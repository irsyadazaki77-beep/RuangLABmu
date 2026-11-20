import { useState, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { exportRecordsToCSV } from '../utils/scienceEngine';
import { ExperimentModule } from '../registry/experimentRegistry';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';
import { useCollabStore } from '../stores/useCollabStore';
import { STUDENT_PROFILES } from '../stores/initialLabParams';
import { saveLastOpenedModuleId } from '../services/gamificationEngine';
import { useLabParamsSync } from './useLabParamsSync';
import { useLabCollabBridge } from './useLabCollabBridge';
import { useLabTelemetryAndXP } from './useLabTelemetryAndXP';
import { useLabSessionAutoSave } from './useLabSessionAutoSave';
import { useRoomSocket } from './useRoomSocket';
import { useSimulationSync } from './useSimulationSync';
import { useGradebookSubmit } from './useGradebookSubmit';
import { shouldShowConceptLabelsByDefault } from '../utils/pedagogicalHelpers';

const EMPTY_LKS_ANSWERS: Record<string, string> = {};

export function useLabSession() {
  const {
    activeDomain,
    setActiveDomain,
    activeModuleId,
    setActiveModule,
    soundEnabled,
    workflowStep,
    setWorkflowStep,
    userRole,
    isLobbyMode,
    setIsLobbyMode,
    academicLevel,
  } = useLabStore(
    useShallow((s) => ({
      activeDomain: s.activeDomain,
      setActiveDomain: s.setActiveDomain,
      activeModuleId: s.activeModuleId,
      setActiveModule: s.setActiveModule,
      soundEnabled: s.soundEnabled,
      workflowStep: s.workflowStep,
      setWorkflowStep: s.setWorkflowStep,
      userRole: s.userRole,
      isLobbyMode: s.isLobbyMode,
      setIsLobbyMode: s.setIsLobbyMode,
      academicLevel: s.academicLevel,
    }))
  );

  const activeRoom = useCollabStore((s) => s.activeRoom);
  const comfortPrefs = useUIStore((s) => s.comfortPrefs);
  const setShowConceptLabels = useUIStore((s) => s.setShowConceptLabels);

  useEffect(() => {
    setShowConceptLabels(shouldShowConceptLabelsByDefault(academicLevel));
  }, [academicLevel, setShowConceptLabels]);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState<number>(0);
  const currentProfile = STUDENT_PROFILES[selectedProfileIdx] ?? STUDENT_PROFILES[0];

  const paramsSync = useLabParamsSync({
    activeDomain,
    activeModuleId,
    soundEnabled,
    comfortPrefs,
    setActiveDomain,
    setActiveModule,
    setIsLobbyMode,
    setWorkflowStep,
  });

  const collabBridge = useLabCollabBridge({
    studentName: currentProfile.name,
    groupName: currentProfile.group,
    userRole,
    activeDomain,
    setPhysicsParams: paramsSync.setPhysicsParams,
    setChemistryParams: paramsSync.setChemistryParams,
    setAstronomyParams: paramsSync.setAstronomyParams,
  });

  const sendWsMessage = useCallback(
    (type: string, payload: unknown) => {
      if (collabBridge.ws && collabBridge.ws.readyState === WebSocket.OPEN) {
        collabBridge.ws.send(JSON.stringify({ type, payload }));
      }
    },
    [collabBridge.ws]
  );

  const handleSnapshotRestored = useCallback(
    (restoredParams: Record<string, unknown>) => {
      if (restoredParams.physicsParams && typeof restoredParams.physicsParams === 'object') {
        paramsSync.setPhysicsParams((prev) => ({
          ...prev,
          ...(restoredParams.physicsParams as Record<string, number>),
        }));
      }
      if (
        restoredParams.chemistryParams &&
        typeof restoredParams.chemistryParams === 'object'
      ) {
        paramsSync.setChemistryParams((prev) => ({
          ...prev,
          ...(restoredParams.chemistryParams as Record<string, number>),
        }));
      }
      if (
        restoredParams.astronomyParams &&
        typeof restoredParams.astronomyParams === 'object'
      ) {
        paramsSync.setAstronomyParams((prev) => ({
          ...prev,
          ...(restoredParams.astronomyParams as Record<string, number>),
        }));
      }
    },
    [paramsSync]
  );

  const roomSocket = useRoomSocket({
    activeRoom,
    currentUserId: currentProfile.name,
    currentUserName: currentProfile.name,
    currentUserRole: userRole,
    activeGroupId: currentProfile.group,
    sendMessage: sendWsMessage,
    onSnapshotRestored: handleSnapshotRestored,
  });

  const simulationSync = useSimulationSync({
    roomPin: roomSocket.roomPin,
    roomId: roomSocket.roomId,
    sendMessage: sendWsMessage,
  });

  const gradebookSubmit = useGradebookSubmit();

  useEffect(() => {
    if (!roomSocket.roomPin) return;
    simulationSync.scheduleSnapshotSync({
      domain: activeDomain,
      moduleId: activeModuleId,
      physicsParams: paramsSync.physicsParams,
      chemistryParams: paramsSync.chemistryParams,
      astronomyParams: paramsSync.astronomyParams,
    });
  }, [
    roomSocket.roomPin,
    activeDomain,
    activeModuleId,
    paramsSync.physicsParams,
    paramsSync.chemistryParams,
    paramsSync.astronomyParams,
    simulationSync,
  ]);

  const telemetry = useLabTelemetryAndXP({
    activeDomain,
    activeScienceDomain: paramsSync.activeScienceDomain,
    academicLevel,
    userRole,
    isLobbyMode,
    workflowStep,
    currentExperimentModule: paramsSync.currentExperimentModule,
    currentModuleHypothesis: paramsSync.currentModuleHypothesis,
    currentProfile,
    physicsParams: paramsSync.physicsParams,
    chemistryParams: paramsSync.chemistryParams,
    biologyContext: paramsSync.biologyContext,
    astronomyParams: paramsSync.astronomyParams,
    selectedBioModuleId: paramsSync.selectedBioModuleId,
    records: collabBridge.records,
    addRecord: collabBridge.addRecord,
    pushNotification: collabBridge.pushNotification,
    syncStudentTelemetry: collabBridge.syncStudentTelemetry,
    backendSubmitQuizScore: collabBridge.submitQuizScore,
  });

  const autoSave = useLabSessionAutoSave({
    studentId: currentProfile.name,
    activeModuleId,
    activeWorkflowStep: workflowStep,
    recordedTrials: collabBridge.records,
    lksAnswers: EMPTY_LKS_ANSWERS,
    safetyPledgeAgreed: workflowStep > 1,
    physicsParams: paramsSync.physicsParams,
    chemistryParams: paramsSync.chemistryParams,
    astronomyParams: paramsSync.astronomyParams,
    isLobbyMode,
  });

  const handleSelectCatalogModule = useCallback(
    (mod: ExperimentModule) => {
      paramsSync.handleSelectCatalogModule(mod, saveLastOpenedModuleId);
    },
    [paramsSync]
  );

  const handleRotateGroup = useCallback(
    (nextStudentName: string, nextGroupId: string) => {
      collabBridge.clearRecords();
      telemetry.setLksGraded(false);
      telemetry.setLatestLksScore(0);
      const foundIdx = STUDENT_PROFILES.findIndex(
        (p) =>
          p.group.toLowerCase().includes(nextGroupId.toLowerCase()) ||
          p.name.toLowerCase().includes(nextStudentName.toLowerCase())
      );
      if (foundIdx !== -1) {
        setSelectedProfileIdx(foundIdx);
      }
    },
    [collabBridge, telemetry]
  );

  return {
    currentExperimentModule: paramsSync.currentExperimentModule,
    activeScienceDomain: paramsSync.activeScienceDomain,
    activeTierLabel: telemetry.activeTierLabel,
    currentProfile,
    selectedProfileIdx,
    setSelectedProfileIdx,
    records: collabBridge.records,
    tasks: collabBridge.tasks,
    notes: collabBridge.notes,
    students: collabBridge.students,
    notifications: collabBridge.notifications,
    lksGraded: telemetry.lksGraded,
    setLksGraded: telemetry.setLksGraded,
    latestLksScore: telemetry.latestLksScore,
    capturedSnapshots: telemetry.capturedSnapshots,
    setCapturedSnapshots: telemetry.setCapturedSnapshots,
    completedChallengeIds: telemetry.completedChallengeIds,
    setCompletedChallengeIds: telemetry.setCompletedChallengeIds,
    currentModuleHypothesis: paramsSync.currentModuleHypothesis,
    physicsParams: paramsSync.physicsParams,
    setPhysicsParams: paramsSync.setPhysicsParams,
    chemistryParams: paramsSync.chemistryParams,
    setChemistryParams: paramsSync.setChemistryParams,
    biologyContext: paramsSync.biologyContext,
    setBiologyContext: paramsSync.setBiologyContext,
    astronomyParams: paramsSync.astronomyParams,
    setAstronomyParams: paramsSync.setAstronomyParams,
    selectedBioModuleId: paramsSync.selectedBioModuleId,
    setSelectedBioModuleId: paramsSync.setSelectedBioModuleId,
    activeMysteryChallenge: collabBridge.activeMysteryChallenge,
    mysterySubmissions: collabBridge.mysterySubmissions,
    remoteCursors: collabBridge.remoteCursors,
    paramLocks: collabBridge.paramLocks,
    emitCursor3D: collabBridge.emitCursor3D,
    acquireParamLock: collabBridge.acquireParamLock,
    releaseParamLock: collabBridge.releaseParamLock,
    externalDrLabMuPrompt: paramsSync.externalDrLabMuPrompt,
    setExternalDrLabMuPrompt: paramsSync.setExternalDrLabMuPrompt,
    reportData: telemetry.reportData,
    deleteRecord: collabBridge.deleteRecord,
    clearRecords: collabBridge.clearRecords,
    handleRotateGroup,
    exportRecordsToCSV,
    submitQuizScore: telemetry.submitQuizScore,
    handleRecordExperiment: telemetry.handleRecordExperiment,
    pushNotification: collabBridge.pushNotification,
    broadcastTeacherFeedback: collabBridge.broadcastTeacherFeedback,
    broadcastMysteryChallenge: collabBridge.broadcastMysteryChallenge,
    activateMysteryChallenge: collabBridge.activateMysteryChallenge,
    createNote: collabBridge.createNote,
    createTask: collabBridge.createTask,
    toggleTask: collabBridge.toggleTask,
    handleCapture3DSnapshot: telemetry.handleCapture3DSnapshot,
    submitMysteryExam: collabBridge.submitMysteryExam,
    dismissMysteryChallenge: collabBridge.dismissMysteryChallenge,
    handleUpdateCurrentHypothesis: paramsSync.handleUpdateCurrentHypothesis,
    handleSelectCatalogModule,
    createRoom: collabBridge.createRoom,
    joinRoom: collabBridge.joinRoom,
    leaveRoom: collabBridge.leaveRoom,
    toggleTeacherFreeze: collabBridge.toggleTeacherFreeze,
    syncStudentTelemetry: collabBridge.syncStudentTelemetry,
    ws: collabBridge.ws,
    autoSave,
    roomSocket,
    simulationSync,
    gradebookSubmit,
  };
}
