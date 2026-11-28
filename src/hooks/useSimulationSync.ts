import { useCallback, useEffect, useRef } from 'react';
import { useSimulationWorker } from './useSimulationWorker';

export { useSimulationWorker };

export interface UseSimulationSyncOptions {
  roomPin: string | null | undefined;
  roomId: string | null | undefined;
  sendMessage: (type: string, payload: unknown) => void;
  throttleMs?: number;
}

export interface SimulationParamsDeltaResult {
  hasChanges: boolean;
  changedKeys: string[];
  delta: Record<string, unknown>;
}

function areValuesShallowOrDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!areValuesShallowOrDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!areValuesShallowOrDeepEqual(objA[key], objB[key])) return false;
  }
  return true;
}

/**
 * Pure helper computing minimal changed keys between consecutive simulation snapshots
 * so identical frames do not waste 3T classroom WebSocket bandwidth.
 */
export function computeSimulationParamsDelta(
  prevParams: Record<string, unknown> | null,
  nextParams: Record<string, unknown>
): SimulationParamsDeltaResult {
  if (!prevParams) {
    const allKeys = Object.keys(nextParams);
    return {
      hasChanges: allKeys.length > 0,
      changedKeys: allKeys,
      delta: { ...nextParams },
    };
  }

  const changedKeys: string[] = [];
  const delta: Record<string, unknown> = {};

  for (const key of Object.keys(nextParams)) {
    const nextVal = nextParams[key];
    const prevVal = prevParams[key];
    if (!areValuesShallowOrDeepEqual(prevVal, nextVal)) {
      changedKeys.push(key);
      if (
        prevVal &&
        nextVal &&
        typeof prevVal === 'object' &&
        typeof nextVal === 'object' &&
        !Array.isArray(prevVal) &&
        !Array.isArray(nextVal)
      ) {
        const subDelta: Record<string, unknown> = {};
        const nextSub = nextVal as Record<string, unknown>;
        const prevSub = prevVal as Record<string, unknown>;
        for (const subKey of Object.keys(nextSub)) {
          if (!areValuesShallowOrDeepEqual(prevSub[subKey], nextSub[subKey])) {
            subDelta[subKey] = nextSub[subKey];
          }
        }
        delta[key] = subDelta;
      } else {
        delta[key] = nextVal;
      }
    }
  }

  return {
    hasChanges: changedKeys.length > 0,
    changedKeys,
    delta,
  };
}

/**
 * Merges a partial delta snapshot onto a base simulation parameter object.
 */
export function mergeSimulationSnapshotParams(
  baseParams: Record<string, unknown>,
  incomingDelta: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...baseParams };
  for (const [key, val] of Object.entries(incomingDelta)) {
    const existing = merged[key];
    if (
      existing &&
      val &&
      typeof existing === 'object' &&
      typeof val === 'object' &&
      !Array.isArray(existing) &&
      !Array.isArray(val)
    ) {
      merged[key] = {
        ...(existing as Record<string, unknown>),
        ...(val as Record<string, unknown>),
      };
    } else {
      merged[key] = val;
    }
  }
  return merged;
}

/**
 * Modular hook bridging the off-thread RK4 Web Worker (`simulationWorker.ts`)
 * with throttled, delta-deduplicated simulation parameter snapshot persistence (`simulation_snapshots`).
 */
export function useSimulationSync(options?: UseSimulationSyncOptions) {
  const throttleMs = options?.throttleMs ?? 600;
  const lastPushTimeRef = useRef<number>(0);
  const lastPushedParamsRef = useRef<Record<string, unknown> | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestParamsRef = useRef<Record<string, unknown> | null>(null);

  const flushSnapshotToServer = useCallback(
    (params: Record<string, unknown>) => {
      const pin = options?.roomPin?.trim();
      if (!pin) return;
      const diff = computeSimulationParamsDelta(lastPushedParamsRef.current, params);
      if (!diff.hasChanges) return;

      lastPushTimeRef.current = Date.now();
      lastPushedParamsRef.current = structuredClone(params);
      options?.sendMessage?.('SIMULATION_SNAPSHOT_PUSH', {
        roomPin: pin,
        roomId: options?.roomId ?? undefined,
        params,
        delta: diff.delta,
        changedKeys: diff.changedKeys,
        updatedAt: lastPushTimeRef.current,
      });
    },
    [options]
  );

  const scheduleSnapshotSync = useCallback(
    (params: Record<string, unknown>) => {
      latestParamsRef.current = params;
      const pin = options?.roomPin?.trim();
      if (!pin) return;

      const diff = computeSimulationParamsDelta(lastPushedParamsRef.current, params);
      if (!diff.hasChanges) return;

      const now = Date.now();
      const elapsed = now - lastPushTimeRef.current;
      if (elapsed >= throttleMs) {
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        flushSnapshotToServer(params);
        return;
      }

      if (!pendingTimerRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          if (latestParamsRef.current) {
            flushSnapshotToServer(latestParamsRef.current);
          }
        }, throttleMs - elapsed);
      }
    },
    [options?.roomPin, throttleMs, flushSnapshotToServer]
  );

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  return {
    scheduleSnapshotSync,
    flushSnapshotToServer,
  };
}
