import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Minus,
  Plus,
  Lock,
  AlertTriangle,
  Activity,
  Sliders,
  RotateCcw,
  CheckCircle2,
  Microscope,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { labSound } from '../../utils/soundEngine';
import { InstrumentCalibrationConfig } from '../../utils/uncertaintyEngine';
import { SciFormula } from './ScientificNotation';

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
  // 240 degree sweep out of 360 degrees
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
                '0 0 16px rgba(245, 158, 11, 0.35)',
                '0 0 0px rgba(245, 158, 11, 0)',
              ],
            }
          : { boxShadow: '0 0 0px rgba(0,0,0,0)' }
      }
      transition={isWarning ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
      className={`relative flex flex-col items-center justify-center rounded-xl border ${
        isWarning
          ? 'border-amber-500/60 bg-slate-950/90'
          : 'border-slate-700/80 bg-slate-950/85'
      } px-2.5 py-2 select-none`}
    >
      <div className="relative flex items-center justify-center" style={{ width: svgSize, height: svgSize - 10 }}>
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="overflow-visible"
        >
          {/* Background 240deg Track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${maxArcLength} ${circumference}`}
            transform={`rotate(150 ${svgSize / 2} ${svgSize / 2})`}
          />
          {/* Animated Foreground 240deg Arc */}
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
              filter: `drop-shadow(0 0 6px ${activeStrokeColor}66)`,
            }}
          />
        </svg>

        {/* Center Digital Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1 text-center">
          <span
            className={`font-mono font-bold tabular-nums tracking-tight ${
              size === 'sm' ? 'text-sm' : 'text-base'
            } ${isWarning ? 'text-amber-400' : 'text-white'}`}
          >
            {formattedValue}
          </span>
          <span className="font-mono text-[10px] text-slate-400 leading-none mt-0.5">
            <SciFormula text={unit} />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300 text-center leading-tight line-clamp-1">
        {isWarning && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
        <span className="truncate max-w-[110px]">
          <SciFormula text={label} />
        </span>
      </div>

      {badgeText && (
        <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          {badgeText}
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
  if (ph <= 2.0) return '#EF4444'; // Strong Acid Red
  if (ph <= 4.5) return '#F97316'; // Weak Acid Orange
  if (ph <= 6.2) return '#EAB308'; // Weak Acid Yellow
  if (ph <= 7.8) return '#10B981'; // Neutral Emerald Green
  if (ph <= 9.5) return '#06B6D4'; // Weak Base Cyan
  if (ph <= 11.5) return '#3B82F6'; // Base Blue
  return '#8B5CF6'; // Strong Base Deep Violet
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
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-950/85 px-3 py-2 select-none">
      {/* Vertical Glass Tube with Graduation Ticks */}
      <div
        className={`relative w-6 ${
          compact ? 'h-20' : 'h-24'
        } rounded-full border-2 border-slate-600/90 bg-slate-900/95 overflow-hidden flex flex-col justify-end p-0.5 shadow-inner`}
      >
        {/* Graduation Tick Marks */}
        <div className="pointer-events-none absolute inset-y-1.5 right-0.5 z-20 flex flex-col justify-between">
          {ticks.map((t) => (
            <div
              key={t}
              className={`h-[1.5px] ${
                t === 50 ? 'w-2.5 bg-slate-300/80' : 'w-1.5 bg-slate-500/70'
              }`}
            />
          ))}
        </div>

        {/* Glass Specular Highlight */}
        <div className="pointer-events-none absolute inset-y-1 left-1 w-0.5 rounded-full bg-white/20 z-20" />

        {/* Animated Liquid Fill Column */}
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
            boxShadow: `0 0 10px ${liquidColor}88`,
          }}
        >
          {/* Meniscus Highlight at Top of Column */}
          <div className="absolute -top-1 inset-x-0 h-2 rounded-full bg-white/60 blur-[0.5px]" />
        </motion.div>
      </div>

      {/* Digital Readout & Scale Metadata */}
      <div className="flex flex-col justify-between min-w-[76px]">
        <span className="text-[11px] font-medium text-slate-300 leading-tight">
          <SciFormula text={label} />
        </span>
        <div className="my-1 flex items-baseline gap-1">
          <span
            className="text-base font-mono font-bold tabular-nums text-white"
            style={{ color: variant === 'ph' ? liquidColor : undefined }}
          >
            {safeVal.toFixed(variant === 'ph' ? 2 : 1)}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            <SciFormula text={unit} />
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-400">
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
  const [displayVal, setDisplayVal] = useState<number>(Number.isFinite(numericValue) ? numericValue : 0);
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

  const formatted = typeof value === 'string'
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
        className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between ${className}`}
      >
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
          <span
            className="text-lg font-bold text-slate-900 dark:text-white"
            style={{ color: flash ? accentColor : undefined }}
          >
            {formatted}
          </span>
          {unit && <span className="text-xs text-slate-400">{unit}</span>}
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
      {label && <span className="text-xs text-slate-400 mr-1">{label}:</span>}
      <span className="font-bold">{formatted}</span>
      {unit && <span className="text-xs text-slate-400">{unit}</span>}
    </motion.div>
  );
};

export interface TactileParameterControlProps {
  id?: string;
  label: string;
  symbol?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  onHoverChange?: (isHovered: boolean) => void;
  lockedBy?: string;
  badgeText?: string;
  precision?: number;
  accentColor?: string;
  onFocusLock?: () => void;
  onBlurLock?: () => void;
}

export const TactileParameterControl: React.FC<TactileParameterControlProps> = ({
  id,
  label,
  symbol,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onHoverChange,
  lockedBy,
  badgeText,
  precision,
  onFocusLock,
  onBlurLock,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const safeVal = Number.isFinite(value) ? value : min;
  const fillPct = Math.min(
    100,
    Math.max(0, ((safeVal - min) / Math.max(1e-6, max - min)) * 100)
  );
  const isLocked = Boolean(lockedBy);

  const decimals =
    precision !== undefined
      ? precision
      : step < 0.05
      ? 2
      : step < 1
      ? 1
      : 0;

  const handleStep = (dir: -1 | 1) => {
    if (isLocked) return;
    labSound.playStep(dir > 0 ? 'up' : 'down');
    const nextRaw = safeVal + dir * step;
    const clamped = Math.min(max, Math.max(min, Number(nextRaw.toFixed(decimals + 1))));
    onChange(clamped);
  };

  return (
    <motion.div
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(false);
      }}
      animate={{
        borderColor: isHovered ? 'rgba(14, 165, 233, 0.55)' : 'rgba(148, 163, 184, 0.2)',
      }}
      transition={{ duration: 0.15 }}
      className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/75 border border-slate-200/90 dark:border-slate-700/80 space-y-2 transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {symbol && (
            <motion.span
              animate={{
                scale: isHovered ? 1.08 : 1,
                boxShadow: isHovered
                  ? '0 0 12px rgba(14, 165, 233, 0.45)'
                  : '0 0 0px rgba(0,0,0,0)',
              }}
              className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-sky-500/15 dark:bg-sky-400/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 shrink-0"
            >
              <SciFormula text={symbol} serifVars />
            </motion.span>
          )}
          <label
            htmlFor={id}
            className="font-semibold text-slate-800 dark:text-slate-100 truncate cursor-pointer"
          >
            <SciFormula text={label} />
          </label>
          {badgeText && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              · <SciFormula text={badgeText} />
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isLocked ? (
            <motion.span
              key="locked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-0.5"
            >
              <Lock className="w-3 h-3" />
              Diatur {lockedBy}
            </motion.span>
          ) : (
            <motion.div
              key="controls"
              className="flex items-center gap-1 shrink-0"
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                disabled={isLocked || safeVal <= min}
                aria-label={`Kurangi ${label}`}
                onClick={() => handleStep(-1)}
                className="p-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </motion.button>

              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums min-w-[68px] text-center px-1">
                {safeVal.toFixed(decimals)} <SciFormula text={unit} />
              </span>

              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                disabled={isLocked || safeVal >= max}
                aria-label={`Tambah ${label}`}
                onClick={() => handleStep(1)}
                className="p-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-500 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Fill Bar + Native Range Input */}
      <div className="relative flex items-center h-5">
        <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-slate-200 dark:bg-slate-900 overflow-hidden border border-slate-300/60 dark:border-slate-700/80">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
            initial={false}
            animate={{ width: `${fillPct}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeVal}
          disabled={isLocked}
          onPointerDown={() => {
            onHoverChange?.(true);
            onFocusLock?.();
          }}
          onFocus={() => {
            onHoverChange?.(true);
            onFocusLock?.();
          }}
          onPointerUp={() => {
            onHoverChange?.(false);
            onBlurLock?.();
          }}
          onBlur={() => {
            onHoverChange?.(false);
            onBlurLock?.();
          }}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative z-10 w-full h-5 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        {/* Custom Visual Thumb */}
        <motion.div
          className="pointer-events-none absolute w-4 h-4 rounded-full bg-white border-2 border-sky-600 dark:border-sky-400 shadow-sm"
          initial={false}
          animate={{
            left: `calc(${fillPct}% - 8px)`,
            scale: isHovered ? 1.18 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        />
      </div>
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

      // Subtle oscilloscope graticule grid
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

      // Center zero reference line
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
        // Lissajous phase space portrait (X vs V / Channel 1 vs Channel 2)
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const cx = w / 2;
        const cy = h / 2;
        const rx = (w * 0.36) * norm1;
        const ry = (h * 0.38) * norm2;
        for (let t = 0; t <= Math.PI * 2; t += 0.06) {
          const x = cx + Math.sin(freq1 * t + phase) * rx;
          const y = cy + Math.cos(freq2 * t + phase * 0.7) * ry;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        // Channel 1 Waveform
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const t = (x / w) * Math.PI * 2 * freq1 + phase;
          const amp = (h * 0.34) * norm1;
          const y = h / 2 - Math.sin(t) * amp * (1 - 0.08 * Math.cos(t * 0.5));
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Channel 2 Waveform
        if (channelMode === 'dual') {
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let x = 0; x < w; x += 2) {
            const t = (x / w) * Math.PI * 2 * freq2 + phase * 1.15 + 0.9;
            const amp = (h * 0.28) * norm2;
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
            Osiloskop Telemetri & Indikator Mikroskopis ({domain})
          </span>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
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
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                channelMode === m.id
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#090D16]">
        <canvas
          ref={canvasRef}
          width={320}
          height={86}
          className="w-full h-[86px] block"
        />
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-slate-950/85 border border-sky-500/40 text-sky-300 tabular-nums">
            CH1 {primaryLabel}: {Number(primaryValue).toFixed(2)} {primaryUnit}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/85 border border-emerald-500/40 text-emerald-300 tabular-nums">
            CH2 {secondaryLabel}: {Number(secondaryValue).toFixed(2)} {secondaryUnit}
          </span>
        </div>
      </div>

      {/* Microscopic / Vector State Strip */}
      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2">
        <Microscope className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-amber-300">
              {microscopicStateLabel}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Vektor & Partikel Aktif
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
            {microscopicDetail}
          </p>
        </div>
      </div>
    </div>
  );
};

export interface InstrumentCalibrationCardProps {
  instrumentName: string;
  unit: string;
  rawValue: number;
  baseUncertaintyDelta: number;
  config: InstrumentCalibrationConfig;
  onChangeConfig: (next: InstrumentCalibrationConfig) => void;
}

export const InstrumentCalibrationCard: React.FC<
  InstrumentCalibrationCardProps
> = ({
  instrumentName,
  unit,
  rawValue,
  baseUncertaintyDelta,
  config,
  onChangeConfig,
}) => {
  const effectiveDelta =
    config.precisionTier === 'high-precision'
      ? Number((baseUncertaintyDelta * 0.35).toFixed(4))
      : baseUncertaintyDelta;

  const activeZeroOffset = config.isZeroCalibrated ? 0 : config.zeroOffsetBias;
  const calibratedValue = Number((rawValue + activeZeroOffset).toFixed(3));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/60 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Kalibrasi Alat Ukur & Ketidakpastian ({instrumentName})
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
            config.isZeroCalibrated
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
          }`}
        >
          {config.isZeroCalibrated
            ? 'Terkalibrasi (Zero-Tare Aktif)'
            : `Bias Nol: ${config.zeroOffsetBias >= 0 ? '+' : ''}${config.zeroOffsetBias.toFixed(2)} ${unit}`}
        </span>
      </div>

      {/* Precision Tier & Tare Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onChangeConfig({ ...config, precisionTier: 'standard' });
            }}
            className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-colors ${
              config.precisionTier === 'standard'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Standar (±{baseUncertaintyDelta} {unit})
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onChangeConfig({ ...config, precisionTier: 'high-precision' });
            }}
            className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-colors ${
              config.precisionTier === 'high-precision'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Presisi Tinggi (±{Number((baseUncertaintyDelta * 0.35).toFixed(3))} {unit})
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              labSound.playSuccessChime();
              onChangeConfig({
                ...config,
                isZeroCalibrated: true,
                zeroOffsetBias: 0,
              });
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Kalibrasi Nol (Tare)
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onChangeConfig({
                ...config,
                isZeroCalibrated: false,
                zeroOffsetBias: Number(
                  ((Math.random() > 0.5 ? 1 : -1) * baseUncertaintyDelta * 3).toFixed(2)
                ),
              });
            }}
            title="Simulasikan pergeseran titik nol (Zero Drift) sebelum kalibrasi"
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-amber-500" />
            Uji Drift
          </button>
        </div>
      </div>

      {/* Live Readout Comparison */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/70 text-[11px] font-mono tabular-nums">
        <span className="text-slate-500 dark:text-slate-400">
          Nilai Teoretis: <strong className="text-slate-800 dark:text-slate-200">{rawValue.toFixed(2)} {unit}</strong>
        </span>
        <span className="text-sky-700 dark:text-sky-300 font-bold">
          Bacaan Alat: {calibratedValue.toFixed(2)} ± {effectiveDelta} {unit}
        </span>
      </div>
    </div>
  );
};

export interface CollapsibleLabSectionProps {
  title: string;
  subtitle?: string;
  statusText?: string;
  defaultOpen?: boolean;
  accentColor?: string;
  children: React.ReactNode;
}

export const CollapsibleLabSection: React.FC<CollapsibleLabSectionProps> = ({
  title,
  subtitle,
  statusText,
  defaultOpen = false,
  accentColor = '#38bdf8',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 pl-3.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusText && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {statusText}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-sky-400' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {children}
        </div>
      )}
    </div>
  );
};

export interface CockpitStepGuideBannerProps {
  recordsCount: number;
  targetCount?: number;
  onProceedToAnalysis?: () => void;
  domainLabel: string;
}

export const CockpitStepGuideBanner: React.FC<CockpitStepGuideBannerProps> = ({
  recordsCount,
  targetCount = 3,
  onProceedToAnalysis,
  domainLabel,
}) => {
  const isReady = recordsCount >= targetCount;

  return (
    <div
      className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition-colors ${
        isReady
          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
          : 'bg-slate-900 border-slate-800 text-slate-200'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span
            className={
              isReady ? 'text-emerald-400 font-bold' : 'text-sky-400 font-semibold'
            }
          >
            {isReady ? '✓ TARGET DATA TERCAPAI' : `PANDUAN TAHAP 2 · ${domainLabel.toUpperCase()}`}
          </span>
          <span className="text-slate-600">·</span>
          <span className="tabular-nums text-slate-300 font-semibold">
            {recordsCount}/{targetCount} Data
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-snug mt-0.5">
          {isReady
            ? 'Data pengamatan sudah cukup! Klik tombol Lanjut untuk menganalisis kurva regresi & menjawab LKS.'
            : `Atur slider variabel di bawah, jalankan simulasi, lalu klik "+ Catat Data" minimal ${targetCount} kali.`}
        </p>
      </div>

      {onProceedToAnalysis && (
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            onProceedToAnalysis();
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer whitespace-nowrap ${
            isReady
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <span>{isReady ? 'Lanjut ke Grafik & LKS' : 'Grafik & LKS'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};


