import React, { Suspense, useState, useMemo, useEffect } from 'react';
import {
  Loader2,
  Lock,
  Unlock,
  Users,
  Sparkles,
  Wifi,
  Crosshair,
  Video,
  VideoOff,
  FlaskConical,
  LayoutDashboard,
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
  } = useLabStore();

  const {
    zenMode,
    drawerOpen,
    setDrawerOpen,
    activeDrawerTab,
    setDrawerTab,
    activeModal,
    openModal,
    closeModal,
  } = useUIStore();

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
  const [lanInfo, setLanInfo] = useState<{ ip: string; port: number; localUrl: string } | null>(null);

  useEffect(() => {
    fetch('/api/lan-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.primaryLanIp || data.primaryIp || data.ip)) {
          const ip = data.primaryLanIp || data.primaryIp || data.ip;
          setLanInfo({
            ip,
            port: data.port,
            localUrl: data.lanUrl || data.localUrl || `http://${ip}:${data.port}`,
          });
        }
      })
      .catch(() => {});
  }, []);

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
                ? `MEJA AKTIF: ${activeRoomId} (PIN: ${roomPin || '1234'}) · ${Object.keys(roomMembers).length} Peserta`
                : 'MODE GURU: Belum Membuka Room PIN'}
            </span>

            {/* 3T LAN Hotspot Info for Teacher */}
            {lanInfo && (
              <span
                data-testid="teacher-bar-lan-badge"
                title="Tips Daerah 3T: Nyalakan Hotspot Wi-Fi di laptop Guru agar siswa dapat membuka IP ini tanpa kuota internet!"
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300"
              >
                <Wifi className="w-3.5 h-3.5 text-amber-400" />
                <span>LAN: <strong className="text-white select-all">{lanInfo.localUrl}</strong></span>
              </span>
            )}

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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="teacher-view-mode-btn"
              onClick={() => {
                labSound.playClick(600);
                if (isLobbyMode) setIsLobbyMode(false);
                setTeacherViewMode((prev) => (prev === 'dashboard' ? 'lab3d' : 'dashboard'));
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                teacherViewMode === 'lab3d' && !isLobbyMode
                  ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Beralih antara Dashboard Monitoring Kelas dan Ruang Lab 3D Demonstrasi Guru"
            >
              {teacherViewMode === 'lab3d' && !isLobbyMode ? (
                <>
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard Guru</span>
                </>
              ) : (
                <>
                  <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
                  <span>Lab 3D Guru</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="teacher-laser-toggle-btn"
              onClick={() => {
                const next = !teacherLaserActive;
                labSound.playClick(next ? 740 : 480);
                setTeacherLaserActive(next);
                if (next) {
                  if (isLobbyMode) setIsLobbyMode(false);
                  setTeacherViewMode('lab3d');
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                teacherLaserActive
                  ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/50 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-slate-700'
              }`}
              title="Arahkan kursor pada objek 3D untuk memancarkan sinar Laser Pointer merah real-time ke seluruh layar murid"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{teacherLaserActive ? '🔴 Laser Pointer Aktif' : '🔴 Laser Pointer 3D'}</span>
            </button>

            <button
              type="button"
              data-testid="teacher-camera-sync-toggle-btn"
              onClick={() => {
                const next = !teacherCameraSyncEnabled;
                labSound.playClick(next ? 700 : 460);
                setTeacherCameraSyncEnabled(next);
                if (next) {
                  if (isLobbyMode) setIsLobbyMode(false);
                  setTeacherViewMode('lab3d');
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                teacherCameraSyncEnabled
                  ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'
              }`}
              title="Sinkronkan sudut pandang kamera 3D murid mengikuti rotasi kamera Guru secara langsung"
            >
              {teacherCameraSyncEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              <span>{teacherCameraSyncEnabled ? '🎥 Kamera Tersinkron' : '🎥 Sinkronkan Kamera Murid'}</span>
            </button>

            <button
              type="button"
              data-testid="teacher-bar-ai-mission-btn"
              onClick={() => {
                labSound.playClick(620);
                openModal('ai-mission-builder');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Buat Misi Praktikum AI</span>
            </button>

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
                  ? 'flex-1 min-h-0 flex overflow-hidden relative w-full h-full'
                  : pip3DMode === 'split'
                  ? 'w-full lg:w-[45%] h-[300px] lg:h-full shrink-0 flex flex-col overflow-hidden relative border-b lg:border-b-0 lg:border-r border-[var(--comfort-border)] bg-slate-950'
                  : pip3DMode === 'pip'
                  ? 'fixed bottom-4 right-4 w-[310px] sm:w-[360px] h-[235px] z-30 rounded-2xl border-2 border-sky-500/50 bg-slate-950 shadow-2xl overflow-hidden flex flex-col'
                  : 'fixed bottom-4 right-4 w-auto h-auto z-30 rounded-xl border border-sky-500/40 bg-slate-900/95 shadow-xl overflow-hidden flex flex-col'
              }
            >
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
    </main>
  );
};

