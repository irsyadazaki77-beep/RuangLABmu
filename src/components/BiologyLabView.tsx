import React, { useState, useMemo } from 'react';
import {
  Leaf,
  Sliders,
  ShieldCheck,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Lock,
  Sparkles,
  Info,
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
  activeGroupId,
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

    // Format summary string
    const summaryParts = currentModule.parameters.map((p) => `${p.label}=${paramsState[p.key]} ${p.unit}`);
    const paramsSummary = summaryParts.join(', ');

    // Metrics formatted dictionary
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
  };

  const currentMode =
    currentModule.id === 'photosynthesis-ingenhousz'
      ? 'photosynthesis-ingenhousz'
      : currentModule.id === 'enzyme-catalase'
      ? 'enzyme-catalase'
      : 'osmosis-plasmolysis';

  return (
    <div className="space-y-6">
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

      {/* Main Simulation Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 3D Scene Visualizer & Playback Control (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            {/* Title & Tier Badge */}
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      {currentModule.subCategory}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-sm">
                      Jenjang {activeTier}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {currentModule.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setModalExperiment(currentModule);
                  setPreLabModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                K3 & Capaian
              </button>
            </div>

            {/* 3D Scene */}
            <BiologyScene3D
              mode={currentMode}
              params={paramsState}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              isPlaying={isPlaying}
            />

            {/* Playback & Reset Bar */}
            <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIsPlaying(!isPlaying);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? 'Jeda Simulasi' : 'Jalankan'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    // Reset to defaults
                    const resets: Record<string, number> = {};
                    currentModule.parameters.forEach((p) => {
                      resets[p.key] = p.defaultValue;
                    });
                    setParamsState((prev) => ({ ...prev, ...resets }));
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                O₂ Generator: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Aktif (25 Hz)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters & Live Output Metric Cards (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Parameter Sliders Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Variabel & Kontrol Percobaan
              </h4>
            </div>

            <div className="space-y-4">
              {currentModule.parameters.map((param) => {
                const val = paramsState[param.key] ?? param.defaultValue;
                const lock = paramLocks[param.key];
                const isLocked = !!lock && lock.lockedByName !== activeStudentName;

                return (
                  <div key={param.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {param.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {param.variableRole === 'bebas' ? 'Bebas' : 'Kontrol'}
                        </span>
                      </div>

                      {isLocked ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                          <Lock className="w-3 h-3" />
                          <span>Diatur oleh {lock.lockedByName}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-900 dark:text-white font-semibold">
                          {val} {param.unit}
                        </span>
                      )}
                    </div>

                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={val}
                      disabled={isLocked}
                      onPointerDown={() => onAcquireLock && onAcquireLock(param.key)}
                      onPointerUp={() => onReleaseLock && onReleaseLock(param.key)}
                      onChange={(e) => handleParamChange(param.key, parseFloat(e.target.value))}
                      className="w-full accent-emerald-600 dark:accent-emerald-400 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Output Metric Cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
              Indikator & Besaran Fisik Terukur
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {currentModule.outputs.map((out) => {
                const val = currentOutputs[out.key];
                return (
                  <div
                    key={out.key}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between"
                  >
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {out.label}
                    </span>
                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {val !== undefined ? val.toFixed(out.precision) : '--'}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        {out.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Notes & Record Button */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <input
                type="text"
                placeholder="Catatan observasi percobaan ini (opsional)..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              <button
                type="button"
                onClick={handleRecordTrial}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Rekam Data Pengamatan ke LKS
              </button>
            </div>
          </div>
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
