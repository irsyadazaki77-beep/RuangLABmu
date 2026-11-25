import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Play, Square, Sparkles, Sliders } from 'lucide-react';
import type { AutoSweepPoint, DomainScenarioPreset } from '../../utils/labScenarioPresets';
import { labSound } from '../../utils/soundEngine';

export interface LabPresetAndSweepBarProps<TParams = Record<string, unknown>> {
  presets: DomainScenarioPreset<TParams>[];
  sweepSteps: AutoSweepPoint<Record<string, number>>[];
  accentColor?: 'sky' | 'teal' | 'emerald';
  onApplyPreset: (preset: DomainScenarioPreset<TParams>) => void;
  onSweepStep: (step: AutoSweepPoint<Record<string, number>>) => void;
  onSweepComplete?: (count: number) => void;
}

export function LabPresetAndSweepBar<TParams = Record<string, unknown>>({
  presets,
  sweepSteps,
  accentColor = 'sky',
  onApplyPreset,
  onSweepStep,
  onSweepComplete,
}: LabPresetAndSweepBarProps<TParams>) {
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetsExpanded, setPresetsExpanded] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const stepIndexRef = useRef<number>(0);

  // Stop any running sweep if module/steps change or unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sweepSteps]);

  const stopSweep = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSweeping(false);
  };

  const handleStartSweep = () => {
    if (isSweeping) {
      labSound.playClick();
      stopSweep();
      return;
    }
    if (sweepSteps.length === 0) return;

    labSound.playClick(660);
    setIsSweeping(true);
    setSweepProgress(0);
    stepIndexRef.current = 0;

    // Run step 0 immediately so user sees instant feedback
    const runNext = () => {
      const idx = stepIndexRef.current;
      if (idx >= sweepSteps.length) {
        stopSweep();
        labSound.playSuccessChime();
        onSweepComplete?.(sweepSteps.length);
        return;
      }
      const step = sweepSteps[idx];
      onSweepStep(step);
      setSweepProgress(idx + 1);
      stepIndexRef.current = idx + 1;

      if (stepIndexRef.current >= sweepSteps.length) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        window.setTimeout(() => {
          setIsSweeping(false);
          labSound.playSuccessChime();
          onSweepComplete?.(sweepSteps.length);
        }, 280);
      }
    };

    runNext();
    if (sweepSteps.length > 1) {
      timerRef.current = window.setInterval(runNext, 420);
    }
  };

  const accentClasses =
    accentColor === 'emerald'
      ? {
          active: 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
          btn: 'bg-emerald-600 hover:bg-emerald-500',
          bar: 'bg-emerald-500',
        }
      : accentColor === 'teal'
      ? {
          active: 'border-teal-500 bg-teal-500/12 text-teal-700 dark:text-teal-300',
          btn: 'bg-teal-600 hover:bg-teal-500',
          bar: 'bg-teal-500',
        }
      : {
          active: 'border-sky-500 bg-sky-500/12 text-sky-700 dark:text-sky-300',
          btn: 'bg-sky-600 hover:bg-sky-500',
          bar: 'bg-sky-500',
        };

  return (
    <div
      data-testid="lab-preset-sweep-bar"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-3 space-y-2.5"
    >
      {/* Collapsible Scenario Presets */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => {
            labSound.playClick(600);
            setPresetsExpanded((prev) => !prev);
          }}
          aria-expanded={presetsExpanded}
          className="w-full flex items-center justify-between text-2xs font-bold text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] uppercase tracking-wider cursor-pointer py-0.5"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sliders className="w-3 h-3" aria-hidden="true" />
            <span>Preset Skenario ({presets.length})</span>
          </span>
          {presetsExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
        </button>

        {presetsExpanded && (
          <div className="grid grid-cols-1 gap-1.5 pt-1">
            {presets.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`scenario-preset-${preset.id}`}
                  onClick={() => {
                    labSound.playClick(620);
                    setActivePresetId(preset.id);
                    onApplyPreset(preset);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? accentClasses.active
                      : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] hover:border-sky-500/40 text-[var(--comfort-text)]'
                  }`}
                >
                  <div className="text-xs font-semibold leading-tight">{preset.label}</div>
                  <div className="text-2xs font-mono text-[var(--comfort-text-muted)] mt-0.5 truncate">
                    {preset.summary}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5-Point Auto-Sweep Data Acquisition */}
      <div className="pt-2 border-t border-[var(--comfort-border)] space-y-2">
        <button
          type="button"
          data-testid="auto-sweep-5pt-btn"
          onClick={handleStartSweep}
          className={`w-full px-3 py-2 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap ${
            isSweeping ? 'bg-rose-600 hover:bg-rose-500' : accentClasses.btn
          }`}
        >
          {isSweeping ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Hentikan Sweep ({sweepProgress}/{sweepSteps.length})</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Auto-Sweep {sweepSteps.length} Titik Data</span>
              <Play className="w-3 h-3 fill-current ml-0.5" aria-hidden="true" />
            </>
          )}
        </button>

        {isSweeping || sweepProgress > 0 ? (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-[var(--comfort-surface)] overflow-hidden border border-[var(--comfort-border)]">
              <div
                className={`h-full transition-all duration-300 ${accentClasses.bar}`}
                style={{ width: `${Math.round((sweepProgress / Math.max(1, sweepSteps.length)) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
              <span>
                {isSweeping
                  ? `Mengukur ${sweepSteps[Math.max(0, sweepProgress - 1)]?.paramLabel ?? ''}...`
                  : `Selesai merekam ${sweepProgress} titik regresi`}
              </span>
              <span>
                {sweepProgress}/{sweepSteps.length}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-2xs text-[var(--comfort-text-muted)] leading-snug">
            Otomatis menyapu 5 variasi{' '}
            <strong className="text-[var(--comfort-text)]">
              {sweepSteps[0]?.paramLabel || 'variabel bebas'}
            </strong>{' '}
            dan mencatat ke tabel regresi.
          </p>
        )}
      </div>
    </div>
  );
}
