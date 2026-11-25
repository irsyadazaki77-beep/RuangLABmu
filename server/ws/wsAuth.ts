import { verifyTeacherAuthorization } from '../../src/utils/submissionPersistence';
import {
  ClientToServerMessageSchema,
  type ClientIdentifyPayload,
  type ClientToServerMessage,
  type WsValidationIssue,
} from '../../src/shared/contracts/wsContracts';
import type { LabRoom } from '../../src/utils/collabProtocol';
import { verifySessionToken } from '../auth/sessionToken';
import { DEFAULT_SCHOOL_ID } from '../db/LabRepository';
import type { LabServerState } from '../state/labServerState';
import type { ExtWebSocket } from './wsTypes';

export type { ClientIdentifyPayload, ClientToServerMessage };

export type ParsedWsMessageResult =
  | { ok: true; message: ClientToServerMessage }
  | { ok: false; message: string; issues: WsValidationIssue[] };

export function parseClientToServerWsMessage(raw: unknown): ParsedWsMessageResult {
  const parsed = ClientToServerMessageSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: WsValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return {
      ok: false,
      message: issues[0]?.message || 'Pesan WebSocket tidak memenuhi kontrak skema.',
      issues,
    };
  }
  return { ok: true, message: parsed.data };
}

export function validateWsMessageEnvelope(raw: unknown): {
  type: string;
  payload: Record<string, unknown>;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as { type?: unknown; payload?: unknown };
  if (typeof msg.type !== 'string' || !msg.type.trim()) return null;
  const payload =
    msg.payload && typeof msg.payload === 'object' && !Array.isArray(msg.payload)
      ? (msg.payload as Record<string, unknown>)
      : {};
  return { type: msg.type, payload };
}

export function applySessionTokenToSocket(
  ws: ExtWebSocket,
  token: string | undefined
): boolean {
  if (!token || typeof token !== 'string' || !token.trim()) return false;
  const claims = verifySessionToken(token.trim());
  if (!claims) return false;
  ws.sessionClaims = claims;
  ws.schoolId = claims.schoolId || DEFAULT_SCHOOL_ID;
  if (!ws.userId) {
    ws.userId = claims.sub;
  }
  if (!ws.userName) {
    ws.userName = claims.displayName;
  }
  if (claims.role === 'teacher' || claims.role === 'admin') {
    ws.role = 'Pengajar';
    return true;
  }
  return false;
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
  if (typeof payload.schoolId === 'string' && payload.schoolId.trim()) {
    ws.schoolId = payload.schoolId.trim();
  } else if (!ws.schoolId) {
    ws.schoolId = DEFAULT_SCHOOL_ID;
  }

  const tokenVerifiedTeacher = applySessionTokenToSocket(
    ws,
    payload.sessionToken || payload.teacherToken
  );

  const activeRoom = ws.roomId
    ? (state.activeLabRooms.get(ws.roomId) as (LabRoom & { pinHash?: string }) | undefined)
    : undefined;
  if (activeRoom?.schoolId && !ws.sessionClaims) {
    ws.schoolId = activeRoom.schoolId;
  }

  if (tokenVerifiedTeacher) {
    ws.role = 'Pengajar';
    return;
  }

  const authCheck = verifyTeacherAuthorization({
    socketId: ws.socketId,
    claimedRole: payload.role,
    providedPin: payload.teacherPin || payload.pin,
    providedToken: payload.teacherToken,
    roomTeacherSocketId: activeRoom?.teacherSocketId,
    isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar',
  });
  ws.role = authCheck.authorized ? 'Pengajar' : 'Siswa';

  if (ws.sessionClaims || ws.roomId) {
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
  }
}

export interface TeacherAuthPayloadFields {
  roomId?: string;
  teacherPin?: string;
  pin?: string;
  teacherToken?: string;
  sessionToken?: string;
}

export function authorizeTeacherAction(
  ws: ExtWebSocket,
  payload: TeacherAuthPayloadFields,
  activeLabRooms: Map<string, LabRoom>,
  roomIdRaw?: string,
  emitUnauthorizedError = false
): { authorized: boolean; room?: LabRoom; targetRoomId: string } {
  const targetRoomId = String(roomIdRaw || payload.roomId || ws.roomId || '')
    .toUpperCase()
    .trim();
  const room = targetRoomId
    ? (activeLabRooms.get(targetRoomId) as (LabRoom & { pinHash?: string }) | undefined)
    : undefined;

  const sessionToken =
    typeof payload.sessionToken === 'string'
      ? payload.sessionToken
      : typeof payload.teacherToken === 'string' && payload.teacherToken.includes('.')
      ? payload.teacherToken
      : undefined;

  const tokenClaims = sessionToken ? verifySessionToken(sessionToken) : ws.sessionClaims;
  const isTokenTeacher = Boolean(
    tokenClaims && (tokenClaims.role === 'teacher' || tokenClaims.role === 'admin')
  );
  if (tokenClaims && isTokenTeacher) {
    const roomSchool = room?.schoolId || DEFAULT_SCHOOL_ID;
    if (!room || tokenClaims.schoolId === roomSchool) {
      ws.sessionClaims = tokenClaims;
      ws.schoolId = tokenClaims.schoolId;
      ws.role = 'Pengajar';
      return { authorized: true, room, targetRoomId };
    }
    if (emitUnauthorizedError) {
      ws.send(
        JSON.stringify({
          type: 'ROOM_ERROR',
          payload: {
            message: 'Akses Pengajar ditolak: Token sesi milik sekolah lain.',
            code: 'SCHOOL_TENANT_MISMATCH',
          },
        })
      );
    }
    return { authorized: false, room, targetRoomId };
  }

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
