import React, { Suspense, useState, useMemo, useEffect } from 'react';
import { Loader2, Lock, Video } from 'lucide-react';
import {
  ScienceDomain,
  AcademicLevel,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  BiologyTelemetryContext,
  ExperimentRecord,
  LabNotification,
} from '../../utils/scienceEngine';
import type {
  GroupTaskItem,
  CollabNoteItem,
} from '../CollaborationAndDataSection';
import type { StudentProgressItem } from '../TeacherDashboardView';
import { LabLobbyHub } from '../LabLobbyHub';
import type { HypothesisNote } from '../ui/HypothesisAndCompareDock';
import type { Lab3DSnapshot } from '../ui/ScientificEnhancementSuite';
import {
  ExperimentModule,
  EducationTier,
  getExperimentById,
} from '../../registry/experimentRegistry';
import { SpatialCursorPayload, ParameterLockPayload } from '../../utils/collabProtocol';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
} from '../../utils/mysteryChallengeEngine';
import { MysteryChallengeModal } from '../exam/MysteryChallengeModal';
import { MysteryChallengeCockpitBanner } from '../exam/MysteryChallengeCockpitBanner';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { BottomNavigationBar } from './BottomNavigationBar';
import { LabControlDock } from '../ui/LabControlDock';
import { TeacherControlBar } from './TeacherControlBar';
import { useWorkspaceMissions } from '../../hooks/useWorkspaceMissions';
import { labSound } from '../../utils/soundEngine';
import { normalizeEducationLevel } from '../../utils/pedagogicalHelpers';

const AnalyticsAndWorksheetPanel = React.lazy(() =>
  import('../AnalyticsAndWorksheetPanel').then((m) => ({ default: m.AnalyticsAndWorksheetPanel }))
);
const CollaborationAndDataSection = React.lazy(() =>
  import('../CollaborationAndDataSection').then((m) => ({ default: m.CollaborationAndDataSection }))
);
const DrLabMuAssistantPanel = React.lazy(() =>
  import('../DrLabMuAssistantPanel').then((m) => ({ default: m.DrLabMuAssistantPanel }))
);
const PreLabBriefingView = React.lazy(() =>
  import('../PreLabBriefingView').then((m) => ({ default: m.PreLabBriefingView }))
);
const AICustomMissionBuilderModal = React.lazy(
  () => import('../teacher/AICustomMissionBuilderModal')
);
const PhysicsLabView = React.lazy(() =>
  import('../PhysicsLabView').then((m) => ({ default: m.PhysicsLabView }))
);
const ChemistryLabView = React.lazy(() =>
  import('../ChemistryLabView').then((m) => ({ default: m.ChemistryLabView }))
);
const BiologyLabView = React.lazy(() =>
  import('../BiologyLabView').then((m) => ({ default: m.BiologyLabView }))
);
const AstronomyLabView = React.lazy(() =>
  import('../AstronomyLabView').then((m) => ({ default: m.AstronomyLabView }))
);
const TeacherDashboardView = React.lazy(() =>
  import('../TeacherDashboardView').then((m) => ({ default: m.TeacherDashboardView }))
);

