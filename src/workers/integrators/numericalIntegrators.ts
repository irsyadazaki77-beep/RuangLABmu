/**
 * Deterministic Numerical Integrators & Step Utilities for Web Worker Simulation
 * Fixed timestep dt = 1/60s (60 Hz) using Runge-Kutta 4th Order (RK4) and Velocity Verlet.
 */

import {
  calculateEnzymeKinetics,
  calculateCellOsmosisTonicity,
} from '../../utils/scienceEngine';
import type {
  SimulationEventType,
  SimulationMode,
} from '../../types/simulationWorkerTypes';

export const FIXED_DT = 1.0 / 60.0; // 60 Hz fixed timestep
export const MAX_STEP_FRAMES = 3600; // Hard cap: max 60 seconds simulated per STEP_FRAMES batch

export interface SimulationStepEvent {
  type: SimulationEventType;
  payload: Record<string, number>;
}

export interface WorkerDomainMutableContext {
  mode: SimulationMode;
  params: Record<string, number>;
  state: Record<string, number>;
  time: number;
  frameIndex: number;
  initialMechanicalEnergy: number;
  previousAngle: number;
  angleAccum: number;
  collisionOccurred: boolean;
  groundHitOccurred: boolean;
  bioEventTriggered: boolean;
}

export function clampStepFrames(deltaFrames: number): number {
  if (!Number.isFinite(deltaFrames)) return 0;
  const truncated = Math.trunc(deltaFrames);
  if (truncated > MAX_STEP_FRAMES) return MAX_STEP_FRAMES;
  if (truncated < -MAX_STEP_FRAMES) return -MAX_STEP_FRAMES;
  return truncated;
}

