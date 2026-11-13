import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
  Camera,
} from 'lucide-react';
import {
  ChemistryParams,
  AcademicLevel,
  calculateChemistryMetrics,
  THERMO_PRESETS,
  REDOX_PRESETS,
  evaluateSafetyHazard,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { LabErrorBoundary } from './common/LabErrorBoundary';
import { labSound } from '../utils/soundEngine';

const ChemistryScene3D = React.lazy(() => import('./ChemistryScene3D'));
import { SpatialCursorPayload } from '../utils/collabProtocol';
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
import {
  getChemistryParameterFeedback,
  normalizeEducationLevel,
} from '../utils/pedagogicalHelpers';
import { useTimelineRecorder } from '../hooks/useTimelineRecorder';
import { DualRealityLabViewport } from './ui/DualRealityLabViewport';

export interface ChemistryLabViewProps {
  params: ChemistryParams;
  onChangeParams: (next: ChemistryParams) => void;
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
  records?: ExperimentRecord[];
  activeStudentName?: string;
  activeGroupId?: string;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
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

export const ChemistryLabView: React.FC<ChemistryLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  academicLevel,
  records = [],
  onProceedToAnalysis,
  remoteCursors,
  onEmitCursor,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const storeAcademicLevel = useLabStore((s) => s.academicLevel);
  const playbackSpeed = useLabStore((s) => s.playbackSpeed);
  const isTimeTraveling = useLabStore((s) => s.isTimeTraveling);
  const effectiveEducationLevel = normalizeEducationLevel(
    academicLevel ?? storeAcademicLevel
  );
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [hazardModalDismissed, setHazardModalDismissed] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const simTimeRef = useRef<number>(0);
  const [isDualRealityMode, setIsDualRealityMode] = useState<boolean>(false);

  const buildInitialRealityB = (base: ChemistryParams): ChemistryParams => {
    switch (base.mode) {
      case 'acid-base-titration':
        return { ...base, titrantAddedMl: Math.min(50, Number((base.titrantAddedMl + 15).toFixed(1))) };
      case 'electrochemistry-cell':
        return { ...base, cathodeConcM: Math.min(2.0, Number((base.cathodeConcM * 2).toFixed(2))) };
      case 'ideal-gas-boyle':
        return { ...base, gasVolumeL: Math.max(2, Number(((base.gasVolumeL ?? 10) * 0.5).toFixed(1))) };
      case 'spectrophotometry-beer':
        return { ...base, spectroConcMm: Math.min(0.25, Number(((base.spectroConcMm ?? 0.1) * 2).toFixed(2))) };
      default:
        return {
          ...base,
          initialTempC: Math.min(95, base.initialTempC + 25),
          kineticsTempC: Math.min(95, (base.kineticsTempC ?? base.initialTempC) + 25),
        };
    }
  };

  const [realityBParams, setRealityBParams] = useState<ChemistryParams>(() => buildInitialRealityB(params));
  const prevChemModeRef = useRef(params.mode);
  useEffect(() => {
    if (prevChemModeRef.current !== params.mode) {
      prevChemModeRef.current = params.mode;
      setRealityBParams(buildInitialRealityB(params));
    }
  }, [params]);

  const metrics = calculateChemistryMetrics(params);
  const safetyHazard = evaluateSafetyHazard('Kimia', undefined, params);
  const prevHazardRef = useRef<boolean>(false);
  useEffect(() => {
    if (safetyHazard.isHazardous && !prevHazardRef.current) {
      labSound.playHazardAlarm();
    }
    prevHazardRef.current = safetyHazard.isHazardous;
  }, [safetyHazard.isHazardous]);
  const metricsB = calculateChemistryMetrics(realityBParams);

  useTimelineRecorder<ChemistryParams, { currentPh: number; finalTempC: number }>({
    domain: 'chemistry',
    simTime,
    simTimeRef,
    isPlaying,
    params,
    stateSnapshot: {
      currentPh: metrics.currentPh,
      finalTempC: metrics.finalTempC,
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

  // Reaction Preset lookup
  const currentPreset =
    THERMO_PRESETS.find((p) => p.id === params.reactionId) ||
    THERMO_PRESETS[0];
  const currentRedoxPreset =
    REDOX_PRESETS.find((p) => p.id === params.redoxPairId) ||
    REDOX_PRESETS[0];

  // Subscribe to Global Lab Events
  useEffect(() => {
    const unsubToggle = subscribeLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, (data: any) => {
      setIsPlaying((prev) => (data?.isSimulating !== undefined ? data.isSimulating : !prev));
    });
    const unsubReset = subscribeLabEvent(LAB_EVENTS.RESET_TRIAL, () => {
      setSimTime(0);
      simTimeRef.current = 0;
      setIsPlaying(false);
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

  const handleParamChange = (patch: Partial<ChemistryParams>) => {
    onChangeParams({ ...params, ...patch });
  };

  const modeToCatalogId: Record<string, string> = {
    'thermo-calorimetry': 'thermo-calorimetry',
    'acid-base-titration': 'acid-base-titration',
    'electrochemistry-cell': 'redox-electrochemistry',
    'ideal-gas-boyle': 'ideal-gas-boyle',
    'reaction-kinetics-arrhenius': 'reaction-kinetics-arrhenius',
    'spectrophotometry-beer': 'spectrophotometry-beer',
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    const title =
      params.mode === 'acid-base-titration'
        ? 'Uji Titrasi Asam-Basa'
        : params.mode === 'electrochemistry-cell'
        ? 'Uji Sel Galvani Volta'
        : params.mode === 'ideal-gas-boyle'
        ? 'Uji Kompresi Gas Boyle'
        : params.mode === 'reaction-kinetics-arrhenius'
        ? 'Uji Kinetika Reaksi Arrhenius'
        : params.mode === 'spectrophotometry-beer'
        ? 'Uji Spektrofotometri Beer-Lambert'
        : 'Uji Termokimia & Reaksi';

    const pSum =
      params.mode === 'acid-base-titration'
        ? `Vb=${params.titrantAddedMl}mL, Mb=${params.titrantBaseConc}M, Ma=${params.analyteAcidConc}M`
        : params.mode === 'electrochemistry-cell'
        ? `[Anoda]=${params.anodeConcM}M, [Katoda]=${params.cathodeConcM}M`
        : params.mode === 'ideal-gas-boyle'
        ? `V=${params.gasVolumeL ?? 10}L, T=${params.gasTemperatureK ?? 300}K`
        : params.mode === 'spectrophotometry-beer'
        ? `λ=${params.spectroWavelengthNm ?? 520}nm, C=${params.spectroConcMm ?? 0.1}mM`
        : `T=${params.initialTempC}°C, [M]=${params.reactantConcentration}M`;

    const numX =
      params.mode === 'acid-base-titration'
        ? params.titrantAddedMl
        : params.mode === 'ideal-gas-boyle'
        ? params.gasVolumeL ?? 10
        : params.mode === 'electrochemistry-cell'
        ? params.anodeConcM
        : params.mode === 'spectrophotometry-beer'
        ? params.spectroConcMm ?? 0.1
        : params.initialTempC;

    const numY1 =
      params.mode === 'acid-base-titration'
        ? metrics.currentPh
        : params.mode === 'ideal-gas-boyle'
        ? metrics.gasPressureAtm ?? 1.0
        : params.mode === 'electrochemistry-cell'
        ? metrics.nernstCellPotentialE
        : params.mode === 'spectrophotometry-beer'
        ? metrics.spectroAbsorbance ?? metrics.absorbanceA ?? 0.4
        : metrics.deltaTempC;

    onRecordExperiment(
      title,
      pSum,
      {
        'pH Larutan': metrics.currentPh,
        'Volume Titran (mL)': params.titrantAddedMl,
        'E_sel Potensial': `${metrics.nernstCellPotentialE ?? 1.1} V`,
      },
      hypothesisNote?.hypothesisText || '',
      { x: numX ?? 0, y1: numY1 ?? 0, y2: metrics.currentPh }
    );
  };

  const telemetryMetrics =
    params.mode === 'acid-base-titration'
      ? [
          { id: 'ph', label: 'pH Larutan', value: metrics.currentPh, min: 0, max: 14, unit: 'pH', color: '#14b8a6' },
          { id: 'vol', label: 'Vol Titran Vb', value: params.titrantAddedMl, min: 0, max: 50, unit: 'mL', color: '#0ea5e9' },
          { id: 'veq', label: 'Titik Ekuivalen', value: metrics.equivalenceVolumeMl, min: 0, max: 50, unit: 'mL', color: '#10b981' },
        ]
      : params.mode === 'electrochemistry-cell'
      ? [
          { id: 'enernst', label: 'Potensial E_sel', value: metrics.nernstCellPotentialE, min: 0, max: 2.5, unit: 'V', color: '#14b8a6' },
          { id: 'e0', label: 'Potensial E°_sel', value: metrics.standardCellPotentialE0, min: 0, max: 2.5, unit: 'V', color: '#0ea5e9' },
          { id: 'dg', label: 'Energi Bebas ΔG', value: metrics.electroFreeEnergyDeltaG, min: -500, max: 100, unit: 'kJ/mol', color: '#10b981' },
        ]
      : params.mode === 'ideal-gas-boyle'
      ? [
          { id: 'patm', label: 'Tekanan Gas (P)', value: metrics.gasPressureAtm ?? 2.4, min: 0, max: 15, unit: 'atm', color: '#14b8a6' },
          { id: 'vgas', label: 'Volume Bejana (V)', value: params.gasVolumeL ?? 10, min: 2, max: 25, unit: 'L', color: '#0ea5e9' },
          { id: 'tgas', label: 'Suhu Mutlak (T)', value: params.gasTemperatureK ?? 300, min: 200, max: 700, unit: 'K', color: '#10b981' },
        ]
      : params.mode === 'spectrophotometry-beer'
      ? [
          { id: 'abs', label: 'Absorbansi (A)', value: metrics.spectroAbsorbance ?? metrics.absorbanceA ?? 0.45, min: 0, max: 2.5, unit: 'A', color: '#14b8a6' },
          { id: 'trans', label: 'Transmitansi (%T)', value: metrics.spectroTransmittancePct ?? metrics.transmittancePct ?? 35, min: 0, max: 100, unit: '%', color: '#0ea5e9' },
          { id: 'wl', label: 'Panjang Gelombang', value: params.spectroWavelengthNm ?? 520, min: 400, max: 700, unit: 'nm', color: '#10b981' },
        ]
      : [
          { id: 'tf', label: 'Suhu Akhir (Tf)', value: metrics.finalTempC, min: 0, max: 100, unit: '°C', color: '#14b8a6' },
          { id: 'dt', label: 'Perubahan ΔT', value: metrics.deltaTempC, min: -30, max: 60, unit: '°C', color: '#0ea5e9' },
          { id: 'rate', label: 'Laju Reaksi (v)', value: metrics.reactionRate, min: 0, max: 5, unit: 'M/s', color: '#10b981' },
        ];

  return (
    <StandardLabViewShell
      domain="Kimia"
      recordsCount={records.length}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: telemetryMetrics[0].label,
        primaryValue: telemetryMetrics[0].value,
        primaryUnit: telemetryMetrics[0].unit,
        secondaryLabel: telemetryMetrics[1].label,
        secondaryValue: telemetryMetrics[1].value,
        secondaryUnit: telemetryMetrics[1].unit,
        microscopicStateLabel: `Kesetimbangan Ion [H⁺] vs [OH⁻] (Veq = ${metrics.equivalenceVolumeMl} mL)`,
        microscopicDetail: `Warna indikator bereaksi transisi pada trayek pH ekuivalen.`,
        accentColor: '#14b8a6',
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
          const chemVar = (() => {
            switch (params.mode) {
              case 'acid-base-titration':
                return {
                  key: 'titrantAddedMl' as const,
                  label: 'Volume Titran Vb (B)',
                  unit: 'mL',
                  min: 0,
                  max: 50,
                  step: 0.5,
                  valB: realityBParams.titrantAddedMl,
                  summaryA: `Vb=${params.titrantAddedMl}mL · pH=${metrics.currentPh}`,
                  summaryB: `Vb=${realityBParams.titrantAddedMl}mL · pH=${metricsB.currentPh}`,
                  delta: `ΔpH = ${(metricsB.currentPh - metrics.currentPh >= 0 ? '+' : '')}${(metricsB.currentPh - metrics.currentPh).toFixed(2)}`,
                };
              case 'ideal-gas-boyle':
                return {
                  key: 'gasVolumeL' as const,
                  label: 'Volume V (B)',
                  unit: 'L',
                  min: 2,
                  max: 25,
                  step: 0.5,
                  valB: realityBParams.gasVolumeL ?? 10,
                  summaryA: `V=${params.gasVolumeL ?? 10}L · P=${metrics.gasPressureAtm ?? 2.4}atm`,
                  summaryB: `V=${realityBParams.gasVolumeL ?? 10}L · P=${metricsB.gasPressureAtm ?? 2.4}atm`,
                  delta: `ΔP = ${((metricsB.gasPressureAtm ?? 0) - (metrics.gasPressureAtm ?? 0) >= 0 ? '+' : '')}${((metricsB.gasPressureAtm ?? 0) - (metrics.gasPressureAtm ?? 0)).toFixed(2)} atm`,
                };
              case 'electrochemistry-cell':
                return {
                  key: 'cathodeConcM' as const,
                  label: '[Katoda] (B)',
                  unit: 'M',
                  min: 0.01,
                  max: 2.0,
                  step: 0.05,
                  valB: realityBParams.cathodeConcM,
                  summaryA: `[Kat]=${params.cathodeConcM}M · E=${metrics.nernstCellPotentialE}V`,
                  summaryB: `[Kat]=${realityBParams.cathodeConcM}M · E=${metricsB.nernstCellPotentialE}V`,
                  delta: `ΔE = ${(metricsB.nernstCellPotentialE - metrics.nernstCellPotentialE >= 0 ? '+' : '')}${(metricsB.nernstCellPotentialE - metrics.nernstCellPotentialE).toFixed(3)} V`,
                };
              default:
                return {
                  key: 'initialTempC' as const,
                  label: 'Suhu T (B)',
                  unit: '°C',
                  min: 10,
                  max: 95,
                  step: 1,
                  valB: realityBParams.initialTempC,
                  summaryA: `T=${params.initialTempC}°C · v=${metrics.reactionRate}M/s`,
                  summaryB: `T=${realityBParams.initialTempC}°C · v=${metricsB.reactionRate}M/s`,
                  delta: `Δv = ${(metricsB.reactionRate - metrics.reactionRate >= 0 ? '+' : '')}${(metricsB.reactionRate - metrics.reactionRate).toFixed(2)} M/s`,
                };
            }
          })();

          return (
            <DualRealityLabViewport
              domain="Kimia"
              moduleTitle={params.mode}
              realityASummary={chemVar.summaryA}
              realityBSummary={chemVar.summaryB}
              deltaSummary={chemVar.delta}
              onResetBToMatchA={() => setRealityBParams({ ...params })}
              onClose={() => setIsDualRealityMode(false)}
              realityBControls={
                <div className="w-full flex items-center justify-between gap-3">
                  <span className="font-semibold text-amber-300 shrink-0">
                    {chemVar.label}:{' '}
                    <strong className="font-mono">
                      {chemVar.valB} {chemVar.unit}
                    </strong>
                  </span>
                  <input
                    type="range"
                    aria-label={chemVar.label}
                    min={chemVar.min}
                    max={chemVar.max}
                    step={chemVar.step}
                    value={chemVar.valB}
                    onChange={(e) => {
                      const nextVal = Number(e.target.value);
                      setRealityBParams((prev) =>
                        chemVar.key === 'initialTempC'
                          ? { ...prev, initialTempC: nextVal, kineticsTempC: nextVal }
                          : { ...prev, [chemVar.key]: nextVal }
                      );
                    }}
                    className="flex-1 max-w-[220px] accent-amber-400 cursor-pointer"
                  />
                </div>
              }
              renderViewport={(side, syncProps) => {
                const pSide = side === 'A' ? params : realityBParams;
                const mSide = side === 'A' ? metrics : metricsB;
                return (
                  <Suspense
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-xs font-mono text-teal-300">
                        Menyiapkan Realitas {side}...
                      </div>
                    }
                  >
                    <ChemistryScene3D
                      params={pSide}
                      metrics={mSide}
                      preset={currentPreset}
                      redoxPreset={currentRedoxPreset}
                      reactionProgress={Math.min(1, pSide.titrantAddedMl / Math.max(1, mSide.equivalenceVolumeMl))}
                      isReacting={pSide.initialTempC > 25}
                      simTime={simTime}
                      simTimeRef={simTimeRef}
                      cameraSyncPose={syncProps.cameraSyncPose}
                      onCameraSyncChange={syncProps.onCameraSyncChange}
                    />
                  </Suspense>
                );
              }}
            />
          );
        })() : undefined
      }
      canvas={
        <LabErrorBoundary domain="Kimia" sceneName="ChemistryScene3D">
          <Suspense
            fallback={
              <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 p-6 gap-3">
                <div className="w-9 h-9 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                <p className="text-xs font-mono font-semibold text-teal-300">
                  Menyiapkan Ruang Laboratorium 3D...
                </p>
              </div>
            }
          >
            <ChemistryScene3D
              params={params}
              metrics={metrics}
              preset={currentPreset}
              redoxPreset={currentRedoxPreset}
              reactionProgress={Math.min(1, params.titrantAddedMl / Math.max(1, metrics.equivalenceVolumeMl))}
              isReacting={params.initialTempC > 25}
              simTime={simTime}
              simTimeRef={simTimeRef}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              onUpdateParam={(key, val) => handleParamChange({ [key]: val } as any)}
              snapshotCount={snapshotCount}
              onCaptureSnapshot={(dataUrl) => {
                setShutterFlash(true);
                setTimeout(() => setShutterFlash(false), 240);
                onCapture3DSnapshot?.(
                  dataUrl,
                  'Titrasi & Reaksi Kimia 3D',
                  `Vb=${params.titrantAddedMl}mL, T=${params.initialTempC}°C`,
                  `pH = ${metrics.currentPh}`
                );
              }}
            />
          </Suspense>
        </LabErrorBoundary>
      }
      safetyModal={
        safetyHazard.isHazardous && !hazardModalDismissed ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-lg w-full rounded-2xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/20 text-[11px] font-mono font-bold text-rose-300">
                  PERINGATAN K3 — KIMIA
                </span>
                {safetyHazard.triggerParamSummary && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                    {safetyHazard.triggerParamSummary}
                  </span>
                )}
              </div>
              <h3 className="text-base font-extrabold text-white">{safetyHazard.title}</h3>
              <p className="text-xs leading-relaxed text-slate-300">{safetyHazard.scientificExplanation}</p>
              {safetyHazard.mitigationInstruction && (
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 p-3 text-xs text-emerald-200">
                  <span className="font-bold text-emerald-300 block mb-0.5">Prosedur Mitigasi K3:</span>
                  {safetyHazard.mitigationInstruction}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setHazardModalDismissed(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Saya Paham
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playRecordSuccess();
                    handleParamChange({
                      initialTempC: 25,
                      kineticsTempC: 25,
                      gasTemperatureK: 300,
                      gasVolumeL: 10,
                      titrantAddedMl: 25,
                      analyteAcidConc: 0.1,
                      titrantBaseConc: 0.1,
                    });
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
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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
              Mode Modul Kimia:
            </label>
            <select
              value={params.mode}
              onChange={(e) => {
                const nextMode = e.target.value as ChemistryParams['mode'];
                labSound.playClick();
                handleParamChange({ mode: nextMode });
                if (modeToCatalogId[nextMode]) {
                  useLabStore.getState().setActiveModule(modeToCatalogId[nextMode]);
                }
              }}
              className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
            >
              <option value="acid-base-titration">Titrasi Asam-Basa (pH &amp; Indikator)</option>
              <option value="thermo-calorimetry">Termokimia &amp; Kalorimetri Entalpi</option>
              <option value="electrochemistry-cell">Sel Elektrokimia Galvani / Volta</option>
              <option value="ideal-gas-boyle">Hukum Gas Ideal Boyle-Gay Lussac</option>
              <option value="reaction-kinetics-arrhenius">Kinetika Reaksi &amp; Arrhenius</option>
              <option value="spectrophotometry-beer">Spektrofotometri UV-Vis Beer-Lambert</option>
            </select>
          </div>

          {/* Direct Burette Dispenser Button */}
          {params.mode === 'acid-base-titration' && (
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
              <span className="font-bold text-xs text-teal-800 dark:text-teal-200 block">
                Aliran Kran Buret 3D:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(680);
                    handleParamChange({
                      titrantAddedMl: Math.min(50, Number((params.titrantAddedMl + 1.0).toFixed(1))),
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  +1.0 mL Titran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(720);
                    handleParamChange({
                      titrantAddedMl: Math.min(50, Number((params.titrantAddedMl + 5.0).toFixed(1))),
                    });
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  +5.0 mL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick(440);
                    handleParamChange({ titrantAddedMl: 0 });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Sliders & Parameters */}
          <CollapsibleLabSection title="Variabel & Parameter Larutan" defaultOpen>
            <div className="space-y-3">
              {params.mode === 'acid-base-titration' ? (
                <>
                  <TactileParameterControl
                    id="chem-titrant-ml"
                    paramKey="titrantAddedMl"
                    label="Volume Titran Buret (Vb)"
                    unit="mL"
                    value={params.titrantAddedMl}
                    min={0}
                    max={50}
                    step={0.5}
                    glossaryTerm="Titik Ekivalen"
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'titrantAddedMl', v, lvl, {
                        equivalenceVolumeMl: metrics.equivalenceVolumeMl,
                      })
                    }
                    onChange={(v) => handleParamChange({ titrantAddedMl: v })}
                  />
                  <TactileParameterControl
                    paramKey="titrantBaseConc"
                    label="Konsentrasi Titran (Mb)"
                    unit="M"
                    value={params.titrantBaseConc}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'titrantBaseConc', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ titrantBaseConc: v })}
                  />
                  <TactileParameterControl
                    paramKey="analyteAcidConc"
                    label="Konsentrasi Analit (Ma)"
                    unit="M"
                    value={params.analyteAcidConc}
                    min={0.05}
                    max={1.0}
                    step={0.05}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'analyteAcidConc', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ analyteAcidConc: v })}
                  />
                </>
              ) : params.mode === 'electrochemistry-cell' ? (
                <>
                  <TactileParameterControl
                    label="Konsentrasi Ion Anoda [Mⁿ⁺]"
                    unit="M"
                    value={params.anodeConcM}
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'anodeConcM', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ anodeConcM: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Ion Katoda [Mⁿ⁺]"
                    unit="M"
                    value={params.cathodeConcM}
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'cathodeConcM', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ cathodeConcM: v })}
                  />
                  <TactileParameterControl
                    label="Suhu Sel Elektrokimia (T)"
                    unit="°C"
                    value={params.initialTempC}
                    min={10}
                    max={80}
                    step={1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'initialTempC', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ initialTempC: v })}
                  />
                </>
              ) : params.mode === 'ideal-gas-boyle' ? (
                <>
                  <TactileParameterControl
                    paramKey="gasVolumeL"
                    label="Volume Silinder Gas (V)"
                    unit="L"
                    value={params.gasVolumeL ?? 10}
                    min={2.0}
                    max={25.0}
                    step={0.5}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'gasVolumeL', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ gasVolumeL: v })}
                  />
                  <TactileParameterControl
                    paramKey="gasTemperatureK"
                    label="Suhu Mutlak Gas (T)"
                    unit="K"
                    value={params.gasTemperatureK ?? 300}
                    min={250}
                    max={700}
                    step={10}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'gasTemperatureK', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ gasTemperatureK: v })}
                  />
                  <TactileParameterControl
                    label="Jumlah Mol Gas (n)"
                    unit="mol"
                    value={params.gasMoles ?? 1.0}
                    min={0.2}
                    max={2.5}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'gasMoles', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ gasMoles: v })}
                  />
                </>
              ) : params.mode === 'spectrophotometry-beer' ? (
                <>
                  <TactileParameterControl
                    label="Panjang Gelombang Monokromator (λ)"
                    unit="nm"
                    value={params.spectroWavelengthNm ?? 520}
                    min={400}
                    max={700}
                    step={10}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'spectroWavelengthNm', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ spectroWavelengthNm: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Sampel Kuvet (C)"
                    unit="mM"
                    value={params.spectroConcMm ?? 0.1}
                    min={0.01}
                    max={0.25}
                    step={0.01}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'spectroConcMm', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ spectroConcMm: v })}
                  />
                  <TactileParameterControl
                    label="Tebal Kuvet (l)"
                    unit="cm"
                    value={params.spectroPathLengthCm ?? 1.0}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'spectroPathLengthCm', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ spectroPathLengthCm: v })}
                  />
                </>
              ) : (
                <>
                  <TactileParameterControl
                    id="chem-heater-temp"
                    paramKey="initialTempC"
                    label="Suhu Pemanas (T)"
                    unit="°C"
                    value={params.initialTempC}
                    min={10}
                    max={95}
                    step={1}
                    glossaryTerm="Denaturasi"
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'initialTempC', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ initialTempC: v, kineticsTempC: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Reaktan"
                    unit="M"
                    value={params.reactantConcentration}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'reactantConcentration', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ reactantConcentration: v, kineticsConcA: v })}
                  />
                  <TactileParameterControl
                    label="Kecepatan Pengaduk Magnetik"
                    unit="RPM"
                    value={params.stirringRpm}
                    min={0}
                    max={600}
                    step={20}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getChemistryParameterFeedback(params.mode, 'stirringRpm', v, lvl)
                    }
                    onChange={(v) => handleParamChange({ stirringRpm: v })}
                  />
                </>
              )}
            </div>
          </CollapsibleLabSection>

          {/* Interactive Formula Card */}
          <CollapsibleLabSection title="Rumus & Kalkulator Interaktif" defaultOpen={false}>
            <InteractiveFormulaCard
              title={params.mode === 'acid-base-titration' ? 'Persamaan Titrasi Asam-Basa' : 'Termokimia & Kinetika Reaksi'}
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
