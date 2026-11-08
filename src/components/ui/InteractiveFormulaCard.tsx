import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calculator,
  Sparkles,
  BookOpen,
  SlidersHorizontal,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export interface FormulaToken {
  symbol: string;       // e.g., "F", "=", "m", "·", "g", "·", "sin(θ)"
  paramKey?: string;    // Links token to a slider/output key (e.g., "mass", "gravity", "angle")
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  color?: string;
  precision?: number;
  description?: string; // Physical meaning of the symbol
}

export interface InteractiveFormulaCardProps {
  title: string;
  subtitle?: string;
  tokens: FormulaToken[];
  activeParamKey?: string | null;
  onTokenSelect?: (paramKey: string) => void;
  onApplyParamValue?: (paramKey: string, value: number) => void;
  accentColor?: string;
}

const SYMBOL_DICTIONARY: Record<string, string> = {
  'ΣF': 'Resultan gaya bersih yang bekerja pada benda sesuai Hukum II Newton (N)',
  a: 'Percepatan translasi benda akibat resultan gaya (m/s²) atau sumbu semi-mayor orbit (AU)',
  F: 'Gaya dorong/tarik eksternal yang bekerja pada sistem (Newton)',
  m: 'Massa inersia benda yang menolak perubahan gerak (kg)',
  'm₁': 'Massa benda pertama sebelum/sesudah tumbukan (kg)',
  'm₂': 'Massa benda kedua atau massa sekunder (kg)',
  g: 'Percepatan gravitasi medan planet tempat eksperimen (m/s²)',
  'sin(θ)': 'Komponen proyeksi gaya sejajar bidang miring terhadap sudut θ',
  'f_k': 'Gaya gesek kinetik yang menghambat gerak benda pada permukaan (N)',
  fk: 'Gaya gesek kinetik yang menghambat gerak benda pada permukaan (N)',
  R: 'Jangkauan mendatar maksimum lintasan gerak parabola (m) atau radius galaktosentris (kpc)',
  'v₀²': 'Kuadrat kecepatan awal peluncuran projektil (m²/s²)',
  'sin(2θ)': 'Faktor trigonometri sudut elevasi (maksimum pada 2θ = 90° atau θ = 45°)',
  'F_p': 'Gaya pemulih pegas Hooke yang arahnya berlawanan simpangan (N)',
  Fp: 'Gaya pemulih pegas Hooke yang arahnya berlawanan simpangan (N)',
  k: 'Konstanta kekakuan pegas (N/m) atau konstanta laju reaksi',
  'Δx': 'Simpangan pegas dari posisi setimbang (m)',
  'p_total': 'Momentum linier total sistem benda sebelum dan sesudah tumbukan (kg·m/s)',
  p_tot: 'Momentum linier total sistem benda sebelum dan sesudah tumbukan (kg·m/s)',
  'v₁': 'Kecepatan awal benda pertama sebelum tumbukan (m/s)',
  'v₂': 'Kecepatan awal benda kedua sebelum tumbukan (m/s)',
  'F_g': 'Gaya tarik gravitasi universal Newton antar dua massa (µN)',
  Fg: 'Gaya tarik gravitasi universal Newton antar dua massa (µN)',
  'r²': 'Kuadrat jarak pisah antara pusat kedua benda bermassa (m²)',
  P: 'Tekanan gas ideal di dalam ruang tertutup (atm)',
  n: 'Jumlah mol zat atau elektron yang terlibat dalam reaksi (mol)',
  T: 'Suhu termodinamika sistem dalam derajat Celsius atau Kelvin',
  V: 'Volume ruang gas atau volume larutan di dalam wadah (L atau mL)',
  Ea: 'Energi aktivasi minimum agar tumbukan molekul menghasilkan reaksi (kJ/mol)',
  A: 'Absorbansi cahaya oleh larutan sesuai Hukum Beer-Lambert',
  c: 'Konsentrasi molar larutan analit yang menyerap cahaya (mM)',
  b: 'Tebal kuvet lintasan berkas cahaya (cm) atau tetapan Wien',
  pH: 'Derajat keasaman larutan (-log[H⁺])',
  E_sel: 'Potensial sel elektrokimia terukur pada kondisi tak-standar (Volt)',
  'E°': 'Potensial reduksi standar sel elektrokimia pada kondisi 25°C, 1 M (Volt)',
  '[Anoda]': 'Konsentrasi molar ion logam pada kompartemen anoda oksidasi (M)',
  '[Katoda]': 'Konsentrasi molar ion logam pada kompartemen katoda reduksi (M)',
  'ΔG': 'Perubahan energi bebas Gibbs penentu spontanitas reaksi (kJ/mol)',
  'ΔH°': 'Perubahan entalpi standar reaksi (negatif = eksotermik, positif = endotermik)',
  'ΔS°': 'Perubahan entropi atau derajat ketidakteraturan sistem (J/mol·K)',
  'r(O₂)': 'Laju produksi gelembung oksigen hasil fotosintesis (/menit)',
  I_lux: 'Intensitas pencahayaan lampu pada tanaman air (lux)',
  '[NaHCO₃]': 'Konsentrasi natrium bikarbonat sebagai sumber CO₂ terlarut (%)',
  'v₀': 'Kecepatan awal reaksi enzimatik katalase (mM/s)',
  'V_max·[S]': 'Laju reaksi maksimum dikalikan konsentrasi substrat H₂O₂ (M)',
  'Π': 'Tekanan osmotik larutan van ’t Hoff pada membran sel (atm)',
  M: 'Molaritas larutan terlarut (mol/L)',
  'λ_max': 'Panjang gelombang puncak pancaran radiasi bintang (nm)',
  T_eff: 'Suhu efektif permukaan fotosfer bintang (Kelvin)',
  v: 'Kecepatan resesi galaksi atau laju orbit planet (km/s)',
  'H₀': 'Konstanta ekspansi kosmologi Hubble (km/s/Mpc)',
  d: 'Jarak kosmis galaksi (Mpc) atau jarak celah (mm)',
  v_obs: 'Kecepatan rotasi bintang di tepi galaksi yang teramati (km/s)',
  'ΔF/F': 'Persentase peredupan cahaya bintang saat eksoplanet melintas (%)',
  R_p: 'Jari-jari eksoplanet dalam satuan jari-jari Bumi (R⊕)',
  'T²': 'Kuadrat periode revolusi orbit planet mengelilingi bintang induk (tahun²)',
  'a³': 'Pangkat tiga sumbu semi-mayor lintasan elips planet (AU³)',
  'M*': 'Massa bintang pusat dalam satuan Massa Matahari (M☉)',
};

