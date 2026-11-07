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
import { Maximize2, Minimize2 } from 'lucide-react';
import { labSound } from '../utils/soundEngine';

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
  onUpdateParam?: (paramKey: string, value: number) => void;
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

function wavelengthToHex(wavelengthNm: number): number {
  let r = 0;
  let g = 0;
  let b = 0;
  if (wavelengthNm >= 380 && wavelengthNm < 440) {
    r = -(wavelengthNm - 440) / (440 - 380);
    b = 1;
  } else if (wavelengthNm >= 440 && wavelengthNm < 490) {
    g = (wavelengthNm - 440) / (490 - 440);
    b = 1;
  } else if (wavelengthNm >= 490 && wavelengthNm < 510) {
    g = 1;
    b = -(wavelengthNm - 510) / (510 - 490);
  } else if (wavelengthNm >= 510 && wavelengthNm < 580) {
    r = (wavelengthNm - 510) / (580 - 510);
    g = 1;
  } else if (wavelengthNm >= 580 && wavelengthNm < 645) {
    r = 1;
    g = -(wavelengthNm - 645) / (645 - 580);
  } else if (wavelengthNm >= 645 && wavelengthNm <= 780) {
    r = 1;
  }
  const ir = Math.round(Math.min(255, Math.max(0, r * 255)));
  const ig = Math.round(Math.min(255, Math.max(0, g * 255)));
  const ib = Math.round(Math.min(255, Math.max(0, b * 255)));
  return (ir << 16) | (ig << 8) | ib;
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
  onUpdateParam,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);

  const latestRef = useRef({
    params,
    metrics,
    instant,
    simTime,
    showVectorOverlay,
    simFrame,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
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
    onUpdateParam,
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

    // Floor & Calibration Grid
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

    // Collaborative 3D Laser Pointer Manager
    const cursorManager = new SpatialCursorManager(scene);

    // Shared Materials
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
    rampBoard.userData = { draggableParam: 'inclineAngle', min: 0, max: 60, step: 1, label: 'Kemiringan θ' };
    pivotGroup.add(rampBoard);

    const railGeo = new THREE.BoxGeometry(9.2, 0.12, 0.08);
    const railFront = new THREE.Mesh(railGeo, darkFrameMat);
    railFront.position.set(4.6, 0.06, 1.0);
    const railBack = new THREE.Mesh(railGeo, darkFrameMat);
    railBack.position.set(4.6, 0.06, -1.0);
    pivotGroup.add(railFront, railBack);

    const blockGroup = new THREE.Group();
    pivotGroup.add(blockGroup);

    const massBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.78, 1.15),
      primaryMassMat
    );
    massBox.position.set(0, 0.39, 0);
    massBox.castShadow = true;
    massBox.userData = { draggableParam: 'appliedForce', min: -100, max: 200, step: 5, label: 'Gaya Dorong F' };
    blockGroup.add(massBox);

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
      new THREE.CylinderGeometry(0.24, 0.32, 1.6, 18),
      brushedSteelMat
    );
    cannonBarrel.rotation.z = -Math.PI / 2;
    cannonBarrel.position.set(0.8, 0, 0);
    cannonBarrel.userData = { draggableParam: 'launchAngle', min: 10, max: 85, step: 1, label: 'Sudut Elevasi θ' };
    cannonPivot.add(cannonBarrel);

    const projectileBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 })
    );
    projectileBall.userData = { draggableParam: 'initialVelocity', min: 5, max: 50, step: 1, label: 'Kecepatan Awal v₀' };
    projectileGroup.add(projectileBall);

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

    // =========================================================
    // 3. SPRING HOOKE 3D GROUP
    // =========================================================
    const springGroup = new THREE.Group();
    scene.add(springGroup);

    const springWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 2.5, 2.5),
      darkFrameMat
    );
    springWall.position.set(-5.2, 1.25, 0);
    springGroup.add(springWall);

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
      springRings.push(rMesh);
      springGroup.add(rMesh);
    }

    const springMassBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.3, 1.3),
      primaryMassMat
    );
    springMassBlock.userData = { draggableParam: 'springDisplacement', min: -2.0, max: 2.0, step: 0.1, label: 'Simpangan x' };
    springGroup.add(springMassBlock);

    // =========================================================
    // 4. PENDULUM HARMONIC 3D GROUP
    // =========================================================
    const pendulumGroup = new THREE.Group();
    scene.add(pendulumGroup);

    const pendStandBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.2, 2.4),
      darkFrameMat
    );
    pendStandBase.position.set(0, 0.1, 0);
    pendulumGroup.add(pendStandBase);

    const pendVerticalPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.2, 16),
      brushedSteelMat
    );
    pendVerticalPillar.position.set(-0.8, 2.2, 0);
    pendulumGroup.add(pendVerticalPillar);

    const pendHorizontalArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.8, 16),
      brushedSteelMat
    );
    pendHorizontalArm.rotation.z = Math.PI / 2;
    pendHorizontalArm.position.set(0, 4.2, 0);
    pendulumGroup.add(pendHorizontalArm);

    // Pivot mount
    const pendPivotGroup = new THREE.Group();
    pendPivotGroup.position.set(0.6, 4.2, 0);
    pendulumGroup.add(pendPivotGroup);

    const pendRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
    );
    pendRod.position.set(0, -0.5, 0);
    pendPivotGroup.add(pendRod);

    const pendBob = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      brassMat
    );
    pendBob.position.set(0, -1.0, 0);
    pendBob.castShadow = true;
    pendBob.userData = { draggableParam: 'pendulumLength', min: 0.3, max: 2.5, step: 0.1, label: 'Panjang Tali L' };
    pendPivotGroup.add(pendBob);

    // Semicircular protractor degree scale
    const protractorGeo = new THREE.RingGeometry(0.5, 0.7, 32, 1, 0, Math.PI);
    protractorGeo.rotateZ(Math.PI);
    const protractor = new THREE.Mesh(
      protractorGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
    );
    protractor.position.set(0.6, 4.2, 0.05);
    pendulumGroup.add(protractor);

    // Shadow guide arc on ground
    const arcGeo = new THREE.BufferGeometry();
    const arcPositions = new Float32Array(41 * 3);
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
    const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.1, gapSize: 0.05 }));
    pendulumGroup.add(arcLine);

    // =========================================================
    // 5. STOKES VISCOSITY 3D GROUP
    // =========================================================
    const stokesGroup = new THREE.Group();
    scene.add(stokesGroup);

    const stokesStand = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.25, 3.0),
      darkFrameMat
    );
    stokesStand.position.set(0, 0.125, 0);
    stokesGroup.add(stokesStand);

    const stokesPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 6.2, 16),
      brushedSteelMat
    );
    stokesPillar.position.set(-1.4, 3.1, 0);
    stokesGroup.add(stokesPillar);

    // Glass cylinder
    const glassCylMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.9,
    });
    const stokesGlassCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 5.2, 32, 1, true),
      glassCylMat
    );
    stokesGlassCyl.position.set(0, 2.7, 0);
    stokesGroup.add(stokesGlassCyl);

    // Liquid inside
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.65,
      roughness: 0.2,
    });
    const stokesLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 4.8, 32),
      liquidMat
    );
    stokesLiquid.position.set(0, 2.5, 0);
    stokesLiquid.userData = { draggableParam: 'fluidViscosity', min: 0.1, max: 2.0, step: 0.05, label: 'Viskositas η' };
    stokesGroup.add(stokesLiquid);

    // Laser timing gate rings
    const gateTop = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    gateTop.rotation.x = Math.PI / 2;
    gateTop.position.set(0, 4.2, 0);
    const gateBottom = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    gateBottom.rotation.x = Math.PI / 2;
    gateBottom.position.set(0, 1.4, 0);
    stokesGroup.add(gateTop, gateBottom);

    // Falling metal sphere
    const stokesSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 24, 24),
      brushedSteelMat
    );
    stokesSphere.position.set(0, 4.5, 0);
    stokesSphere.castShadow = true;
    stokesSphere.userData = { draggableParam: 'sphereRadius', min: 1, max: 20, step: 0.5, label: 'Jari-jari Bola r' };
    stokesGroup.add(stokesSphere);

    const stokesDragArrow = createArrowGroup(0x38bdf8);
    const stokesGravArrow = createArrowGroup(0xf43f5e);
    stokesGroup.add(stokesDragArrow, stokesGravArrow);

    // =========================================================
    // 6. OHM & WHEATSTONE BRIDGE 3D GROUP
    // =========================================================
    const wheatstoneGroup = new THREE.Group();
    scene.add(wheatstoneGroup);

    const circuitTable = new THREE.Mesh(
      new THREE.BoxGeometry(9.0, 0.2, 6.0),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    circuitTable.position.set(0, 0.1, 0);
    wheatstoneGroup.add(circuitTable);

    // DC Power Supply
    const powerSupplyBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 1.6),
      darkFrameMat
    );
    powerSupplyBox.position.set(-3.2, 0.8, -1.8);
    powerSupplyBox.userData = { draggableParam: 'circuitVoltage', min: 1, max: 24, step: 1, label: 'Tegangan Sumber V' };
    wheatstoneGroup.add(powerSupplyBox);

    // Resistor cylinders arranged in diamond
    const resistorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
    const r1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 16), resistorMat);
    r1Mesh.rotation.z = Math.PI / 4;
    r1Mesh.position.set(-1.4, 0.35, 0.8);
    const r2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 16), resistorMat);
    r2Mesh.rotation.z = -Math.PI / 4;
    r2Mesh.position.set(1.4, 0.35, 0.8);
    const r3Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 16), resistorMat);
    r3Mesh.rotation.z = -Math.PI / 4;
    r3Mesh.position.set(-1.4, 0.35, -0.8);
    const rxMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    rxMesh.rotation.z = Math.PI / 4;
    rxMesh.position.set(1.4, 0.35, -0.8);
    rxMesh.userData = { draggableParam: 'resistorRx', min: 10, max: 1000, step: 10, label: 'Resistor Rx (Ohm)' };
    wheatstoneGroup.add(r1Mesh, r2Mesh, r3Mesh, rxMesh);

    // Galvanometer at center
    const galvoBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.35, 32),
      brushedSteelMat
    );
    galvoBox.position.set(0, 0.3, 0);
    wheatstoneGroup.add(galvoBox);

    const galvoNeedle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    galvoNeedle.position.set(0, 0.5, 0);
    wheatstoneGroup.add(galvoNeedle);

    // =========================================================
    // 7. YOUNG'S DOUBLE SLIT OPTICS 3D GROUP
    // =========================================================
    const youngSlitGroup = new THREE.Group();
    scene.add(youngSlitGroup);

    const optBenchRail = new THREE.Mesh(
      new THREE.BoxGeometry(11.0, 0.18, 0.6),
      darkFrameMat
    );
    optBenchRail.position.set(0, 0.09, 0);
    youngSlitGroup.add(optBenchRail);

    // Laser Emitter Housing at left
    const laserEmitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 1.0),
      brushedSteelMat
    );
    laserEmitter.position.set(-4.8, 1.2, 0);
    laserEmitter.userData = { draggableParam: 'lightWavelength', min: 400, max: 700, step: 10, label: 'Panjang Gelombang λ' };
    youngSlitGroup.add(laserEmitter);

    const laserBeamLine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 3.2, 12),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    laserBeamLine.rotation.z = Math.PI / 2;
    laserBeamLine.position.set(-2.8, 1.2, 0);
    youngSlitGroup.add(laserBeamLine);

    // Double Slit Aperture Plate
    const slitPlateGroup = new THREE.Group();
    slitPlateGroup.position.set(-1.2, 1.2, 0);
    youngSlitGroup.add(slitPlateGroup);

    const slitPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.8, 1.4),
      darkFrameMat
    );
    slitPlate.userData = { draggableParam: 'slitDistance', min: 0.05, max: 0.8, step: 0.02, label: 'Jarak Celah d' };
    slitPlateGroup.add(slitPlate);

    // Screen
    const screenCarrier = new THREE.Group();
    screenCarrier.position.set(3.8, 1.4, 0);
    youngSlitGroup.add(screenCarrier);

    // Fringe texture canvas
    const fringeCanvas = document.createElement('canvas');
    fringeCanvas.width = 512;
    fringeCanvas.height = 256;
    const fringeTexture = new THREE.CanvasTexture(fringeCanvas);

    const projScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 2.6),
      new THREE.MeshBasicMaterial({ map: fringeTexture, side: THREE.DoubleSide })
    );
    projScreen.rotation.y = -Math.PI / 2;
    projScreen.userData = { draggableParam: 'screenDistance', min: 0.5, max: 3.0, step: 0.1, label: 'Jarak Layar L' };
    screenCarrier.add(projScreen);

    // =========================================================
    // 8. PHOTOELECTRIC PLANCK 3D GROUP
    // =========================================================
    const photoelectricGroup = new THREE.Group();
    scene.add(photoelectricGroup);

    const peBase = new THREE.Mesh(
      new THREE.BoxGeometry(8.0, 0.2, 4.0),
      darkFrameMat
    );
    peBase.position.set(0, 0.1, 0);
    photoelectricGroup.add(peBase);

    // Glass Phototube bulb
    const peBulb = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 3.2, 28),
      glassCylMat
    );
    peBulb.rotation.z = Math.PI / 2;
    peBulb.position.set(0, 1.6, 0);
    photoelectricGroup.add(peBulb);

    // Cathode plate
    const peCathode = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 })
    );
    peCathode.rotation.x = Math.PI / 2;
    peCathode.position.set(-1.1, 1.6, 0);
    peCathode.userData = { draggableParam: 'targetMetalWorkFunction', min: 2.0, max: 5.5, step: 0.1, label: 'Fungsi Kerja W (eV)' };
    photoelectricGroup.add(peCathode);

    // Anode collector ring
    const peAnode = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.06, 12, 28),
      brassMat
    );
    peAnode.rotation.y = Math.PI / 2;
    peAnode.position.set(1.1, 1.6, 0);
    peAnode.userData = { draggableParam: 'stoppingPotential', min: 0, max: 5.0, step: 0.1, label: 'Potensial Penghenti V₀' };
    photoelectricGroup.add(peAnode);

    // Photoelectron particles
    const PE_PARTICLES_COUNT = 30;
    const peParticles: THREE.Mesh[] = [];
    const peParticleGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const peParticleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < PE_PARTICLES_COUNT; i++) {
      const pMesh = new THREE.Mesh(peParticleGeo, peParticleMat);
      peParticles.push(pMesh);
      photoelectricGroup.add(pMesh);
    }

    // =========================================================
    // DIRECT 3D MESH DRAGGING (RAYCASTER GIZMOS)
    // =========================================================
    let isDragging = false;
    let activeDragMesh: THREE.Object3D | null = null;
    let dragParamKey = '';
    let dragStartPos = { x: 0, y: 0 };
    let dragStartVal = 0;
    let dragConfig = { min: 0, max: 100, step: 1, label: '' };
    const dragRaycaster = new THREE.Raycaster();
    const dragMouse = new THREE.Vector2();

    const getInteractiveMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible && obj.userData?.draggableParam) {
          list.push(obj);
        }
      });
      return list;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      dragMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      dragRaycaster.setFromCamera(dragMouse, camera);

      const hits = dragRaycaster.intersectObjects(getInteractiveMeshes(), false);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const paramKey = hitObj.userData.draggableParam;
        if (paramKey && latestRef.current.onUpdateParam) {
          isDragging = true;
          activeDragMesh = hitObj;
          dragParamKey = paramKey;
          dragStartPos = { x: e.clientX, y: e.clientY };
          dragConfig = {
            min: hitObj.userData.min ?? 0,
            max: hitObj.userData.max ?? 100,
            step: hitObj.userData.step ?? 1,
            label: hitObj.userData.label ?? paramKey,
          };
          const curVal = (latestRef.current.params as unknown as Record<string, number>)[paramKey] ?? 0;
          dragStartVal = curVal;
          controls.enabled = false;
          renderer.domElement.style.cursor = 'grabbing';
          labSound.playClick(600);
          setDragToast({ label: dragConfig.label, value: `${curVal}` });
        }
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        isDragging = false;
        activeDragMesh = null;
        dragParamKey = '';
        controls.enabled = true;
        renderer.domElement.style.cursor = 'grab';
        setTimeout(() => setDragToast(null), 1200);
      }
    };

    // Main Tick Loop
    let disposed = false;
    let rafId = 0;

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
      projectileGroup.visible = p.mode === 'projectile-gravity' || (p.mode as string) === 'projectile-motion';
      springGroup.visible = p.mode === 'spring-hooke';
      pendulumGroup.visible = p.mode === 'pendulum-harmonic';
      stokesGroup.visible = p.mode === 'stokes-viscosity';
      wheatstoneGroup.visible = p.mode === 'ohm-wheatstone';
      youngSlitGroup.visible = p.mode === 'optics-young-slit';
      photoelectricGroup.visible = p.mode === 'photoelectric-planck';

      // 1. Incline update
      if (p.mode === 'newton-incline') {
        const thetaRad = (p.inclineAngle * Math.PI) / 180;
        pivotGroup.rotation.z = thetaRad;
        const strutH = Math.max(0.15, 7.8 * Math.tan(thetaRad));
        supportPillar.scale.set(1, strutH, 1);
        supportPillar.position.set(3.2, 0.24 + strutH / 2, 0);

        const rawDisp = p.initialVelocity * t + 0.5 * m.acceleration * t * t;
        const rampPos = 1.6 + Math.max(-1.2, Math.min(28, rawDisp)) * 0.22;
        blockGroup.position.set(rampPos, 0, 0);
      }

      // 2. Projectile update
      else if (p.mode === 'projectile-gravity' || (p.mode as string) === 'projectile-motion') {
        const maxRange = Math.max(35, m.projectileRange * 1.1);
        const scaleX = 10.4 / maxRange;
        const scaleY = 4.8 / Math.max(18, m.maxProjectileHeight * 1.15);
        cannonPivot.rotation.z = (p.launchAngle * Math.PI) / 180;
        const curX = -5.2 + inst.positionX * scaleX;
        const curY = 0.25 + inst.positionY * scaleY;
        projectileBall.position.set(curX, curY, 0);
        targetRing.position.set(-5.2 + m.projectileRange * scaleX, 0.03, 0);
      }

      // 3. Spring update
      else if (p.mode === 'spring-hooke') {
        const massX = 0.5 + inst.positionX * 2.1;
        springMassBlock.position.set(massX, 0.87, 0);
        const span = Math.max(0.8, massX - 0.65 - -4.95);
        springRings.forEach((ring, idx) => {
          ring.position.set(-4.95 + ((idx + 0.5) / springRings.length) * span, 0.87, 0);
        });
      }

      // 4. Pendulum update
      else if (p.mode === 'pendulum-harmonic') {
        const L = Math.max(0.3, p.pendulumLength ?? 1.2);
        const thetaRad = inst.pendulumAngleRad ?? ((p.pendulumAngle ?? 25) * Math.PI) / 180 * Math.cos(2.8 * t);
        pendPivotGroup.rotation.z = thetaRad;
        pendRod.scale.set(1, L * 1.5, 1);
        pendRod.position.set(0, -L * 0.75, 0);
        pendBob.position.set(0, -L * 1.5, 0);
      }

      // 5. Stokes update
      else if (p.mode === 'stokes-viscosity') {
        const vt = m.stokesTerminalVelocity ?? 0.8;
        const yPos = 4.6 - ((t * vt) % 3.6);
        stokesSphere.position.y = yPos;
        const rScale = (p.sphereRadius ?? 5) / 10;
        stokesSphere.scale.setScalar(rScale);
        if (showVec) {
          orientAndScaleArrow(stokesGravArrow, new THREE.Vector3(0, yPos, 0), new THREE.Vector3(0, -1, 0), 1.2);
          orientAndScaleArrow(stokesDragArrow, new THREE.Vector3(0, yPos, 0), new THREE.Vector3(0, 1, 0), Math.min(1.8, (m.stokesDragForce ?? 0.05) * 8));
        }
      }

      // 6. Wheatstone update
      else if (p.mode === 'ohm-wheatstone') {
        const ig = m.galvanometerCurrent ?? 0;
        const needleAngle = Math.max(-0.6, Math.min(0.6, (ig / 50) * Math.PI * 0.4));
        galvoNeedle.rotation.y = needleAngle;
      }

      // 7. Young's slit update
      else if (p.mode === 'optics-young-slit') {
        const wl = p.lightWavelength ?? 532;
        const beamColor = wavelengthToHex(wl);
        (laserBeamLine.material as THREE.MeshBasicMaterial).color.setHex(beamColor);

        // Redraw interference fringes on screen canvas
        const ctx = fringeCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050811';
          ctx.fillRect(0, 0, fringeCanvas.width, fringeCanvas.height);
          const fringeSpacing = Math.max(8, (m.fringeSpacingMm ?? 3.5) * 8);
          const rgbHex = beamColor.toString(16).padStart(6, '0');
          for (let x = 0; x < fringeCanvas.width; x++) {
            const intensity = Math.pow(Math.cos(((x - 256) / fringeSpacing) * Math.PI), 2);
            ctx.fillStyle = `#${rgbHex}`;
            ctx.globalAlpha = intensity;
            ctx.fillRect(x, 0, 1, fringeCanvas.height);
          }
          ctx.globalAlpha = 1.0;
          fringeTexture.needsUpdate = true;
        }
      }

      // 8. Photoelectric update
      else if (p.mode === 'photoelectric-planck') {
        const emitted = m.photoelectricEmitted ?? true;
        peParticles.forEach((particle, idx) => {
          if (!emitted) {
            particle.visible = false;
            return;
          }
          particle.visible = true;
          const pFrac = ((t * 1.5 + idx / PE_PARTICLES_COUNT) % 1.0);
          const stopV = p.stoppingPotential ?? 1.5;
          const maxKe = m.photoelectricMaxKe ?? 1.2;
          // If stopped, parabolic turnaround
          if (stopV > maxKe) {
            const turnX = -1.1 + (maxKe / stopV) * 2.0;
            const x = pFrac < 0.5 ? -1.1 + (turnX - -1.1) * (pFrac * 2) : turnX - (turnX - -1.1) * ((pFrac - 0.5) * 2);
            particle.position.set(x, 1.6 + Math.sin(idx * 2) * 0.35, Math.cos(idx * 2) * 0.35);
          } else {
            particle.position.set(-1.1 + pFrac * 2.2, 1.6 + Math.sin(idx) * 0.3, Math.cos(idx) * 0.3);
          }
        });
      }

      // Update cursors
      cursorManager.update(
        latestRef.current.remoteCursors || {},
        camera.position
      );

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Pointer move & Drag Handler
    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (isDragging && dragParamKey && latestRef.current.onUpdateParam) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = dragStartPos.y - e.clientY;
        const sensitivity = (dragConfig.max - dragConfig.min) / 300;
        const delta = (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * sensitivity;
        let nextVal = dragStartVal + delta;
        nextVal = Math.max(dragConfig.min, Math.min(dragConfig.max, nextVal));
        if (dragConfig.step >= 1) {
          nextVal = Math.round(nextVal / dragConfig.step) * dragConfig.step;
        } else {
          nextVal = Number((Math.round(nextVal / dragConfig.step) * dragConfig.step).toFixed(2));
        }
        latestRef.current.onUpdateParam(dragParamKey, nextVal);
        setDragToast({ label: dragConfig.label, value: `${nextVal}` });
        return;
      }

      // Hover check for pointer cursor
      dragMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      dragRaycaster.setFromCamera(dragMouse, camera);
      const hits = dragRaycaster.intersectObjects(getInteractiveMeshes(), false);
      if (hits.length > 0) {
        renderer.domElement.style.cursor = 'grab';
      } else {
        renderer.domElement.style.cursor = 'default';
      }

      if (latestRef.current.onEmitCursor) {
        const intersects = dragRaycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          latestRef.current.onEmitCursor(
            [hit.point.x, hit.point.y, hit.point.z],
            hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : undefined,
            hit.object.name
          );
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      cursorManager.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    cameraCtrlRef.current?.setPreset(preset);
  };

  const handleToggleFullscreen = () => {
    labSound.playClick();
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#0B1120] ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="physics-simulation-canvas"
        className="w-full h-full block"
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full backdrop-blur-xl bg-sky-950/90 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 animate-pulse text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      {/* Top Camera Controls */}
      <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 rounded-full backdrop-blur-xl bg-slate-900/75 border border-white/15 px-3 py-1.5 shadow-2xl z-20">
        <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold mr-1">
          Kamera 3D:
        </span>
        {(
          [
            { id: 'isometric', label: 'Isometrik' },
            { id: 'front', label: 'Depan' },
            { id: 'top', label: 'Atas' },
            { id: 'focus', label: 'Fokus' },
          ] as const
        ).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleSelectCameraPreset(preset.id)}
            className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-full transition-colors cursor-pointer ${
              activePreset === preset.id
                ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        ))}
        {!hudCollapsed && showVectorOverlay && (
          <div className="hidden xl:flex items-center gap-2 pl-2 ml-1 border-l border-white/15 text-[10px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Gaya/Vektor
            </span>
          </div>
        )}
      </div>

      {/* Top-Right Fullscreen Toggle Button (Mobile & Desktop) */}
      <div className="pointer-events-auto absolute top-4 right-4 z-30">
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800 border border-white/20 text-xs font-mono text-white shadow-2xl transition-all cursor-pointer"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D (Sentuh & Mobile)'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Kecilkan 3D</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline font-semibold">Layar Penuh 3D</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
