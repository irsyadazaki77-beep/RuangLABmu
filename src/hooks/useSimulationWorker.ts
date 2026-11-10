import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { SimulationFrame } from '../utils/simulationBuffer';
import {
  SimulationMode,
  SimulationEventType,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../types/simulationWorkerTypes';

export interface UseSimulationWorkerReturn {
  currentFrame: SimulationFrame | null;
  bounds: { minFrame: number; maxFrame: number; count: number };
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  stepForward: (delta?: number) => void;
  stepBackward: (delta?: number) => void;
  seekFrame: (frameIndex: number) => void;
  updateParams: (params: Record<string, number>) => void;
  lastEvent: { event: SimulationEventType; payload: Record<string, number> } | null;
}

export function useSimulationWorker(
  mode: SimulationMode,
  params: Record<string, number>
): UseSimulationWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [currentFrame, setCurrentFrame] = useState<SimulationFrame | null>(null);
  const [bounds, setBounds] = useState<{ minFrame: number; maxFrame: number; count: number }>({
    minFrame: 0,
    maxFrame: 0,
    count: 0,
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<{
    event: SimulationEventType;
    payload: Record<string, number>;
  } | null>(null);

  // Initialize Worker
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('../workers/simulationWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'FRAME_UPDATE') {
          setCurrentFrame(data.frame);
          setBounds(data.bounds);
          setIsPlaying(data.isPlaying);
        } else if (data.type === 'SIMULATION_EVENT') {
          setLastEvent({ event: data.event, payload: data.payload });
        }
      };

      const initMsg: WorkerInboundMessage = {
        type: 'INIT',
        mode,
        params,
      };
      worker.postMessage(initMsg);
    } catch (err) {
      console.error('Failed to create simulation worker:', err);
    }

    return () => {
      if (worker) {
        worker.terminate();
        workerRef.current = null;
      }
    };
  }, [mode]);

  // Sync parameter updates to worker
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
    if (workerRef.current) {
      const msg: WorkerInboundMessage = {
        type: 'UPDATE_PARAMS',
        params,
      };
      workerRef.current.postMessage(msg);
    }
  }, [params]);

  const play = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PLAY' });
    }
  }, []);

  const pause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PAUSE' });
    }
  }, []);

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESET' });
    }
  }, []);

  const stepForward = useCallback((delta = 1) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STEP_FRAMES', deltaFrames: Math.max(1, delta) });
    }
  }, []);

  const stepBackward = useCallback((delta = 1) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STEP_FRAMES', deltaFrames: -Math.max(1, delta) });
    }
  }, []);

  const seekFrame = useCallback((frameIndex: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'SEEK_FRAME', frameIndex });
    }
  }, []);

  const updateParams = useCallback((newParams: Record<string, number>) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'UPDATE_PARAMS', params: newParams });
    }
  }, []);

  return useMemo(
    () => ({
      currentFrame,
      bounds,
      isPlaying,
      play,
      pause,
      reset,
      stepForward,
      stepBackward,
      seekFrame,
      updateParams,
      lastEvent,
    }),
    [
      currentFrame,
      bounds,
      isPlaying,
      play,
      pause,
      reset,
      stepForward,
      stepBackward,
      seekFrame,
      updateParams,
      lastEvent,
    ]
  );
}
