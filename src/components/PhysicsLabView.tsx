import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Eye,
  EyeOff,
  HelpCircle,
  CheckCircle,
  Activity,
  Sliders,
  NotebookPen,
  GitCompareArrows,
} from 'lucide-react';
import {
  PhysicsParams,
  PhysicsMetrics,
  KinematicsInstant,
  GRAVITY_PRESETS,
  AcademicLevel,
  calculatePhysicsMetrics,
  evaluateKinematicsAtTime,
  generateAutomaticFeedback,
  evaluateSafetyHazard,
  GUIDED_LAB_SCENARIOS,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { PhysicsScene3D } from './PhysicsScene3D';
import { labSound } from '../utils/soundEngine';
import { useSimulationWorker } from '../hooks/useSimulationWorker';
import {
  DEFAULT_INSTRUMENTS,
  DEFAULT_CALIBRATION_CONFIG,
  InstrumentCalibrationConfig,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import {
  CircularGaugeMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
  LiveTelemetryOscilloscope,
  InstrumentCalibrationCard,
  CollapsibleLabSection,
  CockpitStepGuideBanner,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  evaluateMysterySubmission,
} from '../utils/mysteryChallengeEngine';
import {
  ContextualMicroGuideHUD,
  HypothesisScratchpadCard,
  ExperimentTrialComparePanel,
  HypothesisNote,
} from './ui/HypothesisAndCompareDock';
import {
  QuickChallengeMissionBanner,
  ABLiveComparisonWidget,
  ABMetricItem,
  TargetChallengeMission,
} from './ui/ScientificEnhancementSuite';
import {
  CompactTelemetryRibbon,
  LabWorkflowStagePill,
  LabWorkflowStage,
} from './ui/CompactTelemetryRibbon';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { useLabStore } from '../stores/useLabStore';

interface PhysicsLabViewProps {
  params: PhysicsParams;
  onChangeParams: (next: PhysicsParams) => void;
  onRecordExperiment: (
    title: string,
    paramsSummary: string,
    metrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup: (summary: string) => void;
  academicLevel?: AcademicLevel;
  currentUserId?: string;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  paramLocks?: Record<string, ParameterLockPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onAcquireLock?: (paramKey: string) => void;
  onReleaseLock?: (paramKey: string) => void;
  onSyncParamValue?: (paramKey: string, value: number) => void;
  records?: ExperimentRecord[];
  activeStudentName?: string;
  activeGroupId?: string;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
  activeMysteryChallenge?: MysterySampleChallenge | null;
  onSubmitMysteryExam?: (
    studentName: string,
    result: MysterySubmissionResult,
    title: string
  ) => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  zenMode?: boolean;
  onCapture3DSnapshot?: (
    dataUrl: string,
    moduleTitle: string,
    paramsSummary: string,
    primaryMetric: string
  ) => void;
  snapshotCount?: number;
  completedChallengeIds?: string[];
  onCompleteChallenge?: (challenge: TargetChallengeMission) => void;
}

export const PhysicsLabView: React.FC<PhysicsLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  academicLevel = 'sma',
  currentUserId,
  remoteCursors,
  paramLocks,
  onEmitCursor,
  onAcquireLock,
  onReleaseLock,
  onSyncParamValue,
  records = [],
  activeStudentName = 'Alya Pratama',
  onProceedToAnalysis,
  activeMysteryChallenge,
  onSubmitMysteryExam,
  hypothesisNote,
  onChangeHypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
  completedChallengeIds = [],
  onCompleteChallenge,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const simTimeRef = useRef<number>(0);
  const lastReactRenderRef = useRef<number>(0);
  const storePlaybackSpeed = useLabStore((s) => s.playbackSpeed);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(storePlaybackSpeed || 1.0);
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [noiseEnabled, setNoiseEnabled] = useState<boolean>(false);
  const [calibrationConfig, setCalibrationConfig] =
    useState<InstrumentCalibrationConfig>(DEFAULT_CALIBRATION_CONFIG);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [hazardModalDismissed, setHazardModalDismissed] = useState<boolean>(false);
  const [localHypothesis, setLocalHypothesis] = useState<HypothesisNote>({
    independentVar: 'Gaya Dorong (F) / Sudut (θ)',
    dependentVar: 'Percepatan Benda (a)',
    hypothesisText: '',
    reflectionText: '',
    updatedAt: '',
  });
  const effectiveHypothesis = hypothesisNote ?? localHypothesis;
  const handleUpdateHypothesis = (next: HypothesisNote) => {
    setLocalHypothesis(next);
    if (onChangeHypothesisNote) onChangeHypothesisNote(next);
  };

  useEffect(() => {
    setPlaybackSpeed(storePlaybackSpeed || 1.0);
  }, [storePlaybackSpeed]);

  // Mystery Sample Exam State
  const [mysteryGuessInput, setMysteryGuessInput] = useState<string>('');
  const [mysteryFeedbackResult, setMysteryFeedbackResult] =
    useState<MysterySubmissionResult | null>(null);

  const workerParams = {
    mass: params.mass,
    appliedForce: params.appliedForce,
    inclineAngle: params.inclineAngle,
    frictionCoeffStatic: params.frictionCoeffStatic,
    frictionCoeffKinetic: params.frictionCoeffKinetic,
    gravity: params.gravity,
    initialVelocity: params.initialVelocity,
    launchAngle: params.launchAngle,
    initialHeight: params.initialHeight,
    secondaryMass: params.secondaryMass,
    separationDistance: params.separationDistance,
    collisionMass2: params.collisionMass2,
    velocity2Initial: params.velocity2Initial,
    restitutionCoeff: params.restitutionCoeff,
    springConstantK: params.springConstantK,
    springDisplacement: params.springDisplacement,
    dampingCoeff: params.dampingCoeff,
  };

  const simWorker = useSimulationWorker(params.mode, workerParams);

  useEffect(() => {
    if (simWorker.lastEvent) {
      if (simWorker.lastEvent.event === 'collision') {
        labSound.playCollisionThud(params.restitutionCoeff);
      } else if (simWorker.lastEvent.event === 'ground-hit') {
        labSound.playSnapshotPin();
      }
    }
  }, [simWorker.lastEvent, params.restitutionCoeff]);

  const animRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const collisionSoundPlayedRef = useRef<boolean>(false);

  const metrics: PhysicsMetrics = calculatePhysicsMetrics(params);
  const instant: KinematicsInstant = evaluateKinematicsAtTime(params, simTime);
  const safetyHazard = evaluateSafetyHazard('Fisika', params);

  useEffect(() => {
    if (!safetyHazard.isHazardous) {
      setHazardModalDismissed(false);
    }
  }, [safetyHazard.isHazardous, safetyHazard.hazardCode]);

  const maxSimDuration =
    params.mode === 'projectile-gravity'
      ? Math.max(2, Number((metrics.timeOfFlight + 0.5).toFixed(1)))
      : 8.0;

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTickRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastTickRef.current === null) {
        lastTickRef.current = timestamp;
      }
      const dt = Math.min(0.1, ((timestamp - lastTickRef.current) / 1000) * playbackSpeed);
      lastTickRef.current = timestamp;

      const prev = simTimeRef.current;
      let next = prev + dt;

      if (
        params.mode === 'collision-momentum' &&
        prev < 1.5 &&
        next >= 1.5 &&
        !collisionSoundPlayedRef.current
      ) {
        collisionSoundPlayedRef.current = true;
        labSound.playCollisionThud(params.restitutionCoeff);
      }

      if (next >= maxSimDuration) {
        next = 0;
        collisionSoundPlayedRef.current = false;
      }

      simTimeRef.current = next;

      // Throttle React reconciliation to ~10 FPS for UI readouts, while Three.js reads simTimeRef at 60 FPS
      if (timestamp - lastReactRenderRef.current > 100) {
        lastReactRenderRef.current = timestamp;
        setSimTime(next);
      }

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, playbackSpeed, params.mode, params.restitutionCoeff, maxSimDuration]);

  const handleParamUpdate = (patch: Partial<PhysicsParams>) => {
    onChangeParams({ ...params, ...patch });
    if (onSyncParamValue) {
      for (const [key, val] of Object.entries(patch)) {
        if (typeof val === 'number') {
          onSyncParamValue(key, val);
        }
      }
    }
  };

  const getLockedByName = (paramKey: string): string | undefined => {
    const lock = paramLocks?.[paramKey];
    if (lock && lock.lockedByUserId !== currentUserId) {
      return lock.lockedByName;
    }
    return undefined;
  };

  const handleStartSimulation = () => {
    labSound.playClick(700);
    collisionSoundPlayedRef.current = false;
    if (simTime >= maxSimDuration - 0.1) {
      simTimeRef.current = 0;
      setSimTime(0);
    }
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    useLabStore.getState().setIsSimulating(nextPlay);
    if (nextPlay) {
      if (params.mode === 'spring-hooke') {
        labSound.playSpringTwang(params.springDisplacement);
      }
      const fb = generateAutomaticFeedback('Fisika', params);
      onPushNotification(fb);
    }
  };

  const handleResetSimulation = () => {
    labSound.playClick(460);
    collisionSoundPlayedRef.current = false;
    setIsPlaying(false);
    useLabStore.getState().setIsSimulating(false);
    simTimeRef.current = 0;
    setSimTime(0);
  };

  useEffect(() => {
    const unsubToggle = subscribeLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, (detail) => {
      setIsPlaying((prev) => {
        const next = typeof detail?.isSimulating === 'boolean' ? detail.isSimulating : !prev;
        useLabStore.getState().setIsSimulating(next);
        return next;
      });
    });
    const unsubReset = subscribeLabEvent(LAB_EVENTS.RESET_TRIAL, () => {
      collisionSoundPlayedRef.current = false;
      setIsPlaying(false);
      useLabStore.getState().setIsSimulating(false);
      simTimeRef.current = 0;
      setSimTime(0);
    });
    const unsubSpeed = subscribeLabEvent(LAB_EVENTS.CHANGE_SPEED, (detail) => {
      if (detail?.speed) {
        setPlaybackSpeed(detail.speed);
      }
    });
    return () => {
      unsubToggle();
      unsubReset();
      unsubSpeed();
    };
  }, []);

  const handleRecordClick = () => {
    labSound.playRecordSuccess();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 260);

    let modeLabel = '';
    let summary = '';
    let keyMetrics: Record<string, number | string> = {};
    let numericCoords = {
      x: params.mass,
      y1: metrics.acceleration,
      y2: metrics.netForce,
    };

    if (params.mode === 'newton-incline') {
      const mA = applyInstrumentNoise(
        metrics.acceleration,
        DEFAULT_INSTRUMENTS.dynamometer,
        noiseEnabled || !calibrationConfig.isZeroCalibrated,
        calibrationConfig
      );
      const mF = applyInstrumentNoise(
        metrics.netForce,
        DEFAULT_INSTRUMENTS.dynamometer,
        noiseEnabled || !calibrationConfig.isZeroCalibrated,
        calibrationConfig
      );
      const mV = applyInstrumentNoise(
        instant.speed,
        DEFAULT_INSTRUMENTS.stopwatch,
        noiseEnabled || !calibrationConfig.isZeroCalibrated,
        calibrationConfig
      );

      modeLabel = `Hukum II Newton & Bidang Miring (θ=${params.inclineAngle}°)`;
      summary = `m=${params.mass}kg, F=${params.appliedForce}N, θ=${params.inclineAngle}°, μk=${params.frictionCoeffKinetic}, g=${params.gravity}m/s²`;
      keyMetrics = {
        ΣF: noiseEnabled
          ? formatMeasurementWithUncertainty(mF.measuredValue, mF.uncertainty, 'N')
          : `${metrics.netForce} N`,
        Percepatan: noiseEnabled
          ? formatMeasurementWithUncertainty(mA.measuredValue, mA.uncertainty, 'm/s²')
          : `${metrics.acceleration} m/s²`,
        'Kecepatan (t)': noiseEnabled
          ? formatMeasurementWithUncertainty(mV.measuredValue, mV.uncertainty, 'm/s')
          : `${instant.speed} m/s`,
        'Energi Kinetik': `${instant.kineticEnergy} J`,
      };
      numericCoords = {
        x: params.appliedForce,
        y1: noiseEnabled ? mA.measuredValue : metrics.acceleration,
        y2: instant.kineticEnergy,
      };
    } else if (params.mode === 'projectile-gravity') {
      const mR = applyInstrumentNoise(
        metrics.projectileRange,
        DEFAULT_INSTRUMENTS.ruler,
        noiseEnabled
      );
      const mH = applyInstrumentNoise(
        metrics.maxProjectileHeight,
        DEFAULT_INSTRUMENTS.ruler,
        noiseEnabled
      );
      const mT = applyInstrumentNoise(
        metrics.timeOfFlight,
        DEFAULT_INSTRUMENTS.stopwatch,
        noiseEnabled
      );

      modeLabel = `Kinematika Projektil (∠=${params.launchAngle}°, g=${params.gravity} m/s²)`;
      summary = `m=${params.mass}kg, v₀=${params.initialVelocity}m/s, ∠=${params.launchAngle}°, h₀=${params.initialHeight}m, g=${params.gravity}m/s²`;
      keyMetrics = {
        'Jarak Maks (R)': noiseEnabled
          ? formatMeasurementWithUncertainty(mR.measuredValue, mR.uncertainty, 'm')
          : `${metrics.projectileRange} m`,
        'Tinggi Puncak (H)': noiseEnabled
          ? formatMeasurementWithUncertainty(mH.measuredValue, mH.uncertainty, 'm')
          : `${metrics.maxProjectileHeight} m`,
        'Waktu Tempuh': noiseEnabled
          ? formatMeasurementWithUncertainty(mT.measuredValue, mT.uncertainty, 's')
          : `${metrics.timeOfFlight} s`,
      };
      numericCoords = {
        x: params.initialVelocity,
        y1: noiseEnabled ? mR.measuredValue : metrics.projectileRange,
        y2: noiseEnabled ? mH.measuredValue : metrics.maxProjectileHeight,
      };
    } else if (params.mode === 'collision-momentum') {
      const mV1 = applyInstrumentNoise(
        metrics.v1Final,
        DEFAULT_INSTRUMENTS.stopwatch,
        noiseEnabled
      );
      modeLabel = `Tumbukan 1D & Momentum (e=${params.restitutionCoeff})`;
      summary = `m₁=${params.mass}kg, v₁=${params.initialVelocity}m/s, m₂=${params.collisionMass2}kg, v₂=${params.velocity2Initial}m/s, e=${params.restitutionCoeff}`;
      keyMetrics = {
        'Momentum Total': `${metrics.initialTotalMomentum} kg·m/s`,
        "Kecepatan v₁'": `${metrics.v1Final} m/s`,
        "Kecepatan v₂'": `${metrics.v2Final} m/s`,
        'Hilang EK': `${metrics.energyLossPct}%`,
      };
      numericCoords = {
        x: params.mass,
        y1: noiseEnabled ? mV1.measuredValue : metrics.v1Final,
        y2: metrics.kineticEnergyFinal,
      };
    } else if (params.mode === 'spring-hooke') {
      modeLabel = `Osilasi Pegas Hooke (k=${params.springConstantK} N/m)`;
      summary = `m=${params.mass}kg, k=${params.springConstantK}N/m, Δx=${params.springDisplacement}m, b=${params.dampingCoeff}`;
      keyMetrics = {
        'Gaya Pemulih (Fp)': `${metrics.springRestoringForce} N`,
        'Periode (T)': `${metrics.oscillationPeriod} s`,
        'Energi Potensial': `${metrics.springPotentialEnergy} J`,
      };
      numericCoords = {
        x: params.springDisplacement,
        y1: Math.abs(metrics.springRestoringForce),
        y2: metrics.springPotentialEnergy,
      };
    } else {
      modeLabel = `Gravitasi Universal Dua Massa (r=${params.separationDistance} m)`;
      summary = `m₁=${params.mass}kg, m₂=${params.secondaryMass}kg, r=${params.separationDistance}m`;
      keyMetrics = {
        'Gaya Gravitasi (Fg)': `${metrics.universalGravityForce} µN`,
        'Berat Benda (W)': `${metrics.weightForce} N`,
        'Kecepatan Lepas': `${metrics.escapeVelocitySurface} km/s`,
      };
      numericCoords = {
        x: params.separationDistance,
        y1: metrics.universalGravityForce,
        y2: metrics.weightForce,
      };
    }

    onRecordExperiment(
      modeLabel,
      summary,
      keyMetrics,
      `Data eksperimen ${modeLabel} terekam pada t=${instant.time}s.`,
      numericCoords
    );

    const fb = generateAutomaticFeedback('Fisika', params);
    onPushNotification(fb);
  };

  const physicsFormulaTokens: FormulaToken[] = (() => {
    if (params.mode === 'newton-incline') {
      return [
        { symbol: 'ΣF', value: metrics.netForce, unit: 'N', color: '#38bdf8' },
        { symbol: '=' },
        {
          symbol: 'F',
          paramKey: 'appliedForce',
          value: params.appliedForce,
          min: 0,
          max: 250,
          unit: 'N',
          color: '#10b981',
        },
        { symbol: '−' },
        {
          symbol: 'm',
          paramKey: 'mass',
          value: params.mass,
          min: 1,
          max: 30,
          unit: 'kg',
          color: '#f59e0b',
        },
        { symbol: '·' },
        {
          symbol: 'g',
          paramKey: 'gravity',
          value: params.gravity,
          min: 1.6,
          max: 25,
          unit: 'm/s²',
          color: '#38bdf8',
        },
        { symbol: '·' },
        {
          symbol: 'sin(θ)',
          paramKey: 'inclineAngle',
          value: params.inclineAngle,
          min: 0,
          max: 45,
          unit: '°',
          color: '#a855f7',
        },
        { symbol: '−' },
        {
          symbol: 'f_k',
          paramKey: 'frictionCoeffKinetic',
          value: metrics.frictionForce,
          min: 0,
          max: 50,
          unit: 'N',
          color: '#f43f5e',
        },
      ];
    }
    if (params.mode === 'projectile-gravity') {
      return [
        { symbol: 'R', value: metrics.projectileRange, unit: 'm', color: '#38bdf8' },
        { symbol: '=' },
        {
          symbol: 'v₀²',
          paramKey: 'initialVelocity',
          value: params.initialVelocity,
          min: 4,
          max: 50,
          unit: 'm/s',
          color: '#10b981',
        },
        { symbol: '·' },
        {
          symbol: 'sin(2θ)',
          paramKey: 'launchAngle',
          value: params.launchAngle,
          min: 10,
          max: 80,
          unit: '°',
          color: '#f59e0b',
        },
        { symbol: '/' },
        {
          symbol: 'g',
          paramKey: 'gravity',
          value: params.gravity,
          min: 1.6,
          max: 25,
          unit: 'm/s²',
          color: '#38bdf8',
        },
      ];
    }
    if (params.mode === 'collision-momentum') {
      return [
        {
          symbol: 'p_total',
          value: metrics.initialTotalMomentum,
          unit: 'kg·m/s',
          color: '#38bdf8',
        },
        { symbol: '=' },
        {
          symbol: 'm₁',
          paramKey: 'mass',
          value: params.mass,
          min: 1,
          max: 30,
          unit: 'kg',
          color: '#10b981',
        },
        { symbol: '·' },
        {
          symbol: 'v₁',
          paramKey: 'initialVelocity',
          value: params.initialVelocity,
          min: 1,
          max: 25,
          unit: 'm/s',
          color: '#f59e0b',
        },
        { symbol: '+' },
        {
          symbol: 'm₂',
          paramKey: 'collisionMass2',
          value: params.collisionMass2,
          min: 1,
          max: 30,
          unit: 'kg',
          color: '#a855f7',
        },
        { symbol: '·' },
        {
          symbol: 'v₂',
          paramKey: 'velocity2Initial',
          value: params.velocity2Initial,
          min: -20,
          max: 10,
          unit: 'm/s',
          color: '#f43f5e',
        },
      ];
    }
    if (params.mode === 'spring-hooke') {
      return [
        {
          symbol: 'F_p',
          value: metrics.springRestoringForce,
          unit: 'N',
          color: '#f43f5e',
        },
        { symbol: '= −' },
        {
          symbol: 'k',
          paramKey: 'springConstantK',
          value: params.springConstantK,
          min: 10,
          max: 250,
          unit: 'N/m',
          color: '#38bdf8',
        },
        { symbol: '·' },
        {
          symbol: 'Δx',
          paramKey: 'springDisplacement',
          value: params.springDisplacement,
          min: -1.5,
          max: 1.5,
          unit: 'm',
          color: '#10b981',
        },
      ];
    }
    return [
      {
        symbol: 'F_g',
        value: metrics.universalGravityForce,
        unit: 'µN',
        color: '#38bdf8',
      },
      { symbol: '= G·(' },
      {
        symbol: 'm₁',
        paramKey: 'mass',
        value: params.mass,
        min: 1,
        max: 30,
        unit: 'kg',
        color: '#10b981',
      },
      { symbol: '·' },
      {
        symbol: 'm₂',
        paramKey: 'secondaryMass',
        value: params.secondaryMass,
        min: 10,
        max: 5000,
        unit: 'kg',
        color: '#a855f7',
      },
      { symbol: ') /' },
      {
        symbol: 'r²',
        paramKey: 'separationDistance',
        value: params.separationDistance,
        min: 1,
        max: 40,
        unit: 'm',
        color: '#f59e0b',
      },
    ];
  })();

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full bg-[var(--comfort-bg)] text-[var(--comfort-text)] select-none">
      {/* Safety Hazard Auto-Modal (Fitur 5) */}
      {safetyHazard.isHazardous && !hazardModalDismissed && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-[11px] font-mono font-bold text-rose-300 uppercase">
                  SIMULASI BAHAYA KESELAMATAN K3 — FISIKA
                </span>
                <h3 className="text-base font-extrabold text-white">{safetyHazard.title}</h3>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-semibold text-rose-200 leading-relaxed">
              {safetyHazard.headlineAlert}
            </div>
            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>{safetyHazard.scientificExplanation}</p>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-300">
                Parameter Pemicu: {safetyHazard.triggerParamSummary}
              </div>
              <p className="text-emerald-300 font-medium">
                Prosedur Mitigasi: {safetyHazard.mitigationInstruction}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHazardModalDismissed(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Saya Paham, Amati Efek 3D
              </button>
              <button
                type="button"
                onClick={() => {
                  handleParamUpdate({
                    mass: Math.min(params.mass, 10),
                    appliedForce: Math.min(Math.max(params.appliedForce, -80), 80),
                    pendulumAngle: Math.min(params.pendulumAngle ?? 25, 35),
                    springDisplacement: Math.min(Math.max(params.springDisplacement, -1.0), 1.0),
                  });
                  setHazardModalDismissed(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer shadow-lg"
              >
                Pulihkan ke Parameter Aman
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: Slim 48px Telemetry Ribbon + Full-Bleed 3D Canvas */}
      <div className="flex-1 relative flex flex-col min-w-0 h-full overflow-hidden">
        <CompactTelemetryRibbon
          domain="Fisika"
          recordsCount={records.length}
          metrics={
            params.mode === 'projectile-gravity'
                  ? [
                      {
                        id: 'range',
                        label: 'Jangkauan (R)',
                        value: metrics.projectileRange,
                        min: 0,
                        max: 160,
                        unit: 'm',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'height',
                        label: 'Tinggi Puncak (H)',
                        value: metrics.maxProjectileHeight,
                        min: 0,
                        max: 80,
                        unit: 'm',
                        color: '#10b981',
                      },
                      {
                        id: 'speed',
                        label: 'Kecepatan v(t)',
                        value: instant.speed,
                        min: 0,
                        max: 60,
                        unit: 'm/s',
                        color: '#f59e0b',
                      },
                    ]
                  : params.mode === 'spring-hooke'
                  ? [
                      {
                        id: 'fp',
                        label: 'Gaya Pegas F_p',
                        value: metrics.springRestoringForce,
                        min: -350,
                        max: 350,
                        unit: 'N',
                        color: '#f43f5e',
                      },
                      {
                        id: 'period',
                        label: 'Periode (T)',
                        value: metrics.oscillationPeriod,
                        min: 0,
                        max: 10,
                        unit: 's',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'ep',
                        label: 'Energi E_p',
                        value: metrics.springPotentialEnergy,
                        min: 0,
                        max: 300,
                        unit: 'J',
                        color: '#10b981',
                      },
                    ]
                  : params.mode === 'pendulum-harmonic'
                  ? [
                      {
                        id: 'period',
                        label: 'Periode (T)',
                        value: metrics.pendulumPeriod ?? 2.0,
                        min: 0,
                        max: 8,
                        unit: 's',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'freq',
                        label: 'Frekuensi (f)',
                        value: metrics.pendulumFrequency ?? 0.5,
                        min: 0,
                        max: 5,
                        unit: 'Hz',
                        color: '#10b981',
                      },
                      {
                        id: 'speed',
                        label: 'Kelajuan v(t)',
                        value: instant.speed,
                        min: 0,
                        max: 15,
                        unit: 'm/s',
                        color: '#f59e0b',
                      },
                    ]
                  : params.mode === 'stokes-viscosity'
                  ? [
                      {
                        id: 'vt',
                        label: 'v Terminal (v_t)',
                        value: metrics.stokesTerminalVelocity ?? 0.5,
                        min: 0,
                        max: 10,
                        unit: 'm/s',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'drag',
                        label: 'Gaya Hambat F_d',
                        value: metrics.stokesDragForce ?? 1.0,
                        min: 0,
                        max: 50,
                        unit: 'N',
                        color: '#10b981',
                      },
                      {
                        id: 'eta',
                        label: 'Viskositas (η)',
                        value: params.fluidViscosityPaS ?? params.fluidViscosity ?? 0.8,
                        min: 0,
                        max: 5,
                        unit: 'Pa·s',
                        color: '#f59e0b',
                      },
                    ]
                  : params.mode === 'ohm-wheatstone'
                  ? [
                      {
                        id: 'current',
                        label: 'Arus Rangkaian (I)',
                        value: metrics.circuitCurrent ?? 1.2,
                        min: 0,
                        max: 15,
                        unit: 'A',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'galv',
                        label: 'Arus Galvanometer',
                        value: metrics.galvanometerCurrent ?? 0,
                        min: 0,
                        max: 100,
                        unit: 'mA',
                        color: '#10b981',
                      },
                      {
                        id: 'rx',
                        label: 'Resistor R_x',
                        value: params.bridgeRx ?? params.resistorRx ?? 300,
                        min: 10,
                        max: 1000,
                        unit: 'Ω',
                        color: '#f59e0b',
                      },
                    ]
                  : params.mode === 'optics-young-slit'
                  ? [
                      {
                        id: 'fringe',
                        label: 'Jarak Pita (Δy)',
                        value: metrics.fringeSpacingMm ?? 2.5,
                        min: 0,
                        max: 15,
                        unit: 'mm',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'slit',
                        label: 'Jarak Celah (d)',
                        value: params.slitDistance ?? 0.25,
                        min: 0.05,
                        max: 1.0,
                        unit: 'mm',
                        color: '#10b981',
                      },
                      {
                        id: 'lambda',
                        label: 'Gelombang (λ)',
                        value: params.lightWavelength ?? 532,
                        min: 380,
                        max: 750,
                        unit: 'nm',
                        color: '#f59e0b',
                      },
                    ]
                  : params.mode === 'photoelectric-planck'
                  ? [
                      {
                        id: 'ekmax',
                        label: 'EK_maks Elektron',
                        value: metrics.photoelectricMaxKe ?? 0.8,
                        min: 0,
                        max: 10,
                        unit: 'eV',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'vstop',
                        label: 'Potensial Henti V₀',
                        value: metrics.photoelectricStoppingVoltage ?? 0.8,
                        min: 0,
                        max: 10,
                        unit: 'V',
                        color: '#10b981',
                      },
                      {
                        id: 'freq',
                        label: 'Frekuensi Foton (f)',
                        value: params.photonFrequency ?? 7.5,
                        min: 4,
                        max: 15,
                        unit: '×10^14 Hz',
                        color: '#f59e0b',
                      },
                    ]
                  : params.mode === 'collision-momentum'
                  ? [
                      {
                        id: 'v1f',
                        label: "Kecepatan v₁'",
                        value: metrics.v1Final,
                        min: -25,
                        max: 25,
                        unit: 'm/s',
                        color: '#0ea5e9',
                      },
                      {
                        id: 'v2f',
                        label: "Kecepatan v₂'",
                        value: metrics.v2Final,
                        min: -25,
                        max: 25,
                        unit: 'm/s',
                        color: '#10b981',
                      },
                      {
                        id: 'eloss',
                        label: 'Disipasi EK',
                        value: metrics.energyLossPct,
                        min: 0,
                        max: 100,
                        unit: '%',
                        color: '#f59e0b',
                      },
                    ]
                  : [
                      {
                        id: 'acc',
                        label: 'Percepatan (a)',
                        value: metrics.acceleration,
                        min: -20,
                        max: 35,
                        unit: 'm/s^2',
                        color: '#0ea5e9',
                        warningThreshold: 22,
                      },
                      {
                        id: 'netf',
                        label: 'Resultan ΣF',
                        value: metrics.netForce,
                        min: -150,
                        max: 250,
                        unit: 'N',
                        color: '#10b981',
                      },
                      {
                        id: 'speed',
                        label: 'Kecepatan v(t)',
                        value: instant.speed,
                        min: 0,
                        max: 50,
                        unit: 'm/s',
                        color: '#f59e0b',
                      },
                    ]
              }
              oscilloscope={{
                primaryLabel:
                  params.mode === 'spring-hooke'
                    ? 'Gaya Pegas F_p'
                    : params.mode === 'projectile-gravity'
                    ? 'Jangkauan R'
                    : 'Percepatan a',
                primaryValue:
                  params.mode === 'spring-hooke'
                    ? metrics.springRestoringForce
                    : params.mode === 'projectile-gravity'
                    ? metrics.projectileRange
                    : metrics.acceleration,
                primaryUnit:
                  params.mode === 'spring-hooke'
                    ? 'N'
                    : params.mode === 'projectile-gravity'
                    ? 'm'
                    : 'm/s²',
                secondaryLabel: 'Kecepatan v(t)',
                secondaryValue: instant.speed,
                secondaryUnit: 'm/s',
                microscopicStateLabel:
                  params.mode === 'spring-hooke'
                    ? `Regangan Kisi Elastis Pegas (Ep = ${metrics.springPotentialEnergy} J)`
                    : params.mode === 'collision-momentum'
                    ? `Impuls & Disipasi Tumbukan (Hilang EK = ${metrics.energyLossPct}%)`
                    : `Keseimbangan Vektor Gaya (ΣF = ${metrics.netForce} N, fk = ${Math.abs(metrics.frictionForce)} N)`,
                microscopicDetail:
                  params.mode === 'spring-hooke'
                    ? `Frekuensi sudut ω = ${((2 * Math.PI) / Math.max(0.1, metrics.oscillationPeriod)).toFixed(2)} rad/s dengan periode T = ${metrics.oscillationPeriod} s.`
                    : `Komponen berat sejajar bidang W∥ = ${metrics.gravityParallel} N dan gaya normal N = ${metrics.normalForce} N.`,
                accentColor: '#0ea5e9',
              }}
            />

          {/* Full-Bleed 3D Canvas */}
          <div
            className={`relative w-full flex-1 min-h-[360px] overflow-hidden bg-slate-950 transition-all select-none ${
              safetyHazard.isHazardous
                ? 'ring-2 ring-inset ring-rose-500/70'
                : ''
            }`}
          >
            <PhysicsScene3D
              params={params}
              metrics={metrics}
              instant={instant}
              simTime={simTime}
              simTimeRef={simTimeRef}
              showVectorOverlay={showVectorOverlay}
              simFrame={simWorker.currentFrame}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              onUpdateParam={(paramKey, value) => handleParamUpdate({ [paramKey]: value })}
              snapshotCount={snapshotCount}
              onCaptureSnapshot={(dataUrl) => {
                setShutterFlash(true);
                setTimeout(() => setShutterFlash(false), 260);
                if (onCapture3DSnapshot) {
                  const modTitle =
                    params.mode === 'newton-incline'
                      ? 'Hukum II Newton & Bidang Miring'
                      : params.mode === 'projectile-gravity'
                      ? 'Kinematika Projektil'
                      : params.mode === 'spring-hooke'
                      ? 'Osilasi Pegas Hooke'
                      : params.mode === 'collision-momentum'
                      ? 'Tumbukan & Momentum'
                      : 'Gravitasi Universal';
                  const pSum = `m=${params.mass}kg, F=${params.appliedForce}N, θ=${params.inclineAngle}°, g=${params.gravity}m/s²`;
                  const pMetric =
                    params.mode === 'projectile-gravity'
                      ? `R = ${metrics.projectileRange} m`
                      : params.mode === 'spring-hooke'
                      ? `Fp = ${metrics.springRestoringForce} N`
                      : `a = ${metrics.acceleration} m/s²`;
                  onCapture3DSnapshot(dataUrl, modTitle, pSum, pMetric);
                }
              }}
            />

            {/* Shutter Flash Animation */}
            <AnimatePresence>
              {shutterFlash && (
                <motion.div
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-sky-300/60 via-white/85 to-emerald-300/60"
                />
              )}
            </AnimatePresence>

            {/* Top-Left Vector Toggle */}
            <div className="absolute top-3 left-3 z-20 flex items-center pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVectorOverlay((v) => !v)}
                  className={`backdrop-blur-md border rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md ${
                    showVectorOverlay
                      ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400'
                  }`}
                >
                  {showVectorOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>Vektor Gaya 3D</span>
                </button>
              </div>
            </div>

            {/* Bottom-Left Compact Guide Pill (Collapsed by Default) */}
            <div className="absolute bottom-3 left-3 z-20 pointer-events-none hidden sm:block">
              <ContextualMicroGuideHUD
                moduleTitle={
                  params.mode === 'newton-incline'
                    ? 'Hukum II Newton & Bidang Miring'
                    : params.mode === 'projectile-gravity'
                    ? 'Gerak Parabola (Projektil)'
                    : params.mode === 'spring-hooke'
                    ? 'Osilasi Pegas Hooke'
                    : params.mode === 'collision-momentum'
                    ? 'Tumbukan & Momentum'
                    : 'Gravitasi Universal Dua Massa'
                }
                IndependentVarLabel={
                  params.mode === 'newton-incline'
                    ? 'Gaya Dorong (F) / Sudut (θ)'
                    : params.mode === 'projectile-gravity'
                    ? 'Kecepatan Awal (v₀) / Sudut (θ)'
                    : params.mode === 'spring-hooke'
                    ? 'Simpangan Pegas (Δx)'
                    : params.mode === 'collision-momentum'
                    ? 'Massa (m₁) / Restitusi (e)'
                    : 'Jarak Pemisah (r)'
                }
                DependentVarLabel={
                  params.mode === 'newton-incline'
                    ? 'Percepatan (a)'
                    : params.mode === 'projectile-gravity'
                    ? 'Jarak Jangkauan (R)'
                    : params.mode === 'spring-hooke'
                    ? 'Gaya Pemulih (Fp)'
                    : params.mode === 'collision-momentum'
                    ? 'Kecepatan Akhir (v₁’)'
                    : 'Gaya Gravitasi (Fg)'
                }
                recordsCount={records.length}
                targetRecords={3}
                isPlaying={isPlaying}
                hasHypothesis={Boolean(effectiveHypothesis.hypothesisText?.trim())}
                onQuickRecord={handleRecordClick}
                onProceedToAnalysis={onProceedToAnalysis}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Clean SaaS Parameter Sidebar (Hidden in Zen Mode) */}
        {!zenMode && (
          <aside className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-[var(--comfort-border)] bg-[var(--comfort-surface)] overflow-y-auto p-4 shrink-0 space-y-3.5">
            {/* Primary Action Bar: Catat Data & Analisis Grafik */}
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleRecordClick}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-4 h-4" />
                <span>+ Catat Data</span>
                <span className="bg-slate-950/30 px-1.5 py-0.5 rounded font-mono text-[11px] tabular-nums">
                  {records.length}/3
                </span>
              </motion.button>

              {onProceedToAnalysis && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onProceedToAnalysis();
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    records.length >= 3
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-[var(--comfort-border)]'
                  }`}
                >
                  Grafik &amp; LKS →
                </button>
              )}
            </div>

          {/* Mystery Challenge Form (ONLY if Active for Fisika) */}
          {activeMysteryChallenge && activeMysteryChallenge.domain === 'Fisika' && (
            <div className="bg-sky-950/40 border border-sky-500/40 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <HelpCircle className="w-4 h-4 text-sky-400" />
                  Ujian Sampel Misterius
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {activeMysteryChallenge.codename}
                </span>
              </div>
              <p className="text-xs text-sky-200/90 leading-relaxed">
                {activeMysteryChallenge.storyDescription}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const guess = parseFloat(mysteryGuessInput);
                  if (isNaN(guess)) return;
                  const res = evaluateMysterySubmission(activeMysteryChallenge, guess);
                  setMysteryFeedbackResult(res);
                  if (onSubmitMysteryExam) {
                    onSubmitMysteryExam(activeStudentName, res, activeMysteryChallenge.title);
                  }
                  if (res.passed) labSound.playRecordSuccess();
                  else labSound.playClick(300);
                }}
                className="space-y-2 pt-1"
              >
                <input
                  type="number"
                  step="any"
                  required
                  value={mysteryGuessInput}
                  onChange={(e) => setMysteryGuessInput(e.target.value)}
                  placeholder={`Hasil (${activeMysteryChallenge.hiddenParamUnit})`}
                  className="w-full bg-slate-950 border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Kirim Jawaban
                </button>
              </form>

              {mysteryFeedbackResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    mysteryFeedbackResult.passed
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{mysteryFeedbackResult.verdict}</span>
                    <span className="font-mono">{mysteryFeedbackResult.score}/100</span>
                  </div>
                  <p className="text-[11px] opacity-90">{mysteryFeedbackResult.feedbackText}</p>
                </div>
              )}
            </div>
          )}

          {/* Parameter Sliders Container */}
          <div className="lab-glass-panel rounded-2xl p-3.5 shadow-sm space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Parameter Eksperimen</div>

            <div className="space-y-3">
              <div
                onPointerDown={() => onAcquireLock && onAcquireLock('mass')}
                onPointerUp={() => onReleaseLock && onReleaseLock('mass')}
              >
                <TactileParameterControl
                  label="Massa Benda"
                  symbol="m"
                  value={params.mass}
                  min={1}
                  max={30}
                  step={0.5}
                  unit="kg"
                  accentColor="#f59e0b"
                  lockedBy={getLockedByName('mass')}
                  onHoverChange={(h) => setHoveredParamKey(h ? 'mass' : null)}
                  onChange={(v) => handleParamUpdate({ mass: v })}
                />
              </div>

              {params.mode === 'newton-incline' && (
                <>
                  <TactileParameterControl
                    label="Gaya Dorong"
                    symbol="F"
                    value={params.appliedForce}
                    min={-100}
                    max={250}
                    step={5}
                    unit="N"
                    accentColor="#10b981"
                    lockedBy={getLockedByName('appliedForce')}
                    onHoverChange={(h) => setHoveredParamKey(h ? 'appliedForce' : null)}
                    onChange={(v) => handleParamUpdate({ appliedForce: v })}
                  />
                  <TactileParameterControl
                    label="Sudut Kemiringan"
                    symbol="θ"
                    value={params.inclineAngle}
                    min={0}
                    max={45}
                    step={1}
                    unit="°"
                    accentColor="#a855f7"
                    lockedBy={getLockedByName('inclineAngle')}
                    onHoverChange={(h) => setHoveredParamKey(h ? 'inclineAngle' : null)}
                    onChange={(v) => handleParamUpdate({ inclineAngle: v })}
                  />
                  <TactileParameterControl
                    label="Koefisien Gesek Kinetik"
                    symbol="μk"
                    value={params.frictionCoeffKinetic}
                    min={0}
                    max={0.8}
                    step={0.02}
                    unit=""
                    accentColor="#f43f5e"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'frictionCoeffKinetic' : null)}
                    onChange={(v) => handleParamUpdate({ frictionCoeffKinetic: v })}
                  />
                </>
              )}

              {params.mode === 'projectile-gravity' && (
                <>
                  <TactileParameterControl
                    label="Kecepatan Awal"
                    symbol="v₀"
                    value={params.initialVelocity}
                    min={4}
                    max={50}
                    step={1}
                    unit="m/s"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'initialVelocity' : null)}
                    onChange={(v) => handleParamUpdate({ initialVelocity: v })}
                  />
                  <TactileParameterControl
                    label="Sudut Elevasi"
                    symbol="θ"
                    value={params.launchAngle}
                    min={10}
                    max={80}
                    step={1}
                    unit="°"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'launchAngle' : null)}
                    onChange={(v) => handleParamUpdate({ launchAngle: v })}
                  />
                  <TactileParameterControl
                    label="Tinggi Menara Awal"
                    symbol="h₀"
                    value={params.initialHeight}
                    min={0}
                    max={40}
                    step={1}
                    unit="m"
                    accentColor="#38bdf8"
                    onChange={(v) => handleParamUpdate({ initialHeight: v })}
                  />
                </>
              )}

              {params.mode === 'collision-momentum' && (
                <>
                  <TactileParameterControl
                    label="Kecepatan Benda 1"
                    symbol="v₁"
                    value={params.initialVelocity}
                    min={1}
                    max={25}
                    step={0.5}
                    unit="m/s"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'initialVelocity' : null)}
                    onChange={(v) => handleParamUpdate({ initialVelocity: v })}
                  />
                  <TactileParameterControl
                    label="Massa Benda 2"
                    symbol="m₂"
                    value={params.collisionMass2}
                    min={1}
                    max={30}
                    step={0.5}
                    unit="kg"
                    accentColor="#a855f7"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'collisionMass2' : null)}
                    onChange={(v) => handleParamUpdate({ collisionMass2: v })}
                  />
                  <TactileParameterControl
                    label="Koefisien Restitusi"
                    symbol="e"
                    value={params.restitutionCoeff}
                    min={0}
                    max={1}
                    step={0.05}
                    unit=""
                    accentColor="#38bdf8"
                    onChange={(v) => handleParamUpdate({ restitutionCoeff: v })}
                  />
                </>
              )}

              {params.mode === 'spring-hooke' && (
                <>
                  <TactileParameterControl
                    label="Konstanta Pegas (k)"
                    symbol="k"
                    value={params.springConstantK}
                    min={10}
                    max={250}
                    step={5}
                    unit="N/m"
                    accentColor="#38bdf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'springConstantK' : null)}
                    onChange={(v) => handleParamUpdate({ springConstantK: v })}
                  />
                  <TactileParameterControl
                    label="Simpangan Awal (Δx)"
                    symbol="Δx"
                    value={params.springDisplacement}
                    min={-1.5}
                    max={1.5}
                    step={0.1}
                    unit="m"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'springDisplacement' : null)}
                    onChange={(v) => handleParamUpdate({ springDisplacement: v })}
                  />
                </>
              )}

              {params.mode === 'orbital-gravity' && (
                <>
                  <TactileParameterControl
                    label="Massa Sekunder (m₂)"
                    symbol="m₂"
                    value={params.secondaryMass}
                    min={10}
                    max={5000}
                    step={50}
                    unit="kg"
                    accentColor="#a855f7"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'secondaryMass' : null)}
                    onChange={(v) => handleParamUpdate({ secondaryMass: v })}
                  />
                  <TactileParameterControl
                    label="Jarak Pemisah (r)"
                    symbol="r"
                    value={params.separationDistance}
                    min={1}
                    max={40}
                    step={0.5}
                    unit="m"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'separationDistance' : null)}
                    onChange={(v) => handleParamUpdate({ separationDistance: v })}
                  />
                </>
              )}
            </div>
          </div>

                {/* Interactive Formula Card with Live 3D Parameter Application */}
                <InteractiveFormulaCard
                  title="Persamaan Hukum Fisika Aktif"
                  tokens={physicsFormulaTokens}
                  activeParamKey={hoveredParamKey}
                  onApplyParamValue={(paramKey, value) =>
                    handleParamUpdate({ [paramKey]: value } as Partial<PhysicsParams>)
                  }
                  accentColor="#38bdf8"
                />

                {/* Accordion 1: Scenario & Gravity Presets */}
                <CollapsibleLabSection
                  title="Preset Skenario & Gravitasi Planet"
                  subtitle="Muat cepat pengaturan eksperimen atau ubah gravitasi (Bumi, Bulan, Mars, Jupiter)"
                  statusText={`g = ${params.gravity} m/s²`}
                  accentColor="#38bdf8"
                >
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-300">
                        Gravitasi Lokasi (g)
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {GRAVITY_PRESETS.map((gp) => (
                          <button
                            key={gp.id}
                            type="button"
                            onClick={() => {
                              labSound.playClick();
                              handleParamUpdate({ gravity: gp.g });
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer truncate ${
                              Math.abs(params.gravity - gp.g) < 0.05
                                ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {gp.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] font-semibold text-slate-300">
                        Skenario Eksperimen Siap Pakai
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {GUIDED_LAB_SCENARIOS.filter((s) => s.domain === 'Fisika').map(
                          (sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => {
                                labSound.playClick(740);
                                if (sc.physicsPatch) {
                                  handleParamUpdate(sc.physicsPatch);
                                }
                              }}
                              title={sc.objective}
                              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 text-left transition-colors cursor-pointer"
                            >
                              <div className="text-[11px] font-bold text-slate-100 truncate">
                                {sc.title}
                              </div>
                              <div className="text-[10px] font-mono text-sky-400 truncate">
                                {sc.badgeText}
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleLabSection>

                {/* Accordion 2: Live Telemetry Oscilloscope & Vector Indicator */}
                <CollapsibleLabSection
                  title="Osiloskop Telemetri & Indikator Vektor"
                  subtitle="Grafik sinyal dual-channel (Y-t / X-Y Lissajous) & keseimbangan gaya"
                  statusText={`v = ${instant.speed.toFixed(1)} m/s`}
                  accentColor="#10b981"
                >
                  <LiveTelemetryOscilloscope
                    domain="Fisika"
                    primaryLabel={
                      params.mode === 'spring-hooke'
                        ? 'Gaya Pegas Fp'
                        : params.mode === 'projectile-gravity'
                        ? 'Jangkauan R'
                        : 'Percepatan a'
                    }
                    primaryValue={
                      params.mode === 'spring-hooke'
                        ? metrics.springRestoringForce
                        : params.mode === 'projectile-gravity'
                        ? metrics.projectileRange
                        : metrics.acceleration
                    }
                    primaryUnit={
                      params.mode === 'spring-hooke'
                        ? 'N'
                        : params.mode === 'projectile-gravity'
                        ? 'm'
                        : 'm/s²'
                    }
                    secondaryLabel="Kecepatan v(t)"
                    secondaryValue={instant.speed}
                    secondaryUnit="m/s"
                    microscopicStateLabel={
                      params.mode === 'spring-hooke'
                        ? `Regangan Kisi Elastis Pegas (Ep = ${metrics.springPotentialEnergy} J)`
                        : params.mode === 'collision-momentum'
                        ? `Impuls & Disipasi Tumbukan (Hilang EK = ${metrics.energyLossPct}%)`
                        : `Keseimbangan Vektor Gaya (ΣF = ${metrics.netForce} N, fk = ${Math.abs(metrics.frictionForce)} N)`
                    }
                    microscopicDetail={
                      params.mode === 'spring-hooke'
                        ? `Frekuensi sudut ω = ${(2 * Math.PI / Math.max(0.1, metrics.oscillationPeriod)).toFixed(2)} rad/s dengan periode T = ${metrics.oscillationPeriod} s.`
                        : `Komponen berat sejajar bidang W∥ = ${metrics.gravityParallel} N dan gaya normal N = ${metrics.normalForce} N.`
                    }
                    accentColor="#38bdf8"
                  />
                </CollapsibleLabSection>

                {/* Accordion 3: Manual Instrument Calibration & Uncertainty Simulation */}
                <CollapsibleLabSection
                  title="Kalibrasi Alat Ukur & Ketidakpastian (NST)"
                  subtitle="Atur kalibrasi titik nol (Tare), uji zero-drift, dan tingkat presisi alat"
                  statusText={calibrationConfig.isZeroCalibrated ? 'Terkalibrasi' : 'Standar'}
                  accentColor="#f59e0b"
                >
                  <InstrumentCalibrationCard
                    instrumentName={
                      params.mode === 'projectile-gravity'
                        ? DEFAULT_INSTRUMENTS.ruler.name
                        : DEFAULT_INSTRUMENTS.dynamometer.name
                    }
                    unit={
                      params.mode === 'projectile-gravity'
                        ? 'm'
                        : 'm/s²'
                    }
                    rawValue={
                      params.mode === 'projectile-gravity'
                        ? metrics.projectileRange
                        : metrics.acceleration
                    }
                    baseUncertaintyDelta={
                      params.mode === 'projectile-gravity'
                        ? DEFAULT_INSTRUMENTS.ruler.uncertaintyDelta
                        : DEFAULT_INSTRUMENTS.dynamometer.uncertaintyDelta
                    }
                    config={calibrationConfig}
                    onChangeConfig={(next) => {
                      setCalibrationConfig(next);
                      setNoiseEnabled(true);
                    }}
                  />
                </CollapsibleLabSection>
          </aside>
        )}
    </div>
  );
};
