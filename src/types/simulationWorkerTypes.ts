import { SimulationFrame } from '../utils/simulationBuffer';

export type SimulationMode =
  | 'newton-incline'
  | 'projectile-gravity'
  | 'orbital-gravity'
  | 'collision-momentum'
  | 'spring-hooke'
  | 'pendulum-harmonic'
  | 'stokes-viscosity'
  | 'ohm-wheatstone'
  | 'optics-young-slit'
  | 'photoelectric-planck'
  | 'enzyme-kinetics'
  | 'predator-prey-dynamics'
  | 'cell-osmosis-tonicity';

export type WorkerInboundMessage =
  | { type: 'INIT'; mode: SimulationMode; params: Record<string, number> }
  | { type: 'UPDATE_PARAMS'; params: Record<string, number> }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'STEP_FRAMES'; deltaFrames: number }
  | { type: 'SEEK_FRAME'; frameIndex: number };

export type SimulationEventType =
  | 'ground-hit'
  | 'collision'
  | 'orbit-complete'
  | 'substrate-depleted'
  | 'cell-lysis'
  | 'cell-plasmolysis';

export type WorkerOutboundMessage =
  | {
      type: 'FRAME_UPDATE';
      frame: SimulationFrame;
      bounds: { minFrame: number; maxFrame: number; count: number };
      isPlaying: boolean;
    }
  | {
      type: 'SIMULATION_EVENT';
      event: SimulationEventType;
      payload: Record<string, number>;
    };
