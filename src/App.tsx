import React from 'react';
import { labSound } from './utils/soundEngine';
import { useLabStore } from './stores/useLabStore';
import { STUDENT_PROFILES } from './stores/initialLabParams';
import { TopNavigationHeader } from './components/layout/TopNavigationHeader';
import { MainLabWorkspace } from './components/layout/MainLabWorkspace';
import { GlobalModalPortal } from './components/layout/GlobalModalPortal';
import { useLabSession } from './hooks/useLabSession';

/**
 * RuangLABmu - Virtual Science Laboratory Workspace
 * React 19 + TypeScript + Tailwind CSS v4 + Three.js
 * Clean Container Layout (<150 lines) using Zustand & useLabSession hook.
 */
export default function App() {
  const { setWorkflowStep } = useLabStore();
  const session = useLabSession();

  const {
    currentExperimentModule,
    activeScienceDomain,
    activeTierLabel,
    currentProfile,
    selectedProfileIdx,
    setSelectedProfileIdx,
    records,
    tasks,
    notes,
    students,
    notifications,
    lksGraded,
    setLksGraded,
    capturedSnapshots,
    setCapturedSnapshots,
    completedChallengeIds,
    setCompletedChallengeIds,
    currentModuleHypothesis,
    physicsParams,
    setPhysicsParams,
    chemistryParams,
    setChemistryParams,
    biologyContext,
    setBiologyContext,
    astronomyParams,
    setAstronomyParams,
    selectedBioModuleId,
    setSelectedBioModuleId,
    activeMysteryChallenge,
    remoteCursors,
    paramLocks,
    emitCursor3D,
    acquireParamLock,
    releaseParamLock,
    externalDrLabMuPrompt,
    setExternalDrLabMuPrompt,
    reportData,
    deleteRecord,
    exportRecordsToCSV,
    submitQuizScore,
    handleRecordExperiment,
    pushNotification,
    createNote,
    createTask,
    toggleTask,
    handleCapture3DSnapshot,
    submitMysteryExam,
    handleUpdateCurrentHypothesis,
    handleSelectCatalogModule,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleTeacherFreeze,
  } = session;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--comfort-bg)] text-[var(--comfort-text)] transition-colors duration-200 select-none">
      {/* 1. Header Komposisi Terpadu */}
      <TopNavigationHeader
        experimentModule={currentExperimentModule}
        recordsCount={records.length}
        lksGraded={lksGraded}
        notificationsCount={notifications.length}
        hasLowR2Alert={records.length >= 3}
        studentProfiles={STUDENT_PROFILES}
        selectedProfileIdx={selectedProfileIdx}
        onSelectProfileIdx={setSelectedProfileIdx}
      />

      {/* 2. Workspace Laboratorium Utama (Docking Split-View) */}
      <MainLabWorkspace
        experimentModule={currentExperimentModule}
        activeScienceDomain={activeScienceDomain}
        currentProfile={currentProfile}
        records={records}
        tasks={tasks}
        notes={notes}
        students={students}
        notifications={notifications}
        capturedSnapshots={capturedSnapshots}
        completedChallengeIds={completedChallengeIds}
        currentModuleHypothesis={currentModuleHypothesis}
        physicsParams={physicsParams}
        chemistryParams={chemistryParams}
        biologyContext={biologyContext}
        astronomyParams={astronomyParams}
        selectedBioModuleId={selectedBioModuleId}
        activeMysteryChallenge={activeMysteryChallenge}
        remoteCursors={remoteCursors}
        paramLocks={paramLocks}
        emitCursor3D={emitCursor3D}
        acquireParamLock={acquireParamLock}
        releaseParamLock={releaseParamLock}
        onDeleteRecord={deleteRecord}
        onExportCSV={() => exportRecordsToCSV(records)}
        onSubmitQuizScore={(score, count) => {
          submitQuizScore(currentProfile.name, score, count);
          setLksGraded(true);
        }}
        onRecordExperiment={handleRecordExperiment}
        onPushNotification={pushNotification}
        onSyncWithGroup={(_domain, summary) => {
          createNote(`Sinkronisasi grup: ${summary}`, currentProfile.name, 'Siswa', currentProfile.group);
        }}
        onCapture3DSnapshot={handleCapture3DSnapshot}
        onCompleteChallenge={(id) => setCompletedChallengeIds((prev) => [...prev, id])}
        onSubmitMysteryExam={submitMysteryExam}
        onUpdateCurrentHypothesis={handleUpdateCurrentHypothesis}
        onChangePhysicsParams={setPhysicsParams}
        onChangeChemistryParams={setChemistryParams}
        onChangeBiologyContext={setBiologyContext}
        onChangeAstronomyParams={setAstronomyParams}
        onSelectBioModuleId={setSelectedBioModuleId}
        onToggleTask={toggleTask}
        onCreateTask={(title, domain) => createTask(title, currentProfile.group, domain)}
        onCreateNote={(text) => createNote(text, currentProfile.name, 'Siswa', currentProfile.group)}
        onDeleteSnapshot={(id) => setCapturedSnapshots((prev) => prev.filter((s) => s.id !== id))}
        onReplayRecord={(rec) => {
          labSound.playClick();
          pushNotification({
            id: `notif-replay-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            severity: 'nominal',
            domain: rec.domain,
            title: `Memuat Ulang Parameter ${rec.id}`,
            message: `Parameter ${rec.parametersSummary} telah dimuat kembali ke kokpit 3D.`,
          });
        }}
        onSelectCatalogModule={handleSelectCatalogModule}
        onInjectOutlierDemo={() => {
          setExternalDrLabMuPrompt({
            id: Date.now(),
            prompt: 'Mengapa pada percobaan ke-4 terdapat deviasi data dan nilai R² turun? Faktor apa yang mempengaruhi?',
          });
        }}
        externalDrLabMuPrompt={externalDrLabMuPrompt}
        hasLowR2Alert={records.length >= 3}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onLeaveRoom={leaveRoom}
        onToggleTeacherFreeze={toggleTeacherFreeze}
      />

      {/* 3. Global Modal Portal Terpusat (K3, Safety, Quiz & Report) */}
      <GlobalModalPortal
        experiment={currentExperimentModule}
        activeTier={activeTierLabel}
        reportData={reportData}
        onProceedToLab={() => setWorkflowStep(2)}
      />
    </div>
  );
}
