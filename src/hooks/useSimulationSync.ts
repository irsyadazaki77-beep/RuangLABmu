import { useCallback, useEffect, useRef } from 'react';
import { useSimulationWorker } from './useSimulationWorker';

export { useSimulationWorker };

export interface UseSimulationSyncOptions {
  roomPin: string | null | undefined;
  roomId: string | null | undefined;
  sendMessage: (type: string, payload: unknown) => void;
  throttleMs?: number;
}

/**
 * Modular hook bridging the off-thread RK4 Web Worker (`simulationWorker.ts`)
 * with throttled simulation parameter snapshot persistence (`simulation_snapshots` in SQLite).
 */
export function useSimulationSync(options?: UseSimulationSyncOptions) {
  const throttleMs = options?.throttleMs ?? 600;
  const lastPushTimeRef = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestParamsRef = useRef<Record<string, unknown> | null>(null);

  const flushSnapshotToServer = useCallback(
    (params: Record<string, unknown>) => {
      const pin = options?.roomPin?.trim();
      if (!pin) return;
      lastPushTimeRef.current = Date.now();
      options?.sendMessage?.('SIMULATION_SNAPSHOT_PUSH', {
        roomPin: pin,
        roomId: options?.roomId ?? undefined,
        params,
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
