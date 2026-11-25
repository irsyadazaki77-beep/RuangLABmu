import type { WsPayloadOf } from '../../src/shared/contracts/wsContracts';
import {
  LabRoom,
  LabRoomClient,
  StudentLiveTelemetry,
  generateRandomRoomId,
} from '../../src/utils/collabProtocol';
import { verifyTeacherAuthorization } from '../../src/utils/submissionPersistence';
import { verifySessionToken } from '../auth/sessionToken';
import { DEFAULT_SCHOOL_ID } from '../db/LabRepository';
import {
  generateSecureRoomPin,
  hashRoomPin,
  verifyRoomPinTimingSafe,
} from '../state/labServerState';
import {
  buildRoomReconnectSnapshot,
  sanitizeRoomForBroadcast,
} from '../utils/collabReconnectSync';
import type { ExtWebSocket, WsHandlerServices } from './wsTypes';

export const MAX_JOIN_PIN_ATTEMPTS = 5;
export const JOIN_PIN_WINDOW_MS = 60_000;

interface JoinPinAttemptState {
  failedCount: number;
  windowStartMs: number;
  blockedUntilMs: number;
}

const joinPinAttempts = new Map<string, JoinPinAttemptState>();

export function resetJoinPinAttemptsForTest(): void {
  joinPinAttempts.clear();
}

function getJoinAttemptKey(ws: ExtWebSocket): string {
  const ip = typeof ws.remoteIp === 'string' && ws.remoteIp.trim() ? ws.remoteIp.trim() : '';
  return ip || ws.socketId || 'anonymous-socket';
}

function isJoinAttemptRateLimited(key: string, now = Date.now()): boolean {
  const entry = joinPinAttempts.get(key);
  if (!entry) return false;
  if (entry.blockedUntilMs > now) {
    return true;
  }
  if (now - entry.windowStartMs > JOIN_PIN_WINDOW_MS) {
    joinPinAttempts.delete(key);
    return false;
  }
  return entry.failedCount >= MAX_JOIN_PIN_ATTEMPTS;
}

function recordFailedJoinPinAttempt(key: string, now = Date.now()): boolean {
  const existing = joinPinAttempts.get(key);
  if (!existing || now - existing.windowStartMs > JOIN_PIN_WINDOW_MS) {
    joinPinAttempts.set(key, {
      failedCount: 1,
      windowStartMs: now,
      blockedUntilMs: 0,
    });
    return false;
  }

  existing.failedCount += 1;
  if (existing.failedCount >= MAX_JOIN_PIN_ATTEMPTS) {
    existing.blockedUntilMs = now + JOIN_PIN_WINDOW_MS;
  }
  return existing.failedCount > MAX_JOIN_PIN_ATTEMPTS;
}

function clearJoinPinAttempts(key: string): void {
  joinPinAttempts.delete(key);
}

