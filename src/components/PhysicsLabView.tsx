import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  PhysicsParams,
  AcademicLevel,
  calculatePhysicsMetrics,
  evaluateKinematicsAtTime,
  evaluateSafetyHazard,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { LabErrorBoundary } from './common/LabErrorBoundary';
import { labSound } from '../utils/soundEngine';

const PhysicsScene3D = React.lazy(() => import('./PhysicsScene3D'));
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import {
  CollapsibleLabSection,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
} from './ui/InteractiveFormulaCard';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
} from '../utils/mysteryChallengeEngine';
import {
  HypothesisNote,
} from './ui/HypothesisAndCompareDock';
import { StandardLabViewShell } from './layout/StandardLabViewShell';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../stores/useLabStore';
import { useSimulationWorker } from '../hooks/useSimulationWorker';
import { normalizeEducationLevel } from '../utils/pedagogicalHelpers';
import { useTimelineRecorder } from '../hooks/useTimelineRecorder';
import { DualRealityLabViewport } from './ui/DualRealityLabViewport';
import { PrecisionSlider } from './controls/PrecisionSlider';
import { filterRecordsForModule } from '../utils/spatialHudHelpers';
import { LabSidebarActionHeader } from './layout/LabSidebarActionHeader';
import { LabSceneFallback } from './three/LabSceneFallback';
import { LabHazardModal } from './three/LabHazardModal';
import { PhysicsParameterPanel } from './labs/PhysicsParameterPanel';
import { LabPresetAndSweepBar } from './labs/LabPresetAndSweepBar';
import {
  generateAutoSweepSeries,
  getPhysicsPresetsForMode,
} from '../utils/labScenarioPresets';

export interface PhysicsLabViewProps {
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
  onSyncWithGroup?: (summary: string) => void;
  academicLevel?: AcademicLevel | string;
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
  onCompleteChallenge?: (challenge: any) => void;
}

