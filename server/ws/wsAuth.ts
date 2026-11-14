import { verifyTeacherAuthorization } from '../../src/utils/submissionPersistence';
import type { LabRoom } from '../../src/utils/collabProtocol';
import type { LabServerState } from '../state/labServerState';
import type { ExtWebSocket } from './wsTypes';

export interface ClientIdentifyPayload {
  userId?: string;
  userName?: string;
  groupId?: string;
  domain?: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  roomId?: string;
  role?: string;
  teacherPin?: string;
  pin?: string;
  teacherToken?: string;
}

export function handleClientIdentify(
  ws: ExtWebSocket,
  payload: ClientIdentifyPayload,
  state: LabServerState
): void {
  ws.userId = payload.userId;
  ws.userName = payload.userName;
  ws.groupId = payload.groupId;
  ws.domain = payload.domain;
  if (typeof payload.roomId === 'string' && payload.roomId.trim()) {
    ws.roomId = payload.roomId.toUpperCase().trim();
  }
  const activeRoom = ws.roomId ? state.activeLabRooms.get(ws.roomId) : undefined;
  const authCheck = verifyTeacherAuthorization({
    socketId: ws.socketId,
    claimedRole: payload.role,
    providedPin: payload.teacherPin || payload.pin,
    providedToken: payload.teacherToken,
    roomPin: activeRoom?.pin,
    roomTeacherSocketId: activeRoom?.teacherSocketId,
    isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
  });
  ws.role = authCheck.authorized ? 'Pengajar' : 'Siswa';
}

export function authorizeTeacherAction(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  activeLabRooms: Map<string, LabRoom>,
  roomIdRaw?: string,
  emitUnauthorizedError = false
): { authorized: boolean; room?: LabRoom; targetRoomId: string } {
  const targetRoomId = String(roomIdRaw || payload.roomId || ws.roomId || '')
    .toUpperCase()
    .trim();
  const room = targetRoomId ? activeLabRooms.get(targetRoomId) : undefined;

  const providedPin =
    typeof payload.teacherPin === 'string'
      ? payload.teacherPin
      : typeof payload.pin === 'string'
      ? payload.pin
      : undefined;
  const providedToken =
    typeof payload.teacherToken === 'string' ? payload.teacherToken : undefined;

  const authCheck = verifyTeacherAuthorization({
    socketId: ws.socketId,
    claimedRole: 'Pengajar',
    providedPin,
    providedToken,
    roomPin: room?.pin,
    roomTeacherSocketId: room?.teacherSocketId,
    isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
  });

  if (!authCheck.authorized && emitUnauthorizedError) {
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message: authCheck.reason || 'Akses Pengajar ditolak.',
          code: 'UNAUTHORIZED_TEACHER',
        },
      })
    );
  }

  return { authorized: authCheck.authorized, room, targetRoomId };
}
