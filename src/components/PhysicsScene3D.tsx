import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  PhysicsParams,
  PhysicsMetrics,
  KinematicsInstant,
  evaluateKinematicsAtTime,
} from '../utils/scienceEngine';
import { SimulationFrame } from '../utils/simulationBuffer';
import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';

interface PhysicsScene3DProps {
  params: PhysicsParams;
  metrics: PhysicsMetrics;
  instant: KinematicsInstant;
  simTime: number;
  showVectorOverlay: boolean;
  simFrame?: SimulationFrame | null;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
}

type CameraPreset = 'isometric' | 'front' | 'top' | 'focus';

function createArrowGroup(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.2,
    emissive: colorHex,
    emissiveIntensity: 0.22,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 12);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.name = 'shaft';

  const headGeo = new THREE.ConeGeometry(0.16, 0.36, 14);
  headGeo.translate(0, 0.18, 0);
  const head = new THREE.Mesh(headGeo, mat);
  head.name = 'head';

  group.add(shaft, head);
  return group;
}

function orientAndScaleArrow(
  arrow: THREE.Group,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number
) {
  if (length < 0.08 || dir.lengthSq() < 1e-6) {
    arrow.visible = false;
    return;
  }
  arrow.visible = true;
  arrow.position.copy(origin);
  const normDir = dir.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normDir
  );
  arrow.quaternion.copy(quat);

  const shaftLen = Math.max(0.1, length - 0.34);
  const shaft = arrow.getObjectByName('shaft') as THREE.Mesh;
  const head = arrow.getObjectByName('head') as THREE.Mesh;
  if (shaft) {
    shaft.scale.set(1, shaftLen, 1);
  }
  if (head) {
    head.position.set(0, shaftLen, 0);
  }
}

