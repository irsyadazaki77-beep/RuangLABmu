import React, { useEffect, useState, useRef } from 'react';
import {
  Clock,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { labSound } from '../../utils/soundEngine';

export interface ExamSessionControllerProps {
  studentName: string;
  studentGroup: string;
  moduleId: string;
  domain: string;
  ws?: WebSocket | null;
  isSubmissionLocked: boolean;
  onLockSubmission: () => void;
  onAutoSubmitExam: () => Promise<void> | void;
  children?: React.ReactNode;
}

function parseExamConfigFromUrl(): { enabled: boolean; durationMinutes: number } {
  if (typeof window === 'undefined') {
    return { enabled: false, durationMinutes: 30 };
  }
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') || '').toLowerCase();
  const durationRaw = Number(params.get('duration'));
  const durationMinutes =
    Number.isFinite(durationRaw) && durationRaw > 0 ? Math.min(180, durationRaw) : 30;
  return {
    enabled: mode === 'exam',
    durationMinutes,
  };
}

export const ExamSessionController: React.FC<ExamSessionControllerProps> = ({
  studentName,
  studentGroup,
  moduleId,
  domain,
  ws,
  isSubmissionLocked,
  onLockSubmission,
  onAutoSubmitExam,
  children,
}) => {
  const { t } = useTranslation();
  const initialConfig = parseExamConfigFromUrl();

  const [isExamMode, setIsExamMode] = useState<boolean>(initialConfig.enabled);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    Math.round(initialConfig.durationMinutes * 60)
  );
  const [tabViolationCount, setTabViolationCount] = useState<number>(0);
  const [antiCheatWarningMessage, setAntiCheatWarningMessage] = useState<string | null>(null);
  const [autoSubmittedNotice, setAutoSubmittedNotice] = useState<boolean>(false);

  const hasAutoSubmittedRef = useRef<boolean>(false);

  // Sync URL queries if changed externally
  useEffect(() => {
    const cfg = parseExamConfigFromUrl();
    if (cfg.enabled) {
      setIsExamMode(true);
      setRemainingSeconds(Math.round(cfg.durationMinutes * 60));
    }
  }, []);

  // Countdown Timer Effect
  useEffect(() => {
    if (!isExamMode || isSubmissionLocked) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          if (!hasAutoSubmittedRef.current) {
            hasAutoSubmittedRef.current = true;
            onLockSubmission();
            setAutoSubmittedNotice(true);
            void onAutoSubmitExam();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isExamMode, isSubmissionLocked, onAutoSubmitExam, onLockSubmission]);

  // Anti-Cheat Tab Monitor (document.visibilitychange & window.onblur)
  useEffect(() => {
    if (!isExamMode || isSubmissionLocked) return;

    let lastTriggerTs = 0;

    const triggerAntiCheatAlert = (sourceEvent: 'visibilitychange' | 'window_blur') => {
      const now = Date.now();
      if (now - lastTriggerTs < 800) return; // debounce paired blur + visibilitychange
      lastTriggerTs = now;

      const warningText = 'Peringatan: Tetap berada di halaman praktikum selama ujian!';
      setAntiCheatWarningMessage(warningText);
      setTabViolationCount((c) => {
        const nextCount = c + 1;

        // Send warning log to server via WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(
              JSON.stringify({
                type: 'notification:push',
                payload: {
                  id: `notif-anticheat-${now}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  severity: 'critical',
                  domain: 'Pengajar',
                  title: `Peringatan Anti-Cheat Ujian: ${studentName}`,
                  message: `${studentName} (${studentGroup}) terdeteksi beralih tab/jendela (${sourceEvent}) pada modul ${moduleId} (Pelanggaran ke-${nextCount}).`,
                },
              })
            );
          } catch {
            // ignore ws send error
          }
        }
        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' || document.hidden) {
        triggerAntiCheatAlert('visibilitychange');
      }
    };

    const handleWindowBlur = () => {
      triggerAntiCheatAlert('window_blur');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isExamMode, isSubmissionLocked, studentName, studentGroup, moduleId, ws]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = remainingSeconds <= 300 && remainingSeconds > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top Controlled Exam Bar when Exam Mode is Active */}
      {isExamMode && (
        <div
          role="region"
          aria-label="Pengawas Mode Ujian Praktikum Terkontrol"
          className="shrink-0 bg-slate-900 text-white border-b border-rose-500/40 px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-40"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-rose-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{t('exam.bannerTitle')}</span>
            </span>

            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>

            {/* Countdown Timer */}
            <div
              data-testid="exam-countdown-timer"
              className={`flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-lg border tabular-nums ${
                remainingSeconds === 0
                  ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                  : isUrgent
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-sky-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {t('exam.timeLeft')}: {formattedTime}
              </span>
            </div>

            {/* Tab Monitor Violation Counter */}
            <div className="text-xs text-slate-300 font-mono tabular-nums">
              {t('exam.tabSwitchCount')}:{' '}
              <strong className={tabViolationCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {tabViolationCount}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSubmissionLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('exam.lockedStatus')}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  labSound.playSuccessChime();
                  hasAutoSubmittedRef.current = true;
                  onLockSubmission();
                  void onAutoSubmitExam();
                }}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kumpulkan &amp; Kunci Ujian Sekarang</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Anti-Cheat Tab Switch Warning Alert */}
      {isExamMode && antiCheatWarningMessage && (
        <div
          role="alert"
          data-testid="exam-anticheat-alert"
          className="shrink-0 bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between gap-3 text-xs font-bold z-40"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{antiCheatWarningMessage}</span>
            <span className="font-mono text-[11px] opacity-80">
              (Log peringatan telah dikirim ke server pengawas via WebSocket · Pelanggaran #{tabViolationCount})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAntiCheatWarningMessage(null)}
            className="px-2.5 py-0.5 rounded bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 font-semibold cursor-pointer"
          >
            Saya Mengerti
          </button>
        </div>
      )}

      {/* Auto-Submit Notification Banner when Timer Reaches 00:00 */}
      {isExamMode && autoSubmittedNotice && (
        <div
          role="status"
          className="shrink-0 bg-emerald-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-xs font-bold z-40"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t('exam.autoSubmitted')}</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoSubmittedNotice(false)}
            className="px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Wrapped Workspace Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
};
