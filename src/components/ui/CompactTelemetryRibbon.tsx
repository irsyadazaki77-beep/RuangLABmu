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
  domainColor = 'var(--comfort-accent-solid)',
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
      className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 transition-all"
    >
      <div className="flex items-center gap-1.5 text-2xs font-mono uppercase tracking-wider text-[var(--comfort-text-muted)] px-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: domainColor }}
        />
        <span className="font-bold text-[var(--comfort-text)]">
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
              className={`px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
            >
              {st.icon}
              <span>{st.fullLabel}</span>
              {st.badge && (
                <span
                  className={`text-2xs font-mono font-bold tabular-nums ${
                    isActive
                      ? 'text-white/90'
                      : 'text-[var(--comfort-success)]'
                  }`}
                >
                  · {st.badge}
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
          <button
            type="button"
            data-testid="telemetry-mission-badge"
            onClick={() => {
              labSound.playClick();
              setExpandedId((prev) => (prev === 'mission' ? null : 'mission'));
            }}
            className={`rounded-xl border font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              projectorMode ? 'h-11 sm:h-12 px-3 text-xs sm:text-sm' : 'h-8 px-2.5 text-xs'
            } ${
              projectorMode
                ? expandedId === 'mission'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                  : 'bg-amber-950/80 border-amber-400 text-amber-200 hover:bg-amber-900/80'
                : expandedId === 'mission'
                ? 'comfort-accent-soft'
                : isMissionComplete
                ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success)]/35 text-[var(--comfort-success)]'
                : 'comfort-btn-secondary'
            }`}
            title="Klik untuk melihat detail Misi Praktikum & progres pengumpulan data"
          >
            <Target className={`w-3.5 h-3.5 shrink-0 ${!projectorMode && !isMissionComplete && expandedId !== 'mission' ? 'text-[var(--comfort-accent)]' : ''}`} aria-hidden="true" />
            <span className={projectorMode ? 'font-black' : ''}>Misi Aktif</span>
            <span
              className={`font-mono font-bold tabular-nums ${
                projectorMode ? 'text-xs' : 'text-2xs'
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

          {metrics.map((m) => {
            const isSelected = expandedId === m.id;
            const precision = m.precision ?? (Math.abs(m.value) >= 100 ? 1 : 2);
            const safeVal = Number.isFinite(m.value) ? m.value : 0;
            const strokeColor = m.color || (projectorMode ? '#38bdf8' : 'var(--comfort-accent)');
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
                    : 'h-8 px-2.5 rounded-lg'
                } ${
                  isSelected
                    ? projectorMode
                      ? 'bg-sky-950 border-sky-400 ring-2 ring-sky-400/50 shadow-md'
                      : 'comfort-accent-soft text-[var(--comfort-text)] shadow-xs'
                    : isWarn
                    ? projectorMode
                      ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                      : 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning)]/45 text-[var(--comfort-warning)]'
                    : !projectorMode
                    ? 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] text-[var(--comfort-text)]'
                    : ''
                }`}
              >
                <div className="flex flex-col justify-center leading-tight">
                  <span
                    className={`truncate ${
                      projectorMode
                        ? 'text-xs sm:text-sm font-extrabold text-amber-300 max-w-[170px] uppercase tracking-wide'
                        : 'text-2xs font-semibold text-[var(--comfort-text-muted)] max-w-[100px]'
                    }`}
                  >
                    <SciFormula text={m.label} />
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-1 font-mono tabular-nums">
                    <span
                      className={`font-black tracking-tight ${
                        projectorMode
                          ? 'text-lg sm:text-2xl text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                          : 'text-xs font-bold text-[var(--comfort-text)]'
                      }`}
                      style={{ color: isWarn ? '#d97706' : undefined }}
                    >
                      {safeVal.toFixed(precision)}
                    </span>
                    <span
                      className={
                        projectorMode
                          ? 'text-xs sm:text-sm font-bold text-slate-300'
                          : 'text-2xs text-[var(--comfort-text-muted)]'
                      }
                    >
                      <SciFormula text={m.unit} />
                    </span>
                  </div>
                </div>

                <svg
                  width={projectorMode ? 60 : 36}
                  height={projectorMode ? 20 : 14}
                  viewBox={projectorMode ? '0 0 64 22' : '0 0 44 16'}
                  className="overflow-visible shrink-0 hidden xl:block"
                  aria-hidden="true"
                >
                  <polyline
                    fill="none"
                    stroke={isWarn ? '#f59e0b' : strokeColor}
                    strokeWidth={projectorMode ? '2.6' : '1.6'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={buildSparklinePoints(m)}
                  />
                </svg>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {projectorMode && (
            <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-sm">
              Mode Proyektor Kelas
            </span>
          )}
          {extraBadge}
          {ribbonGlossaryEntry && (
            <ScienceGlossaryTerm
              term={ribbonGlossaryEntry.term}
              displayLabel={<span>{ribbonGlossaryEntry.term}</span>}
              themeMode={projectorMode ? 'dark' : 'auto'}
              className={`h-8 px-2 rounded-lg border text-2xs font-medium shrink-0 hidden sm:inline-flex ${
                projectorMode
                  ? 'border-slate-700 bg-slate-900 text-slate-100'
                  : 'border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)]'
              }`}
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
            className={`h-8 px-2.5 rounded-lg border text-2xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              expandedId === 'oscilloscope'
                ? 'comfort-tab-active border-transparent font-bold'
                : projectorMode
                ? 'bg-slate-900 text-sky-300 border-slate-700 hover:border-sky-400'
                : 'comfort-btn-secondary'
            }`}
            title="Klik untuk membuka Osiloskop Telemetri & Gauge Meter lengkap"
          >
            <Activity className={`w-3.5 h-3.5 ${expandedId !== 'oscilloscope' && !projectorMode ? 'text-[var(--comfort-accent)]' : ''}`} />
            <span className="hidden md:inline">Osiloskop &amp; Gauge</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                expandedId === 'oscilloscope' ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

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
                className="absolute left-3 top-13 z-40 w-80 sm:w-96 bg-[var(--comfort-surface)] text-[var(--comfort-text)] rounded-2xl p-4 shadow-2xl border border-[var(--comfort-border)] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[var(--comfort-accent)]" />
                    <span className="text-xs font-bold text-[var(--comfort-text)]">
                      Misi Praktikum Aktif ({domain})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] cursor-pointer"
                    title="Tutup Detail Misi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--comfort-text)]">
                    {effectiveMissionTitle}
                  </div>
                  <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
                    {effectiveMissionObj}
                  </p>
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-2xs font-mono">
                      <span className="text-[var(--comfort-text-muted)]">
                        Progres Rekam Data:
                      </span>
                      <span className="font-bold text-[var(--comfort-text)] tabular-nums flex items-center gap-1">
                        {isMissionComplete && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--comfort-success)]" />
                        )}
                        {recordsCount} / 3 Titik Data
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isMissionComplete
                            ? 'bg-[var(--comfort-success)]'
                            : 'bg-[var(--comfort-accent-solid)]'
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
                className="absolute left-3 right-3 top-13 z-40 bg-[var(--comfort-surface)] text-[var(--comfort-text)] rounded-2xl p-4 shadow-2xl border border-[var(--comfort-border)] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Gauge className="w-4 h-4 text-[var(--comfort-accent)]" />
                    <span className="text-xs font-bold text-[var(--comfort-text)]">
                      Instrumen Telemetri Presisi &amp; Osiloskop ({domain})
                    </span>
                    {activeMetric && (
                      <span className="text-2xs font-mono font-semibold text-[var(--comfort-accent)]">
                        · Fokus: {activeMetric.label}
                      </span>
                    )}
                    {activeMetricGlossary && (
                      <ScienceGlossaryTerm
                        term={activeMetricGlossary.term}
                        displayLabel={<span>Arti {activeMetricGlossary.term}</span>}
                        className="text-2xs"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] cursor-pointer"
                    title="Tutup Popover Telemetri"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                  <div className="lg:col-span-5 grid grid-cols-3 gap-2">
                    {metrics.map((m) => (
                      <CircularGaugeMeter
                        key={m.id}
                        label={m.label}
                        value={m.value}
                        min={m.min}
                        max={m.max}
                        unit={m.unit}
                        color={m.color || '#0F6B75'}
                        warningThreshold={m.warningThreshold}
                        precision={m.precision ?? 2}
                        badgeText={m.badgeText}
                        size="sm"
                      />
                    ))}
                  </div>

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
