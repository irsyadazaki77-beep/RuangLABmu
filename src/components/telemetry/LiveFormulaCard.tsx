import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Calculator, Sparkles } from 'lucide-react';
import { useLabStore } from '../../stores/useLabStore';
import { formatCleanEquation } from '../../utils/spatialHudHelpers';
import { SciFormula } from '../ui/ScientificNotation';

export interface LiveFormulaCardProps {
  moduleTitle: string;
  formulaEquation: string;
  domainLabel: string;
}

export const LiveFormulaCard: React.FC<LiveFormulaCardProps> = ({
  moduleTitle,
  formulaEquation,
  domainLabel,
}) => {
  const { activeAdjustedParam, liveParamSnapshot } = useLabStore(
    useShallow((s) => ({
      activeAdjustedParam: s.activeAdjustedParam,
      liveParamSnapshot: s.liveParamSnapshot,
    }))
  );

  const paramEntries = Object.entries(liveParamSnapshot).slice(0, 6);

  return (
    <div
      data-testid="live-formula-card"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 space-y-2.5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calculator className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--comfort-text-muted)] truncate">
            Persamaan Hukum · {domainLabel}
          </span>
        </div>
        {activeAdjustedParam && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-500 text-[10px] font-mono font-bold shrink-0">
            <Sparkles className="w-2.5 h-2.5" />
            Aktif Diubah
          </span>
        )}
      </div>

      {/* Main Governing Equation Display */}
      <div className="rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] px-3 py-2 text-center">
        <div className="text-[10px] text-[var(--comfort-text-muted)] mb-0.5 truncate">{moduleTitle}</div>
        <div className="font-mono text-xs sm:text-sm font-bold text-sky-700 dark:text-cyan-300 tracking-wide break-words">
          <SciFormula text={formatCleanEquation(formulaEquation || 'F = m · a')} wrap />
        </div>
      </div>

      {/* Real-Time Variable Substitution Rows (Single Column — Zero Truncation) */}
      {paramEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-[var(--comfort-text-muted)]">
            Substitusi Variabel Real-Time:
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {paramEntries.map(([label, item]) => {
              const isHighlighted = activeAdjustedParam?.label === label;
              return (
                <div
                  key={label}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center justify-between gap-2 transition-all ${
                    isHighlighted
                      ? 'border-amber-400 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/50 font-bold'
                      : 'border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)]'
                  }`}
                >
                  <span className="text-[11px] text-[var(--comfort-text-muted)] font-sans font-medium leading-tight">
                    <SciFormula text={label} wrap />
                  </span>
                  <span className="tabular-nums font-bold shrink-0 text-[var(--comfort-text)]">
                    {Number.isFinite(item.value) ? item.value.toFixed(2) : '0.00'}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
