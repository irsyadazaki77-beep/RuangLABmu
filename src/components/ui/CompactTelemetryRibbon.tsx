import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ChevronDown,
  Compass,
  FlaskConical,
  BarChart3,
  X,
  Gauge,
  Target,
  CheckCircle2,
} from 'lucide-react';
import {
  CircularGaugeMeter,
  LiveTelemetryOscilloscope,
} from './LabInstruments';
import { SciFormula } from './ScientificNotation';
import { labSound } from '../../utils/soundEngine';
import { useUIStore } from '../../stores/useUIStore';
import { findGlossaryTermInText } from '../../utils/pedagogicalHelpers';
import { ScienceGlossaryTerm } from './ScienceGlossaryTerm';

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
  recordsCount?: number;
  missionTitle?: string;
  missionObjective?: string;
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

const DEFAULT_DOMAIN_MISSIONS: Record<
  CompactTelemetryRibbonProps['domain'],
  { title: string; objective: string }
> = {
  Fisika: {
    title: 'Eksperimen Kinematika & Dinamika',
    objective:
      'Variasikan variabel bebas pada panel kanan dan rekam minimal 3 titik data untuk menguji linearitas R².',
  },
  Kimia: {
    title: 'Eksperimen Reaksi & Kesetimbangan',
    objective:
      'Amati perubahan parameter kimiawi secara real-time dan rekam minimal 3 titik data pengamatan.',
  },
  Biologi: {
    title: 'Observasi Bioreaktor & Fisiologi',
    objective:
      'Uji pengaruh faktor lingkungan terhadap respons biologis dan rekam minimal 3 titik data.',
  },
  Astronomi: {
    title: 'Observatorium Astrofisika & Orbit',
    objective:
      'Variasikan parameter orbit/bintang dan rekam minimal 3 titik data untuk evaluasi Hukum Kepler/Hubble.',
  },
};

/**
 * Slim horizontal telemetry ribbon mounted at the top of the 3D canvas column.
 * In Standard Mode: 48px (`h-12`).
 * In Projector Mode: enlarged 1.5x with high contrast numbers (`h-16 sm:h-20`),
 * vibrant readouts visible clearly from the back of the classroom.
 */
