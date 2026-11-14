import crypto from 'crypto';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ParameterLockPayload, SpatialCursorPayload } from '../../src/utils/collabProtocol';
import type {
  LabServerState,
  ServerExperimentRecord,
  ServerNotification,
} from '../state/labServerState';
import { applyCustomMissionToRoom, handleRoomSetCustomMission } from './customMissionHandlers';
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
  handleTeacherFreezeToggle,
} from './roomHandlers';
import {
  handleCursor3DLeave,
  handleCursor3DMove,
  handleParamLockAcquire,
  handleParamLockRelease,
  handleParamValueSync,
  handleTeacherCameraSync,
  handleTeacherLaserRay,
} from './spatialCameraHandlers';
import { handleClientIdentify, type ClientIdentifyPayload } from './wsAuth';
import type { CollabSocketContext, ExtWebSocket, WsHandlerServices } from './wsTypes';

export type { CollabSocketContext, ExtWebSocket } from './wsTypes';
export { applyCustomMissionToRoom } from './customMissionHandlers';

export function createCollabSocketServer(
  server: http.Server,
  state: LabServerState
): CollabSocketContext {
  const wss = new WebSocketServer({ server, path: '/ws-lab', maxPayload: 1024 * 1024 });

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
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          payload?: Record<string, unknown>;
        };
        if (!msg || typeof msg.type !== 'string') return;
        const payload = (msg.payload && typeof msg.payload === 'object' ? msg.payload : {}) as Record<
          string,
          unknown
        >;

        switch (msg.type) {
          case 'client:identify':
            if (msg.payload) {
              handleClientIdentify(ws, payload as ClientIdentifyPayload, state);
            }
            break;
          case 'ROOM_CREATE':
            if (msg.payload) handleRoomCreate(ws, payload, services);
            break;
          case 'ROOM_JOIN':
            if (msg.payload) handleRoomJoin(ws, payload, services);
            break;
          case 'ROOM_LEAVE':
            handleRoomLeave(ws, services);
            break;
          case 'TEACHER_FREEZE_TOGGLE':
            if (msg.payload) handleTeacherFreezeToggle(ws, payload, services);
            break;
          case 'TEACHER_LASER_RAY':
            if (msg.payload) handleTeacherLaserRay(ws, payload, services);
            break;
          case 'TEACHER_CAMERA_SYNC':
            if (msg.payload) handleTeacherCameraSync(ws, payload, services);
            break;
          case 'ROOM_SET_CUSTOM_MISSION':
            if (msg.payload) handleRoomSetCustomMission(ws, payload, services);
            break;
          case 'STUDENT_TELEMETRY_SYNC':
            if (msg.payload) handleStudentTelemetrySync(ws, payload, services);
            break;
          case 'CURSOR_3D_MOVE':
            if (msg.payload) {
              handleCursor3DMove(ws, payload as unknown as SpatialCursorPayload, services);
            }
            break;
          case 'CURSOR_3D_LEAVE':
            if (msg.payload) handleCursor3DLeave(ws, payload, services);
            break;
          case 'PARAM_LOCK_ACQUIRE':
            if (msg.payload) {
              handleParamLockAcquire(
                ws,
                payload as unknown as ParameterLockPayload,
                services
              );
            }
            break;
          case 'PARAM_LOCK_RELEASE':
            if (msg.payload) handleParamLockRelease(ws, payload, services);
            break;
          case 'PARAM_VALUE_SYNC':
            if (msg.payload) handleParamValueSync(ws, payload, services);
            break;
          case 'record:create':
            if (msg.payload) {
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
            if (msg.payload) handleQuizSubmit(payload, services);
            break;
          case 'notification:push':
            if (msg.payload) {
              handleNotificationPush(
                payload as unknown as ServerNotification,
                services
              );
            }
            break;
          case 'teacher:feedback':
            if (msg.payload) handleTeacherFeedback(ws, payload, services);
            break;
          case 'mystery:broadcast':
            if (msg.payload) handleMysteryBroadcast(ws, payload, services);
            break;
          case 'mystery:submit':
            if (msg.payload) handleMysterySubmit(payload, services);
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
