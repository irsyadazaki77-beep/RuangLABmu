import React, { useEffect, useState } from 'react';
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
  } = useLabStore(
    useShallow((s) => ({
      soundEnabled: s.soundEnabled,
      toggleSound: s.toggleSound,
      isLobbyMode: s.isLobbyMode,
      workflowStep: s.workflowStep,
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
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [voiceState, setVoiceState] = useState<VoiceAssistantState>(() =>
    aiVoiceAssistant.getState()
  );

  useEffect(() => {
    const unsub = aiVoiceAssistant.subscribe((next) => setVoiceState(next));
    return unsub;
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
  }, [is3DStageActive]);

  if (!is3DStageActive) {
    return null;
  }

  const safeTimelineMaxIdx = Math.max(0, timelineCount - 1);
  const safeTimelineVal = Math.max(0, Math.min(safeTimelineMaxIdx, timelineCursor));
  const guideStepCount = recordsCount >= 3 ? (workflowStep >= 3 ? '3/3' : '2/3') : '1/3';
  const isMobileSheetOpen = mobileTab === 'variables' || mobileTab === 'telemetry';

  return (
    <div
      role="toolbar"
      aria-label="Dock Kontrol Cepat RuangLABmu"
      className={`${
        isMobileSheetOpen ? 'hidden lg:flex' : 'flex'
      } fixed bottom-[62px] lg:bottom-3 left-1/2 -translate-x-1/2 z-20 lg:z-40 w-[calc(100vw-16px)] sm:w-auto lg:max-w-[calc(100vw-688px)] 2xl:max-w-none flex-col items-stretch gap-1 px-2 py-1.5 rounded-xl studio-hud-surface shadow-2xl border transition-all duration-200 select-none`}
    >
      {/* Slim Time-Travel Scrubber Slider */}
      {timelineCount > 1 && (
        <div
          data-testid="time-travel-scrubber-bar"
          className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-mono transition-colors ${
            isTimeTraveling
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-200'
              : 'studio-hud-subcard text-[var(--comfort-hud-muted)]'
          }`}
        >
          <span className="flex items-center gap-1 font-bold shrink-0">
            <History className={`w-3 h-3 ${isTimeTraveling ? 'text-amber-500' : 'text-sky-500'}`} aria-hidden="true" />
            <span>{isTimeTraveling ? 'Time-Travel' : 'Linimasa'}</span>
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
            className="flex-1 min-w-[90px] sm:min-w-[150px] h-1.5 accent-amber-500 cursor-ew-resize"
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

      <div className="flex flex-wrap lg:flex-nowrap items-center justify-center gap-1">
        {/* 1. Play/Pause */}
        <button
          type="button"
          onClick={handleToggleSimulation}
          title="[Space] Play/Jeda Simulasi"
          aria-label="Play atau Jeda Simulasi 3D (Shortcut Space)"
          className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            isSimulating
              ? 'bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/28'
              : 'bg-amber-500/18 text-amber-700 dark:text-amber-300 border border-amber-500/35 hover:bg-amber-500/28'
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
          className="px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
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
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-sky-600 text-white'
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
          className={`px-1.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
            soundEnabled
              ? 'text-sky-600 dark:text-sky-400 hover:bg-[var(--comfort-surface-subtle)]'
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
              setIsGuideOpen((prev) => !prev);
            }}
            aria-expanded={isGuideOpen}
            aria-label="Panduan Praktikum 3D"
            title="Panduan Praktikum 3D & Checklist Langkah"
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              isGuideOpen
                ? 'bg-sky-600 text-white'
                : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
            }`}
          >
            <Compass className={`w-4 h-4 ${isGuideOpen ? 'text-white' : 'text-sky-500'}`} aria-hidden="true" />
            <span className="hidden sm:inline">Panduan</span>
            <span className={`font-mono text-[10px] font-bold tabular-nums ${isGuideOpen ? 'text-sky-100' : 'text-sky-600 dark:text-sky-300'}`}>
              {guideStepCount}
            </span>
          </button>

          {isGuideOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsGuideOpen(false)} />
              <div
                data-testid="lab-guide-popover"
                className="absolute bottom-11 left-1/2 -translate-x-1/2 w-72 sm:w-80 rounded-xl bg-[var(--comfort-surface)] text-[var(--comfort-text)] border border-[var(--comfort-border)] shadow-2xl p-3.5 z-50 text-xs space-y-2.5 animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                    <Compass className="w-4 h-4 text-sky-500" aria-hidden="true" />
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
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <div className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300">
                        1. Eksplorasi Variabel 3D
                      </div>
                      <div className="text-[10px] text-[var(--comfort-text-muted)]">
                        Ubah nilai variabel bebas dan amati respon aparatus.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                      recordsCount >= 3
                        ? 'bg-emerald-500/10 border-emerald-500/25'
                        : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)]'
                    }`}
                  >
                    {recordsCount >= 3 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Circle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-[11px] flex items-center justify-between text-[var(--comfort-text)]">
                        <span>2. Catat Data Tabel</span>
                        <span className="font-mono text-[10px] tabular-nums font-semibold text-[var(--comfort-text-muted)]">
                          {recordsCount}/3 data
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--comfort-text-muted)]">
                        Ambil minimal 3 data pengamatan variatif untuk analisis regresi linier.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                      workflowStep >= 3
                        ? 'bg-emerald-500/10 border-emerald-500/25'
                        : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)]'
                    }`}
                  >
                    {workflowStep >= 3 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div>
                      <div className="font-bold text-[11px] text-[var(--comfort-text)]">
                        3. Lembar Kerja Siswa (LKS)
                      </div>
                      <div className="text-[10px] text-[var(--comfort-text-muted)]">
                        Uji hipotesis &amp; jawab pertanyaan analisis sains untuk klaim XP.
                      </div>
                    </div>
                  </div>
                </div>
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
          className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            snapshotPulse
              ? 'bg-sky-500 text-slate-950'
              : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
          }`}
        >
          <Camera className={`w-4 h-4 ${snapshotPulse ? 'text-slate-950' : 'text-sky-500'}`} aria-hidden="true" />
          <span className="hidden xl:inline">{t('controls.snapshot')}</span>
          {snapshotCount > 0 && (
            <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-300 tabular-nums">
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
          className={`hidden lg:flex px-2 py-1 rounded-lg text-xs font-semibold items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            zenMode
              ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40'
              : 'text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-surface-subtle)]'
          }`}
        >
          {zenMode ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
          <span className="hidden 2xl:inline">{zenMode ? t('controls.normal') : t('controls.zen')}</span>
        </button>

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
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer relative shrink-0 ${
            voiceState.fullDuplexEnabled
              ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-400/50'
              : 'text-[var(--comfort-hud-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-rose-500'
          }`}
        >
          {voiceState.fullDuplexEnabled ? (
            <Mic className="w-4 h-4" aria-hidden="true" />
          ) : (
            <MicOff className="w-4 h-4 opacity-70" aria-hidden="true" />
          )}
          {voiceState.fullDuplexEnabled && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-400 border border-slate-950" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
