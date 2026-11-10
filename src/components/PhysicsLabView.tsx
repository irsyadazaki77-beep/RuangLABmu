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
    onChangeParams({ ...params, ...patch });
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    const title =
      params.mode === 'projectile-gravity'
        ? 'Uji Kinematika Parabola'
        : params.mode === 'spring-hooke'
        ? 'Uji Osilasi Pegas Hooke'
        : params.mode === 'pendulum-harmonic'
        ? 'Uji Bandul Sederhana Harmonis'
        : 'Uji Bidang Miring Newton';

    const pSum = `m=${params.mass}kg, F=${params.appliedForce}N, θ=${params.inclineAngle}°`;
    const numX =
      params.mode === 'spring-hooke'
        ? params.springDisplacement
        : params.mode === 'projectile-gravity'
        ? params.initialVelocity
        : params.mode === 'pendulum-harmonic'
        ? params.pendulumAngle ?? 25
        : params.appliedForce;

    const numY1 =
      params.mode === 'spring-hooke'
        ? metrics.springRestoringForce
        : params.mode === 'projectile-gravity'
        ? metrics.projectileRange
        : params.mode === 'pendulum-harmonic'
        ? metrics.pendulumPeriod ?? 2.0
        : metrics.acceleration;

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

  // Telemetry Metrics Array
  const telemetryMetrics = [
    {
      id: 'accel',
      label: 'Percepatan (a)',
      value: metrics.acceleration,
      min: -20,
      max: 35,
      unit: 'm/s²',
      color: '#0ea5e9',
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
  ];

  return (
    <StandardLabViewShell
      domain="Fisika"
      recordsCount={records.length}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: 'Percepatan a(t)',
        primaryValue: metrics.acceleration,
        primaryUnit: 'm/s²',
        secondaryLabel: 'Kecepatan v(t)',
        secondaryValue: instant.speed,
        secondaryUnit: 'm/s',
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
                    handleParamUpdate({ mass: 10, appliedForce: 50 });
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
                labSound.playClick();
                handleParamUpdate({ mode: e.target.value as any });
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
            </select>
          </div>

          {/* Sliders & Controls */}
          <CollapsibleLabSection title="Variabel & Parameter Eksperimen" defaultOpen>
            <div className="space-y-3">
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
          <InteractiveFormulaCard
            title="Hukum II Newton & Analisis Resultan Gaya"
            tokens={[
              { symbol: 'a', value: metrics.acceleration, unit: 'm/s²', description: 'Percepatan' },
              { symbol: 'F', value: params.appliedForce, unit: 'N', description: 'Gaya Dorong' },
              { symbol: 'm', value: params.mass, unit: 'kg', description: 'Massa Benda' },
              { symbol: 'sin(θ)', value: params.inclineAngle, unit: '°', description: 'Sudut Bidang' },
            ]}
          />
        </>
      }
    />
  );
};
