import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePhysicsMetrics,
  evaluateKinematicsAtTime,
  calculateChemistryMetrics,
  calculateAstronomyMetrics,
  calculateLinearRegression,
  gradeWorksheetAnswers,
  calculateStudentRubric,
  exportRecordsToCSV,
  exportRubricGradesToCSV,
  GUIDED_LAB_SCENARIOS,
  getConceptCardContent,
  stepParameterValue,
  mapAcademicLevelToTelemetry,
  buildDrLabMuTelemetry,
  generateSocraticDrLabMuResponse,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
  ExperimentRecord,
} from './scienceEngine';

const defaultPhysics: PhysicsParams = {
  mass: 10,
  appliedForce: 15,
  inclineAngle: 0,
  frictionCoeffStatic: 0.3,
  frictionCoeffKinetic: 0.2,
  gravity: 9.81,
  initialVelocity: 0,
  launchAngle: 0,
  initialHeight: 0,
  secondaryMass: 1000,
  separationDistance: 5,
  collisionMass2: 2,
  velocity2Initial: 0,
  restitutionCoeff: 1.0,
  springConstantK: 100,
  springDisplacement: 0.5,
  dampingCoeff: 0.1,
  mode: 'newton-incline',
};

const defaultChemistry: ChemistryParams = {
  mode: 'thermo-calorimetry',
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
  redoxPairId: 'zn-cu-daniell',
  anodeConcM: 1.0,
  cathodeConcM: 1.0,
};

const defaultAstronomy: AstronomyParams = {
  mode: 'solar-kepler',
  selectedPlanetId: 'earth',
  customSemiMajorAxisAu: 4.0,
  customEccentricity: 0.2,
  centralStarMassSolar: 1.0,
  showKeplerAreaSweep: true,
  timeScaleSpeed: 1.0,
  galactocentricRadiusKpc: 8.2,
  bulgeDiskMassFactor: 1.0,
  darkMatterHaloFraction: 1.0,
  sgrAStarMassMillionSolar: 4.15,
  starEffectiveTempK: 5778,
  starRadiusSolar: 1.0,
  exoplanetRadiusEarth: 10.91,
  exoplanetOrbitAu: 1.0,
};

test('Hukum I & II Newton: static friction and linear acceleration', () => {
  const mStatic = calculatePhysicsMetrics(defaultPhysics);
  assert.equal(mStatic.isMoving, false);
  assert.equal(mStatic.acceleration, 0);

  const mMoving = calculatePhysicsMetrics({
    ...defaultPhysics,
    mass: 5,
    appliedForce: 50,
    frictionCoeffStatic: 0.2,
    frictionCoeffKinetic: 0.1,
    gravity: 10,
  });
  assert.equal(mMoving.isMoving, true);
  assert.equal(mMoving.netForce, 45);
  assert.equal(mMoving.acceleration, 9);
});

test('Fisika Baru: 1D Collision Momentum & Spring Hooke Oscillation', () => {
  const inelastic = calculatePhysicsMetrics({
    ...defaultPhysics,
    mode: 'collision-momentum',
    mass: 4,
    initialVelocity: 6,
    collisionMass2: 2,
    velocity2Initial: 0,
    restitutionCoeff: 0,
  });
  assert.equal(inelastic.initialTotalMomentum, 24);
  assert.equal(inelastic.finalTotalMomentum, 24);
  assert.equal(inelastic.v1Final, 4);
  assert.equal(inelastic.v2Final, 4);

  const spring = calculatePhysicsMetrics({
    ...defaultPhysics,
    mode: 'spring-hooke',
    mass: 4,
    springConstantK: 100,
    springDisplacement: 0.5,
  });
  assert.equal(spring.springRestoringForce, -50);
  assert.equal(spring.springPotentialEnergy, 12.5);
  assert.equal(spring.angularFrequency, 5);
  const kinSpring = evaluateKinematicsAtTime(
    {
      ...defaultPhysics,
      mode: 'spring-hooke',
      mass: 4,
      springConstantK: 100,
      springDisplacement: 0.5,
      dampingCoeff: 0,
    },
    0
  );
  assert.equal(kinSpring.positionX, 0.5);
});

