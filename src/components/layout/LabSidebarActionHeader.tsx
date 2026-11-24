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

  const handleManualRecord = () => {
    onRecordTrial();
    triggerRecordFeedback();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleManualRecord}
        title="Catat data pengamatan saat ini (Pintasan keyboard: D)"
        className="flex-1 min-w-[144px] min-h-[44px] px-3 py-2 rounded-xl comfort-btn-primary font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] focus-visible:ring-offset-1"
      >
        {justRecorded ? (
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
        ) : (
          <Camera className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="tabular-nums">
          {justRecorded
            ? `Data #${recordsCount} Tercatat`
            : `+ Catat Data (${isReady ? `${recordsCount} Siap` : `${recordsCount}/${minRequired}`})`}
        </span>
        {!justRecorded && (
          <kbd className="hidden lg:inline-block ml-0.5 px-1 py-0 rounded bg-white/18 text-2xs font-mono font-bold leading-tight">
            D
          </kbd>
        )}
      </button>

      {onProceedToAnalysis && (
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            onProceedToAnalysis();
          }}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
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
