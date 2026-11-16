import crypto from 'crypto';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ParameterLockPayload, SpatialCursorPayload } from '../../src/utils/collabProtocol';
import type {
  LabServerState,
  ServerExperimentRecord,
  ServerNotification,
} from '../state/labServerState';
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

  const broadcastAll = (payload: unknown) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  };

  const broadcastRoom = (
    roomId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) => {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (
        client.readyState === WebSocket.OPEN &&
        client.roomId === roomId &&
        client !== excludeWs
      ) {
        client.send(raw);
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
    wss.clients.forEach((c) => {
      const client = c as ExtWebSocket;
      if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
        if (
          !targetGroupId ||
          client.groupId === targetGroupId ||
          client.role === 'Pengajar' ||
          !client.groupId
        ) {
          client.send(raw);
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
            handleRoomCreate(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'ROOM_JOIN':
            handleRoomJoin(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'ROOM_REJOIN':
            handleRoomRejoin(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'SIMULATION_SNAPSHOT_PUSH':
            handleSimulationSnapshotPush(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'ROOM_LEAVE':
            handleRoomLeave(ws, services);
            break;
          case 'TEACHER_FREEZE_TOGGLE':
            handleTeacherFreezeToggle(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'TEACHER_LASER_RAY':
            handleTeacherLaserRay(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'TEACHER_CAMERA_SYNC':
            handleTeacherCameraSync(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'ROOM_SET_CUSTOM_MISSION':
            handleRoomSetCustomMission(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'STUDENT_TELEMETRY_SYNC':
            handleStudentTelemetrySync(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'CURSOR_3D_MOVE':
            handleCursor3DMove(ws, msg.payload as unknown as SpatialCursorPayload, services);
            break;
          case 'CURSOR_3D_LEAVE':
            handleCursor3DLeave(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'PARAM_LOCK_ACQUIRE':
            handleParamLockAcquire(
              ws,
              msg.payload as unknown as ParameterLockPayload,
              services
            );
            break;
          case 'PARAM_LOCK_RELEASE':
            handleParamLockRelease(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'PARAM_LOCK_RESET_ALL':
            handleParamLockResetAll(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'PARAM_VALUE_SYNC':
            handleParamValueSync(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'record:create':
            handleRecordCreate(
              msg.payload as unknown as ServerExperimentRecord,
              services
            );
            break;
          case 'record:delete':
            handleRecordDelete(msg.payload.id, services);
            break;
          case 'task:toggle':
            handleTaskToggle(msg.payload as Record<string, unknown>, services);
            break;
          case 'task:create':
            handleTaskCreate(msg.payload as Record<string, unknown>, services);
            break;
          case 'note:create':
            handleNoteCreate(msg.payload as Record<string, unknown>, services);
            break;
          case 'quiz:submit':
            handleQuizSubmit(msg.payload as Record<string, unknown>, services);
            break;
          case 'notification:push':
            handleNotificationPush(
              msg.payload as unknown as ServerNotification,
              services
            );
            break;
          case 'teacher:feedback':
            handleTeacherFeedback(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'mystery:broadcast':
            handleMysteryBroadcast(ws, msg.payload as Record<string, unknown>, services);
            break;
          case 'mystery:submit':
            handleMysterySubmit(msg.payload as Record<string, unknown>, services);
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

  return { wss, broadcastAll, broadcastRoom, broadcastGroup };
}
