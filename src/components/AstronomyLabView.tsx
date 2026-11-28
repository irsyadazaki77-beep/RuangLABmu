import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  AstronomyParams,
  AcademicLevel,
  calculateAstronomyMetrics,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { LabErrorBoundary } from './common/LabErrorBoundary';
import { labSound } from '../utils/soundEngine';

const AstronomyScene3D = React.lazy(() => import('./AstronomyScene3D'));
import { SpatialCursorPayload } from '../utils/collabProtocol';
import {
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
import { normalizeEducationLevel } from '../utils/pedagogicalHelpers';
import { useTimelineRecorder } from '../hooks/useTimelineRecorder';
import { DualRealityLabViewport } from './ui/DualRealityLabViewport';
import { PrecisionSlider } from './controls/PrecisionSlider';
import { filterRecordsForModule } from '../utils/spatialHudHelpers';
import { LabSidebarActionHeader } from './layout/LabSidebarActionHeader';
import { LabSceneFallback } from './three/LabSceneFallback';
import { AstronomyParameterPanel } from './labs/AstronomyParameterPanel';
import { LabPresetAndSweepBar } from './labs/LabPresetAndSweepBar';
import {
  generateAutoSweepSeries,
  getAstronomyPresetsForMode,
} from '../utils/labScenarioPresets';

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
      case 'planetary-atmosphere-greenhouse':
        return { ...base, greenhouseGasPpm: Math.min(2000, (base.greenhouseGasPpm ?? 420) + 450) };
      case 'doppler-redshift-binary':
        return {
          ...base,
          binaryInclinationDeg: (base.binaryInclinationDeg ?? 75) > 50 ? 25 : 85,
        };
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
      : params.mode === 'planetary-atmosphere-greenhouse'
      ? [
          { id: 'tsurf', label: 'Suhu Permukaan (Ts)', value: metrics.surfaceTempK ?? 288.4, min: 150, max: 500, unit: 'K', color: '#38bdf8' },
          { id: 'teq', label: 'Suhu Ekuilibrium (Teq)', value: metrics.equilibriumTempK ?? 254.9, min: 150, max: 400, unit: 'K', color: '#10b981' },
          { id: 'dgh', label: 'Efek Rumah Kaca (ΔT)', value: metrics.greenhouseWarmingDeltaK ?? 33.5, min: 0, max: 120, unit: 'K', color: '#f59e0b' },
        ]
      : params.mode === 'doppler-redshift-binary'
      ? [
          { id: 'k1', label: 'Kec. Radial K₁', value: metrics.binaryRadialVel1Kms ?? 17.7, min: 0, max: 120, unit: 'km/s', color: '#38bdf8' },
          { id: 'dl', label: 'Geseran H-α (Δλ)', value: metrics.binaryMaxDopplerShiftNm ?? 0.0387, min: 0, max: 0.3, unit: 'nm', color: '#10b981' },
          { id: 'pbin', label: 'Periode Biner (P)', value: metrics.binaryPeriodDays ?? 61.6, min: 0, max: 600, unit: 'hari', color: '#f59e0b' },
        ]
      : [
          { id: 'period', label: 'Periode Orbit (T)', value: metrics.orbitalPeriodYears, min: 0, max: 165, unit: 'Tahun', color: '#38bdf8' },
          { id: 'speed', label: 'Kecepatan Orbit', value: metrics.meanOrbitalVelocityKms, min: 0, max: 60, unit: 'km/s', color: '#10b981' },
          { id: 'ratio', label: 'Rasio a³/T²', value: metrics.keplerRatioT2OverA3, min: 0, max: 2, unit: '', color: '#f59e0b' },
        ];

  useTimelineRecorder<AstronomyParams, { primary: number; secondary: number }>({
    domain: 'astronomy',
    simTime,
    simTimeRef,
    isPlaying,
    params,
    stateSnapshot: {
      primary: telemetryMetrics[0]?.value ?? metrics.orbitalPeriodYears,
      secondary: telemetryMetrics[1]?.value ?? metrics.meanOrbitalVelocityKms,
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
    'planetary-atmosphere-greenhouse': 'planetary-atmosphere-greenhouse',
    'doppler-redshift-binary': 'doppler-redshift-binary',
  };
  const moduleRecords = filterRecordsForModule(records, 'Astronomi', modeToCatalogId[params.mode]);

  const scenarioPresets = useMemo(
    () => getAstronomyPresetsForMode(params.mode),
    [params.mode]
  );
  const sweepSteps = useMemo(
    () => generateAutoSweepSeries('Astronomi', params.mode, 5),
    [params.mode]
  );

  const handleRecordTrial = (overrideParams?: AstronomyParams, noteOverride?: string) => {
    const p = overrideParams ?? params;
    const m = overrideParams ? calculateAstronomyMetrics(overrideParams) : metrics;
    labSound.playRecordSuccess();
    const title =
      p.mode === 'solar-kepler'
        ? `Orbit Kepler: ${p.selectedPlanetId || 'Planet'}`
        : p.mode === 'milkyway-galaxy'
        ? 'Rotasi Galaksi Bima Sakti'
        : p.mode === 'stellar-exoplanet'
        ? 'Transit Eksoplanet & Kurva Cahaya'
        : p.mode === 'stellar-wien-spectrum'
        ? 'Spektrum Benda Hitam & Hukum Wien'
        : p.mode === 'planetary-atmosphere-greenhouse'
        ? 'Atmosfer Planet, Albedo & Efek Rumah Kaca'
        : p.mode === 'doppler-redshift-binary'
        ? 'Bintang Biner Spektroskopik & Doppler H-α'
        : 'Ekspansi Kosmik & Hukum Hubble';

    let pSum = `a=${p.customSemiMajorAxisAu} AU, e=${p.customEccentricity}, T=${m.orbitalPeriodYears} thn`;
    let numX = Number(Math.pow(p.customSemiMajorAxisAu, 3).toFixed(3));
    let numY1 = Number(Math.pow(m.orbitalPeriodYears, 2).toFixed(3));

    if (p.mode === 'milkyway-galaxy') {
      pSum = `R=${p.galactocentricRadiusKpc} kpc, DM=${p.darkMatterHaloFraction}`;
      numX = p.galactocentricRadiusKpc;
      numY1 = m.observedDarkMatterVelocityKms;
    } else if (p.mode === 'stellar-exoplanet') {
      pSum = `Rp=${p.exoplanetRadiusEarth} R⊕, R*=${p.starRadiusSolar} R☉`;
      numX = p.exoplanetRadiusEarth;
      numY1 = m.transitDepthPct;
    } else if (p.mode === 'stellar-wien-spectrum') {
      pSum = `T*=${p.starEffectiveTempK} K, Kelas=${m.spectralClass}`;
      numX = p.starEffectiveTempK;
      numY1 = m.wienPeakWavelengthNm ?? m.peakWavelengthNm ?? 500;
    } else if (p.mode === 'hubble-expansion') {
      pSum = `d=${p.galaxyDistanceMpc ?? 120} Mpc, H₀=${p.hubbleConstantH0 ?? 70} km/s/Mpc`;
      numX = p.galaxyDistanceMpc ?? 120;
      numY1 = m.hubbleRecessionVelocityKmS ?? m.recessionVelocityKms ?? 8400;
    } else if (p.mode === 'planetary-atmosphere-greenhouse') {
      pSum = `A=${p.planetaryAlbedo ?? 0.30}, CO₂=${p.greenhouseGasPpm ?? 420} ppm, S=${p.stellarFluxFactor ?? 1.0} S₀`;
      numX = p.greenhouseGasPpm ?? 420;
      numY1 = m.surfaceTempK ?? 288.4;
    } else if (p.mode === 'doppler-redshift-binary') {
      pSum = `M₁=${p.binaryMass1Solar ?? 2.2}M☉, M₂=${p.binaryMass2Solar ?? 1.0}M☉, a=${p.binarySeparationAu ?? 0.45}AU, i=${p.binaryInclinationDeg ?? 75}°`;
      numX = p.binaryInclinationDeg ?? 75;
      numY1 = m.binaryRadialVel1Kms ?? 17.7;
    }

    const recordMetrics: Record<string, number | string> =
      p.mode === 'doppler-redshift-binary'
        ? {
            'Kec. Radial K₁': `${m.binaryRadialVel1Kms ?? 17.7} km/s`,
            'Geseran H-α (Δλ)': `${m.binaryMaxDopplerShiftNm ?? 0.0387} nm`,
            'Periode Biner (P)': `${m.binaryPeriodDays ?? 61.6} hari`,
          }
        : {
            'Periode Orbit (T)': `${m.orbitalPeriodYears} Tahun`,
            'Kecepatan Orbit': `${m.meanOrbitalVelocityKms} km/s`,
            'Rasio Kepler a³/T²': m.keplerRatioT2OverA3,
          };

    onRecordExperiment(
      title,
      pSum,
      recordMetrics,
      noteOverride ?? (hypothesisNote?.hypothesisText || ''),
      {
        x: numX,
        y1: numY1,
        y2: p.mode === 'doppler-redshift-binary' ? (m.binaryMaxDopplerShiftNm ?? 0.0387) : m.meanOrbitalVelocityKms,
      }
    );
  };

  return (
    <StandardLabViewShell
      domain="Astronomi"
      recordsCount={moduleRecords.length}
      hypothesisText={hypothesisNote?.hypothesisText}
      recentRecords={moduleRecords}
      onProceedToAnalysis={onProceedToAnalysis}
      onDeleteRecord={onDeleteRecord}
      onBackToPreLab={() => useLabStore.getState().setWorkflowStep(1)}
      telemetryMetrics={telemetryMetrics}
      oscilloscope={(() => {
        const modeHint = (() => {
          switch (params.mode) {
            case 'planetary-atmosphere-greenhouse':
              return {
                label: `Neraca Termal: Teq = ${(metrics.equilibriumTempK ?? 254.9).toFixed(1)} K · ΔT_GH = +${(metrics.greenhouseWarmingDeltaK ?? 33.5).toFixed(1)} K`,
                detail: `Albedo A = ${(params.planetaryAlbedo ?? 0.3).toFixed(2)} memantulkan sebagian fluks surya; CO₂ (${params.greenhouseGasPpm ?? 420} ppm) memerangkap radiasi inframerah.`,
              };
            case 'milkyway-galaxy':
              return {
                label: `Kurva Rotasi: v_obs = ${metrics.observedDarkMatterVelocityKms} km/s vs Kepler ${metrics.keplerianVelocityKms} km/s`,
                detail: `Halo materi gelap menjaga kecepatan rotasi galaksi tetap datar pada radius besar.`,
              };
            case 'stellar-exoplanet':
              return {
                label: `Transit Fotometri: Kedalaman = ${metrics.transitDepthPct}% (${metrics.transitDepthPpm} ppm)`,
                detail: `Penurunan fluks bintang sebanding dengan kuadrat rasio jejari planet terhadap bintang (Rp/R*)².`,
              };
            case 'stellar-wien-spectrum':
              return {
                label: `Hukum Wien: λmax = ${metrics.wienPeakWavelengthNm ?? metrics.peakWavelengthNm ?? 502} nm · T = ${params.starEffectiveTempK} K`,
                detail: `Semakin panas fotosfer bintang, puncak spektrum radiasi benda hitam bergeser ke panjang gelombang lebih pendek.`,
              };
            case 'hubble-expansion':
              return {
                label: `Hukum Hubble: v = ${metrics.hubbleRecessionVelocityKmS ?? 8400} km/s · z = ${(metrics.hubbleRedshiftZ ?? 0.028).toFixed(3)}`,
                detail: `Kecepatan resesi galaksi berbanding lurus dengan jarak kosmologisnya (v = H₀ · d).`,
              };
            case 'doppler-redshift-binary':
              return {
                label: `Biner Spektroskopik: K₁ = ${(metrics.binaryRadialVel1Kms ?? 17.7).toFixed(2)} km/s · Δλ = ${(metrics.binaryMaxDopplerShiftNm ?? 0.0387).toFixed(4)} nm`,
                detail: `Garis H-α (656,28 nm) terpecah menjadi komponen blueshift dan redshift seiring kedua bintang mengorbit barisenter.`,
              };
            default:
              return {
                label: `Orbit Ke-3 Kepler: a³ = ${Math.pow(params.customSemiMajorAxisAu, 3).toFixed(2)} AU³, T² = ${Math.pow(metrics.orbitalPeriodYears, 2).toFixed(2)} thn²`,
                detail: `Gravitasi sentripetal menyeimbangkan kecepatan orbit planet.`,
              };
          }
        })();
        return {
          primaryLabel: telemetryMetrics[0].label,
          primaryValue: telemetryMetrics[0].value,
          primaryUnit: telemetryMetrics[0].unit,
          secondaryLabel: telemetryMetrics[1].label,
          secondaryValue: telemetryMetrics[1].value,
          secondaryUnit: telemetryMetrics[1].unit,
          microscopicStateLabel: modeHint.label,
          microscopicDetail: modeHint.detail,
          accentColor: '#38bdf8',
        };
      })()}
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
              case 'planetary-atmosphere-greenhouse': {
                const deltaTs = (metricsB.surfaceTempK ?? 0) - (metrics.surfaceTempK ?? 0);
                return {
                  key: 'greenhouseGasPpm' as const,
                  label: 'Konsentrasi CO₂ (B)',
                  unit: 'ppm',
                  min: 100,
                  max: 2000,
                  step: 20,
                  valB: realityBParams.greenhouseGasPpm ?? 870,
                  summaryA: `CO₂=${params.greenhouseGasPpm ?? 420}ppm · Ts=${metrics.surfaceTempK}K`,
                  summaryB: `CO₂=${realityBParams.greenhouseGasPpm ?? 870}ppm · Ts=${metricsB.surfaceTempK}K`,
                  delta: `ΔTs = ${(deltaTs >= 0 ? '+' : '')}${deltaTs.toFixed(1)} K`,
                };
              }
              case 'doppler-redshift-binary': {
                const deltaK = (metricsB.binaryRadialVel1Kms ?? 0) - (metrics.binaryRadialVel1Kms ?? 0);
                return {
                  key: 'binaryInclinationDeg' as const,
                  label: 'Inklinasi Orbit i (B)',
                  unit: '°',
                  min: 5,
                  max: 90,
                  step: 5,
                  valB: realityBParams.binaryInclinationDeg ?? 25,
                  summaryA: `i=${params.binaryInclinationDeg ?? 75}° · K₁=${metrics.binaryRadialVel1Kms}km/s`,
                  summaryB: `i=${realityBParams.binaryInclinationDeg ?? 25}° · K₁=${metricsB.binaryRadialVel1Kms}km/s`,
                  delta: `ΔK₁ = ${(deltaK >= 0 ? '+' : '')}${deltaK.toFixed(2)} km/s`,
                };
              }
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
              onRecordComparison={() => {
                handleRecordTrial(params, '[Komparasi A · Kontrol]');
                handleRecordTrial(realityBParams, '[Komparasi B · Uji Variabel]');
              }}
              onClose={() => setIsDualRealityMode(false)}
              realityBControls={
                <div className="w-full min-w-[240px]">
                  <PrecisionSlider
                    compact
                    syncToLiveFormula={false}
                    accentColor="amber"
                    label={astroVar.label}
                    unit={astroVar.unit}
                    min={astroVar.min}
                    max={astroVar.max}
                    step={astroVar.step}
                    value={astroVar.valB}
                    defaultValue={
                      astroVar.key === 'darkMatterHaloFraction'
                        ? params.darkMatterHaloFraction
                        : astroVar.key === 'exoplanetRadiusEarth'
                        ? params.exoplanetRadiusEarth
                        : astroVar.key === 'starEffectiveTempK'
                        ? params.starEffectiveTempK
                        : astroVar.key === 'galaxyDistanceMpc'
                        ? params.galaxyDistanceMpc ?? 120
                        : astroVar.key === 'greenhouseGasPpm'
                        ? params.greenhouseGasPpm ?? 420
                        : astroVar.key === 'binaryInclinationDeg'
                        ? params.binaryInclinationDeg ?? 75
                        : params.customSemiMajorAxisAu
                    }
                    onChange={(nextVal) =>
                      setRealityBParams((prev) => ({ ...prev, [astroVar.key]: nextVal }))
                    }
                  />
                </div>
              }
              renderViewport={(side, syncProps) => (
                <LabErrorBoundary domain="Astronomi" sceneName={`AstronomyScene3D-${side}`}>
                  <Suspense
                    fallback={
                      <LabSceneFallback compact label={`Menyiapkan Realitas ${side}...`} />
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
                </LabErrorBoundary>
              )}
            />
          );
        })() : undefined
      }
      topOverlay={
        focusedPlanetBadge ? (
          <div className="px-3 py-1.5 rounded-xl studio-hud-surface border border-sky-500/45 text-[var(--comfort-hud-text)] text-xs font-mono font-bold shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>
              Fokus Planet: {focusedPlanetBadge} (v = {metrics.meanOrbitalVelocityKms} km/s)
            </span>
          </div>
        ) : null
      }
      canvas={
        <LabErrorBoundary domain="Astronomi" sceneName="AstronomyScene3D">
          <Suspense fallback={<LabSceneFallback accentColor="sky" />}>
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
          <LabSidebarActionHeader
            recordsCount={moduleRecords.length}
            accentColor="sky"
            onRecordTrial={handleRecordTrial}
            onProceedToAnalysis={onProceedToAnalysis}
          />

          <div className="space-y-1.5">
            <label className="text-2xs font-bold text-[var(--comfort-text-muted)] uppercase tracking-wider">
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
              className="w-full text-xs p-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-semibold"
            >
              <option value="solar-kepler">Hukum-Hukum Orbit Kepler &amp; Tata Surya</option>
              <option value="milkyway-galaxy">Rotasi Galaksi Bima Sakti &amp; Materi Gelap</option>
              <option value="stellar-exoplanet">Transit Eksoplanet &amp; Kurva Cahaya</option>
              <option value="stellar-wien-spectrum">Hukum Wien &amp; Radiasi Benda Hitam</option>
              <option value="hubble-expansion">Ekspansi Alam Semesta &amp; Hukum Hubble</option>
              <option value="planetary-atmosphere-greenhouse">Atmosfer Planet, Albedo &amp; Efek Rumah Kaca</option>
              <option value="doppler-redshift-binary">Bintang Biner Spektroskopik &amp; Pergeseran Doppler</option>
            </select>
          </div>

          <LabPresetAndSweepBar
            presets={scenarioPresets}
            sweepSteps={sweepSteps}
            accentColor="sky"
            currentParams={params as unknown as Record<string, unknown>}
            onApplyPreset={(preset) => handleParamPatch(preset.patch)}
            onSweepStep={(step) => {
              const nextParams = { ...params, ...(step.patch as Partial<AstronomyParams>) };
              onChangeParams(nextParams);
              handleRecordTrial(nextParams, step.label);
            }}
          />

          <AstronomyParameterPanel
            params={params}
            educationLevel={effectiveEducationLevel}
            onParamPatch={handleParamPatch}
            onFocusPlanet={setFocusedPlanetBadge}
          />

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
