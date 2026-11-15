/**
 * Astronomy & Celestial Mechanics Domain Simulation Module for Web Worker
 * Symplectic Velocity Verlet integration for Keplerian orbital gravity.
 */

import type { SimulationFrame, Vector3Tuple } from '../../../utils/simulationBuffer';
import type { SimulationMode } from '../../../types/simulationWorkerTypes';
import {
  FIXED_DT,
  stepOrbitalVerlet,
  type SimulationStepEvent,
  type WorkerDomainMutableContext,
} from '../../integrators';

const ASTRONOMY_MODES = new Set<SimulationMode>(['orbital-gravity']);

export function isAstronomySimulationMode(mode: SimulationMode): boolean {
  return ASTRONOMY_MODES.has(mode);
}

export function initAstronomyDomainState(ctx: WorkerDomainMutableContext): void {
  const mStar = ctx.params.centralStarMassSolar ?? 1.0;
  const aAu = Math.max(0.1, ctx.params.semiMajorAxisAu ?? 1.0);
  const e = Math.min(0.95, Math.max(0.0, ctx.params.eccentricity ?? 0.017));
  const mu = 39.478 * mStar; // (2pi)^2 * M_star in AU and years; scale for simulation
  const rPerihelion = aAu * (1.0 - e);
  const vPerihelion = Math.sqrt((mu * (1.0 + e)) / (aAu * Math.max(0.05, 1.0 - e)));

  ctx.state = {
    rx: rPerihelion,
    ry: 0,
    vx: 0,
    vy: vPerihelion,
    ax: -(mu / (rPerihelion * rPerihelion)),
    ay: 0,
    mu,
  };
  ctx.previousAngle = 0;
  ctx.angleAccum = 0;
  const m = ctx.params.mass ?? 1.0;
  ctx.initialMechanicalEnergy =
    0.5 * m * vPerihelion * vPerihelion - (mu * m) / rPerihelion;
}

export function stepAstronomyDomain(
  ctx: WorkerDomainMutableContext
): SimulationStepEvent | undefined {
  let event: SimulationStepEvent | undefined;
  const mu = ctx.state.mu ?? 39.478 * (ctx.params.centralStarMassSolar ?? 1.0);
  const { rxNext, ryNext, vxNext, vyNext, axNext, ayNext } = stepOrbitalVerlet(
    ctx.state.rx,
    ctx.state.ry,
    ctx.state.vx,
    ctx.state.vy,
    mu,
    FIXED_DT
  );

  const currentAngle = Math.atan2(ryNext, rxNext);
  let dTheta = currentAngle - ctx.previousAngle;
  if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
  ctx.angleAccum += Math.abs(dTheta);
  ctx.previousAngle = currentAngle;

  if (ctx.angleAccum >= 2.0 * Math.PI) {
    ctx.angleAccum -= 2.0 * Math.PI;
    event = {
      type: 'orbit-complete',
      payload: {
        period: Number(ctx.time.toFixed(3)),
        a: ctx.params.semiMajorAxisAu ?? 1.0,
      },
    };
  }

  ctx.state.rx = rxNext;
  ctx.state.ry = ryNext;
  ctx.state.vx = vxNext;
  ctx.state.vy = vyNext;
  ctx.state.ax = axNext;
  ctx.state.ay = ayNext;

  return event;
}

export function buildAstronomyDomainFrame(
  ctx: WorkerDomainMutableContext
): SimulationFrame {
  const timestamp = Number(ctx.time.toFixed(3));
  const positions: Record<string, Vector3Tuple> = {};
  const velocities: Record<string, Vector3Tuple> = {};
  const accelerations: Record<string, Vector3Tuple> = {};
  const scalars: Record<string, number> = {};

  const m = ctx.params.mass ?? 1.0;
  const rx = ctx.state.rx ?? 1.0;
  const ry = ctx.state.ry ?? 0;
  const vx = ctx.state.vx ?? 0;
  const vy = ctx.state.vy ?? 0;
  const ax = ctx.state.ax ?? 0;
  const ay = ctx.state.ay ?? 0;
  const rDist = Math.max(0.01, Math.hypot(rx, ry));
  const mu = ctx.state.mu ?? 39.478;

  positions.planet = { x: rx, y: ry, z: 0 };
  velocities.planet = { x: vx, y: vy, z: 0 };
  accelerations.planet = { x: ax, y: ay, z: 0 };

  const kinetic = Number((0.5 * m * (vx * vx + vy * vy)).toFixed(3));
  const potential = Number((-(mu * m) / rDist + 100).toFixed(3));
  const total = Number((kinetic + potential).toFixed(3));
  const thermal = 0;
  scalars.orbitalDistance = rDist;

  return {
    frameIndex: ctx.frameIndex,
    timestamp,
    positions,
    velocities,
    accelerations,
    energies: {
      kinetic,
      potential,
      thermal,
      total,
    },
    scalars,
  };
}
