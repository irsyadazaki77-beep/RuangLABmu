import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export type AccordionVariant = 'default' | 'subtle' | 'warning' | 'accent';

export interface AccordionProps {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ReactNode;
  /**
   * Progressive disclosure preview slot: keeps 1–2 core points visible initially
   * while detailed content stays collapsed behind the toggle.
   */
  preview?: React.ReactNode;
  /**
   * Collapsible detail body revealed when expanded.
   * When omitted or null while `preview` is provided, renders as a static summary card.
   */
  children?: React.ReactNode;
  collapsedLabel?: string;
  expandedLabel?: string;
  collapsedHint?: string;
  expandedHint?: string;
  hiddenCount?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (nextOpen: boolean) => void;
  /**
   * Action controls rendered in the header outside the toggle button
   * to prevent nested interactive elements.
   */
  headerRight?: React.ReactNode;
  variant?: AccordionVariant;
  compact?: boolean;
  testId?: string;
  toggleTestId?: string;
  className?: string;
  previewClassName?: string;
  contentClassName?: string;
}

const VARIANT_SHELL_CLASSES: Record<AccordionVariant, string> = {
  default: 'bg-[var(--comfort-surface)] border-[var(--comfort-border)]',
  subtle: 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)]',
  warning: 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)]',
  accent: 'bg-[var(--comfort-surface)] border-[var(--comfort-accent-border)]',
};

const VARIANT_HEADER_TINT: Record<AccordionVariant, string> = {
  default: '',
  subtle: '',
  warning: '',
  accent: 'bg-[var(--comfort-accent-soft)]',
};

/**
 * Reusable Tailwind CSS Accordion implementing the progressive disclosure pattern
 * for text-heavy scientific areas (Theory, K3 Safety, Rubrics, and Diagnostics).
 * Supports both classic collapsed accordions and "1–2 visible points + Lihat Detail" previews.
 */