export function handleRoomCreate(
  ws: ExtWebSocket,
  payload: Omit<WsPayloadOf<'ROOM_CREATE'>, 'schoolId'> & { schoolId?: string },
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const pinInput = typeof payload.pin === 'string' ? payload.pin.trim() : '';
  const resolvedPin =
    pinInput && pinInput !== '1234' ? pinInput : generateSecureRoomPin();
  const domainRaw = payload.domain;
  const domain: LabRoom['domain'] =
    domainRaw === 'chemistry' ||
    domainRaw === 'biology' ||
    domainRaw === 'astronomy'
      ? domainRaw
      : 'physics';
  const moduleId =
    typeof payload.moduleId === 'string' && payload.moduleId.trim()
      ? payload.moduleId.trim()
      : 'newton-incline';
  const teacherName =
    typeof payload.teacherName === 'string' && payload.teacherName.trim()
      ? payload.teacherName.trim()
      : ws.userName || 'Guru';
  const teacherUserId =
    typeof payload.teacherUserId === 'string' && payload.teacherUserId.trim()
      ? payload.teacherUserId.trim()
      : ws.userId || 'teacher-1';
  const customId =
    typeof payload.roomId === 'string' && payload.roomId.trim()
      ? payload.roomId
      : generateRandomRoomId();

  const tokenClaims =
    typeof payload.sessionToken === 'string' && payload.sessionToken.trim()
      ? verifySessionToken(payload.sessionToken.trim())
      : ws.sessionClaims;
  if (tokenClaims) {
    ws.sessionClaims = tokenClaims;
  }

  const isStrictProd =
    process.env.NODE_ENV === 'production' && process.env.RUANGLAB_PORTABLE !== '1';
  const isTokenTeacher = Boolean(
    tokenClaims && (tokenClaims.role === 'teacher' || tokenClaims.role === 'admin')
  );
  const rawTeacherPayload = payload as { teacherPin?: unknown; teacherToken?: unknown };
  const teacherAuth = isTokenTeacher
    ? { authorized: true }
    : verifyTeacherAuthorization({
        socketId: ws.socketId,
        claimedRole: 'Pengajar',
        providedPin:
          typeof rawTeacherPayload.teacherPin === 'string'
            ? rawTeacherPayload.teacherPin
            : undefined,
        providedToken:
          typeof rawTeacherPayload.teacherToken === 'string'
            ? rawTeacherPayload.teacherToken
            : undefined,
        isSocketAlreadyVerifiedTeacher: ws.role === 'Pengajar' || !isStrictProd,
      });

  if (!teacherAuth.authorized) {
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message: 'Akses ditolak: Hanya Pengajar terverifikasi yang dapat membuat ruangan praktikum.',
          code: 'UNAUTHORIZED_TEACHER_ROLE',
        },
      })
    );
    return;
  }

  const schoolId =
    tokenClaims?.schoolId ||
    (typeof payload.schoolId === 'string' && payload.schoolId.trim()
      ? payload.schoolId.trim()
      : ws.schoolId || DEFAULT_SCHOOL_ID);
  const roomId = customId.toUpperCase().trim();
  const now = Date.now();
  const newRoom: LabRoom & { pinHash?: string } = {
    roomId,
    pin: resolvedPin,
    pinHash: hashRoomPin(resolvedPin),
    schoolId,
    domain,
    moduleId,
    teacherSocketId: ws.socketId,
    teacherName,
    isFrozenByTeacher: false,
    createdAt: now,
    lastActivityAt: now,
    clients: {
      [ws.socketId]: {
        socketId: ws.socketId,
        userId: teacherUserId,
        name: teacherName,
        role: 'teacher',
        joinedAt: now,
      },
    },
  };

  state.activeLabRooms.set(roomId, newRoom);
  state.pruneIdleRooms(now);
  ws.roomId = roomId;
  ws.schoolId = schoolId;
  ws.role = 'Pengajar';

  state.recordAuditLog({
    schoolId,
    actorId: tokenClaims?.sub || teacherUserId,
    actorName: teacherName,
    actorRole: 'teacher',
    action: 'ROOM_CREATED',
    targetType: 'room',
    targetId: roomId,
    metadata: { domain, moduleId },
    ipAddress: ws.remoteIp,
  });

  // Send full room (including PIN) privately ONLY to the room creator
  const { pinHash: _pinHash, ...creatorRoomPayload } = newRoom;
  ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: { room: creatorRoomPayload } }));
  // Broadcast sanitized room state (without PIN or pinHash) to room peers
  broadcastRoom(roomId, {
    type: 'ROOM_STATE_SYNC',
    payload: { room: sanitizeRoomForBroadcast(newRoom) },
  });
}

