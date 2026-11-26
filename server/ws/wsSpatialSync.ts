import type { WsPayloadOf } from '../../src/shared/contracts/wsContracts';
import {
  ParameterLockPayload,
  validateTeacherCameraSyncPayload,
  validateTeacherLaserRayPayload,
} from '../../src/utils/collabProtocol';
import { authorizeTeacherAction } from './wsAuth';
import type { ExtWebSocket, WsHandlerServices } from './wsTypes';

export function handleTeacherLaserRay(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'TEACHER_LASER_RAY'>,
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
      ws.roomId,
      ws.schoolId
    );
  }
}

export function handleTeacherCameraSync(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'TEACHER_CAMERA_SYNC'>,
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
      ws.roomId,
      ws.schoolId
    );
  }
}

export function handleCursor3DMove(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'CURSOR_3D_MOVE'>,
  services: WsHandlerServices
): void {
  ws.userId = payload.userId;
  ws.userName = payload.userName;
  // Never allow an unverified socket to escalate ws.role to 'Pengajar' via CURSOR_3D_MOVE
  const effectiveRole: 'Siswa' | 'Pengajar' =
    ws.role === 'Pengajar' ? 'Pengajar' : 'Siswa';
  ws.role = effectiveRole;
  ws.groupId = payload.groupId;
  ws.domain = payload.domain;

  services.broadcastGroup(
    payload.groupId,
    { type: 'CURSOR_3D_MOVE', payload: { ...payload, role: effectiveRole } },
    ws,
    ws.roomId,
    ws.schoolId
  );
}

export function handleCursor3DLeave(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'CURSOR_3D_LEAVE'>,
  services: WsHandlerServices
): void {
  services.broadcastGroup(
    payload.groupId,
    { type: 'CURSOR_3D_LEAVE', payload },
    ws,
    ws.roomId,
    ws.schoolId
  );
}

export function handleParamLockAcquire(
  ws: ExtWebSocket,
  reqLock: WsPayloadOf<'PARAM_LOCK_ACQUIRE'>,
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
    const grantedLock: ParameterLockPayload & { roomId?: string; schoolId?: string } = {
      ...reqLock,
      ...(ws.roomId ? { roomId: ws.roomId } : {}),
      ...(ws.schoolId ? { schoolId: ws.schoolId } : {}),
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
      ws.roomId,
      ws.schoolId
    );
  }
}

export function handleParamLockRelease(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'PARAM_LOCK_RELEASE'>,
  services: WsHandlerServices
): void {
  const { state, broadcastGroup } = services;
  const { groupId, paramKey, userId } = payload;

  const lockKey = `${ws.roomId || groupId}:${paramKey}`;
  const existing = state.parameterLocks.get(lockKey);
  if (existing && existing.lockedByUserId === userId) {
    state.parameterLocks.delete(lockKey);
    broadcastGroup(
      groupId,
      { type: 'PARAM_LOCK_RELEASE', payload },
      undefined,
      ws.roomId,
      ws.schoolId
    );
  }
}

export function handleParamValueSync(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'PARAM_VALUE_SYNC'>,
  services: WsHandlerServices
): void {
  services.broadcastGroup(
    payload.groupId,
    { type: 'PARAM_VALUE_SYNC', payload },
    ws,
    ws.roomId,
    ws.schoolId
  );
}

export function handleParamLockResetAll(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'PARAM_LOCK_RESET_ALL'>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom, broadcastAll } = services;
  const auth = authorizeTeacherAction(
    ws,
    payload,
    state.activeLabRooms,
    typeof payload.roomId === 'string' ? payload.roomId : undefined,
    true
  );
  if (!auth.authorized) return;

  const targetRoomId = auth.targetRoomId;
  const teacherSchoolId = ws.schoolId || auth.room?.schoolId || 'default-school';
  const targetGroupId =
    typeof payload.groupId === 'string' && payload.groupId.trim()
      ? payload.groupId.trim()
      : undefined;

  let clearedCount = 0;
  for (const [key, lock] of Array.from(state.parameterLocks.entries())) {
    const lockMeta = lock as ParameterLockPayload & { roomId?: string; schoolId?: string };
    const lockSchoolId = lockMeta.schoolId || 'default-school';
    if (lockSchoolId !== teacherSchoolId) {
      continue;
    }
    const keyPrefix = key.split(':')[0]?.toUpperCase().trim();
    const lockRoomId = lockMeta.roomId ? lockMeta.roomId.toUpperCase().trim() : undefined;
    const isKnownOtherRoom =
      (lockRoomId && lockRoomId !== targetRoomId) ||
      (state.activeLabRooms.has(keyPrefix) && keyPrefix !== targetRoomId);
    if (isKnownOtherRoom) {
      continue;
    }
    const matchesRoom =
      keyPrefix === targetRoomId ||
      lockRoomId === targetRoomId ||
      (targetRoomId === 'LAB-ALPHA' && !lockRoomId && !state.activeLabRooms.has(keyPrefix));
    const matchesGroup = Boolean(targetGroupId && lock.groupId === targetGroupId);
    if (matchesRoom || matchesGroup) {
      state.parameterLocks.delete(key);
      clearedCount += 1;
    }
  }

  const syncMsg = {
    type: 'PARAM_LOCKS_SYNC',
    payload: {
      roomId: targetRoomId,
      locks: [],
    },
  };
  const resetMsg = {
    type: 'PARAM_LOCK_RESET_ALL',
    payload: {
      roomId: targetRoomId,
      clearedCount,
    },
  };

  if (ws.roomId || payload.roomId) {
    broadcastRoom(targetRoomId, syncMsg);
    broadcastRoom(targetRoomId, resetMsg);
  } else if (services.broadcastSchool) {
    services.broadcastSchool(teacherSchoolId, syncMsg);
    services.broadcastSchool(teacherSchoolId, resetMsg);
  } else {
    broadcastAll(syncMsg);
    broadcastAll(resetMsg);
  }
}