test('Kimia Baru: Acid-Base Titration Equivalence Point & Electrochemistry Nernst Cell', () => {
  const eqMetrics = calculateChemistryMetrics({
    ...defaultChemistry,
    mode: 'acid-base-titration',
    analyteAcidConc: 0.2,
    analyteVolumeMl: 25,
    titrantBaseConc: 0.25,
    titrantAddedMl: 20,
    acidPka: 1.0,
  });
  assert.equal(eqMetrics.equivalenceVolumeMl, 20);
  assert.equal(eqMetrics.currentPh, 7);
  assert.equal(eqMetrics.titrationRegion, 'Titik Ekuivalen');

  const cellMetrics = calculateChemistryMetrics({
    ...defaultChemistry,
    mode: 'electrochemistry-cell',
    redoxPairId: 'zn-cu-daniell',
    anodeConcM: 1.0,
    cathodeConcM: 1.0,
  });
  assert.equal(cellMetrics.standardCellPotentialE0, 1.1);
  assert.equal(cellMetrics.nernstCellPotentialE, 1.1);
  assert.ok(cellMetrics.electroFreeEnergyDeltaG < -200);
});

test('Astronomi Baru: Hukum III Kepler, Kurva Rotasi Bima Sakti & Transit Eksoplanet', () => {
  const astro = calculateAstronomyMetrics(defaultAstronomy);
  // a = 4.0 AU around 1.0 M_sun -> T = sqrt(64) = 8.0 years
  assert.equal(astro.orbitalPeriodYears, 8);
  assert.equal(astro.perihelionAu, 3.2);
  assert.equal(astro.aphelionAu, 4.8);
  assert.equal(astro.keplerRatioT2OverA3, 1);

  // Milky Way rotation curve with Dark Matter Halo should exceed pure Keplerian velocity
  assert.ok(astro.observedDarkMatterVelocityKms > astro.keplerianVelocityKms);
  assert.ok(astro.galacticOrbitalPeriodMyr > 150 && astro.galacticOrbitalPeriodMyr < 300);

  // Exoplanet with Rp = 10.91 R_earth around R* = 1.0 R_sun (109.1 R_earth) -> Rp/R* = 0.10 -> 1.0% transit depth
  assert.equal(astro.spectralClass, 'G');
  assert.equal(astro.stellarLuminositySolar, 1);
  assert.equal(astro.transitDepthPct, 1);
  assert.equal(astro.isInHabitableZone, true);
});

test('Analitik Regresi Linier OLS, Penilaian LKS Otomatis (6 Soal), dan Rubrik CSV', () => {
  const reg = calculateLinearRegression([
    { x: 1, y: 5 },
    { x: 2, y: 9 },
    { x: 3, y: 13 },
    { x: 4, y: 17 },
  ]);
  assert.equal(reg.slopeM, 4);
  assert.equal(reg.interceptC, 1);
  assert.equal(reg.rSquared, 1);

  const lks = gradeWorksheetAnswers({
    'q-newton-1': 9.0,
    'q-collision-2': 4.0,
    'q-thermo-3': -90.0,
    'q-titration-4': 20.0,
    'q-kepler-5': 8.0,
    'q-exoplanet-6': 1.0,
  });
  assert.equal(lks.totalScore, 100);
  assert.equal(lks.correctCount, 6);

  const rubric = calculateStudentRubric({
    id: 'stu-1',
    name: 'Alya Pratama',
    groupId: 'Kelompok 1',
    trialsRecorded: 4,
    tasksCompleted: 4,
    totalTasks: 4,
    completionPct: 95,
    quizScore: 100,
  });
  assert.equal(rubric.letterGrade, 'A');
  const rubricCsv = exportRubricGradesToCSV([rubric]);
  assert.ok(rubricCsv.includes('Alya Pratama'));

  const sampleRecords: ExperimentRecord[] = [
    {
      id: 'EXP-101',
      timestamp: '10:15:00',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1',
      domain: 'Astronomi',
      experimentTitle: 'Hukum III Kepler, Orbit Jupiter',
      parametersSummary: 'a=5.20 AU, e=0.049',
      keyMetrics: { T: '11.86 tahun', v_orb: '13.06 km/s' },
      notes: 'Data valid',
    },
  ];
  const csv = exportRecordsToCSV(sampleRecords);
  assert.ok(csv.includes('"Hukum III Kepler, Orbit Jupiter"'));
});

