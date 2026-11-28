import React, { useEffect, useMemo, useState } from 'react';
import { Globe2, PlusCircle, RotateCcw } from 'lucide-react';
import { ExperimentRecord } from '../utils/scienceEngine';
import { EARTH_SCIENCE_MODULES } from '../registry/modules/earthScienceModules';
import { useLabStore } from '../stores/useLabStore';
import {
  StandardLabViewShell,
  TelemetryMetricDescriptor,
} from './layout/StandardLabViewShell';
import { EarthScienceScene3D } from './EarthScienceScene3D';
import { labSound } from '../utils/soundEngine';
import { useLabSonification } from '../hooks/useLabSonification';

export interface EarthScienceLabViewProps {
  records: ExperimentRecord[];
  onDeleteRecord: (id: string) => void;
  onProceedToAnalysis: () => void;
  onRecordExperiment: (
    title: string,
    paramsSummary: string,
    metrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  hypothesisNote?: string;
  zenMode?: boolean;
}

export const EarthScienceLabView: React.FC<EarthScienceLabViewProps> = ({
  records,
  onDeleteRecord,
  onProceedToAnalysis,
  onRecordExperiment,
  hypothesisNote,
  zenMode,
}) => {
  const activeModuleId = useLabStore((s) => s.activeModuleId);
  const setActiveModule = useLabStore((s) => s.setActiveModule);
  const isSimulating = useLabStore((s) => s.isSimulating);

  const activeMod = useMemo(() => {
    return (
      EARTH_SCIENCE_MODULES.find((m) => m.id === activeModuleId) ??
      EARTH_SCIENCE_MODULES[0]
    );
  }, [activeModuleId]);

  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of activeMod.parameters) init[p.key] = p.defaultValue;
    return init;
  });

  useEffect(() => {
    const init: Record<string, number> = {};
    for (const p of activeMod.parameters) init[p.key] = p.defaultValue;
    setParams(init);
  }, [activeMod]);

  const [simTime, setSimTime] = useState(0);

  useEffect(() => {
    if (!isSimulating) return;
    const id = setInterval(() => {
      setSimTime((t) => Number(((t + 0.5) % 60).toFixed(2)));
    }, 500);
    return () => clearInterval(id);
  }, [isSimulating]);

  const outputs = useMemo(
    () => activeMod.computeStep(params, simTime),
    [activeMod, params, simTime]
  );

  useLabSonification(
    {
      kind: 'earth',
      magnitude: Number(params.magnitude ?? outputs.surfaceTempC ?? 5.5),
    },
    isSimulating
  );

  const telemetryMetrics: TelemetryMetricDescriptor[] = useMemo(() => {
    return activeMod.outputs.map((out) => ({
      id: out.key,
      label: out.label,
      value: outputs[out.key] ?? 0,
      min: 0,
      max: Math.max(10, Math.abs(outputs[out.key] ?? 10) * 1.5),
      unit: out.unit,
      precision: out.precision,
    }));
  }, [activeMod, outputs]);

  const handleRecordSample = () => {
    labSound.playClick(760);
    const xKey = activeMod.defaultRegressionAxes.xKey;
    const yKey = activeMod.defaultRegressionAxes.yKey;
    const ySecondKey = activeMod.outputs[1]?.key ?? yKey;
    const xVal = params[xKey] ?? 0;
    const y1Val = outputs[yKey] ?? 0;
    const y2Val = outputs[ySecondKey] ?? y1Val;

    const paramSummary = activeMod.parameters
      .map((p) => `${p.label}: ${params[p.key] ?? p.defaultValue} ${p.unit}`.trim())
      .join(' | ');
    const metricsRecord: Record<string, number | string> = {};
    for (const o of activeMod.outputs) {
      metricsRecord[o.key] = Number((outputs[o.key] ?? 0).toFixed(o.precision));
    }

    onRecordExperiment(
      activeMod.title,
      paramSummary,
      metricsRecord,
      `${activeMod.subCategory} · Sampel Kebumian`,
      {
        x: xVal,
        y1: y1Val,
        y2: y2Val,
      }
    );
  };

  const sidebar = (
    <div className="space-y-4 text-xs">
      <div className="space-y-1.5">
        <div className="text-2xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
          <Globe2 className="w-3.5 h-3.5" />
          <span>Modul Ilmu Kebumian</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {EARTH_SCIENCE_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                labSound.playClick(600);
                setActiveModule(m.id);
              }}
              className={`px-2.5 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                m.id === activeMod.id
                  ? 'bg-emerald-600/15 border-emerald-500/60 text-emerald-600 dark:text-emerald-300 font-bold'
                  : 'bg-[var(--comfort-bg)] border-[var(--comfort-border)] hover:border-emerald-500/40'
              }`}
            >
              <div className="truncate">{m.title}</div>
              <div className="text-2xs text-[var(--comfort-text-muted)]">{m.subCategory}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-[var(--comfort-border)]">
        {activeMod.parameters.map((p) => {
          const val = params[p.key] ?? p.defaultValue;
          return (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{p.label}</span>
                <span className="font-mono font-bold text-sky-500 tabular-nums shrink-0">
                  {val} {p.unit}
                </span>
              </div>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={val}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [p.key]: Number(e.target.value) }))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleRecordSample}
          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Catat Data Pengamatan</span>
        </button>
        <button
          type="button"
          onClick={() => {
            labSound.playClick(420);
            const reset: Record<string, number> = {};
            for (const p of activeMod.parameters) reset[p.key] = p.defaultValue;
            setParams(reset);
            setSimTime(0);
          }}
          className="p-2 rounded-xl border border-[var(--comfort-border)] hover:bg-[var(--comfort-surface-muted)] cursor-pointer"
          title="Reset Parameter"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <StandardLabViewShell
      domain="Kebumian"
      recordsCount={records.length}
      hypothesisText={hypothesisNote}
      recentRecords={records}
      onProceedToAnalysis={onProceedToAnalysis}
      onDeleteRecord={onDeleteRecord}
      telemetryMetrics={telemetryMetrics}
      zenMode={zenMode}
      canvas={
        <EarthScienceScene3D
          moduleId={activeMod.id}
          params={params}
          outputs={outputs}
        />
      }
      sidebar={sidebar}
    />
  );
};
