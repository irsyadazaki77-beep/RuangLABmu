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
  applyCustomMissionToRoom,
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
  handleStudentTelemetrySync,
} from './wsRoomManager';
import {
  handleCursor3DLeave,
  handleCursor3DMove,
  handleParamLockAcquire,
  handleParamLockRelease,
  handleParamValueSync,
  handleTeacherCameraSync,
  handleTeacherLaserRay,
} from './wsSpatialSync';
import {
  handleClientIdentify,
  validateWsMessageEnvelope,
  type ClientIdentifyPayload,
} from './wsAuth';
import type { CollabSocketContext, ExtWebSocket, WsHandlerServices } from './wsTypes';

export type { CollabSocketContext, ExtWebSocket } from './wsTypes';
export { applyCustomMissionToRoom } from './wsMissionHandler';

export function createCollabSocketServer(
  server: http.Server,
  state: LabServerState
): CollabSocketContext {
  const wss = new WebSocketServer({ server, path: '/ws-lab', maxPayload: 1024 * 1024 });
  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err?.code !== 'EADDRINUSE') {
      console.error('[RuangLABmu WS Error]:', err);
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

  wss.on('connection', (socket) => {
    const ws = socket as ExtWebSocket;
    ws.socketId = `sock-${crypto.randomUUID()}`;

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
      try {
        const parsed = JSON.parse(data.toString());
        const envelope = validateWsMessageEnvelope(parsed);
        if (!envelope) return;
        const { type: msgType, payload } = envelope;
        const hasPayload = Boolean(
          parsed && typeof parsed === 'object' && 'payload' in parsed && parsed.payload
        );

        switch (msgType) {
          case 'client:identify':
            if (hasPayload) {
              handleClientIdentify(ws, payload as ClientIdentifyPayload, state);
            }
            break;
          case 'ROOM_CREATE':
            if (hasPayload) handleRoomCreate(ws, payload, services);
            break;
          case 'ROOM_JOIN':
            if (hasPayload) handleRoomJoin(ws, payload, services);
            break;
          case 'ROOM_LEAVE':
            handleRoomLeave(ws, services);
            break;
          case 'TEACHER_FREEZE_TOGGLE':
            if (hasPayload) handleTeacherFreezeToggle(ws, payload, services);
            break;
          case 'TEACHER_LASER_RAY':
            if (hasPayload) handleTeacherLaserRay(ws, payload, services);
            break;
          case 'TEACHER_CAMERA_SYNC':
            if (hasPayload) handleTeacherCameraSync(ws, payload, services);
            break;
          case 'ROOM_SET_CUSTOM_MISSION':
            if (hasPayload) handleRoomSetCustomMission(ws, payload, services);
            break;
          case 'STUDENT_TELEMETRY_SYNC':
            if (hasPayload) handleStudentTelemetrySync(ws, payload, services);
            break;
          case 'CURSOR_3D_MOVE':
            if (hasPayload) {
              handleCursor3DMove(ws, payload as unknown as SpatialCursorPayload, services);
            }
            break;
          case 'CURSOR_3D_LEAVE':
            if (hasPayload) handleCursor3DLeave(ws, payload, services);
            break;
          case 'PARAM_LOCK_ACQUIRE':
            if (hasPayload) {
              handleParamLockAcquire(
                ws,
                payload as unknown as ParameterLockPayload,
                services
              );
            }
            break;
          case 'PARAM_LOCK_RELEASE':
            if (hasPayload) handleParamLockRelease(ws, payload, services);
            break;
          case 'PARAM_VALUE_SYNC':
            if (hasPayload) handleParamValueSync(ws, payload, services);
            break;
          case 'record:create':
            if (hasPayload) {
              handleRecordCreate(
                payload as unknown as ServerExperimentRecord,
                services
              );
            }
            break;
          case 'record:delete':
            if (typeof payload.id === 'string') {
              handleRecordDelete(payload.id, services);
            }
            break;
          case 'task:toggle':
            if (typeof payload.id === 'string') {
              handleTaskToggle(payload, services);
            }
            break;
          case 'task:create':
            if (typeof payload.title === 'string') {
              handleTaskCreate(payload, services);
            }
            break;
          case 'note:create':
            if (typeof payload.text === 'string') {
              handleNoteCreate(payload, services);
            }
            break;
          case 'quiz:submit':
            if (hasPayload) handleQuizSubmit(payload, services);
            break;
          case 'notification:push':
            if (hasPayload) {
              handleNotificationPush(
                payload as unknown as ServerNotification,
                services
              );
            }
            break;
          case 'teacher:feedback':
            if (hasPayload) handleTeacherFeedback(ws, payload, services);
            break;
          case 'mystery:broadcast':
            if (hasPayload) handleMysteryBroadcast(ws, payload, services);
            break;
          case 'mystery:submit':
            if (hasPayload) handleMysterySubmit(payload, services);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      cleanupSocketRoomAndLocks(ws, services);
    });
  });

  return { wss, broadcastAll, broadcastRoom, broadcastGroup };
}
