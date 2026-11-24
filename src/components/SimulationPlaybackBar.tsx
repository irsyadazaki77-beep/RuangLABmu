import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  Activity,
  ShieldAlert,
  Gauge,
} from 'lucide-react';
import { SimulationFrame } from '../utils/simulationBuffer';
import {
  InstrumentSpecs,
  DEFAULT_INSTRUMENTS,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import { labSound } from '../utils/soundEngine';

export type PlaybackSpeedMultiplier = 0.25 | 0.5 | 1 | 2;

export interface SimulationPlaybackBarProps {
  currentFrame: SimulationFrame | null;
  bounds: { minFrame: number; maxFrame: number; count: number };
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onSeek: (frameIndex: number) => void;
  noiseEnabled: boolean;
  onToggleNoise: (enabled: boolean) => void;
  instrumentType?: InstrumentSpecs['type'];
  playbackSpeed?: PlaybackSpeedMultiplier;
  onPlaybackSpeedChange?: (speed: PlaybackSpeedMultiplier) => void;
}

const SPEED_OPTIONS: PlaybackSpeedMultiplier[] = [0.25, 0.5, 1, 2];

export const SimulationPlaybackBar: React.FC<SimulationPlaybackBarProps> = ({
  currentFrame,
  bounds,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  onStepForward,
  onStepBackward,
  onSeek,
  noiseEnabled,
  onToggleNoise,
  instrumentType = 'stopwatch',
  playbackSpeed: controlledSpeed,
  onPlaybackSpeedChange,
}) => {
  const [internalSpeed, setInternalSpeed] = useState<PlaybackSpeedMultiplier>(1);
  const currentSpeed = controlledSpeed ?? internalSpeed;
  const activeInstrument = DEFAULT_INSTRUMENTS[instrumentType] ?? DEFAULT_INSTRUMENTS.stopwatch;
  const stopwatchInstrument = DEFAULT_INSTRUMENTS.stopwatch;
  const rawTime = currentFrame ? currentFrame.timestamp : 0;
  const timeMeasurement = applyInstrumentNoise(rawTime, stopwatchInstrument, noiseEnabled);

  const currentIdx = currentFrame ? currentFrame.frameIndex : bounds.minFrame;

  const kinetic = currentFrame ? currentFrame.energies.kinetic : 0;
  const potential = currentFrame ? currentFrame.energies.potential : 0;
  const thermal = currentFrame ? currentFrame.energies.thermal : 0;
  const total = currentFrame ? currentFrame.energies.total : 0;

  return (
    <div
      aria-label="Panel Kontrol Playback Simulasi & Scrubber Waktu"
      className="bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] rounded-xl p-3.5 shadow-sm space-y-3"
    >
      {/* Top Row: Playback Buttons + Timeline Scrubber + Speed Selector + Time Display */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback Button Group */}
        <div className="flex items-center gap-1.5 bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              if (isPlaying) {
                onPause();
              } else {
                onPlay();
              }
            }}
            aria-label={isPlaying ? 'Jeda Simulasi' : 'Jalankan Simulasi'}
            className={`min-h-[44px] min-w-[44px] px-3.5 flex items-center justify-center gap-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 shrink-0" />
                <span>Jeda</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 shrink-0" />
                <span>Putar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onStepBackward();
            }}
            aria-label="Langkah Mundur 1 Frame (-1/60s)"
            title="Langkah Mundur 1 Frame (-1/60s)"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onStepForward();
            }}
            aria-label="Langkah Maju 1 Frame (+1/60s)"
            title="Langkah Maju 1 Frame (+1/60s)"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onReset();
            }}
            aria-label="Reset Simulasi ke Frame Awal"
            title="Reset ke Frame Awal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--comfort-text-muted)] hover:text-rose-500 hover:bg-[var(--comfort-surface)] rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Slider / Scrubber */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2.5">
          <label htmlFor="playback-time-scrubber" className="sr-only">
            Scrubber Garis Waktu Simulasi
          </label>
          <input
            id="playback-time-scrubber"
            type="range"
            min={bounds.minFrame}
            max={bounds.maxFrame}
            step={1}
            value={currentIdx}
            onChange={(e) => {
              onSeek(Number(e.target.value));
            }}
            aria-valuemin={bounds.minFrame}
            aria-valuemax={bounds.maxFrame}
            aria-valuenow={currentIdx}
            aria-valuetext={`Frame ${currentIdx}, Waktu ${rawTime.toFixed(2)} detik`}
            className="w-full h-2 bg-[var(--comfort-border)] rounded-lg appearance-none cursor-pointer accent-sky-600 dark:accent-sky-400 transition-colors"
          />
        </div>

        {/* Speed Selector (0.25x, 0.5x, 1x, 2x) + Time Readout */}
        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
          <div
            className="inline-flex items-center gap-0.5 bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-lg p-0.5"
            role="group"
            aria-label="Kecepatan Playback Simulasi"
          >
            <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ml-1 mr-0.5 hidden sm:inline" />
            {SPEED_OPTIONS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setInternalSpeed(spd);
                  onPlaybackSpeedChange?.(spd);
                }}
                className={`px-2 py-1 rounded text-2xs font-bold transition-colors cursor-pointer ${
                  currentSpeed === spd
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <div className="bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2.5 py-1 text-[var(--comfort-text)] tabular-nums">
            <span className="text-[var(--comfort-text-muted)]">t = </span>
            {noiseEnabled ? (
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                {formatMeasurementWithUncertainty(
                  timeMeasurement.measuredValue,
                  timeMeasurement.uncertainty,
                  stopwatchInstrument.unit
                )}
              </span>
            ) : (
              <span className="text-sky-700 dark:text-sky-300 font-semibold">{rawTime.toFixed(2)} s</span>
            )}
            <span className="text-[var(--comfort-text-muted)] ml-1.5 text-2xs">
              (f: {currentIdx}/{bounds.maxFrame})
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Energy Conservation Readout + Realistic Instrument Noise Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-[var(--comfort-border)]">
        {/* Live Energy Conservation Telemetry */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[var(--comfort-text-muted)] flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Konservasi Energi:
          </span>

          <span className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded tabular-nums">
            Ek: {kinetic.toFixed(2)} J
          </span>

          <span className="font-mono text-sky-700 dark:text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded tabular-nums">
            Ep: {potential.toFixed(2)} J
          </span>

          {thermal > 0 && (
            <span className="font-mono text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded flex items-center gap-1 tabular-nums">
              <Flame className="w-3 h-3" />
              E_termal: {thermal.toFixed(2)} J
            </span>
          )}

          <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1 tabular-nums">
            <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            E_total: {total.toFixed(2)} J
          </span>
        </div>

        {/* Realistic Lab Noise Toggle Switch & Instrument Spec */}
        <div className="flex items-center gap-2">
          {noiseEnabled && (
            <span className="hidden sm:inline-flex items-center gap-1 text-2xs font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded tabular-nums">
              Alat: {activeInstrument.type} (NST {activeInstrument.smallestScaleDivision} {activeInstrument.unit})
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onToggleNoise(!noiseEnabled);
            }}
            aria-pressed={noiseEnabled}
            className={`min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              noiseEnabled
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/50'
                : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] border-[var(--comfort-border)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 ${
                noiseEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--comfort-text-muted)]'
              }`}
            />
            <span>Mode Ketidakpastian Alat Ukur</span>
            <span
              className={`text-2xs px-1.5 py-0.5 rounded font-mono ${
                noiseEnabled
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
              }`}
            >
              {noiseEnabled ? 'AKTIF (±Δx)' : 'OFF'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
