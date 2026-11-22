import React, { useState } from 'react';
import {
  BookMarked,
  Calculator,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Sparkles,
  TableProperties,
} from 'lucide-react';
import type { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';

interface PreLabWorkedExampleAndGlossaryProps {
  experiment: ExperimentModule;
}

const ROLE_LABELS: Record<'bebas' | 'terikat' | 'konstanta', { text: string; tone: string }> = {
  bebas: { text: 'Variabel Bebas', tone: 'text-sky-600 dark:text-sky-400' },
  terikat: { text: 'Variabel Terikat', tone: 'text-emerald-600 dark:text-emerald-400' },
  konstanta: { text: 'Tetapan', tone: 'text-amber-600 dark:text-amber-400' },
};

export const PreLabWorkedExampleAndGlossary: React.FC<PreLabWorkedExampleAndGlossaryProps> = ({
  experiment,
}) => {
  const [showSolution, setShowSolution] = useState(false);
  const [showGlossary, setShowGlossary] = useState(true);

  const hasTakeaways = Boolean(experiment.keyTakeaways && experiment.keyTakeaways.length > 0);
  const hasAnalogy = Boolean(experiment.everydayAnalogy);
  const hasBreakdown = Boolean(experiment.formulaBreakdown && experiment.formulaBreakdown.length > 0);
  const hasWorkedExample = Boolean(experiment.workedExample);
  const hasGlossary = Boolean(experiment.glossary && experiment.glossary.length > 0);

  if (!hasTakeaways && !hasAnalogy && !hasBreakdown && !hasWorkedExample && !hasGlossary) {
    return null;
  }

  return (
    <div className="space-y-5" data-testid="prelab-structured-pedagogy">
      {/* 1. Intisari Konsep & Analogi Dunia Nyata */}
      {(hasTakeaways || hasAnalogy) && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-4">
          {hasTakeaways && experiment.keyTakeaways && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
                <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
                  <h2>Intisari Konsep yang Wajib Dipahami</h2>
                </div>
                <span className="text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
                  {experiment.keyTakeaways.length} Poin Kunci
                </span>
              </div>

              <ol className="space-y-2.5 text-xs sm:text-[13px] text-[var(--comfort-text)]">
                {experiment.keyTakeaways.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 leading-relaxed comfort-prose"
                  >
                    <span className="font-mono font-bold text-[11px] text-[var(--comfort-accent)] shrink-0 mt-0.5 tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {hasAnalogy && experiment.everydayAnalogy && (
            <div className="pt-3 border-t border-[var(--comfort-border)] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--comfort-text)]">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                <span>Analogi Dunia Nyata · {experiment.everydayAnalogy.title}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2 text-xs leading-relaxed comfort-prose">
                <p className="text-[var(--comfort-text)]">
                  {experiment.everydayAnalogy.scenario}
                </p>
                <p className="text-[var(--comfort-text-muted)] pt-1.5 border-t border-[var(--comfort-border)]">
                  <strong className="text-[var(--comfort-text)]">Kaitan Ilmiah: </strong>
                  {experiment.everydayAnalogy.connection}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. Bedah Variabel & Satuan SI */}
      {hasBreakdown && experiment.formulaBreakdown && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
            <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
              <TableProperties className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <h2>Bedah Simbol, Variabel &amp; Satuan</h2>
            </div>
            <span className="text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
              {experiment.formulaBreakdown.length} Besaran
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--comfort-border)] text-[11px] text-[var(--comfort-text-muted)]">
                  <th className="py-2 pr-3 font-semibold whitespace-nowrap">Simbol</th>
                  <th className="py-2 pr-3 font-semibold">Besaran &amp; Peran</th>
                  <th className="py-2 pr-3 font-semibold whitespace-nowrap">Satuan</th>
                  <th className="py-2 font-semibold">Makna Fisis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--comfort-border)]">
                {experiment.formulaBreakdown.map((item, idx) => {
                  const roleMeta = ROLE_LABELS[item.role];
                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-2.5 pr-3 font-mono font-bold text-[var(--comfort-accent)] whitespace-nowrap">
                        {item.symbol}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-[var(--comfort-text)]">{item.name}</div>
                        <div className={`text-[10px] font-mono font-semibold mt-0.5 ${roleMeta.tone}`}>
                          {roleMeta.text}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[var(--comfort-text-muted)] whitespace-nowrap">
                        {item.unit}
                      </td>
                      <td className="py-2.5 text-[var(--comfort-text-muted)] leading-relaxed">
                        {item.explanation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 3. Contoh Soal Terpandu (Interaktif Step-by-Step) */}
      {hasWorkedExample && experiment.workedExample && (
        <section
          data-testid="prelab-worked-example"
          className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 sm:p-6 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
            <div className="flex items-center gap-2 text-[var(--comfort-text)] font-bold text-sm">
              <Calculator className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              <h2>Contoh Soal &amp; Pembahasan Terpandu</h2>
            </div>
            <button
              type="button"
              data-testid="toggle-worked-example-btn"
              onClick={() => {
                labSound.playClick();
                setShowSolution((prev) => !prev);
              }}
              aria-expanded={showSolution}
              className="px-3 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] hover:border-sky-500/60 text-xs font-semibold text-[var(--comfort-text)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{showSolution ? 'Sembunyikan Pembahasan' : 'Tampilkan Pembahasan Bertahap'}</span>
              {showSolution ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
            </button>
          </div>

          <p className="text-xs sm:text-[13px] text-[var(--comfort-text)] font-medium leading-relaxed comfort-prose">
            {experiment.workedExample.question}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-[var(--comfort-text-muted)] pt-0.5 tabular-nums">
            <span className="font-sans font-semibold text-[var(--comfort-text)]">Diketahui:</span>
            {experiment.workedExample.given.map((g, i) => (
              <span key={i}>
                {i > 0 && <span className="mr-3 opacity-50" aria-hidden="true">·</span>}
                {g}
              </span>
            ))}
          </div>

          {showSolution && (
            <div className="pt-3 border-t border-[var(--comfort-border)] space-y-3">
              <ol className="space-y-2 text-xs text-[var(--comfort-text)]">
                {experiment.workedExample.steps.map((st, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-start gap-2.5 leading-relaxed tabular-nums"
                  >
                    <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      0{idx + 1}.
                    </span>
                    <span>{st}</span>
                  </li>
                ))}
              </ol>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1 text-xs">
                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  Jawaban Akhir: {experiment.workedExample.answer}
                </div>
                <p className="text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                  <strong className="text-[var(--comfort-text)]">Makna Fisis: </strong>
                  {experiment.workedExample.physicalMeaning}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Glosarium Istilah Penting */}
      {hasGlossary && experiment.glossary && (
        <section className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setShowGlossary((prev) => !prev);
            }}
            aria-expanded={showGlossary}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
              <BookMarked className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span>Glosarium Istilah Penting</span>
              <span className="text-[11px] font-mono font-normal text-[var(--comfort-text-muted)] tabular-nums">
                ({experiment.glossary.length} istilah)
              </span>
            </div>
            {showGlossary ? (
              <ChevronUp className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            )}
          </button>

          {showGlossary && (
            <dl className="px-5 pb-5 pt-3 border-t border-[var(--comfort-border)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {experiment.glossary.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-1"
                >
                  <dt className="font-bold text-[var(--comfort-text)]">{item.term}</dt>
                  <dd className="text-[var(--comfort-text-muted)] leading-relaxed">{item.definition}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  );
};
