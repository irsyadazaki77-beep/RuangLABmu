import React from 'react';
import { motion } from 'motion/react';
import { SPRING_TACTILE } from '../../styles/motionPresets';

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

const SEVERITY_STYLES: Record<
  TelemetryStatusSeverity,
  {
    stroke: string;
    badgeBg: string;
    badgeText: string;
    statusText: string;
  }
> = {
  nominal: {
    stroke: '#10b981', // emerald-500
    badgeBg: 'bg-emerald-500/15 border-emerald-500/40',
    badgeText: 'text-emerald-400',
    statusText: 'NOMINAL',
  },
  warning: {
    stroke: '#f59e0b', // amber-500
    badgeBg: 'bg-amber-500/15 border-amber-500/40',
    badgeText: 'text-amber-400',
    statusText: 'PERINGATAN',
  },
  critical: {
    stroke: '#f43f5e', // rose-500
    badgeBg: 'bg-rose-500/15 border-rose-500/40',
    badgeText: 'text-rose-400',
    statusText: 'KRITIS',
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
  const safeVal = Number.isFinite(value) ? value : min;
  const span = Math.max(1e-9, max - min);
  const normalized = Math.min(1, Math.max(0, (safeVal - min) / span));

  const severity = resolveGaugeSeverity(safeVal, max, warningThreshold, criticalThreshold);
  const style = SEVERITY_STYLES[severity];

  // Semi-circular radial meter geometry (180 deg arc from -90 deg to +90 deg)
  const radius = 38;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - normalized);
  const needleAngleDeg = -90 + normalized * 180;

  return (
    <div
      data-testid="telemetry-svg-gauge"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 flex flex-col justify-between gap-2 shadow-xs"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-normal text-[var(--comfort-text-muted)] truncate">
          {label}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${style.badgeBg} ${style.badgeText}`}
        >
          {style.statusText}
        </span>
      </div>

      {/* Crisp SVG Radial Arc + Animated Needle */}
      <div className="relative flex items-center justify-center pt-1">
        <svg
          viewBox="0 0 100 58"
          className="w-full max-w-[132px] h-[68px] overflow-visible"
          role="img"
          aria-label={`Gauge ${label}: ${safeVal.toFixed(decimals)} ${unit} (${style.statusText})`}
        >
          {/* Background Track Arc */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-800"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Threshold Tick Marks */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke={style.stroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 180ms ease-out, stroke 200ms ease' }}
          />

          {/* Animated Needle */}
          <motion.g
            initial={false}
            animate={{ rotate: needleAngleDeg }}
            transition={SPRING_TACTILE}
            style={{ originX: '50px', originY: '48px', transformOrigin: '50px 48px' }}
          >
            <line
              x1="50"
              y1="48"
              x2="50"
              y2="16"
              stroke={style.stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="50" cy="48" r="3.5" fill={style.stroke} />
          </motion.g>
        </svg>
      </div>

      {/* Tabular Readout + Min/Max Scale */}
      <div className="flex items-baseline justify-between gap-2 pt-0.5 border-t border-[var(--comfort-border)]">
        <span className="text-[10px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
          {min}–{max}
        </span>
        <div className="font-mono text-sm font-bold text-[var(--comfort-text)] tabular-nums">
          {safeVal.toFixed(decimals)}{' '}
          <span className="text-[11px] font-normal text-[var(--comfort-text-muted)]">
            {unit}
          </span>
        </div>
      </div>

      {subtitle && (
        <p className="text-[10px] text-[var(--comfort-text-muted)] truncate">{subtitle}</p>
      )}
    </div>
  );
};
