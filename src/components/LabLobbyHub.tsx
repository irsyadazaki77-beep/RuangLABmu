import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BarChart3,
  BookOpen,
  ChevronDown,
  Compass,
  Flame,
  Layers,
  Play,
  Search,
  SearchX,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { SPRING_LAYOUT_PILL, SPRING_TACTILE } from '../styles/motionPresets';
import {
  ExperimentModule,
  EducationTier,
  ScienceDomain,
  EXPERIMENT_CATALOG,
  getExperimentById,
} from '../registry/experimentRegistry';
import {
  CURRICULUM_CHAPTERS,
  CurriculumChapter,
} from '../registry/curriculumChapters';
import { labSound } from '../utils/soundEngine';
import { ComfortThemeMode } from './ui/VisualComfortToolbar';
import {
  ScientificBadge,
  AchievementBadgesStrip,
} from './ui/ScientificEnhancementSuite';
import { ModuleSchematicIllustration } from './ui/ModuleSchematicIllustration';
import { SciFormula } from './ui/ScientificNotation';
import { useShallow } from 'zustand/react/shallow';
import { useCollabStore } from '../stores/useCollabStore';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';
import {
  loadLastOpenedModuleId,
  saveLastOpenedModuleId,
  claimDailyLabChallengeXP,
  loadGamificationProfile,
  subscribeGamification,
  getLevelProgress,
  GamificationProfile,
} from '../services/gamificationEngine';
import {
  filterCurriculumChapters,
  filterExperimentModules,
} from '../utils/spatialHudHelpers';
import {
  computeDomainCurriculumProgress,
  loadBookmarkedModuleIds,
  saveBookmarkedModuleIds,
  toggleModuleBookmarkList,
} from '../utils/classAnalyticsEngine';
import {
  DOMAIN_ICONS,
  DOMAIN_PREVIEW_IMAGES,
  DOMAIN_SHOWCASE_META,
  chapterMatchesJenjang,
  formatCleanCardEquation,
} from './lobby/lobbyFormatters';
import { ChapterCatalogCard, ModuleCatalogCard } from './lobby/ModuleCatalogCard';
import { RoomCollabModal } from './lobby/RoomCollabModal';
import { ChapterDetailModal } from './lobby/ChapterDetailModal';

