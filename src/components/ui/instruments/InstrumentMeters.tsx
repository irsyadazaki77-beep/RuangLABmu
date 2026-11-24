import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Activity, Microscope } from 'lucide-react';
import { labSound } from '../../../utils/soundEngine';
import { SciFormula } from '../ScientificNotation';

export interface CircularGaugeMeterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color?: string;
  warningThreshold?: number;
  size?: 'sm' | 'md';
  precision?: number;
  badgeText?: string;
}

export const CircularGaugeMeter: React.FC<CircularGaugeMeterProps> = ({
  label,
  value,
  min,
  max,
  unit,
  color = '#0EA5E9',
  warningThreshold,
  size = 'md',
  precision = 2,
  badgeText,
}) => {
  const safeVal = Number.isFinite(value) ? value : 0;
  const clamped = Math.min(max, Math.max(min, safeVal));
  const ratio = Math.min(1, Math.max(0, (clamped - min) / Math.max(1e-6, max - min)));
  const isWarning = warningThreshold !== undefined && safeVal >= warningThreshold;

  const svgSize = size === 'sm' ? 92 : 116;
  const strokeWidth = size === 'sm' ? 7 : 8.5;
  const radius = (svgSize - strokeWidth * 2) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 240 / 360;
  const maxArcLength = circumference * arcFraction;
  const activeArcLength = maxArcLength * ratio;
  const dashOffset = maxArcLength - activeArcLength;

  const activeStrokeColor = isWarning ? '#F59E0B' : color;

  const formattedValue =
    Math.abs(safeVal) >= 100
      ? safeVal.toFixed(Math.min(1, precision))
      : safeVal.toFixed(precision);

  return (
    <motion.div
      animate={
        isWarning
          ? {
              boxShadow: [
                '0 0 0px rgba(245, 158, 11, 0)',
                '0 0 16px rgba(245, 158, 11, 0.28)',
                '0 0 0px rgba(245, 158, 11, 0)',
              ],
            }
          : { boxShadow: '0 0 0px rgba(0,0,0,0)' }
      }
      transition={isWarning ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
      className={`relative flex flex-col items-center justify-center rounded-xl border px-2.5 py-2 select-none transition-colors ${
        isWarning
          ? 'border-amber-500/60 bg-amber-500/5'
          : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)]'
      }`}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: svgSize, height: svgSize - 10 }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="overflow-visible"
        >
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="var(--comfort-surface-subtle)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${maxArcLength} ${circumference}`}
            transform={`rotate(150 ${svgSize / 2} ${svgSize / 2})`}
          />
          <motion.circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={activeStrokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${maxArcLength} ${circumference}`}
            initial={{ strokeDashoffset: maxArcLength }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            transform={`rotate(150 ${svgSize / 2} ${svgSize / 2})`}
            style={{
              filter: `drop-shadow(0 0 4px ${activeStrokeColor}55)`,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1 text-center">
          <span
            className={`font-mono font-bold tabular-nums tracking-tight ${
              size === 'sm' ? 'text-sm' : 'text-base'
            } ${
              isWarning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-[var(--comfort-text)]'
            }`}
          >
            {formattedValue}
          </span>
          <span className="font-mono text-2xs text-[var(--comfort-text-muted)] leading-none mt-0.5">
            <SciFormula text={unit} />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 text-2xs font-medium text-[var(--comfort-text)] text-center leading-tight line-clamp-1">
        {isWarning && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
        <span className="truncate max-w-[110px]">
          <SciFormula text={label} />
        </span>
      </div>

      {badgeText && (
        <span className="mt-1 text-2xs font-mono font-semibold text-emerald-700 dark:text-emerald-300">
          ● {badgeText}
        </span>
      )}
    </motion.div>
  );
};

export interface LiquidColumnMeterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  variant: 'temperature' | 'ph' | 'volume';
  compact?: boolean;
}

function getPhUniversalColor(ph: number): string {
  if (ph <= 2.0) return '#EF4444';
  if (ph <= 4.5) return '#F97316';
  if (ph <= 6.2) return '#EAB308';
  if (ph <= 7.8) return '#10B981';
  if (ph <= 9.5) return '#06B6D4';
  if (ph <= 11.5) return '#3B82F6';
  return '#8B5CF6';
}

export const LiquidColumnMeter: React.FC<LiquidColumnMeterProps> = ({
  label,
  value,
  min,
  max,
  unit,
  variant,
  compact = false,
}) => {
  const safeVal = Number.isFinite(value) ? value : min;
  const clamped = Math.min(max, Math.max(min, safeVal));
  const fillPct = Math.min(100, Math.max(6, ((clamped - min) / Math.max(1e-6, max - min)) * 100));

  const liquidColor =
    variant === 'ph'
      ? getPhUniversalColor(clamped)
      : variant === 'temperature'
      ? clamped > 65
        ? '#F43F5E'
        : clamped < 18
        ? '#38BDF8'
        : '#F59E0B'
      : '#0EA5E9';

  const ticks = [100, 75, 50, 25, 0];

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] px-3 py-2 select-none">
      <div
        className={`relative w-6 ${
          compact ? 'h-20' : 'h-24'
        } rounded-full border-2 border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] overflow-hidden flex flex-col justify-end p-0.5 shadow-inner`}
      >
        <div className="pointer-events-none absolute inset-y-1.5 right-0.5 z-20 flex flex-col justify-between">
          {ticks.map((t) => (
            <div
              key={t}
              className={`h-[1.5px] ${
                t === 50 ? 'w-2.5 bg-slate-400/80' : 'w-1.5 bg-slate-400/50'
              }`}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-1 left-1 w-0.5 rounded-full bg-white/30 z-20" />

        <motion.div
          layout
          initial={{ height: `${fillPct}%` }}
          animate={{
            height: `${fillPct}%`,
            backgroundColor: liquidColor,
          }}
          transition={{ type: 'spring', stiffness: 150, damping: 20 }}
          className="relative w-full rounded-b-full z-10"
          style={{
            boxShadow: `0 0 8px ${liquidColor}66`,
          }}
        >
          <div className="absolute -top-1 inset-x-0 h-2 rounded-full bg-white/50 blur-[0.5px]" />
        </motion.div>
      </div>

      <div className="flex flex-col justify-between min-w-[76px]">
        <span className="text-2xs font-medium text-[var(--comfort-text)] leading-tight">
          <SciFormula text={label} />
        </span>
        <div className="my-1 flex items-baseline gap-1">
          <span
            className="text-base font-mono font-bold tabular-nums text-[var(--comfort-text)]"
            style={{ color: variant === 'ph' ? liquidColor : undefined }}
          >
            {safeVal.toFixed(variant === 'ph' ? 2 : 1)}
          </span>
          <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
            <SciFormula text={unit} />
          </span>
        </div>
        <div className="text-2xs font-mono text-[var(--comfort-text-muted)]">
          {variant === 'ph'
            ? safeVal < 6.8
              ? 'Asam'
              : safeVal > 7.2
              ? 'Basa'
              : 'Netral'
            : `${min}–${max} ${unit}`}
        </div>
      </div>
    </div>
  );
};

export interface AnimatedNumberReadoutProps {
  value: number | string;
  unit?: string;
  precision?: number;
  label?: string;
  className?: string;
  highlightColor?: string;
  accentColor?: string;
}

export const AnimatedNumberReadout: React.FC<AnimatedNumberReadoutProps> = ({
  value,
  unit,
  precision = 2,
  label,
  className = '',
  highlightColor = 'rgba(14, 165, 233, 0.35)',
  accentColor,
}) => {
  const numericValue = typeof value === 'number' ? value : NaN;
  const [displayVal, setDisplayVal] = useState<number>(
    Number.isFinite(numericValue) ? numericValue : 0
  );
  const [flash, setFlash] = useState<boolean>(false);
  const currentValRef = useRef<number>(Number.isFinite(numericValue) ? numericValue : 0);

  useEffect(() => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    const startVal = currentValRef.current;
    if (Math.abs(value - startVal) > 1e-4) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 260);

      let frameId: number;
      const diff = value - startVal;
      const startTime = performance.now();
      const duration = 180;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextVal = t < 1 ? startVal + diff * eased : value;
        currentValRef.current = nextVal;
        setDisplayVal(nextVal);
        if (t < 1) {
          frameId = requestAnimationFrame(step);
        }
      };

      frameId = requestAnimationFrame(step);
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(frameId);
      };
    }
  }, [value]);

  const formatted =
    typeof value === 'string'
      ? value
      : Number.isFinite(displayVal)
      ? displayVal.toFixed(precision)
      : '0.00';

  if (accentColor && label) {
    return (
      <motion.div
        animate={
          flash
            ? { boxShadow: `0 0 0 2px ${accentColor}66`, scale: 1.02 }
            : { boxShadow: '0 0 0 0px rgba(0,0,0,0)', scale: 1 }
        }
        transition={{ duration: 0.18 }}
        className={`p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-col justify-between ${className}`}
      >
        <span className="text-2xs font-medium text-[var(--comfort-text-muted)] truncate">
          {label}
        </span>
        <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
          <span
            className="text-lg font-bold text-[var(--comfort-text)]"
            style={{ color: flash ? accentColor : undefined }}
          >
            {formatted}
          </span>
          {unit && <span className="text-xs text-[var(--comfort-text-muted)]">{unit}</span>}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={
        flash
          ? { boxShadow: `0 0 0 2px ${highlightColor}`, scale: 1.02 }
          : { boxShadow: '0 0 0 0px rgba(0,0,0,0)', scale: 1 }
      }
      transition={{ duration: 0.18 }}
      className={`inline-flex items-baseline gap-1 font-mono tabular-nums rounded px-1 ${className}`}
    >
      {label && <span className="text-xs text-[var(--comfort-text-muted)] mr-1">{label}:</span>}
      <span className="font-bold">{formatted}</span>
      {unit && <span className="text-xs text-[var(--comfort-text-muted)]">{unit}</span>}
    </motion.div>
  );
};

export interface LiveTelemetryOscilloscopeProps {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  primaryLabel: string;
  primaryValue: number;
  primaryUnit: string;
  secondaryLabel: string;
  secondaryValue: number;
  secondaryUnit: string;
  microscopicStateLabel: string;
  microscopicDetail: string;
  accentColor?: string;
}

export const LiveTelemetryOscilloscope: React.FC<
  LiveTelemetryOscilloscopeProps
> = ({
  domain,
  primaryLabel,
  primaryValue,
  primaryUnit,
  secondaryLabel,
  secondaryValue,
  secondaryUnit,
  microscopicStateLabel,
  microscopicDetail,
  accentColor = '#0EA5E9',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [channelMode, setChannelMode] = useState<'dual' | 'ch1' | 'phase'>('dual');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderLoop = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      const gridStepX = w / 8;
      const gridStepY = h / 4;
      for (let x = gridStepX; x < w; x += gridStepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = gridStepY; y < h; y += gridStepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const norm1 = Math.min(1, Math.max(0.15, Math.abs(primaryValue) / (Math.abs(primaryValue) + 15)));
      const norm2 = Math.min(1, Math.max(0.15, Math.abs(secondaryValue) / (Math.abs(secondaryValue) + 20)));
      const freq1 = 1.6 + norm1 * 3.2;
      const freq2 = 1.2 + norm2 * 2.5;

      if (channelMode === 'phase') {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const cx = w / 2;
        const cy = h / 2;
        const rx = w * 0.36 * norm1;
        const ry = h * 0.38 * norm2;
        for (let t = 0; t <= Math.PI * 2; t += 0.06) {
          const x = cx + Math.sin(freq1 * t + phase) * rx;
          const y = cy + Math.cos(freq2 * t + phase * 0.7) * ry;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const t = (x / w) * Math.PI * 2 * freq1 + phase;
          const amp = h * 0.34 * norm1;
          const y = h / 2 - Math.sin(t) * amp * (1 - 0.08 * Math.cos(t * 0.5));
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (channelMode === 'dual') {
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let x = 0; x < w; x += 2) {
            const t = (x / w) * Math.PI * 2 * freq2 + phase * 1.15 + 0.9;
            const amp = h * 0.28 * norm2;
            const y = h / 2 - Math.cos(t) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      phase += 0.055;
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [primaryValue, secondaryValue, channelMode, accentColor]);

  return (
    <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] p-3 space-y-2.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="text-2xs font-bold uppercase tracking-wider text-[var(--comfort-text)]">
            Osiloskop Telemetri ({domain})
          </span>
        </div>
        <div className="flex items-center gap-1 bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-lg p-0.5">
          {(
            [
              { id: 'dual', label: 'CH1+CH2' },
              { id: 'ch1', label: 'CH1' },
              { id: 'phase', label: 'Fase X-Y' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                labSound.playClick();
                setChannelMode(m.id);
              }}
              className={`px-2 py-0.5 rounded text-2xs font-mono font-semibold transition-colors cursor-pointer ${
                channelMode === m.id
                  ? 'bg-sky-600 text-white'
                  : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dedicated dark CRT phosphor oscilloscope viewport */}
      <div className="relative rounded-lg overflow-hidden border border-slate-700/80 bg-[#090D16]">
        <canvas ref={canvasRef} width={320} height={86} className="w-full h-[86px] block" />
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-2xs font-mono pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-[#090D16]/85 border border-sky-500/40 text-sky-300 tabular-nums">
            CH1 {primaryLabel}: {Number(primaryValue).toFixed(2)} {primaryUnit}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#090D16]/85 border border-emerald-500/40 text-emerald-300 tabular-nums">
            CH2 {secondaryLabel}: {Number(secondaryValue).toFixed(2)} {secondaryUnit}
          </span>
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-start gap-2">
        <Microscope className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs font-semibold text-amber-700 dark:text-amber-300">
              {microscopicStateLabel}
            </span>
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
              Vektor &amp; Partikel
            </span>
          </div>
          <p className="text-2xs text-[var(--comfort-text-muted)] leading-snug mt-0.5">
            {microscopicDetail}
          </p>
        </div>
      </div>
    </div>
  );
};
