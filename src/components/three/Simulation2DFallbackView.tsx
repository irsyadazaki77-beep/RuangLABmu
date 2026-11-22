import React, { useMemo } from 'react';
import { Activity, Cpu, RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore, type LabDomain } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { getComfortChartPalette } from '../ui/VisualComfortToolbar';

export interface TelemetryPoint2D {
  cursorIndex: number;
  t: number;
  primary: number;
  secondary?: number;
}

export interface ParamSnapshotEntry {
  label: string;
  value: number;
  unit: string;
}

export interface Fallback2DTelemetryModel {
  domain: LabDomain;
  title: string;
  accentHex: string;
  polylinePoints: string;
  secondaryPolylinePoints: string;
  latestTime: number;
  latestPrimary: number;
  latestSecondary: number | null;
  minPrimary: number;
  maxPrimary: number;
  paramEntries: ParamSnapshotEntry[];
}

const DOMAIN_META: Record<LabDomain, { title: string; accentHex: string; primaryLabel: string }> = {
  physics: {
    title: 'Telemetri Mekanika & Gelombang 2D',
    accentHex: '#38bdf8',
    primaryLabel: 'Respons Utama',
  },
  chemistry: {
    title: 'Telemetri Reaksi & Titrasi Kimia 2D',
    accentHex: '#14b8a6',
    primaryLabel: 'pH / Laju Reaksi',
  },
  biology: {
    title: 'Telemetri Fisiologi & Sel Biologi 2D',
    accentHex: '#10b981',
    primaryLabel: 'Aktivitas Biologis',
  },
  astronomy: {
    title: 'Telemetri Orbit & Spektroskopi 2D',
    accentHex: '#a78bfa',
    primaryLabel: 'Kurva Cahaya / Orbit',
  },
};

/**
 * Pure projection helper for Mode Ringan 2D fallback canvas/SVG curves and parameter snapshots.
 * Shared with unit tests (`node:test`) to guarantee safe bounding & zero NaN SVG paths.
 */
