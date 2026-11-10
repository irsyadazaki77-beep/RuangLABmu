import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ChevronDown,
  Compass,
  FlaskConical,
  BarChart3,
  X,
  Gauge,
} from 'lucide-react';
import {
  CircularGaugeMeter,
  LiveTelemetryOscilloscope,
} from './LabInstruments';
import { SciFormula } from './ScientificNotation';
import { labSound } from '../../utils/soundEngine';

export interface TelemetryRibbonMetric {
  id: string;
  label: string;
  symbol?: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  precision?: number;
  color?: string;
  warningThreshold?: number;
  badgeText?: string;
}

export interface CompactTelemetryRibbonProps {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  metrics: TelemetryRibbonMetric[];
  oscilloscope: {
    primaryLabel: string;
    primaryValue: number;
    primaryUnit: string;
    secondaryLabel: string;
    secondaryValue: number;
    secondaryUnit: string;
    microscopicStateLabel: string;
    microscopicDetail: string;
    accentColor?: string;
  };
  extraBadge?: React.ReactNode;
}

export type LabWorkflowStage = 1 | 2 | 3;

export interface LabWorkflowStagePillProps {
  activeStage: LabWorkflowStage;
  onChangeStage: (stage: LabWorkflowStage) => void;
  domainColor?: string;
  recordsCount?: number;
  hasHypothesis?: boolean;
}

/**
 * Workflow-Stage Progressive Disclosure Stepper Pill:
 * - Mode 1: [1. Hipotesis & Persiapan]
 * - Mode 2: [2. Eksperimen Aktif]
 * - Mode 3: [3. Analisis & Laporan]
 */
