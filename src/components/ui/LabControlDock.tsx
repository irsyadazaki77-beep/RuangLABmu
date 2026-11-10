import React, { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Camera,
  Play,
  Pause,
  MessageCircle,
} from 'lucide-react';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { labSound } from '../../utils/soundEngine';
import { VisualComfortToolbar } from './VisualComfortToolbar';

export interface LabControlDockProps {
  notificationsCount?: number;
  hasLowR2Alert?: boolean;
  snapshotCount?: number;
}

export const LabControlDock: React.FC<LabControlDockProps> = ({
  notificationsCount = 0,
  hasLowR2Alert = false,
  snapshotCount = 0,
}) => {
  const {
    soundEnabled,
    toggleSound,
    isLobbyMode,
    workflowStep,
    userRole,
  } = useLabStore();

  const {
    zenMode,
    toggleZenMode,
    drawerOpen,
    toggleDrawer,
    comfortPrefs,
    setComfortPrefs,
  } = useUIStore();

  const [simPlaying, setSimPlaying] = useState<boolean>(true);
  const [snapshotPulse, setSnapshotPulse] = useState<boolean>(false);

  const is3DStageActive = userRole === 'siswa' && !isLobbyMode && workflowStep === 2;

  const triggerToggleSimulation = () => {
    labSound.playClick();
    setSimPlaying((prev) => !prev);
    window.dispatchEvent(new CustomEvent('ruanglab:toggle-simulation'));
  };

  const triggerCapture3DSnapshot = () => {
    labSound.playRecordSuccess();
    setSnapshotPulse(true);
    setTimeout(() => setSnapshotPulse(false), 350);
    window.dispatchEvent(new CustomEvent('ruanglab:capture-3d-snapshot'));
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
      } else if (key === 's' && is3DStageActive) {
        e.preventDefault();
        triggerCapture3DSnapshot();
      } else if (e.code === 'Space' && is3DStageActive) {
        // Avoid hijacking spacebar if a button is focused
        if (activeEl && activeEl.tagName.toLowerCase() === 'button') return;
        e.preventDefault();
        triggerToggleSimulation();
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
      className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl lab-glass-panel shadow-2xl border border-slate-300/80 dark:border-slate-700/80 transition-all duration-200 hover:scale-[1.01]"
    >
      {/* 1. Ergonomi Visual Trigger (Popover Upwards) */}
      <VisualComfortToolbar
        preferences={comfortPrefs}
        onChangePreferences={setComfortPrefs}
        zenMode={zenMode}
        onToggleZenMode={toggleZenMode}
        showZenToggle={false}
        compactTrigger={true}
        popoverPlacement="top"
      />

      <div className="w-px h-5 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 2. Sound Mute Toggle [M] */}
      <button
        type="button"
        onClick={() => {
          toggleSound();
          labSound.setEnabled(!soundEnabled);
        }}
        title={`[M] Mute · ${soundEnabled ? 'Bisukan Suara Lab' : 'Nyalakan Suara Lab'}`}
        aria-label={soundEnabled ? 'Bisukan suara laboratorium (Shortcut M)' : 'Nyalakan suara laboratorium (Shortcut M)'}
        className={`group relative px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          soundEnabled
            ? 'text-sky-600 dark:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        <kbd className="hidden xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
          M
        </kbd>
      </button>

      {/* 3. Play/Pause Simulation [Space] & 3D Snapshot [S] when in 3D Stage */}
      {is3DStageActive && (
        <>
          <button
            type="button"
            onClick={triggerToggleSimulation}
            title="[Space] Play/Pause Simulasi"
            aria-label="Play atau Pause Simulasi 3D (Shortcut Space)"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              simPlaying
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
            }`}
          >
            {simPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">{simPlaying ? 'Jeda' : 'Play'}</span>
            <kbd className="px-1 py-0.2 rounded bg-slate-900/15 dark:bg-slate-950/60 text-[9px] font-mono">
              Space
            </kbd>
          </button>

          <button
            type="button"
            onClick={triggerCapture3DSnapshot}
            title="[S] Tangkap Snapshot Kanvas 3D"
            aria-label="Tangkap Snapshot Kanvas 3D (Shortcut S)"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              snapshotPulse
                ? 'bg-sky-500 text-slate-950 scale-95'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
            }`}
          >
            <Camera className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span className="hidden xl:inline">Snapshot</span>
            {snapshotCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-300 font-mono text-[10px] tabular-nums">
                {snapshotCount}
              </span>
            )}
            <kbd className="hidden xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
              S
            </kbd>
          </button>
        </>
      )}

      {/* 4. Zen Mode Toggle [Z] */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          toggleZenMode();
        }}
        title="[Z] Zen Mode (Layar Penuh Kanvas 3D)"
        aria-label={zenMode ? 'Keluar dari Zen Mode (Shortcut Z)' : 'Aktifkan Zen Mode (Shortcut Z)'}
        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          zenMode
            ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
        }`}
      >
        {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        <span className="hidden xl:inline">{zenMode ? 'Normal' : 'Zen'}</span>
        <kbd className="hidden xl:inline-block px-1 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono text-slate-600 dark:text-slate-400">
          Z
        </kbd>
      </button>

      <div className="w-px h-5 bg-slate-300 dark:bg-slate-700/80 mx-0.5" aria-hidden="true" />

      {/* 5. Dr. LabMu Assistant Trigger [A] */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          toggleDrawer();
        }}
        title="[A] Tanya Dr. LabMu (Asisten Sokratik)"
        aria-label="Buka atau tutup Asisten Sokratik Dr. LabMu (Shortcut A)"
        className={`relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          drawerOpen
            ? 'bg-sky-600 text-white shadow-sm'
            : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30'
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        <span>Dr. LabMu</span>
        <kbd
          className={`hidden xl:inline-block px-1 py-0.2 rounded text-[9px] font-mono ${
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
