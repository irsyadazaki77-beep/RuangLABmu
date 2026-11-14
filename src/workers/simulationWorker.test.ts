import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_DT,
  MAX_STEP_FRAMES,
  clampStepFrames,
  stepSpringHookeRK4,
  stepProjectileRK4,
  stepOrbitalVerlet,
} from './simulationWorker';
import {
  packSimulationFrame,
  unpackSimulationFrame,
  SimulationFrame,
} from '../utils/simulationBuffer';

describe('simulationWorker hardening & transferable buffer invariants', () => {
  it('exports MAX_STEP_FRAMES = 3600 and clamps forward/backward STEP_FRAMES bounds', () => {
    assert.equal(MAX_STEP_FRAMES, 3600);
    assert.equal(clampStepFrames(1), 1);
    assert.equal(clampStepFrames(-15), -15);
    assert.equal(clampStepFrames(999999), MAX_STEP_FRAMES);
    assert.equal(clampStepFrames(-999999), -MAX_STEP_FRAMES);
    assert.equal(clampStepFrames(12.9), 12);
    assert.equal(clampStepFrames(Number.NaN), 0);
    assert.equal(clampStepFrames(Number.POSITIVE_INFINITY), 0);
    assert.equal(clampStepFrames(Number.NEGATIVE_INFINITY), 0);
  });

  it('round-trips SimulationFrame losslessly via transferable Float64Array pack/unpack', () => {
    const sample: SimulationFrame = {
      frameIndex: 42,
      timestamp: 0.7,
      positions: {
        block: { x: 1.25, y: -0.5, z: 0 },
        earth: { x: 149.6, y: 0.012, z: -0.004 },
      },
      velocities: {
        block: { x: 2.5, y: 0, z: 0 },
        earth: { x: 0.01, y: 29.78, z: 0 },
      },
      accelerations: {
        block: { x: 0.85, y: -9.81, z: 0 },
        earth: { x: -0.0059, y: 0, z: 0 },
      },
      energies: {
        kinetic: 12.345,
        potential: 67.89,
        thermal: 1.23,
        total: 81.465,
      },
      scalars: {
        displacement: 3.14159,
        angleRad: 0.2618,
      },
    };

    const packed = packSimulationFrame(sample);
    assert.ok(packed.buffer instanceof ArrayBuffer);
    assert.deepEqual(packed.entityKeys, ['block', 'earth']);
    assert.deepEqual(packed.scalarKeys, ['displacement', 'angleRad']);

    const unpacked = unpackSimulationFrame(
      packed.buffer,
      packed.entityKeys,
      packed.scalarKeys
    );
    assert.deepEqual(unpacked, sample);
  });

  it('round-trips SimulationFrame cleanly when scalars are absent', () => {
    const sample: SimulationFrame = {
      frameIndex: 0,
      timestamp: 0,
      positions: { ball: { x: 0, y: 10, z: 0 } },
      velocities: { ball: { x: 5, y: 0, z: 0 } },
      accelerations: { ball: { x: 0, y: -9.81, z: 0 } },
      energies: { kinetic: 12.5, potential: 98.1, thermal: 0, total: 110.6 },
    };

    const packed = packSimulationFrame(sample);
    const unpacked = unpackSimulationFrame(
      packed.buffer,
      packed.entityKeys,
      packed.scalarKeys
    );
    assert.deepEqual(unpacked, sample);
  });

  it('conserves mechanical energy in undamped Spring-Hooke RK4 over 10 seconds (600 steps)', () => {
    const m = 2.0;
    const k = 18.0;
    let x = 0.5;
    let v = 0;
    const eInitial = 0.5 * k * x * x + 0.5 * m * v * v;

    for (let i = 0; i < 600; i++) {
      const next = stepSpringHookeRK4(x, v, m, k, 0, FIXED_DT);
      x = next.xNext;
      v = next.vNext;
    }

    const eFinal = 0.5 * k * x * x + 0.5 * m * v * v;
    assert.ok(
      Math.abs(eFinal - eInitial) < 1e-6,
      `Expected energy conservation within 1e-6, got drift ${Math.abs(eFinal - eInitial)}`
    );
  });

  it('preserves circular orbital radius and energy in Velocity Verlet over 600 steps', () => {
    const mu = 4.0 * Math.PI * Math.PI;
    let rx = 1.0;
    let ry = 0;
    let vx = 0;
    let vy = Math.sqrt(mu / rx);

    const eInitial = 0.5 * (vx * vx + vy * vy) - mu / Math.hypot(rx, ry);

    for (let i = 0; i < 600; i++) {
      const next = stepOrbitalVerlet(rx, ry, vx, vy, mu, FIXED_DT * 0.05);
      rx = next.rxNext;
      ry = next.ryNext;
      vx = next.vxNext;
      vy = next.vyNext;
    }

    const eFinal = 0.5 * (vx * vx + vy * vy) - mu / Math.hypot(rx, ry);
    assert.ok(Math.abs(eFinal - eInitial) < 1e-4);
    assert.ok(Math.abs(Math.hypot(rx, ry) - 1.0) < 1e-3);
  });

  it('integrates drag-free projectile trajectory accurately via RK4', () => {
    const res = stepProjectileRK4(0, 0, 10, 20, 1.0, 9.81, 0, FIXED_DT);
    assert.ok(res.xNext > 0);
    assert.ok(res.yNext > 0);
    assert.ok(Math.abs(res.vxNext - 10) < 1e-9);
    assert.ok(Math.abs(res.ayNext + 9.81) < 1e-9);
  });
});
