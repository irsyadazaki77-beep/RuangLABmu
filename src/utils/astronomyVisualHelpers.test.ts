import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auToSceneRadius,
  computeTransitLightCurveSample,
  normalizeAstronomyMode,
  redshiftToGalaxyColorHex,
} from './astronomyVisualHelpers';

test('normalizeAstronomyMode maps catalog IDs and aliases consistently', () => {
  assert.equal(normalizeAstronomyMode('milky-way-rotation'), 'milkyway-galaxy');
  assert.equal(normalizeAstronomyMode('milkyway-galaxy'), 'milkyway-galaxy');
  assert.equal(normalizeAstronomyMode('exoplanet-transit'), 'stellar-exoplanet');
  assert.equal(normalizeAstronomyMode('stellar-exoplanet'), 'stellar-exoplanet');
  assert.equal(normalizeAstronomyMode('hubble-expansion'), 'hubble-expansion');
  assert.equal(normalizeAstronomyMode('stellar-wien-spectrum'), 'stellar-wien-spectrum');
  assert.equal(normalizeAstronomyMode('unknown-mode'), 'solar-kepler');
});

test('computeTransitLightCurveSample models full limb-darkened dip at mid-transit and baseline out of transit', () => {
  const baseline = computeTransitLightCurveSample(0.0, 1.0, 11.2, 0.05);
  assert.equal(baseline.inTransit, false);
  assert.equal(baseline.fluxRatio, 1);
  assert.equal(baseline.visualFluxRatio, 1);

  const midTransit = computeTransitLightCurveSample(0.5, 1.0, 11.2, 0.05);
  assert.equal(midTransit.inTransit, true);
  assert.ok(midTransit.fluxRatio < 1, 'Flux should dip below 1.0 during transit');
  assert.ok(midTransit.visualFluxRatio < 1, 'Visual flux should show noticeable dip');
  assert.ok(
    midTransit.physicalDepthFraction > 0.009 && midTransit.physicalDepthFraction < 0.015,
    `Jupiter transit around sun should yield ~1.05% depth, got ${midTransit.physicalDepthFraction}`
  );
});

test('auToSceneRadius scales monotonically and clamps safely', () => {
  assert.ok(auToSceneRadius(0.39) < auToSceneRadius(1.0));
  assert.ok(auToSceneRadius(1.0) < auToSceneRadius(5.2));
  assert.ok(Number.isFinite(auToSceneRadius(NaN)));
});

test('redshiftToGalaxyColorHex shifts blue-white galaxies toward crimson at higher z', () => {
  const lowZHex = redshiftToGalaxyColorHex(0.0);
  const highZHex = redshiftToGalaxyColorHex(0.16);
  const lowBlue = lowZHex & 0xff;
  const highRed = (highZHex >> 16) & 0xff;
  const highBlue = highZHex & 0xff;

  assert.ok(lowBlue > highBlue, 'Higher redshift should have lower blue channel');
  assert.ok(highRed > 200, 'Higher redshift should shift strongly toward red');
});
