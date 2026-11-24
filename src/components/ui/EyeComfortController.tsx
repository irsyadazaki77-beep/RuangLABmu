import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Eye, Play, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { EYE_REST_BREAK_SEC, useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';

/**
 * Root Eye-Comfort & Ergonomic Scheduler Controller:
 * - Syncs all 6 visual comfort & accessibility attributes on <html>
 * - Runs Page-Visibility-aware global 20-20-20 eye-rest timer
 * - Renders non-blocking Blue-Light Warmth overlay (bypassed in Projector Mode)
 * - Renders non-intrusive bottom-right 20-20-20 Eye-Rest Toast
 */
export const EyeComfortController: React.FC = () => {
  const {
    comfortPrefs,
    projectorMode,
    eyeRestPromptOpen,
    eyeRestBreakSecondsLeft,
    eyeRestPaused,
    tickEyeRestTimer,
    startEyeRestBreak,
    snoozeEyeRestBreak,
    dismissEyeRestBreak,
  } = useUIStore(
    useShallow((s) => ({
      comfortPrefs: s.comfortPrefs,
      projectorMode: s.projectorMode,
      eyeRestPromptOpen: s.eyeRestPromptOpen,
      eyeRestBreakSecondsLeft: s.eyeRestBreakSecondsLeft,
      eyeRestPaused: s.eyeRestPaused,
      tickEyeRestTimer: s.tickEyeRestTimer,
      startEyeRestBreak: s.startEyeRestBreak,
      snoozeEyeRestBreak: s.snoozeEyeRestBreak,
      dismissEyeRestBreak: s.dismissEyeRestBreak,
    }))
  );

  const eyeRestEnabled =
    comfortPrefs.eyeRestTimerEnabled ?? comfortPrefs.eyeRestReminderEnabled ?? true;
  const activeBlueLight = projectorMode ? 'off' : comfortPrefs.blueLightFilter || 'off';

  // Synchronize root HTML attributes & body classes cleanly regardless of active stage
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', comfortPrefs.theme);
    root.setAttribute('data-font-scale', comfortPrefs.fontScale);
    root.setAttribute('data-line-spacing', comfortPrefs.lineSpacing);
    root.setAttribute('data-dyslexia-mode', comfortPrefs.dyslexiaMode ? 'true' : 'false');
    root.setAttribute('data-colorblind', comfortPrefs.colorBlindSafe ? 'true' : 'false');
    root.setAttribute('data-blue-light-filter', activeBlueLight);
    root.setAttribute('data-projector-mode', String(projectorMode));

    if (comfortPrefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (projectorMode) {
      document.body.classList.add('projector-mode');
    } else {
      document.body.classList.remove('projector-mode');
    }
  }, [
    comfortPrefs.theme,
    comfortPrefs.fontScale,
    comfortPrefs.lineSpacing,
    comfortPrefs.dyslexiaMode,
    comfortPrefs.colorBlindSafe,
    activeBlueLight,
    projectorMode,
  ]);

  // Global 20-20-20 scheduler loop (pauses automatically when tab is hidden)
  useEffect(() => {
    if (!eyeRestEnabled || eyeRestPaused) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      const { event } = tickEyeRestTimer();
      if (event === 'prompt') {
        labSound.playStep();
      } else if (event === 'break-complete') {
        labSound.playRecordSuccess();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [eyeRestEnabled, eyeRestPaused, tickEyeRestTimer]);

  const showToast = eyeRestPromptOpen || eyeRestBreakSecondsLeft !== null;
  const isBreaking = eyeRestBreakSecondsLeft !== null;
  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const breakProgress = isBreaking
    ? Math.max(0, Math.min(1, (eyeRestBreakSecondsLeft ?? 0) / EYE_REST_BREAK_SEC))
    : 1;
  const ringDashOffset = ringCircumference * (1 - breakProgress);

  return (
    <>
      {/* Global Non-Blocking Blue-Light Warmth Compositor Overlay */}
      {activeBlueLight !== 'off' && (
        <div
          aria-hidden="true"
          data-testid="blue-light-warmth-overlay"
          className="pointer-events-none fixed inset-0 z-[9999] transition-colors duration-300"
          style={{
            backgroundColor:
              activeBlueLight === 'night'
                ? 'rgba(255, 158, 58, 0.22)'
                : 'rgba(255, 194, 102, 0.13)',
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {/* Non-Intrusive 20-20-20 Eye-Rest Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
            data-testid="eye-rest-202020-toast"
            className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-[9998] w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-2xl p-4 text-xs"
          >
            <div className="flex items-start gap-3">
              {isBreaking ? (
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
                    <circle
                      cx="22"
                      cy="22"
                      r={ringRadius}
                      fill="none"
                      stroke="var(--comfort-border)"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r={ringRadius}
                      fill="none"
                      stroke={comfortPrefs.colorBlindSafe ? '#009E73' : '#059669'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashOffset}
                      style={{ transition: 'stroke-dashoffset 250ms linear' }}
                    />
                  </svg>
                  <span className="absolute font-mono font-bold text-xs tabular-nums text-[var(--comfort-text)]">
                    {eyeRestBreakSecondsLeft}s
                  </span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Eye className="w-5 h-5" aria-hidden="true" />
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
                    <span>
                      {isBreaking
                        ? 'Istirahat Fokus Mata (20 Detik)'
                        : 'Waktunya Istirahat Mata 20-20-20'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      dismissEyeRestBreak();
                    }}
                    aria-label="Tutup pengingat istirahat mata"
                    className="p-1 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="comfort-prose text-xs text-[var(--comfort-text-muted)]">
                  {isBreaking ? (
                    <>
                      Alihkan pandangan ke objek berjarak{' '}
                      <strong className="text-[var(--comfort-text)]">≥ 6 meter</strong> (jendela
                      atau ujung ruangan) selama{' '}
                      <strong className="font-mono text-[var(--comfort-text)] tabular-nums">
                        {eyeRestBreakSecondsLeft} detik
                      </strong>
                      . Data praktikum Anda tetap aman.
                    </>
                  ) : (
                    <>
                      Anda telah menatap layar selama 20 menit. Tatap objek jauh (≥ 6 m) selama 20
                      detik untuk mengurangi kelelahan fokus lensa mata.
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {isBreaking ? (
                    <button
                      type="button"
                      data-testid="eye-rest-finish-early-btn"
                      onClick={() => {
                        labSound.playClick();
                        dismissEyeRestBreak();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] hover:opacity-90 border border-[var(--comfort-border)] text-[var(--comfort-text)] font-semibold text-2xs cursor-pointer"
                    >
                      Selesai Lebih Awal
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid="eye-rest-start-break-btn"
                        onClick={() => {
                          labSound.playStep();
                          startEyeRestBreak();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                        <span>Mulai 20 Detik</span>
                      </button>
                      <button
                        type="button"
                        data-testid="eye-rest-snooze-btn"
                        onClick={() => {
                          labSound.playClick();
                          snoozeEyeRestBreak(5);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] hover:opacity-90 border border-[var(--comfort-border)] text-[var(--comfort-text)] font-semibold text-2xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span>Tunda 5m</span>
                      </button>
                      <button
                        type="button"
                        data-testid="eye-rest-skip-btn"
                        onClick={() => {
                          labSound.playClick();
                          dismissEyeRestBreak();
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] font-medium text-2xs cursor-pointer"
                      >
                        Lewati
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
