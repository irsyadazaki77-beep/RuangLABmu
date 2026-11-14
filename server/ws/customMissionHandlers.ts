import type { CustomAIMissionPayload, LabRoom } from '../../src/utils/collabProtocol';
import { generateSecureRoomPin } from '../state/labServerState';
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
  let room = activeLabRooms.get(targetRoomId);
  if (!room) {
    room = {
      roomId: targetRoomId,
      pin: generateSecureRoomPin(),
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
  }
  return room;
}

export function handleRoomSetCustomMission(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastAll, broadcastRoom } = services;
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
  const customMission =
    (payload.customMission as CustomAIMissionPayload | null | undefined) ?? null;

  const updatedRoom = applyCustomMissionToRoom(
    state.activeLabRooms,
    targetRoomId,
    customMission,
    teacherName
  );
  state.pruneIdleRooms();

  broadcastAll({
    type: 'ROOM_MISSION_UPDATED',
    payload: {
      roomId: updatedRoom.roomId,
      customMission: updatedRoom.customMission || null,
      room: updatedRoom,
    },
  });
  broadcastRoom(updatedRoom.roomId, {
    type: 'ROOM_STATE_SYNC',
    payload: { room: updatedRoom },
  });
}
