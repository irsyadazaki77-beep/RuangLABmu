import React from 'react';
import { CheckCircle2, Clock, FileText, Package, PlayCircle } from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
import { type EvaluatedRubricReport } from '../../shared/grading/rubricEngine';
import { labSound } from '../../utils/soundEngine';

export interface GradebookSubmissionsListProps {
  submissions: LabSubmission[];
  isLoading: boolean;
  selectedSubmissionId?: string;
  resolveSubmissionRubric: (sub: LabSubmission) => EvaluatedRubricReport;
  onSelectSubmission: (sub: LabSubmission) => void;
  onOpenReplay: (sub: LabSubmission) => void;
}

export const GradebookSubmissionsList: React.FC<GradebookSubmissionsListProps> = ({
  submissions,
  isLoading,
  selectedSubmissionId,
  resolveSubmissionRubric,
  onSelectSubmission,
  onOpenReplay,
}) => {
  return (
    <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-[var(--comfort-border)] overflow-y-auto divide-y divide-[var(--comfort-border)]">
      {isLoading && submissions.length === 0 ? (
        <div className="p-8 text-center text-[var(--comfort-text-muted)] space-y-2">
          <Clock className="w-7 h-7 mx-auto opacity-60" aria-hidden="true" />
          <p className="text-xs font-medium">Memuat daftar laporan siswa...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="p-8 text-center text-[var(--comfort-text-muted)] space-y-2">
          <FileText className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-xs">Tidak ada data penyerahan laporan yang sesuai kriteria.</p>
        </div>
      ) : (
        submissions.map((sub) => {
          const isSelected = selectedSubmissionId === sub.id;
          const isGraded = Boolean(sub.teacherGrade);
          const rubric = resolveSubmissionRubric(sub);

          return (
            <div
              key={sub.id}
              onClick={() => onSelectSubmission(sub)}
              className={`p-4 transition-colors cursor-pointer space-y-2 ${
                isSelected
                  ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/40'
                  : 'hover:bg-[var(--comfort-surface-subtle)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-xs sm:text-sm text-[var(--comfort-text)]">
                      {sub.studentName}
                    </h4>
                    {sub.id.startsWith('RLAB-') && (
                      <span
                        data-testid="offline-submission-badge"
                        className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30"
                      >
                        <Package className="w-2.5 h-2.5" />
                        <span>Luring (.rlab)</span>
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-[var(--comfort-text-muted)]">
                      · {sub.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--comfort-text-muted)] font-medium mt-0.5">
                    Modul: {sub.moduleId} ({sub.domain})
                  </p>
                </div>

                <div className="text-right shrink-0">
                  {isGraded ? (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{sub.teacherGrade?.score}/100</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Rubrik: {rubric.score}/100</span>
                    </span>
                  )}
                  <div className="text-[10px] text-[var(--comfort-text-muted)] mt-0.5 tabular-nums">
                    Kuis: {sub.quizScore}/100 · RK4: {rubric.score}/100
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-1 italic flex-1">
                  "{sub.hypothesisText || 'Tidak ada hipotesis tertulis'}"
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    labSound.playClick();
                    onOpenReplay(sub);
                  }}
                  aria-label={`Lihat Replay Praktikum ${sub.studentName}`}
                  className="px-2.5 py-1 min-h-[32px] rounded-lg bg-sky-500/10 hover:bg-sky-600 hover:text-white text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Lihat Replay Praktikum</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
