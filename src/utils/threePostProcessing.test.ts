import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  clampPostProcessingSettings,
  computeEffectivePassFlags,
  DEFAULT_POST_PROCESSING_SETTINGS,
  enhanceSceneTextureAnisotropy,
  getDomainPostProcessingDefaults,
  shouldHideMeshForSsao,
} from './threePostProcessing';

test('clampPostProcessingSettings sanitizes invalid ranges and AA modes safely', () => {
  const clamped = clampPostProcessingSettings({
    enabled: true,
    bloomEnabled: true,
    ssaoEnabled: false,
    aaMode: 'invalid' as unknown as 'smaa',
    bloomStrength: 4.5,
    ssaoRadius: -2,
  });

  assert.equal(clamped.aaMode, 'smaa');
  assert.equal(clamped.bloomStrength, 0.75);
  assert.equal(clamped.ssaoRadius, 0.15);
  assert.equal(clamped.ssaoEnabled, false);
});

test('computeEffectivePassFlags enables SSAO + Bloom + SMAA on high tier benchtop GPU scenes', () => {
  const flags = computeEffectivePassFlags({
    settings: DEFAULT_POST_PROCESSING_SETTINGS,
    qualityTier: 'high',
    liteDeviceMode: false,
    isSoftwareGl: false,
    domainPreset: 'chemistry',
  });

  assert.equal(flags.bypassComposer, false);
  assert.equal(flags.useSsao, true);
  assert.equal(flags.useBloom, true);
  assert.equal(flags.useSmaa, true);
  assert.equal(flags.useFxaa, false);
  assert.ok(flags.ssaoKernelRadius > 0.4 && flags.ssaoKernelRadius < 0.7);
  assert.ok(flags.bloomThreshold > 1.0);
});

test('computeEffectivePassFlags adapts to observatory domain (stronger Bloom, SSAO off) and balanced tier', () => {
  const astroFlags = computeEffectivePassFlags({
    settings: DEFAULT_POST_PROCESSING_SETTINGS,
    qualityTier: 'high',
    liteDeviceMode: false,
    isSoftwareGl: false,
    domainPreset: 'observatory',
  });
  assert.equal(astroFlags.useSsao, false, 'Deep-space observatory should not apply benchtop SSAO');
  assert.equal(astroFlags.useBloom, true);
  assert.ok(astroFlags.bloomStrength > getDomainPostProcessingDefaults('chemistry').bloomStrength);

  const balancedFlags = computeEffectivePassFlags({
    settings: { ...DEFAULT_POST_PROCESSING_SETTINGS, aaMode: 'fxaa' },
    qualityTier: 'balanced',
    liteDeviceMode: false,
    isSoftwareGl: false,
    domainPreset: 'physics',
  });
  assert.equal(balancedFlags.bypassComposer, false);
  assert.equal(balancedFlags.useSsao, false, 'Balanced tier auto-throttles SSAO to protect FPS');
  assert.equal(balancedFlags.useBloom, true);
  assert.equal(balancedFlags.useSmaa, false);
  assert.equal(balancedFlags.useFxaa, true);
});

test('computeEffectivePassFlags bypasses composer cleanly on Software WebGL, 3T Saver, or disabled master switch', () => {
  const swFlags = computeEffectivePassFlags({
    settings: DEFAULT_POST_PROCESSING_SETTINGS,
    qualityTier: 'high',
    liteDeviceMode: false,
    isSoftwareGl: true,
    domainPreset: 'chemistry',
  });
  assert.equal(swFlags.bypassComposer, true);
  assert.equal(swFlags.useSsao, false);
  assert.equal(swFlags.useBloom, false);
  assert.equal(swFlags.useSmaa, false);

  const saverFlags = computeEffectivePassFlags({
    settings: DEFAULT_POST_PROCESSING_SETTINGS,
    qualityTier: '3t-saver',
    liteDeviceMode: false,
    isSoftwareGl: false,
    domainPreset: 'physics',
  });
  assert.equal(saverFlags.bypassComposer, true);

  const disabledFlags = computeEffectivePassFlags({
    settings: { ...DEFAULT_POST_PROCESSING_SETTINGS, enabled: false },
    qualityTier: 'high',
    liteDeviceMode: false,
    isSoftwareGl: false,
    domainPreset: 'biology',
  });
  assert.equal(disabledFlags.bypassComposer, true);
});

test('shouldHideMeshForSsao hides borosilicate glass, transparent liquids, lines, and points while keeping opaque apparatus', () => {
  const opaqueBench = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b7c90 })
  );
  assert.equal(shouldHideMeshForSsao(opaqueBench), false);

  const glassBeaker = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 2),
    new THREE.MeshPhysicalMaterial({ transmission: 0.93, ior: 1.47 })
  );
  assert.equal(shouldHideMeshForSsao(glassBeaker), true);

  const liquidMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 1.2),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.72, depthWrite: false })
  );
  assert.equal(shouldHideMeshForSsao(liquidMesh), true);

  const lineObj = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
  assert.equal(shouldHideMeshForSsao(lineObj), true);

  const pointsObj = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  assert.equal(shouldHideMeshForSsao(pointsObj), true);
});

test('enhanceSceneTextureAnisotropy upgrades scene material textures up to capped 8x anisotropy', () => {
  const scene = new THREE.Scene();
  const mapTex = new THREE.Texture();
  const bumpTex = new THREE.Texture();
  const mat = new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: bumpTex });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));

  const updated = enhanceSceneTextureAnisotropy(scene, 16);
  assert.equal(updated, 2);
  assert.equal(mapTex.anisotropy, 8);
  assert.equal(bumpTex.anisotropy, 8);

  // Calling again is idempotent
  assert.equal(enhanceSceneTextureAnisotropy(scene, 16), 0);
});
