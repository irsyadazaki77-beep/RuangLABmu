import React from 'react';
import {
  Atom,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MessageCircle,
  Wifi,
  WifiOff,
  User,
  GraduationCap,
} from 'lucide-react';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { AcademicLevel } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { useLabStore, WorkflowStep } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import {
  VisualComfortToolbar,
  VisualComfortPreferences,
} from '../ui/VisualComfortToolbar';

export interface TopNavigationHeaderProps {
  experimentModule: ExperimentModule;
  recordsCount: number;
  lksGraded: boolean;
  notificationsCount: number;
  hasLowR2Alert: boolean;
  studentProfiles: Array<{ name: string; group: string }>;
  selectedProfileIdx: number;
  onSelectProfileIdx: (idx: number) => void;
}

export const TopNavigationHeader: React.FC<TopNavigationHeaderProps> = ({
  experimentModule,
  recordsCount,
  lksGraded,
  notificationsCount,
  hasLowR2Alert,
  studentProfiles,
  selectedProfileIdx,
  onSelectProfileIdx,
}) => {
  const {
    isLobbyMode,
    setIsLobbyMode,
    workflowStep,
    setWorkflowStep,
    userRole,
    setUserRole,
    academicLevel,
    setAcademicLevel,
    soundEnabled,
    toggleSound,
  } = useLabStore();

  const {
    zenMode,
    toggleZenMode,
    drawerOpen,
    toggleDrawer,
    comfortPrefs,
    setComfortPrefs,
  } = useUIStore();

  const { wsConnected } = useCollabStore();

  const currentProfile = studentProfiles[selectedProfileIdx] ?? studentProfiles[0];

  return (
    <header className="h-14 shrink-0 flex items-center justify-between gap-2.5 px-3 sm:px-5 bg-slate-950 border-b border-slate-800 text-white z-40 select-none">
      {/* Zone 1: Brand & Back to Catalog Button */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setIsLobbyMode(true);
          }}
          aria-label="Kembali ke RuangLABmu Lobby"
          className="text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center shadow-xs">
            <Atom className="w-4 h-4 text-white" />
          </span>
          <span className="hidden xs:inline">RuangLABmu</span>
        </button>

        {!isLobbyMode && userRole === 'siswa' && (
          <>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setIsLobbyMode(true);
              }}
              aria-label="Kembali ke Katalog Laboratorium"
              className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>← Katalog</span>
            </button>
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 truncate max-w-[200px] pl-1 border-l border-slate-800">
              <span className="font-mono text-[10px] font-bold uppercase text-sky-400 shrink-0">
                {experimentModule.domain}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-semibold text-slate-200 truncate" title={experimentModule.title}>
                {experimentModule.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Zone 2: 4-Step Workflow Stepper (Center for Students) */}
      <div className="hidden md:flex items-center justify-center shrink-0">
        {userRole === 'siswa' && !isLobbyMode && (
          <nav
            aria-label="Tahapan Alur Praktikum"
            className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shrink-0"
          >
            {(
              [
                { step: 1 as WorkflowStep, label: '1. K3 & Hipotesis', done: workflowStep > 1 },
                {
                  step: 2 as WorkflowStep,
                  label: '2. Simulasi 3D',
                  done: recordsCount >= 3 || workflowStep > 2,
                  badge: `${recordsCount}/3`,
                },
                {
                  step: 3 as WorkflowStep,
                  label: '3. Grafik & LKS',
                  done: lksGraded || workflowStep > 3,
                },
                {
                  step: 4 as WorkflowStep,
                  label: '4. Laporan',
                  done: workflowStep === 4 && recordsCount >= 3 && lksGraded,
                },
              ] as const
            ).map((item) => {
              const isActive = workflowStep === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setWorkflowStep(item.step);
                  }}
                  aria-label={`Pindah ke Tahap ${item.label}`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : item.done
                      ? 'text-emerald-400 hover:bg-slate-800/80'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {item.done && !isActive && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span
                      className={`font-mono text-[10px] px-1 rounded tabular-nums ${
                        recordsCount >= 3
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Zone 3: Controls, Utilities, Sync Status, and Drawer Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Academic Level Selector */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
          {(['smp', 'sma', 'mahasiswa'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => {
                labSound.playClick();
                setAcademicLevel(lvl);
              }}
              aria-label={`Pilih Jenjang Akademik ${lvl.toUpperCase()}`}
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                academicLevel === lvl
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Role Switcher */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setUserRole(userRole === 'siswa' ? 'pengajar' : 'siswa');
          }}
          aria-label={`Ganti peran ke ${userRole === 'siswa' ? 'Pengajar' : 'Siswa'}`}
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
            userRole === 'pengajar'
              ? 'bg-purple-900/40 text-purple-300 border-purple-700/60'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
          title="Beralih peran antara Siswa dan Pengajar"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>{userRole === 'pengajar' ? 'Guru' : 'Siswa'}</span>
        </button>

        {/* WebSocket Real-time Sync Status Badge */}
        <div
          role="status"
          aria-label={wsConnected ? 'Tersambung ke Lab Sync Server' : 'Terputus dari Lab Sync (Mode Lokal)'}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
            wsConnected
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-400'
          }`}
          title={wsConnected ? 'WebSocket Kolaborasi Aktif' : 'WebSocket Terputus (Mode Offline)'}
        >
          {wsConnected ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">Sync</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
              <span className="hidden xl:inline">Offline</span>
            </>
          )}
        </div>

        {/* Audio Engine Mute Toggle */}
        <button
          type="button"
          onClick={() => {
            toggleSound();
            labSound.setEnabled(!soundEnabled);
          }}
          aria-label={soundEnabled ? 'Bisukan suara laboratorium' : 'Nyalakan efek suara laboratorium'}
          className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            soundEnabled
              ? 'bg-slate-900 text-sky-400 border-slate-800 hover:border-slate-700'
              : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}
          title={soundEnabled ? 'Efek Suara Lab Aktif' : 'Efek Suara Dibisukan'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Zen Mode Toggle */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            toggleZenMode();
          }}
          aria-label={zenMode ? 'Keluar dari Mode Zen' : 'Aktifkan Mode Zen Kanvas 3D'}
          className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            zenMode
              ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
          title={zenMode ? 'Keluar dari Mode Zen (Kembalikan Panel)' : 'Mode Zen (Layar Penuh Kanvas 3D)'}
        >
          {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Visual Comfort Preferences */}
        <div className="hidden sm:block">
          <VisualComfortToolbar
            preferences={comfortPrefs}
            onChangePreferences={setComfortPrefs}
            zenMode={zenMode}
            onToggleZenMode={toggleZenMode}
          />
        </div>

        {/* Dr. LabMu Assistant & Notifications Toggle */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            toggleDrawer();
          }}
          aria-label={drawerOpen ? 'Tutup Asisten Dr. LabMu' : 'Buka Asisten Dr. LabMu'}
          className={`relative min-h-[38px] px-2.5 sm:px-3 flex items-center gap-1.5 rounded-lg border font-semibold text-xs transition-colors cursor-pointer ${
            drawerOpen
              ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
              : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Dr. LabMu</span>
          {hasLowR2Alert && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-1 -right-1"
              title="Deviasi Data Terdeteksi!"
            />
          )}
          {notificationsCount > 0 && !hasLowR2Alert && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
              {notificationsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
