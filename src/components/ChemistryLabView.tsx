import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  HelpCircle,
  CheckCircle,
  FlaskConical,
  Sliders,
  NotebookPen,
  GitCompareArrows,
} from 'lucide-react';
import {
  ChemistryParams,
  ChemistryMetrics,
  THERMO_PRESETS,
  REDOX_PRESETS,
  AcademicLevel,
  calculateChemistryMetrics,
  generateAutomaticFeedback,
  evaluateSafetyHazard,
  GUIDED_LAB_SCENARIOS,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { ChemistryScene3D } from './ChemistryScene3D';
import { labSound } from '../utils/soundEngine';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import {
  DEFAULT_INSTRUMENTS,
  DEFAULT_CALIBRATION_CONFIG,
  InstrumentCalibrationConfig,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import {
  CircularGaugeMeter,
  LiquidColumnMeter,
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

interface ChemistryLabViewProps {
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
  onSyncWithGroup: (summary: string) => void;
  academicLevel?: AcademicLevel;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
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

export const ChemistryLabView: React.FC<ChemistryLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  remoteCursors,
  onEmitCursor,
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
  const [isReacting, setIsReacting] = useState<boolean>(true);
  const [reactionProgress, setReactionProgress] = useState<number>(0.25);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [calibrationConfig, setCalibrationConfig] =
    useState<InstrumentCalibrationConfig>(DEFAULT_CALIBRATION_CONFIG);
  const [cockpitTab, setCockpitTab] = useState<'controls' | 'data-diff' | 'hypothesis'>('controls');
  const [hazardModalDismissed, setHazardModalDismissed] = useState<boolean>(false);
  const [localHypothesis, setLocalHypothesis] = useState<HypothesisNote>({
    independentVar: 'Volume Titran / Suhu Awal (T₀)',
    dependentVar: 'pH Larutan / Perubahan Entalpi (ΔH)',
    hypothesisText: '',
    reflectionText: '',
    updatedAt: '',
  });
  const effectiveHypothesis = hypothesisNote ?? localHypothesis;
  const handleUpdateHypothesis = (next: HypothesisNote) => {
    setLocalHypothesis(next);
    if (onChangeHypothesisNote) onChangeHypothesisNote(next);
  };

  // Mystery Sample Exam State
  const [mysteryGuessInput, setMysteryGuessInput] = useState<string>('');
  const [mysteryFeedbackResult, setMysteryFeedbackResult] =
    useState<MysterySubmissionResult | null>(null);

  const animRef = useRef<number | null>(null);

  const preset =
    THERMO_PRESETS.find((p) => p.id === params.reactionId) || THERMO_PRESETS[0];
  const redoxPreset =
    REDOX_PRESETS.find((r) => r.id === params.redoxPairId) || REDOX_PRESETS[0];
  const metrics: ChemistryMetrics = calculateChemistryMetrics(params);
  const safetyHazard = evaluateSafetyHazard('Kimia', undefined, params);

  useEffect(() => {
    if (!safetyHazard.isHazardous) {
      setHazardModalDismissed(false);
    }
  }, [safetyHazard.isHazardous, safetyHazard.hazardCode]);

  useEffect(() => {
    if (!isReacting) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (params.mode === 'acid-base-titration') {
        const nextMl = Math.min(
          50,
          Number((params.titrantAddedMl + dt * 3.5).toFixed(1))
        );
        labSound.playTitrationDrop(metrics.currentPh);
        onChangeParams({
          ...params,
          titrantAddedMl: nextMl >= 49.5 ? 0 : nextMl,
        });
      } else {
        setReactionProgress((prev) => {
          const speedFactor = params.useCatalyst ? 0.28 : 0.16;
          const next = prev + dt * speedFactor;
          if (next >= 1) {
            return 0;
          }
          return next;
        });
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isReacting, params, metrics.currentPh]);

  const handleParamChange = (patch: Partial<ChemistryParams>) => {
    onChangeParams({ ...params, ...patch });
  };

  const handleToggleReaction = () => {
    labSound.playClick(700);
    if (reactionProgress >= 1) setReactionProgress(0);
    const nextState = !isReacting;
    setIsReacting(nextState);
    if (nextState) {
      onPushNotification(generateAutomaticFeedback('Kimia', undefined, params));
    }
  };

  const handleResetReaction = () => {
    labSound.playClick(460);
    setIsReacting(false);
    setReactionProgress(0);
    if (params.mode === 'acid-base-titration') {
      handleParamChange({ titrantAddedMl: 0 });
    }
  };

  const handleRecordChemistry = () => {
    labSound.playRecordSuccess();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 260);

    let title = '';
    let summary = '';
    let keyMetrics: Record<string, number | string> = {};
    let numericCoords = {
      x: params.initialTempC,
      y1: metrics.deltaG,
      y2: metrics.reactionRate,
    };

    if (params.mode === 'acid-base-titration') {
      const mPh = applyInstrumentNoise(
        metrics.currentPh,
        DEFAULT_INSTRUMENTS.phMeter,
        !calibrationConfig.isZeroCalibrated || calibrationConfig.precisionTier === 'high-precision',
        calibrationConfig
      );
      title = `Titrasi Asam-Basa (V_NaOH = ${params.titrantAddedMl} mL)`;
      summary = `[Asam]=${params.analyteAcidConc}M (${params.analyteVolumeMl}mL), [Basa]=${params.titrantBaseConc}M, V_b=${params.titrantAddedMl}mL`;
      keyMetrics = {
        'pH Larutan': formatMeasurementWithUncertainty(mPh.measuredValue, mPh.uncertainty, ''),
        'Volume Ekuivalen': `${metrics.equivalenceVolumeMl} mL`,
        Zona: metrics.titrationRegion,
        Indikator: metrics.indicatorColorName,
      };
      numericCoords = {
        x: params.titrantAddedMl,
        y1: mPh.measuredValue,
        y2: metrics.equivalenceVolumeMl,
      };
    } else if (params.mode === 'electrochemistry-cell') {
      title = `Sel Galvani: ${redoxPreset.name}`;
      summary = `[Anoda]=${params.anodeConcM}M, [Katoda]=${params.cathodeConcM}M, T=${params.initialTempC}°C`;
      keyMetrics = {
        'Potensial E°_sel': `+${metrics.standardCellPotentialE0} V`,
        'Potensial Nernst E': `+${metrics.nernstCellPotentialE} V`,
        'ΔG Redoks': `${metrics.electroFreeEnergyDeltaG} kJ/mol`,
        'Kuosien Q': metrics.reactionQuotientQ,
      };
      numericCoords = {
        x: Math.log10(metrics.reactionQuotientQ || 1),
        y1: metrics.nernstCellPotentialE,
        y2: metrics.electroFreeEnergyDeltaG,
      };
    } else if (params.mode === 'ideal-gas-boyle') {
      title = `Hukum Gas Ideal (V = ${params.gasVolumeL} L, T = ${params.gasTemperatureK} K)`;
      summary = `V=${params.gasVolumeL}L, T=${params.gasTemperatureK}K, n=${params.gasMoles}mol`;
      keyMetrics = {
        'Tekanan Gas (P)': `${metrics.gasPressureAtm} atm`,
        'Volume (V)': `${params.gasVolumeL} L`,
        'Jumlah Mol (n)': `${params.gasMoles} mol`,
        'Konstanta PV': `${metrics.boyleConstantPv} L·atm`,
      };
      numericCoords = {
        x: params.gasVolumeL || 10,
        y1: metrics.gasPressureAtm || 1,
        y2: metrics.boyleConstantPv || 10,
      };
    } else if (params.mode === 'reaction-kinetics-arrhenius') {
      title = `Kinetika Arrhenius Reaksi (T = ${params.kineticsTempC}°C)`;
      summary = `T=${params.kineticsTempC}°C, Ea=${params.kineticsEaKj} kJ/mol, [A]=${params.kineticsConcA} M`;
      keyMetrics = {
        'Konstanta Laju k': `${metrics.arrheniusK} s⁻¹`,
        'Laju Reaksi (r)': `${metrics.reactionRate} M/s`,
        'Energi Aktivasi': `${params.kineticsEaKj} kJ/mol`,
        'Suhu Mutlak (T)': `${metrics.tempKelvin} K`,
      };
      numericCoords = {
        x: metrics.tempKelvin,
        y1: Math.log(metrics.arrheniusK || 0.001),
        y2: metrics.reactionRate,
      };
    } else if (params.mode === 'spectrophotometry-beer') {
      title = `Spektrofotometri UV-Vis (λ = ${params.spectroWavelengthNm} nm)`;
      summary = `c=${params.spectroConcMm} mM, b=${params.spectroPathLengthCm} cm, λ=${params.spectroWavelengthNm} nm`;
      keyMetrics = {
        'Absorbansi (A)': metrics.absorbanceA ?? 0,
        'Transmitansi (%T)': `${metrics.transmittancePct ?? 100}%`,
        'Koefisien Molar (ε)': `${metrics.molarExtinctionEpsilon ?? 9500} M⁻¹cm⁻¹`,
        'Warna Teramati': metrics.absorbedColorName ?? 'Bening',
      };
      numericCoords = {
        x: params.spectroConcMm || 0.5,
        y1: metrics.absorbanceA || 0.5,
        y2: metrics.transmittancePct || 50,
      };
    } else {
      title = `${preset.name} (${preset.equation})`;
      summary = `T₀=${params.initialTempC}°C, [M]=${params.reactantConcentration}M, V=${params.solutionVolumeMl}mL, Katalis=${params.useCatalyst ? 'Ya' : 'Tidak'}`;
      keyMetrics = {
        ΔH: `${metrics.deltaHReaction} kJ/mol`,
        ΔG: `${metrics.deltaG} kJ/mol`,
        'Suhu Akhir': `${metrics.finalTempC} °C`,
        'Laju Reaksi (r)': `${metrics.reactionRate} M/s`,
      };
      numericCoords = {
        x: params.initialTempC,
        y1: metrics.deltaG,
        y2: metrics.finalTempC,
      };
    }

    onRecordExperiment(
      title,
      summary,
      keyMetrics,
      `Data eksperimen kimia (${params.mode}) berhasil direkam.`,
      numericCoords
    );
    onPushNotification(generateAutomaticFeedback('Kimia', undefined, params));
  };

  const chemistryFormulaData: {
    title: string;
    subtitle: string;
    tokens: FormulaToken[];
  } = (() => {
    if (params.mode === 'ideal-gas-boyle') {
      return {
        title: 'Hukum Gas Ideal (Persamaan Keadaan)',
        subtitle: `PV = nRT · R = 0.08206 L·atm/(mol·K)`,
        tokens: [
          { symbol: 'P', value: metrics.gasPressureAtm, unit: 'atm', color: '#38bdf8' },
          { symbol: '=' },
          {
            symbol: 'n',
            paramKey: 'gasMoles',
            value: params.gasMoles ?? 1.0,
            min: 0.1,
            max: 2.5,
            unit: 'mol',
            color: '#f59e0b',
          },
          { symbol: '· R ·' },
          {
            symbol: 'T',
            paramKey: 'gasTemperatureK',
            value: params.gasTemperatureK ?? 300,
            min: 200,
            max: 500,
            unit: 'K',
            color: '#f43f5e',
          },
          { symbol: '/' },
          {
            symbol: 'V',
            paramKey: 'gasVolumeL',
            value: params.gasVolumeL ?? 10,
            min: 2.0,
            max: 25.0,
            unit: 'L',
            color: '#10b981',
          },
        ],
      };
    }
    if (params.mode === 'reaction-kinetics-arrhenius') {
      return {
        title: 'Persamaan Laju Reaksi & Arrhenius',
        subtitle: `k = A · exp(-Ea / RT) · Laju r = k·[A]`,
        tokens: [
          { symbol: 'k', value: metrics.arrheniusK, unit: 's⁻¹', color: '#10b981' },
          { symbol: '= A · e^[-' },
          {
            symbol: 'Ea',
            paramKey: 'kineticsEaKj',
            value: params.kineticsEaKj ?? 50,
            min: 20,
            max: 90,
            unit: 'kJ/mol',
            color: '#f43f5e',
          },
          { symbol: '/ (R·' },
          {
            symbol: 'T',
            paramKey: 'kineticsTempC',
            value: metrics.tempKelvin,
            min: 288,
            max: 368,
            unit: 'K',
            color: '#f59e0b',
          },
          { symbol: ')] · [A]=' },
          {
            symbol: '[A]',
            paramKey: 'kineticsConcA',
            value: params.kineticsConcA ?? 1.0,
            min: 0.1,
            max: 2.5,
            unit: 'M',
            color: '#38bdf8',
          },
        ],
      };
    }
    if (params.mode === 'spectrophotometry-beer') {
      return {
        title: 'Hukum Spektrofotometri Beer-Lambert',
        subtitle: `Absorbansi A = -log(T) = ε · b · c`,
        tokens: [
          { symbol: 'A', value: metrics.absorbanceA, unit: '', color: '#10b981' },
          { symbol: '= ε(' },
          {
            symbol: 'λ',
            paramKey: 'spectroWavelengthNm',
            value: params.spectroWavelengthNm ?? 520,
            min: 380,
            max: 750,
            unit: 'nm',
            color: '#818cf8',
          },
          { symbol: ') · b(' },
          {
            symbol: 'b',
            paramKey: 'spectroPathLengthCm',
            value: params.spectroPathLengthCm ?? 1.0,
            min: 0.5,
            max: 3.0,
            unit: 'cm',
            color: '#f59e0b',
          },
          { symbol: ') ·' },
          {
            symbol: 'c',
            paramKey: 'spectroConcMm',
            value: params.spectroConcMm ?? 0.5,
            min: 0.01,
            max: 1.5,
            unit: 'mM',
            color: '#ec4899',
          },
        ],
      };
    }
    if (params.mode === 'acid-base-titration') {
      return {
        title: 'Stoikiometri Ekuivalensi & pH Titrasi',
        subtitle: `V_eq = ${metrics.equivalenceVolumeMl} mL · ${metrics.indicatorColorName}`,
        tokens: [
          { symbol: 'pH', value: metrics.currentPh, unit: 'pH', color: '#10b981' },
          { symbol: '⇔' },
          {
            symbol: 'M_a',
            paramKey: 'analyteAcidConc',
            value: params.analyteAcidConc,
            min: 0.05,
            max: 0.5,
            unit: 'M',
            color: '#f43f5e',
          },
          { symbol: '·' },
          { symbol: 'V_a', value: params.analyteVolumeMl, unit: 'mL', color: '#94a3b8' },
          { symbol: '−' },
          {
            symbol: 'M_b',
            paramKey: 'titrantBaseConc',
            value: params.titrantBaseConc,
            min: 0.05,
            max: 0.5,
            unit: 'M',
            color: '#38bdf8',
          },
          { symbol: '·' },
          {
            symbol: 'V_b',
            paramKey: 'titrantAddedMl',
            value: params.titrantAddedMl,
            min: 0,
            max: 50,
            unit: 'mL',
            color: '#a855f7',
          },
        ],
      };
    }
    if (params.mode === 'electrochemistry-cell') {
      return {
        title: 'Persamaan Nernst Sel Elektrokimia',
        subtitle: `${redoxPreset.anodeHalf} || ${redoxPreset.cathodeHalf}`,
        tokens: [
          {
            symbol: 'E_sel',
            value: metrics.nernstCellPotentialE,
            unit: 'V',
            color: '#10b981',
          },
          { symbol: '=' },
          {
            symbol: 'E°',
            value: metrics.standardCellPotentialE0,
            unit: 'V',
            color: '#38bdf8',
          },
          { symbol: '− (RT/nF)·ln(' },
          {
            symbol: '[Anoda]',
            paramKey: 'anodeConcM',
            value: params.anodeConcM,
            min: 0.01,
            max: 2.0,
            unit: 'M',
            color: '#f59e0b',
          },
          { symbol: '/' },
          {
            symbol: '[Katoda]',
            paramKey: 'cathodeConcM',
            value: params.cathodeConcM,
            min: 0.01,
            max: 2.0,
            unit: 'M',
            color: '#ec4899',
          },
          { symbol: ')' },
        ],
      };
    }
    return {
      title: 'Energi Bebas Gibbs & Kalorimetri',
      subtitle: `${preset.equation} (${metrics.spontaneityLabel})`,
      tokens: [
        { symbol: 'ΔG', value: metrics.deltaG, unit: 'kJ/mol', color: '#10b981' },
        { symbol: '=' },
        {
          symbol: 'ΔH°',
          value: metrics.deltaHReaction,
          unit: 'kJ/mol',
          color: '#f43f5e',
        },
        { symbol: '−' },
        {
          symbol: 'T',
          paramKey: 'initialTempC',
          value: metrics.tempKelvin,
          min: 278,
          max: 413,
          unit: 'K',
          color: '#f59e0b',
        },
        { symbol: '·' },
        {
          symbol: 'ΔS°',
          paramKey: 'reactantConcentration',
          value: metrics.deltaSReaction,
          min: -200,
          max: 200,
          unit: 'J/mol·K',
          color: '#38bdf8',
        },
      ],
    };
  })();

  const currentLiveTemp = Number(
    (params.initialTempC + metrics.deltaTempC * reactionProgress).toFixed(1)
  );

  return (
    <div className="w-full h-full max-w-[1600px] mx-auto px-4 py-3 overflow-y-auto bg-slate-950 text-slate-100 select-none flex flex-col">
      {/* Safety Hazard Auto-Modal (Fitur 5) */}
      {safetyHazard.isHazardous && !hazardModalDismissed && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border-2 border-rose-500/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-[11px] font-mono font-bold text-rose-300 uppercase">
                  SIMULASI BAHAYA KESELAMATAN K3 — KIMIA
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
                  handleParamChange({
                    initialTempC: 25,
                    kineticsTempC: 25,
                    reactantConcentration: 1.0,
                    useCatalyst: true,
                    gasTemperatureK: 300,
                    gasVolumeL: 10,
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
        {/* LEFT COLUMN: Fixed 3D Scene Canvas & Playback Bar */}
        <div className={`${zenMode ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col h-full min-h-0 gap-3 transition-all`}>
          {/* 3D Canvas Box */}
          <div
            className={`relative w-full flex-1 min-h-[380px] rounded-2xl overflow-hidden border bg-slate-900/60 shadow-2xl transition-all ${
              safetyHazard.isHazardous
                ? 'border-rose-500 ring-2 ring-rose-500/50 animate-pulse'
                : 'border-slate-800'
            }`}
          >
            {safetyHazard.isHazardous && (
              <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-t from-rose-900/40 via-rose-500/15 to-transparent flex items-start justify-center pt-14">
                <div className="px-3.5 py-1.5 rounded-full bg-rose-950/90 border border-rose-500/60 text-[11px] font-mono font-bold text-rose-200 shadow-2xl">
                  ⚠️ PERINGATAN K3: Reaksi Eksotermik di Luar Kendali! (Uap Asam Berbahaya)
                </div>
              </div>
            )}
            <ChemistryScene3D
              params={params}
              metrics={metrics}
              preset={preset}
              redoxPreset={redoxPreset}
              reactionProgress={reactionProgress}
              isReacting={isReacting}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              onUpdateParam={(key, val) => handleParamChange({ [key]: val } as Partial<ChemistryParams>)}
              snapshotCount={snapshotCount}
              onCaptureSnapshot={(dataUrl) => {
                setShutterFlash(true);
                setTimeout(() => setShutterFlash(false), 260);
                if (onCapture3DSnapshot) {
                  const modTitle =
                    params.mode === 'acid-base-titration'
                      ? 'Titrasi Asam-Basa'
                      : params.mode === 'electrochemistry-cell'
                      ? 'Sel Galvani Nernst'
                      : params.mode === 'ideal-gas-boyle'
                      ? 'Hukum Gas Ideal'
                      : params.mode === 'spectrophotometry-beer'
                      ? 'Spektrofotometri UV-Vis'
                      : 'Termokimia & Kalorimetri';
                  const pSum =
                    params.mode === 'acid-base-titration'
                      ? `[Asam]=${params.analyteAcidConc}M, Vb=${params.titrantAddedMl}mL`
                      : `T₀=${params.initialTempC}°C, [M]=${params.reactantConcentration}M`;
                  const pMetric =
                    params.mode === 'acid-base-titration'
                      ? `pH = ${metrics.currentPh.toFixed(2)}`
                      : `ΔG = ${metrics.deltaG} kJ/mol`;
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
                  className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-emerald-300/60 via-white/85 to-sky-300/60"
                />
              )}
            </AnimatePresence>

            {/* Top Overlay Gauges */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                {params.mode === 'acid-base-titration' ? (
                  <>
                    <span className="text-slate-400 font-mono">pH:</span>
                    <span className="font-bold font-mono text-emerald-400 tabular-nums">
                      {metrics.currentPh.toFixed(2)}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 font-mono">V_basa:</span>
                    <span className="font-bold font-mono text-sky-400 tabular-nums">
                      {params.titrantAddedMl} mL
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400 font-mono">T:</span>
                    <span className="font-bold font-mono text-rose-400 tabular-nums">
                      {currentLiveTemp} °C
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 font-mono">Progres:</span>
                    <span className="font-bold font-mono text-emerald-400 tabular-nums">
                      {Math.round(reactionProgress * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom-Left Contextual Micro-Step Guide HUD */}
            <div className="absolute bottom-3 left-3 z-20 pointer-events-none hidden sm:block">
              <ContextualMicroGuideHUD
                moduleTitle={
                  params.mode === 'acid-base-titration'
                    ? 'Titrasi Asam-Basa & Kurva pH'
                    : params.mode === 'electrochemistry-cell'
                    ? 'Sel Elektrokimia Galvani'
                    : params.mode === 'ideal-gas-boyle'
                    ? 'Hukum Gas Ideal (PV = nRT)'
                    : params.mode === 'reaction-kinetics-arrhenius'
                    ? 'Kinetika Reaksi Arrhenius'
                    : params.mode === 'spectrophotometry-beer'
                    ? 'Spektrofotometri Beer-Lambert'
                    : 'Kalorimetri & Termokimia'
                }
                IndependentVarLabel={
                  params.mode === 'acid-base-titration'
                    ? 'Volume Titran NaOH (Vb)'
                    : params.mode === 'ideal-gas-boyle'
                    ? 'Volume Gas (V) / Suhu (T)'
                    : params.mode === 'spectrophotometry-beer'
                    ? 'Konsentrasi Analit (c)'
                    : 'Suhu Awal (T₀) / Konsentrasi [M]'
                }
                DependentVarLabel={
                  params.mode === 'acid-base-titration'
                    ? 'pH Larutan'
                    : params.mode === 'ideal-gas-boyle'
                    ? 'Tekanan Gas (P)'
                    : params.mode === 'spectrophotometry-beer'
                    ? 'Absorbansi (A)'
                    : 'Energi Bebas ΔG & Suhu Akhir'
                }
                recordsCount={records.length}
                targetRecords={3}
                isPlaying={isReacting}
                hasHypothesis={Boolean(effectiveHypothesis.hypothesisText?.trim())}
                onOpenHypothesis={() => setCockpitTab('hypothesis')}
                onOpenCompare={() => setCockpitTab('data-diff')}
                onQuickRecord={handleRecordChemistry}
                onProceedToAnalysis={onProceedToAnalysis}
              />
            </div>
          </div>

          {/* Bottom Playback Bar */}
          <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Play / Reset controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleReaction}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md whitespace-nowrap ${
                    isReacting
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isReacting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isReacting ? 'Jeda Reaksi' : 'Jalankan Reaksi'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetReaction}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Reset Reaksi"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Slider */}
              <div className="flex-1 min-w-[150px] flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 shrink-0">Progres:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={reactionProgress}
                  onChange={(e) => setReactionProgress(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 shrink-0 w-10 tabular-nums">
                  {Math.round(reactionProgress * 100)}%
                </span>
              </div>

              {/* Action Buttons: Catat Data & Analisis Grafik */}
              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleRecordChemistry}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Camera className="w-4 h-4 text-slate-950" />
                  <span>+ Catat Data</span>
                  <span className="bg-slate-950/20 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-950 tabular-nums">
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      records.length >= 3
                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    Grafik & LKS →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Tabbed Control Deck (Hidden in Zen Mode) */}
        {!zenMode && (
          <div className="lg:col-span-4 h-full lg:overflow-y-auto pr-1 space-y-3 pb-4 flex flex-col">
            {/* Sticky Cockpit Tab Switcher */}
            <div
              role="tablist"
              aria-label="Panel Kontrol Praktikum Kimia"
              className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg shrink-0 sticky top-0 z-30"
            >
              <button
                type="button"
                role="tab"
                aria-selected={cockpitTab === 'controls'}
                onClick={() => {
                  labSound.playClick();
                  setCockpitTab('controls');
                }}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  cockpitTab === 'controls'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Kontrol &amp; Rumus</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={cockpitTab === 'data-diff'}
                onClick={() => {
                  labSound.playClick();
                  setCockpitTab('data-diff');
                }}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  cockpitTab === 'data-diff'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <GitCompareArrows className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Data &amp; Diff ({records.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={cockpitTab === 'hypothesis'}
                onClick={() => {
                  labSound.playClick();
                  setCockpitTab('hypothesis');
                }}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  cockpitTab === 'hypothesis'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <NotebookPen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Hipotesis</span>
              </button>
            </div>

            {/* Step-by-Step Guide & Next Step Action Banner */}
            <CockpitStepGuideBanner
              recordsCount={records.length}
              onProceedToAnalysis={onProceedToAnalysis}
              domainLabel="Kimia"
            />

            {cockpitTab === 'controls' && (
              <>
                {/* Automatic Target Challenge Mission Generator */}
                <QuickChallengeMissionBanner
                  domain="Kimia"
                  mode={params.mode}
                  liveMetrics={{
                    currentPh: metrics.currentPh,
                    nernstCellPotentialE: metrics.nernstCellPotentialE,
                    gasPressureAtm: metrics.gasPressureAtm ?? 1,
                    absorbanceA: metrics.absorbanceA ?? 0,
                    finalTempC: metrics.finalTempC,
                    deltaG: metrics.deltaG,
                  }}
                  completedIds={completedChallengeIds}
                  onCompleteChallenge={(ch) => onCompleteChallenge && onCompleteChallenge(ch)}
                />

                {/* Mode Selector */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span>Pilih Sub-Eksperimen Kimia</span>
                  </div>

                  <select
                    value={params.mode}
                    onChange={(e) => {
                      handleParamChange({ mode: e.target.value as ChemistryParams['mode'] });
                      labSound.playClick(680);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="thermo-calorimetry">Termodinamika & Kalorimetri Reaksi</option>
                    <option value="acid-base-titration">Titrasi Asam-Basa & Kurva pH</option>
                    <option value="electrochemistry-cell">Sel Elektrokimia Galvani (Nernst)</option>
                    <option value="ideal-gas-boyle">Hukum Gas Ideal & Boyle (PV = nRT)</option>
                    <option value="reaction-kinetics-arrhenius">Kinetika Reaksi & Persamaan Arrhenius</option>
                    <option value="spectrophotometry-beer">Spektrofotometri UV-Vis & Beer-Lambert</option>
                  </select>
                </div>

          {/* Mystery Challenge Form (ONLY if Active for Kimia) */}
          {activeMysteryChallenge && activeMysteryChallenge.domain === 'Kimia' && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  Ujian Sampel Misterius
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeMysteryChallenge.codename}
                </span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
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
                  className="w-full bg-slate-950 border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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
            <div className="text-xs font-bold text-slate-200">Parameter Reaktan & Larutan</div>

            <div className="space-y-3">
              {params.mode === 'acid-base-titration' && (
                <>
                  <TactileParameterControl
                    label="Konsentrasi Asam (M_a)"
                    symbol="M_a"
                    value={params.analyteAcidConc}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    unit="M"
                    accentColor="#f43f5e"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'analyteAcidConc' : null)}
                    onChange={(v) => handleParamChange({ analyteAcidConc: v })}
                  />
                  <TactileParameterControl
                    label="Volume Analit Asam"
                    symbol="V_a"
                    value={params.analyteVolumeMl}
                    min={10}
                    max={50}
                    step={1}
                    unit="mL"
                    accentColor="#f59e0b"
                    onChange={(v) => handleParamChange({ analyteVolumeMl: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Basa Titran"
                    symbol="M_b"
                    value={params.titrantBaseConc}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    unit="M"
                    accentColor="#38bdf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'titrantBaseConc' : null)}
                    onChange={(v) => handleParamChange({ titrantBaseConc: v })}
                  />
                  <TactileParameterControl
                    label="Volume Titran NaOH Ditambah"
                    symbol="V_b"
                    value={params.titrantAddedMl}
                    min={0}
                    max={50}
                    step={0.5}
                    unit="mL"
                    accentColor="#a855f7"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'titrantAddedMl' : null)}
                    onChange={(v) => handleParamChange({ titrantAddedMl: v })}
                  />
                </>
              )}

              {params.mode === 'electrochemistry-cell' && (
                <>
                  <TactileParameterControl
                    label="Konsentrasi Ion Anoda"
                    symbol="[Anoda]"
                    value={params.anodeConcM}
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    unit="M"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'anodeConcM' : null)}
                    onChange={(v) => handleParamChange({ anodeConcM: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Ion Katoda"
                    symbol="[Katoda]"
                    value={params.cathodeConcM}
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    unit="M"
                    accentColor="#ec4899"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'cathodeConcM' : null)}
                    onChange={(v) => handleParamChange({ cathodeConcM: v })}
                  />
                  <TactileParameterControl
                    label="Suhu Termal Sel"
                    symbol="T"
                    value={params.initialTempC}
                    min={5}
                    max={80}
                    step={1}
                    unit="°C"
                    accentColor="#38bdf8"
                    onChange={(v) => handleParamChange({ initialTempC: v })}
                  />
                </>
              )}

              {params.mode === 'ideal-gas-boyle' && (
                <>
                  <TactileParameterControl
                    label="Volume Silinder Gas (V)"
                    symbol="V"
                    value={params.gasVolumeL ?? 10.0}
                    min={2.0}
                    max={25.0}
                    step={0.5}
                    unit="L"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'gasVolumeL' : null)}
                    onChange={(v) => handleParamChange({ gasVolumeL: v })}
                  />
                  <TactileParameterControl
                    label="Suhu Termal Gas (T)"
                    symbol="T"
                    value={params.gasTemperatureK ?? 300}
                    min={200}
                    max={500}
                    step={5}
                    unit="K"
                    accentColor="#f43f5e"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'gasTemperatureK' : null)}
                    onChange={(v) => handleParamChange({ gasTemperatureK: v })}
                  />
                </>
              )}

              {params.mode === 'reaction-kinetics-arrhenius' && (
                <>
                  <TactileParameterControl
                    label="Suhu Reaksi Termostat"
                    symbol="T"
                    value={params.kineticsTempC ?? 25}
                    min={15}
                    max={95}
                    step={1}
                    unit="°C"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'kineticsTempC' : null)}
                    onChange={(v) => handleParamChange({ kineticsTempC: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Reaktan [A]"
                    symbol="[A]"
                    value={params.kineticsConcA ?? 1.0}
                    min={0.1}
                    max={2.5}
                    step={0.05}
                    unit="M"
                    accentColor="#38bdf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'kineticsConcA' : null)}
                    onChange={(v) => handleParamChange({ kineticsConcA: v })}
                  />
                </>
              )}

              {params.mode === 'spectrophotometry-beer' && (
                <>
                  <TactileParameterControl
                    label="Konsentrasi Analit (c)"
                    symbol="c"
                    value={params.spectroConcMm ?? 0.5}
                    min={0.01}
                    max={1.5}
                    step={0.02}
                    unit="mM"
                    accentColor="#ec4899"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'spectroConcMm' : null)}
                    onChange={(v) => handleParamChange({ spectroConcMm: v })}
                  />
                  <TactileParameterControl
                    label="Panjang Gelombang Eksitasi (λ)"
                    symbol="λ"
                    value={params.spectroWavelengthNm ?? 520}
                    min={380}
                    max={750}
                    step={5}
                    unit="nm"
                    accentColor="#818cf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'spectroWavelengthNm' : null)}
                    onChange={(v) => handleParamChange({ spectroWavelengthNm: v })}
                  />
                </>
              )}

              {params.mode === 'thermo-calorimetry' && (
                <>
                  <TactileParameterControl
                    label="Suhu Awal Reaktan"
                    symbol="T₀"
                    value={params.initialTempC}
                    min={10}
                    max={60}
                    step={1}
                    unit="°C"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'initialTempC' : null)}
                    onChange={(v) => handleParamChange({ initialTempC: v })}
                  />
                  <TactileParameterControl
                    label="Konsentrasi Molar"
                    symbol="M"
                    value={params.reactantConcentration}
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    unit="M"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'reactantConcentration' : null)}
                    onChange={(v) => handleParamChange({ reactantConcentration: v })}
                  />
                </>
              )}
            </div>
          </div>

                {/* Interactive Formula Card */}
                <InteractiveFormulaCard
                  title={chemistryFormulaData.title}
                  subtitle={chemistryFormulaData.subtitle}
                  tokens={chemistryFormulaData.tokens}
                  activeParamKey={hoveredParamKey}
                  onApplyParamValue={(paramKey, value) =>
                    handleParamChange({ [paramKey]: value } as Partial<ChemistryParams>)
                  }
                  accentColor="#10b981"
                />

                {/* Accordion 1: Quick Chemistry Scenario Presets */}
                <CollapsibleLabSection
                  title="Preset Skenario Kimia Cepat"
                  subtitle="Muat cepat larutan standar, titrasi asam-basa, atau sel Galvani"
                  statusText="Skenario Siap"
                  accentColor="#10b981"
                >
                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {GUIDED_LAB_SCENARIOS.filter((s) => s.domain === 'Kimia').map(
                      (sc) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => {
                            labSound.playClick(740);
                            if (sc.chemistryPatch) {
                              handleParamChange(sc.chemistryPatch);
                            }
                          }}
                          title={sc.objective}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 text-left transition-colors cursor-pointer flex items-center justify-between gap-2"
                        >
                          <span className="text-[11px] font-bold text-slate-100 truncate">
                            {sc.title}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                            {sc.badgeText}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </CollapsibleLabSection>

                {/* Accordion 2: Live Telemetry Oscilloscope & Microscopic Indicator */}
                <CollapsibleLabSection
                  title="Osiloskop Telemetri & Indikator Mikroskopis"
                  subtitle="Pantau kurva pH/potensial sel real-time & dinamika tumbukan ion"
                  statusText={
                    params.mode === 'acid-base-titration'
                      ? `pH ${metrics.currentPh.toFixed(2)}`
                      : `${metrics.finalTempC.toFixed(1)} °C`
                  }
                  accentColor="#38bdf8"
                >
                  <LiveTelemetryOscilloscope
                    domain="Kimia"
                    primaryLabel={
                      params.mode === 'acid-base-titration'
                        ? 'pH Larutan'
                        : params.mode === 'electrochemistry-cell'
                        ? 'Potensial E_sel'
                        : 'Suhu T'
                    }
                    primaryValue={
                      params.mode === 'acid-base-titration'
                        ? metrics.currentPh
                        : params.mode === 'electrochemistry-cell'
                        ? metrics.nernstCellPotentialE
                        : metrics.finalTempC
                    }
                    primaryUnit={
                      params.mode === 'acid-base-titration'
                        ? 'pH'
                        : params.mode === 'electrochemistry-cell'
                        ? 'V'
                        : '°C'
                    }
                    secondaryLabel="Laju / ΔG"
                    secondaryValue={
                      params.mode === 'acid-base-titration'
                        ? params.titrantAddedMl
                        : metrics.deltaG
                    }
                    secondaryUnit={
                      params.mode === 'acid-base-titration' ? 'mL' : 'kJ'
                    }
                    microscopicStateLabel={
                      params.mode === 'acid-base-titration'
                        ? `Kesetimbangan Ion H⁺/OH⁻ (${metrics.titrationRegion})`
                        : params.mode === 'electrochemistry-cell'
                        ? `Transfer Elektron Redoks (Q = ${metrics.reactionQuotientQ})`
                        : `Frekuensi Tumbukan Molekul (${metrics.thermalClassification})`
                    }
                    microscopicDetail={
                      params.mode === 'acid-base-titration'
                        ? `Indikator ${metrics.indicatorColorName} · Volume ekuivalen teoretis = ${metrics.equivalenceVolumeMl} mL.`
                        : `Entalpi reaksi ΔH = ${metrics.deltaHReaction} kJ/mol dengan laju r = ${metrics.reactionRate} M/s.`
                    }
                    accentColor="#10b981"
                  />
                </CollapsibleLabSection>

                {/* Accordion 3: Manual Instrument Calibration & Uncertainty Simulation */}
                <CollapsibleLabSection
                  title="Kalibrasi Alat Ukur & Ketidakpastian (NST)"
                  subtitle="Kalibrasi elektroda pH / buret / termometer dan pilih tingkat presisi"
                  statusText={calibrationConfig.isZeroCalibrated ? 'Terkalibrasi' : 'Standar'}
                  accentColor="#f59e0b"
                >
                  <InstrumentCalibrationCard
                    instrumentName={
                      params.mode === 'acid-base-titration'
                        ? DEFAULT_INSTRUMENTS.phMeter.name
                        : params.mode === 'electrochemistry-cell'
                        ? DEFAULT_INSTRUMENTS.voltmeter.name
                        : DEFAULT_INSTRUMENTS.thermometer.name
                    }
                    unit={
                      params.mode === 'acid-base-titration'
                        ? 'pH'
                        : params.mode === 'electrochemistry-cell'
                        ? 'V'
                        : '°C'
                    }
                    rawValue={
                      params.mode === 'acid-base-titration'
                        ? metrics.currentPh
                        : params.mode === 'electrochemistry-cell'
                        ? metrics.nernstCellPotentialE
                        : metrics.finalTempC
                    }
                    baseUncertaintyDelta={
                      params.mode === 'acid-base-titration'
                        ? DEFAULT_INSTRUMENTS.phMeter.uncertaintyDelta
                        : params.mode === 'electrochemistry-cell'
                        ? DEFAULT_INSTRUMENTS.voltmeter.uncertaintyDelta
                        : DEFAULT_INSTRUMENTS.thermometer.uncertaintyDelta
                    }
                    config={calibrationConfig}
                    onChangeConfig={setCalibrationConfig}
                  />
                </CollapsibleLabSection>
              </>
            )}

            {cockpitTab === 'data-diff' && (
              <div className="space-y-3">
                {/* Live Side-by-Side A/B Run Comparison */}
                <ABLiveComparisonWidget
                  domainLabel="Kimia"
                  currentSummary={
                    params.mode === 'acid-base-titration'
                      ? `Ma=${params.analyteAcidConc}M, Mb=${params.titrantBaseConc}M, Vb=${params.titrantAddedMl}mL`
                      : `T₀=${params.initialTempC}°C, [M]=${params.reactantConcentration}M`
                  }
                  currentParams={{
                    initialTempC: params.initialTempC,
                    reactantConcentration: params.reactantConcentration,
                    analyteAcidConc: params.analyteAcidConc,
                    titrantBaseConc: params.titrantBaseConc,
                    titrantAddedMl: params.titrantAddedMl,
                    anodeConcM: params.anodeConcM,
                    cathodeConcM: params.cathodeConcM,
                    gasVolumeL: params.gasVolumeL ?? 10,
                    gasTemperatureK: params.gasTemperatureK ?? 300,
                    spectroConcMm: params.spectroConcMm ?? 0.5,
                  }}
                  liveMetrics={
                    (params.mode === 'acid-base-titration'
                      ? [
                          { key: 'ph', label: 'pH Larutan', value: metrics.currentPh, unit: 'pH' },
                          { key: 'veq', label: 'Vol Ekuivalen', value: metrics.equivalenceVolumeMl, unit: 'mL' },
                          { key: 'vb', label: 'Vol Titran (Vb)', value: params.titrantAddedMl, unit: 'mL' },
                          { key: 'ma', label: 'Molaritas Asam', value: params.analyteAcidConc, unit: 'M' },
                        ]
                      : params.mode === 'electrochemistry-cell'
                      ? [
                          { key: 'esel', label: 'Potensial Nernst', value: metrics.nernstCellPotentialE, unit: 'V' },
                          { key: 'dg', label: 'ΔG Redoks', value: metrics.electroFreeEnergyDeltaG, unit: 'kJ/mol' },
                          { key: 'q', label: 'Kuosien Q', value: metrics.reactionQuotientQ, unit: '' },
                          { key: 'e0', label: 'Potensial E°', value: metrics.standardCellPotentialE0, unit: 'V' },
                        ]
                      : [
                          { key: 'dg', label: 'Energi Bebas (ΔG)', value: metrics.deltaG, unit: 'kJ/mol' },
                          { key: 'tf', label: 'Suhu Akhir', value: metrics.finalTempC, unit: '°C' },
                          { key: 'rate', label: 'Laju Reaksi (r)', value: metrics.reactionRate, unit: 'M/s' },
                          { key: 'dh', label: 'Entalpi (ΔH)', value: metrics.deltaHReaction, unit: 'kJ/mol' },
                        ]) as ABMetricItem[]
                  }
                  onRestoreBaselineParams={(baseParams) =>
                    handleParamChange(baseParams as Partial<ChemistryParams>)
                  }
                />

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">
                      Log Pengamatan Tercatat ({records.length})
                    </span>
                    {onProceedToAnalysis && (
                      <button
                        type="button"
                        onClick={onProceedToAnalysis}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      >
                        Analisis Grafik &amp; LKS →
                      </button>
                    )}
                  </div>
                  {records.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-2">
                      Belum ada data. Klik <strong>+ Catat Data</strong> pada bilah bawah saat menjalankan reaksi.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {records.map((r, idx) => (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-bold text-emerald-400">
                              #{records.length - idx} · {r.domain}
                            </span>
                            <span className="text-slate-500 tabular-nums">{r.timestamp}</span>
                          </div>
                          <div className="text-slate-300 font-mono truncate">{r.parametersSummary}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <ExperimentTrialComparePanel
                  records={records}
                  domainFilter="Kimia"
                />
              </div>
            )}

            {cockpitTab === 'hypothesis' && (
              <HypothesisScratchpadCard
                note={effectiveHypothesis}
                onChange={handleUpdateHypothesis}
                defaultIndependentVar="Volume Titran / Suhu Awal (T₀)"
                defaultDependentVar="pH Larutan / Energi Bebas ΔG"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
