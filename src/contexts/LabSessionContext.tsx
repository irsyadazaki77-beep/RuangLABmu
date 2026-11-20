import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useLabSession } from '../hooks/useLabSession';
import { useLabStore } from '../stores/useLabStore';
import {
  computeRecordsRegressionSummary,
  parseReplayParameters,
} from '../utils/labTelemetryHelpers';
import type { ExperimentRecord, ScienceDomain } from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

export type LabSessionReturn = ReturnType<typeof useLabSession>;

export interface LabSessionContextValue extends LabSessionReturn {
  recordsRegression: ReturnType<typeof computeRecordsRegressionSummary>;
  onExportCSV: () => void;
  onSubmitQuizScoreAndGrade: (score: number, count: number) => void;
  onSyncWithGroup: (domain: ScienceDomain, summary: string) => void;
  onCompleteChallenge: (id: string) => void;
  onCreateTask: (title: string, domain: ScienceDomain) => void;
  onCreateNote: (text: string) => void;
  onDeleteSnapshot: (id: string) => void;
  onReplayRecord: (rec: ExperimentRecord) => void;
  onInjectOutlierDemo: () => void;
}

const LabSessionContext = createContext<LabSessionContextValue | null>(null);

export const LabSessionProvider: React.FC<{
  session: LabSessionReturn;
  children: React.ReactNode;
}> = ({ session, children }) => {
  const setActiveDomain = useLabStore((s) => s.setActiveDomain);
  const setWorkflowStep = useLabStore((s) => s.setWorkflowStep);

  const recordsRegression = useMemo(
    () => computeRecordsRegressionSummary(session.records),
    [session.records]
  );

  const onExportCSV = useCallback(() => {
    session.exportRecordsToCSV(session.records);
  }, [session]);

  const onSubmitQuizScoreAndGrade = useCallback(
    (score: number, count: number) => {
      session.submitQuizScore(session.currentProfile.name, score, count);
      session.setLksGraded(true);
    },
    [session]
  );

  const onSyncWithGroup = useCallback(
    (_domain: ScienceDomain, summary: string) => {
      session.createNote(
        `Sinkronisasi grup: ${summary}`,
        session.currentProfile.name,
        'Siswa',
        session.currentProfile.group
      );
    },
    [session]
  );

  const onCompleteChallenge = useCallback(
    (id: string) => {
      session.setCompletedChallengeIds((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
    },
    [session]
  );

  const onCreateTask = useCallback(
    (title: string, domain: ScienceDomain) => {
      session.createTask(title, session.currentProfile.group, domain);
    },
    [session]
  );

  const onCreateNote = useCallback(
    (text: string) => {
      session.createNote(
        text,
        session.currentProfile.name,
        'Siswa',
        session.currentProfile.group
      );
    },
    [session]
  );

  const onDeleteSnapshot = useCallback(
    (id: string) => {
      session.setCapturedSnapshots((prev) => prev.filter((s) => s.id !== id));
    },
    [session]
  );

  const onReplayRecord = useCallback(
    (rec: ExperimentRecord) => {
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
        session.setPhysicsParams((prev) => ({ ...prev, ...restored.physicsPatch }));
      }
      if (restored.chemistryPatch) {
        session.setChemistryParams((prev) => ({ ...prev, ...restored.chemistryPatch }));
      }
      if (restored.astronomyPatch) {
        session.setAstronomyParams((prev) => ({ ...prev, ...restored.astronomyPatch }));
      }
      if (restored.biologyPatch) {
        const numericPatch: Record<string, number> = {};
        for (const [k, v] of Object.entries(restored.biologyPatch)) {
          if (typeof v === 'number') numericPatch[k] = v;
        }
        if (restored.biologyPatch.mode) {
          session.setSelectedBioModuleId(restored.biologyPatch.mode);
        }
        session.setBiologyContext((prev) => ({
          ...prev,
          moduleId: restored.biologyPatch?.mode || prev.moduleId,
          params: { ...prev.params, ...numericPatch },
        }));
      }

      setWorkflowStep(2);
      session.pushNotification({
        id: `notif-replay-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        severity: 'nominal',
        domain: rec.domain,
        title: `Memuat Ulang Parameter ${rec.id}`,
        message: `Parameter ${rec.parametersSummary} (${restored.matchedKeysCount} variabel) telah dimuat kembali ke kokpit 3D.`,
      });
    },
    [session, setActiveDomain, setWorkflowStep]
  );

  const onInjectOutlierDemo = useCallback(() => {
    session.setExternalDrLabMuPrompt({
      id: Date.now(),
      prompt:
        'Mengapa pada percobaan ke-4 terdapat deviasi data dan nilai R² turun? Faktor apa yang mempengaruhi?',
    });
  }, [session]);

  const value = useMemo<LabSessionContextValue>(
    () => ({
      ...session,
      recordsRegression,
      onExportCSV,
      onSubmitQuizScoreAndGrade,
      onSyncWithGroup,
      onCompleteChallenge,
      onCreateTask,
      onCreateNote,
      onDeleteSnapshot,
      onReplayRecord,
      onInjectOutlierDemo,
    }),
    [
      session,
      recordsRegression,
      onExportCSV,
      onSubmitQuizScoreAndGrade,
      onSyncWithGroup,
      onCompleteChallenge,
      onCreateTask,
      onCreateNote,
      onDeleteSnapshot,
      onReplayRecord,
      onInjectOutlierDemo,
    ]
  );

  return (
    <LabSessionContext.Provider value={value}>
      {children}
    </LabSessionContext.Provider>
  );
};

export function useLabSessionContext(): LabSessionContextValue {
  const ctx = useContext(LabSessionContext);
  if (!ctx) {
    throw new Error('useLabSessionContext must be used inside LabSessionProvider');
  }
  return ctx;
}
