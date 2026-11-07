import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  HelpCircle,
  CheckCircle,
  Sliders,
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
import {
  TactileParameterControl,
} from './ui/LabInstruments';
import {
  InteractiveFormulaCard,
  FormulaToken,
} from './ui/InteractiveFormulaCard';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  evaluateMysterySubmission,
} from '../utils/mysteryChallengeEngine';

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
  activeMysteryChallenge?: MysterySampleChallenge | null;
  onSubmitMysteryExam?: (
    studentName: string,
    result: MysterySubmissionResult,
    title: string
  ) => void;
}

export const AstronomyLabView: React.FC<AstronomyLabViewProps> = ({
  params,
  onChangeParams,
  onRecordExperiment,
  onPushNotification,
  remoteCursors,
  onEmitCursor,
  records = [],
  activeStudentName = 'Alya Pratama',
  activeMysteryChallenge,
  onSubmitMysteryExam,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const [hoveredParamKey, setHoveredParamKey] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  // Mystery Sample Exam State
  const [mysteryGuessInput, setMysteryGuessInput] = useState<string>('');
  const [mysteryFeedbackResult, setMysteryFeedbackResult] =
    useState<MysterySubmissionResult | null>(null);

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
        : params.mode === 'stellar-wien-spectrum'
        ? `Hukum Pergeseran Wien — Bintang ${metrics.spectralClass} (T = ${params.starEffectiveTempK} K)`
        : params.mode === 'hubble-expansion'
        ? `Hukum Ekspansi Hubble — Galaksi (d = ${params.galaxyDistanceMpc} Mpc)`
        : `Diagram H-R Bintang Kelas ${metrics.spectralClass} & Transit Eksoplanet`;

    const summary =
      params.mode === 'solar-kepler'
        ? `Planet=${activePlanet.name}, a=${params.customSemiMajorAxisAu} AU, e=${params.customEccentricity}, M*=${params.centralStarMassSolar} M☉`
        : params.mode === 'milkyway-galaxy'
        ? `R=${params.galactocentricRadiusKpc} kpc, Fraksi DM=${params.darkMatterHaloFraction}, Sgr A*=${params.sgrAStarMassMillionSolar}×10⁶ M☉`
        : params.mode === 'stellar-wien-spectrum'
        ? `T_eff=${params.starEffectiveTempK} K, R*=${params.starRadiusSolar} R☉, λ_max=${metrics.peakWavelengthNm} nm, Kelas ${metrics.spectralClass}`
        : params.mode === 'hubble-expansion'
        ? `d=${params.galaxyDistanceMpc} Mpc, H₀=${params.hubbleConstantH0} km/s/Mpc, v=${metrics.recessionVelocityKms} km/s, z=${metrics.redshiftZ}`
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
        : params.mode === 'stellar-wien-spectrum'
        ? {
            'Panjang Gelombang Puncak': `${metrics.peakWavelengthNm} nm`,
            'Kelas Spektral': metrics.spectralClass,
            'Fluks Permukaan': `${metrics.surfaceFluxWPerM2?.toExponential(2)} W/m²`,
            'Luminositas L': `${metrics.stellarLuminositySolar} L☉`,
          }
        : params.mode === 'hubble-expansion'
        ? {
            'Kecepatan Resesi (v)': `${metrics.recessionVelocityKms} km/s`,
            'Pergeseran Merah (z)': metrics.redshiftZ ?? 0,
            'Waktu Hubble (t_H)': `${metrics.hubbleAgeBillionYears} Miliar Tahun`,
            'Jarak Galaksi (d)': `${params.galaxyDistanceMpc} Mpc`,
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
        : params.mode === 'stellar-wien-spectrum'
        ? {
            x: params.starEffectiveTempK,
            y1: metrics.peakWavelengthNm ?? 500,
            y2: metrics.stellarLuminositySolar,
          }
        : params.mode === 'hubble-expansion'
        ? {
            x: params.galaxyDistanceMpc ?? 100,
            y1: metrics.recessionVelocityKms ?? 7000,
            y2: metrics.redshiftZ ?? 0.02,
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
    if (params.mode === 'stellar-wien-spectrum') {
      return {
        title: 'Hukum Pergeseran Wien (Radiasi Bintang)',
        subtitle: `λ_max · T = b · Tetapan Wien b = 2.898 × 10⁻³ m·K`,
        tokens: [
          { symbol: 'λ_max', value: metrics.peakWavelengthNm, unit: 'nm', color: '#818cf8' },
          { symbol: '=' },
          { symbol: 'b' },
          { symbol: '/' },
          {
            symbol: 'T_eff',
            paramKey: 'starEffectiveTempK',
            value: params.starEffectiveTempK,
            min: 2500,
            max: 35000,
            unit: 'K',
            color: '#f59e0b',
          },
        ],
      };
    }
    if (params.mode === 'hubble-expansion') {
      return {
        title: 'Hukum Ekspansi Alam Semesta Hubble',
        subtitle: `v = H₀ · d · Pergeseran Merah z = v/c`,
        tokens: [
          { symbol: 'v', value: metrics.recessionVelocityKms, unit: 'km/s', color: '#10b981' },
          { symbol: '=' },
          {
            symbol: 'H₀',
            paramKey: 'hubbleConstantH0',
            value: params.hubbleConstantH0 ?? 70,
            min: 50,
            max: 100,
            unit: 'km/s/Mpc',
            color: '#818cf8',
          },
          { symbol: '·' },
          {
            symbol: 'd',
            paramKey: 'galaxyDistanceMpc',
            value: params.galaxyDistanceMpc ?? 100,
            min: 5,
            max: 300,
            unit: 'Mpc',
            color: '#38bdf8',
          },
        ],
      };
    }
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
    <div className="w-full h-full max-w-[1380px] mx-auto p-4 sm:p-6 overflow-y-auto bg-slate-950 text-slate-100 select-none pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: 3D Scene Canvas & Playback Bar */}
        <div className="lg:col-span-8 space-y-4 flex flex-col">
          {/* 3D Canvas Box */}
          <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl">
            <AstronomyScene3D
              params={params}
              metrics={metrics}
              activePlanet={activePlanet}
              simTime={simTime}
              remoteCursors={remoteCursors}
              onEmitCursor={onEmitCursor}
              onUpdateParam={(key, val) => onChangeParams((p) => ({ ...p, [key]: val }))}
            />

            {/* Shutter Flash Animation */}
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

            {/* Top Overlay Readout */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <span className="text-slate-400 font-mono">v_orbit:</span>
                <span className="font-bold font-mono text-indigo-400 tabular-nums">
                  {metrics.meanOrbitalVelocityKms} km/s
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono">Periode (T):</span>
                <span className="font-bold font-mono text-emerald-400 tabular-nums">
                  {metrics.orbitalPeriodYears} thn
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Playback Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Play / Reset controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setIsRunning(!isRunning);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md ${
                    isRunning
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isRunning ? 'Jeda Simulasi' : 'Jalankan Orbit'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setSimTime(0);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title="Reset Orbit"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Time Speed Slider */}
              <div className="flex-1 min-w-[180px] flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 shrink-0">Kecepatan:</span>
                <input
                  type="range"
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  value={params.timeScaleSpeed || 1.0}
                  onChange={(e) =>
                    onChangeParams((p) => ({
                      ...p,
                      timeScaleSpeed: Number(e.target.value),
                    }))
                  }
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-xs font-mono font-bold text-indigo-400 shrink-0 w-10 tabular-nums">
                  {(params.timeScaleSpeed || 1.0).toFixed(1)}x
                </span>
              </div>

              {/* Prominent + Catat Data Percobaan Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleRecordClick}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-slate-950 font-extrabold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span>+ Catat Data Percobaan</span>
                <span className="bg-slate-950/20 px-2 py-0.5 rounded-md font-mono text-[11px] text-slate-950">
                  {records.length}/3 Data
                </span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Parameter Sliders & Formula Card */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Mode Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Modul Eksperimen Astronomi</span>
            </div>

            <select
              value={params.mode}
              onChange={(e) => {
                labSound.playClick();
                onChangeParams((p) => ({
                  ...p,
                  mode: e.target.value as AstronomyParams['mode'],
                }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="solar-kepler">Tata Surya & Hukum Orbit Kepler</option>
              <option value="milkyway-galaxy">Galaksi Bima Sakti & Materi Gelap</option>
              <option value="stellar-exoplanet">Fotometri Transit Eksoplanet & Diagram H-R</option>
              <option value="stellar-wien-spectrum">Spektroskopi Bintang & Hukum Wien</option>
              <option value="hubble-expansion">Ekspansi Alam Semesta & Hukum Hubble</option>
            </select>

            {/* Planet Presets if in Solar-Kepler Mode */}
            {params.mode === 'solar-kepler' && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Preset Planet
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
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {pl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mystery Challenge Form (ONLY if Active for Astronomi) */}
          {activeMysteryChallenge && activeMysteryChallenge.domain === 'Astronomi' && (
            <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  Ujian Sampel Misterius
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {activeMysteryChallenge.codename}
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 leading-relaxed">
                {activeMysteryChallenge.storyDescription}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const guess = parseFloat(mysteryGuessInput);
                  if (isNaN(guess)) return;
                  const res = evaluateMysterySubmission(activeMysteryChallenge, guess);
                  setMysteryFeedbackResult(res);
                  if (onSubmitMysteryExam) {
                    onSubmitMysteryExam(activeStudentName, res, activeMysteryChallenge.title);
                  }
                  if (res.passed) labSound.playRecordSuccess();
                  else labSound.playClick(300);
                }}
                className="space-y-2 pt-1"
              >
                <input
                  type="number"
                  step="any"
                  required
                  value={mysteryGuessInput}
                  onChange={(e) => setMysteryGuessInput(e.target.value)}
                  placeholder={`Hasil (${activeMysteryChallenge.hiddenParamUnit})`}
                  className="w-full bg-slate-950 border border-white/20 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Kirim Jawaban
                </button>
              </form>

              {mysteryFeedbackResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    mysteryFeedbackResult.passed
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{mysteryFeedbackResult.verdict}</span>
                    <span className="font-mono">{mysteryFeedbackResult.score}/100</span>
                  </div>
                  <p className="text-[11px] opacity-90">{mysteryFeedbackResult.feedbackText}</p>
                </div>
              )}
            </div>
          )}

          {/* Parameter Sliders Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="text-xs font-bold text-slate-200">Parameter Observatorium</div>

            <div className="space-y-3">
              {params.mode === 'solar-kepler' && (
                <>
                  <TactileParameterControl
                    label="Sumbu Semi-Mayor (a)"
                    symbol="a"
                    value={params.customSemiMajorAxisAu}
                    min={0.3}
                    max={30.0}
                    step={0.1}
                    unit="AU"
                    accentColor="#38bdf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'customSemiMajorAxisAu' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, customSemiMajorAxisAu: v }))}
                  />
                  <TactileParameterControl
                    label="Eksentrisitas Elips (e)"
                    symbol="e"
                    value={params.customEccentricity}
                    min={0}
                    max={0.85}
                    step={0.01}
                    unit=""
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'customEccentricity' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, customEccentricity: v }))}
                  />
                  <TactileParameterControl
                    label="Massa Bintang Induk (M*)"
                    symbol="M*"
                    value={params.centralStarMassSolar}
                    min={0.2}
                    max={4.0}
                    step={0.1}
                    unit="M☉"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'centralStarMassSolar' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, centralStarMassSolar: v }))}
                  />
                </>
              )}

              {params.mode === 'milkyway-galaxy' && (
                <>
                  <TactileParameterControl
                    label="Jarak Galaktosentris (R)"
                    symbol="R"
                    value={params.galactocentricRadiusKpc}
                    min={1.0}
                    max={25.0}
                    step={0.5}
                    unit="kpc"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'galactocentricRadiusKpc' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, galactocentricRadiusKpc: v }))}
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
                    onHoverChange={(h) => setHoveredParamKey(h ? 'darkMatterHaloFraction' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, darkMatterHaloFraction: v }))}
                  />
                </>
              )}

              {params.mode === 'stellar-wien-spectrum' && (
                <>
                  <TactileParameterControl
                    label="Suhu Efektif Bintang (Teff)"
                    symbol="T"
                    value={params.starEffectiveTempK}
                    min={2500}
                    max={35000}
                    step={250}
                    unit="K"
                    accentColor="#f59e0b"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'starEffectiveTempK' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, starEffectiveTempK: v }))}
                  />
                  <TactileParameterControl
                    label="Radius Bintang (R*)"
                    symbol="R*"
                    value={params.starRadiusSolar}
                    min={0.2}
                    max={20.0}
                    step={0.2}
                    unit="R☉"
                    accentColor="#818cf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'starRadiusSolar' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, starRadiusSolar: v }))}
                  />
                </>
              )}

              {params.mode === 'hubble-expansion' && (
                <>
                  <TactileParameterControl
                    label="Jarak Galaksi Kosmis (d)"
                    symbol="d"
                    value={params.galaxyDistanceMpc ?? 100}
                    min={5}
                    max={300}
                    step={5}
                    unit="Mpc"
                    accentColor="#38bdf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'galaxyDistanceMpc' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, galaxyDistanceMpc: v }))}
                  />
                  <TactileParameterControl
                    label="Konstanta Hubble (H₀)"
                    symbol="H₀"
                    value={params.hubbleConstantH0 ?? 70}
                    min={50}
                    max={100}
                    step={1}
                    unit="km/s/Mpc"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'hubbleConstantH0' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, hubbleConstantH0: v }))}
                  />
                </>
              )}

              {params.mode === 'stellar-exoplanet' && (
                <>
                  <TactileParameterControl
                    label="Suhu Efektif Bintang"
                    symbol="Teff"
                    value={params.starEffectiveTempK}
                    min={2800}
                    max={28000}
                    step={200}
                    unit="K"
                    accentColor="#38bdf8"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'starEffectiveTempK' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, starEffectiveTempK: v }))}
                  />
                  <TactileParameterControl
                    label="Radius Eksoplanet (Rp)"
                    symbol="Rp"
                    value={params.exoplanetRadiusEarth}
                    min={0.5}
                    max={15.0}
                    step={0.1}
                    unit="R⊕"
                    accentColor="#10b981"
                    onHoverChange={(h) => setHoveredParamKey(h ? 'exoplanetRadiusEarth' : null)}
                    onChange={(v) => onChangeParams((p) => ({ ...p, exoplanetRadiusEarth: v }))}
                  />
                </>
              )}
            </div>
          </div>

          {/* Interactive Formula Card */}
          <InteractiveFormulaCard
            title={astronomyFormulaData.title}
            subtitle={astronomyFormulaData.subtitle}
            tokens={astronomyFormulaData.tokens}
            activeParamKey={hoveredParamKey}
            accentColor="#818cf8"
          />
        </div>
      </div>
    </div>
  );
};
