import React, { useState } from 'react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  K3 & Pra-Praktikum
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-sm">
                  Jenjang {activeTier}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {experiment.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 text-xs font-semibold bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('objectives')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'objectives'
                ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Capaian Pembelajaran
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('safety')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'safety'
                ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Alat, Bahan & K3
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'quiz'
                ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Kuis Kesiapan (Pre-Lab)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-700 dark:text-slate-300 space-y-4">
          {/* TAB 1: OBJECTIVES */}
          {activeTab === 'objectives' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">
                  Capaian Pembelajaran (Learning Outcomes) — {activeTier}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Kompetensi yang diharapkan dicapai oleh praktikan setelah menyelesaikan modul ini:
                </p>
                <ul className="space-y-2">
                  {currentObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">
                  Ringkasan Dasar Teori
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                  {experiment.theorySummary}
                </p>
              </div>

              {experiment.keyEquations.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1.5 uppercase tracking-wide">
                    Persamaan Matematis Kunci
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {experiment.keyEquations.map((eq, i) => (
                      <div
                        key={i}
                        className="font-mono text-xs p-2.5 bg-slate-900 text-sky-300 rounded-lg border border-slate-800"
                      >
                        {eq}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAFETY & APPARATUS */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              {/* Safety Rules */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  K3 (Kesehatan & Keselamatan Kerja Laboratorium)
                </div>
                <ul className="space-y-2 text-xs text-amber-900 dark:text-amber-200">
                  {experiment.safetyNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Apparatus List */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2">
                  Daftar Alat & Bahan Praktikum
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {experiment.apparatusList.map((app, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/80"
                    >
                      <div className="w-5 h-5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-[10px]">
                        {i + 1}
                      </div>
                      <span className="text-slate-800 dark:text-slate-200">{app}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRE-LAB QUIZ */}
          {activeTab === 'quiz' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Kuis Kesiapan Konsep & Prosedur
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Jawab pertanyaan singkat berikut untuk memvalidasi pemahaman awal sebelum simulasi:
                  </p>
                </div>
                {submittedQuiz && quizResult && (
                  <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
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
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {qIdx + 1}. {q.question}
                    </p>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = userSelected === optIdx;
                        let optionStyle = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60';

                        if (submittedQuiz) {
                          if (optIdx === q.correctIndex) {
                            optionStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold';
                          } else if (isChosen && !isCorrect) {
                            optionStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300';
                          } else {
                            optionStyle = 'border-slate-200 dark:border-slate-700 opacity-50';
                          }
                        } else if (isChosen) {
                          optionStyle = 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-semibold';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${optionStyle}`}
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
                      <div className="text-[11px] p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 text-sky-900 dark:text-sky-200 mt-2 leading-relaxed">
                        <span className="font-bold">Penjelasan: </span>
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
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-colors"
                  >
                    Periksa Jawaban Kuis
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                  >
                    Ulangi Kuis
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs transition-colors"
          >
            Lanjutkan ke Ruang Laboratorium
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
