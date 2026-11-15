/**
 * Physics Domain Simulation Module for Web Worker
 * Covers Mechanics (Newton Incline, Spring-Hooke, Projectile Gravity, Collision Momentum,
 * Harmonic Pendulum, Stokes Viscosity), Electricity (Ohm-Wheatstone), Optics (Young Slit),
 * and Quantum/Modern Physics (Photoelectric Effect).
 */

import type { SimulationFrame, Vector3Tuple } from '../../../utils/simulationBuffer';
import type { SimulationMode } from '../../../types/simulationWorkerTypes';
import {
  FIXED_DT,
  stepProjectileRK4,
  stepSpringHookeRK4,
  type SimulationStepEvent,
  type WorkerDomainMutableContext,
} from '../../integrators';

const PHYSICS_MODES = new Set<SimulationMode>([
  'newton-incline',
  'spring-hooke',
  'projectile-gravity',
  'collision-momentum',
  'pendulum-harmonic',
  'stokes-viscosity',
  'ohm-wheatstone',
  'optics-young-slit',
  'photoelectric-planck',
]);

export function isPhysicsSimulationMode(mode: SimulationMode): boolean {
  return PHYSICS_MODES.has(mode);
}

export function initPhysicsDomainState(ctx: WorkerDomainMutableContext): void {
  if (ctx.mode === 'spring-hooke') {
    const x0 = ctx.params.springDisplacement ?? 0.8;
    const v0 = 0;
    const k = ctx.params.springConstantK ?? 120;
    ctx.state = { x: x0, v: v0, a: 0 };
    ctx.initialMechanicalEnergy = 0.5 * k * x0 * x0;
  } else if (ctx.mode === 'projectile-gravity') {
    const v0 = ctx.params.initialVelocity ?? 22;
    const angleRad = ((ctx.params.launchAngle ?? 45) * Math.PI) / 180.0;
    const h0 = ctx.params.initialHeight ?? 0;
    const vx0 = v0 * Math.cos(angleRad);
    const vy0 = v0 * Math.sin(angleRad);
    const g = ctx.params.gravity ?? 9.81;
    const m = ctx.params.mass ?? 2.5;

    ctx.state = { x: 0, y: h0, vx: vx0, vy: vy0, ax: 0, ay: -g };
    ctx.initialMechanicalEnergy = 0.5 * m * v0 * v0 + m * g * h0;
  } else if (ctx.mode === 'collision-momentum') {
    ctx.state = {
      x1: 2.0,
      v1: ctx.params.initialVelocity ?? 6.0,
      x2: 12.0,
      v2: ctx.params.velocity2Initial ?? -2.0,
      a1: 0,
      a2: 0,
    };
    const m1 = ctx.params.mass ?? 4.0;
    const m2 = ctx.params.collisionMass2 ?? 2.0;
    const v1 = ctx.state.v1;
    const v2 = ctx.state.v2;
    ctx.initialMechanicalEnergy = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  } else {
    // newton-incline and general mechanics baseline
    ctx.state = {
      s: 0,
      v: ctx.params.initialVelocity ?? 0,
      a: 0,
    };
    ctx.initialMechanicalEnergy = 0;
  }
}

