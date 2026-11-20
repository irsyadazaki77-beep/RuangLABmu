import crypto from 'crypto';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { LabServerState } from '../state/labServerState';
import {
  handleRoomSetCustomMission,
  handleTeacherFreezeToggle,
} from './wsMissionHandler';
import {
  handleMysteryBroadcast,
  handleMysterySubmit,
  handleNoteCreate,
  handleNotificationPush,
  handleQuizSubmit,
  handleRecordCreate,
  handleRecordDelete,
  handleTaskCreate,
  handleTaskToggle,
  handleTeacherFeedback,
} from './labActivityHandlers';
import {
  cleanupSocketRoomAndLocks,
  handleRoomCreate,
  handleRoomJoin,
  handleRoomLeave,
  handleRoomRejoin,
  handleSimulationSnapshotPush,
  handleStudentTelemetrySync,
} from './wsRoomManager';
import {
  handleCursor3DLeave,
  handleCursor3DMove,
  handleParamLockAcquire,
  handleParamLockRelease,
  handleParamLockResetAll,
  handleParamValueSync,
  handleTeacherCameraSync,
  handleTeacherLaserRay,
} from './wsSpatialSync';
import {
  handleClientIdentify,
  parseClientToServerWsMessage,
} from './wsAuth';
import type { CollabSocketContext, ExtWebSocket, WsHandlerServices } from './wsTypes';
import { logger } from '../utils/logger';

export type { CollabSocketContext, ExtWebSocket } from './wsTypes';
export { applyCustomMissionToRoom } from './wsMissionHandler';

export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_BACKPRESSURE_HIGH_WATERMARK_BYTES = 64 * 1024;
export const WS_NON_CRITICAL_HIGH_FREQ_TYPES: ReadonlySet<string> = new Set([
  'CURSOR_3D_MOVE',
  'SPATIAL_CURSOR',
  'PARAM_VALUE_SYNC',
  'PARAM_UPDATE',
  'STUDENT_TELEMETRY_SYNC',
  'TEACHER_LASER_RAY',
  'TEACHER_CAMERA_SYNC',
]);

export function isNonCriticalWsFrame(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const msgType = (payload as { type?: unknown }).type;
  return typeof msgType === 'string' && WS_NON_CRITICAL_HIGH_FREQ_TYPES.has(msgType);
}

export interface SafeWsSendOptions {
  critical: boolean;
  highWatermarkBytes?: number;
  onDropped?: () => void;
}

/**
 * Backpressure guard for slow/3T WebSocket clients: skips sending high-frequency
 * non-critical frames when the client send buffer exceeds the high watermark (64 KB),
 * preventing server memory spikes while keeping critical state/lock frames delivered.
 */
export function safeWsSend(
  client: Pick<WebSocket, 'readyState' | 'bufferedAmount' | 'send'>,
  payload: unknown,
  options: SafeWsSendOptions
): boolean {
  if (client.readyState !== WebSocket.OPEN) {
    return false;
  }
  const highWatermarkBytes =
    options.highWatermarkBytes ?? WS_BACKPRESSURE_HIGH_WATERMARK_BYTES;
  const buffered = typeof client.bufferedAmount === 'number' ? client.bufferedAmount : 0;
  if (!options.critical && buffered > highWatermarkBytes) {
    options.onDropped?.();
    return false;
  }
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    client.send(raw);
    return true;
  } catch {
    return false;
  }
}

export function safeSendWsMessage(
  client: Pick<WebSocket, 'readyState' | 'bufferedAmount' | 'send'>,
  raw: string,
  nonCritical: boolean,
  highWatermarkBytes: number = WS_BACKPRESSURE_HIGH_WATERMARK_BYTES,
  onDropped?: () => void
): boolean {
  return safeWsSend(client, raw, {
    critical: !nonCritical,
    highWatermarkBytes,
    onDropped,
  });
}

