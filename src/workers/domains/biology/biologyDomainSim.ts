/**
 * Biology & Human Anatomy Domain Simulation Module for Web Worker
 * Covers Lotka-Volterra Predator-Prey Ecology, Cell Osmosis & Turgor Pressure,
 * Cardiovascular Heart Hemodynamics, Respiratory Lungs, and Neural Synapse Action Potentials.
 */

import {
  calculateCellOsmosisTonicity,
  calculateCardiovascularHeart,
  calculateRespiratoryLungs,
  calculateNeuralSynapse,
} from '../../../utils/scienceEngine';
import type { SimulationFrame, Vector3Tuple } from '../../../utils/simulationBuffer';
import type { SimulationMode } from '../../../types/simulationWorkerTypes';
import {
  FIXED_DT,
  stepCellOsmosisRK4,
  stepLotkaVolterraRK4,
  type SimulationStepEvent,
  type WorkerDomainMutableContext,
} from '../../integrators';

const BIOLOGY_MODES = new Set<SimulationMode>([
  'predator-prey-dynamics',
  'cell-osmosis-tonicity',
  'anatomy-cardiovascular-heart',
  'anatomy-respiratory-lungs',
  'anatomy-neural-synapse',
]);

export function isBiologySimulationMode(mode: SimulationMode): boolean {
  return BIOLOGY_MODES.has(mode);
}

