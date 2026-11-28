/**
 * Earth & Environmental Science Deterministic Solver (Pilar 3 — RuangLABmu v2.2)
 * Menyediakan model numerik akurat untuk 4 modul Ilmu Kebumian:
 * 1. Gelombang Seismik P & S (Seismologi & Episentrum Gempa)
 * 2. Efek Rumah Kaca & Neraca Radiasi Termal (Hukum Stefan-Boltzmann)
 * 3. Siklus Hidrologi & Hukum Darcy Aliran Air Tanah
 * 4. Peluruhan Radioaktif & Penanggalan Radiometrik (Karbon-14 / Isotop)
 */

const STEFAN_BOLTZMANN = 5.670374419e-8; // W m^-2 K^-4

export interface SeismicOutput {
  hypocenterDistanceKm: number;
  pArrivalSec: number;
  sArrivalSec: number;
  spLagSec: number;
  peakGroundAccelG: number;
  waveAmplitudeMm: number;
}

export function computeSeismicStep(
  params: Record<string, number>,
  timeSec: number
): SeismicOutput {
  const epicenterKm = Math.max(5, params.epicenterDistance ?? 120);
  const depthKm = Math.max(1, params.focalDepth ?? 15);
  const vp = Math.max(3.0, params.pWaveVelocity ?? 6.5); // km/s
  const vs = Math.max(1.5, Math.min(vp - 0.5, params.sWaveVelocity ?? 3.7)); // km/s
  const magnitude = Math.max(2.0, Math.min(9.5, params.magnitude ?? 6.2));

  const hypocenterDistanceKm = Math.sqrt(epicenterKm * epicenterKm + depthKm * depthKm);
  const pArrivalSec = hypocenterDistanceKm / vp;
  const sArrivalSec = hypocenterDistanceKm / vs;
  const spLagSec = Math.max(0, sArrivalSec - pArrivalSec);

  // Empirical attenuation relation for Peak Ground Acceleration (in g)
  const rawPga = Math.pow(10, 0.5 * magnitude - 1.45 * Math.log10(hypocenterDistanceKm + 10) - 0.8);
  const peakGroundAccelG = Math.max(0.001, Math.min(2.5, rawPga));

  // Simulated seismogram displacement (mm) at timeSec
  const t = Math.max(0, timeSec);
  let waveAmplitudeMm = 0;
  if (t >= pArrivalSec) {
    const dtP = t - pArrivalSec;
    waveAmplitudeMm += Math.exp(-dtP * 0.18) * Math.sin(dtP * 14) * peakGroundAccelG * 35;
  }
  if (t >= sArrivalSec) {
    const dtS = t - sArrivalSec;
    waveAmplitudeMm += Math.exp(-dtS * 0.12) * Math.sin(dtS * 7.5) * peakGroundAccelG * 95;
  }

  return {
    hypocenterDistanceKm: Number(hypocenterDistanceKm.toFixed(2)),
    pArrivalSec: Number(pArrivalSec.toFixed(2)),
    sArrivalSec: Number(sArrivalSec.toFixed(2)),
    spLagSec: Number(spLagSec.toFixed(2)),
    peakGroundAccelG: Number(peakGroundAccelG.toFixed(4)),
    waveAmplitudeMm: Number(waveAmplitudeMm.toFixed(2)),
  };
}

export interface GreenhouseOutput {
  absorbedSolarWm2: number;
  effectiveTempK: number;
  surfaceTempK: number;
  surfaceTempC: number;
  greenhouseWarmingK: number;
  radiativeForcingWm2: number;
}

