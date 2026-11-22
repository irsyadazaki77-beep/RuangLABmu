import React from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { SPRING_TACTILE } from '../../styles/motionPresets';
import { useUIStore } from '../../stores/useUIStore';
import { getComfortChartPalette } from '../ui/VisualComfortToolbar';

export type TelemetryStatusSeverity = 'nominal' | 'warning' | 'critical';

export interface TelemetryGaugeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  decimals?: number;
  subtitle?: string;
}

export function resolveGaugeSeverity(
  value: number,
  max: number,
  warningThreshold?: number,
  criticalThreshold?: number
): TelemetryStatusSeverity {
  const crit = criticalThreshold ?? max * 0.88;
  const warn = warningThreshold ?? max * 0.7;
  if (value >= crit) return 'critical';
  if (value >= warn) return 'warning';
  return 'nominal';
}

const SEVERITY_META: Record<
  TelemetryStatusSeverity,
  {
    symbol: string;
    statusText: string;
    badgeBg: string;
  }
> = {
  nominal: {
    symbol: '●',
    statusText: 'NOMINAL',
    badgeBg: 'bg-emerald-500/12 border-emerald-500/35',
  },
  warning: {
    symbol: '▲',
    statusText: 'PERINGATAN',
    badgeBg: 'bg-amber-500/12 border-amber-500/35',
  },
  critical: {
    symbol: '◆',
    statusText: 'KRITIS',
    badgeBg: 'bg-rose-500/12 border-rose-500/35',
  },
};

export const TelemetryGauge: React.FC<TelemetryGaugeProps> = ({
  label,
  value,
  min,
  max,
  unit,
  warningThreshold,
  criticalThreshold,
  decimals = 2,
  subtitle,
}) => {
  const { theme, colorBlindSafe } = useUIStore(
    useShallow((s) => ({
      theme: s.comfortPrefs.theme,
      colorBlindSafe: s.comfortPrefs.colorBlindSafe,
    }))
  );
  const palette = getComfortChartPalette(theme, colorBlindSafe);

  const safeVal = Number.isFinite(value) ? value : min;
  const span = Math.max(1e-9, max - min);
  const normalized = Math.min(1, Math.max(0, (safeVal - min) / span));

  const severity = resolveGaugeSeverity(safeVal, max, warningThreshold, criticalThreshold);
  const meta = SEVERITY_META[severity];
  const strokeColor =
    severity === 'critical'
      ? palette.critical
      : severity === 'warning'
      ? palette.warning
      : palette.secondary;

  // Semi-circular radial meter geometry (180 deg arc from left 180° through top 270° to right 360°)
  const radius = 38;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - normalized);
  const needleRad = Math.PI + normalized * Math.PI;
  const needleLen = 30;
  const needleTipX = 50 + Math.cos(needleRad) * needleLen;
  const needleTipY = 48 + Math.sin(needleRad) * needleLen;

  return (
    <div
      data-testid="telemetry-svg-gauge"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 flex flex-col justify-between gap-2 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span
          title={label}
          className="text-[10px] font-bold uppercase tracking-normal text-[var(--comfort-text-muted)] leading-tight"
        >
          {label}
        </span>
        <span
          style={{
            color: strokeColor,
            borderColor: colorBlindSafe ? strokeColor : undefined,
          }}
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${
            colorBlindSafe ? 'bg-[var(--comfort-surface-subtle)]' : meta.badgeBg
          }`}
        >
          {colorBlindSafe ? `${meta.symbol} ${meta.statusText}` : meta.statusText}
        </span>
      </div>

      {/* Crisp SVG Radial Arc + Exact Semicircular Needle */}
      <div className="relative flex items-center justify-center pt-1">
        <svg
          viewBox="0 0 100 56"
          className="w-full max-w-[132px] h-[68px]"
          role="img"
          aria-label={`Gauge ${label}: ${safeVal.toFixed(decimals)} ${unit} (${meta.statusText})`}
        >
          {/* Background Track Arc */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke={palette.gridStroke}
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Threshold Arc */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke={strokeColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 180ms ease-out, stroke 200ms ease' }}
          />

          {/* Animated Needle locked strictly to semicircle pivot (50, 48) */}
          <motion.line
            initial={false}
            animate={{ x2: needleTipX, y2: needleTipY }}
            transition={SPRING_TACTILE}
            x1="50"
            y1="48"
            stroke={strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="50" cy="48" r="3.6" fill={strokeColor} />
          <circle cx="50" cy="48" r="1.4" fill="var(--comfort-surface)" />
        </svg>
      </div>

      {/* Tabular Readout + Min/Max Scale */}
      <div className="flex items-baseline justify-between gap-1.5 pt-0.5 border-t border-[var(--comfort-border)] min-w-0">
        <span className="text-[10px] font-mono text-[var(--comfort-text-muted)] tabular-nums shrink-0 whitespace-nowrap">
          {Number.isInteger(min) ? min : Number(min.toFixed(1))}–{Number.isInteger(max) ? max : Math.ceil(max)}
        </span>
        <div className="font-mono text-xs sm:text-sm font-bold text-[var(--comfort-text)] tabular-nums truncate text-right">
          {safeVal.toFixed(decimals)}
          {unit ? (
            <span className="ml-1 text-[10px] font-normal text-[var(--comfort-text-muted)]">
              {unit}
            </span>
          ) : null}
        </div>
      </div>

      {subtitle && (
        <p className="text-[10px] text-[var(--comfort-text-muted)] truncate">{subtitle}</p>
      )}
    </div>
  );
};
