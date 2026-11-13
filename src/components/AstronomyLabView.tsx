import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
  Camera,
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
import { LabErrorBoundary } from './common/LabErrorBoundary';
import { labSound } from '../utils/soundEngine';

const AstronomyScene3D = React.lazy(() => import('./AstronomyScene3D'));
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
import { useLabStore } from '../stores/useLabStore';
import {
  getAstronomyParameterFeedback,
  normalizeEducationLevel,
} from '../utils/pedagogicalHelpers';
import { useTimelineRecorder } from '../hooks/useTimelineRecorder';
import { DualRealityLabViewport } from './ui/DualRealityLabViewport';

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
  academicLevel?: AcademicLevel | string;
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
  academicLevel,
  records = [],
  onDeleteRecord,
  onProceedToAnalysis,
  remoteCursors,
  onEmitCursor,
  hypothesisNote,
  zenMode = false,
  onCapture3DSnapshot,
  snapshotCount = 0,
}) => {
  const storeAcademicLevel = useLabStore((s) => s.academicLevel);
  const playbackSpeed = useLabStore((s) => s.playbackSpeed);
  const isTimeTraveling = useLabStore((s) => s.isTimeTraveling);
  const effectiveEducationLevel = normalizeEducationLevel(
    academicLevel ?? storeAcademicLevel
  );
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('isometric');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [focusedPlanetBadge, setFocusedPlanetBadge] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const simTimeRef = useRef<number>(0);
  const [isDualRealityMode, setIsDualRealityMode] = useState<boolean>(false);

  const buildInitialRealityB = (base: AstronomyParams): AstronomyParams => {
    switch (base.mode) {
      case 'milkyway-galaxy':
        return { ...base, darkMatterHaloFraction: 0 };
      case 'stellar-exoplanet':
        return { ...base, exoplanetRadiusEarth: Math.min(15, Number((base.exoplanetRadiusEarth * 2).toFixed(1))) };
      case 'stellar-wien-spectrum':
        return { ...base, starEffectiveTempK: Math.min(30000, base.starEffectiveTempK + 6000) };
      case 'hubble-expansion':
        return { ...base, galaxyDistanceMpc: Math.min(600, (base.galaxyDistanceMpc ?? 120) + 180) };
      default:
        return { ...base, customSemiMajorAxisAu: Math.min(30, Number((base.customSemiMajorAxisAu * 1.8).toFixed(1))) };
    }
  };

  const [realityBParams, setRealityBParams] = useState<AstronomyParams>(() => buildInitialRealityB(params));
  const prevAstroModeRef = useRef(params.mode);
  useEffect(() => {
    if (prevAstroModeRef.current !== params.mode) {
      prevAstroModeRef.current = params.mode;
      setRealityBParams(buildInitialRealityB(params));
    }
  }, [params]);

  const metrics = calculateAstronomyMetrics(params);
  const metricsB = calculateAstronomyMetrics(realityBParams);

  useTimelineRecorder<AstronomyParams, { orbitalPeriodYears: number; meanOrbitalVelocityKms: number }>({
    domain: 'astronomy',
    simTime,
    simTimeRef,
    isPlaying,
    params,
    stateSnapshot: {
      orbitalPeriodYears: metrics.orbitalPeriodYears,
      meanOrbitalVelocityKms: metrics.meanOrbitalVelocityKms,
    },
    onRestoreFrame: (frame) => {
      setIsPlaying(false);
      simTimeRef.current = frame.simTime;
      setSimTime(frame.simTime);
      onChangeParams(frame.parameters);
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

  const handleParamPatch = (patch: Partial<AstronomyParams>) => {
    onChangeParams((prev) => ({ ...prev, ...patch }));
  };

  const modeToCatalogId: Record<string, string> = {
    'solar-kepler': 'solar-kepler',
    'milkyway-galaxy': 'milky-way-rotation',
    'stellar-exoplanet': 'exoplanet-transit',
    'stellar-wien-spectrum': 'stellar-wien-spectrum',
    'hubble-expansion': 'hubble-expansion',
  };

  const handleRecordTrial = () => {
    labSound.playRecordSuccess();
    const title =
      params.mode === 'solar-kepler'
        ? `Orbit Kepler: ${params.selectedPlanetId || 'Planet'}`
        : params.mode === 'milkyway-galaxy'
        ? 'Rotasi Galaksi Bima Sakti'
        : params.mode === 'stellar-exoplanet'
        ? 'Transit Eksoplanet & Kurva Cahaya'
        : params.mode === 'stellar-wien-spectrum'
        ? 'Spektrum Benda Hitam & Hukum Wien'
        : 'Ekspansi Kosmik & Hukum Hubble';

    let pSum = `a=${params.customSemiMajorAxisAu} AU, e=${params.customEccentricity}, T=${metrics.orbitalPeriodYears} thn`;
    let numX = Number(Math.pow(params.customSemiMajorAxisAu, 3).toFixed(3));
    let numY1 = Number(Math.pow(metrics.orbitalPeriodYears, 2).toFixed(3));

    if (params.mode === 'milkyway-galaxy') {
      pSum = `R=${params.galactocentricRadiusKpc} kpc, DM=${params.darkMatterHaloFraction}`;
      numX = params.galactocentricRadiusKpc;
      numY1 = metrics.observedDarkMatterVelocityKms;
    } else if (params.mode === 'stellar-exoplanet') {
      pSum = `Rp=${params.exoplanetRadiusEarth} R⊕, R*=${params.starRadiusSolar} R☉`;
      numX = params.exoplanetRadiusEarth;
      numY1 = metrics.transitDepthPct;
    } else if (params.mode === 'stellar-wien-spectrum') {
      pSum = `T*=${params.starEffectiveTempK} K, Kelas=${metrics.spectralClass}`;
      numX = params.starEffectiveTempK;
      numY1 = metrics.wienPeakWavelengthNm ?? metrics.peakWavelengthNm ?? 500;
    } else if (params.mode === 'hubble-expansion') {
      pSum = `d=${params.galaxyDistanceMpc ?? 120} Mpc, H₀=${params.hubbleConstantH0 ?? 70} km/s/Mpc`;
      numX = params.galaxyDistanceMpc ?? 120;
      numY1 = metrics.hubbleRecessionVelocityKmS ?? metrics.recessionVelocityKms ?? 8400;
    }

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

  const telemetryMetrics =
    params.mode === 'milkyway-galaxy'
      ? [
          { id: 'vobs', label: 'Kecepatan Rotasi', value: metrics.observedDarkMatterVelocityKms, min: 0, max: 350, unit: 'km/s', color: '#38bdf8' },
          { id: 'vkep', label: 'Prediksi Kepler', value: metrics.keplerianVelocityKms, min: 0, max: 350, unit: 'km/s', color: '#10b981' },
          { id: 'rkpc', label: 'Radius Galaksi (R)', value: params.galactocentricRadiusKpc, min: 0.5, max: 25, unit: 'kpc', color: '#f59e0b' },
        ]
      : params.mode === 'stellar-exoplanet'
      ? [
          { id: 'depth', label: 'Kedalaman Transit', value: metrics.transitDepthPct, min: 0, max: 5, unit: '%', color: '#38bdf8' },
          { id: 'ppm', label: 'Redupan Fluks', value: metrics.transitDepthPpm, min: 0, max: 50000, unit: 'ppm', color: '#10b981' },
          { id: 'rp', label: 'Radius Eksoplanet', value: params.exoplanetRadiusEarth, min: 0.5, max: 15, unit: 'R⊕', color: '#f59e0b' },
        ]
      : params.mode === 'stellar-wien-spectrum'
      ? [
          { id: 'wien', label: 'Puncak Wien (λmax)', value: metrics.wienPeakWavelengthNm ?? metrics.peakWavelengthNm ?? 502, min: 80, max: 1100, unit: 'nm', color: '#38bdf8' },
          { id: 'teff', label: 'Suhu Fotosfer (T)', value: params.starEffectiveTempK, min: 2500, max: 30000, unit: 'K', color: '#10b981' },
          { id: 'lum', label: 'Luminositas (L)', value: metrics.stellarLuminositySolar, min: 0, max: 100, unit: 'L☉', color: '#f59e0b' },
        ]
      : params.mode === 'hubble-expansion'
      ? [
          { id: 'vrec', label: 'Kecepatan Resesi (v)', value: metrics.hubbleRecessionVelocityKmS ?? metrics.recessionVelocityKms ?? 8400, min: 0, max: 45000, unit: 'km/s', color: '#38bdf8' },
          { id: 'zred', label: 'Redshift Kosmik (z)', value: metrics.hubbleRedshiftZ ?? metrics.redshiftZ ?? 0.028, min: 0, max: 0.2, unit: 'z', color: '#10b981' },
          { id: 'dmpc', label: 'Jarak Galaksi (d)', value: params.galaxyDistanceMpc ?? 120, min: 20, max: 600, unit: 'Mpc', color: '#f59e0b' },
        ]
      : [
          { id: 'period', label: 'Periode Orbit (T)', value: metrics.orbitalPeriodYears, min: 0, max: 165, unit: 'Tahun', color: '#38bdf8' },
          { id: 'speed', label: 'Kecepatan Orbit', value: metrics.meanOrbitalVelocityKms, min: 0, max: 60, unit: 'km/s', color: '#10b981' },
          { id: 'ratio', label: 'Rasio a³/T²', value: metrics.keplerRatioT2OverA3, min: 0, max: 2, unit: '', color: '#f59e0b' },
        ];

  return (
    <StandardLabViewShell
      domain="Astronomi"
      recordsCount={records.length}
      hypothesisText={hypothesisNote?.hypothesisText}
      recentRecords={records}
      onProceedToAnalysis={onProceedToAnalysis}
      onDeleteRecord={onDeleteRecord}
      onBackToPreLab={() => useLabStore.getState().setWorkflowStep(1)}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={{
        primaryLabel: telemetryMetrics[0].label,
        primaryValue: telemetryMetrics[0].value,
        primaryUnit: telemetryMetrics[0].unit,
        secondaryLabel: telemetryMetrics[1].label,
        secondaryValue: telemetryMetrics[1].value,
        secondaryUnit: telemetryMetrics[1].unit,
        microscopicStateLabel: `Orbit Ke-3 Kepler: a³ = ${(Math.pow(params.customSemiMajorAxisAu, 3)).toFixed(2)} AU³, T² = ${(Math.pow(metrics.orbitalPeriodYears, 2)).toFixed(2)} thn²`,
        microscopicDetail: `Gravitasi sentripetal menyeimbangkan kecepatan orbit planet.`,
        accentColor: '#38bdf8',
      }}
      shutterFlash={shutterFlash}
      zenMode={zenMode}
      activeCameraPreset={activeCameraPreset}
      onSelectCameraPreset={setActiveCameraPreset}
      dualModeActive={isDualRealityMode}
      onToggleDualMode={() => setIsDualRealityMode((prev) => !prev)}
      dualViewport={
        isDualRealityMode ? (() => {
          const astroVar = (() => {
            switch (params.mode) {
              case 'milkyway-galaxy':
                return {
                  key: 'darkMatterHaloFraction' as const,
                  label: 'Materi Gelap (B)',
                  unit: '×',
                  min: 0,
                  max: 1.5,
                  step: 0.1,
                  valB: realityBParams.darkMatterHaloFraction,
                  summaryA: `DM=${params.darkMatterHaloFraction}× · v=${metrics.observedDarkMatterVelocityKms}km/s`,
                  summaryB: `DM=${realityBParams.darkMatterHaloFraction}× · v=${metricsB.observedDarkMatterVelocityKms}km/s`,
                  delta: `Δv = ${(metricsB.observedDarkMatterVelocityKms - metrics.observedDarkMatterVelocityKms >= 0 ? '+' : '')}${(metricsB.observedDarkMatterVelocityKms - metrics.observedDarkMatterVelocityKms).toFixed(1)} km/s`,
                };
              case 'stellar-exoplanet':
                return {
                  key: 'exoplanetRadiusEarth' as const,
                  label: 'Radius Rp (B)',
                  unit: 'R⊕',
                  min: 0.5,
                  max: 15,
                  step: 0.5,
                  valB: realityBParams.exoplanetRadiusEarth,
                  summaryA: `Rp=${params.exoplanetRadiusEarth}R⊕ · Depth=${metrics.transitDepthPct}%`,
                  summaryB: `Rp=${realityBParams.exoplanetRadiusEarth}R⊕ · Depth=${metricsB.transitDepthPct}%`,
                  delta: `ΔDepth = ${(metricsB.transitDepthPct - metrics.transitDepthPct >= 0 ? '+' : '')}${(metricsB.transitDepthPct - metrics.transitDepthPct).toFixed(2)}%`,
                };
              case 'stellar-wien-spectrum':
                return {
                  key: 'starEffectiveTempK' as const,
                  label: 'Suhu T* (B)',
                  unit: 'K',
                  min: 2800,
                  max: 30000,
                  step: 200,
                  valB: realityBParams.starEffectiveTempK,
                  summaryA: `T*=${params.starEffectiveTempK}K · λmax=${metrics.wienPeakWavelengthNm ?? 502}nm`,
                  summaryB: `T*=${realityBParams.starEffectiveTempK}K · λmax=${metricsB.wienPeakWavelengthNm ?? 502}nm`,
                  delta: `Δλ = ${((metricsB.wienPeakWavelengthNm ?? 0) - (metrics.wienPeakWavelengthNm ?? 0) >= 0 ? '+' : '')}${((metricsB.wienPeakWavelengthNm ?? 0) - (metrics.wienPeakWavelengthNm ?? 0)).toFixed(0)} nm`,
                };
              case 'hubble-expansion':
                return {
                  key: 'galaxyDistanceMpc' as const,
                  label: 'Jarak d (B)',
                  unit: 'Mpc',
                  min: 20,
                  max: 600,
                  step: 10,
                  valB: realityBParams.galaxyDistanceMpc ?? 120,
                  summaryA: `d=${params.galaxyDistanceMpc ?? 120}Mpc · v=${metrics.hubbleRecessionVelocityKmS ?? 8400}km/s`,
                  summaryB: `d=${realityBParams.galaxyDistanceMpc ?? 120}Mpc · v=${metricsB.hubbleRecessionVelocityKmS ?? 8400}km/s`,
                  delta: `Δv = ${((metricsB.hubbleRecessionVelocityKmS ?? 0) - (metrics.hubbleRecessionVelocityKmS ?? 0) >= 0 ? '+' : '')}${((metricsB.hubbleRecessionVelocityKmS ?? 0) - (metrics.hubbleRecessionVelocityKmS ?? 0)).toFixed(0)} km/s`,
                };
              default:
                return {
                  key: 'customSemiMajorAxisAu' as const,
                  label: 'Semi-Mayor a (B)',
                  unit: 'AU',
                  min: 0.2,
                  max: 30,
                  step: 0.1,
                  valB: realityBParams.customSemiMajorAxisAu,
                  summaryA: `a=${params.customSemiMajorAxisAu}AU · T=${metrics.orbitalPeriodYears}thn`,
                  summaryB: `a=${realityBParams.customSemiMajorAxisAu}AU · T=${metricsB.orbitalPeriodYears}thn`,
                  delta: `ΔT = ${(metricsB.orbitalPeriodYears - metrics.orbitalPeriodYears >= 0 ? '+' : '')}${(metricsB.orbitalPeriodYears - metrics.orbitalPeriodYears).toFixed(2)} thn`,
                };
            }
          })();

          return (
            <DualRealityLabViewport
              domain="Astronomi"
              moduleTitle={params.mode}
              realityASummary={astroVar.summaryA}
              realityBSummary={astroVar.summaryB}
              deltaSummary={astroVar.delta}
              onResetBToMatchA={() => setRealityBParams({ ...params })}
              onClose={() => setIsDualRealityMode(false)}
              realityBControls={
                <div className="w-full flex items-center justify-between gap-3">
                  <span className="font-semibold text-amber-300 shrink-0">
                    {astroVar.label}:{' '}
                    <strong className="font-mono">
                      {astroVar.valB} {astroVar.unit}
                    </strong>
                  </span>
                  <input
                    type="range"
                    aria-label={astroVar.label}
                    min={astroVar.min}
                    max={astroVar.max}
                    step={astroVar.step}
                    value={astroVar.valB}
                    onChange={(e) => {
                      const nextVal = Number(e.target.value);
                      setRealityBParams((prev) => ({ ...prev, [astroVar.key]: nextVal }));
                    }}
                    className="flex-1 max-w-[220px] accent-amber-400 cursor-pointer"
                  />
                </div>
              }
              renderViewport={(side, syncProps) => (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-xs font-mono text-sky-300">
                      Menyiapkan Realitas {side}...
                    </div>
                  }
                >
                  <AstronomyScene3D
                    params={side === 'A' ? params : realityBParams}
                    metrics={side === 'A' ? metrics : metricsB}
                    simTime={simTime}
                    simTimeRef={simTimeRef}
                    cameraSyncPose={syncProps.cameraSyncPose}
                    onCameraSyncChange={syncProps.onCameraSyncChange}
                  />
                </Suspense>
              )}
            />
          );
        })() : undefined
      }
      topOverlay={
        focusedPlanetBadge ? (
          <div className="px-3 py-1.5 rounded-xl bg-sky-950/80 backdrop-blur-md border border-sky-500/50 text-sky-200 text-xs font-mono font-bold shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Fokus Planet: {focusedPlanetBadge} (v = {metrics.meanOrbitalVelocityKms} km/s)</span>
          </div>
        ) : null
      }
      canvas={
        <LabErrorBoundary domain="Astronomi" sceneName="AstronomyScene3D">
          <Suspense
            fallback={
              <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 p-6 gap-3">
                <div className="w-9 h-9 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-xs font-mono font-semibold text-sky-300">
                  Menyiapkan Ruang Laboratorium 3D...
                </p>
              </div>
            }
          >
            <AstronomyScene3D
              params={params}
              metrics={metrics}
              simTime={simTime}
              simTimeRef={simTimeRef}
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
          </Suspense>
        </LabErrorBoundary>
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
                const nextMode = e.target.value as AstronomyParams['mode'];
                labSound.playClick();
                handleParamPatch({ mode: nextMode });
                if (modeToCatalogId[nextMode]) {
                  useLabStore.getState().setActiveModule(modeToCatalogId[nextMode]);
                }
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

          {/* Planet Presets (for Solar Kepler mode) */}
          {params.mode === 'solar-kepler' && (
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
          )}

          {/* Parameters & Sliders */}
          <CollapsibleLabSection title="Parameter Astrofisika & Orbit" defaultOpen>
            <div className="space-y-3">
              {params.mode === 'milkyway-galaxy' ? (
                <>
                  <TactileParameterControl
                    label="Jarak Galaktosentrik (R)"
                    unit="kpc"
                    value={params.galactocentricRadiusKpc}
                    min={1.0}
                    max={25.0}
                    step={0.5}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'galactocentricRadiusKpc', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ galactocentricRadiusKpc: v })}
                  />
                  <TactileParameterControl
                    label="Fraksi Halo Materi Gelap"
                    unit="×"
                    value={params.darkMatterHaloFraction}
                    min={0}
                    max={1.5}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'darkMatterHaloFraction', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ darkMatterHaloFraction: v })}
                  />
                  <TactileParameterControl
                    label="Faktor Massa Bulge & Disk"
                    unit="×"
                    value={params.bulgeDiskMassFactor}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'bulgeDiskMassFactor', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ bulgeDiskMassFactor: v })}
                  />
                </>
              ) : params.mode === 'stellar-exoplanet' ? (
                <>
                  <TactileParameterControl
                    label="Radius Eksoplanet (Rp)"
                    unit="R⊕"
                    value={params.exoplanetRadiusEarth}
                    min={0.5}
                    max={15.0}
                    step={0.5}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'exoplanetRadiusEarth', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ exoplanetRadiusEarth: v })}
                  />
                  <TactileParameterControl
                    label="Radius Bintang Induk (R*)"
                    unit="R☉"
                    value={params.starRadiusSolar}
                    min={0.2}
                    max={5.0}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'starRadiusSolar', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ starRadiusSolar: v })}
                  />
                  <TactileParameterControl
                    label="Jarak Orbit Eksoplanet"
                    unit="AU"
                    value={params.exoplanetOrbitAu}
                    min={0.05}
                    max={5.0}
                    step={0.05}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'exoplanetOrbitAu', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ exoplanetOrbitAu: v })}
                  />
                </>
              ) : params.mode === 'stellar-wien-spectrum' ? (
                <>
                  <TactileParameterControl
                    paramKey="starEffectiveTempK"
                    label="Suhu Efektif Bintang (T*)"
                    unit="K"
                    value={params.starEffectiveTempK}
                    min={2800}
                    max={30000}
                    step={200}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'starEffectiveTempK', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ starEffectiveTempK: v })}
                  />
                  <TactileParameterControl
                    paramKey="starRadiusSolar"
                    label="Radius Bintang (R*)"
                    unit="R☉"
                    value={params.starRadiusSolar}
                    min={0.2}
                    max={10.0}
                    step={0.2}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'starRadiusSolar', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ starRadiusSolar: v })}
                  />
                </>
              ) : params.mode === 'hubble-expansion' ? (
                <>
                  <TactileParameterControl
                    id="astro-hubble-distance"
                    paramKey="galaxyDistanceMpc"
                    label="Jarak Galaksi Jauh (d)"
                    unit="Mpc"
                    value={params.galaxyDistanceMpc ?? 120}
                    min={20}
                    max={600}
                    step={10}
                    glossaryTerm="Redshift"
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'galaxyDistanceMpc', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ galaxyDistanceMpc: v })}
                  />
                  <TactileParameterControl
                    label="Konstanta Hubble (H₀)"
                    unit="km/s/Mpc"
                    value={params.hubbleConstantH0 ?? 70}
                    min={65}
                    max={78}
                    step={1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'hubbleConstantH0', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ hubbleConstantH0: v })}
                  />
                </>
              ) : (
                <>
                  <TactileParameterControl
                    paramKey="customSemiMajorAxisAu"
                    label="Jarak Semi-Mayor (a)"
                    unit="AU"
                    value={params.customSemiMajorAxisAu}
                    min={0.2}
                    max={30}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'customSemiMajorAxisAu', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ customSemiMajorAxisAu: v })}
                  />

                  <TactileParameterControl
                    id="astro-eccentricity"
                    paramKey="customEccentricity"
                    label="Eksentrisitas Orbit (e)"
                    unit=""
                    value={params.customEccentricity}
                    min={0}
                    max={0.9}
                    step={0.02}
                    glossaryTerm="Eksentrisitas"
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'customEccentricity', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ customEccentricity: v })}
                  />

                  <TactileParameterControl
                    paramKey="centralStarMassSolar"
                    label="Massa Bintang Pusat (M*)"
                    unit="M☉"
                    value={params.centralStarMassSolar}
                    min={0.2}
                    max={5.0}
                    step={0.1}
                    educationLevel={effectiveEducationLevel}
                    dynamicFeedback={(v, lvl) =>
                      getAstronomyParameterFeedback(params.mode, 'centralStarMassSolar', v, lvl)
                    }
                    onChange={(v) => handleParamPatch({ centralStarMassSolar: v })}
                  />
                </>
              )}
            </div>
          </CollapsibleLabSection>

          {/* Interactive Formula Card */}
          <CollapsibleLabSection title="Rumus & Kalkulator Interaktif" defaultOpen={false}>
            <InteractiveFormulaCard
              title="Hukum Astrofisika & Kosmologi"
              tokens={telemetryMetrics.map((tm) => ({
                symbol: tm.label.split(' ')[0],
                value: tm.value,
                unit: tm.unit,
                description: tm.label,
              }))}
            />
          </CollapsibleLabSection>
        </>
      }
    />
  );
};
