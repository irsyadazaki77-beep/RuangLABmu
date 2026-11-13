import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeArrheniusKineticsState,
  computeBeerLambertBeamState,
  computeGasPistonVisualState,
} from './chemistryVisualHelpers';

test('computeGasPistonVisualState computes piston height and thermal color across temperature ranges', () => {
  const cool = computeGasPistonVisualState(10, 290);
  const hot = computeGasPistonVisualState(20, 520);
  assert.ok(hot.pistonY > cool.pistonY);
  assert.equal(cool.gasColorHex, 0x38bdf8);
  assert.equal(hot.gasColorHex, 0xef4444);
  assert.ok(hot.particleSpeed > cool.particleSpeed);
});

test('computeArrheniusKineticsState computes heater glow and stirrer angular velocity', () => {
  const room = computeArrheniusKineticsState(25, 200, false);
  const heated = computeArrheniusKineticsState(80, 600, true);
  assert.ok(Math.abs(room.heaterIntensity) < 1e-4);
  assert.ok(heated.heaterIntensity > 1.0);
  assert.ok(heated.stirAngularStep > room.stirAngularStep);
  assert.ok(heated.vortexOpacity > room.vortexOpacity);
});

test('computeBeerLambertBeamState computes Beer-Lambert beam attenuation and spectral color', () => {
  const lowAbs = computeBeerLambertBeamState(470, 0.1);
  const highAbs = computeBeerLambertBeamState(650, 1.8);
  assert.equal(lowAbs.beamColorHex, 0x3b82f6);
  assert.equal(highAbs.beamColorHex, 0xef4444);
  assert.ok(lowAbs.transmittedOpacity > highAbs.transmittedOpacity);
  assert.ok(lowAbs.transmittance > 0.75);
  assert.ok(highAbs.transmittance < 0.05);
});
