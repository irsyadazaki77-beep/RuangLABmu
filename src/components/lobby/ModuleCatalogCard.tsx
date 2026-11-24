import React from 'react';
import { ArrowRight, Atom, CheckCircle2, Star } from 'lucide-react';
import { EducationTier, ExperimentModule, ScienceDomain } from '../../registry/experimentRegistry';
import { CurriculumChapter } from '../../registry/curriculumChapters';
import { ModuleSchematicIllustration } from '../ui/ModuleSchematicIllustration';
import { SciFormula } from '../ui/ScientificNotation';
import { labSound } from '../../utils/soundEngine';
import {
  DOMAIN_ICONS,
  formatCleanCardEquation,
  getShortJenjangLabel,
} from './lobbyFormatters';

export interface ModuleCatalogCardProps {
  exp: ExperimentModule;
  isCompleted: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: (moduleId: string) => void;
  tierLabel: EducationTier;
  onSelect: (exp: ExperimentModule) => void;
}

const DOMAIN_TEXT_CLASSES: Record<ScienceDomain, string> = {
  fisika: 'text-teal-700 dark:text-teal-400',
  kimia: 'text-emerald-700 dark:text-emerald-400',
  biologi: 'text-rose-700/85 dark:text-rose-400/90',
  astronomi: 'text-amber-700 dark:text-amber-400',
};

