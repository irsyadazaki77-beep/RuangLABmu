import React from 'react';
import { ArrowRight, Atom, CheckCircle2, Star } from 'lucide-react';
import {
  EducationTier,
  ExperimentModule,
  ScienceDomain,
  getExperimentById,
} from '../../registry/experimentRegistry';
import { CurriculumChapter } from '../../registry/curriculumChapters';
import { ModuleSchematicIllustration } from '../ui/ModuleSchematicIllustration';
import { SciFormula } from '../ui/ScientificNotation';
import { labSound } from '../../utils/soundEngine';
import {
  DOMAIN_ICONS,
  DOMAIN_SHOWCASE_META,
  formatCleanCardEquation,
  getShortJenjangLabel,
  resolveMerdekaPhaseLabel,
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
  fisika: 'text-sky-700 dark:text-sky-300',
  kimia: 'text-teal-700 dark:text-teal-300',
  biologi: 'text-emerald-700 dark:text-emerald-300',
  astronomi: 'text-indigo-700 dark:text-indigo-300',
  kebumian: 'text-emerald-700 dark:text-emerald-300',
};

const DOMAIN_HEADER_WASH: Record<ScienceDomain, string> = {
  fisika: 'from-sky-500/12 via-sky-500/4 to-transparent',
  kimia: 'from-teal-500/12 via-teal-500/4 to-transparent',
  biologi: 'from-emerald-500/12 via-emerald-500/4 to-transparent',
  astronomi: 'from-indigo-500/14 via-indigo-500/5 to-transparent',
  kebumian: 'from-emerald-500/14 via-teal-500/5 to-transparent',
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
  const domainTextClass =
    DOMAIN_TEXT_CLASSES[exp.domain] || 'text-[var(--comfort-accent)]';
  const headerWash = DOMAIN_HEADER_WASH[exp.domain] || DOMAIN_HEADER_WASH.fisika;
  const domainMeta = DOMAIN_SHOWCASE_META[exp.domain] || DOMAIN_SHOWCASE_META.fisika;
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
      className="relative bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.992] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] rounded-xl overflow-hidden transition-[border-color,box-shadow,transform] duration-150 flex flex-col justify-between group cursor-pointer"
    >
      <div>
        <div className="relative h-[122px] w-full overflow-hidden border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] lab-grid-bg flex items-center justify-center px-3">
          {/* Subtle domain ambient glow */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${headerWash} opacity-90 group-hover:opacity-100 transition-opacity duration-200`}
          />

          <ModuleSchematicIllustration
            moduleId={exp.id}
            domain={exp.domain}
            title={exp.title}
            subCategory={exp.subCategory}
            className="relative z-10 transition-transform duration-200 group-hover:scale-[1.04]"
          />

          {/* Top-left subtle subCategory label */}
          {exp.subCategory && (
            <span className="pointer-events-none absolute bottom-2 left-2.5 z-10 text-2xs font-mono font-medium text-[var(--comfort-text-muted)] bg-[var(--comfort-surface)]/85 backdrop-blur-xs px-2 py-0.5 rounded-md border border-[var(--comfort-border)]">
              {exp.subCategory}
            </span>
          )}

          {onToggleBookmark && (
            <button
              type="button"
              data-testid={`bookmark-module-${exp.id}`}
              aria-label={
                isBookmarked
                  ? `Hapus ${exp.title} dari favorit`
                  : `Tandai ${exp.title} sebagai favorit`
              }
              aria-pressed={isBookmarked}
              onClick={(e) => {
                e.stopPropagation();
                labSound.playClick();
                onToggleBookmark(exp.id);
              }}
              className={`absolute top-2 right-2 z-10 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
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

        <div className="p-4 pb-3 space-y-2">
          {/* Row 1: Quiet Domain & Chapter kicker + Completion icon */}
          <div className="flex items-center justify-between gap-2 text-2xs text-[var(--comfort-text-muted)]">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 font-mono tabular-nums">
              <DomainIcon
                className={`w-3.5 h-3.5 shrink-0 ${domainTextClass}`}
                aria-hidden="true"
              />
              <span className={`capitalize font-sans font-semibold shrink-0 ${domainTextClass}`}>
                {exp.domain}
              </span>
              {exp.chapterNumber && (
                <>
                  <span aria-hidden="true" className="opacity-45">
                    ·
                  </span>
                  <span className="shrink-0">Bab {exp.chapterNumber}</span>
                </>
              )}
              <span aria-hidden="true" className="opacity-45">
                ·
              </span>
              <span className="shrink-0">{difficultyLabel}</span>
              <span aria-hidden="true" className="opacity-45">
                ·
              </span>
              <span className="shrink-0">{exp.estimatedMinutes} mnt</span>
            </div>

            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-success)] shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Selesai</span>
              </span>
            )}
          </div>

          <h2 className="text-sm sm:text-base font-bold leading-snug tracking-tight group-hover:text-[var(--comfort-accent)] transition-colors text-balance">
            {exp.title}
          </h2>

          <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-2 leading-relaxed comfort-prose">
            {conciseDesc}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3 pt-2.5 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)]/35 flex items-center justify-between gap-2.5">
        {primaryEquation ? (
          <div
            className="min-w-0 flex-1 text-2xs font-mono text-[var(--comfort-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap select-text"
            title={`${primaryEquation} (${tierLabel})`}
          >
            <SciFormula text={primaryEquation} />
          </div>
        ) : (
          <div className="flex-1 font-mono text-2xs text-[var(--comfort-text-muted)]">
            {domainMeta.title} · {tierLabel}
          </div>
        )}

        <button
          type="button"
          aria-label={`Mulai praktikum ${exp.title}`}
          onClick={(e) => {
            e.stopPropagation();
            labSound.playClick();
            onSelect(exp);
          }}
          className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg text-[var(--comfort-accent)] bg-[var(--comfort-accent-soft)]/70 hover:bg-[var(--comfort-accent-soft)] transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
        >
          <span>Mulai</span>
          <ArrowRight
            className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
};

