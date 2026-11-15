/**
 * Deterministic Web Worker Simulation Dispatcher
 * Dispatches fixed-timestep (dt = 1/60s) simulation steps and frame construction
 * to modular domain engines (Physics, Chemistry, Biology, Astronomy) while preserving
 * SharedArrayBuffer / SimulationRingBuffer and transferable message contracts.
 */

import {
  packSimulationFrame,
  SimulationFrame,
  SimulationRingBuffer,
} from '../utils/simulationBuffer';
import {
  SimulationMode,
  SimulationEventType,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../types/simulationWorkerTypes';
import {
  FIXED_DT,
  MAX_STEP_FRAMES,
  clampStepFrames,
  stepSpringHookeRK4,
  stepProjectileRK4,
  stepOrbitalVerlet,
  stepEnzymeKineticsRK4,
  stepLotkaVolterraRK4,
  stepCellOsmosisRK4,
  type SimulationStepEvent,
  type WorkerDomainMutableContext,
} from './integrators';
import {
  initPhysicsDomainState,
  stepPhysicsDomain,
  buildPhysicsDomainFrame,
} from './domains/physics';
import {
  isChemistrySimulationMode,
  initChemistryDomainState,
  stepChemistryDomain,
  buildChemistryDomainFrame,
} from './domains/chemistry';
import {
  isBiologySimulationMode,
  initBiologyDomainState,
  stepBiologyDomain,
  buildBiologyDomainFrame,
} from './domains/biology';
import {
  isAstronomySimulationMode,
  initAstronomyDomainState,
  stepAstronomyDomain,
  buildAstronomyDomainFrame,
} from './domains/astronomy';

export {
  FIXED_DT,
  MAX_STEP_FRAMES,
  clampStepFrames,
  stepSpringHookeRK4,
  stepProjectileRK4,
  stepOrbitalVerlet,
  stepEnzymeKineticsRK4,
  stepLotkaVolterraRK4,
  stepCellOsmosisRK4,
};

export class WorkerSimulationContext implements WorkerDomainMutableContext {
  public mode: SimulationMode = 'newton-incline';
  public params: Record<string, number> = {};
  public isPlaying = false;
  public frameIndex = 0;
  public time = 0;
  public ringBuffer = new SimulationRingBuffer(1800);

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
    if (isAstronomySimulationMode(this.mode)) {
      initAstronomyDomainState(this);
    } else if (isChemistrySimulationMode(this.mode)) {
      initChemistryDomainState(this);
    } else if (isBiologySimulationMode(this.mode)) {
      initBiologyDomainState(this);
    } else {
      initPhysicsDomainState(this);
    }
  }

  public step(): {
    frame: SimulationFrame;
    event?: { type: SimulationEventType; payload: Record<string, number> };
  } {
    this.frameIndex++;
    this.time += FIXED_DT;
    let event: SimulationStepEvent | undefined;

    if (isAstronomySimulationMode(this.mode)) {
      event = stepAstronomyDomain(this);
    } else if (isChemistrySimulationMode(this.mode)) {
      event = stepChemistryDomain(this);
    } else if (isBiologySimulationMode(this.mode)) {
      event = stepBiologyDomain(this);
    } else {
      event = stepPhysicsDomain(this);
    }

    const frame = this.buildCurrentFrame();
    this.ringBuffer.push(frame);

    return { frame, event };
  }

  public buildCurrentFrame(): SimulationFrame {
    if (isAstronomySimulationMode(this.mode)) {
      return buildAstronomyDomainFrame(this);
    }
    if (isChemistrySimulationMode(this.mode)) {
      return buildChemistryDomainFrame(this);
    }
    if (isBiologySimulationMode(this.mode)) {
      return buildBiologyDomainFrame(this);
    }
    return buildPhysicsDomainFrame(this);
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
