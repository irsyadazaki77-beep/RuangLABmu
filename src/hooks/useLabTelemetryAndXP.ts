import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AcademicLevel,
  ExperimentRecord,
  LabNotification,
  ScienceDomain,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import { HypothesisNote } from '../components/ui/HypothesisAndCompareDock';
import { Lab3DSnapshot } from '../components/ui/ScientificEnhancementSuite';
import {
  ExperimentModule,
  EducationTier,
} from '../registry/experimentRegistry';
import { useCollabStore } from '../stores/useCollabStore';
import { recordTelemetryInteraction } from '../utils/telemetryRecorder';
import { evaluateDataPrecisionXP } from '../services/gamificationEngine';
import { aiVoiceAssistant } from '../services/aiVoiceAssistant';
import type { StudentLiveTelemetry } from '../utils/collabProtocol';
import type { LabDomain, UserRole } from '../stores/useLabStore';
import type {
  INITIAL_PHYSICS_PARAMS,
  INITIAL_CHEMISTRY_PARAMS,
  INITIAL_BIOLOGY_CONTEXT,
  INITIAL_ASTRONOMY_PARAMS,
} from '../stores/initialLabParams';

export interface UseLabTelemetryAndXPOptions {
  activeDomain: LabDomain;
  activeScienceDomain: ScienceDomain;
  academicLevel: AcademicLevel;
  userRole: UserRole;
  isLobbyMode: boolean;
  workflowStep: number;
  currentExperimentModule: ExperimentModule;
  currentModuleHypothesis: HypothesisNote;
  currentProfile: { name: string; group: string };
  physicsParams: typeof INITIAL_PHYSICS_PARAMS;
  chemistryParams: typeof INITIAL_CHEMISTRY_PARAMS;
  biologyContext: typeof INITIAL_BIOLOGY_CONTEXT;
  astronomyParams: typeof INITIAL_ASTRONOMY_PARAMS;
  selectedBioModuleId: string;
  records: ExperimentRecord[];
  addRecord: (record: ExperimentRecord) => void;
  pushNotification: (notif: LabNotification) => void;
  syncStudentTelemetry: (telemetry: Omit<StudentLiveTelemetry, 'studentName' | 'lastUpdated'>) => void;
  backendSubmitQuizScore: (studentName: string, score: number, correctCount: number) => void;
}

