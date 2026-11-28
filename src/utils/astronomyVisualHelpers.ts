import { AstronomyMode } from './engines/astronomyEngine';

export interface TransitLightCurveSample {
  /** Normalized horizontal offset relative to stellar radius (0 = star center). */
  xOffsetNorm: number;
  /** True when planet lies on the observer (+Z) hemisphere and overlaps the stellar disk. */
  inTransit: boolean;
  /** Stellar limb darkening intensity multiplier in [0.55, 1.0]. */
  limbFactor: number;
  /** Physical transit depth (Rp / R*)^2 clamped cleanly for tiny rocky planets. */
  physicalDepthFraction: number;
  /** Real normalized stellar flux in [0, 1]. */
  fluxRatio: number;
  /** Visually boosted normalized flux for legible 3D light-curve plots at Earth scales. */
  visualFluxRatio: number;
}

/**
 * Normalizes catalog IDs and internal AstronomyLabView modes into canonical AstronomyMode keys.
 */
export function normalizeAstronomyMode(mode: string | undefined | null): AstronomyMode {
  switch (mode) {
    case 'milkyway-galaxy':
    case 'milky-way-rotation':
      return 'milkyway-galaxy';
    case 'stellar-exoplanet':
    case 'exoplanet-transit':
      return 'stellar-exoplanet';
    case 'stellar-wien-spectrum':
      return 'stellar-wien-spectrum';
    case 'hubble-expansion':
      return 'hubble-expansion';
    case 'planetary-atmosphere-greenhouse':
      return 'planetary-atmosphere-greenhouse';
    case 'doppler-redshift-binary':
      return 'doppler-redshift-binary';
    case 'solar-kepler':
    default:
      return 'solar-kepler';
  }
}

/**
 * Maps an astronomical semi-major axis (AU) to a logarithmic Three.js orbital radius.
 */
export function auToSceneRadius(semiMajorAxisAu: number): number {
  const safeAu = Number.isFinite(semiMajorAxisAu) && semiMajorAxisAu > 0 ? semiMajorAxisAu : 1.0;
  return Math.min(8.6, Math.max(1.55, 2.0 + Math.log10(Math.max(0.2, safeAu)) * 3.5));
}

export interface KeplerOrbitSample {
  ox: number;
  oy: number;
  oz: number;
  b: number;
  tangentX: number;
  tangentY: number;
  tangentZ: number;
}

/**
 * Solves Kepler's Equation M = E - e * sin(E) for eccentric anomaly E (radians)
 * using 4 Newton-Raphson iterations so planets accelerate at perihelion and slow at aphelion.
 */
export function solveKeplerEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  const safeM = Number.isFinite(meanAnomalyRad) ? meanAnomalyRad : 0;
  const e = Number.isFinite(eccentricity) ? Math.max(0, Math.min(0.95, eccentricity)) : 0;
  if (e < 1e-5) return safeM;

  let E = safeM + e * Math.sin(safeM);
  for (let iter = 0; iter < 4; iter++) {
    const f = E - e * Math.sin(E) - safeM;
    const fp = 1 - e * Math.cos(E);
    E -= f / Math.max(1e-4, fp);
  }
  return E;
}

/**
 * Evaluates a 3D point and orbital tangent vector along an inclined Keplerian ellipse
 * with the central star fixed at the primary focus (origin).
 */
export function evaluateKeplerOrbitPoint(
  eccentricAnomalyRad: number,
  semiMajorAxisAu: number,
  eccentricity: number,
  scaledRadius: number,
  inclinationRad: number
): KeplerOrbitSample {
  const a = Number.isFinite(semiMajorAxisAu) && semiMajorAxisAu > 0 ? semiMajorAxisAu : 1.0;
  const e = Number.isFinite(eccentricity) ? Math.max(0, Math.min(0.95, eccentricity)) : 0;
  const bRatio = Math.sqrt(Math.max(0.01, 1 - e * e));
  const b = a * bRatio;
  const cosE = Math.cos(eccentricAnomalyRad);
  const sinE = Math.sin(eccentricAnomalyRad);
  const sinInc = Math.sin(inclinationRad);

  const ox = (cosE - e) * scaledRadius;
  const oy = sinE * scaledRadius * sinInc;
  const oz = bRatio * sinE * scaledRadius;

  // Derivative with respect to eccentric anomaly E points strictly along orbital velocity
  const tangentX = -sinE * scaledRadius;
  const tangentY = cosE * scaledRadius * sinInc;
  const tangentZ = bRatio * cosE * scaledRadius;

  return { ox, oy, oz, b, tangentX, tangentY, tangentZ };
}

