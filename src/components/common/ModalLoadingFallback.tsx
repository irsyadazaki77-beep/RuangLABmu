import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface ModalLoadingFallbackProps {
  label?: string;
}

export const ModalLoadingFallback: React.FC<ModalLoadingFallbackProps> = ({
  label = 'Memuat panel...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4"
    >
      <div className="px-4 py-3 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-lg flex items-center gap-2.5 text-xs font-semibold">
        <RefreshCw className="w-4 h-4 text-sky-600 dark:text-sky-400 animate-spin shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
};
