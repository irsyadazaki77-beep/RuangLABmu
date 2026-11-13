import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMeasurementErrorSummary } from './uncertaintyEngine';
import {
  MIN_PASSING_PRELAB_SCORE,
  issueOrUpdateLabSafetyLicense,
  getLabSafetyLicenseForModule,
  generateDeterministicLicenseCode,
  buildLicenseVerificationText,
} from '../services/labLicenseEngine';
import {
  PRESET_MYSTERY_CHALLENGES,
  evaluateMysterySubmission,
} from './mysteryChallengeEngine';
import { getExperimentById } from '../registry/experimentRegistry';
import {
  calculateEnzymeKinetics,
  calculateCardiovascularHeart,
} from './engines/biologyEngine';
import { generateAcademicReportHTML } from './academicReportExporter';

test('computeMeasurementErrorSummary calculates Type A, Type B, relative error, and theory error accurately', () => {
  // Sample measurements of g around 9.81 m/s^2
  const samples = [9.78, 9.81, 9.83, 9.80, 9.83];
  const summary = computeMeasurementErrorSummary(samples, 9.81, 0.02);

  assert.equal(summary.n, 5);
  assert.equal(summary.mean, 9.81);
  assert.equal(summary.min, 9.78);
  assert.equal(summary.max, 9.83);
  assert.equal(summary.instrumentUncertainty, 0.01); // 0.02 / 2
  assert.ok(summary.sampleStdDev > 0.019 && summary.sampleStdDev < 0.023);
  assert.ok(summary.standardErrorMean > 0.008 && summary.standardErrorMean < 0.011);
  assert.ok(summary.combinedUncertainty > 0.012 && summary.combinedUncertainty < 0.016);
  assert.equal(summary.percentErrorVsTheory, 0);
  assert.equal(summary.precisionGrade, 'Sangat Presisi');
  assert.equal(summary.recommendedSignificantFigures, 4);

  // Empty array edge case
  const emptySummary = computeMeasurementErrorSummary([]);
  assert.equal(emptySummary.n, 0);
  assert.equal(emptySummary.precisionGrade, 'Data Belum Mencukupi');

  // Single reading cannot compute Type A std dev
  const singleSummary = computeMeasurementErrorSummary([5.0], 4.0, 0.1);
  assert.equal(singleSummary.n, 1);
  assert.equal(singleSummary.sampleStdDev, 0);
  assert.equal(singleSummary.instrumentUncertainty, 0.05);
  assert.equal(singleSummary.percentErrorVsTheory, 25);
  assert.equal(singleSummary.precisionGrade, 'Data Belum Mencukupi');
});

test('labLicenseEngine enforces K3 & MIN_PASSING_PRELAB_SCORE threshold and builds QR payload', () => {
  assert.equal(MIN_PASSING_PRELAB_SCORE, 75);

  const codeA = generateDeterministicLicenseCode('pendulum-harmonic', 'Budi Santoso');
  const codeB = generateDeterministicLicenseCode('pendulum-harmonic', 'Budi Santoso');
  assert.equal(codeA, codeB);
  assert.ok(codeA.startsWith('RLM-SIM-'));

  // Fails if quiz score < 75
  const pendingLicense = issueOrUpdateLabSafetyLicense({
    moduleId: 'pendulum-harmonic',
    moduleTitle: 'Bandul Matematis',
    domain: 'fisika',
    studentName: 'Budi Santoso',
    studentGroup: 'Kelompok A',
    tier: 'SMA',
    k3Complied: true,
    preLabQuizScorePct: 50,
  });
  assert.equal(pendingLicense.status, 'BELUM_MEMENUHI_SYARAT');

  // Passes when K3 complied AND quiz >= 75
  const verifiedLicense = issueOrUpdateLabSafetyLicense({
    moduleId: 'pendulum-harmonic',
    moduleTitle: 'Bandul Matematis',
    domain: 'fisika',
    studentName: 'Budi Santoso',
    studentGroup: 'Kelompok A',
    tier: 'SMA',
    k3Complied: true,
    preLabQuizScorePct: 100,
  });
  assert.equal(verifiedLicense.status, 'TERVERIFIKASI');
  assert.equal(verifiedLicense.licenseId, codeA);

  const stored = getLabSafetyLicenseForModule('pendulum-harmonic');
  assert.ok(stored);
  assert.equal(stored.status, 'TERVERIFIKASI');

  const qrPayload = JSON.parse(buildLicenseVerificationText(stored));
  assert.equal(qrPayload.app, 'RuangLABmu SIM-Lab Verifier');
  assert.equal(qrPayload.id, codeA);
  assert.equal(qrPayload.modul, 'pendulum-harmonic');
  assert.equal(qrPayload.skorKuis, '100%');
});

