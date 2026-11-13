import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  applyBorosilicateLiteMode,
  buildGraduationTicks,
  captureComposerSnapshot,
  computeMsaaSamples,
  createBeakerProfilePoints,
  createBiologicalMembraneTexture,
  createBorosilicateGlassMaterial,
  createErlenmeyerProfilePoints,
  createFunnelProfilePoints,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  createVectorArrowGroup,
  disposeThreeSceneResources,
  orientAndScaleVectorArrow,
  smoothCameraTransition,
  wavelengthNmToHex,
  type StudioComposerHandle,
} from './threeStudioKit';
import {
  computeProtractorReadout,
  computeRulerReadout,
  createDigitalProbe3D,
  createMeasurementRuler3D,
  createProtractor3D,
  formatProbeReadout,
} from './threeMeasurementTools';

test('computeMsaaSamples returns 0 for software GL and clamps hardware MSAA up to 4', () => {
  assert.equal(computeMsaaSamples(8, true), 0);
  assert.equal(computeMsaaSamples(16, false), 4);
  assert.equal(computeMsaaSamples(2, false), 2);
  assert.equal(computeMsaaSamples(0, false), 0);
});

test('createBeakerProfilePoints generates non-empty thick-walled vessel coordinates', () => {
  const pts = createBeakerProfilePoints(1.2, 2.5, 0.05);
  assert.ok(pts.length >= 10);
  assert.equal(pts[0].x, 0);
  assert.equal(pts[0].y, 0);
  assert.equal(pts[pts.length - 1].x, 0);
  assert.ok(pts[pts.length - 1].y > 0, 'Inner bottom must have glass thickness > 0');
  const maxY = Math.max(...pts.map((p) => p.y));
  assert.equal(maxY, 2.5);
});

test('createErlenmeyerProfilePoints produces tapered conical neck narrower than base', () => {
  const pts = createErlenmeyerProfilePoints(1.4, 0.4, 2.2, 0.04);
  assert.ok(pts.length > 16);
  const rimPoint = pts.find((p) => p.y === 2.2 && p.x > 0);
  assert.ok(rimPoint !== undefined);
  assert.ok(rimPoint.x < 1.0, 'Erlenmeyer rim must stay noticeably narrower than base');
  assert.ok(pts.every((p) => p.x >= 0 && p.y >= 0));
});

test('createFunnelProfilePoints produces wide top funnel and narrow stem', () => {
  const pts = createFunnelProfilePoints(0.32, 0.08, 0.35, 0.25);
  assert.ok(pts.length >= 7);
  const topWidth = Math.max(...pts.map((p) => p.x));
  assert.ok(topWidth > 0.32);
  assert.ok(pts[0].y === 0);
});

test('buildGraduationTicks yields properly normalized major and minor ticks', () => {
  const ticks = buildGraduationTicks(50, 10, 5);
  assert.equal(ticks.length, 11);
  assert.equal(ticks[0].value, 0);
  assert.equal(ticks[0].isMajor, true);
  assert.equal(ticks[0].ratio, 0);
  assert.equal(ticks[1].value, 5);
  assert.equal(ticks[1].isMajor, false);
  assert.equal(ticks[10].value, 50);
  assert.equal(ticks[10].ratio, 1);
  assert.deepEqual(buildGraduationTicks(0, 10, 5), []);
});

test('smoothCameraTransition smoothly interpolates camera.position and controls.target via Vector3.lerp', () => {
  const mockCamera = { position: new THREE.Vector3(0, 0, 10) };
  const mockControls = { target: new THREE.Vector3(0, 0, 0) };
  const targetPos = new THREE.Vector3(4, 6, 12);
  const targetLookAt = new THREE.Vector3(0, 2, 0);

  const stillMoving = smoothCameraTransition(mockCamera, mockControls, targetPos, targetLookAt, 0.5);
  assert.equal(stillMoving, true);
  assert.equal(mockCamera.position.x, 2);
  assert.equal(mockCamera.position.y, 3);
  assert.equal(mockCamera.position.z, 11);
  assert.equal(mockControls.target.y, 1);

  // Converge after repeated steps
  let active = true;
  for (let i = 0; i < 60 && active; i += 1) {
    active = smoothCameraTransition(mockCamera, mockControls, targetPos, targetLookAt, 0.25);
  }
  assert.equal(active, false, 'smoothCameraTransition should snap and return false once within threshold');
  assert.equal(mockCamera.position.distanceTo(targetPos), 0);
  assert.equal(mockControls.target.distanceTo(targetLookAt), 0);
});

