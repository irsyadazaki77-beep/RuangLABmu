import React, { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import {
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import { LabErrorBoundary } from './common/LabErrorBoundary';
import { SpatialCursorPayload, ParameterLockPayload } from '../utils/collabProtocol';
import { labSound } from '../utils/soundEngine';

const BiologyScene3D = React.lazy(() => import('./BiologyScene3D'));
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
import { useLabStore } from '../stores/useLabStore';
import {
  getBiologyParameterFeedback,
  normalizeEducationLevel,
} from '../utils/pedagogicalHelpers';
import { useTimelineRecorder } from '../hooks/useTimelineRecorder';
import { DualRealityLabViewport } from './ui/DualRealityLabViewport';
import { PrecisionSlider } from './controls/PrecisionSlider';
import { filterRecordsForModule } from '../utils/spatialHudHelpers';
import { LabSidebarActionHeader } from './layout/LabSidebarActionHeader';
import { LabSceneFallback } from './three/LabSceneFallback';
import { LabPresetAndSweepBar } from './labs/LabPresetAndSweepBar';
import {
  generateAutoSweepSeries,
  getBiologyPresetsForModule,
} from '../utils/labScenarioPresets';

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
  activeTier,
  onRecordExperiment,
  remoteCursors = {},
  onEmitCursor,
  onBiologyContextChange,
  records = [],
  onDeleteRecord,
  selectedModuleId: externalModuleId,
  onSelectModuleId,
  onProceedToAnalysis,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const storeLevel = useLabStore((s) => s.academicLevel);
  const playbackSpeed = useLabStore((s) => s.playbackSpeed);
  const isTimeTraveling = useLabStore((s) => s.isTimeTraveling);
  const effectiveEducationLevel = normalizeEducationLevel(activeTier ?? storeLevel);
  const biologyModules = useMemo(() => getExperimentsByDomain('biologi'), []);
  const selectedModuleId = externalModuleId || 'photosynthesis-ingenhousz';

  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const simTimeRef = useRef<number>(0);
  const [isDualRealityMode, setIsDualRealityMode] = useState<boolean>(false);

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

  const buildPerturbedBioRealityB = (
    mod: typeof currentModule,
    base: Record<string, number>
  ): Record<string, number> => {
    const copy = { ...base };
    const firstParam = mod.parameters[0];
    if (firstParam) {
      const span = firstParam.max - firstParam.min;
      const cur = base[firstParam.key] ?? firstParam.defaultValue;
      const shifted = cur + span * 0.3 <= firstParam.max ? cur + span * 0.3 : Math.max(firstParam.min, cur - span * 0.3);
      copy[firstParam.key] = Number(shifted.toFixed(2));
    }
    return copy;
  };

  const [realityBParamsState, setRealityBParamsState] = useState<Record<string, number>>(() =>
    buildPerturbedBioRealityB(currentModule, paramsState)
  );
  const prevBioModuleRef = useRef(currentModule.id);
  useEffect(() => {
    if (prevBioModuleRef.current !== currentModule.id) {
      prevBioModuleRef.current = currentModule.id;
      setRealityBParamsState(buildPerturbedBioRealityB(currentModule, paramsState));
    }
  }, [currentModule, paramsState]);

  const currentOutputs = useMemo(() => {
    return currentModule.computeStep(paramsState, Math.max(0.1, simTime));
  }, [currentModule, paramsState, simTime]);

  const currentOutputsB = useMemo(() => {
    return currentModule.computeStep(realityBParamsState, Math.max(0.1, simTime));
  }, [currentModule, realityBParamsState, simTime]);

  const moduleRecords = filterRecordsForModule(records, 'Biologi', currentModule.id);

  const telemetryMetrics = currentModule.outputs.map((out, idx) => ({
    id: out.key,
    label: out.label,
    value: currentOutputs[out.key] ?? 0,
    unit: out.unit,
    min: 0,
    max: Math.max(10, Math.ceil((currentOutputs[out.key] ?? 10) * 1.8)),
    precision: out.precision,
    color: idx === 0 ? '#10b981' : idx === 1 ? '#38bdf8' : '#f59e0b',
  }));

  useTimelineRecorder<Record<string, number>, { primary: number; secondary?: number }>({
    domain: 'biology',
    simTime,
    simTimeRef,
    isPlaying,
    params: paramsState,
    stateSnapshot: {
      primary: telemetryMetrics[0]?.value ?? 0,
      secondary: telemetryMetrics[1]?.value,
    },
    onRestoreFrame: (frame) => {
      setIsPlaying(false);
      simTimeRef.current = frame.simTime;
      setSimTime(frame.simTime);
      setParamsState(frame.parameters);
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

  const handleParamChange = (key: string, val: number) => {
    setParamsState((prev) => ({ ...prev, [key]: val }));
  };

  const scenarioPresets = useMemo(
    () => getBiologyPresetsForModule(currentModule),
    [currentModule]
  );
  const sweepSteps = useMemo(
    () => generateAutoSweepSeries('Biologi', currentModule.id, 5),
    [currentModule.id]
  );

  const handleRecordTrial = (
    overrideParams?: Record<string, number>,
    noteOverride?: string
  ) => {
    const pState = overrideParams ?? paramsState;
    const outs = overrideParams
      ? currentModule.computeStep(overrideParams, Math.max(0.5, simTime))
      : currentOutputs;
    labSound.playRecordSuccess();
    const summaryParts = currentModule.parameters.map(
      (p) => `${p.label}=${pState[p.key]}${p.unit}`
    );
    const primaryKey = currentModule.outputs[0]?.key || 'val';
    const primaryVal = outs[primaryKey] ?? 0;
    const secondaryKey = currentModule.outputs[1]?.key;
    const secondaryVal = secondaryKey ? (outs[secondaryKey] ?? primaryVal) : primaryVal;
    const inputKey = currentModule.parameters[0]?.key || 'in';
    const inputVal = pState[inputKey] ?? 0;

    const metricMap: Record<string, number | string> = {};
    currentModule.outputs.forEach((o) => {
      metricMap[o.label] = `${(outs[o.key] ?? 0).toFixed(1)} ${o.unit}`;
    });

    onRecordExperiment(
      'Biologi',
      currentModule.title,
      summaryParts.join(', '),
      metricMap,
      noteOverride ?? (hypothesisNote?.hypothesisText || ''),
      { x: inputVal, y1: primaryVal, y2: secondaryVal }
    );
  };

  return (
    <StandardLabViewShell
      domain="Biologi"
      recordsCount={moduleRecords.length}
      hypothesisText={hypothesisNote?.hypothesisText}
      recentRecords={moduleRecords}
      onProceedToAnalysis={onProceedToAnalysis}
      onDeleteRecord={onDeleteRecord}
      onBackToPreLab={() => useLabStore.getState().setWorkflowStep(1)}
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
      dualModeActive={isDualRealityMode}
      onToggleDualMode={() => setIsDualRealityMode((prev) => !prev)}
      dualViewport={
        isDualRealityMode ? (() => {
          const p0 = currentModule.parameters[0];
          const out0 = currentModule.outputs[0];
          const valA = p0 ? (paramsState[p0.key] ?? p0.defaultValue) : 0;
          const valB = p0 ? (realityBParamsState[p0.key] ?? p0.defaultValue) : 0;
          const resA = out0 ? (currentOutputs[out0.key] ?? 0) : 0;
          const resB = out0 ? (currentOutputsB[out0.key] ?? 0) : 0;
          const deltaVal = resB - resA;
          return (
            <DualRealityLabViewport
              domain="Biologi"
              moduleTitle={currentModule.title}
              realityASummary={
                p0 && out0
                  ? `${p0.label.split(' ')[0]}=${valA}${p0.unit} · ${out0.label.split(' ')[0]}=${resA.toFixed(1)}${out0.unit}`
                  : currentModule.title
              }
              realityBSummary={
                p0 && out0
                  ? `${p0.label.split(' ')[0]}=${valB}${p0.unit} · ${out0.label.split(' ')[0]}=${resB.toFixed(1)}${out0.unit}`
                  : currentModule.title
              }
              deltaSummary={
                out0
                  ? `Δ${out0.label.split(' ')[0]} = ${deltaVal >= 0 ? '+' : ''}${deltaVal.toFixed(1)} ${out0.unit}`
                  : undefined
              }
              onResetBToMatchA={() => setRealityBParamsState({ ...paramsState })}
              onRecordComparison={() => {
                handleRecordTrial(paramsState, '[Komparasi A · Kontrol]');
                handleRecordTrial(realityBParamsState, '[Komparasi B · Uji Variabel]');
              }}
              onClose={() => setIsDualRealityMode(false)}
              realityBControls={
                p0 ? (
                  <div className="w-full max-w-md">
                    <PrecisionSlider
                      compact
                      syncToLiveFormula={false}
                      accentColor="amber"
                      label={`${p0.label} (B)`}
                      min={p0.min}
                      max={p0.max}
                      step={p0.step}
                      unit={p0.unit}
                      value={valB}
                      defaultValue={p0.defaultValue}
                      onChange={(nextVal) =>
                        setRealityBParamsState((prev) => ({ ...prev, [p0.key]: nextVal }))
                      }
                    />
                  </div>
                ) : undefined
              }
              renderViewport={(side, syncProps) => (
                <LabErrorBoundary domain="Biologi" sceneName={`BiologyScene3D-${side}`}>
                  <Suspense
                    fallback={
                      <LabSceneFallback compact label={`Menyiapkan Realitas ${side}...`} />
                    }
                  >
                    <BiologyScene3D
                      mode={currentModule.id as any}
                      params={side === 'A' ? paramsState : realityBParamsState}
                      isPlaying={isPlaying}
                      simTime={simTime}
                      simTimeRef={simTimeRef}
                      cameraSyncPose={syncProps.cameraSyncPose}
                      onCameraSyncChange={syncProps.onCameraSyncChange}
                    />
                  </Suspense>
                </LabErrorBoundary>
              )}
            />
          );
        })() : undefined
      }
      canvas={
        <LabErrorBoundary domain="Biologi" sceneName="BiologyScene3D">
          <Suspense fallback={<LabSceneFallback accentColor="emerald" />}>
            <BiologyScene3D
              mode={currentModule.id as any}
              params={paramsState}
              onUpdateParam={handleParamChange}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              isPlaying={isPlaying}
              simTime={simTime}
              simTimeRef={simTimeRef}
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
          </Suspense>
        </LabErrorBoundary>
      }
      sidebar={
        <>
          <LabSidebarActionHeader
            recordsCount={moduleRecords.length}
            accentColor="emerald"
            onRecordTrial={handleRecordTrial}
            onProceedToAnalysis={onProceedToAnalysis}
          />

          {/* Module Selector */}
          <div className="space-y-1.5">
            <label className="text-2xs font-bold text-[var(--comfort-text-muted)] uppercase tracking-wider">
              Pilih Eksperimen Biologi:
            </label>
            <select
              value={currentModule.id}
              onChange={(e) => {
                const nextId = e.target.value;
                labSound.playClick();
                useLabStore.getState().setActiveModule(nextId);
                onSelectModuleId?.(nextId);
              }}
              className="w-full text-xs p-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-semibold"
            >
              {biologyModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <LabPresetAndSweepBar
            presets={scenarioPresets}
            sweepSteps={sweepSteps}
            accentColor="emerald"
            onApplyPreset={(preset) =>
              setParamsState((prev) => ({ ...prev, ...(preset.patch as Record<string, number>) }))
            }
            onSweepStep={(step) => {
              const nextParams: Record<string, number> = { ...paramsState };
              for (const [key, val] of Object.entries(step.patch)) {
                if (typeof val === 'number') {
                  nextParams[key] = val;
                }
              }
              setParamsState(nextParams);
              handleRecordTrial(nextParams, step.label);
            }}
          />

          {/* Sliders & Parameters */}
          <CollapsibleLabSection title="Variabel & Parameter Biologis" defaultOpen>
            <div className="space-y-3">
              {currentModule.parameters.map((p) => {
                const glossaryTerm =
                  p.key === 'temperatureC'
                    ? 'Denaturasi'
                    : p.key === 'sucroseConcMolar'
                    ? 'Osmosis'
                    : p.key === 'vesselRadiusRatio'
                    ? 'Vasokonstriksi'
                    : p.key === 'stimulusVoltageMv'
                    ? 'Potensial Aksi'
                    : undefined;
                return (
                  <TactileParameterControl
                    key={p.key}
                    id={`bio-param-${p.key}`}
                    paramKey={p.key}
                    label={p.label}
                    unit={p.unit}
                    value={paramsState[p.key] ?? p.defaultValue}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    glossaryTerm={glossaryTerm}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getBiologyParameterFeedback(currentModule.id, p.key, v, lvl)
                    }
                    onChange={(v) => handleParamChange(p.key, v)}
                  />
                );
              })}
            </div>
          </CollapsibleLabSection>

          {/* Interactive Formula Card */}
          <CollapsibleLabSection title="Rumus & Kalkulator Interaktif" defaultOpen={false}>
            <InteractiveFormulaCard
              title={currentModule.title}
              tokens={currentModule.parameters.slice(0, 3).map((p) => ({
                symbol: p.label.split(' ')[0],
                value: paramsState[p.key] ?? p.defaultValue,
                unit: p.unit,
                description: p.label,
              }))}
            />
          </CollapsibleLabSection>
        </>
      }
    />
  );
};
