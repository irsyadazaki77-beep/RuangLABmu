import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Compass, Layers, Play, SearchX } from 'lucide-react';
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
import { useShallow } from 'zustand/react/shallow';
import { useCollabStore } from '../stores/useCollabStore';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';
import {
  loadLastOpenedModuleId,
  saveLastOpenedModuleId,
  claimDailyLabChallengeXP,
} from '../services/gamificationEngine';
import {
  filterCurriculumChapters,
  filterExperimentModules,
} from '../utils/spatialHudHelpers';
import { chapterMatchesJenjang } from './lobby/lobbyFormatters';
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
  const [detailChapter, setDetailChapter] = useState<CurriculumChapter | null>(null);

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

    claimDailyLabChallengeXP(
      chosenModule.id,
      chosenModule.title,
      `${new Date().toISOString().slice(0, 10)}:${chosenModule.id}`
    );
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

  const filteredModules = useMemo(() => {
    return filterExperimentModules(EXPERIMENT_CATALOG, {
      domain: lobbySelectedDomain,
      activeTier: jenjangFilter === 'all' ? activeTier : jenjangFilter,
      searchQuery: lobbySearchQuery,
      respectTierFilter: jenjangFilter !== 'all',
    });
  }, [lobbySelectedDomain, activeTier, lobbySearchQuery, jenjangFilter]);

  const detailChapterModules = useMemo(() => {
    if (!detailChapter) return [];
    return detailChapter.moduleIds
      .map((id) => getExperimentById(id))
      .filter((m): m is ExperimentModule => Boolean(m));
  }, [detailChapter]);

  const continueTargetModule = lastOpenedModule || EXPERIMENT_CATALOG[0];
  const cardTierLabel = jenjangFilter === 'all' ? activeTier : jenjangFilter;

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
          className="rounded-xl bg-[var(--comfort-surface)] border border-indigo-500/45 p-4 sm:p-5 text-[var(--comfort-text)] space-y-3 shadow-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-indigo-700 dark:text-indigo-300 font-semibold">
                <span>Misi Studi Kasus AI · Room {activeCustomMission.roomId}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-300 tabular-nums">
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
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0 transition-colors whitespace-nowrap"
            >
              Kerjakan Misi Ini →
            </button>
          </div>
        </div>
      )}

      {/* Unified Workspace Action & Filter Bar */}
      <div className="rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] divide-y divide-[var(--comfort-border)]">
        {/* Row 1: Studio Quick-Start Bar & Unboxed Tabular KPI Readout */}
        <div
          data-testid="quick-start-hero-bar"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0 w-full lg:w-auto">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TACTILE}
              data-testid="quick-start-resume-btn"
              onClick={() => {
                labSound.playClick();
                handleSelectAndTrackExperiment(continueTargetModule);
              }}
              className="max-w-full min-w-0 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors"
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
              className="px-3 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] hover:border-sky-500/50 border border-[var(--comfort-border)] text-[var(--comfort-text)] font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <span>Tantangan Sains</span>
            </button>

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
              className="px-3 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] hover:border-sky-500/50 border border-[var(--comfort-border)] text-[var(--comfort-text)] font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--comfort-text-muted)]" aria-hidden="true" />
              <span>Misi AI Guru</span>
            </button>

            {onOpenMysteryExam && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onOpenMysteryExam();
                }}
                className="px-3 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] hover:border-sky-500/50 border border-[var(--comfort-border)] text-[var(--comfort-text)] font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>Ujian Sampel →</span>
              </button>
            )}
          </div>

          {/* Unboxed Tabular KPI Readout */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-center text-xs text-[var(--comfort-text-muted)] tabular-nums">
            {dailyChallengeToast && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {dailyChallengeToast}
              </span>
            )}
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>
                <strong className="text-[var(--comfort-text)]">{completedModuleIds.length}</strong>{' '}
                Selesai
              </span>
              <span aria-hidden="true" className="opacity-35">·</span>
              <span>
                <strong className="text-sky-600 dark:text-sky-400">{recordsCount}</strong> Data
              </span>
              <span aria-hidden="true" className="opacity-35">·</span>
              <span>
                <strong className="text-[var(--comfort-text)]">
                  {lobbyViewMode === 'chapters' ? filteredChapters.length : filteredModules.length}
                </strong>{' '}
                {lobbyViewMode === 'chapters' ? 'Bab' : 'Modul'}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Flat Compact Filter Bar */}
        <div
          data-testid="lobby-compact-filter-bar"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 px-3 py-2 bg-[var(--comfort-surface-subtle)]/50"
        >
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
                      className="absolute inset-0 rounded-lg bg-sky-600"
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
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
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
                  className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'text-sky-700 dark:text-sky-300'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="lobby-domain-active-pill"
                      transition={SPRING_LAYOUT_PILL}
                      className="absolute inset-0 rounded-lg bg-sky-500/12 border border-sky-500/30"
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
                      ? 'text-sky-700 dark:text-sky-300'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="lobby-tier-active-pill"
                      transition={SPRING_LAYOUT_PILL}
                      className="absolute inset-0 rounded-lg bg-sky-500/12 border border-sky-500/30"
                    />
                  )}
                  <span className="relative z-10">{tierLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
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
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 cursor-pointer"
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
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 cursor-pointer"
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
              tierLabel={cardTierLabel}
              onSelect={handleSelectAndTrackExperiment}
            />
          ))}
        </div>
      )}
    </div>
  );
};