export function handleRoomJoin(
  ws: ExtWebSocket,
  payload: Omit<WsPayloadOf<'ROOM_JOIN'>, 'schoolId'> & { schoolId?: string },
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const now = Date.now();
  const attemptKey = getJoinAttemptKey(ws);

  if (isJoinAttemptRateLimited(attemptKey, now)) {
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message:
            'Terlalu banyak percobaan PIN salah. Silakan tunggu 1 menit sebelum mencoba kembali.',
          code: 'RATE_LIMITED',
        },
      })
    );
    return;
  }

  const rawRoomId = typeof payload.roomId === 'string' ? payload.roomId : '';
  const inputPin = typeof payload.pin === 'string' ? payload.pin : String(payload.pin ?? '');
  const name = typeof payload.name === 'string' ? payload.name : undefined;
  const role = payload.role;
  const userId = typeof payload.userId === 'string' ? payload.userId : undefined;
  const groupId = typeof payload.groupId === 'string' ? payload.groupId : undefined;
  const isReconnect = Boolean(payload.isReconnect);

  const roomId = rawRoomId.toUpperCase().trim();
  const room = state.activeLabRooms.get(roomId) as (LabRoom & { pinHash?: string }) | undefined;

  if (!room) {
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message: `Meja praktikum [${roomId}] tidak ditemukan. Periksa kembali kode ruangan.`,
          code: 'ROOM_NOT_FOUND',
        },
      })
    );
    return;
  }

  const expectedSecret = room.pinHash || room.pin;
  if (expectedSecret && !verifyRoomPinTimingSafe(inputPin, expectedSecret)) {
    const exceededNow = recordFailedJoinPinAttempt(attemptKey, now);
    if (exceededNow) {
      ws.send(
        JSON.stringify({
          type: 'ROOM_ERROR',
          payload: {
            message:
              'Terlalu banyak percobaan PIN salah. Silakan tunggu 1 menit sebelum mencoba kembali.',
            code: 'RATE_LIMITED',
          },
        })
      );
      return;
    }
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message: `Kode PIN untuk meja [${roomId}] salah. Hubungi guru atau pembuat meja.`,
          code: 'INVALID_PIN',
        },
      })
    );
    return;
  }

  clearJoinPinAttempts(attemptKey);

  const resolvedUserId = userId || ws.userId || `user-${now}`;
  const wantsTeacherRole =
    role === 'teacher' || role === 'Pengajar' || role === 'Guru';

  const joinTokenClaims =
    typeof payload.sessionToken === 'string' && payload.sessionToken.trim()
      ? verifySessionToken(payload.sessionToken.trim())
      : ws.sessionClaims;
  const isVerifiedTokenTeacher = Boolean(
    joinTokenClaims &&
      (joinTokenClaims.role === 'teacher' || joinTokenClaims.role === 'admin') &&
      joinTokenClaims.schoolId === (room.schoolId || DEFAULT_SCHOOL_ID)
  );
  if (joinTokenClaims) {
    ws.sessionClaims = joinTokenClaims;
  }

  const isExistingRoomTeacherReconnect = Boolean(
    isVerifiedTokenTeacher ||
      (isReconnect &&
        room.teacherSocketId === ws.socketId &&
        Object.values(room.clients).some(
          (c) => c.userId === resolvedUserId && c.role === 'teacher'
        ))
  );

  const teacherAuth = verifyTeacherAuthorization({
    socketId: ws.socketId,
    claimedRole: wantsTeacherRole ? 'Pengajar' : 'Siswa',
    providedPin:
      typeof payload.teacherPin === 'string' ? payload.teacherPin : undefined,
    providedToken:
      typeof payload.teacherToken === 'string' ? payload.teacherToken : undefined,
    roomTeacherSocketId: room.teacherSocketId,
    isSocketAlreadyVerifiedTeacher:
      ws.role === 'Pengajar' || isExistingRoomTeacherReconnect || isVerifiedTokenTeacher,
  });

  if (wantsTeacherRole && !teacherAuth.authorized) {
    ws.role = 'Siswa';
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message:
            teacherAuth.reason ||
            'Otorisasi Pengajar ditolak: Klien tidak memiliki hak akses guru untuk ruangan ini.',
          code: 'UNAUTHORIZED_TEACHER_ROLE',
        },
      })
    );
    return;
  }

  if (ws.roomId && ws.roomId !== roomId && state.activeLabRooms.has(ws.roomId)) {
    const prev = state.activeLabRooms.get(ws.roomId)!;
    delete prev.clients[ws.socketId];
    state.touchLabRoom(ws.roomId);
    broadcastRoom(ws.roomId, {
      type: 'ROOM_STATE_SYNC',
      payload: { room: sanitizeRoomForBroadcast(prev) },
    });
  }

  const clientRole: 'teacher' | 'student' =
    wantsTeacherRole && teacherAuth.authorized ? 'teacher' : 'student';

  for (const [existingSockId, existingClient] of Object.entries(room.clients)) {
    if (existingSockId !== ws.socketId && existingClient.userId === resolvedUserId) {
      delete room.clients[existingSockId];
    }
  }

  const roomClient: LabRoomClient = {
    socketId: ws.socketId,
    userId: resolvedUserId,
    name: name || ws.userName || 'Siswa',
    role: clientRole,
    groupId: groupId || ws.groupId,
    joinedAt: now,
  };

  room.clients[ws.socketId] = roomClient;
  state.touchLabRoom(roomId, now);
  ws.roomId = roomId;
  ws.schoolId = room.schoolId || DEFAULT_SCHOOL_ID;
  ws.userId = roomClient.userId;
  ws.userName = roomClient.name;
  ws.groupId = roomClient.groupId;
  ws.role = clientRole === 'teacher' ? 'Pengajar' : 'Siswa';
  if (clientRole === 'teacher') {
    room.teacherSocketId = ws.socketId;
    room.teacherName = roomClient.name;
  }

  state.pruneExpiredLocks(now);
  const snapshot = buildRoomReconnectSnapshot(
    room,
    roomClient,
    state.parameterLocks,
    isReconnect,
    now
  );

  // Restore participant `connected = 1` in SQLite and fetch latest `simulation_snapshots`
  const restored = state.rejoinParticipantSession(
    room.pin || roomId,
    roomClient.userId,
    roomId,
    now
  );
  const latestSimParams = restored?.latestSnapshot?.params ?? null;

  ws.send(
    JSON.stringify({
      ...snapshot.roomJoinedMessage,
      payload: {
        ...snapshot.roomJoinedMessage.payload,
        latestSimulationSnapshot: latestSimParams,
      },
    })
  );
  ws.send(JSON.stringify(snapshot.paramLocksSyncMessage));
  if (latestSimParams && restored?.latestSnapshot) {
    ws.send(
      JSON.stringify({
        type: 'SIMULATION_SNAPSHOT_RESTORE',
        payload: {
          roomPin: room.pin || roomId,
          roomId,
          params: latestSimParams,
          updatedAt: restored.latestSnapshot.updatedAt,
        },
      })
    );
  }
  broadcastRoom(roomId, snapshot.roomStateSyncMessage);
}

