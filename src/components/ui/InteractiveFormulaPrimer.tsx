import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

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

const FORMULA_PRIMER_MODELS: Record<string, FormulaPrimerModel> = {
  'newton-incline': {
    moduleId: 'newton-incline',
    title: 'Intuisi Hukum II Newton',
    outcomeSymbol: 'a',
    outcomeLabel: 'Percepatan Balok',
    outcomeUnit: 'm/s²',
    variables: [
      {
        key: 'F',
        symbol: 'ΣF',
        label: 'Resultan Gaya Dorong',
        unit: 'N',
        min: 10,
        max: 100,
        step: 5,
        defaultValue: 40,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'appliedForce',
      },
      {
        key: 'm',
        symbol: 'm',
        label: 'Massa Beban',
        unit: 'kg',
        min: 1,
        max: 20,
        step: 1,
        defaultValue: 4,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'mass',
      },
    ],
    computeOutcome: (v) => Number((v.F / Math.max(0.5, v.m)).toFixed(2)),
    buildIntuitiveSentence: (activeVar, v, outcome) => {
      const fRatio = Number((v.F / 40).toFixed(1));
      const mRatio = Number((v.m / 4).toFixed(1));
      if (activeVar.key === 'F') {
        return `Jika resultan gaya ΣF diatur menjadi ${v.F} N (${fRatio}x nilai awal) pada massa ${v.m} kg, maka percepatan a berubah sebanding lurus menjadi ${outcome} m/s².`;
      }
      return `Jika massa beban m diperbesar menjadi ${v.m} kg (${mRatio}x lipat), inersia meningkat sehingga percepatan a melambat berbanding terbalik menjadi ${outcome} m/s².`;
    },
  },
  'pendulum-harmonic': {
    moduleId: 'pendulum-harmonic',
    title: 'Intuisi Bandul Matematis',
    outcomeSymbol: 'T',
    outcomeLabel: 'Periode Ayunan',
    outcomeUnit: 's',
    variables: [
      {
        key: 'L',
        symbol: 'L',
        label: 'Panjang Tali Bandul',
        unit: 'm',
        min: 0.5,
        max: 8.0,
        step: 0.5,
        defaultValue: 2.0,
        role: 'sqrt',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'pendulumLength',
      },
      {
        key: 'g',
        symbol: 'g',
        label: 'Gravitasi Planet',
        unit: 'm/s²',
        min: 1.6,
        max: 24.8,
        step: 0.2,
        defaultValue: 9.8,
        role: 'inverse',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'gravity',
      },
    ],
    computeOutcome: (v) => Number((2 * Math.PI * Math.sqrt(v.L / Math.max(0.5, v.g))).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) => {
      const lFactor = Number((v.L / 2.0).toFixed(1));
      const tFactor = Number(Math.sqrt(v.L / 2.0).toFixed(2));
      return `Jika panjang tali L diperbesar ${lFactor}x lipat (${v.L} m), maka periode ayunan T melambat ${tFactor}x lipat menjadi ${outcome} s karena T ∝ √L.`;
    },
  },
  'spring-hooke': {
    moduleId: 'spring-hooke',
    title: 'Intuisi Hukum Hooke & Elastisitas',
    outcomeSymbol: 'F',
    outcomeLabel: 'Gaya Pemulih Pegas',
    outcomeUnit: 'N',
    variables: [
      {
        key: 'k',
        symbol: 'k',
        label: 'Konstanta Pegas',
        unit: 'N/m',
        min: 10,
        max: 200,
        step: 10,
        defaultValue: 50,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'springConstant',
      },
      {
        key: 'dx',
        symbol: 'Δx',
        label: 'Simpangan Pegas',
        unit: 'm',
        min: 0.1,
        max: 2.0,
        step: 0.1,
        defaultValue: 0.5,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'springDisplacement',
      },
    ],
    computeOutcome: (v) => Number((v.k * v.dx).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Jika konstanta kekakuan k = ${v.k} N/m ditarik sejauh Δx = ${v.dx} m, gaya pemulih pegas meningkat linier menjadi ${outcome} N.`,
  },
  'thermo-calorimetry': {
    moduleId: 'thermo-calorimetry',
    title: 'Intuisi Kalorimetri & Termokimia',
    outcomeSymbol: 'q',
    outcomeLabel: 'Energi Kalor Reaksi',
    outcomeUnit: 'kJ',
    variables: [
      {
        key: 'M',
        symbol: '[M]',
        label: 'Konsentrasi Molar Reaktan',
        unit: 'mol/L',
        min: 0.2,
        max: 3.0,
        step: 0.2,
        defaultValue: 1.0,
        role: 'independent',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'reactantConcentration',
      },
      {
        key: 'dT',
        symbol: 'ΔT',
        label: 'Kenaikan Suhu Larutan',
        unit: '°C',
        min: 2,
        max: 45,
        step: 1,
        defaultValue: 15,
        role: 'independent',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'initialTempC',
      },
    ],
    computeOutcome: (v) => Number((v.M * v.dT * 1.045).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Jika konsentrasi [M] = ${v.M} mol/L menghasilkan perubahan suhu ΔT = ${v.dT} °C, maka kalor reaksi q yang dilepaskan setara dengan ${outcome} kJ.`,
  },
  'acid-base-titration': {
    moduleId: 'acid-base-titration',
    title: 'Intuisi Stoikiometri Titrasi',
    outcomeSymbol: 'V_eq',
    outcomeLabel: 'Volume Titik Ekuivalen',
    outcomeUnit: 'mL',
    variables: [
      {
        key: 'Ma',
        symbol: 'M_a',
        label: 'Molaritas Analit Asam',
        unit: 'M',
        min: 0.05,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.1,
        role: 'independent',
        colorClass: 'text-teal-600 dark:text-teal-400 border-teal-500/40 bg-teal-500/10',
        paramKey: 'reactantConcentration',
      },
      {
        key: 'Mb',
        symbol: 'M_b',
        label: 'Molaritas Titran Basa',
        unit: 'M',
        min: 0.05,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.1,
        role: 'inverse',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
      },
    ],
    computeOutcome: (v) => Number(((v.Ma * 25) / Math.max(0.05, v.Mb)).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Pada 25 mL asam bermolaritas Ma = ${v.Ma} M yang dititrasi basa Mb = ${v.Mb} M, titik ekuivalen netralisasi tercapai tepat pada Veq = ${outcome} mL.`,
  },
  'photosynthesis-ingenhousz': {
    moduleId: 'photosynthesis-ingenhousz',
    title: 'Intuisi Laju Fotosintesis Hills',
    outcomeSymbol: 'R_O2',
    outcomeLabel: 'Laju Gelembung O₂',
    outcomeUnit: '/mnt',
    variables: [
      {
        key: 'I',
        symbol: 'I_lux',
        label: 'Intensitas Cahaya',
        unit: 'lux',
        min: 200,
        max: 5000,
        step: 200,
        defaultValue: 1600,
        role: 'independent',
        colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        paramKey: 'lightIntensityLux',
      },
      {
        key: 'CO2',
        symbol: '[CO₂]',
        label: 'Kadar Bikarbonat',
        unit: '%',
        min: 0.1,
        max: 2.0,
        step: 0.1,
        defaultValue: 0.5,
        role: 'independent',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'co2ConcentrationPct',
      },
    ],
    computeOutcome: (v) => Number(((v.I / (v.I + 800)) * (v.CO2 / (v.CO2 + 0.25)) * 72).toFixed(1)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Saat intensitas foton I = ${v.I} lux dan [CO₂] = ${v.CO2}%, kloroplas memproduksi ${outcome} gelembung O₂/menit sebelum mencapai titik saturasi enzim Rubisco.`,
  },
  'solar-kepler': {
    moduleId: 'solar-kepler',
    title: 'Intuisi Hukum III Kepler',
    outcomeSymbol: 'T',
    outcomeLabel: 'Periode Orbit Planet',
    outcomeUnit: 'thn',
    variables: [
      {
        key: 'a',
        symbol: 'a',
        label: 'Sumbu Semi-Mayor Orbit',
        unit: 'AU',
        min: 0.4,
        max: 10.0,
        step: 0.2,
        defaultValue: 1.0,
        role: 'quadratic',
        colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
        paramKey: 'customSemiMajorAxisAu',
      },
      {
        key: 'Mstar',
        symbol: 'M_*',
        label: 'Massa Bintang Induk',
        unit: 'M☉',
        min: 0.5,
        max: 4.0,
        step: 0.1,
        defaultValue: 1.0,
        role: 'inverse',
        colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
        paramKey: 'centralStarMassSolar',
      },
    ],
    computeOutcome: (v) => Number(Math.sqrt(Math.pow(v.a, 3) / Math.max(0.2, v.Mstar)).toFixed(2)),
    buildIntuitiveSentence: (_activeVar, v, outcome) =>
      `Jika jarak orbit a = ${v.a} AU mengelilingi bintang bermassa ${v.Mstar} M☉, maka periode revolusi T memerlukan waktu ${outcome} tahun Bumi karena T² ∝ a³/M*.`,
  },
};

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
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            · Eksplorasi Variabel Interaktif
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            title="Reset variabel rumus ke nilai awal"
            className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? 'Sembunyikan Primer Rumus' : 'Tampilkan Primer Rumus'}
            className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
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

              <span className="font-mono text-sm font-bold text-slate-400">∝</span>

              {/* Interactive Variable Badges */}
              {model.variables.map((v, idx) => {
                const curVal = currentValues[v.key];
                const vScale = computeVariableVisualScale(curVal, v.min, v.max);
                const isSelected = activeVar.key === v.key;
                return (
                  <React.Fragment key={v.key}>
                    {idx > 0 && (
                      <span className="font-mono text-xs font-bold text-slate-400">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Geser {activeVar.label} ({activeVar.symbol}):
                  </span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                    {currentValues[activeVar.key]} {activeVar.unit}
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="primer-variable-slider"
                  aria-label={`Geser variabel ${activeVar.label}`}
                  min={activeVar.min}
                  max={activeVar.max}
                  step={activeVar.step}
                  value={currentValues[activeVar.key]}
                  onChange={(e) => handleValueChange(activeVar, Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none bg-stone-200 dark:bg-slate-800 accent-sky-600 cursor-pointer"
                />
              </div>
            )}

            {/* 1-Sentence Live Mathematical Intuition Callout */}
            <p
              data-testid="primer-intuition-sentence"
              className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-stone-100/80 dark:bg-slate-900/70 rounded-lg px-3 py-2 border border-[var(--comfort-border)]"
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