test('UI/UX Siswa & Mahasiswa: Skenario Terbimbing, Mode Penjelasan, dan Stepper Parameter', () => {
  assert.ok(GUIDED_LAB_SCENARIOS.length >= 10);
  const smpConcept = getConceptCardContent('Fisika', 'newton-incline', 'smp');
  const smaConcept = getConceptCardContent('Fisika', 'newton-incline', 'sma');
  const uniConcept = getConceptCardContent('Fisika', 'newton-incline', 'mahasiswa');
  assert.ok(smpConcept.levelLabel.includes('SMP'));
  assert.ok(smaConcept.levelLabel.includes('SMA'));
  assert.ok(uniConcept.levelLabel.includes('Mahasiswa'));
  assert.notEqual(smaConcept.summaryText, uniConcept.summaryText);

  assert.equal(stepParameterValue(19.5, 0.5, 0, 50, 1), 20.0);
  assert.equal(stepParameterValue(49.8, 0.5, 0, 50, 1), 50.0);
  assert.equal(stepParameterValue(0.2, -0.5, 0, 50, 1), 0.0);
});

test('Dr. LabMu Socratic Engine: Telemetry JSON, Outlier R² < 0.85, Direct Answer Refusal & Analogi Jenjang', () => {
  assert.equal(mapAcademicLevelToTelemetry('smp'), 'SMP');
  assert.equal(mapAcademicLevelToTelemetry('sma'), 'SMA');
  assert.equal(mapAcademicLevelToTelemetry('mahasiswa'), 'Perguruan Tinggi');

  const recordsWithOutlier: ExperimentRecord[] = [
    {
      id: 'EXP-303',
      timestamp: '09:30:00',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1',
      domain: 'Fisika',
      experimentTitle: 'Projektil Sudut 85°',
      parametersSummary: 'v₀=20 m/s, ∠=85°',
      keyMetrics: { R: '7.05 m' },
      numericX: 85,
      numericY1: 7.05,
      numericY2: 20.2,
      notes: 'Sudut ekstrem 85 derajat',
    },
    {
      id: 'EXP-302',
      timestamp: '09:25:00',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1',
      domain: 'Fisika',
      experimentTitle: 'Projektil Sudut 45°',
      parametersSummary: 'v₀=20 m/s, ∠=45°',
      keyMetrics: { R: '40.77 m' },
      numericX: 45,
      numericY1: 40.77,
      numericY2: 10.19,
      notes: 'Sudut optimal',
    },
    {
      id: 'EXP-301',
      timestamp: '09:20:00',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1',
      domain: 'Fisika',
      experimentTitle: 'Projektil Sudut 15°',
      parametersSummary: 'v₀=20 m/s, ∠=15°',
      keyMetrics: { R: '20.39 m' },
      numericX: 15,
      numericY1: 20.39,
      numericY2: 1.36,
      notes: 'Sudut rendah',
    },
  ];

  // 1. Test Outlier Detection (R^2 < 0.85)
  const outlierTelemetry = buildDrLabMuTelemetry(
    'Fisika',
    'sma',
    { ...defaultPhysics, mode: 'projectile-gravity', launchAngle: 85, initialVelocity: 20 },
    defaultChemistry,
    defaultAstronomy,
    recordsWithOutlier,
    'Kenapa grafik saya tidak lurus?'
  );
  assert.equal(outlierTelemetry.domain, 'Fisika');
  assert.equal(outlierTelemetry.topic, 'projectile-gravity');
  assert.equal(outlierTelemetry.educationLevel, 'SMA');
  assert.ok(outlierTelemetry.analytics.rSquared < 0.85);
  assert.equal(outlierTelemetry.analytics.hasExtremeOutlier, true);
  assert.ok(outlierTelemetry.analytics.outlierTrial);

  const outlierResponse = generateSocraticDrLabMuResponse(outlierTelemetry);
  assert.equal(outlierResponse.detectedTrigger, 'anomaly-outlier');
  assert.ok(outlierResponse.observation.length > 10);
  assert.ok(outlierResponse.dataHighlight.length > 10);
  assert.ok(outlierResponse.socraticQuestion.length > 10);
  assert.ok(outlierResponse.formattedText.length > 20);

  // 2. Test Direct Answer Refusal ("Berapa nilai g-nya bro?")
  const directQueryTelemetry = buildDrLabMuTelemetry(
    'Fisika',
    'sma',
    defaultPhysics,
    defaultChemistry,
    defaultAstronomy,
    recordsWithOutlier,
    'Berapa nilai g-nya bro?'
  );
  const refusalResponse = generateSocraticDrLabMuResponse(directQueryTelemetry);
  assert.equal(refusalResponse.detectedTrigger, 'direct-answer-refusal');
  assert.ok(refusalResponse.dataHighlight.includes('Ilmuwan hebat tidak menyalin jawaban, tapi membaca polanya! Mari kita periksa slope grafik yang baru saja kamu dapatkan'));
  assert.ok(refusalResponse.dataHighlight.includes('ilmuwan sejati menemukan rahasianya dari grafik sendiri'));

  // 2b. Test Off-Topic Refusal
  const offTopicTelemetry = buildDrLabMuTelemetry(
    'Fisika',
    'sma',
    defaultPhysics,
    defaultChemistry,
    defaultAstronomy,
    recordsWithOutlier,
    'Bisa kasih resep masakan nasi goreng enak?'
  );
  const offTopicResponse = generateSocraticDrLabMuResponse(offTopicTelemetry);
  assert.equal(offTopicResponse.detectedTrigger, 'off-topic-refusal');
  assert.ok(offTopicResponse.observation.includes('fokus'));

  // 2c. Test Biologi Outlier (Enzim pada suhu 80°C)
  const bioRecordsWithOutlier: ExperimentRecord[] = [
    { id: 'BIO-1', timestamp: '10:00', studentName: 'Siswa', groupId: 'G1', domain: 'Biologi', experimentTitle: 'Enzim T=20C', parametersSummary: 'T=20°C', keyMetrics: { v: 40 }, numericX: 20, numericY1: 40, notes: '' },
    { id: 'BIO-2', timestamp: '10:02', studentName: 'Siswa', groupId: 'G1', domain: 'Biologi', experimentTitle: 'Enzim T=37C', parametersSummary: 'T=37°C', keyMetrics: { v: 95 }, numericX: 37, numericY1: 95, notes: '' },
    { id: 'BIO-3', timestamp: '10:04', studentName: 'Siswa', groupId: 'G1', domain: 'Biologi', experimentTitle: 'Enzim T=50C', parametersSummary: 'T=50°C', keyMetrics: { v: 70 }, numericX: 50, numericY1: 70, notes: '' },
    { id: 'BIO-4', timestamp: '10:06', studentName: 'Siswa', groupId: 'G1', domain: 'Biologi', experimentTitle: 'Enzim T=80C', parametersSummary: 'T=80°C', keyMetrics: { v: 5 }, numericX: 80, numericY1: 5, notes: '' },
  ];
  const bioTelemetry = buildDrLabMuTelemetry(
    'Biologi',
    'sma',
    defaultPhysics,
    defaultChemistry,
    defaultAstronomy,
    bioRecordsWithOutlier,
    'Kenapa laju reaksi merosot di suhu tinggi?',
    { moduleId: 'enzyme-catalase', params: { temperatureC: 80 } }
  );
  const bioResponse = generateSocraticDrLabMuResponse(bioTelemetry);
  assert.equal(bioResponse.detectedTrigger, 'anomaly-outlier');
  assert.ok(bioResponse.dataHighlight.includes('suhu dinaikkan ke 80°C'));
  assert.ok(bioResponse.dataHighlight.includes('enzim yang kira-kira terpengaruh'));

  // 3. Test Confused Student Analogies across SMP, SMA, and Perguruan Tinggi
  const cleanRecords: ExperimentRecord[] = [
    {
      id: 'EXP-401',
      timestamp: '10:00:00',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1',
      domain: 'Fisika',
      experimentTitle: 'Hukum II Newton 1',
      parametersSummary: 'F=20 N',
      keyMetrics: { a: '2.0 m/s²' },
      numericX: 20,
      numericY1: 2.0,
      notes: '',
    },
    {
      id: 'EXP-402',
      timestamp: '10:02:00',
      studentName: 'Alya Pratama',
      groupId: 'Kelompok 1',
      domain: 'Fisika',
      experimentTitle: 'Hukum II Newton 2',
      parametersSummary: 'F=40 N',
      keyMetrics: { a: '4.0 m/s²' },
      numericX: 40,
      numericY1: 4.0,
      notes: '',
    },
  ];

  const smpResponse = generateSocraticDrLabMuResponse(
    buildDrLabMuTelemetry(
      'Fisika',
      'smp',
      defaultPhysics,
      defaultChemistry,
      defaultAstronomy,
      cleanRecords,
      'Saya bingung konsepnya Dok'
    )
  );
  assert.equal(smpResponse.detectedTrigger, 'concept-analogy');
  assert.ok(smpResponse.dataHighlight.includes('bola basket'));

  const ptResponse = generateSocraticDrLabMuResponse(
    buildDrLabMuTelemetry(
      'Kimia',
      'mahasiswa',
      defaultPhysics,
      { ...defaultChemistry, mode: 'acid-base-titration' },
      defaultAstronomy,
      [],
      'Mohon penjelasan kesetimbangan kurva ini'
    )
  );
  assert.equal(ptResponse.detectedTrigger, 'concept-analogy');
  assert.ok(ptResponse.dataHighlight.includes('Henderson-Hasselbalch'));
});

