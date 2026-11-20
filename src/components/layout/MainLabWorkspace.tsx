import React, { Suspense, useState, useMemo, useEffect } from 'react';
import { Loader2, Video } from 'lucide-react';
import { AcademicLevel } from '../../utils/scienceEngine';
import { LabLobbyHub } from '../LabLobbyHub';
import { getExperimentById } from '../../registry/experimentRegistry';
import { MysteryChallengeModal } from '../exam/MysteryChallengeModal';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { useLabSessionContext } from '../../contexts/LabSessionContext';
import { BottomNavigationBar } from './BottomNavigationBar';
import { LabControlDock } from '../ui/LabControlDock';
import { TeacherControlBar } from './TeacherControlBar';
import { useWorkspaceMissions } from '../../hooks/useWorkspaceMissions';
import { labSound } from '../../utils/soundEngine';
import { StudentFreezeOverlay } from './workspace/StudentFreezeOverlay';
import { Stage34PipViewport } from './workspace/Stage34PipViewport';

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
const TeacherDashboardView = React.lazy(() =>
  import('../TeacherDashboardView').then((m) => ({ default: m.TeacherDashboardView }))
);

function LabLoadingSkeleton() {
  return (
    <div
      className="w-full h-[calc(100vh-8rem)] min-h-[480px] grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] text-[var(--comfort-text)]"
      role="status"
      aria-live="polite"
      aria-label="Memuat Lingkungan Laboratorium 3D"
    >
      <div className="hidden lg:flex lg:col-span-3 flex-col gap-3 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4">
        <div className="h-4 w-32 rounded bg-[var(--comfort-surface-muted)] animate-pulse" />
        <div className="h-16 rounded-lg bg-[var(--comfort-surface-muted)] animate-pulse" />
        <div className="h-28 rounded-lg bg-[var(--comfort-surface-muted)] animate-pulse" />
        <div className="flex-1 rounded-lg bg-[var(--comfort-surface-muted)]/70 animate-pulse" />
      </div>

      <div className="lg:col-span-6 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] flex flex-col items-center justify-center p-8 space-y-4 shadow-sm">
        <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-500 animate-spin">
          <Loader2 className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-sm font-bold">Memuat Lingkungan Laboratorium 3D...</div>
          <div className="text-xs text-[var(--comfort-text-muted)]">
            Menyiapkan mesin sains &amp; shader WebGL
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:col-span-3 flex-col gap-3 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4">
        <div className="h-4 w-28 rounded bg-[var(--comfort-surface-muted)] animate-pulse" />
        <div className="h-24 rounded-lg bg-[var(--comfort-surface-muted)] animate-pulse" />
        <div className="flex-1 rounded-lg bg-[var(--comfort-surface-muted)]/70 animate-pulse" />
      </div>
    </div>
  );
}