export function handleRoomRejoin(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'ROOM_REJOIN'>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const roomPin =
    typeof payload.roomPin === 'string'
      ? payload.roomPin.trim()
      : typeof payload.pin === 'string'
        ? payload.pin.trim()
        : '';
  const participantId =
    typeof payload.participantId === 'string'
      ? payload.participantId.trim()
      : typeof payload.userId === 'string'
        ? payload.userId.trim()
        : ws.userId || '';
  const roomIdHint =
    typeof payload.roomId === 'string' ? payload.roomId.trim().toUpperCase() : undefined;

  if (!roomPin || !participantId) {
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message: 'Parameter roomPin dan participantId wajib diisi untuk pemulihan sesi 3T.',
          code: 'INVALID_REJOIN_PAYLOAD',
        },
      })
    );
    return;
  }

  const now = Date.now();
  const restored = state.rejoinParticipantSession(roomPin, participantId, roomIdHint, now);
  if (!restored) {
    ws.send(
      JSON.stringify({
        type: 'ROOM_ERROR',
        payload: {
          message: 'Sesi meja praktikum tidak ditemukan atau telah kedaluwarsa.',
          code: 'ROOM_SESSION_EXPIRED',
        },
      })
    );
    return;
  }

  if (restored.room) {
    handleRoomJoin(
      ws,
      {
        roomId: restored.room.roomId,
        pin: restored.room.pin,
        schoolId: restored.room.schoolId || 'default-school',
        name:
          (typeof payload.name === 'string' && payload.name.trim()) ||
          restored.participant.display_name,
        role: restored.participant.role,
        userId: participantId,
        groupId: typeof payload.groupId === 'string' ? payload.groupId : ws.groupId,
        isReconnect: true,
        isVerifiedTeacherReconnect: restored.participant.role === 'teacher',
      },
      services
    );
    return;
  }

  // Fallback if only relational row exists
  if (restored.latestSnapshot) {
    ws.send(
      JSON.stringify({
        type: 'SIMULATION_SNAPSHOT_RESTORE',
        payload: {
          roomPin: restored.dbRoom.pin,
          roomId: roomIdHint || restored.dbRoom.pin,
          params: restored.latestSnapshot.params,
          updatedAt: restored.latestSnapshot.updatedAt,
        },
      })
    );
  }
  if (roomIdHint) {
    broadcastRoom(roomIdHint, {
      type: 'SIMULATION_SNAPSHOT_RESTORE',
      payload: {
        roomPin: restored.dbRoom.pin,
        roomId: roomIdHint,
        params: restored.latestSnapshot?.params ?? {},
        updatedAt: restored.latestSnapshot?.updatedAt ?? now,
      },
    });
  }
}

