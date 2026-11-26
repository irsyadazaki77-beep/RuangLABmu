import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_CATALOG } from '../registry/experimentRegistry';
import {
  computeParameterBaselineDeltas,
  generateAutoSweepSeries,
  getAstronomyPresetsForMode,
  getBiologyPresetsForModule,
  getChemistryPresetsForMode,
  getPhysicsPresetsForMode,
} from './labScenarioPresets';

describe('labScenarioPresets', () => {
  it('provides 3 curated scenario presets (including extreme phenomenon presets) for Physics, Chemistry, Astronomy, and Biology modes', () => {
    const physPresets = getPhysicsPresetsForMode('newton-incline');
    assert.equal(physPresets.length, 3);
    assert.ok(physPresets.every((p) => p.label.length > 0 && Object.keys(p.patch).length > 0));
    assert.ok(physPresets.some((p) => p.category === 'extreme'));

    const chemPresets = getChemistryPresetsForMode('acid-base-titration');
    assert.equal(chemPresets.length, 3);
    assert.ok(chemPresets.some((p) => p.patch.titrantAddedMl === 20 && p.category === 'extreme'));

    const astroPresets = getAstronomyPresetsForMode('solar-kepler');
    assert.equal(astroPresets.length, 3);
    assert.ok(astroPresets.some((p) => p.patch.customSemiMajorAxisAu === 1.0));
    assert.ok(astroPresets.some((p) => p.category === 'extreme'));

    const bioMod = EXPERIMENT_CATALOG.find((m) => m.domain === 'biologi');
    assert.ok(bioMod);
    const bioPresets = getBiologyPresetsForModule(bioMod);
    assert.equal(bioPresets.length, 3);
    assert.ok(bioPresets.some((p) => p.category === 'extreme'));
  });

  it('computes accurate baseline vs current parameter deltas and change directions', () => {
    const baseline = { appliedForce: 20, mass: 5, gravity: 9.81 };
    const current = { appliedForce: 45, mass: 5, gravity: 1.62 };
    const deltas = computeParameterBaselineDeltas(baseline, current, 4);

    assert.equal(deltas.length, 3);
    const forceDelta = deltas.find((d) => d.key === 'appliedForce')!;
    assert.equal(forceDelta.direction, 'up');
    assert.equal(forceDelta.deltaValue, 25);

    const gravDelta = deltas.find((d) => d.key === 'gravity')!;
    assert.equal(gravDelta.direction, 'down');
    assert.ok(gravDelta.deltaValue < 0);

    const massDelta = deltas.find((d) => d.key === 'mass')!;
    assert.equal(massDelta.direction, 'same');
    assert.equal(massDelta.deltaValue, 0);
  });

  it('generates strictly ascending 5-point Auto-Sweep series across all 4 domains', () => {
    const domains: Array<{ domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi'; id: string }> = [
      { domain: 'Fisika', id: 'newton-incline' },
      { domain: 'Kimia', id: 'acid-base-titration' },
      { domain: 'Astronomi', id: 'hubble-expansion' },
      { domain: 'Biologi', id: EXPERIMENT_CATALOG.find((m) => m.domain === 'biologi')!.id },
    ];

    for (const item of domains) {
      const series = generateAutoSweepSeries(item.domain, item.id, 5);
      assert.equal(series.length, 5, `Expected 5 sweep steps for ${item.domain}`);
      for (let i = 1; i < series.length; i++) {
        assert.ok(
          series[i].xValue > series[i - 1].xValue,
          `Sweep xValue should strictly increase for ${item.domain}/${item.id}`
        );
      }
      assert.ok(series[0].patch[series[0].paramKey] === series[0].xValue);
    }
  });
});