export function useLabTelemetryAndXP({
  activeDomain,
  activeScienceDomain,
  academicLevel,
  userRole,
  isLobbyMode,
  workflowStep,
  currentExperimentModule,
  currentModuleHypothesis,
  currentProfile,
  physicsParams,
  chemistryParams,
  biologyContext,
  astronomyParams,
  selectedBioModuleId,
  records,
  addRecord,
  pushNotification,
  syncStudentTelemetry,
  backendSubmitQuizScore,
}: UseLabTelemetryAndXPOptions) {
  const [lksGraded, setLksGraded] = useState<boolean>(false);
  const [latestLksScore, setLatestLksScore] = useState<number>(0);
  const [completedChallengeIds, setCompletedChallengeIds] = useState<string[]>([]);
  const [capturedSnapshots, setCapturedSnapshots] = useState<Lab3DSnapshot[]>([]);

  const activeTierLabel: EducationTier =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'Mahasiswa' : 'SMA';

  // Sync live student telemetry to room when parameters or records change
  useEffect(() => {
    const activeRoomId = useCollabStore.getState().activeRoomId;
    if (!activeRoomId || userRole !== 'siswa') return;

    const currentParams: Record<string, number | string | boolean> =
      activeDomain === 'physics'
        ? {
            mode: physicsParams.mode,
            mass: physicsParams.mass,
            appliedForce: physicsParams.appliedForce,
            inclineAngle: physicsParams.inclineAngle,
            gravity: physicsParams.gravity,
          }
        : activeDomain === 'chemistry'
        ? {
            mode: chemistryParams.mode,
            initialTempC: chemistryParams.initialTempC,
            reactantConcentration: chemistryParams.reactantConcentration,
            titrantAddedMl: chemistryParams.titrantAddedMl,
          }
        : activeDomain === 'biology'
        ? {
            moduleId: selectedBioModuleId,
            ...biologyContext.params,
          }
        : {
            mode: astronomyParams.mode,
            semiMajorAxis: astronomyParams.customSemiMajorAxisAu,
            starMass: astronomyParams.centralStarMassSolar,
          };

    syncStudentTelemetry({
      domain: activeDomain,
      topic: currentExperimentModule.title,
      moduleId: currentExperimentModule.id,
      moduleTitle: currentExperimentModule.title,
      trialsCount: records.length,
      recordsCount: records.length,
      currentParameters: currentParams,
      rSquared: records.length >= 2 ? 0.985 : 0,
      currentActivity: records.length >= 3 ? 'Selesai' : 'Aktif',
      status: records.length >= 3 ? 'Selesai' : 'Aktif',
    });
  }, [
    activeDomain,
    currentExperimentModule,
    physicsParams.mode,
    physicsParams.mass,
    physicsParams.appliedForce,
    physicsParams.inclineAngle,
    physicsParams.gravity,
    chemistryParams.mode,
    chemistryParams.initialTempC,
    chemistryParams.reactantConcentration,
    chemistryParams.titrantAddedMl,
    selectedBioModuleId,
    biologyContext.params,
    astronomyParams.mode,
    astronomyParams.customSemiMajorAxisAu,
    astronomyParams.centralStarMassSolar,
    records.length,
    userRole,
    syncStudentTelemetry,
  ]);

  // Record slider parameter changes into chronological replay buffer
  useEffect(() => {
    if (userRole !== 'siswa' || isLobbyMode) return;
    if (activeDomain === 'physics') {
      recordTelemetryInteraction('appliedForce', physicsParams.appliedForce, workflowStep, {
        domain: 'Fisika',
        eventType: 'slider',
        note: `Mengubah gaya F = ${physicsParams.appliedForce} N (θ = ${physicsParams.inclineAngle}°)`,
      });
    } else if (activeDomain === 'chemistry') {
      recordTelemetryInteraction('titrantAddedMl', chemistryParams.titrantAddedMl, workflowStep, {
        domain: 'Kimia',
        eventType: 'titration',
        note: `Meneteskan larutan titran (${chemistryParams.titrantAddedMl} mL, T = ${chemistryParams.initialTempC}°C)`,
      });
    } else if (activeDomain === 'astronomy') {
      recordTelemetryInteraction('semiMajorAxisAu', astronomyParams.customSemiMajorAxisAu, workflowStep, {
        domain: 'Astronomi',
        eventType: 'slider',
        note: `Mengubah sumbu semi-mayor orbit (${astronomyParams.customSemiMajorAxisAu} AU)`,
      });
    }
  }, [
    userRole,
    isLobbyMode,
    activeDomain,
    workflowStep,
    physicsParams.appliedForce,
    physicsParams.inclineAngle,
    chemistryParams.titrantAddedMl,
    chemistryParams.initialTempC,
    astronomyParams.customSemiMajorAxisAu,
  ]);

  // Sync live telemetry context to Full-Duplex Voice Mentor
  useEffect(() => {
    aiVoiceAssistant.updateLiveLabContext({
      domain: activeScienceDomain,
      academicLevel,
      physicsParams,
      chemistryParams,
      astronomyParams,
      biologyContext,
      records,
    });
  }, [
    activeScienceDomain,
    academicLevel,
    physicsParams,
    chemistryParams,
    astronomyParams,
    biologyContext,
    records,
  ]);

  const handleRecordExperiment = useCallback(
    (
      domain: ScienceDomain,
      title: string,
      paramsSummary: string,
      keyMetrics: Record<string, number | string>,
      noteText: string,
      numericCoords?: { x: number; y1: number; y2: number }
    ) => {
      addRecord({
        id: `EXP-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        studentName: currentProfile.name,
        groupId: currentProfile.group,
        domain,
        experimentTitle: title,
        parametersSummary: paramsSummary,
        keyMetrics,
        numericX: numericCoords?.x,
        numericY1: numericCoords?.y1,
        numericY2: numericCoords?.y2,
        notes: noteText,
      });
      labSound.playRecordSuccess();

      recordTelemetryInteraction(
        numericCoords ? `Data(${numericCoords.x})` : title,
        numericCoords?.y1 ?? records.length + 1,
        workflowStep,
        {
          domain,
          eventType: 'record',
          note: `Mencatat data ${title} (${paramsSummary})`,
          force: true,
        }
      );

      evaluateDataPrecisionXP(0.992, domain, currentExperimentModule.id);
    },
    [addRecord, currentExperimentModule.id, currentProfile.group, currentProfile.name, records.length, workflowStep]
  );

  const handleCapture3DSnapshot = useCallback(
    (
      domain: ScienceDomain,
      dataUrl: string,
      modTitle: string,
      pSum: string,
      pMetric: string
    ) => {
      const newSnap: Lab3DSnapshot = {
        id: `snap-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        dataUrl,
        moduleTitle: modTitle,
        domain,
        paramsSummary: pSum,
        primaryMetric: pMetric,
      };
      setCapturedSnapshots((prev) => [newSnap, ...prev]);
      pushNotification({
        id: `notif-snap-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        severity: 'nominal',
        domain,
        title: 'Tangkapan Layar 3D WebGL Tersimpan',
        message: `Snapshot visual untuk ${modTitle} berhasil ditambahkan ke galeri laporan.`,
      });
    },
    [pushNotification]
  );

  const submitQuizScore = useCallback(
    (studentName: string, score: number, correctCount: number) => {
      setLatestLksScore(score);
      setLksGraded(true);
      backendSubmitQuizScore(studentName, score, correctCount);
    },
    [backendSubmitQuizScore]
  );

  const reportData = useMemo(() => {
    return {
      studentName: currentProfile.name,
      studentId: currentProfile.name.toLowerCase().replace(/\s+/g, '-'),
      groupId: currentProfile.group,
      tier: activeTierLabel,
      dateStr: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      timeStr: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      dateString: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      academicLevel: activeTierLabel,
      experimentTitle: currentExperimentModule.title,
      domain: currentExperimentModule.domain,
      hypothesisText: currentModuleHypothesis.hypothesisText,
      reflectionText: currentModuleHypothesis.reflectionText,
      records,
      lksScore: latestLksScore,
      snapshotDataUrl: capturedSnapshots[0]?.dataUrl,
    };
  }, [
    currentProfile,
    activeTierLabel,
    currentExperimentModule,
    currentModuleHypothesis,
    records,
    latestLksScore,
    capturedSnapshots,
  ]);

  return {
    activeTierLabel,
    lksGraded,
    setLksGraded,
    latestLksScore,
    setLatestLksScore,
    completedChallengeIds,
    setCompletedChallengeIds,
    capturedSnapshots,
    setCapturedSnapshots,
    reportData,
    handleRecordExperiment,
    handleCapture3DSnapshot,
    submitQuizScore,
  };
}
