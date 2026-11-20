import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LiveFormulaCard } from '../../telemetry/LiveFormulaCard';
import { TelemetryGauge } from '../../telemetry/TelemetryGauge';
import { LiveTimeSeriesChart } from '../../telemetry/LiveTimeSeriesChart';
import type { TelemetryMetricDescriptor } from '../StandardLabViewShell';

export interface MobileInstrumentSheetProps {
  expanded: boolean;
  activeTab: 'params' | 'telemetry';
  onSelectTab: (tab: 'params' | 'telemetry') => void;
  onToggleExpand: () => void;
  sidebar: React.ReactNode;
  moduleTitle: string;
  formulaEquation: string;
  domainLabel: string;
  telemetryMetrics: TelemetryMetricDescriptor[];
}

export const MobileInstrumentSheet: React.FC<MobileInstrumentSheetProps> = ({
  expanded,
  activeTab,
  onSelectTab,
  onToggleExpand,
  sidebar,
  moduleTitle,
  formulaEquation,
  domainLabel,
  telemetryMetrics,
}) => {
  const primaryMetric = telemetryMetrics[0];
  const secondaryMetric = telemetryMetrics[1];

  return (
    <div
      data-testid="mobile-lab-bottom-sheet"
      className="lg:hidden absolute left-2 right-2 bottom-2 z-30 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
    >
      <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 border-b border-[var(--comfort-border)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectTab('params')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
              expanded && activeTab === 'params'
                ? 'bg-sky-600 text-white'
                : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]'
            }`}
          >
            Parameter
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('telemetry')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
              expanded && activeTab === 'telemetry'
                ? 'bg-emerald-600 text-white'
                : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]'
            }`}
          >
            Telemetri &amp; Grafik
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? 'Tutup Sheet Instrumen' : 'Buka Sheet Instrumen'}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
        >
          <span>{expanded ? 'Tutup' : 'Buka Panel'}</span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="max-h-[42vh] overflow-y-auto p-3 space-y-2.5">
          {activeTab === 'params' ? (
            sidebar
          ) : (
            <>
              <LiveFormulaCard
                moduleTitle={moduleTitle}
                formulaEquation={formulaEquation}
                domainLabel={domainLabel}
              />
              {telemetryMetrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {telemetryMetrics.slice(0, 2).map((metric) => (
                    <TelemetryGauge
                      key={metric.id}
                      label={metric.label}
                      value={metric.value}
                      min={metric.min}
                      max={metric.max}
                      unit={metric.unit}
                      decimals={metric.precision ?? 2}
                    />
                  ))}
                </div>
              )}
              <LiveTimeSeriesChart
                primaryLabel={primaryMetric?.label}
                primaryUnit={primaryMetric?.unit}
                secondaryLabel={secondaryMetric?.label}
                secondaryUnit={secondaryMetric?.unit}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
