import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sliders,
  Compass,
  Eye,
  EyeOff,
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
import { PreLabSafetyModal } from './PreLabSafetyModal';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import {
  CircularGaugeMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import { FloatingLabAnalyticsDrawer } from './FloatingLabAnalyticsDrawer';

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
  activeGroupId = 'Kelompok-A1',
  onDeleteRecord,
  onExportCSV,
  onSubmitQuizScore,
  onProceedToAnalysis,
  onBackToCatalog,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(1.2);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [noiseEnabled, setNoiseEnabled] = useState<boolean>(false);
  const [leftDockCollapsed, setLeftDockCollapsed] = useState<boolean>(false);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  const physicsModules = getExperimentsByDomain('fisika');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(
    physicsModules[0]
  );

  const activeTier: EducationTier =
    academicLevel === 'smp'
      ? 'SMP'
      : academicLevel === 'mahasiswa'
      ? 'Mahasiswa'
      : 'SMA';

  const currentPhysicsModuleId =
    params.mode === 'newton-incline'
      ? 'newton-incline'
      : params.mode === 'projectile-gravity'
      ? 'projectile-motion'
      : params.mode === 'collision-momentum'
      ? 'collision-momentum'
      : params.mode === 'spring-hooke'
      ? 'spring-hooke'
      : 'gravity-orbital';

  const currentModule =
    physicsModules.find((m) => m.id === currentPhysicsModuleId) ||
    physicsModules[0];

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
  }, [
    isPlaying,
    playbackSpeed,
    params.mode,
    params.restitutionCoeff,
    maxSimDuration,
  ]);

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

  const handleSelectExperimentById = (expId: string) => {
    labSound.playClick();
    if (expId === 'newton-incline') {
      handleParamUpdate({ mode: 'newton-incline' });
    } else if (expId === 'projectile-motion') {
      handleParamUpdate({ mode: 'projectile-gravity' });
    } else if (expId === 'collision-momentum') {
      handleParamUpdate({ mode: 'collision-momentum' });
    } else if (expId === 'spring-hooke') {
      handleParamUpdate({ mode: 'spring-hooke' });
    } else {
      handleParamUpdate({ mode: 'orbital-gravity' });
    }
    const found = physicsModules.find((m) => m.id === expId);
    if (found) setModalExperiment(found);
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
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* FULL-VIEWPORT 3D SCENE CANVAS */}
      <div className="absolute inset-0 w-full h-full z-0">
        <PhysicsScene3D
          params={params}
          metrics={metrics}
          instant={instant}
          simTime={simTime}
          showVectorOverlay={showVectorOverlay}
          simFrame={simWorker.currentFrame}
          remoteCursors={remoteCursors}
          onEmitCursor={onEmitCursor}
        />
      </div>

      {/* CAMERA SHUTTER FLASH ON RECORD */}
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

      {/* 1. TOP-LEFT FLOATING PILL: Experiment Module Picker + Pre-Lab & Rumus Button */}
      <div className="pointer-events-auto absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/15 text-white rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400 shrink-0" />
          <select
            aria-label="Pilih Modul Eksperimen Fisika"
            value={currentPhysicsModuleId}
            onChange={(e) => handleSelectExperimentById(e.target.value)}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
          >
            <option value="newton-incline" className="bg-slate-900 text-white">
              Hukum II Newton & Bidang Miring
            </option>
            <option value="projectile-motion" className="bg-slate-900 text-white">
              Gerak Parabola & Gravitasi Planet
            </option>
            <option value="collision-momentum" className="bg-slate-900 text-white">
              Tumbukan 1D & Kekekalan Momentum
            </option>
            <option value="spring-hooke" className="bg-slate-900 text-white">
              Osilasi Pegas Harmonik (Hukum Hooke)
            </option>
            <option value="gravity-orbital" className="bg-slate-900 text-white">
              Gravitasi Universal Dua Massa
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setModalExperiment(currentModule);
            setPreLabModalOpen(true);
          }}
          className="backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800/90 border border-white/15 text-sky-300 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
          title="Buka Panduan Pre-Lab, K3 & Rumus"
        >
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Pre-Lab & Rumus</span>
        </button>

        <button
          type="button"
          onClick={() => setShowVectorOverlay((v) => !v)}
          className={`backdrop-blur-xl border rounded-2xl px-2.5 py-2 shadow-2xl flex items-center gap-1 text-xs font-mono transition-colors cursor-pointer ${
            showVectorOverlay
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
              : 'bg-slate-900/80 border-white/15 text-slate-400'
          }`}
          title="Tampilkan/Sembunyikan Vektor Gaya 3D"
        >
          {showVectorOverlay ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:inline">Vektor</span>
        </button>
      </div>

      {/* 2. LEFT FLOATING CONTROL DOCK (Collapsible) */}
      <div className="pointer-events-none absolute top-20 left-4 bottom-20 z-30 flex items-start">
        <AnimatePresence initial={false}>
          {!leftDockCollapsed && (
            <motion.aside
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="pointer-events-auto w-76 sm:w-80 h-full overflow-y-auto backdrop-blur-xl bg-slate-900/75 dark:bg-slate-900/80 border border-white/15 text-white rounded-2xl shadow-2xl p-3.5 space-y-3.5"
            >
              {/* Dock Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs font-bold tracking-wide text-white">
                    Kontrol Variabel & Instrumen
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLeftDockCollapsed(true)}
                  aria-label="Sembunyikan panel kontrol kiri"
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* SVG Radial Speedometer & Kinetic Energy Gauges */}
              <div className="grid grid-cols-2 gap-2 justify-items-center bg-slate-950/60 border border-white/10 rounded-xl p-2.5">
                <CircularGaugeMeter
                  size="sm"
                  label="Kecepatan (v)"
                  value={instant.speed}
                  min={0}
                  max={60}
                  unit="m/s"
                  color="#38bdf8"
                />
                <CircularGaugeMeter
                  size="sm"
                  label="Energi Kinetik"
                  value={instant.kineticEnergy}
                  min={0}
                  max={2500}
                  unit="J"
                  precision={0}
                  color="#10b981"
                />
              </div>

              {/* Quick Digital Readout Row */}
              <div className="grid grid-cols-2 gap-2">
                <AnimatedNumberReadout
                  label="Percepatan (a)"
                  value={metrics.acceleration}
                  unit="m/s²"
                  precision={2}
                  accentColor="#38bdf8"
                />
                <AnimatedNumberReadout
                  label="Resultan (ΣF)"
                  value={metrics.netForce}
                  unit="N"
                  precision={1}
                  accentColor="#10b981"
                />
              </div>

              {/* Interactive Glowing Algebraic Formula Card */}
              <InteractiveFormulaCard
                title="Persamaan Hukum Fisika Aktif"
                tokens={physicsFormulaTokens}
                activeParamKey={hoveredParamKey}
                accentColor="#38bdf8"
              />

              {/* Gravity Planet Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Preset Gravitasi Planet (g)
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
                          : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {gp.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tactile Parameter Sliders with Algebraic Symbols */}
              <div className="space-y-2.5">
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'appliedForce' : null)
                      }
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'inclineAngle' : null)
                      }
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'frictionCoeffKinetic' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ frictionCoeffKinetic: v })
                      }
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'initialVelocity' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ initialVelocity: v })
                      }
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'launchAngle' : null)
                      }
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'initialVelocity' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ initialVelocity: v })
                      }
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
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'collisionMass2' : null)
                      }
                      onChange={(v) => handleParamUpdate({ collisionMass2: v })}
                    />
                    <TactileParameterControl
                      label="Kecepatan Benda 2"
                      symbol="v₂"
                      value={params.velocity2Initial}
                      min={-20}
                      max={10}
                      step={0.5}
                      unit="m/s"
                      accentColor="#f43f5e"
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'velocity2Initial' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ velocity2Initial: v })
                      }
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
                      onChange={(v) =>
                        handleParamUpdate({ restitutionCoeff: v })
                      }
                    />
                  </>
                )}

                {params.mode === 'spring-hooke' && (
                  <>
                    <TactileParameterControl
                      label="Konstanta Pegas"
                      symbol="k"
                      value={params.springConstantK}
                      min={10}
                      max={250}
                      step={5}
                      unit="N/m"
                      accentColor="#38bdf8"
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'springConstantK' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ springConstantK: v })
                      }
                    />
                    <TactileParameterControl
                      label="Simpangan Awal"
                      symbol="Δx"
                      value={params.springDisplacement}
                      min={-1.5}
                      max={1.5}
                      step={0.05}
                      unit="m"
                      accentColor="#10b981"
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'springDisplacement' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ springDisplacement: v })
                      }
                    />
                    <TactileParameterControl
                      label="Redaman Udara"
                      symbol="b"
                      value={params.dampingCoeff}
                      min={0}
                      max={2}
                      step={0.05}
                      unit="N·s/m"
                      accentColor="#f43f5e"
                      onChange={(v) => handleParamUpdate({ dampingCoeff: v })}
                    />
                  </>
                )}

                {params.mode === 'orbital-gravity' && (
                  <>
                    <TactileParameterControl
                      label="Massa Kedua"
                      symbol="m₂"
                      value={params.secondaryMass}
                      min={10}
                      max={5000}
                      step={50}
                      unit="kg"
                      accentColor="#a855f7"
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'secondaryMass' : null)
                      }
                      onChange={(v) => handleParamUpdate({ secondaryMass: v })}
                    />
                    <TactileParameterControl
                      label="Jarak Pisah Pusat"
                      symbol="r"
                      value={params.separationDistance}
                      min={1}
                      max={40}
                      step={0.5}
                      unit="m"
                      accentColor="#f59e0b"
                      onHoverChange={(h) =>
                        setHoveredParamKey(h ? 'separationDistance' : null)
                      }
                      onChange={(v) =>
                        handleParamUpdate({ separationDistance: v })
                      }
                    />
                  </>
                )}

                <TactileParameterControl
                  label="Percepatan Gravitasi"
                  symbol="g"
                  value={params.gravity}
                  min={1.6}
                  max={25}
                  step={0.1}
                  unit="m/s²"
                  accentColor="#38bdf8"
                  onHoverChange={(h) => setHoveredParamKey(h ? 'gravity' : null)}
                  onChange={(v) => handleParamUpdate({ gravity: v })}
                />
              </div>

              {/* Instrument Noise Toggle */}
              <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">
                  Simulasi Ketidakpastian Alat (±Δx)
                </span>
                <button
                  type="button"
                  onClick={() => setNoiseEnabled((n) => !n)}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-colors cursor-pointer ${
                    noiseEnabled
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {noiseEnabled ? 'AKTIF' : 'IDEAL'}
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sleek Collapse/Expand Toggle Button (< / >) */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setLeftDockCollapsed((c) => !c);
          }}
          aria-label={
            leftDockCollapsed
              ? 'Buka panel kontrol kiri'
              : 'Tutup panel kontrol kiri'
          }
          className="pointer-events-auto ml-2 mt-3 backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-white rounded-xl p-2 shadow-2xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono"
          title={
            leftDockCollapsed
              ? 'Tampilkan Panel Parameter'
              : 'Sembunyikan Panel Parameter'
          }
        >
          {leftDockCollapsed ? (
            <>
              <ChevronRight className="w-4 h-4 text-sky-400" />
              <span className="pr-1">Kontrol</span>
            </>
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          )}
        </button>
      </div>

      {/* 3. BOTTOM-CENTER FLOATING PLAYBACK & ACTION PILL */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[95vw]">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/15 text-white rounded-full px-3.5 py-2 shadow-2xl flex items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={handleStartSimulation}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-[0_0_18px_rgba(56,189,248,0.45)] transition-colors cursor-pointer shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isPlaying ? 'Jeda' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetSimulation}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
            title="Reset Waktu Simulasi (t = 0s)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Scrubber */}
          <div className="hidden sm:flex items-center gap-2 px-1">
            <span className="font-mono text-[11px] text-sky-300 tabular-nums w-12">
              {simTime.toFixed(2)}s
            </span>
            <input
              type="range"
              aria-label="Garis Waktu Simulasi"
              min={0}
              max={maxSimDuration}
              step={0.05}
              value={Math.min(maxSimDuration, simTime)}
              onChange={(e) => {
                setIsPlaying(false);
                setSimTime(Number(e.target.value));
              }}
              className="w-28 md:w-36 accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() =>
                setPlaybackSpeed((s) => (s === 1 ? 0.5 : s === 0.5 ? 2 : 1))
              }
              className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
            >
              {playbackSpeed}x
            </button>
          </div>

          {/* Glowing Primary Button: + Catat Data Percobaan */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRecordClick}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-[0_0_22px_rgba(16,185,129,0.55)] transition-colors cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>+ Catat Data Percobaan</span>
          </motion.button>
        </div>
      </div>

      {/* 4. RIGHT FLOATING ANALYTICS SUMMARY & STEP TRANSITION */}
      <FloatingLabAnalyticsDrawer
        domain="Fisika"
        experimentTitle={currentModule.title}
        records={records}
        activeStudentName={activeStudentName}
        activeGroupId={activeGroupId}
        accentColor="#38bdf8"
        onDeleteRecord={onDeleteRecord}
        onExportCSV={onExportCSV}
        onSubmitQuizScore={onSubmitQuizScore}
        onProceedToAnalysis={onProceedToAnalysis}
        onBackToCatalog={onBackToCatalog}
      />

      {/* Pre-Lab & Safety Modal */}
      <PreLabSafetyModal
        experiment={modalExperiment}
        activeTier={activeTier}
        isOpen={preLabModalOpen}
        onClose={() => setPreLabModalOpen(false)}
        onProceedToLab={() => {
          handleSelectExperimentById(modalExperiment.id);
        }}
      />
    </div>
  );
};
