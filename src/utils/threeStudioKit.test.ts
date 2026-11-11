import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGraduationTicks,
  computeMsaaSamples,
  createBeakerProfilePoints,
  createErlenmeyerProfilePoints,
  createFunnelProfilePoints,
} from './threeStudioKit';

test('computeMsaaSamples returns 0 for software GL and clamps hardware MSAA up to 4', () => {
  assert.equal(computeMsaaSamples(8, true), 0);
  assert.equal(computeMsaaSamples(16, false), 4);
  assert.equal(computeMsaaSamples(2, false), 2);
  assert.equal(computeMsaaSamples(0, false), 0);
});

test('createBeakerProfilePoints generates non-empty thick-walled vessel coordinates', () => {
  const pts = createBeakerProfilePoints(1.2, 2.5, 0.05);
  assert.ok(pts.length >= 10);
  assert.equal(pts[0].x, 0);
  assert.equal(pts[0].y, 0);
  assert.equal(pts[pts.length - 1].x, 0);
  assert.ok(pts[pts.length - 1].y > 0, 'Inner bottom must have glass thickness > 0');
  const maxY = Math.max(...pts.map((p) => p.y));
  assert.equal(maxY, 2.5);
});

test('createErlenmeyerProfilePoints produces tapered conical neck narrower than base', () => {
  const pts = createErlenmeyerProfilePoints(1.4, 0.4, 2.2, 0.04);
  assert.ok(pts.length > 16);
  const rimPoint = pts.find((p) => p.y === 2.2 && p.x > 0);
  assert.ok(rimPoint !== undefined);
  assert.ok(rimPoint.x < 1.0, 'Erlenmeyer rim must stay noticeably narrower than base');
  assert.ok(pts.every((p) => p.x >= 0 && p.y >= 0));
});

test('createFunnelProfilePoints produces wide top funnel and narrow stem', () => {
  const pts = createFunnelProfilePoints(0.32, 0.08, 0.35, 0.25);
  assert.ok(pts.length >= 7);
  const topWidth = Math.max(...pts.map((p) => p.x));
  assert.ok(topWidth > 0.32);
  assert.ok(pts[0].y === 0);
});

test('buildGraduationTicks yields properly normalized major and minor ticks', () => {
  const ticks = buildGraduationTicks(50, 10, 5);
  assert.equal(ticks.length, 11);
  assert.equal(ticks[0].value, 0);
  assert.equal(ticks[0].isMajor, true);
  assert.equal(ticks[0].ratio, 0);
  assert.equal(ticks[1].value, 5);
  assert.equal(ticks[1].isMajor, false);
  assert.equal(ticks[10].value, 50);
  assert.equal(ticks[10].ratio, 1);
  assert.deepEqual(buildGraduationTicks(0, 10, 5), []);
});