export interface ChapterCatalogCardProps {
  chapter: CurriculumChapter;
  completedModuleIds?: string[];
  onOpenChapter: (ch: CurriculumChapter) => void;
}

export const ChapterCatalogCard: React.FC<ChapterCatalogCardProps> = ({
  chapter,
  completedModuleIds = [],
  onOpenChapter,
}) => {
  const domain = chapter.domain as ScienceDomain;
  const DomainIcon = DOMAIN_ICONS[domain] || Atom;
  const domainTextClass =
    DOMAIN_TEXT_CLASSES[domain] || 'text-[var(--comfort-accent)]';
  const headerWash = DOMAIN_HEADER_WASH[domain] || DOMAIN_HEADER_WASH.fisika;
  const domainMeta = DOMAIN_SHOWCASE_META[domain] || DOMAIN_SHOWCASE_META.fisika;

  const primaryModuleId = chapter.moduleIds[0] || `${domain}-1`;
  const primaryModule = getExperimentById(primaryModuleId);
  const completedInChapter = chapter.moduleIds.filter((id) =>
    completedModuleIds.includes(id)
  ).length;
  const totalInChapter = Math.max(1, chapter.moduleIds.length);
  const completionPct = Math.round((completedInChapter / totalInChapter) * 100);

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
      className="relative rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] overflow-hidden flex flex-col justify-between hover:border-[var(--comfort-accent-border)] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.992] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] transition-[border-color,box-shadow,transform] duration-150 cursor-pointer group"
    >
      {/* Visual Schematic Header Banner for Chapter */}
      <div className="relative h-[96px] w-full overflow-hidden border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] lab-grid-bg flex items-center justify-center px-3">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${headerWash} opacity-90 group-hover:opacity-100 transition-opacity duration-200`}
        />
        <ModuleSchematicIllustration
          moduleId={primaryModuleId}
          domain={domain}
          title={primaryModule?.title || chapter.title}
          subCategory={primaryModule?.subCategory || chapter.title}
          className="relative z-10 transition-transform duration-200 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute top-2 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--comfort-surface)]/90 backdrop-blur-xs border border-[var(--comfort-border)] text-2xs font-mono font-bold text-[var(--comfort-text)] tabular-nums">
          <span>Bab {chapter.chapterNumber}</span>
          <span aria-hidden="true" className="opacity-45">
            ·
          </span>
          <span className={domainTextClass}>{getShortJenjangLabel(chapter)}</span>
          <span aria-hidden="true" className="opacity-45">
            ·
          </span>
          <span className="text-[var(--comfort-text-muted)]">{resolveMerdekaPhaseLabel(chapter)}</span>
        </div>
        {completedInChapter > 0 && (
          <div className="pointer-events-none absolute top-2 right-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--comfort-surface)]/90 backdrop-blur-xs border border-[var(--comfort-border)] text-2xs font-mono font-semibold text-[var(--comfort-success)] tabular-nums">
            <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>
              {completedInChapter}/{chapter.moduleIds.length}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Clean unboxed typographic metadata */}
          <div className="flex items-center justify-between gap-2 text-2xs text-[var(--comfort-text-muted)]">
            <div className="flex items-center gap-1.5 min-w-0">
              <DomainIcon
                className={`w-3.5 h-3.5 shrink-0 ${domainTextClass}`}
                aria-hidden="true"
              />
              <span className={`capitalize font-semibold truncate ${domainTextClass}`}>
                {chapter.domain}
              </span>
              <span aria-hidden="true" className="opacity-45">
                ·
              </span>
              <span className="font-mono tabular-nums">
                {chapter.moduleIds.length} Eksperimen 3D
              </span>
            </div>
          </div>

          <h3 className="text-sm sm:text-base font-bold leading-snug tracking-tight group-hover:text-[var(--comfort-accent)] transition-colors text-balance">
            {chapter.title}
          </h3>

          <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-2 leading-relaxed comfort-prose">
            {chapter.overviewDescription}
          </p>
        </div>

        <div className="pt-2.5 space-y-2 border-t border-[var(--comfort-border)]">
          {/* Chapter Progress Bar */}
          <div className="flex items-center justify-between gap-2 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden border border-[var(--comfort-border)]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${domainMeta.barClass}`}
                style={{ width: `${Math.max(completionPct, completedInChapter > 0 ? 12 : 0)}%` }}
              />
            </div>
            <span className="shrink-0">
              {completedInChapter}/{chapter.moduleIds.length} Selesai
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs text-[var(--comfort-text-muted)] truncate">
              {primaryModule ? `Termasuk: ${primaryModule.title}` : `${chapter.moduleIds.length} Modul 3D`}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                labSound.playClick();
                onOpenChapter(chapter);
              }}
              className="min-h-[34px] px-3 py-1 rounded-lg text-[var(--comfort-accent)] bg-[var(--comfort-accent-soft)]/70 hover:bg-[var(--comfort-accent-soft)] font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Buka Bab</span>
              <ArrowRight
                className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
