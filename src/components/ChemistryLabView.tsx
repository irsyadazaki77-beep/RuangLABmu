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
  Flame,
  Snowflake,
  FlaskConical,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import {
  ChemistryParams,
  ChemistryMetrics,
  THERMO_PRESETS,
  REDOX_PRESETS,
  AcademicLevel,
  calculateChemistryMetrics,
  generateAutomaticFeedback,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { ChemistryScene3D } from './ChemistryScene3D';
import { labSound } from '../utils/soundEngine';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { PreLabSafetyModal } from './PreLabSafetyModal';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import {
  CircularGaugeMeter,
  LiquidColumnMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import { FloatingLabAnalyticsDrawer } from './FloatingLabAnalyticsDrawer';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  evaluateMysterySubmission,
} from '../utils/mysteryChallengeEngine';

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
  onSubmitMysteryExam?: (studentName: string, result: MysterySubmissionResult, title: string) => void;
}

export const ChemistryLabView: React.FC<ChemistryLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  academicLevel = 'sma',
  remoteCursors,
  onEmitCursor,
  records = [],
  activeStudentName = 'Alya Pratama',
  activeGroupId = 'Kelompok-A1',
  onDeleteRecord,
  onExportCSV,
  onSubmitQuizScore,
  onProceedToAnalysis,
  onBackToCatalog,
  activeMysteryChallenge,
  onSubmitMysteryExam,
}) => {
  const [isReacting, setIsReacting] = useState<boolean>(false);
  const [reactionProgress, setReactionProgress] = useState<number>(0);
  const [leftDockCollapsed, setLeftDockCollapsed] = useState<boolean>(false);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  // Mystery Sample Exam State
  const [mysteryGuessInput, setMysteryGuessInput] = useState<string>('');
  const [mysteryFeedbackResult, setMysteryFeedbackResult] = useState<MysterySubmissionResult | null>(null);

  const chemistryModules = getExperimentsByDomain('kimia');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(
    chemistryModules[0]
  );

  const activeTier: EducationTier =
    academicLevel === 'smp'
      ? 'SMP'
      : academicLevel === 'mahasiswa'
      ? 'Mahasiswa'
      : 'SMA';

  const currentChemistryModuleId =
    params.mode === 'thermo-calorimetry'
      ? 'thermo-calorimetry'
      : params.mode === 'acid-base-titration'
      ? 'acid-base-titration'
      : params.mode === 'electrochemistry-cell'
      ? 'redox-electrochemistry'
      : params.mode === 'ideal-gas-boyle'
      ? 'ideal-gas-boyle'
      : params.mode === 'reaction-kinetics-arrhenius'
      ? 'reaction-kinetics-arrhenius'
      : 'spectrophotometry-beer';

  const currentModule =
    chemistryModules.find((m) => m.id === currentChemistryModuleId) ||
    chemistryModules[0];

  const animRef = useRef<number | null>(null);

  const preset =
    THERMO_PRESETS.find((p) => p.id === params.reactionId) || THERMO_PRESETS[0];
  const redoxPreset =
    REDOX_PRESETS.find((r) => r.id === params.redoxPairId) || REDOX_PRESETS[0];
  const metrics: ChemistryMetrics = calculateChemistryMetrics(params);

  useEffect(() => {
    if (!isReacting) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      if (params.mode === 'acid-base-titration') {
        const nextMl = Math.min(
          50,
          Number((params.titrantAddedMl + dt * 4).toFixed(1))
        );
        labSound.playTitrationDrop(metrics.currentPh);
        onChangeParams({
          ...params,
          titrantAddedMl: nextMl,
        });
        if (nextMl >= 49.5) {
          setIsReacting(false);
        }
      } else {
        setReactionProgress((prev) => {
          const speedFactor = params.useCatalyst ? 0.28 : 0.16;
          const next = prev + dt * speedFactor;
          if (next >= 1) {
            setIsReacting(false);
            return 1;
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

  const handleSelectExperimentById = (expId: string) => {
    labSound.playClick();
    if (expId === 'thermo-calorimetry') {
      handleParamChange({ mode: 'thermo-calorimetry' });
    } else if (expId === 'acid-base-titration') {
      handleParamChange({ mode: 'acid-base-titration' });
    } else if (expId === 'redox-electrochemistry' || expId === 'electrochemistry-cell') {
      handleParamChange({ mode: 'electrochemistry-cell' });
    } else if (expId === 'ideal-gas-boyle') {
      handleParamChange({ mode: 'ideal-gas-boyle' });
    } else if (expId === 'reaction-kinetics-arrhenius') {
      handleParamChange({ mode: 'reaction-kinetics-arrhenius' });
    } else if (expId === 'spectrophotometry-beer') {
      handleParamChange({ mode: 'spectrophotometry-beer' });
    }
    const found = chemistryModules.find((m) => m.id === expId);
    if (found) setModalExperiment(found);
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
      title = `Titrasi Asam-Basa (V_NaOH = ${params.titrantAddedMl} mL)`;
      summary = `[Asam]=${params.analyteAcidConc}M (${params.analyteVolumeMl}mL), [Basa]=${params.titrantBaseConc}M, V_b=${params.titrantAddedMl}mL`;
      keyMetrics = {
        'pH Larutan': metrics.currentPh,
        'Volume Ekuivalen': `${metrics.equivalenceVolumeMl} mL`,
        Zona: metrics.titrationRegion,
        Indikator: metrics.indicatorColorName,
      };
      numericCoords = {
        x: params.titrantAddedMl,
        y1: metrics.currentPh,
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
        x: Math.log10(metrics.reactionQuotientQ),
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
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* FULL-VIEWPORT 3D SCENE CANVAS */}
      <div className="absolute inset-0 w-full h-full z-0">
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
            className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-emerald-300/60 via-white/85 to-sky-300/60"
          />
        )}
      </AnimatePresence>

      {/* 1. TOP-LEFT FLOATING PILL: Experiment Module Picker + Pre-Lab & Rumus Button */}
      <div className="pointer-events-auto absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/15 text-white rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
          <select
            aria-label="Pilih Modul Eksperimen Kimia"
            value={currentChemistryModuleId}
            onChange={(e) => handleSelectExperimentById(e.target.value)}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
          >
            <option value="thermo-calorimetry" className="bg-slate-900 text-white">
              Termodinamika & Kalorimetri Reaksi
            </option>
            <option value="acid-base-titration" className="bg-slate-900 text-white">
              Titrasi Asam-Basa & Kurva pH
            </option>
            <option value="redox-electrochemistry" className="bg-slate-900 text-white">
              Sel Elektrokimia Galvani (Nernst)
            </option>
            <option value="ideal-gas-boyle" className="bg-slate-900 text-white">
              Hukum Gas Ideal & Boyle (PV = nRT)
            </option>
            <option value="reaction-kinetics-arrhenius" className="bg-slate-900 text-white">
              Kinetika Reaksi & Persamaan Arrhenius
            </option>
            <option value="spectrophotometry-beer" className="bg-slate-900 text-white">
              Spektrofotometri UV-Vis & Beer-Lambert
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
          className="backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800/90 border border-white/15 text-emerald-300 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
          title="Buka Panduan Pre-Lab, K3 & Rumus"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Pre-Lab & Rumus</span>
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
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold tracking-wide text-white">
                    Kontrol Reaktan & Instrumen
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

              {/* Mystery Sample Exam Banner / Submission Card */}
              {activeMysteryChallenge && activeMysteryChallenge.domain === 'Kimia' && (
                <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      Ujian Sampel Misterius
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {activeMysteryChallenge.codename}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    {activeMysteryChallenge.storyDescription}
                  </p>
                  <div className="bg-slate-950/80 rounded-lg p-2 border border-amber-500/20 text-[11px] font-mono text-slate-300">
                    <div className="text-amber-400 font-bold">Parameter Tersembunyi:</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span>{activeMysteryChallenge.hiddenParamLabel}:</span>
                      <span className="text-rose-400 font-bold">??? (Sampel Misterius)</span>
                    </div>
                  </div>

                  {/* Submission Form */}
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
                    <div>
                      <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                        Masukkan Hasil Perhitungan / Estimasi ({activeMysteryChallenge.hiddenParamUnit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={mysteryGuessInput}
                        onChange={(e) => setMysteryGuessInput(e.target.value)}
                        placeholder={`Contoh: ${(activeMysteryChallenge.actualHiddenValue * 0.95).toFixed(2)}`}
                        className="w-full bg-slate-950 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Kirim Jawaban Ujian Misterius
                    </button>
                  </form>

                  {/* Immediate Feedback Result */}
                  {mysteryFeedbackResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        mysteryFeedbackResult.passed
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{mysteryFeedbackResult.verdict}</span>
                        <span className="font-mono text-sm">{mysteryFeedbackResult.score}/100</span>
                      </div>
                      <div className="text-[11px] opacity-90">
                        Galat: {mysteryFeedbackResult.errorPercentage}% (Nilai Sebenarnya: {mysteryFeedbackResult.actualValue})
                      </div>
                      <p className="text-[10px] opacity-80 pt-1 leading-snug">
                        {mysteryFeedbackResult.feedbackText}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* SVG Radial Gauge + Visual Color-Changing Readouts */}
              <div className="flex items-center justify-around gap-2 bg-slate-950/60 border border-white/10 rounded-xl p-2.5">
                {params.mode === 'acid-base-titration' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Derajat pH"
                      value={metrics.currentPh}
                      min={0}
                      max={14}
                      unit="pH"
                      color={metrics.indicatorColorHex}
                    />
                    <LiquidColumnMeter
                      label="Tabung pH"
                      value={metrics.currentPh}
                      min={0}
                      max={14}
                      unit="pH"
                      variant="ph"
                    />
                  </>
                ) : params.mode === 'electrochemistry-cell' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Potensial E_sel"
                      value={metrics.nernstCellPotentialE}
                      min={0}
                      max={3.5}
                      unit="V"
                      color="#10b981"
                    />
                    <LiquidColumnMeter
                      label="Suhu Sel"
                      value={params.initialTempC}
                      min={0}
                      max={100}
                      unit="°C"
                      variant="temperature"
                    />
                  </>
                ) : params.mode === 'ideal-gas-boyle' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Tekanan (P)"
                      value={metrics.gasPressureAtm ?? 1}
                      min={0}
                      max={10}
                      unit="atm"
                      color="#38bdf8"
                    />
                    <CircularGaugeMeter
                      size="sm"
                      label="Tetapan PV"
                      value={metrics.boyleConstantPv ?? 10}
                      min={0}
                      max={50}
                      unit="L·atm"
                      color="#10b981"
                    />
                  </>
                ) : params.mode === 'reaction-kinetics-arrhenius' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Konstanta k"
                      value={metrics.arrheniusK ?? 0.05}
                      min={0}
                      max={5}
                      unit="s⁻¹"
                      color="#10b981"
                    />
                    <LiquidColumnMeter
                      label="Suhu Reaksi"
                      value={params.kineticsTempC ?? 25}
                      min={0}
                      max={120}
                      unit="°C"
                      variant="temperature"
                    />
                  </>
                ) : params.mode === 'spectrophotometry-beer' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Absorbansi (A)"
                      value={metrics.absorbanceA ?? 0.5}
                      min={0}
                      max={2.5}
                      unit=""
                      color="#f59e0b"
                    />
                    <CircularGaugeMeter
                      size="sm"
                      label="Transmitansi"
                      value={metrics.transmittancePct ?? 50}
                      min={0}
                      max={100}
                      unit="%"
                      color="#38bdf8"
                    />
                  </>
                ) : (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Laju Reaksi (r)"
                      value={metrics.reactionRate}
                      min={0}
                      max={50}
                      unit="M/s"
                      color="#10b981"
                    />
                    <LiquidColumnMeter
                      label="Termometer"
                      value={currentLiveTemp}
                      min={-10}
                      max={120}
                      unit="°C"
                      variant="temperature"
                    />
                  </>
                )}
              </div>

              {/* Quick Digital Readout Row */}
              <div className="grid grid-cols-2 gap-2">
                {params.mode === 'acid-base-titration' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Titik Ekuivalen"
                      value={metrics.equivalenceVolumeMl}
                      unit="mL"
                      precision={1}
                      accentColor="#38bdf8"
                    />
                    <AnimatedNumberReadout
                      label="V_NaOH Tetes"
                      value={params.titrantAddedMl}
                      unit="mL"
                      precision={1}
                      accentColor="#10b981"
                    />
                  </>
                ) : params.mode === 'electrochemistry-cell' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Energi ΔG Redoks"
                      value={metrics.electroFreeEnergyDeltaG}
                      unit="kJ"
                      precision={1}
                      accentColor="#10b981"
                    />
                    <AnimatedNumberReadout
                      label="Kuosien (Q)"
                      value={metrics.reactionQuotientQ}
                      unit=""
                      precision={2}
                      accentColor="#38bdf8"
                    />
                  </>
                ) : params.mode === 'ideal-gas-boyle' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Tekanan (P)"
                      value={metrics.gasPressureAtm ?? 1}
                      unit="atm"
                      precision={2}
                      accentColor="#38bdf8"
                    />
                    <AnimatedNumberReadout
                      label="Volume Tabung"
                      value={params.gasVolumeL ?? 10}
                      unit="L"
                      precision={1}
                      accentColor="#10b981"
                    />
                  </>
                ) : params.mode === 'reaction-kinetics-arrhenius' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Laju Reaksi (r)"
                      value={metrics.reactionRate ?? 0.1}
                      unit="M/s"
                      precision={3}
                      accentColor="#10b981"
                    />
                    <AnimatedNumberReadout
                      label="Suhu Mutlak (T)"
                      value={metrics.tempKelvin ?? 298}
                      unit="K"
                      precision={1}
                      accentColor="#f59e0b"
                    />
                  </>
                ) : params.mode === 'spectrophotometry-beer' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Absorbansi (A)"
                      value={metrics.absorbanceA ?? 0.5}
                      unit=""
                      precision={3}
                      accentColor="#f59e0b"
                    />
                    <AnimatedNumberReadout
                      label="Transmitansi %T"
                      value={metrics.transmittancePct ?? 50}
                      unit="%"
                      precision={1}
                      accentColor="#38bdf8"
                    />
                  </>
                ) : (
                  <>
                    <AnimatedNumberReadout
                      label="Energi Gibbs (ΔG)"
                      value={metrics.deltaG}
                      unit="kJ/mol"
                      precision={1}
                      accentColor="#10b981"
                    />
                    <AnimatedNumberReadout
                      label="Suhu Akhir (T)"
                      value={metrics.finalTempC}
                      unit="°C"
                      precision={1}
                      accentColor="#f43f5e"
                    />
                  </>
                )}
              </div>

              {/* Interactive Formula Card */}
              <InteractiveFormulaCard
                title={chemistryFormulaData.title}
                subtitle={chemistryFormulaData.subtitle}
                tokens={chemistryFormulaData.tokens}
                activeParamKey={hoveredParamKey}
                accentColor="#10b981"
              />

              {/* Mode-Specific Presets & Tactile Parameter Sliders */}
              {params.mode === 'ideal-gas-boyle' && (
                <div className="space-y-2.5">
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

                  <TactileParameterControl
                    label="Jumlah Partikel Gas (n)"
                    symbol="n"
                    value={params.gasMoles ?? 1.0}
                    min={0.1}
                    max={2.5}
                    step={0.05}
                    unit="mol"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'gasMoles' : null)}
                    onChange={(v) => handleParamChange({ gasMoles: v })}
                  />
                </div>
              )}

              {params.mode === 'reaction-kinetics-arrhenius' && (
                <div className="space-y-2.5">
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

                  <TactileParameterControl
                    label="Energi Aktivasi (Ea)"
                    symbol="Ea"
                    value={params.kineticsEaKj ?? 50}
                    min={20}
                    max={90}
                    step={2}
                    unit="kJ/mol"
                    accentColor="#f43f5e"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'kineticsEaKj' : null)}
                    onChange={(v) => handleParamChange({ kineticsEaKj: v })}
                  />
                </div>
              )}

              {params.mode === 'spectrophotometry-beer' && (
                <div className="space-y-2.5">
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
                    label="Tebal Kuvet Optik (b)"
                    symbol="b"
                    value={params.spectroPathLengthCm ?? 1.0}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    unit="cm"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'spectroPathLengthCm' : null)}
                    onChange={(v) => handleParamChange({ spectroPathLengthCm: v })}
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
                </div>
              )}

              {params.mode === 'thermo-calorimetry' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Sistem Reaksi Kalorimetri
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {THERMO_PRESETS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            labSound.playClick();
                            setIsReacting(false);
                            setReactionProgress(0);
                            handleParamChange({ reactionId: item.id });
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                            params.reactionId === item.id
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                              : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {item.deltaHStandard < 0 ? (
                              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            ) : (
                              <Snowflake className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="font-mono text-[10px] opacity-80">
                            {item.deltaHStandard} kJ
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <TactileParameterControl
                    label="Suhu Awal Larutan"
                    symbol="T₀"
                    value={params.initialTempC}
                    min={5}
                    max={120}
                    step={1}
                    unit="°C"
                    accentColor="#f59e0b"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'initialTempC' : null)
                    }
                    onChange={(v) => handleParamChange({ initialTempC: v })}
                  />

                  <TactileParameterControl
                    label="Molaritas Reaktan"
                    symbol="[M]"
                    value={params.reactantConcentration}
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    unit="M"
                    accentColor="#38bdf8"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'reactantConcentration' : null)
                    }
                    onChange={(v) =>
                      handleParamChange({ reactantConcentration: v })
                    }
                  />

                  <TactileParameterControl
                    label="Volume Kalorimeter"
                    symbol="V"
                    value={params.solutionVolumeMl}
                    min={50}
                    max={500}
                    step={25}
                    unit="mL"
                    accentColor="#10b981"
                    onChange={(v) => handleParamChange({ solutionVolumeMl: v })}
                  />

                  <div className="pt-1 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      Katalis Penurun Energi Aktivasi (Ea)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleParamChange({ useCatalyst: !params.useCatalyst })
                      }
                      className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-colors cursor-pointer ${
                        params.useCatalyst
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {params.useCatalyst ? 'KATALIS AKTIF' : 'TANPA KATALIS'}
                    </button>
                  </div>
                </div>
              )}

              {params.mode === 'acid-base-titration' && (
                <div className="space-y-2.5">
                  <TactileParameterControl
                    label="Volume Titrant NaOH"
                    symbol="V_b"
                    value={params.titrantAddedMl}
                    min={0}
                    max={50}
                    step={0.5}
                    unit="mL"
                    accentColor="#a855f7"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'titrantAddedMl' : null)
                    }
                    onChange={(v) => {
                      labSound.playTitrationDrop(metrics.currentPh);
                      handleParamChange({ titrantAddedMl: v });
                    }}
                  />

                  <TactileParameterControl
                    label="Konsentrasi Asam Analit"
                    symbol="M_a"
                    value={params.analyteAcidConc}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    unit="M"
                    accentColor="#f43f5e"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'analyteAcidConc' : null)
                    }
                    onChange={(v) => handleParamChange({ analyteAcidConc: v })}
                  />

                  <TactileParameterControl
                    label="Konsentrasi Basa Titrant"
                    symbol="M_b"
                    value={params.titrantBaseConc}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    unit="M"
                    accentColor="#38bdf8"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'titrantBaseConc' : null)
                    }
                    onChange={(v) => handleParamChange({ titrantBaseConc: v })}
                  />

                  <TactileParameterControl
                    label="Tetapan Disosiasi Asam"
                    symbol="pKa"
                    value={params.acidPka}
                    min={1.0}
                    max={9.5}
                    step={0.1}
                    unit=""
                    accentColor="#10b981"
                    onChange={(v) => handleParamChange({ acidPka: v })}
                  />
                </div>
              )}

              {params.mode === 'electrochemistry-cell' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Pasangan Elektrode Sel Galvani
                    </span>
                    <select
                      aria-label="Pasangan Elektrode"
                      value={params.redoxPairId}
                      onChange={(e) =>
                        handleParamChange({ redoxPairId: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-slate-950/80 border border-white/15 rounded-xl px-2.5 py-2 text-white"
                    >
                      {REDOX_PRESETS.map((rp) => (
                        <option key={rp.id} value={rp.id} className="bg-slate-900">
                          {rp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <TactileParameterControl
                    label="Konsentrasi Ion Anoda"
                    symbol="[A]"
                    value={params.anodeConcM}
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    unit="M"
                    accentColor="#f59e0b"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'anodeConcM' : null)
                    }
                    onChange={(v) => handleParamChange({ anodeConcM: v })}
                  />

                  <TactileParameterControl
                    label="Konsentrasi Ion Katoda"
                    symbol="[K]"
                    value={params.cathodeConcM}
                    min={0.01}
                    max={2.0}
                    step={0.05}
                    unit="M"
                    accentColor="#ec4899"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'cathodeConcM' : null)
                    }
                    onChange={(v) => handleParamChange({ cathodeConcM: v })}
                  />

                  <TactileParameterControl
                    label="Suhu Elektrolit"
                    symbol="T"
                    value={params.initialTempC}
                    min={5}
                    max={95}
                    step={1}
                    unit="°C"
                    accentColor="#38bdf8"
                    onChange={(v) => handleParamChange({ initialTempC: v })}
                  />
                </div>
              )}
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
        >
          {leftDockCollapsed ? (
            <>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
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
            onClick={handleToggleReaction}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_18px_rgba(16,185,129,0.45)] transition-colors cursor-pointer shrink-0"
          >
            {isReacting ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isReacting ? 'Jeda' : 'Reaksikan'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetReaction}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
            title="Reset Progres Reaksi"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Scrubber for Reaction Progress or Titration Volume */}
          <div className="hidden sm:flex items-center gap-2 px-1">
            {params.mode === 'acid-base-titration' ? (
              <>
                <span className="font-mono text-[11px] text-emerald-300 tabular-nums w-14">
                  {params.titrantAddedMl} mL
                </span>
                <input
                  type="range"
                  aria-label="Volume NaOH Ditambahkan"
                  min={0}
                  max={50}
                  step={0.5}
                  value={params.titrantAddedMl}
                  onChange={(e) => {
                    setIsReacting(false);
                    handleParamChange({
                      titrantAddedMl: Number(e.target.value),
                    });
                  }}
                  className="w-28 md:w-36 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </>
            ) : (
              <>
                <span className="font-mono text-[11px] text-emerald-300 tabular-nums w-12">
                  {Math.round(reactionProgress * 100)}%
                </span>
                <input
                  type="range"
                  aria-label="Koordinat Progres Reaksi"
                  min={0}
                  max={1}
                  step={0.02}
                  value={reactionProgress}
                  onChange={(e) => {
                    setIsReacting(false);
                    setReactionProgress(Number(e.target.value));
                  }}
                  className="w-28 md:w-36 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </>
            )}
          </div>

          {/* Glowing Primary Button: + Catat Data Percobaan */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRecordChemistry}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs shadow-[0_0_22px_rgba(56,189,248,0.55)] transition-colors cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>+ Catat Data Percobaan</span>
          </motion.button>
        </div>
      </div>

      {/* 4. RIGHT FLOATING ANALYTICS SUMMARY & STEP TRANSITION */}
      <FloatingLabAnalyticsDrawer
        domain="Kimia"
        experimentTitle={currentModule.title}
        records={records}
        activeStudentName={activeStudentName}
        activeGroupId={activeGroupId}
        accentColor="#10b981"
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
