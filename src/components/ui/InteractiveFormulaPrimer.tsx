import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';
import { PrecisionSlider } from '../controls/PrecisionSlider';

export interface FormulaVariableToken {
  key: string;
  symbol: string;
  sub?: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  role: 'independent' | 'inverse' | 'sqrt' | 'quadratic';
  colorClass: string;
  paramKey?: string;
}

export interface FormulaPrimerModel {
  moduleId: string;
  title: string;
  outcomeSymbol: string;
  outcomeLabel: string;
  outcomeUnit: string;
  lhsOperator?: string;
  variables: FormulaVariableToken[];
  computeOutcome: (vals: Record<string, number>) => number;
  buildIntuitiveSentence: (activeVar: FormulaVariableToken, vals: Record<string, number>, outcome: number) => string;
}

/**
 * Computes proportional visual badge scale factor (between 0.82 and 1.38)
 * based on a variable's current value within [min, max].
 */
export function computeVariableVisualScale(value: number, min: number, max: number): number {
  if (max <= min || !Number.isFinite(value)) return 1.0;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  return Number((0.82 + ratio * 0.56).toFixed(3));
}

import { FORMULA_PRIMER_MODELS } from '../../registry/pedagogy/formulaPrimerModels';

export function getFormulaPrimerModel(moduleId: string, domain?: string): FormulaPrimerModel {
  if (FORMULA_PRIMER_MODELS[moduleId]) {
    return FORMULA_PRIMER_MODELS[moduleId];
  }
  const d = (domain || '').toLowerCase();
  if (d.includes('kimia') || d.includes('chemistry')) {
    return FORMULA_PRIMER_MODELS['thermo-calorimetry'];
  }
  if (d.includes('biologi') || d.includes('biology')) {
    return FORMULA_PRIMER_MODELS['photosynthesis-ingenhousz'];
  }
  if (d.includes('astronomi') || d.includes('astronomy')) {
    return FORMULA_PRIMER_MODELS['solar-kepler'];
  }
  return FORMULA_PRIMER_MODELS['newton-incline'];
}

export interface InteractiveFormulaPrimerProps {
  moduleId: string;
  domain?: string;
  onSyncParameterToScene?: (paramKey: string, value: number) => void;
  defaultExpanded?: boolean;
}

