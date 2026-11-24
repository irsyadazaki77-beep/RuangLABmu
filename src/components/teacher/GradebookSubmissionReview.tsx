import React from 'react';
import { Award, FileCheck2, FileText, PlayCircle, Send, Table } from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
import { type EvaluatedRubricReport } from '../../shared/grading/rubricEngine';
import { labSound } from '../../utils/soundEngine';
import { Accordion } from '../ui/Accordion';

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

const renderRubricCriterion = (
  crit: EvaluatedRubricReport['criteria'][number]
) => (
  <div key={crit.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-bold text-[var(--comfort-text)]">{crit.label}</span>
      <span
        className={`font-mono font-bold text-xs tabular-nums ${
          crit.passed ? 'text-[var(--comfort-success)]' : 'text-[var(--comfort-warning)]'
        }`}
      >
        {crit.earnedPoints}/{crit.maxPoints}
      </span>
    </div>
    <div className="text-2xs font-mono text-[var(--comfort-text-muted)]">
      {crit.measuredSummary}
    </div>
    <p className="comfort-report-prose text-[var(--comfort-text-muted)]">{crit.feedback}</p>
  </div>
);

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
  // Prioritize criteria needing improvement first so the 2-point preview highlights key gaps
  const sortedCriteria = selectedRubric
    ? [...selectedRubric.criteria].sort((a, b) => Number(a.passed) - Number(b.passed))
    : [];
  const previewCriteria = sortedCriteria.slice(0, 2);
  const extraCriteria = sortedCriteria.slice(2);

  return (
    <div className="w-full flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--comfort-surface-subtle)]">
      {selectedSubmission && selectedRubric ? (
        <div className="space-y-4">
          {/* Submission Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
            <div>
              <span className="text-2xs font-mono text-[var(--comfort-accent)] font-semibold">
                {selectedSubmission.id} ·{' '}
                {new Date(selectedSubmission.submittedAt).toLocaleString('id-ID')}
              </span>
              <h3 className="text-base font-extrabold text-[var(--comfort-text)] mt-0.5">
                {selectedSubmission.studentName}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-xs text-[var(--comfort-success)] tabular-nums">
                R² = {selectedSubmission.regressionMetrics?.rSquared?.toFixed(3) ?? '0.99'} · m ={' '}
                {selectedSubmission.regressionMetrics?.slope?.toFixed(2) ?? '1.00'}
              </span>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onOpenReplay(selectedSubmission);
                }}
                className="comfort-btn-secondary px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <PlayCircle className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                <span>Replay 3D</span>
              </button>
            </div>
          </div>

          {/* Progressive Disclosure RK4 Rubric Accordion (2 core criteria visible initially) */}
          <Accordion
            title="Rubrik Otomatis RK4"
            subtitle={selectedRubric.summaryFeedback}
            meta={`${selectedRubric.score}/${selectedRubric.maxScore} · ±${selectedRubric.rk4TolerancePct}% · ${
              selectedRubric.passed ? 'Lulus' : 'Perlu Penguatan'
            }`}
            icon={<FileCheck2 className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
            variant="accent"
            open={expandedRubricOpen}
            onToggle={() => onToggleRubricOpen()}
            collapsedLabel={`Lihat semua ${selectedRubric.criteria.length} kriteria`}
            expandedLabel="Tampilkan 2 kriteria utama"
            collapsedHint="Menampilkan 2 kriteria prioritas rubrik RK4"
            expandedHint="Seluruh kriteria evaluasi rubrik RK4 ditampilkan"
            hiddenCount={extraCriteria.length > 0 ? extraCriteria.length : undefined}
            testId="teacher-rubric-breakdown-panel"
            toggleTestId="teacher-rubric-breakdown-toggle"
            previewClassName="px-4 py-3 divide-y divide-[var(--comfort-border)]"
            contentClassName="px-4 pb-4 pt-3 border-t border-[var(--comfort-border)] divide-y divide-[var(--comfort-border)]"
            preview={<>{previewCriteria.map(renderRubricCriterion)}</>}
          >
            {extraCriteria.length > 0 ? <>{extraCriteria.map(renderRubricCriterion)}</> : null}
          </Accordion>

          {/* Balanced 2-Column Side-by-Side Hipotesis & Kesimpulan with Hairline Separation */}
          <div className="rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--comfort-border)]">
            <div className="p-4 space-y-1.5">
              <span className="font-bold text-2xs text-[var(--comfort-accent)] uppercase tracking-wider block">
                Hipotesis Siswa
              </span>
              <p className="text-[var(--comfort-text)] comfort-report-prose">
                {selectedSubmission.hypothesisText || '—'}
              </p>
            </div>

            <div className="p-4 space-y-1.5">
              <span className="font-bold text-2xs text-[var(--comfort-accent)] uppercase tracking-wider block">
                Kesimpulan Siswa
              </span>
              <p className="text-[var(--comfort-text)] comfort-report-prose">
                {selectedSubmission.conclusionText || '—'}
              </p>
            </div>
          </div>

          {/* Collapsible Observation Data Table */}
          <Accordion
            title="Tabel Data Observasi"
            meta={`${selectedSubmission.observationData?.length || 0} titik · ${selectedSubmission.regressionMetrics?.equation || 'y = mx + c'}`}
            icon={<Table className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
            defaultOpen={false}
            testId="gradebook-observation-accordion"
            contentClassName="p-4 border-t border-[var(--comfort-border)]"
          >
            {selectedSubmission.observationData && selectedSubmission.observationData.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[var(--comfort-border)]">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]">
                    <tr>
                      {Object.keys(selectedSubmission.observationData[0]).map((k) => (
                        <th key={k} className="px-2.5 py-1.5 font-semibold">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--comfort-border)]">
                    {selectedSubmission.observationData.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((val, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 text-[var(--comfort-text)]">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Tidak ada tabel data observasi terlampir.
              </p>
            )}
          </Accordion>

          {/* Teacher Grading & Feedback Form */}
          <form
            onSubmit={onSaveGrade}
            className="p-4 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-accent-border)] space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[var(--comfort-accent)] font-bold text-xs uppercase tracking-wider">
                <Award className="w-4 h-4" aria-hidden="true" />
                <span>Evaluasi &amp; Nilai Pengajar</span>
              </div>
              <div className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                Kuis {selectedSubmission.quizScore}/100 · RK4 {selectedRubric.score}/100 ·{' '}
                {selectedSubmission.teacherGrade ? 'Sudah Dinilai' : 'Menunggu'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[var(--comfort-text)] mb-1">
                  Nilai (0–100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={gradingScore}
                  onChange={(e) => onChangeGradingScore(Number(e.target.value))}
                  className="w-full text-base font-mono font-bold px-3 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] focus:outline-none focus:border-[var(--comfort-accent)] tabular-nums"
                  required
                />
              </div>

              <div className="sm:col-span-9">
                <label className="block text-xs font-semibold text-[var(--comfort-text)] mb-1">
                  Catatan Evaluasi Guru
                </label>
                <textarea
                  rows={2}
                  value={gradingFeedback}
                  onChange={(e) => onChangeGradingFeedback(e.target.value)}
                  placeholder="Tuliskan apresiasi, koreksi metodologi, atau saran pendalaman teori..."
                  className="w-full text-[0.8125rem] leading-relaxed p-2.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] focus:outline-none focus:border-[var(--comfort-accent)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {toastMessage && (
                <span className="text-xs font-bold text-[var(--comfort-success)]">
                  {toastMessage}
                </span>
              )}
              <button
                type="submit"
                disabled={isSubmittingGrade}
                className="comfort-btn-primary ml-auto px-4 py-2 min-h-[38px] rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isSubmittingGrade ? 'Menyimpan...' : 'Simpan Nilai & Evaluasi'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center text-[var(--comfort-text-muted)] p-8 space-y-2">
          <FileText className="w-10 h-10 opacity-40" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--comfort-text)]">
            Pilih Laporan Siswa di Panel Kiri
          </p>
          <p className="text-xs max-w-sm">
            Klik salah satu laporan yang masuk untuk meninjau hipotesis, rubrik RK4, dan memberi nilai akhir.
          </p>
        </div>
      )}
    </div>
  );
};
