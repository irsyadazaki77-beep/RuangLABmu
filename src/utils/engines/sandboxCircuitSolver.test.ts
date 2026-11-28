import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveSandboxTopology,
  createSandboxPreset,
} from './sandboxCircuitSolver';

describe('Pilar 1: Open Sandbox Multi-Domain Solver (Kirchhoff MNA, Fluid, Optical)', () => {
  it('solves series DC circuit accurately using Modified Nodal Analysis', () => {
    const { nodes, wires } = createSandboxPreset('series-circuit');
    // 9V battery, 10 Ohm resistor, 15 Ohm lamp => R_total ≈ 25.07 Ohm => I ≈ 0.359 A
    const res = solveSandboxTopology(nodes, wires);
    assert.strictEqual(res.isClosedCircuit, true);
    assert.strictEqual(res.totalVoltageV, 9);
    assert.ok(Math.abs(res.totalCurrentAmp - 9 / 25.07) < 0.01, `Unexpected current: ${res.totalCurrentAmp}`);
    assert.ok(res.nodeReadouts['lamp-1'].powerWatts > 1.8);
    assert.ok(res.nodeReadouts['lamp-1'].intensity > 0.5);
  });

  it('opens circuit cleanly when switch is toggled OFF', () => {
    const { nodes, wires } = createSandboxPreset('series-circuit');
    const sw = nodes.find((n) => n.id === 'sw-1')!;
    sw.enabled = false;
    const res = solveSandboxTopology(nodes, wires);
    assert.strictEqual(res.isClosedCircuit, false);
    assert.ok(res.totalCurrentAmp < 0.001);
    assert.strictEqual(res.nodeReadouts['lamp-1'].intensity, 0);
  });

  it('solves parallel DC circuit accurately (12V across 12 Ohm || 24 Ohm => R_eq ≈ 8 Ohm, I ≈ 1.5 A)', () => {
    const { nodes, wires } = createSandboxPreset('parallel-circuit');
    const res = solveSandboxTopology(nodes, wires);
    assert.strictEqual(res.isClosedCircuit, true);
    assert.ok(Math.abs(res.equivalentResistanceOhm - 8.05) < 0.15, `Unexpected Req: ${res.equivalentResistanceOhm}`);
    assert.ok(Math.abs(res.totalCurrentAmp - 1.49) < 0.05, `Unexpected I: ${res.totalCurrentAmp}`);
  });

  it('computes fluid titration flow & pH transfer in fluid bench preset', () => {
    const { nodes, wires } = createSandboxPreset('titration-bench');
    const res = solveSandboxTopology(nodes, wires);
    assert.strictEqual(res.fluidTransferredMlPerSec, 2.0);
    assert.ok(Math.abs(res.estimatedPh - 7.0) < 0.05);
  });

  it('computes optical beam transmission across laser -> borosilicate lens -> detector', () => {
    const { nodes, wires } = createSandboxPreset('optical-bench');
    const res = solveSandboxTopology(nodes, wires);
    // 50 mW * 0.92 = 46 mW
    assert.strictEqual(res.opticalOutputMw, 46);
    assert.ok(res.nodeReadouts['det-1'].statusLabel.includes('46.0 mW'));
  });
});