function LabLoadingSkeleton() {
  return (
    <div className="w-full h-[540px] flex flex-col items-center justify-center bg-[var(--comfort-surface)] text-[var(--comfort-text)] rounded-2xl border border-[var(--comfort-border)] p-8 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 animate-spin">
        <Loader2 className="w-6 h-6" />
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-bold">Memuat Lingkungan Laboratorium 3D...</div>
        <div className="text-xs opacity-75">Menyiapkan mesin sains & shader WebGL</div>
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
  mysterySubmissions?: MysterySubmissionResult[];
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
  onBroadcastTeacherFeedback?: (targetStudentId: string, message: string, author: string) => void;
  onBroadcastMysteryChallenge?: (challenge: MysterySampleChallenge, author: string) => void;
  onActivateMysteryChallenge?: (challenge: MysterySampleChallenge) => void;
  onDismissMysteryChallenge?: () => void;
  onSelectCatalogModule: (mod: ExperimentModule) => void;
  onInjectOutlierDemo: () => void;
  externalDrLabMuPrompt: { id: number; prompt: string } | null;
  hasLowR2Alert: boolean;
  onCreateRoom?: (
    pin: string,
    domain: 'physics' | 'chemistry' | 'biology' | 'astronomy',
    moduleId: string,
    customRoomId?: string
  ) => Promise<string | null> | void;
  onJoinRoom?: (roomId: string, pin: string, joinAsRole?: 'teacher' | 'student') => void;
  onLeaveRoom?: () => void;
  onToggleTeacherFreeze?: (isFrozen: boolean) => void;
  onRotateGroup?: (nextStudentName: string, nextGroupId: string) => void;
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
  mysterySubmissions = [],
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
  onBroadcastTeacherFeedback,
  onBroadcastMysteryChallenge,
  onActivateMysteryChallenge,
  onDismissMysteryChallenge,
  onSelectCatalogModule,
  onInjectOutlierDemo,
  externalDrLabMuPrompt,
  hasLowR2Alert,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleTeacherFreeze,
  onRotateGroup,
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
  } = useLabStore(
    useShallow((s) => ({
      activeDomain: s.activeDomain,
      workflowStep: s.workflowStep,
      setWorkflowStep: s.setWorkflowStep,
      userRole: s.userRole,
      isLobbyMode: s.isLobbyMode,
      setIsLobbyMode: s.setIsLobbyMode,
      academicLevel: s.academicLevel,
      setAcademicLevel: s.setAcademicLevel,
    }))
  );
  const [isMysteryModalOpen, setIsMysteryModalOpen] = useState(false);

  const {
    zenMode,
    drawerOpen,
    setDrawerOpen,
    activeDrawerTab,
    setDrawerTab,
    activeModal,
    openModal,
    closeModal,
  } = useUIStore(
    useShallow((s) => ({
      zenMode: s.zenMode,
      drawerOpen: s.drawerOpen,
      setDrawerOpen: s.setDrawerOpen,
      activeDrawerTab: s.activeDrawerTab,
      setDrawerTab: s.setDrawerTab,
      activeModal: s.activeModal,
      openModal: s.openModal,
      closeModal: s.closeModal,
    }))
  );

  const [queuedDrLabMuPrompt, setQueuedDrLabMuPrompt] = useState<{ id: number; prompt: string } | null>(
    externalDrLabMuPrompt
  );
  const [pip3DMode, setPip3DMode] = useState<'pip' | 'split' | 'minimized'>('pip');
  const [teacherViewMode, setTeacherViewMode] = useState<'dashboard' | 'lab3d'>('dashboard');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    return () => clearTimeout(t);
  }, [workflowStep, pip3DMode, teacherViewMode]);

  useEffect(() => {
    if (externalDrLabMuPrompt) {
      setQueuedDrLabMuPrompt(externalDrLabMuPrompt);
    }
  }, [externalDrLabMuPrompt]);

  const {
    wsConnected,
    activeRoomId,
    roomPin,
    isFrozenByTeacher,
    teacherName,
    roomMembers,
    studentTelemetryMap,
    openRoomModal,
    teacherLaserActive,
    setTeacherLaserActive,
    teacherCameraSyncEnabled,
    setTeacherCameraSyncEnabled,
    remoteTeacherLaser,
    remoteTeacherCameraSync,
    followTeacherCamera,
    setFollowTeacherCamera,
  } = useCollabStore(
    useShallow((s) => ({
      wsConnected: s.wsConnected,
      activeRoomId: s.activeRoomId,
      roomPin: s.roomPin,
      isFrozenByTeacher: s.isFrozenByTeacher,
      teacherName: s.teacherName,
      roomMembers: s.roomMembers,
      studentTelemetryMap: s.studentTelemetryMap,
      openRoomModal: s.openRoomModal,
      teacherLaserActive: s.teacherLaserActive,
      setTeacherLaserActive: s.setTeacherLaserActive,
      teacherCameraSyncEnabled: s.teacherCameraSyncEnabled,
      setTeacherCameraSyncEnabled: s.setTeacherCameraSyncEnabled,
      remoteTeacherLaser: s.remoteTeacherLaser,
      remoteTeacherCameraSync: s.remoteTeacherCameraSync,
      followTeacherCamera: s.followTeacherCamera,
      setFollowTeacherCamera: s.setFollowTeacherCamera,
    }))
  );

  const activeTierLabel: EducationTier =
    academicLevel === 'smp'
      ? 'SMP'
      : academicLevel === 'mahasiswa'
      ? 'Mahasiswa'
      : 'SMA';

  // Mission Engine State & 3T LAN Hotspot Info (extracted to useWorkspaceMissions)
  const {
    domainMissions,
    selectedMissionId,
    setSelectedMissionId,
    activeMission,
    missionProgress,
    lanInfo,
  } = useWorkspaceMissions({
    activeDomain,
    activeScienceDomain,
    physicsParams,
    chemistryParams,
    biologyContext,
    astronomyParams,
    completedChallengeIds,
    onCompleteChallenge,
    onPushNotification,
  });

  const liveStudentTelemetries = useMemo(
    () => Object.values(studentTelemetryMap),
    [studentTelemetryMap]
  );

  return (
    <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[var(--comfort-bg)] text-[var(--comfort-text)] transition-colors duration-200">
      {/* FLOATING TEACHER CONTROL BAR & ROOM MONITOR (FITUR 1) */}
      {userRole === 'pengajar' && (
        <TeacherControlBar
          activeRoomId={activeRoomId}
          roomPin={roomPin}
          roomMembersCount={Object.keys(roomMembers).length}
          lanInfo={lanInfo}
          liveStudentTelemetries={liveStudentTelemetries}
          isLobbyMode={isLobbyMode}
          setIsLobbyMode={setIsLobbyMode}
          teacherViewMode={teacherViewMode}
          setTeacherViewMode={setTeacherViewMode}
          teacherLaserActive={teacherLaserActive}
          setTeacherLaserActive={setTeacherLaserActive}
          teacherCameraSyncEnabled={teacherCameraSyncEnabled}
          setTeacherCameraSyncEnabled={setTeacherCameraSyncEnabled}
          isFrozenByTeacher={isFrozenByTeacher}
          currentProfileName={currentProfile.name}
          onOpenAiMissionBuilder={() => openModal('ai-mission-builder')}
          onOpenCreateRoom={() => openRoomModal('create')}
          onToggleTeacherFreeze={onToggleTeacherFreeze}
        />
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
        {userRole === 'pengajar' && teacherViewMode === 'dashboard' && !isLobbyMode && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <TeacherDashboardView
              students={students}
              records={records}
              mysterySubmissions={mysterySubmissions}
              onSendTeacherFeedback={(targetStudentId, message) => {
                onBroadcastTeacherFeedback?.(targetStudentId, message, currentProfile.name);
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
                onBroadcastMysteryChallenge?.(challenge, currentProfile.name);
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
                if (userRole === 'pengajar') {
                  setTeacherViewMode('lab3d');
                  setWorkflowStep(2);
                } else {
                  setWorkflowStep(1);
                }
              }}
              onCreateRoom={onCreateRoom}
              onJoinRoom={onJoinRoom}
              onLeaveRoom={onLeaveRoom}
              onToggleTeacherFreeze={onToggleTeacherFreeze}
              onOpenMysteryExam={() => setIsMysteryModalOpen(true)}
            />
          </div>
        )}

        {/* VIEW 3: Student Workflow Stage 1 (K3 & Pre-Lab Briefing) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 1 && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <PreLabBriefingView
              experiment={experimentModule}
              activeTier={activeTierLabel}
              studentName={currentProfile.name}
              studentGroup={currentProfile.group}
              onProceedToSimulation={() => setWorkflowStep(2)}
              onBackToLobby={() => setIsLobbyMode(true)}
              hypothesisNote={currentModuleHypothesis}
              onChangeHypothesisNote={onUpdateCurrentHypothesis}
            />
          </div>
        )}

        {/* VIEW 4, 5 & 6: Student Workflow Stages 2 (3D Cockpit), 3 (Grafik & LKS), and 4 (Laporan) OR Teacher Live 3D Demo Cockpit */}
        {!isLobbyMode &&
          ((userRole === 'siswa' && (workflowStep === 2 || workflowStep === 3 || workflowStep === 4)) ||
            (userRole === 'pengajar' && teacherViewMode === 'lab3d')) && (() => {
          const isTeacherLabDemo = userRole === 'pengajar' && teacherViewMode === 'lab3d';
          const effectiveStep = isTeacherLabDemo ? 2 : workflowStep;
          return (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden h-full w-full relative">
            {/* Student Live Teacher Laser / Camera Follow Status Pill */}
            {userRole === 'siswa' && (remoteTeacherCameraSync?.enabled || remoteTeacherLaser?.active) && (
              <div
                data-testid="student-follow-teacher-cam-pill"
                className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-indigo-400/60 text-xs text-slate-100 shadow-xl"
              >
                {remoteTeacherLaser?.active && (
                  <span className="inline-flex items-center gap-1.5 text-rose-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>
                      Laser {remoteTeacherLaser.teacherName}: {remoteTeacherLaser.hoveredObject || 'Aparatus 3D'}
                    </span>
                  </span>
                )}
                {remoteTeacherCameraSync?.enabled && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-indigo-300 font-semibold">
                      <Video className="w-3.5 h-3.5" />
                      <span>
                        {followTeacherCamera ? 'Mengikuti Kamera Guru' : 'Kamera Guru Aktif (Dijeda)'}
                      </span>
                    </span>
                    <button
                      type="button"
                      data-testid="student-follow-teacher-cam-btn"
                      onClick={() => setFollowTeacherCamera(!followTeacherCamera)}
                      className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
                    >
                      {followTeacherCamera ? 'Lepas' : 'Ikuti Guru'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Persistent 3D Viewport Container (Full Cockpit on Step 2, Split 45% or Floating Mini-3D PiP on Steps 3 & 4) */}
            <div
              data-testid={effectiveStep === 2 ? 'main-3d-cockpit' : 'mini-3d-pip-viewport'}
              data-pip-mode={effectiveStep === 2 ? 'full' : pip3DMode}
              className={
                effectiveStep === 2
                  ? 'flex-1 min-h-0 flex flex-col overflow-hidden relative w-full h-full'
                  : pip3DMode === 'split'
                  ? 'w-full lg:w-[45%] h-[300px] lg:h-full shrink-0 flex flex-col overflow-hidden relative border-b lg:border-b-0 lg:border-r border-[var(--comfort-border)] bg-slate-950'
                  : pip3DMode === 'pip'
                  ? 'fixed bottom-4 right-4 w-[310px] sm:w-[360px] h-[235px] z-30 rounded-2xl border-2 border-sky-500/50 bg-slate-950 shadow-2xl overflow-hidden flex flex-col'
                  : 'fixed bottom-4 right-4 w-auto h-auto z-30 rounded-xl border border-sky-500/40 bg-slate-900/95 shadow-xl overflow-hidden flex flex-col'
              }
            >
              {/* Active Mystery Sample Forensic Exam Banner (All 4 Domains on Step 2) */}
              {effectiveStep === 2 && activeMysteryChallenge && (
                <MysteryChallengeCockpitBanner
                  challenge={activeMysteryChallenge}
                  studentName={currentProfile.name}
                  onSubmitResult={(sName, res, title) => {
                    onSubmitMysteryExam(sName, res, title);
                    if (res.passed) {
                      onCompleteChallenge(activeMysteryChallenge.id);
                    }
                  }}
                  onDismiss={() => onDismissMysteryChallenge?.()}
                  onAskDrLabMu={(prompt) => {
                    setDrawerTab('ai');
                    setDrawerOpen(true);
                    setQueuedDrLabMuPrompt({ id: Date.now(), prompt });
                  }}
                />
              )}

              {/* Mini-3D PiP / Split Control Header Bar when in Step 3 or Step 4 */}
              {effectiveStep !== 2 && (
                <div className="px-3 py-1.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-200 shrink-0 z-20">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="font-mono font-bold text-sky-400 truncate">
                      Live 3D PiP · {experimentModule.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      data-testid="pip-mode-split-btn"
                      onClick={() => {
                        labSound.playClick();
                        setPip3DMode(pip3DMode === 'split' ? 'pip' : 'split');
                        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
                      }}
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer transition-colors ${
                        pip3DMode === 'split'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Alihkan antara Split 45%/55% dan Jendela Melayang Mini-PiP"
                    >
                      {pip3DMode === 'split' ? 'Mini-PiP' : 'Split 45/55'}
                    </button>
                    <button
                      type="button"
                      data-testid="pip-toggle-minimize-btn"
                      onClick={() => {
                        labSound.playClick();
                        setPip3DMode(pip3DMode === 'minimized' ? 'pip' : 'minimized');
                        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] cursor-pointer"
                    >
                      {pip3DMode === 'minimized' ? 'Tampilkan 3D' : 'Kecilkan'}
                    </button>
                    <button
                      type="button"
                      data-testid="pip-return-to-3d-btn"
                      onClick={() => {
                        labSound.playClick();
                        setWorkflowStep(2);
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold cursor-pointer"
                    >
                      Penuh
                    </button>
                  </div>
                </div>
              )}

              {/* 3D Scene Inner Viewport */}
              <div
                className={
                  effectiveStep !== 2 && pip3DMode === 'minimized'
                    ? 'hidden'
                    : 'flex-1 min-h-0 flex overflow-hidden relative w-full h-full'
                }
              >
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
                    zenMode={effectiveStep === 2 ? zenMode : true}
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
                    zenMode={effectiveStep === 2 ? zenMode : true}
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
                      setAcademicLevel(normalizeEducationLevel(newTier));
                    }}
                    hypothesisNote={currentModuleHypothesis}
                    onChangeHypothesisNote={onUpdateCurrentHypothesis}
                    zenMode={effectiveStep === 2 ? zenMode : true}
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
                    zenMode={effectiveStep === 2 ? zenMode : true}
                    snapshotCount={capturedSnapshots.length}
                    onCapture3DSnapshot={(dataUrl, modTitle, pSum, pMetric) =>
                      onCapture3DSnapshot('Astronomi', dataUrl, modTitle, pSum, pMetric)
                    }
                    completedChallengeIds={completedChallengeIds}
                    onCompleteChallenge={(ch) => onCompleteChallenge(ch.id)}
                  />
                )}
              </div>
            </div>

            {/* VIEW 5: Student Workflow Stage 3 (Analytics, OLS Regression, LKS) */}
            {effectiveStep === 3 && (
              <div
                className={`flex-1 overflow-y-auto px-4 py-6 ${
                  pip3DMode === 'split' ? 'lg:w-[55%]' : 'max-w-[1380px] w-full mx-auto'
                }`}
              >
                {records.length < 3 && (
                  <div
                    data-testid="stage3-data-readiness-banner"
                    className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200"
                  >
                    <span>
                      <strong>Tip Analisis:</strong> Saat ini baru{' '}
                      <span className="font-mono font-bold tabular-nums">{records.length}/3</span> titik data pengamatan tercatat. Tambahkan minimal 3 variasi data agar grafik regresi OLS &amp; uji LKS lebih akurat.
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setPip3DMode('split');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-bold text-[11px] cursor-pointer"
                      >
                        Buka Split 3D 45/55
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          setWorkflowStep(2);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Kembali ke Meja 3D
                      </button>
                    </div>
                  </div>
                )}
                <AnalyticsAndWorksheetPanel
                  records={records}
                  activeStudentName={currentProfile.name}
                  activeGroupId={currentProfile.group}
                  onSubmitQuizScore={onSubmitQuizScore}
                  onDeleteRecord={onDeleteRecord}
                  onExportCSV={onExportCSV}
                  onRotateGroup={onRotateGroup}
                  hypothesisNote={currentModuleHypothesis}
                  onChangeHypothesisNote={onUpdateCurrentHypothesis}
                  snapshots3D={capturedSnapshots}
                  moduleId={experimentModule.id}
                  domain={activeScienceDomain}
                  onAskDrLabMu={(prompt) => {
                    setDrawerTab('ai');
                    setDrawerOpen(true);
                    setQueuedDrLabMuPrompt({ id: Date.now(), prompt });
                  }}
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
            {effectiveStep === 4 && (
              <div
                className={`flex-1 overflow-y-auto px-4 py-6 ${
                  pip3DMode === 'split' ? 'lg:w-[55%]' : 'max-w-[1380px] w-full mx-auto'
                }`}
              >
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
                  moduleId={experimentModule.id}
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

            {/* Mobile Bottom Navigation Bar (<1024px) */}
            {effectiveStep === 2 && (
              <BottomNavigationBar recordsCount={records.length} hasLowR2Alert={hasLowR2Alert} />
            )}
          </div>
          );
        })()}
      </Suspense>

      {/* Unified Floating Action Dock (Bottom-Center) */}
      <LabControlDock
        notificationsCount={notifications.length}
        hasLowR2Alert={hasLowR2Alert}
        snapshotCount={capturedSnapshots.length}
        recordsCount={records.length}
      />

      {/* Socratic Dr. LabMu Slide-Over Drawer & Notification Center (Lazy-Loaded) */}
      <Suspense fallback={null}>
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
          externalPromptRequest={queuedDrLabMuPrompt}
          wsConnected={wsConnected}
        />

        {activeModal === 'ai-mission-builder' && (
          <AICustomMissionBuilderModal
            isOpen={activeModal === 'ai-mission-builder'}
            onClose={closeModal}
            teacherName={teacherName || currentProfile.name || 'Dr. Hendra Kusuma'}
            onSelectModule={onSelectCatalogModule}
          />
        )}
      </Suspense>

      <MysteryChallengeModal
        isOpen={isMysteryModalOpen}
        onClose={() => setIsMysteryModalOpen(false)}
        activeChallengeId={activeMysteryChallenge?.id ?? null}
        onSelectChallenge={(challenge) => {
          const targetModule = getExperimentById(challenge.moduleId);
          if (targetModule) {
            onSelectCatalogModule(targetModule);
          }
          onActivateMysteryChallenge?.(challenge);
          setIsMysteryModalOpen(false);
          setIsLobbyMode(false);
          setWorkflowStep(2);
          onPushNotification({
            id: `notif-mystery-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            severity: 'elevated',
            domain: challenge.domain,
            title: `Ujian Sampel Misteri Dimulai: ${challenge.codename}`,
            message: `Tentukan nilai ${challenge.hiddenParamLabel} (${challenge.hiddenParamUnit}) melalui eksperimen kokpit 3D.`,
          });
        }}
      />
    </main>
  );
};

