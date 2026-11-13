import React from 'react';
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
} from 'lucide-react';
import { SimulationFrame } from '../utils/simulationBuffer';
import {
  InstrumentSpecs,
  DEFAULT_INSTRUMENTS,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import { labSound } from '../utils/soundEngine';

export interface SimulationPlaybackBarProps {
  currentFrame: SimulationFrame | null;
  bounds: { minFrame: number; maxFrame: number; count: number };
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSeek: (frameIndex: number) => void;
  noiseEnabled: boolean;
  onToggleNoise: (enabled: boolean) => void;
  instrumentType?: InstrumentSpecs['type'];
}

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
}) => {
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
      className="bg-slate-900/95 text-slate-100 border border-slate-700/80 rounded-xl p-3.5 shadow-md space-y-3"
    >
      {/* Top Row: Playback Buttons + Timeline Scrubber + Time Display */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback Button Group */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 p-1 rounded-xl">
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
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
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition-colors"
          />
        </div>

        {/* Time Readout with Optional Instrument Uncertainty Badge */}
        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
          <div className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-slate-200">
            <span className="text-slate-400">t = </span>
            {noiseEnabled ? (
              <span className="text-amber-400 font-semibold">
                {formatMeasurementWithUncertainty(
                  timeMeasurement.measuredValue,
                  timeMeasurement.uncertainty,
                  stopwatchInstrument.unit
                )}
              </span>
            ) : (
              <span className="text-sky-300 font-semibold">{rawTime.toFixed(2)} s</span>
            )}
            <span className="text-slate-500 ml-1.5 text-[10px]">
              (f: {currentIdx}/{bounds.maxFrame})
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Energy Conservation Readout + Realistic Instrument Noise Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800">
        {/* Live Energy Conservation Telemetry */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-slate-400 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            Konservasi Energi:
          </span>

          <span className="font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
            Ek: {kinetic.toFixed(2)} J
          </span>

          <span className="font-mono text-sky-400 bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded">
            Ep: {potential.toFixed(2)} J
          </span>

          {thermal > 0 && (
            <span className="font-mono text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded flex items-center gap-1">
              <Flame className="w-3 h-3" />
              E_termal: {thermal.toFixed(2)} J
            </span>
          )}

          <span className="font-mono text-amber-300 font-semibold bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            E_total: {total.toFixed(2)} J
          </span>
        </div>

        {/* Realistic Lab Noise Toggle Switch & Instrument Spec */}
        <div className="flex items-center gap-2">
          {noiseEnabled && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-amber-300/90 bg-amber-950/40 border border-amber-900/60 px-2 py-0.5 rounded">
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
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
              noiseEnabled
                ? 'bg-amber-950/80 text-amber-300 border-amber-600 shadow-xs'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 ${
                noiseEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span>Mode Ketidakpastian Alat Ukur</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                noiseEnabled ? 'bg-amber-600 text-slate-950 font-bold' : 'bg-slate-700 text-slate-400'
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
