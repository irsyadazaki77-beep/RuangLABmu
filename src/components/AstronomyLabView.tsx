import React, { useEffect, useState } from 'react';
import {
  Camera,
  Sliders,
  Telescope,
} from 'lucide-react';
import {
  AstronomyParams,
  AcademicLevel,
  calculateAstronomyMetrics,
  SOLAR_PLANET_PRESETS,
  SolarPlanetPreset,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { AstronomyScene3D } from './AstronomyScene3D';
import { labSound } from '../utils/soundEngine';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import {
  TactileParameterControl,
  CollapsibleLabSection,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
} from './ui/InteractiveFormulaCard';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
} from '../utils/mysteryChallengeEngine';
import {
  HypothesisNote,
} from './ui/HypothesisAndCompareDock';
import { StandardLabViewShell } from './layout/StandardLabViewShell';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';

export interface AstronomyLabViewProps {
  params: AstronomyParams;
  onChangeParams: React.Dispatch<React.SetStateAction<AstronomyParams>>;
  onRecordExperiment: (
    title: string,
    paramsSummary: string,
    metrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup?: (summary: string) => void;
  academicLevel?: AcademicLevel;
  records?: ExperimentRecord[];
  activeStudentName?: string;
  activeGroupId?: string;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
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
  onCompleteChallenge?: (challenge: any) => void;
}

export const AstronomyLabView: React.FC<AstronomyLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  academicLevel = 'sma',
  records = [],
  onProceedToAnalysis,
  remoteCursors,
  onEmitCursor,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [focusedPlanetBadge, setFocusedPlanetBadge] = useState<string | null>(null);

  const metrics = calculateAstronomyMetrics(params);

