import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createBrushedMetalTextures,
  createContactShadowPlane,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  createThreadedRodTextures,
  createVectorArrowGroup as createArrowGroup,
  orientAndScaleVectorArrow as orientAndScaleArrow,
} from '../../utils/threeStudioKit';
import {
  PhysicsParams,
  PhysicsMetrics,
  evaluateKinematicsAtTime,
} from '../../utils/scienceEngine';
import {
  computeInclineVisualState,
  computePendulumVisualKinematics,
  computeSpringVisualKinematics,
} from '../../utils/physicsVisualHelpers';
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
  particleScale?: number;
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
  const threadedTex = createThreadedRodTextures(7);
  const rampScaleTex = createGraduatedScaleTexture(200, 'cm', 20, {
    width: 256,
    height: 512,
    strokeColor: 'rgba(15, 23, 42, 0.86)',
  });
  const airTrackScaleTex = createGraduatedScaleTexture(120, 'cm', 24, {
    width: 256,
    height: 512,
  });

  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xdce4ee,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.006,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.18,
  });
  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x2d3b4e,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.005,
    metalness: 0.72,
    roughness: 0.28,
    envMapIntensity: 0.88,
  });
  const primaryMassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0369a1,
    roughnessMap: metalTex?.roughnessMap ?? null,
    metalness: 0.42,
    roughness: 0.16,
    clearcoat: 0.96,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.05,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe5a524,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.004,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.18,
  });
  const threadedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughnessMap: threadedTex?.roughnessMap ?? metalTex?.roughnessMap ?? null,
    bumpMap: threadedTex?.bumpMap ?? metalTex?.bumpMap ?? null,
    bumpScale: 0.022,
    metalness: 0.88,
    roughness: 0.26,
    envMapIntensity: 1.12,
  });
  const ptfeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.26,
    metalness: 0.04,
    envMapIntensity: 0.75,
  });
  const rubberBumperMat = new THREE.MeshStandardMaterial({
    color: 0x18212f,
    roughness: 0.88,
    metalness: 0.04,
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
    new RoundedBoxGeometry(10.6, 0.22, 2.7, 3, 0.04),
    darkFrameMat
  );
  basePedestal.position.set(0, 0.15, 0);
  basePedestal.castShadow = true;
  basePedestal.receiveShadow = true;
  inclineGroup.add(basePedestal);

  // Rubberized anti-vibration leveling feet + baked AO contact shadow beneath pedestal
  const footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.88, metalness: 0.05 });
  const footGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.06, 16);
  [
    [-4.85, -1.05],
    [-4.85, 1.05],
    [4.85, -1.05],
    [4.85, 1.05],
  ].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(fx, 0.03, fz);
    inclineGroup.add(foot);
  });
  const inclineContactShadow = createContactShadowPlane(5.55, 1.65, 0.34);
  inclineContactShadow.position.set(0, 0.008, 0);
  inclineGroup.add(inclineContactShadow);

  const pivotGroup = new THREE.Group();
  pivotGroup.position.set(-4.6, 0.26, 0);
  inclineGroup.add(pivotGroup);

  const hingeAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 2.24, 20),
    brassMat
  );
  hingeAxle.rotation.x = Math.PI / 2;
  pivotGroup.add(hingeAxle);

  // Hinge clevis cheeks & calibrated brass angle quadrant at pivot
  const clevisGeo = new RoundedBoxGeometry(0.36, 0.34, 0.12, 2, 0.02);
  const clevisFront = new THREE.Mesh(clevisGeo, darkFrameMat);
  clevisFront.position.set(-4.6, 0.32, 1.12);
  const clevisBack = new THREE.Mesh(clevisGeo, darkFrameMat);
  clevisBack.position.set(-4.6, 0.32, -1.12);
  inclineGroup.add(clevisFront, clevisBack);

  const inclineProtractorArc = new THREE.Mesh(
    new THREE.RingGeometry(1.18, 1.32, 28, 1, 0, Math.PI / 3),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.82,
      roughness: 0.26,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    })
  );
  inclineProtractorArc.position.set(-4.6, 0.24, 1.14);
  inclineGroup.add(inclineProtractorArc);

  const inclineAnglePointer = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.032, 0.032),
    brassMat
  );
  inclineAnglePointer.position.set(0.67, 0, 1.155);
  pivotGroup.add(inclineAnglePointer);

  const rampBoard = new THREE.Mesh(
    new RoundedBoxGeometry(9.2, 0.22, 2.1, 3, 0.03),
    brushedSteelMat
  );
  rampBoard.position.set(4.6, -0.11, 0);
  rampBoard.castShadow = true;
  rampBoard.receiveShadow = true;
  rampBoard.userData = { draggableParam: 'inclineAngle', min: 0, max: 60, step: 1, label: 'Kemiringan θ' };
  pivotGroup.add(rampBoard);

  // Rubberized top bumper end-stop + machined aluminum & brass pulley assembly on incline track
  const rampEndStop = new THREE.Mesh(
    new RoundedBoxGeometry(0.2, 0.42, 2.04, 2, 0.03),
    darkFrameMat
  );
  rampEndStop.position.set(9.12, 0.18, 0);
  rampEndStop.castShadow = true;
  pivotGroup.add(rampEndStop);

  const rubberStopPad = new THREE.Mesh(
    new RoundedBoxGeometry(0.06, 0.3, 1.82, 2, 0.015),
    rubberBumperMat
  );
  rubberStopPad.position.set(8.99, 0.18, 0);
  pivotGroup.add(rubberStopPad);

  // Grooved brass top pulley bracket at upper end of track (PASCO dynamics track style)
  const pulleyBracketGeo = new RoundedBoxGeometry(0.46, 0.18, 0.055, 2, 0.012);
  const pulleyCheekF = new THREE.Mesh(pulleyBracketGeo, brushedSteelMat);
  pulleyCheekF.position.set(9.38, 0.24, 0.11);
  const pulleyCheekB = new THREE.Mesh(pulleyBracketGeo, brushedSteelMat);
  pulleyCheekB.position.set(9.38, 0.24, -0.11);
  const pulleyWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.11, 24),
    brassMat
  );
  pulleyWheel.rotation.x = Math.PI / 2;
  pulleyWheel.position.set(9.54, 0.24, 0);
  pulleyWheel.castShadow = true;
  const pulleyGroove = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.025, 10, 28),
    darkFrameMat
  );
  pulleyGroove.position.set(9.54, 0.24, 0);
  const pulleyPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.28, 14),
    brushedSteelMat
  );
  pulleyPin.rotation.x = Math.PI / 2;
  pulleyPin.position.set(9.54, 0.24, 0);
  pivotGroup.add(pulleyCheekF, pulleyCheekB, pulleyWheel, pulleyGroove, pulleyPin);

  // Recessed dark optical guide channel down track center for extruded aluminum depth
  const centerGroove = new THREE.Mesh(
    new THREE.BoxGeometry(8.95, 0.012, 0.32),
    darkFrameMat
  );
  centerGroove.position.set(4.56, 0.002, 0);
  pivotGroup.add(centerGroove);

  if (rampScaleTex) {
    const rampScaleStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 0.56),
      new THREE.MeshBasicMaterial({ map: rampScaleTex, transparent: true, opacity: 0.92, depthWrite: false })
    );
    rampScaleStrip.rotation.x = -Math.PI / 2;
    rampScaleStrip.rotation.z = -Math.PI / 2;
    rampScaleStrip.position.set(4.6, 0.01, 0.72);
    pivotGroup.add(rampScaleStrip);
  }

  // Two-tone extruded side guide rails (anodized gunmetal base + bright satin aluminum top cap)
  const railGeo = new RoundedBoxGeometry(9.2, 0.13, 0.085, 2, 0.02);
  const railFront = new THREE.Mesh(railGeo, darkFrameMat);
  railFront.position.set(4.6, 0.06, 1.0);
  const railBack = new THREE.Mesh(railGeo, darkFrameMat);
  railBack.position.set(4.6, 0.06, -1.0);
  const railCapGeo = new THREE.BoxGeometry(9.18, 0.025, 0.055);
  const railCapF = new THREE.Mesh(railCapGeo, brushedSteelMat);
  railCapF.position.set(4.6, 0.132, 1.0);
  const railCapB = new THREE.Mesh(railCapGeo, brushedSteelMat);
  railCapB.position.set(4.6, 0.132, -1.0);
  pivotGroup.add(railFront, railBack, railCapF, railCapB);

  const blockGroup = new THREE.Group();
  pivotGroup.add(blockGroup);

  // Separate visual sub-group so volumetric mass scaling never distorts force vector arrows
  const blockBodyGroup = new THREE.Group();
  blockGroup.add(blockBodyGroup);

  // Composite machined laboratory dynamics block (anodized sapphire chassis + aluminum deck + slotted brass mass discs + PTFE glide shoes + brass load collar)
  const massBox = new THREE.Mesh(
    new RoundedBoxGeometry(1.22, 0.66, 1.18, 4, 0.055),
    primaryMassMat
  );
  massBox.position.set(0, 0.4, 0);
  massBox.castShadow = true;
  massBox.receiveShadow = true;
  massBox.userData = { draggableParam: 'appliedForce', min: -100, max: 200, step: 5, label: 'Gaya Dorong F' };
  blockBodyGroup.add(massBox);

  const blockTopPlate = new THREE.Mesh(
    new RoundedBoxGeometry(1.1, 0.06, 1.06, 2, 0.018),
    brushedSteelMat
  );
  blockTopPlate.position.set(0, 0.755, 0);
  blockTopPlate.castShadow = true;
  blockBodyGroup.add(blockTopPlate);

  // Stacked machined slotted calibration weight discs nested on the top plate
  const weightDiscLower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.38, 0.075, 28),
    brassMat
  );
  weightDiscLower.position.set(0, 0.818, 0);
  weightDiscLower.castShadow = true;
  const weightDiscUpper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.065, 28),
    brushedSteelMat
  );
  weightDiscUpper.position.set(0, 0.885, 0);
  weightDiscUpper.castShadow = true;
  blockBodyGroup.add(weightDiscLower, weightDiscUpper);

  const blockSideBand = new THREE.Mesh(
    new RoundedBoxGeometry(1.245, 0.075, 1.205, 2, 0.012),
    brushedSteelMat
  );
  blockSideBand.position.set(0, 0.4, 0);
  blockBodyGroup.add(blockSideBand);

  // Low-friction white PTFE/Delrin linear glide shoes seated cleanly on aluminum track
  const runnerGeo = new RoundedBoxGeometry(1.16, 0.075, 0.16, 2, 0.02);
  const runnerFront = new THREE.Mesh(runnerGeo, ptfeMat);
  runnerFront.position.set(0, 0.038, 0.42);
  const runnerBack = new THREE.Mesh(runnerGeo, ptfeMat);
  runnerBack.position.set(0, 0.038, -0.42);
  blockBodyGroup.add(runnerFront, runnerBack);

  // Subtle thermal sliding-friction contact glow underneath PTFE runners when moving
  const frictionGlowMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const frictionGlowPad = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 1.02), frictionGlowMat);
  frictionGlowPad.rotation.x = -Math.PI / 2;
  frictionGlowPad.position.set(0, 0.012, 0);
  frictionGlowPad.visible = false;
  blockBodyGroup.add(frictionGlowPad);

  // Front force-sensor tow hook eyelet
  const frontTowHook = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.022, 10, 20),
    brushedSteelMat
  );
  frontTowHook.position.set(0.65, 0.4, 0);
  blockBodyGroup.add(frontTowHook);

  const blockCollarBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 0.06, 18),
    brassMat
  );
  blockCollarBase.position.set(0, 0.94, 0);
  blockBodyGroup.add(blockCollarBase);

  const blockCapRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.028, 12, 24),
    brassMat
  );
  blockCapRing.position.set(0, 1.04, 0);
  blockCapRing.castShadow = true;
  blockBodyGroup.add(blockCapRing);

  const arrowApplied = createArrowGroup(0x10b981); // Emerald: F_dorong
  const arrowFriction = createArrowGroup(0xf59e0b); // Amber: f_s / f_k
  const arrowNormal = createArrowGroup(0x38bdf8); // Sky: N
  const arrowWeight = createArrowGroup(0xf43f5e); // Rose: W = m·g
  const arrowGravityParallel = createArrowGroup(0xa855f7); // Violet: m·g·sin θ
  const arrowNetForce = createArrowGroup(0x22d3ee); // Cyan: ΣF
  blockGroup.add(
    arrowApplied,
    arrowFriction,
    arrowNormal,
    arrowWeight,
    arrowGravityParallel,
    arrowNetForce
  );

  // Machined elevation screw-jack assembly with flange bolts, threaded leadscrew, and knurled brass handwheel
  const supportBaseFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.44, 0.14, 24),
    darkFrameMat
  );
  supportBaseFlange.position.set(3.2, 0.33, 0);
  supportBaseFlange.castShadow = true;
  inclineGroup.add(supportBaseFlange);

  const flangeBoltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6);
  for (let b = 0; b < 4; b++) {
    const ba = (b / 4) * Math.PI * 2 + Math.PI / 4;
    const fBolt = new THREE.Mesh(flangeBoltGeo, brushedSteelMat);
    fBolt.position.set(3.2 + Math.cos(ba) * 0.3, 0.41, Math.sin(ba) * 0.3);
    inclineGroup.add(fBolt);
  }

  const supportPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.145, 1, 24),
    threadedSteelMat
  );
  supportPillar.position.set(3.2, 0.5, 0);
  supportPillar.castShadow = true;
  inclineGroup.add(supportPillar);

  const supportCollar = new THREE.Group();
  supportCollar.position.set(3.2, 0.5, 0);
  const collarHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24),
    brassMat
  );
  supportCollar.add(collarHub);
  const knurlFinGeo = new THREE.BoxGeometry(0.05, 0.14, 0.62);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(knurlFinGeo, brassMat);
    fin.rotation.y = (k / 4) * Math.PI;
    supportCollar.add(fin);
  }
  inclineGroup.add(supportCollar);

  // 2. Projectile Gravity 3D Group + Motion Trail
  const projectileGroup = new THREE.Group();
  scene.add(projectileGroup);

  const launchTower = new THREE.Mesh(
    new RoundedBoxGeometry(1.36, 0.86, 1.36, 3, 0.05),
    darkFrameMat
  );
  launchTower.position.set(-5.2, 0.43, 0);
  launchTower.castShadow = true;
  launchTower.receiveShadow = true;
  projectileGroup.add(launchTower);

  // Trunnion yoke cheeks + elevation quadrant behind cannon
  const yokeCheekGeo = new RoundedBoxGeometry(0.36, 0.54, 0.1, 2, 0.02);
  const yokeFront = new THREE.Mesh(yokeCheekGeo, brushedSteelMat);
  yokeFront.position.set(-5.2, 1.0, 0.44);
  const yokeBack = new THREE.Mesh(yokeCheekGeo, brushedSteelMat);
  yokeBack.position.set(-5.2, 1.0, -0.44);
  const cannonQuadrant = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.86, 28, 1, 0, Math.PI / 2),
    brassMat
  );
  cannonQuadrant.position.set(-5.2, 1.0, -0.48);
  projectileGroup.add(yokeFront, yokeBack, cannonQuadrant);

  const cannonPivot = new THREE.Group();
  cannonPivot.position.set(-5.2, 1.0, 0);
  projectileGroup.add(cannonPivot);

  const cannonTrunnion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.98, 16),
    brassMat
  );
  cannonTrunnion.rotation.x = Math.PI / 2;
  cannonPivot.add(cannonTrunnion);

  const cannonBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.29, 1.65, 22),
    brushedSteelMat
  );
  cannonBarrel.rotation.z = -Math.PI / 2;
  cannonBarrel.position.set(0.8, 0, 0);
  cannonBarrel.castShadow = true;
  cannonBarrel.userData = { draggableParam: 'launchAngle', min: 10, max: 85, step: 1, label: 'Sudut Elevasi θ' };
  cannonPivot.add(cannonBarrel);

  const cannonBreechCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 18, 18),
    darkFrameMat
  );
  cannonBreechCap.position.set(-0.04, 0, 0);
  const cannonMuzzleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.045, 12, 24),
    brassMat
  );
  cannonMuzzleRing.rotation.y = Math.PI / 2;
  cannonMuzzleRing.position.set(1.62, 0, 0);
  const cannonMidCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.275, 0.275, 0.18, 20),
    darkFrameMat
  );
  cannonMidCollar.rotation.z = Math.PI / 2;
  cannonMidCollar.position.set(0.55, 0, 0);
  cannonPivot.add(cannonBreechCap, cannonMuzzleRing, cannonMidCollar);

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

  // Real-time instantaneous velocity decomposition vectors (vx cyan, vy amber) + Apex marker ring
  const projVxArrow = createArrowGroup(0x22d3ee);
  const projVyArrow = createArrowGroup(0xf59e0b);
  const apexMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.032, 12, 28),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.92 })
  );
  projectileGroup.add(projVxArrow, projVyArrow, apexMarker);

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

  if (rampScaleTex) {
    const springScaleStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 0.48),
      new THREE.MeshBasicMaterial({ map: rampScaleTex, transparent: true, opacity: 0.82, depthWrite: false })
    );
    springScaleStrip.rotation.x = -Math.PI / 2;
    springScaleStrip.rotation.z = -Math.PI / 2;
    springScaleStrip.position.set(0.2, 0.216, 0.78);
    springGroup.add(springScaleStrip);
  }

  // Wall anchor plate & equilibrium zero marker on track
  const wallAnchorPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.12, 20),
    brassMat
  );
  wallAnchorPlate.rotation.z = Math.PI / 2;
  wallAnchorPlate.position.set(-4.98, 0.87, 0);
  const eqMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.03, 1.9),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  eqMarker.position.set(0.5, 0.22, 0);
  springGroup.add(wallAnchorPlate, eqMarker);

  // Continuous 3D Helical Steel Coil built via zero-allocation InstancedMesh segments
  const HELIX_SEGMENTS = 108;
  const helixSegGeo = new THREE.CylinderGeometry(0.046, 0.046, 1.0, 8, 1);
  const helixInstanced = new THREE.InstancedMesh(helixSegGeo, brushedSteelMat, HELIX_SEGMENTS);
  helixInstanced.castShadow = true;
  helixInstanced.frustumCulled = false;
  springGroup.add(helixInstanced);
  const _hxP0 = new THREE.Vector3();
  const _hxP1 = new THREE.Vector3();
  const _hxMid = new THREE.Vector3();
  const _hxDir = new THREE.Vector3();
  const _hxQuat = new THREE.Quaternion();
  const _hxScale = new THREE.Vector3();
  const _hxMat4 = new THREE.Matrix4();
  const _hxYAxis = new THREE.Vector3(0, 1, 0);

  const springMassBlock = new THREE.Mesh(
    new RoundedBoxGeometry(1.32, 1.32, 1.32, 4, 0.07),
    primaryMassMat
  );
  springMassBlock.castShadow = true;
  springMassBlock.userData = { draggableParam: 'springDisplacement', min: -2.0, max: 2.0, step: 0.1, label: 'Simpangan x' };
  const springBlockHook = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.035, 10, 20),
    brassMat
  );
  springBlockHook.position.set(-0.72, 0, 0);
  springMassBlock.add(springBlockHook);
  springGroup.add(springMassBlock);

  const springForceArrow = createArrowGroup(0x10b981);
  springGroup.add(springForceArrow);

  // 4. Pendulum Harmonic 3D Group + Motion Trail
  const pendulumGroup = new THREE.Group();
  scene.add(pendulumGroup);

  const pendStandBase = new THREE.Mesh(
    new RoundedBoxGeometry(2.6, 0.22, 2.4, 3, 0.04),
    darkFrameMat
  );
  pendStandBase.position.set(0, 0.11, 0);
  pendStandBase.receiveShadow = true;
  pendulumGroup.add(pendStandBase);

  const pendBaseFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.12, 20),
    brassMat
  );
  pendBaseFlange.position.set(-0.8, 0.28, 0);
  pendulumGroup.add(pendBaseFlange);

  const pendVerticalPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.2, 18),
    brushedSteelMat
  );
  pendVerticalPillar.position.set(-0.8, 2.25, 0);
  pendVerticalPillar.castShadow = true;
  pendulumGroup.add(pendVerticalPillar);

  const pendBosshead = new THREE.Mesh(
    new RoundedBoxGeometry(0.28, 0.26, 0.24, 2, 0.03),
    darkFrameMat
  );
  pendBosshead.position.set(-0.8, 4.2, 0);
  const pendBossKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.18, 14),
    brassMat
  );
  pendBossKnob.rotation.z = Math.PI / 2;
  pendBossKnob.position.set(-0.98, 4.2, 0);
  pendulumGroup.add(pendBosshead, pendBossKnob);

  const pendHorizontalArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.8, 16),
    brushedSteelMat
  );
  pendHorizontalArm.rotation.z = Math.PI / 2;
  pendHorizontalArm.position.set(0, 4.2, 0);
  pendulumGroup.add(pendHorizontalArm);

  const pendPivotCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16),
    brassMat
  );
  pendPivotCollar.rotation.x = Math.PI / 2;
  pendPivotCollar.position.set(0.6, 4.2, 0);
  pendulumGroup.add(pendPivotCollar);

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
  const pendBobEyelet = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.022, 10, 18),
    brushedSteelMat
  );
  pendBobEyelet.position.set(0, 0.4, 0);
  pendBob.add(pendBobEyelet);
  pendPivotGroup.add(pendBob);

  const pendulumMotionTrail = createMotionTrailSystem(48, 0xf59e0b);
  pendulumGroup.add(pendulumMotionTrail.group);

  const pendRestoringArrow = createArrowGroup(0x10b981);
  const pendGravityArrow = createArrowGroup(0xf43f5e);
  const pendTensionArrow = createArrowGroup(0x22d3ee);
  pendulumGroup.add(pendRestoringArrow, pendGravityArrow, pendTensionArrow);

  const protractorGeo = new THREE.RingGeometry(0.52, 0.74, 36, 1, 0, Math.PI);
  protractorGeo.rotateZ(Math.PI);
  const protractor = new THREE.Mesh(
    protractorGeo,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
  );
  protractor.position.set(0.6, 4.2, 0.05);
  pendulumGroup.add(protractor);

  const ARC_SAMPLES = 41;
  const arcGeo = new THREE.BufferGeometry();
  const arcPositions = new Float32Array(ARC_SAMPLES * 3);
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
  const arcLine = new THREE.Line(
    arcGeo,
    new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.14, gapSize: 0.08, transparent: true, opacity: 0.72 })
  );
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
  const { stokesSphere, cart1Mesh, cart2Mesh, satelliteBody, meldeHangingMass } = specialRigs;

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
  const smokeGeo = new THREE.SphereGeometry(0.24, 10, 10);
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.45,
  });
  const hazardSmokePool = createInstancedParticlePool(
    HAZARD_SMOKE_COUNT,
    smokeGeo,
    smokeMat,
    hazardGroup
  );
  hazardSmokePool.mesh.frustumCulled = false;

  const gizmoWorldPos = new THREE.Vector3();
  const pendBobWorldPos = new THREE.Vector3();
  const conceptBlockWorldPos = new THREE.Vector3();
  const conceptPivotWorldPos = new THREE.Vector3();

  // Pre-allocated scratch helpers for zero per-frame allocations
  const _arrowOrigin = new THREE.Vector3();
  const _arrowDir = new THREE.Vector3();
  const _upUnit = new THREE.Vector3(0, 1, 0);
  const _downUnit = new THREE.Vector3(0, -1, 0);
  const _reusableConceptEntries: ConceptLabelProjectionEntry[] = [
    { dom: undefined, worldPos: new THREE.Vector3(), text: '', active: false },
    { dom: undefined, worldPos: new THREE.Vector3(), text: '', active: false },
    { dom: undefined, worldPos: new THREE.Vector3(), text: '', active: false },
    { dom: undefined, worldPos: new THREE.Vector3(), text: '', active: false },
  ];

  const update = (input: PhysicsCoreStageUpdateInput) => {
    const {
      params: p,
      metrics: m,
      simTime: t,
      nowSec,
      showVectors: showVec,
      isLite,
      particleScale = 1.0,
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
      p.mode === 'photoelectric-planck' ||
      p.mode === 'standing-wave-melde' ||
      p.mode === 'faraday-induction';

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
      const activeSmoke = Math.max(8, Math.round(HAZARD_SMOKE_COUNT * particleScale));
      for (let idx = 0; idx < activeSmoke; idx++) {
        const cycle = (nowSec * 1.4 + idx * 0.17) % 1.0;
        hazardSmokePool.setTransform(
          idx,
          Math.sin(nowSec * 2.2 + idx) * (1.2 + cycle * 1.6),
          0.4 + cycle * 4.2,
          Math.cos(nowSec * 1.8 + idx) * (0.8 + cycle * 1.1),
          0.6 + cycle * 1.8
        );
      }
      hazardSmokePool.commit(activeSmoke);
    }

    if (inclineGroup.visible) {
      const effectiveAngle = p.mode === 'newton-incline' ? p.inclineAngle : 0;
      const thetaRad = (effectiveAngle * Math.PI) / 180;
      pivotGroup.rotation.z = thetaRad;
      const strutH = Math.max(0.15, 7.8 * Math.tan(thetaRad) - 0.12);
      supportPillar.scale.set(1, strutH, 1);
      supportPillar.position.set(3.2, 0.24 + strutH / 2, 0);
      supportCollar.position.set(3.2, 0.24 + strutH - 0.1, 0);

      const incState = computeInclineVisualState(p, m, t);
      blockGroup.position.set(4.5 + incState.blockRampOffset, 0, 0);
      blockBodyGroup.scale.setScalar(incState.blockScale);

      // Rotate upper pulley wheel when block slides along track
      if (m.isMoving) {
        pulleyWheel.rotation.y = -t * Math.min(8, Math.max(1.2, Math.abs(m.acceleration) * 0.9));
      }

      // Thermal sliding friction glow pad under runners
      frictionGlowPad.visible = incState.frictionHeatGlow > 0.02;
      if (frictionGlowPad.visible) {
        frictionGlowMat.opacity = incState.frictionHeatGlow * (0.52 + 0.12 * Math.sin(nowSec * 12));
      }

      const bodyMidY = 0.44 * incState.blockScale;
      if (showVec) {
        _arrowOrigin.set(0, bodyMidY, 0);
        if (incState.appliedArrowLen > 0.01) {
          _arrowDir.set(p.appliedForce >= 0 ? 1 : -1, 0, 0);
          orientAndScaleArrow(arrowApplied, _arrowOrigin, _arrowDir, incState.appliedArrowLen);
        } else {
          arrowApplied.visible = false;
        }

        if (incState.frictionDirSign !== 0 && incState.frictionArrowLen > 0.01) {
          _arrowOrigin.set(0, 0.16, 0);
          _arrowDir.set(incState.frictionDirSign, 0, 0);
          orientAndScaleArrow(arrowFriction, _arrowOrigin, _arrowDir, incState.frictionArrowLen);
        } else {
          arrowFriction.visible = false;
        }

        _arrowOrigin.set(0, bodyMidY, 0);
        orientAndScaleArrow(arrowNormal, _arrowOrigin, _upUnit, incState.normalArrowLen);

        _arrowDir.set(-Math.sin(thetaRad), -Math.cos(thetaRad), 0);
        orientAndScaleArrow(arrowWeight, _arrowOrigin, _arrowDir, incState.weightArrowLen);

        if (incState.gravityParallelArrowLen > 0.01) {
          _arrowOrigin.set(0, bodyMidY * 0.72, 0.54 * incState.blockScale);
          _arrowDir.set(-1, 0, 0);
          orientAndScaleArrow(
            arrowGravityParallel,
            _arrowOrigin,
            _arrowDir,
            incState.gravityParallelArrowLen
          );
        } else {
          arrowGravityParallel.visible = false;
        }

        if (incState.netForceDirSign !== 0 && incState.netForceArrowLen > 0.01) {
          _arrowOrigin.set(0, 1.05 * incState.blockScale, 0);
          _arrowDir.set(incState.netForceDirSign, 0, 0);
          orientAndScaleArrow(arrowNetForce, _arrowOrigin, _arrowDir, incState.netForceArrowLen);
        } else {
          arrowNetForce.visible = false;
        }
      } else {
        arrowApplied.visible = false;
        arrowFriction.visible = false;
        arrowNormal.visible = false;
        arrowWeight.visible = false;
        arrowGravityParallel.visible = false;
        arrowNetForce.visible = false;
      }
    } else if (m.mode === 'projectile-gravity') {
      const maxRange = Math.max(35, m.projectileRange * 1.1);
      const scaleX = 10.4 / maxRange;
      const scaleY = 4.8 / Math.max(18, m.maxProjectileHeight * 1.15);
      const launchElevY = 0.25 + Math.max(0, p.initialHeight ?? 0) * scaleY;
      const pivotY = Math.max(0.85, launchElevY);

      const towerScaleY = Math.max(1.0, (pivotY - 0.14) / 0.86);
      launchTower.scale.set(1, towerScaleY, 1);
      launchTower.position.set(-5.2, 0.43 * towerScaleY, 0);
      yokeFront.position.set(-5.2, pivotY, 0.44);
      yokeBack.position.set(-5.2, pivotY, -0.44);
      cannonQuadrant.position.set(-5.2, pivotY, -0.48);
      cannonPivot.position.set(-5.2, pivotY, 0);
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

      // Golden apex marker ring at exact theoretical peak (t_apex = v0*sin(theta)/g)
      const gSafe = Math.max(0.1, p.gravity || 9.81);
      const tApex = Math.max(
        0,
        Math.min(flightT, (p.initialVelocity * Math.sin((p.launchAngle * Math.PI) / 180)) / gSafe)
      );
      const apexInst = evaluateKinematicsAtTime(p, tApex);
      apexMarker.position.set(
        -5.2 + apexInst.positionX * scaleX,
        0.25 + apexInst.positionY * scaleY,
        0
      );
      apexMarker.rotation.y = nowSec * 1.8;

      const loopT = t % Math.max(1.5, flightT + 0.35);
      const loopInst = evaluateKinematicsAtTime(p, Math.min(loopT, flightT));
      const curX = -5.2 + loopInst.positionX * scaleX;
      const curY = 0.25 + loopInst.positionY * scaleY;
      projectileBall.position.set(curX, curY, 0);
      projectileMotionTrail.pushSample(projectileBall.position);
      targetRing.position.set(-5.2 + m.projectileRange * scaleX, 0.03, 0);

      if (showVec) {
        _arrowOrigin.set(curX, curY, 0);
        const vxLen = Math.min(1.85, Math.abs(loopInst.velocityX) * 0.065);
        if (vxLen > 0.06) {
          _arrowDir.set(loopInst.velocityX >= 0 ? 1 : -1, 0, 0);
          orientAndScaleArrow(projVxArrow, _arrowOrigin, _arrowDir, vxLen);
        } else {
          projVxArrow.visible = false;
        }
        const vyLen = Math.min(1.85, Math.abs(loopInst.velocityY) * 0.065);
        if (vyLen > 0.06) {
          _arrowDir.set(0, loopInst.velocityY >= 0 ? 1 : -1, 0);
          orientAndScaleArrow(projVyArrow, _arrowOrigin, _arrowDir, vyLen);
        } else {
          projVyArrow.visible = false;
        }
      } else {
        projVxArrow.visible = false;
        projVyArrow.visible = false;
      }

      if (followCamEnabled && !camTransitionActive && !isDragging) {
        const followTargetX = THREE.MathUtils.clamp(curX * 0.45, -3.2, 3.8);
        const followTargetY = THREE.MathUtils.clamp(Math.max(1.2, curY * 0.55), 1.1, 4.2);
        controlsTarget.x = THREE.MathUtils.lerp(controlsTarget.x, followTargetX, 0.08);
        controlsTarget.y = THREE.MathUtils.lerp(controlsTarget.y, followTargetY, 0.08);
      }
    } else if (p.mode === 'spring-hooke') {
      const spState = computeSpringVisualKinematics(p, t);
      const liveX = spState.displacementM;
      const massX = 0.5 + liveX * 2.1;
      const blockY = 0.21 + 0.66 * spState.blockScale;
      springMassBlock.scale.setScalar(spState.blockScale);
      springMassBlock.position.set(massX, blockY, 0);

      // Update continuous 3D helical spring wire segments with coil stiffness thickness ∝ sqrt(k)
      const startX = -4.92;
      const endX = massX - 0.72 * spState.blockScale;
      const span = Math.max(0.6, endX - startX);
      const turns = 11.0;
      const coilR = 0.34;
      const wireRatio = spState.coilWireRadius / 0.046;
      const anchorY = 0.87;
      for (let i = 0; i < HELIX_SEGMENTS; i++) {
        const u0 = i / HELIX_SEGMENTS;
        const u1 = (i + 1) / HELIX_SEGMENTS;
        const taper0 = Math.min(1, u0 * 14, (1 - u0) * 14);
        const taper1 = Math.min(1, u1 * 14, (1 - u1) * 14);
        const a0 = u0 * turns * Math.PI * 2;
        const a1 = u1 * turns * Math.PI * 2;
        const midY0 = anchorY + (blockY - anchorY) * u0;
        const midY1 = anchorY + (blockY - anchorY) * u1;
        _hxP0.set(startX + u0 * span, midY0 + Math.sin(a0) * coilR * taper0, Math.cos(a0) * coilR * taper0);
        _hxP1.set(startX + u1 * span, midY1 + Math.sin(a1) * coilR * taper1, Math.cos(a1) * coilR * taper1);
        _hxMid.addVectors(_hxP0, _hxP1).multiplyScalar(0.5);
        _hxDir.subVectors(_hxP1, _hxP0);
        const segLen = Math.max(0.01, _hxDir.length());
        _hxDir.multiplyScalar(1 / segLen);
        _hxQuat.setFromUnitVectors(_hxYAxis, _hxDir);
        _hxScale.set(wireRatio, segLen * 1.06, wireRatio);
        _hxMat4.compose(_hxMid, _hxQuat, _hxScale);
        helixInstanced.setMatrixAt(i, _hxMat4);
      }
      helixInstanced.instanceMatrix.needsUpdate = true;

      if (showVec && Math.abs(spState.restoringForceN) > 0.05) {
        _arrowOrigin.set(massX, blockY + 0.88 * spState.blockScale, 0);
        _arrowDir.set(spState.restoringForceN >= 0 ? 1 : -1, 0, 0);
        orientAndScaleArrow(
          springForceArrow,
          _arrowOrigin,
          _arrowDir,
          Math.min(2.4, Math.max(0.28, Math.abs(spState.restoringForceN) / 55))
        );
      } else {
        springForceArrow.visible = false;
      }
    } else if (p.mode === 'pendulum-harmonic') {
      const L = Math.max(0.3, p.pendulumLength ?? 1.2);
      const visualLen = L * 1.5;
      const maxAngleRad = ((p.pendulumAngle ?? 25) * Math.PI) / 180;
      const pendState = computePendulumVisualKinematics(p, t);
      const thetaRad = pendState.angleRad;
      pendPivotGroup.rotation.z = thetaRad;
      pendRod.scale.set(1, visualLen, 1);
      pendRod.position.set(0, -visualLen * 0.5, 0);
      pendBob.scale.setScalar(pendState.bobRadiusScale);
      pendBob.position.set(0, -visualLen, 0);
      pendBob.getWorldPosition(pendBobWorldPos);
      pendulumMotionTrail.pushSample(pendBobWorldPos);

      // Update dashed swing sweep arc across [-maxAngleRad, +maxAngleRad]
      const arcAttr = arcGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < ARC_SAMPLES; i++) {
        const u = i / (ARC_SAMPLES - 1);
        const a = -maxAngleRad + u * maxAngleRad * 2;
        arcAttr.setXYZ(i, 0.6 + Math.sin(a) * visualLen, 4.2 - Math.cos(a) * visualLen, 0);
      }
      arcAttr.needsUpdate = true;
      arcLine.computeLineDistances();

      if (showVec) {
        const weightLen = Math.min(1.9, Math.max(0.45, pendState.weightForceN * 0.045));
        orientAndScaleArrow(pendGravityArrow, pendBobWorldPos, _downUnit, weightLen);

        // Restoring tangential force F_t = -m·g·sin θ
        const restoreLen = Math.min(1.75, Math.abs(pendState.restoringForceN) * 0.06);
        if (restoreLen > 0.06) {
          const restoreSign = pendState.restoringForceN >= 0 ? 1 : -1;
          _arrowDir.set(Math.cos(thetaRad) * restoreSign, Math.sin(thetaRad) * restoreSign, 0);
          orientAndScaleArrow(pendRestoringArrow, pendBobWorldPos, _arrowDir, restoreLen);
        } else {
          pendRestoringArrow.visible = false;
        }

        // Rod tension T = m·g·cos θ + m·v²/L pointing from bob directly toward pivot (0.6, 4.2, 0)
        _arrowDir.set(0.6 - pendBobWorldPos.x, 4.2 - pendBobWorldPos.y, 0).normalize();
        const tensionLen = Math.min(2.0, Math.max(0.4, pendState.tensionForceN * 0.045));
        orientAndScaleArrow(pendTensionArrow, pendBobWorldPos, _arrowDir, tensionLen);
      } else {
        pendGravityArrow.visible = false;
        pendRestoringArrow.visible = false;
        pendTensionArrow.visible = false;
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
        particleScale,
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
    _reusableConceptEntries[0].dom = cDom.c1;
    _reusableConceptEntries[1].dom = cDom.c2;
    _reusableConceptEntries[2].dom = cDom.c3;
    _reusableConceptEntries[3].dom = cDom.c4;
    _reusableConceptEntries[0].active = false;
    _reusableConceptEntries[1].active = false;
    _reusableConceptEntries[2].active = false;
    _reusableConceptEntries[3].active = false;

    if (!activeLabels) return _reusableConceptEntries;

    if (inclineGroup.visible) {
      massBox.getWorldPosition(conceptBlockWorldPos);
      _reusableConceptEntries[0].worldPos.set(conceptBlockWorldPos.x, conceptBlockWorldPos.y + 1.38, conceptBlockWorldPos.z);
      _reusableConceptEntries[0].text = `ΣF = ${curM.netForce.toFixed(1)} N · a = ${curM.acceleration.toFixed(2)} m/s²`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[1].worldPos.set(conceptBlockWorldPos.x - 0.9, conceptBlockWorldPos.y + 0.35, conceptBlockWorldPos.z);
      _reusableConceptEntries[1].text = `${curM.isMoving ? 'Gesek fₖ' : 'Statis fₛ'} = ${Math.abs(curM.frictionForce).toFixed(1)} N`;
      _reusableConceptEntries[1].active = true;

      _reusableConceptEntries[2].worldPos.set(conceptBlockWorldPos.x + 0.75, conceptBlockWorldPos.y + 0.9, conceptBlockWorldPos.z);
      _reusableConceptEntries[2].text = `Normal N = ${curM.normalForce.toFixed(1)} N`;
      _reusableConceptEntries[2].active = true;

      _reusableConceptEntries[3].worldPos.set(conceptBlockWorldPos.x + 0.4, conceptBlockWorldPos.y - 0.75, conceptBlockWorldPos.z);
      _reusableConceptEntries[3].text = `W = ${curM.weightForce.toFixed(1)} N · mg sinθ = ${curM.gravityParallel.toFixed(1)} N`;
      _reusableConceptEntries[3].active = true;
    } else if (curM.mode === 'pendulum-harmonic') {
      pendPivotGroup.getWorldPosition(conceptPivotWorldPos);
      pendBob.getWorldPosition(pendBobWorldPos);
      _reusableConceptEntries[0].worldPos.set(conceptPivotWorldPos.x - 0.45, conceptPivotWorldPos.y - 0.35, conceptPivotWorldPos.z);
      _reusableConceptEntries[0].text = `Panjang Tali L = ${(curP.pendulumLength ?? 1.2).toFixed(2)} m`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[2].worldPos.set(pendBobWorldPos.x + 0.55, pendBobWorldPos.y + 0.25, pendBobWorldPos.z);
      _reusableConceptEntries[2].text = `Periode T = ${curM.pendulumPeriod.toFixed(2)} s · Tegangan T`;
      _reusableConceptEntries[2].active = true;

      _reusableConceptEntries[3].worldPos.set(pendBobWorldPos.x, pendBobWorldPos.y - 0.65, pendBobWorldPos.z);
      _reusableConceptEntries[3].text = `Berat W = ${(curP.mass * curP.gravity).toFixed(1)} N (g=${curP.gravity.toFixed(1)})`;
      _reusableConceptEntries[3].active = true;
    } else if (curM.mode === 'spring-hooke') {
      const sp = springMassBlock.position;
      _reusableConceptEntries[2].worldPos.set(sp.x, sp.y + 1.35, sp.z);
      _reusableConceptEntries[2].text = `Gaya Pegas Fₚ = -k·x · k = ${curP.springConstantK} N/m`;
      _reusableConceptEntries[2].active = true;

      _reusableConceptEntries[0].worldPos.set(sp.x, sp.y + 0.5, sp.z);
      _reusableConceptEntries[0].text = `Massa m = ${curP.mass.toFixed(1)} kg · Ep = ${curM.springPotentialEnergy.toFixed(1)} J`;
      _reusableConceptEntries[0].active = true;
    } else if (curM.mode === 'projectile-gravity') {
      const bp = projectileBall.position;
      const tp = targetRing.position;
      const ap = apexMarker.position;
      _reusableConceptEntries[0].worldPos.set(bp.x, bp.y + 0.55, bp.z);
      _reusableConceptEntries[0].text = `v₀ = ${curP.initialVelocity} m/s · θ = ${curP.launchAngle}°`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[1].worldPos.set(ap.x, ap.y + 0.45, ap.z);
      _reusableConceptEntries[1].text = `Puncak H = ${curM.maxProjectileHeight.toFixed(1)} m`;
      _reusableConceptEntries[1].active = true;

      _reusableConceptEntries[2].worldPos.set(tp.x, tp.y + 0.45, tp.z);
      _reusableConceptEntries[2].text = `Jangkauan R = ${curM.projectileRange.toFixed(1)} m`;
      _reusableConceptEntries[2].active = true;
    } else if (curM.mode === 'collision-momentum') {
      const p1 = cart1Mesh.position;
      const p2 = cart2Mesh.position;
      _reusableConceptEntries[0].worldPos.set(p1.x, p1.y + 1.0, p1.z);
      _reusableConceptEntries[0].text = `Momentum p₁ = ${(curP.mass * curM.v1Final).toFixed(1)} kg·m/s`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[1].worldPos.set(p2.x, p2.y + 1.0, p2.z);
      _reusableConceptEntries[1].text = `Momentum p₂ = ${((curP.collisionMass2 || 2) * curM.v2Final).toFixed(1)} kg·m/s`;
      _reusableConceptEntries[1].active = true;
    } else if (curM.mode === 'stokes-viscosity') {
      const sp = stokesSphere.position;
      _reusableConceptEntries[0].worldPos.set(sp.x, sp.y + 0.75, sp.z);
      _reusableConceptEntries[0].text = `Gaya Hambat Stokes ↑ · vₜ = ${curM.stokesTerminalVelocity.toFixed(2)} m/s`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[3].worldPos.set(sp.x, sp.y - 0.75, sp.z);
      _reusableConceptEntries[3].text = 'Gaya Berat Bola ↓';
      _reusableConceptEntries[3].active = true;
    } else if (curM.mode === 'ohm-wheatstone') {
      _reusableConceptEntries[0].worldPos.set(0, 1.0, 0);
      _reusableConceptEntries[0].text = `Galvanometer I_g = ${curM.galvanometerCurrent.toFixed(2)} mA`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[1].worldPos.set(1.4, 0.9, -0.8);
      _reusableConceptEntries[1].text = `Resistor Uji Rx = ${curP.resistorRx ?? 100} Ω`;
      _reusableConceptEntries[1].active = true;
    } else if (curM.mode === 'optics-young-slit') {
      _reusableConceptEntries[0].worldPos.set(-1.2, 2.3, 0);
      _reusableConceptEntries[0].text = `Celah Ganda d = ${(curP.slitDistance ?? 0.2).toFixed(2)} mm`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[2].worldPos.set(3.8, 2.9, 0);
      _reusableConceptEntries[2].text = `Jarak Frinji Δy = ${curM.fringeSpacingMm.toFixed(2)} mm`;
      _reusableConceptEntries[2].active = true;
    } else if (curM.mode === 'photoelectric-planck') {
      _reusableConceptEntries[0].worldPos.set(-1.1, 2.7, 0);
      _reusableConceptEntries[0].text = `Katoda Logam (W₀ = ${(curP.targetMetalWorkFunction ?? 2.3).toFixed(1)} eV)`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[2].worldPos.set(0.4, 2.3, 0);
      _reusableConceptEntries[2].text = `Ek Maks = ${curM.photoelectricMaxKe.toFixed(2)} eV`;
      _reusableConceptEntries[2].active = true;
    } else if (curM.mode === 'orbital-gravity') {
      const sat = satelliteBody.position;
      _reusableConceptEntries[2].worldPos.set(sat.x, sat.y + 0.75, sat.z);
      _reusableConceptEntries[2].text = 'Gaya Gravitasi F_G ∝ 1/r²';
      _reusableConceptEntries[2].active = true;
    } else if (curM.mode === 'standing-wave-melde') {
      meldeHangingMass.getWorldPosition(conceptBlockWorldPos);
      _reusableConceptEntries[0].worldPos.set(-3.8, 2.05, 0);
      _reusableConceptEntries[0].text = `Vibrator f = ${(curP.waveFrequency ?? 50).toFixed(0)} Hz`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[2].worldPos.set(0, 2.15, 0);
      _reusableConceptEntries[2].text = `Gelombang Berdiri · v = ${curM.meldeWaveSpeed.toFixed(1)} m/s · λ = ${curM.meldeWavelength.toFixed(2)} m`;
      _reusableConceptEntries[2].active = true;

      _reusableConceptEntries[3].worldPos.set(conceptBlockWorldPos.x, conceptBlockWorldPos.y + 0.65, conceptBlockWorldPos.z);
      _reusableConceptEntries[3].text = `Tegangan Tali F = ${curM.meldeTensionForce.toFixed(2)} N`;
      _reusableConceptEntries[3].active = true;
    } else if (curM.mode === 'faraday-induction') {
      _reusableConceptEntries[0].worldPos.set(-2.15, 2.25, 0);
      _reusableConceptEntries[0].text = `Magnet B = ${(curP.magneticFieldTesla ?? 0.45).toFixed(2)} T · f = ${(curP.magnetOscillationHz ?? 1.2).toFixed(1)} Hz`;
      _reusableConceptEntries[0].active = true;

      _reusableConceptEntries[2].worldPos.set(-0.65, 2.55, 0);
      _reusableConceptEntries[2].text = `Solenoida N = ${curP.coilTurnsN ?? 120} · εₘₐₓ = ${curM.faradayPeakEmfV.toFixed(2)} V`;
      _reusableConceptEntries[2].active = true;

      _reusableConceptEntries[3].worldPos.set(2.75, 1.75, 0.35);
      _reusableConceptEntries[3].text = `Iₘₐₓ = ${curM.faradayPeakCurrentMa.toFixed(1)} mA · P = ${curM.faradayAvgPowerW.toFixed(2)} W`;
      _reusableConceptEntries[3].active = true;
    }

    return _reusableConceptEntries;
  };

  return {
    pendBobWorldPos,
    playCannonLaunchSound: () => cannonSoundEmitter.play(),
    update,
    buildConceptEntries,
    dispose: () => {
      metalTex?.dispose();
      threadedTex?.dispose();
      rampScaleTex?.dispose();
      airTrackScaleTex?.dispose();
      specialRigs.dispose();
    },
  };
}
