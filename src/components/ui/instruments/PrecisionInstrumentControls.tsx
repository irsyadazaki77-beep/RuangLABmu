import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Minus, Plus, Lock, RotateCcw, ChevronDown, Info } from 'lucide-react';
import { labSound } from '../../../utils/soundEngine';
import { SciFormula } from '../ScientificNotation';
import {
  normalizeEducationLevel,
  type EducationLevel,
} from '../../../utils/pedagogicalHelpers';
import { useLabStore } from '../../../stores/useLabStore';
import { ScienceGlossaryTerm } from '../ScienceGlossaryTerm';

export interface TactileParameterControlProps {
  id?: string;
  label: string;
  symbol?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue?: number;
  onChange: (v: number) => void;
  onHoverChange?: (isHovered: boolean) => void;
  lockedBy?: string;
  lockedByRole?: 'Siswa' | 'Pengajar' | 'teacher' | 'student';
  badgeText?: string;
  precision?: number;
  accentColor?: string;
  onFocusLock?: () => void;
  onBlurLock?: () => void;
  dynamicFeedback?: (value: number, level: EducationLevel) => string;
  educationLevel?: EducationLevel;
  glossaryTerm?: string;
  paramKey?: string;
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
  defaultValue,
  onChange,
  onHoverChange,
  lockedBy,
  lockedByRole,
  badgeText,
  precision,
  onFocusLock,
  onBlurLock,
  dynamicFeedback,
  educationLevel,
  glossaryTerm,
  paramKey,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const initialDefaultRef = useRef<number>(
    defaultValue ?? (Number.isFinite(value) ? value : min)
  );
  const storeAcademicLevel = useLabStore((s) => s.academicLevel);
  const highlightedParamKey = useLabStore((s) => s.highlightedParamKey);
  const setActiveAdjustedParam = useLabStore((s) => s.setActiveAdjustedParam);
  const updateLiveParamSnapshot = useLabStore((s) => s.updateLiveParamSnapshot);
  const removeLiveParamSnapshot = useLabStore((s) => s.removeLiveParamSnapshot);
  const isHighlighted = Boolean(paramKey && highlightedParamKey === paramKey);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isHighlighted]);

  const effectiveLevel: EducationLevel = normalizeEducationLevel(
    educationLevel ?? storeAcademicLevel
  );
  const safeVal = Number.isFinite(value) ? value : min;
  const resolvedDefault = defaultValue ?? initialDefaultRef.current;
  const displayVarKey = symbol ? `${symbol} (${label})` : label;

  useEffect(() => {
    updateLiveParamSnapshot(displayVarKey, safeVal, unit);
    return () => {
      removeLiveParamSnapshot(displayVarKey);
    };
  }, [displayVarKey, safeVal, unit, updateLiveParamSnapshot, removeLiveParamSnapshot]);

  const feedbackText = dynamicFeedback ? dynamicFeedback(safeVal, effectiveLevel) : '';
  const fillPct = Math.min(
    100,
    Math.max(0, ((safeVal - min) / Math.max(1e-6, max - min)) * 100)
  );
  const isLocked = Boolean(lockedBy);
  const resolvedLockRole =
    lockedByRole === 'Pengajar' ||
    lockedByRole === 'teacher' ||
    (lockedBy && /dr\.|guru|pengajar/i.test(lockedBy))
      ? 'Pengajar'
      : 'Siswa';

  const decimals =
    precision !== undefined
      ? precision
      : step < 0.01
      ? 3
      : step < 0.1
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
    setActiveAdjustedParam({ label: displayVarKey, value: clamped, unit });
  };

  const handleResetDefault = () => {
    if (isLocked) return;
    labSound.playClick();
    const clamped = Math.min(max, Math.max(min, Number(resolvedDefault.toFixed(decimals + 1))));
    onChange(clamped);
    setActiveAdjustedParam({ label: displayVarKey, value: clamped, unit });
  };

  const handleNumericInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const raw = e.target.value;
    if (raw === '' || raw === '-') return;
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, Number(parsed.toFixed(decimals + 1))));
      onChange(clamped);
      setActiveAdjustedParam({ label: displayVarKey, value: clamped, unit });
    }
  };

  return (
    <motion.div
      ref={cardRef}
      data-param-key={paramKey}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(true);
        setActiveAdjustedParam({ label: displayVarKey, value: safeVal, unit });
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(false);
        setActiveAdjustedParam(null);
      }}
      animate={{
        borderColor: isHighlighted
          ? 'rgba(251, 191, 36, 0.95)'
          : isHovered
          ? 'rgba(14, 165, 233, 0.55)'
          : 'var(--comfort-border)',
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
      className={`p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border space-y-2 transition-all ${
        isHighlighted
          ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
          : 'border-[var(--comfort-border)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {symbol && (
            <motion.span
              animate={{
                scale: isHovered ? 1.06 : 1,
                boxShadow: isHovered
                  ? '0 0 10px rgba(14, 165, 233, 0.35)'
                  : '0 0 0px rgba(0,0,0,0)',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
              className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-sky-500/12 text-sky-700 dark:text-sky-300 border border-sky-500/25 shrink-0"
            >
              <SciFormula text={symbol} serifVars />
            </motion.span>
          )}
          <label
            htmlFor={id}
            className="font-semibold text-[var(--comfort-text)] truncate cursor-pointer"
          >
            <SciFormula text={label} />
          </label>
          {glossaryTerm && (
            <ScienceGlossaryTerm
              term={glossaryTerm}
              displayLabel="?"
              className="px-1.5 py-0 rounded bg-sky-500/10 text-[10px] font-mono text-sky-700 dark:text-sky-300 border-b border-dotted border-sky-500/70 shrink-0"
            />
          )}
          {badgeText && (
            <span className="text-[10px] font-mono text-[var(--comfort-text-muted)]">
              · <SciFormula text={badgeText} />
            </span>
          )}
          {isHighlighted && (
            <span
              data-testid="dr-labmu-slider-highlight-badge"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/50 shrink-0"
            >
              Fokus Dr. LabMu
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
              transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-0.5"
              title={`Parameter sedang dikendalikan oleh ${lockedBy} (${resolvedLockRole})`}
            >
              <Lock className="w-3 h-3" />
              <span>Diatur {lockedBy}</span>
              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-500/20 font-bold">
                {resolvedLockRole}
              </span>
            </motion.span>
          ) : (
            <motion.div key="controls" className="flex items-center gap-1 shrink-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                disabled={isLocked || safeVal <= min}
                aria-label={`Kurangi ${label}`}
                onClick={() => handleStep(-1)}
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] hover:border-sky-500 text-[var(--comfort-text)] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </motion.button>

              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] focus-within:border-sky-500">
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  disabled={isLocked}
                  value={Number(safeVal.toFixed(decimals))}
                  onFocus={() => {
                    onFocusLock?.();
                    setActiveAdjustedParam({ label: displayVarKey, value: safeVal, unit });
                  }}
                  onBlur={() => {
                    onBlurLock?.();
                    setActiveAdjustedParam(null);
                  }}
                  onChange={handleNumericInputChange}
                  aria-label={`Input numerik ${label}`}
                  className="w-14 bg-transparent font-mono font-bold text-xs text-[var(--comfort-text)] tabular-nums text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="font-mono text-[10px] text-[var(--comfort-text-muted)]">
                  <SciFormula text={unit} />
                </span>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                disabled={isLocked || safeVal >= max}
                aria-label={`Tambah ${label}`}
                onClick={() => handleStep(1)}
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] hover:border-sky-500 text-[var(--comfort-text)] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                disabled={isLocked || Math.abs(safeVal - resolvedDefault) < 1e-6}
                aria-label={`Reset ${label} ke nilai bawaan`}
                title={`Reset ke bawaan (${resolvedDefault.toFixed(decimals)}${unit ? ` ${unit}` : ''})`}
                onClick={handleResetDefault}
                className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] hover:border-sky-500 text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] disabled:opacity-35 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Fill Bar + Native Range Input */}
      <div className="relative flex items-center h-6">
        <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-[var(--comfort-surface)] overflow-hidden border border-[var(--comfort-border)]">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
            initial={false}
            animate={{ width: `${fillPct}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
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
          className="relative z-10 w-full h-6 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <motion.div
          className="pointer-events-none absolute w-4 h-4 rounded-full bg-[var(--comfort-elevated)] border-2 border-sky-600 dark:border-sky-400 shadow-sm"
          initial={false}
          animate={{
            left: `calc(${fillPct}% - 8px)`,
            scale: isHovered ? 1.18 : 1,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />
      </div>

      {feedbackText && (
        <p
          data-testid={id ? `${id}-feedback` : 'parameter-micro-insight'}
          className="text-[11px] leading-snug font-medium text-sky-700 dark:text-sky-300 flex items-start gap-1.5 pt-0.5"
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <span>{feedbackText}</span>
        </p>
      )}
    </motion.div>
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
  accentColor = '#0284c7',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer min-h-[44px]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-xs font-bold text-[var(--comfort-text)] truncate">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-[11px] text-[var(--comfort-text-muted)] truncate mt-0.5 pl-3.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusText && (
            <span className="text-[10px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
              {statusText}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--comfort-text-muted)] transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-[var(--comfort-border)]">
          {children}
        </div>
      )}
    </div>
  );
};
