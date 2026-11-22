import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export interface LabHazardInfo {
  title: string;
  scientificExplanation: string;
  triggerParamSummary?: string;
  mitigationInstruction?: string;
}

export interface LabHazardModalProps {
  domainLabel: string;
  hazard: LabHazardInfo;
  onDismiss: () => void;
  onRestoreSafe: () => void;
}

export const LabHazardModal: React.FC<LabHazardModalProps> = ({
  domainLabel,
  hazard,
  onDismiss,
  onRestoreSafe,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Peringatan K3 ${domainLabel}`}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="max-w-lg w-full rounded-2xl bg-[var(--comfort-elevated)] border border-rose-500/70 shadow-2xl p-6 space-y-4 text-[var(--comfort-text)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/35 text-[11px] font-mono font-bold text-rose-700 dark:text-rose-300 uppercase">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Peringatan K3 — {domainLabel}</span>
          </span>
          {hazard.triggerParamSummary && (
            <span className="px-2 py-0.5 rounded bg-[var(--comfort-surface-subtle)] text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/35 tabular-nums">
              {hazard.triggerParamSummary}
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-[var(--comfort-text)]">{hazard.title}</h3>
        <p className="text-xs leading-relaxed text-[var(--comfort-text-muted)] comfort-prose">
          {hazard.scientificExplanation}
        </p>

        {hazard.mitigationInstruction && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 p-3 text-xs text-[var(--comfort-text)]">
            <span className="font-bold text-emerald-700 dark:text-emerald-300 block mb-0.5">
              Prosedur Mitigasi K3:
            </span>
            <span className="text-[var(--comfort-text-muted)]">{hazard.mitigationInstruction}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onDismiss();
            }}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text)] hover:opacity-90 cursor-pointer"
          >
            Saya Paham
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playRecordSuccess();
              onRestoreSafe();
            }}
            className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Pulihkan ke Parameter Aman
          </button>
        </div>
      </div>
    </div>
  );
};
