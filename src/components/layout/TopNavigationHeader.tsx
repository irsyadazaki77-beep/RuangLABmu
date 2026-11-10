import React, { useEffect } from 'react';
import {
  Atom,
  CheckCircle2,
  MessageCircle,
  GraduationCap,
  Sun,
  BookOpen,
  Moon,
} from 'lucide-react';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import { useLabStore, WorkflowStep } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { ComfortThemeMode } from '../ui/VisualComfortToolbar';

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
}) => {
  const {
    isLobbyMode,
    setIsLobbyMode,
    workflowStep,
    setWorkflowStep,
    userRole,
    setUserRole,
  } = useLabStore();

  const {
    drawerOpen,
    toggleDrawer,
    comfortPrefs,
    setComfortPrefs,
  } = useUIStore();

  const { wsConnected } = useCollabStore();

  // Keep root HTML attributes synchronized with active comfort preferences at all times
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', comfortPrefs.theme);
    root.setAttribute('data-font-scale', comfortPrefs.fontScale);
    root.setAttribute('data-line-spacing', comfortPrefs.lineSpacing);
    root.setAttribute('data-colorblind', comfortPrefs.colorBlindSafe ? 'true' : 'false');
    if (comfortPrefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [
    comfortPrefs.theme,
    comfortPrefs.fontScale,
    comfortPrefs.lineSpacing,
    comfortPrefs.colorBlindSafe,
  ]);

  const handleThemeSwitch = (theme: ComfortThemeMode) => {
    labSound.playClick();
    setComfortPrefs({ theme });
  };

  return (
    <header className="sticky top-0 h-14 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-stone-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 z-40 select-none transition-colors duration-200">
      {/* Zone 1: Brand Identity ("RuangLABmu" + "Virtual Science Lab") & Back to Catalog */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setIsLobbyMode(true);
          }}
          aria-label="Kembali ke RuangLABmu Lobby"
          className="flex items-center gap-2 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center shadow-xs shrink-0">
            <Atom className="w-4 h-4 text-white" />
          </span>
          <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            RuangLABmu
          </span>
          {isLobbyMode && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 whitespace-nowrap">
              Virtual Science Lab
            </span>
          )}
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
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-white bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>← Katalog</span>
            </button>
            <div className="hidden xl:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[145px] 2xl:max-w-[240px] pl-1.5 border-l border-stone-200 dark:border-slate-800">
              <span className="font-mono text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 shrink-0">
                {experimentModule.domain}
              </span>
              <span className="text-slate-400 dark:text-slate-600">·</span>
              <span
                className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                title={experimentModule.title}
              >
                {experimentModule.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Zone 2: 4-Step Workflow Stepper (Center when inside Lab Workspace) */}
      <div className="hidden md:flex items-center justify-center shrink-0">
        {userRole === 'siswa' && !isLobbyMode && (
          <nav
            aria-label="Tahapan Alur Praktikum"
            className="flex items-center gap-0.5 bg-stone-100/90 dark:bg-slate-900/90 border border-stone-200/80 dark:border-slate-800 p-1 rounded-xl shrink-0"
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
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : item.done
                      ? 'text-emerald-700 dark:text-emerald-400 hover:bg-stone-200/60 dark:hover:bg-slate-800/80'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {item.done && !isActive && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span
                      className={`font-mono text-[10px] px-1 rounded tabular-nums ${
                        recordsCount >= 3
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : isActive
                          ? 'bg-sky-700 text-sky-100'
                          : 'bg-stone-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
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

      {/* Zone 3: Streamlined Right Utilities (Sync Dot, Role Switcher, Theme Switcher, Dr. LabMu) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* 1. Status Sync (Thin Green Dot) */}
        <div
          role="status"
          aria-label={wsConnected ? 'Tersambung ke Lab Sync Server' : 'Mode Sinkronisasi Lokal'}
          title={wsConnected ? 'Real-Time Sync Aktif' : 'Sinkronisasi Lokal'}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-stone-100/80 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              wsConnected
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className="hidden lg:inline text-[11px] font-mono">
            {wsConnected ? 'Sync' : 'Lokal'}
          </span>
        </div>

        {/* 2. Role Switcher (Siswa / Guru) */}
        <div
          role="group"
          aria-label="Pilih Peran Pengguna"
          className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 text-xs font-semibold"
        >
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setUserRole('siswa');
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              userRole === 'siswa'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Siswa</span>
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setUserRole('pengajar');
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              userRole === 'pengajar'
                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 hidden sm:inline" />
            <span>Guru</span>
          </button>
        </div>

        {/* 3. Theme Switcher (Terang / Sepia / Gelap) */}
        <div
          role="group"
          aria-label="Pilih Tema Tampilan"
          className="hidden sm:flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 text-xs font-semibold"
        >
          {(
            [
              { id: 'light' as ComfortThemeMode, label: 'Terang', Icon: Sun },
              { id: 'sepia' as ComfortThemeMode, label: 'Sepia', Icon: BookOpen },
              { id: 'dark' as ComfortThemeMode, label: 'Gelap', Icon: Moon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = comfortPrefs.theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleThemeSwitch(id)}
                title={`Tema ${label}`}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-sky-400" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Dr. LabMu Assistant Button */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            toggleDrawer();
          }}
          aria-label={drawerOpen ? 'Tutup Asisten Dr. LabMu' : 'Buka Asisten Dr. LabMu'}
          className={`relative px-2.5 py-1 flex items-center gap-1.5 rounded-lg border font-semibold text-xs transition-colors cursor-pointer shrink-0 ${
            drawerOpen
              ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-stone-200 dark:border-slate-800 hover:border-sky-500/50 dark:hover:border-slate-700'
          }`}
        >
          <MessageCircle
            className={`w-3.5 h-3.5 ${drawerOpen ? 'text-white' : 'text-sky-600 dark:text-sky-400'}`}
          />
          <span>Dr. LabMu</span>
          {hasLowR2Alert && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5"
              title="Deviasi Data Terdeteksi!"
            />
          )}
          {notificationsCount > 0 && !hasLowR2Alert && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {notificationsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
