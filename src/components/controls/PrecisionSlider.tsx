import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Minus, Plus, RotateCcw } from 'lucide-react';
import { SPRING_TACTILE } from '../../styles/motionPresets';
import { useLabStore } from '../../stores/useLabStore';
import { labSound } from '../../utils/soundEngine';

export interface CollaboratorParamLock {
  userName: string;
  userRole?: 'teacher' | 'student' | 'pengajar' | 'siswa' | string;
  colorHex?: string;
}

export interface PrecisionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  defaultValue?: number;
  onChange: (value: number) => void;
  accentColor?: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'indigo' | 'sky';
  disabled?: boolean;
  lockedBy?: CollaboratorParamLock | null;
  onFocusLock?: () => void;
  onBlurRelease?: () => void;
  precisionDecimals?: number;
  isHighlighted?: boolean;
}

const ACCENT_TRACK_MAP: Record<
  NonNullable<PrecisionSliderProps['accentColor']>,
  {
    fill: string;
    badge: string;
    ring: string;
    sliderAccent: string;
  }
> = {
  cyan: {
    fill: 'bg-cyan-500/80',
    badge: 'text-cyan-700 dark:text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    ring: 'focus-within:ring-cyan-500/40',
    sliderAccent: 'accent-cyan-500',
  },
  sky: {
    fill: 'bg-sky-500/80',
    badge: 'text-sky-700 dark:text-sky-300 border-sky-500/40 bg-sky-500/10',
    ring: 'focus-within:ring-sky-500/40',
    sliderAccent: 'accent-sky-500',
  },
  emerald: {
    fill: 'bg-emerald-500/80',
    badge: 'text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    ring: 'focus-within:ring-emerald-500/40',
    sliderAccent: 'accent-emerald-500',
  },
  amber: {
    fill: 'bg-amber-500/80',
    badge: 'text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10',
    ring: 'focus-within:ring-amber-500/40',
    sliderAccent: 'accent-amber-500',
  },
  violet: {
    fill: 'bg-violet-500/80',
    badge: 'text-violet-700 dark:text-violet-300 border-violet-500/40 bg-violet-500/10',
    ring: 'focus-within:ring-violet-500/40',
    sliderAccent: 'accent-violet-500',
  },
  rose: {
    fill: 'bg-rose-500/80',
    badge: 'text-rose-700 dark:text-rose-300 border-rose-500/40 bg-rose-500/10',
    ring: 'focus-within:ring-rose-500/40',
    sliderAccent: 'accent-rose-500',
  },
  indigo: {
    fill: 'bg-indigo-500/80',
    badge: 'text-indigo-700 dark:text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
    ring: 'focus-within:ring-indigo-500/40',
    sliderAccent: 'accent-indigo-500',
  },
};

export function clampAndSnapParameter(
  rawValue: number,
  min: number,
  max: number,
  step: number,
  decimals: number
): number {
  if (!Number.isFinite(rawValue)) return min;
  const clamped = Math.min(max, Math.max(min, rawValue));
  if (step <= 0) return Number(clamped.toFixed(decimals));
  const stepsFromMin = Math.round((clamped - min) / step);
  const snapped = min + stepsFromMin * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(decimals));
}

