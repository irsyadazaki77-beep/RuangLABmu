import React, { Suspense } from 'react';
import { labSound } from './utils/soundEngine';
import { useLabStore } from './stores/useLabStore';
import { useUIStore } from './stores/useUIStore';
import { useCollabStore } from './stores/useCollabStore';
import { STUDENT_PROFILES } from './stores/initialLabParams';
import { TopNavigationHeader } from './components/layout/TopNavigationHeader';
import { MainLabWorkspace } from './components/layout/MainLabWorkspace';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
import { ExamSessionController } from './components/exam/ExamSessionController';
import { useLabSession } from './hooks/useLabSession';
import { useUrlRouterSync } from './hooks/useUrlRouterSync';
import { recordK3Compliance } from './services/gamificationEngine';

const GlobalModalPortal = React.lazy(() =>
  import('./components/layout/GlobalModalPortal').then((m) => ({ default: m.GlobalModalPortal }))
);
const CommandPaletteModal = React.lazy(() =>
  import('./components/ui/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal }))
);
const LabOnboardingTour = React.lazy(() =>
  import('./components/ui/LabOnboardingTour').then((m) => ({ default: m.LabOnboardingTour }))
);
import { buildSubmissionTelemetryTimeline } from './utils/telemetryRecorder';
import {
  computeRecordsRegressionSummary,
  parseReplayParameters,
} from './utils/labTelemetryHelpers';

/**
 * RuangLABmu - Virtual Science Laboratory Workspace (v2.0)
 * React 19 + TypeScript + Tailwind CSS v4 + Three.js
 * Clean Container Layout using Zustand & useLabSession hook.
 */
export default function App() {
  useUrlRouterSync();

  const { setActiveDomain, setWorkflowStep, isSubmissionLocked, setSubmissionLocked } = useLabStore();
  const { onboardingTourOpen, setOnboardingTourOpen } = useUIStore();
  const { activeRoomId } = useCollabStore();
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
    latestLksScore,
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
    mysterySubmissions,
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
    broadcastTeacherFeedback,
    broadcastMysteryChallenge,
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
    ws,
  } = session;

  const recordsRegression = computeRecordsRegressionSummary(records);

  const handleAutoSubmitExam = async () => {
    setSubmissionLocked(true);
    setLksGraded(true);
    try {
      const obsPayload = records.map((r, i) => ({
        No: i + 1,
        Waktu: r.timestamp,
        X: r.numericX ?? 0,
        Y1: r.numericY1 ?? 0,
        Parameter: r.parametersSummary,
      }));
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: currentProfile.name,
          studentId: currentProfile.group,
          roomId: activeRoomId || 'LAB-ALPHA',
          domain: activeScienceDomain,
          moduleId: currentExperimentModule.id,
          submittedAt: new Date().toISOString(),
          hypothesisText: currentModuleHypothesis.hypothesisText || 'Pengumpulan otomatis saat batas waktu ujian berakhir.',
          observationData: obsPayload,
          regressionMetrics: {
            rSquared: recordsRegression.rSquared,
            slope: recordsRegression.slope,
            equation: recordsRegression.equation,
          },
          quizAnswers: [],
          quizScore: latestLksScore,
          conclusionText: 'Dikumpulkan otomatis oleh ExamSessionController.',
          telemetryLog: buildSubmissionTelemetryTimeline(activeScienceDomain, obsPayload),
        }),
      });
    } catch {
      // ignore network error on auto-submit
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--comfort-bg)] text-[var(--comfort-text)] transition-colors duration-200">
      {/* 1. Header Komposisi Terpadu */}
      <TopNavigationHeader
        experimentModule={currentExperimentModule}
        recordsCount={records.length}
        lksGraded={lksGraded}
        notificationsCount={notifications.length}
        hasLowR2Alert={recordsRegression.isLowR2Alert}
        studentProfiles={STUDENT_PROFILES}
        selectedProfileIdx={selectedProfileIdx}
        onSelectProfileIdx={setSelectedProfileIdx}
        records={records}
        capturedSnapshots={capturedSnapshots}
        bestRSquared={recordsRegression.rSquared}
        latestLksScore={latestLksScore}
      />

      {/* 2. Exam Controller Wrapper + Workspace Laboratorium Utama */}
      <ExamSessionController
        studentName={currentProfile.name}
        studentGroup={currentProfile.group}
        moduleId={currentExperimentModule.id}
        domain={activeScienceDomain}
        ws={ws}
        isSubmissionLocked={isSubmissionLocked}
        onLockSubmission={() => setSubmissionLocked(true)}
        onAutoSubmitExam={handleAutoSubmitExam}
      >
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
          mysterySubmissions={mysterySubmissions}
          remoteCursors={remoteCursors}
          paramLocks={paramLocks}
          emitCursor3D={emitCursor3D}
          acquireParamLock={acquireParamLock}
          releaseParamLock={releaseParamLock}
          onDeleteRecord={deleteRecord}
          onExportCSV={() => exportRecordsToCSV(records)}
          onRotateGroup={session.handleRotateGroup}
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
          onBroadcastTeacherFeedback={broadcastTeacherFeedback}
          onBroadcastMysteryChallenge={broadcastMysteryChallenge}
          onReplayRecord={(rec) => {
            labSound.playClick();
            const restored = parseReplayParameters(rec);
            const domainKeyMap = {
              Fisika: 'physics',
              Kimia: 'chemistry',
              Biologi: 'biology',
              Astronomi: 'astronomy',
            } as const;
            setActiveDomain(domainKeyMap[restored.domain]);

            if (restored.physicsPatch) {
              setPhysicsParams((prev) => ({ ...prev, ...restored.physicsPatch }));
            }
            if (restored.chemistryPatch) {
              setChemistryParams((prev) => ({ ...prev, ...restored.chemistryPatch }));
            }
            if (restored.astronomyPatch) {
              setAstronomyParams((prev) => ({ ...prev, ...restored.astronomyPatch }));
            }
            if (restored.biologyPatch) {
              const numericPatch: Record<string, number> = {};
              for (const [k, v] of Object.entries(restored.biologyPatch)) {
                if (typeof v === 'number') numericPatch[k] = v;
              }
              if (restored.biologyPatch.mode) {
                setSelectedBioModuleId(restored.biologyPatch.mode);
              }
              setBiologyContext((prev) => ({
                ...prev,
                moduleId: restored.biologyPatch?.mode || prev.moduleId,
                params: { ...prev.params, ...numericPatch },
              }));
            }

            setWorkflowStep(2);
            pushNotification({
              id: `notif-replay-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              severity: 'nominal',
              domain: rec.domain,
              title: `Memuat Ulang Parameter ${rec.id}`,
              message: `Parameter ${rec.parametersSummary} (${restored.matchedKeysCount} variabel) telah dimuat kembali ke kokpit 3D.`,
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
          hasLowR2Alert={recordsRegression.isLowR2Alert}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onLeaveRoom={leaveRoom}
          onToggleTeacherFreeze={toggleTeacherFreeze}
        />
      </ExamSessionController>

      {/* 3. Global Modal Portal Terpusat, Onboarding Tour & Command Palette */}
      <Suspense fallback={null}>
        <GlobalModalPortal
          experiment={currentExperimentModule}
          activeTier={activeTierLabel}
          reportData={reportData}
          onProceedToLab={() => {
            recordK3Compliance(currentExperimentModule.id);
            setWorkflowStep(2);
          }}
        />

        {onboardingTourOpen && (
          <LabOnboardingTour
            isOpen={onboardingTourOpen}
            onClose={() => setOnboardingTourOpen(false)}
          />
        )}

        <CommandPaletteModal onSelectModule={handleSelectCatalogModule} />
      </Suspense>

      {/* 4. In-App PWA Offline Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}