export const MainLabWorkspace: React.FC = () => {
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

  const {
    drawerOpen,
    setDrawerOpen,
    activeDrawerTab,
    setDrawerTab,
    activeModal,
    openModal,
    closeModal,
    teacherViewMode,
    setTeacherViewMode,
  } = useUIStore(
    useShallow((s) => ({
      drawerOpen: s.drawerOpen,
      setDrawerOpen: s.setDrawerOpen,
      activeDrawerTab: s.activeDrawerTab,
      setDrawerTab: s.setDrawerTab,
      activeModal: s.activeModal,
      openModal: s.openModal,
      closeModal: s.closeModal,
      teacherViewMode: s.teacherViewMode,
      setTeacherViewMode: s.setTeacherViewMode,
    }))
  );

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

  const {
    currentExperimentModule,
    activeScienceDomain,
    activeTierLabel,
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
    activeMysteryChallenge,
    mysterySubmissions,
    externalDrLabMuPrompt,
    recordsRegression,
    deleteRecord,
    onExportCSV,
    onSubmitQuizScoreAndGrade,
    handleRotateGroup,
    pushNotification,
    broadcastTeacherFeedback,
    broadcastMysteryChallenge,
    activateMysteryChallenge,
    onCompleteChallenge,
    onCreateTask,
    onCreateNote,
    toggleTask,
    onDeleteSnapshot,
    onReplayRecord,
    handleUpdateCurrentHypothesis,
    handleSelectCatalogModule,
    onInjectOutlierDemo,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleTeacherFreeze,
  } = useLabSessionContext();

  const [isMysteryModalOpen, setIsMysteryModalOpen] = useState(false);
  const [queuedDrLabMuPrompt, setQueuedDrLabMuPrompt] = useState<{
    id: number;
    prompt: string;
  } | null>(externalDrLabMuPrompt);
  const [pip3DMode, setPip3DMode] = useState<'pip' | 'split' | 'minimized'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'minimized' : 'pip'
  );

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

  const { lanInfo } = useWorkspaceMissions({
    activeDomain,
    activeScienceDomain,
    physicsParams,
    chemistryParams,
    biologyContext,
    astronomyParams,
    completedChallengeIds,
    onCompleteChallenge,
    onPushNotification: pushNotification,
  });

  const liveStudentTelemetries = useMemo(
    () => Object.values(studentTelemetryMap),
    [studentTelemetryMap]
  );

  const hasLowR2Alert = recordsRegression.isLowR2Alert;

  return (
    <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[var(--comfort-bg)] text-[var(--comfort-text)] transition-colors duration-200">
      {/* TEACHER CONTROL BAR */}
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
          onToggleTeacherFreeze={toggleTeacherFreeze}
        />
      )}

      {/* STUDENT SCREEN FREEZE OVERLAY */}
      {userRole === 'siswa' && isFrozenByTeacher && (
        <StudentFreezeOverlay teacherName={teacherName} activeRoomId={activeRoomId} />
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
                broadcastTeacherFeedback(targetStudentId, message, currentProfile.name);
                pushNotification({
                  id: `notif-fb-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Pengajar',
                  title: 'Umpan Balik Pengajar Dikirim',
                  message: `Pesan untuk siswa (${targetStudentId}): "${message}"`,
                });
              }}
              onExportGradesNotification={(count) => {
                pushNotification({
                  id: `notif-grades-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  severity: 'nominal',
                  domain: 'Pengajar',
                  title: 'Rekap Nilai Siswa Diekspor',
                  message: `Nilai ${count} siswa berhasil diekspor ke format laporan resmi.`,
                });
              }}
              activeMysteryChallenge={activeMysteryChallenge}
              onBroadcastMysteryChallenge={(challenge) => {
                broadcastMysteryChallenge(challenge, currentProfile.name);
                pushNotification({
                  id: `notif-myst-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
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
                handleSelectCatalogModule(exp);
                setIsLobbyMode(false);
                if (userRole === 'pengajar') {
                  setTeacherViewMode('lab3d');
                  setWorkflowStep(2);
                } else {
                  setWorkflowStep(1);
                }
              }}
              onCreateRoom={createRoom}
              onJoinRoom={joinRoom}
              onLeaveRoom={leaveRoom}
              onToggleTeacherFreeze={toggleTeacherFreeze}
              onOpenMysteryExam={() => setIsMysteryModalOpen(true)}
            />
          </div>
        )}

        {/* VIEW 3: Student Workflow Stage 1 (K3 & Pre-Lab Briefing) */}
        {userRole === 'siswa' && !isLobbyMode && workflowStep === 1 && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <PreLabBriefingView
              experiment={currentExperimentModule}
              activeTier={activeTierLabel}
              studentName={currentProfile.name}
              studentGroup={currentProfile.group}
              onProceedToSimulation={() => setWorkflowStep(2)}
              onBackToLobby={() => setIsLobbyMode(true)}
              hypothesisNote={currentModuleHypothesis}
              onChangeHypothesisNote={handleUpdateCurrentHypothesis}
              records={records}
            />
          </div>
        )}

        {/* VIEW 4, 5 & 6: Stages 2 (3D Cockpit), 3 (Analytics), 4 (Collab Report) */}
        {!isLobbyMode &&
          ((userRole === 'siswa' && (workflowStep === 2 || workflowStep === 3 || workflowStep === 4)) ||
            (userRole === 'pengajar' && teacherViewMode === 'lab3d')) &&
          (() => {
            const isTeacherLabDemo = userRole === 'pengajar' && teacherViewMode === 'lab3d';
            const effectiveStep = isTeacherLabDemo ? 2 : workflowStep;
            return (
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden h-full w-full relative">
                {userRole === 'siswa' &&
                  (remoteTeacherCameraSync?.enabled || remoteTeacherLaser?.active) && (
                    <div
                      data-testid="student-follow-teacher-cam-pill"
                      className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 border border-indigo-400/60 text-xs text-slate-100 shadow-xl"
                    >
                      {remoteTeacherLaser?.active && (
                        <span className="inline-flex items-center gap-1.5 text-rose-300 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>
                            Laser {remoteTeacherLaser.teacherName}:{' '}
                            {remoteTeacherLaser.hoveredObject || 'Aparatus 3D'}
                          </span>
                        </span>
                      )}
                      {remoteTeacherCameraSync?.enabled && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-indigo-300 font-semibold">
                            <Video className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {followTeacherCamera
                                ? 'Mengikuti Kamera Guru'
                                : 'Kamera Guru Aktif (Dijeda)'}
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

                <Stage34PipViewport
                  effectiveStep={effectiveStep}
                  pip3DMode={pip3DMode}
                  onChangePip3DMode={setPip3DMode}
                  onQueueDrLabMuPrompt={(prompt) =>
                    setQueuedDrLabMuPrompt({ id: Date.now(), prompt })
                  }
                />

                {/* Stage 3: Analytics, Regression & LKS */}
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
                          <span className="font-mono font-bold tabular-nums">
                            {records.length}/3
                          </span>{' '}
                          titik data pengamatan tercatat. Tambahkan minimal 3 variasi data agar
                          grafik regresi OLS &amp; uji LKS lebih akurat.
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
                      onSubmitQuizScore={onSubmitQuizScoreAndGrade}
                      onDeleteRecord={deleteRecord}
                      onExportCSV={onExportCSV}
                      onRotateGroup={handleRotateGroup}
                      hypothesisNote={currentModuleHypothesis}
                      onChangeHypothesisNote={handleUpdateCurrentHypothesis}
                      snapshots3D={capturedSnapshots}
                      moduleId={currentExperimentModule.id}
                      domain={activeScienceDomain}
                      onAskDrLabMu={(prompt) => {
                        setDrawerTab('ai');
                        setDrawerOpen(true);
                        setQueuedDrLabMuPrompt({ id: Date.now(), prompt });
                      }}
                      onBackToLab={() => setWorkflowStep(2)}
                      onProceedToReport={() => setWorkflowStep(4)}
                      onExportChartNotification={(fmt: 'PNG' | 'PDF') =>
                        pushNotification({
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

                {/* Stage 4: Collaboration, Report & Group Tasks */}
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
                      onDeleteRecord={deleteRecord}
                      onToggleTask={toggleTask}
                      onCreateTask={onCreateTask}
                      onCreateNote={onCreateNote}
                      onBackToAnalysis={() => setWorkflowStep(3)}
                      onBackToCatalog={() => setIsLobbyMode(true)}
                      hypothesisNote={currentModuleHypothesis}
                      onChangeHypothesisNote={handleUpdateCurrentHypothesis}
                      snapshots3D={capturedSnapshots}
                      onDeleteSnapshot={onDeleteSnapshot}
                      onReplayRecord={onReplayRecord}
                      students={students}
                      moduleId={currentExperimentModule.id}
                      onCSVExported={(count) =>
                        pushNotification({
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

                {/* Mobile Bottom Navigation Bar */}
                {effectiveStep === 2 && (
                  <BottomNavigationBar
                    recordsCount={records.length}
                    hasLowR2Alert={hasLowR2Alert}
                  />
                )}
              </div>
            );
          })()}
      </Suspense>

      <LabControlDock
        notificationsCount={notifications.length}
        hasLowR2Alert={hasLowR2Alert}
        snapshotCount={capturedSnapshots.length}
        recordsCount={records.length}
      />

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
            onSelectModule={handleSelectCatalogModule}
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
            handleSelectCatalogModule(targetModule);
          }
          activateMysteryChallenge(challenge);
          setIsMysteryModalOpen(false);
          setIsLobbyMode(false);
          setWorkflowStep(2);
          pushNotification({
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
