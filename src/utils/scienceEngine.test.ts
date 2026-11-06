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
  const smaConcept = getConceptCardContent('Fisika', 'newton-incline', 'sma');
  const uniConcept = getConceptCardContent('Fisika', 'newton-incline', 'mahasiswa');
  assert.ok(smaConcept.levelLabel.includes('SMA'));
  assert.ok(uniConcept.levelLabel.includes('Mahasiswa'));
  assert.notEqual(smaConcept.summaryText, uniConcept.summaryText);

  assert.equal(stepParameterValue(19.5, 0.5, 0, 50, 1), 20.0);
  assert.equal(stepParameterValue(49.8, 0.5, 0, 50, 1), 50.0);
  assert.equal(stepParameterValue(0.2, -0.5, 0, 50, 1), 0.0);
});

