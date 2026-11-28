import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDraggedParameterValue,
  computeDragStepChanged,
  isPointerClickGesture,
} from './threeInteractionHelper';

describe('threeInteractionHelper direct manipulation helpers', () => {
  it('computes snapped and clamped dragged parameter values', () => {
    const val = computeDraggedParameterValue(30, 56, 0, 0, 60, 1, 280);
    assert.strictEqual(val, 42);
    const clampedHigh = computeDraggedParameterValue(55, 200, 0, 0, 60, 1, 280);
    assert.strictEqual(clampedHigh, 60);
  });

  it('detects whether a drag crossed a new step threshold', () => {
    assert.strictEqual(computeDragStepChanged(null, 10, 1), true);
    assert.strictEqual(computeDragStepChanged(10, 10.2, 1), false);
    assert.strictEqual(computeDragStepChanged(10, 11, 1), true);
    assert.strictEqual(computeDragStepChanged(1.0, 1.25, 0.25), true);
  });

  it('distinguishes clicks from drag gestures by travel distance', () => {
    assert.strictEqual(isPointerClickGesture(3, 4, 5), true);
    assert.strictEqual(isPointerClickGesture(8, 0, 5), false);
  });
});
