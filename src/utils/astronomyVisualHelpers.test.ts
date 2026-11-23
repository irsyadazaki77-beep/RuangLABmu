import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auToSceneRadius,
  computeTransitLightCurveSample,
  evaluateKeplerOrbitPoint,
  normalizeAstronomyMode,
  redshiftToGalaxyColorHex,
  solveKeplerEccentricAnomaly,
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

test('solveKeplerEccentricAnomaly satisfies Kepler equation M = E - e*sin(E) and accelerates near perihelion', () => {
  const e = 0.55;
  for (const M of [0.2, 0.9, 1.8, 3.14, 4.7, 5.9]) {
    const E = solveKeplerEccentricAnomaly(M, e);
    const residual = Math.abs(E - e * Math.sin(E) - M);
    assert.ok(residual < 1e-6, `Expected residual < 1e-6 for M=${M}, got ${residual}`);
  }

  // Equal mean-anomaly delta sweeps larger eccentric-anomaly arc near perihelion (M=0) than aphelion (M=π)
  const deltaM = 0.25;
  const dEPeri = solveKeplerEccentricAnomaly(deltaM, e) - solveKeplerEccentricAnomaly(0, e);
  const dEAph = solveKeplerEccentricAnomaly(Math.PI + deltaM, e) - solveKeplerEccentricAnomaly(Math.PI, e);
  assert.ok(dEPeri > dEAph * 2.5, 'Orbital angular speed must be faster near perihelion than aphelion');
});

test('evaluateKeplerOrbitPoint preserves true elliptical semi-minor compression and focus offset', () => {
  const a = 2.5;
  const e = 0.6;
  const scaledR = 4.0;
  const incRad = 0;

  const peri = evaluateKeplerOrbitPoint(0, a, e, scaledR, incRad);
  const aph = evaluateKeplerOrbitPoint(Math.PI, a, e, scaledR, incRad);
  const quad = evaluateKeplerOrbitPoint(Math.PI / 2, a, e, scaledR, incRad);

  assert.ok(Math.abs(peri.ox - (1 - e) * scaledR) < 1e-6, 'Perihelion must lie at (1 - e) * scaledR');
  assert.ok(Math.abs(aph.ox + (1 + e) * scaledR) < 1e-6, 'Aphelion must lie at -(1 + e) * scaledR');
  const expectedSemiMinor = Math.sqrt(1 - e * e) * scaledR; // 0.8 * 4.0 = 3.2
  assert.ok(
    Math.abs(quad.oz - expectedSemiMinor) < 1e-6,
    `Semi-minor oz must equal sqrt(1-e^2)*scaledR (${expectedSemiMinor}), got ${quad.oz}`
  );
  assert.ok(quad.oz < scaledR, 'Eccentric ellipse must be visibly compressed along semi-minor axis');
  assert.ok(peri.tangentZ > 0 && Math.abs(peri.tangentX) < 1e-6, 'Perihelion velocity tangent should point along +Z');
});

