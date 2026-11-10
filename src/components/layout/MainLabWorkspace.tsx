import React, { lazy, Suspense, useState, useMemo, useEffect } from 'react';
import {
  Loader2,
  Lock,
  Unlock,
  Trophy,
  Target,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  BiologyTelemetryContext,
  ExperimentRecord,
  LabNotification,
  calculatePhysicsMetrics,
  calculateChemistryMetrics,
  calculateAstronomyMetrics,
} from '../../utils/scienceEngine';
import {
  GroupTaskItem,
  CollabNoteItem,
  CollaborationAndDataSection,
} from '../CollaborationAndDataSection';
import { AnalyticsAndWorksheetPanel } from '../AnalyticsAndWorksheetPanel';
import { StudentProgressItem } from '../TeacherDashboardView';
import { DrLabMuAssistantPanel } from '../DrLabMuAssistantPanel';
import { LabLobbyHub } from '../LabLobbyHub';
import { PreLabBriefingView } from '../PreLabBriefingView';
import { HypothesisNote } from '../ui/HypothesisAndCompareDock';
import { Lab3DSnapshot } from '../ui/ScientificEnhancementSuite';
import {
  ExperimentModule,
  EducationTier,
} from '../../registry/experimentRegistry';
import {
  LAB_MISSIONS_CATALOG,
  evaluateLabMissionProgress,
} from '../../registry/missionRegistry';
import { SpatialCursorPayload, ParameterLockPayload } from '../../utils/collabProtocol';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
} from '../../utils/mysteryChallengeEngine';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { BottomNavigationBar } from './BottomNavigationBar';
import { LabControlDock } from '../ui/LabControlDock';
import { labSound } from '../../utils/soundEngine';

const PhysicsLabView = lazy(() =>
  import('../PhysicsLabView').then((m) => ({ default: m.PhysicsLabView }))
);
const ChemistryLabView = lazy(() =>
  import('../ChemistryLabView').then((m) => ({ default: m.ChemistryLabView }))
);
const BiologyLabView = lazy(() =>
  import('../BiologyLabView').then((m) => ({ default: m.BiologyLabView }))
);
const AstronomyLabView = lazy(() =>
  import('../AstronomyLabView').then((m) => ({ default: m.AstronomyLabView }))
);
const TeacherDashboardView = lazy(() =>
  import('../TeacherDashboardView').then((m) => ({ default: m.TeacherDashboardView }))
);

function LabLoadingSkeleton() {
  return (
    <div className="w-full h-[540px] flex flex-col items-center justify-center bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 animate-spin">
        <Loader2 className="w-6 h-6" />
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-bold text-white">Memuat Lingkungan Laboratorium 3D...</div>
        <div className="text-xs text-slate-400">Menyiapkan mesin sains & shader WebGL</div>
      </div>
    </div>
  );
}

