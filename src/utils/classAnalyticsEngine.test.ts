import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_CATALOG } from '../registry/experimentRegistry';
import type { LabSubmission } from '../types/submissionTypes';
import {
  computeClassGradebookAnalytics,
  computeDomainCurriculumProgress,
  toggleModuleBookmarkList,
} from './classAnalyticsEngine';

function makeSubmission(id: string, score: number, graded: boolean): LabSubmission {
  return {
    id,
    studentName: `Siswa ${id}`,
    moduleId: 'phys-newton',
    domain: 'Fisika',
    submittedAt: new Date().toISOString(),
    hypothesisText: 'Gaya berbanding lurus dengan percepatan',
    observationData: [
      { label: 'Uji 1', x: 10, y1: 2 },
      { label: 'Uji 2', x: 20, y1: 4 },
      { label: 'Uji 3', x: 30, y1: 6 },
    ],
    regressionMetrics: { rSquared: 0.998, equation: 'y = 0.2x', slope: 0.2 },
    quizAnswers: [],
    quizScore: score,
    conclusionText: 'Percepatan sebanding dengan gaya dorong pada massa tetap.',
    teacherGrade: graded
      ? { score, feedback: 'Baik', gradedAt: new Date().toISOString() }
      : undefined,
  };
}

describe('classAnalyticsEngine', () => {
  it('computes empty gradebook analytics safely', () => {
    const empty = computeClassGradebookAnalytics([], 75);
    assert.equal(empty.totalSubmissions, 0);
    assert.equal(empty.averageScore, 0);
    assert.equal(empty.passRatePct, 0);
    assert.equal(empty.histogram.length, 5);
    assert.equal(empty.weakestCriterion, null);
  });

  it('computes score histogram, KKM pass/remedial counts, and rubric averages', () => {
    const subs = [
      makeSubmission('1', 55, true),
      makeSubmission('2', 74, true),
      makeSubmission('3', 82, true),
      makeSubmission('4', 94, false),
    ];

    // With KKM 75: 55 (fail), 74 (fail), 82 (pass), 94 (ungraded -> uses rubric score)
    const analytics = computeClassGradebookAnalytics(subs, 75);
    assert.equal(analytics.totalSubmissions, 4);
    assert.equal(analytics.gradedCount, 3);
    assert.equal(analytics.pendingCount, 1);
    assert.ok(analytics.averageScore > 50);
    assert.equal(
      analytics.histogram.reduce((sum, bin) => sum + bin.count, 0),
      4
    );
    assert.ok(analytics.rubricAverages.length >= 4);
    for (const crit of analytics.rubricAverages) {
      assert.ok(Number.isFinite(crit.averagePoints), `averagePoints should be finite for ${crit.id}`);
      assert.ok(
        Number.isFinite(crit.averagePct) && crit.averagePct >= 0 && crit.averagePct <= 100,
        `averagePct should be 0..100 for ${crit.id}, got ${crit.averagePct}`
      );
    }
    assert.ok(analytics.weakestCriterion !== null);

    // Adjusting KKM higher reduces or maintains pass rate
    const strict = computeClassGradebookAnalytics(subs, 90);
    assert.ok(strict.passedCount <= analytics.passedCount);
  });

  it('computes per-domain curriculum progress across the full 28-module catalog', () => {
    const physMod = EXPERIMENT_CATALOG.find((m) => m.domain === 'fisika')!;
    const chemMod = EXPERIMENT_CATALOG.find((m) => m.domain === 'kimia')!;
    const progress = computeDomainCurriculumProgress(EXPERIMENT_CATALOG, [physMod.id, chemMod.id]);

    assert.equal(progress.totalModules, EXPERIMENT_CATALOG.length);
    assert.equal(progress.totalCompleted, 2);
    assert.equal(progress.domains.length, 4);

    const fisika = progress.domains.find((d) => d.domain === 'fisika')!;
    const biologi = progress.domains.find((d) => d.domain === 'biologi')!;
    assert.equal(fisika.completedCount, 1);
    assert.equal(biologi.completedCount, 0);
  });

  it('toggles module bookmark IDs immutably', () => {
    const added = toggleModuleBookmarkList([], 'phys-newton');
    assert.deepEqual(added, ['phys-newton']);
    const addedTwo = toggleModuleBookmarkList(added, 'chem-titration');
    assert.deepEqual(addedTwo, ['phys-newton', 'chem-titration']);
    const removed = toggleModuleBookmarkList(addedTwo, 'phys-newton');
    assert.deepEqual(removed, ['chem-titration']);
  });
});
