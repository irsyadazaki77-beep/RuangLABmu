import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
} from 'lucide-react';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
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
import {
  BiologyTelemetryContext,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { FloatingLabAnalyticsDrawer } from './FloatingLabAnalyticsDrawer';

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
  onBiologyContextChange?: (ctx: BiologyTelemetryContext) => void;
  records?: ExperimentRecord[];
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  selectedModuleId?: string;
  onSelectModuleId?: (id: string) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
}

export const BiologyLabView: React.FC<BiologyLabViewProps> = ({
  activeStudentName,
  activeGroupId,
  activeTier,
  onRecordExperiment,
  remoteCursors = {},
  onEmitCursor,
  paramLocks = {},
  onAcquireLock,
  onReleaseLock,
  onBiologyContextChange,
  records = [],
  onDeleteRecord,
  onExportCSV,
  onSubmitQuizScore,
  selectedModuleId: externalModuleId,
  onSelectModuleId,
  onProceedToAnalysis,
  onBackToCatalog,
}) => {
  const biologyModules = useMemo(() => getExperimentsByDomain('biologi'), []);
  const [internalModuleId, setInternalModuleId] = useState<string>(
    externalModuleId || 'photosynthesis-ingenhousz'
  );
  const selectedModuleId = externalModuleId ?? internalModuleId;
  const setSelectedModuleId = (id: string) => {
    setInternalModuleId(id);
    if (onSelectModuleId) onSelectModuleId(id);
  };
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(
    biologyModules[0]
  );
  const [leftDockCollapsed, setLeftDockCollapsed] = useState<boolean>(false);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0.45);

  const currentModule = useMemo(() => {
    return (
      biologyModules.find((m) => m.id === selectedModuleId) || biologyModules[0]
    );
  }, [biologyModules, selectedModuleId]);

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

  // Sync active Biology module & parameters up to App.tsx for Dr. LabMu
  useEffect(() => {
    if (onBiologyContextChange) {
      const activeParams: Record<string, number> = {};
      currentModule.parameters.forEach((p) => {
        activeParams[p.key] = paramsState[p.key] ?? p.defaultValue;
      });
      onBiologyContextChange({
        moduleId: selectedModuleId,
        params: activeParams,
      });
    }
  }, [selectedModuleId, paramsState, currentModule, onBiologyContextChange]);

  const currentOutputs = useMemo(() => {
    return currentModule.computeStep(paramsState, 0);
  }, [currentModule, paramsState]);

  const handleParamChange = (key: string, val: number) => {
    setParamsState((prev) => ({ ...prev, [key]: val }));
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 260);

    const summaryParts = currentModule.parameters.map(
      (p) => `${p.label}=${paramsState[p.key]} ${p.unit}`
    );
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

    onRecordExperiment(
      'Biologi',
      currentModule.title,
      paramsSummary,
      metricsDict,
      `Pengujian ${currentModule.title} jenjang ${activeTier} pada ${paramsSummary}.`,
      { x: numX, y1: numY1, y2: 0 }
    );
  };

  const currentMode =
    currentModule.id === 'photosynthesis-ingenhousz'
      ? 'photosynthesis-ingenhousz'
      : currentModule.id === 'enzyme-catalase'
      ? 'enzyme-catalase'
      : 'osmosis-plasmolysis';

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
        title: 'Laju Fotosintesis Ingenhousz',
        subtitle: '6CO₂ + 6H₂O + Cahaya → C₆H₁₂O₆ + 6O₂↑',
        tokens: [
          {
            symbol: 'r(O₂)',
            value: Number(rate.toFixed(1)),
            unit: '/mnt',
            color: '#10b981',
          },
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
            symbol: 'T',
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
      return {
        title: 'Kinetika Enzim Katalase Michaelis-Menten',
        subtitle: '2H₂O₂ → 2H₂O + O₂↑',
        tokens: [
          {
            symbol: 'v₀',
            value: Number(v0.toFixed(2)),
            unit: 'mM/s',
            color: '#10b981',
          },
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
          { symbol: '/ (K_m + [S]) ·' },
          {
            symbol: 'pH',
            paramKey: 'solutionPh',
            value: ph,
            min: 3.0,
            max: 11.0,
            unit: 'pH',
            color: '#a855f7',
          },
        ],
      };
    }
    const pi = currentOutputs['osmoticPressureAtm'] ?? 4.5;
    const m = paramsState['sucroseMolarityM'] ?? 0.3;
    const t = paramsState['temperatureC'] ?? 25;
    return {
      title: 'Tekanan Osmotik van ’t Hoff',
      subtitle: 'Plasmolisis Sel pada Larutan Hipertonik',
      tokens: [
        {
          symbol: 'Π',
          value: Number(pi.toFixed(2)),
          unit: 'atm',
          color: '#10b981',
        },
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
        { symbol: '· R ·' },
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
  const liveBioTempOrPh =
    currentMode === 'enzyme-catalase'
      ? paramsState['solutionPh'] ?? 7.0
      : currentMode === 'photosynthesis-ingenhousz'
      ? paramsState['waterTempC'] ?? 28
      : paramsState['temperatureC'] ?? 25;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* FULL-VIEWPORT 3D SCENE CANVAS */}
      <div className="absolute inset-0 w-full h-full z-0">
        <BiologyScene3D
          mode={currentMode}
          params={paramsState}
          remoteCursors={remoteCursors}
          onEmitCursor={onEmitCursor}
          isPlaying={isPlaying}
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
            className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-emerald-300/60 via-white/85 to-lime-300/60"
          />
        )}
      </AnimatePresence>

      {/* 1. TOP-LEFT FLOATING PILL: Experiment Module Picker + Pre-Lab & Rumus Button */}
      <div className="pointer-events-auto absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/15 text-white rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
          <select
            aria-label="Pilih Modul Eksperimen Biologi"
            value={selectedModuleId}
            onChange={(e) => {
              labSound.playClick();
              setSelectedModuleId(e.target.value);
              const found = biologyModules.find((m) => m.id === e.target.value);
              if (found) setModalExperiment(found);
            }}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
          >
            {biologyModules.map((mod) => (
              <option key={mod.id} value={mod.id} className="bg-slate-900 text-white">
                {mod.title}
              </option>
            ))}
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
                    Kontrol Bioreaktor & Instrumen
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

              {/* SVG Radial Gauge + Color-Changing pH / Temperature Tube */}
              <div className="flex items-center justify-around gap-2 bg-slate-950/60 border border-white/10 rounded-xl p-2.5">
                {primaryOutput && (
                  <CircularGaugeMeter
                    size="sm"
                    label={primaryOutput.label.slice(0, 15)}
                    value={currentOutputs[primaryOutput.key] ?? 0}
                    min={0}
                    max={
                      currentMode === 'photosynthesis-ingenhousz'
                        ? 80
                        : currentMode === 'enzyme-catalase'
                        ? 40
                        : 25
                    }
                    unit={primaryOutput.unit}
                    color="#10b981"
                  />
                )}
                <LiquidColumnMeter
                  label={currentMode === 'enzyme-catalase' ? 'pH Enzim' : 'Suhu Air'}
                  value={liveBioTempOrPh}
                  min={currentMode === 'enzyme-catalase' ? 0 : 0}
                  max={currentMode === 'enzyme-catalase' ? 14 : 60}
                  unit={currentMode === 'enzyme-catalase' ? 'pH' : '°C'}
                  variant={currentMode === 'enzyme-catalase' ? 'ph' : 'temperature'}
                />
              </div>

              {/* Digital Readouts */}
              <div className="grid grid-cols-2 gap-2">
                {currentModule.outputs.slice(0, 2).map((out) => (
                  <AnimatedNumberReadout
                    key={out.key}
                    label={out.label}
                    value={currentOutputs[out.key] ?? 0}
                    precision={out.precision}
                    unit={out.unit}
                    accentColor="#10b981"
                  />
                ))}
              </div>

              {/* Interactive Formula Card */}
              <InteractiveFormulaCard
                title={biologyFormulaData.title}
                subtitle={biologyFormulaData.subtitle}
                tokens={biologyFormulaData.tokens}
                activeParamKey={hoveredParamKey}
                accentColor="#10b981"
              />

              {/* Tactile Parameter Sliders */}
              <div className="space-y-2.5">
                {currentModule.parameters.map((param) => {
                  const val = paramsState[param.key] ?? param.defaultValue;
                  const lock = paramLocks[param.key];
                  const isLocked =
                    !!lock && lock.lockedByName !== activeStudentName;

                  return (
                    <div
                      key={param.key}
                      onPointerDown={() =>
                        onAcquireLock && onAcquireLock(param.key)
                      }
                      onPointerUp={() =>
                        onReleaseLock && onReleaseLock(param.key)
                      }
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
                        onHoverChange={(h) =>
                          setHoveredParamKey(h ? param.key : null)
                        }
                        onChange={(v) => handleParamChange(param.key, v)}
                      />
                    </div>
                  );
                })}
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
            onClick={() => {
              labSound.playClick();
              setIsPlaying(!isPlaying);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-[0_0_18px_rgba(16,185,129,0.45)] transition-colors cursor-pointer shrink-0"
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
            onClick={() => {
              labSound.playClick();
              const resets: Record<string, number> = {};
              currentModule.parameters.forEach((p) => {
                resets[p.key] = p.defaultValue;
              });
              setParamsState((prev) => ({ ...prev, ...resets }));
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
            title="Reset Parameter Biologi"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Scrubber */}
          <div className="hidden sm:flex items-center gap-2 px-1">
            <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
              {Math.round(simProgress * 100)}%
            </span>
            <input
              type="range"
              aria-label="Waktu Pengamatan Biologi"
              min={0}
              max={1}
              step={0.05}
              value={simProgress}
              onChange={(e) => setSimProgress(Number(e.target.value))}
              className="w-28 md:w-36 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
          </div>

          {/* Glowing Primary Button: + Catat Data Percobaan */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRecordTrial}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-lime-400 hover:bg-lime-300 text-slate-950 font-bold text-xs shadow-[0_0_22px_rgba(132,204,22,0.55)] transition-colors cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>+ Catat Data Percobaan</span>
          </motion.button>
        </div>
      </div>

      {/* 4. RIGHT FLOATING ANALYTICS SUMMARY & STEP TRANSITION */}
      <FloatingLabAnalyticsDrawer
        domain="Biologi"
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
