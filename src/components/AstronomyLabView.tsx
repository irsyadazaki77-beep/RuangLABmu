import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sliders,
  Compass,
} from 'lucide-react';
import {
  AstronomyParams,
  AcademicLevel,
  SOLAR_PLANET_PRESETS,
  calculateAstronomyMetrics,
  generateAutomaticFeedback,
  LabNotification,
  ExperimentRecord,
} from '../utils/scienceEngine';
import { AstronomyScene3D } from './AstronomyScene3D';
import { labSound } from '../utils/soundEngine';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { PreLabSafetyModal } from './PreLabSafetyModal';
import {
  ExperimentModule,
  EducationTier,
  getExperimentsByDomain,
} from '../registry/experimentRegistry';
import {
  CircularGaugeMeter,
  TactileParameterControl,
  AnimatedNumberReadout,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import { FloatingLabAnalyticsDrawer } from './FloatingLabAnalyticsDrawer';

interface AstronomyLabViewProps {
  params: AstronomyParams;
  onChangeParams: React.Dispatch<React.SetStateAction<AstronomyParams>>;
  academicLevel?: AcademicLevel;
  onRecordExperiment: (
    title: string,
    summary: string,
    keyMetrics: Record<string, number | string>,
    notes: string,
    numericCoords?: { x: number; y1: number; y2: number }
  ) => void;
  onPushNotification: (notif: LabNotification) => void;
  onSyncWithGroup: (summary: string) => void;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  records?: ExperimentRecord[];
  activeStudentName?: string;
  activeGroupId?: string;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
}

export const AstronomyLabView: React.FC<AstronomyLabViewProps> = ({
  params,
  onChangeParams,
  academicLevel = 'sma',
  onRecordExperiment,
  onPushNotification,
  remoteCursors,
  onEmitCursor,
  records = [],
  activeStudentName = 'Alya Pratama',
  activeGroupId = 'Kelompok-A1',
  onDeleteRecord,
  onExportCSV,
  onSubmitQuizScore,
  onProceedToAnalysis,
  onBackToCatalog,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const [leftDockCollapsed, setLeftDockCollapsed] = useState<boolean>(false);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  const astronomyModules = getExperimentsByDomain('astronomi');
  const [preLabModalOpen, setPreLabModalOpen] = useState<boolean>(false);
  const [modalExperiment, setModalExperiment] = useState<ExperimentModule>(
    astronomyModules[0]
  );

  const activeTier: EducationTier =
    academicLevel === 'smp'
      ? 'SMP'
      : academicLevel === 'mahasiswa'
      ? 'Mahasiswa'
      : 'SMA';

  const currentAstronomyModuleId =
    params.mode === 'solar-kepler'
      ? 'solar-kepler'
      : params.mode === 'milkyway-galaxy'
      ? 'milky-way-rotation'
      : 'exoplanet-transit';

  const currentModule =
    astronomyModules.find((m) => m.id === currentAstronomyModuleId) ||
    astronomyModules[0];

  const metrics = calculateAstronomyMetrics(params);
  const activePlanet =
    SOLAR_PLANET_PRESETS.find((p) => p.id === params.selectedPlanetId) ||
    SOLAR_PLANET_PRESETS[2];

  useEffect(() => {
    if (!isRunning) return;
    let animId: number;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      setSimTime((prev) => prev + dt * (params.timeScaleSpeed || 1));
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, params.timeScaleSpeed]);

  const handleSelectExperimentById = (expId: string) => {
    labSound.playClick();
    if (expId === 'solar-kepler') {
      onChangeParams((p) => ({ ...p, mode: 'solar-kepler' }));
    } else if (expId === 'milky-way-rotation') {
      onChangeParams((p) => ({ ...p, mode: 'milkyway-galaxy' }));
    } else {
      onChangeParams((p) => ({ ...p, mode: 'stellar-exoplanet' }));
    }
    const found = astronomyModules.find((m) => m.id === expId);
    if (found) setModalExperiment(found);
  };

  const handleSelectPlanetPreset = (planetId: string) => {
    labSound.playClick();
    const preset =
      SOLAR_PLANET_PRESETS.find((p) => p.id === planetId) ||
      SOLAR_PLANET_PRESETS[2];
    const updated: AstronomyParams = {
      ...params,
      selectedPlanetId: preset.id,
      customSemiMajorAxisAu: preset.semiMajorAxisAu,
      customEccentricity: preset.eccentricity,
    };
    onChangeParams(updated);
    onPushNotification(
      generateAutomaticFeedback('Astronomi', undefined, undefined, updated)
    );
  };

  const handleRecordClick = () => {
    labSound.playRecordSuccess();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 260);

    const title =
      params.mode === 'solar-kepler'
        ? `Orbit Hukum Kepler — ${activePlanet.name} (a = ${params.customSemiMajorAxisAu} AU)`
        : params.mode === 'milkyway-galaxy'
        ? `Kurva Rotasi Galaksi Bima Sakti (R = ${params.galactocentricRadiusKpc} kpc)`
        : `Diagram H-R Bintang Kelas ${metrics.spectralClass} & Transit Eksoplanet`;

    const summary =
      params.mode === 'solar-kepler'
        ? `Planet=${activePlanet.name}, a=${params.customSemiMajorAxisAu} AU, e=${params.customEccentricity}, M*=${params.centralStarMassSolar} M☉`
        : params.mode === 'milkyway-galaxy'
        ? `R=${params.galactocentricRadiusKpc} kpc, Fraksi DM=${params.darkMatterHaloFraction}, Sgr A*=${params.sgrAStarMassMillionSolar}×10⁶ M☉`
        : `T_eff=${params.starEffectiveTempK} K, R*=${params.starRadiusSolar} R☉, Rp=${params.exoplanetRadiusEarth} R⊕, d=${params.exoplanetOrbitAu} AU`;

    const keyMetrics: Record<string, number | string> =
      params.mode === 'solar-kepler'
        ? {
            'Periode T': `${metrics.orbitalPeriodYears} tahun`,
            'v Orbit Rata-rata': `${metrics.meanOrbitalVelocityKms} km/s`,
            'Rasio T²/a³': `${metrics.keplerRatioT2OverA3}`,
          }
        : params.mode === 'milkyway-galaxy'
        ? {
            'v Observasi (DM)': `${metrics.observedDarkMatterVelocityKms} km/s`,
            'v Keplerian': `${metrics.keplerianVelocityKms} km/s`,
            'Massa M(<R)': `${metrics.enclosedMassBillionSolar}×10⁹ M☉`,
          }
        : {
            'Luminositas L': `${metrics.stellarLuminositySolar} L☉`,
            'Kedalaman Transit': `${metrics.transitDepthPct}% (${metrics.transitDepthPpm} ppm)`,
            'Status Orbit': metrics.isInHabitableZone
              ? 'Zona Laik Huni'
              : 'Luar Zona Laik Huni',
          };

    const numericCoords =
      params.mode === 'solar-kepler'
        ? {
            x: Number(Math.pow(params.customSemiMajorAxisAu, 3).toFixed(2)),
            y1: Number(Math.pow(metrics.orbitalPeriodYears, 2).toFixed(2)),
            y2: metrics.meanOrbitalVelocityKms,
          }
        : params.mode === 'milkyway-galaxy'
        ? {
            x: params.galactocentricRadiusKpc,
            y1: metrics.observedDarkMatterVelocityKms,
            y2: metrics.keplerianVelocityKms,
          }
        : {
            x: params.exoplanetRadiusEarth,
            y1: metrics.transitDepthPct,
            y2: metrics.stellarLuminositySolar,
          };

    onRecordExperiment(
      title,
      summary,
      keyMetrics,
      'Pengamatan astronomi 3D tercatat untuk evaluasi regresi dan LKS.',
      numericCoords
    );
  };

  const astronomyFormulaData: {
    title: string;
    subtitle: string;
    tokens: FormulaToken[];
  } = (() => {
    if (params.mode === 'milkyway-galaxy') {
      return {
        title: 'Kecepatan Rotasi Galaksi & Materi Gelap',
        subtitle: `Anomali Δv = +${metrics.velocityAnomalyKms} km/s pada R = ${params.galactocentricRadiusKpc} kpc`,
        tokens: [
          {
            symbol: 'v_obs',
            value: metrics.observedDarkMatterVelocityKms,
            unit: 'km/s',
            color: '#818cf8',
          },
          { symbol: '= √[G·(' },
          {
            symbol: 'M_SgrA*',
            paramKey: 'sgrAStarMassMillionSolar',
            value: params.sgrAStarMassMillionSolar,
            min: 1.0,
            max: 15.0,
            unit: '×10⁶ M☉',
            color: '#f59e0b',
          },
          { symbol: '+' },
          {
            symbol: 'M_DM',
            paramKey: 'darkMatterHaloFraction',
            value: params.darkMatterHaloFraction,
            min: 0.0,
            max: 1.5,
            unit: '×Halo',
            color: '#38bdf8',
          },
          { symbol: ') /' },
          {
            symbol: 'R',
            paramKey: 'galactocentricRadiusKpc',
            value: params.galactocentricRadiusKpc,
            min: 1.0,
            max: 25.0,
            unit: 'kpc',
            color: '#10b981',
          },
          { symbol: ']' },
        ],
      };
    }
    if (params.mode === 'stellar-exoplanet') {
      return {
        title: 'Hukum Stefan-Boltzmann & Transit Eksoplanet',
        subtitle: `Kelas Spektral ${metrics.spectralClass} · ΔF/F = -${metrics.transitDepthPct}%`,
        tokens: [
          {
            symbol: 'ΔF/F',
            value: metrics.transitDepthPct,
            unit: '%',
            color: '#818cf8',
          },
          { symbol: '= (' },
          {
            symbol: 'R_p',
            paramKey: 'exoplanetRadiusEarth',
            value: params.exoplanetRadiusEarth,
            min: 0.5,
            max: 15.0,
            unit: 'R⊕',
            color: '#10b981',
          },
          { symbol: '/' },
          {
            symbol: 'R*',
            paramKey: 'starRadiusSolar',
            value: params.starRadiusSolar,
            min: 0.2,
            max: 8.0,
            unit: 'R☉',
            color: '#f59e0b',
          },
          { symbol: ')² ·' },
          {
            symbol: 'T_eff',
            paramKey: 'starEffectiveTempK',
            value: params.starEffectiveTempK,
            min: 2800,
            max: 28000,
            unit: 'K',
            color: '#38bdf8',
          },
        ],
      };
    }
    return {
      title: 'Hukum III Kepler & Dinamika Orbit',
      subtitle: `${activePlanet.name} · Perihelion ${metrics.perihelionAu} AU · Aphelion ${metrics.aphelionAu} AU`,
      tokens: [
        {
          symbol: 'T²',
          value: Number(Math.pow(metrics.orbitalPeriodYears, 2).toFixed(2)),
          unit: 'thn²',
          color: '#818cf8',
        },
        { symbol: '=' },
        {
          symbol: 'a³',
          paramKey: 'customSemiMajorAxisAu',
          value: Number(Math.pow(params.customSemiMajorAxisAu, 3).toFixed(2)),
          min: 0.02,
          max: 32768,
          unit: 'AU³',
          color: '#38bdf8',
        },
        { symbol: '/' },
        {
          symbol: 'M*',
          paramKey: 'centralStarMassSolar',
          value: params.centralStarMassSolar,
          min: 0.2,
          max: 4.0,
          unit: 'M☉',
          color: '#f59e0b',
        },
        { symbol: '· (1−e²)' },
      ],
    };
  })();

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* FULL-VIEWPORT 3D SCENE CANVAS */}
      <div className="absolute inset-0 w-full h-full z-0">
        <AstronomyScene3D
          params={params}
          metrics={metrics}
          activePlanet={activePlanet}
          simTime={simTime}
          remoteCursors={remoteCursors}
          onEmitCursor={onEmitCursor}
        />
      </div>

      {/* CAMERA SHUTTER FLASH ON RECORD */}
      <AnimatePresence>
        {shutterFlash && (
          <motion.div
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-tr from-indigo-300/60 via-white/85 to-sky-300/60"
          />
        )}
      </AnimatePresence>

      {/* 1. TOP-LEFT FLOATING PILL: Experiment Module Picker + Pre-Lab & Rumus Button */}
      <div className="pointer-events-auto absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/15 text-white rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2">
          <Compass className="w-4 h-4 text-indigo-400 shrink-0" />
          <select
            aria-label="Pilih Modul Eksperimen Astronomi"
            value={currentAstronomyModuleId}
            onChange={(e) => handleSelectExperimentById(e.target.value)}
            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
          >
            <option value="solar-kepler" className="bg-slate-900 text-white">
              Tata Surya & Hukum Orbit Kepler
            </option>
            <option value="milky-way-rotation" className="bg-slate-900 text-white">
              Galaksi Bima Sakti & Materi Gelap
            </option>
            <option value="exoplanet-transit" className="bg-slate-900 text-white">
              Fotometri Transit Eksoplanet & Diagram H-R
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setModalExperiment(currentModule);
            setPreLabModalOpen(true);
          }}
          className="backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800/90 border border-white/15 text-indigo-300 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
          title="Buka Panduan Pre-Lab, K3 & Rumus"
        >
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span className="hidden sm:inline">Pre-Lab & Rumus</span>
        </button>
      </div>

      {/* 2. LEFT FLOATING CONTROL DOCK (Collapsible) */}
      <div className="pointer-events-none absolute top-20 left-4 bottom-20 z-30 flex items-start">
        <AnimatePresence initial={false}>
          {!leftDockCollapsed && (
            <motion.aside
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className="pointer-events-auto w-76 sm:w-80 h-full overflow-y-auto backdrop-blur-xl bg-slate-900/75 dark:bg-slate-900/80 border border-white/15 text-white rounded-2xl shadow-2xl p-3.5 space-y-3.5"
            >
              {/* Dock Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-bold tracking-wide text-white">
                    Kontrol Observatorium 3D
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLeftDockCollapsed(true)}
                  aria-label="Sembunyikan panel kontrol kiri"
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* SVG Radial Speedometer & Astro Gauges */}
              <div className="grid grid-cols-2 gap-2 justify-items-center bg-slate-950/60 border border-white/10 rounded-xl p-2.5">
                {params.mode === 'solar-kepler' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Laju Orbit (v)"
                      value={metrics.meanOrbitalVelocityKms}
                      min={0}
                      max={60}
                      unit="km/s"
                      color="#38bdf8"
                    />
                    <CircularGaugeMeter
                      size="sm"
                      label="Rasio T²/a³"
                      value={metrics.keplerRatioT2OverA3}
                      min={0}
                      max={2.5}
                      unit=""
                      precision={2}
                      color="#10b981"
                    />
                  </>
                ) : params.mode === 'milkyway-galaxy' ? (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="v_obs (DM)"
                      value={metrics.observedDarkMatterVelocityKms}
                      min={0}
                      max={300}
                      unit="km/s"
                      color="#818cf8"
                    />
                    <CircularGaugeMeter
                      size="sm"
                      label="v_Keplerian"
                      value={metrics.keplerianVelocityKms}
                      min={0}
                      max={300}
                      unit="km/s"
                      color="#f59e0b"
                    />
                  </>
                ) : (
                  <>
                    <CircularGaugeMeter
                      size="sm"
                      label="Transit ΔF/F"
                      value={metrics.transitDepthPct}
                      min={0}
                      max={4}
                      unit="%"
                      precision={2}
                      color="#38bdf8"
                    />
                    <CircularGaugeMeter
                      size="sm"
                      label="Suhu Bintang"
                      value={params.starEffectiveTempK}
                      min={2800}
                      max={28000}
                      unit="K"
                      precision={0}
                      color={metrics.starColorHex}
                    />
                  </>
                )}
              </div>

              {/* Digital Readouts */}
              <div className="grid grid-cols-2 gap-2">
                {params.mode === 'solar-kepler' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Periode Orbit (T)"
                      value={metrics.orbitalPeriodYears}
                      unit="thn"
                      precision={2}
                      accentColor="#818cf8"
                    />
                    <AnimatedNumberReadout
                      label="v Perihelion"
                      value={metrics.perihelionVelocityKms}
                      unit="km/s"
                      precision={1}
                      accentColor="#10b981"
                    />
                  </>
                ) : params.mode === 'milkyway-galaxy' ? (
                  <>
                    <AnimatedNumberReadout
                      label="Massa M(<R)"
                      value={metrics.enclosedMassBillionSolar}
                      unit="×10⁹M☉"
                      precision={1}
                      accentColor="#818cf8"
                    />
                    <AnimatedNumberReadout
                      label="Anomali Δv"
                      value={metrics.velocityAnomalyKms}
                      unit="km/s"
                      precision={1}
                      accentColor="#10b981"
                    />
                  </>
                ) : (
                  <>
                    <AnimatedNumberReadout
                      label="Luminositas (L)"
                      value={metrics.stellarLuminositySolar}
                      unit="L☉"
                      precision={2}
                      accentColor="#f59e0b"
                    />
                    <AnimatedNumberReadout
                      label="Kedalaman (ppm)"
                      value={metrics.transitDepthPpm}
                      unit="ppm"
                      precision={0}
                      accentColor="#38bdf8"
                    />
                  </>
                )}
              </div>

              {/* Interactive Formula Card */}
              <InteractiveFormulaCard
                title={astronomyFormulaData.title}
                subtitle={astronomyFormulaData.subtitle}
                tokens={astronomyFormulaData.tokens}
                activeParamKey={hoveredParamKey}
                accentColor="#818cf8"
              />

              {/* Mode-Specific Controls */}
              {params.mode === 'solar-kepler' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Preset Planet Tata Surya
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {SOLAR_PLANET_PRESETS.slice(0, 8).map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => handleSelectPlanetPreset(pl.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-colors cursor-pointer truncate ${
                            params.selectedPlanetId === pl.id
                              ? 'bg-indigo-500 text-white border-indigo-400 font-bold'
                              : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {pl.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <TactileParameterControl
                    label="Sumbu Semi-Mayor"
                    symbol="a"
                    value={params.customSemiMajorAxisAu}
                    min={0.3}
                    max={30.0}
                    step={0.1}
                    unit="AU"
                    accentColor="#38bdf8"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'customSemiMajorAxisAu' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        customSemiMajorAxisAu: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Eksentrisitas Elips"
                    symbol="e"
                    value={params.customEccentricity}
                    min={0}
                    max={0.85}
                    step={0.01}
                    unit=""
                    accentColor="#10b981"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'customEccentricity' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        customEccentricity: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Massa Bintang Induk"
                    symbol="M*"
                    value={params.centralStarMassSolar}
                    min={0.2}
                    max={4.0}
                    step={0.1}
                    unit="M☉"
                    accentColor="#f59e0b"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'centralStarMassSolar' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        centralStarMassSolar: v,
                      }))
                    }
                  />
                </div>
              )}

              {params.mode === 'milkyway-galaxy' && (
                <div className="space-y-2.5">
                  <TactileParameterControl
                    label="Jarak Galaktosentris"
                    symbol="R"
                    value={params.galactocentricRadiusKpc}
                    min={1.0}
                    max={25.0}
                    step={0.5}
                    unit="kpc"
                    accentColor="#10b981"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'galactocentricRadiusKpc' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        galactocentricRadiusKpc: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Fraksi Halo Materi Gelap"
                    symbol="DM"
                    value={params.darkMatterHaloFraction}
                    min={0.0}
                    max={1.5}
                    step={0.05}
                    unit="×"
                    accentColor="#38bdf8"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'darkMatterHaloFraction' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        darkMatterHaloFraction: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Massa Lubang Hitam Sgr A*"
                    symbol="M•"
                    value={params.sgrAStarMassMillionSolar}
                    min={1.0}
                    max={15.0}
                    step={0.2}
                    unit="×10⁶M☉"
                    accentColor="#f59e0b"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'sgrAStarMassMillionSolar' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        sgrAStarMassMillionSolar: v,
                      }))
                    }
                  />
                </div>
              )}

              {params.mode === 'stellar-exoplanet' && (
                <div className="space-y-2.5">
                  <TactileParameterControl
                    label="Suhu Efektif Bintang"
                    symbol="Teff"
                    value={params.starEffectiveTempK}
                    min={2800}
                    max={28000}
                    step={200}
                    unit="K"
                    accentColor="#38bdf8"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'starEffectiveTempK' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        starEffectiveTempK: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Radius Bintang Induk"
                    symbol="R*"
                    value={params.starRadiusSolar}
                    min={0.2}
                    max={8.0}
                    step={0.1}
                    unit="R☉"
                    accentColor="#f59e0b"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'starRadiusSolar' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        starRadiusSolar: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Radius Eksoplanet"
                    symbol="Rp"
                    value={params.exoplanetRadiusEarth}
                    min={0.5}
                    max={15.0}
                    step={0.2}
                    unit="R⊕"
                    accentColor="#10b981"
                    onHoverChange={(h) =>
                      setHoveredParamKey(h ? 'exoplanetRadiusEarth' : null)
                    }
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        exoplanetRadiusEarth: v,
                      }))
                    }
                  />

                  <TactileParameterControl
                    label="Jarak Orbit Eksoplanet"
                    symbol="d"
                    value={params.exoplanetOrbitAu}
                    min={0.05}
                    max={5.0}
                    step={0.05}
                    unit="AU"
                    accentColor="#818cf8"
                    onChange={(v) =>
                      onChangeParams((p) => ({
                        ...p,
                        exoplanetOrbitAu: v,
                      }))
                    }
                  />
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sleek Collapse/Expand Toggle Button (< / >) */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setLeftDockCollapsed((c) => !c);
          }}
          aria-label={
            leftDockCollapsed
              ? 'Buka panel kontrol kiri'
              : 'Tutup panel kontrol kiri'
          }
          className="pointer-events-auto ml-2 mt-3 backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-white rounded-xl p-2 shadow-2xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono"
        >
          {leftDockCollapsed ? (
            <>
              <ChevronRight className="w-4 h-4 text-indigo-400" />
              <span className="pr-1">Kontrol</span>
            </>
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          )}
        </button>
      </div>

      {/* 3. BOTTOM-CENTER FLOATING PLAYBACK & ACTION PILL */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[95vw]">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/15 text-white rounded-full px-3.5 py-2 shadow-2xl flex items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setIsRunning((r) => !r);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-[0_0_18px_rgba(99,102,241,0.45)] transition-colors cursor-pointer shrink-0"
          >
            {isRunning ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isRunning ? 'Jeda' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setSimTime(0);
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
            title="Reset Fase Orbit (t = 0)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Scrubber */}
          <div className="hidden sm:flex items-center gap-2 px-1">
            <span className="font-mono text-[11px] text-indigo-300 tabular-nums w-12">
              {simTime.toFixed(1)}s
            </span>
            <input
              type="range"
              aria-label="Skala Waktu Orbit"
              min={0}
              max={20}
              step={0.1}
              value={simTime % 20}
              onChange={(e) => {
                setIsRunning(false);
                setSimTime(Number(e.target.value));
              }}
              className="w-28 md:w-36 accent-indigo-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() =>
                onChangeParams((p) => ({
                  ...p,
                  timeScaleSpeed:
                    p.timeScaleSpeed === 1 ? 2 : p.timeScaleSpeed === 2 ? 0.5 : 1,
                }))
              }
              className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
            >
              {params.timeScaleSpeed}x
            </button>
          </div>

          {/* Glowing Primary Button: + Catat Data Percobaan */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRecordClick}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-[0_0_22px_rgba(16,185,129,0.55)] transition-colors cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>+ Catat Data Percobaan</span>
          </motion.button>
        </div>
      </div>

      {/* 4. RIGHT FLOATING ANALYTICS SUMMARY & STEP TRANSITION */}
      <FloatingLabAnalyticsDrawer
        domain="Astronomi"
        experimentTitle={currentModule.title}
        records={records}
        activeStudentName={activeStudentName}
        activeGroupId={activeGroupId}
        accentColor="#818cf8"
        onDeleteRecord={onDeleteRecord}
        onExportCSV={onExportCSV}
        onSubmitQuizScore={onSubmitQuizScore}
        onProceedToAnalysis={onProceedToAnalysis}
        onBackToCatalog={onBackToCatalog}
      />

      {/* Pre-Lab & Safety Modal */}
      <PreLabSafetyModal
        experiment={modalExperiment}
        activeTier={activeTier}
        isOpen={preLabModalOpen}
        onClose={() => setPreLabModalOpen(false)}
        onProceedToLab={() => {
          handleSelectExperimentById(modalExperiment.id);
        }}
      />
    </div>
  );
};