export interface KeplerInstantaneousDynamics {
  /** Instantaneous heliocentric distance r(E) = a * (1 - e cos E) in AU */
  instantRadiusAu: number;
  /** Exact Vis-Viva orbital speed v(r) = 29.7847 * sqrt(M * (2/r - 1/a)) in km/s */
  instantVelocityKmS: number;
  /** Velocity vector arrow length scaled proportionally to v(r) / v_mean */
  velocityArrowLen: number;
  /** Gravity vector arrow length scaled monotonically with 1 / r^2 */
  gravityArrowLen: number;
  /** Solar insolation / comet tail activity factor proportional to (a / r)^2 */
  insolationRatio: number;
}

/**
 * Evaluates exact instantaneous Vis-Viva speed v(r) and inverse-square gravity scaling F ∝ 1/r²
 * at eccentric anomaly E so 3D vectors dynamically grow at perihelion and shrink at aphelion.
 */
export function computeKeplerInstantaneousDynamics(
  eccentricAnomalyRad: number,
  semiMajorAxisAu: number,
  eccentricity: number,
  starMassSolar = 1.0
): KeplerInstantaneousDynamics {
  const a = Math.max(0.05, Number.isFinite(semiMajorAxisAu) ? semiMajorAxisAu : 1.0);
  const e = Math.max(0, Math.min(0.95, Number.isFinite(eccentricity) ? eccentricity : 0.0167));
  const M = Math.max(0.08, Number.isFinite(starMassSolar) ? starMassSolar : 1.0);
  const V_EARTH_KMS = 29.7847;

  const instantRadiusAu = Math.max(1e-4, a * (1 - e * Math.cos(eccentricAnomalyRad)));
  const vMean = V_EARTH_KMS * Math.sqrt(M / a);
  const instantVelocityKmS = V_EARTH_KMS * Math.sqrt(Math.max(1e-6, M * (2 / instantRadiusAu - 1 / a)));

  const velRatio = instantVelocityKmS / Math.max(1e-4, vMean);
  const velocityArrowLen = Math.min(2.6, Math.max(0.55, 1.35 * velRatio));

  const insolationRatio = Math.pow(a / instantRadiusAu, 2);
  // Smooth log-compressed inverse-square scaling so perihelion gravity spike is vivid without clipping star
  const gravityArrowLen = Math.min(2.4, Math.max(0.55, 1.15 * Math.pow(insolationRatio, 0.35)));

  return {
    instantRadiusAu: Number(instantRadiusAu.toFixed(4)),
    instantVelocityKmS: Number(instantVelocityKmS.toFixed(2)),
    velocityArrowLen: Number(velocityArrowLen.toFixed(3)),
    gravityArrowLen: Number(gravityArrowLen.toFixed(3)),
    insolationRatio: Number(insolationRatio.toFixed(3)),
  };
}

/**
 * Computes physically exact galactic differential angular velocity ω = v / R
 * so inner stars orbit faster in rad/s than outer stars, and dark-matter halo boosts outer ω.
 */
export function computeMilkyWayAngularSpeed(
  radiusKpc: number,
  orbitalVelocityKmS: number
): number {
  const safeR = Math.max(0.5, Number.isFinite(radiusKpc) ? radiusKpc : 8.2);
  const safeV = Math.max(10, Number.isFinite(orbitalVelocityKmS) ? orbitalVelocityKmS : 220);
  // Normalized so Earth/Sun at R=8.2 kpc, v=220 km/s yields ~0.72 rad/s visual cadence
  const omega = (safeV / safeR) * (8.2 / 220) * 0.72;
  return Number(Math.min(3.5, Math.max(0.12, omega)).toFixed(4));
}

/**
 * Evaluates exact Planck spectral radiance B(λ, T) normalized to peak = 1.0 at Wien λ_max = b / T.
 * Uses physical hc / k_B = 1.438776877e7 nm·K.
 */
export function computePlanckNormalizedIntensity(wavelengthNm: number, tempK: number): number {
  const HC_OVER_KB_NM_K = 1.438776877e7;
  const WIEN_B_NM_K = 2.897771955e6;
  const safeT = Math.max(1000, Math.min(50000, Number.isFinite(tempK) ? tempK : 5778));
  const safeWl = Math.max(40, Number.isFinite(wavelengthNm) ? wavelengthNm : 500);

  const raw = (wl: number) => {
    const x = HC_OVER_KB_NM_K / (wl * safeT);
    if (x > 250) return 0;
    return 1 / (Math.pow(wl, 5) * (Math.exp(x) - 1));
  };

  const lambdaPeak = WIEN_B_NM_K / safeT;
  const peakVal = raw(lambdaPeak);
  if (peakVal <= 0) return 0;
  return Number(Math.max(0, Math.min(1, raw(safeWl) / peakVal)).toFixed(5));
}

