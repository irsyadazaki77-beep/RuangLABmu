import React, { useEffect, useMemo, useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
} from 'lucide-react';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { getExperimentById } from '../../registry/experimentRegistry';
import { generateDynamicPostLabQuiz } from '../../utils/dynamicWorksheetEngine';
import { labSound } from '../../utils/soundEngine';

export interface PostLabMasteryQuizProps {
  records: ExperimentRecord[];
  activeStudentName: string;
  moduleId?: string;
  domain?: string;
  onQuizCompleted?: (score: number, correctCount: number) => void;
}

const SOURCE_TAG_LABELS: Record<'data-aktual' | 'analisis-kurva' | 'metodologi', string> = {
  'data-aktual': 'Data Aktual',
  'analisis-kurva': 'Analisis Kurva',
  metodologi: 'Metodologi Ilmiah',
};

export const PostLabMasteryQuiz: React.FC<PostLabMasteryQuizProps> = ({
  records,
  activeStudentName,
  moduleId,
  domain,
  onQuizCompleted,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    setSelectedAnswers({});
    setIsSubmitted(false);
  }, [moduleId]);

  const activeModule = useMemo(
    () => (moduleId ? getExperimentById(moduleId) : undefined),
    [moduleId]
  );

  const questions = useMemo(
    () => generateDynamicPostLabQuiz(activeModule, records, domain),
    [activeModule, records, domain]
  );

  const handleSelectOption = (qId: string, optKey: string) => {
    if (isSubmitted) return;
    labSound.playClick();
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optKey }));
  };

  const handleEvaluateQuiz = () => {
    labSound.playRecordSuccess();
    setIsSubmitted(true);

    let correctCount = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctKey) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / Math.max(1, questions.length)) * 100);
    onQuizCompleted?.(score, correctCount);
  };

  const handleRetake = () => {
    labSound.playClick();
    setSelectedAnswers({});
    setIsSubmitted(false);
  };

  const answeredCount = questions.filter((q) => Boolean(selectedAnswers[q.id])).length;
  const correctCount = questions.filter((q) => selectedAnswers[q.id] === q.correctKey).length;
  const score = Math.round((correctCount / Math.max(1, questions.length)) * 100);

  return (
    <div
      data-testid="postlab-mastery-quiz"
      className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-5 shadow-sm space-y-4"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-[var(--comfort-text)]">
              Kuis Evaluasi Pemahaman Pasca-Praktikum (Kontekstual)
            </h3>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              3 soal dinamis berbasis kurva regresi &amp; data pengamatan {activeStudentName} ({activeModule?.title || domain || 'Sains'})
            </p>
          </div>
        </div>

        {isSubmitted && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Skor Kuis: {score} / 100</span>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const userAns = selectedAnswers[q.id];
          const isCorrect = userAns === q.correctKey;

          return (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    Pertanyaan #{idx + 1}
                  </span>
                  <span className="text-[var(--comfort-border)]">·</span>
                  <span className="text-2xs font-medium text-[var(--comfort-text-muted)]">
                    {SOURCE_TAG_LABELS[q.sourceTag]}
                  </span>
                </div>
                {isSubmitted && (
                  <span
                    className={`inline-flex items-center gap-1 text-2xs font-bold ${
                      isCorrect ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Benar (+33.3)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> Kurang Tepat
                      </>
                    )}
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-[var(--comfort-text)] leading-relaxed">
                {q.question}
              </p>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {q.options.map((opt) => {
                  const isSelected = userAns === opt.key;
                  let optStyle =
                    'border-[var(--comfort-border)] hover:border-sky-400 bg-[var(--comfort-surface)] text-[var(--comfort-text)]';

                  if (isSubmitted) {
                    if (opt.key === q.correctKey) {
                      optStyle =
                        'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-bold';
                    } else if (isSelected && !isCorrect) {
                      optStyle =
                        'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200 line-through';
                    }
                  } else if (isSelected) {
                    optStyle =
                      'border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-200 font-bold';
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectOption(q.id, opt.key)}
                      className={`text-left text-xs p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${optStyle}`}
                    >
                      <span className="font-mono font-bold text-[var(--comfort-text-muted)] shrink-0">
                        {opt.key}.
                      </span>
                      <span className="leading-relaxed">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {isSubmitted && (
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/25 text-2xs text-[var(--comfort-text)] leading-relaxed">
                  <strong>Pembahasan Ilmiah:</strong> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-[var(--comfort-text-muted)] tabular-nums">
          Terjawab {answeredCount} dari {questions.length} soal
        </div>

        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <button
              type="button"
              onClick={handleRetake}
              className="px-4 py-2 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] hover:opacity-90 text-[var(--comfort-text)] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ulangi Kuis</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={answeredCount < questions.length}
              onClick={handleEvaluateQuiz}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              Kirim Jawaban Kuis
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
