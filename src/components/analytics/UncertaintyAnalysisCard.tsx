import React, { useMemo, useState } from 'react';
import { Ruler, Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';
import { computeMeasurementErrorSummary } from '../../utils/uncertaintyEngine';

export interface UncertaintyAnalysisCardProps {
  metricLabel: string;
  unit?: string;
  values: number[];
  theoreticalInput?: string;
  onChangeTheoreticalInput?: (val: string) => void;
  nstInput?: string;
  onChangeNstInput?: (val: string) => void;
}

const GRADE_STYLE_MAP = {
  'Sangat Presisi':
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40',
  'Presisi Baik': 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40',
  'Cukup Presisi':
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40',
  'Perlu Pengulangan':
    'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/40',
  'Data Belum Mencukupi':
    'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-400/40',
} as const;

export const UncertaintyAnalysisCard: React.FC<UncertaintyAnalysisCardProps> = ({
  metricLabel,
  unit = '',
  values,
  theoreticalInput,
  onChangeTheoreticalInput,
  nstInput,
  onChangeNstInput,
}) => {
  const [internalTheory, setInternalTheory] = useState<string>('');
  const [internalNst, setInternalNst] = useState<string>('');

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
  const gradeStyle = GRADE_STYLE_MAP[summary.precisionGrade];

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Ruler className="w-4 h-4" />
            <span>Analisis Ketidakpastian &amp; Ralat Pengukuran (Tipe A + Tipe B)</span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
            Metrik Dianalisis: {metricLabel} ({summary.n} sampel data)
          </h3>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${gradeStyle}`}
        >
          {summary.precisionGrade === 'Perlu Pengulangan' ||
          summary.precisionGrade === 'Data Belum Mencukupi' ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>Tingkat Presisi: {summary.precisionGrade}</span>
        </span>
      </div>

      {/* Controls for NST & Theoretical Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
        <label className="block text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            NST Alat Ukur (Nilai Skala Terkecil, opsional)
          </span>
          <input
            type="number"
            step="any"
            min="0.0001"
            value={activeNstStr}
            onChange={(e) => setNst(e.target.value)}
            placeholder="Otomatis: 0.01 (ketidakpastian ½ NST = 0.005)"
            className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
          />
        </label>

        <label className="block text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Nilai Referensi Teoretis / Literatur (y_teori, opsional)
          </span>
          <input
            type="number"
            step="any"
            value={activeTheoryStr}
            onChange={(e) => setTheory(e.target.value)}
            placeholder="Isi nilai teori untuk hitung % Galat Sistematis"
            className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
          />
        </label>
      </div>

      {summary.n === 0 ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-800 dark:text-amber-200">
          Belum ada data numerik valid untuk dihitung ralatnya. Rekam minimal 2 titik data eksperimen agar deviasi standar sampel (Tipe A) dapat dihitung.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50">
              <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                Pelaporan Baku (x̄ ± Δx)
              </div>
              <div className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5 break-all">
                {summary.mean.toFixed(3)} ± {summary.combinedUncertainty.toFixed(3)}
                {unitSuffix}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Rentang: {summary.min.toFixed(3)} – {summary.max.toFixed(3)}
                {unitSuffix}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Ralat Tipe A (Acak) &amp; Tipe B (Alat)
              </div>
              <div className="text-xs font-mono text-slate-900 dark:text-white mt-1 space-y-0.5">
                <div>s (Std Dev): {summary.sampleStdDev.toFixed(4)}</div>
                <div>sₓ̄ (SE Mean): {summary.standardErrorMean.toFixed(4)}</div>
                <div>Δx_B (½ NST): {summary.instrumentUncertainty.toFixed(4)}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Ketidakpastian Relatif &amp; Angka Penting
              </div>
              <div className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
                ±{summary.relativeUncertaintyPct.toFixed(2)}%
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1">
                <Calculator className="w-3 h-3 text-indigo-500" />
                <span>
                  Disarankan: <strong>{summary.recommendedSignificantFigures} Angka Penting</strong>
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                % Galat terhadap Teori
              </div>
              <div className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5">
                {summary.percentErrorVsTheory !== undefined
                  ? `${summary.percentErrorVsTheory.toFixed(2)}%`
                  : 'Belum diisi'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {summary.percentErrorVsTheory !== undefined
                  ? '|x̄ - y_teori| / |y_teori| × 100%'
                  : 'Masukkan y_teori di atas'}
              </div>
            </div>
          </div>

          {summary.n < 2 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Catatan: Sampel baru 1 titik, sehingga deviasi standar acak Tipe A bernilai 0. Ambil minimal 3 pengulangan agar estimasi ralat acak representatif.
            </p>
          )}
        </>
      )}
    </section>
  );
};
