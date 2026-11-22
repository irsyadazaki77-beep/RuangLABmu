import React, { useState, useMemo } from 'react';
import { ArrowLeftRight, FileSpreadsheet, X } from 'lucide-react';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';

export interface ExperimentTrialComparePanelProps {
  records: ExperimentRecord[];
  domainFilter?: string;
  onClose?: () => void;
}

/**
 * Perbandingan Rekaman Eksperimen Berdampingan (Diff / Compare 2 Percobaan)
 */
export const ExperimentTrialComparePanel: React.FC<ExperimentTrialComparePanelProps> = ({
  records: rawRecords,
  domainFilter,
  onClose,
}) => {
  const records = useMemo(() => {
    if (!domainFilter) return rawRecords;
    const filtered = rawRecords.filter(
      (r) => r.domain.toLowerCase() === domainFilter.toLowerCase()
    );
    return filtered.length >= 2 ? filtered : rawRecords;
  }, [rawRecords, domainFilter]);

  const [trialAId, setTrialAId] = useState<string>(() => records[1]?.id || records[0]?.id || '');
  const [trialBId, setTrialBId] = useState<string>(() => records[0]?.id || '');

  const recordA = useMemo(
    () => records.find((r) => r.id === trialAId) || records[1] || records[0],
    [records, trialAId]
  );
  const recordB = useMemo(
    () => records.find((r) => r.id === trialBId) || records[0],
    [records, trialBId]
  );

  if (records.length < 2 || !recordA || !recordB) {
    return (
      <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-bold text-[var(--comfort-text)] flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-sky-500" />
            <span>Komparator 2 Rekaman Eksperimen Berdampingan (Diff)</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              aria-label="Tutup komparator"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-[var(--comfort-text-muted)] leading-relaxed">
          Rekam minimal <strong>2 titik data eksperimen</strong> di simulasi 3D untuk membandingkan perubahan parameter (ΔX) dan respons terukur (ΔY) secara berdampingan.
        </p>
      </div>
    );
  }

  const dx =
    recordA.numericX !== undefined && recordB.numericX !== undefined
      ? Number((recordB.numericX - recordA.numericX).toFixed(3))
      : null;
  const dy1 =
    recordA.numericY1 !== undefined && recordB.numericY1 !== undefined
      ? Number((recordB.numericY1 - recordA.numericY1).toFixed(3))
      : null;
  const dy2 =
    recordA.numericY2 !== undefined && recordB.numericY2 !== undefined
      ? Number((recordB.numericY2 - recordA.numericY2).toFixed(3))
      : null;

  const pctChangeY1 =
    dy1 !== null && recordA.numericY1 && Math.abs(recordA.numericY1) > 1e-6
      ? Number(((dy1 / Math.abs(recordA.numericY1)) * 100).toFixed(1))
      : null;

  const allMetricKeys = Array.from(
    new Set([...Object.keys(recordA.keyMetrics), ...Object.keys(recordB.keyMetrics)])
  );

  return (
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4 sm:p-5 space-y-4 text-xs shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--comfort-text)] text-xs sm:text-sm">
              Perbandingan 2 Eksperimen Berdampingan (Side-by-Side Diff)
            </h3>
            <p className="text-[11px] text-[var(--comfort-text-muted)]">
              Analisis kausalitas perubahan parameter input terhadap metrik output terukur
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
            aria-label="Tutup komparator"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selector Row: Percobaan A vs Percobaan B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1.5">
          <label className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 block">
            PERCOBAAN ACUAN (A)
          </label>
          <select
            value={recordA.id}
            onChange={(e) => {
              labSound.playClick();
              setTrialAId(e.target.value);
            }}
            className="w-full bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--comfort-text)] focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} ({r.timestamp}) — {r.experimentTitle}
              </option>
            ))}
          </select>
          <div className="font-mono text-[11px] text-[var(--comfort-text-muted)]">
            Parameter: {recordA.parametersSummary}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1.5">
          <label className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
            PERCOBAAN PEMBANDING (B)
          </label>
          <select
            value={recordB.id}
            onChange={(e) => {
              labSound.playClick();
              setTrialBId(e.target.value);
            }}
            className="w-full bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--comfort-text)] focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} ({r.timestamp}) — {r.experimentTitle}
              </option>
            ))}
          </select>
          <div className="font-mono text-[11px] text-[var(--comfort-text-muted)]">
            Parameter: {recordB.parametersSummary}
          </div>
        </div>
      </div>

      {/* Quantitative Delta KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
          <div className="text-[11px] text-[var(--comfort-text-muted)]">
            Perubahan Variabel Bebas (ΔX = X_B - X_A)
          </div>
          <div className="mt-1 font-mono font-bold text-base text-[var(--comfort-text)] tabular-nums">
            {dx !== null ? (
              <>
                {dx > 0 ? `+${dx}` : dx}{' '}
                <span className="text-xs font-normal text-[var(--comfort-text-muted)]">
                  ({recordA.numericX} → {recordB.numericX})
                </span>
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
          <div className="text-[11px] text-[var(--comfort-text-muted)]">
            Selisih Respons Utama (ΔY₁ = Y₁_B - Y₁_A)
          </div>
          <div className="mt-1 font-mono font-bold text-base text-sky-600 dark:text-sky-400 tabular-nums">
            {dy1 !== null ? (
              <>
                {dy1 > 0 ? `▲ +${dy1}` : dy1 < 0 ? `▼ ${dy1}` : '● 0'}{' '}
                {pctChangeY1 !== null && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    ({pctChangeY1 > 0 ? `+${pctChangeY1}%` : `${pctChangeY1}%`})
                  </span>
                )}
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
          <div className="text-[11px] text-[var(--comfort-text-muted)]">
            Selisih Respons Sekunder (ΔY₂)
          </div>
          <div className="mt-1 font-mono font-bold text-base text-amber-600 dark:text-amber-400 tabular-nums">
            {dy2 !== null ? (
              <>
                {dy2 > 0 ? `▲ +${dy2}` : dy2 < 0 ? `▼ ${dy2}` : '● 0'}{' '}
                <span className="text-xs font-normal text-[var(--comfort-text-muted)]">
                  ({recordA.numericY2 ?? 0} → {recordB.numericY2 ?? 0})
                </span>
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>
      </div>

      {/* Detailed Side-by-Side Metrics Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--comfort-border)]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] font-mono text-[11px]">
              <th className="py-2 px-3">Besaran Terukur</th>
              <th className="py-2 px-3">Percobaan A ({recordA.id})</th>
              <th className="py-2 px-3">Percobaan B ({recordB.id})</th>
              <th className="py-2 px-3">Perubahan (Δ)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--comfort-border)] font-mono tabular-nums">
            {allMetricKeys.map((key) => {
              const valA = String(recordA.keyMetrics[key] ?? '-');
              const valB = String(recordB.keyMetrics[key] ?? '-');
              const numA = parseFloat(valA.replace(/[^\d.-]/g, ''));
              const numB = parseFloat(valB.replace(/[^\d.-]/g, ''));
              const hasNumericDelta = !Number.isNaN(numA) && !Number.isNaN(numB);
              const diff = hasNumericDelta ? Number((numB - numA).toFixed(3)) : 0;

              return (
                <tr key={key} className="text-[var(--comfort-text)]">
                  <td className="py-2 px-3 font-sans font-semibold">{key}</td>
                  <td className="py-2 px-3">{valA}</td>
                  <td className="py-2 px-3 font-semibold">{valB}</td>
                  <td className="py-2 px-3">
                    {hasNumericDelta ? (
                      <span
                        className={
                          diff > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : diff < 0
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-[var(--comfort-text-muted)]'
                        }
                      >
                        {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '= 0 (Tetap)'}
                      </span>
                    ) : valA === valB ? (
                      <span className="text-[var(--comfort-text-muted)]">= Sama</span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400">Berubah</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Automatic Causal Interpretation Footer */}
      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-[var(--comfort-text)] flex items-start gap-2">
        <FileSpreadsheet className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
        <div>
          <strong>Sintesis Kausalitas:</strong> Ketika parameter diubah dari{' '}
          <span className="font-mono">{recordA.id}</span> ke{' '}
          <span className="font-mono">{recordB.id}</span> (ΔX ={' '}
          <span className="font-mono">{dx ?? 0}</span>), respons utama Y₁ mengalami perubahan sebesar{' '}
          <span className="font-mono font-bold">
            {dy1 ?? 0} ({pctChangeY1 !== null ? `${pctChangeY1}%` : '0%'})
          </span>
          . Gunakan temuan ini untuk menjawab LKS dan menyusun kesimpulan laporan!
        </div>
      </div>
    </div>
  );
};
