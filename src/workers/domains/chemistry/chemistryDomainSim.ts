/**
 * Chemistry & Biochemical Kinetics Domain Simulation Module for Web Worker
 * Covers Enzyme/Reaction Kinetics, Acid-Base Titration, and Chemical Equilibrium dynamics.
 */

import { calculateEnzymeKinetics } from '../../../utils/scienceEngine';
import type { SimulationFrame, Vector3Tuple } from '../../../utils/simulationBuffer';
import type { SimulationMode } from '../../../types/simulationWorkerTypes';
import {
  FIXED_DT,
  stepEnzymeKineticsRK4,
  type SimulationStepEvent,
  type WorkerDomainMutableContext,
} from '../../integrators';

const CHEMISTRY_MODES = new Set<SimulationMode>(['enzyme-kinetics']);

export function isChemistrySimulationMode(mode: SimulationMode): boolean {
  return CHEMISTRY_MODES.has(mode);
}

export function initChemistryDomainState(ctx: WorkerDomainMutableContext): void {
  const s0 = ctx.params.substrateConcMm ?? 10.0;
  const vMax = ctx.params.vMaxBase ?? 120.0 * (ctx.params.enzymeVolumeMl ?? 1.0);
  const km = ctx.params.kmConstantMm ?? 4.5;
  const tempC = ctx.params.temperatureC ?? 37.0;
  const ph = ctx.params.solutionPh ?? ctx.params.solutionPH ?? 7.0;
  const initKin = calculateEnzymeKinetics({
    substrateConcMm: s0,
    vMaxBase: vMax,
    kmConstantMm: km,
    temperatureC: tempC,
    solutionPh: ph,
  });
  ctx.state = {
    substrateMm: s0,
    productMm: 0,
    reactionVelocityV: initKin.reactionVelocityV,
    thermalFactor: initKin.thermalFactor,
    phFactor: initKin.phFactor,
    denaturationDegreePct: initKin.denaturationDegreePct,
  };
  ctx.initialMechanicalEnergy = s0;
}

export function stepChemistryDomain(
  ctx: WorkerDomainMutableContext
): SimulationStepEvent | undefined {
  let event: SimulationStepEvent | undefined;

  const vMax = ctx.params.vMaxBase ?? 120.0 * (ctx.params.enzymeVolumeMl ?? 1.0);
  const km = ctx.params.kmConstantMm ?? 4.5;
  const tempC = ctx.params.temperatureC ?? 37.0;
  const ph = ctx.params.solutionPh ?? ctx.params.solutionPH ?? 7.0;

  const next = stepEnzymeKineticsRK4(
    ctx.state.substrateMm,
    ctx.state.productMm,
    vMax,
    km,
    tempC,
    ph,
    FIXED_DT
  );
  ctx.state.substrateMm = next.substrateNext;
  ctx.state.productMm = next.productNext;
  ctx.state.reactionVelocityV = next.reactionVelocityV;
  ctx.state.thermalFactor = next.thermalFactor;
  ctx.state.phFactor = next.phFactor;
  ctx.state.denaturationDegreePct = next.denaturationDegreePct;

  if (next.substrateNext <= 0.05 && !ctx.bioEventTriggered) {
    ctx.bioEventTriggered = true;
    event = {
      type: 'substrate-depleted',
      payload: {
        time: Number(ctx.time.toFixed(2)),
        productMm: Number(next.productNext.toFixed(3)),
      },
    };
  }

  return event;
}

export function buildChemistryDomainFrame(ctx: WorkerDomainMutableContext): SimulationFrame {
  const timestamp = Number(ctx.time.toFixed(3));
  const positions: Record<string, Vector3Tuple> = {};
  const velocities: Record<string, Vector3Tuple> = {};
  const accelerations: Record<string, Vector3Tuple> = {};
  const scalars: Record<string, number> = {};

  const s = ctx.state.substrateMm ?? 0;
  const p = ctx.state.productMm ?? 0;
  const v = ctx.state.reactionVelocityV ?? 0;
  const denat = ctx.state.denaturationDegreePct ?? 0;

  positions.substrate = { x: s, y: p, z: 0 };
  velocities.substrate = { x: -v * 0.025, y: v * 0.025, z: 0 };
  accelerations.substrate = { x: 0, y: 0, z: 0 };

  const kinetic = Number(p.toFixed(4));
  const potential = Number(s.toFixed(4));
  const thermal = Number(denat.toFixed(2));
  const total = Number((s + p).toFixed(4));

  scalars.substrateConcMm = Number(s.toFixed(4));
  scalars.productConcMm = Number(p.toFixed(4));
  scalars.reactionVelocityV = Number(v.toFixed(4));
  scalars.denaturationDegreePct = Number(denat.toFixed(2));

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