export function computeGreenhouseStep(
  params: Record<string, number>,
  _timeSec: number
): GreenhouseOutput {
  const solarConstant = Math.max(800, params.solarConstant ?? 1361); // W/m^2
  const albedo = Math.max(0.05, Math.min(0.85, params.albedo ?? 0.3));
  const co2Ppm = Math.max(180, Math.min(1200, params.co2Concentration ?? 420));

  // Radiative forcing relative to pre-industrial 280 ppm: ΔF = 5.35 * ln(C / 280)
  const radiativeForcingWm2 = 5.35 * Math.log(co2Ppm / 280);
  // Atmospheric longwave emissivity (baseline ~0.77 at 280 ppm, rises logarithmically with CO2)
  const emissivity = Math.max(0.1, Math.min(0.96, 0.77 + radiativeForcingWm2 * 0.015));

  const absorbedSolarWm2 = (solarConstant * (1 - albedo)) / 4;
  const effectiveTempK = Math.pow(absorbedSolarWm2 / STEFAN_BOLTZMANN, 0.25);
  // Single-layer greenhouse model: T_surf = T_eff / (1 - emissivity / 2)^(1/4)
  const surfaceTempK = effectiveTempK / Math.pow(1 - emissivity / 2, 0.25);
  const surfaceTempC = surfaceTempK - 273.15;
  const greenhouseWarmingK = surfaceTempK - effectiveTempK;

  return {
    absorbedSolarWm2: Number(absorbedSolarWm2.toFixed(2)),
    effectiveTempK: Number(effectiveTempK.toFixed(2)),
    surfaceTempK: Number(surfaceTempK.toFixed(2)),
    surfaceTempC: Number(surfaceTempC.toFixed(2)),
    greenhouseWarmingK: Number(greenhouseWarmingK.toFixed(2)),
    radiativeForcingWm2: Number(radiativeForcingWm2.toFixed(2)),
  };
}

export interface DarcyHydrologyOutput {
  hydraulicGradient: number;
  darcyFluxMPerDay: number;
  dischargeM3PerDay: number;
  erosionRiskIndex: number;
}

export function computeDarcyHydrologyStep(
  params: Record<string, number>,
  _timeSec: number
): DarcyHydrologyOutput {
  const conductivityK = Math.max(0.05, params.hydraulicConductivity ?? 12); // m/day
  const headDiffM = Math.max(0.1, params.hydraulicHeadDiff ?? 8); // m
  const lengthM = Math.max(5, params.aquiferLength ?? 100); // m
  const areaM2 = Math.max(1, params.crossSectionArea ?? 25); // m^2

  const hydraulicGradient = headDiffM / lengthM;
  const darcyFluxMPerDay = conductivityK * hydraulicGradient;
  const dischargeM3PerDay = darcyFluxMPerDay * areaM2;
  const erosionRiskIndex = Math.min(100, (darcyFluxMPerDay / 2.5) * 35);

  return {
    hydraulicGradient: Number(hydraulicGradient.toFixed(4)),
    darcyFluxMPerDay: Number(darcyFluxMPerDay.toFixed(3)),
    dischargeM3PerDay: Number(dischargeM3PerDay.toFixed(2)),
    erosionRiskIndex: Number(erosionRiskIndex.toFixed(1)),
  };
}

export interface RadioactiveDecayOutput {
  remainingAtoms: number;
  remainingPercent: number;
  decayConstant: number;
  activityBq: number;
  halfLivesElapsed: number;
}

export function computeRadioactiveDecayStep(
  params: Record<string, number>,
  timeSec: number
): RadioactiveDecayOutput {
  const initialAtoms = Math.max(100, params.initialNuclei ?? 10000);
  const halfLife = Math.max(0.5, params.halfLife ?? 5.73); // scaled unit (e.g. ribu tahun / detik)
  const elapsed = Math.max(0, (params.elapsedTime ?? 0) + timeSec * 0.25);

  const decayConstant = Math.LN2 / halfLife;
  const halfLivesElapsed = elapsed / halfLife;
  const remainingAtoms = initialAtoms * Math.pow(0.5, halfLivesElapsed);
  const remainingPercent = (remainingAtoms / initialAtoms) * 100;
  const activityBq = decayConstant * remainingAtoms;

  return {
    remainingAtoms: Number(remainingAtoms.toFixed(1)),
    remainingPercent: Number(remainingPercent.toFixed(2)),
    decayConstant: Number(decayConstant.toFixed(4)),
    activityBq: Number(activityBq.toFixed(2)),
    halfLivesElapsed: Number(halfLivesElapsed.toFixed(2)),
  };
}