  useEffect(() => {
    const unsubCapture = subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, () => {
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 240);
    });
    return () => unsubCapture();
  }, []);

  const handleParamPatch = (patch: Partial<AstronomyParams>) => {
    onChangeParams((prev) => ({ ...prev, ...patch }));
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    const title =
      params.mode === 'solar-kepler'
        ? `Orbit Kepler: ${params.selectedPlanetId || 'Planet'}`
        : params.mode === 'milkyway-galaxy'
        ? 'Rotasi Galaksi Bima Sakti'
        : 'Transit Eksoplanet & Wien';

    const pSum = `a=${params.customSemiMajorAxisAu} AU, e=${params.customEccentricity}, T=${metrics.orbitalPeriodYears} thn`;
    const numX = Number(Math.pow(params.customSemiMajorAxisAu, 3).toFixed(3));
    const numY1 = Number(Math.pow(metrics.orbitalPeriodYears, 2).toFixed(3));

    onRecordExperiment(
      title,
      pSum,
      {
        'Periode Orbit (T)': `${metrics.orbitalPeriodYears} Tahun`,
        'Kecepatan Orbit': `${metrics.meanOrbitalVelocityKms} km/s`,
        'Rasio Kepler a³/T²': metrics.keplerRatioT2OverA3,
      },
      hypothesisNote?.hypothesisText || '',
      { x: numX, y1: numY1, y2: metrics.meanOrbitalVelocityKms }
    );
  };

  const telemetryMetrics = [
    {
      id: 'period',
      label: 'Periode Orbit (T)',
      value: metrics.orbitalPeriodYears,
      min: 0,
      max: 165,
      unit: 'Tahun',
      color: '#38bdf8',
    },
    {
      id: 'speed',
      label: 'Kecepatan Orbit',
      value: metrics.meanOrbitalVelocityKms,
      min: 0,
      max: 60,
      unit: 'km/s',
      color: '#10b981',
    },
    {
      id: 'ratio',
      label: 'Rasio a³/T²',
      value: metrics.keplerRatioT2OverA3,
      min: 0,
      max: 2,
      unit: '',
      color: '#f59e0b',
    },
  ];

  return (
    <StandardLabViewShell
      domain="Astronomi"
      recordsCount={records.length}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: 'Kecepatan Orbit v(t)',
        primaryValue: metrics.meanOrbitalVelocityKms,
        primaryUnit: 'km/s',
        secondaryLabel: 'Periode T',
        secondaryValue: metrics.orbitalPeriodYears,
        secondaryUnit: 'thn',
        microscopicStateLabel: `Orbit Ke-3 Kepler: a³ = ${(Math.pow(params.customSemiMajorAxisAu, 3)).toFixed(2)} AU³, T² = ${(Math.pow(metrics.orbitalPeriodYears, 2)).toFixed(2)} thn²`,
        microscopicDetail: `Gravitasi sentripetal menyeimbangkan kecepatan orbit planet.`,
        accentColor: '#38bdf8',
      }}
      shutterFlash={shutterFlash}
      zenMode={zenMode}
      activeCameraPreset={activeCameraPreset}
      onSelectCameraPreset={setActiveCameraPreset}
      topOverlay={
        focusedPlanetBadge ? (
          <div className="px-3 py-1.5 rounded-xl bg-sky-950/80 backdrop-blur-md border border-sky-500/50 text-sky-200 text-xs font-mono font-bold shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Fokus Planet: {focusedPlanetBadge} (v = {metrics.meanOrbitalVelocityKms} km/s)</span>
          </div>
        ) : null
      }
      canvas={
        <AstronomyScene3D
          params={params}
          metrics={metrics}
          remoteCursors={remoteCursors}
          onEmitCursor={onEmitCursor}
          onUpdateParam={(key, val) => handleParamPatch({ [key]: val })}
          onPlanetClick={(planetName) => {
            setFocusedPlanetBadge(planetName);
            labSound.playClick(720);
          }}
          snapshotCount={snapshotCount}
          onCaptureSnapshot={(dataUrl) => {
            setShutterFlash(true);
            setTimeout(() => setShutterFlash(false), 240);
            onCapture3DSnapshot?.(
              dataUrl,
              'Orbit Tata Surya & Kepler 3D',
              `Planet: ${params.selectedPlanetId || 'Bumi'}`,
              `v = ${metrics.meanOrbitalVelocityKms} km/s`
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
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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

          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Mode Modul Astronomi:
            </label>
            <select
              value={params.mode}
              onChange={(e) => {
                labSound.playClick();
                handleParamPatch({ mode: e.target.value as any });
              }}
              className="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
            >
              <option value="solar-kepler">Hukum-Hukum Orbit Kepler &amp; Tata Surya</option>
              <option value="milkyway-galaxy">Rotasi Galaksi Bima Sakti &amp; Materi Gelap</option>
              <option value="stellar-exoplanet">Transit Eksoplanet &amp; Kurva Cahaya</option>
              <option value="stellar-wien-spectrum">Hukum Wien &amp; Radiasi Benda Hitam</option>
              <option value="hubble-expansion">Ekspansi Alam Semesta &amp; Hukum Hubble</option>
            </select>
          </div>

          {/* Planet Presets */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider">
              Pilih Benda Langit:
            </span>
            <div className="grid grid-cols-3 gap-1">
              {SOLAR_PLANET_PRESETS.map((planet: SolarPlanetPreset) => (
                <button
                  key={planet.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    handleParamPatch({
                      selectedPlanetId: planet.id,
                      customSemiMajorAxisAu: planet.semiMajorAxisAu,
                      customEccentricity: planet.eccentricity,
                    });
                    setFocusedPlanetBadge(planet.name);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    params.selectedPlanetId === planet.id
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {planet.name}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters & Sliders */}
          <CollapsibleLabSection title="Parameter Orbit & Kepler" defaultOpen>
            <div className="space-y-3">
              <TactileParameterControl
                label="Jarak Semi-Mayor (a)"
                unit="AU"
                value={params.customSemiMajorAxisAu}
                min={0.2}
                max={30}
                step={0.1}
                onChange={(v) => handleParamPatch({ customSemiMajorAxisAu: v })}
              />

              <TactileParameterControl
                label="Eksentrisitas Orbit (e)"
                unit=""
                value={params.customEccentricity}
                min={0}
                max={0.9}
                step={0.02}
                onChange={(v) => handleParamPatch({ customEccentricity: v })}
              />
            </div>
          </CollapsibleLabSection>

          {/* Interactive Formula Card */}
          <InteractiveFormulaCard
            title="Hukum III Kepler (Keharmonisan Orbit)"
            tokens={[
              { symbol: 'T', value: metrics.orbitalPeriodYears, unit: 'thn', description: 'Periode Orbit' },
              { symbol: 'a', value: params.customSemiMajorAxisAu, unit: 'AU', description: 'Sumbu Semi-Mayor' },
              { symbol: 'v', value: metrics.meanOrbitalVelocityKms, unit: 'km/s', description: 'Kecepatan Orbit' },
            ]}
          />
        </>
      }
    />
  );
};
