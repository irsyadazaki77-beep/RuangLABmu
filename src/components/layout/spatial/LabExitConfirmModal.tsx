import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { MODAL_POPOVER_VARIANTS } from '../../../styles/motionPresets';
import { labSound } from '../../../utils/soundEngine';

export interface LabExitConfirmModalProps {
  isOpen: boolean;
  recordsCount: number;
  onCancel: () => void;
  onConfirmExit: () => void;
}

export const LabExitConfirmModal: React.FC<LabExitConfirmModalProps> = ({
  isOpen,
  recordsCount,
  onCancel,
  onConfirmExit,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="lab-exit-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lab-exit-confirm-title"
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            variants={MODAL_POPOVER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-2xl p-5 space-y-4 text-[var(--comfort-text)]"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-500 shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 id="lab-exit-confirm-title" className="text-sm font-bold text-[var(--comfort-text)]">
                  Keluar ke Lobby Katalog?
                </h3>
                <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed">
                  Anda memiliki{' '}
                  <strong className="text-[var(--comfort-text)] tabular-nums">
                    {recordsCount} data pengamatan
                  </strong>{' '}
                  dan jejak simulasi aktif. Kembali ke Lobby akan menutup sesi praktikum 3D ini.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] hover:opacity-90 text-xs font-semibold text-[var(--comfort-text)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Tetap di Lab
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onConfirmExit();
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Keluar ke Lobby
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