export const PrecisionSlider: React.FC<PrecisionSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  defaultValue,
  onChange,
  accentColor = 'cyan',
  disabled = false,
  lockedBy = null,
  onFocusLock,
  onBlurRelease,
  precisionDecimals,
  isHighlighted = false,
}) => {
  const decimals =
    precisionDecimals ??
    (step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0);

  const resolvedDefault = defaultValue ?? Number(((min + max) / 2).toFixed(decimals));
  const [draftText, setDraftText] = useState<string>(() => value.toFixed(decimals));
  const [isEditingText, setIsEditingText] = useState(false);

  const setActiveAdjustedParam = useLabStore((s) => s.setActiveAdjustedParam);
  const updateLiveParamSnapshot = useLabStore((s) => s.updateLiveParamSnapshot);

  useEffect(() => {
    if (!isEditingText) {
      setDraftText(value.toFixed(decimals));
    }
  }, [value, decimals, isEditingText]);

  useEffect(() => {
    updateLiveParamSnapshot(label, value, unit);
  }, [label, value, unit, updateLiveParamSnapshot]);

  const isLockedByCollaborator = Boolean(lockedBy);
  const isControlDisabled = disabled || isLockedByCollaborator;

  const span = Math.max(1e-9, max - min);
  const fillPercent = Math.min(100, Math.max(0, ((value - min) / span) * 100));
  const palette = ACCENT_TRACK_MAP[accentColor] ?? ACCENT_TRACK_MAP.cyan;

  const applyValue = (candidate: number) => {
    if (isControlDisabled) return;
    const next = clampAndSnapParameter(candidate, min, max, step, decimals);
    onChange(next);
    setActiveAdjustedParam({ label, value: next, unit });
  };

  const commitDraftText = () => {
    setIsEditingText(false);
    const parsed = Number(draftText.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraftText(value.toFixed(decimals));
      return;
    }
    applyValue(parsed);
  };

  const roleLabel =
    lockedBy?.userRole === 'teacher' || lockedBy?.userRole === 'pengajar'
      ? 'Guru'
      : 'Rekan';

  return (
    <div
      onMouseEnter={() => setActiveAdjustedParam({ label, value, unit })}
      onMouseLeave={() => setActiveAdjustedParam(null)}
      className={`rounded-xl border p-2.5 transition-all select-none ${
        isHighlighted
          ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50 shadow-sm'
          : isLockedByCollaborator
            ? 'border-amber-500/50 bg-amber-950/15 opacity-85'
            : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-slate-400 dark:hover:border-slate-600'
      } ${palette.ring}`}
    >
      {/* Top Row: Label + Lock Indicator + Value Badge + Reset */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-[var(--comfort-text)] truncate">
            {label}
          </span>
          {lockedBy && (
            <span
              data-testid="collaborator-lock-pill"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 shrink-0"
              title={`Parameter sedang diatur oleh ${lockedBy.userName} (${roleLabel})`}
            >
              <Lock className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate max-w-[96px]">
                {lockedBy.userName} · {roleLabel}
              </span>
            </span>
          )}
        </div>

        {/* Inline Editable Numeric Badge + Unit + Reset */}
        <div className="flex items-center gap-1 shrink-0">
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-xs font-bold tabular-nums ${palette.badge}`}
          >
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Input numerik ${label}`}
              disabled={isControlDisabled}
              value={isEditingText ? draftText : value.toFixed(decimals)}
              onFocus={(e) => {
                setIsEditingText(true);
                setDraftText(value.toFixed(decimals));
                e.currentTarget.select();
                onFocusLock?.();
                setActiveAdjustedParam({ label, value, unit });
              }}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={() => {
                commitDraftText();
                onBlurRelease?.();
                setActiveAdjustedParam(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setIsEditingText(false);
                  setDraftText(value.toFixed(decimals));
                  e.currentTarget.blur();
                }
              }}
              className="w-14 bg-transparent text-right focus:outline-none tabular-nums disabled:cursor-not-allowed"
            />
            {unit && (
              <span className="text-[10px] opacity-80 font-semibold select-none">
                {unit}
              </span>
            )}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            transition={SPRING_TACTILE}
            disabled={isControlDisabled || Math.abs(value - resolvedDefault) < 1e-6}
            onClick={() => {
              labSound.playClick();
              applyValue(resolvedDefault);
            }}
            aria-label={`Reset ${label} ke nilai bawaan`}
            title={`Reset ke bawaan (${resolvedDefault.toFixed(decimals)}${unit ? ` ${unit}` : ''})`}
            className="w-6 h-6 rounded-md border border-[var(--comfort-border)] bg-[var(--comfort-bg)] flex items-center justify-center text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </motion.button>
        </div>
      </div>

      {/* Bottom Row: Fine Step (-) + Animated Progress Track + Range Slider + Fine Step (+) */}
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          transition={SPRING_TACTILE}
          disabled={isControlDisabled || value <= min}
          onClick={() => {
            labSound.playClick();
            applyValue(value - step);
          }}
          aria-label={`Kurangi ${label}`}
          title={`Kurangi ${step}${unit ? ` ${unit}` : ''}`}
          className="w-7 h-7 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] flex items-center justify-center text-[var(--comfort-text)] hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <Minus className="w-3.5 h-3.5" />
        </motion.button>

        <div className="relative flex-1 flex items-center h-6">
          {/* Animated Track Background & Progress Fill */}
          <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-slate-300/80 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${palette.fill}`}
              animate={{ width: `${fillPercent}%` }}
              transition={SPRING_TACTILE}
            />
          </div>

          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            disabled={isControlDisabled}
            value={value}
            onFocus={() => {
              onFocusLock?.();
              setActiveAdjustedParam({ label, value, unit });
            }}
            onBlur={() => {
              onBlurRelease?.();
              setActiveAdjustedParam(null);
            }}
            onPointerDown={() => {
              onFocusLock?.();
              setActiveAdjustedParam({ label, value, unit });
            }}
            onPointerUp={() => {
              onBlurRelease?.();
            }}
            onChange={(e) => applyValue(Number(e.target.value))}
            className={`relative z-10 w-full h-2 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed ${palette.sliderAccent}`}
          />
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          transition={SPRING_TACTILE}
          disabled={isControlDisabled || value >= max}
          onClick={() => {
            labSound.playClick();
            applyValue(value + step);
          }}
          aria-label={`Tambah ${label}`}
          title={`Tambah ${step}${unit ? ` ${unit}` : ''}`}
          className="w-7 h-7 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-bg)] flex items-center justify-center text-[var(--comfort-text)] hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </div>
  );
};