export const InteractiveFormulaPrimer: React.FC<InteractiveFormulaPrimerProps> = ({
  moduleId,
  domain,
  onSyncParameterToScene,
  defaultExpanded = true,
}) => {
  const model = useMemo(() => getFormulaPrimerModel(moduleId, domain), [moduleId, domain]);

  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    model.variables.forEach((v) => {
      init[v.key] = v.defaultValue;
    });
    return init;
  });

  const [selectedVarKey, setSelectedVarKey] = useState<string>(model.variables[0]?.key || '');
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  // Sync defaults when module changes
  React.useEffect(() => {
    const next: Record<string, number> = {};
    model.variables.forEach((v) => {
      next[v.key] = v.defaultValue;
    });
    setValues(next);
    setSelectedVarKey(model.variables[0]?.key || '');
  }, [model]);

  const activeVar =
    model.variables.find((v) => v.key === selectedVarKey) || model.variables[0];

  const currentValues = useMemo(() => {
    const merged: Record<string, number> = {};
    model.variables.forEach((v) => {
      merged[v.key] = values[v.key] ?? v.defaultValue;
    });
    return merged;
  }, [model, values]);

  const outcomeValue = useMemo(
    () => model.computeOutcome(currentValues),
    [model, currentValues]
  );

  const baselineOutcome = useMemo(() => {
    const base: Record<string, number> = {};
    model.variables.forEach((v) => {
      base[v.key] = v.defaultValue;
    });
    return Math.max(0.01, model.computeOutcome(base));
  }, [model]);

  const outcomeScale = useMemo(() => {
    const ratio = outcomeValue / baselineOutcome;
    return Math.max(0.78, Math.min(1.42, Number((0.85 + Math.log2(Math.max(0.25, ratio)) * 0.2).toFixed(3))));
  }, [outcomeValue, baselineOutcome]);

  const intuitiveSentence = useMemo(
    () => model.buildIntuitiveSentence(activeVar, currentValues, outcomeValue),
    [model, activeVar, currentValues, outcomeValue]
  );

  const handleValueChange = (variable: FormulaVariableToken, nextVal: number) => {
    setValues((prev) => ({ ...prev, [variable.key]: nextVal }));
    if (variable.paramKey && onSyncParameterToScene) {
      onSyncParameterToScene(variable.paramKey, nextVal);
    }
  };

  const handleReset = () => {
    labSound.playClick();
    const resetMap: Record<string, number> = {};
    model.variables.forEach((v) => {
      resetMap[v.key] = v.defaultValue;
      if (v.paramKey && onSyncParameterToScene) {
        onSyncParameterToScene(v.paramKey, v.defaultValue);
      }
    });
    setValues(resetMap);
  };

  return (
    <div
      data-testid="interactive-formula-primer"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs overflow-hidden transition-colors"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-[var(--comfort-border)]">
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setIsExpanded((prev) => !prev);
          }}
          className="flex items-center gap-2 text-left cursor-pointer min-w-0 flex-1"
        >
          <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="text-xs font-bold tracking-tight truncate">{model.title}</span>
          <span className="text-[11px] text-[var(--comfort-text-muted)] hidden sm:inline">
            · Eksplorasi Variabel Interaktif
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            title="Reset variabel rumus ke nilai awal"
            className="p-1.5 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? 'Sembunyikan Primer Rumus' : 'Tampilkan Primer Rumus'}
            className="p-1.5 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="p-3.5 space-y-3"
          >
            {/* Dynamic Proportionally Scaled Equation Stage */}
            <div className="rounded-xl bg-[var(--comfort-bg)] border border-[var(--comfort-border)] px-3 py-3 flex flex-wrap items-center justify-center gap-2 min-h-[64px]">
              {/* Outcome Badge */}
              <motion.div
                animate={{ scale: outcomeScale }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                data-testid="primer-outcome-badge"
                className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5 tabular-nums"
              >
                <span>{model.outcomeSymbol}</span>
                <span className="opacity-60">=</span>
                <span>
                  {outcomeValue} {model.outcomeUnit}
                </span>
              </motion.div>

              <span className="font-mono text-sm font-bold text-[var(--comfort-text-muted)]">∝</span>

              {/* Interactive Variable Badges */}
              {model.variables.map((v, idx) => {
                const curVal = currentValues[v.key];
                const vScale = computeVariableVisualScale(curVal, v.min, v.max);
                const isSelected = activeVar.key === v.key;
                return (
                  <React.Fragment key={v.key}>
                    {idx > 0 && (
                      <span className="font-mono text-xs font-bold text-[var(--comfort-text-muted)]">
                        {v.role === 'inverse' ? '÷' : '·'}
                      </span>
                    )}
                    <motion.button
                      type="button"
                      animate={{ scale: vScale }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                      onClick={() => {
                        labSound.playClick(640);
                        setSelectedVarKey(v.key);
                      }}
                      data-testid={`primer-var-badge-${v.key}`}
                      className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-bold cursor-pointer transition-shadow tabular-nums ${
                        v.colorClass
                      } ${isSelected ? 'ring-2 ring-sky-500/60 shadow-xs' : 'opacity-85 hover:opacity-100'}`}
                    >
                      <span>{v.symbol}</span>
                      <span className="ml-1 opacity-85">
                        ({curVal}
                        {v.unit ? ` ${v.unit}` : ''})
                      </span>
                    </motion.button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Active Variable Scrubber */}
            {activeVar && (
              <PrecisionSlider
                compact
                syncToLiveFormula={false}
                accentColor="sky"
                testId="primer-variable-slider"
                label={`${activeVar.label} (${activeVar.symbol})`}
                min={activeVar.min}
                max={activeVar.max}
                step={activeVar.step}
                unit={activeVar.unit}
                defaultValue={activeVar.defaultValue}
                value={currentValues[activeVar.key]}
                onChange={(nextVal) => handleValueChange(activeVar, nextVal)}
              />
            )}

            {/* 1-Sentence Live Mathematical Intuition Callout */}
            <p
              data-testid="primer-intuition-sentence"
              className="text-xs leading-relaxed text-[var(--comfort-text)] bg-[var(--comfort-surface-subtle)] rounded-lg px-3 py-2 border border-[var(--comfort-border)]"
            >
              {intuitiveSentence}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveFormulaPrimer;
