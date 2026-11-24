import React, { useState } from 'react';
import {
  BookMarked,
  Calculator,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TableProperties,
} from 'lucide-react';
import type { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import { Accordion } from '../ui/Accordion';

interface PreLabWorkedExampleAndGlossaryProps {
  experiment: ExperimentModule;
}

const ROLE_LABELS: Record<'bebas' | 'terikat' | 'konstanta', { text: string; tone: string }> = {
  bebas: { text: 'Variabel Bebas', tone: 'text-[var(--comfort-accent)]' },
  terikat: { text: 'Variabel Terikat', tone: 'text-[var(--comfort-success)]' },
  konstanta: { text: 'Tetapan', tone: 'text-[var(--comfort-warning)]' },
};

export const PreLabWorkedExampleAndGlossary: React.FC<PreLabWorkedExampleAndGlossaryProps> = ({
  experiment,
}) => {
  const [showSolution, setShowSolution] = useState(false);

  const hasAnalogy = Boolean(experiment.everydayAnalogy);
  const hasBreakdown = Boolean(experiment.formulaBreakdown && experiment.formulaBreakdown.length > 0);
  const hasWorkedExample = Boolean(experiment.workedExample);
  const hasGlossary = Boolean(experiment.glossary && experiment.glossary.length > 0);

  if (!hasAnalogy && !hasBreakdown && !hasWorkedExample && !hasGlossary) {
    return null;
  }

  return (
    <div className="space-y-3" data-testid="prelab-structured-pedagogy">
      {/* 1. Analogi Dunia Nyata (collapsed by default) */}
      {hasAnalogy && experiment.everydayAnalogy && (
        <Accordion
          title="Analogi Dunia Nyata"
          meta={experiment.everydayAnalogy.title}
          icon={<Lightbulb className="w-4 h-4 text-[var(--comfort-warning)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="prelab-analogy-accordion"
        >
          <div className="space-y-2.5 text-xs leading-relaxed comfort-prose">
            <p className="text-[var(--comfort-text)]">{experiment.everydayAnalogy.scenario}</p>
            <p className="text-[var(--comfort-text-muted)] pt-2 border-t border-[var(--comfort-border)]">
              <strong className="text-[var(--comfort-text)]">Kaitan Ilmiah: </strong>
              {experiment.everydayAnalogy.connection}
            </p>
          </div>
        </Accordion>
      )}

      {/* 2. Bedah Variabel & Satuan SI (collapsed by default) */}
      {hasBreakdown && experiment.formulaBreakdown && (
        <Accordion
          title="Bedah Simbol, Variabel & Satuan"
          meta={`${experiment.formulaBreakdown.length} besaran`}
          icon={<TableProperties className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="prelab-formula-breakdown-accordion"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--comfort-border)] text-2xs text-[var(--comfort-text-muted)]">
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
                        <div className={`text-2xs font-mono font-semibold mt-0.5 ${roleMeta.tone}`}>
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
        </Accordion>
      )}

      {/* 3. Contoh Soal Terpandu (collapsed by default) */}
      {hasWorkedExample && experiment.workedExample && (
        <Accordion
          title="Contoh Soal & Pembahasan Terpandu"
          meta={`${experiment.workedExample.steps.length} langkah`}
          icon={<Calculator className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="prelab-worked-example"
        >
          <div className="space-y-3">
            <p className="text-xs sm:text-[0.8125rem] text-[var(--comfort-text)] font-medium leading-relaxed comfort-prose">
              {experiment.workedExample.question}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
              <span className="font-sans font-semibold text-[var(--comfort-text)]">Diketahui:</span>
              {experiment.workedExample.given.map((g, i) => (
                <span key={i}>
                  {i > 0 && <span className="mr-3 opacity-50" aria-hidden="true">·</span>}
                  {g}
                </span>
              ))}
            </div>

            <div>
              <button
                type="button"
                data-testid="toggle-worked-example-btn"
                onClick={() => {
                  labSound.playClick();
                  setShowSolution((prev) => !prev);
                }}
                aria-expanded={showSolution}
                className="comfort-btn-secondary px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{showSolution ? 'Sembunyikan Pembahasan' : 'Tampilkan Pembahasan Bertahap'}</span>
                {showSolution ? (
                  <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
              </button>
            </div>

            {showSolution && (
              <div className="pt-3 border-t border-[var(--comfort-border)] space-y-3">
                <ol className="divide-y divide-[var(--comfort-border)] text-xs text-[var(--comfort-text)]">
                  {experiment.workedExample.steps.map((st, idx) => (
                    <li
                      key={idx}
                      className="py-2 first:pt-0 last:pb-0 flex items-start gap-2.5 leading-relaxed tabular-nums"
                    >
                      <span className="font-mono font-bold text-2xs text-[var(--comfort-accent)] shrink-0 mt-0.5">
                        0{idx + 1}.
                      </span>
                      <span>{st}</span>
                    </li>
                  ))}
                </ol>

                <div className="pt-2.5 border-t border-[var(--comfort-border)] space-y-1 text-xs">
                  <div className="font-mono font-bold text-[var(--comfort-success)] tabular-nums">
                    Jawaban Akhir: {experiment.workedExample.answer}
                  </div>
                  <p className="text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                    <strong className="text-[var(--comfort-text)]">Makna Fisis: </strong>
                    {experiment.workedExample.physicalMeaning}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Accordion>
      )}

      {/* 4. Glosarium Istilah Penting (collapsed by default) */}
      {hasGlossary && experiment.glossary && (
        <Accordion
          title="Glosarium Istilah Penting"
          meta={`${experiment.glossary.length} istilah`}
          icon={<BookMarked className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="prelab-glossary-accordion"
        >
          <dl className="divide-y divide-[var(--comfort-border)] text-xs">
            {experiment.glossary.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                <dt className="font-bold text-[var(--comfort-text)]">{item.term}</dt>
                <dd className="text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                  {item.definition}
                </dd>
              </div>
            ))}
          </dl>
        </Accordion>
      )}
    </div>
  );
};
