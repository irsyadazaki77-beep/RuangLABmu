import React, { useMemo, useState } from 'react';
import { Ruler, Calculator, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { computeMeasurementErrorSummary } from '../../utils/uncertaintyEngine';
import { labSound } from '../../utils/soundEngine';

export interface UncertaintyAnalysisCardProps {
  metricLabel: string;
  unit?: string;
  values: number[];
  theoreticalInput?: string;
  onChangeTheoreticalInput?: (val: string) => void;
  nstInput?: string;
  onChangeNstInput?: (val: string) => void;
  defaultOpen?: boolean;
}

const GRADE_TONE_MAP = {
  'Sangat Presisi': 'text-emerald-700 dark:text-emerald-400',
  'Presisi Baik': 'text-sky-700 dark:text-sky-400',
  'Cukup Presisi': 'text-amber-700 dark:text-amber-400',
  'Perlu Pengulangan': 'text-rose-700 dark:text-rose-400',
  'Data Belum Mencukupi': 'text-[var(--comfort-text-muted)]',
} as const;

export const UncertaintyAnalysisCard: React.FC<UncertaintyAnalysisCardProps> = ({
  metricLabel,
  unit = '',
  values,
  theoreticalInput,
  onChangeTheoreticalInput,
  nstInput,
  onChangeNstInput,
  defaultOpen = false,
}) => {
  const [internalTheory, setInternalTheory] = useState<string>('');
  const [internalNst, setInternalNst] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  const activeTheoryStr = theoreticalInput !== undefined ? theoreticalInput : internalTheory;
  const activeNstStr = nstInput !== undefined ? nstInput : internalNst;

  const setTheory = onChangeTheoreticalInput || setInternalTheory;
  const setNst = onChangeNstInput || setInternalNst;

  const parsedTheory = useMemo(() => {
    const trimmed = activeTheoryStr.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : undefined;
  }, [activeTheoryStr]);

  const parsedNst = useMemo(() => {
    const trimmed = activeNstStr.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }, [activeNstStr]);

  const summary = useMemo(
    () => computeMeasurementErrorSummary(values, parsedTheory, parsedNst),
    [values, parsedTheory, parsedNst]
  );

  const unitSuffix = unit ? ` ${unit}` : '';
  const gradeTone = GRADE_TONE_MAP[summary.precisionGrade];

  return (
    <section
      data-testid="uncertainty-analysis-card"
      className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden"
    >
      {/* Compact Single-Row Summary Accordion Header */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
        className="w-full px-4 sm:px-5 py-3.5 min-h-[48px] flex flex-wrap items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors duration-150 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Ruler className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-[var(--comfort-text)] truncate">
              Analisis Ketidakpastian &amp; Ralat ({metricLabel})
            </div>
            <div className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums mt-0.5 flex flex-wrap items-center gap-x-2">
              {summary.n > 0 ? (
                <>
                  <span>
                    x̄ ± Δx = <strong className="text-[var(--comfort-text)]">{summary.mean.toFixed(3)} ± {summary.combinedUncertainty.toFixed(3)}{unitSuffix}</strong>
                  </span>
                  <span aria-hidden="true" className="opacity-45">·</span>
                  <span>Relatif ±{summary.relativeUncertaintyPct.toFixed(2)}%</span>
                </>
              ) : (
                <span>Belum ada data numerik ({summary.n} sampel)</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className={`inline-flex items-center gap-1 text-2xs font-semibold ${gradeTone}`}>
            {summary.precisionGrade === 'Perlu Pengulangan' ||
            summary.precisionGrade === 'Data Belum Mencukupi' ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{summary.precisionGrade}</span>
          </span>
          <span className="text-2xs font-semibold text-sky-700 dark:text-sky-300">
            {isOpen ? 'Ringkas' : 'Lihat Detail'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[var(--comfort-text-muted)] transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-[var(--comfort-border)] space-y-4">
          {/* Controls for NST & Theoretical Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-semibold text-[var(--comfort-text)]">
                NST Alat Ukur (opsional)
              </span>
              <input
                type="number"
                step="any"
                min="0.0001"
                value={activeNstStr}
                onChange={(e) => setNst(e.target.value)}
                placeholder="Default: 0.01 (½ NST = 0.005)"
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-mono text-xs"
              />
            </label>

            <label className="block text-xs">
              <span className="font-semibold text-[var(--comfort-text)]">
                Nilai Referensi Teori y_teori (opsional)
              </span>
              <input
                type="number"
                step="any"
                value={activeTheoryStr}
                onChange={(e) => setTheory(e.target.value)}
                placeholder="Isi untuk menghitung % galat teori"
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-mono text-xs"
              />
            </label>
          </div>

          {summary.n === 0 ? (
            <p className="comfort-report-prose text-xs text-amber-700 dark:text-amber-300">
              Rekam minimal 2 titik data eksperimen agar deviasi standar sampel (Tipe A) dapat dihitung.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[var(--comfort-border)]">
                <div className="space-y-0.5">
                  <div className="text-2xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Pelaporan Baku (x̄ ± Δx)
                  </div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-[var(--comfort-text)] break-all">
                    {summary.mean.toFixed(3)} ± {summary.combinedUncertainty.toFixed(3)}
                    {unitSuffix}
                  </div>
                  <div className="text-2xs text-[var(--comfort-text-muted)] tabular-nums">
                    Rentang: {summary.min.toFixed(3)}–{summary.max.toFixed(3)}{unitSuffix}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                    Ralat Tipe A &amp; Tipe B
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[var(--comfort-text)] leading-relaxed">
                    <div>s = {summary.sampleStdDev.toFixed(4)}</div>
                    <div>sₓ̄ = {summary.standardErrorMean.toFixed(4)}</div>
                    <div>½ NST = {summary.instrumentUncertainty.toFixed(4)}</div>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                    Ketidakpastian Relatif
                  </div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-[var(--comfort-text)]">
                    ±{summary.relativeUncertaintyPct.toFixed(2)}%
                  </div>
                  <div className="text-2xs text-[var(--comfort-text-muted)] flex items-center gap-1">
                    <Calculator className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>{summary.recommendedSignificantFigures} Angka Penting</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                    % Galat vs Teori
                  </div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-[var(--comfort-text)]">
                    {summary.percentErrorVsTheory !== undefined
                      ? `${summary.percentErrorVsTheory.toFixed(2)}%`
                      : '—'}
                  </div>
                  <div className="text-2xs text-[var(--comfort-text-muted)]">
                    {summary.percentErrorVsTheory !== undefined
                      ? '|x̄ - y_teori| / |y_teori|'
                      : 'Isi y_teori di atas'}
                  </div>
                </div>
              </div>

              {summary.n < 2 && (
                <p className="comfort-report-prose text-xs text-amber-700 dark:text-amber-300">
                  Catatan: Baru 1 titik data; ambil minimal 3 pengulangan agar estimasi ralat acak representatif.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
