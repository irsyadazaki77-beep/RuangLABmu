import React, { Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
  Users,
  KeyRound,
  Plus,
  Lock,
  Unlock,
  LogOut,
  ChevronDown,
  UserCircle2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { Lab3DSnapshot } from '../ui/ScientificEnhancementSuite';
import { labSound } from '../../utils/soundEngine';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import { StudentWorkflowStepper } from './StudentWorkflowStepper';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { buildShareableModuleUrl } from '../../hooks/useUrlRouterSync';
import { ComfortThemeMode } from '../ui/VisualComfortToolbar';
import { getDomainAccentTokens } from '../../utils/layoutFlowHelpers';
import { MODAL_POPOVER_VARIANTS, SPRING_TACTILE } from '../../styles/motionPresets';
import {
  GamificationProfile,
  ScientificBadge,
  loadGamificationProfile,
  subscribeGamification,
} from '../../services/gamificationEngine';
import { setAppLanguage } from '../../i18n';

const TeacherGradebookHub = React.lazy(() => import('../teacher/TeacherGradebookHub'));
const StudentPortfolioModal = React.lazy(() => import('../portfolio/StudentPortfolioModal'));
const BadgeNotificationModal = React.lazy(() =>
  import('../ui/BadgeNotificationModal').then((m) => ({ default: m.BadgeNotificationModal }))
);

export interface TopNavigationHeaderProps {
  experimentModule: ExperimentModule;
  recordsCount: number;
  lksGraded: boolean;
  notificationsCount: number;
  hasLowR2Alert: boolean;
  studentProfiles: Array<{ name: string; group: string }>;
  selectedProfileIdx: number;
  onSelectProfileIdx: (idx: number) => void;
  records?: ExperimentRecord[];
  capturedSnapshots?: Lab3DSnapshot[];
  bestRSquared?: number;
  latestLksScore?: number;
  onLeaveRoom?: () => void;
  onToggleTeacherFreeze?: (isFrozen: boolean) => void;
}

export const TopNavigationHeader: React.FC<TopNavigationHeaderProps> = ({
  experimentModule,
  recordsCount,
  lksGraded,
  notificationsCount,
  hasLowR2Alert,
  studentProfiles,
  selectedProfileIdx,
  records = [],
  capturedSnapshots = [],
  bestRSquared = 0,
  latestLksScore = 0,
  onLeaveRoom,
  onToggleTeacherFreeze,
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
    academicLevel,
  } = useLabStore(
    useShallow((s) => ({
      activeDomain: s.activeDomain,
      activeModuleId: s.activeModuleId,
      isLobbyMode: s.isLobbyMode,
      setIsLobbyMode: s.setIsLobbyMode,
      workflowStep: s.workflowStep,
      setWorkflowStep: s.setWorkflowStep,
      userRole: s.userRole,
      setUserRole: s.setUserRole,
      academicLevel: s.academicLevel,
    }))
  );

  const {
    drawerOpen,
    toggleDrawer,
    setDrawerTab,
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
    lobbySearchQuery,
    setLobbySearchQuery,
    teacherViewMode,
  } = useUIStore(
    useShallow((s) => ({
      drawerOpen: s.drawerOpen,
      toggleDrawer: s.toggleDrawer,
      setDrawerTab: s.setDrawerTab,
      comfortPrefs: s.comfortPrefs,
      setComfortPrefs: s.setComfortPrefs,
      activeModal: s.activeModal,
      openModal: s.openModal,
      closeModal: s.closeModal,
      setOnboardingTourOpen: s.setOnboardingTourOpen,
      liteDeviceMode: s.liteDeviceMode,
      toggleLiteDeviceMode: s.toggleLiteDeviceMode,
      liteModeNotification: s.liteModeNotification,
      setLiteModeNotification: s.setLiteModeNotification,
      projectorMode: s.projectorMode,
      toggleProjectorMode: s.toggleProjectorMode,
      lobbySearchQuery: s.lobbySearchQuery,
      setLobbySearchQuery: s.setLobbySearchQuery,
      teacherViewMode: s.teacherViewMode,
    }))
  );

  const {
    wsConnected,
    activeRoomId,
    roomPin,
    roomMembers,
    isFrozenByTeacher,
    openRoomModal,
  } = useCollabStore(
    useShallow((s) => ({
      wsConnected: s.wsConnected,
      activeRoomId: s.activeRoomId,
      roomPin: s.roomPin,
      roomMembers: s.roomMembers,
      isFrozenByTeacher: s.isFrozenByTeacher,
      openRoomModal: s.openRoomModal,
    }))
  );

  const domainAccent = getDomainAccentTokens(experimentModule.domain);
  const tierShortLabel =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'MHS' : 'SMA';

  const [isGradebookOpen, setIsGradebookOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const [shareToastVisible, setShareToastVisible] = useState(false);
  const [isConnectivityTooltipOpen, setIsConnectivityTooltipOpen] = useState(false);

  const prefsContainerRef = useRef<HTMLDivElement>(null);
  const collabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefsOpen && !collabOpen && !isConnectivityTooltipOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (prefsOpen && prefsContainerRef.current && !prefsContainerRef.current.contains(target)) {
        setPrefsOpen(false);
      }
      if (collabOpen && collabContainerRef.current && !collabContainerRef.current.contains(target)) {
        setCollabOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPrefsOpen(false);
        setCollabOpen(false);
        setIsConnectivityTooltipOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [prefsOpen, collabOpen, isConnectivityTooltipOpen]);

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

  // Unified 3-State Connectivity Status (Single Source of Truth)
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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
      : isOnline && wsConnected && !isLocalLanHost
      ? 'online-cloud'
      : isOnline
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

  // Synchronize comfort preferences onto root HTML attributes
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

  const isFullBleedActiveLab =
    !isLobbyMode &&
    ((userRole === 'siswa' && workflowStep === 2) ||
      (userRole === 'pengajar' && teacherViewMode === 'lab3d'));

  const memberCount = Object.keys(roomMembers).length;
  const activeProfile = studentProfiles[selectedProfileIdx] ?? studentProfiles[0];

  return (
    <>
      {!isFullBleedActiveLab && (
        <header className="sticky top-0 h-14 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 bg-white/95 dark:bg-slate-950/95 border-b border-stone-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 z-40 select-none transition-colors duration-200">
          {/* 1. Brand Identity + Compact Context */}
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
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-white bg-stone-100 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>{t('nav.backToCatalog')}</span>
                </button>
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] pl-2 border-l border-stone-200 dark:border-slate-800">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${domainAccent.dotClass}`} />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {experimentModule.title}
                  </span>
                  <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-stone-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-stone-200 dark:border-slate-700 shrink-0">
                    {tierShortLabel}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 2. Center: Search Bar (Lobby) or Workflow Stepper (Stages 1/3/4) */}
          <div className="flex-1 flex items-center justify-center min-w-0 max-w-md mx-2">
            {isLobbyMode ? (
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={lobbySearchQuery}
                  onChange={(e) => setLobbySearchQuery(e.target.value)}
                  placeholder="Cari modul atau rumus..."
                  aria-label="Cari modul atau rumus..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-stone-100/90 dark:bg-slate-900 border border-stone-200/90 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {lobbySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLobbySearchQuery('')}
                    aria-label="Hapus kata kunci pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              userRole === 'siswa' && (
                <div className="hidden md:flex items-center justify-center">
                  <StudentWorkflowStepper
                    workflowStep={workflowStep}
                    setWorkflowStep={setWorkflowStep}
                    recordsCount={recordsCount}
                    lksGraded={lksGraded}
                  />
                </div>
              )
            )}
          </div>

          {/* 3. Right Utilities: 1 Unified Connection Pill + 1 Meja Bersama Button + 1 Dr. LabMu/Profile Dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
            {/* A. Unified Connection Status Pill (Single Source of Truth) */}
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
                    ? 'Online'
                    : connectivityMode === 'lan-hotspot'
                    ? 'LAN Kelas'
                    : 'Luring'
                }`}
                className={`px-2.5 py-1 flex items-center gap-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
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
                      ? 'bg-emerald-500'
                      : connectivityMode === 'lan-hotspot'
                      ? 'bg-sky-500'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="font-bold">
                  {connectivityMode === 'online-cloud'
                    ? 'Online'
                    : connectivityMode === 'lan-hotspot'
                    ? 'LAN Kelas'
                    : 'Luring'}
                </span>
              </button>

              <AnimatePresence>
                {isConnectivityTooltipOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsConnectivityTooltipOpen(false)}
                    />
                    <motion.div
                      variants={MODAL_POPOVER_VARIANTS}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      data-testid="connectivity-status-tooltip"
                      className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-4 z-50 text-xs space-y-3"
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
                                ? 'Mode Online 3T Siap'
                                : connectivityMode === 'lan-hotspot'
                                ? 'Mode LAN Kelas (Tanpa Kuota)'
                                : 'Mode Luring Mandiri'}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              Host: {hostname || 'localhost'} · {wsConnected ? 'Sync Aktif' : 'Cache Lokal'}
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

                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {connectivityMode === 'lan-hotspot'
                          ? 'Terhubung ke server laptop Guru via Wi-Fi lokal kelas tanpa kuota internet. Data & nilai tersinkron ke Buku Nilai Guru.'
                          : connectivityMode === 'online-cloud'
                          ? 'Koneksi jaringan aktif. Modul simulasi tetap dicache otomatis di perangkat (PWA) untuk ketahanan sinyal 3T.'
                          : 'Berjalan 100% di memori lokal perangkat (PWA + Offline Dr. LabMu). Seluruh data pengamatan dan LKS aman tersimpan lokal.'}
                      </p>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* B. Single Meja Bersama Button + Popover */}
            <div ref={collabContainerRef} className="relative">
              <button
                type="button"
                data-testid="navbar-meja-bersama-btn"
                onClick={() => {
                  labSound.playClick();
                  setPrefsOpen(false);
                  setCollabOpen((prev) => !prev);
                }}
                aria-expanded={collabOpen}
                className={`px-2.5 py-1 flex items-center gap-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  activeRoomId
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : collabOpen
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-stone-100 dark:bg-slate-900 border-stone-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-500/50'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {activeRoomId ? `Room: ${activeRoomId}` : 'Meja Bersama'}
                </span>
                {activeRoomId && (
                  <span className="px-1 py-0.2 rounded bg-emerald-500/20 font-mono text-[10px] font-bold tabular-nums">
                    {memberCount}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-75" />
              </button>

              <AnimatePresence>
                {collabOpen && (
                  <motion.div
                    variants={MODAL_POPOVER_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    data-testid="meja-bersama-popover"
                    className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-3.5 space-y-3 z-50 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <Users className="w-4 h-4 text-sky-500" />
                        <span>Meja Bersama (Kolaborasi)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCollabOpen(false)}
                        aria-label="Tutup Popover Meja Bersama"
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {activeRoomId ? (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span>Room: {activeRoomId}</span>
                          <span>{memberCount} Peserta</span>
                        </div>
                        {roomPin && (
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                            PIN Meja: <strong>{roomPin}</strong>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 pt-1">
                          {userRole === 'pengajar' && onToggleTeacherFreeze && (
                            <button
                              type="button"
                              onClick={() => {
                                labSound.playClick(540);
                                onToggleTeacherFreeze(!isFrozenByTeacher);
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                                isFrozenByTeacher
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isFrozenByTeacher ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              <span>{isFrozenByTeacher ? 'Buka Kunci' : 'Kunci Layar'}</span>
                            </button>
                          )}
                          {onLeaveRoom && (
                            <button
                              type="button"
                              onClick={() => {
                                labSound.playClick();
                                onLeaveRoom();
                                setCollabOpen(false);
                              }}
                              className="py-1.5 px-2.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-200 hover:text-rose-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>Keluar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Gabung meja praktikum kelompok dengan PIN atau buat ruangan baru via Internet maupun Hotspot LAN kelas.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setCollabOpen(false);
                          openRoomModal('join');
                        }}
                        className="py-2 px-2.5 rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 hover:bg-stone-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>Masuk dengan PIN</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setCollabOpen(false);
                          openRoomModal('create');
                        }}
                        className="py-2 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>+ Buat Room</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* C. Unified Dr. LabMu / User Profile & Settings Dropdown */}
            <div ref={prefsContainerRef} className="relative">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={SPRING_TACTILE}
                data-testid="settings-popover-trigger-btn"
                onClick={() => {
                  labSound.playClick();
                  setCollabOpen(false);
                  setPrefsOpen((prev) => !prev);
                }}
                aria-expanded={prefsOpen}
                aria-label="Dr. LabMu, Profil & Pengaturan"
                className={`relative px-2.5 py-1 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                  prefsOpen
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-stone-200/90 dark:border-slate-800 hover:border-sky-500/50 text-slate-800 dark:text-slate-200'
                }`}
              >
                {userRole === 'pengajar' ? (
                  <GraduationCap
                    className={`w-3.5 h-3.5 shrink-0 ${prefsOpen ? 'text-white' : 'text-emerald-500'}`}
                  />
                ) : (
                  <UserCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${prefsOpen ? 'text-white' : 'text-sky-500'}`}
                  />
                )}
                <span className="hidden sm:inline font-bold">
                  {userRole === 'pengajar' ? 'Guru' : activeProfile?.name?.split(' ')[0] || 'Siswa'}
                </span>
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded tabular-nums ${
                    prefsOpen
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  Lv.{gamificationProfile.level}
                </span>
                <SlidersHorizontal className="w-3 h-3 opacity-75 shrink-0" />
                {hasLowR2Alert && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5"
                    title="Deviasi Data Terdeteksi!"
                  />
                )}
              </motion.button>

              <AnimatePresence>
                {prefsOpen && (
                  <motion.div
                    variants={MODAL_POPOVER_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    data-testid="settings-popover-menu"
                    className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl p-3.5 space-y-3 z-50 text-xs max-h-[82vh] overflow-y-auto"
                  >
                    {/* Profile + Quick Actions: Dr. LabMu & Portfolio/Gradebook */}
                    <div className="space-y-2 pb-2.5 border-b border-stone-200/80 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {activeProfile?.name || 'Alya Pratama'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {activeProfile?.group || 'Kelompok 1'} · Level {gamificationProfile.level} ({gamificationProfile.xp} XP)
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid="open-portfolio-btn"
                          onClick={() => {
                            labSound.playClick();
                            setPrefsOpen(false);
                            if (userRole === 'pengajar') {
                              setIsGradebookOpen(true);
                              openModal('gradebook');
                            } else {
                              openModal('portfolio');
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>{userRole === 'pengajar' ? 'Buku Nilai' : 'Portofolio'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          data-onboarding="dr-labmu-trigger"
                          onClick={() => {
                            labSound.playClick();
                            setPrefsOpen(false);
                            if (drawerOpen) toggleDrawer();
                            else setDrawerTab('ai');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Asisten Dr. LabMu</span>
                          {notificationsCount > 0 && (
                            <span className="font-mono text-[10px] opacity-80">({notificationsCount})</span>
                          )}
                        </button>

                        <button
                          type="button"
                          data-testid="lobby-teacher-gradebook-toggle-btn"
                          onClick={() => {
                            labSound.playClick();
                            const nextRole = userRole === 'pengajar' ? 'siswa' : 'pengajar';
                            setUserRole(nextRole);
                            if (nextRole === 'pengajar') {
                              setIsGradebookOpen(true);
                              openModal('gradebook');
                              setPrefsOpen(false);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer ${
                            userRole === 'pengajar'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-500'
                          }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>{userRole === 'pengajar' ? 'Buku Nilai Aktif' : 'Mode Guru'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Theme Selector */}
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

                    {/* Language & Role */}
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

                    {/* 3T Visual Classroom Modes */}
                    <div className="pt-2 border-t border-stone-200/80 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Mode Visual Ruang Kelas 3T
                      </span>

                      <button
                        type="button"
                        data-testid="projector-mode-toggle-btn"
                        onClick={() => {
                          labSound.playClick(projectorMode ? 480 : 720);
                          toggleProjectorMode();
                        }}
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          projectorMode
                            ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/70'
                            : 'bg-stone-100 dark:bg-slate-950 border-stone-200/80 dark:border-slate-800 hover:border-amber-500/40 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Monitor className={`w-4 h-4 ${projectorMode ? 'text-amber-500' : 'text-slate-400'}`} />
                          <span>Mode Proyektor Kelas (1.5x)</span>
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

                    {/* Lab Tools */}
                    <div className="space-y-1 pt-2 border-t border-stone-200/80 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Alat Praktikum
                      </span>
                      <button
                        type="button"
                        data-testid="header-print-blank-worksheet-btn"
                        onClick={() => {
                          labSound.playClick();
                          setPrefsOpen(false);
                          void import('../../utils/academicReportExporter').then((m) =>
                            m.printBlankStudentWorksheet(experimentModule, 'SMA')
                          );
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Cetak LKS Kosong (Fotokopi Kelas)</span>
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

                      <button
                        type="button"
                        data-testid="header-open-ai-mission-builder-btn"
                        onClick={() => {
                          labSound.playClick(620);
                          setPrefsOpen(false);
                          if (userRole !== 'pengajar') {
                            setUserRole('pengajar');
                          }
                          openModal('ai-mission-builder');
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Buat Misi Praktikum AI (Guru)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
      )}

      {/* Share Link Confirmation Toast */}
      {shareToastVisible && (
        <div
          role="status"
          data-testid="share-link-toast"
          className="fixed top-16 right-4 z-50 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xl flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Tautan praktikum berhasil disalin!</span>
        </div>
      )}

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

      {/* Student Portfolio Modal */}
      {activeModal === 'portfolio' && (
        <Suspense fallback={null}>
          <StudentPortfolioModal
            isOpen={activeModal === 'portfolio'}
            onClose={closeModal}
            studentName={activeProfile?.name || 'Alya Pratama'}
            studentGroup={activeProfile?.group || 'Kelompok 1'}
            profile={gamificationProfile}
            records={records}
            snapshots={capturedSnapshots}
            bestRSquared={bestRSquared}
            lksGraded={lksGraded}
            latestLksScore={latestLksScore}
            activeModuleTitle={experimentModule.title}
          />
        </Suspense>
      )}

      {/* Gamification Badge Celebration Modal */}
      {isBadgeModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* 3T Adaptive Lite Mode Notification Banner */}
      {liteModeNotification && (
        <div
          role="status"
          data-testid="lite-mode-notification-toast"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 border border-amber-300 cursor-pointer"
          onClick={() => setLiteModeNotification(null)}
        >
          <Zap className="w-4 h-4 fill-slate-950 shrink-0" />
          <span>{liteModeNotification}</span>
          <span className="text-[10px] opacity-75 underline ml-1">(Tutup)</span>
        </div>
      )}
    </>
  );
};
