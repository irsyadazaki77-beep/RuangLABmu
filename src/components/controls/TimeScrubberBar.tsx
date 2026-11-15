import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, RotateCcw } from 'lucide-react';
import { useLabStore } from '../../stores/useLabStore';
import { labSound } from '../../utils/soundEngine';
import {
  SimulationPlaybackBar,
  type PlaybackSpeedMultiplier,
  type SimulationPlaybackBarProps,
} from '../SimulationPlaybackBar';

const SPEED_OPTIONS: PlaybackSpeedMultiplier[] = [0.25, 0.5, 1, 2];

export interface TimeScrubberBarProps extends Partial<SimulationPlaybackBarProps> {
  compactFloating?: boolean;
}

/**
 * Ring-Buffer Time Scrubber & Synchronized Telemetry Cursor
 * Connects to simulationWorker.ts ring-buffer history via Zustand useShallow selectors
 * or explicit frame bounds when passed directly by a domain view.
 */
export const TimeScrubberBar: React.FC<TimeScrubberBarProps> = (props) => {
  const {
    isSimulating,
    playbackSpeed,
    isTimeTraveling,
    timelineCount,
    timelineCursor,
    timelineCurrentTime,
    toggleSimulation,
    triggerResetTrial,
    setPlaybackSpeed,
    seekTimelineCursor,
  } = useLabStore(
    useShallow((s) => ({
      isSimulating: s.isSimulating,
      playbackSpeed: s.playbackSpeed,
      isTimeTraveling: s.isTimeTraveling,
      timelineCount: s.timelineCount,
      timelineCursor: s.timelineCursor,
      timelineCurrentTime: s.timelineCurrentTime,
      toggleSimulation: s.toggleSimulation,
      triggerResetTrial: s.triggerResetTrial,
      setPlaybackSpeed: s.setPlaybackSpeed,
      seekTimelineCursor: s.seekTimelineCursor,
    }))
  );

  // If full SimulationPlaybackBar props are provided (e.g. inside PhysicsLabView),
  // synchronize seek events with useLabStore so telemetry charts stay in lockstep.
  if (
    props.bounds &&
    props.onPlay &&
    props.onPause &&
    props.onReset &&
    props.onStepBackward &&
    props.onStepForward &&
    props.onSeek &&
    props.onToggleNoise !== undefined
  ) {
    return (
      <SimulationPlaybackBar
        currentFrame={props.currentFrame ?? null}
        bounds={props.bounds}
        isPlaying={props.isPlaying ?? isSimulating}
        onPlay={props.onPlay}
        onPause={props.onPause}
        onReset={props.onReset}
        onStepBackward={props.onStepBackward}
        onStepForward={props.onStepForward}
        onSeek={(frameIdx) => {
          props.onSeek?.(frameIdx);
          seekTimelineCursor(frameIdx);
        }}
        noiseEnabled={props.noiseEnabled ?? false}
        onToggleNoise={props.onToggleNoise}
        instrumentType={props.instrumentType}
        playbackSpeed={(props.playbackSpeed ?? playbackSpeed) as PlaybackSpeedMultiplier}
        onPlaybackSpeedChange={(spd) => {
          props.onPlaybackSpeedChange?.(spd);
          setPlaybackSpeed(spd);
        }}
      />
    );
  }

  const maxIdx = Math.max(0, timelineCount - 1);
  const currentIdx = isTimeTraveling ? timelineCursor : maxIdx;
  const displaySeconds = Number.isFinite(timelineCurrentTime) ? timelineCurrentTime : 0;

  return (
    <div
      data-testid="floating-time-scrubber-bar"
      aria-label="Scrubber Garis Waktu Ring-Buffer Simulasi"
      className="bg-slate-900/90 backdrop-blur-md text-slate-100 border border-slate-700/80 rounded-2xl px-3.5 py-2 shadow-xl flex flex-wrap items-center justify-between gap-3"
    >
      {/* Play/Pause + Single-Frame Step + Reset */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            toggleSimulation();
          }}
          aria-label={isSimulating ? 'Jeda Simulasi' : 'Jalankan Simulasi'}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
            isSimulating
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isSimulating ? 'Jeda' : 'Putar'}</span>
        </button>

        <button
          type="button"
          disabled={timelineCount === 0 || currentIdx <= 0}
          onClick={() => {
            labSound.playClick();
            seekTimelineCursor(Math.max(0, currentIdx - 1));
          }}
          aria-label="Langkah Mundur 1 Frame"
          title="Langkah Mundur 1 Frame"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={timelineCount === 0 || currentIdx >= maxIdx}
          onClick={() => {
            labSound.playClick();
            seekTimelineCursor(Math.min(maxIdx, currentIdx + 1));
          }}
          aria-label="Langkah Maju 1 Frame"
          title="Langkah Maju 1 Frame"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            triggerResetTrial();
          }}
          aria-label="Reset Simulasi"
          title="Reset Simulasi"
          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ring-Buffer Timeline Slider */}
      <div className="flex-1 min-w-[160px] flex items-center gap-2">
        <input
          type="range"
          aria-label="Scrubber Garis Waktu Ring-Buffer"
          min={0}
          max={Math.max(1, maxIdx)}
          step={1}
          disabled={timelineCount <= 1}
          value={currentIdx}
          onChange={(e) => seekTimelineCursor(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
        />
      </div>

      {/* Playback Speed Selector (0.25x, 0.5x, 1x, 2x) + Live Clock */}
      <div className="flex items-center gap-2 font-mono text-xs shrink-0">
        <div
          className="inline-flex items-center gap-0.5 bg-slate-800/90 border border-slate-700 rounded-lg p-0.5"
          role="group"
          aria-label="Kecepatan Playback Simulasi"
        >
          <Gauge className="w-3.5 h-3.5 text-cyan-400 ml-1 mr-0.5 hidden sm:inline" />
          {SPEED_OPTIONS.map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => {
                labSound.playClick();
                setPlaybackSpeed(spd);
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                Math.abs(playbackSpeed - spd) < 0.01
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-cyan-300 font-bold tabular-nums">
          t = {displaySeconds.toFixed(2)} s
        </div>
      </div>
    </div>
  );
};
