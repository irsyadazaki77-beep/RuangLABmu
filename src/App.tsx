import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
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
import {
  enqueuePendingExamSubmission,
  flushPendingExamSubmissions,
  loadPendingExamSubmissions,
  submitExamPayload,
} from './utils/examSubmissionQueue';

const GlobalModalPortal = React.lazy(() =>
  import('./components/layout/GlobalModalPortal').then((m) => ({ default: m.GlobalModalPortal }))
);
const CommandPaletteModal = React.lazy(() =>
  import('./components/ui/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal }))
);
const LabOnboardingTour = React.lazy(() =>
  import('./components/ui/LabOnboardingTour').then((m) => ({ default: m.LabOnboardingTour }))
);
export const PhysicsLabView = React.lazy(() =>
  import('./components/PhysicsLabView').then((m) => ({ default: m.PhysicsLabView }))
);
export const ChemistryLabView = React.lazy(() =>
  import('./components/ChemistryLabView').then((m) => ({ default: m.ChemistryLabView }))
);
export const BiologyLabView = React.lazy(() =>
  import('./components/BiologyLabView').then((m) => ({ default: m.BiologyLabView }))
);
export const AstronomyLabView = React.lazy(() =>
  import('./components/AstronomyLabView').then((m) => ({ default: m.AstronomyLabView }))
);
export const TeacherDashboardView = React.lazy(() =>
  import('./components/TeacherDashboardView').then((m) => ({ default: m.TeacherDashboardView }))
);
import { buildSubmissionTelemetryTimeline } from './utils/telemetryRecorder';
import {
  computeRecordsRegressionSummary,
  parseReplayParameters,
} from './utils/labTelemetryHelpers';

function AppLabThemeSkeleton() {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-[var(--comfort-bg)] text-[var(--comfort-text)] p-8">
      <div className="w-full max-w-md rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-6 text-center space-y-3 shadow-lg">
        <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 mx-auto animate-spin">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div className="text-sm font-bold">Memuat Modul Laboratorium 3D...</div>
        <div className="text-xs opacity-75">Menyiapkan mesin simulasi & kanvas WebGL sesuai tema</div>
      </div>
    </div>
  );
}

interface ExamSubmissionBannerState {
  status: 'idle' | 'pending_retry' | 'retrying' | 'synced';
  message: string;
  pendingCount: number;
}

/**
 * RuangLABmu - Virtual Science Laboratory Workspace (v2.0)
 * React 19 + TypeScript + Tailwind CSS v4 + Three.js
 * Clean Container Layout using Zustand & useLabSession hook.
 */