/**
 * Evaluates normalized stellar flux with linear limb darkening during an exoplanet transit.
 * Phase 0.5 corresponds to mid-transit directly on the observer (+Z) line of sight.
 */
export function computeTransitLightCurveSample(
  phase01: number,
  starRadiusSolar: number,
  exoplanetRadiusEarth: number,
  orbitAu = 0.05
): TransitLightCurveSample {
  const safeStarR = Number.isFinite(starRadiusSolar) && starRadiusSolar > 0.1 ? starRadiusSolar : 1.0;
  const safePlanetR =
    Number.isFinite(exoplanetRadiusEarth) && exoplanetRadiusEarth > 0.1 ? exoplanetRadiusEarth : 1.0;
  const safeOrbitAu = Number.isFinite(orbitAu) && orbitAu > 0.01 ? orbitAu : 0.05;

  const wrappedPhase = ((phase01 % 1) + 1) % 1;
  const angle = (wrappedPhase - 0.5) * Math.PI * 2;
  const zSign = Math.cos(angle);

  // Wider angular transit window for tight orbits, clamped to realistic visual chord
  const orbitVisualScale = Math.min(4.8, Math.max(1.8, 1.85 + Math.log10(safeOrbitAu + 0.25) * 1.45));
  const starDiskScale = Math.min(1.8, Math.max(0.75, 1.05 * Math.pow(safeStarR, 0.35)));
  const xScene = Math.sin(angle) * orbitVisualScale;
  const xOffsetNorm = xScene / starDiskScale;

  const ratio = safePlanetR / (safeStarR * 109.2);
  const physicalDepthFraction = Math.min(0.25, ratio * ratio);
  const planetDiskRatio = Math.min(0.32, Math.max(0.05, ratio * 2.1));

  if (zSign <= 0 || Math.abs(xOffsetNorm) >= 1 + planetDiskRatio) {
    return {
      xOffsetNorm,
      inTransit: false,
      limbFactor: 1,
      physicalDepthFraction,
      fluxRatio: 1,
      visualFluxRatio: 1,
    };
  }

  // Smooth ingress/egress chord overlap + linear limb darkening I(mu) = 1 - u1 * (1 - mu)
  const rAbs = Math.abs(xOffsetNorm);
  const overlap =
    rAbs <= 1 - planetDiskRatio
      ? 1
      : Math.max(0, Math.min(1, (1 + planetDiskRatio - rAbs) / (2 * planetDiskRatio)));
  const smoothOverlap = overlap * overlap * (3 - 2 * overlap);

  const clampedR = Math.min(0.995, rAbs);
  const mu = Math.sqrt(Math.max(0, 1 - clampedR * clampedR));
  const u1 = 0.45;
  const limbFactor = (1 - u1 * (1 - mu)) / (1 - u1 / 3);

  const dip = physicalDepthFraction * smoothOverlap * limbFactor;
  const fluxRatio = Math.max(0, 1 - dip);

  // Boost tiny terrestrial dips cleanly (while keeping large hot-Jupiters proportional)
  const visualDepth = Math.min(0.32, Math.max(0.035, Math.sqrt(physicalDepthFraction) * 1.15));
  const visualFluxRatio = Math.max(0.65, 1 - visualDepth * smoothOverlap * limbFactor);

  return {
    xOffsetNorm,
    inTransit: smoothOverlap > 0.01,
    limbFactor,
    physicalDepthFraction,
    fluxRatio,
    visualFluxRatio,
  };
}

/**
 * Computes cosmological redshift color tint (blue-white starforming spiral -> deep crimson redshifted).
 */
export function redshiftToGalaxyColorHex(redshiftZ: number): number {
  const safeZ = Number.isFinite(redshiftZ) ? Math.max(0, Math.min(0.25, redshiftZ)) : 0.03;
  const t = Math.min(1, safeZ / 0.16);

  // Stop 0 (z=0): #93c5fd (147, 197, 253)
  // Stop 0.5 (z=0.08): #fbbf24 (251, 191, 36)
  // Stop 1.0 (z>=0.16): #ef4444 (239, 68, 68)
  let r: number;
  let g: number;
  let b: number;

  if (t < 0.5) {
    const k = t * 2;
    r = Math.round(147 + (251 - 147) * k);
    g = Math.round(197 + (191 - 197) * k);
    b = Math.round(253 + (36 - 253) * k);
  } else {
    const k = (t - 0.5) * 2;
    r = Math.round(251 + (239 - 251) * k);
    g = Math.round(191 + (68 - 191) * k);
    b = Math.round(36 + (68 - 36) * k);
  }

  return (r << 16) | (g << 8) | b;
}