test('createGraduatedScaleTexture and createBiologicalMembraneTexture gracefully handle headless Node environment', () => {
  // In Node environment without DOM document, both return null safely without throwing
  assert.equal(createGraduatedScaleTexture(50, 'mL', 10), null);
  assert.equal(createBiologicalMembraneTexture('#15803d', '#4ade80'), null);
});

test('createVectorArrowGroup and orientAndScaleVectorArrow position, hide on zero length, and scale cleanly', () => {
  const arrow = createVectorArrowGroup(0x38bdf8, 0.35);
  assert.ok(arrow.getObjectByName('shaft'));
  assert.ok(arrow.getObjectByName('head'));

  orientAndScaleVectorArrow(arrow, new THREE.Vector3(1, 2, 3), new THREE.Vector3(1, 0, 0), 2.5);
  assert.equal(arrow.visible, true);
  assert.equal(arrow.position.x, 1);
  assert.equal(arrow.position.y, 2);
  assert.equal(arrow.position.z, 3);

  const shaft = arrow.getObjectByName('shaft') as THREE.Mesh;
  assert.ok(Math.abs(shaft.scale.y - (2.5 - 0.34)) < 1e-6);

  orientAndScaleVectorArrow(arrow, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.01);
  assert.equal(arrow.visible, false);
});

test('wavelengthNmToHex maps visible spectrum boundaries accurately', () => {
  assert.equal(wavelengthNmToHex(400), 0xaa00ff);
  assert.equal(wavelengthNmToHex(532), 0x50ff00);
  assert.equal(wavelengthNmToHex(660), 0xff0000);
  assert.equal(wavelengthNmToHex(200), 0x000000);
});

test('captureComposerSnapshot renders a fresh frame synchronously before calling toDataURL', () => {
  const calls: Array<{ lite?: boolean; dt?: number }> = [];
  const mockRenderer = {
    domElement: {
      toDataURL: (mime: string) => `data:${mime};base64,MOCK`,
    },
  } as unknown as THREE.WebGLRenderer;
  const mockComposer = {
    render: (lite?: boolean, dt?: number) => {
      calls.push({ lite, dt });
    },
  } as unknown as StudioComposerHandle;

  const url = captureComposerSnapshot(mockRenderer, mockComposer, true);
  assert.equal(url, 'data:image/png;base64,MOCK');
  assert.deepEqual(calls, [{ lite: true, dt: 0 }]);
});

