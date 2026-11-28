import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_CATALOG, getExperimentById } from '../experimentRegistry';
import { FORMULA_PRIMER_MODELS } from './formulaPrimerModels';
import {
  getAdaptiveCameraPose,
  resolveApparatusInspection,
  type StudioDomain,
} from '../../utils/studio3DCatalog';
import { calculatePhysicsMetrics } from '../../utils/engines/physicsEngine';
import { calculateChemistryMetrics } from '../../utils/engines/chemistryEngine';
import { calculateEnzymeKinetics } from '../../utils/engines/biologyEngine';
import { extractConceptHint, formatCleanEquation } from '../../utils/spatialHudHelpers';

const RAW_LATEX_PATTERN = /\\frac|\\sqrt|\\sum|\\in\b|10\^[0-9-]/;
const ASCII_UNDERSCORE_VAR_PATTERN = /\b[A-Za-z]+_[A-Za-z0-9]+\b/;

function assertCleanNotation(text: string, context: string) {
  assert.equal(
    RAW_LATEX_PATTERN.test(text),
    false,
    `Raw LaTeX leaked in ${context}: "${text}"`
  );
  assert.equal(
    ASCII_UNDERSCORE_VAR_PATTERN.test(text),
    false,
    `ASCII underscore variable leaked in ${context}: "${text}"`
  );
}

describe('40-Module Structured Pedagogy & Interactive Formula Primers', () => {
  it('covers all 40 modules with complete structured pedagogy fields', () => {
    assert.equal(EXPERIMENT_CATALOG.length, 40);

    for (const mod of EXPERIMENT_CATALOG) {
      assert.ok(
        Array.isArray(mod.keyTakeaways) && mod.keyTakeaways.length >= 3,
        `${mod.id} missing >= 3 keyTakeaways`
      );
      assert.ok(mod.everydayAnalogy, `${mod.id} missing everydayAnalogy`);
      assert.ok(mod.everydayAnalogy.title.length > 4, `${mod.id} analogy title too short`);
      assert.ok(mod.everydayAnalogy.scenario.length > 15, `${mod.id} analogy scenario too short`);
      assert.ok(mod.everydayAnalogy.connection.length > 15, `${mod.id} analogy connection too short`);

      assert.ok(
        Array.isArray(mod.formulaBreakdown) && mod.formulaBreakdown.length >= 3,
        `${mod.id} missing >= 3 formulaBreakdown items`
      );

      assert.ok(mod.workedExample, `${mod.id} missing workedExample`);
      assert.ok(mod.workedExample.question.length > 10, `${mod.id} workedExample missing question`);
      assert.ok(mod.workedExample.steps.length >= 2, `${mod.id} workedExample needs >= 2 steps`);
      assert.ok(mod.workedExample.answer.length > 2, `${mod.id} workedExample missing answer`);

      assert.ok(
        Array.isArray(mod.glossary) && mod.glossary.length >= 3,
        `${mod.id} missing >= 3 glossary terms`
      );

      assert.ok(mod.deepDiveContent, `${mod.id} missing deepDiveContent`);
      assert.ok(
        Boolean(mod.deepDiveContent.historicalContext || mod.deepDiveContent.advancedConcept),
        `${mod.id} deepDiveContent has no narrative content`
      );

      assert.ok(
        Array.isArray(mod.preLabQuiz) && mod.preLabQuiz.length >= 2,
        `${mod.id} must have at least 2 pre-lab quiz questions`
      );
    }
  });

  it('contains zero raw LaTeX or ASCII underscore notation leaks across all 28 modules', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      mod.keyTakeaways?.forEach((item, idx) =>
        assertCleanNotation(item, `${mod.id}.keyTakeaways[${idx}]`)
      );
      if (mod.everydayAnalogy) {
        assertCleanNotation(mod.everydayAnalogy.title, `${mod.id}.everydayAnalogy.title`);
        assertCleanNotation(mod.everydayAnalogy.scenario, `${mod.id}.everydayAnalogy.scenario`);
        assertCleanNotation(mod.everydayAnalogy.connection, `${mod.id}.everydayAnalogy.connection`);
      }
      mod.formulaBreakdown?.forEach((v, idx) => {
        assertCleanNotation(v.symbol, `${mod.id}.formulaBreakdown[${idx}].symbol`);
        assertCleanNotation(v.name, `${mod.id}.formulaBreakdown[${idx}].name`);
        assertCleanNotation(v.unit, `${mod.id}.formulaBreakdown[${idx}].unit`);
        assertCleanNotation(v.explanation, `${mod.id}.formulaBreakdown[${idx}].explanation`);
      });
      if (mod.workedExample) {
        assertCleanNotation(mod.workedExample.question, `${mod.id}.workedExample.question`);
        mod.workedExample.given.forEach((g, idx) =>
          assertCleanNotation(g, `${mod.id}.workedExample.given[${idx}]`)
        );
        mod.workedExample.steps.forEach((s, idx) =>
          assertCleanNotation(s, `${mod.id}.workedExample.steps[${idx}]`)
        );
        assertCleanNotation(mod.workedExample.answer, `${mod.id}.workedExample.answer`);
        assertCleanNotation(
          mod.workedExample.physicalMeaning,
          `${mod.id}.workedExample.physicalMeaning`
        );
      }
      mod.glossary?.forEach((g, idx) => {
        assertCleanNotation(g.term, `${mod.id}.glossary[${idx}].term`);
        assertCleanNotation(g.definition, `${mod.id}.glossary[${idx}].definition`);
      });
      mod.preLabQuiz.forEach((q, idx) => {
        assertCleanNotation(q.question, `${mod.id}.preLabQuiz[${idx}].question`);
        q.options.forEach((opt, oi) =>
          assertCleanNotation(opt, `${mod.id}.preLabQuiz[${idx}].options[${oi}]`)
        );
        assertCleanNotation(q.explanation, `${mod.id}.preLabQuiz[${idx}].explanation`);
      });
    }
  });

  it('provides a dedicated clean InteractiveFormulaPrimer model for all 28 modules', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      const model = FORMULA_PRIMER_MODELS[mod.id];
      assert.ok(model, `Missing FORMULA_PRIMER_MODELS entry for ${mod.id}`);
      assert.ok(model.variables.length >= 1, `${mod.id} primer needs >= 1 variable`);
      assertCleanNotation(model.title, `primer.${mod.id}.title`);
      assertCleanNotation(model.outcomeSymbol, `primer.${mod.id}.outcomeSymbol`);
      assertCleanNotation(model.outcomeLabel, `primer.${mod.id}.outcomeLabel`);

      const defaultVals: Record<string, number> = {};
      for (const v of model.variables) {
        assertCleanNotation(v.symbol, `primer.${mod.id}.var.${v.key}.symbol`);
        assertCleanNotation(v.label, `primer.${mod.id}.var.${v.key}.label`);
        defaultVals[v.key] = v.defaultValue;
      }

      const outcome = model.computeOutcome(defaultVals);
      assert.ok(Number.isFinite(outcome), `primer.${mod.id} returned non-finite outcome`);

      const sentence = model.buildIntuitiveSentence(model.variables[0], defaultVals, outcome);
      assert.ok(sentence.length > 15, `primer.${mod.id} returned short intuitive sentence`);
      assertCleanNotation(sentence, `primer.${mod.id}.sentence`);
    }
  });
});