export interface BinaryDopplerVisualState {
  phaseRad: number;
  star1Pos: [number, number, number];
  star2Pos: [number, number, number];
  star1RadialVelKms: number;
  star2RadialVelKms: number;
  star1LambdaNm: number;
  star2LambdaNm: number;
  star1DeltaLambdaNm: number;
  star2DeltaLambdaNm: number;
  orbitRadius1Scene: number;
  orbitRadius2Scene: number;
}

/**
 * Evaluates instantaneous barycentric positions M1*r1 = M2*r2 on an inclined orbit,
 * radial velocities v_r = v * sin(i) * cos/sin(phi), and shifted H-alpha 656.28 nm lines.
 */
export function computeBinaryDopplerVisualState(
  params: {
    binaryMass1Solar?: number;
    binaryMass2Solar?: number;
    binarySeparationAu?: number;
    binaryInclinationDeg?: number;
  },
  timeSec: number
): BinaryDopplerVisualState {
  const m1 = Math.max(0.2, params.binaryMass1Solar ?? 2.2);
  const m2 = Math.max(0.1, params.binaryMass2Solar ?? 1.0);
  const aAu = Math.max(0.05, params.binarySeparationAu ?? 0.45);
  const incDeg = Math.max(0, Math.min(90, params.binaryInclinationDeg ?? 75));
  const incRad = (incDeg * Math.PI) / 180;

  const totalM = m1 + m2;
  const periodDays = Math.sqrt(Math.pow(aAu, 3) / totalM) * 365.25;
  const vRelKms = 29.7847 * Math.sqrt(totalM / aAu);
  const k1 = vRelKms * (m2 / totalM) * Math.sin(incRad);
  const k2 = vRelKms * (m1 / totalM) * Math.sin(incRad);

  // Scene total separation scaled cleanly between 3.2 and 5.6 world units
  const sepScene = Math.min(5.6, Math.max(3.2, 3.0 + aAu * 1.4));
  const orbitRadius1Scene = sepScene * (m2 / totalM);
  const orbitRadius2Scene = sepScene * (m1 / totalM);

  // Visual orbital angular speed inversely proportional to orbital period
  const omegaVis = Math.max(0.35, Math.min(2.6, 55 / Math.max(12, periodDays)));
  const phaseRad = Math.max(0, timeSec) * omegaVis;

  const cosP = Math.cos(phaseRad);
  const sinP = Math.sin(phaseRad);
  const cosI = Math.cos(incRad);

  // Observer sits along +Z axis; inclination tilts the Z-axis out of the sky plane into Y-Z
  // At phaseRad = 0: star1 is at (+r1, 0, 0) moving toward +Z (receding? Wait: observer at +Z means moving +Z = approaching (-vr, blueshift)!)
  const s1x = orbitRadius1Scene * cosP;
  const s1z = orbitRadius1Scene * sinP * Math.sin(incRad);
  const s1y = orbitRadius1Scene * sinP * cosI;

  const s2x = -orbitRadius2Scene * cosP;
  const s2z = -orbitRadius2Scene * sinP * Math.sin(incRad);
  const s2y = -orbitRadius2Scene * sinP * cosI;

  // Radial velocity (+ = receding / redshift, - = approaching / blueshift): proportional to -cos(phase) * sin(i)
  const star1RadialVelKms = -k1 * cosP;
  const star2RadialVelKms = k2 * cosP;

  const H_ALPHA_NM = 656.28;
  const C_KMS = 299792.458;
  const star1DeltaLambdaNm = H_ALPHA_NM * (star1RadialVelKms / C_KMS);
  const star2DeltaLambdaNm = H_ALPHA_NM * (star2RadialVelKms / C_KMS);

  return {
    phaseRad,
    star1Pos: [Number(s1x.toFixed(4)), Number(s1y.toFixed(4)), Number(s1z.toFixed(4))],
    star2Pos: [Number(s2x.toFixed(4)), Number(s2y.toFixed(4)), Number(s2z.toFixed(4))],
    star1RadialVelKms: Number(star1RadialVelKms.toFixed(2)),
    star2RadialVelKms: Number(star2RadialVelKms.toFixed(2)),
    star1LambdaNm: Number((H_ALPHA_NM + star1DeltaLambdaNm).toFixed(4)),
    star2LambdaNm: Number((H_ALPHA_NM + star2DeltaLambdaNm).toFixed(4)),
    star1DeltaLambdaNm: Number(star1DeltaLambdaNm.toFixed(4)),
    star2DeltaLambdaNm: Number(star2DeltaLambdaNm.toFixed(4)),
    orbitRadius1Scene: Number(orbitRadius1Scene.toFixed(3)),
    orbitRadius2Scene: Number(orbitRadius2Scene.toFixed(3)),
  };
}

