/**
 * Pure visual calculation helpers for Physics 3D rigs:
 * - Mechanical energy split (Kinetic Ek, Potential Ep, Total Etot normalized 0..1)
 * - 1D Collision shockwave ring scale & opacity around impact time
 * - Signed Wheatstone bridge galvanometer deflection angle
 * - Photoelectric electron beam trajectory & turnaround under stopping potential
 */

export interface MechanicalEnergySplit {
  ekNorm: number;
  epNorm: number;
  etotNorm: number;
  ekJoules: number;
  epJoules: number;
}

/**
 * Computes normalized (0.06..1.0) heights for 3D Kinetic & Potential energy bars.
 */
export function computeMechanicalEnergySplit(
  kineticEnergyJ: number,
  potentialEnergyJ: number
): MechanicalEnergySplit {
  const ek = Math.max(0, Number.isFinite(kineticEnergyJ) ? kineticEnergyJ : 0);
  const ep = Math.max(0, Number.isFinite(potentialEnergyJ) ? potentialEnergyJ : 0);
  const total = Math.max(1e-3, ek + ep);
  const scaleCap = Math.max(50, total);
  return {
    ekNorm: Math.max(0.06, Math.min(1.0, ek / scaleCap)),
    epNorm: Math.max(0.06, Math.min(1.0, ep / scaleCap)),
    etotNorm: Math.max(0.1, Math.min(1.0, (ek + ep) / scaleCap)),
    ekJoules: ek,
    epJoules: ep,
  };
}

/**
 * Computes transient shockwave ring scale and opacity right after a 1D cart collision.
 */
export function computeCollisionShockwaveState(
  cycleSec: number,
  impactTimeSec = 1.4,
  durationSec = 0.45
): { visible: boolean; scale: number; opacity: number } {
  const dt = cycleSec - impactTimeSec;
  if (dt < 0 || dt > durationSec) {
    return { visible: false, scale: 0.2, opacity: 0 };
  }
  const progress = Math.max(0, Math.min(1, dt / durationSec));
  return {
    visible: true,
    scale: Number((0.35 + progress * 1.95).toFixed(3)),
    opacity: Number(((1 - progress) * 0.85).toFixed(3)),
  };
}

/**
 * Computes the signed galvanometer needle angle (in radians) for a Wheatstone bridge.
 */
export function computeWheatstoneNeedleAngle(
  r1: number,
  r2: number,
  r3: number,
  rx: number,
  galvanometerCurrentMa: number
): { angleRad: number; isBalanced: boolean } {
  const sR1 = Math.max(1, r1);
  const sR2 = Math.max(1, r2);
  const sR3 = Math.max(1, r3);
  const sRx = Math.max(1, rx);
  const vDiff = sR2 / (sR1 + sR2) - sRx / (sR3 + sRx);
  const isBalanced = Math.abs(vDiff) < 1e-4 || Math.abs(galvanometerCurrentMa) < 0.05;
  const dirSign = isBalanced ? 0 : Math.sign(vDiff);
  const rawAngle = dirSign * (Math.abs(galvanometerCurrentMa) / 45) * Math.PI * 0.42;
  const clamped = Math.max(-0.68, Math.min(0.68, rawAngle));
  return {
    angleRad: Number(clamped.toFixed(4)),
    isBalanced,
  };
}

/**
 * Computes the horizontal X coordinate of a photoelectron between cathode (-1.1) and anode (+1.1),
 * modeling classical turnaround when stoppingPotential > maxKe.
 */
export function computePhotoelectricElectronX(
  phase01: number,
  maxKeEv: number,
  stoppingPotentialV: number
): { x: number; reachesAnode: boolean } {
  const p = ((phase01 % 1) + 1) % 1;
  const safeKe = Math.max(0, maxKeEv);
  const safeStop = Math.max(0, stoppingPotentialV);
  if (safeStop > safeKe && safeStop > 1e-4) {
    const turnX = -1.1 + Math.min(0.95, safeKe / safeStop) * 2.0;
    const x =
      p < 0.5
        ? -1.1 + (turnX - -1.1) * (p * 2)
        : turnX - (turnX - -1.1) * ((p - 0.5) * 2);
    return { x: Number(x.toFixed(4)), reachesAnode: false };
  }
  return {
    x: Number((-1.1 + p * 2.2).toFixed(4)),
    reachesAnode: true,
  };
}