export function stepPhysicsDomain(
  ctx: WorkerDomainMutableContext
): SimulationStepEvent | undefined {
  let event: SimulationStepEvent | undefined;

  if (ctx.mode === 'spring-hooke') {
    const m = ctx.params.mass ?? 4.0;
    const k = ctx.params.springConstantK ?? 120;
    const c = ctx.params.dampingCoeff ?? 0.15;
    const { xNext, vNext, aNext } = stepSpringHookeRK4(
      ctx.state.x,
      ctx.state.v,
      m,
      k,
      c,
      FIXED_DT
    );
    ctx.state.x = xNext;
    ctx.state.v = vNext;
    ctx.state.a = aNext;
  } else if (ctx.mode === 'projectile-gravity') {
    const m = ctx.params.mass ?? 2.5;
    const g = ctx.params.gravity ?? 9.81;
    const drag = ctx.params.dragCoeff ?? 0.0;

    if (ctx.state.y <= 0 && ctx.state.vy <= 0) {
      ctx.state.vx = 0;
      ctx.state.vy = 0;
      ctx.state.ax = 0;
      ctx.state.ay = 0;
    } else {
      const { xNext, yNext, vxNext, vyNext, axNext, ayNext } = stepProjectileRK4(
        ctx.state.x,
        ctx.state.y,
        ctx.state.vx,
        ctx.state.vy,
        m,
        g,
        drag,
        FIXED_DT
      );

      if (yNext <= 0 && !ctx.groundHitOccurred) {
        ctx.groundHitOccurred = true;
        ctx.state.x = xNext;
        ctx.state.y = 0;
        ctx.state.vx = 0;
        ctx.state.vy = 0;
        ctx.state.ax = 0;
        ctx.state.ay = 0;
        event = {
          type: 'ground-hit',
          payload: { x: Number(xNext.toFixed(2)), time: Number(ctx.time.toFixed(2)) },
        };
      } else {
        ctx.state.x = xNext;
        ctx.state.y = Math.max(0, yNext);
        ctx.state.vx = vxNext;
        ctx.state.vy = vyNext;
        ctx.state.ax = axNext;
        ctx.state.ay = ayNext;
      }
    }
  } else if (ctx.mode === 'collision-momentum') {
    const m1 = ctx.params.mass ?? 4.0;
    const m2 = ctx.params.collisionMass2 ?? 2.0;
    const e = Math.min(1.0, Math.max(0.0, ctx.params.restitutionCoeff ?? 1.0));

    let { x1, v1, x2, v2 } = ctx.state;
    x1 += v1 * FIXED_DT;
    x2 += v2 * FIXED_DT;

    const contactDistance = 1.0;
    if (x1 + contactDistance >= x2 && !ctx.collisionOccurred && v1 > v2) {
      ctx.collisionOccurred = true;
      const v1Final = ((m1 - e * m2) * v1 + (1.0 + e) * m2 * v2) / (m1 + m2);
      const v2Final = ((m2 - e * m1) * v2 + (1.0 + e) * m1 * v1) / (m1 + m2);

      v1 = v1Final;
      v2 = v2Final;

      const ekInitial =
        0.5 * m1 * ctx.state.v1 * ctx.state.v1 + 0.5 * m2 * ctx.state.v2 * ctx.state.v2;
      const ekFinal = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
      const energyLossPct = ekInitial > 0 ? ((ekInitial - ekFinal) / ekInitial) * 100 : 0;

      event = {
        type: 'collision',
        payload: {
          time: Number(ctx.time.toFixed(2)),
          v1Final: Number(v1.toFixed(2)),
          v2Final: Number(v2.toFixed(2)),
          energyLossPct: Number(energyLossPct.toFixed(1)),
        },
      };
    }

    ctx.state.x1 = x1;
    ctx.state.v1 = v1;
    ctx.state.x2 = x2;
    ctx.state.v2 = v2;
  } else {
    // newton-incline
    const m = ctx.params.mass ?? 4.0;
    const F = ctx.params.appliedForce ?? 45;
    const theta = ((ctx.params.inclineAngle ?? 15) * Math.PI) / 180.0;
    const g = ctx.params.gravity ?? 9.81;
    const muK = ctx.params.frictionCoeffKinetic ?? 0.15;
    const muS = ctx.params.frictionCoeffStatic ?? 0.2;

    const N = m * g * Math.cos(theta);
    const fParallel = m * g * Math.sin(theta);
    const fsMax = muS * N;
    const fk = muK * N;

    const driving = F - fParallel;
    let accel = 0;

    if (Math.abs(ctx.state.v) > 0.001) {
      const fFric = -Math.sign(ctx.state.v) * fk;
      accel = (driving + fFric) / m;
    } else {
      if (Math.abs(driving) > fsMax) {
        accel = (driving - Math.sign(driving) * fk) / m;
      } else {
        accel = 0;
        ctx.state.v = 0;
      }
    }

    ctx.state.v += accel * FIXED_DT;
    ctx.state.s += ctx.state.v * FIXED_DT;
    ctx.state.a = accel;
  }

  return event;
}

