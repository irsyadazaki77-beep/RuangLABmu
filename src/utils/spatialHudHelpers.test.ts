import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampAndSnapParameter } from '../components/controls/PrecisionSlider';
import { resolveGaugeSeverity } from '../components/telemetry/TelemetryGauge';
import { SPRING_TACTILE } from '../styles/motionPresets';

describe('Spatial HUD Precision Controls & Telemetry Helpers', () => {
  it('clamps and snaps parameter values to step increments and bounds', () => {
    assert.equal(clampAndSnapParameter(15.26, 0, 20, 0.5, 1), 15.5);
    assert.equal(clampAndSnapParameter(-5, 0, 20, 0.5, 1), 0);
    assert.equal(clampAndSnapParameter(99, 0, 20, 0.5, 1), 20);
    assert.equal(clampAndSnapParameter(Number.NaN, 2, 10, 1, 0), 2);
  });

  it('resolves SVG telemetry gauge severity thresholds accurately', () => {
    assert.equal(resolveGaugeSeverity(40, 100, 70, 90), 'nominal');
    assert.equal(resolveGaugeSeverity(75, 100, 70, 90), 'warning');
    assert.equal(resolveGaugeSeverity(92, 100, 70, 90), 'critical');
  });

  it('exposes calibrated spring physics constants for tactile drawers and controls', () => {
    assert.equal((SPRING_TACTILE as { type?: string }).type, 'spring');
    assert.equal((SPRING_TACTILE as { stiffness?: number }).stiffness, 320);
    assert.equal((SPRING_TACTILE as { damping?: number }).damping, 28);
  });
});
