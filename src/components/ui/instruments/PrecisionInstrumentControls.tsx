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
import { useUIStore } from '../../../stores/useUIStore';
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
  const [isInteracting, setIsInteracting] = useState(false);
  const [hintPinned, setHintPinned] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const initialDefaultRef = useRef<number>(
    defaultValue ?? (Number.isFinite(value) ? value : min)
  );
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestValRef = useRef<number>(Number.isFinite(value) ? value : min);
  const storeAcademicLevel = useLabStore((s) => s.academicLevel);
  const highlightedParamKey = useLabStore((s) => s.highlightedParamKey);
  const setActiveAdjustedParam = useLabStore((s) => s.setActiveAdjustedParam);
  const updateLiveParamSnapshot = useLabStore((s) => s.updateLiveParamSnapshot);
  const removeLiveParamSnapshot = useLabStore((s) => s.removeLiveParamSnapshot);
  const compactSliderMode = useUIStore((s) => s.compactSliderMode);
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
  latestValRef.current = safeVal;
  const resolvedDefault = defaultValue ?? initialDefaultRef.current;
  const displayVarKey = symbol ? `${symbol} (${label})` : label;

  const stopHoldRepeat = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopHoldRepeat();
  }, []);

  useEffect(() => {
    updateLiveParamSnapshot(displayVarKey, safeVal, unit);
    return () => {
      removeLiveParamSnapshot(displayVarKey);
    };
  }, [displayVarKey, safeVal, unit, updateLiveParamSnapshot, removeLiveParamSnapshot]);

  const feedbackText = dynamicFeedback ? dynamicFeedback(safeVal, effectiveLevel) : '';
  const spanRange = Math.max(1e-6, max - min);
  const fillPct = Math.min(100, Math.max(0, ((safeVal - min) / spanRange) * 100));
  const defaultPct = Math.min(100, Math.max(0, ((resolvedDefault - min) / spanRange) * 100));
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

  const deltaFromDefault = safeVal - resolvedDefault;
  const hasDelta = Math.abs(deltaFromDefault) >= Math.max(step * 0.1, 1e-6);

  const applyStepDelta = (dir: -1 | 1, fine = false) => {
    if (isLocked) return;
    const effectiveStep = fine ? step / 5 : step;
    const precisionDigits = fine ? Math.min(4, decimals + 2) : decimals + 1;
    const nextRaw = latestValRef.current + dir * effectiveStep;
    const clamped = Math.min(max, Math.max(min, Number(nextRaw.toFixed(precisionDigits))));
    if (Math.abs(clamped - latestValRef.current) < 1e-9) return;
    latestValRef.current = clamped;
    labSound.playStep(dir > 0 ? 'up' : 'down');
    onChange(clamped);
    setActiveAdjustedParam({ label: displayVarKey, value: clamped, unit });
  };

  const handleStepPointerDown = (dir: -1 | 1, e: React.PointerEvent<HTMLButtonElement>) => {
    if (isLocked) return;
    const fine = e.shiftKey;
    stopHoldRepeat();
    setIsInteracting(true);
    onFocusLock?.();
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        applyStepDelta(dir, fine);
      }, 85);
    }, 360);
  };

  const handleStepPointerUp = () => {
    stopHoldRepeat();
    setIsInteracting(false);
    onBlurLock?.();
  };

  const handleRangeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLocked || !e.shiftKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      applyStepDelta(1, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      applyStepDelta(-1, true);
    }
  };

  const handleResetDefault = () => {
    if (isLocked) return;
    labSound.playClick();
    const clamped = Math.min(max, Math.max(min, Number(resolvedDefault.toFixed(decimals + 1))));
    latestValRef.current = clamped;
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
      latestValRef.current = clamped;
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
          ? 'var(--comfort-warning)'
          : isInteracting || isHovered
          ? 'var(--comfort-accent-border)'
          : 'var(--comfort-border)',
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
      className={`${
        compactSliderMode ? 'p-2 space-y-1' : 'p-3 space-y-2'
      } rounded-xl bg-[var(--comfort-surface-subtle)] border transition-colors ${
        isHighlighted
          ? 'ring-2 ring-[var(--comfort-warning)] shadow-sm'
          : 'border-[var(--comfort-border)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          {symbol && (
            <motion.span
              animate={{
                scale: isHovered || isInteracting ? 1.04 : 1,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
              className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono font-bold text-xs comfort-accent-soft border shrink-0"
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
              className="px-1.5 py-0 rounded bg-[var(--comfort-accent-soft)] text-2xs font-mono text-[var(--comfort-accent)] border-b border-dotted border-[var(--comfort-accent)] shrink-0"
            />
          )}
          {badgeText && (
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
              · <SciFormula text={badgeText} />
            </span>
          )}
          {hasDelta && !isLocked && (
            <span
              data-testid={id ? `${id}-delta` : undefined}
              className="text-2xs font-mono font-semibold text-[var(--comfort-accent)] tabular-nums shrink-0"
              title={`Selisih dari nilai awal (${resolvedDefault.toFixed(decimals)})`}
            >
              Δ{deltaFromDefault > 0 ? '+' : ''}
              {deltaFromDefault.toFixed(decimals)}
            </span>
          )}
          {feedbackText && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setHintPinned((prev) => !prev);
              }}
              aria-expanded={hintPinned || isInteracting || isHighlighted}
              aria-label={`Catatan fisis untuk ${label}`}
              title={hintPinned ? 'Sembunyikan catatan fisis' : 'Lihat catatan fisis'}
              className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                hintPinned || isInteracting || isHighlighted
                  ? 'text-[var(--comfort-accent)] bg-[var(--comfort-accent-soft)]'
                  : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)]'
              }`}
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {isHighlighted && (
            <span
              data-testid="dr-labmu-slider-highlight-badge"
              className="text-2xs font-bold px-1.5 py-0.5 rounded bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)] border border-[var(--comfort-warning-border)] shrink-0"
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
              className="inline-flex items-center gap-1 text-2xs font-mono text-[var(--comfort-warning)] bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] rounded px-2 py-0.5"
              title={`Parameter sedang dikendalikan oleh ${lockedBy} (${resolvedLockRole})`}
            >
              <Lock className="w-3 h-3" />
              <span>Diatur {lockedBy}</span>
              <span className="text-2xs uppercase font-bold opacity-85">
                · {resolvedLockRole}
              </span>
            </motion.span>
          ) : (
            <motion.div key="controls" className="flex items-center gap-1 shrink-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                disabled={isLocked || safeVal <= min}
                aria-label={`Kurangi ${label}`}
                title="Klik atau tahan untuk mengurangi (Shift+Klik untuk langkah halus)"
                onClick={(e) => applyStepDelta(-1, e.shiftKey)}
                onPointerDown={(e) => handleStepPointerDown(-1, e)}
                onPointerUp={handleStepPointerUp}
                onPointerLeave={handleStepPointerUp}
                onPointerCancel={handleStepPointerUp}
                className="min-w-[40px] min-h-[40px] lg:min-w-[34px] lg:min-h-[34px] flex items-center justify-center rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] text-[var(--comfort-text)] disabled:opacity-40 transition-colors cursor-pointer select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
              >
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              </motion.button>

              <div className="inline-flex items-center gap-1 px-2 min-h-[40px] lg:min-h-[34px] rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] focus-within:border-[var(--comfort-accent)] focus-within:ring-1 focus-within:ring-[var(--comfort-accent)]/30">
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  disabled={isLocked}
                  value={Number(safeVal.toFixed(decimals))}
                  onFocus={() => {
                    setIsInteracting(true);
                    onFocusLock?.();
                    setActiveAdjustedParam({ label: displayVarKey, value: safeVal, unit });
                  }}
                  onBlur={() => {
                    setIsInteracting(false);
                    onBlurLock?.();
                    setActiveAdjustedParam(null);
                  }}
                  onKeyDown={handleRangeKeyDown}
                  onChange={handleNumericInputChange}
                  aria-label={`Input numerik ${label}`}
                  className="w-14 bg-transparent font-mono font-bold text-xs text-[var(--comfort-text)] tabular-nums text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="font-mono text-2xs text-[var(--comfort-text-muted)]">
                  <SciFormula text={unit} />
                </span>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                disabled={isLocked || safeVal >= max}
                aria-label={`Tambah ${label}`}
                title="Klik atau tahan untuk menambah (Shift+Klik untuk langkah halus)"
                onClick={(e) => applyStepDelta(1, e.shiftKey)}
                onPointerDown={(e) => handleStepPointerDown(1, e)}
                onPointerUp={handleStepPointerUp}
                onPointerLeave={handleStepPointerUp}
                onPointerCancel={handleStepPointerUp}
                className="min-w-[40px] min-h-[40px] lg:min-w-[34px] lg:min-h-[34px] flex items-center justify-center rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] text-[var(--comfort-text)] disabled:opacity-40 transition-colors cursor-pointer select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                disabled={isLocked || !hasDelta}
                aria-label={`Reset ${label} ke nilai bawaan`}
                title={`Reset ke bawaan (${resolvedDefault.toFixed(decimals)}${unit ? ` ${unit}` : ''})`}
                onClick={handleResetDefault}
                className="min-w-[40px] min-h-[40px] lg:min-w-[34px] lg:min-h-[34px] flex items-center justify-center rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] disabled:opacity-35 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Fill Bar + Default Marker + Native Range Input + Scale Ticks */}
      <div className="space-y-1">
        <div className="relative flex items-center h-7">
          <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-[var(--comfort-surface)] overflow-hidden border border-[var(--comfort-border)]">
            <motion.div
              className="h-full bg-[var(--comfort-accent-solid)] rounded-full"
              initial={false}
              animate={{ width: `${fillPct}%` }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            />
          </div>
          {/* Default value reference notch */}
          <span
            aria-hidden="true"
            style={{ left: `calc(${defaultPct}% - 1px)` }}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-full bg-[var(--comfort-text-muted)]/45"
          />
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={safeVal}
            disabled={isLocked}
            onPointerDown={() => {
              setIsInteracting(true);
              onHoverChange?.(true);
              onFocusLock?.();
            }}
            onFocus={() => {
              setIsInteracting(true);
              onHoverChange?.(true);
              onFocusLock?.();
            }}
            onPointerUp={() => {
              setIsInteracting(false);
              onHoverChange?.(false);
              onBlurLock?.();
            }}
            onBlur={() => {
              setIsInteracting(false);
              onHoverChange?.(false);
              onBlurLock?.();
            }}
            onKeyDown={handleRangeKeyDown}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              latestValRef.current = parsed;
              onChange(parsed);
            }}
            className="relative z-10 w-full h-7 opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <motion.div
            className="pointer-events-none absolute w-4 h-4 rounded-full bg-[var(--comfort-elevated)] border-2 border-[var(--comfort-accent)] shadow-sm"
            initial={false}
            animate={{
              left: `calc(${fillPct}% - 8px)`,
              scale: isInteracting ? 1.2 : isHovered ? 1.12 : 1,
            }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          />
        </div>

        {/* Scale Ticks & Min/Max Boundary Readout */}
        {!compactSliderMode && (
          <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums px-0.5 select-none">
            <span>{min.toFixed(decimals)}</span>
            <div className="flex items-center gap-5 opacity-45" aria-hidden="true">
              <span className="w-px h-1.5 bg-current" />
              <span className="w-px h-2 bg-current" />
              <span className="w-px h-1.5 bg-current" />
            </div>
            <span>{max.toFixed(decimals)}</span>
          </div>
        )}
      </div>

      {feedbackText && (hintPinned || isInteracting || isHighlighted) && (
        <p
          data-testid={id ? `${id}-feedback` : 'parameter-micro-insight'}
          className="text-2xs leading-snug font-medium text-[var(--comfort-accent)] flex items-start gap-1.5 pt-1 border-t border-[var(--comfort-border)]"
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--comfort-accent)]" aria-hidden="true" />
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
  accentColor = 'var(--comfort-accent)',
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
            <p className="text-2xs text-[var(--comfort-text-muted)] truncate mt-0.5 pl-3.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusText && (
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
              {statusText}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--comfort-text-muted)] transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-[var(--comfort-accent)]' : ''
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