// ==========================================
// PHASE 2 TESTS: Buffer, Uncertainty, RK4/Verlet
// ==========================================

import {
  SimulationRingBuffer,
  SimulationFrame,
} from './simulationBuffer';
import {
  DEFAULT_INSTRUMENTS,
  applyInstrumentNoise,
  formatMeasurementWithUncertainty,
} from './uncertaintyEngine';
import {
  stepSpringHookeRK4,
  stepOrbitalVerlet,
} from '../workers/simulationWorker';

test('SimulationRingBuffer: circular FIFO buffer, wrap-around, and O(1) frame lookup', () => {
  const capacity = 5;
  const buffer = new SimulationRingBuffer(capacity);
  assert.equal(buffer.getCapacity(), 5);
  assert.equal(buffer.getCount(), 0);

  const makeFrame = (index: number): SimulationFrame => ({
    frameIndex: index,
    timestamp: index * (1 / 60),
    positions: { mass: { x: index, y: 0, z: 0 } },
    velocities: { mass: { x: 1, y: 0, z: 0 } },
    accelerations: { mass: { x: 0, y: 0, z: 0 } },
    energies: { kinetic: 10, potential: 0, thermal: 0, total: 10 },
  });

  // Push 3 frames
  buffer.push(makeFrame(0));
  buffer.push(makeFrame(1));
  buffer.push(makeFrame(2));

  assert.equal(buffer.getCount(), 3);
  let bounds = buffer.getBounds();
  assert.equal(bounds.minFrame, 0);
  assert.equal(bounds.maxFrame, 2);
  assert.equal(buffer.getLatest()?.frameIndex, 2);

  // Push frames 3, 4, 5, 6, 7 (total 8 frames, wraps around capacity of 5)
  buffer.push(makeFrame(3));
  buffer.push(makeFrame(4));
  buffer.push(makeFrame(5));
  buffer.push(makeFrame(6));
  buffer.push(makeFrame(7));

  assert.equal(buffer.getCount(), 5);
  bounds = buffer.getBounds();
  assert.equal(bounds.minFrame, 3);
  assert.equal(bounds.maxFrame, 7);
  assert.equal(buffer.getLatest()?.frameIndex, 7);

  // Frame 0, 1, 2 should be overwritten and return null
  assert.equal(buffer.getByFrameIndex(0), null);
  assert.equal(buffer.getByFrameIndex(1), null);
  assert.equal(buffer.getByFrameIndex(2), null);

  // Frames 3..7 should be valid
  assert.equal(buffer.getByFrameIndex(3)?.positions.mass.x, 3);
  assert.equal(buffer.getByFrameIndex(7)?.positions.mass.x, 7);

  // Ordered array should be strictly chronological
  const ordered = buffer.getAllOrdered();
  assert.equal(ordered.length, 5);
  assert.deepEqual(
    ordered.map((f) => f.frameIndex),
    [3, 4, 5, 6, 7]
  );

  // Clear resets the buffer
  buffer.clear();
  assert.equal(buffer.getCount(), 0);
  assert.equal(buffer.getLatest(), null);
});

