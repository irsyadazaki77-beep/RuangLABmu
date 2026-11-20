import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Clock, X } from 'lucide-react';
import { MODAL_POPOVER_VARIANTS } from '../../styles/motionPresets';
import { CurriculumChapter } from '../../registry/curriculumChapters';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';

export interface ChapterDetailModalProps {
  chapter: CurriculumChapter | null;
  modules: ExperimentModule[];
  completedModuleIds: string[];
  onClose: () => void;
  onSelectExperiment: (exp: ExperimentModule) => void;
}

export const ChapterDetailModal: React.FC<ChapterDetailModalProps> = ({
  chapter,
  modules,
  completedModuleIds,
  onClose,
  onSelectExperiment,
}) => {
  useEffect(() => {
    if (!chapter) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapter, onClose]);

  return (
    <AnimatePresence>
      {chapter && (
        <div
          data-testid="chapter-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Detail ${chapter.title}`}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            variants={MODAL_POPOVER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="max-w-3xl w-full rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl p-5 sm:p-6 space-y-5 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3.5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--comfort-text-muted)]">
                  <span className="font-mono font-bold text-[var(--comfort-accent)]">
                    Bab {chapter.chapterNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium">{chapter.competencyTier}</span>
                  <span aria-hidden="true">·</span>
                  <span>Sasaran: {chapter.targetGrades}</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight">{chapter.title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup Detail Bab"
                className="p-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
              {chapter.overviewDescription}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Capaian Pembelajaran Inti</span>
                </div>
                <ul className="space-y-1.5 text-[var(--comfort-text-muted)]">
                  {chapter.coreCompetencies.map((comp, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-sky-600 dark:text-sky-400 font-bold" aria-hidden="true">
                        ·
                      </span>
                      <span>{comp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex flex-col justify-between space-y-3">
                <div>
                  <div className="font-semibold">Prasyarat Konsep</div>
                  <p className="text-[var(--comfort-text-muted)] mt-1 leading-relaxed">
                    {chapter.prerequisites.join(' · ')}
                  </p>
                </div>
                <div className="pt-2.5 border-t border-[var(--comfort-border)]">
                  <div className="font-semibold">Konteks Industri &amp; Penerapan Nyata</div>
                  <p className="text-[var(--comfort-text-muted)] mt-1 leading-relaxed">
                    {chapter.realWorldTheme}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="text-xs font-semibold text-[var(--comfort-text-muted)]">
                Pilih Modul Praktikum 3D ({modules.length} Modul)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {modules.map((mod) => {
                  const isDone = completedModuleIds.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        onSelectExperiment(mod);
                      }}
                      className="text-left p-3.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-sky-500 transition-colors flex items-center justify-between gap-2.5 cursor-pointer group"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs group-hover:text-sky-600 dark:group-hover:text-sky-400 truncate">
                            {mod.title}
                          </span>
                          {isDone && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--comfort-text-muted)] flex items-center gap-2">
                          <span>{mod.subCategory}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="w-3 h-3" />
                            {mod.estimatedMinutes}m
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md bg-sky-600 text-white text-[11px] font-semibold shrink-0 whitespace-nowrap">
                        Mulai →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