export const PhysicsLabView: React.FC<PhysicsLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  academicLevel,
  remoteCursors,
  onEmitCursor,
  records = [],
  onDeleteRecord,
  onProceedToAnalysis,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const simTimeRef = useRef<number>(0);
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [showVectorOverlay, setShowVectorOverlay] = useState<boolean>(true);
  const [hazardModalDismissed, setHazardModalDismissed] = useState<boolean>(false);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [isDualRealityMode, setIsDualRealityMode] = useState<boolean>(false);

  const buildInitialRealityB = (base: PhysicsParams): PhysicsParams => {
    switch (base.mode) {
      case 'pendulum-harmonic':
        return { ...base, pendulumLength: Math.min(2.5, Number(((base.pendulumLength ?? 1.2) + 0.6).toFixed(1))) };
      case 'spring-hooke':
        return { ...base, springConstantK: Math.min(400, Math.round((base.springConstantK || 120) * 1.8)) };
      case 'projectile-gravity':
        return { ...base, initialVelocity: Math.min(50, Math.round((base.initialVelocity || 22) + 10)) };
      case 'collision-momentum':
        return { ...base, restitutionCoeff: base.restitutionCoeff > 0.5 ? 0.2 : 0.95 };
      case 'stokes-viscosity':
        return { ...base, fluidViscosity: Math.min(2.0, Number(((base.fluidViscosity ?? 0.8) + 0.7).toFixed(2))) };
      case 'ohm-wheatstone':
        return { ...base, resistorRx: Math.min(500, (base.resistorRx ?? 100) + 120) };
      case 'optics-young-slit':
        return { ...base, lightWavelength: base.lightWavelength && base.lightWavelength > 580 ? 450 : 650 };
      case 'photoelectric-planck':
        return { ...base, lightWavelength: 260 };
      case 'orbital-gravity':
        return { ...base, separationDistance: Math.max(2, Number((base.separationDistance * 0.65).toFixed(1))) };
      default:
        return { ...base, mass: Math.min(30, Number((base.mass * 2).toFixed(1))) };
    }
  };

  const [realityBParams, setRealityBParams] = useState<PhysicsParams>(() => buildInitialRealityB(params));
  const prevPhysicsModeRef = useRef(params.mode);
  useEffect(() => {
    if (prevPhysicsModeRef.current !== params.mode) {
      prevPhysicsModeRef.current = params.mode;
      setRealityBParams(buildInitialRealityB(params));
    }
  }, [params]);

  const { playbackSpeed, academicLevel: storeAcademicLevel, isTimeTraveling } = useLabStore(
    useShallow((s) => ({
      playbackSpeed: s.playbackSpeed,
      academicLevel: s.academicLevel,
      isTimeTraveling: s.isTimeTraveling,
    }))
  );
  const effectiveEducationLevel = normalizeEducationLevel(
    academicLevel ?? storeAcademicLevel
  );

  // Web Worker for determinism
  const simWorker = useSimulationWorker(params.mode, params as any);

  const metrics = calculatePhysicsMetrics(params);
  const instant = evaluateKinematicsAtTime(params, simTime);
  const safetyHazard = evaluateSafetyHazard('Fisika', params);
  const prevHazardRef = useRef<boolean>(false);
  useEffect(() => {
    if (safetyHazard.isHazardous && !prevHazardRef.current) {
      labSound.playHazardAlarm();
    }
    prevHazardRef.current = safetyHazard.isHazardous;
  }, [safetyHazard.isHazardous]);
  const metricsB = calculatePhysicsMetrics(realityBParams);
  const instantB = evaluateKinematicsAtTime(realityBParams, simTime);

  // Mode-adaptive Telemetry Metrics Array
  const telemetryMetrics =
    metrics.mode === 'projectile-gravity'
      ? [
          { id: 'range', label: 'Jangkauan (R)', value: metrics.projectileRange, min: 0, max: 150, unit: 'm', color: '#0ea5e9' },
          { id: 'hmax', label: 'Tinggi Maks (H)', value: metrics.maxProjectileHeight, min: 0, max: 80, unit: 'm', color: '#10b981' },
          { id: 'tof', label: 'Waktu Terbang', value: metrics.timeOfFlight, min: 0, max: 12, unit: 's', color: '#f59e0b' },
        ]
      : metrics.mode === 'spring-hooke'
      ? [
          { id: 'frest', label: 'Gaya Pegas (Fp)', value: metrics.springRestoringForce, min: -400, max: 400, unit: 'N', color: '#0ea5e9' },
          { id: 'ep', label: 'Energi Ep Pegas', value: metrics.springPotentialEnergy, min: 0, max: 300, unit: 'J', color: '#10b981' },
          { id: 'period', label: 'Periode (T)', value: metrics.oscillationPeriod, min: 0, max: 6, unit: 's', color: '#f59e0b' },
        ]
      : metrics.mode === 'pendulum-harmonic'
      ? [
          { id: 'tpend', label: 'Periode Ayun (T)', value: metrics.pendulumPeriod, min: 0, max: 5, unit: 's', color: '#0ea5e9' },
          { id: 'fpend', label: 'Frekuensi (f)', value: metrics.pendulumFrequency, min: 0, max: 3, unit: 'Hz', color: '#10b981' },
          { id: 'angle', label: 'Simpangan θ₀', value: params.pendulumAngle ?? 25, min: 0, max: 90, unit: '°', color: '#f59e0b' },
        ]
      : metrics.mode === 'stokes-viscosity'
      ? [
          { id: 'vt', label: 'Kecepatan Terminal', value: metrics.stokesTerminalVelocity, min: 0, max: 5, unit: 'm/s', color: '#0ea5e9' },
          { id: 'fdrag', label: 'Gaya Gesek Stokes', value: metrics.stokesDragForce, min: 0, max: 2, unit: 'N', color: '#10b981' },
          { id: 'visc', label: 'Viskositas (η)', value: params.fluidViscosity ?? 0.8, min: 0, max: 2, unit: 'Pa·s', color: '#f59e0b' },
        ]
      : metrics.mode === 'ohm-wheatstone'
      ? [
          { id: 'ig', label: 'Arus Galvanometer', value: metrics.galvanometerCurrent, min: -50, max: 50, unit: 'mA', color: '#0ea5e9' },
          { id: 'itot', label: 'Arus Rangkaian', value: metrics.circuitCurrent, min: 0, max: 5, unit: 'A', color: '#10b981' },
          { id: 'rx', label: 'Hambatan Rx', value: params.resistorRx ?? 100, min: 10, max: 1000, unit: 'Ω', color: '#f59e0b' },
        ]
      : metrics.mode === 'optics-young-slit'
      ? [
          { id: 'dy', label: 'Jarak Pita (Δy)', value: metrics.fringeSpacingMm, min: 0, max: 15, unit: 'mm', color: '#0ea5e9' },
          { id: 'wl', label: 'Panjang Gelombang', value: params.lightWavelength ?? 532, min: 380, max: 700, unit: 'nm', color: '#10b981' },
          { id: 'slit', label: 'Celah (d)', value: params.slitDistance ?? 0.25, min: 0.05, max: 1.0, unit: 'mm', color: '#f59e0b' },
        ]
      : metrics.mode === 'photoelectric-planck'
      ? [
          { id: 'ke', label: 'Ek Maks Fotoelektron', value: metrics.photoelectricMaxKe, min: 0, max: 5, unit: 'eV', color: '#0ea5e9' },
          { id: 'v0', label: 'Potensial Henti V₀', value: metrics.photoelectricStoppingVoltage, min: 0, max: 5, unit: 'V', color: '#10b981' },
          { id: 'wf', label: 'Fungsi Kerja (W)', value: params.targetMetalWorkFunction ?? 2.3, min: 2, max: 5.5, unit: 'eV', color: '#f59e0b' },
        ]
      : [
          { id: 'accel', label: 'Percepatan (a)', value: metrics.acceleration, min: -20, max: 35, unit: 'm/s²', color: '#0ea5e9' },
          { id: 'netf', label: 'Resultan ΣF', value: metrics.netForce, min: -150, max: 250, unit: 'N', color: '#10b981' },
          { id: 'speed', label: 'Kecepatan v(t)', value: instant.speed, min: 0, max: 50, unit: 'm/s', color: '#f59e0b' },
        ];

  useTimelineRecorder<PhysicsParams, { primary: number; secondary: number }>({
    domain: 'physics',
    simTime,
    simTimeRef,
    isPlaying,
    params,
    stateSnapshot: {
      primary: telemetryMetrics[0]?.value ?? metrics.acceleration,
      secondary: telemetryMetrics[1]?.value ?? metrics.netForce,
    },
    onRestoreFrame: (frame) => {
      setIsPlaying(false);
      simTimeRef.current = frame.simTime;
      setSimTime(frame.simTime);
      onChangeParams(frame.parameters);
    },
  });

  useEffect(() => {
    let animId = 0;
    let lastStamp = performance.now();

    const loop = (stamp: number) => {
      const dt = Math.min((stamp - lastStamp) / 1000, 0.1);
      lastStamp = stamp;

      if (isPlaying && !isTimeTraveling) {
        setSimTime((prev) => {
          const next = prev + dt * playbackSpeed;
          simTimeRef.current = next;
          return next;
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isTimeTraveling, playbackSpeed]);

  const simWorkerRef = useRef(simWorker);
  simWorkerRef.current = simWorker;

  // Subscribe to Global Lab Events
  useEffect(() => {
    const unsubToggle = subscribeLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, (data: any) => {
      setIsPlaying((prev) => (data?.isSimulating !== undefined ? data.isSimulating : !prev));
    });
    const unsubReset = subscribeLabEvent(LAB_EVENTS.RESET_TRIAL, () => {
      setSimTime(0);
      simTimeRef.current = 0;
      simWorkerRef.current.reset();
    });
    const unsubCapture = subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, () => {
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 240);
    });

    return () => {
      unsubToggle();
      unsubReset();
      unsubCapture();
    };
  }, []);

  const handleParamUpdate = (patch: Partial<PhysicsParams>) => {
    const next = { ...params, ...patch };
    if (patch.mode && patch.mode === 'projectile-gravity' && next.initialVelocity <= 0) {
      next.initialVelocity = 22;
    }
    if (patch.mode && patch.mode === 'collision-momentum' && next.initialVelocity <= 0) {
      next.initialVelocity = 10;
    }
    onChangeParams(next);
  };

  const modeToCatalogId: Record<string, string> = {
    'newton-incline': 'newton-incline',
    'projectile-gravity': 'projectile-motion',
    'spring-hooke': 'spring-hooke',
    'pendulum-harmonic': 'pendulum-harmonic',
    'collision-momentum': 'collision-momentum',
    'stokes-viscosity': 'stokes-viscosity',
    'ohm-wheatstone': 'ohm-wheatstone',
    'optics-young-slit': 'optics-young-slit',
    'photoelectric-planck': 'photoelectric-planck',
    'orbital-gravity': 'gravity-orbital',
  };
  const moduleRecords = filterRecordsForModule(records, 'Fisika', modeToCatalogId[params.mode]);

  const scenarioPresets = useMemo(
    () => getPhysicsPresetsForMode(params.mode),
    [params.mode]
  );
  const sweepSteps = useMemo(
    () => generateAutoSweepSeries('Fisika', params.mode, 5),
    [params.mode]
  );

  const handleRecordTrial = (overrideParams?: PhysicsParams, noteOverride?: string) => {
    const p = overrideParams ?? params;
    const m = overrideParams ? calculatePhysicsMetrics(overrideParams) : metrics;
    const inst = overrideParams ? evaluateKinematicsAtTime(overrideParams, Math.max(1, simTime)) : instant;
    labSound.playRecordSuccess();
    const titleMap: Record<string, string> = {
      'newton-incline': 'Uji Bidang Miring Newton',
      'projectile-gravity': 'Uji Kinematika Parabola',
      'spring-hooke': 'Uji Osilasi Pegas Hooke',
      'pendulum-harmonic': 'Uji Bandul Sederhana Harmonis',
      'collision-momentum': 'Uji Tumbukan 1D & Momentum',
      'stokes-viscosity': 'Uji Viskositas Fluida Stokes',
      'ohm-wheatstone': 'Uji Jembatan Wheatstone & Hukum Ohm',
      'optics-young-slit': 'Uji Interferensi Celah Ganda Young',
      'photoelectric-planck': 'Uji Efek Fotolistrik Planck',
      'orbital-gravity': 'Uji Gravitasi Universal Newton',
    };
    const title = titleMap[p.mode] || 'Uji Eksperimen Fisika';

    let pSum = `m=${p.mass}kg, F=${p.appliedForce}N, θ=${p.inclineAngle}°`;
    let numX = p.appliedForce;
    let numY1 = m.acceleration;

    if (m.mode === 'projectile-gravity') {
      pSum = `v₀=${p.initialVelocity}m/s, θ=${p.launchAngle}°, g=${p.gravity}m/s²`;
      numX = p.initialVelocity;
      numY1 = m.projectileRange;
    } else if (m.mode === 'spring-hooke') {
      pSum = `k=${p.springConstantK}N/m, Δx=${p.springDisplacement}m, m=${p.mass}kg`;
      numX = p.springDisplacement;
      numY1 = Math.abs(m.springRestoringForce);
    } else if (m.mode === 'pendulum-harmonic') {
      pSum = `L=${p.pendulumLength ?? 1.2}m, θ₀=${p.pendulumAngle ?? 25}°, g=${p.gravity}m/s²`;
      numX = p.pendulumLength ?? 1.2;
      numY1 = m.pendulumPeriod;
    } else if (m.mode === 'collision-momentum') {
      pSum = `m₁=${p.mass}kg, v₁=${p.initialVelocity}m/s, m₂=${p.collisionMass2}kg, e=${p.restitutionCoeff}`;
      numX = p.initialVelocity;
      numY1 = m.v1Final;
    } else if (m.mode === 'stokes-viscosity') {
      pSum = `η=${p.fluidViscosity ?? 0.8}Pa·s, r=${p.sphereRadius ?? 5}mm`;
      numX = p.sphereRadius ?? 5;
      numY1 = m.stokesTerminalVelocity;
    } else if (m.mode === 'ohm-wheatstone') {
      pSum = `V=${p.circuitVoltage ?? 12}V, Rx=${p.resistorRx ?? 100}Ω`;
      numX = p.resistorRx ?? 100;
      numY1 = m.galvanometerCurrent;
    } else if (m.mode === 'optics-young-slit') {
      pSum = `λ=${p.lightWavelength ?? 532}nm, d=${p.slitDistance ?? 0.25}mm, L=${p.screenDistance ?? 1.5}m`;
      numX = p.lightWavelength ?? 532;
      numY1 = m.fringeSpacingMm;
    } else if (m.mode === 'photoelectric-planck') {
      pSum = `λ=${p.lightWavelength ?? 400}nm, W=${p.targetMetalWorkFunction ?? 2.3}eV`;
      numX = p.lightWavelength ?? 400;
      numY1 = m.photoelectricMaxKe;
    } else if (m.mode === 'orbital-gravity') {
      pSum = `M₁=${p.mass}kg, M₂=${p.secondaryMass}kg, r=${p.separationDistance}m`;
      numX = p.separationDistance;
      numY1 = m.universalGravityForce;
    }

    onRecordExperiment(
      title,
      pSum,
      {
        'Percepatan (a)': `${m.acceleration} m/s²`,
        'Kecepatan v(t)': `${inst.speed} m/s`,
        'Jangkauan (R)': m.mode === 'projectile-gravity' ? `${m.projectileRange} m` : '0 m',
      },
      noteOverride ?? (hypothesisNote?.hypothesisText || ''),
      { x: numX, y1: numY1, y2: inst.speed }
    );
  };

  return (
    <StandardLabViewShell
      domain="Fisika"
      recordsCount={moduleRecords.length}
      hypothesisText={hypothesisNote?.hypothesisText}
      recentRecords={moduleRecords}
      onProceedToAnalysis={onProceedToAnalysis}
      onDeleteRecord={onDeleteRecord}
      onBackToPreLab={() => useLabStore.getState().setWorkflowStep(1)}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: telemetryMetrics[0].label,
        primaryValue: telemetryMetrics[0].value,
        primaryUnit: telemetryMetrics[0].unit,
        secondaryLabel: telemetryMetrics[1].label,
        secondaryValue: telemetryMetrics[1].value,
        secondaryUnit: telemetryMetrics[1].unit,
        microscopicStateLabel: `ΣF = ${metrics.netForce} N (fk = ${Math.abs(metrics.frictionForce)} N)`,
        microscopicDetail: `W∥ = ${metrics.gravityParallel} N dan gaya normal N = ${metrics.normalForce} N.`,
        accentColor: '#0ea5e9',
      }}
      isHazardous={safetyHazard.isHazardous}
      shutterFlash={shutterFlash}
      zenMode={zenMode}
      activeCameraPreset={activeCameraPreset}
      onSelectCameraPreset={setActiveCameraPreset}
      dualModeActive={isDualRealityMode}
      onToggleDualMode={() => setIsDualRealityMode((prev) => !prev)}
      dualViewport={
        isDualRealityMode ? (() => {
          const primaryVar = (() => {
            if (metrics.mode === 'pendulum-harmonic' && metricsB.mode === 'pendulum-harmonic') {
              const deltaT = metricsB.pendulumPeriod - metrics.pendulumPeriod;
              return {
                key: 'pendulumLength' as const,
                label: 'Panjang Tali L (B)',
                unit: 'm',
                min: 0.3,
                max: 2.5,
                step: 0.1,
                valA: params.pendulumLength ?? 1.2,
                valB: realityBParams.pendulumLength ?? 1.8,
                summaryA: `L=${(params.pendulumLength ?? 1.2).toFixed(1)}m · T=${metrics.pendulumPeriod.toFixed(2)}s`,
                summaryB: `L=${(realityBParams.pendulumLength ?? 1.8).toFixed(1)}m · T=${metricsB.pendulumPeriod.toFixed(2)}s`,
                delta: `ΔT = ${(deltaT >= 0 ? '+' : '')}${deltaT.toFixed(2)} s`,
              };
            }
            if (metrics.mode === 'spring-hooke' && metricsB.mode === 'spring-hooke') {
              const deltaT = metricsB.oscillationPeriod - metrics.oscillationPeriod;
              return {
                key: 'springConstantK' as const,
                label: 'Konstanta k (B)',
                unit: 'N/m',
                min: 10,
                max: 400,
                step: 5,
                valA: params.springConstantK,
                valB: realityBParams.springConstantK,
                summaryA: `k=${params.springConstantK}N/m · T=${metrics.oscillationPeriod}s`,
                summaryB: `k=${realityBParams.springConstantK}N/m · T=${metricsB.oscillationPeriod}s`,
                delta: `ΔT = ${(deltaT >= 0 ? '+' : '')}${deltaT.toFixed(2)} s`,
              };
            }
            if (metrics.mode === 'projectile-gravity' && metricsB.mode === 'projectile-gravity') {
              const deltaR = metricsB.projectileRange - metrics.projectileRange;
              return {
                key: 'initialVelocity' as const,
                label: 'v₀ Peluncur (B)',
                unit: 'm/s',
                min: 5,
                max: 50,
                step: 1,
                valA: params.initialVelocity,
                valB: realityBParams.initialVelocity,
                summaryA: `v₀=${params.initialVelocity}m/s · R=${metrics.projectileRange}m`,
                summaryB: `v₀=${realityBParams.initialVelocity}m/s · R=${metricsB.projectileRange}m`,
                delta: `ΔR = ${(deltaR >= 0 ? '+' : '')}${deltaR.toFixed(1)} m`,
              };
            }
            const deltaA = metricsB.acceleration - metrics.acceleration;
            return {
              key: 'mass' as const,
              label: 'Massa m (B)',
              unit: 'kg',
              min: 0.5,
              max: 30,
              step: 0.5,
              valA: params.mass,
              valB: realityBParams.mass,
              summaryA: `m=${params.mass}kg · a=${metrics.acceleration}m/s²`,
              summaryB: `m=${realityBParams.mass}kg · a=${metricsB.acceleration}m/s²`,
              delta: `Δa = ${(deltaA >= 0 ? '+' : '')}${deltaA.toFixed(2)} m/s²`,
            };
          })();

          return (
            <DualRealityLabViewport
              domain="Fisika"
              moduleTitle={params.mode}
              realityASummary={primaryVar.summaryA}
              realityBSummary={primaryVar.summaryB}
              deltaSummary={primaryVar.delta}
              onResetBToMatchA={() => setRealityBParams({ ...params })}
              onRecordComparison={() => {
                handleRecordTrial(params, '[Komparasi A · Kontrol]');
                handleRecordTrial(realityBParams, '[Komparasi B · Uji Variabel]');
              }}
              onClose={() => setIsDualRealityMode(false)}
              realityBControls={
                <div className="w-full min-w-[240px]">
                  <PrecisionSlider
                    compact
                    syncToLiveFormula={false}
                    accentColor="amber"
                    label={primaryVar.label}
                    unit={primaryVar.unit}
                    min={primaryVar.min}
                    max={primaryVar.max}
                    step={primaryVar.step}
                    value={primaryVar.valB}
                    defaultValue={primaryVar.valA}
                    onChange={(nextVal) =>
                      setRealityBParams((prev) => ({ ...prev, [primaryVar.key]: nextVal }))
                    }
                  />
                </div>
              }
              renderViewport={(side, syncProps) => (
                <LabErrorBoundary domain="Fisika" sceneName={`PhysicsScene3D-${side}`}>
                  <Suspense
                    fallback={
                      <LabSceneFallback compact label={`Menyiapkan Realitas ${side}...`} />
                    }
                  >
                    <PhysicsScene3D
                      params={side === 'A' ? params : realityBParams}
                      metrics={side === 'A' ? metrics : metricsB}
                      instant={side === 'A' ? instant : instantB}
                      simTime={simTime}
                      simTimeRef={simTimeRef}
                      showVectorOverlay={showVectorOverlay}
                      simFrame={side === 'A' ? simWorker.currentFrame : undefined}
                      cameraSyncPose={syncProps.cameraSyncPose}
                      onCameraSyncChange={syncProps.onCameraSyncChange}
                    />
                  </Suspense>
                </LabErrorBoundary>
              )}
            />
          );
        })() : undefined
      }
      canvas={
        <LabErrorBoundary domain="Fisika" sceneName="PhysicsScene3D">
          <Suspense fallback={<LabSceneFallback accentColor="sky" />}>
            <PhysicsScene3D
              params={params}
              metrics={metrics}
              instant={instant}
              simTime={simTime}
              simTimeRef={simTimeRef}
              showVectorOverlay={showVectorOverlay}
              onToggleVectorOverlay={() => setShowVectorOverlay((prev) => !prev)}
              simFrame={simWorker.currentFrame}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              onUpdateParam={(key, val) => handleParamUpdate({ [key]: val })}
              snapshotCount={snapshotCount}
              onCaptureSnapshot={(dataUrl) => {
                setShutterFlash(true);
                setTimeout(() => setShutterFlash(false), 240);
                onCapture3DSnapshot?.(
                  dataUrl,
                  'Hukum Newton & Mekanika 3D',
                  `m=${params.mass}kg, F=${params.appliedForce}N`,
                  `a = ${metrics.acceleration} m/s²`
                );
              }}
            />
          </Suspense>
        </LabErrorBoundary>
      }
      safetyModal={
        safetyHazard.isHazardous && !hazardModalDismissed ? (
          <LabHazardModal
            domainLabel="FISIKA"
            hazard={safetyHazard}
            onDismiss={() => setHazardModalDismissed(true)}
            onRestoreSafe={() => {
              handleParamUpdate({
                mass: 10,
                appliedForce: 50,
                pendulumAngle: 30,
                springDisplacement: 0.8,
              });
              setHazardModalDismissed(false);
            }}
          />
        ) : null
      }
      sidebar={
        <>
          <LabSidebarActionHeader
            recordsCount={moduleRecords.length}
            accentColor="sky"
            onRecordTrial={handleRecordTrial}
            onProceedToAnalysis={onProceedToAnalysis}
          />

          <div className="space-y-1.5">
            <label className="text-2xs font-bold text-[var(--comfort-text-muted)] uppercase tracking-wider">
              Mode Modul Fisika:
            </label>
            <select
              value={params.mode}
              onChange={(e) => {
                const nextMode = e.target.value as PhysicsParams['mode'];
                labSound.playClick();
                handleParamUpdate({ mode: nextMode });
                if (modeToCatalogId[nextMode]) {
                  useLabStore.getState().setActiveModule(modeToCatalogId[nextMode]);
                }
              }}
              className="w-full text-xs p-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-semibold"
            >
              <option value="newton-incline">Hukum II Newton &amp; Bidang Miring</option>
              <option value="projectile-gravity">Gerak Parabola (Kinematika Proyektil)</option>
              <option value="spring-hooke">Osilasi Pegas Hooke &amp; Energi Ep</option>
              <option value="pendulum-harmonic">Bandul Sederhana Harmonis</option>
              <option value="collision-momentum">Tumbukan 1D &amp; Momentum</option>
              <option value="stokes-viscosity">Viskositas Fluida &amp; Hukum Stokes</option>
              <option value="ohm-wheatstone">Hukum Ohm &amp; Jembatan Wheatstone</option>
              <option value="optics-young-slit">Interferensi Celah Ganda Young</option>
              <option value="photoelectric-planck">Efek Fotolistrik &amp; Konstanta Planck</option>
              <option value="orbital-gravity">Gravitasi Universal &amp; Orbit Satelit</option>
            </select>
          </div>

          <LabPresetAndSweepBar
            presets={scenarioPresets}
            sweepSteps={sweepSteps}
            accentColor="sky"
            onApplyPreset={(preset) => handleParamUpdate(preset.patch)}
            onSweepStep={(step) => {
              const nextParams = { ...params, ...(step.patch as Partial<PhysicsParams>) };
              onChangeParams(nextParams);
              handleRecordTrial(nextParams, step.label);
            }}
          />

          <PhysicsParameterPanel
            params={params}
            educationLevel={effectiveEducationLevel}
            onParamUpdate={handleParamUpdate}
          />

          <CollapsibleLabSection title="Rumus & Kalkulator Interaktif" defaultOpen={false}>
            <InteractiveFormulaCard
              title="Hukum Fisika & Analisis Kuantitatif"
              tokens={telemetryMetrics.map((tm) => ({
                symbol: tm.label.split(' ')[0],
                value: tm.value,
                unit: tm.unit,
                description: tm.label,
              }))}
            />
          </CollapsibleLabSection>
        </>
      }
    />
  );
};
