import React from 'react';
import { Award, ChevronDown, FileCheck2, FileText, PlayCircle, Send } from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
import { type EvaluatedRubricReport } from '../../shared/grading/rubricEngine';
import { labSound } from '../../utils/soundEngine';

export interface GradebookSubmissionReviewProps {
  selectedSubmission: LabSubmission | null;
  selectedRubric: EvaluatedRubricReport | null;
  expandedRubricOpen: boolean;
  onToggleRubricOpen: () => void;
  onOpenReplay: (sub: LabSubmission) => void;
  gradingScore: number;
  onChangeGradingScore: (val: number) => void;
  gradingFeedback: string;
  onChangeGradingFeedback: (val: string) => void;
  isSubmittingGrade: boolean;
  toastMessage: string | null;
  onSaveGrade: (e: React.FormEvent) => void;
}

export const GradebookSubmissionReview: React.FC<GradebookSubmissionReviewProps> = ({
  selectedSubmission,
  selectedRubric,
  expandedRubricOpen,
  onToggleRubricOpen,
  onOpenReplay,
  gradingScore,
  onChangeGradingScore,
  gradingFeedback,
  onChangeGradingFeedback,
  isSubmittingGrade,
  toastMessage,
  onSaveGrade,
}) => {
  return (
    <div className="w-full md:w-1/2 flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--comfort-surface-subtle)]">
      {selectedSubmission && selectedRubric ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
                Review Laporan Siswa · {selectedSubmission.id}
              </span>
              <h3 className="text-base font-extrabold text-[var(--comfort-text)]">
                {selectedSubmission.studentName}
              </h3>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Diserahkan pada:{' '}
                {new Date(selectedSubmission.submittedAt).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onOpenReplay(selectedSubmission);
                }}
                className="px-3 py-1.5 min-h-[34px] rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Lihat Replay Praktikum</span>
              </button>
              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                R² = {selectedSubmission.regressionMetrics?.rSquared?.toFixed(3) ?? '0.99'} · m ={' '}
                {selectedSubmission.regressionMetrics?.slope?.toFixed(2) ?? '1.00'}
              </span>
            </div>
          </div>

          {/* Expandable Deterministic RK4 Auto-Rubric Breakdown Drawer */}
          <div
            data-testid="teacher-rubric-breakdown-panel"
            className="rounded-2xl border border-teal-500/30 bg-[var(--comfort-surface)] overflow-hidden shadow-xs"
          >
            <button
              type="button"
              onClick={onToggleRubricOpen}
              aria-expanded={expandedRubricOpen}
              className="w-full px-4 py-3 flex items-center justify-between gap-2 bg-teal-500/10 hover:bg-teal-500/15 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <span className="text-xs font-extrabold text-[var(--comfort-text)] block">
                    Rincian Rubrik Otomatis &amp; Toleransi Numerik RK4
                  </span>
                  <span className="text-[11px] text-[var(--comfort-text-muted)]">
                    Toleransi RK4: ±{selectedRubric.rk4TolerancePct}% · Status:{' '}
                    {selectedRubric.passed ? 'Lulus Kriteria Minimum' : 'Perlu Penguatan'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-mono font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                  {selectedRubric.score}/{selectedRubric.maxScore}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[var(--comfort-text-muted)] transition-transform ${
                    expandedRubricOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {expandedRubricOpen && (
              <div className="p-3.5 space-y-2.5 divide-y divide-[var(--comfort-border)] text-xs">
                <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300 pb-1">
                  {selectedRubric.summaryFeedback}
                </p>
                {selectedRubric.criteria.map((crit) => (
                  <div key={crit.id} className="pt-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--comfort-text)]">{crit.label}</span>
                      <span
                        className={`font-mono font-bold text-xs tabular-nums ${
                          crit.passed
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {crit.earnedPoints}/{crit.maxPoints} poin
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--comfort-text-muted)]">
                      Terukur: {crit.measuredSummary}
                    </div>
                    <p className="text-[11px] text-[var(--comfort-text-muted)] leading-snug">
                      {crit.feedback}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hipotesis & Kesimpulan */}
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
              <span className="font-bold text-[11px] text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                Hipotesis Siswa:
              </span>
              <p className="text-[var(--comfort-text)] leading-relaxed">
                {selectedSubmission.hypothesisText || '—'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[var(--comfort-text-muted)] uppercase tracking-wider">
                  Data Observasi ({selectedSubmission.observationData?.length || 0} Titik Uji)
                </span>
                <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                  {selectedSubmission.regressionMetrics?.equation || 'y = mx + c'}
                </span>
              </div>
              {selectedSubmission.observationData && selectedSubmission.observationData.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[var(--comfort-border)]">
                  <table className="w-full text-left text-[11px] font-mono tabular-nums">
                    <thead className="bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]">
                      <tr>
                        {Object.keys(selectedSubmission.observationData[0]).map((k) => (
                          <th key={k} className="px-2 py-1 font-semibold">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--comfort-border)]">
                      {selectedSubmission.observationData.slice(0, 4).map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, cIdx) => (
                            <td key={cIdx} className="px-2 py-1 text-[var(--comfort-text)]">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
              <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                Kesimpulan Siswa:
              </span>
              <p className="text-[var(--comfort-text)] leading-relaxed">
                {selectedSubmission.conclusionText || '—'}
              </p>
            </div>
          </div>

          {/* Teacher Grading & Feedback Form */}
          <form
            onSubmit={onSaveGrade}
            className="p-4 rounded-2xl bg-[var(--comfort-surface)] border border-sky-500/30 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Evaluasi &amp; Nilai Pengajar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--comfort-text)] mb-1">
                  Nilai Numerik (0–100):
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={gradingScore}
                  onChange={(e) => onChangeGradingScore(Number(e.target.value))}
                  className="w-full text-base font-mono font-bold px-3 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] focus:outline-none focus:border-sky-500 tabular-nums"
                  required
                />
              </div>

              <div className="text-[11px] text-[var(--comfort-text-muted)]">
                Skor Kuis LKS:{' '}
                <strong className="font-mono text-[var(--comfort-text)] tabular-nums">
                  {selectedSubmission.quizScore}/100
                </strong>
                <br />
                Rekomendasi Rubrik RK4:{' '}
                <strong className="font-mono text-teal-600 dark:text-teal-400 tabular-nums">
                  {selectedRubric.score}/100
                </strong>
                <br />
                Status: {selectedSubmission.teacherGrade ? 'Sudah Dinilai' : 'Menunggu Penilaian'}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--comfort-text)] mb-1">
                Catatan Evaluasi / Umpan Balik Guru:
              </label>
              <textarea
                rows={2}
                value={gradingFeedback}
                onChange={(e) => onChangeGradingFeedback(e.target.value)}
                placeholder="Tuliskan apresiasi, koreksi metodologi, atau saran pendalaman teori..."
                className="w-full text-xs p-2.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {toastMessage && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {toastMessage}
                </span>
              )}
              <button
                type="submit"
                disabled={isSubmittingGrade}
                className="ml-auto px-5 py-2 min-h-[38px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingGrade ? 'Menyimpan...' : 'Simpan Nilai & Beri Evaluasi'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center text-[var(--comfort-text-muted)] p-8 space-y-2">
          <FileText className="w-10 h-10 opacity-40" />
          <p className="text-sm font-semibold text-[var(--comfort-text)]">
            Pilih Laporan Siswa di Panel Kiri
          </p>
          <p className="text-xs max-w-sm">
            Klik salah satu laporan yang masuk untuk meninjau data hipotesis, grafik regresi, rincian rubrik RK4, dan memberi nilai akhir.
          </p>
        </div>
      )}
    </div>
  );
};
