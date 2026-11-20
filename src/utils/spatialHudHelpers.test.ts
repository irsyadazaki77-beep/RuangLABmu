import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCursorChartPosition,
  computeExpDampingAlpha,
  decimateTelemetryFrames,
  extractNumericPair,
  filterCurriculumChapters,
  filterExperimentModules,
  formatCleanEquation,
  shouldConfirmLabExit,
} from './spatialHudHelpers';
import { EXPERIMENT_CATALOG } from '../registry/experimentRegistry';
import { CURRICULUM_CHAPTERS } from '../registry/curriculumChapters';

describe('spatialHudHelpers', () => {
  it('filters curriculum chapters by domain and formula/title search query', () => {
    const physicsChapters = filterCurriculumChapters(CURRICULUM_CHAPTERS, {
      domain: 'fisika',
      searchQuery: '',
      modules: EXPERIMENT_CATALOG,
    });
    assert.ok(physicsChapters.length > 0);
    assert.ok(physicsChapters.every((ch) => ch.domain === 'fisika'));

    const titrasiMatches = filterCurriculumChapters(CURRICULUM_CHAPTERS, {
      domain: 'all',
      searchQuery: 'Titrasi',
      modules: EXPERIMENT_CATALOG,
    });
    assert.ok(titrasiMatches.length >= 1);
  });

  it('filters experiment modules by domain, tier, and equation/title search', () => {
    const smaPhysics = filterExperimentModules(EXPERIMENT_CATALOG, {
      domain: 'fisika',
      activeTier: 'SMA',
      searchQuery: 'Newton',
    });
    assert.ok(smaPhysics.some((m) => m.id === 'newton-incline'));

    const allInChapter = filterExperimentModules(EXPERIMENT_CATALOG, {
      domain: 'all',
      activeTier: 'SMP',
      searchQuery: '',
      chapterNumber: 1,
      respectTierFilter: true,
    });
    assert.ok(allInChapter.length >= 1);
    assert.ok(allInChapter.every((m) => m.chapterNumber === 1));
  });

  it('guards exit confirmation only when session has observations or timeline progress', () => {
    assert.equal(shouldConfirmLabExit({ recordsCount: 0, timelineCount: 0 }), false);
    assert.equal(shouldConfirmLabExit({ recordsCount: 0, timelineCount: 4 }), false);
    assert.equal(shouldConfirmLabExit({ recordsCount: 1, timelineCount: 0 }), true);
    assert.equal(shouldConfirmLabExit({ recordsCount: 0, timelineCount: 12 }), true);
  });

  it('extracts numeric telemetry pairs and decimates ring-buffer frames safely', () => {
    assert.deepEqual(extractNumericPair({ speed: 4.5, acceleration: 2.1, label: 'ok' }), {
      primary: 4.5,
      secondary: 2.1,
    });
    assert.equal(extractNumericPair({ label: 'only-string' }), null);

    const frames = Array.from({ length: 240 }, (_, i) => ({
      simTime: i * 0.05,
      stateSnapshot: { speed: i * 0.1, acceleration: 9.81 },
    }));

    const series = decimateTelemetryFrames(frames, 60);
    assert.equal(series.length, 60);
    assert.equal(series[0].cursorIndex, 0);
    assert.equal(series[series.length - 1].cursorIndex, 239);
  });

  it('maps timelineCurrentTime to SVG cursor X position and computes bounded dt damping alpha', () => {
    assert.equal(computeCursorChartPosition(5, 0, 10, 40, 200), 140);
    assert.equal(computeCursorChartPosition(0, 0, 0, 40, 200), 240);
    assert.equal(computeCursorChartPosition(-5, 0, 10, 40, 200), 40);

    const alpha60 = computeExpDampingAlpha(1 / 60, 10);
    const alpha30 = computeExpDampingAlpha(1 / 30, 10);
    assert.ok(alpha30 > alpha60);
    assert.ok(alpha60 > 0 && alpha60 < 1);
    assert.ok(alpha30 > 0 && alpha30 < 1);
  });

  it('formats LaTeX formula tokens into readable Unicode equations', () => {
    assert.equal(formatCleanEquation('\\Sigma F = m \\cdot a'), 'Σ F = m · a');
    assert.equal(formatCleanEquation('q = m \\cdot c \\cdot \\Delta T'), 'q = m · c · Δ T');
    assert.equal(formatCleanEquation('T = 2\\pi \\sqrt{\\frac{L}{g}}'), 'T = 2π √(L / g)');
    assert.equal(
      formatCleanEquation('\\dot{V}_E = RR \\times TV / 1000'),
      'V\u0307_E = RR × TV / 1000'
    );
    assert.equal(
      formatCleanEquation(
        'E_{\\text{ion}} = \\frac{RT}{zF} \\ln\\left(\\frac{[Ion]_{\\text{luar}}}{[Ion]_{\\text{dalam}}}\\right) \\approx \\pm 61.5 \\log_{10}(x)'
      ),
      'E_ion = RT / zF ln([Ion]_luar / [Ion]_dalam) ≈ ± 61.5 log_10(x)'
    );
  });
});