export default function App() {
  useUrlRouterSync();

  const { setActiveDomain, setWorkflowStep, isSubmissionLocked, setSubmissionLocked } =
    useLabStore(
      useShallow((s) => ({
        setActiveDomain: s.setActiveDomain,
        setWorkflowStep: s.setWorkflowStep,
        isSubmissionLocked: s.isSubmissionLocked,
        setSubmissionLocked: s.setSubmissionLocked,
      }))
    );

  const { onboardingTourOpen, setOnboardingTourOpen } = useUIStore(
    useShallow((s) => ({
      onboardingTourOpen: s.onboardingTourOpen,
      setOnboardingTourOpen: s.setOnboardingTourOpen,
    }))
  );

  const activeRoomId = useCollabStore((s) => s.activeRoomId);
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
    activateMysteryChallenge,
    createNote,
    createTask,
    toggleTask,
    handleCapture3DSnapshot,
    submitMysteryExam,
    dismissMysteryChallenge,
    handleUpdateCurrentHypothesis,
    handleSelectCatalogModule,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleTeacherFreeze,
    ws,
  } = session;

  const recordsRegression = useMemo(
    () => computeRecordsRegressionSummary(records),
    [records]
  );

  const [examBanner, setExamBanner] = useState<ExamSubmissionBannerState>(() => {
    const initialPending = loadPendingExamSubmissions();
    return initialPending.length > 0
      ? {
          status: 'pending_retry',
          message: `Ada ${initialPending.length} jawaban ujian tersimpan lokal yang menunggu koneksi untuk dikirim ulang ke server.`,
          pendingCount: initialPending.length,
        }
      : { status: 'idle', message: '', pendingCount: 0 };
  });

  const retryPendingExamSubmissions = useCallback(async () => {
    const currentQueue = loadPendingExamSubmissions();
    if (currentQueue.length === 0) return;

    setExamBanner({
      status: 'retrying',
      message: `Mengirim ulang ${currentQueue.length} jawaban ujian tersimpan ke server...`,
      pendingCount: currentQueue.length,
    });

    const summary = await flushPendingExamSubmissions();
    if (summary.remainingCount === 0) {
      setExamBanner({
        status: 'synced',
        message: `Jawaban ujian berhasil dikirim ke server${summary.ticketCode ? ` (Tiket: ${summary.ticketCode})` : ''}.`,
        pendingCount: 0,
      });
      pushNotification({
        id: `notif-exam-sync-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        severity: 'nominal',
        domain: activeScienceDomain,
        title: 'Pengumpulan Ujian Tersinkronisasi',
        message: `Jawaban ujian yang sebelumnya tertunda berhasil dikirim ke server.`,
      });
    } else {
      setExamBanner({
        status: 'pending_retry',
        message: `Gagal mengirim jawaban ujian (${summary.lastError || 'jaringan terputus'}). Data tetap aman tersimpan secara lokal dan akan dicoba ulang otomatis saat koneksi pulih.`,
        pendingCount: summary.remainingCount,
      });
    }
  }, [activeScienceDomain, pushNotification]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (examBanner.pendingCount === 0) return;

    const onOnline = () => {
      void retryPendingExamSubmissions();
    };

    window.addEventListener('online', onOnline);
    const retryTimer = window.setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        void retryPendingExamSubmissions();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(retryTimer);
    };
  }, [examBanner.pendingCount, retryPendingExamSubmissions]);

  const handleAutoSubmitExam = useCallback(async () => {
    setSubmissionLocked(true);
    setLksGraded(true);

    const obsPayload = records.map((r, i) => ({
      No: i + 1,
      Waktu: r.timestamp,
      X: r.numericX ?? 0,
      Y1: r.numericY1 ?? 0,
      Parameter: r.parametersSummary,
    }));

    const examPayload: Record<string, unknown> = {
      studentName: currentProfile.name,
      studentId: currentProfile.group,
      roomId: activeRoomId || 'LAB-ALPHA',
      domain: activeScienceDomain,
      moduleId: currentExperimentModule.id,
      submittedAt: new Date().toISOString(),
      hypothesisText:
        currentModuleHypothesis.hypothesisText ||
        'Pengumpulan otomatis saat batas waktu ujian berakhir.',
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
    };

    const result = await submitExamPayload(examPayload);
    if (result.ok) {
      setExamBanner({
        status: 'synced',
        message: `Jawaban ujian berhasil dikumpulkan dan diverifikasi server${result.ticketCode ? ` (Tiket: ${result.ticketCode})` : ''}.`,
        pendingCount: loadPendingExamSubmissions().length,
      });
      return;
    }

    const updatedQueue = enqueuePendingExamSubmission(
      examPayload,
      result.error || 'Gagal mengirim ke server'
    );
    setExamBanner({
      status: 'pending_retry',
      message: `Koneksi gagal saat pengumpulan ujian (${result.error || 'offline'}). Jawaban Anda telah diamankan di penyimpanan lokal dan akan dikirim ulang otomatis saat koneksi kembali.`,
      pendingCount: updatedQueue.length,
    });
    pushNotification({
      id: `notif-exam-offline-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      severity: 'elevated',
      domain: activeScienceDomain,
      title: 'Jawaban Ujian Disimpan Lokal (Menunggu Koneksi)',
      message:
        'Pengiriman ke server belum berhasil. Jawaban ujian disimpan aman di perangkat dan akan dicoba ulang otomatis.',
    });
  }, [
    activeRoomId,
    activeScienceDomain,
    currentExperimentModule.id,
    currentModuleHypothesis.hypothesisText,
    currentProfile.group,
    currentProfile.name,
    latestLksScore,
    pushNotification,
    records,
    recordsRegression.equation,
    recordsRegression.rSquared,
    recordsRegression.slope,
    setLksGraded,
    setSubmissionLocked,
  ]);

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

      {/* Exam Submission Recovery & Retry Banner */}
      {examBanner.status !== 'idle' && (
        <div
          role="status"
          data-testid="exam-submission-status-banner"
          className={`shrink-0 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold border-b z-40 ${
            examBanner.status === 'synced'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-amber-500 text-slate-950 border-amber-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {examBanner.status === 'synced' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{examBanner.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {examBanner.status !== 'synced' && (
              <button
                type="button"
                onClick={() => void retryPendingExamSubmissions()}
                disabled={examBanner.status === 'retrying'}
                className="px-3 py-1 rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60 font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${examBanner.status === 'retrying' ? 'animate-spin' : ''}`}
                />
                <span>
                  {examBanner.status === 'retrying' ? 'Mengirim...' : 'Coba Kirim Ulang'}
                </span>
              </button>
            )}
            {examBanner.status === 'synced' && (
              <button
                type="button"
                onClick={() => setExamBanner({ status: 'idle', message: '', pendingCount: 0 })}
                className="px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

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
        <Suspense fallback={<AppLabThemeSkeleton />}>
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
          onActivateMysteryChallenge={activateMysteryChallenge}
          onDismissMysteryChallenge={dismissMysteryChallenge}
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
        </Suspense>
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