export function build2DFallbackTelemetryModel(
  domain: LabDomain,
  series: TelemetryPoint2D[],
  paramSnapshot: Record<string, { value: number; unit: string }>,
  width = 360,
  height = 120
): Fallback2DTelemetryModel {
  const meta = DOMAIN_META[domain] ?? DOMAIN_META.physics;
  const validSeries = series.filter(
    (pt) => Number.isFinite(pt.t) && Number.isFinite(pt.primary)
  );
  const sample = validSeries.slice(-90);

  let minP = 0;
  let maxP = 1;
  if (sample.length > 0) {
    minP = sample[0].primary;
    maxP = sample[0].primary;
    for (const pt of sample) {
      if (pt.primary < minP) minP = pt.primary;
      if (pt.primary > maxP) maxP = pt.primary;
    }
    if (Math.abs(maxP - minP) < 1e-6) {
      minP -= 1;
      maxP += 1;
    }
  }

  const padX = 10;
  const padY = 12;
  const innerW = Math.max(20, width - padX * 2);
  const innerH = Math.max(20, height - padY * 2);

  const polylinePoints =
    sample.length >= 2
      ? sample
          .map((pt, idx) => {
            const x = padX + (idx / (sample.length - 1)) * innerW;
            const normY = (pt.primary - minP) / Math.max(1e-6, maxP - minP);
            const y = padY + (1 - normY) * innerH;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : `${padX},${(height / 2).toFixed(1)} ${width - padX},${(height / 2).toFixed(1)}`;

  const secSample = sample.filter((pt) => typeof pt.secondary === 'number' && Number.isFinite(pt.secondary));
  let secondaryPolylinePoints = '';
  if (secSample.length >= 2) {
    let minS = secSample[0].secondary as number;
    let maxS = minS;
    for (const pt of secSample) {
      const val = pt.secondary as number;
      if (val < minS) minS = val;
      if (val > maxS) maxS = val;
    }
    if (Math.abs(maxS - minS) < 1e-6) {
      minS -= 1;
      maxS += 1;
    }
    secondaryPolylinePoints = secSample
      .map((pt, idx) => {
        const x = padX + (idx / (secSample.length - 1)) * innerW;
        const normY = ((pt.secondary as number) - minS) / Math.max(1e-6, maxS - minS);
        const y = padY + (1 - normY) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  const lastPt = sample[sample.length - 1];
  const paramEntries: ParamSnapshotEntry[] = Object.entries(paramSnapshot)
    .filter(([, item]) => item && Number.isFinite(item.value))
    .slice(0, 8)
    .map(([label, item]) => ({
      label,
      value: item.value,
      unit: item.unit || '',
    }));

  return {
    domain,
    title: meta.title,
    accentHex: meta.accentHex,
    polylinePoints,
    secondaryPolylinePoints,
    latestTime: lastPt ? lastPt.t : 0,
    latestPrimary: lastPt ? lastPt.primary : 0,
    latestSecondary: lastPt && typeof lastPt.secondary === 'number' ? lastPt.secondary : null,
    minPrimary: minP,
    maxPrimary: maxP,
    paramEntries,
  };
}

export interface Simulation2DFallbackViewProps {
  sceneTitle?: string;
  domain?: LabDomain;
  onRestore3D?: () => void;
  contextLostReason?: string;
}

/**
 * Lightweight 2D Canvas/SVG Telemetry View backed by SimulationRingBuffer/liveTelemetrySeries.
 * Allows 3T devices or recovered WebGL failures to inspect experiments, curves, and parameters cleanly.
 */
export const Simulation2DFallbackView: React.FC<Simulation2DFallbackViewProps> = ({
  sceneTitle,
  domain: domainProp,
  onRestore3D,
  contextLostReason,
}) => {
  const activeDomain = useLabStore((s) => s.activeDomain);
  const activeModuleId = useLabStore((s) => s.activeModuleId);
  const liveTelemetrySeries = useLabStore((s) => s.liveTelemetrySeries);
  const liveParamSnapshot = useLabStore((s) => s.liveParamSnapshot);
  const timelineCurrentTime = useLabStore((s) => s.timelineCurrentTime);
  const leftDrawerOpen = useUIStore((s) => s.leftDrawerOpen);
  const rightTelemetryOpen = useUIStore((s) => s.rightTelemetryOpen);
  const zenMode = useUIStore((s) => s.zenMode);

  const resolvedDomain = domainProp ?? activeDomain;

  const model = useMemo(
    () =>
      build2DFallbackTelemetryModel(
        resolvedDomain,
        liveTelemetrySeries,
        liveParamSnapshot,
        420,
        140
      ),
    [resolvedDomain, liveTelemetrySeries, liveParamSnapshot]
  );

  const phaseAngle = ((timelineCurrentTime || model.latestTime) * 1.6) % (Math.PI * 2);
  const orbitCx = 90 + Math.cos(phaseAngle) * 44;
  const orbitCy = 65 + Math.sin(phaseAngle) * 26;

  const { theme, colorBlindSafe } = useUIStore(
    useShallow((s) => ({
      theme: s.comfortPrefs.theme,
      colorBlindSafe: s.comfortPrefs.colorBlindSafe,
    }))
  );
  const palette = getComfortChartPalette(theme, colorBlindSafe);
  const primaryStroke = colorBlindSafe ? palette.primary : model.accentHex;
  const secondaryStroke = palette.warning;

  const safeLeftPad = !zenMode && leftDrawerOpen ? 'lg:pl-[352px]' : '';
  const safeRightPad = !zenMode && rightTelemetryOpen ? 'lg:pr-[372px]' : '';

  return (
    <div
      data-testid="lab-2d-fallback-view"
      className={`w-full h-full min-h-[280px] bg-[var(--comfort-bg)] pt-16 pb-28 sm:pb-24 px-3 sm:px-4 ${safeLeftPad} ${safeRightPad} flex flex-col select-none overflow-hidden`}
    >
      <div className="w-full flex-1 min-h-0 rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] p-3.5 sm:p-5 flex flex-col justify-between gap-3 text-[var(--comfort-text)] overflow-y-auto shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-sky-700 dark:text-sky-300">
              <Cpu className="w-3 h-3" />
              <span>Mode Ringan 2D · Hemat GPU 3T</span>
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--comfort-text)] truncate">
              {sceneTitle || model.title} ({activeModuleId})
            </h3>
          </div>
        </div>

        {onRestore3D && (
          <button
            type="button"
            data-testid="restore-3d-from-2d-btn"
            onClick={onRestore3D}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-800 dark:text-teal-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kembali ke Mode 3D</span>
          </button>
        )}
      </div>

      {contextLostReason && (
        <p className="text-[11px] font-mono text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-1.5">
          {contextLostReason}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-1 items-stretch">
        {/* Domain 2D Schematic Diagram */}
        <div className="xl:col-span-5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] p-3 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--comfort-text-muted)] mb-1">
            Skema Aparatus 2D ({resolvedDomain})
          </div>
          <svg
            viewBox="0 0 180 130"
            className="w-full h-32 rounded-lg border border-[var(--comfort-border)]"
            style={{ backgroundColor: palette.canvasBg }}
            aria-label="Skema Simulasi 2D"
          >
            <line x1="12" y1="108" x2="168" y2="108" stroke={palette.axisStroke} strokeWidth="2" />
            {resolvedDomain === 'physics' && (
              <>
                <polygon points="24,108 136,108 24,52" fill={palette.gridStroke} stroke={primaryStroke} strokeWidth="1.5" />
                <rect
                  x={Math.min(110, 44 + ((phaseAngle / (Math.PI * 2)) * 55))}
                  y="72"
                  width="22"
                  height="16"
                  rx="3"
                  transform="rotate(24 72 80)"
                  fill={primaryStroke}
                  stroke={palette.pointStroke}
                  strokeWidth="1.5"
                />
              </>
            )}
            {resolvedDomain === 'chemistry' && (
              <>
                <path d="M68,26 L112,26 L124,106 L56,106 Z" fill={palette.canvasBg} stroke={palette.axisStroke} strokeWidth="2" />
                <path d="M62,72 L118,72 L123,105 L57,105 Z" fill={palette.secondary} fillOpacity="0.65" />
                <rect x="86" y="10" width="8" height="24" fill={palette.labelFill} rx="2" />
              </>
            )}
            {resolvedDomain === 'biology' && (
              <>
                <ellipse cx="90" cy="65" rx="58" ry="38" fill={palette.secondary} fillOpacity="0.2" stroke={palette.secondary} strokeWidth="2" />
                <circle cx="90" cy="65" r="17" fill={palette.primary} fillOpacity="0.55" stroke={palette.secondary} strokeWidth="1.5" />
                <circle cx={orbitCx * 0.7 + 25} cy={orbitCy * 0.65 + 22} r="5" fill={palette.warning} />
              </>
            )}
            {resolvedDomain === 'astronomy' && (
              <>
                <ellipse cx="90" cy="65" rx="48" ry="28" fill="none" stroke={palette.axisStroke} strokeDasharray="3 3" />
                <circle cx="90" cy="65" r="11" fill={palette.warning} />
                <circle cx={orbitCx} cy={orbitCy} r="5.5" fill={primaryStroke} stroke={palette.pointStroke} strokeWidth="1.2" />
              </>
            )}
          </svg>
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--comfort-text-muted)] mt-1.5">
            <span>t = {model.latestTime.toFixed(2)} s</span>
            <span style={{ color: primaryStroke }} className="font-bold">
              y = {model.latestPrimary.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Live Telemetry Curve from SimulationRingBuffer */}
        <div className="xl:col-span-7 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--comfort-text-muted)] mb-1">
            <span>Kurva Real-Time (RingBuffer 2D)</span>
            <span className="text-[var(--comfort-text)]">
              [{model.minPrimary.toFixed(2)} .. {model.maxPrimary.toFixed(2)}]
            </span>
          </div>
          <svg
            viewBox="0 0 420 140"
            className="w-full h-32 rounded-lg border border-[var(--comfort-border)]"
            style={{ backgroundColor: palette.canvasBg }}
            aria-label="Grafik Kurva Telemetri 2D"
          >
            <line x1="10" y1="70" x2="410" y2="70" stroke={palette.gridStroke} strokeWidth="1" strokeDasharray="4 4" />
            {model.secondaryPolylinePoints && (
              <polyline
                fill="none"
                stroke={secondaryStroke}
                strokeWidth="1.8"
                strokeOpacity="0.85"
                strokeDasharray={colorBlindSafe ? '4 2' : undefined}
                points={model.secondaryPolylinePoints}
              />
            )}
            <polyline
              fill="none"
              stroke={primaryStroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={model.polylinePoints}
            />
          </svg>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {model.paramEntries.length > 0 ? (
              model.paramEntries.map((entry) => (
                <span
                  key={entry.label}
                  className="px-2 py-0.5 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[10px] font-mono text-[var(--comfort-text-muted)]"
                >
                  {entry.label}: <b className="text-[var(--comfort-text)]">{entry.value}</b>
                  {entry.unit ? ` ${entry.unit}` : ''}
                </span>
              ))
            ) : (
              <span className="text-[11px] font-mono text-[var(--comfort-text-muted)]">
                Parameter & kalkulator numerik aktif di panel variabel — siap mencatat percobaan.
              </span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Simulation2DFallbackView;