export function initBiologyDomainState(ctx: WorkerDomainMutableContext): void {
  if (ctx.mode === 'predator-prey-dynamics') {
    const x0 = ctx.params.preyPopulationX ?? 40.0;
    const y0 = ctx.params.predatorPopulationY ?? 9.0;
    const alpha = ctx.params.preyGrowthRateAlpha ?? 1.1;
    const beta = ctx.params.predationRateBeta ?? 0.04;
    const delta = ctx.params.predatorReproductionDelta ?? 0.01;
    const gamma = ctx.params.predatorMortalityGamma ?? 0.4;
    const dx0 = alpha * x0 - beta * x0 * y0;
    const dy0 = delta * x0 * y0 - gamma * y0;
    const h0 =
      delta * Math.max(1e-4, x0) -
      gamma * Math.log(Math.max(1e-4, x0)) +
      beta * Math.max(1e-4, y0) -
      alpha * Math.log(Math.max(1e-4, y0));
    ctx.state = {
      preyX: x0,
      predatorY: y0,
      dPreyDt: dx0,
      dPredatorDt: dy0,
      phaseInvariantH: h0,
    };
    ctx.initialMechanicalEnergy = h0;
  } else if (ctx.mode === 'cell-osmosis-tonicity') {
    const v0 = ctx.params.initialCellVolumeUm3 ?? 1000.0;
    const mInt = ctx.params.intracellularMolarityM ?? 0.28;
    const mExt = ctx.params.extracellularMolarityM ?? ctx.params.sucroseConcMolar ?? 0.3;
    const tempC = ctx.params.temperatureC ?? ctx.params.solutionTempC ?? 25.0;
    const hasWall = (ctx.params.hasCellWall ?? 1) >= 0.5;
    const initOsm = calculateCellOsmosisTonicity({
      intracellularMolarityM: mInt,
      extracellularMolarityM: mExt,
      temperatureC: tempC,
      initialCellVolumeUm3: v0,
      currentCellVolumeUm3: v0,
      hasCellWall: hasWall,
    });
    ctx.state = {
      volumeUm3: v0,
      initialVolumeUm3: v0,
      netWaterFluxUm3PerSec: initOsm.netWaterFluxUm3PerSec,
      turgorPressureAtm: initOsm.turgorPressureAtm,
      osmoticPressureIntAtm: initOsm.osmoticPressureIntAtm,
      osmoticPressureExtAtm: initOsm.osmoticPressureExtAtm,
      isPlasmolyzed: initOsm.isPlasmolyzed ? 1 : 0,
      isLysed: initOsm.isLysed ? 1 : 0,
    };
    ctx.initialMechanicalEnergy = initOsm.osmoticPressureIntAtm;
  } else if (ctx.mode === 'anatomy-cardiovascular-heart') {
    const cv = calculateCardiovascularHeart({
      heartRateBpm: ctx.params.heartRateBpm ?? 72,
      vesselRadiusRatio: ctx.params.vesselRadiusRatio ?? 1.0,
      bloodViscosity: ctx.params.bloodViscosity ?? 3.5,
      exerciseIntensity: ctx.params.exerciseIntensity ?? 20,
      timeSec: 0,
    });
    ctx.state = {
      strokeVolumeMl: cv.strokeVolumeMl,
      cardiacOutputLMin: cv.cardiacOutputLMin,
      vascularResistance: cv.vascularResistance,
      systolicMmHg: cv.systolicMmHg,
      diastolicMmHg: cv.diastolicMmHg,
      meanArterialPressure: cv.meanArterialPressure,
      ecgVoltageMv: cv.ecgVoltageMv,
    };
    ctx.initialMechanicalEnergy = cv.meanArterialPressure;
  } else if (ctx.mode === 'anatomy-respiratory-lungs') {
    const resp = calculateRespiratoryLungs({
      respirationRate: ctx.params.respirationRate ?? 15,
      diaphragmEffort: ctx.params.diaphragmEffort ?? 50,
      airwayResistance: ctx.params.airwayResistance ?? 1.0,
      altitudeMeters: ctx.params.altitudeMeters ?? 0,
      timeSec: 0,
    });
    ctx.state = {
      tidalVolumeMl: resp.tidalVolumeMl,
      minuteVentilationLMin: resp.minuteVentilationLMin,
      alveolarPo2MmHg: resp.alveolarPo2MmHg,
      spo2Percent: resp.spo2Percent,
      instantLungVolumeMl: resp.instantLungVolumeMl,
    };
    ctx.initialMechanicalEnergy = resp.spo2Percent;
  } else if (ctx.mode === 'anatomy-neural-synapse') {
    const neu = calculateNeuralSynapse({
      stimulusVoltageMv: ctx.params.stimulusVoltageMv ?? -40,
      myelinThickness: ctx.params.myelinThickness ?? 75,
      extracellularNaMm: ctx.params.extracellularNaMm ?? 145,
      extracellularKMm: ctx.params.extracellularKMm ?? 4.5,
      timeSec: 0,
    });
    ctx.state = {
      nernstNaMv: neu.nernstNaMv,
      nernstKMv: neu.nernstKMv,
      restingPotentialMv: neu.restingPotentialMv,
      conductionVelocityMs: neu.conductionVelocityMs,
      membranePotentialMv: neu.membranePotentialMv,
      actionPotentialTriggered: neu.actionPotentialTriggered ? 1 : 0,
    };
    ctx.initialMechanicalEnergy = neu.restingPotentialMv;
  }
}

