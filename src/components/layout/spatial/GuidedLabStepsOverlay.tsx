import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Compass } from 'lucide-react';
import { labSound } from '../../../utils/soundEngine';

export interface GuidedLabStepsOverlayProps {
  steps: string[];
  recordsCount: number;
  isLeftVisible: boolean;
  isRightVisible: boolean;
}

/**
 * Compact collapsible guided lab steps overlay inside the 3D cockpit.
 * Defaults to a minimal single-line toggle so the 3D viewport remains wide open.
 */
export const GuidedLabStepsOverlay: React.FC<GuidedLabStepsOverlayProps> = ({
  steps,
  recordsCount,
  isLeftVisible,
  isRightVisible,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

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
      className={`pointer-events-none absolute top-[128px] lg:top-[132px] xl:top-[100px] z-20 flex justify-center ${corridorClass}`}
    >
      <div className="pointer-events-auto max-w-full sm:max-w-[460px] rounded-xl studio-hud-surface shadow-md overflow-hidden">
        <button
          type="button"
          data-testid="toggle-guided-steps-btn"
          aria-expanded={expanded}
          onClick={() => {
            labSound.playClick(600);
            setExpanded((prev) => !prev);
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-sky-500/10 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold text-[var(--comfort-hud-text)] whitespace-nowrap tabular-nums">
              Langkah {activeStepIdx + 1}/{steps.length}
            </span>
            <span className="text-[11px] text-[var(--comfort-text-muted)] truncate hidden sm:inline">
              · {cleanActiveStep}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
          )}
        </button>

        {expanded && (
          <ol className="px-3 pb-2.5 pt-2 border-t border-[var(--comfort-border)] space-y-1.5 text-[11px] max-h-[190px] overflow-y-auto">
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
                    <span className="font-mono font-bold text-[10px] text-sky-500 shrink-0 mt-0.5 tabular-nums">
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