export function handleSimulationSnapshotPush(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'SIMULATION_SNAPSHOT_PUSH'>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const roomPin =
    typeof payload.roomPin === 'string' && payload.roomPin.trim()
      ? payload.roomPin.trim()
      : ws.roomId || '';
  const params = payload.params;
  if (!roomPin || !params || typeof params !== 'object') return;

  const now = Date.now();
  const saved = state.saveRoomSimulationSnapshot(
    roomPin,
    params as Record<string, unknown>,
    now
  );
  const targetRoomId =
    (typeof payload.roomId === 'string' && payload.roomId.trim().toUpperCase()) ||
    ws.roomId;
  if (targetRoomId) {
    broadcastRoom(
      targetRoomId,
      {
        type: 'SIMULATION_SNAPSHOT_RESTORE',
        payload: {
          roomPin: saved.room_pin,
          roomId: targetRoomId,
          params: params as Record<string, unknown>,
          updatedAt: saved.updated_at,
        },
      },
      ws
    );
  }
}

export function handleRoomLeave(
  ws: ExtWebSocket,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  if (ws.roomId && state.activeLabRooms.has(ws.roomId)) {
    const room = state.activeLabRooms.get(ws.roomId)!;
    if (ws.userId && room.pin) {
      state.database.setParticipantConnected(room.pin, ws.userId, false);
    }
    delete room.clients[ws.socketId];
    if (room.teacherSocketId === ws.socketId) {
      room.teacherSocketId = undefined;
    }
    const oldId = ws.roomId;
    state.touchLabRoom(oldId);
    ws.roomId = undefined;
    broadcastRoom(oldId, {
      type: 'ROOM_STATE_SYNC',
      payload: { room: sanitizeRoomForBroadcast(room) },
    });
  }
}

export function handleStudentTelemetrySync(
  ws: ExtWebSocket,
  payload: WsPayloadOf<'STUDENT_TELEMETRY_SYNC'>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
  const targetRoomId = String(payload.roomId || ws.roomId || '')
    .toUpperCase()
    .trim();
  const room = state.activeLabRooms.get(targetRoomId);
  if (!room) return;

  const studentName =
    typeof payload.studentName === 'string' ? payload.studentName : undefined;
  const telemetry = payload.telemetry as StudentLiveTelemetry | undefined;
  if (!telemetry) return;

  const client = room.clients[ws.socketId];
  if (client) {
    client.telemetry = {
      ...telemetry,
      studentName: studentName || client.name,
      lastUpdated: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  }
  state.touchLabRoom(targetRoomId);
  broadcastRoom(targetRoomId, {
    type: 'STUDENT_TELEMETRY_SYNC',
    payload: {
      roomId: targetRoomId,
      studentName: studentName || ws.userName,
      telemetry: client?.telemetry || telemetry,
    },
  });
}

export function cleanupSocketRoomAndLocks(
  ws: ExtWebSocket,
  services: WsHandlerServices
): void {
  const { state, broadcastGroup, broadcastRoom } = services;
  if (ws.userId) {
    for (const [key, lock] of state.parameterLocks.entries()) {
      if (lock.lockedByUserId === ws.userId) {
        state.parameterLocks.delete(key);
        broadcastGroup(
          lock.groupId,
          {
            type: 'PARAM_LOCK_RELEASE',
            payload: {
              groupId: lock.groupId,
              domain: lock.domain,
              paramKey: lock.paramKey,
              userId: ws.userId,
            },
          },
          undefined,
          ws.roomId
        );
      }
    }
    if (ws.groupId) {
      broadcastGroup(
        ws.groupId,
        {
          type: 'CURSOR_3D_LEAVE',
          payload: { userId: ws.userId, groupId: ws.groupId },
        },
        undefined,
        ws.roomId
      );
    }
  }

  if (ws.roomId && state.activeLabRooms.has(ws.roomId)) {
    const room = state.activeLabRooms.get(ws.roomId)!;
    if (ws.userId && room.pin) {
      state.database.setParticipantConnected(room.pin, ws.userId, false);
    }
    delete room.clients[ws.socketId];
    if (room.teacherSocketId === ws.socketId) {
      room.teacherSocketId = undefined;
    }
    state.touchLabRoom(ws.roomId);
    broadcastRoom(ws.roomId, {
      type: 'ROOM_STATE_SYNC',
      payload: { room: sanitizeRoomForBroadcast(room) },
    });
  }
}
