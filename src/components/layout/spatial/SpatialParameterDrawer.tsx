import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, BookOpen, PanelLeftClose, Sliders } from 'lucide-react';
import { DRAWER_LEFT_VARIANTS } from '../../../styles/motionPresets';
import { Accordion } from '../../ui/Accordion';

export interface SpatialParameterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hypothesisText?: string;
  theorySummary?: string;
  keyTakeaways?: string[];
  safetyNotes?: string[];
  sidebar: React.ReactNode;
}

export const SpatialParameterDrawer: React.FC<SpatialParameterDrawerProps> = ({
  isOpen,
  onClose,
  hypothesisText,
  theorySummary,
  keyTakeaways = [],
  safetyNotes = [],
  sidebar,
}) => {
  const [hypothesisExpanded, setHypothesisExpanded] = useState(false);

  const primaryTakeaway =
    keyTakeaways[0] ||
    (theorySummary ? theorySummary.split(/(?<=[.!?])\s+/)[0]?.trim() : '');
  const primarySafety = safetyNotes[0] || '';
  const extraTakeaways = keyTakeaways.slice(1);
  const extraSafety = safetyNotes.slice(1);
  const hasQuickRef = Boolean(primaryTakeaway || primarySafety);
  const hasExtraRef =
    Boolean(theorySummary && theorySummary.length > (primaryTakeaway?.length ?? 0) + 12) ||
    extraTakeaways.length > 0 ||
    extraSafety.length > 0;
  const hiddenRefCount = extraTakeaways.length + extraSafety.length;

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside
          key="spatial-left-drawer"
          data-testid="spatial-left-drawer"
          variants={DRAWER_LEFT_VARIANTS}
          initial="closed"
          animate="open"
          exit="closed"
          aria-label="Panel Parameter & Kontrol Eksperimen"
          className="hidden lg:flex flex-col absolute top-[58px] bottom-[84px] left-3 w-[296px] xl:w-[316px] z-20 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xl overflow-hidden"
        >
          <div className="px-3.5 py-2 border-b border-[var(--comfort-border)] flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-bold flex items-center gap-1.5 text-[var(--comfort-text)] min-w-0 truncate">
              <Sliders className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span className="truncate">Parameter Eksperimen</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Panel Parameter"
              title="Tutup Panel Parameter ([)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
            >
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {hypothesisText && (
              <div className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-bold text-[var(--comfort-accent)]">
                    Hipotesis Awal
                  </span>
                  {hypothesisText.length > 90 && (
                    <button
                      type="button"
                      onClick={() => setHypothesisExpanded((prev) => !prev)}
                      className="text-2xs font-semibold text-[var(--comfort-accent)] hover:underline cursor-pointer"
                    >
                      {hypothesisExpanded ? 'Ringkas' : 'Selengkapnya'}
                    </button>
                  )}
                </div>
                <p
                  className={`text-2xs italic text-[var(--comfort-text-muted)] leading-relaxed ${
                    hypothesisExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  &ldquo;{hypothesisText}&rdquo;
                </p>
              </div>
            )}

            {sidebar}

            {hasQuickRef && (
              <Accordion
                title="Ringkasan Teori & K3"
                icon={<BookOpen className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />}
                variant="subtle"
                compact
                collapsedLabel="Lihat Detail"
                expandedLabel="Ringkas"
                hiddenCount={hiddenRefCount > 0 ? hiddenRefCount : undefined}
                testId="spatial-theory-k3-accordion"
                toggleTestId="spatial-theory-k3-toggle"
                preview={
                  <ul className="space-y-1.5 text-2xs leading-relaxed text-[var(--comfort-text)]">
                    {primaryTakeaway && (
                      <li className="flex items-start gap-1.5">
                        <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0">
                          01.
                        </span>
                        <span className="line-clamp-2">{primaryTakeaway}</span>
                      </li>
                    )}
                    {primarySafety && (
                      <li className="flex items-start gap-1.5 text-[var(--comfort-text-muted)]">
                        <AlertTriangle
                          className="w-3 h-3 text-[var(--comfort-warning)] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="line-clamp-2">{primarySafety}</span>
                      </li>
                    )}
                  </ul>
                }
              >
                {hasExtraRef ? (
                  <div className="space-y-2.5 text-2xs leading-relaxed text-[var(--comfort-text-muted)]">
                    {theorySummary && (
                      <div className="space-y-1">
                        <div className="font-bold text-[var(--comfort-text)]">Dasar Teori</div>
                        <p className="comfort-prose">{theorySummary}</p>
                      </div>
                    )}
                    {extraTakeaways.length > 0 && (
                      <ul className="space-y-1">
                        {extraTakeaways.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="font-mono font-bold text-[var(--comfort-accent)] shrink-0">
                              0{idx + 2}.
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {extraSafety.length > 0 && (
                      <div className="pt-2 border-t border-[var(--comfort-border)] space-y-1">
                        <div className="font-bold text-[var(--comfort-text)]">Aturan K3 Lainnya</div>
                        <ul className="space-y-1">
                          {extraSafety.map((note, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <AlertTriangle
                                className="w-3 h-3 text-[var(--comfort-warning)] shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </Accordion>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
