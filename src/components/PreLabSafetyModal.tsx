import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ListChecks,
  Award,
  ArrowRight,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';

interface PreLabSafetyModalProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
  isOpen: boolean;
  onClose: () => void;
  onProceedToLab?: () => void;
}

export const PreLabSafetyModal: React.FC<PreLabSafetyModalProps> = ({
  experiment,
  activeTier,
  isOpen,
  onClose,
  onProceedToLab,
}) => {
  const [activeTab, setActiveTab] = useState<'objectives' | 'safety' | 'quiz'>('objectives');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentObjectives =
    experiment.objectives[activeTier] ||
    experiment.objectives.SMA ||
    experiment.objectives.SMP ||
    [];

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (submittedQuiz) return;
    labSound.playClick();
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const calculateScore = () => {
    let correct = 0;
    experiment.preLabQuiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correct++;
      }
    });
    return {
      correct,
      total: experiment.preLabQuiz.length,
      percentage: Math.round((correct / Math.max(1, experiment.preLabQuiz.length)) * 100),
    };
  };

  const handleCheckQuiz = () => {
    labSound.playRecordSuccess();
    setSubmittedQuiz(true);
  };

  const handleResetQuiz = () => {
    labSound.playClick();
    setSelectedAnswers({});
    setSubmittedQuiz(false);
  };

  const quizResult = submittedQuiz ? calculateScore() : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`K3 dan Pra-Praktikum ${experiment.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                  K3 &amp; Pra-Praktikum
                </span>
                <span className="text-[11px] font-mono font-medium text-[var(--comfort-text-muted)]">
                  · Jenjang {activeTier}
                </span>
              </div>
              <h3 className="text-base font-bold text-[var(--comfort-text)] leading-tight">
                {experiment.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pra-praktikum"
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--comfort-border)] px-6 gap-6 text-xs font-semibold bg-[var(--comfort-surface)] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('objectives')}
            className={`py-3 min-h-[44px] border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'objectives'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Capaian Pembelajaran
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('safety')}
            className={`py-3 min-h-[44px] border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'safety'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Alat, Bahan &amp; K3
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`py-3 min-h-[44px] border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'quiz'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Kuis Kesiapan (Pre-Lab)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-[var(--comfort-text)] space-y-4">
          {activeTab === 'objectives' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-[var(--comfort-text)] text-sm mb-1">
                  Capaian Pembelajaran (Learning Outcomes) — {activeTier}
                </h4>
                <p className="text-xs text-[var(--comfort-text-muted)] mb-3">
                  Kompetensi yang diharapkan dicapai oleh praktikan setelah menyelesaikan modul ini:
                </p>
                <ul className="space-y-2">
                  {currentObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-[var(--comfort-border)]">
                <h4 className="font-bold text-[var(--comfort-text)] text-sm mb-1.5">
                  Ringkasan Dasar Teori
                </h4>
                <p className="comfort-prose text-xs text-[var(--comfort-text-muted)] leading-relaxed bg-[var(--comfort-surface-subtle)] p-3.5 rounded-xl border border-[var(--comfort-border)]">
                  {experiment.theorySummary}
                </p>
              </div>

              {experiment.keyEquations.length > 0 && (
                <div>
                  <h4 className="font-bold text-[var(--comfort-text)] text-xs mb-1.5 uppercase tracking-wide">
                    Persamaan Matematis Kunci
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {experiment.keyEquations.map((eq, i) => (
                      <div
                        key={i}
                        className="font-mono text-xs p-2.5 bg-[var(--comfort-surface-subtle)] text-sky-700 dark:text-sky-300 rounded-lg border border-[var(--comfort-border)] font-semibold"
                      >
                        {eq}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35">
                <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  K3 (Kesehatan &amp; Keselamatan Kerja Laboratorium)
                </div>
                <ul className="space-y-2 text-xs text-[var(--comfort-text)]">
                  {experiment.safetyNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-[var(--comfort-text)] text-sm mb-2">
                  Daftar Alat &amp; Bahan Praktikum
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {experiment.apparatusList.map((app, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs p-2.5 bg-[var(--comfort-surface-subtle)] rounded-lg border border-[var(--comfort-border)]"
                    >
                      <div className="w-5 h-5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-[var(--comfort-text)]">{app}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-[var(--comfort-text)] text-sm">
                    Kuis Kesiapan Konsep &amp; Prosedur
                  </h4>
                  <p className="text-xs text-[var(--comfort-text-muted)]">
                    Jawab pertanyaan singkat berikut untuk memvalidasi pemahaman awal sebelum simulasi:
                  </p>
                </div>
                {submittedQuiz && quizResult && (
                  <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/35 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-mono tabular-nums">
                    <Award className="w-4 h-4" />
                    Skor: {quizResult.percentage}/100 ({quizResult.correct}/{quizResult.total} Benar)
                  </div>
                )}
              </div>

              {experiment.preLabQuiz.map((q, qIdx) => {
                const userSelected = selectedAnswers[q.id];
                const isCorrect = userSelected === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-2.5"
                  >
                    <p className="text-xs font-semibold text-[var(--comfort-text)] leading-relaxed">
                      {qIdx + 1}. {q.question}
                    </p>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = userSelected === optIdx;
                        let optionStyle =
                          'border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] hover:border-sky-500/60';

                        if (submittedQuiz) {
                          if (optIdx === q.correctIndex) {
                            optionStyle =
                              'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold';
                          } else if (isChosen && !isCorrect) {
                            optionStyle =
                              'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300';
                          } else {
                            optionStyle =
                              'border-[var(--comfort-border)] bg-[var(--comfort-surface)] opacity-55';
                          }
                        } else if (isChosen) {
                          optionStyle =
                            'border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-300 font-semibold';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            className={`w-full text-left p-2.5 min-h-[40px] rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${optionStyle}`}
                          >
                            <span>{opt}</span>
                            {submittedQuiz && optIdx === q.correctIndex && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {submittedQuiz && (
                      <div className="text-[11px] p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[var(--comfort-text)] mt-2 leading-relaxed">
                        <span className="font-bold text-sky-700 dark:text-sky-300">Penjelasan: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                {!submittedQuiz ? (
                  <button
                    type="button"
                    onClick={handleCheckQuiz}
                    disabled={Object.keys(selectedAnswers).length < experiment.preLabQuiz.length}
                    className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
                  >
                    Periksa Jawaban Kuis
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] hover:bg-[var(--comfort-elevated)] transition-colors cursor-pointer"
                  >
                    Ulangi Kuis
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playRecordSuccess();
              if (onProceedToLab) onProceedToLab();
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2 min-h-[40px] text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Lanjutkan ke Ruang Laboratorium
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
