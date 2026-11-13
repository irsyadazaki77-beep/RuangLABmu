import type {
  LabRoom,
  LabRoomClient,
  ParameterLockPayload,
} from '../../src/utils/collabProtocol';

/**
 * Resolves unexpired parameter locks scoped to a given room (matching either
 * the roomId lock prefix or the client's groupId).
 */
export function getRoomScopedLocks(
  parameterLocks: Map<string, ParameterLockPayload>,
  roomId: string,
  groupId?: string,
  nowMs: number = Date.now()
): ParameterLockPayload[] {
  const normalizedRoomId = (roomId || '').toUpperCase().trim();
  const result: ParameterLockPayload[] = [];

  for (const [key, lock] of parameterLocks.entries()) {
    if (!lock || typeof lock.expiresAt !== 'number' || lock.expiresAt <= nowMs) {
      continue;
    }
    const prefix = key.split(':')[0]?.toUpperCase().trim();
    const matchesRoom = normalizedRoomId.length > 0 && prefix === normalizedRoomId;
    const matchesGroup = Boolean(groupId && lock.groupId === groupId);
    if (matchesRoom || matchesGroup) {
      result.push(lock);
    }
  }

  return result;
}

export interface RoomReconnectSnapshot {
  roomJoinedMessage: {
    type: 'ROOM_JOINED';
    payload: {
      room: LabRoom;
      client: LabRoomClient;
      isReconnect: boolean;
      paramLocks: ParameterLockPayload[];
    };
  };
  paramLocksSyncMessage: {
    type: 'PARAM_LOCKS_SYNC';
    payload: {
      roomId: string;
      locks: ParameterLockPayload[];
    };
  };
  roomStateSyncMessage: {
    type: 'ROOM_STATE_SYNC';
    payload: {
      room: LabRoom;
    };
  };
}

/**
 * Builds the authoritative snapshot messages sent when a client joins or
 * reconnects to an existing collaborative room.
 */
export function buildRoomReconnectSnapshot(
  room: LabRoom,
  client: LabRoomClient,
  parameterLocks: Map<string, ParameterLockPayload>,
  isReconnect: boolean,
  nowMs: number = Date.now()
): RoomReconnectSnapshot {
  const roomLocks = getRoomScopedLocks(
    parameterLocks,
    room.roomId,
    client.groupId,
    nowMs
  );

  return {
    roomJoinedMessage: {
      type: 'ROOM_JOINED',
      payload: {
        room,
        client,
        isReconnect,
        paramLocks: roomLocks,
      },
    },
    paramLocksSyncMessage: {
      type: 'PARAM_LOCKS_SYNC',
      payload: {
        roomId: room.roomId,
        locks: roomLocks,
      },
    },
    roomStateSyncMessage: {
      type: 'ROOM_STATE_SYNC',
      payload: {
        room,
      },
    },
  };
}