// Pure RK4 step for Damped Spring-Hooke Oscillator
export function stepSpringHookeRK4(
  x: number,
  v: number,
  m: number,
  k: number,
  c: number,
  dt: number
): { xNext: number; vNext: number; aNext: number } {
  const mass = Math.max(0.01, m);
  const accel = (posX: number, velX: number) => -(k / mass) * posX - (c / mass) * velX;

  const k1v = accel(x, v);
  const k1x = v;

  const k2v = accel(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v);
  const k2x = v + 0.5 * dt * k1v;

  const k3v = accel(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v);
  const k3x = v + 0.5 * dt * k2v;

  const k4v = accel(x + dt * k3x, v + dt * k3v);
  const k4x = v + dt * k3v;

  const xNext = x + (dt / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
  const vNext = v + (dt / 6.0) * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
  const aNext = accel(xNext, vNext);

  return { xNext, vNext, aNext };
}

// Pure RK4 step for Projectile Motion with optional Drag
export function stepProjectileRK4(
  x: number,
  y: number,
  vx: number,
  vy: number,
  m: number,
  g: number,
  dragCoeff: number,
  dt: number
): {
  xNext: number;
  yNext: number;
  vxNext: number;
  vyNext: number;
  axNext: number;
  ayNext: number;
} {
  const mass = Math.max(0.01, m);
  const computeAccels = (_px: number, _py: number, velX: number, velY: number) => {
    const speed = Math.hypot(velX, velY);
    const dragForceMag = dragCoeff * speed;
    const ax = -(dragForceMag / mass) * velX;
    const ay = -g - (dragForceMag / mass) * velY;
    return { ax, ay };
  };

  const k1 = computeAccels(x, y, vx, vy);

  const k2 = computeAccels(
    x + 0.5 * dt * vx,
    y + 0.5 * dt * vy,
    vx + 0.5 * dt * k1.ax,
    vy + 0.5 * dt * k1.ay
  );

  const k3 = computeAccels(
    x + 0.5 * dt * (vx + 0.5 * dt * k1.ax),
    y + 0.5 * dt * (vy + 0.5 * dt * k1.ay),
    vx + 0.5 * dt * k2.ax,
    vy + 0.5 * dt * k2.ay
  );

  const k4 = computeAccels(
    x + dt * (vx + 0.5 * dt * k2.ax),
    y + dt * (vy + 0.5 * dt * k2.ay),
    vx + dt * k3.ax,
    vy + dt * k3.ay
  );

  const xNext =
    x +
    (dt / 6.0) *
      (vx +
        2.0 * (vx + 0.5 * dt * k1.ax) +
        2.0 * (vx + 0.5 * dt * k2.ax) +
        (vx + dt * k3.ax));
  const yNext =
    y +
    (dt / 6.0) *
      (vy +
        2.0 * (vy + 0.5 * dt * k1.ay) +
        2.0 * (vy + 0.5 * dt * k2.ay) +
        (vy + dt * k3.ay));

  const vxNext = vx + (dt / 6.0) * (k1.ax + 2.0 * k2.ax + 2.0 * k3.ax + k4.ax);
  const vyNext = vy + (dt / 6.0) * (k1.ay + 2.0 * k2.ay + 2.0 * k3.ay + k4.ay);

  const finalAcc = computeAccels(xNext, yNext, vxNext, vyNext);

  return {
    xNext,
    yNext,
    vxNext,
    vyNext,
    axNext: finalAcc.ax,
    ayNext: finalAcc.ay,
  };
}

// Pure Velocity Verlet step for Orbital Gravity (Symplectic Energy-Conserving)
export function stepOrbitalVerlet(
  rx: number,
  ry: number,
  vx: number,
  vy: number,
  mu: number,
  dt: number
): {
  rxNext: number;
  ryNext: number;
  vxNext: number;
  vyNext: number;
  axNext: number;
  ayNext: number;
} {
  const rDistSq = rx * rx + ry * ry;
  const rDist = Math.max(0.001, Math.sqrt(rDistSq));
  const rDistCubed = rDist * rDist * rDist;

  const axCurr = -(mu / rDistCubed) * rx;
  const ayCurr = -(mu / rDistCubed) * ry;

  // 1. Position update using current velocity and acceleration
  const rxNext = rx + vx * dt + 0.5 * axCurr * dt * dt;
  const ryNext = ry + vy * dt + 0.5 * ayCurr * dt * dt;

  // 2. Next acceleration from updated position
  const rNextSq = rxNext * rxNext + ryNext * ryNext;
  const rNextDist = Math.max(0.001, Math.sqrt(rNextSq));
  const rNextCubed = rNextDist * rNextDist * rNextDist;

  const axNext = -(mu / rNextCubed) * rxNext;
  const ayNext = -(mu / rNextCubed) * ryNext;

  // 3. Velocity update using average of current and next acceleration
  const vxNext = vx + 0.5 * (axCurr + axNext) * dt;
  const vyNext = vy + 0.5 * (ayCurr + ayNext) * dt;

  return { rxNext, ryNext, vxNext, vyNext, axNext, ayNext };
}

/**
 * Pure 4th-Order Runge-Kutta (RK4) step for Michaelis-Menten Enzyme Kinetics
 * d[S]/dt = -v([S]), d[P]/dt = +v([S])
 */
export function stepEnzymeKineticsRK4(
  substrateMm: number,
  productMm: number,
  vMaxBase: number,
  kmConstantMm: number,
  temperatureC: number,
  solutionPh: number,
  dt: number
): {
  substrateNext: number;
  productNext: number;
  reactionVelocityV: number;
  thermalFactor: number;
  phFactor: number;
  denaturationDegreePct: number;
} {
  const sCurr = Math.max(0, substrateMm);
  const pCurr = Math.max(0, productMm);

  interface EnzymeKineticsRateEval {
    rateMmPerSec: number;
    rawVelocity: number;
    thermalFactor: number;
    phFactor: number;
    denaturationDegreePct: number;
  }

  const evalVelocity = (sVal: number): EnzymeKineticsRateEval => {
    const clampedS = Math.max(0, sVal);
    const kin = calculateEnzymeKinetics({
      substrateConcMm: clampedS,
      vMaxBase,
      kmConstantMm,
      temperatureC,
      solutionPh,
    });
    // Convert umol/(L*s) to mM/s (1 mM = 1000 umol/L, scaled by 0.025 for observable bioreactor time course)
    const rateMmPerSec = kin.reactionVelocityV * 0.025;
    return {
      rateMmPerSec,
      rawVelocity: kin.reactionVelocityV,
      thermalFactor: kin.thermalFactor,
      phFactor: kin.phFactor,
      denaturationDegreePct: kin.denaturationDegreePct,
    };
  };

  const k1 = evalVelocity(sCurr);
  const k2 = evalVelocity(sCurr - 0.5 * dt * k1.rateMmPerSec);
  const k3 = evalVelocity(sCurr - 0.5 * dt * k2.rateMmPerSec);
  const k4 = evalVelocity(sCurr - dt * k3.rateMmPerSec);

  const deltaS =
    (dt / 6.0) *
    (k1.rateMmPerSec +
      2.0 * k2.rateMmPerSec +
      2.0 * k3.rateMmPerSec +
      k4.rateMmPerSec);
  const actualConsumed = Math.min(sCurr, Math.max(0, deltaS));

  const substrateNext = sCurr - actualConsumed;
  const productNext = pCurr + actualConsumed;
  const finalEval = evalVelocity(substrateNext);

  return {
    substrateNext,
    productNext,
    reactionVelocityV: finalEval.rawVelocity,
    thermalFactor: finalEval.thermalFactor,
    phFactor: finalEval.phFactor,
    denaturationDegreePct: finalEval.denaturationDegreePct,
  };
}

/**
 * Pure 4th-Order Runge-Kutta (RK4) step for Lotka-Volterra Predator-Prey Dynamics
 * dx/dt = alpha*x - beta*x*y
 * dy/dt = delta*x*y - gamma*y
 */
export function stepLotkaVolterraRK4(
  preyX: number,
  predatorY: number,
  alpha: number,
  beta: number,
  delta: number,
  gamma: number,
  dt: number
): {
  preyNext: number;
  predatorNext: number;
  dPreyDt: number;
  dPredatorDt: number;
  phaseInvariantH: number;
} {
  const a = Math.max(0.001, alpha);
  const b = Math.max(0.0001, beta);
  const d = Math.max(0.0001, delta);
  const g = Math.max(0.001, gamma);

  const derivatives = (x: number, y: number) => {
    const sx = Math.max(0, x);
    const sy = Math.max(0, y);
    return {
      dx: a * sx - b * sx * sy,
      dy: d * sx * sy - g * sy,
    };
  };

  const k1 = derivatives(preyX, predatorY);
  const k2 = derivatives(preyX + 0.5 * dt * k1.dx, predatorY + 0.5 * dt * k1.dy);
  const k3 = derivatives(preyX + 0.5 * dt * k2.dx, predatorY + 0.5 * dt * k2.dy);
  const k4 = derivatives(preyX + dt * k3.dx, predatorY + dt * k3.dy);

  const preyNext = Math.max(
    1e-4,
    preyX + (dt / 6.0) * (k1.dx + 2.0 * k2.dx + 2.0 * k3.dx + k4.dx)
  );
  const predatorNext = Math.max(
    1e-4,
    predatorY + (dt / 6.0) * (k1.dy + 2.0 * k2.dy + 2.0 * k3.dy + k4.dy)
  );

  const nextDeriv = derivatives(preyNext, predatorNext);
  const phaseInvariantH =
    d * preyNext - g * Math.log(preyNext) + b * predatorNext - a * Math.log(predatorNext);

  return {
    preyNext,
    predatorNext,
    dPreyDt: nextDeriv.dx,
    dPredatorDt: nextDeriv.dy,
    phaseInvariantH,
  };
}

/**
 * Pure 4th-Order Runge-Kutta (RK4) step for Cell Osmosis & Turgor Pressure Dynamics
 * dV/dt = L_p * A * (Pi_int(V) - Pi_ext - P_turgor(V))
 */
export function stepCellOsmosisRK4(
  currentVolumeUm3: number,
  initialVolumeUm3: number,
  intracellularMolarityM: number,
  extracellularMolarityM: number,
  vantHoffFactorInt: number,
  vantHoffFactorExt: number,
  temperatureC: number,
  hasCellWall: boolean,
  dt: number
): {
  volumeNextUm3: number;
  netWaterFluxUm3PerSec: number;
  turgorPressureAtm: number;
  osmoticPressureIntAtm: number;
  osmoticPressureExtAtm: number;
  isPlasmolyzed: boolean;
  isLysed: boolean;
} {
  const v0 = Math.max(10, initialVolumeUm3);
  const minVolume = 0.35 * v0;
  const maxVolume = hasCellWall ? 1.55 * v0 : 1.65 * v0;

  const evalOsmosis = (vol: number) => {
    const clampedVol = Math.min(maxVolume, Math.max(minVolume, vol));
    return calculateCellOsmosisTonicity({
      intracellularMolarityM,
      extracellularMolarityM,
      vantHoffFactorInt,
      vantHoffFactorExt,
      temperatureC,
      initialCellVolumeUm3: v0,
      currentCellVolumeUm3: clampedVol,
      hasCellWall,
    });
  };

  const k1 = evalOsmosis(currentVolumeUm3).netWaterFluxUm3PerSec;
  const k2 = evalOsmosis(currentVolumeUm3 + 0.5 * dt * k1).netWaterFluxUm3PerSec;
  const k3 = evalOsmosis(currentVolumeUm3 + 0.5 * dt * k2).netWaterFluxUm3PerSec;
  const k4 = evalOsmosis(currentVolumeUm3 + dt * k3).netWaterFluxUm3PerSec;

  const rawNextVol = currentVolumeUm3 + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
  const volumeNextUm3 = Math.min(maxVolume, Math.max(minVolume, rawNextVol));
  const finalState = evalOsmosis(volumeNextUm3);

  return {
    volumeNextUm3,
    netWaterFluxUm3PerSec: finalState.netWaterFluxUm3PerSec,
    turgorPressureAtm: finalState.turgorPressureAtm,
    osmoticPressureIntAtm: finalState.osmoticPressureIntAtm,
    osmoticPressureExtAtm: finalState.osmoticPressureExtAtm,
    isPlasmolyzed: finalState.isPlasmolyzed,
    isLysed: finalState.isLysed,
  };
}
