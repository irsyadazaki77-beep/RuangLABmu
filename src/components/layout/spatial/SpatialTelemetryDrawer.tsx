import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Bot, PanelRightClose, Trash2 } from 'lucide-react';
import { DRAWER_RIGHT_VARIANTS } from '../../../styles/motionPresets';
import { LiveFormulaCard } from '../../telemetry/LiveFormulaCard';
import { TelemetryGauge } from '../../telemetry/TelemetryGauge';
import { LiveTimeSeriesChart } from '../../telemetry/LiveTimeSeriesChart';
import { labSound } from '../../../utils/soundEngine';
import type { ExperimentRecord } from '../../../utils/scienceEngine';
import type {
  OscilloscopeHudDescriptor,
  TelemetryMetricDescriptor,
} from '../StandardLabViewShell';

export interface SpatialTelemetryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  oscilloscope?: OscilloscopeHudDescriptor;
  telemetryMetrics: TelemetryMetricDescriptor[];
  moduleTitle: string;
  formulaEquation: string;
  domainLabel: string;
  recentRecords: ExperimentRecord[];
  recordsCount: number;
  onProceedToAnalysis?: () => void;
  onDeleteRecord?: (id: string) => void;
  onOpenDrLabMu: () => void;
}

export const SpatialTelemetryDrawer: React.FC<SpatialTelemetryDrawerProps> = ({
  isOpen,
  onClose,
  oscilloscope,
  telemetryMetrics,
  moduleTitle,
  formulaEquation,
  domainLabel,
  recentRecords,
  recordsCount,
  onProceedToAnalysis,
  onDeleteRecord,
  onOpenDrLabMu,
}) => {
  const primaryMetric = telemetryMetrics[0];
  const secondaryMetric = telemetryMetrics[1];

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside
          key="spatial-telemetry-hud-panel"
          data-testid="spatial-telemetry-hud-panel"
          variants={DRAWER_RIGHT_VARIANTS}
          initial="closed"
          animate="open"
          exit="closed"
          aria-label="Panel Telemetri, Rumus Hidup & Grafik"
          className="hidden lg:flex flex-col absolute top-16 bottom-16 right-3 w-[348px] z-20 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--comfort-border)] flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--comfort-text)]">
              <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
              <span>Telemetri &amp; Rumus</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Panel Telemetri"
              className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
            >
              <PanelRightClose className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
            {oscilloscope && (
              <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 space-y-0.5">
                <div className="font-mono text-[11px] font-bold text-sky-300 truncate">
                  {oscilloscope.microscopicStateLabel}
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                  {oscilloscope.microscopicDetail}
                </p>
              </div>
            )}

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

            <LiveFormulaCard
              moduleTitle={moduleTitle}
              formulaEquation={formulaEquation}
              domainLabel={domainLabel}
            />

            <LiveTimeSeriesChart
              primaryLabel={primaryMetric?.label}
              primaryUnit={primaryMetric?.unit}
              secondaryLabel={secondaryMetric?.label}
              secondaryUnit={secondaryMetric?.unit}
            />

            {recentRecords.length > 0 && (
              <div className="rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--comfort-text-muted)] tabular-nums">
                    Data Tercatat ({recordsCount})
                  </span>
                  {onProceedToAnalysis && (
                    <button
                      type="button"
                      onClick={onProceedToAnalysis}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Grafik &amp; LKS →
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {recentRecords.slice(0, 4).map((rec, idx) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] font-mono text-[10px]"
                    >
                      <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0 tabular-nums">
                        #{idx + 1}
                      </span>
                      <span className="truncate flex-1 text-[var(--comfort-text)]">
                        {rec.parametersSummary}
                      </span>
                      {onDeleteRecord && (
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          aria-label={`Hapus data percobaan ${idx + 1}`}
                          className="text-[var(--comfort-text-muted)] hover:text-rose-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onOpenDrLabMu();
              }}
              className="w-full py-2 px-3 rounded-lg bg-sky-500/12 hover:bg-sky-500/20 border border-sky-500/35 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Diskusi Sokratik Dr. LabMu</span>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
