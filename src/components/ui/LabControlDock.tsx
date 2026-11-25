import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Camera,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Compass,
  Mic,
  MicOff,
  CheckCircle2,
  Circle,
  X,
  History,
  PlusCircle,
  Check,
  Keyboard,
  ArrowRight,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import { LAB_EVENTS, emitLabEvent } from '../../utils/labEventBus';
import { useTranslation } from 'react-i18next';
import { aiVoiceAssistant, VoiceAssistantState } from '../../services/aiVoiceAssistant';

export interface LabControlDockProps {
  notificationsCount?: number;
  hasLowR2Alert?: boolean;
  snapshotCount?: number;
  recordsCount?: number;
}

const SPEED_OPTIONS = [0.5, 1, 2] as const;

const KEYBOARD_SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: 'D', label: 'Catat data pengamatan saat ini' },
  { keys: 'Spasi', label: 'Jalankan / jeda simulasi 3D' },
  { keys: 'R', label: 'Reset percobaan ke kondisi awal' },
  { keys: 'S', label: 'Tangkap snapshot kanvas 3D' },
  { keys: '1–4', label: 'Pindah sudut preset kamera 3D' },
  { keys: '[ / ]', label: 'Buka/tutup panel Parameter / Telemetri' },
  { keys: 'Z', label: 'Mode Fokus 3D (sembunyikan panel)' },
  { keys: 'M', label: 'Bisukan / nyalakan efek suara' },
  { keys: 'A', label: 'Buka / tutup panel Dr. LabMu' },
  { keys: 'Ctrl+K', label: 'Pencarian cepat modul & perintah' },
];

