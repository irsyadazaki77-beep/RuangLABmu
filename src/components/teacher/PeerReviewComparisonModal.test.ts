import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePeerComparisonSummary } from './PeerReviewComparisonModal';

describe('PeerReviewComparisonModal helpers', () => {
  it('flags significant R-squared gap and identifies higher-precision group', () => {
    const res = computePeerComparisonSummary(
      {
        studentName: 'Kelompok A',
        domain: 'Fisika',
        moduleId: 'newton-incline',
        recordsCount: 6,
        rSquared: 0.992,
        lastUpdated: '2026-11-28T00:00:00Z',
      },
      {
        studentName: 'Kelompok B',
        domain: 'Fisika',
        moduleId: 'newton-incline',
        recordsCount: 5,
        rSquared: 0.875,
        lastUpdated: '2026-11-28T00:00:00Z',
      }
    );

    assert.equal(res.higherPrecisionStudent, 'Kelompok A');
    assert.ok(res.rSquaredDiff >= 0.08);
    assert.match(res.diagnosticNote, /linieritas/i);
  });
});
