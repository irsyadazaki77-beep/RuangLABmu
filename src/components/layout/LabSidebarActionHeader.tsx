import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { labSound } from '../../utils/soundEngine';
import { LAB_EVENTS, subscribeLabEvent } from '../../utils/labEventBus';

export interface LabSidebarActionHeaderProps {
  recordsCount: number;
  minRequired?: number;
  accentColor?: 'sky' | 'teal' | 'emerald';
  onRecordTrial: () => void;
  onProceedToAnalysis?: () => void;
}

export const LabSidebarActionHeader: React.FC<LabSidebarActionHeaderProps> = ({
  recordsCount,
  minRequired = 3,
  onRecordTrial,
  onProceedToAnalysis,
}) => {
  const isReady = recordsCount >= minRequired;
  const [justRecorded, setJustRecorded] = useState(false);
  const onRecordRef = useRef(onRecordTrial);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onRecordRef.current = onRecordTrial;
  }, [onRecordTrial]);

  const triggerRecordFeedback = () => {
    setJustRecorded(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null;
      setJustRecorded(false);
    }, 900);
  };

  useEffect(() => {
    const unsub = subscribeLabEvent(LAB_EVENTS.RECORD_TRIAL, () => {
      onRecordRef.current();
      triggerRecordFeedback();
    });
    return () => {
      unsub();
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {justRecorded ? (
          <Check className="w-3.5 h-3.5 text-[var(--comfort-success)] shrink-0" aria-hidden="true" />
        ) : (
          <Camera className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
        )}
        <span className="text-2xs font-bold text-[var(--comfort-text)] tabular-nums truncate">
          {justRecorded
            ? `Data #${recordsCount} Tercatat`
            : isReady
            ? `Data: ${recordsCount} Siap`
            : `Progres Data: ${recordsCount}/${minRequired}`}
        </span>
      </div>

      {onProceedToAnalysis && (
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            onProceedToAnalysis();
          }}
          className={`min-h-[34px] px-2.5 py-1 rounded-lg text-2xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            isReady
              ? 'comfort-accent-soft border font-bold hover:opacity-90'
              : 'comfort-btn-secondary'
          }`}
        >
          Grafik &amp; LKS →
        </button>
      )}
    </div>
  );
};