export const PhysicsScene3D: React.FC<PhysicsScene3DProps> = ({
  params,
  metrics,
  instant,
  simTime,
  showVectorOverlay,
  simFrame,
  remoteCursors,
  onEmitCursor,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');

  const latestRef = useRef({
    params,
    metrics,
    instant,
    simTime,
    showVectorOverlay,
    simFrame,
    remoteCursors,
    onEmitCursor,
  });
  latestRef.current = {
    params,
    metrics,
    instant,
    simTime,
    showVectorOverlay,
    simFrame,
    remoteCursors,
    onEmitCursor,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glRenderer);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.018);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 250);
    camera.position.set(0, 6.2, 13.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.4, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 4;
    controls.maxDistance = 38;

    const applyCameraPreset = (preset: CameraPreset) => {
      if (preset === 'isometric') {
        camera.position.set(4.8, 6.2, 12.8);
        controls.target.set(0, 1.4, 0);
      } else if (preset === 'front') {
        camera.position.set(0, 2.6, 14.2);
        controls.target.set(0, 1.5, 0);
      } else if (preset === 'top') {
        camera.position.set(0, 16.5, 0.8);
        controls.target.set(0, 0, 0);
      } else {
        camera.position.set(1.8, 3.4, 8.2);
        controls.target.set(0, 1.6, 0);
      }
      controls.update();
    };
    cameraCtrlRef.current = { setPreset: applyCameraPreset };
    applyCameraPreset('isometric');

    // Studio 3-Point Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(8, 14, 9);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    const d = 12;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-9, 6, -8);
    scene.add(rimLight);

    // Laboratory Floor & Calibration Grid
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.name = 'Lantai Laboratorium';
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(32, 32, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Phase 3: Collaborative 3D Laser Pointer Manager
    const cursorManager = new SpatialCursorManager(scene);

    // Shared PBR Materials
    const brushedSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.82,
      roughness: 0.25,
    });
    const darkFrameMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.55,
      roughness: 0.4,
    });
    const primaryMassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.35,
      roughness: 0.25,
    });
    const secondaryMassMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.35,
      roughness: 0.28,
    });
    const gravitySecondaryMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      metalness: 0.4,
      roughness: 0.25,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.78,
      roughness: 0.24,
    });

    // =========================================================
    // 1. NEWTON INCLINE 3D GROUP
    // =========================================================
    const inclineGroup = new THREE.Group();
    scene.add(inclineGroup);

    const basePedestal = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.24, 2.6),
      darkFrameMat
    );
    basePedestal.position.set(0, 0.12, 0);
    basePedestal.receiveShadow = true;
    inclineGroup.add(basePedestal);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(-4.6, 0.24, 0);
    inclineGroup.add(pivotGroup);

    const rampBoard = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.22, 2.1),
      brushedSteelMat
    );
    rampBoard.position.set(4.6, -0.11, 0);
    rampBoard.castShadow = true;
    rampBoard.receiveShadow = true;
    pivotGroup.add(rampBoard);

    // Side rails along the ramp
    const railGeo = new THREE.BoxGeometry(9.2, 0.12, 0.08);
    const railFront = new THREE.Mesh(railGeo, darkFrameMat);
    railFront.position.set(4.6, 0.06, 1.0);
    const railBack = new THREE.Mesh(railGeo, darkFrameMat);
    railBack.position.set(4.6, 0.06, -1.0);
    pivotGroup.add(railFront, railBack);

    // Pulley at top of ramp
    const pulleyWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.16, 20),
      brassMat
    );
    pulleyWheel.rotation.x = Math.PI / 2;
    pulleyWheel.position.set(9.35, 0.25, 0);
    pivotGroup.add(pulleyWheel);

    // Sliding Mass Block Group on Ramp
    const blockGroup = new THREE.Group();
    pivotGroup.add(blockGroup);

    const massBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.78, 1.15),
      primaryMassMat
    );
    massBox.position.set(0, 0.39, 0);
    massBox.castShadow = true;
    blockGroup.add(massBox);

    const hookRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.035, 10, 20),
      brassMat
    );
    hookRing.position.set(0.62, 0.39, 0);
    blockGroup.add(hookRing);

    // 4 Force Vector Arrows on Block
    const arrowApplied = createArrowGroup(0x10b981); // Emerald F
    const arrowFriction = createArrowGroup(0xf59e0b); // Amber fk
    const arrowNormal = createArrowGroup(0x38bdf8); // Sky N
    const arrowWeight = createArrowGroup(0xf43f5e); // Rose W
    blockGroup.add(arrowApplied, arrowFriction, arrowNormal, arrowWeight);

    // Hydraulic Support Strut under Ramp
    const supportPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1, 16),
      brushedSteelMat
    );
    supportPillar.position.set(3.2, 0.5, 0);
    inclineGroup.add(supportPillar);

    // =========================================================
    // 2. PROJECTILE GRAVITY 3D GROUP
    // =========================================================
    const projectileGroup = new THREE.Group();
    scene.add(projectileGroup);

    const launchTower = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1, 1.2),
      darkFrameMat
    );
    launchTower.position.set(-5.2, 0.5, 0);
    projectileGroup.add(launchTower);

    const cannonPivot = new THREE.Group();
    cannonPivot.position.set(-5.2, 1.0, 0);
    projectileGroup.add(cannonPivot);

    const cannonBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 1.35, 20),
      brushedSteelMat
    );
    cannonBarrel.rotation.z = -Math.PI / 2;
    cannonBarrel.position.set(0.55, 0, 0);
    cannonPivot.add(cannonBarrel);

    const cannonBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 18),
      brassMat
    );
    cannonPivot.add(cannonBase);

    const projectileBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.3,
        roughness: 0.2,
        emissive: 0x0284c7,
        emissiveIntensity: 0.25,
      })
    );
    projectileBall.castShadow = true;
    projectileGroup.add(projectileBall);

    const projVelXArrow = createArrowGroup(0x10b981);
    const projVelYArrow = createArrowGroup(0xf59e0b);
    projectileGroup.add(projVelXArrow, projVelYArrow);

    const trajLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    const trajPoints = Array.from(
      { length: 61 },
      () => new THREE.Vector3(0, 0, 0)
    );
    const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPoints);
    const trajLine = new THREE.Line(trajGeo, trajLineMat);
    projectileGroup.add(trajLine);

    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.55, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        side: THREE.DoubleSide,
      })
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.y = 0.03;
    projectileGroup.add(targetRing);

    // =========================================================
    // 3. ORBITAL / UNIVERSAL GRAVITY 3D GROUP
    // =========================================================
    const gravityGroup = new THREE.Group();
    scene.add(gravityGroup);

    const gravSphere1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 28, 28),
      primaryMassMat
    );
    gravSphere1.castShadow = true;
    const gravSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 28, 28),
      gravitySecondaryMat
    );
    gravSphere2.castShadow = true;
    gravityGroup.add(gravSphere1, gravSphere2);

    const gravRing1 = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.18, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      })
    );
    gravRing1.rotation.x = Math.PI / 2;
    gravSphere1.add(gravRing1);

    const gravRing2 = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.42, 32),
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      })
    );
    gravRing2.rotation.x = Math.PI / 2;
    gravSphere2.add(gravRing2);

    const gravArrow1 = createArrowGroup(0x10b981);
    const gravArrow2 = createArrowGroup(0xf59e0b);
    gravityGroup.add(gravArrow1, gravArrow2);

    const tetherRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1, 10),
      new THREE.MeshBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.5,
      })
    );
    tetherRod.rotation.z = Math.PI / 2;
    gravityGroup.add(tetherRod);

    // =========================================================
    // 4. COLLISION & MOMENTUM 3D AIR-TRACK GROUP
    // =========================================================
    const collisionGroup = new THREE.Group();
    scene.add(collisionGroup);

    const airTrackBeam = new THREE.Mesh(
      new THREE.BoxGeometry(13.5, 0.32, 1.3),
      brushedSteelMat
    );
    airTrackBeam.position.set(0, 0.65, 0);
    airTrackBeam.receiveShadow = true;
    collisionGroup.add(airTrackBeam);

    const legLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.65, 1.4),
      darkFrameMat
    );
    legLeft.position.set(-5.8, 0.325, 0);
    const legRight = legLeft.clone();
    legRight.position.set(5.8, 0.325, 0);
    collisionGroup.add(legLeft, legRight);

    const colSphere1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 28, 28),
      primaryMassMat
    );
    colSphere1.castShadow = true;
    const colSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 28, 28),
      secondaryMassMat
    );
    colSphere2.castShadow = true;
    collisionGroup.add(colSphere1, colSphere2);

    const colVel1Arrow = createArrowGroup(0x38bdf8);
    const colVel2Arrow = createArrowGroup(0xf59e0b);
    collisionGroup.add(colVel1Arrow, colVel2Arrow);

    const impactFlashRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.05, 12, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0,
      })
    );
    impactFlashRing.rotation.y = Math.PI / 2;
    impactFlashRing.position.set(0, 1.45, 0);
    collisionGroup.add(impactFlashRing);

    // =========================================================
    // 5. SPRING HOOKE HARMONIC OSCILLATOR 3D GROUP
    // =========================================================
    const springGroup = new THREE.Group();
    scene.add(springGroup);

    const anchorWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 2.8, 2.6),
      darkFrameMat
    );
    anchorWall.position.set(-5.2, 1.4, 0);
    anchorWall.castShadow = true;
    springGroup.add(anchorWall);

    const guideTrack = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.22, 2.2),
      brushedSteelMat
    );
    guideTrack.position.set(0.5, 0.11, 0);
    guideTrack.receiveShadow = true;
    springGroup.add(guideTrack);

    // Equilibrium marker plane at x = 0.5
    const eqMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 2.3),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    eqMarker.position.set(0.5, 0.24, 0);
    springGroup.add(eqMarker);

    // Helix coil spring built from 50 segments along X
    const COIL_POINTS = 96;
    const coilPositions = new Float32Array(COIL_POINTS * 3);
    const coilGeo = new THREE.BufferGeometry();
    coilGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(coilPositions, 3)
    );
    const coilLine = new THREE.Line(
      coilGeo,
      new THREE.LineBasicMaterial({ color: 0xe2e8f0 })
    );
    springGroup.add(coilLine);

    // Also add 12 torus rings along the spring length for a solid 3D metallic spring look
    const springRings: THREE.Mesh[] = [];
    const springRingGeo = new THREE.TorusGeometry(0.38, 0.055, 10, 20);
    springRingGeo.rotateY(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const rMesh = new THREE.Mesh(springRingGeo, brushedSteelMat);
      springRings.push(rMesh);
      springGroup.add(rMesh);
    }

    const springMassBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.3, 1.3),
      primaryMassMat
    );
    springMassBlock.castShadow = true;
    springGroup.add(springMassBlock);

    const springForceArrow = createArrowGroup(0xf43f5e);
    const springVelArrow = createArrowGroup(0x10b981);
    springGroup.add(springForceArrow, springVelArrow);

    // =========================================================
    // RENDER & UPDATE LOOP WITH SOFTWARE-GL FENCE PACING
    // =========================================================
    let disposed = false;
    let rafId = 0;

    function afterDraw(cb: () => void) {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        if (!sync) {
          setTimeout(cb, 80);
          return;
        }
        const status = gl.clientWaitSync(sync, 0, 0);
        if (
          status === gl.ALREADY_SIGNALED ||
          status === gl.CONDITION_SATISFIED
        ) {
          gl.deleteSync(sync);
          setTimeout(cb, 80);
        } else {
          setTimeout(poll, 16);
        }
      };
      setTimeout(poll, 16);
    }

    const tick = () => {
      if (disposed) return;

      const {
        params: p,
        metrics: m,
        instant: inst,
        simTime: t,
        showVectorOverlay: showVec,
      } = latestRef.current;

      inclineGroup.visible = p.mode === 'newton-incline';
      projectileGroup.visible = p.mode === 'projectile-gravity';
      gravityGroup.visible = p.mode === 'orbital-gravity';
      collisionGroup.visible = p.mode === 'collision-momentum';
      springGroup.visible = p.mode === 'spring-hooke';

      if (p.mode === 'newton-incline') {
        const thetaRad = (p.inclineAngle * Math.PI) / 180;
        pivotGroup.rotation.z = thetaRad;

        const strutX = 3.2;
        const distFromPivot = strutX - -4.6;
        const strutH = Math.max(0.15, distFromPivot * Math.tan(thetaRad));
        supportPillar.scale.set(1, strutH, 1);
        supportPillar.position.set(strutX, 0.24 + strutH / 2, 0);
        supportPillar.visible = p.inclineAngle > 1;

        const rawDisp =
          p.initialVelocity * t + 0.5 * m.acceleration * t * t;
        const clampedDisp = Math.max(-1.2, Math.min(28, rawDisp));
        const rampPos = 1.6 + clampedDisp * 0.22;
        blockGroup.position.set(rampPos, 0, 0);

        const scaleFactor = Math.max(
          0.75,
          Math.min(1.35, 0.8 + p.mass * 0.018)
        );
        massBox.scale.set(scaleFactor, scaleFactor, scaleFactor);
        massBox.position.y = 0.39 * scaleFactor;

        if (showVec) {
          const fLen = Math.min(2.6, Math.abs(p.appliedForce) * 0.018);
          orientAndScaleArrow(
            arrowApplied,
            new THREE.Vector3(0, 0.45 * scaleFactor, 0),
            new THREE.Vector3(Math.sign(p.appliedForce || 1), 0, 0),
            Math.abs(p.appliedForce) > 0.5 ? Math.max(0.65, fLen) : 0
          );

          const fkLen = Math.min(2.2, Math.abs(m.frictionForce) * 0.022);
          orientAndScaleArrow(
            arrowFriction,
            new THREE.Vector3(0, 0.15, 0.45),
            new THREE.Vector3(Math.sign(m.frictionForce || -1), 0, 0),
            Math.abs(m.frictionForce) > 0.5 ? Math.max(0.55, fkLen) : 0
          );

          const nLen = Math.min(2.3, Math.max(0.7, m.normalForce * 0.012));
          orientAndScaleArrow(
            arrowNormal,
            new THREE.Vector3(0, 0.78 * scaleFactor, 0),
            new THREE.Vector3(0, 1, 0),
            nLen
          );

          const wLen = Math.min(2.4, Math.max(0.75, m.weightForce * 0.012));
          orientAndScaleArrow(
            arrowWeight,
            new THREE.Vector3(0, 0.2, 0),
            new THREE.Vector3(-Math.sin(thetaRad), -Math.cos(thetaRad), 0),
            wLen
          );
        } else {
          arrowApplied.visible = false;
          arrowFriction.visible = false;
          arrowNormal.visible = false;
          arrowWeight.visible = false;
        }
      } else if (p.mode === 'projectile-gravity') {
        const maxRange = Math.max(35, m.projectileRange * 1.1);
        const maxH = Math.max(18, m.maxProjectileHeight * 1.15);
        const scaleX = 10.4 / maxRange;
        const scaleY = 4.8 / maxH;

        const towerH = Math.max(0.25, p.initialHeight * scaleY);
        launchTower.scale.set(1, towerH, 1);
        launchTower.position.set(-5.2, towerH / 2, 0);
        cannonPivot.position.set(-5.2, towerH + 0.15, 0);
        cannonPivot.rotation.z = (p.launchAngle * Math.PI) / 180;

        // Update 3D trajectory arch points
        const totalT = Math.max(0.5, m.timeOfFlight);
        const posAttr = trajGeo.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        for (let i = 0; i <= 60; i++) {
          const tSample = (i / 60) * totalT;
          const pt = evaluateKinematicsAtTime(p, tSample);
          posAttr.setXYZ(
            i,
            -5.2 + pt.positionX * scaleX,
            0.25 + pt.positionY * scaleY,
            0
          );
        }
        posAttr.needsUpdate = true;

        const curX = -5.2 + inst.positionX * scaleX;
        const curY = 0.25 + inst.positionY * scaleY;
        projectileBall.position.set(curX, curY, 0);
        targetRing.position.set(-5.2 + m.projectileRange * scaleX, 0.03, 0);

        if (showVec) {
          orientAndScaleArrow(
            projVelXArrow,
            new THREE.Vector3(curX, curY, 0),
            new THREE.Vector3(Math.sign(inst.velocityX || 1), 0, 0),
            Math.min(2.2, Math.abs(inst.velocityX) * 0.08)
          );
          orientAndScaleArrow(
            projVelYArrow,
            new THREE.Vector3(curX, curY, 0),
            new THREE.Vector3(0, Math.sign(inst.velocityY || -1), 0),
            Math.min(2.2, Math.abs(inst.velocityY) * 0.08)
          );
        } else {
          projVelXArrow.visible = false;
          projVelYArrow.visible = false;
        }
      } else if (p.mode === 'orbital-gravity') {
        const sep = Math.min(4.8, Math.max(1.5, p.separationDistance * 0.12));
        const r1Scale = Math.min(1.35, Math.max(0.65, 0.6 + p.mass * 0.02));
        const r2Scale = Math.min(
          1.6,
          Math.max(0.8, 0.55 + Math.log10(Math.max(10, p.secondaryMass)) * 0.25)
        );

        gravSphere1.scale.setScalar(r1Scale);
        gravSphere2.scale.setScalar(r2Scale);
        gravSphere1.position.set(-sep, 1.8, 0);
        gravSphere2.position.set(sep, 1.8, 0);

        tetherRod.scale.set(1, sep * 2, 1);
        tetherRod.position.set(0, 1.8, 0);

        if (showVec) {
          const arrowLen = Math.min(
            2.2,
            Math.max(0.75, Math.log10(m.universalGravityForce + 1.2) * 1.1)
          );
          orientAndScaleArrow(
            gravArrow1,
            new THREE.Vector3(-sep + 0.75 * r1Scale, 1.8, 0),
            new THREE.Vector3(1, 0, 0),
            arrowLen
          );
          orientAndScaleArrow(
            gravArrow2,
            new THREE.Vector3(sep - 0.95 * r2Scale, 1.8, 0),
            new THREE.Vector3(-1, 0, 0),
            arrowLen
          );
        } else {
          gravArrow1.visible = false;
          gravArrow2.visible = false;
        }
      } else if (p.mode === 'collision-momentum') {
        const collisionTime = 1.5;
        const dtImpact = t - collisionTime;
        const r1 = Math.min(1.25, Math.max(0.7, 0.65 + p.mass * 0.02));
        const r2 = Math.min(
          1.25,
          Math.max(0.7, 0.65 + p.collisionMass2 * 0.02)
        );
        colSphere1.scale.setScalar(r1);
        colSphere2.scale.setScalar(r2);

        const rad1 = 0.62 * r1;
        const rad2 = 0.62 * r2;
        const speedScale = 0.28;

        let x1 = 0;
        let x2 = 0;
        if (dtImpact <= 0) {
          x1 = -rad1 + p.initialVelocity * dtImpact * speedScale;
          x2 = rad2 + p.velocity2Initial * dtImpact * speedScale;
        } else {
          x1 = -rad1 + m.v1Final * dtImpact * speedScale;
          x2 = rad2 + m.v2Final * dtImpact * speedScale;
        }
        x1 = Math.max(-5.6, Math.min(5.2, x1));
        x2 = Math.max(-5.2, Math.min(5.6, x2));

        const y1 = 0.81 + rad1;
        const y2 = 0.81 + rad2;
        colSphere1.position.set(x1, y1, 0);
        colSphere2.position.set(x2, y2, 0);

        const impactProximity = Math.max(0, 1 - Math.abs(dtImpact) * 4.5);
        (impactFlashRing.material as THREE.MeshBasicMaterial).opacity =
          impactProximity * 0.85;
        impactFlashRing.scale.setScalar(0.6 + (1 - impactProximity) * 0.9);

        if (showVec) {
          const v1Now = dtImpact <= 0 ? p.initialVelocity : m.v1Final;
          const v2Now = dtImpact <= 0 ? p.velocity2Initial : m.v2Final;
          orientAndScaleArrow(
            colVel1Arrow,
            new THREE.Vector3(x1, y1 + rad1 + 0.15, 0),
            new THREE.Vector3(Math.sign(v1Now || 1), 0, 0),
            Math.min(2.4, Math.abs(v1Now) * 0.16)
          );
          orientAndScaleArrow(
            colVel2Arrow,
            new THREE.Vector3(x2, y2 + rad2 + 0.15, 0),
            new THREE.Vector3(Math.sign(v2Now || -1), 0, 0),
            Math.min(2.4, Math.abs(v2Now) * 0.16)
          );
        } else {
          colVel1Arrow.visible = false;
          colVel2Arrow.visible = false;
        }
      } else if (p.mode === 'spring-hooke') {
        const eqX = 0.5;
        const massX = eqX + inst.positionX * 2.1;
        springMassBlock.position.set(massX, 0.87, 0);

        const startX = -4.95;
        const endX = massX - 0.65;
        const span = Math.max(0.8, endX - startX);

        const posAttr = coilGeo.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const turns = 12;
        for (let i = 0; i < COIL_POINTS; i++) {
          const frac = i / (COIL_POINTS - 1);
          const angle = frac * turns * Math.PI * 2;
          const sx = startX + frac * span;
          const sy = 0.87 + 0.36 * Math.sin(angle);
          const sz = 0.36 * Math.cos(angle);
          posAttr.setXYZ(i, sx, sy, sz);
        }
        posAttr.needsUpdate = true;

        springRings.forEach((ring, idx) => {
          const frac = (idx + 0.5) / springRings.length;
          ring.position.set(startX + frac * span, 0.87, 0);
        });

        if (showVec) {
          const fRestoring = -p.springConstantK * inst.positionX;
          orientAndScaleArrow(
            springForceArrow,
            new THREE.Vector3(massX, 1.65, 0),
            new THREE.Vector3(Math.sign(fRestoring || -1), 0, 0),
            Math.min(2.5, Math.abs(fRestoring) * 0.015)
          );
          orientAndScaleArrow(
            springVelArrow,
            new THREE.Vector3(massX, 1.25, 0.72),
            new THREE.Vector3(Math.sign(inst.velocityX || 1), 0, 0),
            Math.min(2.2, Math.abs(inst.velocityX) * 0.25)
          );
        } else {
          springForceArrow.visible = false;
          springVelArrow.visible = false;
        }
      }

      // Update Phase 3 3D laser cursors for remote lab partners
      cursorManager.update(
        latestRef.current.remoteCursors || {},
        camera.position
      );

      controls.update();
      renderer.render(scene, camera);
      afterDraw(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Raycast surface interaction for multiplayer laser pointer
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planeIntersect = new THREE.Vector3();

    const handlePointerMove = (e: PointerEvent) => {
      if (!latestRef.current.onEmitCursor) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);

      const targets: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.visible &&
          obj.name !== 'SpatialLaserCursors' &&
          !obj.name.startsWith('cursor-') &&
          obj.name !== 'shaft' &&
          obj.name !== 'head'
        ) {
          targets.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(targets, false);
      let hitPos: [number, number, number] | null = null;
      let hitNormal: [number, number, number] | undefined = undefined;
      let hoveredName: string | undefined = undefined;

      if (intersects.length > 0) {
        const hit = intersects[0];
        hitPos = [
          Number(hit.point.x.toFixed(3)),
          Number(hit.point.y.toFixed(3)),
          Number(hit.point.z.toFixed(3)),
        ];
        if (hit.face) {
          hitNormal = [
            Number(hit.face.normal.x.toFixed(3)),
            Number(hit.face.normal.y.toFixed(3)),
            Number(hit.face.normal.z.toFixed(3)),
          ];
        }
        if (hit.object.name && hit.object.name !== 'Lantai Laboratorium') {
          hoveredName = hit.object.name;
        } else if (
          hit.object.parent &&
          hit.object.parent.name &&
          !hit.object.parent.name.startsWith('cursor') &&
          hit.object.parent.name !== 'SpatialLaserCursors'
        ) {
          hoveredName = hit.object.parent.name;
        }
      } else {
        const hit = raycaster.ray.intersectPlane(groundPlane, planeIntersect);
        if (hit) {
          hitPos = [Number(hit.x.toFixed(3)), 0.05, Number(hit.z.toFixed(3))];
        }
      }

      if (hitPos) {
        latestRef.current.onEmitCursor(hitPos, hitNormal, hoveredName);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 760;
      const h = container.clientHeight || 380;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      cursorManager.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    cameraCtrlRef.current?.setPreset(preset);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-[#0B1120]">
      <div
        ref={mountRef}
        data-testid="physics-simulation-canvas"
        className="w-full h-[340px] sm:h-[380px] block cursor-grab active:cursor-grabbing"
      />

      {/* Top-Left Live 3D Telemetry Badge (Opaque dark background — no backdrop-blur) */}
      <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-slate-700 bg-[#0F172A] px-3 py-2 text-xs shadow-md">
        <div className="font-mono text-[11px] font-semibold text-sky-400">
          VIEWPORT 3D WEBGL · t = {instant.time.toFixed(2)} s
        </div>
        <div className="mt-0.5 font-mono text-xs font-semibold text-slate-100 tabular-nums">
          v = {instant.speed.toFixed(2)} m/s · a = {instant.acceleration.toFixed(2)} m/s²
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
          Posisi 3D: ({instant.positionX.toFixed(2)} m, {instant.positionY.toFixed(2)} m)
        </div>
      </div>

      {/* Top-Right Vector Legend */}
      {showVectorOverlay && (
        <div className="pointer-events-none absolute top-3 right-3 hidden sm:flex items-center gap-2.5 rounded-md border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 text-[11px] font-mono text-slate-300">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Gaya / vₓ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
            Normal N
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Gesek / vᵧ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
            Berat W / Fp
          </span>
        </div>
      )}

      {/* Collapsible Bottom Camera & Cinema Dock */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10">
        {!hudCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 shadow-lg">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">
              Kamera 3D:
            </span>
            {(
              [
                { id: 'isometric', label: 'Isometrik 3D' },
                { id: 'front', label: 'Tampak Depan' },
                { id: 'top', label: 'Tampak Atas' },
                { id: 'focus', label: 'Fokus Objek' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectCameraPreset(preset.id)}
                className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                  activePreset === preset.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          className="rounded border border-slate-700 bg-[#0F172A] px-2.5 py-0.5 text-[10px] font-mono text-slate-300 hover:text-white shadow"
        >
          {hudCollapsed ? '▴ Tampilkan Kontrol Kamera 3D' : '▾ Sembunyikan HUD'}
        </button>
      </div>
    </div>
  );
};