describe('3D Studio Adaptive Camera Catalog & Apparatus Inspector', () => {
  const DOMAIN_MAP: Record<string, StudioDomain> = {
    fisika: 'physics',
    kimia: 'chemistry',
    biologi: 'biology',
    astronomi: 'astronomy',
    kebumian: 'earth',
  };

  it('returns finite camera poses for all presets across all 28 modules', () => {
    const presets = ['isometric', 'front', 'top', 'focus', 'ecliptic'] as const;
    for (const mod of EXPERIMENT_CATALOG) {
      const domain = DOMAIN_MAP[mod.domain];
      for (const preset of presets) {
        const pose = getAdaptiveCameraPose(domain, mod.id, preset);
        assert.equal(pose.pos.length, 3);
        assert.equal(pose.target.length, 3);
        pose.pos.forEach((n) => assert.ok(Number.isFinite(n), `Non-finite pos for ${mod.id}:${preset}`));
        pose.target.forEach((n) =>
          assert.ok(Number.isFinite(n), `Non-finite target for ${mod.id}:${preset}`)
        );
      }
    }
  });

  it('resolves clean Indonesian apparatus inspection metadata for all 28 modules', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      const domain = DOMAIN_MAP[mod.domain];
      const info = resolveApparatusInspection(domain, mod.id);
      assert.ok(info.title.length > 3, `Missing title for ${mod.id}`);
      assert.ok(info.roleSummary.length > 10, `Missing roleSummary for ${mod.id}`);
      assert.ok(info.scientificConcept.length > 10, `Missing scientificConcept for ${mod.id}`);
      assert.ok(info.relatedFormula.length > 2, `Missing relatedFormula for ${mod.id}`);
      assertCleanNotation(info.title, `inspector.${mod.id}.title`);
      assertCleanNotation(info.roleSummary, `inspector.${mod.id}.roleSummary`);
      assertCleanNotation(info.scientificConcept, `inspector.${mod.id}.scientificConcept`);
      assertCleanNotation(info.relatedFormula, `inspector.${mod.id}.relatedFormula`);
    }
  });
});

