import { useEffect, useRef, useState, useCallback } from 'react';
import {
  SpatialCursorPayload,
  ParameterLockPayload,
  getUserColor,
} from '../utils/collabProtocol';
import { useCollabStore } from '../stores/useCollabStore';

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

/**
 * Maximum 20 Hz rate limit (every 50ms) for 3D cursor coordinate broadcasts
 * to prevent WebSocket flooding on 120Hz/144Hz high-refresh-rate displays.
 */
export const THROTTLE_MS = 50;
export const CURSOR_LERP_FACTOR = 0.25;
export const CURSOR_TTL_MS = 8000; // 8 seconds timeout before pruning inactive cursors
const LERP_FRAME_MS = 16; // ~60 FPS receiver interpolation interval
const LERP_EPSILON_SQ = 1e-6;

/**
 * Scalar Linear Interpolation (LERP):
 * currentPos + (targetPos - currentPos) * factor
 */
export function lerpCoordinate(
  currentPos: number,
  targetPos: number,
  factor: number = CURSOR_LERP_FACTOR
): number {
  return currentPos + (targetPos - currentPos) * factor;
}

/**
 * 3D Vector Linear Interpolation (LERP) for smooth 60 FPS remote partner cursors:
 * currentPos + (targetPos - currentPos) * 0.25
 */
export function lerpCursor3DPosition(
  currentPos: [number, number, number],
  targetPos: [number, number, number],
  factor: number = CURSOR_LERP_FACTOR
): [number, number, number] {
  return [
    currentPos[0] + (targetPos[0] - currentPos[0]) * factor,
    currentPos[1] + (targetPos[1] - currentPos[1]) * factor,
    currentPos[2] + (targetPos[2] - currentPos[2]) * factor,
  ];
}

/**
 * Pure helper to check whether a cursor emission is allowed under the 20 Hz (50ms) throttle.
 */
export function shouldEmitThrottledCursor(
  nowMs: number,
  lastEmitMs: number,
  throttleMs: number = THROTTLE_MS
): boolean {
  return nowMs - lastEmitMs >= throttleMs;
}

