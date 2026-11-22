import React from 'react';
import {
  CheckCircle2,
  Download,
  Lightbulb,
  Lock,
  Send,
  Users,
  Wand2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gradeWorksheetAnswers, WorksheetQuestion } from '../../utils/scienceEngine';
import { CustomAIMissionPayload } from '../../utils/collabProtocol';
import { labSound } from '../../utils/soundEngine';

export interface WorksheetQuestionListProps {
  activeCustomMission: CustomAIMissionPayload | null;
  customMissionAnswers: Record<string, string>;
  onChangeCustomMissionAnswer: (questionId: string, value: string) => void;
  filteredQuestions: WorksheetQuestion[];
  answers: Record<string, string>;
  onChangeAnswer: (questionId: string, value: string) => void;
  hintLevelByQuestion: Record<string, number>;
  onAdvanceHint: (questionId: string) => void;
  gradedResult: ReturnType<typeof gradeWorksheetAnswers> | null;
  isSubmissionLocked: boolean;
  isSubmittingReport: boolean;
  onGradeForm: (e: React.FormEvent) => void;
  onOpenRotationModal: () => void;
  onDownloadOfflineRlab: () => void;
  onSubmitReportToTeacher: () => void;
}

export const WorksheetQuestionList: React.FC<WorksheetQuestionListProps> = ({
  activeCustomMission,
  customMissionAnswers,
  onChangeCustomMissionAnswer,
  filteredQuestions,
  answers,
  onChangeAnswer,
  hintLevelByQuestion,
  onAdvanceHint,
  gradedResult,
  isSubmissionLocked,
  isSubmittingReport,
  onGradeForm,
  onOpenRotationModal,
  onDownloadOfflineRlab,
  onSubmitReportToTeacher,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      {/* Active Teacher AI Custom Mission Contextual LKS Questions */}
      {activeCustomMission && (
        <div
          data-testid="lks-custom-ai-mission-section"
          className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/35 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold">
                <Wand2 className="w-3 h-3" />
                <span>MISI STUDI KASUS GURU · ROOM {activeCustomMission.roomId}</span>
              </span>
              <h4 className="text-sm font-extrabold text-[var(--comfort-text)] mt-1">
                {activeCustomMission.title}
              </h4>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Target {activeCustomMission.targetVariable.variableLabel}:{' '}
              {activeCustomMission.targetVariable.minSuccessValue} –{' '}
              {activeCustomMission.targetVariable.maxSuccessValue}{' '}
              {activeCustomMission.targetVariable.unit}
            </span>
          </div>
          <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
            {activeCustomMission.narrative}
          </p>
          <div className="space-y-2.5 pt-1">
            {activeCustomMission.contextualQuestions.slice(0, 3).map((cq, idx) => (
              <div
                key={cq.id || idx}
                className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-indigo-500/25 space-y-1.5"
              >
                <div className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Pertanyaan Kontekstual Studi Kasus #{idx + 1}
                </div>
                <p className="text-xs font-semibold text-[var(--comfort-text)]">
                  {cq.questionText}
                </p>
                <input
                  type="text"
                  disabled={isSubmissionLocked}
                  value={customMissionAnswers[cq.id] || ''}
                  onChange={(e) => onChangeCustomMissionAnswer(cq.id, e.target.value)}
                  placeholder={`Petunjuk: ${cq.hint}`}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LKS Questions Form */}
      <form onSubmit={onGradeForm} className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-center text-xs text-[var(--comfort-text-muted)]">
            Tidak ada soal LKS pada filter domain ini. Pilih "Semua" untuk melihat seluruh soal.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => {
              const userAns = answers[q.id] || '';
              const hintLvl = hintLevelByQuestion[q.id] || 0;
              const evalItem = gradedResult?.results?.[q.id];

              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--comfort-text-muted)]">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                          Soal {idx + 1} · {q.domain}
                        </span>
                        <span>·</span>
                        <span className="font-semibold">
                          {t('lks.weight')}: {Math.round(100 / (filteredQuestions.length || 1))}{' '}
                          {t('lks.points')}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--comfort-text)] leading-relaxed comfort-prose">
                        {q.questionText}
                      </p>
                    </div>

                    {/* Scaffolded Hint Trigger */}
                    <button
                      type="button"
                      disabled={isSubmissionLocked}
                      onClick={() => onAdvanceHint(q.id)}
                      className="px-2.5 py-1.5 min-h-[34px] rounded-lg bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>
                        {t('lks.hint')} ({hintLvl}/3)
                      </span>
                    </button>
                  </div>

                  {/* Scaffolded Hints Accordion */}
                  {hintLvl > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-[var(--comfort-text)] space-y-1">
                      <div className="font-bold text-[11px] text-amber-800 dark:text-amber-300">
                        {hintLvl === 1
                          ? 'Petunjuk Tingkat 1 (Konseptual):'
                          : hintLvl === 2
                          ? 'Petunjuk Tingkat 2 (Rumus & Variabel):'
                          : 'Petunjuk Tingkat 3 (Langkah Solusi):'}
                      </div>
                      <p className="text-[11px] leading-relaxed comfort-prose">
                        {q.scaffoldedHints?.[hintLvl - 1] || q.formulaHint || q.explanation}
                      </p>
                    </div>
                  )}

                  {/* Input and Evaluation Feedback */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={isSubmissionLocked}
                      value={userAns}
                      onChange={(e) => {
                        if (!isSubmissionLocked) {
                          onChangeAnswer(q.id, e.target.value);
                        }
                      }}
                      placeholder={t('lks.answerPlaceholder')}
                      className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] focus:outline-none focus:border-sky-500 font-mono disabled:opacity-60"
                    />
                    {evalItem && (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          evalItem.isCorrect
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {evalItem.isCorrect ? '✓ Benar' : '✗ Kurang Tepat'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit and Grade Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {gradedResult && (
            <div className="flex items-center gap-2 text-xs text-[var(--comfort-text)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                Nilai LKS:{' '}
                <strong className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {gradedResult.totalScore}/100
                </strong>{' '}
                ({gradedResult.correctCount} dari {gradedResult.totalQuestions} Soal Benar)
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="submit"
              disabled={isSubmissionLocked}
              className="px-4 py-2 min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              {t('lks.checkGrade')}
            </button>
            <button
              type="button"
              data-testid="bottom-pass-and-play-rotation-btn"
              onClick={() => {
                labSound.playClick();
                onOpenRotationModal();
              }}
              title="Simpan laporan kelompok aktif dan reset meja praktikum untuk giliran kelompok berikutnya"
              className="px-4 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Simpan &amp; Ganti Giliran Kelompok</span>
            </button>
            <button
              type="button"
              data-testid="download-offline-rlab-btn"
              onClick={onDownloadOfflineRlab}
              title="Unduh paket tugas luring (.rlab) terenkapsulasi anti-tamper untuk dikumpulkan via Flashdisk/Bluetooth tanpa kuota"
              className="px-4 py-2 min-h-[40px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File Tugas Luring (.rlab)</span>
            </button>
            <button
              type="button"
              onClick={onSubmitReportToTeacher}
              disabled={isSubmittingReport || isSubmissionLocked}
              className="px-5 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              {isSubmissionLocked ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {isSubmissionLocked
                  ? 'Laporan Terkunci'
                  : isSubmittingReport
                  ? t('lks.submitting')
                  : t('lks.submitReport')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