export const CompactTelemetryRibbon: React.FC<CompactTelemetryRibbonProps> = ({
  domain,
  metrics,
  oscilloscope,
  recordsCount = 0,
  missionTitle,
  missionObjective,
  extraBadge,
}) => {
  const projectorMode = useUIStore((s) => s.projectorMode);
  const [expandedId, setExpandedId] = useState<
    string | 'oscilloscope' | 'mission' | null
  >(null);
  const [historyMap, setHistoryMap] = useState<Record<string, number[]>>({});

  const metricsValuesSig = metrics.map((m) => `${m.id}:${Number.isFinite(m.value) ? m.value.toFixed(2) : '0'}`).join('|');
  const prevSigRef = useRef<string>('');

  // Record 18-point rolling sparkline history for each metric
  useEffect(() => {
    if (metricsValuesSig === prevSigRef.current) return;
    prevSigRef.current = metricsValuesSig;

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
  }, [metricsValuesSig, metrics]);

  const buildSparklinePoints = (metric: TelemetryRibbonMetric): string => {
    const samples = historyMap[metric.id] ?? [metric.value];
    const w = projectorMode ? 64 : 44;
    const h = projectorMode ? 22 : 16;
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
  const ribbonGlossaryEntry =
    metrics
      .map((m) => findGlossaryTermInText(m.label))
      .find((entry) => Boolean(entry)) ??
    findGlossaryTermInText(oscilloscope.microscopicStateLabel);
  const activeMetricGlossary = activeMetric
    ? findGlossaryTermInText(activeMetric.label)
    : ribbonGlossaryEntry;
  const effectiveMissionTitle =
    missionTitle || DEFAULT_DOMAIN_MISSIONS[domain].title;
  const effectiveMissionObj =
    missionObjective || DEFAULT_DOMAIN_MISSIONS[domain].objective;
  const isMissionComplete = recordsCount >= 3;

  return (
    <div
      data-testid="compact-telemetry-ribbon"
      className={`relative z-30 w-full shrink-0 select-none transition-all duration-200 ${
        projectorMode
          ? 'h-16 sm:h-20 border-b-2 border-amber-400 bg-slate-950 text-white shadow-lg'
          : 'h-12 border-b border-[var(--comfort-border)] bg-[var(--comfort-surface)]'
      }`}
    >
      {/* Horizontal Telemetry Bar */}
      <div className="h-full px-3 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {/* Active Mission Badge */}
          <button
            type="button"
            data-testid="telemetry-mission-badge"
            onClick={() => {
              labSound.playClick();
              setExpandedId((prev) => (prev === 'mission' ? null : 'mission'));
            }}
            className={`rounded-xl border font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              projectorMode ? 'h-11 sm:h-12 px-3 text-xs sm:text-sm' : 'h-8 px-2 text-xs'
            } ${
              expandedId === 'mission'
                ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400'
                : isMissionComplete
                ? 'bg-emerald-500/20 border-emerald-400/80 text-emerald-300 hover:bg-emerald-500/30'
                : projectorMode
                ? 'bg-amber-950/80 border-amber-400 text-amber-200 hover:bg-amber-900/80'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Klik untuk melihat detail Misi Praktikum & progres pengumpulan data"
          >
            <span aria-hidden="true" className={projectorMode ? 'text-base' : ''}>🎯</span>
            <span className={projectorMode ? 'font-black' : ''}>Misi Aktif</span>
            <span
              className={`px-1.5 py-0.2 rounded font-mono font-bold tabular-nums ${
                projectorMode ? 'text-xs' : 'text-[10px]'
              } ${
                isMissionComplete
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : 'bg-amber-500/30 text-amber-200'
              }`}
            >
              {Math.min(3, recordsCount)}/3
            </span>
          </button>

          <div
            className={`w-px mx-0.5 shrink-0 ${
              projectorMode ? 'h-8 bg-amber-400/40' : 'h-5 bg-[var(--comfort-border)]'
            }`}
            aria-hidden="true"
          />

          {/* Telemetry Metrics with 1.5x Scaling in Projector Mode */}
          {metrics.map((m) => {
            const isSelected = expandedId === m.id;
            const precision = m.precision ?? (Math.abs(m.value) >= 100 ? 1 : 2);
            const safeVal = Number.isFinite(m.value) ? m.value : 0;
            const strokeColor = m.color || (projectorMode ? '#38bdf8' : '#0ea5e9');
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
                className={`rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  projectorMode
                    ? 'h-11 sm:h-14 px-3.5 border-2 border-slate-700 bg-slate-900/90 shadow-md hover:border-amber-400'
                    : 'h-8 px-2 rounded-lg'
                } ${
                  isSelected
                    ? projectorMode
                      ? 'bg-sky-950 border-sky-400 ring-2 ring-sky-400/50 shadow-md'
                      : 'bg-sky-500/20 border-sky-400 text-slate-900 dark:text-white shadow-xs'
                    : isWarn
                    ? projectorMode
                      ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                      : 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200'
                    : !projectorMode
                    ? 'bg-slate-900/5 dark:bg-slate-900/70 border-slate-300/70 dark:border-slate-700/80 hover:border-sky-400/70 text-slate-800 dark:text-slate-100'
                    : ''
                }`}
              >
                <div className="flex flex-col justify-center leading-tight">
                  <span
                    className={`truncate ${
                      projectorMode
                        ? 'text-xs sm:text-sm font-extrabold text-amber-300 dark:text-amber-300 max-w-[170px] uppercase tracking-wide'
                        : 'text-[10px] font-semibold text-slate-500 dark:text-slate-400 max-w-[100px]'
                    }`}
                  >
                    <SciFormula text={m.label} />
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-1 font-mono tabular-nums">
                    <span
                      className={`font-black tracking-tight ${
                        projectorMode
                          ? 'text-lg sm:text-2xl text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                          : 'text-xs font-bold text-slate-900 dark:text-white'
                      }`}
                      style={{ color: isWarn ? '#fbbf24' : undefined }}
                    >
                      {safeVal.toFixed(precision)}
                    </span>
                    <span
                      className={
                        projectorMode
                          ? 'text-xs sm:text-sm font-bold text-slate-300'
                          : 'text-[10px] text-slate-500 dark:text-slate-400'
                      }
                    >
                      <SciFormula text={m.unit} />
                    </span>
                  </div>
                </div>

                <svg
                  width={projectorMode ? 60 : 36}
                  height={projectorMode ? 20 : 14}
                  viewBox={projectorMode ? "0 0 64 22" : "0 0 44 16"}
                  className="overflow-visible shrink-0 hidden xl:block"
                  aria-hidden="true"
                >
                  <polyline
                    fill="none"
                    stroke={isWarn ? '#fbbf24' : strokeColor}
                    strokeWidth={projectorMode ? "2.6" : "1.6"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={buildSparklinePoints(m)}
                  />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Right Side: Click-to-Expand Oscilloscope Trigger & Optional Domain Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {projectorMode && (
            <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-sm animate-pulse">
              📽️ Mode Proyektor Kelas
            </span>
          )}
          {extraBadge}
          {ribbonGlossaryEntry && (
            <ScienceGlossaryTerm
              term={ribbonGlossaryEntry.term}
              displayLabel={<span>📖 {ribbonGlossaryEntry.term}</span>}
              themeMode={projectorMode ? 'dark' : 'auto'}
              className="h-8 px-2 rounded-lg border border-[var(--comfort-border)] bg-slate-900/5 dark:bg-slate-900/80 text-[11px] font-medium shrink-0 hidden sm:inline-flex"
            />
          )}
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
                : 'bg-slate-900/5 dark:bg-slate-900/80 text-sky-700 dark:text-sky-300 border-slate-300/80 dark:border-slate-700 hover:border-sky-400/60'
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

      {/* Click-to-Expand Popover Panel (Mission Details OR Gauge Meters + LiveTelemetryOscilloscope) */}
      <AnimatePresence>
        {expandedId !== null && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setExpandedId(null)}
            />
            {expandedId === 'mission' ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                data-testid="telemetry-mission-popover"
                className="absolute left-3 top-13 z-40 w-80 sm:w-96 lab-glass-panel rounded-2xl p-4 shadow-2xl border border-slate-300/80 dark:border-slate-700/80 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Misi Praktikum Aktif ({domain})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
                    title="Tutup Detail Misi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {effectiveMissionTitle}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {effectiveMissionObj}
                  </p>
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-600 dark:text-slate-400">
                        Progres Rekam Data:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums flex items-center gap-1">
                        {isMissionComplete && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {recordsCount} / 3 Titik Data
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isMissionComplete ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (recordsCount / 3) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                data-testid="telemetry-expanded-popover"
                className="absolute left-3 right-3 top-13 z-40 lab-glass-panel rounded-2xl p-4 shadow-2xl border border-slate-300/80 dark:border-slate-700/80 space-y-3"
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
                    {activeMetricGlossary && (
                      <ScienceGlossaryTerm
                        term={activeMetricGlossary.term}
                        displayLabel={<span>📖 Arti {activeMetricGlossary.term}</span>}
                        className="text-[11px]"
                      />
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
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
