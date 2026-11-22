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

  return (
    <div className="space-y-5">
      {/* Theory & Key Equations */}
      <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm border-b border-[var(--comfort-border)] pb-3">
          <BookOpen className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
          <h2>Tinjauan Teori Ilmiah &amp; Persamaan Kunci</h2>
        </div>

        <p className="text-xs sm:text-sm text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
          {experiment.theorySummary}
        </p>

        {experiment.keyEquations.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-semibold text-[var(--comfort-text-muted)]">
              Rumus &amp; Hukum Dasar:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {experiment.keyEquations.map((eq, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-xs text-[var(--comfort-accent)] font-semibold leading-relaxed"
                >
                  <SciFormula text={formatCleanEquation(eq)} wrap />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Objectives */}
        <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2.5">
          <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-xs">
            <ListChecks className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
            <h3>Capaian Pembelajaran (Jenjang {activeTier})</h3>
          </div>
          <ul className="space-y-2 text-xs text-[var(--comfort-text-muted)]">
            {currentObjectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5 leading-relaxed comfort-prose">
                <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0 tabular-nums">
                  0{i + 1}.
                </span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Structured Takeaways, Real-World Analogy, Variable Table, Worked Example & Glossary */}
      <PreLabWorkedExampleAndGlossary experiment={experiment} />

      {/* Scientific Investigation Guide */}
      {experiment.stepByStepGuide && experiment.stepByStepGuide.length > 0 && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-3">
            <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
              <Compass className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <h2>Panduan Investigasi Ilmiah Terarah</h2>
            </div>
            <span className="text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
              {experiment.stepByStepGuide.length} Tahap
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {experiment.stepByStepGuide.map((stepText, idx) => {
              const cleanStep = stepText.replace(/^\d+\.\s*/, '');
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-start gap-2.5 text-xs text-[var(--comfort-text)] leading-relaxed"
                >
                  <span className="font-mono font-bold text-[11px] text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <span>{cleanStep}</span>
                </div>
              );
            })}
          </div>
        </section>
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
  return (
    <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
        <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
          <h2>{safetyTitle}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleK3Narration}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
              isSpeakingK3
                ? 'bg-amber-500 text-slate-950'
                : 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{isSpeakingK3 ? stopLabel : listenLabel}</span>
          </button>

          <button
            type="button"
            onClick={onComplyK3}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
              k3Complied
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{k3Complied ? compliedLabel : complyLabel}</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {experiment.safetyNotes.map((note, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/25 text-xs text-[var(--comfort-text)] flex items-start gap-2.5 leading-relaxed comfort-prose"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{note}</span>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2.5">
        <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-xs">
          <Atom className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
          <h3>{apparatusHeader}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {experiment.apparatusList.map((app, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-center gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
              <span className="text-[var(--comfort-text)] font-medium">{app}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