interface LabLobbyHubProps {
  activeTier: EducationTier;
  studentName: string;
  studentGroup: string;
  completedModuleIds: string[];
  recordsCount: number;
  onTierChange: (tier: EducationTier) => void;
  onSelectExperiment: (experiment: ExperimentModule) => void;
  onOpenMysteryExam?: () => void;
  comfortTheme?: ComfortThemeMode;
  onChangeComfortTheme?: (theme: ComfortThemeMode) => void;
  badges?: ScientificBadge[];
  onCreateRoom?: (
    pin: string,
    domain: 'physics' | 'chemistry' | 'biology' | 'astronomy',
    moduleId: string,
    customRoomId?: string
  ) => void;
  onJoinRoom?: (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => void;
  onLeaveRoom?: () => void;
  onToggleTeacherFreeze?: (isFrozen: boolean) => void;
}

export const LabLobbyHub: React.FC<LabLobbyHubProps> = ({
  activeTier,
  studentName,
  studentGroup,
  completedModuleIds,
  recordsCount,
  onTierChange,
  onSelectExperiment,
  onOpenMysteryExam,
  badges = [],
  onCreateRoom,
  onJoinRoom,
}) => {
  const [jenjangFilter, setJenjangFilter] = useState<'all' | EducationTier>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'completed' | 'bookmarked'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => loadBookmarkedModuleIds());
  const [detailChapter, setDetailChapter] = useState<CurriculumChapter | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(() =>
    loadGamificationProfile()
  );
  const inlineSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setGamificationProfile(loadGamificationProfile());
    return subscribeGamification((updated) => {
      setGamificationProfile(updated);
    });
  }, []);

  const handleToggleBookmark = (moduleId: string) => {
    setBookmarkedIds((prev) => {
      const next = toggleModuleBookmarkList(prev, moduleId);
      saveBookmarkedModuleIds(next);
      return next;
    });
  };

  const { userRole, setUserRole } = useLabStore(
    useShallow((s) => ({
      userRole: s.userRole,
      setUserRole: s.setUserRole,
    }))
  );

  const {
    openModal,
    lobbySearchQuery,
    setLobbySearchQuery,
    lobbyViewMode,
    setLobbyViewMode,
    lobbySelectedDomain,
    setLobbySelectedDomain,
  } = useUIStore(
    useShallow((s) => ({
      openModal: s.openModal,
      lobbySearchQuery: s.lobbySearchQuery,
      setLobbySearchQuery: s.setLobbySearchQuery,
      lobbyViewMode: s.lobbyViewMode,
      setLobbyViewMode: s.setLobbyViewMode,
      lobbySelectedDomain: s.lobbySelectedDomain,
      setLobbySelectedDomain: s.setLobbySelectedDomain,
    }))
  );

  const {
    activeCustomMission,
    isRoomModalOpen,
    roomModalMode,
    roomError,
    openRoomModal,
    closeRoomModal,
    setRoomError,
  } = useCollabStore(
    useShallow((s) => ({
      activeCustomMission: s.activeCustomMission,
      isRoomModalOpen: s.isRoomModalOpen,
      roomModalMode: s.roomModalMode,
      roomError: s.roomError,
      openRoomModal: s.openRoomModal,
      closeRoomModal: s.closeRoomModal,
      setRoomError: s.setRoomError,
    }))
  );

  const [lastModuleId, setLastModuleId] = useState<string | null>(() =>
    loadLastOpenedModuleId()
  );
  const [dailyChallengeToast, setDailyChallengeToast] = useState<string | null>(null);
  const [lanInfo, setLanInfo] = useState<{
    ip: string;
    port: number;
    localUrl: string;
    allLanIps: string[];
  } | null>(null);

  useEffect(() => {
    setLastModuleId(loadLastOpenedModuleId());
    fetch('/api/lan-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.primaryLanIp || data.primaryIp || data.ip)) {
          const primary = data.primaryLanIp || data.primaryIp || data.ip;
          const port = data.port || 3000;
          const allIps =
            Array.isArray(data.allLanIps) && data.allLanIps.length > 0
              ? data.allLanIps
              : [primary];
          setLanInfo({
            ip: primary,
            port,
            localUrl: `http://${primary}:${port}`,
            allLanIps: allIps,
          });
        }
      })
      .catch(() => {
        // Silently ignore when offline
      });
  }, []);

  useEffect(() => {
    if (!detailChapter) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailChapter(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailChapter]);

  // Global '/' shortcut to focus Lobby inline search
  useEffect(() => {
    const onSlashKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inlineSearchRef.current?.focus();
    };
    window.addEventListener('keydown', onSlashKey);
    return () => window.removeEventListener('keydown', onSlashKey);
  }, []);

  const lastOpenedModule = useMemo(() => {
    if (!lastModuleId) return null;
    return getExperimentById(lastModuleId) || null;
  }, [lastModuleId]);

  const handleSelectAndTrackExperiment = (exp: ExperimentModule) => {
    saveLastOpenedModuleId(exp.id);
    setLastModuleId(exp.id);
    setDetailChapter(null);
    onSelectExperiment(exp);
  };

  const handleStartDailyLabChallenge = () => {
    labSound.playSuccessChime();
    const candidates = EXPERIMENT_CATALOG.filter((m) =>
      m.supportedTiers.includes(activeTier)
    );
    const pool = candidates.length > 0 ? candidates : EXPERIMENT_CATALOG;
    const randomIdx = Math.floor(Math.random() * pool.length);
    const chosenModule = pool[randomIdx] || EXPERIMENT_CATALOG[0];

    const res = claimDailyLabChallengeXP(
      chosenModule.id,
      chosenModule.title,
      `${new Date().toISOString().slice(0, 10)}:${chosenModule.id}`
    );
    setGamificationProfile(res.profile);
    saveLastOpenedModuleId(chosenModule.id);
    setLastModuleId(chosenModule.id);
    setDailyChallengeToast(
      `Bonus +250 XP diklaim! Membuka: ${chosenModule.title}`
    );
    onSelectExperiment(chosenModule);
  };

  const filteredChapters = useMemo(() => {
    const byDomainAndQuery = filterCurriculumChapters(CURRICULUM_CHAPTERS, {
      domain: lobbySelectedDomain,
      searchQuery: lobbySearchQuery,
      modules: EXPERIMENT_CATALOG,
    });
    return byDomainAndQuery.filter((ch) => chapterMatchesJenjang(ch, jenjangFilter));
  }, [lobbySelectedDomain, lobbySearchQuery, jenjangFilter]);

  const domainCurriculumProgress = useMemo(
    () => computeDomainCurriculumProgress(EXPERIMENT_CATALOG, completedModuleIds),
    [completedModuleIds]
  );

  const filteredModules = useMemo(() => {
    const base = filterExperimentModules(EXPERIMENT_CATALOG, {
      domain: lobbySelectedDomain,
      activeTier: jenjangFilter === 'all' ? activeTier : jenjangFilter,
      searchQuery: lobbySearchQuery,
      respectTierFilter: jenjangFilter !== 'all',
    });
    return base.filter((mod) => {
      if (difficultyFilter !== 'all' && mod.difficulty !== difficultyFilter) {
        return false;
      }
      if (statusFilter === 'completed' && !completedModuleIds.includes(mod.id)) {
        return false;
      }
      if (statusFilter === 'todo' && completedModuleIds.includes(mod.id)) {
        return false;
      }
      if (statusFilter === 'bookmarked' && !bookmarkedIds.includes(mod.id)) {
        return false;
      }
      return true;
    });
  }, [
    lobbySelectedDomain,
    activeTier,
    lobbySearchQuery,
    jenjangFilter,
    difficultyFilter,
    statusFilter,
    completedModuleIds,
    bookmarkedIds,
  ]);

  const detailChapterModules = useMemo(() => {
    if (!detailChapter) return [];
    return detailChapter.moduleIds
      .map((id) => getExperimentById(id))
      .filter((m): m is ExperimentModule => Boolean(m));
  }, [detailChapter]);

  const continueTargetModule = useMemo(() => {
    if (lastOpenedModule) return lastOpenedModule;
    if (lobbySelectedDomain !== 'all') {
      const domainMatch = EXPERIMENT_CATALOG.find(
        (m) => m.domain === lobbySelectedDomain && m.supportedTiers.includes(activeTier)
      );
      if (domainMatch) return domainMatch;
    }
    return (
      EXPERIMENT_CATALOG.find((m) => m.supportedTiers.includes(activeTier)) ||
      EXPERIMENT_CATALOG[0]
    );
  }, [lastOpenedModule, lobbySelectedDomain, activeTier]);

  const cardTierLabel = jenjangFilter === 'all' ? activeTier : jenjangFilter;
  const hasActiveFilters = Boolean(
    lobbySearchQuery.trim() ||
      lobbySelectedDomain !== 'all' ||
      jenjangFilter !== 'all' ||
      statusFilter !== 'all' ||
      difficultyFilter !== 'all'
  );

  const levelInfo = useMemo(
    () => getLevelProgress(gamificationProfile.xp),
    [gamificationProfile.xp]
  );

  const spotlightPreviewUrl = DOMAIN_PREVIEW_IMAGES[continueTargetModule.domain];
  const spotlightEquation = formatCleanCardEquation(
    continueTargetModule.keyEquations[0] || ''
  );
  const spotlightDesc =
    continueTargetModule.theorySummary.split('.')[0]?.trim() + '.' ||
    continueTargetModule.theorySummary;
  const SpotlightDomainIcon = DOMAIN_ICONS[continueTargetModule.domain];

  const handleResetAllFilters = () => {
    labSound.playClick();
    setLobbySearchQuery('');
    setLobbySelectedDomain('all');
    setJenjangFilter('all');
    setStatusFilter('all');
    setDifficultyFilter('all');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5 select-text">
      {isRoomModalOpen && (
        <RoomCollabModal
          isOpen={isRoomModalOpen}
          mode={roomModalMode}
          roomError={roomError}
          userRole={userRole}
          lanInfo={lanInfo}
          onOpenMode={openRoomModal}
          onClose={closeRoomModal}
          onSetRoomError={setRoomError}
          onSetUserRole={setUserRole}
          onCreateRoom={onCreateRoom}
          onJoinRoom={onJoinRoom}
        />
      )}

      {detailChapter && (
        <ChapterDetailModal
          chapter={detailChapter}
          modules={detailChapterModules}
          completedModuleIds={completedModuleIds}
          onClose={() => setDetailChapter(null)}
          onSelectExperiment={handleSelectAndTrackExperiment}
        />
      )}

      {/* Active Room Custom AI Mission Banner */}
      {activeCustomMission && (
        <div
          data-testid="active-room-custom-mission-card"
          className="rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-accent-border)] p-4 sm:p-5 text-[var(--comfort-text)] space-y-3 shadow-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-2xs font-mono text-[var(--comfort-accent)] font-semibold">
                <span>Misi Studi Kasus AI · Room {activeCustomMission.roomId}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--comfort-text)] tabular-nums">
                  Target {activeCustomMission.targetVariable.variableLabel}:{' '}
                  {activeCustomMission.targetVariable.minSuccessValue}–
                  {activeCustomMission.targetVariable.maxSuccessValue}{' '}
                  {activeCustomMission.targetVariable.unit}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--comfort-text)]">
                {activeCustomMission.title}
              </h3>
              <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed comfort-prose">
                {activeCustomMission.narrative}
              </p>
            </div>

            <button
              type="button"
              data-testid="start-room-custom-mission-btn"
              onClick={() => {
                labSound.playClick(640);
                const targetMod =
                  getExperimentById(activeCustomMission.moduleId) || EXPERIMENT_CATALOG[0];
                handleSelectAndTrackExperiment(targetMod);
              }}
              className="px-4 py-2 rounded-lg comfort-btn-primary font-semibold text-xs cursor-pointer shrink-0 transition-colors whitespace-nowrap"
            >
              Kerjakan Misi Ini →
            </button>
          </div>
        </div>
      )}

      {/* Studio Science Hero Spotlight & Student Progress Deck */}
      <section
        data-testid="quick-start-hero-bar"
        aria-label="Sorotan Eksperimen & Progres Belajar Siswa"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
      >
        {/* Left 7 Cols: Featured / Resume Experiment Spotlight */}
        <div className="lg:col-span-7 relative rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] overflow-hidden flex flex-col justify-between shadow-xs group">
          {/* Top Visual Media & Live Schematic Split */}
          <div className="relative min-h-[188px] sm:min-h-[204px] w-full overflow-hidden flex flex-col justify-between p-4 sm:p-5 text-white bg-slate-900">
            {!brokenImages[`hero-${continueTargetModule.domain}`] ? (
              <img
                src={spotlightPreviewUrl}
                alt={`Studio Laboratorium ${continueTargetModule.domain}`}
                referrerPolicy="no-referrer"
                onError={() =>
                  setBrokenImages((prev) => ({
                    ...prev,
                    [`hero-${continueTargetModule.domain}`]: true,
                  }))
                }
                className="pointer-events-none absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 lab-grid-bg"
              />
            )}

            {/* Measured Contrast Scrim for WCAG AA Legibility */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-900/35"
            />

            {/* Top Kicker Row */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-2xs font-mono">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-200 tabular-nums">
                <SpotlightDomainIcon
                  className="w-3.5 h-3.5 text-teal-300 shrink-0"
                  aria-hidden="true"
                />
                <span className="font-sans font-bold text-white uppercase tracking-wide">
                  {lastOpenedModule ? 'Lanjutkan Eksperimen' : 'Sorotan Praktikum 3D'}
                </span>
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
                <span className="capitalize text-teal-200 font-semibold">
                  {continueTargetModule.domain}
                </span>
                {continueTargetModule.chapterNumber && (
                  <>
                    <span aria-hidden="true" className="opacity-50">
                      ·
                    </span>
                    <span>Bab {continueTargetModule.chapterNumber}</span>
                  </>
                )}
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
                <span>{continueTargetModule.estimatedMinutes} mnt</span>
              </div>

              {spotlightEquation && (
                <div className="hidden sm:block px-2.5 py-0.5 rounded-md bg-black/45 backdrop-blur-xs border border-white/15 text-teal-200 font-mono text-2xs">
                  <SciFormula text={spotlightEquation} />
                </div>
              )}
            </div>

            {/* Bottom Content & Schematic Preview */}
            <div className="relative z-10 pt-4 flex items-end justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug text-balance">
                  {continueTargetModule.title}
                </h2>
                <p className="text-xs text-slate-200/90 line-clamp-2 leading-relaxed">
                  {spotlightDesc}
                </p>
              </div>

              {/* Mini Floating Live Schematic Window */}
              <div className="hidden sm:flex w-36 h-20 shrink-0 rounded-lg bg-slate-950/75 backdrop-blur-xs border border-white/15 p-1.5 items-center justify-center overflow-hidden">
                <ModuleSchematicIllustration
                  moduleId={continueTargetModule.id}
                  domain={continueTargetModule.domain}
                  title={continueTargetModule.title}
                  subCategory={continueTargetModule.subCategory}
                />
              </div>
            </div>
          </div>

          {/* Action Toolbar Footer */}
          <div className="p-3 sm:px-4 sm:py-3 bg-[var(--comfort-surface)] border-t border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TACTILE}
                data-testid="quick-start-resume-btn"
                onClick={() => {
                  labSound.playClick();
                  handleSelectAndTrackExperiment(continueTargetModule);
                }}
                className="max-w-full min-w-0 min-h-[38px] px-4 py-2 rounded-lg comfort-btn-primary font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <Play className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {lastOpenedModule
                    ? `Lanjutkan Praktikum: ${lastOpenedModule.title}`
                    : `Mulai Praktikum: ${continueTargetModule.title}`}
                </span>
              </motion.button>

              <button
                type="button"
                data-testid="daily-lab-challenge-btn"
                onClick={handleStartDailyLabChallenge}
                className="min-h-[38px] px-3 py-2 rounded-lg comfort-btn-secondary font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                title="Kerjakan tantangan eksperimen acak hari ini dan raih +250 XP"
              >
                <Flame
                  className="w-3.5 h-3.5 text-[var(--comfort-warning)] shrink-0"
                  aria-hidden="true"
                />
                <span>Tantangan Sains (+250 XP)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="lobby-open-ai-mission-builder-btn"
                onClick={() => {
                  labSound.playClick(620);
                  if (userRole !== 'pengajar') {
                    setUserRole('pengajar');
                  }
                  openModal('ai-mission-builder');
                }}
                className="min-h-[38px] px-3 py-2 rounded-lg comfort-btn-secondary font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Compass
                  className="w-3.5 h-3.5 text-[var(--comfort-text-muted)]"
                  aria-hidden="true"
                />
                <span>Misi AI Guru</span>
              </button>

              {onOpenMysteryExam && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onOpenMysteryExam();
                  }}
                  className="min-h-[38px] px-3 py-2 rounded-lg comfort-btn-secondary font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>Ujian Sampel →</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Student Learning Progress, Scientist Rank & STEM Mission Deck */}
        <div
          data-testid="student-progress-xp-deck"
          className="lg:col-span-5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xs"
        >
          <div className="space-y-3">
            {/* Student Identity & Scientist Level Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                  <span>{studentName || 'Praktikan Sains'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{studentGroup || 'Kelompok 1'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[var(--comfort-accent)]">
                    Jenjang {activeTier}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--comfort-text)] truncate">
                  Lv. {levelInfo.level} · {levelInfo.rankTitle}
                </h3>
              </div>

              <div className="text-right shrink-0 font-mono tabular-nums">
                <div className="text-sm sm:text-base font-bold text-[var(--comfort-accent)]">
                  {gamificationProfile.xp} XP
                </div>
                <div className="text-2xs text-[var(--comfort-text-muted)]">
                  Target Lv. {levelInfo.level + 1}
                </div>
              </div>
            </div>

            {/* Level XP Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                <span>Progres Penguasaan Sains</span>
                <span>
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP ({levelInfo.progressPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--comfort-accent-solid)] transition-all duration-300"
                  style={{ width: `${Math.max(6, levelInfo.progressPct)}%` }}
                />
              </div>
            </div>

            {dailyChallengeToast && (
              <div className="px-3 py-1.5 rounded-lg bg-[var(--comfort-success-soft)] border border-[var(--comfort-success-border)] text-2xs font-semibold text-[var(--comfort-success)]">
                {dailyChallengeToast}
              </div>
            )}

            {/* 3-Column Tabular Student Achievement Readout */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
                <div className="font-mono text-sm sm:text-base font-bold text-[var(--comfort-text)] tabular-nums">
                  {completedModuleIds.length}/{EXPERIMENT_CATALOG.length}
                </div>
                <div className="text-2xs text-[var(--comfort-text-muted)]">
                  Modul Selesai
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
                <div className="font-mono text-sm sm:text-base font-bold text-[var(--comfort-accent)] tabular-nums">
                  {recordsCount}
                </div>
                <div className="text-2xs text-[var(--comfort-text-muted)]">
                  Data Observasi
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
                <div className="font-mono text-sm sm:text-base font-bold text-[var(--comfort-text)] tabular-nums">
                  {gamificationProfile.unlockedBadges.length}/5
                </div>
                <div className="text-2xs text-[var(--comfort-text-muted)]">
                  Lencana Sains
                </div>
              </div>
            </div>
          </div>

          {/* Footer Quick Actions: STEM Portfolio & Curriculum Status */}
          <div className="pt-3 border-t border-[var(--comfort-border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
              <Award className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
              <span>
                Kurikulum {domainCurriculumProgress.overallPct}% ·{' '}
                {lobbyViewMode === 'chapters'
                  ? `${filteredChapters.length} Bab`
                  : `${filteredModules.length} Modul`}
              </span>
            </div>

            <button
              type="button"
              data-testid="lobby-open-stem-portfolio-btn"
              onClick={() => {
                labSound.playClick();
                openModal('portfolio');
              }}
              className="min-h-[34px] px-3 py-1.5 rounded-lg comfort-btn-secondary text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
              <span>Portofolio STEM</span>
            </button>
          </div>
        </div>
      </section>

      {/* Interactive 4 Science Domains Explorer Cards */}
      <section
        data-testid="science-domain-explorer-grid"
        aria-label="Eksplorasi 4 Bidang Sains"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        {domainCurriculumProgress.domains.map((dom) => {
          const domainKey = dom.domain as ScienceDomain;
          const isSelected = lobbySelectedDomain === domainKey;
          const DomainIcon = DOMAIN_ICONS[domainKey];
          const meta = DOMAIN_SHOWCASE_META[domainKey];
          const previewUrl = DOMAIN_PREVIEW_IMAGES[domainKey];
          const imageKey = `domain-${domainKey}`;

          return (
            <button
              key={domainKey}
              type="button"
              data-testid={`domain-explorer-card-${domainKey}`}
              aria-pressed={isSelected}
              onClick={() => {
                labSound.playClick();
                setLobbySelectedDomain(isSelected ? 'all' : domainKey);
              }}
              className={`group relative text-left rounded-xl border overflow-hidden transition-[border-color,box-shadow,transform] duration-150 cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
                isSelected
                  ? 'border-[var(--comfort-accent)] bg-[var(--comfort-accent-soft)]/35 shadow-sm -translate-y-0.5'
                  : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-[var(--comfort-accent-border)] hover:shadow-sm hover:-translate-y-0.5'
              }`}
            >
              {/* Top Domain Studio Visual Banner */}
              <div className="relative h-20 w-full overflow-hidden bg-slate-900 border-b border-[var(--comfort-border)]">
                {!brokenImages[imageKey] ? (
                  <img
                    src={previewUrl}
                    alt={`Laboratorium ${meta.title}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [imageKey]: true }))
                    }
                    className="pointer-events-none w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 lab-grid-bg"
                  />
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent"
                />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2 text-white">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <DomainIcon className="w-4 h-4 text-teal-300 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-bold tracking-tight truncate">
                      {meta.title}
                    </span>
                  </div>
                  <span className="font-mono text-2xs font-semibold text-slate-200 tabular-nums shrink-0">
                    {dom.completedCount}/{dom.totalCount}
                  </span>
                </div>
              </div>

              {/* Domain Card Body & Progress Bar */}
              <div className="p-3 space-y-2 flex-1 flex flex-col justify-between w-full">
                <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
                  {meta.tagline}
                </p>

                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden border border-[var(--comfort-border)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${meta.barClass}`}
                      style={{
                        width: `${Math.max(dom.pct, dom.completedCount > 0 ? 10 : 0)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                    <span>{dom.pct}% Selesai</span>
                    <span className="font-sans font-semibold text-[var(--comfort-accent)]">
                      {isSelected ? 'Filter Aktif ✓' : 'Jelajahi →'}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Unified Workspace Filter & Search Bar */}
      <div className="rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] divide-y divide-[var(--comfort-border)]">
        {/* Flat Compact Filter & Inline Search Bar */}
        <div
          data-testid="lobby-compact-filter-bar"
          className="flex flex-col lg:flex-row lg:flex-wrap xl:flex-nowrap items-stretch lg:items-center justify-between gap-2 px-3 py-2.5 bg-[var(--comfort-surface-subtle)]/50"
        >
          {/* Inline Quick Search Input (Shortcut '/') */}
          <div className="relative flex items-center w-full lg:w-48 xl:w-52 shrink-0">
            <Search
              className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] absolute left-2.5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={inlineSearchRef}
              type="text"
              data-testid="lobby-inline-search-input"
              value={lobbySearchQuery}
              onChange={(e) => setLobbySearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setLobbySearchQuery('');
                  inlineSearchRef.current?.blur();
                }
              }}
              placeholder="Cari modul, rumus, bab..."
              aria-label="Cari modul praktikum di lobi"
              className="w-full min-h-[36px] pl-8 pr-8 py-1.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] focus:border-[var(--comfort-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]/25 text-xs text-[var(--comfort-text)] placeholder-[var(--comfort-text-muted)] transition-colors"
            />
            {lobbySearchQuery ? (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setLobbySearchQuery('');
                  inlineSearchRef.current?.focus();
                }}
                aria-label="Hapus kata kunci pencarian"
                className="absolute right-1.5 p-1 rounded-md text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="hidden sm:inline-block absolute right-2 px-1.5 py-0.5 rounded bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-mono text-2xs text-[var(--comfort-text-muted)] leading-none pointer-events-none"
              >
                /
              </kbd>
            )}
          </div>

          <span className="hidden lg:block w-px h-4 bg-[var(--comfort-border)] shrink-0" aria-hidden="true" />

          {/* View Mode Segmented Control */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'chapters', label: 'Bab Kurikulum', Icon: BookOpen },
                { id: 'all', label: 'Semua Modul', Icon: Layers },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = lobbyViewMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setLobbyViewMode(id);
                  }}
                  className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                    active
                      ? 'text-white'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="lobby-view-mode-pill"
                      transition={SPRING_LAYOUT_PILL}
                      className="pointer-events-none absolute inset-0 rounded-lg bg-[var(--comfort-accent-solid)]"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" aria-hidden="true" />
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          <span className="hidden lg:block w-px h-4 bg-[var(--comfort-border)] shrink-0" aria-hidden="true" />

          {/* Domain Filter Tabs */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'fisika', label: 'Fisika' },
              { id: 'kimia', label: 'Kimia' },
              { id: 'biologi', label: 'Biologi' },
              { id: 'astronomi', label: 'Astronomi' },
            ].map((tab) => {
              const isSelected = lobbySelectedDomain === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setLobbySelectedDomain(tab.id as ScienceDomain | 'all');
                  }}
                  className={`relative px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'text-[var(--comfort-accent)]'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="lobby-domain-active-pill"
                      transition={SPRING_LAYOUT_PILL}
                      className="pointer-events-none absolute inset-0 rounded-lg bg-[var(--comfort-accent-soft)] border border-[var(--comfort-accent-border)]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="hidden lg:block w-px h-4 bg-[var(--comfort-border)] shrink-0" aria-hidden="true" />

          {/* Jenjang Selector */}
          <div
            role="group"
            aria-label="Filter Jenjang Pendidikan"
            className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar"
          >
            {(['Semua', 'SMP', 'SMA', 'Mahasiswa'] as const).map((tierLabel) => {
              const targetValue: 'all' | EducationTier =
                tierLabel === 'Semua' ? 'all' : tierLabel;
              const active = jenjangFilter === targetValue;
              return (
                <button
                  key={tierLabel}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setJenjangFilter(targetValue);
                    if (targetValue !== 'all') {
                      onTierChange(targetValue);
                    }
                  }}
                  className={`relative px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[var(--comfort-accent)]'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="lobby-tier-active-pill"
                      transition={SPRING_LAYOUT_PILL}
                      className="pointer-events-none absolute inset-0 rounded-lg bg-[var(--comfort-accent-soft)] border border-[var(--comfort-accent-border)]"
                    />
                  )}
                  <span className="relative z-10">{tierLabel}</span>
                </button>
              );
            })}

            <button
              type="button"
              data-testid="lobby-advanced-filters-toggle"
              onClick={() => {
                labSound.playClick();
                setAdvancedFiltersOpen((prev) => !prev);
              }}
              aria-expanded={advancedFiltersOpen || statusFilter !== 'all' || difficultyFilter !== 'all'}
              className={`ml-auto inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1.5 rounded-lg border text-2xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                advancedFiltersOpen || statusFilter !== 'all' || difficultyFilter !== 'all'
                  ? 'comfort-accent-soft'
                  : 'border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-[var(--comfort-text)] hover:border-[var(--comfort-accent-border)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
              <span>
                Progres &amp; Filter
                {statusFilter !== 'all' || difficultyFilter !== 'all'
                  ? ' •'
                  : ` (${domainCurriculumProgress.overallPct}%)`}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  advancedFiltersOpen || statusFilter !== 'all' || difficultyFilter !== 'all'
                    ? 'rotate-180'
                    : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* Row 2: Domain Curriculum Progress & Status/Difficulty Micro-Filters (collapsed by default) */}
        {(advancedFiltersOpen || statusFilter !== 'all' || difficultyFilter !== 'all') && (
          <div
            data-testid="lobby-domain-progress-strip"
            className="px-4 py-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs bg-[var(--comfort-surface)]"
          >
            {/* Per-domain Curriculum Progress Bars */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-2xs font-mono font-semibold text-[var(--comfort-text-muted)] tabular-nums shrink-0">
                Kurikulum {domainCurriculumProgress.totalCompleted}/{domainCurriculumProgress.totalModules} ({domainCurriculumProgress.overallPct}%)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {domainCurriculumProgress.domains.map((dom) => {
                  const isActive = lobbySelectedDomain === dom.domain;
                  return (
                    <button
                      key={dom.domain}
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setLobbySelectedDomain(isActive ? 'all' : dom.domain);
                      }}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                        isActive
                          ? 'comfort-accent-soft text-[var(--comfort-text)]'
                          : 'border-transparent hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]'
                      }`}
                      title={`Filter domain ${dom.label} (${dom.completedCount}/${dom.totalCount} selesai)`}
                    >
                      <span className="font-semibold text-2xs text-[var(--comfort-text)]">
                        {dom.label}
                      </span>
                      <div className="w-12 h-1.5 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden border border-[var(--comfort-border)]">
                        <div
                          className="h-full rounded-full bg-[var(--comfort-accent-solid)] transition-all"
                          style={{ width: `${dom.pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-2xs tabular-nums">
                        {dom.completedCount}/{dom.totalCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status & Difficulty Compact Selectors */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label="Filter Status Modul"
                className="inline-flex items-center gap-1 bg-[var(--comfort-surface-subtle)] p-0.5 rounded-lg border border-[var(--comfort-border)]"
              >
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'todo', label: 'Belum' },
                    { id: 'completed', label: 'Selesai' },
                    { id: 'bookmarked', label: `Favorit (${bookmarkedIds.length})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`lobby-status-filter-${item.id}`}
                    onClick={() => {
                      labSound.playClick();
                      setStatusFilter(item.id);
                      if (item.id !== 'all' && lobbyViewMode === 'chapters') {
                        setLobbyViewMode('all');
                      }
                    }}
                    className={`px-2 py-1 rounded-md text-2xs font-semibold transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1 ${
                      statusFilter === item.id
                        ? 'comfort-tab-active'
                        : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                    }`}
                  >
                    {item.id === 'bookmarked' && (
                      <Star className="w-3 h-3 fill-current" aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <select
                data-testid="lobby-difficulty-filter"
                aria-label="Filter Tingkat Kesulitan Modul"
                value={difficultyFilter}
                onChange={(e) => {
                  labSound.playClick();
                  const val = e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3);
                  setDifficultyFilter(val);
                  if (val !== 'all' && lobbyViewMode === 'chapters') {
                    setLobbyViewMode('all');
                  }
                }}
                className="px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-2xs font-semibold text-[var(--comfort-text)] cursor-pointer"
              >
                <option value="all">Semua Level</option>
                <option value="1">Dasar</option>
                <option value="2">Menengah</option>
                <option value="3">Lanjut</option>
              </select>
            </div>
          </div>
        )}

        {/* Active Filter Summary Strip (only visible when filtering/searching) */}
        {hasActiveFilters && (
          <div
            data-testid="lobby-active-filter-strip"
            className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 bg-[var(--comfort-surface-subtle)]/70 text-2xs"
          >
            <div className="flex flex-wrap items-center gap-2 text-[var(--comfort-text-muted)]">
              <span className="font-mono font-semibold text-[var(--comfort-text)] tabular-nums">
                Menampilkan {lobbyViewMode === 'chapters' ? `${filteredChapters.length} bab` : `${filteredModules.length} modul`}
              </span>
              {lobbySearchQuery.trim() && (
                <span>
                  · Kata kunci: <strong className="text-[var(--comfort-accent)]">&ldquo;{lobbySearchQuery.trim()}&rdquo;</strong>
                </span>
              )}
              {lobbySelectedDomain !== 'all' && (
                <span className="capitalize">
                  · Domain: <strong className="text-[var(--comfort-text)]">{lobbySelectedDomain}</strong>
                </span>
              )}
              {jenjangFilter !== 'all' && (
                <span>
                  · Jenjang: <strong className="text-[var(--comfort-text)]">{jenjangFilter}</strong>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="px-2.5 py-1 rounded-lg comfort-btn-secondary text-2xs font-semibold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>

      {badges.length > 0 && <AchievementBadgesStrip badges={badges} />}

      {/* Main Catalog Grid */}
      {lobbyViewMode === 'chapters' ? (
        <div className="space-y-5">
          {filteredChapters.length === 0 && filteredModules.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-dashed border-[var(--comfort-border)] bg-[var(--comfort-surface)] space-y-3">
              <SearchX className="w-8 h-8 text-[var(--comfort-text-muted)] mx-auto" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--comfort-text)]">
                  Tidak ada bab atau modul yang sesuai dengan filter saat ini.
                </p>
                <p className="text-xs text-[var(--comfort-text-muted)]">
                  Ubah kata kunci pencarian atau pilih domain sains lainnya di atas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLobbySelectedDomain('all');
                  setJenjangFilter('all');
                  setLobbySearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg comfort-btn-primary cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <>
              {filteredChapters.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredChapters.map((ch) => (
                    <ChapterCatalogCard
                      key={ch.id}
                      chapter={ch}
                      completedModuleIds={completedModuleIds}
                      onOpenChapter={setDetailChapter}
                    />
                  ))}
                </div>
              )}

              {lobbySearchQuery.trim() && filteredModules.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <div className="text-xs font-semibold text-[var(--comfort-text-muted)]">
                    Hasil Modul untuk &ldquo;{lobbySearchQuery.trim()}&rdquo; ({filteredModules.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                    {filteredModules.map((exp) => (
                      <ModuleCatalogCard
                        key={exp.id}
                        exp={exp}
                        isCompleted={completedModuleIds.includes(exp.id)}
                        isBookmarked={bookmarkedIds.includes(exp.id)}
                        onToggleBookmark={handleToggleBookmark}
                        tierLabel={cardTierLabel}
                        onSelect={handleSelectAndTrackExperiment}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="p-10 text-center rounded-xl border border-dashed border-[var(--comfort-border)] bg-[var(--comfort-surface)] space-y-3">
          <SearchX className="w-8 h-8 text-[var(--comfort-text-muted)] mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--comfort-text)]">
              Tidak ada modul eksperimen yang sesuai dengan pencarian atau filter Anda.
            </p>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              Coba hapus kata kunci atau tampilkan seluruh bidang sains.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLobbySearchQuery('');
              setLobbySelectedDomain('all');
              setJenjangFilter('all');
              setStatusFilter('all');
              setDifficultyFilter('all');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg comfort-btn-primary cursor-pointer"
          >
            Tampilkan Semua Modul
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {filteredModules.map((exp) => (
            <ModuleCatalogCard
              key={exp.id}
              exp={exp}
              isCompleted={completedModuleIds.includes(exp.id)}
              isBookmarked={bookmarkedIds.includes(exp.id)}
              onToggleBookmark={handleToggleBookmark}
              tierLabel={cardTierLabel}
              onSelect={handleSelectAndTrackExperiment}
            />
          ))}
        </div>
      )}
    </div>
  );
};
