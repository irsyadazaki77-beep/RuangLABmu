import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  EyeOff,
  Sliders,
  NotebookPen,
} from 'lucide-react';
import {
  PhysicsParams,
  GRAVITY_PRESETS,
  AcademicLevel,
  calculatePhysicsMetrics,
  evaluateKinematicsAtTime,
  evaluateSafetyHazard,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { PhysicsScene3D } from './PhysicsScene3D';
import { LabErrorBoundary } from './common/LabErrorBoundary';
import { labSound } from '../utils/soundEngine';
import { useSimulationWorker } from '../hooks/useSimulationWorker';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import {
  TactileParameterControl,
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
import { useLabStore } from '../stores/useLabStore';

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
  onCompleteChallenge?: (challenge: any) => void;
}

export const PhysicsLabView: React.FC<PhysicsLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  academicLevel = 'sma',
  remoteCursors,
  paramLocks,
  onEmitCursor,
  onAcquireLock,
  onReleaseLock,
  records = [],
  onProceedToAnalysis,
  hypothesisNote,
  onChangeHypothesisNote,
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

  const { playbackSpeed } = useLabStore();

  // Web Worker for determinism
  const simWorker = useSimulationWorker(params.mode, params as any);

  const metrics = calculatePhysicsMetrics(params);
  const instant = evaluateKinematicsAtTime(params, simTime);
  const safetyHazard = evaluateSafetyHazard('Fisika', params);

  useEffect(() => {
    let animId = 0;
    let lastStamp = performance.now();

    const loop = (stamp: number) => {
      const dt = Math.min((stamp - lastStamp) / 1000, 0.1);
      lastStamp = stamp;

      if (isPlaying) {
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
  }, [isPlaying, playbackSpeed]);

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

  const handleRecordTrial = () => {
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
    const title = titleMap[params.mode] || 'Uji Eksperimen Fisika';

    let pSum = `m=${params.mass}kg, F=${params.appliedForce}N, θ=${params.inclineAngle}°`;
    let numX = params.appliedForce;
    let numY1 = metrics.acceleration;

    if (params.mode === 'projectile-gravity') {
      pSum = `v₀=${params.initialVelocity}m/s, θ=${params.launchAngle}°, g=${params.gravity}m/s²`;
      numX = params.initialVelocity;
      numY1 = metrics.projectileRange;
    } else if (params.mode === 'spring-hooke') {
      pSum = `k=${params.springConstantK}N/m, Δx=${params.springDisplacement}m, m=${params.mass}kg`;
      numX = params.springDisplacement;
      numY1 = Math.abs(metrics.springRestoringForce);
    } else if (params.mode === 'pendulum-harmonic') {
      pSum = `L=${params.pendulumLength ?? 1.2}m, θ₀=${params.pendulumAngle ?? 25}°, g=${params.gravity}m/s²`;
      numX = params.pendulumLength ?? 1.2;
      numY1 = metrics.pendulumPeriod ?? 2.2;
    } else if (params.mode === 'collision-momentum') {
      pSum = `m₁=${params.mass}kg, v₁=${params.initialVelocity}m/s, m₂=${params.collisionMass2}kg, e=${params.restitutionCoeff}`;
      numX = params.initialVelocity;
      numY1 = metrics.v1Final;
    } else if (params.mode === 'stokes-viscosity') {
      pSum = `η=${params.fluidViscosity ?? 0.8}Pa·s, r=${params.sphereRadius ?? 5}mm`;
      numX = params.sphereRadius ?? 5;
      numY1 = metrics.stokesTerminalVelocity ?? 0.5;
    } else if (params.mode === 'ohm-wheatstone') {
      pSum = `V=${params.circuitVoltage ?? 12}V, Rx=${params.resistorRx ?? 100}Ω`;
      numX = params.resistorRx ?? 100;
      numY1 = metrics.galvanometerCurrent ?? 0;
    } else if (params.mode === 'optics-young-slit') {
      pSum = `λ=${params.lightWavelength ?? 532}nm, d=${params.slitDistance ?? 0.25}mm, L=${params.screenDistance ?? 1.5}m`;
      numX = params.lightWavelength ?? 532;
      numY1 = metrics.fringeSpacingMm ?? 3.2;
    } else if (params.mode === 'photoelectric-planck') {
      pSum = `λ=${params.lightWavelength ?? 400}nm, W=${params.targetMetalWorkFunction ?? 2.3}eV`;
      numX = params.lightWavelength ?? 400;
      numY1 = metrics.photoelectricMaxKe ?? 0.8;
    } else if (params.mode === 'orbital-gravity') {
      pSum = `M₁=${params.mass}kg, M₂=${params.secondaryMass}kg, r=${params.separationDistance}m`;
      numX = params.separationDistance;
      numY1 = metrics.universalGravityForce;
    }

    onRecordExperiment(
      title,
      pSum,
      {
        'Percepatan (a)': `${metrics.acceleration} m/s²`,
        'Kecepatan v(t)': `${instant.speed} m/s`,
        'Jangkauan (R)': `${metrics.projectileRange} m`,
      },
      hypothesisNote?.hypothesisText || '',
      { x: numX, y1: numY1, y2: instant.speed }
    );
  };

  // Mode-adaptive Telemetry Metrics Array
  const telemetryMetrics =
    params.mode === 'projectile-gravity'
      ? [
          { id: 'range', label: 'Jangkauan (R)', value: metrics.projectileRange, min: 0, max: 150, unit: 'm', color: '#0ea5e9' },
          { id: 'hmax', label: 'Tinggi Maks (H)', value: metrics.maxProjectileHeight, min: 0, max: 80, unit: 'm', color: '#10b981' },
          { id: 'tof', label: 'Waktu Terbang', value: metrics.timeOfFlight, min: 0, max: 12, unit: 's', color: '#f59e0b' },
        ]
      : params.mode === 'spring-hooke'
      ? [
          { id: 'frest', label: 'Gaya Pegas (Fp)', value: metrics.springRestoringForce, min: -400, max: 400, unit: 'N', color: '#0ea5e9' },
          { id: 'ep', label: 'Energi Ep Pegas', value: metrics.springPotentialEnergy, min: 0, max: 300, unit: 'J', color: '#10b981' },
          { id: 'period', label: 'Periode (T)', value: metrics.oscillationPeriod, min: 0, max: 6, unit: 's', color: '#f59e0b' },
        ]
      : params.mode === 'pendulum-harmonic'
      ? [
          { id: 'tpend', label: 'Periode Ayun (T)', value: metrics.pendulumPeriod ?? 2.2, min: 0, max: 5, unit: 's', color: '#0ea5e9' },
          { id: 'fpend', label: 'Frekuensi (f)', value: metrics.pendulumFrequency ?? 0.45, min: 0, max: 3, unit: 'Hz', color: '#10b981' },
          { id: 'angle', label: 'Simpangan θ₀', value: params.pendulumAngle ?? 25, min: 0, max: 90, unit: '°', color: '#f59e0b' },
        ]
      : params.mode === 'stokes-viscosity'
      ? [
          { id: 'vt', label: 'Kecepatan Terminal', value: metrics.stokesTerminalVelocity ?? 0.5, min: 0, max: 5, unit: 'm/s', color: '#0ea5e9' },
          { id: 'fdrag', label: 'Gaya Gesek Stokes', value: metrics.stokesDragForce ?? 0.1, min: 0, max: 2, unit: 'N', color: '#10b981' },
          { id: 'visc', label: 'Viskositas (η)', value: params.fluidViscosity ?? 0.8, min: 0, max: 2, unit: 'Pa·s', color: '#f59e0b' },
        ]
      : params.mode === 'ohm-wheatstone'
      ? [
          { id: 'ig', label: 'Arus Galvanometer', value: metrics.galvanometerCurrent ?? 0, min: -50, max: 50, unit: 'mA', color: '#0ea5e9' },
          { id: 'itot', label: 'Arus Rangkaian', value: metrics.circuitCurrent ?? 0.1, min: 0, max: 5, unit: 'A', color: '#10b981' },
          { id: 'rx', label: 'Hambatan Rx', value: params.resistorRx ?? 100, min: 10, max: 1000, unit: 'Ω', color: '#f59e0b' },
        ]
      : params.mode === 'optics-young-slit'
      ? [
          { id: 'dy', label: 'Jarak Pita (Δy)', value: metrics.fringeSpacingMm ?? 3.2, min: 0, max: 15, unit: 'mm', color: '#0ea5e9' },
          { id: 'wl', label: 'Panjang Gelombang', value: params.lightWavelength ?? 532, min: 380, max: 700, unit: 'nm', color: '#10b981' },
          { id: 'slit', label: 'Celah (d)', value: params.slitDistance ?? 0.25, min: 0.05, max: 1.0, unit: 'mm', color: '#f59e0b' },
        ]
      : params.mode === 'photoelectric-planck'
      ? [
          { id: 'ke', label: 'Ek Maks Fotoelektron', value: metrics.photoelectricMaxKe ?? 0.8, min: 0, max: 5, unit: 'eV', color: '#0ea5e9' },
          { id: 'v0', label: 'Potensial Henti V₀', value: metrics.photoelectricStoppingVoltage ?? 0.8, min: 0, max: 5, unit: 'V', color: '#10b981' },
          { id: 'wf', label: 'Fungsi Kerja (W)', value: params.targetMetalWorkFunction ?? 2.3, min: 2, max: 5.5, unit: 'eV', color: '#f59e0b' },
        ]
      : [
          { id: 'accel', label: 'Percepatan (a)', value: metrics.acceleration, min: -20, max: 35, unit: 'm/s²', color: '#0ea5e9' },
          { id: 'netf', label: 'Resultan ΣF', value: metrics.netForce, min: -150, max: 250, unit: 'N', color: '#10b981' },
          { id: 'speed', label: 'Kecepatan v(t)', value: instant.speed, min: 0, max: 50, unit: 'm/s', color: '#f59e0b' },
        ];

  return (
    <StandardLabViewShell
      domain="Fisika"
      recordsCount={records.length}
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
      topOverlay={
        <button
          type="button"
          onClick={() => setShowVectorOverlay(!showVectorOverlay)}
          className={`backdrop-blur-md border rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md ${
            showVectorOverlay
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-400'
          }`}
        >
          {showVectorOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>Vektor Gaya 3D</span>
        </button>
      }
      canvas={
        <LabErrorBoundary domain="Fisika" sceneName="PhysicsScene3D">
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
        </LabErrorBoundary>
      }
      safetyModal={
        safetyHazard.isHazardous && !hazardModalDismissed ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-lg w-full rounded-2xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl p-6 space-y-4">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/20 text-[11px] font-mono font-bold text-rose-300">
                PERINGATAN K3 — FISIKA
              </span>
              <h3 className="text-base font-extrabold text-white">{safetyHazard.title}</h3>
              <p className="text-xs text-slate-300">{safetyHazard.scientificExplanation}</p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHazardModalDismissed(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Saya Paham
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleParamUpdate({ mass: 10, appliedForce: 50, pendulumAngle: 30, springDisplacement: 0.8 });
                    setHazardModalDismissed(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  Pulihkan ke Parameter Aman
                </button>
              </div>
            </div>
          </div>
        ) : null
      }
      sidebar={
        <>
          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecordTrial}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>+ Catat Data ({records.length}/3)</span>
            </button>

            {onProceedToAnalysis && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onProceedToAnalysis();
                }}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                  records.length >= 3
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                Grafik &amp; LKS →
              </button>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
              className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
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

          {/* Sliders & Controls */}
          <CollapsibleLabSection title="Variabel & Parameter Eksperimen" defaultOpen>
            <div className="space-y-3">
              {params.mode === 'projectile-gravity' ? (
                <>
                  <TactileParameterControl
                    label="Kecepatan Awal (v₀)"
                    unit="m/s"
                    value={params.initialVelocity || 22}
                    min={5}
                    max={50}
                    step={1}
                    onChange={(v) => handleParamUpdate({ initialVelocity: v })}
                  />
                  <TactileParameterControl
                    label="Sudut Peluncuran (θ)"
                    unit="°"
                    value={params.launchAngle}
                    min={10}
                    max={85}
                    step={1}
                    onChange={(v) => handleParamUpdate({ launchAngle: v })}
                  />
                  <TactileParameterControl
                    label="Tinggi Awal Menara (h₀)"
                    unit="m"
                    value={params.initialHeight}
                    min={0}
                    max={40}
                    step={1}
                    onChange={(v) => handleParamUpdate({ initialHeight: v })}
                  />
                  <TactileParameterControl
                    label="Massa Proyektil (m)"
                    unit="kg"
                    value={params.mass}
                    min={0.5}
                    max={25}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />
                </>
              ) : params.mode === 'spring-hooke' ? (
                <>
                  <TactileParameterControl
                    label="Konstanta Pegas (k)"
                    unit="N/m"
                    value={params.springConstantK}
                    min={10}
                    max={400}
                    step={5}
                    onChange={(v) => handleParamUpdate({ springConstantK: v })}
                  />
                  <TactileParameterControl
                    label="Simpangan Tarik (Δx)"
                    unit="m"
                    value={params.springDisplacement}
                    min={-2.0}
                    max={2.0}
                    step={0.1}
                    onChange={(v) => handleParamUpdate({ springDisplacement: v })}
                  />
                  <TactileParameterControl
                    label="Massa Beban (m)"
                    unit="kg"
                    value={params.mass}
                    min={0.5}
                    max={25}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />
                  <TactileParameterControl
                    label="Koefisien Redaman (b)"
                    unit="Ns/m"
                    value={params.dampingCoeff}
                    min={0}
                    max={2.0}
                    step={0.05}
                    onChange={(v) => handleParamUpdate({ dampingCoeff: v })}
                  />
                </>
              ) : params.mode === 'pendulum-harmonic' ? (
                <>
                  <TactileParameterControl
                    label="Panjang Tali Bandul (L)"
                    unit="m"
                    value={params.pendulumLength ?? 1.2}
                    min={0.3}
                    max={2.5}
                    step={0.1}
                    onChange={(v) => handleParamUpdate({ pendulumLength: v })}
                  />
                  <TactileParameterControl
                    label="Sudut Simpangan Awal (θ₀)"
                    unit="°"
                    value={params.pendulumAngle ?? 25}
                    min={5}
                    max={85}
                    step={1}
                    onChange={(v) => handleParamUpdate({ pendulumAngle: v })}
                  />
                  <TactileParameterControl
                    label="Massa Bandul (m)"
                    unit="kg"
                    value={params.mass}
                    min={0.5}
                    max={20}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />
                </>
              ) : params.mode === 'collision-momentum' ? (
                <>
                  <TactileParameterControl
                    label="Massa Benda 1 (m₁)"
                    unit="kg"
                    value={params.mass}
                    min={0.5}
                    max={25}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />
                  <TactileParameterControl
                    label="Kecepatan Awal 1 (v₁)"
                    unit="m/s"
                    value={params.initialVelocity || 10}
                    min={1}
                    max={30}
                    step={1}
                    onChange={(v) => handleParamUpdate({ initialVelocity: v })}
                  />
                  <TactileParameterControl
                    label="Massa Benda 2 (m₂)"
                    unit="kg"
                    value={params.collisionMass2}
                    min={0.5}
                    max={25}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ collisionMass2: v })}
                  />
                  <TactileParameterControl
                    label="Koefisien Restitusi (e)"
                    unit=""
                    value={params.restitutionCoeff}
                    min={0}
                    max={1.0}
                    step={0.05}
                    onChange={(v) => handleParamUpdate({ restitutionCoeff: v })}
                  />
                </>
              ) : params.mode === 'stokes-viscosity' ? (
                <>
                  <TactileParameterControl
                    label="Viskositas Fluida (η)"
                    unit="Pa·s"
                    value={params.fluidViscosity ?? 0.8}
                    min={0.05}
                    max={2.0}
                    step={0.05}
                    onChange={(v) => handleParamUpdate({ fluidViscosity: v, fluidViscosityPaS: v })}
                  />
                  <TactileParameterControl
                    label="Jari-jari Bola (r)"
                    unit="mm"
                    value={params.sphereRadius ?? 5}
                    min={1}
                    max={20}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ sphereRadius: v, sphereRadiusMm: v })}
                  />
                  <TactileParameterControl
                    label="Massa Jenis Bola (ρ_b)"
                    unit="kg/m³"
                    value={params.sphereDensity ?? 7800}
                    min={2000}
                    max={9000}
                    step={100}
                    onChange={(v) => handleParamUpdate({ sphereDensity: v, sphereDensityKgM3: v })}
                  />
                </>
              ) : params.mode === 'ohm-wheatstone' ? (
                <>
                  <TactileParameterControl
                    label="Tegangan Sumber (V)"
                    unit="V"
                    value={params.circuitVoltage ?? 12}
                    min={1}
                    max={24}
                    step={1}
                    onChange={(v) => handleParamUpdate({ circuitVoltage: v, circuitVoltageV: v })}
                  />
                  <TactileParameterControl
                    label="Resistor Uji (Rx)"
                    unit="Ω"
                    value={params.resistorRx ?? 100}
                    min={10}
                    max={500}
                    step={5}
                    onChange={(v) => handleParamUpdate({ resistorRx: v, bridgeRx: v })}
                  />
                  <TactileParameterControl
                    label="Resistor Pembanding (R₃)"
                    unit="Ω"
                    value={params.resistorR3 ?? 100}
                    min={10}
                    max={500}
                    step={5}
                    onChange={(v) => handleParamUpdate({ resistorR3: v, bridgeR3: v })}
                  />
                </>
              ) : params.mode === 'optics-young-slit' ? (
                <>
                  <TactileParameterControl
                    label="Panjang Gelombang Laser (λ)"
                    unit="nm"
                    value={params.lightWavelength ?? 532}
                    min={400}
                    max={700}
                    step={10}
                    onChange={(v) => handleParamUpdate({ lightWavelength: v })}
                  />
                  <TactileParameterControl
                    label="Jarak Antar Celah (d)"
                    unit="mm"
                    value={params.slitDistance ?? 0.25}
                    min={0.05}
                    max={0.8}
                    step={0.05}
                    onChange={(v) => handleParamUpdate({ slitDistance: v })}
                  />
                  <TactileParameterControl
                    label="Jarak Celah ke Layar (L)"
                    unit="m"
                    value={params.screenDistance ?? 1.5}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    onChange={(v) => handleParamUpdate({ screenDistance: v })}
                  />
                </>
              ) : params.mode === 'photoelectric-planck' ? (
                <>
                  <TactileParameterControl
                    label="Panjang Gelombang Foton (λ)"
                    unit="nm"
                    value={params.lightWavelength ?? 400}
                    min={200}
                    max={700}
                    step={10}
                    onChange={(v) => handleParamUpdate({ lightWavelength: v })}
                  />
                  <TactileParameterControl
                    label="Fungsi Kerja Logam (W₀)"
                    unit="eV"
                    value={params.targetMetalWorkFunction ?? 2.3}
                    min={2.0}
                    max={5.5}
                    step={0.1}
                    onChange={(v) => handleParamUpdate({ targetMetalWorkFunction: v })}
                  />
                  <TactileParameterControl
                    label="Potensial Penghenti (V₀)"
                    unit="V"
                    value={params.stoppingPotential ?? 1.2}
                    min={0}
                    max={5.0}
                    step={0.1}
                    onChange={(v) => handleParamUpdate({ stoppingPotential: v })}
                  />
                </>
              ) : params.mode === 'orbital-gravity' ? (
                <>
                  <TactileParameterControl
                    label="Massa Primer (M₁)"
                    unit="kg"
                    value={params.mass}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />
                  <TactileParameterControl
                    label="Massa Sekunder (M₂)"
                    unit="kg"
                    value={params.secondaryMass}
                    min={100}
                    max={5000}
                    step={100}
                    onChange={(v) => handleParamUpdate({ secondaryMass: v })}
                  />
                  <TactileParameterControl
                    label="Jarak Pisah Pusat (r)"
                    unit="m"
                    value={params.separationDistance}
                    min={1}
                    max={30}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ separationDistance: v })}
                  />
                </>
              ) : (
                <>
                  <TactileParameterControl
                    label="Massa Benda (m)"
                    unit="kg"
                    value={params.mass}
                    min={0.5}
                    max={30}
                    step={0.5}
                    onChange={(v) => handleParamUpdate({ mass: v })}
                  />

                  <TactileParameterControl
                    label="Gaya Dorong Luar (F)"
                    unit="N"
                    value={params.appliedForce}
                    min={-150}
                    max={250}
                    step={5}
                    onChange={(v) => handleParamUpdate({ appliedForce: v })}
                  />

                  <TactileParameterControl
                    label="Sudut Kemiringan (θ)"
                    unit="°"
                    value={params.inclineAngle}
                    min={0}
                    max={60}
                    step={1}
                    onChange={(v) => handleParamUpdate({ inclineAngle: v })}
                  />

                  <TactileParameterControl
                    label="Koefisien Gesek Kinetis (μk)"
                    unit=""
                    value={params.frictionCoeffKinetic}
                    min={0}
                    max={0.8}
                    step={0.05}
                    onChange={(v) => handleParamUpdate({ frictionCoeffKinetic: v })}
                  />
                </>
              )}
            </div>
          </CollapsibleLabSection>

          {/* Gravity Preset Pill Switcher */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider">
              Gravitasi Lingkungan (g):
            </span>
            <div className="grid grid-cols-3 gap-1">
              {GRAVITY_PRESETS.slice(0, 3).map((gp) => (
                <button
                  key={gp.name}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    handleParamUpdate({ gravity: gp.g });
                  }}
                  className={`py-1 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    Math.abs(params.gravity - gp.g) < 0.1
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {gp.name}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Formula Card */}
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