export const Accordion: React.FC<AccordionProps> = ({
  title,
  subtitle,
  meta,
  icon,
  preview,
  children,
  collapsedLabel = 'Lihat Detail',
  expandedLabel = 'Ringkas',
  collapsedHint,
  expandedHint,
  hiddenCount,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  headerRight,
  variant = 'default',
  compact = false,
  testId,
  toggleTestId,
  className = '',
  previewClassName,
  contentClassName,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
  const headingId = useId();
  const panelId = useId();

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const hasExpandableContent =
    children !== undefined && children !== null && children !== false;
  const hasPreview = preview !== undefined && preview !== null && preview !== false;

  const handleToggle = () => {
    if (!hasExpandableContent) return;
    labSound.playClick();
    const next = !isOpen;
    if (onToggle) onToggle(next);
    else setInternalOpen(next);
  };

  const toggleText = isOpen
    ? expandedLabel
    : hiddenCount && hiddenCount > 0
      ? `${collapsedLabel} (+${hiddenCount})`
      : collapsedLabel;

  const shellTone = VARIANT_SHELL_CLASSES[variant];
  const headerTint = VARIANT_HEADER_TINT[variant];
  const padX = compact ? 'px-3' : 'px-4 sm:px-5';
  const defaultPreviewClasses = compact ? 'px-3 py-2.5' : 'px-4 sm:px-5 py-3.5';
  const defaultContentClasses = compact
    ? 'px-3 pb-3 pt-2.5 border-t border-[var(--comfort-border)]'
    : 'px-4 sm:px-5 pb-5 pt-3.5 border-t border-[var(--comfort-border)]';

  // Mode A: Progressive-disclosure card with 1–2 visible core points in `preview`
  if (hasPreview) {
    return (
      <section
        data-testid={testId}
        className={`border rounded-xl overflow-hidden transition-colors ${shellTone} ${className}`}
      >
        {/* Header Bar */}
        <div
          className={`${padX} ${compact ? 'py-2.5' : 'py-3'} border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2.5 ${headerTint}`}
        >
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {icon && <span className="shrink-0 mt-0.5 flex items-center">{icon}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3
                  id={headingId}
                  className={`${
                    compact ? 'text-xs' : 'text-xs sm:text-sm'
                  } font-bold text-[var(--comfort-text)] leading-snug`}
                >
                  {title}
                </h3>
                {meta && (
                  <span className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums shrink-0">
                    · {meta}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {headerRight && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{headerRight}</div>
          )}
        </div>

        {/* Always-Visible 1–2 Point Core Preview */}
        <div className={previewClassName ?? defaultPreviewClasses}>{preview}</div>

        {/* Expanded Detail Body */}
        {hasExpandableContent && isOpen && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={headingId}
            className={contentClassName ?? defaultContentClasses}
          >
            {children}
          </div>
        )}

        {/* Progressive Disclosure Footer Toggle */}
        {hasExpandableContent && (
          <div
            className={`${padX} ${
              compact ? 'py-1.5' : 'py-2'
            } border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)]/55 flex flex-wrap items-center justify-between gap-2`}
          >
            <span className="text-2xs text-[var(--comfort-text-muted)]">
              {isOpen ? (expandedHint ?? '') : (collapsedHint ?? '')}
            </span>
            <button
              type="button"
              data-testid={toggleTestId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={handleToggle}
              className="ml-auto inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <span>{toggleText}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                  isOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </section>
    );
  }

  // Mode B: Compact single-header collapsible accordion (zero content visible until expanded)
  return (
    <section
      data-testid={testId}
      className={`border rounded-xl overflow-hidden transition-colors ${shellTone} ${className}`}
    >
      <div
        className={`flex items-center justify-between gap-2 ${headerTint} ${
          headerRight ? `${padX} py-1.5` : ''
        }`}
      >
        <button
          type="button"
          id={headingId}
          data-testid={toggleTestId}
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={`flex-1 min-w-0 ${
            headerRight ? 'py-2 pr-2' : `${padX} ${compact ? 'py-2.5' : 'py-3'}`
          } ${
            compact ? 'min-h-[40px]' : 'min-h-[44px]'
          } flex items-center justify-between gap-3 text-left hover:bg-[var(--comfort-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--comfort-accent)] transition-colors duration-150 cursor-pointer`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {icon && <span className="shrink-0 flex items-center">{icon}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className={`${
                    compact ? 'text-xs' : 'text-xs sm:text-sm'
                  } font-bold text-[var(--comfort-text)] truncate`}
                >
                  {title}
                </span>
                {meta && (
                  <span className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums shrink-0">
                    · {meta}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-2xs text-[var(--comfort-text-muted)] truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {!headerRight && (
            <ChevronDown
              className={`w-4 h-4 text-[var(--comfort-text-muted)] transition-transform duration-150 shrink-0 ${
                isOpen ? 'rotate-180 text-[var(--comfort-accent)]' : ''
              }`}
              aria-hidden="true"
            />
          )}
        </button>

        {headerRight && (
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-label={`${isOpen ? expandedLabel : collapsedLabel} ${title}`}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-150 shrink-0 ${
                  isOpen ? 'rotate-180 text-[var(--comfort-accent)]' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </div>

      {hasExpandableContent && isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className={contentClassName ?? defaultContentClasses}
        >
          {children}
        </div>
      )}
    </section>
  );
};

export interface AccordionGroupProps {
  children: React.ReactNode;
  compact?: boolean;
  label?: string;
  testId?: string;
  className?: string;
}

/**
 * Semantic container for stacking related progressive-disclosure Accordion cards
 * with consistent vertical rhythm.
 */
export const AccordionGroup: React.FC<AccordionGroupProps> = ({
  children,
  compact = false,
  label,
  testId,
  className = '',
}) => (
  <div
    data-testid={testId}
    aria-label={label}
    className={`${compact ? 'space-y-2' : 'space-y-3'} ${className}`}
  >
    {children}
  </div>
);
