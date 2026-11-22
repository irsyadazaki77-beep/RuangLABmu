import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Activity,
  Clock,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
} from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
import {
  TelemetryReplayEvent,
  buildSubmissionTelemetryTimeline,
} from '../../utils/telemetryRecorder';
import { labSound } from '../../utils/soundEngine';

export interface SessionReplayPlayerProps {
  submission: LabSubmission | null;
  isOpen: boolean;
  onClose: () => void;
}

const SPEED_MULTIPLIERS = [1, 2, 4] as const;

export const SessionReplayPlayer: React.FC<SessionReplayPlayerProps> = ({
  submission,
  isOpen,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const events: TelemetryReplayEvent[] = useMemo(() => {
    if (!submission) return [];
    if (Array.isArray(submission.telemetryLog) && submission.telemetryLog.length > 0) {
      return submission.telemetryLog;
    }
    return buildSubmissionTelemetryTimeline(submission.domain, submission.observationData);
  }, [submission]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsPlaying(false);
    }
  }, [isOpen, submission?.id]);

  useEffect(() => {
    if (!isPlaying || events.length <= 1) return;

    const intervalMs = Math.max(180, Math.round(900 / playbackSpeed));
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, events.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !submission || typeof document === 'undefined') return null;

  const activeEvent = events[currentIndex] || events[0];
  const startTs = events[0]?.timestamp || Date.now();
  const elapsedSec = activeEvent ? Math.max(0, Math.round((activeEvent.timestamp - startTs) / 1000)) : 0;

  const parameterStateSnapshot: Record<string, number> = {};
  for (let i = 0; i <= currentIndex && i < events.length; i++) {
    const ev = events[i];
    if (ev) {
      parameterStateSnapshot[ev.parameterName] = ev.value;
    }
  }

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Replay Kronologi Praktikum — ${submission.studentName}`}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--comfort-border)] flex items-center justify-between bg-[var(--comfort-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--comfort-text)]">
                Replay Kronologi Praktikum — {submission.studentName}
              </h2>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Modul: {submission.moduleId} ({submission.domain}) · {events.length} Kejadian Terekam
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onClose();
            }}
            aria-label="Tutup Pemutar Replay"
            className="p-2 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrubber & Playback Controls Bar */}
        <div className="p-4 sm:px-6 bg-[var(--comfort-surface)] text-[var(--comfort-text)] border-b border-[var(--comfort-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  if (currentIndex >= events.length - 1 && !isPlaying) {
                    setCurrentIndex(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((p) => !p);
                  }
                }}
                className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setIsPlaying(false);
                  setCurrentIndex(0);
                }}
                title="Reset ke Awal"
                className="p-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] hover:opacity-90 text-[var(--comfort-text)] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-w-[200px] flex items-center gap-3">
              <span className="font-mono text-xs text-sky-600 dark:text-sky-400 tabular-nums shrink-0 font-bold">
                t = +{formatElapsed(elapsedSec)}
              </span>
              <input
                type="range"
                aria-label="Timeline Scrubber Replay Praktikum"
                min={0}
                max={Math.max(0, events.length - 1)}
                step={1}
                value={currentIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentIndex(Number(e.target.value));
                }}
                className="w-full h-2 bg-[var(--comfort-surface-subtle)] rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <span className="font-mono text-xs text-[var(--comfort-text-muted)] tabular-nums shrink-0">
                Langkah {currentIndex + 1}/{events.length}
              </span>
            </div>

            <div
              role="group"
              aria-label="Kecepatan Replay"
              className="flex items-center gap-1 bg-[var(--comfort-surface-subtle)] p-1 rounded-lg border border-[var(--comfort-border)]"
            >
              {SPEED_MULTIPLIERS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setPlaybackSpeed(spd);
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors cursor-pointer tabular-nums ${
                    playbackSpeed === spd
                      ? 'bg-sky-600 text-white'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          <div className="md:col-span-5 p-5 border-b md:border-b-0 md:border-r border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] overflow-y-auto space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                Status Variabel pada Langkah #{currentIndex + 1}
              </span>
              <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                {activeEvent?.note || `Mengubah ${activeEvent?.parameterName} → ${activeEvent?.value}`}
              </h3>
              <p className="text-xs text-[var(--comfort-text-muted)] font-mono tabular-nums">
                Tahap Alur #{activeEvent?.stepIndex ?? 2} · Waktu: +{formatElapsed(elapsedSec)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] space-y-2.5">
              <div className="text-xs font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-500" />
                <span>Snapshot Parameter Meja 3D</span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(parameterStateSnapshot).map(([paramKey, val]) => (
                  <div
                    key={paramKey}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono ${
                      activeEvent?.parameterName === paramKey
                        ? 'bg-sky-500/15 border border-sky-500/40 text-sky-700 dark:text-sky-300 font-bold'
                        : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]'
                    }`}
                  >
                    <span>{paramKey}</span>
                    <span className="tabular-nums">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] space-y-1.5 text-xs">
              <div className="font-bold text-[var(--comfort-text)]">
                Metrik Regresi Akhir Siswa
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-[var(--comfort-text-muted)]">R² (Koefisien Determinasi):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {submission.regressionMetrics?.rSquared?.toFixed(3) ?? '0.992'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-[var(--comfort-text-muted)]">Persamaan Regresi:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">
                  {submission.regressionMetrics?.equation || 'y = mx + c'}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 p-5 overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--comfort-border)]">
              <h3 className="text-xs font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>Daftar Log Kejadian Kronologis (Klik untuk Melompat)</span>
              </h3>
              <span className="text-[11px] text-[var(--comfort-text-muted)] font-mono tabular-nums">
                {events.length} Kejadian
              </span>
            </div>

            <div className="space-y-2">
              {events.map((ev, idx) => {
                const isCurrent = idx === currentIndex;
                const relSec = Math.max(0, Math.round((ev.timestamp - startTs) / 1000));
                const isAnomaly = ev.eventType === 'anomaly';
                const isRecord = ev.eventType === 'record';
                const isTitration = ev.eventType === 'titration';

                return (
                  <button
                    key={`${ev.timestamp}-${idx}`}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setIsPlaying(false);
                      setCurrentIndex(idx);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isCurrent
                        ? 'bg-sky-500/15 border-sky-500/50'
                        : isAnomaly
                        ? 'bg-rose-500/10 border-rose-500/35 hover:bg-rose-500/15'
                        : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] hover:bg-[var(--comfort-surface-subtle)]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {isAnomaly ? (
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                        ) : isRecord ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : isTitration ? (
                          <FlaskConical className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Sliders className="w-4 h-4 text-sky-500" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-[var(--comfort-text)]">
                          {ev.note || `Mengubah parameter ${ev.parameterName}`}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--comfort-text-muted)]">
                          Parameter:{' '}
                          <strong className="text-[var(--comfort-text)]">{ev.parameterName}</strong> ={' '}
                          <strong className="text-sky-600 dark:text-sky-400 tabular-nums">
                            {ev.value}
                          </strong>{' '}
                          · Tahap #{ev.stepIndex}
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-[11px] text-[var(--comfort-text-muted)] tabular-nums shrink-0">
                      +{formatElapsed(relSec)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
