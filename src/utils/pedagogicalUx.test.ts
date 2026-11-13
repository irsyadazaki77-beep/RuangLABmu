import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCIENCE_GLOSSARY,
  getGlossaryEntry,
  findGlossaryTermInText,
  normalizeEducationLevel,
  shouldShowConceptLabelsByDefault,
  getPhysicsParameterFeedback,
  getChemistryParameterFeedback,
  getBiologyParameterFeedback,
  getAstronomyParameterFeedback,
  translateObservationPattern,
  projectWorldAnchorToViewport,
  computeGlossaryPopoverPosition,
} from './pedagogicalHelpers';

test('SCIENCE_GLOSSARY contains all 10 required science terms with explanation & analogy', () => {
  const requiredTerms = [
    'R²',
    'Slope/Gradien',
    'Outlier',
    'Eksentrisitas',
    'Denaturasi',
    'Osmosis',
    'Titik Ekivalen',
    'Vasokonstriksi',
    'Potensial Aksi',
    'Redshift',
  ];

  for (const term of requiredTerms) {
    const entry = getGlossaryEntry(term);
    assert.ok(entry, `Missing glossary entry for ${term}`);
    assert.ok(entry.explanation.length > 20, `Explanation too short for ${term}`);
    assert.ok(entry.analogy.length > 20, `Analogy too short for ${term}`);
  }

  assert.equal(getGlossaryEntry('r2')?.id, 'r-squared');
  assert.equal(getGlossaryEntry('Titik Ekuivalen')?.id, 'titik-ekivalen');
  assert.equal(findGlossaryTermInText('Kemiringan Slope kurva regresi')?.id, 'slope-gradien');
  assert.ok(SCIENCE_GLOSSARY.length >= 10);
});

test('shouldShowConceptLabelsByDefault activates for SMP/SMA and turns off for Mahasiswa', () => {
  assert.equal(normalizeEducationLevel('SMP'), 'smp');
  assert.equal(normalizeEducationLevel('Perguruan Tinggi'), 'mahasiswa');
  assert.equal(shouldShowConceptLabelsByDefault('smp'), true);
  assert.equal(shouldShowConceptLabelsByDefault('sma'), true);
  assert.equal(shouldShowConceptLabelsByDefault('mahasiswa'), false);
});

test('Parameter feedback differentiates SMP vs SMA intuition across 4 domains', () => {
  const smpPendulum = getPhysicsParameterFeedback('pendulum-harmonic', 'pendulumLength', 2.0, 'smp');
  const smaPendulum = getPhysicsParameterFeedback('pendulum-harmonic', 'pendulumLength', 2.0, 'sma');
  assert.ok(smpPendulum.includes('ayunan terasa lebih lambat'));
  assert.ok(smaPendulum.includes('2π√(L/g)'));
  assert.notEqual(smpPendulum, smaPendulum);

  const enzymeHotSmp = getBiologyParameterFeedback('enzyme-catalase', 'temperatureC', 52, 'smp');
  const enzymeHotSma = getBiologyParameterFeedback('enzyme-catalase', 'temperatureC', 52, 'sma');
  assert.ok(enzymeHotSmp.includes('> 45°C') && enzymeHotSmp.toLowerCase().includes('terdenaturasi'));
  assert.ok(enzymeHotSma.toLowerCase().includes('tersier'));

  const vesselNarrow = getBiologyParameterFeedback('anatomy-cardiovascular-heart', 'vesselRadiusRatio', 0.6, 'smp');
  assert.ok(vesselNarrow.toLowerCase().includes('menyempit') && vesselNarrow.toLowerCase().includes('tekanan darah'));

  const chemTitrationEq = getChemistryParameterFeedback(
    'acid-base-titration',
    'titrantAddedMl',
    25.0,
    'smp',
    { equivalenceVolumeMl: 25.0 }
  );
  assert.ok(chemTitrationEq.includes('Titik Ekivalen'));

  const astroEcc = getAstronomyParameterFeedback('solar-kepler', 'customEccentricity', 0.65, 'sma');
  assert.ok(astroEcc.includes('perihelion'));
});

const makeRec = (
  id: string,
  domain: 'Fisika' | 'Kimia',
  experimentTitle: string,
  numericX: number,
  numericY1: number
) => ({
  id,
  timestamp: '10:00',
  studentName: 'Siswa Uji',
  groupId: 'G1',
  domain,
  experimentTitle,
  parametersSummary: '',
  keyMetrics: {},
  numericX,
  numericY1,
  notes: '',
});