export function stepBiologyDomain(
  ctx: WorkerDomainMutableContext
): SimulationStepEvent | undefined {
  let event: SimulationStepEvent | undefined;

  if (ctx.mode === 'predator-prey-dynamics') {
    const alpha = ctx.params.preyGrowthRateAlpha ?? 1.1;
    const beta = ctx.params.predationRateBeta ?? 0.04;
    const delta = ctx.params.predatorReproductionDelta ?? 0.01;
    const gamma = ctx.params.predatorMortalityGamma ?? 0.4;

    const next = stepLotkaVolterraRK4(
      ctx.state.preyX,
      ctx.state.predatorY,
      alpha,
      beta,
      delta,
      gamma,
      FIXED_DT
    );
    ctx.state.preyX = next.preyNext;
    ctx.state.predatorY = next.predatorNext;
    ctx.state.dPreyDt = next.dPreyDt;
    ctx.state.dPredatorDt = next.dPredatorDt;
    ctx.state.phaseInvariantH = next.phaseInvariantH;
  } else if (ctx.mode === 'cell-osmosis-tonicity') {
    const v0 = ctx.state.initialVolumeUm3 ?? 1000.0;
    const mInt = ctx.params.intracellularMolarityM ?? 0.28;
    const mExt = ctx.params.extracellularMolarityM ?? ctx.params.sucroseConcMolar ?? 0.3;
    const iInt = ctx.params.vantHoffFactorInt ?? 1.0;
    const iExt = ctx.params.vantHoffFactorExt ?? 1.0;
    const tempC = ctx.params.temperatureC ?? ctx.params.solutionTempC ?? 25.0;
    const hasWall = (ctx.params.hasCellWall ?? 1) >= 0.5;

    const next = stepCellOsmosisRK4(
      ctx.state.volumeUm3,
      v0,
      mInt,
      mExt,
      iInt,
      iExt,
      tempC,
      hasWall,
      FIXED_DT
    );
    ctx.state.volumeUm3 = next.volumeNextUm3;
    ctx.state.netWaterFluxUm3PerSec = next.netWaterFluxUm3PerSec;
    ctx.state.turgorPressureAtm = next.turgorPressureAtm;
    ctx.state.osmoticPressureIntAtm = next.osmoticPressureIntAtm;
    ctx.state.osmoticPressureExtAtm = next.osmoticPressureExtAtm;
    ctx.state.isPlasmolyzed = next.isPlasmolyzed ? 1 : 0;
    ctx.state.isLysed = next.isLysed ? 1 : 0;

    if (next.isLysed && !ctx.bioEventTriggered) {
      ctx.bioEventTriggered = true;
      event = {
        type: 'cell-lysis',
        payload: {
          time: Number(ctx.time.toFixed(2)),
          volumeUm3: Number(next.volumeNextUm3.toFixed(1)),
        },
      };
    } else if (
      next.isPlasmolyzed &&
      !ctx.bioEventTriggered &&
      next.volumeNextUm3 <= 0.85 * v0
    ) {
      ctx.bioEventTriggered = true;
      event = {
        type: 'cell-plasmolysis',
        payload: {
          time: Number(ctx.time.toFixed(2)),
          volumeUm3: Number(next.volumeNextUm3.toFixed(1)),
        },
      };
    }
  } else if (ctx.mode === 'anatomy-cardiovascular-heart') {
    const cv = calculateCardiovascularHeart({
      heartRateBpm: ctx.params.heartRateBpm ?? 72,
      vesselRadiusRatio: ctx.params.vesselRadiusRatio ?? 1.0,
      bloodViscosity: ctx.params.bloodViscosity ?? 3.5,
      exerciseIntensity: ctx.params.exerciseIntensity ?? 20,
      timeSec: ctx.time,
    });
    ctx.state.strokeVolumeMl = cv.strokeVolumeMl;
    ctx.state.cardiacOutputLMin = cv.cardiacOutputLMin;
    ctx.state.vascularResistance = cv.vascularResistance;
    ctx.state.systolicMmHg = cv.systolicMmHg;
    ctx.state.diastolicMmHg = cv.diastolicMmHg;
    ctx.state.meanArterialPressure = cv.meanArterialPressure;
    ctx.state.ecgVoltageMv = cv.ecgVoltageMv;
  } else if (ctx.mode === 'anatomy-respiratory-lungs') {
    const resp = calculateRespiratoryLungs({
      respirationRate: ctx.params.respirationRate ?? 15,
      diaphragmEffort: ctx.params.diaphragmEffort ?? 50,
      airwayResistance: ctx.params.airwayResistance ?? 1.0,
      altitudeMeters: ctx.params.altitudeMeters ?? 0,
      timeSec: ctx.time,
    });
    ctx.state.tidalVolumeMl = resp.tidalVolumeMl;
    ctx.state.minuteVentilationLMin = resp.minuteVentilationLMin;
    ctx.state.alveolarPo2MmHg = resp.alveolarPo2MmHg;
    ctx.state.spo2Percent = resp.spo2Percent;
    ctx.state.instantLungVolumeMl = resp.instantLungVolumeMl;
    if (resp.spo2Percent < 85 && !ctx.bioEventTriggered) {
      ctx.bioEventTriggered = true;
      event = {
        type: 'hypoxia-alert',
        payload: {
          time: Number(ctx.time.toFixed(2)),
          spo2Percent: resp.spo2Percent,
        },
      };
    }
  } else if (ctx.mode === 'anatomy-neural-synapse') {
    const neu = calculateNeuralSynapse({
      stimulusVoltageMv: ctx.params.stimulusVoltageMv ?? -40,
      myelinThickness: ctx.params.myelinThickness ?? 75,
      extracellularNaMm: ctx.params.extracellularNaMm ?? 145,
      extracellularKMm: ctx.params.extracellularKMm ?? 4.5,
      timeSec: ctx.time,
    });
    ctx.state.nernstNaMv = neu.nernstNaMv;
    ctx.state.nernstKMv = neu.nernstKMv;
    ctx.state.restingPotentialMv = neu.restingPotentialMv;
    ctx.state.conductionVelocityMs = neu.conductionVelocityMs;
    ctx.state.membranePotentialMv = neu.membranePotentialMv;
    ctx.state.actionPotentialTriggered = neu.actionPotentialTriggered ? 1 : 0;
    if (neu.actionPotentialTriggered && !ctx.bioEventTriggered) {
      ctx.bioEventTriggered = true;
      event = {
        type: 'action-potential-fired',
        payload: {
          time: Number(ctx.time.toFixed(2)),
          conductionVelocityMs: neu.conductionVelocityMs,
        },
      };
    }
  }

  return event;
}

