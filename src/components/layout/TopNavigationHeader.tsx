import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
  Wifi,
  Globe,
  HardDrive,
  X,
  Monitor,
  Printer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { labSound } from '../../utils/soundEngine';
import { useLabStore, WorkflowStep } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { buildShareableModuleUrl } from '../../hooks/useUrlRouterSync';
import { ComfortThemeMode } from '../ui/VisualComfortToolbar';
import { printBlankStudentWorksheet } from '../../utils/academicReportExporter';
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
  const prefsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (prefsContainerRef.current && !prefsContainerRef.current.contains(e.target as Node)) {
        setPrefsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrefsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [prefsOpen]);

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
    projectorMode,
    toggleProjectorMode,
  } = useUIStore();

  const { wsConnected, activeRoomId } = useCollabStore();

  // 3-State Connectivity Status for 3T Areas
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isConnectivityTooltipOpen, setIsConnectivityTooltipOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalLanHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.endsWith('.local');

  const connectivityMode: 'online-cloud' | 'lan-hotspot' | 'offline-standalone' =
    wsConnected && isLocalLanHost
      ? 'lan-hotspot'
      : wsConnected && isOnline && !isLocalLanHost
      ? 'online-cloud'
      : 'offline-standalone';

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
    <header className="sticky top-0 h-14 shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-5 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-stone-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 z-40 select-none transition-colors duration-200">
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
          <span className={`font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap ${!isLobbyMode ? 'hidden sm:inline' : ''}`}>
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
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-white bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700 px-2 sm:px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
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

      {/* Zone 3: Consolidated Minimalist Utilities (Strictly 4 Clean Groups: Connection Pill, Profile Pill, Settings Popover, Dr. LabMu) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
        {/* GRUP 1: Pill Status Koneksi Ringkas (3-State Connectivity Badge) */}
        <div className="relative">
          <button
            type="button"
            data-testid="tri-state-connectivity-badge"
            onClick={() => {
              labSound.playClick();
              setIsConnectivityTooltipOpen((prev) => !prev);
            }}
            aria-expanded={isConnectivityTooltipOpen}
            aria-label={`Status Konektivitas: ${
              connectivityMode === 'online-cloud'
                ? 'Online Cloud'
                : connectivityMode === 'lan-hotspot'
                ? 'LAN Kelas (Tanpa Kuota)'
                : 'Mode Luring Mandiri'
            }`}
            title="Klik untuk detail koneksi & status penyimpanan data"
            className={`px-2 sm:px-2.5 py-1 flex items-center gap-1 sm:gap-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 shadow-2xs ${
              connectivityMode === 'online-cloud'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/20'
                : connectivityMode === 'lan-hotspot'
                ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/35 hover:bg-sky-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/35 hover:bg-amber-500/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                connectivityMode === 'online-cloud'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectivityMode === 'lan-hotspot'
                  ? 'bg-sky-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span className="font-bold">
              {connectivityMode === 'online-cloud' ? (
                'Online'
              ) : connectivityMode === 'lan-hotspot' ? (
                <>
                  <span className="sm:hidden">LAN</span>
                  <span className="hidden sm:inline">LAN Kelas</span>
                </>
              ) : (
                'Luring'
              )}
            </span>
          </button>

          {/* Tooltip Dialog Ringkas Status Penyimpanan Data Siswa */}
          {isConnectivityTooltipOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsConnectivityTooltipOpen(false)}
              />
              <div
                data-testid="connectivity-status-tooltip"
                className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-4 z-50 text-xs space-y-3 animate-fade-in"
              >
                <div className="flex items-start justify-between gap-2 border-b border-stone-200/80 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        connectivityMode === 'online-cloud'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : connectivityMode === 'lan-hotspot'
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {connectivityMode === 'online-cloud' && <Globe className="w-4 h-4" />}
                      {connectivityMode === 'lan-hotspot' && <Wifi className="w-4 h-4" />}
                      {connectivityMode === 'offline-standalone' && <HardDrive className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {connectivityMode === 'online-cloud'
                          ? '🟢 Mode Online Cloud'
                          : connectivityMode === 'lan-hotspot'
                          ? '🔵 Mode LAN Kelas (Tanpa Kuota)'
                          : '🟠 Mode Luring Mandiri'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        Host: {hostname || 'localhost'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsConnectivityTooltipOpen(false)}
                    aria-label="Tutup Detail Konektivitas"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {connectivityMode === 'online-cloud' && (
                    <p>
                      Terhubung ke server cloud RuangLABmu dengan internet aktif. Data percobaan, telemetri, dan progres tersinkronisasi otomatis.
                    </p>
                  )}
                  {connectivityMode === 'lan-hotspot' && (
                    <p>
                      Terhubung langsung ke server laptop Guru via Hotspot Wi-Fi lokal kelas tanpa mengonsumsi kuota internet. Nilai dan data pengamatan Anda langsung diterima buku nilai guru!
                    </p>
                  )}
                  {connectivityMode === 'offline-standalone' && (
                    <p>
                      Berjalan 100% di memori lokal perangkat (PWA + Offline Dr. LabMu). Data observasi, regresi, dan kuis Anda tersimpan aman secara luring tanpa memerlukan sinyal internet.
                    </p>
                  )}
                </div>

                {/* Status Penyimpanan Data Siswa */}
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-slate-950 border border-stone-200/90 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Status Penyimpanan Data:
                  </div>
                  <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    {connectivityMode === 'online-cloud'
                      ? '✓ Database Cloud + Cache PWA Lokal'
                      : connectivityMode === 'lan-hotspot'
                      ? '✓ Buku Nilai Laptop Guru (LAN) + Backup Lokal'
                      : '✓ Memori Lokal (IndexedDB & LocalStorage)'}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {connectivityMode === 'offline-standalone'
                      ? 'Tip 3T: Anda dapat mengunduh berkas (.rlab) di lembar kerja untuk dikumpulkan ke guru lewat Bluetooth atau flashdisk.'
                      : 'Data aman dari risiko kehilangan koneksi sewaktu-waktu.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* GRUP 2: Pill Profil & Peran (Lv.X · Siswa/Guru + Akses Portofolio/Gradebook) */}
        <button
          type="button"
          data-testid="open-portfolio-btn"
          onClick={() => {
            labSound.playClick();
            if (userRole === 'pengajar') {
              setIsGradebookOpen(true);
              openModal('gradebook');
            } else {
              openModal('portfolio');
            }
          }}
          aria-label={`Profil ${userRole === 'pengajar' ? 'Guru' : 'Siswa'} Level ${gamificationProfile.level}`}
          title={
            userRole === 'pengajar'
              ? 'Buka Buku Nilai & Rekap Laporan Guru'
              : 'Buka Portofolio Sains, Radar Kompetensi STEM & Koleksi Lencana'
          }
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
        >
          {userRole === 'pengajar' ? (
            <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <span className="font-mono text-[11px] font-bold tabular-nums">
            Lv.{gamificationProfile.level}
          </span>
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500">·</span>
          <span className="hidden sm:inline font-bold">
            {userRole === 'pengajar' ? 'Guru' : 'Siswa'}
          </span>
        </button>

        {/* GRUP 3: Unified Popover Menu "⚙️ Pengaturan & Alat" (SettingsPopover) */}
        <div ref={prefsContainerRef} className="relative">
          <button
            type="button"
            data-testid="settings-popover-trigger-btn"
            onClick={() => {
              labSound.playClick();
              setPrefsOpen((prev) => !prev);
            }}
            aria-expanded={prefsOpen}
            aria-label="Pengaturan & Alat"
            title="⚙️ Pengaturan & Alat (Tema, Bahasa, Hemat Daya, Salin Link, Command Palette, Tur UI)"
            className={`p-1.5 sm:px-2 sm:py-1 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
              prefsOpen
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                : 'bg-stone-100 dark:bg-slate-900 border-stone-200/80 dark:border-slate-800 hover:border-sky-500/50 text-slate-700 dark:text-slate-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">⚙️</span>
          </button>

          {prefsOpen && (
            <>
              <div
                data-testid="settings-popover-menu"
                className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-3.5 space-y-3 z-50 text-xs animate-fade-in"
              >
                {/* 1. Pemilih Tema */}
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

                {/* 2. Saklar Bahasa & Mode Pengguna */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/80 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Bahasa
                    </span>
                    <div className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 font-mono font-bold">
                      <button
                        type="button"
                        onClick={() => handleLanguageSwitch('id')}
                        className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
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
                        className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
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
                      Peran
                    </span>
                    <div className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 font-semibold text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setUserRole('siswa');
                        }}
                        className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                          userRole === 'siswa'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Siswa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setUserRole('pengajar');
                        }}
                        className={`flex-1 py-1 rounded-md text-center cursor-pointer transition-colors ${
                          userRole === 'pengajar'
                            ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Guru
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Toggles: Mode Proyektor Kelas & Mode Hemat Daya 3T */}
                <div className="pt-2 border-t border-stone-200/80 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mode Visual Ruang Kelas 3T
                  </span>

                  {/* Toggle Mode Proyektor Kelas */}
                  <button
                    type="button"
                    data-testid="projector-mode-toggle-btn"
                    onClick={() => {
                      labSound.playClick(projectorMode ? 480 : 720);
                      toggleProjectorMode();
                    }}
                    title="Perbesar angka telemetri & indikator 1.5x dengan kontras tinggi untuk tayangan layar proyektor kelas"
                    className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      projectorMode
                        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/70 shadow-xs ring-1 ring-amber-400/40'
                        : 'bg-stone-100 dark:bg-slate-950 border-stone-200/80 dark:border-slate-800 hover:border-amber-500/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Monitor
                        className={`w-4 h-4 ${
                          projectorMode ? 'text-amber-500' : 'text-slate-400'
                        }`}
                      />
                      <span>📽️ Mode Proyektor Kelas (1.5x)</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        projectorMode
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-stone-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {projectorMode ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </button>

                  {/* Toggle Mode Hemat Daya 3T */}
                  <button
                    type="button"
                    data-testid="lite-device-mode-toggle-btn"
                    onClick={() => {
                      labSound.playClick(liteDeviceMode ? 440 : 660);
                      toggleLiteDeviceMode();
                    }}
                    className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      liteDeviceMode
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                        : 'bg-stone-100 dark:bg-slate-950 border-stone-200/80 dark:border-slate-800 hover:border-amber-500/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap
                        className={`w-4 h-4 ${
                          liteDeviceMode ? 'text-amber-500 fill-amber-500' : 'text-slate-400'
                        }`}
                      />
                      <span>Mode Hemat Daya 3T (30 FPS)</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        liteDeviceMode
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-stone-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {liteDeviceMode ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </button>
                </div>

                {/* 4. Alat Praktikum: Cetak LKS Kosong, Salin Link, Command Palette & Tur Panduan */}
                <div className="space-y-1.5 pt-2 border-t border-stone-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Alat Praktikum
                  </span>
                  <div className="grid grid-cols-1 gap-1 font-medium">
                    <button
                      type="button"
                      data-testid="header-print-blank-worksheet-btn"
                      onClick={() => {
                        labSound.playClick();
                        setPrefsOpen(false);
                        printBlankStudentWorksheet(experimentModule, 'SMA');
                      }}
                      title="Cetak format LKS kosong hemat tinta untuk difotokopi bagi siswa kelas"
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>🖨️ Cetak LKS Kosong (Fotokopi Kelas)</span>
                    </button>

                    <button
                      type="button"
                      data-testid="share-module-link-btn"
                      onClick={() => {
                        void handleShareModuleLink();
                        setPrefsOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs cursor-pointer transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>Salin Link Modul Praktikum</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setPrefsOpen(false);
                        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center justify-between rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Pencarian Cepat (Command Palette)</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">Ctrl+K</span>
                    </button>

                    <button
                      type="button"
                      data-testid="open-onboarding-tour-btn"
                      onClick={() => {
                        labSound.playClick();
                        setPrefsOpen(false);
                        setOnboardingTourOpen(true);
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs cursor-pointer transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>Tur Panduan UI Interaktif</span>
                    </button>

                    {userRole === 'pengajar' && (
                      <button
                        type="button"
                        data-testid="header-open-ai-mission-builder-btn"
                        onClick={() => {
                          labSound.playClick(620);
                          setPrefsOpen(false);
                          openModal('ai-mission-builder');
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>✨ Buat Misi Praktikum AI (Guru)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

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

        {/* GRUP 4: Tombol Utama "💬 Dr. LabMu" */}
        <button
          type="button"
          data-onboarding="dr-labmu-trigger"
          onClick={() => {
            labSound.playClick();
            toggleDrawer();
          }}
          aria-label={drawerOpen ? 'Tutup Asisten Dr. LabMu' : 'Buka Asisten Dr. LabMu'}
          title="[A] Tanya Dr. LabMu (Asisten Sokratik AI)"
          className={`relative px-2 sm:px-2.5 py-1 flex items-center gap-1 sm:gap-1.5 rounded-lg border font-semibold text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
            drawerOpen
              ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
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

