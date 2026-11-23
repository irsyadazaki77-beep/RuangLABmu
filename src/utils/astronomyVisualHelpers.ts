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
