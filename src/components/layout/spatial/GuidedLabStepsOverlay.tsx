import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  PlusCircle,
  RotateCcw,
  Sliders,
  ArrowRight,
  X,
} from 'lucide-react';
import { labSound } from '../../../utils/soundEngine';
import { LAB_EVENTS, emitLabEvent } from '../../../utils/labEventBus';

export interface GuidedLabStepsOverlayProps {
  steps: string[];
  recordsCount: number;
  isLeftVisible?: boolean;
  isRightVisible?: boolean;
  onOpenParameterDrawer?: () => void;
  onProceedToAnalysis?: () => void;
}

/**
 * Interactive Guided Experiment Checklist & Stepper inside the unified 3D center overlay stack.
 * Combines automatic progress from recorded trials with manual step toggling and contextual quick actions.
 */
export const GuidedLabStepsOverlay: React.FC<GuidedLabStepsOverlayProps> = ({
  steps,
  recordsCount,
  onOpenParameterDrawer,
  onProceedToAnalysis,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Track manual overrides: true = manually checked, false = manually unchecked
  const [manualStepChecks, setManualStepChecks] = useState<Record<number, boolean>>({});

  const completedMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (let i = 0; i < steps.length; i++) {
      if (i in manualStepChecks) {
        map[i] = manualStepChecks[i];
      } else {
        map[i] = i < recordsCount;
      }
    }
    return map;
  }, [steps.length, recordsCount, manualStepChecks]);

  if (!steps || steps.length === 0) return null;

  const completedCount = steps.reduce((acc, _, idx) => acc + (completedMap[idx] ? 1 : 0), 0);
  const firstIncompleteIdx = steps.findIndex((_, idx) => !completedMap[idx]);
  const activeStepIdx = firstIncompleteIdx !== -1 ? firstIncompleteIdx : steps.length - 1;
  const cleanActiveStep = steps[activeStepIdx]?.replace(/^\d+\.\s*/, '') || '';
  const progressPct = Math.round((completedCount / Math.max(1, steps.length)) * 100);

  if (dismissed) {
    return (
      <div
        data-testid="guided-lab-steps-overlay"
        className="pointer-events-none w-full flex justify-center"
      >
        <button
          type="button"
          data-testid="toggle-guided-steps-btn"
          onClick={() => {
            labSound.playClick(600);
            setDismissed(false);
          }}
          title="Tampilkan kembali panduan langkah praktikum"
          className="pointer-events-auto px-2.5 py-1 rounded-xl studio-hud-surface border border-[var(--comfort-border)] shadow-sm flex items-center gap-1.5 text-2xs font-semibold text-[var(--comfort-hud-text)] hover:border-[var(--comfort-accent)] transition-colors cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            Panduan {activeStepIdx + 1}/{steps.length}
          </span>
        </button>
      </div>
    );
  }

  const handleToggleStepCheck = (idx: number) => {
    labSound.playClick(completedMap[idx] ? 520 : 680);
    setManualStepChecks((prev) => ({
      ...prev,
      [idx]: !completedMap[idx],
    }));
  };

  const handleResetChecklist = () => {
    labSound.playClick(480);
    setManualStepChecks({});
  };

  return (
    <div
      data-testid="guided-lab-steps-overlay"
      className="pointer-events-none w-full flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-[640px] rounded-xl studio-hud-surface border border-[var(--comfort-border)] shadow-md overflow-hidden">
        <div className="flex items-center">
          <button
            type="button"
            data-testid="toggle-guided-steps-btn"
            aria-expanded={expanded}
            title={cleanActiveStep}
            onClick={() => {
              labSound.playClick(600);
              setExpanded((prev) => !prev);
            }}
            className="flex-1 min-w-0 min-h-[34px] px-2.5 py-1 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-[var(--comfort-accent-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--comfort-accent)]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span className="text-2xs font-bold text-[var(--comfort-hud-text)] whitespace-nowrap tabular-nums shrink-0">
                Langkah {activeStepIdx + 1}/{steps.length}
              </span>
              <span className="text-2xs font-mono text-[var(--comfort-success)] whitespace-nowrap tabular-nums shrink-0">
                ({completedCount}/{steps.length})
              </span>
              <span className="text-2xs text-[var(--comfort-hud-muted)] truncate">
                · {cleanActiveStep}
              </span>
            </div>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)] shrink-0" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick(480);
              setExpanded(false);
              setDismissed(true);
            }}
            aria-label="Sembunyikan banner langkah"
            title="Kecilkan panduan langkah agar kanvas 3D lebih bersih"
            className="min-w-[32px] min-h-[34px] flex items-center justify-center text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-accent-soft)] border-l border-[var(--comfort-border)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--comfort-accent)]"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Thin Visual Progress Bar */}
        <div className="h-1 w-full bg-[var(--comfort-surface-subtle)] overflow-hidden">
          <div
            className="h-full bg-[var(--comfort-accent)] transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {expanded && (
          <div className="px-3 pb-2.5 pt-2 border-t border-[var(--comfort-border)] space-y-2 text-2xs">
            <div className="flex items-center justify-between gap-2 text-[var(--comfort-hud-muted)]">
              <span>Klik langkah untuk menandai selesai / belum selesai:</span>
              {Object.keys(manualStepChecks).length > 0 && (
                <button
                  type="button"
                  data-testid="reset-guided-checklist-btn"
                  onClick={handleResetChecklist}
                  className="inline-flex items-center gap-1 text-[var(--comfort-accent)] hover:underline cursor-pointer font-semibold"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Sinkron Otomatis</span>
                </button>
              )}
            </div>

            <ol className="space-y-1.5 max-h-[190px] overflow-y-auto">
              {steps.map((raw, idx) => {
                const text = raw.replace(/^\d+\.\s*/, '');
                const isDone = Boolean(completedMap[idx]);
                const isCurrent = idx === activeStepIdx && !isDone;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      data-testid={`guided-step-check-${idx}`}
                      onClick={() => handleToggleStepCheck(idx)}
                      className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 leading-relaxed transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[var(--comfort-accent-soft)] text-[var(--comfort-hud-text)] font-medium'
                          : isDone
                          ? 'text-[var(--comfort-hud-muted)] hover:bg-[var(--comfort-surface-subtle)]'
                          : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--comfort-success)] shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <span className="font-mono font-bold text-2xs text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                          0{idx + 1}.
                        </span>
                      )}
                      <span className={isDone ? 'line-through opacity-75' : ''}>{text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Quick Action Footer Bar inside Expanded Checklist */}
            <div className="pt-1.5 border-t border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-1.5">
              {onOpenParameterDrawer && (
                <button
                  type="button"
                  data-testid="guided-open-params-btn"
                  onClick={() => {
                    labSound.playClick(600);
                    onOpenParameterDrawer();
                  }}
                  className="px-2 py-1 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-[var(--comfort-accent)] text-[var(--comfort-hud-text)] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3 text-[var(--comfort-accent)]" aria-hidden="true" />
                  <span>Atur Variabel</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  labSound.playRecordSuccess();
                  emitLabEvent(LAB_EVENTS.RECORD_TRIAL, { source: 'dock', timestamp: Date.now() });
                }}
                className="px-2.5 py-1 rounded-lg bg-[var(--comfort-accent)] text-white font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3 h-3" aria-hidden="true" />
                <span>Catat Sampel ({recordsCount})</span>
              </button>

              {onProceedToAnalysis && recordsCount >= 2 && (
                <button
                  type="button"
                  data-testid="guided-proceed-analysis-btn"
                  onClick={() => {
                    labSound.playSuccessChime();
                    onProceedToAnalysis();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Lanjut Analisis LKS</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
