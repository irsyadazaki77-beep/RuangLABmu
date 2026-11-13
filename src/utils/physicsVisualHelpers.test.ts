import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMechanicalEnergySplit,
  computeCollisionShockwaveState,
  computeWheatstoneNeedleAngle,
  computePhotoelectricElectronX,
} from './physicsVisualHelpers';

test('computeMechanicalEnergySplit normalizes kinetic and potential energy safely', () => {
  const split = computeMechanicalEnergySplit(75, 25);
  assert.ok(split.ekNorm > split.epNorm);
  assert.equal(split.etotNorm, 1.0);

  const zeroSplit = computeMechanicalEnergySplit(0, 0);
  assert.equal(zeroSplit.ekNorm, 0.06);
  assert.equal(zeroSplit.epNorm, 0.06);
});

test('computeCollisionShockwaveState activates only within impact window', () => {
  const before = computeCollisionShockwaveState(1.1, 1.4, 0.45);
  assert.equal(before.visible, false);

  const during = computeCollisionShockwaveState(1.5, 1.4, 0.45);
  assert.equal(during.visible, true);
  assert.ok(during.scale > 0.35);
  assert.ok(during.opacity > 0);

  const after = computeCollisionShockwaveState(2.1, 1.4, 0.45);
  assert.equal(after.visible, false);
});

test('computeWheatstoneNeedleAngle detects balanced bridge and signed deflection', () => {
  const balanced = computeWheatstoneNeedleAngle(100, 200, 150, 300, 0);
  assert.equal(balanced.isBalanced, true);
  assert.equal(balanced.angleRad, 0);

  const unbalanced = computeWheatstoneNeedleAngle(100, 200, 100, 50, 22);
  assert.equal(unbalanced.isBalanced, false);
  assert.ok(unbalanced.angleRad > 0);
});

test('computePhotoelectricElectronX models turnaround when stopping potential exceeds Ek_max', () => {
  const repelled = computePhotoelectricElectronX(0.5, 1.0, 2.0);
  assert.equal(repelled.reachesAnode, false);
  assert.ok(repelled.x < 1.1);

  const collected = computePhotoelectricElectronX(0.95, 2.5, 1.0);
  assert.equal(collected.reachesAnode, true);
  assert.ok(collected.x > 0.8);
});