function isValidVec3(vec: unknown): vec is [number, number, number] {
  return (
    Array.isArray(vec) &&
    vec.length === 3 &&
    typeof vec[0] === 'number' &&
    Number.isFinite(vec[0]) &&
    typeof vec[1] === 'number' &&
    Number.isFinite(vec[1]) &&
    typeof vec[2] === 'number' &&
    Number.isFinite(vec[2])
  );
}

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
  const storeLockedParameters = useCollabStore((s) => s.lockedParameters);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, SpatialCursorPayload>>({});
  const [paramLocks, setParamLocks] = useState<Record<string, ParameterLockPayload>>({});

  const lastCursorEmitRef = useRef<number>(0);
  // Authoritative target cursor positions received from WebSocket (20 Hz)
  const targetCursorsRef = useRef<Record<string, SpatialCursorPayload>>({});
  // Offline queue for parameter sync messages during transient WebSocket reconnects
  const pendingParamOutboxRef = useRef<Array<{ type: string; payload: unknown }>>([]);

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

  // Identify client on connection or when identity changes, and flush any buffered param updates
  useEffect(() => {
    if (!ws) return;

    const sendIdentifyAndFlush = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'client:identify',
          payload: {
            userId,
            userName,
            role,
            groupId,
            domain,
            teacherPin: role === 'Pengajar' ? '1234' : undefined,
          },
        })
      );

      while (pendingParamOutboxRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
        const item = pendingParamOutboxRef.current.shift();
        if (item) {
          ws.send(JSON.stringify(item));
        }
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      sendIdentifyAndFlush();
    } else {
      ws.addEventListener('open', sendIdentifyAndFlush, { once: true });
      return () => {
        ws.removeEventListener('open', sendIdentifyAndFlush);
      };
    }
  }, [ws, userId, userName, role, groupId, domain]);

  // Hydrate paramLocks from store whenever storeLockedParameters updates (e.g. on reconnect snapshot)
  useEffect(() => {
    const now = Date.now();
    const relevant: Record<string, ParameterLockPayload> = {};
    for (const [key, lock] of Object.entries(storeLockedParameters)) {
      if (
        lock &&
        typeof lock.paramKey === 'string' &&
        (lock.groupId === groupId || useCollabStore.getState().activeRoomId) &&
        typeof lock.expiresAt === 'number' &&
        lock.expiresAt > now
      ) {
        relevant[key] = lock;
      }
    }
    setParamLocks(relevant);
  }, [storeLockedParameters, groupId]);

  // 60 FPS Receiver-Side LERP Interpolation Loop for Remote 3D Cursors
  useEffect(() => {
    const lerpInterval = setInterval(() => {
      const targets = targetCursorsRef.current;
      const targetIds = Object.keys(targets);
      if (targetIds.length === 0) return;

      setRemoteCursors((prev) => {
        let mutated = false;
        const next: Record<string, SpatialCursorPayload> = { ...prev };

        for (const id of targetIds) {
          const target = targets[id];
          const current = prev[id];

          if (!current) {
            next[id] = target;
            mutated = true;
            continue;
          }

          const [cx, cy, cz] = current.position;
          const [tx, ty, tz] = target.position;
          const distSq =
            (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy) + (tz - cz) * (tz - cz);

          if (
            distSq > LERP_EPSILON_SQ ||
            current.hoveredObject !== target.hoveredObject ||
            current.updatedAt !== target.updatedAt
          ) {
            const interpolatedPos: [number, number, number] =
              distSq > LERP_EPSILON_SQ
                ? lerpCursor3DPosition(current.position, target.position, CURSOR_LERP_FACTOR)
                : [tx, ty, tz];

            const interpolatedNormal: [number, number, number] | undefined =
              current.normal && target.normal
                ? lerpCursor3DPosition(current.normal, target.normal, CURSOR_LERP_FACTOR)
                : target.normal;

            next[id] = {
              ...target,
              position: interpolatedPos,
              normal: interpolatedNormal,
            };
            mutated = true;
          }
        }

        return mutated ? next : prev;
      });
    }, LERP_FRAME_MS);

    return () => clearInterval(lerpInterval);
  }, []);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data !== 'string') return;
        const msg = JSON.parse(event.data);
        if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

        const { current } = optionsRef;

        if (msg.type === 'init:state' && Array.isArray(msg.payload?.paramLocks)) {
          const locksList: ParameterLockPayload[] = msg.payload.paramLocks;
          const relevantLocks: Record<string, ParameterLockPayload> = {};
          const now = Date.now();
          for (const lock of locksList) {
            if (
              lock &&
              typeof lock.paramKey === 'string' &&
              lock.groupId === current.groupId &&
              typeof lock.expiresAt === 'number' &&
              lock.expiresAt > now
            ) {
              relevantLocks[lock.paramKey] = lock;
            }
          }
          setParamLocks(relevantLocks);
        } else if (msg.type === 'CURSOR_3D_MOVE' && msg.payload) {
          const incoming = msg.payload as SpatialCursorPayload;
          if (!incoming || typeof incoming.userId !== 'string' || !isValidVec3(incoming.position)) {
            return;
          }
          // Only show cursors from other users in the same group and domain
          if (
            incoming.userId !== current.userId &&
            incoming.groupId === current.groupId &&
            incoming.domain === current.domain
          ) {
            targetCursorsRef.current[incoming.userId] = incoming;

            setRemoteCursors((prev) => {
              const existing = prev[incoming.userId];
              if (!existing) {
                return {
                  ...prev,
                  [incoming.userId]: incoming,
                };
              }
              // Apply one immediate LERP step: currentPos + (targetPos - currentPos) * 0.25
              const lerpedPosition = lerpCursor3DPosition(
                existing.position,
                incoming.position,
                CURSOR_LERP_FACTOR
              );
              const lerpedNormal =
                existing.normal && isValidVec3(incoming.normal)
                  ? lerpCursor3DPosition(existing.normal, incoming.normal, CURSOR_LERP_FACTOR)
                  : incoming.normal;

              return {
                ...prev,
                [incoming.userId]: {
                  ...incoming,
                  position: lerpedPosition,
                  normal: lerpedNormal,
                },
              };
            });
          }
        } else if (msg.type === 'CURSOR_3D_LEAVE' && msg.payload) {
          const leavingId = msg.payload.userId;
          if (typeof leavingId === 'string') {
            delete targetCursorsRef.current[leavingId];
            setRemoteCursors((prev) => {
              if (!prev[leavingId]) return prev;
              const next = { ...prev };
              delete next[leavingId];
              return next;
            });
          }
        } else if (msg.type === 'PARAM_LOCK_ACQUIRE' && msg.payload) {
          const lock = msg.payload as ParameterLockPayload;
          if (lock && typeof lock.paramKey === 'string' && lock.groupId === current.groupId) {
            setParamLocks((prev) => ({
              ...prev,
              [lock.paramKey]: lock,
            }));
          }
        } else if (msg.type === 'PARAM_LOCK_RELEASE' && msg.payload) {
          const { groupId: lockGroup, paramKey } = msg.payload;
          if (lockGroup === current.groupId && typeof paramKey === 'string') {
            setParamLocks((prev) => {
              if (!prev[paramKey]) return prev;
              const next = { ...prev };
              delete next[paramKey];
              return next;
            });
          }
        } else if (msg.type === 'PARAM_LOCKS_SYNC' && Array.isArray(msg.payload?.locks)) {
          const locksList: ParameterLockPayload[] = msg.payload.locks;
          const nextLocks: Record<string, ParameterLockPayload> = {};
          const now = Date.now();
          for (const l of locksList) {
            if (
              l &&
              typeof l.paramKey === 'string' &&
              l.groupId === current.groupId &&
              typeof l.expiresAt === 'number' &&
              l.expiresAt > now
            ) {
              nextLocks[l.paramKey] = l;
            }
          }
          setParamLocks(nextLocks);
        } else if (msg.type === 'PARAM_VALUE_SYNC' && msg.payload) {
          const { groupId: syncGroup, paramKey, value, updatedBy } = msg.payload;
          if (
            syncGroup === current.groupId &&
            updatedBy !== current.userId &&
            typeof paramKey === 'string' &&
            typeof value === 'number' &&
            Number.isFinite(value)
          ) {
            current.onRemoteParamSync?.(paramKey, value);
          }
        }
      } catch {
        // Non-critical JSON parse error from corrupted messages
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

      for (const [id, target] of Object.entries(targetCursorsRef.current)) {
        if (now - target.updatedAt > CURSOR_TTL_MS) {
          delete targetCursorsRef.current[id];
        }
      }

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
      targetCursorsRef.current = {};
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

  // Throttled 3D Cursor Emitter (max 20 Hz / every 50ms)
  const emitCursor3D = useCallback(
    (
      position: [number, number, number],
      normal?: [number, number, number],
      hoveredObject?: string
    ) => {
      const now = Date.now();
      if (!shouldEmitThrottledCursor(now, lastCursorEmitRef.current, THROTTLE_MS)) {
        return;
      }
      lastCursorEmitRef.current = now;

      const {
        ws: curWs,
        userId: curUser,
        userName: curName,
        role: curRole,
        groupId: curGroup,
        domain: curDomain,
        userColor: curColor,
      } = optionsRef.current;

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

    const payload: ParameterLockPayload = {
      groupId: curGroup,
      domain: curDomain,
      paramKey,
      lockedByUserId: curUser,
      lockedByName: curName,
      expiresAt: Date.now() + 5000,
    };

    // Optimistically set locally
    setParamLocks((prev) => ({
      ...prev,
      [paramKey]: payload,
    }));

    if (curWs && curWs.readyState === WebSocket.OPEN) {
      curWs.send(
        JSON.stringify({
          type: 'PARAM_LOCK_ACQUIRE',
          payload,
        })
      );
    } else {
      pendingParamOutboxRef.current.push({ type: 'PARAM_LOCK_ACQUIRE', payload });
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

    const payload = {
      groupId: curGroup,
      domain: curDomain,
      paramKey,
      userId: curUser,
    };

    if (curWs && curWs.readyState === WebSocket.OPEN) {
      curWs.send(
        JSON.stringify({
          type: 'PARAM_LOCK_RELEASE',
          payload,
        })
      );
    } else {
      pendingParamOutboxRef.current.push({ type: 'PARAM_LOCK_RELEASE', payload });
    }
  }, []);

  // Sync Slider Value in Real-Time (with offline outbox buffering when reconnecting)
  const syncParamValue = useCallback((paramKey: string, value: number) => {
    const { ws: curWs, userId: curUser, groupId: curGroup, domain: curDomain } =
      optionsRef.current;

    const payload = {
      groupId: curGroup,
      domain: curDomain,
      paramKey,
      value,
      updatedBy: curUser,
    };

    if (curWs && curWs.readyState === WebSocket.OPEN) {
      curWs.send(
        JSON.stringify({
          type: 'PARAM_VALUE_SYNC',
          payload,
        })
      );
    } else {
      pendingParamOutboxRef.current.push({ type: 'PARAM_VALUE_SYNC', payload });
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
