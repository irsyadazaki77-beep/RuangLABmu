import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDopplerObservedHz,
  computeHarmonicPitchHz,
  computeTitrationPhPitchHz,
  computeSeismicToneHz,
  shouldEmitGeigerClick,
  computeHeartbeatIntervalsMs,
} from './scientificSonificationEngine';

describe('Dynamic Scientific Sonification Engine (v3.0)', () => {
  it('computes Doppler shift frequency accurately when source approaches and recedes', () => {
    const approaching = computeDopplerObservedHz(440, 34.3, 0, 343);
    const receding = computeDopplerObservedHz(440, -34.3, 0, 343);
    assert.ok(Math.abs(approaching - 488.89) < 0.05);
    assert.ok(Math.abs(receding - 400.0) < 0.05);
    assert.ok(approaching > 440 && receding < 440);
  });

  it('maps physical oscillation frequency logarithmically into audible harmonic pitch (220..880 Hz)', () => {
    const slow = computeHarmonicPitchHz(0.1);
    const mid = computeHarmonicPitchHz(1.0);
    const fast = computeHarmonicPitchHz(10.0);
    assert.strictEqual(slow, 220);
    assert.strictEqual(mid, 440);
    assert.strictEqual(fast, 880);
  });

  it('maps titration pH monotonically across the equivalence midpoint', () => {
    const acidic = computeTitrationPhPitchHz(2);
    const neutral = computeTitrationPhPitchHz(7);
    const basic = computeTitrationPhPitchHz(12);
    assert.ok(acidic < neutral && neutral < basic);
    assert.strictEqual(neutral, 440);
  });

  it('maps earthquake magnitude to deep seismic audio frequencies (55..140 Hz)', () => {
    const smallQuake = computeSeismicToneHz(3.5);
    const largeQuake = computeSeismicToneHz(8.0);
    assert.ok(smallQuake > largeQuake);
    assert.ok(largeQuake >= 55 && smallQuake <= 140);
  });

  it('evaluates stochastic Geiger-Müller Poisson click probability safely', () => {
    assert.strictEqual(shouldEmitGeigerClick(0, 0.1, 0.0), false);
    assert.strictEqual(shouldEmitGeigerClick(1000, 0.1, 0.05), true);
    assert.strictEqual(shouldEmitGeigerClick(10, 0.01, 0.9999), false);
  });

  it('computes physiological S1-S2 Lub-Dub heartbeat intervals for BPM', () => {
    const rest = computeHeartbeatIntervalsMs(60);
    const exercise = computeHeartbeatIntervalsMs(150);
    assert.strictEqual(rest.cycleMs, 1000);
    assert.strictEqual(rest.lubToDubMs, 320);
    assert.strictEqual(exercise.cycleMs, 400);
    assert.ok(exercise.lubToDubMs >= 140 && exercise.lubToDubMs < rest.lubToDubMs);
  });
});
