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
  MessageCircle,
  Gauge,
} from 'lucide-react';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import { useTranslation } from 'react-i18next';

export interface LabControlDockProps {
  notificationsCount?: number;
  hasLowR2Alert?: boolean;
  snapshotCount?: number;
}

const SPEED_OPTIONS = [0.5, 1, 2] as const;

export const LabControlDock: React.FC<LabControlDockProps> = ({
  notificationsCount = 0,
  hasLowR2Alert = false,
  snapshotCount = 0,
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
  } = useLabStore();

  const {
    zenMode,
    toggleZenMode,
    drawerOpen,
    toggleDrawer,
  } = useUIStore();

  const [snapshotPulse, setSnapshotPulse] = useState<boolean>(false);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [is3DStageActive]);

  if (!is3DStageActive) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Dock Kontrol Cepat RuangLABmu"
      className={`fixed bottom-3 -translate-x-1/2 z-40 flex items-center gap-1 px-2.5 py-1.5 rounded-2xl lab-glass-panel shadow-2xl border border-slate-300/80 dark:border-slate-700/80 transition-all duration-200 select-none ${
        zenMode
          ? 'left-1/2'
          : 'left-1/2 lg:left-[calc(50%-9rem)] xl:left-[calc(50%-11rem)]'
      }`}
    >
      {/* 1. Play/Jeda [Space] */}
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
        <kbd className="hidden 2xl:inline-block px-1 py-0.2 rounded bg-slate-900/15 dark:bg-slate-950/60 text-[9px] font-mono">
          Space
        </kbd>
      </button>

      {/* 2. Reset [R] */}
      <button
        type="button"
        onClick={handleResetTrial}
        title="[R] Reset Percobaan Simulasi"
        aria-label="Reset Percobaan Simulasi (Shortcut R)"
        className="px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden sm:inline">{t('controls.reset')}</span>
        <kbd className="hidden 2xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
          R
        </kbd>
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

      {/* 4. Sound Mute Toggle [M] */}
      <button
        type="button"
        onClick={() => {
          toggleSound();
          labSound.setEnabled(!soundEnabled);
        }}
        title={`[M] Mute · ${soundEnabled ? t('controls.mute') : t('controls.unmute')}`}
        aria-label={soundEnabled ? 'Bisukan suara laboratorium (Shortcut M)' : 'Nyalakan suara laboratorium (Shortcut M)'}
        className={`group relative px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          soundEnabled
            ? 'text-sky-600 dark:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        <kbd className="hidden 2xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
          M
        </kbd>
      </button>

      {/* 5. Snapshot [S] */}
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
        <kbd className="hidden 2xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
          S
        </kbd>
      </button>

      {/* 6. Zen Mode Toggle [Z] */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          toggleZenMode();
        }}
        title="[Z] Zen Mode (Layar Penuh Kanvas 3D)"
        aria-label={zenMode ? 'Keluar dari Zen Mode (Shortcut Z)' : 'Aktifkan Zen Mode (Shortcut Z)'}
        className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          zenMode
            ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        <span className="hidden lg:inline">{zenMode ? t('controls.normal') : t('controls.zen')}</span>
        <kbd className="hidden 2xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
          Z
        </kbd>
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 7. Dr. LabMu Assistant Trigger [A] */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          toggleDrawer();
        }}
        title="[A] Tanya Dr. LabMu (Asisten Sokratik)"
        aria-label="Buka atau tutup Asisten Sokratik Dr. LabMu (Shortcut A)"
        className={`relative px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          drawerOpen
            ? 'bg-sky-600 text-white shadow-sm'
            : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30'
        }`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>Dr. LabMu</span>
        <kbd
          className={`hidden 2xl:inline-block px-1 py-0.2 rounded text-[9px] font-mono ${
            drawerOpen
              ? 'bg-sky-700 text-sky-100'
              : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
          }`}
        >
          A
        </kbd>
        {hasLowR2Alert && (
          <span
            className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5"
            title="Deviasi Data Terdeteksi!"
          />
        )}
        {notificationsCount > 0 && !hasLowR2Alert && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900/80 text-sky-300 tabular-nums">
            {notificationsCount}
          </span>
        )}
      </button>
    </div>
  );
};
