import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Sparkles, X } from 'lucide-react';
import { getGlossaryEntry } from '../../utils/pedagogicalHelpers';
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
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: false,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  const updatePosition = () => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popWidth = Math.min(310, vw - 24);
    const estHeight = 188;

    const placeAbove = rect.bottom + estHeight + 12 > vh && rect.top - estHeight - 12 > 8;
    const rawLeft = rect.left + rect.width / 2 - popWidth / 2;
    const clampedLeft = Math.max(12, Math.min(vw - popWidth - 12, rawLeft));
    const top = placeAbove ? Math.max(12, rect.top - 8) : Math.min(vh - 20, rect.bottom + 8);

    setCoords({ top, left: clampedLeft, placeAbove });
  };

  const openPopover = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const scheduleClose = () => {
    if (pinned) return;
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 140);
  };

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
      setPinned(false);
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setIsOpen(false);
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
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  if (!entry) {
    return <span className={className}>{displayLabel ?? term}</span>;
  }

  const popoverSurfaceClass =
    themeMode === 'dark'
      ? 'bg-slate-950 text-slate-100 border-slate-700'
      : 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] border-[var(--comfort-border)]';

  const popoverMutedClass =
    themeMode === 'dark' ? 'text-slate-300' : 'text-[var(--comfort-muted)]';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={`glossary-term-${entry.id}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onFocus={openPopover}
        onBlur={scheduleClose}
        onClick={(e) => {
          e.stopPropagation();
          labSound.playClick(660);
          if (isOpen && pinned) {
            setPinned(false);
            setIsOpen(false);
          } else {
            setPinned(true);
            openPopover();
          }
        }}
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
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 'min(310px, calc(100vw - 24px))',
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
                  setPinned(false);
                  setIsOpen(false);
                }}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
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