export interface MainLabWorkspaceProps {
  experimentModule: ExperimentModule;
  activeScienceDomain: ScienceDomain;
  currentProfile: { name: string; group: string };
  records: ExperimentRecord[];
  tasks: GroupTaskItem[];
  notes: CollabNoteItem[];
  students: StudentProgressItem[];
  notifications: LabNotification[];
  capturedSnapshots: Lab3DSnapshot[];
  completedChallengeIds: string[];
  currentModuleHypothesis: HypothesisNote;
  physicsParams: PhysicsParams;
  chemistryParams: ChemistryParams;
  biologyContext: BiologyTelemetryContext;
  astronomyParams: AstronomyParams;
  selectedBioModuleId: string;
  activeMysteryChallenge: MysterySampleChallenge | null;
  remoteCursors: Record<string, SpatialCursorPayload>;
  paramLocks: Record<string, ParameterLockPayload>;
  emitCursor3D: (pos: [number, number, number], normal?: [number, number, number], hoveredObject?: string) => void;
  acquireParamLock: (paramKey: string) => void;
  releaseParamLock: (paramKey: string) => void;
  onDeleteRecord: (id: string) => void;
  onExportCSV: () => void;
  onSubmitQuizScore: (score: number, correctCount: number) => void;
  onRecordExperiment: (
    domain: ScienceDomain,
    title: string,
    paramsSummary: string,
    keyMetrics: Record<string, number | string>,
    noteText: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup: (domain: ScienceDomain, summary: string) => void;
  onCapture3DSnapshot: (domain: ScienceDomain, dataUrl: string, modTitle: string, pSum: string, pMetric: string) => void;
  onCompleteChallenge: (id: string) => void;
  onSubmitMysteryExam: (studentName: string, result: MysterySubmissionResult, title: string) => void;
  onUpdateCurrentHypothesis: (note: HypothesisNote) => void;
  onChangePhysicsParams: (params: PhysicsParams) => void;
  onChangeChemistryParams: (params: ChemistryParams) => void;
  onChangeBiologyContext: (ctx: BiologyTelemetryContext) => void;
  onChangeAstronomyParams: React.Dispatch<React.SetStateAction<AstronomyParams>>;
  onSelectBioModuleId: (id: string) => void;
  onToggleTask: (taskId: string) => void;
  onCreateTask: (title: string, domain: ScienceDomain) => void;
  onCreateNote: (text: string) => void;
  onDeleteSnapshot: (id: string) => void;
  onReplayRecord: (rec: ExperimentRecord) => void;
  onSelectCatalogModule: (mod: ExperimentModule) => void;
  onInjectOutlierDemo: () => void;
  externalDrLabMuPrompt: { id: number; prompt: string } | null;
  hasLowR2Alert: boolean;
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

export const MainLabWorkspace: React.FC<MainLabWorkspaceProps> = ({
  experimentModule,
  activeScienceDomain,
  currentProfile,
  records,
  tasks,
  notes,
  students,
  notifications,
  capturedSnapshots,
  completedChallengeIds,
  currentModuleHypothesis,
  physicsParams,
  chemistryParams,
  biologyContext,
  astronomyParams,
  selectedBioModuleId,
  activeMysteryChallenge,
  remoteCursors,
  paramLocks,
  emitCursor3D,
  acquireParamLock,
  releaseParamLock,
  onDeleteRecord,
  onExportCSV,
  onSubmitQuizScore,
  onRecordExperiment,
  onPushNotification,
  onSyncWithGroup,
  onCapture3DSnapshot,
  onCompleteChallenge,
  onSubmitMysteryExam,
  onUpdateCurrentHypothesis,
  onChangePhysicsParams,
  onChangeChemistryParams,
  onChangeBiologyContext,
  onChangeAstronomyParams,
  onSelectBioModuleId,
  onToggleTask,
  onCreateTask,
  onCreateNote,
  onDeleteSnapshot,
  onReplayRecord,
  onSelectCatalogModule,
  onInjectOutlierDemo,
  externalDrLabMuPrompt,
  hasLowR2Alert,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleTeacherFreeze,
}) => {
  const {
    activeDomain,
    workflowStep,
    setWorkflowStep,
    userRole,
    isLobbyMode,
    setIsLobbyMode,
    academicLevel,
    setAcademicLevel,
  } = useLabStore();

  const {
    zenMode,
    drawerOpen,
    setDrawerOpen,
    activeDrawerTab,
    setDrawerTab,
  } = useUIStore();

  const {
    wsConnected,
    activeRoomId,
    roomPin,
    isFrozenByTeacher,
    teacherName,
    roomMembers,
    studentTelemetryMap,
    openRoomModal,
  } = useCollabStore();

  const activeTierLabel: EducationTier =
    academicLevel === 'smp'
      ? 'SMP'
      : academicLevel === 'mahasiswa'
      ? 'Mahasiswa'
      : 'SMA';

  // Mission Engine State (Fitur 3)
  const domainMissions = useMemo(
    () => LAB_MISSIONS_CATALOG.filter((m) => m.domain === activeDomain),
    [activeDomain]
  );
  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    domainMissions[0]?.id || LAB_MISSIONS_CATALOG[0].id
  );
  const [claimedBadges, setClaimedBadges] = useState<string[]>([]);

  useEffect(() => {
    if (domainMissions.length > 0 && !domainMissions.some((m) => m.id === selectedMissionId)) {
      setSelectedMissionId(domainMissions[0].id);
    }
  }, [domainMissions, selectedMissionId]);

  const activeMission = useMemo(
    () =>
      domainMissions.find((m) => m.id === selectedMissionId) ||
      domainMissions[0] ||
      LAB_MISSIONS_CATALOG[0],
    [domainMissions, selectedMissionId]
  );

  const missionProgress = useMemo(() => {
    const pMetrics = calculatePhysicsMetrics(physicsParams);
    const cMetrics = calculateChemistryMetrics(chemistryParams);
    const aMetrics = calculateAstronomyMetrics(astronomyParams);
    return evaluateLabMissionProgress(
      activeMission,
      physicsParams,
      pMetrics,
      chemistryParams,
      cMetrics,
      biologyContext,
      astronomyParams,
      aMetrics
    );
  }, [activeMission, physicsParams, chemistryParams, biologyContext, astronomyParams]);

  // Auto-award mission badge when target condition is achieved
  useEffect(() => {
    if (
      missionProgress.isCompleted &&
      !claimedBadges.includes(activeMission.id) &&
      !completedChallengeIds.includes(activeMission.id)
    ) {
      setClaimedBadges((prev) => [...prev, activeMission.id]);
      onCompleteChallenge(activeMission.id);
      labSound.playRecordSuccess();
      onPushNotification({
        id: `notif-mission-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        severity: 'nominal',
        domain: activeScienceDomain,
        title: `Misi Praktikum Tuntas: ${activeMission.title}`,
        message: `Selamat! Anda meraih lencana ${activeMission.rewardBadge} dengan galat ${missionProgress.errorPct}%.`,
      });
    }
  }, [
    missionProgress.isCompleted,
    missionProgress.errorPct,
    activeMission,
    claimedBadges,
    completedChallengeIds,
    onCompleteChallenge,
    onPushNotification,
    activeScienceDomain,
  ]);

  const liveStudentTelemetries = useMemo(
    () => Object.values(studentTelemetryMap),
    [studentTelemetryMap]
  );

  return (
    <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[var(--comfort-bg)] text-[var(--comfort-text)] transition-colors duration-200">
      {/* FLOATING TEACHER CONTROL BAR & ROOM MONITOR (FITUR 1) */}
      {userRole === 'pengajar' && (
        <div className="shrink-0 bg-slate-900/95 border-b border-amber-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-mono font-bold text-amber-300">
              <Users className="w-3.5 h-3.5" />
              {activeRoomId
                ? `MEJA AKTIF: ${activeRoomId} (PIN: ${roomPin || '1234'}) · ${roomMembers.length} Peserta`
                : 'MODE GURU: Belum Membuka Room PIN'}
            </span>

            {liveStudentTelemetries.length > 0 && (
              <div className="hidden xl:flex items-center gap-2 text-xs text-slate-300 font-mono">
                <span className="text-slate-500">Live Telemetri Siswa:</span>
                {liveStudentTelemetries.slice(0, 3).map((st) => (
                  <span
                    key={st.studentName}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-300"
                  >
                    {st.studentName}: {st.moduleTitle} ({st.recordsCount} data)
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!activeRoomId && (
              <button
                type="button"
                onClick={() => openRoomModal('create')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                + Buat Meja Praktikum Ber-PIN
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                labSound.playClick(540);
                if (onToggleTeacherFreeze) {
                  onToggleTeacherFreeze(!isFrozenByTeacher);
                } else {
                  useCollabStore.getState().setTeacherFreeze(!isFrozenByTeacher, currentProfile.name);
                }
              }}
              className={`px-4 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                isFrozenByTeacher
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {isFrozenByTeacher ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>
                {isFrozenByTeacher
                  ? 'Buka Kunci Layar Murid (Unfreeze)'
                  : 'Kunci Layar Murid (Freeze Inputs)'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STUDENT SCREEN FREEZE OVERLAY WHEN LOCKED BY TEACHER (FITUR 1) */}
      {userRole === 'siswa' && isFrozenByTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border-2 border-amber-500/80 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                KONTROL INTERAKTIF DIKUNCI GURU
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Perhatian ke Penjelasan {teacherName || 'Guru Pengampu'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Seluruh slider dan kontrol eksperimen di meja praktikum{' '}
              <span className="font-mono font-bold text-sky-400">{activeRoomId || 'Kelas'}</span>{' '}
              sedang dibekukan sementara saat pengajar memberikan arahan konsep sains.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => useCollabStore.getState().setTeacherFreeze(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer"
              >
                Mode Mandiri: Lepas Kunci Lokal
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<LabLoadingSkeleton />}>
        {/* VIEW 1: Teacher Dashboard */}
        {userRole === 'pengajar' && !isLobbyMode && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <TeacherDashboardView
              students={students}
              records={records}
              onSendTeacherFeedback={(targetStudentId, message) => {
                onPushNotification({
                  id: `notif-fb-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  severity: 'nominal',
                  domain: 'Pengajar',
                  title: 'Umpan Balik Pengajar Dikirim',
                  message: `Pesan untuk siswa (${targetStudentId}): "${message}"`,
                });
              }}
              onExportGradesNotification={(count) => {
                onPushNotification({
                  id: `notif-grades-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  severity: 'nominal',
                  domain: 'Pengajar',
                  title: 'Rekap Nilai Siswa Diekspor',
                  message: `Nilai ${count} siswa berhasil diekspor ke format laporan resmi.`,
                });
              }}
              activeMysteryChallenge={activeMysteryChallenge}
              onBroadcastMysteryChallenge={(challenge) => {
                onPushNotification({
                  id: `notif-myst-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  severity: 'nominal',
                  domain: 'Pengajar',
                  title: 'Tantangan Sampel Misteri Disebarkan',
                  message: `Tantangan "${challenge.title}" telah disiarkan ke seluruh kelompok praktikan.`,
                });
              }}
            />
          </div>
        )}

        {/* VIEW 2: Experiment Lobby Hub */}
        {isLobbyMode && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <LabLobbyHub
              activeTier={activeTierLabel}
              studentName={currentProfile.name}
              studentGroup={currentProfile.group}
              completedModuleIds={completedChallengeIds}
              recordsCount={records.length}
              onTierChange={(tier) => {
                setAcademicLevel(tier.toLowerCase() as AcademicLevel);
              }}
              onSelectExperiment={(exp) => {
                onSelectCatalogModule(exp);
                setIsLobbyMode(false);
                setWorkflowStep(1);
              }}
              onCreateRoom={onCreateRoom}
              onJoinRoom={onJoinRoom}
              onLeaveRoom={onLeaveRoom}
              onToggleTeacherFreeze={onToggleTeacherFreeze}
            />
          </div>
        )}

        {/* VIEW 3: Student Workflow Stage 1 (K3 & Pre-Lab Briefing) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 1 && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <PreLabBriefingView
              experiment={experimentModule}
              activeTier={activeTierLabel}
              onProceedToSimulation={() => setWorkflowStep(2)}
              onBackToLobby={() => setIsLobbyMode(true)}
              hypothesisNote={currentModuleHypothesis}
              onChangeHypothesisNote={onUpdateCurrentHypothesis}
            />
          </div>
        )}

        {/* VIEW 4: Student Workflow Stage 2 (3D Simulation Cockpit & Docking Split-View) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 2 && (
          <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
            {/* MISSION PROGRESS BAR ABOVE 3D CANVAS (FITUR 3) */}
            <div className="shrink-0 max-w-[1600px] w-full mx-auto px-4 pt-2.5">
              <div className="rounded-xl bg-slate-900/95 border border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-400 shrink-0">
                    <Target className="w-4 h-4" />
                    <span>Misi Praktikum:</span>
                  </div>
                  <select
                    aria-label="Pilih Misi Praktikum"
                    value={activeMission.id}
                    onChange={(e) => {
                      labSound.playClick();
                      setSelectedMissionId(e.target.value);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white cursor-pointer"
                  >
                    {domainMissions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.targetCondition.metricLabel}: {m.targetCondition.targetVal}{' '}
                        {m.targetCondition.unit})
                      </option>
                    ))}
                  </select>
                  <span className="hidden xl:inline text-[11px] text-slate-400 truncate max-w-md">
                    {activeMission.storyline}
                  </span>
                </div>

                {/* Live Progress Bar & Badge Status */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">{activeMission.targetCondition.metricLabel}:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        missionProgress.isCompleted ? 'text-emerald-400' : 'text-sky-400'
                      }`}
                    >
                      {missionProgress.currentValue} {activeMission.targetCondition.unit}
                    </span>
                    <span className="text-slate-500">
                      (Target {activeMission.targetCondition.minVal}–{activeMission.targetCondition.maxVal})
                    </span>
                  </div>

                  <div className="w-28 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        missionProgress.isCompleted ? 'bg-emerald-400' : 'bg-sky-500'
                      }`}
                      style={{ width: `${missionProgress.progressPct}%` }}
                    />
                  </div>

                  {missionProgress.isCompleted || completedChallengeIds.includes(activeMission.id) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{activeMission.rewardBadge}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-400">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      <span>Galat: {missionProgress.errorPct}%</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 relative overflow-y-auto">
              {activeDomain === 'physics' && (
                <PhysicsLabView
                  params={physicsParams}
                  onChangeParams={onChangePhysicsParams}
                  academicLevel={academicLevel}
                  records={records}
                  activeStudentName={currentProfile.name}
                  activeGroupId={currentProfile.group}
                  onDeleteRecord={onDeleteRecord}
                  onExportCSV={onExportCSV}
                  onSubmitQuizScore={onSubmitQuizScore}
                  onProceedToAnalysis={() => setWorkflowStep(3)}
                  onBackToCatalog={() => setIsLobbyMode(true)}
                  onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
                    onRecordExperiment('Fisika', title, summary, keyMetrics, noteText, numericCoords)
                  }
                  onPushNotification={onPushNotification}
                  onSyncWithGroup={(summary) => onSyncWithGroup('Fisika', summary)}
                  remoteCursors={remoteCursors}
                  onEmitCursor={emitCursor3D}
                  paramLocks={paramLocks}
                  onAcquireLock={acquireParamLock}
                  onReleaseLock={releaseParamLock}
                  activeMysteryChallenge={activeMysteryChallenge}
                  onSubmitMysteryExam={onSubmitMysteryExam}
                  hypothesisNote={currentModuleHypothesis}
                  onChangeHypothesisNote={onUpdateCurrentHypothesis}
                  zenMode={zenMode}
                  snapshotCount={capturedSnapshots.length}
                  onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                    onCapture3DSnapshot('Fisika', dataUrl, modTitle, pSum, pMetric)
                  }
                  completedChallengeIds={completedChallengeIds}
                  onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
                />
              )}

              {activeDomain === 'chemistry' && (
                <ChemistryLabView
                  params={chemistryParams}
                  onChangeParams={onChangeChemistryParams}
                  academicLevel={academicLevel}
                  records={records}
                  activeStudentName={currentProfile.name}
                  activeGroupId={currentProfile.group}
                  onDeleteRecord={onDeleteRecord}
                  onExportCSV={onExportCSV}
                  onSubmitQuizScore={onSubmitQuizScore}
                  onProceedToAnalysis={() => setWorkflowStep(3)}
                  onBackToCatalog={() => setIsLobbyMode(true)}
                  onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
                    onRecordExperiment('Kimia', title, summary, keyMetrics, noteText, numericCoords)
                  }
                  onPushNotification={onPushNotification}
                  onSyncWithGroup={(summary) => onSyncWithGroup('Kimia', summary)}
                  remoteCursors={remoteCursors}
                  onEmitCursor={emitCursor3D}
                  activeMysteryChallenge={activeMysteryChallenge}
                  onSubmitMysteryExam={onSubmitMysteryExam}
                  hypothesisNote={currentModuleHypothesis}
                  onChangeHypothesisNote={onUpdateCurrentHypothesis}
                  zenMode={zenMode}
                  snapshotCount={capturedSnapshots.length}
                  onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                    onCapture3DSnapshot('Kimia', dataUrl, modTitle, pSum, pMetric)
                  }
                  completedChallengeIds={completedChallengeIds}
                  onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
                />
              )}

              {activeDomain === 'biology' && (
                <BiologyLabView
                  activeStudentName={currentProfile.name}
                  activeGroupId={currentProfile.group}
                  activeTier={activeTierLabel}
                  selectedModuleId={selectedBioModuleId}
                  onSelectModuleId={onSelectBioModuleId}
                  records={records}
                  onDeleteRecord={onDeleteRecord}
                  onExportCSV={onExportCSV}
                  onSubmitQuizScore={onSubmitQuizScore}
                  onProceedToAnalysis={() => setWorkflowStep(3)}
                  onBackToCatalog={() => setIsLobbyMode(true)}
                  onBiologyContextChange={onChangeBiologyContext}
                  onRecordExperiment={(_d, title, summary, keyMetrics, noteText, numericCoords) =>
                    onRecordExperiment('Biologi', title, summary, keyMetrics, noteText, numericCoords)
                  }
                  remoteCursors={remoteCursors}
                  onEmitCursor={emitCursor3D}
                  paramLocks={paramLocks}
                  onAcquireLock={acquireParamLock}
                  onReleaseLock={releaseParamLock}
                  onTierChange={(newTier) => {
                    setAcademicLevel(newTier.toLowerCase() as AcademicLevel);
                  }}
                  hypothesisNote={currentModuleHypothesis}
                  onChangeHypothesisNote={onUpdateCurrentHypothesis}
                  zenMode={zenMode}
                  snapshotCount={capturedSnapshots.length}
                  onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                    onCapture3DSnapshot('Biologi', dataUrl, modTitle, pSum, pMetric)
                  }
                  completedChallengeIds={completedChallengeIds}
                  onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
                />
              )}

              {activeDomain === 'astronomy' && (
                <AstronomyLabView
                  params={astronomyParams}
                  onChangeParams={onChangeAstronomyParams}
                  academicLevel={academicLevel}
                  records={records}
                  activeStudentName={currentProfile.name}
                  activeGroupId={currentProfile.group}
                  onDeleteRecord={onDeleteRecord}
                  onExportCSV={onExportCSV}
                  onSubmitQuizScore={onSubmitQuizScore}
                  onProceedToAnalysis={() => setWorkflowStep(3)}
                  onBackToCatalog={() => setIsLobbyMode(true)}
                  onRecordExperiment={(title, summary, keyMetrics, noteText, numericCoords) =>
                    onRecordExperiment('Astronomi', title, summary, keyMetrics, noteText, numericCoords)
                  }
                  onPushNotification={onPushNotification}
                  onSyncWithGroup={(summary) => onSyncWithGroup('Astronomi', summary)}
                  remoteCursors={remoteCursors}
                  onEmitCursor={emitCursor3D}
                  activeMysteryChallenge={activeMysteryChallenge}
                  onSubmitMysteryExam={onSubmitMysteryExam}
                  hypothesisNote={currentModuleHypothesis}
                  onChangeHypothesisNote={onUpdateCurrentHypothesis}
                  zenMode={zenMode}
                  snapshotCount={capturedSnapshots.length}
                  onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                    onCapture3DSnapshot('Astronomi', dataUrl, modTitle, pSum, pMetric)
                  }
                  completedChallengeIds={completedChallengeIds}
                  onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
                />
              )}
            </div>

            {/* Mobile Bottom Navigation Bar (<1024px) */}
            <BottomNavigationBar recordsCount={records.length} hasLowR2Alert={hasLowR2Alert} />
          </div>
        )}

        {/* VIEW 5: Student Workflow Stage 3 (Analytics, OLS Regression, LKS) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 3 && (
          <div className="flex-1 overflow-y-auto max-w-[1380px] w-full mx-auto px-4 py-6">
            <AnalyticsAndWorksheetPanel
              records={records}
              activeStudentName={currentProfile.name}
              activeGroupId={currentProfile.group}
              onSubmitQuizScore={onSubmitQuizScore}
              onBackToLab={() => setWorkflowStep(2)}
              onProceedToReport={() => setWorkflowStep(4)}
              onExportChartNotification={(fmt: 'PNG' | 'PDF') =>
                onPushNotification({
                  id: `notif-exp-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Kolaborasi',
                  title: `Ekspor Grafik & Laporan (${fmt}) Selesai`,
                  message: `Grafik regresi multi-sumbu dan hasil analisis telah diekspor ke ${fmt}.`,
                })
              }
            />
          </div>
        )}

        {/* VIEW 6: Student Workflow Stage 4 (Collaboration, Report & Group Tasks) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 4 && (
          <div className="flex-1 overflow-y-auto max-w-[1380px] w-full mx-auto px-4 py-6">
            <CollaborationAndDataSection
              records={records}
              tasks={tasks}
              notes={notes}
              activeGroupId={currentProfile.group}
              activeStudentName={currentProfile.name}
              onDeleteRecord={onDeleteRecord}
              onToggleTask={onToggleTask}
              onCreateTask={onCreateTask}
              onCreateNote={onCreateNote}
              onBackToAnalysis={() => setWorkflowStep(3)}
              onBackToCatalog={() => setIsLobbyMode(true)}
              hypothesisNote={currentModuleHypothesis}
              onChangeHypothesisNote={onUpdateCurrentHypothesis}
              snapshots3D={capturedSnapshots}
              onDeleteSnapshot={onDeleteSnapshot}
              onReplayRecord={onReplayRecord}
              students={students}
              onCSVExported={(count) =>
                onPushNotification({
                  id: `notif-csv-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Kolaborasi',
                  title: 'Berkas CSV Kelompok Diunduh',
                  message: `${count} baris data eksperimen siap diolah di spreadsheet.`,
                })
              }
            />
          </div>
        )}
      </Suspense>

      {/* Unified Floating Action Dock (Bottom-Center) */}
      <LabControlDock
        notificationsCount={notifications.length}
        hasLowR2Alert={hasLowR2Alert}
        snapshotCount={capturedSnapshots.length}
      />

      {/* Socratic Dr. LabMu Slide-Over Drawer & Notification Center */}
      <DrLabMuAssistantPanel
        domain={activeScienceDomain}
        academicLevel={academicLevel}
        physicsParams={physicsParams}
        chemistryParams={chemistryParams}
        astronomyParams={astronomyParams}
        biologyContext={biologyContext}
        records={records}
        notifications={notifications}
        isOpen={drawerOpen}
        activeTab={activeDrawerTab === 'ai' ? 'dr-labmu' : 'notifications'}
        onOpenChange={setDrawerOpen}
        onTabChange={(tab) => setDrawerTab(tab === 'dr-labmu' ? 'ai' : 'analytics')}
        onInjectOutlierDemo={onInjectOutlierDemo}
        externalPromptRequest={externalDrLabMuPrompt}
        wsConnected={wsConnected}
      />
    </main>
  );
};