test('PRESET_MYSTERY_CHALLENGES covers all 4 domains including scientifically verified Biology cases', () => {
  const domains = new Set(PRESET_MYSTERY_CHALLENGES.map((c) => c.domain));
  assert.ok(domains.has('Fisika'));
  assert.ok(domains.has('Kimia'));
  assert.ok(domains.has('Biologi'));
  assert.ok(domains.has('Astronomi'));

  // All mystery preset moduleIds must resolve to existing catalog modules
  for (const challenge of PRESET_MYSTERY_CHALLENGES) {
    const mod = getExperimentById(challenge.moduleId);
    assert.ok(mod, `Module ${challenge.moduleId} must exist in catalog`);
  }

  // Verify Biology enzyme challenge consistency with biologyEngine
  const enzymeChallenge = PRESET_MYSTERY_CHALLENGES.find(
    (c) => c.id === 'bio-mystery-enzyme'
  );
  assert.ok(enzymeChallenge);
  const kin = calculateEnzymeKinetics({
    substrateConcMm: 9,
    vMaxBase: 120,
    kmConstantMm: enzymeChallenge.actualHiddenValue,
    temperatureC: 37,
    solutionPh: 7.0,
  });
  assert.equal(Number(kin.reactionVelocityV.toFixed(1)), 80.0);
  const evalEnzyme = evaluateMysterySubmission(enzymeChallenge, 4.5);
  assert.equal(evalEnzyme.passed, true);
  assert.equal(evalEnzyme.score, 100);

  // Verify Biology cardiovascular stenosis consistency with Poiseuille model
  const cardioChallenge = PRESET_MYSTERY_CHALLENGES.find(
    (c) => c.id === 'bio-mystery-cardio'
  );
  assert.ok(cardioChallenge);
  const heart = calculateCardiovascularHeart({
    heartRateBpm: 72,
    vesselRadiusRatio: cardioChallenge.actualHiddenValue,
    bloodViscosity: 3.5,
    exerciseIntensity: 20,
  });
  assert.ok(Math.abs(heart.vascularResistance - 5.602) < 0.01);
  const evalCardio = evaluateMysterySubmission(cardioChallenge, 0.65);
  assert.equal(evalCardio.passed, true);
  assert.equal(evalCardio.score, 100);
});

test('generateAcademicReportHTML embeds SIM Lab license, POE prediction, uncertainty analysis, and misconception clinic', () => {
  const pendulumMod = getExperimentById('pendulum-harmonic');
  assert.ok(pendulumMod);

  const html = generateAcademicReportHTML({
    experimentTitle: pendulumMod.title,
    studentName: 'Siti Aminah',
    groupId: 'Kelompok 2',
    tier: 'SMA',
    dateStr: '14 November 2026',
    timeStr: '08:30',
    domain: 'Fisika',
    module: pendulumMod,
    records: [
      {
        id: 'R1',
        timestamp: '08:20',
        studentName: 'Siti Aminah',
        groupId: 'Kelompok 2',
        domain: 'Fisika',
        experimentTitle: pendulumMod.title,
        parametersSummary: 'L = 1.0 m',
        keyMetrics: { T: '2.01 s' },
        notes: 'Valid',
        numericX: 1.0,
        numericY1: 2.01,
      },
      {
        id: 'R2',
        timestamp: '08:25',
        studentName: 'Siti Aminah',
        groupId: 'Kelompok 2',
        domain: 'Fisika',
        experimentTitle: pendulumMod.title,
        parametersSummary: 'L = 1.5 m',
        keyMetrics: { T: '2.46 s' },
        notes: 'Valid',
        numericX: 1.5,
        numericY1: 2.46,
      },
    ],
    simLabLicense: {
      licenseCode: 'RLM-SIM-2026-12345',
      status: 'TERVERIFIKASI',
      quizScore: 100,
      issuedDateStr: '14 Nov 2026',
    },
    poeEvaluationSummary: {
      predictedTrend: 'Naik Sublinier',
      predictedX: 2.0,
      predictedY: 2.84,
      actualYAtPredictedX: 2.838,
      deviationPct: 0.07,
    },
    uncertaintySummary: {
      metricLabel: 'Periode (s)',
      n: 5,
      mean: 2.01,
      sampleStdDev: 0.015,
      standardErrorMean: 0.0067,
      instrumentUncertainty: 0.005,
      combinedUncertainty: 0.0084,
      relativeUncertaintyPct: 0.42,
      percentErrorVsTheory: 0.2,
      precisionGrade: 'Sangat Presisi',
      recommendedSignificantFigures: 4,
    },
  });

  assert.ok(html.includes('RLM-SIM-2026-12345'));
  assert.ok(html.includes('TERVERIFIKASI'));
  assert.ok(html.includes('Predict–Observe–Explain'));
  assert.ok(html.includes('IV-C. Analisis Ketidakpastian'));
  assert.ok(html.includes('Sangat Presisi'));
  assert.ok(html.includes('V-D. Refleksi Klinik Miskonsepsi'));
});
