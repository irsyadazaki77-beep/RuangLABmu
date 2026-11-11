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
import { useLabStore } from '../stores/useLabStore';

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
                    onChange={(v) => handleParamPatch({ galactocentricRadiusKpc: v })}
                  />
                  <TactileParameterControl
                    label="Fraksi Halo Materi Gelap"
                    unit="×"
                    value={params.darkMatterHaloFraction}
                    min={0}
                    max={1.5}
                    step={0.1}
                    onChange={(v) => handleParamPatch({ darkMatterHaloFraction: v })}
                  />
                  <TactileParameterControl
                    label="Faktor Massa Bulge & Disk"
                    unit="×"
                    value={params.bulgeDiskMassFactor}
                    min={0.5}
                    max={2.0}
                    step={0.1}
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
                    onChange={(v) => handleParamPatch({ exoplanetRadiusEarth: v })}
                  />
                  <TactileParameterControl
                    label="Radius Bintang Induk (R*)"
                    unit="R☉"
                    value={params.starRadiusSolar}
                    min={0.2}
                    max={5.0}
                    step={0.1}
                    onChange={(v) => handleParamPatch({ starRadiusSolar: v })}
                  />
                  <TactileParameterControl
                    label="Jarak Orbit Eksoplanet"
                    unit="AU"
                    value={params.exoplanetOrbitAu}
                    min={0.05}
                    max={5.0}
                    step={0.05}
                    onChange={(v) => handleParamPatch({ exoplanetOrbitAu: v })}
                  />
                </>
              ) : params.mode === 'stellar-wien-spectrum' ? (
                <>
                  <TactileParameterControl
                    label="Suhu Efektif Bintang (T*)"
                    unit="K"
                    value={params.starEffectiveTempK}
                    min={2800}
                    max={30000}
                    step={200}
                    onChange={(v) => handleParamPatch({ starEffectiveTempK: v })}
                  />
                  <TactileParameterControl
                    label="Radius Bintang (R*)"
                    unit="R☉"
                    value={params.starRadiusSolar}
                    min={0.2}
                    max={10.0}
                    step={0.2}
                    onChange={(v) => handleParamPatch({ starRadiusSolar: v })}
                  />
                </>
              ) : params.mode === 'hubble-expansion' ? (
                <>
                  <TactileParameterControl
                    label="Jarak Galaksi Jauh (d)"
                    unit="Mpc"
                    value={params.galaxyDistanceMpc ?? 120}
                    min={20}
                    max={600}
                    step={10}
                    onChange={(v) => handleParamPatch({ galaxyDistanceMpc: v })}
                  />
                  <TactileParameterControl
                    label="Konstanta Hubble (H₀)"
                    unit="km/s/Mpc"
                    value={params.hubbleConstantH0 ?? 70}
                    min={65}
                    max={78}
                    step={1}
                    onChange={(v) => handleParamPatch({ hubbleConstantH0: v })}
                  />
                </>
              ) : (
                <>
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

                  <TactileParameterControl
                    label="Massa Bintang Pusat (M*)"
                    unit="M☉"
                    value={params.centralStarMassSolar}
                    min={0.2}
                    max={5.0}
                    step={0.1}
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
