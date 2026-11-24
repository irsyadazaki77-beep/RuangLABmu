import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Compass, X } from 'lucide-react';
import { labSound } from '../../../utils/soundEngine';

export interface GuidedLabStepsOverlayProps {
  steps: string[];
  recordsCount: number;
  isLeftVisible: boolean;
  isRightVisible: boolean;
}

/**
 * Compact collapsible guided lab steps overlay inside the 3D cockpit.
 * Defaults to a minimal single-line toggle with quick dismiss for unobstructed 3D focus.
 */
export const GuidedLabStepsOverlay: React.FC<GuidedLabStepsOverlayProps> = ({
  steps,
  recordsCount,
  isLeftVisible,
  isRightVisible,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!steps || steps.length === 0 || dismissed) return null;

  const activeStepIdx = Math.min(steps.length - 1, Math.max(0, recordsCount));
  const cleanActiveStep = steps[activeStepIdx]?.replace(/^\d+\.\s*/, '') || '';

  const corridorClass = [
    'left-3 right-3',
    isLeftVisible ? 'lg:left-[332px] xl:left-[344px]' : 'lg:left-3',
    isRightVisible ? 'lg:right-[348px] xl:right-[360px]' : 'lg:right-3',
  ].join(' ');

  return (
    <div
      data-testid="guided-lab-steps-overlay"
      className={`pointer-events-none absolute top-[98px] lg:top-[96px] z-20 flex justify-center ${corridorClass}`}
    >
      <div className="pointer-events-auto max-w-full sm:max-w-[430px] rounded-xl studio-hud-surface shadow-sm overflow-hidden">
        <div className="flex items-center">
          <button
            type="button"
            data-testid="toggle-guided-steps-btn"
            aria-expanded={expanded}
            onClick={() => {
              labSound.playClick(600);
              setExpanded((prev) => !prev);
            }}
            className="flex-1 min-w-0 px-2.5 py-1 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-sky-500/10 transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
              <span className="text-2xs font-bold text-[var(--comfort-hud-text)] whitespace-nowrap tabular-nums">
                Langkah {activeStepIdx + 1}/{steps.length}
              </span>
              <span className="text-2xs text-[var(--comfort-text-muted)] truncate hidden sm:inline">
                · {cleanActiveStep}
              </span>
            </div>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick(480);
              setDismissed(true);
            }}
            aria-label="Sembunyikan banner langkah"
            title="Sembunyikan panduan langkah agar kanvas 3D lebih bersih"
            className="px-1.5 py-1 text-[var(--comfort-text-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-sky-500/10 border-l border-[var(--comfort-border)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>

        {expanded && (
          <ol className="px-3 pb-2.5 pt-2 border-t border-[var(--comfort-border)] space-y-1.5 text-2xs max-h-[190px] overflow-y-auto">
            {steps.map((raw, idx) => {
              const text = raw.replace(/^\d+\.\s*/, '');
              const isDone = idx < recordsCount;
              const isCurrent = idx === activeStepIdx;
              return (
                <li
                  key={idx}
                  className={`flex items-start gap-2 rounded-lg px-2 py-1 leading-relaxed ${
                    isCurrent
                      ? 'bg-sky-500/12 text-[var(--comfort-hud-text)] font-medium'
                      : 'text-[var(--comfort-text-muted)]'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <span className="font-mono font-bold text-2xs text-sky-500 shrink-0 mt-0.5 tabular-nums">
                      0{idx + 1}.
                    </span>
                  )}
                  <span className={isDone ? 'line-through opacity-75' : ''}>{text}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