test('Instrument Uncertainty Engine: Gaussian noise, NST uncertainty, and formatting', () => {
  const stopwatch = DEFAULT_INSTRUMENTS.stopwatch;
  const trueTime = 5.234;

  // Disabled mode: must return exact true value with zero uncertainty
  const exact = applyInstrumentNoise(trueTime, stopwatch, false);
  assert.equal(exact.measuredValue, trueTime);
  assert.equal(exact.uncertainty, 0);
  assert.equal(exact.relativeErrorPct, 0);
  assert.equal(exact.noiseAdded, 0);

  // Enabled mode: introduces Gaussian jitter scaled by NST/2 + human reaction
  const noisy = applyInstrumentNoise(trueTime, stopwatch, true);
  assert.ok(Number.isFinite(noisy.measuredValue));
  assert.equal(noisy.uncertainty, stopwatch.smallestScaleDivision / 2); // NST / 2 = 0.005 s
  assert.ok(noisy.relativeErrorPct >= 0);
  // Value should stay within plausible physiological bounds (+- 1 second)
  assert.ok(Math.abs(noisy.measuredValue - trueTime) < 1.0);

  // Formatting helper
  const formatted = formatMeasurementWithUncertainty(10.5, 0.05, 's', 0.48);
  assert.ok(formatted.includes('10.5'));
  assert.ok(formatted.includes('± 0.05'));
  assert.ok(formatted.includes('s'));
  assert.ok(formatted.includes('0.48%'));
});

