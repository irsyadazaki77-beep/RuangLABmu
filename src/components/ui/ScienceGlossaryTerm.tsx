import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Sparkles, X } from 'lucide-react';
import {
  computeGlossaryPopoverPosition,
  getGlossaryEntry,
  type GlossaryPopoverPosition,
} from '../../utils/pedagogicalHelpers';
import { labSound } from '../../utils/soundEngine';

export interface ScienceGlossaryTermProps {
  term: string;
  displayLabel?: React.ReactNode;
  className?: string;
  themeMode?: 'auto' | 'dark';
}

export const ScienceGlossaryTerm: React.FC<ScienceGlossaryTermProps> = ({
  term,
  displayLabel,
  className = '',
  themeMode = 'auto',
}) => {
  const entry = getGlossaryEntry(term);
  const [isOpen, setIsOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<GlossaryPopoverPosition>({
    top: 0,
    left: 0,
    width: 310,
    placeAbove: false,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const suppressNextFocusOpenRef = useRef<boolean>(false);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords(
      computeGlossaryPopoverPosition(
        rect,
        window.innerWidth,
        window.innerHeight
      )
    );
  }, []);

  const clearPendingClose = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const openPopover = useCallback(() => {
    clearPendingClose();
    updatePosition();
    setIsOpen(true);
  }, [clearPendingClose, updatePosition]);

  const closePopover = useCallback(
    (restoreFocusToTrigger = false) => {
      clearPendingClose();
      setPinned(false);
      setIsOpen(false);
      if (restoreFocusToTrigger && triggerRef.current) {
        suppressNextFocusOpenRef.current = true;
        triggerRef.current.focus();
      }
    },
    [clearPendingClose]
  );

  const scheduleClose = useCallback(() => {
    if (pinned) return;
    clearPendingClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 140);
  }, [clearPendingClose, pinned]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      closePopover(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        const activeInsidePopover = Boolean(
          popoverRef.current &&
            document.activeElement &&
            popoverRef.current.contains(document.activeElement)
        );
        closePopover(activeInsidePopover);
      }
    };

    const handleScrollOrResize = () => updatePosition();

    document.addEventListener('pointerdown', handleDocPointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('pointerdown', handleDocPointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition, closePopover]);

  useEffect(() => {
    return () => clearPendingClose();
  }, [clearPendingClose]);

  if (!entry) {
    return <span className={className}>{displayLabel ?? term}</span>;
  }

  const popoverSurfaceClass =
    themeMode === 'dark'
      ? 'bg-slate-950 text-slate-100 border-slate-700'
      : 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] border-[var(--comfort-border)]';

  const popoverMutedClass =
    themeMode === 'dark' ? 'text-slate-300' : 'text-[var(--comfort-muted)]';

  const handleToggleActivate = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    labSound.playClick(660);
    if (isOpen && pinned) {
      closePopover(false);
    } else {
      setPinned(true);
      openPopover();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const nextFocus = e.relatedTarget as Node | null;
    if (
      nextFocus &&
      (triggerRef.current?.contains(nextFocus) || popoverRef.current?.contains(nextFocus))
    ) {
      return;
    }
    scheduleClose();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={`glossary-term-${entry.id}`}
        aria-controls={isOpen ? tooltipId : undefined}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          if (suppressNextFocusOpenRef.current) {
            suppressNextFocusOpenRef.current = false;
            return;
          }
          openPopover();
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            e.stopPropagation();
            closePopover(false);
          } else if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            handleToggleActivate(e);
          }
        }}
        onClick={handleToggleActivate}
        title={`Ketuk atau arahkan kursor untuk arti "${entry.term}"`}
        className={`inline-flex items-center gap-0.5 border-b border-dotted border-sky-500/80 dark:border-sky-400/80 font-semibold text-inherit cursor-help hover:text-sky-600 dark:hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xs transition-colors ${className}`}
      >
        <span>{displayLabel ?? entry.term}</span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            id={tooltipId}
            role="tooltip"
            data-testid={`glossary-popover-${entry.id}`}
            onMouseEnter={openPopover}
            onMouseLeave={scheduleClose}
            onBlur={handleBlur}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: `${coords.width}px`,
              maxWidth: 'calc(100vw - 24px)',
              transform: coords.placeAbove ? 'translateY(-100%)' : 'none',
              zIndex: 9999,
            }}
            className={`rounded-xl border shadow-2xl p-3 text-left space-y-2 ${popoverSurfaceClass}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span>Kamus Mini · {entry.category}</span>
                </div>
                <div className="text-xs font-extrabold leading-snug mt-0.5">
                  {entry.displayTitle}
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup kamus istilah"
                onClick={(e) => {
                  e.stopPropagation();
                  closePopover(true);
                }}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] leading-relaxed">
              {entry.explanation}
            </p>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Analogi Sehari-hari</span>
              </div>
              <p className={`text-[11px] leading-snug ${popoverMutedClass}`}>
                {entry.analogy}
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
