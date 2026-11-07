import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Camera,
  Leaf,
} from 'lucide-react';
import {
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import { BiologyScene3D } from './BiologyScene3D';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import { labSound } from '../utils/soundEngine';
import {
  TactileParameterControl,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import {
  BiologyTelemetryContext,
  ExperimentRecord,
} from '../utils/scienceEngine';

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
  activeTier,
  onRecordExperiment,
  remoteCursors = {},
  onEmitCursor,
  paramLocks = {},
  onAcquireLock,
  onReleaseLock,
  onBiologyContextChange,
  records = [],
  selectedModuleId: externalModuleId,
  onSelectModuleId,
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

  return (
    <div className="w-full h-full max-w-[1380px] mx-auto p-4 sm:p-6 overflow-y-auto bg-slate-950 text-slate-100 select-none pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: 3D Scene Canvas & Playback Bar */}
        <div className="lg:col-span-8 space-y-4 flex flex-col">
          {/* 3D Canvas Box */}
          <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl">
            <BiologyScene3D
              mode={currentMode}
              params={paramsState}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              isPlaying={isPlaying}
            />

            {/* Shutter Flash Animation */}
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
          </div>

          {/* Bottom Playback & Recording Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Play / Reset controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIsPlaying(!isPlaying);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md ${
                    isPlaying
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'Jeda' : 'Jalankan Observasi'}</span>
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
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Reset Parameter Biologi"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Slider */}
              <div className="flex-1 min-w-[180px] flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 shrink-0">Waktu:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={simProgress}
                  onChange={(e) => setSimProgress(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs font-mono font-bold text-emerald-400 shrink-0 w-10 tabular-nums">
                  {Math.round(simProgress * 100)}%
                </span>
              </div>

              {/* Prominent + Catat Data Percobaan Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleRecordTrial}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-400 hover:to-lime-400 text-slate-950 font-extrabold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span>+ Catat Data Percobaan</span>
                <span className="bg-slate-950/20 px-2 py-0.5 rounded-md font-mono text-[11px] text-slate-950">
                  {records.length}/3 Data
                </span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Parameter Sliders & Formula Card */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Module Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Modul Eksperimen Biologi</span>
            </div>

            <select
              value={selectedModuleId}
              onChange={(e) => {
                labSound.playClick();
                setSelectedModuleId(e.target.value);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {biologyModules.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.title}
                </option>
              ))}
            </select>
          </div>

          {/* Parameter Sliders Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="text-xs font-bold text-slate-200">Parameter Bioreaktor</div>

            <div className="space-y-3">
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
          </div>

          {/* Interactive Formula Card */}
          <InteractiveFormulaCard
            title={biologyFormulaData.title}
            subtitle={biologyFormulaData.subtitle}
            tokens={biologyFormulaData.tokens}
            activeParamKey={hoveredParamKey}
            accentColor="#10b981"
          />
        </div>
      </div>
    </div>
  );
};