test('disposeThreeSceneResources disposes all scene geometries, materials, textures, and clears scene', () => {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const tex = new THREE.Texture();
  const mat = new THREE.MeshStandardMaterial({ map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  const envTex = new THREE.Texture();
  const stats = disposeThreeSceneResources(scene, null, envTex);

  assert.equal(stats.geometriesDisposed, 1);
  assert.equal(stats.materialsDisposed, 1);
  assert.equal(stats.texturesDisposed, 2);
  assert.equal(scene.children.length, 0);
});

test('createBorosilicateGlassMaterial provides PBR IOR 1.47 glass in full mode and Lite fallback in 3T mode', () => {
  const fullMat = createBorosilicateGlassMaterial(false);
  assert.ok(fullMat instanceof THREE.MeshPhysicalMaterial);
  assert.equal(fullMat.ior, 1.47);
  assert.equal(fullMat.transmission, 0.93);

  applyBorosilicateLiteMode(fullMat, true);
  assert.equal(fullMat.transmission, 0);

  applyBorosilicateLiteMode(fullMat, false);
  assert.equal(fullMat.transmission, 0.93);

  const liteMat = createBorosilicateGlassMaterial(true);
  assert.ok(!(liteMat instanceof THREE.MeshPhysicalMaterial));
  assert.equal(liteMat.transparent, true);

  fullMat.dispose();
  liteMat.dispose();
});

test('createInstancedParticlePool updates transforms, colors, and clamps active count in single InstancedMesh', () => {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.05, 6, 6);
  const mat = new THREE.MeshStandardMaterial();
  const pool = createInstancedParticlePool(20, geo, mat, group);

  assert.ok(pool.mesh instanceof THREE.InstancedMesh);
  assert.equal(pool.maxCount, 20);
  assert.equal(group.children.length, 1);

  pool.setTransform(0, 1.5, 2.0, -0.5, 1.25);
  pool.setColor(0, 0x38bdf8);
  pool.commit(12);
  assert.equal(pool.mesh.count, 12);

  geo.dispose();
  mat.dispose();
});

test('threeMeasurementTools pure NST helpers and 3D instrument handles work cleanly in headless mode', () => {
  const ruler = computeRulerReadout([0, 0, 0], [3, 4, 0], 10, 0.1);
  assert.equal(ruler.worldDistance, 5);
  assert.equal(ruler.distanceCm, 50);
  assert.equal(ruler.uncertaintyCm, 0.05);
  assert.equal(ruler.formatted, '50.00 ± 0.05 cm');

  const protractor = computeProtractorReadout([0, 0, 0], [2, 0, 0], [0, 2, 0], 1.0);
  assert.equal(protractor.angleDeg, 90);
  assert.equal(protractor.uncertaintyDeg, 0.5);
  assert.equal(protractor.formatted, '90.0 ± 0.5°');

  const phReadout = formatProbeReadout('ph', 2.4);
  assert.equal(phReadout.formatted, 'pH 2.40 ± 0.02');
  assert.equal(phReadout.severityHex, '#f43f5e');

  const tempReadout = formatProbeReadout('thermometer', 74.5);
  assert.equal(tempReadout.formatted, '74.5 ± 0.1 °C');
  assert.equal(tempReadout.severityHex, '#ef4444');

  const ruler3d = createMeasurementRuler3D();
  const updatedRuler = ruler3d.setEndpoints(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0));
  assert.equal(updatedRuler.distanceCm, 20);
  assert.equal(ruler3d.getInteractiveHandles().length, 2);
  ruler3d.dispose();

  const protractor3d = createProtractor3D(45);
  assert.equal(protractor3d.getAngleDeg(), 45);
  const updatedAngle = protractor3d.setAngleDeg(60);
  assert.equal(updatedAngle.angleDeg, 60);
  protractor3d.dispose();

  const probe3d = createDigitalProbe3D('thermometer');
  const probeStatus = probe3d.setReading('thermometer', 80);
  assert.equal(probeStatus.formatted, '80.0 ± 0.1 °C');
  probe3d.dispose();
});

test('FASE 4: multi-module rig disposal leaves 0 leaked WebGL geometries and textures on renderer.info.memory', () => {
  const memory = { geometries: 0, textures: 0 };
  const trackGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
    memory.geometries++;
    geo.addEventListener('dispose', () => {
      memory.geometries = Math.max(0, memory.geometries - 1);
    });
    return geo;
  };
  const trackTex = <T extends THREE.Texture>(tex: T): T => {
    memory.textures++;
    tex.addEventListener('dispose', () => {
      memory.textures = Math.max(0, memory.textures - 1);
    });
    return tex;
  };

  for (const liteMode of [false, true, false]) {
    const scene = new THREE.Scene();
    const vesselGeo = trackGeo(new THREE.CylinderGeometry(0.8, 0.8, 2.0, 24));
    const glassMat = createBorosilicateGlassMaterial(liteMode);
    const mapTex = trackTex(new THREE.Texture());
    const roughTex = trackTex(new THREE.Texture());
    const benchMat = new THREE.MeshStandardMaterial({ map: mapTex, roughnessMap: roughTex });

    const vessel = new THREE.Mesh(vesselGeo, glassMat);
    const bench = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5, 0.2, 3)), benchMat);
    scene.add(vessel, bench);

    const particleGeo = trackGeo(new THREE.SphereGeometry(0.04, 8, 8));
    const particleMat = new THREE.MeshStandardMaterial();
    createInstancedParticlePool(24, particleGeo, particleMat, scene);

    const envTex = trackTex(new THREE.Texture());
    const mockRenderer = {
      info: { memory },
      renderLists: { dispose: () => {} },
      dispose: () => {},
    } as unknown as THREE.WebGLRenderer;

    assert.ok(memory.geometries >= 3);
    assert.ok(memory.textures >= 3);

    disposeThreeSceneResources(scene, mockRenderer, envTex);

    assert.equal(mockRenderer.info.memory.geometries, 0);
    assert.equal(mockRenderer.info.memory.textures, 0);
    assert.equal(scene.children.length, 0);
  }
});

