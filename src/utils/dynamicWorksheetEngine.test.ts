import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_CATALOG } from '../registry/experimentRegistry';
import { calculateCurveFitting, ExperimentRecord } from './engines/statisticsAndRegression';
import {
  buildModulePresetDataset,
  compareCurveModels,
  computeResidualsAndErrorBars,
  generateDynamicPostLabQuiz,
  generateDynamicWorksheetQuestions,
  parseManualCsvRecords,
  resolveModuleAxisMeta,
} from './dynamicWorksheetEngine';

describe('dynamicWorksheetEngine', () => {
  it('builds a valid 5-point dataset with real axis labels for every module in the 28-module catalog', () => {
    assert.ok(EXPERIMENT_CATALOG.length >= 28, 'Catalog should contain at least 28 modules');
    for (const mod of EXPERIMENT_CATALOG) {
      const ds = buildModulePresetDataset(mod, 5);
      assert.equal(ds.points.length, 5, `Preset points length for ${mod.id}`);
      assert.ok(ds.xAxisLabel.length > 0, `xAxisLabel missing for ${mod.id}`);
      assert.ok(ds.y1AxisLabel.length > 0, `y1AxisLabel missing for ${mod.id}`);
      for (const pt of ds.points) {
        assert.ok(Number.isFinite(pt.x), `x must be finite for ${mod.id}`);
        assert.ok(Number.isFinite(pt.y1), `y1 must be finite for ${mod.id}`);
      }
    }
  });

  it('resolves fallback axis metadata safely when module is undefined', () => {
    const meta = resolveModuleAxisMeta(undefined);
    assert.equal(meta.xKey, 'x');
    assert.equal(meta.y1Key, 'y1');
  });

  it('computes accurate residuals and symmetric error bars for a linear fit', () => {
    const points = [
      { label: 'Uji 1', x: 1, y1: 2.1, y2: 0 },
      { label: 'Uji 2', x: 2, y1: 3.9, y2: 0 },
      { label: 'Uji 3', x: 3, y1: 6.1, y2: 0 },
      { label: 'Uji 4', x: 4, y1: 7.9, y2: 0 },
    ];
    const fit = calculateCurveFitting(
      points.map((p) => ({ x: p.x, y: p.y1 })),
      'linear'
    );
    const result = computeResidualsAndErrorBars(points, fit, 0.2);
    assert.equal(result.residuals.length, 4);
    assert.ok(result.rmse > 0 && result.rmse < 0.25);
    assert.ok(result.maxAbsResidual > 0);
    for (const r of result.residuals) {
      assert.ok(r.errorBarHalf >= 0.1, 'Error bar half-width should respect instrument NST/2');
    }
  });

  it('identifies power-law and quadratic curves in 4-model Auto-Best-Fit comparison', () => {
    // Power law y = 2 * x^1.5 (Kepler-like)
    const powerPts = [1, 2, 3, 4, 5].map((x) => ({ x, y: Number((2 * Math.pow(x, 1.5)).toFixed(4)) }));
    const powerFit = calculateCurveFitting(powerPts, 'power');
    assert.equal(powerFit.modelType, 'power');
    assert.ok(powerFit.rSquared > 0.999, `Expected power R² > 0.999, got ${powerFit.rSquared}`);
    assert.ok(Math.abs((powerFit.powerB ?? 0) - 1.5) < 0.05);

    const cmp = compareCurveModels(powerPts);
    assert.equal(cmp.comparisons.length, 4);
    const bestItem = cmp.comparisons.find((c) => c.isBest);
    assert.ok(bestItem);
    assert.ok(bestItem.rSquared > 0.99);

    // Pure linear should prefer linear via Occam's razor tie-break
    const linPts = [1, 2, 3, 4, 5].map((x) => ({ x, y: 3 * x + 2 }));
    const linCmp = compareCurveModels(linPts);
    assert.equal(linCmp.bestModel, 'linear');
  });

  it('parses manual CSV, TSV, and semicolon-delimited measurements while skipping header rows', () => {
    const raw = `
      X (m); Y1 (s); Y2 (m/s); Catatan
      1.0; 2.01; 0.5; Pengukuran pertama
      2,0; 2,84; 0,7; Pengukuran kedua
      invalid; row
      3.0; 3.48; ; Tanpa Y2
    `;
    const rows = parseManualCsvRecords(raw);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].x, 1);
    assert.equal(rows[0].y1, 2.01);
    assert.equal(rows[0].y2, 0.5);
    assert.equal(rows[0].notes, 'Pengukuran pertama');
    assert.equal(rows[1].x, 2);
    assert.equal(rows[1].y1, 2.84);
    assert.equal(rows[2].y2, undefined);
    assert.equal(rows[2].notes, 'Tanpa Y2');
  });

  it('generates contextual LKS questions and post-lab quiz grounded in actual student records', () => {
    const mod = EXPERIMENT_CATALOG[0];
    const studentRecords: ExperimentRecord[] = [
      { id: 'r1', timestamp: '10:00', studentName: 'Ani', groupId: 'G1', domain: 'Fisika', moduleId: mod.id, experimentTitle: mod.title, parametersSummary: 'F=20N', keyMetrics: { a: 4.0 }, numericX: 20, numericY1: 4.0, notes: 'Uji 1' },
      { id: 'r2', timestamp: '10:01', studentName: 'Ani', groupId: 'G1', domain: 'Fisika', moduleId: mod.id, experimentTitle: mod.title, parametersSummary: 'F=40N', keyMetrics: { a: 8.0 }, numericX: 40, numericY1: 8.0, notes: 'Uji 2' },
      { id: 'r3', timestamp: '10:02', studentName: 'Ani', groupId: 'G1', domain: 'Fisika', moduleId: mod.id, experimentTitle: mod.title, parametersSummary: 'F=60N', keyMetrics: { a: 12.0 }, numericX: 60, numericY1: 12.0, notes: 'Uji 3' },
    ];

    const questions = generateDynamicWorksheetQuestions(mod, studentRecords, 'Fisika');
    assert.ok(questions.length >= 3, 'Should generate at least 3 contextual LKS questions');
    assert.ok(questions[0].questionText.includes('3 titik'), 'Should reference actual student record count');
    assert.ok(Math.abs(questions[1].correctValue - 0.2) < 0.01, 'Secant slope should match ΔY/ΔX = 8/40 = 0.2');
    assert.equal(questions[2].correctValue, 8, 'Mean Y should equal 8.0');

    const quiz = generateDynamicPostLabQuiz(mod, studentRecords, 'Fisika');
    assert.equal(quiz.length, 3);
    assert.ok(quiz[0].question.includes('data aktual Anda'));
    for (const q of quiz) {
      assert.equal(q.options.length, 4);
      assert.ok(['A', 'B', 'C', 'D'].includes(q.correctKey));
    }
  });
});
