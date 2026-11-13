import { useEffect, useRef } from 'react';
import {
  getDomainTimelineBuffer,
  TimelineFrame,
} from '../utils/simulationTimelineBuffer';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { useLabStore } from '../stores/useLabStore';

export interface UseTimelineRecorderOptions<TParams, TState> {
  domain: string;
  simTime: number;
  simTimeRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  params: TParams;
  stateSnapshot: TState;
  onRestoreFrame: (frame: TimelineFrame<TParams, TState>) => void;
}

/**
 * Records simulation snapshots into the 600-frame ring buffer (~30Hz = 20s)
 * and synchronizes Time-Travel scrubbing & branching resume with LabControlDock.
 */
export function useTimelineRecorder<TParams, TState>({
  domain,
  simTime,
  simTimeRef,
  isPlaying,
  params,
  stateSnapshot,
  onRestoreFrame,
}: UseTimelineRecorderOptions<TParams, TState>): void {
  const latestRef = useRef({
    params,
    stateSnapshot,
    onRestoreFrame,
    isPlaying,
  });
  latestRef.current = { params, stateSnapshot, onRestoreFrame, isPlaying };

  const lastPushMsRef = useRef<number>(0);
  const lastUiSyncMsRef = useRef<number>(0);

  // Clear buffer when switching lab domain
  useEffect(() => {
    const buf = getDomainTimelineBuffer<TParams, TState>(domain);
    buf.clear();
    lastPushMsRef.current = 0;
    lastUiSyncMsRef.current = 0;
    useLabStore.getState().resetTimelineState();
    return () => {
      buf.clear();
    };
  }, [domain]);

  // Capture frames at ~30Hz (33ms) while simulation is running forward
  useEffect(() => {
    const storeState = useLabStore.getState();
    if (!isPlaying || storeState.isTimeTraveling) return;

    const nowMs = performance.now();
    if (nowMs - lastPushMsRef.current < 33) return;
    lastPushMsRef.current = nowMs;

    const buf = getDomainTimelineBuffer<TParams, TState>(domain);
    buf.push(simTime, params, stateSnapshot);

    if (nowMs - lastUiSyncMsRef.current >= 100 || buf.getCount() <= 2) {
      lastUiSyncMsRef.current = nowMs;
      const range = buf.getRange();
      storeState.setTimelineStatus({
        timelineCount: range.count,
        timelineCursor: Math.max(0, range.count - 1),
        timelineMinTime: range.minTime,
        timelineMaxTime: range.maxTime,
        timelineCurrentTime: simTime,
      });
    }
  }, [domain, simTime, isPlaying, params, stateSnapshot]);

  // Subscribe to Time-Travel Seek, Branching Resume, and Reset
  useEffect(() => {
    const unsubSeek = subscribeLabEvent(LAB_EVENTS.SEEK_TIMELINE, (detail) => {
      if (!detail) return;
      const buf = getDomainTimelineBuffer<TParams, TState>(domain);
      const frame = buf.getAt(detail.cursorIndex);
      if (!frame) return;

      simTimeRef.current = frame.simTime;
      latestRef.current.onRestoreFrame(frame);

      const range = buf.getRange();
      useLabStore.getState().setTimelineStatus({
        timelineCount: range.count,
        timelineCursor: Math.max(0, Math.min(range.count - 1, detail.cursorIndex)),
        timelineMinTime: range.minTime,
        timelineMaxTime: range.maxTime,
        timelineCurrentTime: frame.simTime,
        isTimeTraveling: true,
      });
    });

    const unsubResume = subscribeLabEvent(LAB_EVENTS.RESUME_FROM_TIMELINE, (detail) => {
      const buf = getDomainTimelineBuffer<TParams, TState>(domain);
      if (detail && buf.getCount() > 0) {
        buf.truncateAfter(detail.cursorIndex);
      }
      const range = buf.getRange();
      lastPushMsRef.current = 0;
      useLabStore.getState().setTimelineStatus({
        timelineCount: range.count,
        timelineCursor: Math.max(0, range.count - 1),
        timelineMinTime: range.minTime,
        timelineMaxTime: range.maxTime,
        timelineCurrentTime: range.maxTime,
        isTimeTraveling: false,
      });
    });

    const unsubReset = subscribeLabEvent(LAB_EVENTS.RESET_TRIAL, () => {
      const buf = getDomainTimelineBuffer<TParams, TState>(domain);
      buf.clear();
      lastPushMsRef.current = 0;
      lastUiSyncMsRef.current = 0;
      useLabStore.getState().resetTimelineState();
    });

    return () => {
      unsubSeek();
      unsubResume();
      unsubReset();
    };
  }, [domain, simTimeRef]);
}
