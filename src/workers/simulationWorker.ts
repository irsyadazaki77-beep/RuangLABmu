/**
 * Deterministic Web Worker Physics Simulation Engine
 * Runs continuous numerical integration at fixed timestep dt = 1/60s
 * using Runge-Kutta 4th Order (RK4) and Velocity Verlet integrators.
 */

import {
  packSimulationFrame,
  SimulationFrame,
  SimulationRingBuffer,
  Vector3Tuple,
} from '../utils/simulationBuffer';
import {
  SimulationMode,
  SimulationEventType,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../types/simulationWorkerTypes';
import {
  calculateEnzymeKinetics,
  calculateCellOsmosisTonicity,
  calculateCardiovascularHeart,
  calculateRespiratoryLungs,
  calculateNeuralSynapse,
} from '../utils/scienceEngine';

export const FIXED_DT = 1.0 / 60.0; // 60 Hz fixed timestep
export const MAX_STEP_FRAMES = 3600; // Hard cap: max 60 seconds simulated per STEP_FRAMES batch

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
): { xNext: number; yNext: number; vxNext: number; vyNext: number; axNext: number; ayNext: number } {
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

  const xNext = x + (dt / 6.0) * (vx + 2.0 * (vx + 0.5 * dt * k1.ax) + 2.0 * (vx + 0.5 * dt * k2.ax) + (vx + dt * k3.ax));
  const yNext = y + (dt / 6.0) * (vy + 2.0 * (vy + 0.5 * dt * k1.ay) + 2.0 * (vy + 0.5 * dt * k2.ay) + (vy + dt * k3.ay));

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
): { rxNext: number; ryNext: number; vxNext: number; vyNext: number; axNext: number; ayNext: number } {
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

  interface EnzymeKineticsRateEval {
    rateMmPerSec: number;
    rawVelocity: number;
    thermalFactor: number;
    phFactor: number;
    denaturationDegreePct: number;
  }

  const k1 = evalVelocity(sCurr);
  const k2 = evalVelocity(sCurr - 0.5 * dt * k1.rateMmPerSec);
  const k3 = evalVelocity(sCurr - 0.5 * dt * k2.rateMmPerSec);
  const k4 = evalVelocity(sCurr - dt * k3.rateMmPerSec);

  const deltaS = (dt / 6.0) * (k1.rateMmPerSec + 2.0 * k2.rateMmPerSec + 2.0 * k3.rateMmPerSec + k4.rateMmPerSec);
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

// Internal worker state class
export class WorkerSimulationContext {
  public mode: SimulationMode = 'newton-incline';
  public params: Record<string, number> = {};
  public isPlaying = false;
  public frameIndex = 0;
  public time = 0;
  public ringBuffer = new SimulationRingBuffer(1800);

  // Dynamic simulation variables
  public state: Record<string, number> = {};
  public initialMechanicalEnergy = 0;
  public previousAngle = 0;
  public angleAccum = 0;
  public collisionOccurred = false;
  public groundHitOccurred = false;
  public bioEventTriggered = false;

  constructor() {
    this.initDefault();
  }

  public init(mode: SimulationMode, params: Record<string, number>): void {
    this.mode = mode;
    this.params = { ...params };
    this.isPlaying = false;
    this.frameIndex = 0;
    this.time = 0;
    this.ringBuffer.clear();
    this.collisionOccurred = false;
    this.groundHitOccurred = false;
    this.bioEventTriggered = false;
    this.angleAccum = 0;
    this.previousAngle = 0;

    this.initModeState();
    const initialFrame = this.buildCurrentFrame();
    this.ringBuffer.push(initialFrame);
  }

  public updateParams(newParams: Record<string, number>): void {
    this.params = { ...this.params, ...newParams };
  }

  public reset(): void {
    this.init(this.mode, this.params);
  }

  private initDefault(): void {
    this.params = {
      mass: 4.0,
      appliedForce: 45,
      inclineAngle: 15,
      frictionCoeffStatic: 0.2,
      frictionCoeffKinetic: 0.15,
      gravity: 9.81,
      initialVelocity: 0,
      launchAngle: 45,
      initialHeight: 0,
      springConstantK: 120,
      springDisplacement: 0.8,
      dampingCoeff: 0.15,
      collisionMass2: 2.0,
      velocity2Initial: -2.0,
      restitutionCoeff: 1.0,
      centralStarMassSolar: 1.0,
      semiMajorAxisAu: 1.0,
      eccentricity: 0.017,
      dragCoeff: 0.0,
    };
    this.initModeState();
  }

  private initModeState(): void {
    if (this.mode === 'spring-hooke') {
      const x0 = this.params.springDisplacement ?? 0.8;
      const v0 = 0;
      const k = this.params.springConstantK ?? 120;
      this.state = { x: x0, v: v0, a: 0 };
      this.initialMechanicalEnergy = 0.5 * k * x0 * x0;
    } else if (this.mode === 'projectile-gravity') {
      const v0 = this.params.initialVelocity ?? 22;
      const angleRad = ((this.params.launchAngle ?? 45) * Math.PI) / 180.0;
      const h0 = this.params.initialHeight ?? 0;
      const vx0 = v0 * Math.cos(angleRad);
      const vy0 = v0 * Math.sin(angleRad);
      const g = this.params.gravity ?? 9.81;
      const m = this.params.mass ?? 2.5;

      this.state = { x: 0, y: h0, vx: vx0, vy: vy0, ax: 0, ay: -g };
      this.initialMechanicalEnergy = 0.5 * m * v0 * v0 + m * g * h0;
    } else if (this.mode === 'orbital-gravity') {
      const mStar = this.params.centralStarMassSolar ?? 1.0;
      const aAu = Math.max(0.1, this.params.semiMajorAxisAu ?? 1.0);
      const e = Math.min(0.95, Math.max(0.0, this.params.eccentricity ?? 0.017));
      const mu = 39.478 * mStar; // (2pi)^2 * M_star in AU and years; scale for simulation
      const rPerihelion = aAu * (1.0 - e);
      const vPerihelion = Math.sqrt((mu * (1.0 + e)) / (aAu * Math.max(0.05, 1.0 - e)));

      this.state = {
        rx: rPerihelion,
        ry: 0,
        vx: 0,
        vy: vPerihelion,
        ax: -(mu / (rPerihelion * rPerihelion)),
        ay: 0,
        mu,
      };
      this.previousAngle = 0;
      this.angleAccum = 0;
      const m = this.params.mass ?? 1.0;
      this.initialMechanicalEnergy = 0.5 * m * vPerihelion * vPerihelion - (mu * m) / rPerihelion;
    } else if (this.mode === 'collision-momentum') {
      this.state = {
        x1: 2.0,
        v1: this.params.initialVelocity ?? 6.0,
        x2: 12.0,
        v2: this.params.velocity2Initial ?? -2.0,
        a1: 0,
        a2: 0,
      };
      const m1 = this.params.mass ?? 4.0;
      const m2 = this.params.collisionMass2 ?? 2.0;
      const v1 = this.state.v1;
      const v2 = this.state.v2;
      this.initialMechanicalEnergy = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
    } else if (this.mode === 'enzyme-kinetics') {
      const s0 = this.params.substrateConcMm ?? 10.0;
      const vMax = this.params.vMaxBase ?? 120.0 * (this.params.enzymeVolumeMl ?? 1.0);
      const km = this.params.kmConstantMm ?? 4.5;
      const tempC = this.params.temperatureC ?? 37.0;
      const ph = this.params.solutionPh ?? this.params.solutionPH ?? 7.0;
      const initKin = calculateEnzymeKinetics({
        substrateConcMm: s0,
        vMaxBase: vMax,
        kmConstantMm: km,
        temperatureC: tempC,
        solutionPh: ph,
      });
      this.state = {
        substrateMm: s0,
        productMm: 0,
        reactionVelocityV: initKin.reactionVelocityV,
        thermalFactor: initKin.thermalFactor,
        phFactor: initKin.phFactor,
        denaturationDegreePct: initKin.denaturationDegreePct,
      };
      this.initialMechanicalEnergy = s0;
    } else if (this.mode === 'predator-prey-dynamics') {
      const x0 = this.params.preyPopulationX ?? 40.0;
      const y0 = this.params.predatorPopulationY ?? 9.0;
      const alpha = this.params.preyGrowthRateAlpha ?? 1.1;
      const beta = this.params.predationRateBeta ?? 0.04;
      const delta = this.params.predatorReproductionDelta ?? 0.01;
      const gamma = this.params.predatorMortalityGamma ?? 0.4;
      const dx0 = alpha * x0 - beta * x0 * y0;
      const dy0 = delta * x0 * y0 - gamma * y0;
      const h0 =
        delta * Math.max(1e-4, x0) -
        gamma * Math.log(Math.max(1e-4, x0)) +
        beta * Math.max(1e-4, y0) -
        alpha * Math.log(Math.max(1e-4, y0));
      this.state = {
        preyX: x0,
        predatorY: y0,
        dPreyDt: dx0,
        dPredatorDt: dy0,
        phaseInvariantH: h0,
      };
      this.initialMechanicalEnergy = h0;
    } else if (this.mode === 'cell-osmosis-tonicity') {
      const v0 = this.params.initialCellVolumeUm3 ?? 1000.0;
      const mInt = this.params.intracellularMolarityM ?? 0.28;
      const mExt = this.params.extracellularMolarityM ?? this.params.sucroseConcMolar ?? 0.30;
      const tempC = this.params.temperatureC ?? this.params.solutionTempC ?? 25.0;
      const hasWall = (this.params.hasCellWall ?? 1) >= 0.5;
      const initOsm = calculateCellOsmosisTonicity({
        intracellularMolarityM: mInt,
        extracellularMolarityM: mExt,
        temperatureC: tempC,
        initialCellVolumeUm3: v0,
        currentCellVolumeUm3: v0,
        hasCellWall: hasWall,
      });
      this.state = {
        volumeUm3: v0,
        initialVolumeUm3: v0,
        netWaterFluxUm3PerSec: initOsm.netWaterFluxUm3PerSec,
        turgorPressureAtm: initOsm.turgorPressureAtm,
        osmoticPressureIntAtm: initOsm.osmoticPressureIntAtm,
        osmoticPressureExtAtm: initOsm.osmoticPressureExtAtm,
        isPlasmolyzed: initOsm.isPlasmolyzed ? 1 : 0,
        isLysed: initOsm.isLysed ? 1 : 0,
      };
      this.initialMechanicalEnergy = initOsm.osmoticPressureIntAtm;
    } else if (this.mode === 'anatomy-cardiovascular-heart') {
      const cv = calculateCardiovascularHeart({
        heartRateBpm: this.params.heartRateBpm ?? 72,
        vesselRadiusRatio: this.params.vesselRadiusRatio ?? 1.0,
        bloodViscosity: this.params.bloodViscosity ?? 3.5,
        exerciseIntensity: this.params.exerciseIntensity ?? 20,
        timeSec: 0,
      });
      this.state = {
        strokeVolumeMl: cv.strokeVolumeMl,
        cardiacOutputLMin: cv.cardiacOutputLMin,
        vascularResistance: cv.vascularResistance,
        systolicMmHg: cv.systolicMmHg,
        diastolicMmHg: cv.diastolicMmHg,
        meanArterialPressure: cv.meanArterialPressure,
        ecgVoltageMv: cv.ecgVoltageMv,
      };
      this.initialMechanicalEnergy = cv.meanArterialPressure;
    } else if (this.mode === 'anatomy-respiratory-lungs') {
      const resp = calculateRespiratoryLungs({
        respirationRate: this.params.respirationRate ?? 15,
        diaphragmEffort: this.params.diaphragmEffort ?? 50,
        airwayResistance: this.params.airwayResistance ?? 1.0,
        altitudeMeters: this.params.altitudeMeters ?? 0,
        timeSec: 0,
      });
      this.state = {
        tidalVolumeMl: resp.tidalVolumeMl,
        minuteVentilationLMin: resp.minuteVentilationLMin,
        alveolarPo2MmHg: resp.alveolarPo2MmHg,
        spo2Percent: resp.spo2Percent,
        instantLungVolumeMl: resp.instantLungVolumeMl,
      };
      this.initialMechanicalEnergy = resp.spo2Percent;
    } else if (this.mode === 'anatomy-neural-synapse') {
      const neu = calculateNeuralSynapse({
        stimulusVoltageMv: this.params.stimulusVoltageMv ?? -40,
        myelinThickness: this.params.myelinThickness ?? 75,
        extracellularNaMm: this.params.extracellularNaMm ?? 145,
        extracellularKMm: this.params.extracellularKMm ?? 4.5,
        timeSec: 0,
      });
      this.state = {
        nernstNaMv: neu.nernstNaMv,
        nernstKMv: neu.nernstKMv,
        restingPotentialMv: neu.restingPotentialMv,
        conductionVelocityMs: neu.conductionVelocityMs,
        membranePotentialMv: neu.membranePotentialMv,
        actionPotentialTriggered: neu.actionPotentialTriggered ? 1 : 0,
      };
      this.initialMechanicalEnergy = neu.restingPotentialMv;
    } else {
      // newton-incline
      this.state = {
        s: 0,
        v: this.params.initialVelocity ?? 0,
        a: 0,
      };
      this.initialMechanicalEnergy = 0;
    }
  }

  public step(): { frame: SimulationFrame; event?: { type: SimulationEventType; payload: Record<string, number> } } {
    this.frameIndex++;
    this.time += FIXED_DT;
    let event: { type: SimulationEventType; payload: Record<string, number> } | undefined;

    if (this.mode === 'spring-hooke') {
      const m = this.params.mass ?? 4.0;
      const k = this.params.springConstantK ?? 120;
      const c = this.params.dampingCoeff ?? 0.15;
      const { xNext, vNext, aNext } = stepSpringHookeRK4(
        this.state.x,
        this.state.v,
        m,
        k,
        c,
        FIXED_DT
      );
      this.state.x = xNext;
      this.state.v = vNext;
      this.state.a = aNext;
    } else if (this.mode === 'projectile-gravity') {
      const m = this.params.mass ?? 2.5;
      const g = this.params.gravity ?? 9.81;
      const drag = this.params.dragCoeff ?? 0.0;

      if (this.state.y <= 0 && this.state.vy <= 0) {
        // stationary on ground
        this.state.vx = 0;
        this.state.vy = 0;
        this.state.ax = 0;
        this.state.ay = 0;
      } else {
        const { xNext, yNext, vxNext, vyNext, axNext, ayNext } = stepProjectileRK4(
          this.state.x,
          this.state.y,
          this.state.vx,
          this.state.vy,
          m,
          g,
          drag,
          FIXED_DT
        );

        if (yNext <= 0 && !this.groundHitOccurred) {
          this.groundHitOccurred = true;
          this.state.x = xNext;
          this.state.y = 0;
          this.state.vx = 0;
          this.state.vy = 0;
          this.state.ax = 0;
          this.state.ay = 0;
          event = {
            type: 'ground-hit',
            payload: { x: Number(xNext.toFixed(2)), time: Number(this.time.toFixed(2)) },
          };
        } else {
          this.state.x = xNext;
          this.state.y = Math.max(0, yNext);
          this.state.vx = vxNext;
          this.state.vy = vyNext;
          this.state.ax = axNext;
          this.state.ay = ayNext;
        }
      }
    } else if (this.mode === 'orbital-gravity') {
      const mu = this.state.mu ?? (39.478 * (this.params.centralStarMassSolar ?? 1.0));
      const { rxNext, ryNext, vxNext, vyNext, axNext, ayNext } = stepOrbitalVerlet(
        this.state.rx,
        this.state.ry,
        this.state.vx,
        this.state.vy,
        mu,
        FIXED_DT
      );

      const currentAngle = Math.atan2(ryNext, rxNext);
      let dTheta = currentAngle - this.previousAngle;
      if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
      if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
      this.angleAccum += Math.abs(dTheta);
      this.previousAngle = currentAngle;

      if (this.angleAccum >= 2.0 * Math.PI) {
        this.angleAccum -= 2.0 * Math.PI;
        event = {
          type: 'orbit-complete',
          payload: { period: Number(this.time.toFixed(3)), a: this.params.semiMajorAxisAu ?? 1.0 },
        };
      }

      this.state.rx = rxNext;
      this.state.ry = ryNext;
      this.state.vx = vxNext;
      this.state.vy = vyNext;
      this.state.ax = axNext;
      this.state.ay = ayNext;
    } else if (this.mode === 'collision-momentum') {
      const m1 = this.params.mass ?? 4.0;
      const m2 = this.params.collisionMass2 ?? 2.0;
      const e = Math.min(1.0, Math.max(0.0, this.params.restitutionCoeff ?? 1.0));

      let { x1, v1, x2, v2 } = this.state;
      x1 += v1 * FIXED_DT;
      x2 += v2 * FIXED_DT;

      const contactDistance = 1.0;
      if (x1 + contactDistance >= x2 && !this.collisionOccurred && v1 > v2) {
        this.collisionOccurred = true;
        const v1Final = ((m1 - e * m2) * v1 + (1.0 + e) * m2 * v2) / (m1 + m2);
        const v2Final = ((m2 - e * m1) * v2 + (1.0 + e) * m1 * v1) / (m1 + m2);

        v1 = v1Final;
        v2 = v2Final;

        const ekInitial = 0.5 * m1 * this.state.v1 * this.state.v1 + 0.5 * m2 * this.state.v2 * this.state.v2;
        const ekFinal = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
        const energyLossPct = ekInitial > 0 ? ((ekInitial - ekFinal) / ekInitial) * 100 : 0;

        event = {
          type: 'collision',
          payload: {
            time: Number(this.time.toFixed(2)),
            v1Final: Number(v1.toFixed(2)),
            v2Final: Number(v2.toFixed(2)),
            energyLossPct: Number(energyLossPct.toFixed(1)),
          },
        };
      }

      this.state.x1 = x1;
      this.state.v1 = v1;
      this.state.x2 = x2;
      this.state.v2 = v2;
    } else if (this.mode === 'enzyme-kinetics') {
      const vMax = this.params.vMaxBase ?? 120.0 * (this.params.enzymeVolumeMl ?? 1.0);
      const km = this.params.kmConstantMm ?? 4.5;
      const tempC = this.params.temperatureC ?? 37.0;
      const ph = this.params.solutionPh ?? this.params.solutionPH ?? 7.0;

      const next = stepEnzymeKineticsRK4(
        this.state.substrateMm,
        this.state.productMm,
        vMax,
        km,
        tempC,
        ph,
        FIXED_DT
      );
      this.state.substrateMm = next.substrateNext;
      this.state.productMm = next.productNext;
      this.state.reactionVelocityV = next.reactionVelocityV;
      this.state.thermalFactor = next.thermalFactor;
      this.state.phFactor = next.phFactor;
      this.state.denaturationDegreePct = next.denaturationDegreePct;

      if (next.substrateNext <= 0.05 && !this.bioEventTriggered) {
        this.bioEventTriggered = true;
        event = {
          type: 'substrate-depleted',
          payload: {
            time: Number(this.time.toFixed(2)),
            productMm: Number(next.productNext.toFixed(3)),
          },
        };
      }
    } else if (this.mode === 'predator-prey-dynamics') {
      const alpha = this.params.preyGrowthRateAlpha ?? 1.1;
      const beta = this.params.predationRateBeta ?? 0.04;
      const delta = this.params.predatorReproductionDelta ?? 0.01;
      const gamma = this.params.predatorMortalityGamma ?? 0.4;

      const next = stepLotkaVolterraRK4(
        this.state.preyX,
        this.state.predatorY,
        alpha,
        beta,
        delta,
        gamma,
        FIXED_DT
      );
      this.state.preyX = next.preyNext;
      this.state.predatorY = next.predatorNext;
      this.state.dPreyDt = next.dPreyDt;
      this.state.dPredatorDt = next.dPredatorDt;
      this.state.phaseInvariantH = next.phaseInvariantH;
    } else if (this.mode === 'cell-osmosis-tonicity') {
      const v0 = this.state.initialVolumeUm3 ?? 1000.0;
      const mInt = this.params.intracellularMolarityM ?? 0.28;
      const mExt = this.params.extracellularMolarityM ?? this.params.sucroseConcMolar ?? 0.30;
      const iInt = this.params.vantHoffFactorInt ?? 1.0;
      const iExt = this.params.vantHoffFactorExt ?? 1.0;
      const tempC = this.params.temperatureC ?? this.params.solutionTempC ?? 25.0;
      const hasWall = (this.params.hasCellWall ?? 1) >= 0.5;

      const next = stepCellOsmosisRK4(
        this.state.volumeUm3,
        v0,
        mInt,
        mExt,
        iInt,
        iExt,
        tempC,
        hasWall,
        FIXED_DT
      );
      this.state.volumeUm3 = next.volumeNextUm3;
      this.state.netWaterFluxUm3PerSec = next.netWaterFluxUm3PerSec;
      this.state.turgorPressureAtm = next.turgorPressureAtm;
      this.state.osmoticPressureIntAtm = next.osmoticPressureIntAtm;
      this.state.osmoticPressureExtAtm = next.osmoticPressureExtAtm;
      this.state.isPlasmolyzed = next.isPlasmolyzed ? 1 : 0;
      this.state.isLysed = next.isLysed ? 1 : 0;

      if (next.isLysed && !this.bioEventTriggered) {
        this.bioEventTriggered = true;
        event = {
          type: 'cell-lysis',
          payload: {
            time: Number(this.time.toFixed(2)),
            volumeUm3: Number(next.volumeNextUm3.toFixed(1)),
          },
        };
      } else if (next.isPlasmolyzed && !this.bioEventTriggered && next.volumeNextUm3 <= 0.85 * v0) {
        this.bioEventTriggered = true;
        event = {
          type: 'cell-plasmolysis',
          payload: {
            time: Number(this.time.toFixed(2)),
            volumeUm3: Number(next.volumeNextUm3.toFixed(1)),
          },
        };
      }
    } else if (this.mode === 'anatomy-cardiovascular-heart') {
      const cv = calculateCardiovascularHeart({
        heartRateBpm: this.params.heartRateBpm ?? 72,
        vesselRadiusRatio: this.params.vesselRadiusRatio ?? 1.0,
        bloodViscosity: this.params.bloodViscosity ?? 3.5,
        exerciseIntensity: this.params.exerciseIntensity ?? 20,
        timeSec: this.time,
      });
      this.state.strokeVolumeMl = cv.strokeVolumeMl;
      this.state.cardiacOutputLMin = cv.cardiacOutputLMin;
      this.state.vascularResistance = cv.vascularResistance;
      this.state.systolicMmHg = cv.systolicMmHg;
      this.state.diastolicMmHg = cv.diastolicMmHg;
      this.state.meanArterialPressure = cv.meanArterialPressure;
      this.state.ecgVoltageMv = cv.ecgVoltageMv;
    } else if (this.mode === 'anatomy-respiratory-lungs') {
      const resp = calculateRespiratoryLungs({
        respirationRate: this.params.respirationRate ?? 15,
        diaphragmEffort: this.params.diaphragmEffort ?? 50,
        airwayResistance: this.params.airwayResistance ?? 1.0,
        altitudeMeters: this.params.altitudeMeters ?? 0,
        timeSec: this.time,
      });
      this.state.tidalVolumeMl = resp.tidalVolumeMl;
      this.state.minuteVentilationLMin = resp.minuteVentilationLMin;
      this.state.alveolarPo2MmHg = resp.alveolarPo2MmHg;
      this.state.spo2Percent = resp.spo2Percent;
      this.state.instantLungVolumeMl = resp.instantLungVolumeMl;
      if (resp.spo2Percent < 85 && !this.bioEventTriggered) {
        this.bioEventTriggered = true;
        event = {
          type: 'hypoxia-alert',
          payload: {
            time: Number(this.time.toFixed(2)),
            spo2Percent: resp.spo2Percent,
          },
        };
      }
    } else if (this.mode === 'anatomy-neural-synapse') {
      const neu = calculateNeuralSynapse({
        stimulusVoltageMv: this.params.stimulusVoltageMv ?? -40,
        myelinThickness: this.params.myelinThickness ?? 75,
        extracellularNaMm: this.params.extracellularNaMm ?? 145,
        extracellularKMm: this.params.extracellularKMm ?? 4.5,
        timeSec: this.time,
      });
      this.state.nernstNaMv = neu.nernstNaMv;
      this.state.nernstKMv = neu.nernstKMv;
      this.state.restingPotentialMv = neu.restingPotentialMv;
      this.state.conductionVelocityMs = neu.conductionVelocityMs;
      this.state.membranePotentialMv = neu.membranePotentialMv;
      this.state.actionPotentialTriggered = neu.actionPotentialTriggered ? 1 : 0;
      if (neu.actionPotentialTriggered && !this.bioEventTriggered) {
        this.bioEventTriggered = true;
        event = {
          type: 'action-potential-fired',
          payload: {
            time: Number(this.time.toFixed(2)),
            conductionVelocityMs: neu.conductionVelocityMs,
          },
        };
      }
    } else {
      // newton-incline
      const m = this.params.mass ?? 4.0;
      const F = this.params.appliedForce ?? 45;
      const theta = ((this.params.inclineAngle ?? 15) * Math.PI) / 180.0;
      const g = this.params.gravity ?? 9.81;
      const muK = this.params.frictionCoeffKinetic ?? 0.15;
      const muS = this.params.frictionCoeffStatic ?? 0.2;

      const N = m * g * Math.cos(theta);
      const fParallel = m * g * Math.sin(theta);
      const fsMax = muS * N;
      const fk = muK * N;

      const driving = F - fParallel;
      let accel = 0;

      if (Math.abs(this.state.v) > 0.001) {
        const fFric = -Math.sign(this.state.v) * fk;
        accel = (driving + fFric) / m;
      } else {
        if (Math.abs(driving) > fsMax) {
          accel = (driving - Math.sign(driving) * fk) / m;
        } else {
          accel = 0;
          this.state.v = 0;
        }
      }

      this.state.v += accel * FIXED_DT;
      this.state.s += this.state.v * FIXED_DT;
      this.state.a = accel;
    }

    const frame = this.buildCurrentFrame();
    this.ringBuffer.push(frame);

    return { frame, event };
  }

  public buildCurrentFrame(): SimulationFrame {
    const timestamp = Number(this.time.toFixed(3));
    const positions: Record<string, Vector3Tuple> = {};
    const velocities: Record<string, Vector3Tuple> = {};
    const accelerations: Record<string, Vector3Tuple> = {};
    let kinetic = 0;
    let potential = 0;
    let thermal = 0;
    let total = 0;
    const scalars: Record<string, number> = {};

    if (this.mode === 'spring-hooke') {
      const m = this.params.mass ?? 4.0;
      const k = this.params.springConstantK ?? 120;
      const x = this.state.x ?? 0;
      const v = this.state.v ?? 0;
      const a = this.state.a ?? 0;

      positions.mass = { x, y: 0, z: 0 };
      velocities.mass = { x: v, y: 0, z: 0 };
      accelerations.mass = { x: a, y: 0, z: 0 };

      kinetic = Number((0.5 * m * v * v).toFixed(3));
      potential = Number((0.5 * k * x * x).toFixed(3));
      thermal = Number(Math.max(0, this.initialMechanicalEnergy - (kinetic + potential)).toFixed(3));
      total = Number((kinetic + potential + thermal).toFixed(3));
      scalars.springExtension = x;
    } else if (this.mode === 'projectile-gravity') {
      const m = this.params.mass ?? 2.5;
      const g = this.params.gravity ?? 9.81;
      const x = this.state.x ?? 0;
      const y = this.state.y ?? 0;
      const vx = this.state.vx ?? 0;
      const vy = this.state.vy ?? 0;
      const ax = this.state.ax ?? 0;
      const ay = this.state.ay ?? 0;

      positions.projectile = { x, y, z: 0 };
      velocities.projectile = { x: vx, y: vy, z: 0 };
      accelerations.projectile = { x: ax, y: ay, z: 0 };

      kinetic = Number((0.5 * m * (vx * vx + vy * vy)).toFixed(3));
      potential = Number((m * g * Math.max(0, y)).toFixed(3));
      thermal = Number(Math.max(0, this.initialMechanicalEnergy - (kinetic + potential)).toFixed(3));
      total = Number((kinetic + potential + thermal).toFixed(3));
      scalars.height = y;
      scalars.range = x;
    } else if (this.mode === 'orbital-gravity') {
      const m = this.params.mass ?? 1.0;
      const rx = this.state.rx ?? 1.0;
      const ry = this.state.ry ?? 0;
      const vx = this.state.vx ?? 0;
      const vy = this.state.vy ?? 0;
      const ax = this.state.ax ?? 0;
      const ay = this.state.ay ?? 0;
      const rDist = Math.max(0.01, Math.hypot(rx, ry));
      const mu = this.state.mu ?? 39.478;

      positions.planet = { x: rx, y: ry, z: 0 };
      velocities.planet = { x: vx, y: vy, z: 0 };
      accelerations.planet = { x: ax, y: ay, z: 0 };

      kinetic = Number((0.5 * m * (vx * vx + vy * vy)).toFixed(3));
      potential = Number((-(mu * m) / rDist + 100).toFixed(3));
      total = Number((kinetic + potential).toFixed(3));
      thermal = 0;
      scalars.orbitalDistance = rDist;
    } else if (this.mode === 'collision-momentum') {
      const m1 = this.params.mass ?? 4.0;
      const m2 = this.params.collisionMass2 ?? 2.0;
      const x1 = this.state.x1 ?? 0;
      const v1 = this.state.v1 ?? 0;
      const x2 = this.state.x2 ?? 0;
      const v2 = this.state.v2 ?? 0;

      positions.body1 = { x: x1, y: 0, z: 0 };
      positions.body2 = { x: x2, y: 0, z: 0 };
      velocities.body1 = { x: v1, y: 0, z: 0 };
      velocities.body2 = { x: v2, y: 0, z: 0 };
      accelerations.body1 = { x: 0, y: 0, z: 0 };
      accelerations.body2 = { x: 0, y: 0, z: 0 };

      kinetic = Number((0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2).toFixed(3));
      potential = 0;
      thermal = Number(Math.max(0, this.initialMechanicalEnergy - kinetic).toFixed(3));
      total = Number((kinetic + thermal).toFixed(3));
      scalars.totalMomentum = Number((m1 * v1 + m2 * v2).toFixed(3));
    } else if (this.mode === 'enzyme-kinetics') {
      const s = this.state.substrateMm ?? 0;
      const p = this.state.productMm ?? 0;
      const v = this.state.reactionVelocityV ?? 0;
      const denat = this.state.denaturationDegreePct ?? 0;

      positions.substrate = { x: s, y: p, z: 0 };
      velocities.substrate = { x: -v * 0.025, y: v * 0.025, z: 0 };
      accelerations.substrate = { x: 0, y: 0, z: 0 };

      kinetic = Number(p.toFixed(4));
      potential = Number(s.toFixed(4));
      thermal = Number(denat.toFixed(2));
      total = Number((s + p).toFixed(4));
      scalars.substrateConcMm = Number(s.toFixed(4));
      scalars.productConcMm = Number(p.toFixed(4));
      scalars.reactionVelocityV = Number(v.toFixed(4));
      scalars.denaturationDegreePct = Number(denat.toFixed(2));
    } else if (this.mode === 'predator-prey-dynamics') {
      const x = this.state.preyX ?? 40;
      const y = this.state.predatorY ?? 9;
      const dx = this.state.dPreyDt ?? 0;
      const dy = this.state.dPredatorDt ?? 0;
      const h = this.state.phaseInvariantH ?? 0;

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
    } else if (this.mode === 'cell-osmosis-tonicity') {
      const vol = this.state.volumeUm3 ?? 1000;
      const v0 = this.state.initialVolumeUm3 ?? 1000;
      const flux = this.state.netWaterFluxUm3PerSec ?? 0;
      const turgor = this.state.turgorPressureAtm ?? 0;
      const piInt = this.state.osmoticPressureIntAtm ?? 0;
      const piExt = this.state.osmoticPressureExtAtm ?? 0;

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
    } else if (this.mode === 'anatomy-cardiovascular-heart') {
      const sv = this.state.strokeVolumeMl ?? 70;
      const co = this.state.cardiacOutputLMin ?? 5.04;
      const r = this.state.vascularResistance ?? 1.0;
      const sbp = this.state.systolicMmHg ?? 120;
      const dbp = this.state.diastolicMmHg ?? 80;
      const map = this.state.meanArterialPressure ?? 93.3;
      const ecg = this.state.ecgVoltageMv ?? 0;

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
    } else if (this.mode === 'anatomy-respiratory-lungs') {
      const tv = this.state.tidalVolumeMl ?? 500;
      const ve = this.state.minuteVentilationLMin ?? 7.5;
      const pao2 = this.state.alveolarPo2MmHg ?? 102;
      const spo2 = this.state.spo2Percent ?? 97.5;
      const vol = this.state.instantLungVolumeMl ?? 2650;

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
    } else if (this.mode === 'anatomy-neural-synapse') {
      const eNa = this.state.nernstNaMv ?? 60.7;
      const eK = this.state.nernstKMv ?? -91.8;
      const vRest = this.state.restingPotentialMv ?? -70;
      const vel = this.state.conductionVelocityMs ?? 80;
      const vm = this.state.membranePotentialMv ?? -70;
      const fired = this.state.actionPotentialTriggered ?? 1;

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
    } else {
      // newton-incline
      const m = this.params.mass ?? 4.0;
      const s = this.state.s ?? 0;
      const v = this.state.v ?? 0;
      const a = this.state.a ?? 0;
      const theta = ((this.params.inclineAngle ?? 15) * Math.PI) / 180.0;
      const g = this.params.gravity ?? 9.81;

      const posX = s * Math.cos(theta);
      const posY = s * Math.sin(theta);

      positions.block = { x: posX, y: posY, z: 0 };
      velocities.block = { x: v * Math.cos(theta), y: v * Math.sin(theta), z: 0 };
      accelerations.block = { x: a * Math.cos(theta), y: a * Math.sin(theta), z: 0 };

      kinetic = Number((0.5 * m * v * v).toFixed(3));
      potential = Number((m * g * Math.max(0, posY)).toFixed(3));
      thermal = 0;
      total = Number((kinetic + potential).toFixed(3));
      scalars.displacement = s;
    }

    return {
      frameIndex: this.frameIndex,
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
}

// Check if running inside Worker context
const isWorkerScope =
  typeof self !== 'undefined' &&
  typeof (self as unknown as Worker).postMessage === 'function' &&
  typeof window === 'undefined';

if (isWorkerScope) {
  const context = new WorkerSimulationContext();
  const workerGlobal = self as unknown as Worker;
  let loopTimerId: ReturnType<typeof setTimeout> | null = null;
  let expectedNextTickMs = 0;

  const postSimulationError = (err: unknown) => {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown worker error';
    const errorMsg: WorkerOutboundMessage = {
      type: 'SIMULATION_ERROR',
      message,
    };
    workerGlobal.postMessage(errorMsg);
  };

  const postFrameUpdate = (frame: SimulationFrame) => {
    const packed = packSimulationFrame(frame);
    const msg: WorkerOutboundMessage = {
      type: 'FRAME_UPDATE',
      transferBuffer: packed.buffer,
      entityKeys: packed.entityKeys,
      scalarKeys: packed.scalarKeys,
      bounds: context.ringBuffer.getBounds(),
      isPlaying: context.isPlaying,
    };
    workerGlobal.postMessage(msg, [packed.buffer]);
  };

  const stopLoop = () => {
    if (loopTimerId !== null) {
      clearTimeout(loopTimerId);
      loopTimerId = null;
    }
    context.isPlaying = false;
  };

  const scheduleNextTick = () => {
    if (!context.isPlaying) return;
    const stepMs = FIXED_DT * 1000;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Prevent spiral of death if main thread/tab was suspended
    if (now - expectedNextTickMs > stepMs * 5) {
      expectedNextTickMs = now + stepMs;
    }
    const delayMs = Math.max(0, expectedNextTickMs - now);

    loopTimerId = setTimeout(() => {
      loopTimerId = null;
      if (!context.isPlaying) return;
      try {
        const { frame, event } = context.step();
        postFrameUpdate(frame);
        if (event) {
          const eventMsg: WorkerOutboundMessage = {
            type: 'SIMULATION_EVENT',
            event: event.type,
            payload: event.payload,
          };
          workerGlobal.postMessage(eventMsg);
        }
        expectedNextTickMs += stepMs;
        scheduleNextTick();
      } catch (err) {
        stopLoop();
        postSimulationError(err);
      }
    }, delayMs);
  };

  const startLoop = () => {
    if (context.isPlaying || loopTimerId !== null) return;
    try {
      context.isPlaying = true;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      expectedNextTickMs = now + FIXED_DT * 1000;
      scheduleNextTick();
    } catch (err) {
      stopLoop();
      postSimulationError(err);
    }
  };

  self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    try {
      switch (msg.type) {
        case 'INIT': {
          stopLoop();
          context.init(msg.mode, msg.params);
          const current = context.ringBuffer.getLatest();
          if (current) postFrameUpdate(current);
          break;
        }
        case 'UPDATE_PARAMS': {
          context.updateParams(msg.params);
          break;
        }
        case 'PLAY': {
          startLoop();
          break;
        }
        case 'PAUSE': {
          stopLoop();
          const current = context.ringBuffer.getLatest();
          if (current) postFrameUpdate(current);
          break;
        }
        case 'RESET': {
          stopLoop();
          context.reset();
          const current = context.ringBuffer.getLatest();
          if (current) postFrameUpdate(current);
          break;
        }
        case 'STEP_FRAMES': {
          stopLoop();
          const clampedDelta = clampStepFrames(msg.deltaFrames);
          if (clampedDelta === 0) break;

          const bounds = context.ringBuffer.getBounds();
          const targetFrameIndex =
            clampedDelta < 0
              ? Math.max(bounds.minFrame, context.frameIndex + clampedDelta)
              : context.frameIndex + clampedDelta;

          const historical = context.ringBuffer.getByFrameIndex(targetFrameIndex);
          if (historical) {
            context.frameIndex = historical.frameIndex;
            context.time = historical.timestamp;
            postFrameUpdate(historical);
          } else if (clampedDelta > 0) {
            for (let i = 0; i < clampedDelta; i++) {
              context.step();
            }
            const latest = context.ringBuffer.getLatest();
            if (latest) postFrameUpdate(latest);
          }
          break;
        }
        case 'SEEK_FRAME': {
          stopLoop();
          const frame = context.ringBuffer.getByFrameIndex(msg.frameIndex);
          if (frame) {
            context.frameIndex = frame.frameIndex;
            context.time = frame.timestamp;
            postFrameUpdate(frame);
          }
          break;
        }
        default: {
          const _exhaustive: never = msg;
          throw new Error(`Unhandled simulation worker message: ${JSON.stringify(_exhaustive)}`);
        }
      }
    } catch (err) {
      stopLoop();
      postSimulationError(err);
    }
  };
}

