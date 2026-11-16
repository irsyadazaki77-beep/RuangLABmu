import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  applyQualityTierToRenderer,
  createAdaptiveQualityController,
  getPixelRatioForTier,
  getQualityTierSpec,
  normalizeQualityTier,
} from './useAdaptiveQuality';

test('normalizeQualityTier maps legacy medium/low tiers to balanced/3t-saver', () => {
  assert.equal(normalizeQualityTier('high'), 'high');
  assert.equal(normalizeQualityTier('medium'), 'balanced');
  assert.equal(normalizeQualityTier('low'), '3t-saver');
  assert.equal(normalizeQualityTier('balanced'), 'balanced');
  assert.equal(normalizeQualityTier('3t-saver'), '3t-saver');
});

test('getPixelRatioForTier caps high tier at 1.5 and locks balanced/3t-saver to 1.0', () => {
  assert.equal(getPixelRatioForTier('high', 3), 1.5);
  assert.equal(getPixelRatioForTier('high', 1.25), 1.25);
  assert.equal(getPixelRatioForTier('balanced', 2.5), 1.0);
  assert.equal(getPixelRatioForTier('3t-saver', 3.0), 1.0);
});

test('getQualityTierSpec enforces shadow map, particle density, and post-processing budgets', () => {
  const high = getQualityTierSpec('high', 2);
  assert.equal(high.shadowsEnabled, true);
  assert.equal(high.shadowMapSize, 1024);
  assert.equal(high.particleDensityScale, 1.0);
  assert.equal(high.postProcessingEnabled, true);

  const balanced = getQualityTierSpec('balanced', 2);
  assert.equal(balanced.shadowsEnabled, true);
  assert.equal(balanced.shadowMapSize, 512);
  assert.equal(balanced.particleDensityScale, 0.85);

  const saver = getQualityTierSpec('3t-saver', 2);
  assert.equal(saver.shadowsEnabled, false);
  assert.equal(saver.shadowMapSize, 512);
  assert.equal(saver.particleDensityScale, 0.5);
  assert.equal(saver.postProcessingEnabled, false);
});

test('createAdaptiveQualityController promotes and demotes across 60-frame rolling FPS thresholds', () => {
  const transitions: string[] = [];
  const controller = createAdaptiveQualityController({
    initialTier: 'high',
    initialMode: 'auto',
    onTierChange: (tier) => transitions.push(tier),
  });

  // 1) Sustain 60 FPS -> stays high
  for (let i = 0; i < 60; i += 1) {
    controller.recordFrameDelta(1 / 60);
  }
  assert.equal(controller.getTier(), 'high');
  assert.ok(controller.getRollingFps() >= 59);

  // 2) Drop to ~33 FPS (between 25 and 44 FPS) -> balanced
  for (let i = 0; i < 75; i += 1) {
    controller.recordFrameDelta(0.03);
  }
  assert.equal(controller.getTier(), 'balanced');

  // 3) Drop below 25 FPS (18 FPS) -> 3t-saver
  for (let i = 0; i < 75; i += 1) {
    controller.recordFrameDelta(1 / 18);
  }
  assert.equal(controller.getTier(), '3t-saver');

  // 4) Recover to 60 FPS for >= 4 seconds -> steps back up through balanced -> high
  for (let i = 0; i < 300; i += 1) {
    controller.recordFrameDelta(1 / 60);
  }
  assert.equal(controller.getTier(), 'balanced');
  for (let i = 0; i < 260; i += 1) {
    controller.recordFrameDelta(1 / 60);
  }
  assert.equal(controller.getTier(), 'high');
  assert.deepEqual(transitions, ['balanced', '3t-saver', 'balanced', 'high']);
});

test('createAdaptiveQualityController respects manual 3t-saver and high overrides and resizes shadow maps safely', () => {
  let shadowMapDisposed = false;
  let lastDpr = 0;
  const mockRenderer = {
    setPixelRatio: (dpr: number) => {
      lastDpr = dpr;
    },
    shadowMap: {
      enabled: true,
      needsUpdate: false,
    },
  } as unknown as THREE.WebGLRenderer;

  const keyLight = new THREE.DirectionalLight(0xffffff, 1);
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.map = {
    dispose: () => {
      shadowMapDisposed = true;
    },
  } as unknown as THREE.WebGLRenderTarget;

  const controller = createAdaptiveQualityController({
    initialMode: 'auto',
    shadowLights: [keyLight],
  });

  controller.setMode('3t-saver', mockRenderer);
  assert.equal(controller.getTier(), '3t-saver');
  assert.equal(lastDpr, 1.0);
  assert.equal(mockRenderer.shadowMap.enabled, false);
  assert.equal(shadowMapDisposed, true);
  assert.equal(keyLight.shadow.mapSize.width, 512);
  assert.equal(keyLight.shadow.mapSize.height, 512);

  // Recording slow frames in manual high mode keeps tier locked at high
  controller.setMode('high', mockRenderer);
  assert.equal(controller.getTier(), 'high');
  assert.equal(mockRenderer.shadowMap.enabled, true);
  assert.equal(keyLight.shadow.mapSize.width, 1024);
  for (let i = 0; i < 90; i += 1) {
    controller.recordFrameDelta(0.05, mockRenderer);
  }
  assert.equal(controller.getTier(), 'high');
});

test('applyQualityTierToRenderer forces DPR 1 on software GL even for high tier', () => {
  let dpr = 0;
  const mockRenderer = {
    setPixelRatio: (val: number) => {
      dpr = val;
    },
    shadowMap: { enabled: false, needsUpdate: false },
  } as unknown as THREE.WebGLRenderer;

  applyQualityTierToRenderer(mockRenderer, 'high', { isSoftwareGl: true });
  assert.equal(dpr, 1.0);
  assert.equal(mockRenderer.shadowMap.enabled, true);
});