test('Deterministic Physics: RK4 and Velocity Verlet energy conservation', () => {
  const dt = 1.0 / 60.0;

  // 1. Damped/Undamped Spring-Hooke with RK4
  // For c = 0 (undamped), total mechanical energy E = 1/2 m v^2 + 1/2 k x^2 must be strictly conserved
  const m = 2.0;
  const k = 50.0;
  const c = 0.0; // Undamped
  let x = 0.8;
  let v = 0.0;
  const initialEnergy = 0.5 * k * x * x + 0.5 * m * v * v; // 16.0 Joules

  // Simulate 120 steps = 2 seconds (exceeds one full period T = 2*pi*sqrt(2/50) = 1.256 s)
  for (let step = 0; step < 120; step++) {
    const next = stepSpringHookeRK4(x, v, m, k, c, dt);
    x = next.xNext;
    v = next.vNext;
  }
  const finalEnergy = 0.5 * k * x * x + 0.5 * m * v * v;
  const energyDriftPct = (Math.abs(finalEnergy - initialEnergy) / initialEnergy) * 100;
  // RK4 4th order numerical drift should be well under 0.01%
  assert.ok(energyDriftPct < 0.05, `Spring RK4 energy drift was ${energyDriftPct}%`);

  // 2. Symplectic Velocity Verlet for Keplerian Orbital Gravity
  // Circular orbit at r = 1.0 AU, mu = 1.0, v = 1.0
  let rx = 1.0;
  let ry = 0.0;
  let vx = 0.0;
  let vy = 1.0;
  const mu = 1.0;
  const initialOrbitalEnergy = 0.5 * (vx * vx + vy * vy) - mu / Math.hypot(rx, ry); // -0.5

  // Simulate 360 steps = 6.0 seconds (~1 full orbit T = 2*pi = 6.28 s)
  for (let step = 0; step < 360; step++) {
    const next = stepOrbitalVerlet(rx, ry, vx, vy, mu, dt);
    rx = next.rxNext;
    ry = next.ryNext;
    vx = next.vxNext;
    vy = next.vyNext;
  }
  const finalOrbitalEnergy = 0.5 * (vx * vx + vy * vy) - mu / Math.hypot(rx, ry);
  const orbitalDriftPct = (Math.abs(finalOrbitalEnergy - initialOrbitalEnergy) / Math.abs(initialOrbitalEnergy)) * 100;
  // Velocity Verlet is symplectic so orbital energy remains bounded without unphysical decay
  assert.ok(orbitalDriftPct < 0.1, `Orbital Verlet energy drift was ${orbitalDriftPct}%`);
});