test('translateObservationPattern handles empty, <3 points, constant-X, rising, falling, flat & NaN', () => {
  const emptyRes = translateObservationPattern({ records: [], domain: 'Fisika', moduleId: 'pendulum-harmonic' });
  assert.equal(emptyRes.status, 'empty');

  const twoPts = translateObservationPattern({
    records: [
      makeRec('1', 'Fisika', 'Bandul', 0.5, 1.42),
      makeRec('2', 'Fisika', 'Bandul', 1.0, 2.01),
    ],
    moduleId: 'pendulum-harmonic',
  });
  assert.equal(twoPts.status, 'insufficient');
  assert.equal(twoPts.pointsCount, 2);

  const constantX = translateObservationPattern({
    records: [
      makeRec('1', 'Fisika', 'Bandul', 1.0, 2.0),
      makeRec('2', 'Fisika', 'Bandul', 1.0, 2.1),
      makeRec('3', 'Fisika', 'Bandul', 1.0, 2.0),
    ],
    moduleId: 'pendulum-harmonic',
  });
  assert.equal(constantX.status, 'constant-x');

  const rising = translateObservationPattern({
    records: [
      makeRec('1', 'Fisika', 'Bandul', 0.5, 1.4),
      makeRec('2', 'Fisika', 'Bandul', 1.0, 2.0),
      makeRec('3', 'Fisika', 'Bandul', 1.5, 2.5),
    ],
    moduleId: 'pendulum-harmonic',
  });
  assert.equal(rising.status, 'ready');
  assert.equal(rising.trendDirection, 'naik');
  assert.ok(rising.rSquaredPct >= 95);
  assert.ok(rising.summaryText.includes('Berdasarkan 3 data'));

  const falling = translateObservationPattern({
    records: [
      makeRec('1', 'Kimia', 'Hukum Boyle', 2, 12),
      makeRec('2', 'Kimia', 'Hukum Boyle', 4, 6),
      makeRec('3', 'Kimia', 'Hukum Boyle', 8, 3),
    ],
    moduleId: 'ideal-gas-boyle',
  });
  assert.equal(falling.trendDirection, 'turun');

  const flatWithNaN = translateObservationPattern({
    records: [
      makeRec('1', 'Fisika', 'Bandul', 1, 2.0),
      makeRec('2', 'Fisika', 'Bandul', 2, 2.0),
      makeRec('3', 'Fisika', 'Bandul', 3, 2.0),
      makeRec('4', 'Fisika', 'Bandul', Number.NaN, 5.0),
    ],
    moduleId: 'pendulum-harmonic',
  });
  assert.equal(flatWithNaN.pointsCount, 3);
  assert.equal(flatWithNaN.trendDirection, 'stabil');
});

test('projectWorldAnchorToViewport hides small viewports, behind-camera points, and clamps edges', () => {
  assert.equal(projectWorldAnchorToViewport(0, 0, 0.5, 280, 180).visible, false);
  assert.equal(projectWorldAnchorToViewport(0, 0, 1.2, 800, 500).visible, false);
  assert.equal(projectWorldAnchorToViewport(0, 0, -1.5, 800, 500).visible, false);

  const center = projectWorldAnchorToViewport(0, 0, 0.2, 800, 500);
  assert.equal(center.visible, true);
  assert.equal(center.x, 400);
  assert.equal(center.y, 250);

  const clampedRight = projectWorldAnchorToViewport(0.99, 0.99, 0.2, 800, 500);
  assert.equal(clampedRight.visible, true);
  assert.equal(clampedRight.x, 800 - 56);
  assert.equal(clampedRight.y, 48);
});

test('computeGlossaryPopoverPosition keeps popover strictly inside 360px mobile viewport', () => {
  // Trigger at far right edge on 360px screen
  const rightEdge = computeGlossaryPopoverPosition(
    { left: 325, width: 24, top: 100, bottom: 120 },
    360,
    740
  );
  assert.ok(rightEdge.left >= 12);
  assert.ok(rightEdge.left + rightEdge.width <= 360 - 12);

  // Trigger at far left edge on 360px screen
  const leftEdge = computeGlossaryPopoverPosition(
    { left: 4, width: 24, top: 100, bottom: 120 },
    360,
    740
  );
  assert.ok(leftEdge.left >= 12);
  assert.ok(leftEdge.left + leftEdge.width <= 360 - 12);

  // Trigger near bottom flips upward cleanly
  const nearBottom = computeGlossaryPopoverPosition(
    { left: 160, width: 40, top: 650, bottom: 670 },
    360,
    740
  );
  assert.equal(nearBottom.placeAbove, true);
});
