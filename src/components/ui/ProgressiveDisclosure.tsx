import React from 'react';
import { ChevronDown } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';
import { Accordion, AccordionGroup, type AccordionProps } from './Accordion';

export { Accordion, AccordionGroup };
export type { AccordionProps };
export type { AccordionGroupProps, AccordionVariant } from './Accordion';

export interface DetailAccordionProps {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ReactNode;
  preview?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (nextOpen: boolean) => void;
  testId?: string;
  toggleTestId?: string;
  className?: string;
  contentClassName?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Backward-compatible alias delegating to the reusable Accordion component.
 */
export const DetailAccordion: React.FC<DetailAccordionProps> = (props) => (
  <Accordion {...props} />
);

export interface DetailToggleButtonProps {
  expanded: boolean;
  onToggle: () => void;
  collapsedLabel?: string;
  expandedLabel?: string;
  hiddenCount?: number;
  testId?: string;
  className?: string;
}

/**
 * Consistent inline "Lihat Detail" / "Sembunyikan" toggle button for
 * 1–2 core points + progressive disclosure lists.
 */
export const DetailToggleButton: React.FC<DetailToggleButtonProps> = ({
  expanded,
  onToggle,
  collapsedLabel = 'Lihat Detail',
  expandedLabel = 'Sembunyikan',
  hiddenCount,
  testId,
  className = '',
}) => {
  const label = expanded
    ? expandedLabel
    : hiddenCount && hiddenCount > 0
      ? `${collapsedLabel} (+${hiddenCount})`
      : collapsedLabel;

  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={expanded}
      onClick={() => {
        labSound.playClick();
        onToggle();
      }}
      className={`inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] transition-colors duration-150 cursor-pointer whitespace-nowrap ${className}`}
    >
      <span>{label}</span>
      <ChevronDown
        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
          expanded ? 'rotate-180' : ''
        }`}
        aria-hidden="true"
      />
    </button>
  );
};