export const LabControlDock: React.FC<LabControlDockProps> = ({
  snapshotCount = 0,
  recordsCount = 0,
}) => {
  const { t } = useTranslation();
  const {
    soundEnabled,
    toggleSound,
    isLobbyMode,
    workflowStep,
    setWorkflowStep,
    userRole,
    isSimulating,
    playbackSpeed,
    setPlaybackSpeed,
    toggleSimulation,
    triggerResetTrial,
    triggerCaptureSnapshot,
    isTimeTraveling,
    timelineCount,
    timelineCursor,
    timelineMinTime,
    timelineMaxTime,
    timelineCurrentTime,
    seekTimelineCursor,
    liveTelemetrySeries,
  } = useLabStore(
    useShallow((s) => ({
      soundEnabled: s.soundEnabled,
      toggleSound: s.toggleSound,
      isLobbyMode: s.isLobbyMode,
      workflowStep: s.workflowStep,
      setWorkflowStep: s.setWorkflowStep,
      userRole: s.userRole,
      isSimulating: s.isSimulating,
      playbackSpeed: s.playbackSpeed,
      setPlaybackSpeed: s.setPlaybackSpeed,
      toggleSimulation: s.toggleSimulation,
      triggerResetTrial: s.triggerResetTrial,
      triggerCaptureSnapshot: s.triggerCaptureSnapshot,
      isTimeTraveling: s.isTimeTraveling,
      timelineCount: s.timelineCount,
      timelineCursor: s.timelineCursor,
      timelineMinTime: s.timelineMinTime,
      timelineMaxTime: s.timelineMaxTime,
      timelineCurrentTime: s.timelineCurrentTime,
      seekTimelineCursor: s.seekTimelineCursor,
      liveTelemetrySeries: s.liveTelemetrySeries,
    }))
  );

  const { zenMode, toggleZenMode, mobileTab } = useUIStore(
    useShallow((s) => ({
      zenMode: s.zenMode,
      toggleZenMode: s.toggleZenMode,
      mobileTab: s.mobileTab,
    }))
  );

  const [snapshotPulse, setSnapshotPulse] = useState<boolean>(false);
  const [recordPulse, setRecordPulse] = useState<boolean>(false);
  const [recordToastLabel, setRecordToastLabel] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [voiceState, setVoiceState] = useState<VoiceAssistantState>(() =>
    aiVoiceAssistant.getState()
  );

  const prevRecordsCountRef = useRef<number>(recordsCount);
  const recordPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = aiVoiceAssistant.subscribe((next) => setVoiceState(next));
    return unsub;
  }, []);

  useEffect(() => {
    if (recordsCount > prevRecordsCountRef.current) {
      setRecordPulse(true);
      setRecordToastLabel(`Data #${recordsCount} tercatat`);
      if (recordPulseTimerRef.current) clearTimeout(recordPulseTimerRef.current);
      recordPulseTimerRef.current = setTimeout(() => {
        setRecordPulse(false);
        setRecordToastLabel(null);
        recordPulseTimerRef.current = null;
      }, 1500);
    }
    prevRecordsCountRef.current = recordsCount;
  }, [recordsCount]);

  useEffect(() => {
    return () => {
      if (recordPulseTimerRef.current) {
        clearTimeout(recordPulseTimerRef.current);
        recordPulseTimerRef.current = null;
      }
    };
  }, []);

  const teacherViewMode = useUIStore((s) => s.teacherViewMode);
  const is3DStageActive =
    !isLobbyMode &&
    ((userRole === 'siswa' && workflowStep === 2) ||
      (userRole === 'pengajar' && teacherViewMode === 'lab3d'));

  const handleToggleSimulation = () => {
    labSound.playClick();
    toggleSimulation();
  };

  const handleResetTrial = () => {
    labSound.playClick(460);
    triggerResetTrial();
  };

  const handleRecordTrial = (source: 'dock' | 'keyboard' = 'dock') => {
    labSound.playRecordSuccess();
    setRecordPulse(true);
    emitLabEvent(LAB_EVENTS.RECORD_TRIAL, { source, timestamp: Date.now() });
    if (recordPulseTimerRef.current) clearTimeout(recordPulseTimerRef.current);
    recordPulseTimerRef.current = setTimeout(() => {
      setRecordPulse(false);
      recordPulseTimerRef.current = null;
    }, 900);
  };

  const handleCapture3DSnapshot = () => {
    labSound.playRecordSuccess();
    setSnapshotPulse(true);
    setTimeout(() => setSnapshotPulse(false), 350);
    triggerCaptureSnapshot();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          activeEl.isContentEditable
        ) {
          return;
        }
      }

      if (e.key === '?' && is3DStageActive) {
        e.preventDefault();
        labSound.playClick();
        setIsGuideOpen(false);
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape' && (isGuideOpen || isShortcutsOpen)) {
        setIsGuideOpen(false);
        setIsShortcutsOpen(false);
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'z') {
        e.preventDefault();
        labSound.playClick();
        useUIStore.getState().toggleZenMode();
      } else if (key === 'm') {
        e.preventDefault();
        const currentSound = useLabStore.getState().soundEnabled;
        useLabStore.getState().toggleSound();
        labSound.setEnabled(!currentSound);
      } else if (key === 'a') {
        e.preventDefault();
        labSound.playClick();
        useUIStore.getState().toggleDrawer();
      } else if (key === 'd' && is3DStageActive) {
        e.preventDefault();
        handleRecordTrial('keyboard');
      } else if (key === 'r' && is3DStageActive) {
        e.preventDefault();
        labSound.playClick(460);
        useLabStore.getState().triggerResetTrial();
      } else if (key === 's' && is3DStageActive) {
        e.preventDefault();
        labSound.playRecordSuccess();
        setSnapshotPulse(true);
        setTimeout(() => setSnapshotPulse(false), 350);
        useLabStore.getState().triggerCaptureSnapshot();
      } else if (e.code === 'Space' && is3DStageActive) {
        if (activeEl && activeEl.tagName.toLowerCase() === 'button') return;
        e.preventDefault();
        labSound.playClick();
        useLabStore.getState().toggleSimulation();
      } else if (
        is3DStageActive &&
        (key === '1' || key === '2' || key === '3' || key === '4')
      ) {
        e.preventDefault();
        labSound.playClick();
        const presetIdx = (Number(key) - 1) as 0 | 1 | 2 | 3;
        emitLabEvent(LAB_EVENTS.SET_CAMERA_PRESET, { index: presetIdx });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [is3DStageActive, isGuideOpen, isShortcutsOpen]);

  if (!is3DStageActive) {
    return null;
  }

  const safeTimelineMaxIdx = Math.max(0, timelineCount - 1);
  const safeTimelineVal = Math.max(0, Math.min(safeTimelineMaxIdx, timelineCursor));
  const guideStepCount = recordsCount >= 3 ? (workflowStep >= 3 ? '3/3' : '2/3') : '1/3';
  const isReadyForAnalysis = recordsCount >= 3;
  const isMobileSheetOpen = mobileTab === 'variables' || mobileTab === 'telemetry';

  // Compute inline mini-sparkline points from recent liveTelemetrySeries
  const sparklineSample = liveTelemetrySeries.slice(-16);
  const sparklinePoints = (() => {
    if (sparklineSample.length < 2) return '0,10 18,8 36,10';
    const vals = sparklineSample.map((pt) => (Number.isFinite(pt.primary) ? pt.primary : 0));
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const span = Math.max(1e-4, maxV - minV);
    return vals
      .map((v, i) => {
        const x = ((i / (vals.length - 1)) * 36).toFixed(1);
        const y = (16 - ((v - minV) / span) * 12).toFixed(1);
        return `${x},${y}`;
      })
      .join(' ');
  })();

  return (
    <div
      role="toolbar"
      aria-label="Dock Kontrol Cepat RuangLABmu"
      className={`${
        isMobileSheetOpen ? 'hidden lg:flex' : 'flex'
      } fixed bottom-[60px] lg:bottom-2.5 left-1/2 -translate-x-1/2 z-20 lg:z-40 max-w-[calc(100vw-16px)] lg:max-w-[calc(100vw-24px)] flex-col items-stretch gap-1 px-2 py-1.5 rounded-xl studio-hud-surface shadow-lg border transition-all duration-200 select-none`}
    >
      {/* Floating Instant Confirmation Toast above Dock */}
      {recordToastLabel && (
        <div
          role="status"
          aria-live="polite"
          data-testid="dock-record-confirmation"
          className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-[var(--comfort-success)] text-white text-2xs font-bold shadow-md flex items-center gap-1.5 whitespace-nowrap animate-fade-in"
        >
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{recordToastLabel}</span>
          {isReadyForAnalysis && (
            <span className="opacity-90 font-normal">· Siap Analisis</span>
          )}
        </div>
      )}

      {/* Ultra-slim Time-Travel Scrubber Strip */}
      {timelineCount > 1 && (
        <div
          data-testid="time-travel-scrubber-bar"
          className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-2xs font-mono transition-colors ${
            isTimeTraveling
              ? 'bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)]'
              : 'text-[var(--comfort-hud-muted)]'
          }`}
        >
          <span className="flex items-center gap-1 font-bold shrink-0">
            <History
              className={`w-3 h-3 ${
                isTimeTraveling ? 'text-[var(--comfort-warning)]' : 'text-[var(--comfort-accent)]'
              }`}
              aria-hidden="true"
            />
            <span className="hidden md:inline">{isTimeTraveling ? 'Time-Travel' : 'Linimasa'}</span>
          </span>
          <input
            type="range"
            data-testid="time-travel-scrubber"
            aria-label="Time-Travel Scrubber Simulasi 3D"
            min={0}
            max={safeTimelineMaxIdx}
            step={1}
            value={safeTimelineVal}
            onChange={(e) => {
              seekTimelineCursor(Number(e.target.value));
            }}
            className="flex-1 min-w-[88px] sm:min-w-[140px] h-1 accent-[var(--comfort-accent)] cursor-ew-resize"
          />
          <span className="tabular-nums font-bold shrink-0 text-[var(--comfort-hud-text)]">
            t={timelineCurrentTime.toFixed(2)}s
            <span className="opacity-65 hidden xl:inline">
              {' '}
              ({timelineMinTime.toFixed(1)}–{timelineMaxTime.toFixed(1)}s)
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-nowrap items-center justify-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
        {/* 0. Quick Record Data CTA ([D]) — Priority #1 */}
        <button
          type="button"
          data-testid="dock-record-trial-btn"
          onClick={() => handleRecordTrial('dock')}
          title="[D] Catat Data Pengamatan 3D Saat Ini"
          aria-label="+ Catat Data Pengamatan 3D (Shortcut D)"
          className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-[0.96] cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            recordPulse
              ? 'bg-[var(--comfort-success)] text-white shadow-sm'
              : 'comfort-btn-primary shadow-2xs'
          }`}
        >
          {recordPulse ? (
            <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <PlusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>Catat Data</span>
          <span className="font-mono text-2xs px-1 py-0 rounded bg-white/18 tabular-nums">
            {isReadyForAnalysis ? `${recordsCount}✓` : `${recordsCount}/3`}
          </span>
          <kbd className="hidden xl:inline font-mono text-2xs opacity-80">D</kbd>
        </button>

        {/* 0.5. Inline Live Mini-Sparkline & Trial Step Indicator */}
        <div
          data-testid="dock-mini-sparkline"
          title={`Tren Telemetri Live · ${recordsCount} dari minimal 3 titik data tercatat`}
          className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] shrink-0"
        >
          <svg
            width="38"
            height="18"
            viewBox="0 0 38 18"
            fill="none"
            aria-hidden="true"
            className="shrink-0 overflow-visible"
          >
            <polyline
              points={sparklinePoints}
              fill="none"
              stroke="var(--comfort-accent)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex items-center gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((dotIdx) => (
              <span
                key={dotIdx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  recordsCount > dotIdx
                    ? 'bg-[var(--comfort-success)]'
                    : 'bg-[var(--comfort-border)]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="hidden sm:block w-px h-4 bg-[var(--comfort-border)] mx-0.5 shrink-0" aria-hidden="true" />

        {/* 1. Play/Pause */}
        <button
          type="button"
          onClick={handleToggleSimulation}
          title="[Space] Play/Jeda Simulasi"
          aria-label="Play atau Jeda Simulasi 3D (Shortcut Space)"
          className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            isSimulating
              ? 'bg-[var(--comfort-success-soft)] text-[var(--comfort-success)] border-[var(--comfort-success-border)]'
              : 'bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)] border-[var(--comfort-warning-border)]'
          }`}
        >
          {isSimulating ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{isSimulating ? t('controls.pause') : t('controls.play')}</span>
        </button>

        {/* 2. Reset */}
        <button
          type="button"
          onClick={handleResetTrial}
          title="[R] Reset Percobaan Simulasi"
          aria-label="Reset Percobaan Simulasi (Shortcut R)"
          className="min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[var(--comfort-warning)]" aria-hidden="true" />
          <span className="hidden 2xl:inline">{t('controls.reset')}</span>
        </button>

        <div className="hidden sm:block w-px h-4 bg-[var(--comfort-border)] mx-0.5 shrink-0" aria-hidden="true" />

        {/* 3. Speed Selector */}
        <div
          className="flex items-center gap-0.5 studio-hud-subcard p-0.5 rounded-lg border shrink-0"
          role="group"
          aria-label={t('controls.speed')}
        >
          <Gauge className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)] ml-1 mr-0.5 hidden 2xl:inline" aria-hidden="true" />
          {SPEED_OPTIONS.map((spd) => {
            const isActive = Math.abs(playbackSpeed - spd) < 0.05;
            return (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setPlaybackSpeed(spd);
                }}
                className={`min-h-[28px] px-1.5 py-0.5 rounded-md text-2xs font-mono font-bold transition-colors cursor-pointer tabular-nums ${
                  isActive
                    ? 'comfort-tab-active'
                    : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
                }`}
                title={`${t('controls.speed')} ${spd}x`}
              >
                {spd}x
              </button>
            );
          })}
        </div>

        <div className="hidden sm:block w-px h-4 bg-[var(--comfort-border)] mx-0.5 shrink-0" aria-hidden="true" />

        {/* 4. Sound Toggle */}
        <button
          type="button"
          onClick={() => {
            toggleSound();
            labSound.setEnabled(!soundEnabled);
          }}
          title={`[M] ${soundEnabled ? t('controls.mute') : t('controls.unmute')}`}
          aria-label={soundEnabled ? 'Bisukan suara laboratorium (Shortcut M)' : 'Nyalakan suara laboratorium (Shortcut M)'}
          className={`min-h-[34px] px-1.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            soundEnabled
              ? 'text-[var(--comfort-accent)] hover:bg-[var(--comfort-surface-subtle)]'
              : 'text-[var(--comfort-hud-muted)] hover:bg-[var(--comfort-surface-subtle)]'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
        </button>

        {/* 4.5. Panduan Praktikum Trigger & Popover */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick(620);
              setIsShortcutsOpen(false);
              setIsGuideOpen((prev) => !prev);
            }}
            aria-expanded={isGuideOpen}
            aria-label="Panduan Praktikum 3D"
            title="Panduan Praktikum 3D & Checklist Langkah"
            className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              isGuideOpen
                ? 'comfort-tab-active'
                : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
            }`}
          >
            <Compass className={`w-4 h-4 ${isGuideOpen ? 'text-white' : 'text-[var(--comfort-accent)]'}`} aria-hidden="true" />
            <span className="hidden sm:inline">Panduan</span>
            <span className={`font-mono text-2xs font-bold tabular-nums ${isGuideOpen ? 'text-white/90' : 'text-[var(--comfort-accent)]'}`}>
              {guideStepCount}
            </span>
          </button>

          {isGuideOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsGuideOpen(false)} />
              <div
                data-testid="lab-guide-popover"
                className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 sm:w-80 rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl p-3.5 z-50 text-xs space-y-2.5 animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                    <Compass className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />
                    <span>Panduan Praktikum 3D</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(false)}
                    aria-label="Tutup panduan"
                    className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--comfort-success-soft)] border border-[var(--comfort-success-border)]">
                    <CheckCircle2 className="w-4 h-4 text-[var(--comfort-success)] shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <div className="font-bold text-2xs text-[var(--comfort-success)]">
                        1. Eksplorasi Variabel 3D
                      </div>
                      <div className="text-2xs text-[var(--comfort-text-muted)]">
                        Ubah nilai variabel bebas dan amati respon aparatus.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                      recordsCount >= 3
                        ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success-border)]'
                        : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)]'
                    }`}
                  >
                    {recordsCount >= 3 ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--comfort-success)] shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--comfort-warning)] shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-2xs flex items-center justify-between text-[var(--comfort-text)]">
                        <span>2. Catat Data Tabel</span>
                        <span className="font-mono text-2xs tabular-nums font-semibold text-[var(--comfort-text-muted)]">
                          {recordsCount}/3 data
                        </span>
                      </div>
                      <div className="text-2xs text-[var(--comfort-text-muted)]">
                        Tekan <strong>Catat Data</strong> atau tombol <kbd className="font-mono font-bold">D</kbd> minimal 3 kali untuk analisis regresi.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                      workflowStep >= 3
                        ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success-border)]'
                        : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)]'
                    }`}
                  >
                    {workflowStep >= 3 ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--comfort-success)] shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-2xs text-[var(--comfort-text)]">
                        3. Lembar Kerja Siswa (LKS)
                      </div>
                      <div className="text-2xs text-[var(--comfort-text-muted)]">
                        Uji hipotesis &amp; jawab pertanyaan analisis sains untuk klaim XP.
                      </div>
                    </div>
                  </div>
                </div>

                {isReadyForAnalysis && (
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setIsGuideOpen(false);
                      setWorkflowStep(3);
                    }}
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-lg comfort-btn-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Lanjut ke Grafik &amp; LKS</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="hidden sm:block w-px h-4 bg-[var(--comfort-border)] mx-0.5 shrink-0" aria-hidden="true" />

        {/* 5. Snapshot */}
        <button
          type="button"
          onClick={handleCapture3DSnapshot}
          title="[S] Tangkap Snapshot Kanvas 3D"
          aria-label="Tangkap Snapshot Kanvas 3D (Shortcut S)"
          className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            snapshotPulse
              ? 'comfort-tab-active'
              : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
          }`}
        >
          <Camera className={`w-4 h-4 ${snapshotPulse ? 'text-white' : 'text-[var(--comfort-accent)]'}`} aria-hidden="true" />
          <span className="hidden xl:inline">{t('controls.snapshot')}</span>
          {snapshotCount > 0 && (
            <span className="font-mono text-2xs font-bold text-[var(--comfort-accent)] tabular-nums">
              · {snapshotCount}
            </span>
          )}
        </button>

        {/* 6. Zen Mode Toggle */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            toggleZenMode();
          }}
          title="[Z] Fokus Penuh (Sembunyikan Sidebar Kontrol)"
          aria-label={zenMode ? 'Keluar dari Mode Fokus (Shortcut Z)' : 'Aktifkan Mode Fokus (Shortcut Z)'}
          className={`hidden lg:flex min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            zenMode
              ? 'comfort-accent-soft border'
              : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
          }`}
        >
          {zenMode ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
          <span className="hidden 2xl:inline">{zenMode ? t('controls.normal') : t('controls.zen')}</span>
        </button>

        {/* 6.5. Keyboard Shortcuts Popover (?) */}
        <div className="relative hidden lg:block shrink-0">
          <button
            type="button"
            data-testid="dock-shortcuts-btn"
            onClick={() => {
              labSound.playClick();
              setIsGuideOpen(false);
              setIsShortcutsOpen((prev) => !prev);
            }}
            aria-expanded={isShortcutsOpen}
            aria-label="Pintasan Keyboard Laboratorium (?)"
            title="[?] Daftar Pintasan Keyboard"
            className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              isShortcutsOpen
                ? 'comfort-tab-active'
                : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {isShortcutsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsShortcutsOpen(false)} />
              <div
                data-testid="lab-shortcuts-popover"
                className="absolute bottom-12 right-0 w-72 rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl p-3.5 z-50 text-xs space-y-2 animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                    <Keyboard className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />
                    <span>Pintasan Keyboard</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsShortcutsOpen(false)}
                    aria-label="Tutup daftar pintasan"
                    className="p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {KEYBOARD_SHORTCUTS.map((item) => (
                    <li
                      key={item.keys}
                      className="flex items-center justify-between gap-2 text-2xs"
                    >
                      <span className="text-[var(--comfort-text-muted)]">{item.label}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono font-bold text-[var(--comfort-text)] shrink-0">
                        {item.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="hidden sm:block w-px h-4 bg-[var(--comfort-border)] mx-0.5 shrink-0" aria-hidden="true" />

        {/* 7. Voice Assistant Button */}
        <button
          type="button"
          data-testid="voice-lab-mentor-dock"
          onClick={() => {
            labSound.playClick(voiceState.fullDuplexEnabled ? 440 : 720);
            aiVoiceAssistant.toggleFullDuplexSession();
          }}
          aria-label={
            voiceState.fullDuplexEnabled
              ? 'Matikan Suara Dr. LabMu'
              : 'Tanya Dr. LabMu via Suara (Full-Duplex)'
          }
          title={
            voiceState.fullDuplexEnabled
              ? 'Suara Dr. LabMu Aktif (Klik untuk matikan)'
              : 'Tanya Dr. LabMu via Suara Interaktif'
          }
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
            voiceState.fullDuplexEnabled
              ? 'bg-[var(--comfort-danger)] text-white shadow-sm ring-2 ring-[var(--comfort-danger)]/40'
              : 'text-[var(--comfort-hud-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-danger)]'
          }`}
        >
          {voiceState.fullDuplexEnabled ? (
            <Mic className="w-4 h-4" aria-hidden="true" />
          ) : (
            <MicOff className="w-4 h-4 opacity-70" aria-hidden="true" />
          )}
          {voiceState.fullDuplexEnabled && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--comfort-danger)] border border-[var(--comfort-surface)]" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