export const LabWorkflowStagePill: React.FC<LabWorkflowStagePillProps> = ({
  activeStage,
  onChangeStage,
  domainColor = '#0ea5e9',
  recordsCount = 0,
  hasHypothesis = false,
}) => {
  const stages: Array<{
    id: LabWorkflowStage;
    shortLabel: string;
    fullLabel: string;
    subtext: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: 1,
      shortLabel: '1. Hipotesis & Persiapan',
      fullLabel: '1. Hipotesis & Persiapan',
      subtext: 'Rumuskan prediksi awal & panduan mikro',
      icon: <Compass className="w-3.5 h-3.5" />,
      badge: hasHypothesis ? '✓ Siap' : undefined,
    },
    {
      id: 2,
      shortLabel: '2. Eksperimen Aktif',
      fullLabel: '2. Eksperimen Aktif',
      subtext: 'Kanvas 3D 80% + Kontrol Variabel Taktil',
      icon: <FlaskConical className="w-3.5 h-3.5" />,
    },
    {
      id: 3,
      shortLabel: '3. Analisis & Laporan',
      fullLabel: '3. Analisis & Laporan',
      subtext: 'Split-screen Kurva Regresi, LKS & Komparasi A/B',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      badge: recordsCount > 0 ? `${recordsCount} Data` : undefined,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Tahapan Alur Kerja Laboratorium"
      data-testid="workflow-stage-stepper"
      className="lab-glass-panel rounded-2xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 transition-all"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: domainColor }}
        />
        <span className="font-bold text-slate-700 dark:text-slate-200">
          Alur Praktikum:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 flex-1 sm:flex-initial justify-end">
        {stages.map((st) => {
          const isActive = activeStage === st.id;
          return (
            <button
              key={st.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`workflow-stage-btn-${st.id}`}
              onClick={() => {
                labSound.playClick();
                onChangeStage(st.id);
              }}
              title={st.subtext}
              style={
                isActive
                  ? {
                      backgroundColor: domainColor,
                      borderColor: domainColor,
                    }
                  : undefined
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isActive
                  ? 'text-slate-950 shadow-sm scale-[1.01]'
                  : 'bg-slate-100/85 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {st.icon}
              <span>[{st.fullLabel}]</span>
              {st.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold tabular-nums ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {st.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Slim horizontal telemetry ribbon (`max-h-[48px]` / `h-12`) mounted at the top of the 3D canvas.
 * Displays key numeric readouts in `IBM Plex Mono` (`tabular-nums`) + live SVG mini-sparkline,
 * with Click-to-Expand popover for full-size `CircularGaugeMeter` & `LiveTelemetryOscilloscope`.
 */
export const CompactTelemetryRibbon: React.FC<CompactTelemetryRibbonProps> = ({
  domain,
  metrics,
  oscilloscope,
  extraBadge,
}) => {
  const [expandedId, setExpandedId] = useState<string | 'oscilloscope' | null>(
    null
  );
  const [historyMap, setHistoryMap] = useState<Record<string, number[]>>({});

  // Record 18-point rolling sparkline history for each metric
  useEffect(() => {
    setHistoryMap((prev) => {
      const next: Record<string, number[]> = { ...prev };
      for (const m of metrics) {
        const safe = Number.isFinite(m.value) ? m.value : 0;
        const arr = prev[m.id] ? [...prev[m.id], safe] : [safe];
        if (arr.length > 18) arr.shift();
        next[m.id] = arr;
      }
      return next;
    });
  }, [metrics]);

  const buildSparklinePoints = (metric: TelemetryRibbonMetric): string => {
    const samples = historyMap[metric.id] ?? [metric.value];
    const w = 44;
    const h = 16;
    const span = Math.max(1e-6, metric.max - metric.min);

    if (samples.length === 1) {
      const norm = Math.min(1, Math.max(0, (samples[0] - metric.min) / span));
      const y = (h - 2 - norm * (h - 4)).toFixed(1);
      return `0,${y} ${w},${y}`;
    }

    return samples
      .map((val, idx) => {
        const x = ((idx / Math.max(1, samples.length - 1)) * w).toFixed(1);
        const norm = Math.min(1, Math.max(0, (val - metric.min) / span));
        const y = (h - 2 - norm * (h - 4)).toFixed(1);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const activeMetric = metrics.find((m) => m.id === expandedId) ?? null;

  return (
    <div
      data-testid="compact-telemetry-ribbon"
      className="relative z-30 w-full select-none"
    >
      {/* Slim 48px Horizontal Telemetry Bar */}
      <div className="lab-glass-panel h-12 max-h-[48px] px-3 rounded-xl flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          {metrics.map((m) => {
            const isSelected = expandedId === m.id;
            const precision = m.precision ?? (Math.abs(m.value) >= 100 ? 1 : 2);
            const safeVal = Number.isFinite(m.value) ? m.value : 0;
            const strokeColor = m.color || '#0ea5e9';
            const isWarn =
              m.warningThreshold !== undefined && safeVal >= m.warningThreshold;

            return (
              <button
                key={m.id}
                type="button"
                data-testid={`telemetry-metric-btn-${m.id}`}
                onClick={() => {
                  labSound.playClick();
                  setExpandedId((prev) => (prev === m.id ? null : m.id));
                }}
                title={`Klik untuk membuka instrumen gauge & osiloskop: ${m.label}`}
                className={`h-9 px-2.5 rounded-lg border text-left transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-sky-500/20 border-sky-400 text-slate-900 dark:text-white shadow-xs'
                    : isWarn
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-900/5 dark:bg-slate-900/70 border-slate-300/70 dark:border-slate-700/80 hover:border-sky-400/70 text-slate-800 dark:text-slate-100'
                }`}
              >
                <div className="flex flex-col justify-center leading-none">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[115px]">
                    <SciFormula text={m.label} />
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-1 font-mono tabular-nums">
                    <span
                      className="text-xs font-bold text-slate-900 dark:text-white"
                      style={{ color: isWarn ? '#f59e0b' : undefined }}
                    >
                      {safeVal.toFixed(precision)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      <SciFormula text={m.unit} />
                    </span>
                  </div>
                </div>

                {/* Live Mini-Sparkline SVG */}
                <svg
                  width={44}
                  height={16}
                  viewBox="0 0 44 16"
                  className="overflow-visible shrink-0 hidden sm:block"
                  aria-hidden="true"
                >
                  <polyline
                    fill="none"
                    stroke={isWarn ? '#f59e0b' : strokeColor}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={buildSparklinePoints(m)}
                  />
                </svg>

                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
                    isSelected ? 'rotate-180 text-sky-400' : ''
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Side: Click-to-Expand Oscilloscope Trigger & Optional Domain Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {extraBadge}
          <button
            type="button"
            data-testid="telemetry-oscilloscope-toggle"
            onClick={() => {
              labSound.playClick();
              setExpandedId((prev) =>
                prev === 'oscilloscope' ? null : 'oscilloscope'
              );
            }}
            className={`h-8 px-2.5 rounded-lg border text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              expandedId === 'oscilloscope'
                ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                : 'bg-slate-900/80 text-sky-300 border-slate-700 hover:border-sky-400/60'
            }`}
            title="Klik untuk membuka Osiloskop Telemetri & Gauge Meter lengkap"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Osiloskop & Gauge</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                expandedId === 'oscilloscope' ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Click-to-Expand Popover Panel (Gauge Meters + LiveTelemetryOscilloscope) */}
      <AnimatePresence>
        {expandedId !== null && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setExpandedId(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              data-testid="telemetry-expanded-popover"
              className="absolute left-0 right-0 top-14 z-40 lab-glass-panel rounded-2xl p-4 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Instrumen Telemetri Presisi & Osiloskop ({domain})
                  </span>
                  {activeMetric && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30">
                      Fokus: {activeMetric.label}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Tutup Popover Telemetri"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                {/* Circular Gauge Meters */}
                <div className="lg:col-span-5 grid grid-cols-3 gap-2">
                  {metrics.map((m) => (
                    <CircularGaugeMeter
                      key={m.id}
                      label={m.label}
                      value={m.value}
                      min={m.min}
                      max={m.max}
                      unit={m.unit}
                      color={m.color || '#0ea5e9'}
                      warningThreshold={m.warningThreshold}
                      precision={m.precision ?? 2}
                      badgeText={m.badgeText}
                      size="sm"
                    />
                  ))}
                </div>

                {/* Full LiveTelemetryOscilloscope */}
                <div className="lg:col-span-7">
                  <LiveTelemetryOscilloscope
                    domain={domain}
                    primaryLabel={oscilloscope.primaryLabel}
                    primaryValue={oscilloscope.primaryValue}
                    primaryUnit={oscilloscope.primaryUnit}
                    secondaryLabel={oscilloscope.secondaryLabel}
                    secondaryValue={oscilloscope.secondaryValue}
                    secondaryUnit={oscilloscope.secondaryUnit}
                    microscopicStateLabel={oscilloscope.microscopicStateLabel}
                    microscopicDetail={oscilloscope.microscopicDetail}
                    accentColor={oscilloscope.accentColor}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
