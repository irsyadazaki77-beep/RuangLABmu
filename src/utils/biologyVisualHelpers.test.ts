import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCatalasePhHex,
  computeEcosystemVisualCounts,
  computeOsmosisVisualState,
  computePhotosynthesisGasLevel,
} from './biologyVisualHelpers';

test('computeOsmosisVisualState models hypotonic turgor, isotonic equilibrium, and hypertonic plasmolysis', () => {
  const hypo = computeOsmosisVisualState(0.05);
  assert.equal(hypo.state, 'hypotonic');
  assert.ok(hypo.vacuoleScale > 1.0, 'Central vacuole swells in hypotonic solution');
  assert.ok(hypo.cyclosisSpeed > 1.0, 'Cyclosis remains rapid in turgid cell');

  const iso = computeOsmosisVisualState(0.28);
  assert.equal(iso.state, 'isotonic');

  const hyper = computeOsmosisVisualState(0.9);
  assert.equal(hyper.state, 'hypertonic');
  assert.ok(hyper.protoplastScale < iso.protoplastScale, 'Protoplast shrinks in hypertonic medium');
  assert.ok(hyper.vacuoleScale < 0.5, 'Central vacuole collapses during plasmolysis');
  assert.ok(hyper.cyclosisSpeed < 0.3, 'Cytoplasmic streaming slows under severe plasmolysis');
});

test('computeEcosystemVisualCounts caps instanced counts and flags ecological balance states', () => {
  const balanced = computeEcosystemVisualCounts(40, 9, false);
  assert.equal(balanced.status, 'seimbang');
  assert.ok(balanced.preyInstances > balanced.predatorInstances);

  const liteBalanced = computeEcosystemVisualCounts(40, 9, true);
  assert.ok(liteBalanced.preyInstances <= balanced.preyInstances, 'Lite mode lowers instanced budget');

  assert.equal(computeEcosystemVisualCounts(100, 3, false).status, 'ledakan_mangsa');
  assert.equal(computeEcosystemVisualCounts(20, 35, false).status, 'tekanan_predasi');
});

test('computeCatalasePhHex & computePhotosynthesisGasLevel reflect biochemical trends cleanly', () => {
  assert.equal(computeCatalasePhHex(3.0), 0xf59e0b);
  assert.equal(computeCatalasePhHex(7.0), 0xef4444);
  assert.equal(computeCatalasePhHex(10.5), 0x8b5cf6);

  const redGas = computePhotosynthesisGasLevel(1800, 660, 3.0);
  const greenGas = computePhotosynthesisGasLevel(1800, 530, 3.0);
  assert.ok(redGas > greenGas, 'Red absorption peak produces higher O2 accumulation than green');
});
