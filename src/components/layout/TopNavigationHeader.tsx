import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Atom, CheckCircle2, Search, X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ExperimentModule } from '../../registry/experimentRegistry';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { Lab3DSnapshot } from '../ui/ScientificEnhancementSuite';
import { labSound } from '../../utils/soundEngine';
import { useLabStore } from '../../stores/useLabStore';
import { StudentWorkflowStepper } from './StudentWorkflowStepper';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { buildShareableModuleUrl } from '../../hooks/useUrlRouterSync';
import { ComfortThemeMode } from '../ui/VisualComfortToolbar';
import {
  GamificationProfile,
  ScientificBadge,
  loadGamificationProfile,
  subscribeGamification,
} from '../../services/gamificationEngine';
import { setAppLanguage } from '../../i18n';
import { useOfflineOutboxStatus } from '../../utils/offlineOutbox';
import { ConnectivityPopover, ConnectivityMode } from './header/ConnectivityPopover';
import { CollabRoomPopover } from './header/CollabRoomPopover';
import { UserSettingsPopover } from './header/UserSettingsPopover';

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

  const tierShortLabel =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'MHS' : 'SMA';

  const [isGradebookOpen, setIsGradebookOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const [shareToastVisible, setShareToastVisible] = useState(false);
  const [isConnectivityTooltipOpen, setIsConnectivityTooltipOpen] = useState(false);

  const prefsContainerRef = useRef<HTMLDivElement>(null);
  const collabContainerRef = useRef<HTMLDivElement>(null);
  const shareToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shareToastTimerRef.current) {
        clearTimeout(shareToastTimerRef.current);
        shareToastTimerRef.current = null;
      }
    };
  }, []);

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

  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(() =>
    loadGamificationProfile()
  );
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<ScientificBadge | null>(null);
  const [recentXpDelta, setRecentXpDelta] = useState<number>(0);

  useEffect(() => {
    setGamificationProfile(loadGamificationProfile());
    return subscribeGamification((updatedProfile, latestBadge, xpDelta) => {
      setGamificationProfile(updatedProfile);
      if (latestBadge) {
        setNewlyUnlockedBadge(latestBadge);
        setRecentXpDelta(xpDelta);
        setIsBadgeModalOpen(true);
      }
    });
  }, []);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const outboxStatus = useOfflineOutboxStatus();

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

  const connectivityMode: ConnectivityMode =
    wsConnected && isLocalLanHost
      ? 'lan-hotspot'
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
    if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current);
    shareToastTimerRef.current = setTimeout(() => {
      shareToastTimerRef.current = null;
      setShareToastVisible(false);
    }, 2800);
  };

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
        <header
          style={{ backgroundColor: 'var(--comfort-header-bg)' }}
          className="sticky top-0 h-14 shrink-0 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 backdrop-blur-md border-b border-[var(--comfort-border)] text-[var(--comfort-text)] z-40 select-none transition-colors duration-200"
        >
          {/* Zone 1: Brand Wordmark + Concise Module Breadcrumb */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setIsLobbyMode(true);
              }}
              aria-label="Kembali ke RuangLABmu Lobby"
              className="flex items-center gap-2 shrink-0 cursor-pointer hover:opacity-85 transition-opacity rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
            >
              <span className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center shrink-0">
                <Atom className="w-4 h-4 text-white" aria-hidden="true" />
              </span>
              <span className="font-bold text-base tracking-tight whitespace-nowrap">
                RuangLABmu
              </span>
            </button>

            {!isLobbyMode && userRole === 'siswa' && (
              <div className="flex items-center gap-2.5 min-w-0 pl-2.5 border-l border-[var(--comfort-border)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIsLobbyMode(true);
                  }}
                  aria-label="Kembali ke Katalog Laboratorium"
                  className="font-medium text-[var(--comfort-text-muted)] hover:text-[var(--comfort-accent)] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                >
                  {t('nav.backToCatalog')}
                </button>
                <span className="hidden lg:inline text-[var(--comfort-text-muted)]" aria-hidden="true">
                  ·
                </span>
                <span className="hidden lg:inline font-semibold truncate max-w-[200px]">
                  {experimentModule.title}
                </span>
                <span className="hidden lg:inline text-[var(--comfort-text-muted)] font-mono text-[11px] shrink-0">
                  {tierShortLabel}
                </span>
              </div>
            )}
          </div>

          {/* Zone 2: Search Bar (Lobby) or Workflow Stepper (Stages 1/3/4) */}
          <div className="flex-1 flex items-center justify-center min-w-0 max-w-md">
            {isLobbyMode ? (
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={lobbySearchQuery}
                  onChange={(e) => setLobbySearchQuery(e.target.value)}
                  placeholder="Cari modul atau rumus..."
                  aria-label="Cari modul atau rumus..."
                  className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:border-sky-500 transition-colors"
                />
                {lobbySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLobbySearchQuery('')}
                    aria-label="Hapus kata kunci pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
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

          {/* Zone 3: Connectivity · Meja Bersama · Profile & Settings */}
          <div className="flex items-center gap-2 shrink-0 relative">
            <ConnectivityPopover
              isOpen={isConnectivityTooltipOpen}
              onToggle={() => setIsConnectivityTooltipOpen((prev) => !prev)}
              onClose={() => setIsConnectivityTooltipOpen(false)}
              connectivityMode={connectivityMode}
              hostname={hostname}
              wsConnected={wsConnected}
              isOnline={isOnline}
              outboxStatus={outboxStatus}
            />

            <CollabRoomPopover
              containerRef={collabContainerRef}
              isOpen={collabOpen}
              onToggle={() => {
                setPrefsOpen(false);
                setCollabOpen((prev) => !prev);
              }}
              onClose={() => setCollabOpen(false)}
              activeRoomId={activeRoomId}
              roomPin={roomPin}
              memberCount={memberCount}
              userRole={userRole}
              isFrozenByTeacher={isFrozenByTeacher}
              onOpenRoomModal={openRoomModal}
              onLeaveRoom={onLeaveRoom}
              onToggleTeacherFreeze={onToggleTeacherFreeze}
            />

            <UserSettingsPopover
              containerRef={prefsContainerRef}
              isOpen={prefsOpen}
              onToggle={() => {
                setCollabOpen(false);
                setPrefsOpen((prev) => !prev);
              }}
              onClose={() => setPrefsOpen(false)}
              userRole={userRole}
              setUserRole={setUserRole}
              activeProfile={activeProfile}
              gamificationProfile={gamificationProfile}
              hasLowR2Alert={hasLowR2Alert}
              notificationsCount={notificationsCount}
              drawerOpen={drawerOpen}
              toggleDrawer={toggleDrawer}
              setDrawerTab={setDrawerTab}
              comfortPrefs={comfortPrefs}
              onThemeSwitch={handleThemeSwitch}
              activeLang={activeLang}
              onLanguageSwitch={handleLanguageSwitch}
              projectorMode={projectorMode}
              toggleProjectorMode={toggleProjectorMode}
              liteDeviceMode={liteDeviceMode}
              toggleLiteDeviceMode={toggleLiteDeviceMode}
              experimentModule={experimentModule}
              onShareModuleLink={handleShareModuleLink}
              onOpenGradebook={() => {
                setIsGradebookOpen(true);
                openModal('gradebook');
              }}
              openModal={openModal}
              setOnboardingTourOpen={setOnboardingTourOpen}
            />
          </div>
        </header>
      )}

      {shareToastVisible && (
        <div
          role="status"
          data-testid="share-link-toast"
          className="fixed top-16 right-4 z-50 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-lg flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Tautan praktikum berhasil disalin!</span>
        </div>
      )}

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

      {liteModeNotification && (
        <div
          role="status"
          data-testid="lite-mode-notification-toast"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs shadow-lg flex items-center gap-2 border border-amber-400 cursor-pointer"
          onClick={() => setLiteModeNotification(null)}
        >
          <Zap className="w-4 h-4 fill-slate-950 shrink-0" />
          <span>{liteModeNotification}</span>
          <span className="text-[11px] opacity-80 underline ml-1">(Tutup)</span>
        </div>
      )}
    </>
  );
};
