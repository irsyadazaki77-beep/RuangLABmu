import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Leaf,
  Sliders,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Camera,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import { ExperimentCatalogPicker } from './ExperimentCatalogPicker';
import { PreLabSafetyModal } from './PreLabSafetyModal';
import { BiologyScene3D } from './BiologyScene3D';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import { labSound } from '../utils/soundEngine';
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

interface BiologyLabViewProps {
  activeStudentName: string;
  activeGroupId: string;
  activeTier: EducationTier;
  onRecordExperiment: (
    domain: 'Biologi',
    title: string,
    paramsSummary: string,
    keyMetrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  paramLocks?: Record<string, ParameterLockPayload>;
  onAcquireLock?: (paramKey: string) => void;
  onReleaseLock?: (paramKey: string) => void;
  onTierChange?: (tier: EducationTier) => void;
}

export const BiologyLabView: React.FC<BiologyLabViewProps> = ({
  activeStudentName,
  activeTier,
  onRecordExperiment,
  remoteCursors = {},
  onEmitCursor,
  paramLocks = {},
  onAcquireLock,
  onReleaseLock,
  onTierChange,
}) => {
  const biologyModules = useMemo(() => getExperimentsByDomain('biologi'), []);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('photosynthesis-ingenhousz');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(biologyModules[0]);
  const [activeHudSection, setActiveHudSection] = useState<'kontrol' | 'grafik' | 'panduan'>('kontrol');
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [recordToastCount, setRecordToastCount] = useState<number>(0);

  // Current Experiment Module
  const currentModule = useMemo(() => {
    return biologyModules.find((m) => m.id === selectedModuleId) || biologyModules[0];
  }, [biologyModules, selectedModuleId]);

  // Dynamic Parameters State initialized from module definition
  const [paramsState, setParamsState] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    biologyModules.forEach((mod) => {
      mod.parameters.forEach((p) => {
        init[p.key] = p.defaultValue;
      });
    });
    return init;
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [customNote, setCustomNote] = useState<string>('');

  // Compute Current Step Outputs
  const currentOutputs = useMemo(() => {
    return currentModule.computeStep(paramsState, 0);
  }, [currentModule, paramsState]);

  const handleParamChange = (key: string, val: number) => {
    setParamsState((prev) => ({ ...prev, [key]: val }));
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    setShutterFlash(true);
    setRecordToastCount((c) => c + 1);
    setTimeout(() => setShutterFlash(false), 220);

    const summaryParts = currentModule.parameters.map((p) => `${p.label}=${paramsState[p.key]} ${p.unit}`);
    const paramsSummary = summaryParts.join(', ');

    const metricsDict: Record<string, number | string> = {};
    currentModule.outputs.forEach((out) => {
      const val = currentOutputs[out.key];
      metricsDict[out.label] = `${val?.toFixed(out.precision) ?? 0} ${out.unit}`;
    });

    const xKey = currentModule.defaultRegressionAxes.xKey;
    const yKey = currentModule.defaultRegressionAxes.yKey;
    const numX = paramsState[xKey] ?? 0;
    const numY1 = currentOutputs[yKey] ?? 0;

    const defaultNotes =
      customNote.trim() ||
      `Pengujian ${currentModule.title} jenjang ${activeTier} pada ${paramsSummary}.`;

    onRecordExperiment(
      'Biologi',
      currentModule.title,
      paramsSummary,
      metricsDict,
      defaultNotes,
      { x: numX, y1: numY1, y2: 0 }
    );
    setCustomNote('');
  };

  const currentMode =
    currentModule.id === 'photosynthesis-ingenhousz'
      ? 'photosynthesis-ingenhousz'
      : currentModule.id === 'enzyme-catalase'
      ? 'enzyme-catalase'
      : 'osmosis-plasmolysis';

  // Interactive Formula Tokens for Biology
  const biologyFormulaData: {
    title: string;
    subtitle: string;
    tokens: FormulaToken[];
  } = useMemo(() => {
    if (currentMode === 'photosynthesis-ingenhousz') {
      const rate = currentOutputs['o2BubbleRate'] ?? 24;
      const lux = paramsState['lightIntensityLux'] ?? 5000;
      const nahco3 = paramsState['nahco3ConcPct'] ?? 0.5;
      const temp = paramsState['waterTempC'] ?? 28;
      return {
        title: 'Laju Fotosintesis Ingenhousz (Faktor Pembatas Blackman)',
        subtitle: '6CO₂ + 6H₂O + Cahaya → C₆H₁₂O₆ + 6O₂↑',
        tokens: [
          { symbol: 'r(O₂)', value: Number(rate.toFixed(1)), unit: 'gelembung/mnt', color: '#10b981' },
          { symbol: '∝' },
          {
            symbol: 'I_lux',
            paramKey: 'lightIntensityLux',
            value: lux,
            min: 500,
            max: 15000,
            unit: 'lux',
            color: '#f59e0b',
          },
          { symbol: '·' },
          {
            symbol: '[NaHCO₃]',
            paramKey: 'nahco3ConcPct',
            value: nahco3,
            min: 0,
            max: 2.0,
            unit: '%',
            color: '#38bdf8',
          },
          { symbol: '·' },
          {
            symbol: 'f(T)',
            paramKey: 'waterTempC',
            value: temp,
            min: 10,
            max: 45,
            unit: '°C',
            color: '#ec4899',
          },
        ],
      };
    }
    if (currentMode === 'enzyme-catalase') {
      const v0 = currentOutputs['reactionVelocity'] ?? 15;
      const s = paramsState['substrateH2O2ConcM'] ?? 0.5;
      const ph = paramsState['solutionPh'] ?? 7.0;
      const temp = paramsState['incubationTempC'] ?? 37;
      return {
        title: 'Kinetika Enzim Katalase Michaelis-Menten',
        subtitle: '2H₂O₂ → 2H₂O + O₂↑ (Dikatalisis Enzim Katalase)',
        tokens: [
          { symbol: 'v₀', value: Number(v0.toFixed(2)), unit: 'mM/s', color: '#10b981' },
          { symbol: '=' },
          {
            symbol: 'V_max·[S]',
            paramKey: 'substrateH2O2ConcM',
            value: s,
            min: 0.1,
            max: 2.0,
            unit: 'M',
            color: '#38bdf8',
          },
          { symbol: '/' },
          { symbol: '(K_m + [S])' },
          { symbol: '·' },
          {
            symbol: 'α(pH,T)',
            paramKey: 'solutionPh',
            value: ph,
            min: 3.0,
            max: 11.0,
            unit: `pH (${temp}°C)`,
            color: '#a855f7',
          },
        ],
      };
    }
    const pi = currentOutputs['osmoticPressureAtm'] ?? 4.5;
    const m = paramsState['sucroseMolarityM'] ?? 0.3;
    const t = paramsState['temperatureC'] ?? 25;
    return {
      title: 'Tekanan Osmotik van ’t Hoff & Potensial Air Sel',
      subtitle: 'Plasmolisis terjadi ketika konsentrasi sukrosa eksternal hipertonik',
      tokens: [
        { symbol: 'Π', value: Number(pi.toFixed(2)), unit: 'atm', color: '#10b981' },
        { symbol: '=' },
        {
          symbol: 'M',
          paramKey: 'sucroseMolarityM',
          value: m,
          min: 0.0,
          max: 1.0,
          unit: 'mol/L',
          color: '#38bdf8',
        },
        { symbol: '·' },
        { symbol: 'R', value: 0.0821, unit: 'L·atm/mol·K', color: '#94a3b8' },
        { symbol: '·' },
        {
          symbol: 'T',
          paramKey: 'temperatureC',
          value: t + 273.15,
          min: 283,
          max: 318,
          unit: 'K',
          color: '#f59e0b',
        },
      ],
    };
  }, [currentMode, currentOutputs, paramsState]);

  const primaryOutput = currentModule.outputs[0];
  const secondaryOutput = currentModule.outputs[1] || currentModule.outputs[0];

  return (
    <div className="space-y-5">
      {/* Universal Experiment Catalog Drawer / Selector */}
      <ExperimentCatalogPicker
        domain="biologi"
        currentExperimentId={selectedModuleId}
        activeTier={activeTier}
        onSelectExperiment={(exp) => {
          setSelectedModuleId(exp.id);
        }}
        onOpenPreLabModal={(exp) => {
          setModalExperiment(exp);
          setPreLabModalOpen(true);
        }}
        onTierChange={onTierChange}
      />

      {/* SPATIAL HUD COCKPIT WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* HERO 3D STAGE (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative min-h-[560px] rounded-2xl overflow-hidden border border-emerald-500/40 bg-[#041410] shadow-[0_0_50px_-12px_rgba(16,185,129,0.35)] flex flex-col justify-between">
            {/* Camera Shutter Flash on Record */}
            <AnimatePresence>
              {shutterFlash && (
                <motion.div
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-emerald-300/60 via-white/80 to-lime-300/60"
                />
              )}
            </AnimatePresence>

            {/* Flying "+1 Data Tercatat!" Toast Badge */}
            <AnimatePresence>
              {recordToastCount > 0 && (
                <motion.div
                  key={recordToastCount}
                  initial={{ opacity: 0, y: 24, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="pointer-events-none absolute bottom-20 right-5 z-30 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/95 text-slate-950 font-mono text-xs font-bold shadow-[0_0_25px_rgba(16,185,129,0.75)] border border-emerald-300"
                >
                  <Camera className="w-4 h-4" />
                  <span>+1 Data Biologi Tercatat!</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TOP-LEFT FLOATING HUD: Experiment Selector Pill + Tier Badge + Live Status */}
            <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 max-w-[62%]">
              <div className="lab-glass-panel bg-slate-950/85 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-slate-100 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isPlaying ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isPlaying ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    {isPlaying ? 'BIO-SIM AKTIF · 60 FPS' : 'SIAGA BIOLOGI'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold">
                    {activeTier}
                  </span>
                </div>
                <div className="font-mono font-bold text-white text-xs mt-1 truncate">
                  {currentModule.title}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setModalExperiment(currentModule);
                  setPreLabModalOpen(true);
                }}
                className="lab-glass-panel bg-slate-900/85 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-md"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                K3 & Panduan
              </button>
            </div>

            {/* TOP-RIGHT FLOATING HUD: Tactile Instrument Gauges */}
            <div className="pointer-events-none absolute top-3.5 right-3.5 z-20 hidden sm:flex items-start gap-2">
              {primaryOutput && (
                <CircularGaugeMeter
                  size="sm"
                  label={primaryOutput.label.slice(0, 16)}
                  value={currentOutputs[primaryOutput.key] ?? 0}
                  min={0}
                  max={currentMode === 'photosynthesis-ingenhousz' ? 80 : currentMode === 'enzyme-catalase' ? 40 : 25}
                  unit={primaryOutput.unit}
                  color="#10b981"
                />
              )}
              {currentMode === 'enzyme-catalase' ? (
                <LiquidColumnMeter
                  label="pH Enzim"
                  value={paramsState['solutionPh'] ?? 7.0}
                  min={0}
                  max={14}
                  unit="pH"
                  variant="ph"
                />
              ) : (
                secondaryOutput && (
                  <CircularGaugeMeter
                    size="sm"
                    label={secondaryOutput.label.slice(0, 16)}
                    value={currentOutputs[secondaryOutput.key] ?? 0}
                    min={0}
                    max={100}
                    unit={secondaryOutput.unit}
                    color="#84cc16"
                  />
                )
              )}
            </div>

            {/* MAIN 3D VIEWPORT */}
            <div className="flex-1 flex flex-col justify-center">
              <BiologyScene3D
                mode={currentMode}
                params={paramsState}
                remoteCursors={remoteCursors}
                onEmitCursor={onEmitCursor}
                isPlaying={isPlaying}
              />
            </div>

            {/* BOTTOM FLOATING HUD DECK */}
            <div className="relative z-20 bg-slate-950/95 backdrop-blur-md border-t border-emerald-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    labSound.playClick();
                    setIsPlaying(!isPlaying);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.45)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? 'Jeda Simulasi' : 'Jalankan Simulasi'}
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    labSound.playClick();
                    const resets: Record<string, number> = {};
                    currentModule.parameters.forEach((p) => {
                      resets[p.key] = p.defaultValue;
                    });
                    setParamsState((prev) => ({ ...prev, ...resets }));
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </motion.button>
              </div>

              <div className="text-[11px] font-mono text-emerald-300 hidden md:block">
                Sensor Bioreaktor: <span className="font-bold text-white">Aktif (25 Hz)</span>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRecordTrial}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-lime-400 hover:bg-lime-300 rounded-xl shadow-[0_0_20px_rgba(132,204,22,0.5)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Catat Data Percobaan
              </motion.button>
            </div>
          </div>
        </div>

        {/* RIGHT COCKPIT DOCK: Collapsible Segmented Drawer Tabs (4 Cols) */}
        <div className="lg:col-span-4 bg-white/95 dark:bg-slate-900/90 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          {/* Segmented Drawer Navigation */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-950/90 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {[
              { id: 'kontrol', label: 'Kontrol & Rumus', icon: Sliders },
              { id: 'grafik', label: 'Grafik & Data', icon: BarChart3 },
              { id: 'panduan', label: 'Panduan & K3', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeHudSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick(680);
                    setActiveHudSection(tab.id as 'kontrol' | 'grafik' | 'panduan');
                  }}
                  className={`relative flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="hud-section-pill-bio"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-emerald-600 shadow-xs"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                  <span className="relative z-10 truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {activeHudSection === 'kontrol' && (
              <motion.div
                key="kontrol"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Interactive Live Formula Visualizer */}
                <InteractiveFormulaCard
                  title={biologyFormulaData.title}
                  subtitle={biologyFormulaData.subtitle}
                  tokens={biologyFormulaData.tokens}
                  activeParamKey={hoveredParamKey}
                  accentColor="#10b981"
                />

                {/* Tactile Parameter Controls */}
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {currentModule.parameters.map((param) => {
                    const val = paramsState[param.key] ?? param.defaultValue;
                    const lock = paramLocks[param.key];
                    const isLocked = !!lock && lock.lockedByName !== activeStudentName;

                    return (
                      <div
                        key={param.key}
                        onPointerDown={() => onAcquireLock && onAcquireLock(param.key)}
                        onPointerUp={() => onReleaseLock && onReleaseLock(param.key)}
                      >
                        <TactileParameterControl
                          label={param.label}
                          symbol={param.key.slice(0, 3)}
                          value={val}
                          min={param.min}
                          max={param.max}
                          step={param.step}
                          unit={param.unit}
                          accentColor="#10b981"
                          lockedBy={isLocked ? lock.lockedByName : undefined}
                          onHoverChange={(h) => setHoveredParamKey(h ? param.key : null)}
                          onChange={(v) => handleParamChange(param.key, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeHudSection === 'grafik' && (
              <motion.div
                key="grafik"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Telemetri Biologi Real-Time
                  </span>
                  <span className="text-[11px] font-mono text-emerald-500">
                    ● {currentModule.subCategory}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {currentModule.outputs.map((out) => {
                    const val = currentOutputs[out.key] ?? 0;
                    return (
                      <AnimatedNumberReadout
                        key={out.key}
                        label={out.label}
                        value={val}
                        precision={out.precision}
                        unit={out.unit}
                        accentColor="#10b981"
                      />
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <input
                    type="text"
                    placeholder="Catatan observasi percobaan biologi..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleRecordTrial}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Rekam Data Pengamatan ke LKS
                  </motion.button>
                </div>
              </motion.div>
            )}

            {activeHudSection === 'panduan' && (
              <motion.div
                key="panduan"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                <details
                  open
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-3 text-xs"
                >
                  <summary className="font-bold text-slate-900 dark:text-white cursor-pointer flex items-center justify-between">
                    <span>Ringkasan Konsep: {currentModule.title}</span>
                    <span className="font-mono text-[10px] text-emerald-500">{activeTier}</span>
                  </summary>
                  <div className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{currentModule.theorySummary}</p>
                    <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
                      Rumus: {currentModule.keyEquations[0]}
                    </p>
                  </div>
                </details>

                <details className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-3 text-xs">
                  <summary className="font-bold text-slate-900 dark:text-white cursor-pointer flex items-center justify-between">
                    <span>Prosedur Kerja & Keselamatan K3</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </summary>
                  <div className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                    <ol className="list-decimal list-inside space-y-1">
                      {(currentModule.objectives[activeTier] || currentModule.safetyNotes).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                </details>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* PreLab Safety Modal */}
      <PreLabSafetyModal
        experiment={modalExperiment}
        activeTier={activeTier}
        isOpen={preLabModalOpen}
        onClose={() => setPreLabModalOpen(false)}
        onProceedToLab={() => {
          setSelectedModuleId(modalExperiment.id);
        }}
      />
    </div>
  );
};
