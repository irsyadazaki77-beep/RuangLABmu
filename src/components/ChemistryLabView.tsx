import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeEducationLevel } from '../utils/pedagogicalHelpers';
import { useTimelineRecorder } from '../hooks/useTimelineRecorder';
import { DualRealityLabViewport } from './ui/DualRealityLabViewport';
import { PrecisionSlider } from './controls/PrecisionSlider';
import { filterRecordsForModule } from '../utils/spatialHudHelpers';
import { LabSidebarActionHeader } from './layout/LabSidebarActionHeader';
import { LabSceneFallback } from './three/LabSceneFallback';
import { LabHazardModal } from './three/LabHazardModal';
import { ChemistryParameterPanel } from './labs/ChemistryParameterPanel';
import { LabPresetAndSweepBar } from './labs/LabPresetAndSweepBar';
import {
  generateAutoSweepSeries,
  getChemistryPresetsForMode,
} from '../utils/labScenarioPresets';

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
  onDeleteRecord,
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
      case 'chemical-equilibrium-lechatelier':
        return { ...base, equilibriumTempC: Math.min(100, (base.equilibriumTempC ?? 25) + 35) };
      case 'electrolysis-faraday':
        return { ...base, electrolysisCurrentA: Math.min(8.0, Number(((base.electrolysisCurrentA ?? 2.5) * 1.6).toFixed(2))) };
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
      : params.mode === 'chemical-equilibrium-lechatelier'
      ? [
          { id: 'xno2', label: 'Fraksi NO₂ (x)', value: metrics.no2MoleFractionPct ?? 31.4, min: 0, max: 100, unit: '%', color: '#14b8a6' },
          { id: 'kp', label: 'Konstanta Kp', value: metrics.leChatelierKp ?? 0.142, min: 0, max: 20, unit: 'atm', color: '#0ea5e9' },
          { id: 'alpha', label: 'Derajat Disosiasi (α)', value: metrics.no2DissociationAlpha ?? 0.186, min: 0, max: 1, unit: '', color: '#10b981' },
        ]
      : params.mode === 'electrolysis-faraday'
      ? [
          { id: 'mass', label: 'Massa Endapan (m)', value: metrics.electrolysisMassDepositedG ?? 1.48, min: 0, max: 20, unit: 'g', color: '#14b8a6' },
          { id: 'charge', label: 'Muatan Listrik (Q)', value: metrics.electrolysisChargeC ?? 4500, min: 0, max: 60000, unit: 'C', color: '#0ea5e9' },
          { id: 'o2', label: 'Volume Gas O₂', value: metrics.electrolysisAnodeGasMl ?? 261.3, min: 0, max: 3000, unit: 'mL', color: '#10b981' },
        ]
      : [
          { id: 'tf', label: 'Suhu Akhir (Tf)', value: metrics.finalTempC, min: 0, max: 100, unit: '°C', color: '#14b8a6' },
          { id: 'dt', label: 'Perubahan ΔT', value: metrics.deltaTempC, min: -30, max: 60, unit: '°C', color: '#0ea5e9' },
          { id: 'rate', label: 'Laju Reaksi (v)', value: metrics.reactionRate, min: 0, max: 5, unit: 'M/s', color: '#10b981' },
        ];

  useTimelineRecorder<ChemistryParams, { primary: number; secondary: number }>({
    domain: 'chemistry',
    simTime,
    simTimeRef,
    isPlaying,
    params,
    stateSnapshot: {
      primary: telemetryMetrics[0]?.value ?? metrics.currentPh,
      secondary: telemetryMetrics[1]?.value ?? metrics.finalTempC,
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
    'chemical-equilibrium-lechatelier': 'chemical-equilibrium-lechatelier',
    'electrolysis-faraday': 'electrolysis-faraday',
  };
  const moduleRecords = filterRecordsForModule(records, 'Kimia', modeToCatalogId[params.mode]);

  const scenarioPresets = useMemo(
    () => getChemistryPresetsForMode(params.mode),
    [params.mode]
  );
  const sweepSteps = useMemo(
    () => generateAutoSweepSeries('Kimia', params.mode, 5),
    [params.mode]
  );

  const handleRecordTrial = (overrideParams?: ChemistryParams, noteOverride?: string) => {
    const p = overrideParams ?? params;
    const m = overrideParams ? calculateChemistryMetrics(overrideParams) : metrics;
    labSound.playRecordSuccess();
    const title =
      p.mode === 'acid-base-titration'
        ? 'Uji Titrasi Asam-Basa'
        : p.mode === 'electrochemistry-cell'
        ? 'Uji Sel Galvani Volta'
        : p.mode === 'ideal-gas-boyle'
        ? 'Uji Kompresi Gas Boyle'
        : p.mode === 'reaction-kinetics-arrhenius'
        ? 'Uji Kinetika Reaksi Arrhenius'
        : p.mode === 'spectrophotometry-beer'
        ? 'Uji Spektrofotometri Beer-Lambert'
        : p.mode === 'chemical-equilibrium-lechatelier'
        ? 'Uji Kesetimbangan Le Chatelier N₂O₄ ⇌ 2NO₂'
        : p.mode === 'electrolysis-faraday'
        ? 'Uji Sel Elektrolisis & Hukum I Faraday'
        : 'Uji Termokimia & Reaksi';

    const pSum =
      p.mode === 'acid-base-titration'
        ? `Vb=${p.titrantAddedMl}mL, Mb=${p.titrantBaseConc}M, Ma=${p.analyteAcidConc}M`
        : p.mode === 'electrochemistry-cell'
        ? `[Anoda]=${p.anodeConcM}M, [Katoda]=${p.cathodeConcM}M`
        : p.mode === 'ideal-gas-boyle'
        ? `V=${p.gasVolumeL ?? 10}L, T=${p.gasTemperatureK ?? 300}K`
        : p.mode === 'spectrophotometry-beer'
        ? `λ=${p.spectroWavelengthNm ?? 520}nm, C=${p.spectroConcMm ?? 0.1}mM`
        : p.mode === 'chemical-equilibrium-lechatelier'
        ? `T=${p.equilibriumTempC ?? 25}°C, P=${p.equilibriumPressureAtm ?? 1.0}atm, [N₂O₄]₀=${p.n2o4InitialConcM ?? 0.5}M`
        : p.mode === 'electrolysis-faraday'
        ? `I=${p.electrolysisCurrentA ?? 2.5}A, t=${p.electrolysisTimeMin ?? 30}mnt, Logam=${m.electrolysisMetalSymbol ?? 'Cu'}`
        : `T=${p.initialTempC}°C, [M]=${p.reactantConcentration}M`;

    const numX =
      p.mode === 'acid-base-titration'
        ? p.titrantAddedMl
        : p.mode === 'ideal-gas-boyle'
        ? p.gasVolumeL ?? 10
        : p.mode === 'electrochemistry-cell'
        ? p.cathodeConcM
        : p.mode === 'spectrophotometry-beer'
        ? p.spectroConcMm ?? 0.1
        : p.mode === 'chemical-equilibrium-lechatelier'
        ? p.equilibriumTempC ?? 25
        : p.mode === 'electrolysis-faraday'
        ? p.electrolysisCurrentA ?? 2.5
        : p.initialTempC;

    const numY1 =
      p.mode === 'acid-base-titration'
        ? m.currentPh
        : p.mode === 'ideal-gas-boyle'
        ? m.gasPressureAtm ?? 1.0
        : p.mode === 'electrochemistry-cell'
        ? m.nernstCellPotentialE
        : p.mode === 'spectrophotometry-beer'
        ? m.spectroAbsorbance ?? m.absorbanceA ?? 0.4
        : p.mode === 'chemical-equilibrium-lechatelier'
        ? m.no2MoleFractionPct ?? 31.4
        : p.mode === 'electrolysis-faraday'
        ? m.electrolysisMassDepositedG ?? 1.48
        : m.deltaTempC;

    const recordMetrics: Record<string, number | string> =
      p.mode === 'electrolysis-faraday'
        ? {
            'Massa Endapan (m)': `${m.electrolysisMassDepositedG ?? 1.48} g`,
            'Muatan Listrik (Q)': `${m.electrolysisChargeC ?? 4500} C`,
            'Volume Gas O₂': `${m.electrolysisAnodeGasMl ?? 261.3} mL`,
          }
        : {
            'pH Larutan': m.currentPh,
            'Volume Titran (mL)': p.titrantAddedMl,
            'E_sel Potensial': `${m.nernstCellPotentialE ?? 1.1} V`,
          };

    onRecordExperiment(
      title,
      pSum,
      recordMetrics,
      noteOverride ?? (hypothesisNote?.hypothesisText || ''),
      {
        x: numX ?? 0,
        y1: numY1 ?? 0,
        y2: p.mode === 'electrolysis-faraday' ? (m.electrolysisAnodeGasMl ?? 261.3) : m.currentPh,
      }
    );
  };

  return (
    <StandardLabViewShell
      domain="Kimia"
      recordsCount={moduleRecords.length}
      hypothesisText={hypothesisNote?.hypothesisText}
      recentRecords={moduleRecords}
      onProceedToAnalysis={onProceedToAnalysis}
      onDeleteRecord={onDeleteRecord}
      onBackToPreLab={() => useLabStore.getState().setWorkflowStep(1)}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={(() => {
        const primaryTxt = `${telemetryMetrics[0].label} = ${telemetryMetrics[0].value} ${telemetryMetrics[0].unit}`;
        const secondaryTxt = `${telemetryMetrics[1].label} = ${telemetryMetrics[1].value} ${telemetryMetrics[1].unit}`;
        const modeHint = (() => {
          switch (params.mode) {
            case 'electrochemistry-cell':
              return {
                label: `Sel Volta: ${primaryTxt} · ${secondaryTxt}`,
                detail: `Aliran elektron bergerak dari anoda (oksidasi) menuju katoda (reduksi) melalui jembatan garam.`,
              };
            case 'ideal-gas-boyle':
              return {
                label: `Gas Ideal: ${primaryTxt} · ${secondaryTxt}`,
                detail: `Tumbukan partikel gas terhadap dinding wadah menentukan tekanan termodinamik.`,
              };
            case 'spectrophotometry-beer':
              return {
                label: `Hukum Beer-Lambert: ${primaryTxt} · ${secondaryTxt}`,
                detail: `Absorbansi larutan sebanding lurus dengan konsentrasi molar dan panjang lintasan kuvet.`,
              };
            case 'chemical-equilibrium-lechatelier':
              return {
                label: `Kesetimbangan: ${primaryTxt} · ${secondaryTxt}`,
                detail: `Pergeseran sistem mengikuti asas Le Chatelier untuk meminimalkan gangguan eksternal.`,
              };
            case 'electrolysis-faraday':
              return {
                label: `Hukum I Faraday: ${primaryTxt} · ${secondaryTxt}`,
                detail: `Reduksi kation mengendap di katoda sesuai m = (Ar·I·t)/(n·F), sementara gas O₂ terbentuk di anoda.`,
              };
            case 'acid-base-titration':
              return {
                label: `Kesetimbangan Ion [H⁺] vs [OH⁻] (Veq = ${metrics.equivalenceVolumeMl} mL)`,
                detail: `Warna indikator bereaksi transisi pada trayek pH ekuivalen.`,
              };
            default:
              return {
                label: `Kinetika & Termokimia: ${primaryTxt} · ${secondaryTxt}`,
                detail: `Frekuensi tumbukan efektif antar molekul menentukan laju dan perubahan entalpi reaksi.`,
              };
          }
        })();
        return {
          primaryLabel: telemetryMetrics[0].label,
          primaryValue: telemetryMetrics[0].value,
          primaryUnit: telemetryMetrics[0].unit,
          secondaryLabel: telemetryMetrics[1].label,
          secondaryValue: telemetryMetrics[1].value,
          secondaryUnit: telemetryMetrics[1].unit,
          microscopicStateLabel: modeHint.label,
          microscopicDetail: modeHint.detail,
          accentColor: '#14b8a6',
        };
      })()}
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
              case 'chemical-equilibrium-lechatelier': {
                const deltaX = (metricsB.no2MoleFractionPct ?? 0) - (metrics.no2MoleFractionPct ?? 0);
                return {
                  key: 'equilibriumTempC' as const,
                  label: 'Suhu Bejana T (B)',
                  unit: '°C',
                  min: -10,
                  max: 100,
                  step: 1,
                  valB: realityBParams.equilibriumTempC ?? 60,
                  summaryA: `T=${params.equilibriumTempC ?? 25}°C · NO₂=${metrics.no2MoleFractionPct}%`,
                  summaryB: `T=${realityBParams.equilibriumTempC ?? 60}°C · NO₂=${metricsB.no2MoleFractionPct}%`,
                  delta: `ΔNO₂ = ${(deltaX >= 0 ? '+' : '')}${deltaX.toFixed(1)}%`,
                };
              }
              case 'electrolysis-faraday': {
                const deltaM = (metricsB.electrolysisMassDepositedG ?? 0) - (metrics.electrolysisMassDepositedG ?? 0);
                return {
                  key: 'electrolysisCurrentA' as const,
                  label: 'Arus Listrik I (B)',
                  unit: 'A',
                  min: 0.5,
                  max: 8.0,
                  step: 0.25,
                  valB: realityBParams.electrolysisCurrentA ?? 4.0,
                  summaryA: `I=${params.electrolysisCurrentA ?? 2.5}A · m=${metrics.electrolysisMassDepositedG}g`,
                  summaryB: `I=${realityBParams.electrolysisCurrentA ?? 4.0}A · m=${metricsB.electrolysisMassDepositedG}g`,
                  delta: `Δm = ${(deltaM >= 0 ? '+' : '')}${deltaM.toFixed(3)} g`,
                };
              }
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
                    label={chemVar.label}
                    unit={chemVar.unit}
                    min={chemVar.min}
                    max={chemVar.max}
                    step={chemVar.step}
                    value={chemVar.valB}
                    defaultValue={
                      chemVar.key === 'titrantAddedMl'
                        ? params.titrantAddedMl
                        : chemVar.key === 'gasVolumeL'
                        ? params.gasVolumeL ?? 10
                        : chemVar.key === 'cathodeConcM'
                        ? params.cathodeConcM
                        : chemVar.key === 'equilibriumTempC'
                        ? params.equilibriumTempC ?? 25
                        : chemVar.key === 'electrolysisCurrentA'
                        ? params.electrolysisCurrentA ?? 2.5
                        : params.initialTempC
                    }
                    onChange={(nextVal) =>
                      setRealityBParams((prev) =>
                        chemVar.key === 'initialTempC'
                          ? { ...prev, initialTempC: nextVal, kineticsTempC: nextVal }
                          : { ...prev, [chemVar.key]: nextVal }
                      )
                    }
                  />
                </div>
              }
              renderViewport={(side, syncProps) => {
                const pSide = side === 'A' ? params : realityBParams;
                const mSide = side === 'A' ? metrics : metricsB;
                return (
                  <LabErrorBoundary domain="Kimia" sceneName={`ChemistryScene3D-${side}`}>
                    <Suspense
                      fallback={
                        <LabSceneFallback compact label={`Menyiapkan Realitas ${side}...`} />
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
                  </LabErrorBoundary>
                );
              }}
            />
          );
        })() : undefined
      }
      canvas={
        <LabErrorBoundary domain="Kimia" sceneName="ChemistryScene3D">
          <Suspense fallback={<LabSceneFallback accentColor="teal" />}>
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
          <LabHazardModal
            domainLabel="KIMIA"
            hazard={safetyHazard}
            onDismiss={() => setHazardModalDismissed(true)}
            onRestoreSafe={() => {
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
          />
        ) : null
      }
      sidebar={
        <>
          <LabSidebarActionHeader
            recordsCount={moduleRecords.length}
            accentColor="teal"
            onRecordTrial={handleRecordTrial}
            onProceedToAnalysis={onProceedToAnalysis}
          />

          <div className="space-y-1.5">
            <label className="text-2xs font-bold text-[var(--comfort-text-muted)] uppercase tracking-wider">
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
              className="w-full text-xs p-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-semibold"
            >
              <option value="acid-base-titration">Titrasi Asam-Basa (pH &amp; Indikator)</option>
              <option value="thermo-calorimetry">Termokimia &amp; Kalorimetri Entalpi</option>
              <option value="electrochemistry-cell">Sel Elektrokimia Galvani / Volta</option>
              <option value="ideal-gas-boyle">Hukum Gas Ideal Boyle-Gay Lussac</option>
              <option value="reaction-kinetics-arrhenius">Kinetika Reaksi &amp; Arrhenius</option>
              <option value="spectrophotometry-beer">Spektrofotometri UV-Vis Beer-Lambert</option>
              <option value="chemical-equilibrium-lechatelier">Kesetimbangan Kimia Dinamis &amp; Asas Le Chatelier</option>
              <option value="electrolysis-faraday">Sel Elektrolisis &amp; Hukum I Faraday</option>
            </select>
          </div>

          <LabPresetAndSweepBar
            presets={scenarioPresets}
            sweepSteps={sweepSteps}
            accentColor="teal"
            currentParams={params as unknown as Record<string, unknown>}
            onApplyPreset={(preset) => handleParamChange(preset.patch)}
            onSweepStep={(step) => {
              const nextParams = { ...params, ...(step.patch as Partial<ChemistryParams>) };
              onChangeParams(nextParams);
              handleRecordTrial(nextParams, step.label);
            }}
          />

          <ChemistryParameterPanel
            params={params}
            metrics={metrics}
            educationLevel={effectiveEducationLevel}
            onParamChange={handleParamChange}
          />

          <CollapsibleLabSection title="Rumus & Kalkulator Interaktif" defaultOpen={false}>
            <InteractiveFormulaCard
              title={
                params.mode === 'acid-base-titration'
                  ? 'Persamaan Titrasi Asam-Basa'
                  : 'Termokimia & Kinetika Reaksi'
              }
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
