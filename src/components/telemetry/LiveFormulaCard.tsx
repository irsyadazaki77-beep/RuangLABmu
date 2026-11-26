import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Calculator, Zap } from 'lucide-react';
import { useLabStore } from '../../stores/useLabStore';
import { formatCleanEquation } from '../../utils/spatialHudHelpers';
import { SciFormula } from '../ui/ScientificNotation';
import type { TelemetryMetricDescriptor } from '../layout/StandardLabViewShell';

export interface LiveFormulaCardProps {
  moduleTitle: string;
  formulaEquation: string;
  domainLabel: string;
  telemetryMetrics?: TelemetryMetricDescriptor[];
}

export const LiveFormulaCard: React.FC<LiveFormulaCardProps> = ({
  moduleTitle,
  formulaEquation,
  domainLabel,
  telemetryMetrics = [],
}) => {
  const { activeAdjustedParam, liveParamSnapshot } = useLabStore(
    useShallow((s) => ({
      activeAdjustedParam: s.activeAdjustedParam,
      liveParamSnapshot: s.liveParamSnapshot,
    }))
  );

  const paramEntries = Object.entries(liveParamSnapshot).slice(0, 6);
  const derivedOutputs = telemetryMetrics.slice(0, 3);

  return (
    <div
      data-testid="live-formula-card"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 space-y-2.5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calculator className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
          <span className="text-2xs font-bold text-[var(--comfort-text-muted)] truncate">
            Persamaan Hukum · {domainLabel}
          </span>
        </div>
        {activeAdjustedParam && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] text-[var(--comfort-warning)] text-2xs font-mono font-bold shrink-0">
            <Zap className="w-2.5 h-2.5" aria-hidden="true" />
            Aktif Diubah
          </span>
        )}
      </div>

      {/* Main Governing Equation Display with Studio Blueprint Backdrop */}
      <div className="relative rounded-lg bg-[var(--comfort-surface-subtle)] lab-grid-bg border border-[var(--comfort-border)] px-3 py-2.5 text-center overflow-hidden">
        <div className="text-2xs text-[var(--comfort-text-muted)] mb-0.5 truncate font-medium">
          {moduleTitle}
        </div>
        <div className="font-mono text-xs sm:text-sm font-bold text-[var(--comfort-accent)] tracking-wide break-words">
          <SciFormula text={formatCleanEquation(formulaEquation || 'F = m · a')} wrap />
        </div>
      </div>

      {/* Real-Time Variable Substitution Rows (Single Column — Zero Truncation) */}
      {paramEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
            Parameter Input (Slider):
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {paramEntries.map(([label, item]) => {
              const isHighlighted = activeAdjustedParam?.label === label;
              return (
                <div
                  key={label}
                  className={`px-2.5 py-1.5 rounded-lg border text-2xs font-mono flex items-center justify-between gap-2 transition-colors ${
                    isHighlighted
                      ? 'border-[var(--comfort-warning-border)] bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)] font-bold'
                      : 'border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)]'
                  }`}
                >
                  <span className="text-2xs text-[var(--comfort-text-muted)] font-sans font-medium leading-tight">
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

      {/* Derived Real-Time Computed Physics/Bio/Chem/Astro Outputs with Magnitude Bar */}
      {derivedOutputs.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-[var(--comfort-border)]">
          <div className="text-2xs font-semibold text-[var(--comfort-success)]">
            Hasil Terhitung Real-Time:
          </div>
          <div className="grid grid-cols-1 gap-1.5" data-testid="live-formula-derived-outputs">
            {derivedOutputs.map((metric) => {
              const span = Math.max(1e-9, metric.max - metric.min);
              const safeVal = Number.isFinite(metric.value) ? metric.value : metric.min;
              const fillPct = Math.min(
                100,
                Math.max(4, Math.round(((safeVal - metric.min) / span) * 100))
              );

              return (
                <div
                  key={metric.id}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--comfort-success-border)] bg-[var(--comfort-success-soft)] text-2xs font-mono space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs text-[var(--comfort-text)] font-sans font-medium leading-tight flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: metric.color || 'var(--comfort-success)' }}
                        aria-hidden="true"
                      />
                      <SciFormula text={metric.label} wrap />
                    </span>
                    <span className="tabular-nums font-bold shrink-0 text-[var(--comfort-success)]">
                      {Number.isFinite(metric.value)
                        ? metric.value.toFixed(metric.precision ?? 2)
                        : '0.00'}
                      {metric.unit ? ` ${metric.unit}` : ''}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--comfort-surface)]/80 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${fillPct}%`,
                        backgroundColor: metric.color || 'var(--comfort-success)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