export const InteractiveFormulaCard: React.FC<InteractiveFormulaCardProps> = ({
  title,
  subtitle,
  tokens,
  activeParamKey,
  onTokenSelect,
  onApplyParamValue,
}) => {
  const [substitutionMode, setSubstitutionMode] = useState<
    'symbol' | 'number' | 'calculator'
  >('symbol');
  const [localHoveredKey, setLocalHoveredKey] = useState<string | null>(null);
  const [selectedSymbolIdx, setSelectedSymbolIdx] = useState<number>(0);

  // Local "What-If" overrides for the interactive formula calculator
  const [whatIfValues, setWhatIfValues] = useState<Record<string, number>>({});

  const variableTokens = useMemo(
    () =>
      tokens
        .map((t, idx) => ({ ...t, originalIdx: idx }))
        .filter((t) => t.value !== undefined || Boolean(t.paramKey)),
    [tokens]
  );

  // Identify primary output token (usually LHS before '=')
  const outputToken = variableTokens[0];
  const highlightedKey = activeParamKey || localHoveredKey;
  const activeVarToken =
    variableTokens[selectedSymbolIdx] || variableTokens[1] || variableTokens[0];

  const resolveTokenValue = (tok: FormulaToken) => {
    const key = tok.paramKey || tok.symbol;
    if (substitutionMode === 'calculator' && whatIfValues[key] !== undefined) {
      return whatIfValues[key];
    }
    return tok.value;
  };

  // Estimate causal impact on outputToken when testing a What-If value
  const whatIfAnalysis = useMemo(() => {
    if (!activeVarToken || activeVarToken.value === undefined) return null;
    const key = activeVarToken.paramKey || activeVarToken.symbol;
    const baseVal = activeVarToken.value;
    const testedVal =
      whatIfValues[key] !== undefined ? whatIfValues[key] : baseVal;
    const ratio =
      Math.abs(baseVal) > 1e-6 ? testedVal / baseVal : testedVal > 0 ? 1 : 0;
    const pctChange =
      Math.abs(baseVal) > 1e-6
        ? ((testedVal - baseVal) / Math.abs(baseVal)) * 100
        : 0;

    // Determine mathematical relationship from surrounding operator tokens
    const tokIdx = activeVarToken.originalIdx;
    const prevSymbol = tokIdx > 0 ? tokens[tokIdx - 1]?.symbol || '' : '';
    const isDenominator = prevSymbol.includes('/');
    const isSubtracted = prevSymbol.includes('−') || prevSymbol.includes('-');
    const isSquared =
      activeVarToken.symbol.includes('²') || activeVarToken.symbol.includes('^2');
    const isCubed = activeVarToken.symbol.includes('³');

    let relationLabel = 'Berbanding Lurus (Linier)';
    let estimatedOutput = outputToken?.value ?? 0;

    if (activeVarToken.originalIdx === 0) {
      relationLabel = 'Besaran Output Utama (Variabel Terikat)';
      estimatedOutput = testedVal;
    } else if (isDenominator && isSquared) {
      relationLabel = 'Berbanding Terbalik Kuadrat (∝ 1/x²)';
      estimatedOutput =
        ratio > 0.01 ? (outputToken?.value ?? 0) / (ratio * ratio) : 0;
    } else if (isDenominator) {
      relationLabel = 'Berbanding Terbalik (∝ 1/x)';
      estimatedOutput = ratio > 0.01 ? (outputToken?.value ?? 0) / ratio : 0;
    } else if (isSquared) {
      relationLabel = 'Berbanding Lurus Kuadratik (∝ x²)';
      estimatedOutput = (outputToken?.value ?? 0) * (ratio * ratio);
    } else if (isCubed) {
      relationLabel = 'Pangkat Tiga / Hukum Kepler (∝ x³)';
      estimatedOutput = (outputToken?.value ?? 0) * Math.pow(ratio, 1.5);
    } else if (isSubtracted) {
      relationLabel = 'Faktor Pengurang (Korelasi Negatif)';
      estimatedOutput =
        (outputToken?.value ?? 0) - (testedVal - baseVal);
    } else {
      relationLabel = 'Berbanding Lurus (∝ x)';
      estimatedOutput = (outputToken?.value ?? 0) * ratio;
    }

    return {
      baseVal,
      testedVal,
      pctChange,
      relationLabel,
      estimatedOutput,
      hasOverride:
        whatIfValues[key] !== undefined &&
        Math.abs(whatIfValues[key] - baseVal) > 1e-4,
    };
  }, [activeVarToken, whatIfValues, tokens, outputToken]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-3.5 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Toggle between Mode Simbol, Substitusi Angka, and Bedah & Uji */}
        <div
          role="group"
          aria-label="Mode Visualisasi Rumus"
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
        >
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSubstitutionMode('symbol');
            }}
            className={`px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              substitutionMode === 'symbol'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Simbol
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSubstitutionMode('number');
            }}
            className={`px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              substitutionMode === 'number'
                ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Substitusi
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSubstitutionMode('calculator');
              if (selectedSymbolIdx === 0 && variableTokens.length > 1) {
                setSelectedSymbolIdx(1);
              }
            }}
            className={`px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              substitutionMode === 'calculator'
                ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Bedah &amp; Uji</span>
          </button>
        </div>
      </div>

      {/* Interactive Formula Stage */}
      <div className="relative rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-3.5 flex flex-wrap items-center justify-center gap-1.5 min-h-[70px] overflow-visible">
        {tokens.map((tok, idx) => {
          const isOutputToken =
            outputToken &&
            idx === outputToken.originalIdx &&
            substitutionMode === 'calculator' &&
            whatIfAnalysis?.hasOverride;

          const effectiveVal = isOutputToken
            ? whatIfAnalysis.estimatedOutput
            : resolveTokenValue(tok);

          const isVariable =
            effectiveVal !== undefined || Boolean(tok.paramKey);
          const varIdx = variableTokens.findIndex(
            (vt) => vt.originalIdx === idx
          );
          const isHighlighted =
            (Boolean(tok.paramKey) && tok.paramKey === highlightedKey) ||
            (substitutionMode === 'calculator' && varIdx === selectedSymbolIdx);

          const min = tok.min ?? 0;
          const max =
            tok.max ??
            (effectiveVal ? Math.max(10, Math.abs(effectiveVal) * 2) : 100);
          const normalizedValue =
            effectiveVal !== undefined
              ? Math.min(
                  1,
                  Math.max(
                    0,
                    (Math.abs(effectiveVal) - min) / Math.max(1e-6, max - min)
                  )
                )
              : 0.25;

          const dynamicScale = isVariable
            ? isHighlighted
              ? 1 + normalizedValue * 0.2 + 0.04
              : 1 + normalizedValue * 0.08
            : 1;

          const formattedVal =
            effectiveVal !== undefined
              ? effectiveVal.toFixed(
                  tok.precision ?? (Math.abs(effectiveVal) < 10 ? 2 : 1)
                )
              : '';

          if (!isVariable) {
            return (
              <span
                key={`${tok.symbol}-${idx}`}
                className="font-mono text-sm sm:text-base font-semibold text-slate-400 px-0.5 select-none"
              >
                {tok.symbol}
              </span>
            );
          }

          return (
            <motion.button
              key={`${tok.symbol}-${idx}`}
              type="button"
              onMouseEnter={() =>
                tok.paramKey && setLocalHoveredKey(tok.paramKey)
              }
              onMouseLeave={() => setLocalHoveredKey(null)}
              onClick={() => {
                labSound.playClick();
                if (varIdx >= 0) {
                  setSelectedSymbolIdx(varIdx);
                  setSubstitutionMode('calculator');
                }
                if (tok.paramKey && onTokenSelect) {
                  onTokenSelect(tok.paramKey);
                }
              }}
              animate={{
                scale: dynamicScale,
                boxShadow: isHighlighted
                  ? `0 0 14px ${tok.color || 'rgba(56, 189, 248, 0.5)'}`
                  : '0 0 0px rgba(0,0,0,0)',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={`relative inline-flex flex-col items-center justify-center px-2 py-1 rounded-lg font-mono border transition-colors cursor-pointer ${
                isHighlighted
                  ? 'bg-sky-500/25 border-sky-400 text-white z-20'
                  : isOutputToken
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 z-10'
                  : 'bg-slate-900/90 border-slate-700/90 text-sky-300 hover:border-sky-500/60 z-10'
              }`}
            >
              <AnimatePresence>
                {(isHighlighted || substitutionMode !== 'number') &&
                  effectiveVal !== undefined && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className={`text-[10px] font-mono tabular-nums whitespace-nowrap leading-none mb-0.5 ${
                        isHighlighted
                          ? 'text-amber-300 font-bold'
                          : isOutputToken
                          ? 'text-emerald-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {substitutionMode !== 'number'
                        ? `${formattedVal}${tok.unit ? ` ${tok.unit}` : ''}`
                        : tok.symbol}
                    </motion.span>
                  )}
              </AnimatePresence>

              <span className="text-xs sm:text-sm font-bold tracking-tight text-white tabular-nums whitespace-nowrap">
                {substitutionMode !== 'number'
                  ? tok.symbol
                  : `${formattedVal}${tok.unit ? ` ${tok.unit}` : ''}`}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Mode 3: Bedah Simbol & Kalkulator Uji Coba Variabel */}
      <AnimatePresence initial={false}>
        {substitutionMode === 'calculator' && activeVarToken && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-2.5 text-xs overflow-hidden"
          >
            {/* Variable Selector Pills */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                  Pilih Simbol:
                </span>
                {variableTokens.map((vt, vIdx) => (
                  <button
                    key={`${vt.symbol}-${vIdx}`}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setSelectedSymbolIdx(vIdx);
                    }}
                    className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border transition-colors cursor-pointer ${
                      selectedSymbolIdx === vIdx
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {vt.symbol}
                  </button>
                ))}
              </div>

              {Object.keys(whatIfValues).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setWhatIfValues({});
                  }}
                  className="text-[10px] font-mono text-slate-500 hover:text-sky-400 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Uji</span>
                </button>
              )}
            </div>

            {/* Selected Symbol Explanation & What-If Scrubber */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  [{activeVarToken.symbol}]{' '}
                  {whatIfAnalysis && (
                    <span className="text-[10px] font-sans font-normal text-slate-500 dark:text-slate-400">
                      · {whatIfAnalysis.relationLabel}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200 font-bold tabular-nums">
                  {resolveTokenValue(activeVarToken)?.toFixed(2) ?? '-'}{' '}
                  {activeVarToken.unit || ''}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeVarToken.description ||
                  SYMBOL_DICTIONARY[activeVarToken.symbol] ||
                  `Besaran fisis (${activeVarToken.symbol}) dalam persamaan ${title} dengan satuan ${activeVarToken.unit || 'SI'}.`}
              </p>

              {activeVarToken.value !== undefined &&
                activeVarToken.originalIdx > 0 && (
                  <div className="pt-1 space-y-2 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>
                          Uji Proporsi &ldquo;What-If&rdquo; (
                          {activeVarToken.symbol}):
                        </span>
                      </span>
                      {whatIfAnalysis && (
                        <span className="tabular-nums">
                          {whatIfAnalysis.pctChange >= 0 ? '+' : ''}
                          {whatIfAnalysis.pctChange.toFixed(0)}% dari sensor
                        </span>
                      )}
                    </div>

                    <input
                      type="range"
                      min={activeVarToken.min ?? 0}
                      max={
                        activeVarToken.max ??
                        Math.max(10, Math.abs(activeVarToken.value) * 2)
                      }
                      step={
                        ((activeVarToken.max ?? 100) -
                          (activeVarToken.min ?? 0)) /
                        50
                      }
                      value={
                        resolveTokenValue(activeVarToken) ??
                        activeVarToken.value
                      }
                      onChange={(e) => {
                        const k =
                          activeVarToken.paramKey || activeVarToken.symbol;
                        setWhatIfValues((prev) => ({
                          ...prev,
                          [k]: Number(e.target.value),
                        }));
                      }}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />

                    {/* Live Causal Prediction & Apply Button */}
                    {whatIfAnalysis && outputToken && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          Prediksi{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {outputToken.symbol}
                          </strong>
                          : {(outputToken.value ?? 0).toFixed(2)} →{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {whatIfAnalysis.estimatedOutput.toFixed(2)}{' '}
                            {outputToken.unit || ''}
                          </strong>
                        </div>

                        {onApplyParamValue && activeVarToken.paramKey && (
                          <button
                            type="button"
                            onClick={() => {
                              labSound.playRecordSuccess();
                              if (activeVarToken.paramKey) {
                                onApplyParamValue(
                                  activeVarToken.paramKey,
                                  whatIfAnalysis.testedVal
                                );
                                setWhatIfValues({});
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>Terapkan ke 3D</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <span>
            Klik simbol pada rumus untuk membedah arti fisis &amp; menguji
            dampak variabel secara langsung
          </span>
        </span>
      </div>
    </div>
  );
};
