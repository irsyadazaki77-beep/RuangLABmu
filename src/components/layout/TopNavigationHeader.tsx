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
  Search,
  SlidersHorizontal,
  Link2,
  HelpCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import { useLabStore, WorkflowStep } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { buildShareableModuleUrl } from '../../hooks/useUrlRouterSync';
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
    activeDomain,
    activeModuleId,
    isLobbyMode,
    setIsLobbyMode,
    workflowStep,
    setWorkflowStep,
    userRole,
    setUserRole,
  } = useLabStore();

  const [isGradebookOpen, setIsGradebookOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [shareToastVisible, setShareToastVisible] = useState(false);

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
    activeModal,
    openModal,
    closeModal,
    setOnboardingTourOpen,
    liteDeviceMode,
    toggleLiteDeviceMode,
    liteModeNotification,
    setLiteModeNotification,
  } = useUIStore();

  const { wsConnected, activeRoomId } = useCollabStore();

  useEffect(() => {
    if (activeModal === 'gradebook') {
      setIsGradebookOpen(true);
    }
  }, [activeModal]);

  const handleShareModuleLink = async () => {
    labSound.playClick(680);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ruanglabmu.app';
    const shareUrl = buildShareableModuleUrl(
      origin,
      activeDomain,
      activeModuleId || experimentModule.id,
      workflowStep,
      activeRoomId
    );
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // fallback if clipboard permission denied in iframe
    }
    setShareToastVisible(true);
    setTimeout(() => {
      setShareToastVisible(false);
    }, 2800);
  };

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
            data-onboarding="workflow-stepper"
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

      {/* Zone 3: Calm Right Utilities (Share Link, XP Portfolio, Onboarding Tour, Search, Unified Settings Popover, Dr. LabMu) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
        {/* FITUR 2: Tombol "✨ Buat Misi Praktikum AI" untuk Guru */}
        {userRole === 'pengajar' && (
          <button
            type="button"
            data-testid="header-open-ai-mission-builder-btn"
            onClick={() => {
              labSound.playClick(620);
              openModal('ai-mission-builder');
            }}
            aria-label="Buat Misi Praktikum AI untuk Room Kelas"
            title="✨ Buat Misi Praktikum AI & Studi Kasus untuk Room PIN Kelas"
            className="px-2.5 sm:px-3 py-1 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-extrabold shadow-sm cursor-pointer transition-all whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>✨ Buat Misi Praktikum AI</span>
          </button>
        )}

        {/* PILAR 1: Bagikan Link Modul Button */}
        <button
          type="button"
          onClick={handleShareModuleLink}
          data-testid="share-module-link-btn"
          aria-label="Bagikan Link Modul Praktikum"
          title="🔗 Bagikan Link Modul (Salin URL Deep-Link ke Clipboard)"
          className="px-2 sm:px-2.5 py-1 flex items-center gap-1.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 hover:border-sky-500/50 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="hidden lg:inline">🔗 Bagikan Link Modul</span>
        </button>

        {/* Share Link Confirmation Toast */}
        {shareToastVisible && (
          <div
            role="status"
            data-testid="share-link-toast"
            className="fixed top-16 right-4 z-50 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Tautan praktikum berhasil disalin!</span>
          </div>
        )}

        {/* PILAR 4: Compact Level / XP Pill -> Opens Student Portfolio & STEM Radar */}
        <button
          type="button"
          data-testid="open-portfolio-btn"
          onClick={() => {
            labSound.playClick();
            openModal('portfolio');
          }}
          aria-label={`Portofolio Sains & Profil Siswa Level ${gamificationProfile.level} (${gamificationProfile.xp} XP)`}
          title="Buka Portofolio Sains, Radar Kompetensi STEM & Koleksi Lencana"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-mono text-[11px] font-bold tabular-nums">
            {t('nav.level')}{gamificationProfile.level}
          </span>
          <span className="hidden xl:inline font-mono text-[11px] opacity-80 tabular-nums">
            · {gamificationProfile.xp} XP
          </span>
        </button>

        {/* PILAR 5: [? Panduan UI] Spotlight Onboarding Tour Button */}
        <button
          type="button"
          data-testid="open-onboarding-tour-btn"
          onClick={() => {
            labSound.playClick();
            setOnboardingTourOpen(true);
          }}
          aria-label="Buka Panduan UI Interaktif"
          title="[? Panduan UI] Tur Interaktif RuangLABmu"
          className="px-2 py-1 flex items-center gap-1 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 hover:border-sky-500/50 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="hidden xl:inline text-[11px]">? Panduan UI</span>
        </button>

        {/* 3T LITE GPU & BATTERY SAVER MODE TOGGLE */}
        <button
          type="button"
          data-testid="lite-device-mode-toggle-btn"
          onClick={() => {
            labSound.playClick(liteDeviceMode ? 440 : 660);
            toggleLiteDeviceMode();
          }}
          aria-label={liteDeviceMode ? 'Matikan Mode Hemat Daya 3T' : 'Aktifkan Mode Hemat Daya 3T (30 FPS & Tanpa Shader Berat)'}
          title={liteDeviceMode ? 'Mode Hemat Daya 3T Aktif (30 FPS, Tanpa Bloom/Bayangan Berat)' : 'Aktifkan Mode Hemat Daya untuk Chromebook / HP RAM 2GB-4GB'}
          className={`px-2 py-1 flex items-center gap-1 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
            liteDeviceMode
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-xs'
              : 'bg-stone-100 dark:bg-slate-900 border-stone-200/80 dark:border-slate-800 hover:border-amber-500/50 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${liteDeviceMode ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
          <span className="text-[11px] font-bold">{liteDeviceMode ? '⚡ Hemat Daya: Aktif' : '⚡ Mode Hemat'}</span>
        </button>

        {/* Gradebook Button (Only active when role Guru is selected) */}
        {userRole === 'pengajar' && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setIsGradebookOpen(true);
              openModal('gradebook');
            }}
            title="Buka Buku Nilai & Rekap Laporan Guru"
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('nav.gradebook')}</span>
          </button>
        )}

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          title={`${t('nav.search')} (Ctrl+K)`}
          aria-label="Buka Pencarian & Perintah Cepat"
          className="p-1.5 sm:px-2 sm:py-1 flex items-center gap-1.5 rounded-lg bg-stone-100 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800 hover:border-sky-500/50 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden xl:inline text-[11px] text-slate-400 font-mono">⌘K</span>
        </button>

        {/* Consolidated Preferences Popover (Theme, Language, Role, Sync Status) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setPrefsOpen((prev) => !prev);
            }}
            aria-expanded={prefsOpen}
            aria-label="Pengaturan Tampilan, Bahasa, dan Peran"
            title="Tema, Bahasa (ID/EN), Peran (Siswa/Guru) & Sync"
            className={`relative p-1.5 sm:px-2 sm:py-1 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              prefsOpen
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-stone-100 dark:bg-slate-900 border-stone-200/80 dark:border-slate-800 hover:border-sky-500/50 text-slate-700 dark:text-slate-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span
              className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-400'}`}
              title={wsConnected ? t('nav.syncActive') : t('nav.syncLocal')}
            />
          </button>

          {prefsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPrefsOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-3 space-y-3 z-50 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tema Tampilan
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800">
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
                          className={`py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                            active
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Icon className="w-3 h-3 text-amber-500 dark:text-sky-400 shrink-0" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Bahasa
                  </span>
                  <div className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 font-mono font-bold">
                    <button
                      type="button"
                      onClick={() => handleLanguageSwitch('id')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        activeLang === 'id'
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      ID
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLanguageSwitch('en')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        activeLang === 'en'
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mode Pengguna
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setUserRole('siswa');
                        setPrefsOpen(false);
                      }}
                      className={`py-1.5 rounded-lg cursor-pointer ${
                        userRole === 'siswa'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {t('nav.roleStudent')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setUserRole('pengajar');
                        setIsLobbyMode(false);
                        setPrefsOpen(false);
                      }}
                      className={`py-1.5 rounded-lg cursor-pointer flex items-center justify-center gap-1 ${
                        userRole === 'pengajar'
                          ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{t('nav.roleTeacher')}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Status Sync</span>
                  <span className="flex items-center gap-1.5 font-mono font-semibold text-slate-700 dark:text-slate-200">
                    <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {wsConnected ? t('nav.syncActive') : t('nav.syncLocal')}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Single Clear Dr. LabMu Assistant Button */}
        <button
          type="button"
          data-onboarding="dr-labmu-trigger"
          onClick={() => {
            labSound.playClick();
            toggleDrawer();
          }}
          aria-label={drawerOpen ? 'Tutup Asisten Dr. LabMu' : 'Buka Asisten Dr. LabMu'}
          title="[A] Tanya Dr. LabMu (Asisten Sokratik AI)"
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
            onClose={() => {
              setIsGradebookOpen(false);
              if (activeModal === 'gradebook') closeModal();
            }}
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

      {/* 3T Adaptive Lite Mode Notification Banner */}
      {liteModeNotification && (
        <div
          role="status"
          data-testid="lite-mode-notification-toast"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 border border-amber-300 animate-bounce cursor-pointer"
          onClick={() => setLiteModeNotification(null)}
        >
          <Zap className="w-4 h-4 fill-slate-950 shrink-0" />
          <span>{liteModeNotification}</span>
          <span className="text-[10px] opacity-75 underline ml-1">(Tutup)</span>
        </div>
      )}
    </header>
  );
};

