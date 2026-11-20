import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PanelLeftClose, Sliders } from 'lucide-react';
import { DRAWER_LEFT_VARIANTS } from '../../../styles/motionPresets';

export interface SpatialParameterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hypothesisText?: string;
  sidebar: React.ReactNode;
}

export const SpatialParameterDrawer: React.FC<SpatialParameterDrawerProps> = ({
  isOpen,
  onClose,
  hypothesisText,
  sidebar,
}) => {
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
          className="hidden lg:flex flex-col absolute top-16 bottom-16 left-3 w-[332px] z-20 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--comfort-border)] flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--comfort-text)]">
              <Sliders className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
              <span>Parameter Eksperimen</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Panel Parameter"
              className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {hypothesisText && (
              <div className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs space-y-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Hipotesis Awal
                </div>
                <p className="text-[11px] italic text-[var(--comfort-text-muted)] line-clamp-2 leading-relaxed">
                  &ldquo;{hypothesisText}&rdquo;
                </p>
              </div>
            )}

            {sidebar}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
