import type { WsPayloadOf } from '../../src/shared/contracts/wsContracts';
import type { CustomAIMissionPayload, LabRoom } from '../../src/utils/collabProtocol';
import { generateSecureRoomPin, hashRoomPin } from '../state/labServerState';
import { sanitizeRoomForBroadcast } from '../utils/collabReconnectSync';
import { authorizeTeacherAction } from './wsAuth';
import type { ExtWebSocket, WsHandlerServices } from './wsTypes';

export function applyCustomMissionToRoom(
  activeLabRooms: Map<string, LabRoom>,
  roomIdRaw: string,
  mission: CustomAIMissionPayload | null,
  teacherName?: string
): LabRoom {
  const targetRoomId = (roomIdRaw || 'LAB-ALPHA').toUpperCase().trim();
  const now = Date.now();
  let room = activeLabRooms.get(targetRoomId) as (LabRoom & { pinHash?: string }) | undefined;
  if (!room) {
    const newPin = generateSecureRoomPin();
    room = {
      roomId: targetRoomId,
      pin: newPin,
      pinHash: hashRoomPin(newPin),
      domain: mission?.domain || 'physics',
      moduleId: mission?.moduleId || 'newton-incline',
      teacherName: teacherName || mission?.createdByTeacher || 'Dr. Hendra Kusuma',
      isFrozenByTeacher: false,
      createdAt: now,
      lastActivityAt: now,
      clients: {},
      customMission: mission,
    };
    activeLabRooms.set(targetRoomId, room);
  } else {
    room.customMission = mission;
    room.lastActivityAt = now;
    if (mission) {
      room.domain = mission.domain;
      room.moduleId = mission.moduleId;
    }
    activeLabRooms.set(targetRoomId, room);
  }
  return room;
}

export function handleRoomSetCustomMission(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'ROOM_SET_CUSTOM_MISSION'>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const targetRoomId = String(payload.roomId || ws.roomId || 'LAB-ALPHA')
    .toUpperCase()
    .trim();

  const existingRoom = state.activeLabRooms.get(targetRoomId);
  if (existingRoom) {
    const auth = authorizeTeacherAction(
      ws,
      payload,
      state.activeLabRooms,
      targetRoomId,
      true
    );
    if (!auth.authorized) return;
  }

  const teacherName =
    typeof payload.teacherName === 'string' && payload.teacherName.trim()
      ? payload.teacherName.trim()
      : ws.userName;
  const customMission = payload.customMission ?? null;

  const updatedRoom = applyCustomMissionToRoom(
    state.activeLabRooms,
    targetRoomId,
    customMission,
    teacherName
  );
  state.pruneIdleRooms();
  const sanitizedRoom = sanitizeRoomForBroadcast(updatedRoom);

  state.recordAuditLog({
    schoolId: updatedRoom.schoolId || ws.schoolId || 'default-school',
    actorId: ws.sessionClaims?.sub || ws.userId || ws.socketId,
    actorName: teacherName || ws.userName || 'Pengajar',
    actorRole: 'teacher',
    action: 'MISSION_PUBLISHED',
    targetType: 'room',
    targetId: updatedRoom.roomId,
    metadata: { missionId: updatedRoom.customMission?.id || null },
    ipAddress: ws.remoteIp,
  });

  broadcastRoom(updatedRoom.roomId, {
    type: 'ROOM_MISSION_UPDATED',
    payload: {
      roomId: updatedRoom.roomId,
      customMission: updatedRoom.customMission || null,
      room: sanitizedRoom,
    },
  });
  broadcastRoom(updatedRoom.roomId, {
    type: 'ROOM_STATE_SYNC',
    payload: { room: sanitizedRoom },
  });
}

export function handleTeacherFreezeToggle(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'TEACHER_FREEZE_TOGGLE'>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const auth = authorizeTeacherAction(
    ws,
    payload,
    state.activeLabRooms,
    typeof payload.roomId === 'string' ? payload.roomId : undefined,
    true
  );
  if (!auth.room) return;
  if (!auth.authorized) return;

  auth.room.isFrozenByTeacher = Boolean(payload.isFrozen);
  state.touchLabRoom(auth.targetRoomId);
  const teacherName =
    typeof payload.teacherName === 'string' && payload.teacherName.trim()
      ? payload.teacherName.trim()
      : ws.userName || auth.room.teacherName || 'Guru';

  state.recordAuditLog({
    schoolId: auth.room.schoolId || ws.schoolId || 'default-school',
    actorId: ws.sessionClaims?.sub || ws.userId || ws.socketId,
    actorName: teacherName,
    actorRole: 'teacher',
    action: 'TEACHER_FREEZE_TOGGLE',
    targetType: 'room',
    targetId: auth.targetRoomId,
    metadata: { isFrozen: auth.room.isFrozenByTeacher },
    ipAddress: ws.remoteIp,
  });

  broadcastRoom(auth.targetRoomId, {
    type: 'TEACHER_FREEZE_TOGGLE',
    payload: {
      roomId: auth.targetRoomId,
      isFrozen: auth.room.isFrozenByTeacher,
      teacherName,
    },
  });
  broadcastRoom(auth.targetRoomId, {
    type: 'ROOM_STATE_SYNC',
    payload: { room: sanitizeRoomForBroadcast(auth.room) },
  });
}
