import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createBrushedMetalTextures,
  createGraduatedScaleTexture,
  createVectorArrowGroup as createArrowGroup,
  orientAndScaleVectorArrow as orientAndScaleArrow,
} from '../../utils/threeStudioKit';
import {
  PhysicsParams,
  PhysicsMetrics,
  evaluateKinematicsAtTime,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { buildPhysicsSpecialRigs } from './PhysicsRigs';
import type {
  ConceptLabelDomRef,
  ConceptLabelProjectionEntry,
} from '../ui/ConceptLabelsOverlay';

export interface MotionTrailSystem {
  group: THREE.Group;
  pushSample: (pos: THREE.Vector3) => void;
  reset: (pos: THREE.Vector3) => void;
}

export function createMotionTrailSystem(maxPoints: number, baseHex: number): MotionTrailSystem {
  const group = new THREE.Group();
  const positions = new Float32Array(maxPoints * 3);
  const colors = new Float32Array(maxPoints * 3);
  const baseColor = new THREE.Color(baseHex);

  for (let i = 0; i < maxPoints; i++) {
    const fade = Math.pow(1 - i / maxPoints, 1.4);
    colors[i * 3] = baseColor.r * fade * 1.4;
    colors[i * 3 + 1] = baseColor.g * fade * 1.4;
    colors[i * 3 + 2] = baseColor.b * fade * 1.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
  });
  const ribbonLine = new THREE.Line(geo, lineMat);

  const pointsMat = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const neonDots = new THREE.Points(geo, pointsMat);

  group.add(ribbonLine, neonDots);

  let initialized = false;

  const reset = (pos: THREE.Vector3) => {
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < maxPoints; i++) {
      posAttr.setXYZ(i, pos.x, pos.y, pos.z);
    }
    posAttr.needsUpdate = true;
    initialized = true;
  };

  const pushSample = (pos: THREE.Vector3) => {
    if (!initialized) {
      reset(pos);
      return;
    }
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const headX = posAttr.getX(0);
    const headY = posAttr.getY(0);
    const headZ = posAttr.getZ(0);
    const distSq =
      (pos.x - headX) * (pos.x - headX) +
      (pos.y - headY) * (pos.y - headY) +
      (pos.z - headZ) * (pos.z - headZ);

    if (distSq > 9.0) {
      reset(pos);
      return;
    }
    if (distSq < 0.0004) return;

    for (let i = maxPoints - 1; i > 0; i--) {
      posAttr.setXYZ(
        i,
        posAttr.getX(i - 1),
        posAttr.getY(i - 1),
        posAttr.getZ(i - 1)
      );
    }
    posAttr.setXYZ(0, pos.x, pos.y, pos.z);
    posAttr.needsUpdate = true;
  };

  return { group, pushSample, reset };
}

export interface PhysicsCoreStageUpdateInput {
  params: PhysicsParams;
  metrics: PhysicsMetrics;
  simTime: number;
  nowSec: number;
  showVectors: boolean;
  isLite: boolean;
  isSimTimeAdvancing: boolean;
  followCamEnabled: boolean;
  camTransitionActive: boolean;
  isDragging: boolean;
  activeDragMesh: THREE.Object3D | null;
  hoveredMesh: THREE.Object3D | null;
  controlsTarget: THREE.Vector3;
}

export interface PhysicsCoreStageHandle {
  pendBobWorldPos: THREE.Vector3;
  playCannonLaunchSound: () => void;
  update: (input: PhysicsCoreStageUpdateInput) => void;
  buildConceptEntries: (
    params: PhysicsParams,
    metrics: PhysicsMetrics,
    activeLabels: boolean,
    cDom: Record<string, ConceptLabelDomRef>
  ) => ConceptLabelProjectionEntry[];
  dispose: () => void;
}

