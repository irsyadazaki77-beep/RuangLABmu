import { useCallback, useEffect, useRef, useState } from 'react';
import type { LabRoom } from '../utils/collabProtocol';
import { apiFetch } from '../utils/apiClient';

export interface RoomSocketReconnectResult {
  status: 'rejoined';
  roomPin: string;
  room: LabRoom | null;
  latestSimulationSnapshot: Record<string, unknown> | null;
  snapshotUpdatedAt: number | null;
}

export interface UseRoomSocketOptions {
  activeRoom: LabRoom | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'Siswa' | 'Pengajar' | 'siswa' | 'pengajar' | 'student' | 'teacher';
  activeGroupId: string;
  sendMessage: (type: string, payload: unknown) => void;
  onSnapshotRestored?: (params: Record<string, unknown>, updatedAt: number) => void;
}

/**
 * Modular hook for Room PIN multiplayer connection & unstable 3T network reconnect recovery.
 * Coordinates WebSocket `ROOM_REJOIN` and REST `POST /api/rooms/rejoin` so students on
 * intermittent 3T connections seamlessly restore `connected = 1` and recover their latest
 * `simulation_snapshots` parameters.
 */
export function useRoomSocket({
  activeRoom,
  currentUserId,
  currentUserName,
  currentUserRole,
  activeGroupId,
  sendMessage,
  onSnapshotRestored,
}: UseRoomSocketOptions) {
  const [isReconnecting3T, setIsReconnecting3T] = useState(false);
  const [lastRestoredAt, setLastRestoredAt] = useState<number | null>(null);
  const lastRoomPinRef = useRef<string | null>(null);
  const lastRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeRoom?.pin) {
      lastRoomPinRef.current = activeRoom.pin;
    }
    if (activeRoom?.roomId) {
      lastRoomIdRef.current = activeRoom.roomId;
    }
  }, [activeRoom?.pin, activeRoom?.roomId]);

  const rejoinRoomSession = useCallback(
    async (explicitPin?: string, explicitParticipantId?: string): Promise<RoomSocketReconnectResult | null> => {
      const targetPin = (explicitPin || activeRoom?.pin || lastRoomPinRef.current || '').trim();
      const targetParticipantId = (explicitParticipantId || currentUserId || '').trim();
      const targetRoomId = activeRoom?.roomId || lastRoomIdRef.current || undefined;

      if (!targetPin || !targetParticipantId) {
        return null;
      }

      setIsReconnecting3T(true);
      try {
        // 1. Trigger WebSocket ROOM_REJOIN immediately
        const normalizedRole =
          currentUserRole.toLowerCase() === 'pengajar' ||
          currentUserRole.toLowerCase() === 'teacher'
            ? 'teacher'
            : 'student';
        sendMessage('ROOM_REJOIN', {
          roomPin: targetPin,
          participantId: targetParticipantId,
          roomId: targetRoomId,
          name: currentUserName,
          role: normalizedRole,
          groupId: activeGroupId,
        });

        // 2. Execute REST fallback `/api/rooms/rejoin` for deterministic snapshot recovery
        const response = await apiFetch('/api/rooms/rejoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomPin: targetPin,
            participantId: targetParticipantId,
            roomId: targetRoomId,
          }),
        });

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as RoomSocketReconnectResult;
        if (data.latestSimulationSnapshot && onSnapshotRestored) {
          const ts = data.snapshotUpdatedAt ?? Date.now();
          onSnapshotRestored(data.latestSimulationSnapshot, ts);
          setLastRestoredAt(ts);
        }
        return data;
      } catch {
        return null;
      } finally {
        setIsReconnecting3T(false);
      }
    },
    [
      activeRoom?.pin,
      activeRoom?.roomId,
      currentUserId,
      currentUserName,
      currentUserRole,
      activeGroupId,
      sendMessage,
      onSnapshotRestored,
    ]
  );

  // Automatically trigger 3T rejoin recovery when browser regains `online` connectivity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      if (lastRoomPinRef.current && currentUserId) {
        void rejoinRoomSession(lastRoomPinRef.current, currentUserId);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUserId, rejoinRoomSession]);

  return {
    roomPin: activeRoom?.pin ?? lastRoomPinRef.current,
    roomId: activeRoom?.roomId ?? lastRoomIdRef.current,
    isReconnecting3T,
    lastRestoredAt,
    rejoinRoomSession,
  };
}
