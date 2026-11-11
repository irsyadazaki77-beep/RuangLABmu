import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRecordsRegressionSummary,
  formatDrLabMuAskPayload,
  normalizeDrLabMuRequest,
  parseReplayParameters,
} from './labTelemetryHelpers';
import type { ExperimentRecord } from './scienceEngine';

function makeRecord(overrides: Partial<ExperimentRecord>): ExperimentRecord {
  return {
    id: 'REC-001',
    timestamp: '10:00:00',
    studentName: 'Budi Santoso',
    groupId: 'Kelompok A',
    domain: 'Fisika',
    experimentTitle: 'Hukum II Newton & Bidang Miring',
    parametersSummary: 'F=40 N, m=5 kg, θ=30°',
    keyMetrics: { a: '2.5 m/s²' },
    numericX: 40,
    numericY1: 8,
    notes: '',
    ...overrides,
  };
}

describe('Lab Telemetry & Contract Helpers', () => {
  it('computes accurate OLS regression and triggers low-R² alert only for noisy 3+ points', () => {
    const cleanRecords = [
      makeRecord({ id: 'R1', numericX: 10, numericY1: 2 }),
      makeRecord({ id: 'R2', numericX: 20, numericY1: 4 }),
      makeRecord({ id: 'R3', numericX: 30, numericY1: 6 }),
      makeRecord({ id: 'R4', numericX: 40, numericY1: 8 }),
    ];

    const cleanSummary = computeRecordsRegressionSummary(cleanRecords);
    assert.strictEqual(cleanSummary.hasRegression, true);
    assert.strictEqual(cleanSummary.pointsCount, 4);
    assert.ok(cleanSummary.rSquared > 0.999);
    assert.ok(Math.abs(cleanSummary.slope - 0.2) < 1e-4);
    assert.strictEqual(cleanSummary.isLowR2Alert, false);

    const noisyRecords = [
      makeRecord({ id: 'N1', numericX: 1, numericY1: 10 }),
      makeRecord({ id: 'N2', numericX: 2, numericY1: 2 }),
      makeRecord({ id: 'N3', numericX: 3, numericY1: 15 }),
      makeRecord({ id: 'N4', numericX: 4, numericY1: 1 }),
    ];

    const noisySummary = computeRecordsRegressionSummary(noisyRecords);
    assert.strictEqual(noisySummary.hasRegression, true);
    assert.ok(noisySummary.rSquared < 0.85);
    assert.strictEqual(noisySummary.isLowR2Alert, true);
  });

  it('handles fewer than 2 numeric points safely without regression alert', () => {
    const single = computeRecordsRegressionSummary([
      makeRecord({ id: 'S1', numericX: 5, numericY1: 12 }),
    ]);
    assert.strictEqual(single.hasRegression, false);
    assert.strictEqual(single.pointsCount, 1);
    assert.strictEqual(single.isLowR2Alert, false);
  });

  it('parses replay parameters for Physics, Chemistry, Biology, and Astronomy records', () => {
    const phy = parseReplayParameters(
      makeRecord({
        domain: 'Fisika',
        experimentTitle: 'Kinematika Gerak Parabola',
        parametersSummary: 'v0=28 m/s, ∠=45°',
      })
    );
    assert.strictEqual(phy.domain, 'Fisika');
    assert.strictEqual(phy.physicsPatch?.mode, 'projectile-gravity');
    assert.strictEqual(phy.physicsPatch?.initialVelocity, 28);
    assert.strictEqual(phy.physicsPatch?.launchAngle, 45);

    const chem = parseReplayParameters(
      makeRecord({
        domain: 'Kimia',
        experimentTitle: 'Titrasi Asam-Basa Kuat',
        parametersSummary: 'Ma=0.1 M, Va=25 mL, Mb=0.1 M, Vb=24.5 mL',
      })
    );
    assert.strictEqual(chem.domain, 'Kimia');
    assert.strictEqual(chem.chemistryPatch?.mode, 'acid-base-titration');
    assert.strictEqual(chem.chemistryPatch?.analyteAcidConc, 0.1);
    assert.strictEqual(chem.chemistryPatch?.analyteVolumeMl, 25);
    assert.strictEqual(chem.chemistryPatch?.titrantBaseConc, 0.1);
    assert.strictEqual(chem.chemistryPatch?.titrantAddedMl, 24.5);

    const bio = parseReplayParameters(
      makeRecord({
        domain: 'Biologi',
        experimentTitle: 'Kinetika Enzim Katalase',
        parametersSummary: '[S]=15 mM, T=37°C, pH=7.2',
      })
    );
    assert.strictEqual(bio.domain, 'Biologi');
    assert.strictEqual(bio.biologyPatch?.substrateConcMm, 15);
    assert.strictEqual(bio.biologyPatch?.temperatureC, 37);
    assert.strictEqual(bio.biologyPatch?.solutionPh, 7.2);

    const astro = parseReplayParameters(
      makeRecord({
        domain: 'Astronomi',
        experimentTitle: 'Ekspansi Kosmik & Hukum Hubble',
        parametersSummary: 'd=180 Mpc, H₀=70 km/s/Mpc',
      })
    );
    assert.strictEqual(astro.domain, 'Astronomi');
    assert.strictEqual(astro.astronomyPatch?.mode, 'hubble-expansion');
    assert.strictEqual(astro.astronomyPatch?.galaxyDistanceMpc, 180);
    assert.strictEqual(astro.astronomyPatch?.hubbleConstantH0, 70);
  });

  it('normalizes both nested and flat Dr. LabMu /ask payloads and formats responses uniformly', () => {
    const nested = normalizeDrLabMuRequest({
      telemetry: {
        domain: 'Fisika',
        topic: 'newton-incline',
        educationLevel: 'SMA',
        studentQuery: 'Mengapa R2 turun?',
        analytics: { rSquared: 0.72, hasExtremeOutlier: true },
      },
    });
    assert.ok(nested);
    assert.strictEqual(nested.domain, 'Fisika');
    assert.strictEqual(nested.topic, 'newton-incline');
    assert.strictEqual(nested.analytics.rSquared, 0.72);
    assert.strictEqual(nested.analytics.hasExtremeOutlier, true);

    const flat = normalizeDrLabMuRequest({
      domain: 'Kimia',
      moduleId: 'acid-base-titration',
      educationTier: 'mahasiswa',
    });
    assert.ok(flat);
    assert.strictEqual(flat.domain, 'Kimia');
    assert.strictEqual(flat.topic, 'acid-base-titration');
    assert.strictEqual(flat.educationLevel, 'Perguruan Tinggi');

    assert.strictEqual(normalizeDrLabMuRequest({}), null);

    const geminiOut = formatDrLabMuAskPayload(
      {
        observasiSingkat: 'Data pH melonjak pada Vb = 25 mL.',
        insightKonseptual: 'Pada titik ekuivalen, mol H+ dan OH- tepat habis bereaksi.',
        pertanyaanPemantik: 'Berapakah perkiraan pH pada titik ekuivalen asam kuat-basa kuat?',
        hasAnomaly: false,
      },
      'gemini-api'
    );
    assert.strictEqual(geminiOut.source, 'gemini-api');
    assert.strictEqual(geminiOut.response.observation, 'Data pH melonjak pada Vb = 25 mL.');
    assert.strictEqual(geminiOut.response.detectedTrigger, 'concept-analogy');
    assert.ok(geminiOut.response.formattedText.includes('Observasi Singkat'));
  });
});