describe('Scientific Accuracy & Cross-Layer Consistency Across All 28 Modules', () => {
  it('validates all preLabQuiz items have valid correctIndex and non-empty explanations', () => {
    for (const mod of EXPERIMENT_CATALOG) {
      assert.ok(mod.preLabQuiz.length >= 2, `${mod.id} needs >= 2 preLabQuiz items`);
      for (const q of mod.preLabQuiz) {
        assert.ok(q.question.trim().length > 8, `${mod.id}:${q.id} question too short`);
        assert.ok(q.options.length >= 2, `${mod.id}:${q.id} needs >= 2 options`);
        assert.ok(
          Number.isInteger(q.correctIndex) &&
            q.correctIndex >= 0 &&
            q.correctIndex < q.options.length,
          `${mod.id}:${q.id} invalid correctIndex ${q.correctIndex}`
        );
        assert.ok(q.explanation.trim().length > 10, `${mod.id}:${q.id} explanation too short`);
      }
    }
  });

  it('keeps thermo-calorimetry primer aligned with q = m · c · ΔT', () => {
    const primer = FORMULA_PRIMER_MODELS['thermo-calorimetry'];
    assert.ok(primer);
    assert.equal(primer.computeOutcome({ m: 200, dT: 10 }), 8.37);
    assert.equal(primer.computeOutcome({ m: 500, dT: 20 }), 41.84);
  });

  it('keeps ohm-wheatstone unified on R1·Rx = R2·R3 across module, engine, and primer', () => {
    const mod = getExperimentById('ohm-wheatstone')!;
    const balanced = mod.computeStep(
      { sourceVoltage: 12, resistor1: 100, resistor2: 200, resistor3: 150, unknownRx: 300 },
      0
    );
    assert.equal(balanced.bridgeVoltage, 0);
    assert.equal(balanced.calculatedRx, 300);

    const engineBalanced = calculatePhysicsMetrics({
      mass: 5,
      appliedForce: 0,
      inclineAngle: 0,
      frictionCoeffStatic: 0.2,
      frictionCoeffKinetic: 0.1,
      gravity: 9.81,
      initialVelocity: 0,
      launchAngle: 0,
      initialHeight: 0,
      secondaryMass: 100,
      separationDistance: 5,
      collisionMass2: 2,
      velocity2Initial: 0,
      restitutionCoeff: 1,
      springConstantK: 100,
      springDisplacement: 0,
      dampingCoeff: 0,
      mode: 'ohm-wheatstone',
      circuitVoltage: 12,
      resistorR1: 100,
      resistorR2: 200,
      resistorR3: 150,
      resistorRx: 300,
    });
    assert.equal(engineBalanced.mode, 'ohm-wheatstone');
    if (engineBalanced.mode === 'ohm-wheatstone') {
      assert.equal(engineBalanced.galvanometerCurrent, 0);
      assert.equal(engineBalanced.bridgeBalanced, true);
    }

    const primer = FORMULA_PRIMER_MODELS['ohm-wheatstone'];
    assert.equal(primer.computeOutcome({ R3: 150, R2: 200, R1: 100 }), 300);
  });

  it('computes astrophysically accurate Milky Way halo mass and solar B-V color index', () => {
    const mw = getExperimentById('milky-way-rotation')!;
    const out = mw.computeStep(
      { galactocentricRadiusKpc: 8.2, darkMatterHaloFraction: 1.0, bulgeDiskMassFactor: 1.0 },
      0
    );
    assert.ok(
      out.darkMatterMassEnclosed >= 2 && out.darkMatterMassEnclosed <= 15,
      `Expected realistic halo mass 2-15 ×10^10 Msun at 8.2 kpc, got ${out.darkMatterMassEnclosed}`
    );

    const wien = getExperimentById('stellar-wien-spectrum')!;
    const sun = wien.computeStep({ starEffectiveTempK: 5778, starRadiusSolar: 1.0 }, 0);
    assert.ok(
      sun.colorIndexBMinusV >= 0.6 && sun.colorIndexBMinusV <= 0.7,
      `Expected Sun B-V near +0.65, got ${sun.colorIndexBMinusV}`
    );
  });

  it('aligns enzyme-catalase Km = 4.5 mM and unit μmol/(L·s) across module, engine, and primer', () => {
    const mod = getExperimentById('enzyme-catalase')!;
    const out = mod.computeStep({ substrateConcMm: 4.5, temperatureC: 37, solutionPH: 7.0, enzymeVolumeMl: 1.0 }, 0);
    assert.equal(out.reactionRateV, 60);

    const eng = calculateEnzymeKinetics({
      substrateConcMm: 4.5,
      vMaxBase: 120,
      kmConstantMm: 4.5,
      temperatureC: 37,
      solutionPh: 7.0,
    });
    assert.equal(eng.reactionVelocityV, 60);

    const primer = FORMULA_PRIMER_MODELS['enzyme-catalase'];
    assert.equal(primer.outcomeUnit, 'μmol/(L·s)');
    assert.equal(primer.computeOutcome({ S: 4.5, T: 37 }), 60);
  });

  it('keeps photosynthesis-ingenhousz O2 multiplier consistent and limitingFactorCode dynamic', () => {
    const mod = getExperimentById('photosynthesis-ingenhousz')!;
    const lowLight = mod.computeStep(
      { lightIntensityLux: 100, wavelengthNm: 660, bicarbonateConc: 2.5, waterTempC: 28 },
      0
    );
    assert.equal(lowLight.limitingFactorCode, 1);
    assert.ok(Math.abs(lowLight.o2VolumeProducedMl - lowLight.bubbleRatePerMin * 0.045) < 0.01);

    const lowCo2 = mod.computeStep(
      { lightIntensityLux: 3500, wavelengthNm: 660, bicarbonateConc: 0.1, waterTempC: 28 },
      0
    );
    assert.equal(lowCo2.limitingFactorCode, 2);

    const highTemp = mod.computeStep(
      { lightIntensityLux: 3500, wavelengthNm: 660, bicarbonateConc: 2.5, waterTempC: 44 },
      0
    );
    assert.equal(highTemp.limitingFactorCode, 3);
  });

  it('models diatomic ideal-gas adiabatic compression consistently and Ag+ Nernst stoichiometry', () => {
    const gas = getExperimentById('ideal-gas-boyle')!;
    const iso = gas.computeStep({ moles: 1.0, temperatureK: 300, volumeL: 5.0, isAdiabatic: 0 }, 0);
    const adia = gas.computeStep({ moles: 1.0, temperatureK: 300, volumeL: 5.0, isAdiabatic: 1 }, 0);
    assert.ok(adia.pressureAtm > iso.pressureAtm);
    assert.ok(adia.internalEnergyJ > iso.internalEnergyJ);

    const agCell = calculateChemistryMetrics({
      mode: 'electrochemistry-cell',
      reactionId: 'neutralization-hcl-naoh',
      initialTempC: 25,
      reactantConcentration: 1.0,
      solutionVolumeMl: 200,
      pressureAtm: 1.0,
      useCatalyst: false,
      stirringRpm: 200,
      analyteAcidConc: 0.2,
      analyteVolumeMl: 25,
      titrantBaseConc: 0.25,
      titrantAddedMl: 20,
      acidPka: 1.0,
      indicatorType: 'fenolftalein',
      redoxPairId: 'mg-ag-high',
      anodeConcM: 1.0,
      cathodeConcM: 0.5,
    });
    assert.equal(agCell.reactionQuotientQ, 4);
  });

  it('extractConceptHint preserves decimal numbers and formatCleanEquation converts Leftrightarrow', () => {
    assert.equal(
      extractConceptHint('Pada pH = 7.0 dan g = 9.81 m/s², sistem berada pada kondisi setimbang. Kalimat kedua.'),
      'Pada pH = 7.0 dan g = 9.81 m/s², sistem berada pada kondisi setimbang.'
    );
    assert.ok(
      formatCleanEquation('T^2 / a^3 = 1/M_* \\Leftrightarrow T^2 = \\frac{4\\pi^2}{GM_*}a^3').includes('⇔')
    );
  });

  it('validates scientific calculations for the 4 new cross-domain 3D modules', () => {
    const melde = getExperimentById('standing-wave-melde')!;
    assert.ok(melde);
    const meldeOut = melde.computeStep(
      { mass: 2.0, stringLength: 1.2, linearMassDensity: 0.005, waveFrequency: 50 },
      0
    );
    assert.ok(meldeOut.waveSpeed > 60 && meldeOut.waveSpeed < 64);
    assert.ok(meldeOut.harmonicLoops > 1.8 && meldeOut.harmonicLoops < 2.1);

    const lechat = getExperimentById('chemical-equilibrium-lechatelier')!;
    assert.ok(lechat);
    const coldEq = lechat.computeStep({ equilibriumTempC: 5, equilibriumPressureAtm: 1.0, n2o4InitialConcM: 0.5 }, 0);
    const hotEq = lechat.computeStep({ equilibriumTempC: 75, equilibriumPressureAtm: 1.0, n2o4InitialConcM: 0.5 }, 0);
    assert.ok(
      hotEq.no2MoleFractionPct > coldEq.no2MoleFractionPct,
      'Endothermic N2O4 -> 2NO2 must shift toward NO2 at higher temperature'
    );

    const mendel = getExperimentById('mendel-genetics-dihybrid')!;
    assert.ok(mendel);
    const mendelOut = mendel.computeStep(
      { sampleSizeN: 320, dominantAlleleFreqR: 0.5, dominantAlleleFreqY: 0.5 },
      0
    );
    assert.equal(
      mendelOut.observedRoundYellow +
        mendelOut.observedRoundGreen +
        mendelOut.observedWrinkledYellow +
        mendelOut.observedWrinkledGreen,
      320
    );

    const gh = getExperimentById('planetary-atmosphere-greenhouse')!;
    assert.ok(gh);
    const earth = gh.computeStep({ planetaryAlbedo: 0.3, greenhouseGasPpm: 420, stellarFluxFactor: 1.0 }, 0);
    const highGh = gh.computeStep({ planetaryAlbedo: 0.3, greenhouseGasPpm: 1600, stellarFluxFactor: 1.0 }, 0);
    assert.ok(earth.surfaceTempK > earth.equilibriumTempK);
    assert.ok(highGh.surfaceTempK > earth.surfaceTempK);
  });

  it('validates exact scientific formulas across the 4 newly expanded 3D modules', () => {
    const faraday = getExperimentById('faraday-induction')!;
    assert.ok(faraday);
    const f1 = faraday.computeStep(
      { coilTurnsN: 100, magneticFieldTesla: 0.5, magnetOscillationHz: 2.0, coilAreaCm2: 20, loadResistanceOhm: 10 },
      0
    );
    assert.equal(f1.faradayPeakFluxMwb, 1);
    assert.ok(Math.abs(f1.faradayPeakEmfV - 1.257) < 0.01);

    const elec = getExperimentById('electrolysis-faraday')!;
    assert.ok(elec);
    const e1 = elec.computeStep(
      { electrolysisCurrentA: 2.5, electrolysisTimeMin: 30, electrolysisMolarMass: 63.55, electrolysisValenceN: 2 },
      0
    );
    assert.equal(e1.electrolysisChargeC, 4500);
    assert.ok(Math.abs(e1.electrolysisMassDepositedG - 1.482) < 0.01);

    const pcr = getExperimentById('dna-pcr-electrophoresis')!;
    assert.ok(pcr);
    const pcrOpt = pcr.computeStep(
      { pcrCycles: 25, annealingTempC: 58, agaroseConcPct: 1.2, electrophoresisVoltageV: 100, dnaFragmentBp: 750 },
      0
    );
    const pcrHighTa = pcr.computeStep(
      { pcrCycles: 25, annealingTempC: 70, agaroseConcPct: 1.2, electrophoresisVoltageV: 100, dnaFragmentBp: 750 },
      0
    );
    assert.equal(pcrOpt.pcrEfficiencyPct, 100);
    assert.ok(pcrOpt.log10DnaCopies > pcrHighTa.log10DnaCopies);
    const smallBand = pcr.computeStep({ pcrCycles: 25, annealingTempC: 58, agaroseConcPct: 1.2, electrophoresisVoltageV: 100, dnaFragmentBp: 250 }, 0);
    const largeBand = pcr.computeStep({ pcrCycles: 25, annealingTempC: 58, agaroseConcPct: 1.2, electrophoresisVoltageV: 100, dnaFragmentBp: 2000 }, 0);
    assert.ok(smallBand.migrationDistanceMm > largeBand.migrationDistanceMm);

    const bin = getExperimentById('doppler-redshift-binary')!;
    assert.ok(bin);
    const faceOn = bin.computeStep({ binaryMass1Solar: 2.0, binaryMass2Solar: 1.0, binarySeparationAu: 0.45, binaryInclinationDeg: 0 }, 0);
    const edgeOn = bin.computeStep({ binaryMass1Solar: 2.0, binaryMass2Solar: 1.0, binarySeparationAu: 0.45, binaryInclinationDeg: 90 }, 0);
    assert.equal(faceOn.binaryMaxDopplerShiftNm, 0);
    assert.ok(edgeOn.binaryMaxDopplerShiftNm > 0.05);
    assert.ok(Math.abs(edgeOn.binaryRadialVel2Kms - 2 * edgeOn.binaryRadialVel1Kms) < 0.05);
  });
});