export function buildBiologyDomainFrame(ctx: WorkerDomainMutableContext): SimulationFrame {
  const timestamp = Number(ctx.time.toFixed(3));
  const positions: Record<string, Vector3Tuple> = {};
  const velocities: Record<string, Vector3Tuple> = {};
  const accelerations: Record<string, Vector3Tuple> = {};
  let kinetic = 0;
  let potential = 0;
  let thermal = 0;
  let total = 0;
  const scalars: Record<string, number> = {};

  if (ctx.mode === 'predator-prey-dynamics') {
    const x = ctx.state.preyX ?? 40;
    const y = ctx.state.predatorY ?? 9;
    const dx = ctx.state.dPreyDt ?? 0;
    const dy = ctx.state.dPredatorDt ?? 0;
    const h = ctx.state.phaseInvariantH ?? 0;

    positions.ecosystem = { x, y, z: 0 };
    velocities.ecosystem = { x: dx, y: dy, z: 0 };
    accelerations.ecosystem = { x: 0, y: 0, z: 0 };

    kinetic = Number(x.toFixed(3));
    potential = Number(y.toFixed(3));
    thermal = 0;
    total = Number(h.toFixed(4));
    scalars.preyPopulation = Number(x.toFixed(3));
    scalars.predatorPopulation = Number(y.toFixed(3));
    scalars.dPreyDt = Number(dx.toFixed(4));
    scalars.dPredatorDt = Number(dy.toFixed(4));
    scalars.phaseInvariantH = Number(h.toFixed(4));
  } else if (ctx.mode === 'cell-osmosis-tonicity') {
    const vol = ctx.state.volumeUm3 ?? 1000;
    const v0 = ctx.state.initialVolumeUm3 ?? 1000;
    const flux = ctx.state.netWaterFluxUm3PerSec ?? 0;
    const turgor = ctx.state.turgorPressureAtm ?? 0;
    const piInt = ctx.state.osmoticPressureIntAtm ?? 0;
    const piExt = ctx.state.osmoticPressureExtAtm ?? 0;

    positions.cell = { x: vol / v0, y: turgor, z: 0 };
    velocities.cell = { x: flux / v0, y: 0, z: 0 };
    accelerations.cell = { x: 0, y: 0, z: 0 };

    kinetic = Number(Math.abs(flux).toFixed(3));
    potential = Number(turgor.toFixed(4));
    thermal = Number(piExt.toFixed(4));
    total = Number(piInt.toFixed(4));
    scalars.cellVolumeUm3 = Number(vol.toFixed(2));
    scalars.volumeRatio = Number((vol / v0).toFixed(4));
    scalars.netWaterFluxUm3PerSec = Number(flux.toFixed(3));
    scalars.turgorPressureAtm = Number(turgor.toFixed(4));
    scalars.osmoticPressureIntAtm = Number(piInt.toFixed(4));
    scalars.osmoticPressureExtAtm = Number(piExt.toFixed(4));
  } else if (ctx.mode === 'anatomy-cardiovascular-heart') {
    const sv = ctx.state.strokeVolumeMl ?? 70;
    const co = ctx.state.cardiacOutputLMin ?? 5.04;
    const r = ctx.state.vascularResistance ?? 1.0;
    const sbp = ctx.state.systolicMmHg ?? 120;
    const dbp = ctx.state.diastolicMmHg ?? 80;
    const map = ctx.state.meanArterialPressure ?? 93.3;
    const ecg = ctx.state.ecgVoltageMv ?? 0;

    positions.heart = { x: co, y: map, z: ecg };
    velocities.heart = { x: sv, y: sbp - dbp, z: 0 };
    accelerations.heart = { x: 0, y: 0, z: 0 };

    kinetic = Number(co.toFixed(2));
    potential = Number(map.toFixed(1));
    thermal = Number(r.toFixed(3));
    total = Number(sbp.toFixed(1));

    scalars.strokeVolumeMl = sv;
    scalars.cardiacOutputLMin = co;
    scalars.vascularResistance = r;
    scalars.systolicMmHg = sbp;
    scalars.diastolicMmHg = dbp;
    scalars.meanArterialPressure = map;
    scalars.ecgVoltageMv = ecg;
  } else if (ctx.mode === 'anatomy-respiratory-lungs') {
    const tv = ctx.state.tidalVolumeMl ?? 500;
    const ve = ctx.state.minuteVentilationLMin ?? 7.5;
    const pao2 = ctx.state.alveolarPo2MmHg ?? 102;
    const spo2 = ctx.state.spo2Percent ?? 97.5;
    const vol = ctx.state.instantLungVolumeMl ?? 2650;

    positions.lungs = { x: tv, y: spo2, z: vol };
    velocities.lungs = { x: ve, y: pao2, z: 0 };
    accelerations.lungs = { x: 0, y: 0, z: 0 };

    kinetic = Number(ve.toFixed(2));
    potential = Number(pao2.toFixed(1));
    thermal = 0;
    total = Number(spo2.toFixed(2));

    scalars.tidalVolumeMl = tv;
    scalars.minuteVentilationLMin = ve;
    scalars.alveolarPo2MmHg = pao2;
    scalars.spo2Percent = spo2;
    scalars.instantLungVolumeMl = vol;
  } else if (ctx.mode === 'anatomy-neural-synapse') {
    const eNa = ctx.state.nernstNaMv ?? 60.7;
    const eK = ctx.state.nernstKMv ?? -91.8;
    const vRest = ctx.state.restingPotentialMv ?? -70;
    const vel = ctx.state.conductionVelocityMs ?? 80;
    const vm = ctx.state.membranePotentialMv ?? -70;
    const fired = ctx.state.actionPotentialTriggered ?? 1;

    positions.neuron = { x: vm, y: vel, z: fired };
    velocities.neuron = { x: eNa, y: eK, z: 0 };
    accelerations.neuron = { x: 0, y: 0, z: 0 };

    kinetic = Number(vel.toFixed(2));
    potential = Number(vm.toFixed(2));
    thermal = Number(vRest.toFixed(2));
    total = Number(eNa.toFixed(2));

    scalars.nernstNaMv = eNa;
    scalars.nernstKMv = eK;
    scalars.restingPotentialMv = vRest;
    scalars.conductionVelocityMs = vel;
    scalars.membranePotentialMv = vm;
    scalars.actionPotentialTriggered = fired;
  }

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
