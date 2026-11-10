import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Camera,
  Sliders,
  Dna,
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
  CollapsibleLabSection,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
} from './ui/InteractiveFormulaCard';
import {
  BiologyTelemetryContext,
  ExperimentRecord,
} from '../utils/scienceEngine';
import {
  HypothesisNote,
} from './ui/HypothesisAndCompareDock';
import {
  TargetChallengeMission,
} from './ui/ScientificEnhancementSuite';
import { StandardLabViewShell } from './layout/StandardLabViewShell';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';

export interface BiologyLabViewProps {
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
  onRecordExperiment,
  remoteCursors = {},
  onEmitCursor,
  onBiologyContextChange,
  records = [],
  selectedModuleId: externalModuleId,
  onSelectModuleId,
  onProceedToAnalysis,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const biologyModules = useMemo(() => getExperimentsByDomain('biologi'), []);
  const selectedModuleId = externalModuleId || 'photosynthesis-ingenhousz';

  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

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

  const currentOutputs = useMemo(() => {
    return currentModule.computeStep(paramsState, 1.0);
  }, [currentModule, paramsState]);

  const prevBioSig = useRef('');
  const bioSig = `${currentModule.id}:${JSON.stringify(paramsState)}`;

  useEffect(() => {
    if (prevBioSig.current === bioSig) return;
    prevBioSig.current = bioSig;

    if (onBiologyContextChange) {
      onBiologyContextChange({
        moduleId: currentModule.id,
        params: paramsState,
        liveMetrics: currentOutputs,
      });
    }
  }, [bioSig, currentModule.id, paramsState, currentOutputs, onBiologyContextChange]);

  useEffect(() => {
    const unsubToggle = subscribeLabEvent(LAB_EVENTS.TOGGLE_SIMULATION, (data: any) => {
      setIsPlaying((prev) => (data?.isSimulating !== undefined ? data.isSimulating : !prev));
    });
    const unsubCapture = subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, () => {
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 240);
    });
    return () => {
      unsubToggle();
      unsubCapture();
    };
  }, []);

  const handleParamChange = (key: string, val: number) => {
    setParamsState((prev) => ({ ...prev, [key]: val }));
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    const summaryParts = currentModule.parameters.map(
      (p) => `${p.label}=${paramsState[p.key]}${p.unit}`
    );
    const primaryKey = currentModule.outputs[0]?.key || 'val';
    const primaryVal = currentOutputs[primaryKey] ?? 0;
    const inputKey = currentModule.parameters[0]?.key || 'in';
    const inputVal = paramsState[inputKey] ?? 0;

    const metricMap: Record<string, number | string> = {};
    currentModule.outputs.forEach((o) => {
      metricMap[o.label] = `${currentOutputs[o.key]?.toFixed(1)} ${o.unit}`;
    });

    onRecordExperiment(
      'Biologi',
      currentModule.title,
      summaryParts.join(', '),
      metricMap,
      hypothesisNote?.hypothesisText || '',
      { x: inputVal, y1: primaryVal, y2: primaryVal }
    );
  };

  const telemetryMetrics = currentModule.outputs.map((out, idx) => ({
    id: out.key,
    label: out.label,
    value: currentOutputs[out.key] ?? 0,
    unit: out.unit,
    min: 0,
    max: Math.max(10, (currentOutputs[out.key] ?? 10) * 1.8),
    precision: out.precision,
    color: idx === 0 ? '#10b981' : idx === 1 ? '#38bdf8' : '#f59e0b',
  }));

  return (
    <StandardLabViewShell
      domain="Biologi"
      recordsCount={records.length}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: currentModule.outputs[0]?.label || 'Laju O₂',
        primaryValue: currentOutputs[currentModule.outputs[0]?.key || 'o2BubbleRate'] ?? 0,
        primaryUnit: currentModule.outputs[0]?.unit || '/mnt',
        secondaryLabel: currentModule.parameters[0]?.label || 'Input',
        secondaryValue: paramsState[currentModule.parameters[0]?.key || 'lightIntensityLux'] ?? 0,
        secondaryUnit: currentModule.parameters[0]?.unit || '',
        microscopicStateLabel: `Aparatus Biologi: ${currentModule.title}`,
        microscopicDetail: `Reaksi metabolik kuantitatif dan kinetika enzim terkontrol.`,
        accentColor: '#10b981',
      }}
      shutterFlash={shutterFlash}
      zenMode={zenMode}
      activeCameraPreset={activeCameraPreset}
      onSelectCameraPreset={setActiveCameraPreset}
      canvas={
        <BiologyScene3D
          mode={currentModule.id as any}
          params={paramsState}
          remoteCursors={remoteCursors}
          onEmitCursor={onEmitCursor}
          isPlaying={isPlaying}
          snapshotCount={snapshotCount}
          onCaptureSnapshot={(dataUrl) => {
            setShutterFlash(true);
            setTimeout(() => setShutterFlash(false), 240);
            onCapture3DSnapshot?.(
              dataUrl,
              currentModule.title,
              'Eksplorasi Biologi Sel 3D',
              `${currentModule.outputs[0]?.label} = ${currentOutputs[currentModule.outputs[0]?.key]}`
            );
          }}
        />
      }
      sidebar={
        <>
          {/* Action Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecordTrial}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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

          {/* Module Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pilih Eksperimen Biologi:
            </label>
            <select
              value={currentModule.id}
              onChange={(e) => {
                labSound.playClick();
                onSelectModuleId?.(e.target.value);
              }}
              className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
            >
              {biologyModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sliders & Parameters */}
          <CollapsibleLabSection title="Variabel & Parameter Biologis" defaultOpen>
            <div className="space-y-3">
              {currentModule.parameters.map((p) => (
                <TactileParameterControl
                  key={p.key}
                  label={p.label}
                  unit={p.unit}
                  value={paramsState[p.key] ?? p.defaultValue}
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  onChange={(v) => handleParamChange(p.key, v)}
                />
              ))}
            </div>
          </CollapsibleLabSection>

          {/* Interactive Formula Card */}
          <InteractiveFormulaCard
            title={currentModule.title}
            tokens={currentModule.parameters.slice(0, 3).map((p) => ({
              symbol: p.key.slice(0, 2),
              value: paramsState[p.key] ?? p.defaultValue,
              unit: p.unit,
              description: p.label,
            }))}
          />
        </>
      }
    />
  );
};
