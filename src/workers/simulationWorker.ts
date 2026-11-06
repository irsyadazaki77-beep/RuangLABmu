/**
 * Deterministic Web Worker Physics Simulation Engine
 * Runs continuous numerical integration at fixed timestep dt = 1/60s
 * using Runge-Kutta 4th Order (RK4) and Velocity Verlet integrators.
 */

import {
  SimulationFrame,
  SimulationRingBuffer,
  Vector3Tuple,
} from '../utils/simulationBuffer';
import {
  SimulationMode,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../types/simulationWorkerTypes';

export const FIXED_DT = 1.0 / 60.0; // 60 Hz fixed timestep

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

  public step(): { frame: SimulationFrame; event?: { type: 'ground-hit' | 'collision' | 'orbit-complete'; payload: Record<string, number> } } {
    this.frameIndex++;
    this.time += FIXED_DT;
    let event: { type: 'ground-hit' | 'collision' | 'orbit-complete'; payload: Record<string, number> } | undefined;

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
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const postFrameUpdate = (frame: SimulationFrame) => {
    const msg: WorkerOutboundMessage = {
      type: 'FRAME_UPDATE',
      frame,
      bounds: context.ringBuffer.getBounds(),
      isPlaying: context.isPlaying,
    };
    (self as unknown as Worker).postMessage(msg);
  };

  const startLoop = () => {
    if (intervalId !== null) return;
    context.isPlaying = true;
    intervalId = setInterval(() => {
      const { frame, event } = context.step();
      postFrameUpdate(frame);
      if (event) {
        const eventMsg: WorkerOutboundMessage = {
          type: 'SIMULATION_EVENT',
          event: event.type,
          payload: event.payload,
        };
        (self as unknown as Worker).postMessage(eventMsg);
      }
    }, FIXED_DT * 1000);
  };

  const stopLoop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    context.isPlaying = false;
  };

  self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

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
        const targetFrameIndex = context.frameIndex + msg.deltaFrames;
        const historical = context.ringBuffer.getByFrameIndex(targetFrameIndex);
        if (historical) {
          context.frameIndex = historical.frameIndex;
          context.time = historical.timestamp;
          postFrameUpdate(historical);
        } else if (msg.deltaFrames > 0) {
          // If advancing beyond recorded history, step forward
          for (let i = 0; i < msg.deltaFrames; i++) {
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
    }
  };
}
