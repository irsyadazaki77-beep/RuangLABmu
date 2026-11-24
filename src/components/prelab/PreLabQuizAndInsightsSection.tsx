import React from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Calculator,
  CheckCircle2,
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
import { extractConceptHint, formatCleanEquation } from '../../utils/spatialHudHelpers';
import { labSound } from '../../utils/soundEngine';
import { Accordion, AccordionGroup } from '../ui/Accordion';
import { DIYLocalWisdomCard } from '../ui/DIYLocalWisdomCard';
import { InteractiveFormulaPrimer } from '../ui/InteractiveFormulaPrimer';
import { SciFormula } from '../ui/ScientificNotation';

interface PreLabInsightsPanelProps {
  experiment: ExperimentModule;
}

const renderMisconceptionItem = (item: string, idx: number) => {
  const parts = item.split(/Faktanya:|Fakta:/i);
  const misconception = parts[0]?.trim() || item;
  const fact = parts[1]?.trim() || '';

  return (
    <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-2 text-xs">
      <div className="flex items-start gap-2.5">
        <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--comfort-danger)]" aria-hidden="true" />
        <div className="leading-relaxed comfort-prose">
          <span className="font-bold text-[var(--comfort-danger)]">Mitos: </span>
          <span className="text-[var(--comfort-text)]">{misconception}</span>
        </div>
      </div>
      {fact && (
        <div className="flex items-start gap-2.5 pl-6">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--comfort-success)]" aria-hidden="true" />
          <div className="leading-relaxed comfort-prose">
            <span className="font-bold text-[var(--comfort-success)]">Fakta: </span>
            <span className="text-[var(--comfort-text-muted)]">{fact}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const PreLabInsightsPanel: React.FC<PreLabInsightsPanelProps> = ({ experiment }) => {
  const misconceptions = experiment.commonMisconceptions ?? [];
  const coreMisconceptions = misconceptions.slice(0, 1);
  const extraMisconceptions = misconceptions.slice(1);

  const industryApps = experiment.realWorldApplications ?? [];
  const coreApps = industryApps.slice(0, 1);
  const extraApps = industryApps.slice(1);

  return (
    <AccordionGroup className="space-y-4">
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 space-y-4">
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

      {misconceptions.length > 0 && (
        <Accordion
          title="Klinik Miskonsepsi: Mitos vs Fakta"
          meta={`${misconceptions.length} poin`}
          icon={<Lightbulb className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
          collapsedLabel="Lihat miskonsepsi lainnya"
          expandedLabel="Tampilkan 1 poin utama"
          hiddenCount={extraMisconceptions.length > 0 ? extraMisconceptions.length : undefined}
          testId="prelab-misconceptions-accordion"
          preview={
            <div className="divide-y divide-[var(--comfort-border)]">
              {coreMisconceptions.map((item, idx) => renderMisconceptionItem(item, idx))}
            </div>
          }
        >
          {extraMisconceptions.length > 0 ? (
            <div className="divide-y divide-[var(--comfort-border)]">
              {extraMisconceptions.map((item, idx) => renderMisconceptionItem(item, idx + 1))}
            </div>
          ) : null}
        </Accordion>
      )}

      {industryApps.length > 0 && (
        <Accordion
          title="Aplikasi Nyata & Industri di Indonesia"
          meta={`${industryApps.length} kasus`}
          icon={<Factory className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
          collapsedLabel="Lihat kasus industri lainnya"
          expandedLabel="Tampilkan 1 kasus utama"
          hiddenCount={extraApps.length > 0 ? extraApps.length : undefined}
          testId="prelab-industry-apps-accordion"
          preview={
            <div className="divide-y divide-[var(--comfort-border)] text-xs">
              {coreApps.map((appText, idx) => (
                <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5">
                  <span className="font-mono text-2xs font-bold text-[var(--comfort-accent)] tabular-nums mt-0.5 shrink-0">
                    0{idx + 1}.
                  </span>
                  <p className="text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                    {appText}
                  </p>
                </div>
              ))}
            </div>
          }
        >
          {extraApps.length > 0 ? (
            <div className="divide-y divide-[var(--comfort-border)] text-xs">
              {extraApps.map((appText, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                  <span className="font-mono text-2xs font-bold text-[var(--comfort-accent)] tabular-nums mt-0.5 shrink-0">
                    0{idx + 2}.
                  </span>
                  <p className="text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                    {appText}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </Accordion>
      )}

      {experiment.deepDiveContent && (
        <Accordion
          title="Penurunan Rumus & Sejarah Penemuan"
          meta="Pengayaan"
          icon={<GraduationCap className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
          defaultOpen={false}
          testId="prelab-deep-dive-accordion"
        >
          <div className="space-y-4">
            {experiment.deepDiveContent.historicalContext && (
              <div className="text-xs space-y-1 text-[var(--comfort-text-muted)] leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                  <History className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                  <span>Konteks Sejarah Sains</span>
                </div>
                <p className="comfort-prose">{experiment.deepDiveContent.historicalContext}</p>
              </div>
            )}

            {experiment.deepDiveContent.derivationLatex &&
              experiment.deepDiveContent.derivationLatex.length > 0 && (
                <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2">
                  <div className="text-xs font-semibold text-[var(--comfort-text)] flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                    <span>Langkah Penurunan Matematis</span>
                  </div>
                  <div className="space-y-1.5">
                    {experiment.deepDiveContent.derivationLatex.map((step, idx) => (
                      <div
                        key={idx}
                        className="py-1.5 px-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] font-mono text-xs text-[var(--comfort-accent)] overflow-x-auto flex items-center gap-2"
                      >
                        <span className="text-[var(--comfort-text-muted)] font-mono text-2xs shrink-0 tabular-nums">
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
              <div className="pt-3 border-t border-[var(--comfort-border)] text-xs text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                <strong className="text-[var(--comfort-text)]">Konsep Lanjutan: </strong>
                {experiment.deepDiveContent.advancedConcept}
              </div>
            )}
          </div>
        </Accordion>
      )}
    </AccordionGroup>
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
                ? 'text-[var(--comfort-success)]'
                : 'text-[var(--comfort-text-muted)]'
            }`}
            aria-hidden="true"
          />
          <span>SIM Laboratorium K3</span>
        </div>
        <span
          className={`font-mono text-2xs font-bold uppercase tracking-wider ${
            activeLicense?.status === 'TERVERIFIKASI'
              ? 'text-[var(--comfort-success)]'
              : 'text-[var(--comfort-warning)]'
          }`}
        >
          {activeLicense?.status === 'TERVERIFIKASI' ? 'Terverifikasi' : 'Menunggu Syarat'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-2xs text-[var(--comfort-text-muted)]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2
            className={`w-3.5 h-3.5 shrink-0 ${
              k3Complied ? 'text-[var(--comfort-success)]' : 'text-[var(--comfort-text-muted)]'
            }`}
            aria-hidden="true"
          />
          <span>1. Patuh SOP K3</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          <Award
            className={`w-3.5 h-3.5 shrink-0 ${
              quizScorePct >= MIN_PASSING_PRELAB_SCORE
                ? 'text-[var(--comfort-success)]'
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
          className="w-full py-2 px-3 rounded-lg comfort-btn-primary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Buka &amp; Cetak SIM Lab ({activeLicense.licenseId})</span>
        </button>
      ) : (
        <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
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
            <span className="text-base font-bold text-[var(--comfort-success)]">
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
                  className="px-2 py-0.5 rounded-md comfort-btn-secondary font-semibold text-2xs flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                >
                  <Lightbulb className="w-3 h-3 text-[var(--comfort-warning)] shrink-0" aria-hidden="true" />
                  <span>{hintOpen ? 'Tutup Petunjuk' : 'Petunjuk'}</span>
                </button>
              </div>

              {hintOpen && (
                <div className="p-2.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-2xs text-[var(--comfort-text)] leading-relaxed">
                  <strong className="text-[var(--comfort-accent)]">Petunjuk Konsep:</strong>{' '}
                  {extractConceptHint(q.explanation)}
                </div>
              )}

              <div className="space-y-1.5">
                {q.options.map((opt, optIdx) => {
                  const isChoice = selected === optIdx;
                  let btnStyle =
                    'bg-[var(--comfort-surface)] border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-[var(--comfort-accent-border)]';

                  if (quizSubmitted) {
                    if (optIdx === q.correctIndex) {
                      btnStyle =
                        'bg-[var(--comfort-success-soft)] border-[var(--comfort-success)] text-[var(--comfort-success)] font-bold';
                    } else if (isChoice && !isCorrect) {
                      btnStyle =
                        'bg-[var(--comfort-danger-soft)] border-[var(--comfort-danger)] text-[var(--comfort-danger)]';
                    }
                  } else if (isChoice) {
                    btnStyle = 'comfort-accent-soft font-bold';
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
                <div className="pt-1 text-2xs text-[var(--comfort-text-muted)]">
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
            className="w-full py-2.5 px-4 rounded-lg comfort-btn-primary font-semibold text-xs transition-colors disabled:opacity-40 cursor-pointer"
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
          className={`w-full py-3 px-5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            quizSubmitted ? 'comfort-btn-primary shadow-sm' : 'comfort-btn-secondary'
          }`}
        >
          <span>{readyOpen3DLabel}</span>
          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
