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

  const {
    zenMode,
    toggleZenMode,
  } = useUIStore(
    useShallow((s) => ({
      zenMode: s.zenMode,
      toggleZenMode: s.toggleZenMode,
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

  const is3DStageActive = userRole === 'siswa' && !isLobbyMode && workflowStep === 2;

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

  // Global keyboard shortcuts with input focus guard
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

  return (
    <div
      role="toolbar"
      aria-label="Dock Kontrol Cepat RuangLABmu"
      className={`fixed bottom-3 -translate-x-1/2 z-40 flex flex-col items-stretch gap-1.5 px-2.5 py-1.5 rounded-2xl lab-glass-panel shadow-2xl border border-slate-300/80 dark:border-slate-700/80 transition-all duration-200 select-none ${
        zenMode
          ? 'left-1/2'
          : 'left-1/2 lg:left-[calc(50%-9rem)] xl:left-[calc(50%-11rem)]'
      }`}
    >
      {/* Slim Time-Travel Scrubber Slider */}
      {timelineCount > 1 && (
        <div
          data-testid="time-travel-scrubber-bar"
          className={`flex items-center gap-2 px-2 py-1 rounded-xl border text-[10px] font-mono transition-colors ${
            isTimeTraveling
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-200'
              : 'bg-slate-200/50 dark:bg-slate-900/60 border-slate-300/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1 font-bold shrink-0">
            <History className={`w-3 h-3 ${isTimeTraveling ? 'text-amber-500' : 'text-sky-500'}`} />
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
            className="flex-1 min-w-[110px] sm:min-w-[170px] h-1.5 accent-amber-500 cursor-ew-resize"
          />
          <span className="tabular-nums font-bold shrink-0">
            t={timelineCurrentTime.toFixed(2)}s
            <span className="opacity-60 hidden sm:inline">
              {' '}
              ({timelineMinTime.toFixed(1)}–{timelineMaxTime.toFixed(1)}s)
            </span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-1">
      {/* 1. Play/Jeda */}
      <button
        type="button"
        onClick={handleToggleSimulation}
        title="[Space] Play/Jeda Simulasi"
        aria-label="Play atau Jeda Simulasi 3D (Shortcut Space)"
        className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          isSimulating
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
        }`}
      >
        {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        <span>{isSimulating ? t('controls.pause') : t('controls.play')}</span>
      </button>

      {/* 2. Reset */}
      <button
        type="button"
        onClick={handleResetTrial}
        title="[R] Reset Percobaan Simulasi"
        aria-label="Reset Percobaan Simulasi (Shortcut R)"
        className="px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden sm:inline">{t('controls.reset')}</span>
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 3. Speed Selector [0.5x | 1x | 2x] */}
      <div
        className="flex items-center gap-0.5 bg-slate-200/60 dark:bg-slate-900/70 p-0.5 rounded-xl border border-slate-300/60 dark:border-slate-700/60"
        role="group"
        aria-label={t('controls.speed')}
      >
        <Gauge className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1 mr-0.5 hidden md:inline" />
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
              className={`px-1.5 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer tabular-nums ${
                isActive
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300/50 dark:hover:bg-slate-800'
              }`}
              title={`${t('controls.speed')} ${spd}x`}
            >
              {spd}x
            </button>
          );
        })}
      </div>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 4. Sound Mute Toggle */}
      <button
        type="button"
        onClick={() => {
          toggleSound();
          labSound.setEnabled(!soundEnabled);
        }}
        title={`[M] ${soundEnabled ? t('controls.mute') : t('controls.unmute')}`}
        aria-label={soundEnabled ? 'Bisukan suara laboratorium (Shortcut M)' : 'Nyalakan suara laboratorium (Shortcut M)'}
        className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          soundEnabled
            ? 'text-sky-600 dark:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      {/* 4.5. 🧭 Panduan (X/3) Trigger & Popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            labSound.playClick(620);
            setIsGuideOpen((prev) => !prev);
          }}
          aria-expanded={isGuideOpen}
          aria-label="Panduan Praktikum 3D"
          title="🧭 Panduan Praktikum 3D & Checklist Langkah"
          className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
            isGuideOpen
              ? 'bg-sky-600 text-white shadow-2xs'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
          }`}
        >
          <Compass className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span className="hidden sm:inline">Panduan</span>
          <span className="px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-bold tabular-nums">
            {recordsCount >= 3 ? (workflowStep >= 3 ? '3/3' : '2/3') : '1/3'}
          </span>
        </button>

        {isGuideOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsGuideOpen(false)} />
            <div
              data-testid="lab-guide-popover"
              className="absolute bottom-11 left-1/2 -translate-x-1/2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-3.5 z-50 text-xs space-y-2.5 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Compass className="w-4 h-4 text-sky-500" />
                  <span>Panduan Praktikum 3D</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start gap-2 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[11px]">1. Eksplorasi Variabel 3D</div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-300">
                      Ubah nilai variabel bebas dan amati respon aparatus.
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-2 p-1.5 rounded-lg border text-xs ${
                    recordsCount >= 3
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-stone-50 dark:bg-slate-950 border-stone-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {recordsCount >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-[11px] flex items-center justify-between">
                      <span>2. Catat Data Tabel</span>
                      <span className="font-mono text-[10px] tabular-nums font-semibold">
                        {recordsCount}/3 data
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Ambil minimal 3 data pengamatan variatif untuk analisis regresi linier.
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-2 p-1.5 rounded-lg border text-xs ${
                    workflowStep >= 3
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-stone-50 dark:bg-slate-950 border-stone-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {workflowStep >= 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-[11px]">3. Lembar Kerja Siswa (LKS)</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Uji hipotesis & jawab pertanyaan analisis sains untuk klaim XP.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 5. Snapshot */}
      <button
        type="button"
        onClick={handleCapture3DSnapshot}
        title="[S] Tangkap Snapshot Kanvas 3D"
        aria-label="Tangkap Snapshot Kanvas 3D (Shortcut S)"
        className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          snapshotPulse
            ? 'bg-sky-500 text-slate-950 scale-95'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        <Camera className="w-4 h-4 text-sky-500 dark:text-sky-400" />
        <span className="hidden lg:inline">{t('controls.snapshot')}</span>
        {snapshotCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-300 font-mono text-[10px] tabular-nums">
            {snapshotCount}
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
        className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          zenMode
            ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        <span className="hidden lg:inline">{zenMode ? t('controls.normal') : t('controls.zen')}</span>
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 7. Round Microphone Button for Dr. LabMu Voice Assistant */}
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
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer relative shrink-0 ${
          voiceState.fullDuplexEnabled
            ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-400/50 animate-pulse'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-rose-500'
        }`}
      >
        {voiceState.fullDuplexEnabled ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4 opacity-70" />
        )}
        {voiceState.fullDuplexEnabled && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
        )}
      </button>
      </div>
    </div>
  );
};
