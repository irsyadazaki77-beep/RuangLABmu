/**
 * Pure helper utilities for Chemistry 3D apparatus rendering & visual realism.
 * Extracted for fast unit testing and clean separation from WebGL context.
 */

export interface GasPistonVisualState {
  /** World Y position of the piston head */
  pistonY: number;
  /** World Y position of the piston rod */
  rodY: number;
  /** Thermal color hex of gas molecules */
  gasColorHex: number;
  /** Particle speed multiplier */
  particleSpeed: number;
}

/**
 * Computes piston height, rod height, gas molecule color, and thermal speed
 * for Boyle/Ideal Gas 3D apparatus.
 */
export function computeGasPistonVisualState(
  volumeL: number,
  temperatureK: number
): GasPistonVisualState {
  const safeV = Math.max(2.0, Math.min(25.0, Number.isFinite(volumeL) ? volumeL : 10.0));
  const safeT = Math.max(100, Math.min(1000, Number.isFinite(temperatureK) ? temperatureK : 300));
  const pistonY = 0.8 + (safeV / 25.0) * 3.2;
  const rodY = pistonY + 1.2;
  const gasColorHex = safeT >= 480 ? 0xef4444 : safeT >= 360 ? 0xf97316 : 0x38bdf8;
  const particleSpeed = Math.sqrt(safeT / 300) * 0.04;
  return {
    pistonY,
    rodY,
    gasColorHex,
    particleSpeed,
  };
}

export interface ArrheniusKineticsVisualState {
  /** Point light intensity under the beaker */
  heaterIntensity: number;
  /** Stirrer bar angular step per frame (rad) */
  stirAngularStep: number;
  /** Thermal convection vortex ring opacity */
  vortexOpacity: number;
}

/**
 * Computes hotplate glow, magnetic stirrer rotation speed, and convection shimmer
 * for Arrhenius Kinetics 3D apparatus.
 */
export function computeArrheniusKineticsState(
  tempC: number,
  stirringRpm: number,
  reacting: boolean
): ArrheniusKineticsVisualState {
  const safeTemp = Math.max(0, Math.min(120, Number.isFinite(tempC) ? tempC : 25));
  const safeRpm = Math.max(0, Math.min(1200, Number.isFinite(stirringRpm) ? stirringRpm : 300));
  const heaterIntensity = Math.max(0, ((safeTemp - 25) / 65) * 1.4);
  const stirAngularStep = (safeRpm / 60) * 0.25 * (reacting ? 1.4 : 0.8);
  const vortexOpacity = Math.min(0.65, 0.12 + (safeRpm / 1000) * 0.35 + Math.max(0, safeTemp - 25) * 0.004);
  return {
    heaterIntensity,
    stirAngularStep,
    vortexOpacity,
  };
}

export interface BeerLambertBeamState {
  /** Monochromatic beam RGB hex */
  beamColorHex: number;
  /** Incident beam opacity before cuvette (0..1) */
  incidentOpacity: number;
  /** Transmitted beam opacity after cuvette (attenuated by Beer-Lambert 10^-A) */
  transmittedOpacity: number;
  /** Transmittance fraction T = 10^(-A) */
  transmittance: number;
}

/**
 * Maps wavelength (400-700 nm) to visible RGB hex and computes Beer-Lambert
 * beam attenuation before and after the sample cuvette.
 */
export function computeBeerLambertBeamState(
  wavelengthNm: number,
  absorbance: number
): BeerLambertBeamState {
  const wl = Math.max(380, Math.min(720, Number.isFinite(wavelengthNm) ? wavelengthNm : 520));
  const safeA = Math.max(0, Math.min(3.5, Number.isFinite(absorbance) ? absorbance : 0.45));

  let beamColorHex = 0xef4444;
  if (wl < 450) beamColorHex = 0x8b5cf6;
  else if (wl < 495) beamColorHex = 0x3b82f6;
  else if (wl < 570) beamColorHex = 0x10b981;
  else if (wl < 590) beamColorHex = 0xeab308;
  else if (wl < 620) beamColorHex = 0xf97316;

  const transmittance = Math.pow(10, -safeA);
  const incidentOpacity = 0.82;
  const transmittedOpacity = Math.max(0.08, Math.min(0.82, 0.12 + transmittance * 0.7));

  return {
    beamColorHex,
    incidentOpacity,
    transmittedOpacity,
    transmittance,
  };
}
