import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Factory,
  GraduationCap,
  HelpCircle,
  History,
  Lightbulb,
  XCircle,
} from 'lucide-react';
import { ExperimentModule } from '../../registry/experimentRegistry';
import {
  LabSafetyLicense,
  MIN_PASSING_PRELAB_SCORE,
} from '../../services/labLicenseEngine';
import { formatCleanEquation } from '../../utils/spatialHudHelpers';
import { labSound } from '../../utils/soundEngine';
import { DIYLocalWisdomCard } from '../ui/DIYLocalWisdomCard';
import { InteractiveFormulaPrimer } from '../ui/InteractiveFormulaPrimer';
import { SciFormula } from '../ui/ScientificNotation';

interface PreLabInsightsPanelProps {
  experiment: ExperimentModule;
}

export const PreLabInsightsPanel: React.FC<PreLabInsightsPanelProps> = ({ experiment }) => {
  const [showMisconceptions, setShowMisconceptions] = useState(true);
  const [showIndustryApps, setShowIndustryApps] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);

  return (
    <div className="space-y-5">
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
        <InteractiveFormulaPrimer
          moduleId={experiment.id}
          domain={experiment.domain}
          defaultExpanded={true}
        />

        <DIYLocalWisdomCard
          domain={experiment.domain}
          moduleId={experiment.id}
          defaultExpanded={false}
        />
      </div>

      {experiment.commonMisconceptions && experiment.commonMisconceptions.length > 0 && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowMisconceptions((prev) => !prev)}
            aria-expanded={showMisconceptions}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                <span>Klinik Miskonsepsi: Mitos vs Fakta Ilmiah</span>
              </div>
              <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                Klarifikasi konsep · {experiment.commonMisconceptions.length} poin penting
              </div>
            </div>
            {showMisconceptions ? (
              <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            )}
          </button>

          {showMisconceptions && (
            <div className="px-5 pb-5 pt-2 border-t border-[var(--comfort-border)] space-y-3">
              {experiment.commonMisconceptions.map((item, idx) => {
                const parts = item.split(/Faktanya:|Fakta:/i);
                const misconception = parts[0]?.trim() || item;
                const fact = parts[1]?.trim() || '';

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2.5 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" aria-hidden="true" />
                      <div>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          Mitos Umum:{' '}
                        </span>
                        <span className="text-[var(--comfort-text)]">{misconception}</span>
                      </div>
                    </div>
                    {fact && (
                      <div className="flex items-start gap-2.5 pt-2 border-t border-[var(--comfort-border)]">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden="true" />
                        <div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            Fakta Ilmiah:{' '}
                          </span>
                          <span className="text-[var(--comfort-text-muted)] leading-relaxed">
                            {fact}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {experiment.realWorldApplications && experiment.realWorldApplications.length > 0 && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowIndustryApps((prev) => !prev)}
            aria-expanded={showIndustryApps}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
                <Factory className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                <span>Aplikasi Nyata &amp; Industri di Indonesia</span>
              </div>
              <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                Konteks nasional &amp; industri · {experiment.realWorldApplications.length} studi kasus
              </div>
            </div>
            {showIndustryApps ? (
              <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            )}
          </button>

          {showIndustryApps && (
            <div className="px-5 pb-5 pt-3 border-t border-[var(--comfort-border)] grid grid-cols-1 sm:grid-cols-3 gap-3">
              {experiment.realWorldApplications.map((appText, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-col justify-between text-xs space-y-2"
                >
                  <div className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    0{idx + 1} · Aplikasi
                  </div>
                  <p className="text-[var(--comfort-text-muted)] leading-relaxed text-xs">
                    {appText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {experiment.deepDiveContent && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDeepDive((prev) => !prev)}
            aria-expanded={showDeepDive}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
                <GraduationCap className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden="true" />
                <span>Bedah Penurunan Rumus &amp; Sejarah Penemuan</span>
              </div>
              <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                Pengayaan konseptual &amp; derivasi matematis
              </div>
            </div>
            {showDeepDive ? (
              <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            )}
          </button>

          {showDeepDive && (
            <div className="px-5 pb-5 pt-3 border-t border-[var(--comfort-border)] space-y-4">
              {experiment.deepDiveContent.historicalContext && (
                <div className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs space-y-1.5 text-[var(--comfort-text-muted)] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                    <History className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                    <span>Konteks Sejarah Sains:</span>
                  </div>
                  <p className="comfort-prose">{experiment.deepDiveContent.historicalContext}</p>
                </div>
              )}

              {experiment.deepDiveContent.derivationLatex &&
                experiment.deepDiveContent.derivationLatex.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[var(--comfort-text-muted)] flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                      <span>Langkah Penurunan Matematis Eksak:</span>
                    </div>
                    <div className="space-y-1.5">
                      {experiment.deepDiveContent.derivationLatex.map((step, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-xs text-indigo-600 dark:text-indigo-300 overflow-x-auto flex items-center gap-2"
                        >
                          <span className="text-[var(--comfort-text-muted)] font-mono text-[10px] shrink-0 tabular-nums">
                            [{idx + 1}]
                          </span>
                          <span className="font-semibold">
                            <SciFormula text={formatCleanEquation(step)} wrap />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {experiment.deepDiveContent.advancedConcept && (
                <div className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                  <strong className="text-[var(--comfort-text)]">Konsep Lanjutan &amp; Batasan: </strong>
                  {experiment.deepDiveContent.advancedConcept}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

interface PreLabSafetyLicenseCardProps {
  activeLicense: LabSafetyLicense | null;
  k3Complied: boolean;
  quizScorePct: number;
  onOpenLicenseModal: () => void;
}

export const PreLabSafetyLicenseCard: React.FC<PreLabSafetyLicenseCardProps> = ({
  activeLicense,
  k3Complied,
  quizScorePct,
  onOpenLicenseModal,
}) => {
  return (
    <div className="p-3.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--comfort-text)]">
          <BadgeCheck
            className={`w-4 h-4 shrink-0 ${
              activeLicense?.status === 'TERVERIFIKASI'
                ? 'text-emerald-500'
                : 'text-[var(--comfort-text-muted)]'
            }`}
            aria-hidden="true"
          />
          <span>SIM Laboratorium K3</span>
        </div>
        <span
          className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
            activeLicense?.status === 'TERVERIFIKASI'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {activeLicense?.status === 'TERVERIFIKASI' ? 'Terverifikasi' : 'Menunggu Syarat'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--comfort-text-muted)]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2
            className={`w-3.5 h-3.5 shrink-0 ${
              k3Complied ? 'text-emerald-500' : 'text-[var(--comfort-text-muted)]'
            }`}
            aria-hidden="true"
          />
          <span>1. Patuh SOP K3</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <Award
            className={`w-3.5 h-3.5 shrink-0 ${
              quizScorePct >= MIN_PASSING_PRELAB_SCORE
                ? 'text-emerald-500'
                : 'text-[var(--comfort-text-muted)]'
            }`}
            aria-hidden="true"
          />
          <span>
            2. Kuis ≥ {MIN_PASSING_PRELAB_SCORE}% ({quizScorePct}%)
          </span>
        </div>
      </div>

      {activeLicense?.status === 'TERVERIFIKASI' ? (
        <button
          type="button"
          onClick={() => {
            labSound.playSuccessChime();
            onOpenLicenseModal();
          }}
          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Buka &amp; Cetak SIM Lab ({activeLicense.licenseId})</span>
        </button>
      ) : (
        <p className="text-[11px] text-[var(--comfort-text-muted)] leading-relaxed">
          Klik <strong className="text-[var(--comfort-text)]">&quot;Saya Patuh K3&quot;</strong> dan selesaikan Kuis Pra-Lab (minimal skor {MIN_PASSING_PRELAB_SCORE}%) untuk menerbitkan kartu SIM Lab ber-QR Code.
        </p>
      )}
    </div>
  );
};

interface PreLabQuizCardProps {
  experiment: ExperimentModule;
  selectedAnswers: Record<string, number>;
  quizSubmitted: boolean;
  quizResult: { correct: number; total: number; percentage: number } | null;
  openedQuizHints: Record<string, boolean>;
  k3Complied: boolean;
  activeLicense: LabSafetyLicense | null;
  readyOpen3DLabel: string;
  onSelectOption: (questionId: string, optionIdx: number) => void;
  onToggleHint: (questionId: string) => void;
  onSubmitQuiz: () => void;
  onResetQuiz: () => void;
  onOpenLicenseModal: () => void;
  onProceedToSimulation: () => void;
}

export const PreLabQuizCard: React.FC<PreLabQuizCardProps> = ({
  experiment,
  selectedAnswers,
  quizSubmitted,
  quizResult,
  openedQuizHints,
  k3Complied,
  activeLicense,
  readyOpen3DLabel,
  onSelectOption,
  onToggleHint,
  onSubmitQuiz,
  onResetQuiz,
  onOpenLicenseModal,
  onProceedToSimulation,
}) => {
  const effectivePct = quizResult?.percentage ?? activeLicense?.preLabQuizScorePct ?? 0;

  return (
    <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--comfort-border)]">
        <div>
          <h2 className="text-sm font-bold text-[var(--comfort-text)] flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
            <span>Kuis Kesiapan Pra-Praktikum</span>
          </h2>
          <p className="text-xs text-[var(--comfort-text-muted)] mt-0.5">
            Dilengkapi petunjuk konsep bertahap sebelum memasuki kokpit 3D
          </p>
        </div>
        {quizResult && (
          <div className="text-right font-mono tabular-nums">
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {quizResult.correct}/{quizResult.total}
            </span>
            <span className="text-xs text-[var(--comfort-text-muted)] ml-1">
              ({quizResult.percentage}%)
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {experiment.preLabQuiz.map((q, qIdx) => {
          const selected = selectedAnswers[q.id];
          const isCorrect = selected === q.correctIndex;
          const hintOpen = Boolean(openedQuizHints[q.id]);

          return (
            <div
              key={q.id}
              className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-xs text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                    0{qIdx + 1}.
                  </span>
                  <p className="text-xs font-semibold text-[var(--comfort-text)] leading-relaxed comfort-prose">
                    {q.question}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleHint(q.id)}
                  className="px-2 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                >
                  <Lightbulb className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{hintOpen ? 'Tutup Petunjuk' : 'Petunjuk'}</span>
                </button>
              </div>

              {hintOpen && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-[var(--comfort-text)] leading-relaxed">
                  <strong>Petunjuk Konsep:</strong> {q.explanation.split('.')[0]}.
                </div>
              )}

              <div className="space-y-1.5">
                {q.options.map((opt, optIdx) => {
                  const isChoice = selected === optIdx;
                  let btnStyle =
                    'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-sky-500';

                  if (quizSubmitted) {
                    if (optIdx === q.correctIndex) {
                      btnStyle =
                        'bg-emerald-500/18 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                    } else if (isChoice && !isCorrect) {
                      btnStyle =
                        'bg-rose-500/18 border-rose-500 text-rose-700 dark:text-rose-300';
                    }
                  } else if (isChoice) {
                    btnStyle =
                      'bg-sky-500/18 border-sky-500 text-sky-700 dark:text-sky-300 font-bold';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => onSelectOption(q.id, optIdx)}
                      className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${btnStyle}`}
                    >
                      <span className="font-mono mr-1.5 opacity-60">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {quizSubmitted && (
                <div className="pt-1 text-[11px] text-[var(--comfort-text-muted)]">
                  <strong className="text-[var(--comfort-text)]">Penjelasan:</strong> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex flex-col gap-2.5">
        {!quizSubmitted ? (
          <button
            type="button"
            onClick={onSubmitQuiz}
            disabled={Object.keys(selectedAnswers).length < experiment.preLabQuiz.length}
            className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer"
          >
            Periksa Jawaban Kuis Pra-Lab
          </button>
        ) : (
          <button
            type="button"
            onClick={onResetQuiz}
            className="w-full py-2 text-xs text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
          >
            Ulangi Kuis Pra-Lab
          </button>
        )}

        <PreLabSafetyLicenseCard
          activeLicense={activeLicense}
          k3Complied={k3Complied}
          quizScorePct={effectivePct}
          onOpenLicenseModal={onOpenLicenseModal}
        />

        <button
          type="button"
          onClick={onProceedToSimulation}
          className="w-full py-3 px-5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <span>{readyOpen3DLabel}</span>
          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
