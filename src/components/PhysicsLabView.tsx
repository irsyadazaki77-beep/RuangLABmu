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
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { PhysicsScene3D } from './PhysicsScene3D';
import { labSound } from '../utils/soundEngine';
import { useSimulationWorker } from '../hooks/useSimulationWorker';
import {
  DEFAULT_INSTRUMENTS,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import {
  CircularGaugeMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
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
  activeMysteryChallenge,
  onSubmitMysteryExam,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(1.2);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [noiseEnabled, setNoiseEnabled] = useState<boolean>(false);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

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
    if (simWorker.currentFrame) {
      setSimTime(simWorker.currentFrame.timestamp);
    }
  }, [simWorker.currentFrame]);

  useEffect(() => {
    setIsPlaying(simWorker.isPlaying);
  }, [simWorker.isPlaying]);

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
      const dt = ((timestamp - lastTickRef.current) / 1000) * playbackSpeed;
      lastTickRef.current = timestamp;

      setSimTime((prev) => {
        const next = prev + dt;
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
          setIsPlaying(false);
          return Number(maxSimDuration.toFixed(2));
        }
        return next;
      });

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
    if (simTime >= maxSimDuration - 0.1) setSimTime(0);
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
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
    setSimTime(0);
  };

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
        noiseEnabled
      );
      const mF = applyInstrumentNoise(
        metrics.netForce,
        DEFAULT_INSTRUMENTS.dynamometer,
        noiseEnabled
      );
      const mV = applyInstrumentNoise(
        instant.speed,
        DEFAULT_INSTRUMENTS.stopwatch,
        noiseEnabled
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
    <div className="w-full h-full max-w-[1380px] mx-auto p-4 sm:p-6 overflow-y-auto bg-slate-950 text-slate-100 select-none pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: 3D Scene Canvas (h-[540px]) & Playback Controls */}
        <div className="lg:col-span-8 space-y-4 flex flex-col">
          {/* 3D Canvas Box */}
          <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl">
            <PhysicsScene3D
              params={params}
              metrics={metrics}
              instant={instant}
              simTime={simTime}
              showVectorOverlay={showVectorOverlay}
              simFrame={simWorker.currentFrame}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              onUpdateParam={(paramKey, value) => handleParamUpdate({ [paramKey]: value })}
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

            {/* Top Overlay Gauges / Vector Toggle */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
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

              {/* Quick Gauges Overlay */}
              <div className="pointer-events-auto hidden sm:flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <span className="text-slate-400 font-mono">v:</span>
                <span className="font-bold font-mono text-sky-400 tabular-nums">
                  {instant.speed.toFixed(2)} m/s
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono">a:</span>
                <span className="font-bold font-mono text-emerald-400 tabular-nums">
                  {metrics.acceleration.toFixed(2)} m/s²
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Playback & Recording Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Play / Reset controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartSimulation}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md ${
                    isPlaying
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'Jeda' : 'Putar Simulasi'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetSimulation}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Reset Simulasi ke Awal"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Time Scrubber */}
              <div className="flex-1 min-w-[180px] flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 shrink-0">t:</span>
                <input
                  type="range"
                  min={0}
                  max={maxSimDuration}
                  step={0.05}
                  value={simTime}
                  onChange={(e) => setSimTime(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <span className="text-xs font-mono font-bold text-sky-400 shrink-0 w-12 tabular-nums">
                  {simTime.toFixed(2)}s
                </span>
              </div>

              {/* Prominent + Catat Data Percobaan Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleRecordClick}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span>+ Catat Data Percobaan</span>
                <span className="bg-slate-950/20 px-2 py-0.5 rounded-md font-mono text-[11px] text-slate-950">
                  {records.length}/3 Data
                </span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Parameter Sliders & Interactive Formula Card */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Mode Selector & Gravity Planet Presets */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span>Opsi & Mode Simulasi Fisika</span>
            </div>

            <select
              value={params.mode}
              onChange={(e) => {
                handleParamUpdate({ mode: e.target.value as PhysicsParams['mode'] });
                labSound.playClick(680);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="newton-incline">Hukum II Newton & Bidang Miring</option>
              <option value="projectile-gravity">Gerak Parabola (Projektil)</option>
              <option value="spring-hooke">Osilasi Pegas Hooke</option>
              <option value="collision-momentum">Tumbukan & Momentum</option>
              <option value="orbital-gravity">Gravitasi Dua Massa</option>
            </select>

            {/* Planet Presets */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Preset Gravitasi (g)
              </span>
              <div className="grid grid-cols-4 gap-1">
                {GRAVITY_PRESETS.map((gp) => (
                  <button
                    key={gp.id}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      handleParamUpdate({ gravity: gp.g });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer truncate ${
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="text-xs font-bold text-slate-200">Parameter Eksperimen</div>

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

          {/* Interactive Formula Card */}
          <InteractiveFormulaCard
            title="Persamaan Hukum Fisika Aktif"
            tokens={physicsFormulaTokens}
            activeParamKey={hoveredParamKey}
            accentColor="#38bdf8"
          />
        </div>
      </div>
    </div>
  );
};
