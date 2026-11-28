import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSeismicStep,
  computeGreenhouseStep,
  computeDarcyHydrologyStep,
  computeRadioactiveDecayStep,
} from './earthDomainSim';

describe('Pilar 3: Earth & Environmental Science Deterministic Solver', () => {
  it('computes seismic P & S arrival lag accurately: Δt = d * (1/vs - 1/vp)', () => {
    const out = computeSeismicStep(
      { epicenterDistance: 120, focalDepth: 0, pWaveVelocity: 6.0, sWaveVelocity: 3.0, magnitude: 6.0 },
      25
    );
    // d = sqrt(120^2 + 1^2) ≈ 120.004 (focalDepth clamped to min 1 km)
    assert.ok(Math.abs(out.pArrivalSec - 20.0) < 0.05);
    assert.ok(Math.abs(out.sArrivalSec - 40.0) < 0.05);
    assert.ok(Math.abs(out.spLagSec - 20.0) < 0.05);
    assert.ok(out.peakGroundAccelG > 0);
  });

  it('computes greenhouse Stefan-Boltzmann warming and CO2 sensitivity', () => {
    const preIndustrial = computeGreenhouseStep(
      { solarConstant: 1361, albedo: 0.3, co2Concentration: 280 },
      0
    );
    const highCo2 = computeGreenhouseStep(
      { solarConstant: 1361, albedo: 0.3, co2Concentration: 560 },
      0
    );
    assert.ok(preIndustrial.effectiveTempK > 250 && preIndustrial.effectiveTempK < 260);
    assert.ok(preIndustrial.surfaceTempK > preIndustrial.effectiveTempK);
    assert.ok(highCo2.surfaceTempC > preIndustrial.surfaceTempC);
    assert.ok(highCo2.radiativeForcingWm2 > 3.5 && highCo2.radiativeForcingWm2 < 4.0);
  });

  it('computes Darcy groundwater discharge Q = K * A * (Δh / L)', () => {
    const out = computeDarcyHydrologyStep(
      { hydraulicConductivity: 10, hydraulicHeadDiff: 5, aquiferLength: 100, crossSectionArea: 20 },
      0
    );
    // i = 0.05, q = 0.5 m/day, Q = 10 m^3/day
    assert.strictEqual(out.hydraulicGradient, 0.05);
    assert.strictEqual(out.darcyFluxMPerDay, 0.5);
    assert.strictEqual(out.dischargeM3PerDay, 10);
  });

  it('computes radioactive half-life decay accurately (3 half-lives => 12.5%)', () => {
    const out = computeRadioactiveDecayStep(
      { initialNuclei: 10000, halfLife: 5.0, elapsedTime: 15.0 },
      0
    );
    assert.strictEqual(out.halfLivesElapsed, 3);
    assert.strictEqual(out.remainingPercent, 12.5);
    assert.strictEqual(out.remainingAtoms, 1250);
  });
});
