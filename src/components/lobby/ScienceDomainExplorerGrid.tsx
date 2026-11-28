import React from 'react';
import type { ScienceDomain } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import {
  DOMAIN_ICONS,
  DOMAIN_PREVIEW_IMAGES,
  DOMAIN_SHOWCASE_META,
} from './lobbyFormatters';

export interface DomainProgressItem {
  domain: ScienceDomain;
  label: string;
  completedCount: number;
  totalCount: number;
  pct: number;
}

export interface ScienceDomainExplorerGridProps {
  domains: DomainProgressItem[];
  selectedDomain: ScienceDomain | 'all';
  brokenImages: Record<string, boolean>;
  onMarkBrokenImage: (imageKey: string) => void;
  onSelectDomain: (domain: ScienceDomain | 'all') => void;
}

export const ScienceDomainExplorerGrid: React.FC<ScienceDomainExplorerGridProps> = ({
  domains,
  selectedDomain,
  brokenImages,
  onMarkBrokenImage,
  onSelectDomain,
}) => {
  return (
    <section
      data-testid="science-domain-explorer-grid"
      aria-label="Eksplorasi 5 Bidang Sains"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
    >
      {domains.map((dom) => {
        const domainKey = dom.domain;
        const isSelected = selectedDomain === domainKey;
        const DomainIcon = DOMAIN_ICONS[domainKey];
        const meta = DOMAIN_SHOWCASE_META[domainKey];
        const previewUrl = DOMAIN_PREVIEW_IMAGES[domainKey];
        const imageKey = `domain-${domainKey}`;

        return (
          <button
            key={domainKey}
            type="button"
            data-testid={`domain-explorer-card-${domainKey}`}
            aria-pressed={isSelected}
            onClick={() => {
              labSound.playClick();
              onSelectDomain(isSelected ? 'all' : domainKey);
            }}
            className={`group relative text-left rounded-xl border overflow-hidden transition-[border-color,box-shadow,transform] duration-150 cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              isSelected
                ? 'border-[var(--comfort-accent)] bg-[var(--comfort-accent-soft)]/35 shadow-sm -translate-y-0.5'
                : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-[var(--comfort-accent-border)] hover:shadow-sm hover:-translate-y-0.5'
            }`}
          >
            {/* Top Domain Studio Visual Banner */}
            <div className="relative h-20 w-full overflow-hidden bg-slate-900 border-b border-[var(--comfort-border)]">
              {!brokenImages[imageKey] ? (
                <img
                  src={previewUrl}
                  alt={`Laboratorium ${meta.title}`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => onMarkBrokenImage(imageKey)}
                  className="pointer-events-none w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="pointer-events-none w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 lab-grid-bg"
                />
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent"
              />
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2 text-white">
                <div className="flex items-center gap-1.5 min-w-0">
                  <DomainIcon className="w-4 h-4 text-teal-300 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold tracking-tight truncate">
                    {meta.title}
                  </span>
                </div>
                <span className="font-mono text-2xs font-semibold text-slate-200 tabular-nums shrink-0">
                  {dom.completedCount}/{dom.totalCount}
                </span>
              </div>
            </div>

            {/* Domain Card Body & Progress Bar */}
            <div className="p-3 space-y-2 flex-1 flex flex-col justify-between w-full">
              <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
                {meta.tagline}
              </p>

              <div className="space-y-1">
                <div className="w-full h-1.5 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden border border-[var(--comfort-border)]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${meta.barClass}`}
                    style={{
                      width: `${Math.max(dom.pct, dom.completedCount > 0 ? 10 : 0)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                  <span>{dom.pct}% Selesai</span>
                  <span className="font-sans font-semibold text-[var(--comfort-accent)]">
                    {isSelected ? 'Filter Aktif ✓' : 'Jelajahi →'}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
};
