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
  Atom,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import { labSound } from '../utils/soundEngine';
import { Accordion, AccordionGroup } from './ui/Accordion';

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

  const coreObjectives = currentObjectives.slice(0, 2);
  const extraObjectives = currentObjectives.slice(2);
  const firstSentenceSummary =
    experiment.theorySummary.split(/(?<=[.!?])\s+/)[0]?.trim() || experiment.theorySummary;
  const hasExtendedTheory =
    experiment.theorySummary.length > firstSentenceSummary.length + 12 ||
    experiment.keyEquations.length > 1;
  const primaryEquation = experiment.keyEquations[0];
  const secondaryEquations = experiment.keyEquations.slice(1);

  const coreSafetyNotes = experiment.safetyNotes.slice(0, 2);
  const extraSafetyNotes = experiment.safetyNotes.slice(2);

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
            <div className="w-9 h-9 rounded-xl comfort-accent-soft border flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-semibold text-[var(--comfort-accent)] uppercase tracking-wider">
                  K3 &amp; Pra-Praktikum
                </span>
                <span className="text-2xs font-mono font-medium text-[var(--comfort-text-muted)]">
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
            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
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
                ? 'border-[var(--comfort-accent)] text-[var(--comfort-accent)]'
                : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            Capaian &amp; Teori
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('safety')}
            className={`py-3 min-h-[44px] border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'safety'
                ? 'border-[var(--comfort-accent)] text-[var(--comfort-accent)]'
                : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--comfort-warning)]" aria-hidden="true" />
            Alat, Bahan &amp; K3
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`py-3 min-h-[44px] border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'quiz'
                ? 'border-[var(--comfort-accent)] text-[var(--comfort-accent)]'
                : 'border-transparent text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
            Kuis Kesiapan (Pre-Lab)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-sm text-[var(--comfort-text)] space-y-4">
          {activeTab === 'objectives' && (
            <AccordionGroup>
              <Accordion
                title={`Capaian Pembelajaran — ${activeTier}`}
                meta={`${currentObjectives.length} poin`}
                icon={<CheckCircle2 className="w-4 h-4 text-[var(--comfort-success)]" aria-hidden="true" />}
                collapsedLabel="Lihat capaian lainnya"
                expandedLabel="Tampilkan 2 poin utama"
                hiddenCount={extraObjectives.length > 0 ? extraObjectives.length : undefined}
                testId="modal-objectives-accordion"
                preview={
                  <ul className="space-y-2">
                    {coreObjectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed comfort-prose">
                        <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
                          0{i + 1}.
                        </span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                }
              >
                {extraObjectives.length > 0 ? (
                  <ul className="space-y-2">
                    {extraObjectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed comfort-prose">
                        <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
                          0{i + 3}.
                        </span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Accordion>

              <Accordion
                title="Ringkasan Dasar Teori & Persamaan Kunci"
                meta={experiment.keyEquations.length > 0 ? `${experiment.keyEquations.length} rumus` : undefined}
                icon={<BookOpen className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
                collapsedLabel="Lihat uraian lengkap"
                expandedLabel="Ringkas teori"
                hiddenCount={secondaryEquations.length > 0 ? secondaryEquations.length : undefined}
                testId="modal-theory-accordion"
                preview={
                  <div className="space-y-3">
                    <p className="comfort-prose text-xs text-[var(--comfort-text-muted)] leading-relaxed">
                      {firstSentenceSummary}
                    </p>
                    {primaryEquation && (
                      <div className="font-mono text-xs p-2.5 bg-[var(--comfort-surface-subtle)] text-[var(--comfort-accent)] rounded-lg border border-[var(--comfort-border)] font-semibold">
                        {primaryEquation}
                      </div>
                    )}
                  </div>
                }
              >
                {hasExtendedTheory ? (
                  <div className="space-y-3">
                    <p className="comfort-prose text-xs text-[var(--comfort-text-muted)] leading-relaxed">
                      {experiment.theorySummary}
                    </p>
                    {secondaryEquations.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {secondaryEquations.map((eq, i) => (
                          <div
                            key={i}
                            className="font-mono text-xs p-2.5 bg-[var(--comfort-surface-subtle)] text-[var(--comfort-accent)] rounded-lg border border-[var(--comfort-border)] font-semibold"
                          >
                            {eq}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </Accordion>
            </AccordionGroup>
          )}

          {activeTab === 'safety' && (
            <AccordionGroup>
              <Accordion
                title="K3 (Kesehatan & Keselamatan Kerja Laboratorium)"
                meta={`${experiment.safetyNotes.length} aturan`}
                variant="warning"
                icon={<AlertTriangle className="w-4 h-4 text-[var(--comfort-warning)]" aria-hidden="true" />}
                collapsedLabel={`Lihat semua ${experiment.safetyNotes.length} aturan K3`}
                expandedLabel="Tampilkan 2 poin utama"
                hiddenCount={extraSafetyNotes.length > 0 ? extraSafetyNotes.length : undefined}
                testId="modal-safety-accordion"
                preview={
                  <ul className="space-y-2 text-xs text-[var(--comfort-text)]">
                    {coreSafetyNotes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed comfort-prose">
                        <span className="font-bold text-[var(--comfort-warning)] shrink-0">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                }
              >
                {extraSafetyNotes.length > 0 ? (
                  <ul className="space-y-2 text-xs text-[var(--comfort-text)]">
                    {extraSafetyNotes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed comfort-prose">
                        <span className="font-bold text-[var(--comfort-warning)] shrink-0">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Accordion>

              <Accordion
                title="Daftar Alat & Bahan Praktikum"
                meta={`${experiment.apparatusList.length} item`}
                icon={<Atom className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
                defaultOpen={false}
                testId="modal-apparatus-accordion"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {experiment.apparatusList.map((app, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs p-2.5 bg-[var(--comfort-surface-subtle)] rounded-lg border border-[var(--comfort-border)]"
                    >
                      <span className="font-mono font-bold text-2xs text-[var(--comfort-accent)] shrink-0 tabular-nums">
                        {String(i + 1).padStart(2, '0')}.
                      </span>
                      <span className="text-[var(--comfort-text)]">{app}</span>
                    </div>
                  ))}
                </div>
              </Accordion>
            </AccordionGroup>
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
                  <div className="px-3 py-1 bg-[var(--comfort-success-soft)] border border-[var(--comfort-success)]/30 rounded-lg text-xs font-bold text-[var(--comfort-success)] flex items-center gap-1.5 font-mono tabular-nums">
                    <Award className="w-4 h-4" aria-hidden="true" />
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
                          'border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] hover:border-[var(--comfort-accent-border)]';

                        if (submittedQuiz) {
                          if (optIdx === q.correctIndex) {
                            optionStyle =
                              'border-[var(--comfort-success)] bg-[var(--comfort-success-soft)] text-[var(--comfort-success)] font-semibold';
                          } else if (isChosen && !isCorrect) {
                            optionStyle =
                              'border-[var(--comfort-danger)] bg-[var(--comfort-danger-soft)] text-[var(--comfort-danger)]';
                          } else {
                            optionStyle =
                              'border-[var(--comfort-border)] bg-[var(--comfort-surface)] opacity-55';
                          }
                        } else if (isChosen) {
                          optionStyle = 'comfort-accent-soft font-semibold';
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
                              <CheckCircle2 className="w-4 h-4 text-[var(--comfort-success)] shrink-0" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {submittedQuiz && (
                      <div className="text-2xs p-2.5 rounded-lg comfort-accent-soft border text-[var(--comfort-text)] mt-2 leading-relaxed">
                        <span className="font-bold text-[var(--comfort-accent)]">Penjelasan: </span>
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
                    className="comfort-btn-primary px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Periksa Jawaban Kuis
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="comfort-btn-secondary px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
            className="comfort-btn-primary flex items-center gap-2 px-5 py-2 min-h-[40px] text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Lanjutkan ke Ruang Laboratorium
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
