import React from 'react';
import { ArrowRight, Atom, CheckCircle2, Star } from 'lucide-react';
import { EducationTier, ExperimentModule, ScienceDomain } from '../../registry/experimentRegistry';
import { CurriculumChapter } from '../../registry/curriculumChapters';
import { ModuleSchematicIllustration } from '../ui/ModuleSchematicIllustration';
import { SciFormula } from '../ui/ScientificNotation';
import { labSound } from '../../utils/soundEngine';
import {
  DOMAIN_COLORS,
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

export const ModuleCatalogCard: React.FC<ModuleCatalogCardProps> = ({
  exp,
  isCompleted,
  isBookmarked = false,
  onToggleBookmark,
  tierLabel,
  onSelect,
}) => {
  const DomainIcon = DOMAIN_ICONS[exp.domain] || Atom;
  const accentColor = DOMAIN_COLORS[exp.domain] || '#0284c7';
  const conciseDesc =
    exp.theorySummary.split('.')[0]?.trim() + '.' || exp.theorySummary;
  const primaryEquation = formatCleanCardEquation(exp.keyEquations[0] || '');
  const difficultyLabel =
    exp.difficulty === 1 ? 'Dasar' : exp.difficulty === 2 ? 'Menengah' : 'Lanjut';

  return (
    <article
      onClick={() => {
        labSound.playClick();
        onSelect(exp);
      }}
      className="relative bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] hover:border-sky-500/50 hover:shadow-md rounded-xl overflow-hidden transition-all duration-200 flex flex-col justify-between group cursor-pointer"
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
              className={`absolute top-2 right-2 p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isBookmarked
                  ? 'bg-amber-500/15 border-amber-500/45 text-amber-500'
                  : 'bg-[var(--comfort-surface)]/90 border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-amber-500'
              }`}
              title={isBookmarked ? 'Hapus dari Favorit' : 'Simpan ke Favorit'}
            >
              <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
            </button>
          )}
        </div>

        <div className="p-4 pb-3 space-y-2">
          {/* Zero-pill clean unboxed metadata kicker */}
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)]">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <DomainIcon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: accentColor }}
                aria-hidden="true"
              />
              <span className="capitalize font-semibold text-[var(--comfort-text)]">{exp.domain}</span>
              {exp.chapterNumber && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Bab {exp.chapterNumber}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="truncate">{exp.subCategory}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0 tabular-nums">
              <span>{difficultyLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{tierLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{exp.estimatedMinutes}m</span>
              {isCompleted && (
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                  aria-label="Selesai"
                />
              )}
            </div>
          </div>

          <h2 className="text-base font-bold leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {exp.title}
          </h2>

          <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-2 leading-relaxed comfort-prose">
            {conciseDesc}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3.5 pt-2.5 border-t border-[var(--comfort-border)] flex items-center justify-between gap-2.5">
        {primaryEquation ? (
          <div
            className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs font-mono text-sky-700 dark:text-sky-300 overflow-hidden text-ellipsis whitespace-nowrap select-text"
            title={primaryEquation}
          >
            <SciFormula text={primaryEquation} />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            labSound.playClick();
            onSelect(exp);
          }}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 group-hover:text-sky-600 dark:group-hover:text-sky-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Mulai Praktikum →
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
  const domainColor = DOMAIN_COLORS[chapter.domain as ScienceDomain] || '#0284c7';

  return (
    <div
      data-testid={`diet-chapter-card-${chapter.chapterNumber}`}
      onClick={() => {
        labSound.playClick();
        onOpenChapter(chapter);
      }}
      className="relative rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] overflow-hidden flex flex-col justify-between hover:border-sky-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Clean unboxed typographic metadata */}
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--comfort-text-muted)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono font-bold text-[var(--comfort-text)]">
                Bab {chapter.chapterNumber}
              </span>
              <span aria-hidden="true">·</span>
              <DomainIcon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: domainColor }}
                aria-hidden="true"
              />
              <span className="capitalize font-medium truncate text-[var(--comfort-text)]">
                {chapter.domain}
              </span>
            </div>
            <span className="font-mono text-[11px] font-medium shrink-0 text-[var(--comfort-text-muted)]">
              {getShortJenjangLabel(chapter)}
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-bold leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {chapter.title}
          </h3>

          <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-2 leading-relaxed">
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
            className="px-2.5 py-1 rounded-lg text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Buka Bab</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
