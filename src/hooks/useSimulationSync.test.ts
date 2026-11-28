import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSimulationParamsDelta,
  mergeSimulationSnapshotParams,
} from './useSimulationSync';

describe('useSimulationSync delta helpers', () => {
  it('returns no changes when snapshot parameters are identical', () => {
    const prev = {
      physicsParams: { mode: 'newton-incline', mass: 2.5, angle: 30 },
      chemistryParams: { molarity: 0.5 },
    };
    const next = {
      physicsParams: { mode: 'newton-incline', mass: 2.5, angle: 30 },
      chemistryParams: { molarity: 0.5 },
    };

    const diff = computeSimulationParamsDelta(prev, next);
    assert.equal(diff.hasChanges, false);
    assert.deepEqual(diff.changedKeys, []);
    assert.deepEqual(diff.delta, {});
  });

  it('extracts only modified nested domain parameter fields', () => {
    const prev = {
      physicsParams: { mode: 'newton-incline', mass: 2.5, angle: 30 },
      chemistryParams: { molarity: 0.5 },
    };
    const next = {
      physicsParams: { mode: 'newton-incline', mass: 4.0, angle: 30 },
      chemistryParams: { molarity: 0.5 },
    };

    const diff = computeSimulationParamsDelta(prev, next);
    assert.equal(diff.hasChanges, true);
    assert.deepEqual(diff.changedKeys, ['physicsParams']);
    assert.deepEqual(diff.delta, {
      physicsParams: { mass: 4.0 },
    });

    const merged = mergeSimulationSnapshotParams(prev, diff.delta);
    assert.deepEqual(merged, next);
  });
});
