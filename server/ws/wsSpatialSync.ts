import {
  ParameterLockPayload,
  SpatialCursorPayload,
  validateTeacherCameraSyncPayload,
  validateTeacherLaserRayPayload,
} from '../../src/utils/collabProtocol';
import { authorizeTeacherAction } from './wsAuth';
import type { ExtWebSocket, WsHandlerServices } from './wsTypes';

export function handleTeacherLaserRay(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom, broadcastGroup } = services;
  const targetRoomId = String(payload.roomId || ws.roomId || 'LAB-ALPHA')
    .toUpperCase()
    .trim();
  const auth = authorizeTeacherAction(ws, payload, state.activeLabRooms, targetRoomId);
  if (!auth.authorized) return;

  const validated = validateTeacherLaserRayPayload({
    ...payload,
    roomId: targetRoomId,
    teacherName:
      (typeof payload.teacherName === 'string' && payload.teacherName.trim()) ||
      ws.userName ||
      auth.room?.teacherName ||
      'Pengajar',
  });
  if (!validated) return;

  if (auth.room) {
    state.touchLabRoom(targetRoomId);
    broadcastRoom(targetRoomId, { type: 'TEACHER_LASER_RAY', payload: validated }, ws);
  } else {
    broadcastGroup(
      ws.groupId,
      { type: 'TEACHER_LASER_RAY', payload: validated },
      ws,
      ws.roomId
    );
  }
}

export function handleTeacherCameraSync(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom, broadcastGroup } = services;
  const targetRoomId = String(payload.roomId || ws.roomId || 'LAB-ALPHA')
    .toUpperCase()
    .trim();
  const auth = authorizeTeacherAction(ws, payload, state.activeLabRooms, targetRoomId);
  if (!auth.authorized) return;

  const validated = validateTeacherCameraSyncPayload({
    ...payload,
    roomId: targetRoomId,
    teacherName:
      (typeof payload.teacherName === 'string' && payload.teacherName.trim()) ||
      ws.userName ||
      auth.room?.teacherName ||
      'Pengajar',
  });
  if (!validated) return;

  if (auth.room) {
    state.touchLabRoom(targetRoomId);
    broadcastRoom(targetRoomId, { type: 'TEACHER_CAMERA_SYNC', payload: validated }, ws);
  } else {
    broadcastGroup(
      ws.groupId,
      { type: 'TEACHER_CAMERA_SYNC', payload: validated },
      ws,
      ws.roomId
    );
  }
}

export function handleCursor3DMove(
  ws: ExtWebSocket,
  payload: SpatialCursorPayload,
  services: WsHandlerServices
): void {
  ws.userId = payload.userId;
  ws.userName = payload.userName;
  ws.role = payload.role;
  ws.groupId = payload.groupId;
  ws.domain = payload.domain;

  services.broadcastGroup(
    payload.groupId,
    { type: 'CURSOR_3D_MOVE', payload },
    ws,
    ws.roomId
  );
}

export function handleCursor3DLeave(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  services.broadcastGroup(
    typeof payload.groupId === 'string' ? payload.groupId : undefined,
    { type: 'CURSOR_3D_LEAVE', payload },
    ws,
    ws.roomId
  );
}

export function handleParamLockAcquire(
  ws: ExtWebSocket,
  reqLock: ParameterLockPayload,
  services: WsHandlerServices
): void {
  const { state, broadcastGroup } = services;
  ws.userId = reqLock.lockedByUserId;
  ws.userName = reqLock.lockedByName;
  ws.groupId = reqLock.groupId;

  const lockKey = `${ws.roomId || reqLock.groupId}:${reqLock.paramKey}`;
  const existing = state.parameterLocks.get(lockKey);
  const now = Date.now();

  if (
    !existing ||
    now > existing.expiresAt ||
    existing.lockedByUserId === reqLock.lockedByUserId
  ) {
    const grantedLock: ParameterLockPayload = {
      ...reqLock,
      expiresAt:
        now +
        (reqLock.expiresAt && reqLock.expiresAt > now
          ? Math.min(reqLock.expiresAt - now, 8000)
          : 5000),
    };
    state.parameterLocks.set(lockKey, grantedLock);
    state.pruneExpiredLocks(now);
    broadcastGroup(
      reqLock.groupId,
      { type: 'PARAM_LOCK_ACQUIRE', payload: grantedLock },
      undefined,
      ws.roomId
    );
  }
}

export function handleParamLockRelease(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastGroup } = services;
  const groupId = typeof payload.groupId === 'string' ? payload.groupId : '';
  const paramKey = typeof payload.paramKey === 'string' ? payload.paramKey : '';
  const userId = typeof payload.userId === 'string' ? payload.userId : '';

  const lockKey = `${ws.roomId || groupId}:${paramKey}`;
  const existing = state.parameterLocks.get(lockKey);
  if (existing && existing.lockedByUserId === userId) {
    state.parameterLocks.delete(lockKey);
    broadcastGroup(
      groupId,
      { type: 'PARAM_LOCK_RELEASE', payload },
      undefined,
      ws.roomId
    );
  }
}

export function handleParamValueSync(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  services.broadcastGroup(
    typeof payload.groupId === 'string' ? payload.groupId : undefined,
    { type: 'PARAM_VALUE_SYNC', payload },
    ws,
    ws.roomId
  );
}
