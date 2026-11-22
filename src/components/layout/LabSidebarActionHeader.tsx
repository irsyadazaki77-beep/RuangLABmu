import React from 'react';
import { Camera } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export interface LabSidebarActionHeaderProps {
  recordsCount: number;
  minRequired?: number;
  accentColor?: 'sky' | 'teal' | 'emerald';
  onRecordTrial: () => void;
  onProceedToAnalysis?: () => void;
}

const ACCENT_BUTTON_CLASSES: Record<'sky' | 'teal' | 'emerald', string> = {
  sky: 'bg-sky-600 hover:bg-sky-500 text-white',
  teal: 'bg-teal-600 hover:bg-teal-500 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white',
};

export const LabSidebarActionHeader: React.FC<LabSidebarActionHeaderProps> = ({
  recordsCount,
  minRequired = 3,
  accentColor = 'sky',
  onRecordTrial,
  onProceedToAnalysis,
}) => {
  const isReady = recordsCount >= minRequired;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRecordTrial}
        className={`flex-1 min-w-[140px] min-h-[40px] px-3 py-2 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${ACCENT_BUTTON_CLASSES[accentColor]}`}
      >
        <Camera className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="tabular-nums">
          + Catat Data ({isReady ? `${recordsCount} Siap` : `${recordsCount}/${minRequired}`})
        </span>
      </button>

      {onProceedToAnalysis && (
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            onProceedToAnalysis();
          }}
          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            isReady
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-sky-500/50'
          }`}
        >
          Grafik &amp; LKS →
        </button>
      )}
    </div>
  );
};
