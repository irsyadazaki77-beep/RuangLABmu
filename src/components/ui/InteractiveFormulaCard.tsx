import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, Sparkles } from 'lucide-react';
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
}

export interface InteractiveFormulaCardProps {
  title: string;
  subtitle?: string;
  tokens: FormulaToken[];
  activeParamKey?: string | null;
  onTokenSelect?: (paramKey: string) => void;
  accentColor?: string;
}

export const InteractiveFormulaCard: React.FC<InteractiveFormulaCardProps> = ({
  title,
  subtitle,
  tokens,
  activeParamKey,
  onTokenSelect,
  accentColor = '#0ea5e9',
}) => {
  const [substitutionMode, setSubstitutionMode] = useState<'symbol' | 'number'>('symbol');
  const [localHoveredKey, setLocalHoveredKey] = useState<string | null>(null);

  const highlightedKey = activeParamKey || localHoveredKey;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-4 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Toggle between Mode Simbol and Mode Substitusi Angka */}
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
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              substitutionMode === 'symbol'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Mode Simbol
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSubstitutionMode('number');
            }}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              substitutionMode === 'number'
                ? 'bg-sky-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Mode Substitusi Angka
          </button>
        </div>
      </div>

      {/* Interactive Formula Stage */}
      <div className="relative rounded-xl bg-slate-950 border border-slate-800 px-4 py-5 flex flex-wrap items-center justify-center gap-2 min-h-[76px] overflow-visible">
        {tokens.map((tok, idx) => {
          const isVariable = tok.value !== undefined || Boolean(tok.paramKey);
          const isHighlighted =
            Boolean(tok.paramKey) && tok.paramKey === highlightedKey;

          const min = tok.min ?? 0;
          const max = tok.max ?? (tok.value ? Math.max(10, Math.abs(tok.value) * 2) : 100);
          const normalizedValue =
            tok.value !== undefined
              ? Math.min(1, Math.max(0, (Math.abs(tok.value) - min) / Math.max(1e-6, max - min)))
              : 0.25;

          const dynamicScale = isVariable
            ? isHighlighted
              ? 1 + normalizedValue * 0.35 + 0.08
              : 1 + normalizedValue * 0.16
            : 1;

          const formattedVal =
            tok.value !== undefined
              ? tok.value.toFixed(tok.precision ?? (Math.abs(tok.value) < 10 ? 2 : 1))
              : '';

          if (!isVariable) {
            return (
              <span
                key={`${tok.symbol}-${idx}`}
                className="font-mono text-base sm:text-lg font-semibold text-slate-400 px-0.5 select-none"
              >
                {tok.symbol}
              </span>
            );
          }

          return (
            <motion.button
              key={`${tok.symbol}-${idx}`}
              type="button"
              onMouseEnter={() => tok.paramKey && setLocalHoveredKey(tok.paramKey)}
              onMouseLeave={() => setLocalHoveredKey(null)}
              onClick={() => {
                if (tok.paramKey && onTokenSelect) {
                  labSound.playClick();
                  onTokenSelect(tok.paramKey);
                }
              }}
              animate={{
                scale: dynamicScale,
                boxShadow: isHighlighted
                  ? `0 0 18px ${tok.color || 'rgba(56, 189, 248, 0.55)'}`
                  : '0 0 0px rgba(0,0,0,0)',
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={`relative inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-lg font-mono border transition-colors ${
                isHighlighted
                  ? 'bg-sky-500/25 border-sky-400 text-white z-20'
                  : 'bg-slate-900/90 border-slate-700/90 text-sky-300 hover:border-sky-500/60 z-10'
              }`}
            >
              {/* Floating Value Mini-Badge on Hover / Active Slider Drag */}
              <AnimatePresence>
                {(isHighlighted || substitutionMode === 'symbol') &&
                  tok.value !== undefined && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className={`text-[10px] font-mono tabular-nums whitespace-nowrap leading-none mb-0.5 ${
                        isHighlighted ? 'text-amber-300 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {substitutionMode === 'symbol'
                        ? `${formattedVal}${tok.unit ? ` ${tok.unit}` : ''}`
                        : tok.symbol}
                    </motion.span>
                  )}
              </AnimatePresence>

              <span className="text-sm sm:text-base font-bold tracking-tight text-white tabular-nums whitespace-nowrap">
                {substitutionMode === 'symbol'
                  ? tok.symbol
                  : `${formattedVal}${tok.unit ? ` ${tok.unit}` : ''}`}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-sky-500" />
          Geser variabel kontrol untuk melihat proporsi rumus berubah secara dinamis
        </span>
      </div>
    </div>
  );
};
