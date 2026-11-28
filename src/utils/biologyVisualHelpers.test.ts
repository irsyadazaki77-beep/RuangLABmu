import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCatalaseFormulaVisualState,
  computeCatalasePhHex,
  computeEcosystemVisualCounts,
  computeHeartVisualKinematics,
  computeLotkaVolterraVisualState,
  computeLungsVisualKinematics,
  computeNeuronVisualKinematics,
  computeOsmosisVisualState,
  computePhotosynthesisGasLevel,
  computePhotosynthesisVisualState,
  computeDnaPcrVisualState,
} from './biologyVisualHelpers';

test('computeOsmosisVisualState models hypotonic turgor, isotonic equilibrium, hypertonic plasmolysis, and van t Hoff Ψs', () => {
  const hypo = computeOsmosisVisualState(0.05, 25);
  assert.equal(hypo.state, 'hypotonic');
  assert.ok(hypo.vacuoleScale > 1.0, 'Central vacuole swells in hypotonic solution');
  assert.ok(hypo.cyclosisSpeed > 1.0, 'Cyclosis remains rapid in turgid cell');

  const iso = computeOsmosisVisualState(0.28, 25);
  assert.equal(iso.state, 'isotonic');

  const hyper = computeOsmosisVisualState(0.9, 25);
  assert.equal(hyper.state, 'hypertonic');
  assert.ok(hyper.protoplastScale < iso.protoplastScale, 'Protoplast shrinks in hypertonic medium');
  assert.ok(hyper.vacuoleScale < 0.5, 'Central vacuole collapses during plasmolysis');
  assert.ok(hyper.cyclosisSpeed < 0.3, 'Cytoplasmic streaming slows under severe plasmolysis');
  assert.ok(hyper.solutePotentialMpa < iso.solutePotentialMpa, 'Higher sucrose makes Ψs more negative');
});

test('computeEcosystemVisualCounts caps instanced counts and flags ecological balance states', () => {
  const balanced = computeEcosystemVisualCounts(40, 9, false);
  assert.equal(balanced.status, 'seimbang');
  assert.ok(balanced.preyInstances > balanced.predatorInstances);

  const liteBalanced = computeEcosystemVisualCounts(40, 9, true);
  assert.ok(liteBalanced.preyInstances <= balanced.preyInstances, 'Lite mode lowers instanced budget');

  assert.equal(computeEcosystemVisualCounts(100, 3, false).status, 'ledakan_mangsa');
  assert.equal(computeEcosystemVisualCounts(20, 35, false).status, 'tekanan_predasi');

  const lv = computeLotkaVolterraVisualState({ preyPopulationX: 40, predatorPopulationY: 9 });
  assert.equal(lv.equilibriumPreyX, 40);
  assert.equal(lv.equilibriumPredatorY, 27.5);
});

test('computeCatalaseFormulaVisualState matches exact Michaelis-Menten & >45C thermal denaturation', () => {
  assert.equal(computeCatalasePhHex(3.0), 0xf59e0b);
  assert.equal(computeCatalasePhHex(7.0), 0xef4444);
  assert.equal(computeCatalasePhHex(10.5), 0x8b5cf6);

  const opt = computeCatalaseFormulaVisualState({
    substrateConcMm: 10,
    solutionPH: 7.0,
    temperatureC: 37,
    enzymeVolumeMl: 1.0,
  });
  const boiled = computeCatalaseFormulaVisualState({
    substrateConcMm: 10,
    solutionPH: 7.0,
    temperatureC: 70,
    enzymeVolumeMl: 1.0,
  });
  assert.equal(opt.isDenatured, false);
  assert.equal(boiled.isDenatured, true, 'Catalase at 70°C must be severely denatured');
  assert.ok(
    boiled.foamHeightCm < opt.foamHeightCm * 0.15,
    'Boiled denatured catalase must produce near-zero foam compared to 37°C optimum'
  );
});

test('computePhotosynthesisVisualState models wavelength peaks AND waterTempC thermal curve', () => {
  const redGas = computePhotosynthesisGasLevel(1800, 660, 3.0, 28);
  const greenGas = computePhotosynthesisGasLevel(1800, 530, 3.0, 28);
  assert.ok(redGas > greenGas, 'Red absorption peak produces higher O2 accumulation than green');

  const optTemp = computePhotosynthesisVisualState(1800, 660, 3.0, 30);
  const coldTemp = computePhotosynthesisVisualState(1800, 660, 3.0, 12);
  const hotTemp = computePhotosynthesisVisualState(1800, 660, 3.0, 44);
  assert.ok(optTemp.bubbleRatePerMin > coldTemp.bubbleRatePerMin * 3);
  assert.ok(optTemp.bubbleRatePerMin > hotTemp.bubbleRatePerMin * 3);
});

test('Anatomy physiological kinematics helpers align with Poiseuille, Boyle/Hill SpO2, and All-or-None Nernst', () => {
  const heartNormal = computeHeartVisualKinematics({ heartRateBpm: 72, vesselRadiusRatio: 1.0 }, 0.2);
  const heartStenosis = computeHeartVisualKinematics({ heartRateBpm: 72, vesselRadiusRatio: 0.5 }, 0.2);
  assert.ok(heartStenosis.plaqueSeverity > 0.7);
  assert.ok(heartStenosis.metrics.vascularResistance > heartNormal.metrics.vascularResistance * 10);

  const lungsSea = computeLungsVisualKinematics({ altitudeMeters: 0, respirationRate: 15, diaphragmEffort: 50 }, 2.0);
  const lungsEverest = computeLungsVisualKinematics({ altitudeMeters: 7500, respirationRate: 15, diaphragmEffort: 50 }, 2.0);
  assert.ok(lungsEverest.hypoxiaRatio > lungsSea.hypoxiaRatio + 0.5, 'High altitude must trigger hypoxia tint');

  const neuronSub = computeNeuronVisualKinematics({ stimulusVoltageMv: -62, myelinThickness: 80 }, 0.25);
  const neuronFired = computeNeuronVisualKinematics({ stimulusVoltageMv: -35, myelinThickness: 80 }, 0.25);
  assert.equal(neuronSub.pulseRateHz, 0, 'Sub-threshold stimulus (< -55 mV) must not propagate impulse');
  assert.ok(neuronFired.pulseRateHz > 1.0, 'Supra-threshold myelinated axon must propagate rapidly');
});

test('computeDnaPcrVisualState syncs thermal cycler phases, annealing efficiency, and gel fragment migration', () => {
  const optimal = computeDnaPcrVisualState(
    { pcrCycles: 28, annealingTempC: 58, agaroseConcPct: 1.2, electrophoresisVoltageV: 110, dnaFragmentBp: 350 },
    2.5
  );
  const mismatched = computeDnaPcrVisualState(
    { pcrCycles: 28, annealingTempC: 71, agaroseConcPct: 1.2, electrophoresisVoltageV: 110, dnaFragmentBp: 2400 },
    0.5
  );
  assert.equal(optimal.cyclePhaseName, 'Annealing (Primer)');
  assert.equal(optimal.liveCyclerTempC, 58);
  assert.equal(mismatched.cyclePhaseName, 'Denaturasi (95 °C)');
  assert.ok(optimal.uvGlowIntensity > mismatched.uvGlowIntensity, 'Optimal Ta must yield brighter UV band');
  assert.ok(optimal.bandMigrationFrac > mismatched.bandMigrationFrac, 'Smaller 350 bp fragment migrates farther than 2400 bp');
  assert.equal(optimal.ladderMigrationFracs.length, 5);
});
