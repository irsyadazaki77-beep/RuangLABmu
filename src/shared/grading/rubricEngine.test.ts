import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSubmissionRubric,
  parseRubricJson,
  serializeRubricJson,
} from './rubricEngine';

describe('Auto-Grading Rubric Engine (src/shared/grading/rubricEngine.ts)', () => {
  it('evaluates Physics Newton incline submission within physical RK4 tolerance', () => {
    const report = evaluateSubmissionRubric({
      domain: 'physics',
      moduleId: 'newton-incline',
      hypothesisText: 'Semakin besar sudut kemiringan bidang miring, maka percepatan benda semakin meningkat sesuai persamaan g sin theta.',
      observationData: [
        { angle: 15, mass: 2, friction: 0.1, acceleration: 1.59 },
        { angle: 30, mass: 2, friction: 0.1, acceleration: 4.05 },
        { angle: 45, mass: 2, friction: 0.1, acceleration: 6.24 },
      ],
      regressionMetrics: {
        rSquared: 0.994,
        slope: 0.13,
        equation: 'y = 0.13x - 0.25',
      },
      quizScore: 100,
      conclusionText: 'Berdasarkan regresi linear dengan R² = 0.994, hipotesis terbukti bahwa percepatan berbanding lurus dengan komponen gaya gravitasi.',
    });

    assert.ok(report.score >= 90, `Expected high score >= 90, got ${report.score}`);
    assert.strictEqual(report.criteria.length, 5);
    assert.strictEqual(report.criteria[2].id, 'rk4_numerical_accuracy');
    assert.strictEqual(report.criteria[2].passed, true);

    const serialized = serializeRubricJson(report);
    const parsed = parseRubricJson(serialized);
    assert.ok(parsed);
    assert.strictEqual(parsed.score, report.score);
    assert.strictEqual(parsed.moduleId, 'newton-incline');
  });

  it('evaluates Chemistry acid-base titration equivalence pH and flags out-of-range measurements', () => {
    const accurateTitration = evaluateSubmissionRubric({
      domain: 'chemistry',
      moduleId: 'acid-base-titration',
      hypothesisText: 'Penambahan NaOH pada HCl mencapai titik ekuivalen pada pH netral 7.00 ketika mol asam sama dengan mol basa.',
      observationData: [
        { volumeAdded: 20.0, ph: 2.85, molarity: 0.1 },
        { volumeAdded: 24.9, ph: 6.98, molarity: 0.1 },
        { volumeAdded: 25.0, ph: 7.02, molarity: 0.1 },
      ],
      regressionMetrics: {
        rSquared: 0.96,
        slope: 0.42,
        equation: 'pH curve fit',
      },
      quizScore: 90,
      conclusionText: 'Titik ekuivalen tercapai pada volume 25 mL NaOH dengan nilai pH 7.00 sesuai stoikiometri.',
    });

    const inaccurateTitration = evaluateSubmissionRubric({
      domain: 'chemistry',
      moduleId: 'acid-base-titration',
      hypothesisText: 'pH berubah.',
      observationData: [
        { volumeAdded: 5.0, ph: 1.2 },
      ],
      regressionMetrics: null,
      quizScore: 40,
      conclusionText: 'Selesai.',
    });

    assert.ok(accurateTitration.score > inaccurateTitration.score + 30);
    assert.strictEqual(accurateTitration.criteria[2].passed, true);
    assert.strictEqual(inaccurateTitration.criteria[0].passed, false);
  });

  it('evaluates Biology Ingenhousz photosynthesis and Astronomy Kepler 3rd Law submissions', () => {
    const bioReport = evaluateSubmissionRubric({
      domain: 'biology',
      moduleId: 'photosynthesis-ingenhousz',
      hypothesisText: 'Intensitas cahaya meningkatkan laju produksi gelembung O2 pada Hydrilla hingga titik saturasi enzim.',
      observationData: [
        { lightIntensity: 25, bubbles: 14, temperature: 28 },
        { lightIntensity: 50, bubbles: 28, temperature: 28 },
        { lightIntensity: 75, bubbles: 39, temperature: 28 },
      ],
      regressionMetrics: {
        rSquared: 0.985,
        slope: 0.5,
        equation: 'y = 0.5x + 2',
      },
      quizScore: 85,
      conclusionText: 'Laju fotosintesis meningkat secara proporsional terhadap intensitas cahaya pada suhu optimum 28°C.',
    });

    const astroReport = evaluateSubmissionRubric({
      domain: 'astronomy',
      moduleId: 'solar-kepler',
      hypothesisText: 'Kuadrat periode orbit planet berbanding lurus dengan pangkat tiga sumbu semi-mayor sesuai Hukum III Kepler.',
      observationData: [
        { semiMajorAxis: 1.0, periodYears: 1.0 },
        { semiMajorAxis: 1.524, periodYears: 1.881 },
        { semiMajorAxis: 5.203, periodYears: 11.862 },
      ],
      regressionMetrics: {
        rSquared: 0.999,
        slope: 1.0,
        equation: 'T² = 1.00 a³',
      },
      quizScore: 100,
      conclusionText: 'Rasio T²/a³ konstan bernilai 1.00 untuk seluruh sampel orbit planet tata surya.',
    });

    assert.ok(bioReport.score >= 85);
    assert.ok(astroReport.score >= 92);
    assert.strictEqual(astroReport.criteria[2].passed, true);
  });
});
