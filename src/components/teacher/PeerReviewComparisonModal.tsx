import React, { useMemo, useState } from 'react';
import { CheckCircle2, Columns2, MessageSquare, Sparkles, X } from 'lucide-react';
import type { StudentLiveTelemetry } from '../../utils/collabProtocol';

export interface PeerComparisonSummary {
  recordsDiff: number;
  rSquaredDiff: number;
  higherPrecisionStudent: string;
  diagnosticNote: string;
}

/**
 * Pure helper: Compares live telemetry metrics of two student groups for Side-by-Side Peer Review.
 */
export function computePeerComparisonSummary(
  groupA: StudentLiveTelemetry,
  groupB: StudentLiveTelemetry
): PeerComparisonSummary {
  const recA = groupA.recordsCount ?? groupA.trialsCount ?? 0;
  const recB = groupB.recordsCount ?? groupB.trialsCount ?? 0;
  const r2A = Number.isFinite(groupA.rSquared) ? groupA.rSquared : 0;
  const r2B = Number.isFinite(groupB.rSquared) ? groupB.rSquared : 0;

  const recordsDiff = Math.abs(recA - recB);
  const rSquaredDiff = Number(Math.abs(r2A - r2B).toFixed(4));
  const higherPrecisionStudent =
    r2A >= r2B
      ? groupA.studentName || 'Kelompok A'
      : groupB.studentName || 'Kelompok B';

  let diagnosticNote = 'Kedua kelompok menunjukkan konsistensi data eksperimen yang sangat baik.';
  if (rSquaredDiff >= 0.08) {
    diagnosticNote = `Terdapat selisih linieritas signifikan (ΔR² = ${rSquaredDiff.toFixed(3)}). Diskusikan kemungkinan galat sistematis atau titik pencilan (outlier) bersama kelas.`;
  } else if (recordsDiff >= 3) {
    diagnosticNote = `Selisih jumlah sampel (${recordsDiff} titik). Anjurkan kelompok dengan sampel lebih sedikit untuk menambah variasi variabel bebas.`;
  }

  return {
    recordsDiff,
    rSquaredDiff,
    higherPrecisionStudent,
    diagnosticNote,
  };
}

export interface PeerReviewComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetries: StudentLiveTelemetry[];
}

const DEMO_FALLBACK_TELEMETRIES: StudentLiveTelemetry[] = [
  {
    studentName: 'Kelompok A (Alya & Bima)',
    domain: 'Fisika',
    moduleId: 'newton-incline',
    moduleTitle: 'Hukum II Newton & Bidang Miring',
    recordsCount: 6,
    rSquared: 0.992,
    parametersSummary: 'Sudut 30°, a = 4.12 m/s²',
    lastUpdated: new Date().toISOString(),
  },
  {
    studentName: 'Kelompok B (Citra & Dimas)',
    domain: 'Fisika',
    moduleId: 'newton-incline',
    moduleTitle: 'Hukum II Newton & Bidang Miring',
    recordsCount: 4,
    rSquared: 0.904,
    parametersSummary: 'Sudut 30°, a = 3.85 m/s² (terdapat 1 outlier)',
    lastUpdated: new Date().toISOString(),
  },
];

export const PeerReviewComparisonModal: React.FC<PeerReviewComparisonModalProps> = ({
  isOpen,
  onClose,
  telemetries,
}) => {
  const effectiveList = useMemo(
    () => (telemetries.length >= 2 ? telemetries : DEMO_FALLBACK_TELEMETRIES),
    [telemetries]
  );

  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(1);
  const [peerNotes, setPeerNotes] = useState('');

  const leftGroup = effectiveList[leftIdx] ?? effectiveList[0];
  const rightGroup = effectiveList[rightIdx] ?? effectiveList[1] ?? effectiveList[0];

  const comparison = useMemo(
    () => computePeerComparisonSummary(leftGroup, rightGroup),
    [leftGroup, rightGroup]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="peer-review-comparison-modal"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--comfort-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Columns2 className="w-5 h-5 text-sky-500" />
            <div>
              <h2 className="text-sm font-bold">
                Peer-Review &amp; Perbandingan Kelompok Berdampingan
              </h2>
              <p className="text-2xs text-[var(--comfort-text-muted)]">
                Bandingkan akurasi regresi (R²), jumlah variasi data, dan temuan antar kelompok untuk diskusi kelas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--comfort-surface-muted)] cursor-pointer"
            aria-label="Tutup perbandingan peer-review"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {telemetries.length < 2 && (
            <div className="text-2xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
              Menampilkan data simulasi demonstrasi karena saat ini kurang dari 2 kelompok aktif mengirimkan telemetri di ruangan PIN.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { side: 'Kelompok Kiri', idx: leftIdx, setIdx: setLeftIdx, group: leftGroup, accent: 'border-sky-500/40' },
              { side: 'Kelompok Kanan', idx: rightIdx, setIdx: setRightIdx, group: rightGroup, accent: 'border-emerald-500/40' },
            ].map(({ side, idx, setIdx, group, accent }) => (
              <div
                key={side}
                className={`rounded-xl border ${accent} bg-[var(--comfort-bg)] p-4 space-y-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)]">
                    {side}
                  </span>
                  <select
                    value={idx}
                    onChange={(e) => setIdx(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-xs font-semibold"
                  >
                    {effectiveList.map((item, i) => (
                      <option key={`${item.studentName}-${i}`} value={i}>
                        {item.studentName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-sm font-bold">{group.studentName}</div>
                <div className="text-xs text-[var(--comfort-text-muted)]">{group.moduleTitle}</div>

                <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
                  <div className="p-2.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                    <div className="text-2xs text-[var(--comfort-text-muted)]">Jumlah Sampel</div>
                    <div className="text-base font-bold text-sky-500">{group.recordsCount} titik</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                    <div className="text-2xs text-[var(--comfort-text-muted)]">Akurasi Regresi R²</div>
                    <div className="text-base font-bold text-emerald-500">
                      {Number.isFinite(group.rSquared) ? group.rSquared.toFixed(3) : '—'}
                    </div>
                  </div>
                </div>

                {group.parametersSummary && (
                  <div className="text-2xs p-2.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                    <span className="font-semibold">Ringkasan Terakhir:</span> {group.parametersSummary}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Automated Diagnostic Synthesis */}
          <div className="rounded-xl border border-indigo-500/35 bg-indigo-500/10 p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-300">
              <Sparkles className="w-4 h-4" />
              <span>Sintesis Diagnostik Peer-Review</span>
            </div>
            <p className="leading-relaxed">{comparison.diagnosticNote}</p>
            <div className="flex flex-wrap items-center gap-3 text-2xs font-mono pt-1">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Presisi Tertinggi: {comparison.higherPrecisionStudent}
              </span>
              <span>ΔSampel: {comparison.recordsDiff}</span>
              <span>ΔR²: {comparison.rSquaredDiff.toFixed(3)}</span>
            </div>
          </div>

          {/* Collaborative Classroom Review Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
              <span>Catatan Umpan Balik Peer-Review Kelas</span>
            </label>
            <textarea
              rows={2}
              value={peerNotes}
              onChange={(e) => setPeerNotes(e.target.value)}
              placeholder="Tuliskan kesimpulan diskusi perbandingan data kedua kelompok..."
              className="w-full rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
