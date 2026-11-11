import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  Atom,
  CheckCircle2,
  MessageCircle,
  GraduationCap,
  Sun,
  BookOpen,
  Moon,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import { useLabStore, WorkflowStep } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { ComfortThemeMode } from '../ui/VisualComfortToolbar';
const TeacherGradebookHub = lazy(() => import('../teacher/TeacherGradebookHub'));
import {
  GamificationProfile,
  ScientificBadge,
  loadGamificationProfile,
  subscribeGamification,
} from '../../services/gamificationEngine';
import { BadgeNotificationModal } from '../ui/BadgeNotificationModal';
import { setAppLanguage } from '../../i18n';

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
  const { t, i18n } = useTranslation();
  const activeLang: 'id' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'id';

  const {
    isLobbyMode,
    setIsLobbyMode,
    workflowStep,
    setWorkflowStep,
    userRole,
    setUserRole,
  } = useLabStore();

  const [isGradebookOpen, setIsGradebookOpen] = useState(false);

  // Gamification state & celebration modal
  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(() =>
    loadGamificationProfile()
  );
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<ScientificBadge | null>(null);
  const [recentXpDelta, setRecentXpDelta] = useState<number>(0);

  useEffect(() => {
    setGamificationProfile(loadGamificationProfile());
    const unsubscribe = subscribeGamification((updatedProfile, latestBadge, xpDelta) => {
      setGamificationProfile(updatedProfile);
      if (latestBadge) {
        setNewlyUnlockedBadge(latestBadge);
        setRecentXpDelta(xpDelta);
        setIsBadgeModalOpen(true);
      }
    });
    return unsubscribe;
  }, []);

  const {
    drawerOpen,
    toggleDrawer,
    comfortPrefs,
    setComfortPrefs,
  } = useUIStore();

  const { wsConnected, activeRoomId } = useCollabStore();

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

  const handleLanguageSwitch = (lang: 'id' | 'en') => {
    labSound.playClick();
    setAppLanguage(lang);
  };

  return (
    <header className="sticky top-0 h-14 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-stone-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 z-40 select-none transition-colors duration-200">
      {/* Zone 1: Brand Identity ("RuangLABmu") & Back to Catalog */}
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
            <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 whitespace-nowrap">
              {t('nav.virtualScienceLab')}
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
              <span>{t('nav.backToCatalog')}</span>
            </button>
            <div className="hidden 2xl:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px] pl-1.5 border-l border-stone-200 dark:border-slate-800">
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
                { step: 1 as WorkflowStep, label: t('nav.step1'), done: workflowStep > 1 },
                {
                  step: 2 as WorkflowStep,
                  label: t('nav.step2'),
                  done: recordsCount >= 3 || workflowStep > 2,
                  badge: `${recordsCount}/3`,
                },
                {
                  step: 3 as WorkflowStep,
                  label: t('nav.step3'),
                  done: lksGraded || workflowStep > 3,
                },
                {
                  step: 4 as WorkflowStep,
                  label: t('nav.step4'),
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

      {/* Zone 3: Right Utilities (Gamification XP/Level, [ID|EN] Switcher, Sync, Role, Theme, Dr. LabMu) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* FITUR 1: Compact Level / XP & Badges Trigger */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setNewlyUnlockedBadge(null);
            setIsBadgeModalOpen(true);
          }}
          aria-label={`Profil Gamifikasi Siswa Level ${gamificationProfile.level} (${gamificationProfile.xp} XP)`}
          title="Lihat Level, XP & Koleksi Lencana Saintifik"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-mono text-[11px] font-bold tabular-nums">
            {t('nav.level')}{gamificationProfile.level} · {gamificationProfile.xp} XP
          </span>
          {gamificationProfile.unlockedBadges.length > 0 && (
            <span className="hidden xl:inline text-[10px] font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              ({gamificationProfile.unlockedBadges.length}/5)
            </span>
          )}
        </button>

        {/* FITUR 4: Multi-Language Switcher [ID | EN] */}
        <div
          role="group"
          aria-label="Pilih Bahasa Antarmuka (ID / EN)"
          className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 text-[11px] font-mono font-bold shrink-0"
        >
          <button
            type="button"
            onClick={() => handleLanguageSwitch('id')}
            aria-label="Bahasa Indonesia (ID)"
            className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
              activeLang === 'id'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ID
          </button>
          <span className="text-slate-300 dark:text-slate-700 px-0.5" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            onClick={() => handleLanguageSwitch('en')}
            aria-label="English Language (EN)"
            className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
              activeLang === 'en'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            EN
          </button>
        </div>

        {/* 1. Status Sync (Real WebSocket Connection Indicator) */}
        <div
          role="status"
          aria-label={wsConnected ? 'Tersambung ke Lab Sync Server' : 'Mode Sinkronisasi Lokal'}
          title={wsConnected ? 'Real-Time Sync Aktif' : 'Sinkronisasi Lokal'}
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-stone-100/80 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              wsConnected
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className="hidden xl:inline text-[11px] font-mono">
            {wsConnected ? t('nav.syncActive') : t('nav.syncLocal')}
          </span>
        </div>

        {/* 2. Role Switcher (Siswa / Guru) & Gradebook Trigger */}
        <div
          role="group"
          aria-label="Pilih Peran Pengguna"
          className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 text-xs font-semibold shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setUserRole('siswa');
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              userRole === 'siswa'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{t('nav.roleStudent')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setUserRole('pengajar');
              setIsLobbyMode(false);
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              userRole === 'pengajar'
                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 hidden sm:inline" />
            <span>{t('nav.roleTeacher')}</span>
          </button>
        </div>

        {/* Gradebook Button (Hanya tampil / aktif saat role Guru aktif) */}
        {userRole === 'pengajar' && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setIsGradebookOpen(true);
            }}
            title="Buka Buku Nilai & Rekap Laporan Guru"
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('nav.gradebook')}</span>
          </button>
        )}

        {/* Command Palette Trigger Button */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          title="Buka Menu Pencarian & Aksi Cepat (Ctrl+K / ⌘K)"
          aria-label="Buka Pencarian & Perintah Cepat"
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 hover:border-sky-500/50 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors shrink-0"
        >
          <span className="hidden xl:inline">{t('nav.search')}</span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Ctrl+K
          </kbd>
        </button>

        {/* 3. Theme Switcher (Terang / Sepia / Gelap) */}
        <div
          role="group"
          aria-label="Pilih Tema Tampilan"
          className="hidden sm:flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 text-xs font-semibold shrink-0"
        >
          {(
            [
              { id: 'light' as ComfortThemeMode, label: t('nav.themeLight'), Icon: Sun },
              { id: 'sepia' as ComfortThemeMode, label: t('nav.themeSepia'), Icon: BookOpen },
              { id: 'dark' as ComfortThemeMode, label: t('nav.themeDark'), Icon: Moon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = comfortPrefs.theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleThemeSwitch(id)}
                title={`Tema ${label}`}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-sky-400" />
                <span className="hidden 2xl:inline">{label}</span>
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
          className={`relative px-2.5 py-1 flex items-center gap-1.5 rounded-lg border font-semibold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
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
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums">
              {notificationsCount}
            </span>
          )}
        </button>
      </div>

      {/* Teacher Gradebook Hub Modal */}
      {isGradebookOpen && (
        <Suspense fallback={null}>
          <TeacherGradebookHub
            isOpen={isGradebookOpen}
            onClose={() => setIsGradebookOpen(false)}
            activeRoomId={activeRoomId || undefined}
          />
        </Suspense>
      )}

      {/* Student Gamification & Badges Celebration Modal */}
      <BadgeNotificationModal
        isOpen={isBadgeModalOpen}
        onClose={() => {
          setIsBadgeModalOpen(false);
          setNewlyUnlockedBadge(null);
        }}
        profile={gamificationProfile}
        newlyUnlockedBadge={newlyUnlockedBadge}
        recentXpDelta={recentXpDelta}
      />
    </header>
  );
};