test('Universal Experiment Registry: Module Catalog Integrity & Numerical Output Validation', async () => {
  const {
    EXPERIMENT_CATALOG,
    getExperimentsByDomain,
    getExperimentById,
    getAllExperiments,
  } = await import('../registry/experimentRegistry');

  // 1. Total Catalog Count & Domain Coverage
  assert.ok(EXPERIMENT_CATALOG.length >= 15, `Catalog should contain at least 15 practical modules, found ${EXPERIMENT_CATALOG.length}`);

  const physicsMods = getExperimentsByDomain('fisika');
  const chemMods = getExperimentsByDomain('kimia');
  const bioMods = getExperimentsByDomain('biologi');
  const astroMods = getExperimentsByDomain('astronomi');

  assert.ok(physicsMods.length >= 7, `Expected >= 7 Physics modules, found ${physicsMods.length}`);
  assert.ok(chemMods.length >= 5, `Expected >= 5 Chemistry modules, found ${chemMods.length}`);
  assert.ok(bioMods.length >= 3, `Expected >= 3 Biology modules, found ${bioMods.length}`);
  assert.ok(astroMods.length >= 4, `Expected >= 4 Astronomy modules, found ${astroMods.length}`);

  // 2. Structural & Numerical Integrity for Every Registered Module
  for (const mod of EXPERIMENT_CATALOG) {
    assert.ok(mod.id && typeof mod.id === 'string', `Module ${mod.id} missing valid ID`);
    assert.ok(mod.title && typeof mod.title === 'string', `Module ${mod.id} missing valid title`);
    assert.ok(['fisika', 'kimia', 'biologi', 'astronomi'].includes(mod.domain), `Invalid domain in ${mod.id}`);
    assert.ok(mod.supportedTiers.length > 0, `Module ${mod.id} must support at least 1 tier`);
    assert.ok(mod.apparatusList.length > 0, `Module ${mod.id} apparatusList is empty`);
    assert.ok(mod.safetyNotes.length > 0, `Module ${mod.id} safetyNotes is empty`);
    assert.ok(mod.preLabQuiz.length > 0, `Module ${mod.id} preLabQuiz is empty`);

    // Verify Default Parameters
    const defaultParams: Record<string, number> = {};
    for (const p of mod.parameters) {
      assert.ok(p.defaultValue >= p.min && p.defaultValue <= p.max, `Default value out of range in ${mod.id}.${p.key}`);
      defaultParams[p.key] = p.defaultValue;
    }

    // Verify computeStep execution and finite numerical results
    const outputs = mod.computeStep(defaultParams, 1.0);
    assert.ok(outputs && typeof outputs === 'object', `computeStep in ${mod.id} failed to return an object`);

    for (const out of mod.outputs) {
      const val = outputs[out.key];
      assert.ok(val !== undefined, `Missing output key '${out.key}' in computeStep for ${mod.id}`);
      assert.ok(Number.isFinite(val), `Output '${out.key}' in ${mod.id} was not a finite number: ${val}`);
      assert.ok(!Number.isNaN(val), `Output '${out.key}' in ${mod.id} returned NaN`);
    }
  }

  // 3. Selector lookup helpers
  const pend = getExperimentById('pendulum-harmonic');
  assert.ok(pend, 'getExperimentById(pendulum-harmonic) should return module');
  assert.equal(pend.domain, 'fisika');

  const photo = getExperimentById('photosynthesis-ingenhousz');
  assert.ok(photo, 'getExperimentById(photosynthesis-ingenhousz) should return module');
  assert.equal(photo.domain, 'biologi');

  const smpMods = getAllExperiments('SMP');
  assert.ok(smpMods.length > 0, 'SMP modules should exist in catalog');
});



