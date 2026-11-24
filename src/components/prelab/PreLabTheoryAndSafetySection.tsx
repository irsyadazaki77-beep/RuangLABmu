import React from 'react';
import {
  AlertTriangle,
  Atom,
  BookOpen,
  CheckCircle2,
  Compass,
  ListChecks,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { EducationTier, ExperimentModule } from '../../registry/experimentRegistry';
import { formatCleanEquation } from '../../utils/spatialHudHelpers';
import { SciFormula } from '../ui/ScientificNotation';
import { Accordion } from '../ui/Accordion';
import { PreLabWorkedExampleAndGlossary } from './PreLabWorkedExampleAndGlossary';

interface PreLabTheoryPanelProps {
  experiment: ExperimentModule;
  activeTier: EducationTier;
}

export const PreLabTheoryPanel: React.FC<PreLabTheoryPanelProps> = ({
  experiment,
  activeTier,
}) => {
  const currentObjectives =
    experiment.objectives[activeTier] ||
    experiment.objectives.SMA ||
    experiment.objectives.SMP ||
    [];

  const takeaways = experiment.keyTakeaways ?? [];
  const coreTakeaways = takeaways.slice(0, 2);
  const extraTakeaways = takeaways.slice(2);
  const primaryEquation = experiment.keyEquations[0];
  const secondaryEquations = experiment.keyEquations.slice(1);
  const coreObjectives = currentObjectives.slice(0, 2);
  const extraObjectives = currentObjectives.slice(2);

  const firstSentenceSummary =
    experiment.theorySummary.split(/(?<=[.!?])\s+/)[0]?.trim() || experiment.theorySummary;

  const hasExpandableDetails =
    extraTakeaways.length > 0 ||
    secondaryEquations.length > 0 ||
    extraObjectives.length > 0 ||
    experiment.theorySummary.length > firstSentenceSummary.length + 12;

  const hiddenDetailCount =
    extraTakeaways.length + secondaryEquations.length + extraObjectives.length;

  return (
    <div className="space-y-4">
      {/* 1. Ringkasan Cepat (1–2 core takeaways, primary equation, 2 core objectives + progressive disclosure) */}
      <Accordion
        title="Ringkasan Cepat & Teori Inti"
        meta={`Jenjang ${activeTier}`}
        icon={<BookOpen className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
        collapsedLabel="Lihat Detail"
        expandedLabel="Ringkas"
        collapsedHint="Uraian teori lengkap & rumus pendukung dilipat agar ringkas"
        expandedHint="Menampilkan uraian teori dan capaian lengkap"
        hiddenCount={hiddenDetailCount > 0 ? hiddenDetailCount : undefined}
        testId="prelab-theory-accordion"
        toggleTestId="prelab-theory-detail-toggle"
        previewClassName="p-5 sm:p-6 space-y-4"
        contentClassName="px-5 sm:px-6 pb-5 pt-4 border-t border-[var(--comfort-border)] space-y-4"
        preview={
          <>
            {/* 1–2 Core Takeaways or Concise Lead Sentence */}
            {coreTakeaways.length > 0 ? (
              <ol className="space-y-2 text-xs sm:text-[0.8125rem] text-[var(--comfort-text)]">
                {coreTakeaways.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 leading-relaxed comfort-prose"
                  >
                    <span className="font-mono font-bold text-2xs text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs sm:text-sm text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                {firstSentenceSummary}
              </p>
            )}

            {/* Primary Equation */}
            {primaryEquation && (
              <div className="px-3.5 py-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2">
                <span className="text-2xs font-semibold text-[var(--comfort-text-muted)]">
                  Persamaan Utama
                </span>
                <div className="font-mono text-xs sm:text-[0.8125rem] text-[var(--comfort-accent)] font-semibold">
                  <SciFormula text={formatCleanEquation(primaryEquation)} wrap />
                </div>
              </div>
            )}

            {/* First 2 Learning Objectives */}
            {coreObjectives.length > 0 && (
              <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2">
                <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-xs">
                  <ListChecks className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                  <h4>Tujuan Utama Praktikum</h4>
                </div>
                <ul className="space-y-1.5 text-xs text-[var(--comfort-text-muted)]">
                  {coreObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2.5 leading-relaxed comfort-prose">
                      <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
                        0{i + 1}.
                      </span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      >
        {hasExpandableDetails ? (
          <>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[var(--comfort-text)]">
                Uraian Teori Lengkap
              </div>
              <p className="text-xs sm:text-[0.8125rem] text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                {experiment.theorySummary}
              </p>
            </div>

            {extraTakeaways.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[var(--comfort-text)]">
                  Intisari Konsep Tambahan
                </div>
                <ol className="space-y-2 text-xs text-[var(--comfort-text-muted)]">
                  {extraTakeaways.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 leading-relaxed comfort-prose"
                    >
                      <span className="font-mono font-bold text-2xs text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                        0{idx + 3}.
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {secondaryEquations.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[var(--comfort-text)]">
                  Persamaan Pendukung
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {secondaryEquations.map((eq, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-xs text-[var(--comfort-accent)] font-semibold leading-relaxed"
                    >
                      <SciFormula text={formatCleanEquation(eq)} wrap />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extraObjectives.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[var(--comfort-text)]">
                  Capaian Pembelajaran Lanjutan
                </div>
                <ul className="space-y-1.5 text-xs text-[var(--comfort-text-muted)]">
                  {extraObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2.5 leading-relaxed comfort-prose">
                      <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
                        0{i + 3}.
                      </span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </Accordion>

      {/* 2. Collapsed Reference Accordions: Analogy, Variables, Worked Example, Glossary */}
      <PreLabWorkedExampleAndGlossary experiment={experiment} />

      {/* 3. Collapsed Scientific Investigation Guide */}
      {experiment.stepByStepGuide && experiment.stepByStepGuide.length > 0 && (
        <Accordion
          title="Panduan Investigasi Ilmiah Terarah"
          meta={`${experiment.stepByStepGuide.length} tahap`}
          icon={<Compass className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="prelab-investigation-guide-accordion"
        >
          <ol className="divide-y divide-[var(--comfort-border)] text-xs text-[var(--comfort-text)]">
            {experiment.stepByStepGuide.map((stepText, idx) => {
              const cleanStep = stepText.replace(/^\d+\.\s*/, '');
              return (
                <li
                  key={idx}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5 leading-relaxed comfort-prose"
                >
                  <span className="font-mono font-bold text-2xs text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <span>{cleanStep}</span>
                </li>
              );
            })}
          </ol>
        </Accordion>
      )}
    </div>
  );
};

interface PreLabSafetyAndApparatusCardProps {
  experiment: ExperimentModule;
  isSpeakingK3: boolean;
  k3Complied: boolean;
  safetyTitle: string;
  listenLabel: string;
  stopLabel: string;
  complyLabel: string;
  compliedLabel: string;
  apparatusHeader: string;
  onToggleK3Narration: () => void;
  onComplyK3: () => void;
}

export const PreLabSafetyAndApparatusCard: React.FC<PreLabSafetyAndApparatusCardProps> = ({
  experiment,
  isSpeakingK3,
  k3Complied,
  safetyTitle,
  listenLabel,
  stopLabel,
  complyLabel,
  compliedLabel,
  apparatusHeader,
  onToggleK3Narration,
  onComplyK3,
}) => {
  const coreSafetyNotes = experiment.safetyNotes.slice(0, 2);
  const extraSafetyNotes = experiment.safetyNotes.slice(2);

  return (
    <div className="space-y-4">
      <Accordion
        title={safetyTitle}
        meta={`${experiment.safetyNotes.length} poin`}
        icon={<ShieldCheck className="w-4 h-4 text-[var(--comfort-warning)] shrink-0" aria-hidden="true" />}
        collapsedLabel={`Lihat semua ${experiment.safetyNotes.length} aturan K3`}
        expandedLabel="Tampilkan 2 poin utama"
        collapsedHint="Menampilkan 2 aturan K3 terpenting terlebih dahulu"
        expandedHint="Seluruh panduan keselamatan laboratorium ditampilkan"
        testId="prelab-k3-accordion"
        toggleTestId="prelab-k3-detail-toggle"
        previewClassName="px-4 sm:px-5 py-3.5"
        contentClassName="px-4 sm:px-5 pb-4 pt-3 border-t border-[var(--comfort-border)]"
        headerRight={
          <>
            <button
              type="button"
              onClick={onToggleK3Narration}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
                isSpeakingK3
                  ? 'comfort-accent-soft border'
                  : 'comfort-btn-secondary'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span>{isSpeakingK3 ? stopLabel : listenLabel}</span>
            </button>

            <button
              type="button"
              onClick={onComplyK3}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
                k3Complied
                  ? 'bg-[var(--comfort-success-soft)] text-[var(--comfort-success)] border border-[var(--comfort-success)]/30'
                  : 'comfort-btn-primary'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{k3Complied ? compliedLabel : complyLabel}</span>
            </button>
          </>
        }
        preview={
          <ul className="divide-y divide-[var(--comfort-border)]">
            {coreSafetyNotes.map((note, idx) => (
              <li
                key={idx}
                className="py-2.5 first:pt-0 last:pb-0 text-xs text-[var(--comfort-text)] flex items-start gap-2.5 leading-relaxed comfort-prose"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--comfort-warning)] shrink-0 mt-1" aria-hidden="true" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        }
      >
        {extraSafetyNotes.length > 0 ? (
          <ul className="divide-y divide-[var(--comfort-border)]">
            {extraSafetyNotes.map((note, idx) => (
              <li
                key={idx}
                className="py-2.5 first:pt-0 last:pb-0 text-xs text-[var(--comfort-text)] flex items-start gap-2.5 leading-relaxed comfort-prose"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--comfort-warning)] shrink-0 mt-1" aria-hidden="true" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Accordion>

      <Accordion
        title={apparatusHeader}
        meta={`${experiment.apparatusList.length} item`}
        icon={<Atom className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
        defaultOpen={false}
        testId="prelab-apparatus-accordion"
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {experiment.apparatusList.map((app, i) => (
            <li key={i} className="flex items-center gap-2 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span className="text-[var(--comfort-text)] font-medium">{app}</span>
            </li>
          ))}
        </ul>
      </Accordion>
    </div>
  );
};
