import { useState, useMemo, useEffect } from 'react';
import {
  ScienceDomain,
  exportRecordsToCSV,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import { HypothesisNote } from '../components/ui/HypothesisAndCompareDock';
import { Lab3DSnapshot } from '../components/ui/ScientificEnhancementSuite';
import {
  ExperimentModule,
  EducationTier,
  getExperimentById,
  EXPERIMENT_CATALOG,
} from '../registry/experimentRegistry';
import { useLabStore } from '../stores/useLabStore';
import { useUIStore } from '../stores/useUIStore';
import { useCollabStore } from '../stores/useCollabStore';
import { useBackendSync } from './useBackendSync';
import { useSpatialCollab } from './useSpatialCollab';
import {
  STUDENT_PROFILES,
  INITIAL_PHYSICS_PARAMS,
  INITIAL_CHEMISTRY_PARAMS,
  INITIAL_BIOLOGY_CONTEXT,
  INITIAL_ASTRONOMY_PARAMS,
} from '../stores/initialLabParams';
import { recordTelemetryInteraction } from '../utils/telemetryRecorder';
import {
  evaluateDataPrecisionXP,
  saveLastOpenedModuleId,
} from '../services/gamificationEngine';
import { aiVoiceAssistant } from '../services/aiVoiceAssistant';
import { LAB_EVENTS } from '../utils/labEventBus';


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
    setAcademicLevel,
  } = useLabStore();

  const { comfortPrefs } = useUIStore();
  const { setWsConnected } = useCollabStore();

  const [selectedProfileIdx, setSelectedProfileIdx] = useState<number>(0);
  const currentProfile = STUDENT_PROFILES[selectedProfileIdx] ?? STUDENT_PROFILES[0];
  const [selectedBioModuleId, setSelectedBioModuleId] = useState<string>('photosynthesis-ingenhousz');
  const [lksGraded, setLksGraded] = useState<boolean>(false);
  const [latestLksScore, setLatestLksScore] = useState<number>(0);
  const [completedChallengeIds, setCompletedChallengeIds] = useState<string[]>([]);
  const [capturedSnapshots, setCapturedSnapshots] = useState<Lab3DSnapshot[]>([]);
  const [externalDrLabMuPrompt, setExternalDrLabMuPrompt] = useState<{ id: number; prompt: string } | null>(null);

  // Sync Comfort Preferences with DOM root attributes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-comfort-theme', comfortPrefs.theme);
    root.setAttribute('data-font-scale', comfortPrefs.fontScale);
    root.setAttribute('data-line-spacing', comfortPrefs.lineSpacing);
    root.setAttribute('data-colorblind', comfortPrefs.colorBlindSafe ? 'true' : 'false');
    if (comfortPrefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [comfortPrefs]);

  useEffect(() => {
    labSound.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Simulation parameters for all 4 science domains
  const [physicsParams, setPhysicsParams] = useState(INITIAL_PHYSICS_PARAMS);
  const [chemistryParams, setChemistryParams] = useState(INITIAL_CHEMISTRY_PARAMS);
  const [biologyContext, setBiologyContext] = useState(INITIAL_BIOLOGY_CONTEXT);
  const [astronomyParams, setAstronomyParams] = useState(INITIAL_ASTRONOMY_PARAMS);

  const [hypothesisNotesByModule, setHypothesisNotesByModule] = useState<Record<string, HypothesisNote>>(() => {
    try {
      const saved = window.localStorage.getItem('simulab-hypothesis-notes');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      'newton-incline': {
        independentVar: 'Gaya Dorong (F) dan Sudut Kemiringan (θ)',
        dependentVar: 'Percepatan Balok (a)',
        hypothesisText:
          'Semakin besar gaya dorong F pada massa tetap, maka percepatan balok a akan meningkat secara linier sesuai Hukum II Newton (a = ΣF/m).',
        reflectionText:
          'Data eksperimen menunjukkan hubungan linier kuat (R² > 0.98) antara ΣF dan percepatan.',
        updatedAt: '08:45',
      },
    };
  });

  // Real-time backend synchronization hook
  const {
    records,
    tasks,
    notes,
    students,
    notifications,
    activeMysteryChallenge,
    mysterySubmissions,
    wsConnected: syncWsConnected,
    ws,
    addRecord,
    deleteRecord,
    clearRecords,
    toggleTask,
    createTask,
    createNote,
    submitQuizScore: backendSubmitQuizScore,
    pushNotification,
    broadcastTeacherFeedback,
    broadcastMysteryChallenge,
    submitMysteryExam,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleTeacherFreeze,
    syncStudentTelemetry,
  } = useBackendSync(
    currentProfile.name,
    currentProfile.group,
    userRole === 'pengajar' ? 'Pengajar' : 'Siswa',
    activeDomain === 'physics'
      ? 'fisika'
      : activeDomain === 'chemistry'
      ? 'kimia'
      : activeDomain === 'biology'
      ? 'biologi'
      : 'astronomi'
  );

  useEffect(() => {
    setWsConnected(syncWsConnected);
  }, [syncWsConnected, setWsConnected]);

  // Spatial 3D Multi-User Collaboration Hook
  const currentUserId = currentProfile.name.toLowerCase().replace(/\s+/g, '-');
  const {
    remoteCursors,
    paramLocks,
    emitCursor3D,
    acquireParamLock,
    releaseParamLock,
  } = useSpatialCollab({
    ws,
    userId: currentUserId,
    userName: currentProfile.name,
    role: userRole === 'pengajar' ? 'Pengajar' : 'Siswa',
    groupId: currentProfile.group,
    domain:
      activeDomain === 'physics'
        ? 'fisika'
        : activeDomain === 'chemistry'
        ? 'kimia'
        : activeDomain === 'biology'
        ? 'biologi'
        : 'astronomi',
    onRemoteParamSync: (paramKey, value) => {
      if (activeDomain === 'physics') {
        setPhysicsParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeDomain === 'chemistry') {
        setChemistryParams((prev) => ({ ...prev, [paramKey]: value }));
      } else if (activeDomain === 'astronomy') {
        setAstronomyParams((prev) => ({ ...prev, [paramKey]: value }));
      }
    },
  });

  // Current Experiment Module Resolver
  const currentExperimentModule = useMemo(() => {
    const domainDefaultMap: Record<string, string> = {
      physics: 'newton-incline',
      chemistry: 'thermo-calorimetry',
      biology: selectedBioModuleId,
      astronomy: 'solar-kepler',
    };
    const modId = activeModuleId || domainDefaultMap[activeDomain] || 'newton-incline';
    return getExperimentById(modId) ?? EXPERIMENT_CATALOG[0];
  }, [activeDomain, activeModuleId, selectedBioModuleId]);

  const activeScienceDomain: ScienceDomain =
    activeDomain === 'chemistry'
      ? 'Kimia'
      : activeDomain === 'biology'
      ? 'Biologi'
      : activeDomain === 'astronomy'
      ? 'Astronomi'
      : 'Fisika';

  // Sync live student telemetry to room when parameters or records change (Fitur 1)
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

  const currentModuleHypothesis = hypothesisNotesByModule[currentExperimentModule.id] ?? {
    independentVar: 'Variabel Bebas',
    dependentVar: 'Variabel Terikat',
    hypothesisText: '',
    reflectionText: '',
    updatedAt: '',
  };

  const handleUpdateCurrentHypothesis = (next: HypothesisNote) => {
    setHypothesisNotesByModule((prev) => {
      const updated = { ...prev, [currentExperimentModule.id]: next };
      try {
        window.localStorage.setItem('simulab-hypothesis-notes', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleRecordExperiment = (
    domain: ScienceDomain,
    title: string,
    paramsSummary: string,
    keyMetrics: Record<string, number | string>,
    noteText: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => {
    addRecord({
      id: `EXP-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

    // FITUR 3: Rekam titik data ke buffer telemetri kronologis
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

    // FITUR 1: Berikan XP presisi data saat mencatat titik uji
    evaluateDataPrecisionXP(0.992, domain, currentExperimentModule.id);
  };

  const handleCapture3DSnapshot = (
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
  };

  // Synchronize domain simulation mode whenever activeModuleId changes
  useEffect(() => {
    const physicsModeMap: Record<string, typeof physicsParams.mode> = {
      'newton-incline': 'newton-incline',
      'projectile-motion': 'projectile-gravity',
      'projectile-gravity': 'projectile-gravity',
      'pendulum-harmonic': 'pendulum-harmonic',
      'spring-hooke': 'spring-hooke',
      'collision-momentum': 'collision-momentum',
      'stokes-viscosity': 'stokes-viscosity',
      'ohm-wheatstone': 'ohm-wheatstone',
      'optics-young-slit': 'optics-young-slit',
      'photoelectric-planck': 'photoelectric-planck',
      'gravity-orbital': 'orbital-gravity',
      'orbital-gravity': 'orbital-gravity',
    };
    const chemistryModeMap: Record<string, typeof chemistryParams.mode> = {
      'thermo-calorimetry': 'thermo-calorimetry',
      'acid-base-titration': 'acid-base-titration',
      'redox-electrochemistry': 'electrochemistry-cell',
      'electrochemistry-cell': 'electrochemistry-cell',
      'ideal-gas-boyle': 'ideal-gas-boyle',
      'reaction-kinetics-arrhenius': 'reaction-kinetics-arrhenius',
      'spectrophotometry-beer': 'spectrophotometry-beer',
    };
    const astronomyModeMap: Record<string, typeof astronomyParams.mode> = {
      'solar-kepler': 'solar-kepler',
      'milky-way-rotation': 'milkyway-galaxy',
      'exoplanet-transit': 'stellar-exoplanet',
      'stellar-wien-spectrum': 'stellar-wien-spectrum',
      'hubble-expansion': 'hubble-expansion',
    };

    if (physicsModeMap[activeModuleId]) {
      const targetMode = physicsModeMap[activeModuleId];
      setPhysicsParams((prev) =>
        prev.mode === targetMode
          ? prev
          : {
              ...prev,
              mode: targetMode,
              initialVelocity:
                targetMode === 'projectile-gravity' && prev.initialVelocity <= 0
                  ? 22
                  : prev.initialVelocity,
            }
      );
    } else if (chemistryModeMap[activeModuleId]) {
      setChemistryParams((prev) =>
        prev.mode === chemistryModeMap[activeModuleId]
          ? prev
          : { ...prev, mode: chemistryModeMap[activeModuleId] }
      );
    } else if (astronomyModeMap[activeModuleId]) {
      setAstronomyParams((prev) =>
        prev.mode === astronomyModeMap[activeModuleId]
          ? prev
          : { ...prev, mode: astronomyModeMap[activeModuleId] }
      );
    } else if (
      [
        'photosynthesis-ingenhousz',
        'enzyme-catalase',
        'predator-prey-dynamics',
        'osmosis-plasmolysis',
      ].includes(activeModuleId)
    ) {
      setSelectedBioModuleId(activeModuleId);
    }
  }, [activeModuleId]);

  const handleSelectCatalogModule = (mod: ExperimentModule) => {
    labSound.playClick();
    saveLastOpenedModuleId(mod.id);
    setActiveModule(mod.id);
    setActiveDomain(mod.domain.toLowerCase() as any);
    if ((mod.domain as string).toLowerCase() === 'biologi') {
      setSelectedBioModuleId(mod.id);
    }
    setIsLobbyMode(false);
    setWorkflowStep(1);
  };

  const activeTierLabel: EducationTier =
    academicLevel === 'smp' ? 'SMP' : academicLevel === 'mahasiswa' ? 'Mahasiswa' : 'SMA';

  const reportData = useMemo(() => {
    return {
      studentName: currentProfile.name,
      studentId: currentProfile.name.toLowerCase().replace(/\s+/g, '-'),
      groupId: currentProfile.group,
      tier: activeTierLabel,
      dateStr: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      timeStr: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      dateString: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      academicLevel: activeTierLabel,
      experimentTitle: currentExperimentModule.title,
      domain: currentExperimentModule.domain,
      hypothesisText: currentModuleHypothesis.hypothesisText,
      reflectionText: currentModuleHypothesis.reflectionText,
      records,
      lksScore: latestLksScore,
      snapshotDataUrl: capturedSnapshots[0]?.dataUrl,
    };
  }, [currentProfile, activeTierLabel, currentExperimentModule, currentModuleHypothesis, records, latestLksScore, capturedSnapshots]);

  // FITUR 3: Rekam perubahan slider parameter siswa ke buffer telemetri
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

  // Fase 1 — Tugas 1 & 2: Sinkronkan telemetri ke Asisten Suara Full-Duplex & tangani interaksi Laser Pointer VR
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

  useEffect(() => {
    const onXRSpatialSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ parameterDelta?: number }>).detail;
      const stepDir = detail?.parameterDelta && detail.parameterDelta < 0 ? -1 : 1;
      labSound.playClick(stepDir > 0 ? 740 : 560);

      if (activeDomain === 'physics') {
        setPhysicsParams((prev) => ({
          ...prev,
          appliedForce: Math.max(5, Math.min(100, prev.appliedForce + stepDir * 5)),
        }));
      } else if (activeDomain === 'chemistry') {
        setChemistryParams((prev) => ({
          ...prev,
          titrantAddedMl: Number(
            Math.max(0, Math.min(50, prev.titrantAddedMl + stepDir * 1.5)).toFixed(1)
          ),
        }));
      } else if (activeDomain === 'astronomy') {
        setAstronomyParams((prev) => ({
          ...prev,
          customSemiMajorAxisAu: Number(
            Math.max(0.4, Math.min(10, prev.customSemiMajorAxisAu + stepDir * 0.25)).toFixed(2)
          ),
        }));
      }
    };

    const onScaffoldingAskDrLabMu = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          prompt: string;
        }>
      ).detail;
      if (detail?.prompt) {
        setExternalDrLabMuPrompt({
          id: Date.now(),
          prompt: detail.prompt,
        });
      }
    };

    window.addEventListener('ruanglab:xr-spatial-select', onXRSpatialSelect);
    window.addEventListener(LAB_EVENTS.SCAFFOLDING_ASK_DR_LABMU, onScaffoldingAskDrLabMu);
    return () => {
      window.removeEventListener('ruanglab:xr-spatial-select', onXRSpatialSelect);
      window.removeEventListener(LAB_EVENTS.SCAFFOLDING_ASK_DR_LABMU, onScaffoldingAskDrLabMu);
    };
  }, [activeDomain]);

  return {
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
    clearRecords,
    handleRotateGroup: (nextStudentName: string, nextGroupId: string) => {
      clearRecords();
      setLksGraded(false);
      setLatestLksScore(0);
      const foundIdx = STUDENT_PROFILES.findIndex(
        (p) =>
          p.group.toLowerCase().includes(nextGroupId.toLowerCase()) ||
          p.name.toLowerCase().includes(nextStudentName.toLowerCase())
      );
      if (foundIdx !== -1) {
        setSelectedProfileIdx(foundIdx);
      }
    },
    exportRecordsToCSV,
    submitQuizScore: (studentName: string, score: number, correctCount: number) => {
      setLatestLksScore(score);
      setLksGraded(true);
      backendSubmitQuizScore(studentName, score, correctCount);
    },
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
    syncStudentTelemetry,
    ws,
  };
}

