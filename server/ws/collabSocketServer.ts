import crypto from 'crypto';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { DEFAULT_SCHOOL_ID } from '../db/LabRepository';
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
import {
  InMemoryRealtimeEventBus,
  type RealtimeEventBus,
} from './realtimeEventBus';
import type { CollabSocketContext, ExtWebSocket, WsHandlerServices } from './wsTypes';
import { logger } from '../utils/logger';

export type { CollabSocketContext, ExtWebSocket } from './wsTypes';
export { applyCustomMissionToRoom } from './wsMissionHandler';

export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_BACKPRESSURE_HIGH_WATERMARK_BYTES = 64 * 1024;
export const WS_DEFAULT_MAX_MESSAGES_PER_SECOND = 60;
export const WS_NON_CRITICAL_HIGH_FREQ_TYPES: ReadonlySet<string> = new Set([
  'CURSOR_3D_MOVE',
  'SPATIAL_CURSOR',
  'PARAM_VALUE_SYNC',
  'PARAM_UPDATE',
  'STUDENT_TELEMETRY_SYNC',
  'TEACHER_LASER_RAY',
  'TEACHER_CAMERA_SYNC',
]);

export interface CollabSocketServerOptions {
  isOriginAllowed?: (origin: string | undefined) => boolean;
  maxMessagesPerSecond?: number;
  eventBus?: RealtimeEventBus;
}

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
 * Per-socket sliding-window rate limiter (default 60 frames/sec).
 */