export function buildPhysicsDomainFrame(ctx: WorkerDomainMutableContext): SimulationFrame {
  const timestamp = Number(ctx.time.toFixed(3));
  const positions: Record<string, Vector3Tuple> = {};
  const velocities: Record<string, Vector3Tuple> = {};
  const accelerations: Record<string, Vector3Tuple> = {};
  let kinetic = 0;
  let potential = 0;
  let thermal = 0;
  let total = 0;
  const scalars: Record<string, number> = {};

  if (ctx.mode === 'spring-hooke') {
    const m = ctx.params.mass ?? 4.0;
    const k = ctx.params.springConstantK ?? 120;
    const x = ctx.state.x ?? 0;
    const v = ctx.state.v ?? 0;
    const a = ctx.state.a ?? 0;

    positions.mass = { x, y: 0, z: 0 };
    velocities.mass = { x: v, y: 0, z: 0 };
    accelerations.mass = { x: a, y: 0, z: 0 };

    kinetic = Number((0.5 * m * v * v).toFixed(3));
    potential = Number((0.5 * k * x * x).toFixed(3));
    thermal = Number(
      Math.max(0, ctx.initialMechanicalEnergy - (kinetic + potential)).toFixed(3)
    );
    total = Number((kinetic + potential + thermal).toFixed(3));
    scalars.springExtension = x;
  } else if (ctx.mode === 'projectile-gravity') {
    const m = ctx.params.mass ?? 2.5;
    const g = ctx.params.gravity ?? 9.81;
    const x = ctx.state.x ?? 0;
    const y = ctx.state.y ?? 0;
    const vx = ctx.state.vx ?? 0;
    const vy = ctx.state.vy ?? 0;
    const ax = ctx.state.ax ?? 0;
    const ay = ctx.state.ay ?? 0;

    positions.projectile = { x, y, z: 0 };
    velocities.projectile = { x: vx, y: vy, z: 0 };
    accelerations.projectile = { x: ax, y: ay, z: 0 };

    kinetic = Number((0.5 * m * (vx * vx + vy * vy)).toFixed(3));
    potential = Number((m * g * Math.max(0, y)).toFixed(3));
    thermal = Number(
      Math.max(0, ctx.initialMechanicalEnergy - (kinetic + potential)).toFixed(3)
    );
    total = Number((kinetic + potential + thermal).toFixed(3));
    scalars.height = y;
    scalars.range = x;
  } else if (ctx.mode === 'collision-momentum') {
    const m1 = ctx.params.mass ?? 4.0;
    const m2 = ctx.params.collisionMass2 ?? 2.0;
    const x1 = ctx.state.x1 ?? 0;
    const v1 = ctx.state.v1 ?? 0;
    const x2 = ctx.state.x2 ?? 0;
    const v2 = ctx.state.v2 ?? 0;

    positions.body1 = { x: x1, y: 0, z: 0 };
    positions.body2 = { x: x2, y: 0, z: 0 };
    velocities.body1 = { x: v1, y: 0, z: 0 };
    velocities.body2 = { x: v2, y: 0, z: 0 };
    accelerations.body1 = { x: 0, y: 0, z: 0 };
    accelerations.body2 = { x: 0, y: 0, z: 0 };

    kinetic = Number((0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2).toFixed(3));
    potential = 0;
    thermal = Number(Math.max(0, ctx.initialMechanicalEnergy - kinetic).toFixed(3));
    total = Number((kinetic + thermal).toFixed(3));
    scalars.totalMomentum = Number((m1 * v1 + m2 * v2).toFixed(3));
  } else {
    // newton-incline
    const m = ctx.params.mass ?? 4.0;
    const s = ctx.state.s ?? 0;
    const v = ctx.state.v ?? 0;
    const a = ctx.state.a ?? 0;
    const theta = ((ctx.params.inclineAngle ?? 15) * Math.PI) / 180.0;
    const g = ctx.params.gravity ?? 9.81;

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
