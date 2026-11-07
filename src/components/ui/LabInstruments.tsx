import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Minus, Plus, Lock, AlertTriangle } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

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
          <span className="font-mono text-[10px] uppercase text-slate-400 leading-none mt-0.5">
            {unit}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300 text-center leading-tight line-clamp-1">
        {isWarning && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
        <span className="truncate max-w-[110px]">{label}</span>
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
          {label}
        </span>
        <div className="my-1 flex items-baseline gap-1">
          <span
            className="text-base font-mono font-bold tabular-nums text-white"
            style={{ color: variant === 'ph' ? liquidColor : undefined }}
          >
            {safeVal.toFixed(variant === 'ph' ? 2 : 1)}
          </span>
          <span className="text-[10px] font-mono text-slate-400">{unit}</span>
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

  useEffect(() => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    if (Math.abs(value - displayVal) > 1e-4) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 260);

      let frameId: number;
      const startVal = displayVal;
      const diff = value - startVal;
      const startTime = performance.now();
      const duration = 180;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayVal(startVal + diff * eased);
        if (t < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          setDisplayVal(value);
        }
      };

      frameId = requestAnimationFrame(step);
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(frameId);
      };
    }
  }, [value, displayVal]);

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
              {symbol}
            </motion.span>
          )}
          <label
            htmlFor={id}
            className="font-semibold text-slate-800 dark:text-slate-100 truncate cursor-pointer"
          >
            {label}
          </label>
          {badgeText && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              · {badgeText}
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
                {safeVal.toFixed(decimals)} {unit}
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
