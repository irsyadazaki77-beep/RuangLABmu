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
          className="hidden lg:flex flex-col absolute top-[58px] bottom-[84px] right-3 w-[304px] xl:w-[324px] z-20 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xl overflow-hidden"
        >
          <div className="px-3.5 py-2 border-b border-[var(--comfort-border)] flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-bold flex items-center gap-1.5 text-[var(--comfort-text)] min-w-0 truncate">
              <Activity className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span className="truncate">Telemetri &amp; Rumus</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Panel Telemetri"
              title="Tutup Panel Telemetri (])"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
            >
              <PanelRightClose className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
            {oscilloscope && (
              <div className="rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] px-3 py-2 text-xs text-[var(--comfort-text)] space-y-0.5">
                <div className="font-mono text-2xs font-bold text-[var(--comfort-accent)] truncate">
                  {oscilloscope.microscopicStateLabel}
                </div>
                <p className="text-2xs text-[var(--comfort-text-muted)] line-clamp-2 leading-relaxed">
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
              telemetryMetrics={telemetryMetrics}
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
                  <span className="font-mono text-2xs font-bold text-[var(--comfort-text-muted)] tabular-nums">
                    Data Tercatat ({recordsCount})
                  </span>
                  {onProceedToAnalysis && (
                    <button
                      type="button"
                      onClick={onProceedToAnalysis}
                      className="text-2xs font-bold text-[var(--comfort-accent)] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Grafik &amp; LKS →
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {recentRecords.slice(0, 4).map((rec, idx) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] font-mono text-2xs"
                    >
                      <span className="font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
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
                          className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-danger)] cursor-pointer shrink-0"
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
              className="w-full py-2 px-3 rounded-lg comfort-accent-soft border text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
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
