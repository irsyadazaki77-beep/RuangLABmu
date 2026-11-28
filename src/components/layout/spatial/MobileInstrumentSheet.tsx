import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, PlusCircle, Check } from 'lucide-react';
import { LiveFormulaCard } from '../../telemetry/LiveFormulaCard';
import { TelemetryGauge } from '../../telemetry/TelemetryGauge';
import { LiveTimeSeriesChart } from '../../telemetry/LiveTimeSeriesChart';
import type { TelemetryMetricDescriptor } from '../StandardLabViewShell';
import { LAB_EVENTS, emitLabEvent } from '../../../utils/labEventBus';
import { labSound } from '../../../utils/soundEngine';

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
  recordsCount?: number;
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
  recordsCount = 0,
}) => {
  const [snapHeight, setSnapHeight] = useState<'compact' | 'tall'>('compact');
  const [justRecorded, setJustRecorded] = useState(false);
  const primaryMetric = telemetryMetrics[0];
  const secondaryMetric = telemetryMetrics[1];

  const handleQuickRecord = () => {
    labSound.playRecordSuccess();
    emitLabEvent(LAB_EVENTS.RECORD_TRIAL, {
      source: 'mobile-sheet',
      timestamp: Date.now(),
    });
    setJustRecorded(true);
    setTimeout(() => setJustRecorded(false), 900);
  };

  return (
    <AnimatePresence>
      {expanded && (
        <>
          {/* Tap upper 3D canvas area to quickly dismiss mobile sheet back to 3D view */}
          <div
            aria-hidden="true"
            onClick={() => {
              labSound.playClick(480);
              onToggleExpand();
            }}
            className="lg:hidden absolute inset-x-0 top-[60px] bottom-0 z-20"
          />
          <motion.div
            key="mobile-sheet"
            data-testid="mobile-lab-bottom-sheet"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.85 }}
            className="lg:hidden absolute left-2 right-2 bottom-2 z-30 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
          >
          {/* Sheet Handle & Quick Snap Height Toggle */}
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSnapHeight((prev) => (prev === 'compact' ? 'tall' : 'compact'));
            }}
            aria-label={
              snapHeight === 'compact'
                ? 'Perluas tinggi sheet instrumen'
                : 'Ringkas tinggi sheet instrumen'
            }
            className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer"
          >
            <span className="w-9 h-1 rounded-full bg-[var(--comfort-border)]" aria-hidden="true" />
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
              {snapHeight === 'compact' ? 'Luas' : 'Ringkas'}
            </span>
            {snapHeight === 'compact' ? (
              <ChevronUp className="w-3 h-3 text-[var(--comfort-text-muted)]" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3 h-3 text-[var(--comfort-text-muted)]" aria-hidden="true" />
            )}
          </button>

          {/* Header Tabs + Thumb-Zone Quick Record + Close */}
          <div className="px-2.5 pb-2 pt-1 flex items-center justify-between gap-1.5 border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)]">
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onSelectTab('params');
                }}
                className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-2xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                  activeTab === 'params'
                    ? 'comfort-tab-active'
                    : 'bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)]'
                }`}
              >
                Parameter
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onSelectTab('telemetry');
                }}
                className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-2xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                  activeTab === 'telemetry'
                    ? 'comfort-tab-active'
                    : 'bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] border border-[var(--comfort-border)]'
                }`}
              >
                Telemetri
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="mobile-sheet-record-btn"
                onClick={handleQuickRecord}
                aria-label="Catat data pengamatan 3D sekarang"
                className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-2xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-transform active:scale-[0.96] ${
                  justRecorded
                    ? 'bg-[var(--comfort-success)] text-white'
                    : 'comfort-btn-primary'
                }`}
              >
                {justRecorded ? (
                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {justRecorded ? 'Tercatat' : `Catat (${recordsCount}/3)`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onToggleExpand();
                }}
                aria-label="Tutup Sheet Instrumen"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-2xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className={`${
              snapHeight === 'tall' ? 'max-h-[68vh]' : 'max-h-[44vh]'
            } overflow-y-auto p-3 space-y-2.5 transition-[max-height] duration-200`}
          >
            {activeTab === 'params' ? (
              sidebar
            ) : (
              <>
                <LiveFormulaCard
                  moduleTitle={moduleTitle}
                  formulaEquation={formulaEquation}
                  domainLabel={domainLabel}
                  telemetryMetrics={telemetryMetrics}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