export function buildPhysicsCoreStage(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  initialLite: boolean
): PhysicsCoreStageHandle {
  const metalTex = createBrushedMetalTextures();
  const rampScaleTex = createGraduatedScaleTexture(200, 'cm', 20, {
    width: 256,
    height: 512,
  });
  const airTrackScaleTex = createGraduatedScaleTexture(120, 'cm', 24, {
    width: 256,
    height: 512,
  });

  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.006,
    metalness: 0.88,
    roughness: 0.24,
    envMapIntensity: 1.35,
  });
  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.005,
    metalness: 0.62,
    roughness: 0.36,
    envMapIntensity: 1.05,
  });
  const primaryMassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    metalness: 0.28,
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.25,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughnessMap: metalTex?.roughnessMap ?? null,
    metalness: 0.84,
    roughness: 0.24,
    envMapIntensity: 1.3,
  });

  // Floating accent glow ring gizmo for hover & drag
  const hoverGizmoGroup = new THREE.Group();
  hoverGizmoGroup.visible = false;
  const outerGizmoRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.032, 16, 48),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
    })
  );
  outerGizmoRing.rotation.x = Math.PI / 2;
  const innerGizmoRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.68, 36),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.32,
    })
  );
  innerGizmoRing.rotation.x = Math.PI / 2;
  hoverGizmoGroup.add(outerGizmoRing, innerGizmoRing);
  scene.add(hoverGizmoGroup);

  // 1. Newton Incline 3D Group
  const inclineGroup = new THREE.Group();
  scene.add(inclineGroup);

  const basePedestal = new THREE.Mesh(
    new RoundedBoxGeometry(10.6, 0.24, 2.7, 3, 0.04),
    darkFrameMat
  );
  basePedestal.position.set(0, 0.12, 0);
  basePedestal.receiveShadow = true;
  inclineGroup.add(basePedestal);

  const pivotGroup = new THREE.Group();
  pivotGroup.position.set(-4.6, 0.24, 0);
  inclineGroup.add(pivotGroup);

  const hingeAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 2.24, 20),
    brassMat
  );
  hingeAxle.rotation.x = Math.PI / 2;
  pivotGroup.add(hingeAxle);

  const rampBoard = new THREE.Mesh(
    new RoundedBoxGeometry(9.2, 0.22, 2.1, 3, 0.03),
    brushedSteelMat
  );
  rampBoard.position.set(4.6, -0.11, 0);
  rampBoard.castShadow = true;
  rampBoard.receiveShadow = true;
  rampBoard.userData = { draggableParam: 'inclineAngle', min: 0, max: 60, step: 1, label: 'Kemiringan θ' };
  pivotGroup.add(rampBoard);

  if (rampScaleTex) {
    const rampScaleStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 0.55),
      new THREE.MeshBasicMaterial({ map: rampScaleTex, transparent: true, opacity: 0.85, depthWrite: false })
    );
    rampScaleStrip.rotation.x = -Math.PI / 2;
    rampScaleStrip.rotation.z = -Math.PI / 2;
    rampScaleStrip.position.set(4.6, 0.008, 0.76);
    pivotGroup.add(rampScaleStrip);
  }

  const railGeo = new RoundedBoxGeometry(9.2, 0.13, 0.08, 2, 0.02);
  const railFront = new THREE.Mesh(railGeo, darkFrameMat);
  railFront.position.set(4.6, 0.06, 1.0);
  const railBack = new THREE.Mesh(railGeo, darkFrameMat);
  railBack.position.set(4.6, 0.06, -1.0);
  pivotGroup.add(railFront, railBack);

  const blockGroup = new THREE.Group();
  pivotGroup.add(blockGroup);

  const massBox = new THREE.Mesh(
    new RoundedBoxGeometry(1.18, 0.76, 1.18, 4, 0.06),
    primaryMassMat
  );
  massBox.position.set(0, 0.39, 0);
  massBox.castShadow = true;
  massBox.receiveShadow = true;
  massBox.userData = { draggableParam: 'appliedForce', min: -100, max: 200, step: 5, label: 'Gaya Dorong F' };
  blockGroup.add(massBox);

  const blockCapRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.032, 12, 24),
    brassMat
  );
  blockCapRing.position.set(0, 0.82, 0);
  blockCapRing.castShadow = true;
  blockGroup.add(blockCapRing);

  const arrowApplied = createArrowGroup(0x10b981);
  const arrowFriction = createArrowGroup(0xf59e0b);
  const arrowNormal = createArrowGroup(0x38bdf8);
  const arrowWeight = createArrowGroup(0xf43f5e);
  blockGroup.add(arrowApplied, arrowFriction, arrowNormal, arrowWeight);

  const supportPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 1, 16),
    brushedSteelMat
  );
  supportPillar.position.set(3.2, 0.5, 0);
  supportPillar.castShadow = true;
  inclineGroup.add(supportPillar);

  // 2. Projectile Gravity 3D Group + Motion Trail
  const projectileGroup = new THREE.Group();
  scene.add(projectileGroup);

  const launchTower = new THREE.Mesh(
    new RoundedBoxGeometry(1.24, 1, 1.24, 3, 0.05),
    darkFrameMat
  );
  launchTower.position.set(-5.2, 0.5, 0);
  launchTower.castShadow = true;
  launchTower.receiveShadow = true;
  projectileGroup.add(launchTower);

  const cannonPivot = new THREE.Group();
  cannonPivot.position.set(-5.2, 1.0, 0);
  projectileGroup.add(cannonPivot);

  const cannonBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.32, 1.6, 18),
    brushedSteelMat
  );
  cannonBarrel.rotation.z = -Math.PI / 2;
  cannonBarrel.position.set(0.8, 0, 0);
  cannonBarrel.castShadow = true;
  cannonBarrel.userData = { draggableParam: 'launchAngle', min: 10, max: 85, step: 1, label: 'Sudut Elevasi θ' };
  cannonPivot.add(cannonBarrel);

  const cannonSoundEmitter = labSound.createPositionalSoundEmitter(camera, 'collision-thud');
  cannonBarrel.add(cannonSoundEmitter.sound);

  const projectileBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0xef4444,
      emissiveIntensity: 0.55,
    })
  );
  projectileBall.castShadow = true;
  projectileBall.userData = { draggableParam: 'initialVelocity', min: 5, max: 50, step: 1, label: 'Kecepatan Awal v₀' };
  projectileGroup.add(projectileBall);

  const projectileMotionTrail = createMotionTrailSystem(54, 0x38bdf8);
  projectileGroup.add(projectileMotionTrail.group);

  const trajGeo = new THREE.BufferGeometry();
  const trajPositions = new Float32Array(61 * 3);
  trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));
  const trajLine = new THREE.Line(
    trajGeo,
    new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.3, gapSize: 0.15 })
  );
  trajLine.computeLineDistances();
  projectileGroup.add(trajLine);

  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.65, 32),
    new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
  );
  targetRing.rotation.x = -Math.PI / 2;
  projectileGroup.add(targetRing);

  // 3. Spring Hooke 3D Group
  const springGroup = new THREE.Group();
  scene.add(springGroup);

  const springWall = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, 2.5, 2.5, 3, 0.04),
    darkFrameMat
  );
  springWall.position.set(-5.2, 1.25, 0);
  springWall.castShadow = true;
  springGroup.add(springWall);

  const springTrackBed = new THREE.Mesh(
    new RoundedBoxGeometry(10.8, 0.21, 2.2, 3, 0.03),
    darkFrameMat
  );
  springTrackBed.position.set(0.2, 0.105, 0);
  springTrackBed.receiveShadow = true;
  springGroup.add(springTrackBed);

  const COIL_POINTS = 96;
  const coilPositions = new Float32Array(COIL_POINTS * 3);
  const coilGeo = new THREE.BufferGeometry();
  coilGeo.setAttribute('position', new THREE.BufferAttribute(coilPositions, 3));
  const coilLine = new THREE.Line(coilGeo, new THREE.LineBasicMaterial({ color: 0xe2e8f0 }));
  springGroup.add(coilLine);

  const springRings: THREE.Mesh[] = [];
  const springRingGeo = new THREE.TorusGeometry(0.38, 0.055, 10, 20);
  springRingGeo.rotateY(Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const rMesh = new THREE.Mesh(springRingGeo, brushedSteelMat);
    rMesh.castShadow = true;
    springRings.push(rMesh);
    springGroup.add(rMesh);
  }

  const springMassBlock = new THREE.Mesh(
    new RoundedBoxGeometry(1.32, 1.32, 1.32, 4, 0.07),
    primaryMassMat
  );
  springMassBlock.castShadow = true;
  springMassBlock.userData = { draggableParam: 'springDisplacement', min: -2.0, max: 2.0, step: 0.1, label: 'Simpangan x' };
  springGroup.add(springMassBlock);

  const springForceArrow = createArrowGroup(0x10b981);
  springGroup.add(springForceArrow);

  // 4. Pendulum Harmonic 3D Group + Motion Trail
  const pendulumGroup = new THREE.Group();
  scene.add(pendulumGroup);

  const pendStandBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), darkFrameMat);
  pendStandBase.position.set(0, 0.1, 0);
  pendStandBase.receiveShadow = true;
  pendulumGroup.add(pendStandBase);

  const pendVerticalPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.2, 16),
    brushedSteelMat
  );
  pendVerticalPillar.position.set(-0.8, 2.2, 0);
  pendVerticalPillar.castShadow = true;
  pendulumGroup.add(pendVerticalPillar);

  const pendHorizontalArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.8, 16),
    brushedSteelMat
  );
  pendHorizontalArm.rotation.z = Math.PI / 2;
  pendHorizontalArm.position.set(0, 4.2, 0);
  pendulumGroup.add(pendHorizontalArm);

  const pendPivotGroup = new THREE.Group();
  pendPivotGroup.position.set(0.6, 4.2, 0);
  pendulumGroup.add(pendPivotGroup);

  const pendRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1, 12),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
  );
  pendRod.position.set(0, -0.5, 0);
  pendPivotGroup.add(pendRod);

  const pendBob = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 32), brassMat);
  pendBob.position.set(0, -1.0, 0);
  pendBob.castShadow = true;
  pendBob.userData = { draggableParam: 'pendulumAngle', min: 5, max: 75, step: 1, label: 'Sudut Awal θ₀' };
  pendPivotGroup.add(pendBob);

  const pendulumMotionTrail = createMotionTrailSystem(48, 0xf59e0b);
  pendulumGroup.add(pendulumMotionTrail.group);

  const pendRestoringArrow = createArrowGroup(0x10b981);
  const pendGravityArrow = createArrowGroup(0xf43f5e);
  pendulumGroup.add(pendRestoringArrow, pendGravityArrow);

  const protractorGeo = new THREE.RingGeometry(0.5, 0.7, 32, 1, 0, Math.PI);
  protractorGeo.rotateZ(Math.PI);
  const protractor = new THREE.Mesh(
    protractorGeo,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
  );
  protractor.position.set(0.6, 4.2, 0.05);
  pendulumGroup.add(protractor);

  const arcGeo = new THREE.BufferGeometry();
  const arcPositions = new Float32Array(41 * 3);
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
  const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.1, gapSize: 0.05 }));
  pendulumGroup.add(arcLine);

  // 5-8c. Special Physics Rigs
  const specialRigs = buildPhysicsSpecialRigs(
    scene,
    {
      darkFrameMat,
      brushedSteelMat,
      brassMat,
      primaryMassMat,
      airTrackScaleTex,
    },
    initialLite
  );
  const { stokesSphere, cart1Mesh, cart2Mesh, satelliteBody } = specialRigs;

  // 9. Safety Hazard 3D Smoke & Alarm Light Group
  const hazardGroup = new THREE.Group();
  hazardGroup.visible = false;
  scene.add(hazardGroup);

  const hazardLight = new THREE.PointLight(0xff1e42, 0, 18);
  hazardLight.position.set(0, 4.5, 2.0);
  hazardGroup.add(hazardLight);

  const hazardRingGeo = new THREE.TorusGeometry(2.75, 0.048, 12, 48);
  const hazardRingMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.78,
  });
  const hazardPerimeterRing = new THREE.Mesh(hazardRingGeo, hazardRingMat);
  hazardPerimeterRing.rotation.x = Math.PI / 2;
  hazardPerimeterRing.position.set(0, 0.25, 0);
  hazardGroup.add(hazardPerimeterRing);

  const HAZARD_SMOKE_COUNT = 28;
  const hazardSmokeMeshes: THREE.Mesh[] = [];
  const smokeGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.45,
  });
  for (let i = 0; i < HAZARD_SMOKE_COUNT; i++) {
    const sMesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
    sMesh.position.set(
      (Math.random() - 0.5) * 4.5,
      0.5 + Math.random() * 3.5,
      (Math.random() - 0.5) * 2.5
    );
    hazardSmokeMeshes.push(sMesh);
    hazardGroup.add(sMesh);
  }

  const gizmoWorldPos = new THREE.Vector3();
  const pendBobWorldPos = new THREE.Vector3();
  const conceptBlockWorldPos = new THREE.Vector3();
  const conceptPivotWorldPos = new THREE.Vector3();

  const update = (input: PhysicsCoreStageUpdateInput) => {
    const {
      params: p,
      metrics: m,
      simTime: t,
      nowSec,
      showVectors: showVec,
      isLite,
      isSimTimeAdvancing,
      followCamEnabled,
      camTransitionActive,
      isDragging,
      activeDragMesh,
      hoveredMesh,
      controlsTarget,
    } = input;

    const isKnownSpecialMode =
      p.mode === 'projectile-gravity' ||
      (p.mode as string) === 'projectile-motion' ||
      p.mode === 'spring-hooke' ||
      p.mode === 'pendulum-harmonic' ||
      p.mode === 'collision-momentum' ||
      p.mode === 'orbital-gravity' ||
      (p.mode as string) === 'gravity-orbital' ||
      p.mode === 'stokes-viscosity' ||
      p.mode === 'ohm-wheatstone' ||
      p.mode === 'optics-young-slit' ||
      p.mode === 'photoelectric-planck';

    inclineGroup.visible = p.mode === 'newton-incline' || !isKnownSpecialMode;
    projectileGroup.visible = p.mode === 'projectile-gravity' || (p.mode as string) === 'projectile-motion';
    springGroup.visible = p.mode === 'spring-hooke';
    pendulumGroup.visible = p.mode === 'pendulum-harmonic';

    const isHazardous =
      (p.mode === 'pendulum-harmonic' && Math.abs(p.pendulumAngle ?? 0) > 80) ||
      (p.mass >= 24 && Math.abs(p.appliedForce) >= 180) ||
      (p.mode === 'spring-hooke' && Math.abs(p.springDisplacement) >= 1.8 && p.springConstantK >= 180);

    hazardGroup.visible = isHazardous;
    if (isHazardous) {
      hazardLight.intensity = isLite ? 0 : 3.5 + Math.sin(nowSec * 14) * 2.5;
      const pulse = 1 + Math.sin(nowSec * 9) * 0.08;
      hazardPerimeterRing.scale.set(pulse, pulse, 1);
      hazardRingMat.opacity = 0.48 + 0.35 * Math.abs(Math.sin(nowSec * 7));
      hazardSmokeMeshes.forEach((sMesh, idx) => {
        const cycle = (nowSec * 1.4 + idx * 0.17) % 1.0;
        sMesh.position.y = 0.4 + cycle * 4.2;
        sMesh.position.x = Math.sin(nowSec * 2.2 + idx) * (1.2 + cycle * 1.6);
        sMesh.position.z = Math.cos(nowSec * 1.8 + idx) * (0.8 + cycle * 1.1);
        sMesh.scale.setScalar(0.6 + cycle * 1.8);
        (sMesh.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.55;
      });
    }

    if (inclineGroup.visible) {
      const effectiveAngle = p.mode === 'newton-incline' ? p.inclineAngle : 0;
      const thetaRad = (effectiveAngle * Math.PI) / 180;
      pivotGroup.rotation.z = thetaRad;
      const strutH = Math.max(0.15, 7.8 * Math.tan(thetaRad));
      supportPillar.scale.set(1, strutH, 1);
      supportPillar.position.set(3.2, 0.24 + strutH / 2, 0);

      const cycleT = t % 3.2;
      const rawDisp = p.initialVelocity * cycleT + 0.5 * m.acceleration * cycleT * cycleT;
      const wrappedDisp = ((rawDisp % 26) + 26) % 26;
      const rampPos = 1.6 + Math.max(-1.0, Math.min(26, Math.abs(m.acceleration) > 0.05 ? wrappedDisp : rawDisp)) * 0.22;
      blockGroup.position.set(rampPos, 0, 0);

      if (showVec) {
        const origin = new THREE.Vector3(0, 0.45, 0);
        orientAndScaleArrow(
          arrowApplied,
          origin,
          new THREE.Vector3(p.appliedForce >= 0 ? 1 : -1, 0, 0),
          Math.min(2.6, Math.abs(p.appliedForce) / 35)
        );
        orientAndScaleArrow(
          arrowFriction,
          origin,
          new THREE.Vector3(m.netForce >= 0 ? -1 : 1, 0, 0),
          Math.min(2.2, Math.abs(m.frictionForce) / 25)
        );
        orientAndScaleArrow(
          arrowNormal,
          origin,
          new THREE.Vector3(0, 1, 0),
          Math.min(2.4, m.normalForce / 45)
        );
        orientAndScaleArrow(
          arrowWeight,
          origin,
          new THREE.Vector3(-Math.sin(thetaRad), -Math.cos(thetaRad), 0),
          Math.min(2.5, m.weightForce / 45)
        );
      } else {
        arrowApplied.visible = false;
        arrowFriction.visible = false;
        arrowNormal.visible = false;
        arrowWeight.visible = false;
      }
    } else if (m.mode === 'projectile-gravity') {
      const maxRange = Math.max(35, m.projectileRange * 1.1);
      const scaleX = 10.4 / maxRange;
      const scaleY = 4.8 / Math.max(18, m.maxProjectileHeight * 1.15);
      cannonPivot.rotation.z = (p.launchAngle * Math.PI) / 180;

      const flightT = Math.max(0.5, m.timeOfFlight);
      const posAttr = trajGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i <= 60; i++) {
        const sampleT = (i / 60) * flightT;
        const sampleInst = evaluateKinematicsAtTime(p, sampleT);
        const sx = -5.2 + sampleInst.positionX * scaleX;
        const sy = Math.max(0.05, 0.25 + sampleInst.positionY * scaleY);
        posAttr.setXYZ(i, sx, sy, 0);
      }
      posAttr.needsUpdate = true;
      trajLine.computeLineDistances();

      const loopT = t % Math.max(1.5, flightT + 0.35);
      const loopInst = evaluateKinematicsAtTime(p, Math.min(loopT, flightT));
      const curX = -5.2 + loopInst.positionX * scaleX;
      const curY = 0.25 + loopInst.positionY * scaleY;
      projectileBall.position.set(curX, curY, 0);
      projectileMotionTrail.pushSample(projectileBall.position);
      targetRing.position.set(-5.2 + m.projectileRange * scaleX, 0.03, 0);

      if (followCamEnabled && !camTransitionActive && !isDragging) {
        const followTargetX = THREE.MathUtils.clamp(curX * 0.45, -3.2, 3.8);
        const followTargetY = THREE.MathUtils.clamp(Math.max(1.2, curY * 0.55), 1.1, 4.2);
        controlsTarget.x = THREE.MathUtils.lerp(controlsTarget.x, followTargetX, 0.08);
        controlsTarget.y = THREE.MathUtils.lerp(controlsTarget.y, followTargetY, 0.08);
      }
    } else if (p.mode === 'spring-hooke') {
      const omega = Math.sqrt(Math.max(1, p.springConstantK) / Math.max(0.2, p.mass));
      const amp = Math.abs(p.springDisplacement) > 0.05 ? p.springDisplacement : 0.85;
      const damp = Math.exp(-0.04 * (p.dampingCoeff ?? 0.15) * (t % 6.0));
      const liveX = amp * damp * Math.cos(omega * t);
      const massX = 0.5 + liveX * 2.1;
      springMassBlock.position.set(massX, 0.87, 0);
      const span = Math.max(0.8, massX - 0.65 - -4.95);
      springRings.forEach((ring, idx) => {
        ring.position.set(-4.95 + ((idx + 0.5) / springRings.length) * span, 0.87, 0);
      });
      if (showVec) {
        const fSpring = -p.springConstantK * liveX;
        orientAndScaleArrow(
          springForceArrow,
          new THREE.Vector3(massX, 1.85, 0),
          new THREE.Vector3(fSpring >= 0 ? 1 : -1, 0, 0),
          Math.min(2.4, Math.abs(fSpring) / 60)
        );
      } else {
        springForceArrow.visible = false;
      }
    } else if (p.mode === 'pendulum-harmonic') {
      const L = Math.max(0.3, p.pendulumLength ?? 1.2);
      const omegaP = Math.sqrt(Math.max(1.0, p.gravity) / L);
      const maxAngleRad = ((p.pendulumAngle ?? 25) * Math.PI) / 180;
      const thetaRad = maxAngleRad * Math.cos(omegaP * t);
      pendPivotGroup.rotation.z = thetaRad;
      pendRod.scale.set(1, L * 1.5, 1);
      pendRod.position.set(0, -L * 0.75, 0);
      pendBob.position.set(0, -L * 1.5, 0);
      pendBob.getWorldPosition(pendBobWorldPos);
      pendulumMotionTrail.pushSample(pendBobWorldPos);

      if (showVec) {
        orientAndScaleArrow(
          pendGravityArrow,
          pendBobWorldPos,
          new THREE.Vector3(0, -1, 0),
          0.95
        );
        const signT = thetaRad >= 0 ? 1 : -1;
        orientAndScaleArrow(
          pendRestoringArrow,
          pendBobWorldPos,
          new THREE.Vector3(-Math.cos(thetaRad) * signT, -Math.sin(thetaRad) * signT, 0),
          Math.min(1.6, Math.abs(Math.sin(thetaRad)) * 2.2)
        );
      } else {
        pendGravityArrow.visible = false;
        pendRestoringArrow.visible = false;
      }
    }

    const liveInst = evaluateKinematicsAtTime(p, t);
    specialRigs.update(
      {
        params: p,
        metrics: m,
        simTime: t,
        nowSec,
        showVectors: showVec,
        isLite,
        isSimTimeAdvancing,
      },
      liveInst.kineticEnergy,
      liveInst.potentialEnergy
    );

    const gizmoTarget = activeDragMesh || hoveredMesh;
    if (gizmoTarget) {
      gizmoTarget.getWorldPosition(gizmoWorldPos);
      hoverGizmoGroup.visible = true;
      hoverGizmoGroup.position.copy(gizmoWorldPos);
      hoverGizmoGroup.rotation.y = nowSec * 2.2;
      const pulseScale = (isDragging ? 1.18 : 1.0) + Math.sin(nowSec * 6.0) * 0.08;
      hoverGizmoGroup.scale.setScalar(pulseScale);
      (outerGizmoRing.material as THREE.MeshBasicMaterial).color.setHex(
        isDragging ? 0x10b981 : 0x38bdf8
      );
    } else {
      hoverGizmoGroup.visible = false;
    }
  };

  const buildConceptEntries = (
    curP: PhysicsParams,
    curM: PhysicsMetrics,
    activeLabels: boolean,
    cDom: Record<string, ConceptLabelDomRef>
  ): ConceptLabelProjectionEntry[] => {
    const cEntries: ConceptLabelProjectionEntry[] = [
      { dom: cDom.c1, worldPos: new THREE.Vector3(), text: '', active: false },
      { dom: cDom.c2, worldPos: new THREE.Vector3(), text: '', active: false },
      { dom: cDom.c3, worldPos: new THREE.Vector3(), text: '', active: false },
      { dom: cDom.c4, worldPos: new THREE.Vector3(), text: '', active: false },
    ];

    if (!activeLabels) return cEntries;

    if (inclineGroup.visible) {
      massBox.getWorldPosition(conceptBlockWorldPos);
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(0, 1.35, 0)),
        text: `Gaya Dorong F = ${curP.appliedForce.toFixed(0)} N`,
        active: true,
      };
      cEntries[1] = {
        dom: cDom.c2,
        worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(-0.9, 0.35, 0)),
        text: `Gesek fₖ = ${curM.frictionForce.toFixed(1)} N`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(0.75, 0.9, 0)),
        text: `Normal N = ${curM.normalForce.toFixed(1)} N`,
        active: true,
      };
      cEntries[3] = {
        dom: cDom.c4,
        worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(0.4, -0.75, 0)),
        text: `Berat W = ${curM.weightForce.toFixed(1)} N`,
        active: true,
      };
    } else if (curM.mode === 'pendulum-harmonic') {
      pendPivotGroup.getWorldPosition(conceptPivotWorldPos);
      pendBob.getWorldPosition(pendBobWorldPos);
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: conceptPivotWorldPos.clone().add(new THREE.Vector3(-0.45, -0.35, 0)),
        text: `Panjang Tali L = ${(curP.pendulumLength ?? 1.2).toFixed(2)} m`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: pendBobWorldPos.clone().add(new THREE.Vector3(0.55, 0.25, 0)),
        text: `Gaya Pemulih · Periode T = ${curM.pendulumPeriod.toFixed(2)} s`,
        active: true,
      };
      cEntries[3] = {
        dom: cDom.c4,
        worldPos: pendBobWorldPos.clone().add(new THREE.Vector3(0, -0.65, 0)),
        text: `Gravitasi g = ${curP.gravity.toFixed(1)} m/s²`,
        active: true,
      };
    } else if (curM.mode === 'spring-hooke') {
      const sp = springMassBlock.position;
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(sp.x, sp.y + 1.35, sp.z),
        text: `Gaya Pegas Fₚ = -k·Δx · k = ${curP.springConstantK} N/m`,
        active: true,
      };
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(sp.x, sp.y + 0.5, sp.z),
        text: `Massa m = ${curP.mass.toFixed(1)} kg`,
        active: true,
      };
    } else if (curM.mode === 'projectile-gravity') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: projectileBall.position.clone().add(new THREE.Vector3(0, 0.55, 0)),
        text: `Proyektil v₀ = ${curP.initialVelocity} m/s · θ = ${curP.launchAngle}°`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: targetRing.position.clone().add(new THREE.Vector3(0, 0.45, 0)),
        text: `Jarak Jatuh R = ${curM.projectileRange.toFixed(1)} m`,
        active: true,
      };
    } else if (curM.mode === 'collision-momentum') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: cart1Mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
        text: `Momentum p₁ = ${(curP.mass * curM.v1Final).toFixed(1)} kg·m/s`,
        active: true,
      };
      cEntries[1] = {
        dom: cDom.c2,
        worldPos: cart2Mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
        text: `Momentum p₂ = ${((curP.collisionMass2 || 2) * curM.v2Final).toFixed(1)} kg·m/s`,
        active: true,
      };
    } else if (curM.mode === 'stokes-viscosity') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: stokesSphere.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
        text: `Gaya Hambat Stokes ↑ · vₜ = ${curM.stokesTerminalVelocity.toFixed(2)} m/s`,
        active: true,
      };
      cEntries[3] = {
        dom: cDom.c4,
        worldPos: stokesSphere.position.clone().add(new THREE.Vector3(0, -0.75, 0)),
        text: 'Gaya Berat Bola ↓',
        active: true,
      };
    } else if (curM.mode === 'ohm-wheatstone') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(0, 1.0, 0),
        text: `Galvanometer I_g = ${curM.galvanometerCurrent.toFixed(2)} mA`,
        active: true,
      };
      cEntries[1] = {
        dom: cDom.c2,
        worldPos: new THREE.Vector3(1.4, 0.9, -0.8),
        text: `Resistor Uji Rx = ${curP.resistorRx ?? 100} Ω`,
        active: true,
      };
    } else if (curM.mode === 'optics-young-slit') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(-1.2, 2.3, 0),
        text: `Celah Ganda d = ${(curP.slitDistance ?? 0.2).toFixed(2)} mm`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(3.8, 2.9, 0),
        text: `Jarak Frinji Δy = ${curM.fringeSpacingMm.toFixed(2)} mm`,
        active: true,
      };
    } else if (curM.mode === 'photoelectric-planck') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(-1.1, 2.7, 0),
        text: `Katoda Logam (W₀ = ${(curP.targetMetalWorkFunction ?? 2.3).toFixed(1)} eV)`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(0.4, 2.3, 0),
        text: `Ek Maks = ${curM.photoelectricMaxKe.toFixed(2)} eV`,
        active: true,
      };
    } else if (curM.mode === 'orbital-gravity') {
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: satelliteBody.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
        text: 'Gaya Gravitasi F_G ∝ 1/r²',
        active: true,
      };
    }

    return cEntries;
  };

  return {
    pendBobWorldPos,
    playCannonLaunchSound: () => cannonSoundEmitter.play(),
    update,
    buildConceptEntries,
    dispose: () => {
      metalTex?.dispose();
      rampScaleTex?.dispose();
      airTrackScaleTex?.dispose();
      specialRigs.dispose();
    },
  };
}
