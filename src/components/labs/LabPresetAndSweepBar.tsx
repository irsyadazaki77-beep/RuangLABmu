import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  Sparkles,
  Sliders,
  Pin,
  PinOff,
  RotateCcw,
  Flame,
} from 'lucide-react';
import {
  computeParameterBaselineDeltas,
  type AutoSweepPoint,
  type DomainScenarioPreset,
} from '../../utils/labScenarioPresets';
import { labSound } from '../../utils/soundEngine';

export interface LabPresetAndSweepBarProps<TParams = Record<string, unknown>> {
  presets: DomainScenarioPreset<TParams>[];
  sweepSteps: AutoSweepPoint<Record<string, number>>[];
  accentColor?: 'sky' | 'teal' | 'emerald';
  currentParams?: Record<string, unknown>;
  onApplyPreset: (preset: DomainScenarioPreset<TParams>) => void;
  onSweepStep: (step: AutoSweepPoint<Record<string, number>>) => void;
  onSweepComplete?: (count: number) => void;
}

export function LabPresetAndSweepBar<TParams = Record<string, unknown>>({
  presets,
  sweepSteps,
  accentColor = 'sky',
  currentParams,
  onApplyPreset,
  onSweepStep,
  onSweepComplete,
}: LabPresetAndSweepBarProps<TParams>) {
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetsExpanded, setPresetsExpanded] = useState<boolean>(false);
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<'all' | 'standard' | 'extreme'>('all');
  const [pinnedBaseline, setPinnedBaseline] = useState<Record<string, unknown> | null>(null);
  const [pinnedPresetLabel, setPinnedPresetLabel] = useState<string>('Kondisi Awal');
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const stepIndexRef = useRef<number>(0);

  // Stop any running sweep if module/steps change or unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, [sweepSteps]);

  const stopSweep = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
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
        if (finishTimerRef.current !== null) {
          window.clearTimeout(finishTimerRef.current);
        }
        finishTimerRef.current = window.setTimeout(() => {
          finishTimerRef.current = null;
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

  const filteredPresets = useMemo(() => {
    if (presetCategoryFilter === 'all') return presets;
    return presets.filter((p) => (p.category ?? 'standard') === presetCategoryFilter);
  }, [presets, presetCategoryFilter]);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? null,
    [presets, activePresetId]
  );

  // Merge active preset patch over currentParams if currentParams not explicitly passed
  const effectiveCurrentParams = useMemo(() => {
    if (currentParams) return currentParams;
    if (activePreset) return activePreset.patch as Record<string, unknown>;
    return (presets[0]?.patch as Record<string, unknown>) ?? null;
  }, [currentParams, activePreset, presets]);

  const baselineDeltas = useMemo(
    () => computeParameterBaselineDeltas(pinnedBaseline, effectiveCurrentParams, 4),
    [pinnedBaseline, effectiveCurrentParams]
  );

  const handleTogglePinBaseline = () => {
    labSound.playClick(640);
    if (pinnedBaseline) {
      setPinnedBaseline(null);
      return;
    }
    const snap = effectiveCurrentParams
      ? { ...effectiveCurrentParams }
      : ((presets[0]?.patch as Record<string, unknown>) ?? {});
    setPinnedBaseline(snap);
    setPinnedPresetLabel(activePreset?.label || 'Kondisi Acuan');
  };

  const handleRestorePinnedBaseline = () => {
    if (!pinnedBaseline) return;
    labSound.playClick(580);
    onApplyPreset({
      id: 'pinned-baseline-restore',
      label: pinnedPresetLabel,
      summary: 'Dikembalikan ke kondisi baseline',
      patch: pinnedBaseline as Partial<TParams>,
    });
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
      {/* Collapsible Scenario Presets with Standard vs Extreme Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              labSound.playClick(600);
              setPresetsExpanded((prev) => !prev);
            }}
            aria-expanded={presetsExpanded}
            className="flex-1 flex items-center justify-between text-2xs font-bold text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer py-0.5"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sliders className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Skenario &amp; Fenomena ({presets.length})</span>
            </span>
            {presetsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            data-testid="pin-baseline-btn"
            onClick={handleTogglePinBaseline}
            title={
              pinnedBaseline
                ? 'Lepas sematan kondisi baseline'
                : 'Sematkan kondisi parameter saat ini sebagai Baseline pembanding'
            }
            className={`px-2 py-1 rounded-lg border text-2xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              pinnedBaseline
                ? 'border-[var(--comfort-accent)] bg-[var(--comfort-accent-soft)] text-[var(--comfort-accent)]'
                : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            {pinnedBaseline ? (
              <>
                <PinOff className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Lepas Baseline</span>
              </>
            ) : (
              <>
                <Pin className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Pin Baseline</span>
              </>
            )}
          </button>
        </div>

        {presetsExpanded && (
          <>
            {/* Segmented Filter: Semua | Standar | Fenomena Ekstrem */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
              <button
                type="button"
                data-testid="preset-filter-all"
                onClick={() => {
                  labSound.playClick(580);
                  setPresetCategoryFilter('all');
                }}
                className={`flex-1 py-1 px-2 rounded-md text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  presetCategoryFilter === 'all'
                    ? 'bg-[var(--comfort-accent)] text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                Semua ({presets.length})
              </button>
              <button
                type="button"
                data-testid="preset-filter-standard"
                onClick={() => {
                  labSound.playClick(600);
                  setPresetCategoryFilter('standard');
                }}
                className={`flex-1 py-1 px-2 rounded-md text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  presetCategoryFilter === 'standard'
                    ? 'bg-[var(--comfort-accent)] text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                Standar
              </button>
              <button
                type="button"
                data-testid="preset-filter-extreme"
                onClick={() => {
                  labSound.playClick(640);
                  setPresetCategoryFilter('extreme');
                }}
                className={`flex-1 py-1 px-2 rounded-md text-2xs font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                  presetCategoryFilter === 'extreme'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                }`}
              >
                <Flame className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Ekstrem</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
              {filteredPresets.map((preset) => {
                const isActive = activePresetId === preset.id;
                const isExtreme = preset.category === 'extreme';
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
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold leading-tight truncate">
                        {preset.label}
                      </span>
                      {isExtreme && (
                        <span className="text-2xs font-mono font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          ▲ EKSTREM
                        </span>
                      )}
                    </div>
                    <div className="text-2xs font-mono text-[var(--comfort-text-muted)] mt-0.5 truncate tabular-nums">
                      {preset.summary}
                    </div>
                    {isActive && preset.phenomenonNote && (
                      <div className="mt-1.5 pt-1.5 border-t border-[var(--comfort-border)] text-2xs text-[var(--comfort-text)] leading-snug">
                        {preset.phenomenonNote}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Live Baseline vs Active Experiment Delta Card */}
      {pinnedBaseline && (
        <div
          data-testid="baseline-comparison-card"
          className="rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5 space-y-2 text-2xs"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-1.5">
            <div className="font-bold text-[var(--comfort-text)] truncate">
              Komparasi Baseline: <span className="text-[var(--comfort-accent)]">{pinnedPresetLabel}</span>
            </div>
            <button
              type="button"
              data-testid="restore-baseline-btn"
              onClick={handleRestorePinnedBaseline}
              title="Kembalikan parameter ke kondisi Baseline"
              className="inline-flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-accent)] hover:underline cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Pulihkan</span>
            </button>
          </div>

          {baselineDeltas.length > 0 ? (
            <div className="space-y-1 font-mono tabular-nums">
              {baselineDeltas.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 text-2xs"
                >
                  <span className="font-sans text-[var(--comfort-text-muted)] truncate">
                    {item.label}:
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[var(--comfort-text-muted)]">
                      {item.baselineValue} → <strong className="text-[var(--comfort-text)]">{item.currentValue}</strong>
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                    <span
                      className={`font-bold ${
                        item.direction === 'up'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.direction === 'down'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[var(--comfort-text-muted)]'
                      }`}
                    >
                      {item.direction === 'up'
                        ? `▲ +${item.deltaValue}`
                        : item.direction === 'down'
                        ? `▼ ${item.deltaValue}`
                        : '● 0'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--comfort-text-muted)] leading-snug">
              Geser slider variabel atau pilih preset lain untuk melihat selisih (Δ) terhadap kondisi baseline.
            </p>
          )}
        </div>
      )}

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
            Cara cepat: otomatis mencoba &amp; mencatat 5 variasi{' '}
            <strong className="text-[var(--comfort-text)]">
              {sweepSteps[0]?.paramLabel || 'variabel bebas'}
            </strong>{' '}
            ke tabel regresi.
          </p>
        )}
      </div>
    </div>
  );
}