/**
 * Executes a single heartbeat sweep across all connected WebSocket clients.
 * Terminates and cleans up any zombie 3T socket that failed to respond with `pong`
 * since the previous sweep, releasing its `parameterLocks` and `room.teacherSocketId`.
 */
export function runWsHeartbeatSweep(
  clients: Iterable<WebSocket>,
  services: WsHandlerServices
): number {
  let terminatedCount = 0;
  for (const rawClient of clients) {
    const ws = rawClient as ExtWebSocket;
    if (ws.isAlive === false) {
      cleanupSocketRoomAndLocks(ws, services);
      try {
        ws.terminate();
      } catch {
        // Ignore terminate error on already closed socket
      }
      terminatedCount += 1;
    } else {
      ws.isAlive = false;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      } catch {
        // Ignore ping error on closing socket
      }
    }
  }
  services.state.pruneExpiredLocks();
  services.state.pruneIdleRooms();
  return terminatedCount;
}

export function createCollabSocketServer(
  server: http.Server,
  state: LabServerState
): CollabSocketContext {
  const wss = new WebSocketServer({ server, path: '/ws-lab', maxPayload: 1024 * 1024 });
  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err?.code !== 'EADDRINUSE') {
      logger.error('WebSocket server error', { error: err });
    }
  });

  let droppedNonCriticalFrames = 0;
  const onBackpressureDropped = () => {
    droppedNonCriticalFrames += 1;
  };

  const broadcastAll = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    const critical = !isNonCriticalWsFrame(payload);
    wss.clients.forEach((client) => {
      safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
    });
  };

  const broadcastRoom = (
    roomId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const raw = JSON.stringify(payload);
    const critical = !isNonCriticalWsFrame(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client.roomId === roomId && client !== excludeWs) {
        safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
      }
    });
  };

  const broadcastGroup = (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string
  ) => {
    if (roomIdScope) {
      broadcastRoom(roomIdScope, payload, excludeWs);
      return;
    }
    const raw = JSON.stringify(payload);
    const critical = !isNonCriticalWsFrame(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client !== excludeWs) {
        if (
          !targetGroupId ||
          client.groupId === targetGroupId ||
          client.role === 'Pengajar' ||
          !client.groupId
        ) {
          safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
        }
      }
    });
  };

  const services: WsHandlerServices = {
    state,
    broadcastAll,
    broadcastRoom,
    broadcastGroup,
  };

  const heartbeatInterval = setInterval(() => {
    runWsHeartbeatSweep(wss.clients, services);
  }, WS_HEARTBEAT_INTERVAL_MS);
  heartbeatInterval.unref?.();

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (socket, req) => {
    const ws = socket as ExtWebSocket;
    ws.socketId = `sock-${crypto.randomUUID()}`;
    ws.isAlive = true;
    ws.remoteIp = req?.socket?.remoteAddress || undefined;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    state.pruneExpiredLocks();

    ws.send(
      JSON.stringify({
        type: 'init:state',
        payload: {
          records: state.experimentRecords,
          tasks: state.groupTasks,
          notes: state.collabNotes,
          students: state.studentRoster,
          notifications: state.notifications,
          paramLocks: Array.from(state.parameterLocks.values()),
        },
      })
    );

    ws.on('message', (data) => {
      ws.isAlive = true;
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(data.toString());
      } catch (err) {
        logger.warn('Malformed WebSocket JSON frame rejected', {
          participantId: ws.userId,
          roomId: ws.roomId,
          error: err instanceof Error ? err.message : 'Invalid JSON',
        });
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            payload: {
              code: 'VALIDATION_ERROR',
              message: 'Format JSON pesan WebSocket tidak valid.',
              issues: [{ path: '', message: 'Malformed JSON frame' }],
            },
          })
        );
        return;
      }

      const validation = parseClientToServerWsMessage(parsedRaw);
      if (!validation.ok) {
        logger.warn('WebSocket message failed Zod contract validation', {
          participantId: ws.userId,
          roomId: ws.roomId,
          issues: validation.issues,
        });
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            payload: {
              code: 'VALIDATION_ERROR',
              message: validation.message,
              issues: validation.issues,
            },
          })
        );
        return;
      }

      try {
        const msg = validation.message;
        switch (msg.type) {
          case 'client:identify':
            handleClientIdentify(ws, msg.payload, state);
            break;
          case 'ROOM_CREATE':
            handleRoomCreate(ws, msg.payload, services);
            break;
          case 'ROOM_JOIN':
            handleRoomJoin(ws, msg.payload, services);
            break;
          case 'ROOM_REJOIN':
            handleRoomRejoin(ws, msg.payload, services);
            break;
          case 'SIMULATION_SNAPSHOT_PUSH':
            handleSimulationSnapshotPush(ws, msg.payload, services);
            break;
          case 'ROOM_LEAVE':
            handleRoomLeave(ws, services);
            break;
          case 'TEACHER_FREEZE_TOGGLE':
            handleTeacherFreezeToggle(ws, msg.payload, services);
            break;
          case 'TEACHER_LASER_RAY':
            handleTeacherLaserRay(ws, msg.payload, services);
            break;
          case 'TEACHER_CAMERA_SYNC':
            handleTeacherCameraSync(ws, msg.payload, services);
            break;
          case 'ROOM_SET_CUSTOM_MISSION':
            handleRoomSetCustomMission(ws, msg.payload, services);
            break;
          case 'STUDENT_TELEMETRY_SYNC':
            handleStudentTelemetrySync(ws, msg.payload, services);
            break;
          case 'CURSOR_3D_MOVE':
            handleCursor3DMove(ws, msg.payload, services);
            break;
          case 'CURSOR_3D_LEAVE':
            handleCursor3DLeave(ws, msg.payload, services);
            break;
          case 'PARAM_LOCK_ACQUIRE':
            handleParamLockAcquire(ws, msg.payload, services);
            break;
          case 'PARAM_LOCK_RELEASE':
            handleParamLockRelease(ws, msg.payload, services);
            break;
          case 'PARAM_LOCK_RESET_ALL':
            handleParamLockResetAll(ws, msg.payload, services);
            break;
          case 'PARAM_VALUE_SYNC':
            handleParamValueSync(ws, msg.payload, services);
            break;
          case 'record:create':
            handleRecordCreate(msg.payload, services);
            break;
          case 'record:delete':
            handleRecordDelete(msg.payload.id, services);
            break;
          case 'task:toggle':
            handleTaskToggle(msg.payload, services);
            break;
          case 'task:create':
            handleTaskCreate(msg.payload, services);
            break;
          case 'note:create':
            handleNoteCreate(msg.payload, services);
            break;
          case 'quiz:submit':
            handleQuizSubmit(msg.payload, services);
            break;
          case 'notification:push':
            handleNotificationPush(msg.payload, services);
            break;
          case 'teacher:feedback':
            handleTeacherFeedback(ws, msg.payload, services);
            break;
          case 'mystery:broadcast':
            handleMysteryBroadcast(ws, msg.payload, services);
            break;
          case 'mystery:submit':
            handleMysterySubmit(msg.payload, services);
            break;
          default:
            break;
        }
      } catch (err) {
        logger.error('WebSocket message dispatch error', {
          participantId: ws.userId,
          roomId: ws.roomId,
          error: err,
        });
      }
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client socket error', {
        participantId: ws.userId,
        roomId: ws.roomId,
        error: err,
      });
      cleanupSocketRoomAndLocks(ws, services);
    });

    ws.on('close', () => {
      cleanupSocketRoomAndLocks(ws, services);
    });
  });

  return {
    wss,
    broadcastAll,
    broadcastRoom,
    broadcastGroup,
    getBackpressureStats: () => ({ droppedNonCriticalFrames }),
  };
}
