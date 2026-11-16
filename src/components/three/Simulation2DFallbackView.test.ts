import assert from 'node:assert/strict';
import test from 'node:test';
import { build2DFallbackTelemetryModel } from './Simulation2DFallbackView';

test('build2DFallbackTelemetryModel produces valid bounded SVG polylines across all 4 domains', () => {
  const series = [
    { cursorIndex: 0, t: 0, primary: 0, secondary: 10 },
    { cursorIndex: 1, t: 0.5, primary: 5, secondary: 8 },
    { cursorIndex: 2, t: 1.0, primary: 10, secondary: 6 },
  ];
  const params = {
    massa: { value: 2.5, unit: 'kg' },
    gaya: { value: 12, unit: 'N' },
  };

  for (const domain of ['physics', 'chemistry', 'biology', 'astronomy'] as const) {
    const model = build2DFallbackTelemetryModel(domain, series, params, 420, 140);
    assert.equal(model.domain, domain);
    assert.ok(model.title.length > 0);
    assert.equal(model.latestTime, 1.0);
    assert.equal(model.latestPrimary, 10);
    assert.equal(model.latestSecondary, 6);
    assert.equal(model.minPrimary, 0);
    assert.equal(model.maxPrimary, 10);
    assert.ok(!model.polylinePoints.includes('NaN'));
    assert.ok(!model.secondaryPolylinePoints.includes('NaN'));
    assert.equal(model.polylinePoints.split(' ').length, 3);
    assert.equal(model.paramEntries.length, 2);
  }
});

test('build2DFallbackTelemetryModel safely filters NaN/Infinity points and handles flat/empty series', () => {
  const emptyModel = build2DFallbackTelemetryModel('chemistry', [], {});
  assert.equal(emptyModel.latestPrimary, 0);
  assert.equal(emptyModel.latestSecondary, null);
  assert.ok(!emptyModel.polylinePoints.includes('NaN'));
  assert.equal(emptyModel.polylinePoints.split(' ').length, 2);

  const flatAndInvalidModel = build2DFallbackTelemetryModel(
    'astronomy',
    [
      { cursorIndex: 0, t: Number.NaN, primary: 10 },
      { cursorIndex: 1, t: 1, primary: 4.5, secondary: Number.POSITIVE_INFINITY },
      { cursorIndex: 2, t: 2, primary: 4.5, secondary: 2.0 },
      { cursorIndex: 3, t: 3, primary: 4.5, secondary: 2.0 },
    ],
    {
      badParam: { value: Number.NaN, unit: 'm' },
      orbitRadius: { value: 1.0, unit: 'AU' },
    }
  );

  assert.equal(flatAndInvalidModel.latestTime, 3);
  assert.equal(flatAndInvalidModel.latestPrimary, 4.5);
  assert.ok(flatAndInvalidModel.maxPrimary > flatAndInvalidModel.minPrimary);
  assert.ok(!flatAndInvalidModel.polylinePoints.includes('NaN'));
  assert.ok(!flatAndInvalidModel.secondaryPolylinePoints.includes('NaN'));
  assert.deepEqual(flatAndInvalidModel.paramEntries, [
    { label: 'orbitRadius', value: 1.0, unit: 'AU' },
  ]);
});
