import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
} from 'lucide-react';
import {
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import { BiologyScene3D } from './BiologyScene3D';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import { labSound } from '../utils/soundEngine';
import {
  DEFAULT_CALIBRATION_CONFIG,
  InstrumentCalibrationConfig,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from '../utils/uncertaintyEngine';
import {
  TactileParameterControl,
  InstrumentCalibrationCard,
  CollapsibleLabSection,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import {
  BiologyTelemetryContext,
  ExperimentRecord,
} from '../utils/scienceEngine';
import {
  ContextualMicroGuideHUD,
  HypothesisNote,
} from './ui/HypothesisAndCompareDock';
import {
  TargetChallengeMission,
} from './ui/ScientificEnhancementSuite';
import {
  CompactTelemetryRibbon,
  TelemetryRibbonMetric,
} from './ui/CompactTelemetryRibbon';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { useLabStore } from '../stores/useLabStore';

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
  onProceedToAnalysis,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const biologyModules = useMemo(() => getExperimentsByDomain('biologi'), []);
  const selectedModuleId = externalModuleId || 'photosynthesis-ingenhousz';

  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [calibrationConfig, setCalibrationConfig] =
    useState<InstrumentCalibrationConfig>(DEFAULT_CALIBRATION_CONFIG);

  const effectiveHypothesis = hypothesisNote ?? {
    independentVar: 'Intensitas Cahaya / Konsentrasi Substrat',
    dependentVar: 'Laju Gelembung O₂ / Kecepatan Reaksi',
    hypothesisText: '',
    reflectionText: '',
    updatedAt: '',
  };

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

  useEffect(() => {
    const unsubToggle = subscribeLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, (detail) => {
      setIsPlaying((prev) => {
        const next = typeof detail?.isSimulating === 'boolean' ? detail.isSimulating : !prev;
        useLabStore.getState().setIsSimulating(next);
        return next;
      });
    });
    const unsubReset = subscribeLabEvent(LAB_EVENTS.RESET_TRIAL, () => {
      setIsPlaying(false);
      useLabStore.getState().setIsSimulating(false);
      const resetMap: Record<string, number> = {};
      biologyModules.forEach((mod) => {
        mod.parameters.forEach((p) => {
          resetMap[p.key] = p.defaultValue;
        });
      });
      setParamsState(resetMap);
    });
    return () => {
      unsubToggle();
      unsubReset();
    };
  }, [biologyModules]);

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
    const rawY1 = currentOutputs[yKey] ?? 0;
    const calibratedMeasurement = applyInstrumentNoise(
      rawY1,
      {
        name: 'Sensor Bioreaktor Optik',
        smallestScaleDivision: 0.4,
        unit: currentModule.outputs[0]?.unit || '',
        uncertaintyDelta: 0.2,
        precisionDecimals: 2,
      },
      !calibrationConfig.isZeroCalibrated || calibrationConfig.precisionTier === 'high-precision',
      calibrationConfig
    );

    if (currentModule.outputs[0]) {
      metricsDict[currentModule.outputs[0].label] = formatMeasurementWithUncertainty(
        calibratedMeasurement.measuredValue,
        calibratedMeasurement.uncertainty,
        currentModule.outputs[0].unit
      );
    }

    onRecordExperiment(
      'Biologi',
      currentModule.title,
      paramsSummary,
      metricsDict,
      `Pengujian ${currentModule.title} jenjang ${activeTier} pada ${paramsSummary}.`,
      { x: numX, y1: calibratedMeasurement.measuredValue, y2: 0 }
    );
  };

  const currentMode =
    currentModule.id === 'photosynthesis-ingenhousz'
      ? 'photosynthesis-ingenhousz'
      : currentModule.id === 'enzyme-catalase' || currentModule.id === 'enzyme-kinetics'
      ? 'enzyme-catalase'
      : currentModule.id === 'predator-prey-dynamics'
      ? 'predator-prey-dynamics'
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
      const v0 = currentOutputs['reactionRate'] ?? currentOutputs['reactionVelocity'] ?? 15;
      const s = paramsState['substrateConcMm'] ?? paramsState['substrateH2O2ConcM'] ?? 10;
      const ph = paramsState['solutionPH'] ?? paramsState['solutionPh'] ?? 7.0;
      return {
        title: 'Kinetika Enzim Katalase Michaelis-Menten',
        subtitle: 'v = (Vmax·[S]) / (Km + [S]) · f(T) · f(pH)',
        tokens: [
          {
            symbol: 'v₀',
            value: Number(v0.toFixed(2)),
            unit: 'μM/s',
            color: '#10b981',
          },
          { symbol: '=' },
          {
            symbol: 'V_max·[S]',
            paramKey: 'substrateConcMm',
            value: s,
            min: 1,
            max: 25,
            unit: 'mM',
            color: '#38bdf8',
          },
          { symbol: '/ (K_m + [S]) ·' },
          {
            symbol: 'pH',
            paramKey: 'solutionPH',
            value: ph,
            min: 2.0,
            max: 12.0,
            unit: 'pH',
            color: '#a855f7',
          },
        ],
      };
    }
    if (currentMode === 'predator-prey-dynamics') {
      const dxdt = currentOutputs['dxdt'] ?? 0;
      const alpha = paramsState['alpha'] ?? 1.1;
      const beta = paramsState['beta'] ?? 0.4;
      const prey = paramsState['preyCount'] ?? 40;
      return {
        title: 'Dinamika Ekosistem Lotka-Volterra',
        subtitle: 'dx/dt = αx − βxy,  dy/dt = δxy − γy',
        tokens: [
          {
            symbol: 'dx/dt',
            value: Number(dxdt.toFixed(1)),
            unit: '/t',
            color: '#10b981',
          },
          { symbol: '=' },
          {
            symbol: 'α',
            paramKey: 'alpha',
            value: alpha,
            min: 0.2,
            max: 2.5,
            unit: '/t',
            color: '#38bdf8',
          },
          { symbol: '·' },
          {
            symbol: 'x',
            paramKey: 'preyCount',
            value: prey,
            min: 5,
            max: 120,
            unit: 'ind',
            color: '#f59e0b',
          },
          { symbol: '−' },
          {
            symbol: 'β·x·y',
            paramKey: 'beta',
            value: beta,
            min: 0.05,
            max: 1.0,
            unit: '',
            color: '#ec4899',
          },
        ],
      };
    }
    const pi = currentOutputs['osmoticPressureAtm'] ?? 4.5;
    const m = paramsState['sucroseConcMolar'] ?? paramsState['sucroseMolarityM'] ?? 0.3;
    const t = paramsState['temperatureC'] ?? 25;
    return {
      title: 'Tekanan Osmotik van ’t Hoff',
      subtitle: 'Π = i · M · R · T  |  Fluks Osmotik & Turgor Sel',
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
          paramKey: 'sucroseConcMolar',
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

  const telemetryRibbonMetrics: TelemetryRibbonMetric[] = useMemo(() => {
    return currentModule.outputs.map((out, idx) => ({
      id: out.key,
      label: out.label,
      value: currentOutputs[out.key] ?? 0,
      unit: out.unit,
      min: 0,
      max: Math.max(10, (currentOutputs[out.key] ?? 10) * 1.8),
      precision: out.precision,
      color: idx === 0 ? '#10b981' : idx === 1 ? '#38bdf8' : '#f59e0b',
    }));
  }, [currentModule, currentOutputs]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full bg-[var(--comfort-bg)] text-[var(--comfort-text)] select-none">
      {/* LEFT COLUMN: Slim 48px Telemetry Ribbon + Full-Bleed 3D Canvas */}
      <div className="flex-1 relative flex flex-col min-w-0 h-full overflow-hidden">
        <CompactTelemetryRibbon
          domain="Biologi"
          metrics={telemetryRibbonMetrics}
          recordsCount={records.length}
          missionTitle={currentModule.title}
          oscilloscope={{
            primaryLabel: currentModule.outputs[0]?.label || 'Laju O₂',
            primaryValue: currentOutputs[currentModule.outputs[0]?.key || 'o2BubbleRate'] ?? 0,
            primaryUnit: currentModule.outputs[0]?.unit || '/mnt',
            secondaryLabel: currentModule.parameters[0]?.label || 'Input',
            secondaryValue: paramsState[currentModule.parameters[0]?.key || 'lightIntensityLux'] ?? 0,
            secondaryUnit: currentModule.parameters[0]?.unit || '',
            microscopicStateLabel:
              currentMode === 'photosynthesis-ingenhousz'
                ? 'Aktivitas Kloroplas & Fotolisis Air Tilakoid'
                : currentMode === 'enzyme-catalase'
                ? 'Kompleks Enzim-Substrat (Situs Aktif Hem Katalase)'
                : currentMode === 'predator-prey-dynamics'
                ? 'Siklus Populasi Mangsa-Predator Lotka-Volterra'
                : 'Status Turgor Membran Plasma & Vakuola Sel',
            microscopicDetail:
              currentMode === 'photosynthesis-ingenhousz'
                ? 'Pelepasan mikro-gelembung O₂ berbanding lurus dengan fluks foton sebelum mencapai titik jenuh enzim Rubisco.'
                : currentMode === 'enzyme-catalase'
                ? 'Suhu dan pH ekstrem memicu denaturasi ikatan hidrogen konformasi 3D situs aktif enzim.'
                : currentMode === 'predator-prey-dynamics'
                ? 'Osilasi fase populasi mangsa (x) mendahului puncak populasi predator (y).'
                : 'Perbedaan potensial air (ΔΨ) mendorong fluks osmotik melintasi membran semipermeabel.',
            accentColor: '#10b981',
          }}
        />

        {/* Full-Bleed 3D Canvas */}
        <div className="relative w-full flex-1 min-h-[360px] overflow-hidden bg-slate-950 select-none">
          <BiologyScene3D
            mode={currentMode}
            params={paramsState}
            remoteCursors={remoteCursors}
            onEmitCursor={onEmitCursor}
            isPlaying={isPlaying}
            snapshotCount={snapshotCount}
            onCaptureSnapshot={(dataUrl) => {
              setShutterFlash(true);
              setTimeout(() => setShutterFlash(false), 260);
              if (onCapture3DSnapshot) {
                const summaryParts = currentModule.parameters.map(
                  (p) => `${p.label}=${paramsState[p.key]} ${p.unit}`
                );
                const out0 = currentModule.outputs[0];
                const val0 = out0 ? currentOutputs[out0.key] : 0;
                onCapture3DSnapshot(
                  dataUrl,
                  currentModule.title,
                  summaryParts.join(', '),
                  out0 ? `${out0.label} = ${val0?.toFixed(1)} ${out0.unit}` : 'Bioreaktor Aktif'
                );
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
                className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-emerald-300/60 via-white/85 to-lime-300/60"
              />
            )}
          </AnimatePresence>

          {/* Bottom-Left Compact Guide Pill (Collapsed by Default) */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none hidden sm:block">
            <ContextualMicroGuideHUD
              moduleTitle={currentModule.title}
              IndependentVarLabel={currentModule.parameters[0]?.label || 'Parameter Bioreaktor'}
              DependentVarLabel={currentModule.outputs[0]?.label || 'Laju Biologis'}
              recordsCount={records.length}
              targetRecords={3}
              isPlaying={isPlaying}
              hasHypothesis={Boolean(effectiveHypothesis.hypothesisText?.trim())}
              onQuickRecord={handleRecordTrial}
              onProceedToAnalysis={onProceedToAnalysis}
            />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Clean SaaS Parameter Sidebar (Hidden in Zen Mode) */}
      {!zenMode && (
        <aside className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-[var(--comfort-border)] bg-[var(--comfort-surface)] overflow-y-auto p-4 shrink-0 space-y-3.5">
          {/* Primary Action Bar: Catat Data & Analisis Grafik */}
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRecordTrial}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              <span>+ Catat Data</span>
              <span className="bg-slate-950/30 px-1.5 py-0.5 rounded font-mono text-[11px] tabular-nums">
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
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  records.length >= 3
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                    : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-[var(--comfort-border)]'
                }`}
              >
                Grafik &amp; LKS →
              </button>
            )}
          </div>

          {/* Parameter Sliders Container */}
          <div className="lab-glass-panel rounded-2xl p-3.5 shadow-sm space-y-2.5">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Parameter Bioreaktor
            </div>

            <div className="space-y-2.5">
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
            onApplyParamValue={(paramKey, value) => handleParamChange(paramKey, value)}
            accentColor="#10b981"
          />

          {/* Accordion: Manual Instrument Calibration */}
          <CollapsibleLabSection
            title="Kalibrasi Sensor Optik & Respirometer"
            subtitle="Atur kalibrasi nol (Tare) dan tingkat presisi sensor biologi"
            statusText={calibrationConfig.isZeroCalibrated ? 'Terkalibrasi' : 'Standar'}
            accentColor="#f59e0b"
          >
            <InstrumentCalibrationCard
              instrumentName="Sensor Optik & Respirometer Biologi"
              unit={currentModule.outputs[0]?.unit || 'satuan'}
              rawValue={currentOutputs[currentModule.outputs[0]?.key || 'o2BubbleRate'] ?? 0}
              baseUncertaintyDelta={0.2}
              config={calibrationConfig}
              onChangeConfig={setCalibrationConfig}
            />
          </CollapsibleLabSection>
        </aside>
      )}
    </div>
  );
};
