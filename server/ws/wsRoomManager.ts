import {
  LabRoom,
  LabRoomClient,
  StudentLiveTelemetry,
  generateRandomRoomId,
} from '../../src/utils/collabProtocol';
import {
  generateSecureRoomPin,
  hashRoomPin,
  verifyRoomPinTimingSafe,
} from '../state/labServerState';
import { buildRoomReconnectSnapshot } from '../utils/collabReconnectSync';
import type { ExtWebSocket, WsHandlerServices } from './wsTypes';

export function handleRoomCreate(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
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

  const roomId = customId.toUpperCase().trim();
  const now = Date.now();
  const newRoom: LabRoom & { pinHash?: string } = {
    roomId,
    pin: resolvedPin,
    pinHash: hashRoomPin(resolvedPin),
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
  ws.role = 'Pengajar';

  ws.send(JSON.stringify({ type: 'ROOM_CREATED', payload: { room: newRoom } }));
  broadcastRoom(roomId, { type: 'ROOM_STATE_SYNC', payload: { room: newRoom } });
}

export function handleRoomJoin(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
  services: WsHandlerServices
): void {
  const { state, broadcastRoom } = services;
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

  if (ws.roomId && ws.roomId !== roomId && state.activeLabRooms.has(ws.roomId)) {
    const prev = state.activeLabRooms.get(ws.roomId)!;
    delete prev.clients[ws.socketId];
    state.touchLabRoom(ws.roomId);
    broadcastRoom(ws.roomId, { type: 'ROOM_STATE_SYNC', payload: { room: prev } });
  }

  const clientRole: 'teacher' | 'student' =
    role === 'teacher' || role === 'Pengajar' ? 'teacher' : 'student';
  const resolvedUserId = userId || ws.userId || `user-${Date.now()}`;

  for (const [existingSockId, existingClient] of Object.entries(room.clients)) {
    if (existingSockId !== ws.socketId && existingClient.userId === resolvedUserId) {
      delete room.clients[existingSockId];
    }
  }

  const now = Date.now();
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
    isReconnect
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
  payload: Record<string, unknown>,
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
        name:
          (typeof payload.name === 'string' && payload.name.trim()) ||
          restored.participant.display_name,
        role: restored.participant.role,
        userId: participantId,
        groupId: typeof payload.groupId === 'string' ? payload.groupId : ws.groupId,
        isReconnect: true,
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
  payload: Record<string, unknown>,
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
    broadcastRoom(oldId, { type: 'ROOM_STATE_SYNC', payload: { room } });
  }
}

export function handleStudentTelemetrySync(
  ws: ExtWebSocket,
  payload: Record<string, unknown>,
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
    broadcastRoom(ws.roomId, { type: 'ROOM_STATE_SYNC', payload: { room } });
  }
}
