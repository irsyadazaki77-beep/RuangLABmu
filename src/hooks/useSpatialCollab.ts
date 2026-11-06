import { useEffect, useRef, useState, useCallback } from 'react';
import {
  SpatialCursorPayload,
  ParameterLockPayload,
  getUserColor,
} from '../utils/collabProtocol';

export interface UseSpatialCollabOptions {
  ws: WebSocket | null;
  userId: string;
  userName: string;
  role: 'Siswa' | 'Pengajar';
  groupId: string;
  domain: 'fisika' | 'kimia' | 'biologi' | 'astronomi';
  userColor?: string;
  onRemoteParamSync?: (paramKey: string, value: number) => void;
}

export interface UseSpatialCollabReturn {
  remoteCursors: Record<string, SpatialCursorPayload>;
  paramLocks: Record<string, ParameterLockPayload>;
  emitCursor3D: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  acquireParamLock: (paramKey: string) => void;
  releaseParamLock: (paramKey: string) => void;
  syncParamValue: (paramKey: string, value: number) => void;
}

const THROTTLE_MS = 40; // 25 Hz rate limit for 3D cursor position broadcasts
const CURSOR_TTL_MS = 8000; // 8 seconds timeout before pruning inactive cursors

export function useSpatialCollab({
  ws,
  userId,
  userName,
  role,
  groupId,
  domain,
  userColor,
  onRemoteParamSync,
}: UseSpatialCollabOptions): UseSpatialCollabReturn {
  const [remoteCursors, setRemoteCursors] = useState<Record<string, SpatialCursorPayload>>({});
  const [paramLocks, setParamLocks] = useState<Record<string, ParameterLockPayload>>({});

  const lastCursorEmitRef = useRef<number>(0);
  const activeColor = userColor || getUserColor(userName, role);

  const optionsRef = useRef({
    ws,
    userId,
    userName,
    role,
    groupId,
    domain,
    userColor: activeColor,
    onRemoteParamSync,
  });

  useEffect(() => {
    optionsRef.current = {
      ws,
      userId,
      userName,
      role,
      groupId,
      domain,
      userColor: activeColor,
      onRemoteParamSync,
    };
  }, [ws, userId, userName, role, groupId, domain, activeColor, onRemoteParamSync]);

  // Identify client on connection or when identity changes
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'client:identify',
          payload: {
            userId,
            userName,
            role,
            groupId,
            domain,
          },
        })
      );
    }
  }, [ws, userId, userName, role, groupId, domain]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        const { current } = optionsRef;

        if (msg.type === 'init:state' && msg.payload?.paramLocks) {
          const locksList: ParameterLockPayload[] = msg.payload.paramLocks;
          const relevantLocks: Record<string, ParameterLockPayload> = {};
          const now = Date.now();
          for (const lock of locksList) {
            if (lock.groupId === current.groupId && lock.expiresAt > now) {
              relevantLocks[lock.paramKey] = lock;
            }
          }
          setParamLocks(relevantLocks);
        } else if (msg.type === 'CURSOR_3D_MOVE' && msg.payload) {
          const incoming = msg.payload as SpatialCursorPayload;
          // Only show cursors from other users in the same group and domain
          if (
            incoming.userId !== current.userId &&
            incoming.groupId === current.groupId &&
            incoming.domain === current.domain
          ) {
            setRemoteCursors((prev) => ({
              ...prev,
              [incoming.userId]: incoming,
            }));
          }
        } else if (msg.type === 'CURSOR_3D_LEAVE' && msg.payload) {
          const { userId: leavingId } = msg.payload;
          setRemoteCursors((prev) => {
            if (!prev[leavingId]) return prev;
            const next = { ...prev };
            delete next[leavingId];
            return next;
          });
        } else if (msg.type === 'PARAM_LOCK_ACQUIRE' && msg.payload) {
          const lock = msg.payload as ParameterLockPayload;
          if (lock.groupId === current.groupId) {
            setParamLocks((prev) => ({
              ...prev,
              [lock.paramKey]: lock,
            }));
          }
        } else if (msg.type === 'PARAM_LOCK_RELEASE' && msg.payload) {
          const { groupId: lockGroup, paramKey } = msg.payload;
          if (lockGroup === current.groupId) {
            setParamLocks((prev) => {
              if (!prev[paramKey]) return prev;
              const next = { ...prev };
              delete next[paramKey];
              return next;
            });
          }
        } else if (msg.type === 'PARAM_LOCKS_SYNC' && msg.payload?.locks) {
          const locksList: ParameterLockPayload[] = msg.payload.locks;
          const nextLocks: Record<string, ParameterLockPayload> = {};
          const now = Date.now();
          for (const l of locksList) {
            if (l.groupId === current.groupId && l.expiresAt > now) {
              nextLocks[l.paramKey] = l;
            }
          }
          setParamLocks(nextLocks);
        } else if (msg.type === 'PARAM_VALUE_SYNC' && msg.payload) {
          const { groupId: syncGroup, paramKey, value, updatedBy } = msg.payload;
          if (syncGroup === current.groupId && updatedBy !== current.userId) {
            current.onRemoteParamSync?.(paramKey, value);
          }
        }
      } catch (err) {
        // Non-critical JSON parse error from other messages
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  // Periodic pruning of stale cursors (TTL = 8s) and expired mutex locks
  useEffect(() => {
    const pruneInterval = setInterval(() => {
      const now = Date.now();

      setRemoteCursors((prev) => {
        let changed = false;
        const next: Record<string, SpatialCursorPayload> = {};
        for (const [id, cursor] of Object.entries(prev)) {
          if (now - cursor.updatedAt <= CURSOR_TTL_MS) {
            next[id] = cursor;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setParamLocks((prev) => {
        let changed = false;
        const next: Record<string, ParameterLockPayload> = {};
        for (const [key, lock] of Object.entries(prev)) {
          if (now <= lock.expiresAt) {
            next[key] = lock;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1500);

    return () => clearInterval(pruneInterval);
  }, []);

  // Send leave notification when switching group or domain
  useEffect(() => {
    return () => {
      const { ws: curWs, userId: curUser, groupId: curGroup } = optionsRef.current;
      if (curWs && curWs.readyState === WebSocket.OPEN) {
        try {
          curWs.send(
            JSON.stringify({
              type: 'CURSOR_3D_LEAVE',
              payload: { userId: curUser, groupId: curGroup },
            })
          );
        } catch {
          // ignore error on unmount
        }
      }
    };
  }, [groupId, domain]);

  // Throttled 3D Cursor Emitter (<= 25 Hz)
  const emitCursor3D = useCallback(
    (
      position: [number, number, number],
      normal?: [number, number, number],
      hoveredObject?: string
    ) => {
      const now = Date.now();
      if (now - lastCursorEmitRef.current < THROTTLE_MS) {
        return;
      }
      lastCursorEmitRef.current = now;

      const { ws: curWs, userId: curUser, userName: curName, role: curRole, groupId: curGroup, domain: curDomain, userColor: curColor } =
        optionsRef.current;

      if (curWs && curWs.readyState === WebSocket.OPEN) {
        const payload: SpatialCursorPayload = {
          userId: curUser,
          userName: curName,
          role: curRole,
          groupId: curGroup,
          domain: curDomain,
          color: curColor,
          position,
          normal,
          hoveredObject,
          updatedAt: now,
        };
        curWs.send(
          JSON.stringify({
            type: 'CURSOR_3D_MOVE',
            payload,
          })
        );
      }
    },
    []
  );

  // Acquire Parameter Mutex Lock
  const acquireParamLock = useCallback((paramKey: string) => {
    const { ws: curWs, userId: curUser, userName: curName, groupId: curGroup, domain: curDomain } =
      optionsRef.current;

    // Optimistically set locally
    setParamLocks((prev) => ({
      ...prev,
      [paramKey]: {
        groupId: curGroup,
        domain: curDomain,
        paramKey,
        lockedByUserId: curUser,
        lockedByName: curName,
        expiresAt: Date.now() + 5000,
      },
    }));

    if (curWs && curWs.readyState === WebSocket.OPEN) {
      const payload: ParameterLockPayload = {
        groupId: curGroup,
        domain: curDomain,
        paramKey,
        lockedByUserId: curUser,
        lockedByName: curName,
        expiresAt: Date.now() + 5000,
      };
      curWs.send(
        JSON.stringify({
          type: 'PARAM_LOCK_ACQUIRE',
          payload,
        })
      );
    }
  }, []);

  // Release Parameter Mutex Lock
  const releaseParamLock = useCallback((paramKey: string) => {
    const { ws: curWs, userId: curUser, groupId: curGroup, domain: curDomain } =
      optionsRef.current;

    setParamLocks((prev) => {
      if (!prev[paramKey]) return prev;
      const next = { ...prev };
      delete next[paramKey];
      return next;
    });

    if (curWs && curWs.readyState === WebSocket.OPEN) {
      curWs.send(
        JSON.stringify({
          type: 'PARAM_LOCK_RELEASE',
          payload: {
            groupId: curGroup,
            domain: curDomain,
            paramKey,
            userId: curUser,
          },
        })
      );
    }
  }, []);

  // Sync Slider Value in Real-Time
  const syncParamValue = useCallback((paramKey: string, value: number) => {
    const { ws: curWs, userId: curUser, groupId: curGroup, domain: curDomain } =
      optionsRef.current;

    if (curWs && curWs.readyState === WebSocket.OPEN) {
      curWs.send(
        JSON.stringify({
          type: 'PARAM_VALUE_SYNC',
          payload: {
            groupId: curGroup,
            domain: curDomain,
            paramKey,
            value,
            updatedBy: curUser,
          },
        })
      );
    }
  }, []);

  return {
    remoteCursors,
    paramLocks,
    emitCursor3D,
    acquireParamLock,
    releaseParamLock,
    syncParamValue,
  };
}