export const ModuleCatalogCard: React.FC<ModuleCatalogCardProps> = ({
  exp,
  isCompleted,
  isBookmarked = false,
  onToggleBookmark,
  tierLabel,
  onSelect,
}) => {
  const DomainIcon = DOMAIN_ICONS[exp.domain] || Atom;
  const domainTextClass = DOMAIN_TEXT_CLASSES[exp.domain] || 'text-[var(--comfort-accent)]';
  const conciseDesc =
    exp.theorySummary.split('.')[0]?.trim() + '.' || exp.theorySummary;
  const primaryEquation = formatCleanCardEquation(exp.keyEquations[0] || '');
  const difficultyLabel =
    exp.difficulty === 1 ? 'Dasar' : exp.difficulty === 2 ? 'Menengah' : 'Lanjut';

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Buka praktikum ${exp.title}`}
      onClick={() => {
        labSound.playClick();
        onSelect(exp);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          labSound.playClick();
          onSelect(exp);
        }
      }}
      className="relative bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] hover:shadow-md active:scale-[0.992] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] rounded-xl overflow-hidden transition-[border-color,box-shadow,transform] duration-150 flex flex-col justify-between group cursor-pointer"
    >
      <div>
        <div className="relative h-[108px] w-full overflow-hidden border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] lab-grid-bg flex items-center justify-center px-3">
          <ModuleSchematicIllustration
            moduleId={exp.id}
            domain={exp.domain}
            title={exp.title}
            subCategory={exp.subCategory}
            className="transition-transform duration-200 group-hover:scale-[1.03]"
          />
          {onToggleBookmark && (
            <button
              type="button"
              data-testid={`bookmark-module-${exp.id}`}
              aria-label={isBookmarked ? `Hapus ${exp.title} dari favorit` : `Tandai ${exp.title} sebagai favorit`}
              aria-pressed={isBookmarked}
              onClick={(e) => {
                e.stopPropagation();
                labSound.playClick();
                onToggleBookmark(exp.id);
              }}
              className={`absolute top-2 right-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
                isBookmarked
                  ? 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning)]/40 text-[var(--comfort-warning)]'
                  : 'bg-[var(--comfort-surface)]/92 border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-warning)]'
              }`}
              title={isBookmarked ? 'Hapus dari Favorit' : 'Simpan ke Favorit'}
            >
              <Star className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        <div className="p-4 pb-3 space-y-1.5">
          {/* Row 1: Quiet Domain & Chapter kicker + Completion icon */}
          <div className="flex items-center justify-between gap-2 text-2xs text-[var(--comfort-text-muted)]">
            <div className="flex items-center gap-1.5 min-w-0 font-mono tabular-nums">
              <DomainIcon
                className={`w-3.5 h-3.5 shrink-0 ${domainTextClass}`}
                aria-hidden="true"
              />
              <span className="capitalize font-sans font-semibold text-[var(--comfort-text)] shrink-0">
                {exp.domain}
              </span>
              {exp.chapterNumber && (
                <>
                  <span aria-hidden="true" className="opacity-45">·</span>
                  <span className="shrink-0">Bab {exp.chapterNumber}</span>
                </>
              )}
              <span aria-hidden="true" className="opacity-45">·</span>
              <span className="shrink-0">{difficultyLabel}</span>
              <span aria-hidden="true" className="opacity-45">·</span>
              <span className="shrink-0">{exp.estimatedMinutes} mnt</span>
            </div>

            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-success)] shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Selesai</span>
              </span>
            )}
          </div>

          <h2 className="text-sm sm:text-base font-bold leading-snug tracking-tight group-hover:text-[var(--comfort-accent)] transition-colors">
            {exp.title}
          </h2>

          <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-1 leading-relaxed comfort-prose">
            {conciseDesc}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3 pt-2.5 border-t border-[var(--comfort-border)] flex items-center justify-between gap-2.5">
        {primaryEquation ? (
          <div
            className="min-w-0 flex-1 text-2xs font-mono text-[var(--comfort-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap select-text"
            title={`${primaryEquation} (${tierLabel})`}
          >
            <SciFormula text={primaryEquation} />
          </div>
        ) : (
          <div className="flex-1 font-mono text-2xs text-[var(--comfort-text-muted)]">{tierLabel}</div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            labSound.playClick();
            onSelect(exp);
          }}
          className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-lg text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Mulai →
        </button>
      </div>
    </article>
  );
};

export interface ChapterCatalogCardProps {
  chapter: CurriculumChapter;
  onOpenChapter: (ch: CurriculumChapter) => void;
}

export const ChapterCatalogCard: React.FC<ChapterCatalogCardProps> = ({
  chapter,
  onOpenChapter,
}) => {
  const DomainIcon = DOMAIN_ICONS[chapter.domain as ScienceDomain] || Atom;
  const domainTextClass =
    DOMAIN_TEXT_CLASSES[chapter.domain as ScienceDomain] || 'text-[var(--comfort-accent)]';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Buka Bab ${chapter.chapterNumber}: ${chapter.title}`}
      data-testid={`diet-chapter-card-${chapter.chapterNumber}`}
      onClick={() => {
        labSound.playClick();
        onOpenChapter(chapter);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          labSound.playClick();
          onOpenChapter(chapter);
        }
      }}
      className="relative rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] overflow-hidden flex flex-col justify-between hover:border-[var(--comfort-accent-border)] hover:shadow-md active:scale-[0.992] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] transition-[border-color,box-shadow,transform] duration-150 cursor-pointer group"
    >
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Clean unboxed typographic metadata */}
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono font-bold text-[var(--comfort-text)] tabular-nums">
                Bab {chapter.chapterNumber}
              </span>
              <span aria-hidden="true" className="opacity-45">·</span>
              <DomainIcon
                className={`w-3.5 h-3.5 shrink-0 ${domainTextClass}`}
                aria-hidden="true"
              />
              <span className="capitalize font-medium truncate text-[var(--comfort-text)]">
                {chapter.domain}
              </span>
            </div>
            <span className="font-mono text-2xs font-medium shrink-0 text-[var(--comfort-text-muted)]">
              {getShortJenjangLabel(chapter)}
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-bold leading-snug tracking-tight group-hover:text-[var(--comfort-accent)] transition-colors">
            {chapter.title}
          </h3>

          <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-1 leading-relaxed comfort-prose">
            {chapter.overviewDescription}
          </p>
        </div>

        <div className="pt-2.5 flex items-center justify-between border-t border-[var(--comfort-border)]">
          <span className="text-xs font-mono font-medium text-[var(--comfort-text-muted)] tabular-nums">
            {chapter.moduleIds.length} Modul 3D
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              labSound.playClick();
              onOpenChapter(chapter);
            }}
            className="min-h-[36px] px-2.5 py-1 rounded-lg text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)] font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Buka Bab</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
