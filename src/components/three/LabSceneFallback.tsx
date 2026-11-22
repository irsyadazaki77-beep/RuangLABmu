import React from 'react';

export interface LabSceneFallbackProps {
  label?: string;
  compact?: boolean;
  accentColor?: 'sky' | 'teal' | 'emerald';
}

const SPINNER_RING_CLASSES: Record<'sky' | 'teal' | 'emerald', string> = {
  sky: 'border-sky-500 border-t-transparent',
  teal: 'border-teal-500 border-t-transparent',
  emerald: 'border-emerald-500 border-t-transparent',
};

export const LabSceneFallback: React.FC<LabSceneFallbackProps> = ({
  label = 'Menyiapkan Ruang Laboratorium 3D...',
  compact = false,
  accentColor = 'sky',
}) => {
  if (compact) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--comfort-surface-subtle)] text-xs font-mono text-[var(--comfort-text-muted)]">
        {label}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)] p-6 gap-3">
      <div
        className={`w-9 h-9 rounded-full border-2 animate-spin ${SPINNER_RING_CLASSES[accentColor]}`}
        aria-hidden="true"
      />
      <p className="text-xs font-mono font-semibold text-[var(--comfort-text)]">{label}</p>
    </div>
  );
};
