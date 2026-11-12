import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLabDeepLink,
  buildLabDeepLinkSearch,
  buildShareableModuleUrl,
} from '../hooks/useUrlRouterSync';
import {
  clampSplitSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH_PX,
} from '../components/layout/StandardLabViewShell';
import {
  computeVariableVisualScale,
  getFormulaPrimerModel,
} from '../components/ui/InteractiveFormulaPrimer';
import { computeStemRadarScores } from '../components/portfolio/StudentPortfolioModal';
import { LAB_ONBOARDING_STEPS } from '../components/ui/LabOnboardingTour';
import { createInitialGamificationProfile } from '../services/gamificationEngine';

test('PILAR 1: parseLabDeepLink parses root catalog, module deep-link, room code, and portfolio/gradebook views', () => {
  const root = parseLabDeepLink('');
  assert.equal(root.isLobbyMode, true);
  assert.equal(root.viewModal, null);

  const deepSim = parseLabDeepLink('?domain=physics&module=newton-incline&step=simulation');
  assert.equal(deepSim.isLobbyMode, false);
  assert.equal(deepSim.domain, 'physics');
  assert.equal(deepSim.moduleId, 'newton-incline');
  assert.equal(deepSim.workflowStep, 2);

  const roomLink = parseLabDeepLink('?room=pin123');
  assert.equal(roomLink.roomCode, 'PIN123');

  const portfolioView = parseLabDeepLink('?view=portfolio');
  assert.equal(portfolioView.viewModal, 'portfolio');

  const gradebookView = parseLabDeepLink('?view=gradebook');
  assert.equal(gradebookView.viewModal, 'gradebook');
});

test('PILAR 1: buildLabDeepLinkSearch and buildShareableModuleUrl serialize deep-link URLs accurately', () => {
  const lobbyUrl = buildLabDeepLinkSearch({
    isLobbyMode: true,
    domain: 'physics',
    moduleId: 'newton-incline',
    workflowStep: 1,
  });
  assert.equal(lobbyUrl, '/');

  const simUrl = buildShareableModuleUrl(
    'https://ruanglabmu.app',
    'physics',
    'newton-incline',
    2,
    'PIN123'
  );
  assert.equal(
    simUrl,
    'https://ruanglabmu.app/?domain=physics&module=newton-incline&step=simulation&room=PIN123'
  );
});

test('PILAR 2: clampSplitSidebarWidth enforces 280px minimum and 55% viewport maximum', () => {
  assert.equal(DEFAULT_SIDEBAR_WIDTH_PX, 360);
  // Below minimum -> clamps to 280px
  assert.equal(clampSplitSidebarWidth(190, 1440), 280);
  // Within range -> preserves exact width
  assert.equal(clampSplitSidebarWidth(420, 1440), 420);
  // Above 55% of 1000px (550px) -> clamps to 550px
  assert.equal(clampSplitSidebarWidth(760, 1000), 550);
});

test('PILAR 3: InteractiveFormulaPrimer scales variable badges proportionally and generates intuitive sentences', () => {
  const minScale = computeVariableVisualScale(0.5, 0.5, 8.0);
  const midScale = computeVariableVisualScale(4.25, 0.5, 8.0);
  const maxScale = computeVariableVisualScale(8.0, 0.5, 8.0);

  assert.equal(minScale, 0.82);
  assert.ok(midScale > minScale && midScale < maxScale);
  assert.equal(maxScale, 1.38);

  const pendulumModel = getFormulaPrimerModel('pendulum-harmonic', 'Fisika');
  const outcomeAt2m = pendulumModel.computeOutcome({ L: 2.0, g: 9.8 });
  const outcomeAt8m = pendulumModel.computeOutcome({ L: 8.0, g: 9.8 });
  // Quadrupling pendulum length L doubles period T
  assert.ok(Math.abs(outcomeAt8m / outcomeAt2m - 2.0) < 0.05);

  const sentence = pendulumModel.buildIntuitiveSentence(
    pendulumModel.variables[0],
    { L: 8.0, g: 9.8 },
    outcomeAt8m
  );
  assert.ok(sentence.includes('4x lipat'));
  assert.ok(sentence.includes('2x lipat'));
});

test('PILAR 4: computeStemRadarScores computes 5 STEM Competency axes within 0..100', () => {
  const profile = createInitialGamificationProfile();
  profile.xp = 650;
  profile.level = 3;
  profile.unlockedBadges = ['K3 Guardian', 'Precision Analyst'];
  profile.completedActionKeys = ['k3:newton-incline', 'r2_99:newton-incline'];

  const axes = computeStemRadarScores({
    profile,
    recordsCount: 4,
    bestRSquared: 0.994,
    lksGraded: true,
    latestLksScore: 100,
    completedModulesCount: 2,
    snapshotsCount: 2,
  });

  assert.equal(axes.length, 5);
  const ids = axes.map((a) => a.id);
  assert.deepEqual(ids, ['regression', 'k3', 'exploration', 'lks', 'speed']);
  for (const axis of axes) {
    assert.ok(axis.score >= 35 && axis.score <= 100, `Axis ${axis.id} score ${axis.score} out of range`);
  }
  assert.equal(axes[0].score, 99); // R² = 0.994 -> 99
  assert.equal(axes[3].score, 100); // LKS 100
});

test('PILAR 5: LAB_ONBOARDING_STEPS defines 4 structured spotlight steps', () => {
  assert.equal(LAB_ONBOARDING_STEPS.length, 4);
  assert.equal(LAB_ONBOARDING_STEPS[0].targetSelector, '[data-onboarding="canvas-3d"]');
  assert.equal(LAB_ONBOARDING_STEPS[1].targetSelector, '[data-onboarding="telemetry-ribbon"]');
  assert.equal(LAB_ONBOARDING_STEPS[2].targetSelector, '[data-onboarding="workflow-stepper"]');
  assert.equal(LAB_ONBOARDING_STEPS[3].targetSelector, '[data-onboarding="dr-labmu-trigger"]');
});