export function checkWsRateLimit(
  ws: ExtWebSocket,
  maxPerSecond: number = WS_DEFAULT_MAX_MESSAGES_PER_SECOND,
  now = Date.now()
): boolean {
  const cutoff = now - 1000;
  const timestamps = ws.msgTimestamps || [];
  let trimIdx = 0;
  while (trimIdx < timestamps.length && timestamps[trimIdx] < cutoff) {
    trimIdx += 1;
  }
  if (trimIdx > 0) {
    timestamps.splice(0, trimIdx);
  }
  if (timestamps.length >= maxPerSecond) {
    ws.msgTimestamps = timestamps;
    return false;
  }
  timestamps.push(now);
  ws.msgTimestamps = timestamps;
  return true;
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
  state: LabServerState,
  options?: CollabSocketServerOptions
): CollabSocketContext {
  const maxMessagesPerSecond =
    options?.maxMessagesPerSecond ?? WS_DEFAULT_MAX_MESSAGES_PER_SECOND;
  const eventBus: RealtimeEventBus = options?.eventBus ?? new InMemoryRealtimeEventBus();

  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const handleServerUpgrade = (
    req: http.IncomingMessage,
    socket: import('stream').Duplex,
    head: Buffer
  ) => {
    const rawUrl = req.url || '';
    const queryIdx = rawUrl.indexOf('?');
    const pathname = queryIdx !== -1 ? rawUrl.slice(0, queryIdx) : rawUrl;
    if (pathname === '/ws-lab') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  };
  server.on('upgrade', handleServerUpgrade);
  wss.on('close', () => {
    server.off('upgrade', handleServerUpgrade);
  });
  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err?.code !== 'EADDRINUSE') {
      logger.error('WebSocket server error', { error: err });
    }
  });

  let droppedNonCriticalFrames = 0;
  let rateLimitedDrops = 0;
  const onBackpressureDropped = () => {
    droppedNonCriticalFrames += 1;
  };

  interface WsFanoutEvent {
    scope: 'all' | 'room' | 'school' | 'school_teachers';
    targetId: string;
    payload: unknown;
    excludeSocketId?: string;
  }

  const WS_FANOUT_CHANNEL = 'ws:fanout';

  // Subscribe local WebSocket fan-out to RealtimeEventBus (Redis-ready adapter hook)
  const unsubscribeBus = eventBus.subscribe(WS_FANOUT_CHANNEL, (envelope) => {
    const event = envelope.payload as WsFanoutEvent | undefined;
    if (!event || typeof event !== 'object') return;
    const raw = JSON.stringify(event.payload);
    const critical = !isNonCriticalWsFrame(event.payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (event.excludeSocketId && client.socketId === event.excludeSocketId) {
        return;
      }
      if (event.scope === 'room') {
        if (client.roomId === event.targetId) {
          safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
        }
      } else if (event.scope === 'school') {
        const clientSchool = client.schoolId || DEFAULT_SCHOOL_ID;
        if (clientSchool === event.targetId) {
          safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
        }
      } else if (event.scope === 'school_teachers') {
        const clientSchool = client.schoolId || DEFAULT_SCHOOL_ID;
        if (clientSchool === event.targetId && client.role === 'Pengajar') {
          safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
        }
      } else {
        safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
      }
    });
  });

  const broadcastAll = (payload: unknown) => {
    eventBus.publish(WS_FANOUT_CHANNEL, {
      scope: 'all',
      targetId: '*',
      payload,
    } satisfies WsFanoutEvent);
  };

  const broadcastRoom = (
    roomId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const excludeSocketId = (excludeWs as ExtWebSocket | undefined)?.socketId;
    eventBus.publish(WS_FANOUT_CHANNEL, {
      scope: 'room',
      targetId: roomId,
      payload,
      excludeSocketId,
    } satisfies WsFanoutEvent);
  };

  const broadcastSchool = (
    schoolId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const normalizedSchool = schoolId?.trim() || DEFAULT_SCHOOL_ID;
    const excludeSocketId = (excludeWs as ExtWebSocket | undefined)?.socketId;
    eventBus.publish(WS_FANOUT_CHANNEL, {
      scope: 'school',
      targetId: normalizedSchool,
      payload,
      excludeSocketId,
    } satisfies WsFanoutEvent);
  };

  const broadcastSchoolTeachers = (
    schoolId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const normalizedSchool = schoolId?.trim() || DEFAULT_SCHOOL_ID;
    const excludeSocketId = (excludeWs as ExtWebSocket | undefined)?.socketId;
    eventBus.publish(WS_FANOUT_CHANNEL, {
      scope: 'school_teachers',
      targetId: normalizedSchool,
      payload,
      excludeSocketId,
    } satisfies WsFanoutEvent);
  };

  const broadcastGroup = (
    targetGroupId: string | null | undefined,
    payload: unknown,
    excludeWs?: WebSocket,
    roomIdScope?: string,
    schoolIdScope?: string
  ) => {
    if (roomIdScope) {
      broadcastRoom(roomIdScope, payload, excludeWs);
      return;
    }
    const raw = JSON.stringify(payload);
    const critical = !isNonCriticalWsFrame(payload);
    const scopedSchool = schoolIdScope?.trim() || undefined;
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client === excludeWs) return;
      if (scopedSchool && (client.schoolId || DEFAULT_SCHOOL_ID) !== scopedSchool) {
        return;
      }
      if (
        !targetGroupId ||
        client.groupId === targetGroupId ||
        client.role === 'Pengajar' ||
        !client.groupId
      ) {
        safeWsSend(client, raw, { critical, onDropped: onBackpressureDropped });
      }
    });
  };

  const services: WsHandlerServices = {
    state,
    eventBus,
    broadcastAll,
    broadcastRoom,
    broadcastSchool,
    broadcastSchoolTeachers,
    broadcastGroup,
  };

  const heartbeatInterval = setInterval(() => {
    runWsHeartbeatSweep(wss.clients, services);
  }, WS_HEARTBEAT_INTERVAL_MS);
  heartbeatInterval.unref?.();

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    unsubscribeBus();
  });

  wss.on('connection', (socket, req) => {
    const origin = req?.headers?.origin;
    if (options?.isOriginAllowed && !options.isOriginAllowed(origin)) {
      logger.warn('WebSocket connection rejected due to disallowed Origin', {
        origin,
        remoteIp: req?.socket?.remoteAddress,
      });
      socket.close(1008, 'Origin tidak diizinkan oleh kebijakan keamanan.');
      return;
    }

    const ws = socket as ExtWebSocket;
    ws.socketId = `sock-${crypto.randomUUID()}`;
    ws.isAlive = true;
    ws.schoolId = DEFAULT_SCHOOL_ID;
    ws.msgTimestamps = [];
    ws.remoteIp = req?.socket?.remoteAddress || undefined;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    state.pruneExpiredLocks();

    // Do not leak global records/notes/students to unauthenticated sockets on raw connect;
    // scoped state is delivered after client:identify / ROOM_JOIN.
    ws.send(
      JSON.stringify({
        type: 'init:state',
        payload: {
          records: [],
          tasks: [],
          notes: [],
          students: [],
          notifications: [],
          paramLocks: [],
        },
      })
    );

    ws.on('message', (data) => {
      ws.isAlive = true;
      const now = Date.now();
      if (!checkWsRateLimit(ws, maxMessagesPerSecond, now)) {
        rateLimitedDrops += 1;
        if (!ws.rateLimitNotifiedAt || now - ws.rateLimitNotifiedAt > 1000) {
          ws.rateLimitNotifiedAt = now;
          safeWsSend(
            ws,
            {
              type: 'ERROR',
              payload: {
                code: 'RATE_LIMITED',
                message: 'Frekuensi pesan WebSocket melebihi batas aman (maksimal 60 pesan/detik).',
              },
            },
            { critical: true }
          );
        }
        return;
      }

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
            handleRecordCreate(msg.payload, services, ws);
            break;
          case 'record:delete':
            handleRecordDelete(msg.payload.id, services, ws);
            break;
          case 'task:toggle':
            handleTaskToggle(msg.payload, services, ws);
            break;
          case 'task:create':
            handleTaskCreate(msg.payload, services, ws);
            break;
          case 'note:create':
            handleNoteCreate(msg.payload, services, ws);
            break;
          case 'quiz:submit':
            handleQuizSubmit(msg.payload, services, ws);
            break;
          case 'notification:push':
            handleNotificationPush(msg.payload, services, ws);
            break;
          case 'teacher:feedback':
            handleTeacherFeedback(ws, msg.payload, services);
            break;
          case 'mystery:broadcast':
            handleMysteryBroadcast(ws, msg.payload, services);
            break;
          case 'mystery:submit':
            handleMysterySubmit(msg.payload, services, ws);
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
    eventBus,
    broadcastAll,
    broadcastRoom,
    broadcastSchool,
    broadcastSchoolTeachers,
    broadcastGroup,
    getBackpressureStats: () => ({
      droppedNonCriticalFrames,
      rateLimitedDrops,
    }),
  };
}
