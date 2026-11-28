import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  applyBorosilicateLiteMode,
  createAnalogGaugeDialTexture,
  createBorosilicateGlassMaterial,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  createInstrumentPanelTexture,
  createPlanetSurfaceTexture,
  createVectorArrowGroup,
  orientAndScaleVectorArrow,
  updateInstrumentPanelTexture,
  wavelengthNmToHex,
} from '../../utils/threeStudioKit';
import { PhysicsMetrics, PhysicsParams } from '../../utils/scienceEngine';
import { globalMultiApparatusEngine } from '../../utils/engines/multiApparatusEngine';
import { labSound } from '../../utils/soundEngine';
import {
  computeCollisionCartKinematics,
  computeCollisionShockwaveState,
  computeFaradayInductionVisualState,
  computeMechanicalEnergySplit,
  computeOrbitalAngularVelocity,
  computePhotoelectricElectronX,
  computeStokesDropState,
  computeWheatstoneBranchCurrents,
  computeWheatstoneNeedleAngle,
  computeYoungFringeIntensity,
  photonFrequencyToWavelengthNm,
} from '../../utils/physicsVisualHelpers';

export interface PhysicsRigMaterials {
  darkFrameMat: THREE.Material;
  brushedSteelMat: THREE.Material;
  brassMat: THREE.Material;
  primaryMassMat: THREE.Material;
  airTrackScaleTex: THREE.Texture | null;
}

export interface PhysicsRigUpdateContext {
  params: PhysicsParams;
  metrics: PhysicsMetrics;
  simTime: number;
  nowSec: number;
  showVectors: boolean;
  isLite: boolean;
  particleScale?: number;
  isSimTimeAdvancing: boolean;
}

export interface PhysicsSpecialRigsHandle {
  stokesGroup: THREE.Group;
  wheatstoneGroup: THREE.Group;
  youngSlitGroup: THREE.Group;
  photoelectricGroup: THREE.Group;
  collisionGroup: THREE.Group;
  orbitalGroup: THREE.Group;
  meldeGroup: THREE.Group;
  faradayGroup: THREE.Group;
  energyWidgetGroup: THREE.Group;
  stokesSphere: THREE.Mesh;
  cart1Mesh: THREE.Group;
  cart2Mesh: THREE.Group;
  satelliteBody: THREE.Mesh;
  meldeHangingMass: THREE.Mesh;
  update: (ctx: PhysicsRigUpdateContext, curEk?: number, curEp?: number) => void;
  dispose: () => void;
}

/**
 * Builds modular 3D Physics Rigs for Stokes Viscosity, Wheatstone Bridge,
 * Young's Double-Slit Interference, Photoelectric Planck Tube, 1D Air-Track Collision,
 * Orbital Gravity, and the real-time 3D Mechanical Energy (Ek / Ep) Column HUD.
 */
export function buildPhysicsSpecialRigs(
  scene: THREE.Scene,
  mats: PhysicsRigMaterials,
  initialLiteMode: boolean
): PhysicsSpecialRigsHandle {
  const { darkFrameMat, brushedSteelMat, brassMat, primaryMassMat, airTrackScaleTex } = mats;
  const disposableTextures: Array<THREE.Texture | null> = [];

  // =========================================================
  // 1. STOKES VISCOSITY 3D GROUP
  // =========================================================
  const stokesGroup = new THREE.Group();
  scene.add(stokesGroup);

  const stokesStand = new THREE.Mesh(
    new RoundedBoxGeometry(3.3, 0.26, 3.1, 3, 0.04),
    darkFrameMat
  );
  stokesStand.position.set(-0.25, 0.13, 0);
  stokesStand.receiveShadow = true;
  stokesGroup.add(stokesStand);

  const stokesPillarFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.12, 20),
    brassMat
  );
  stokesPillarFlange.position.set(-1.4, 0.3, 0);
  const stokesPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 5.6, 16),
    brushedSteelMat
  );
  stokesPillar.position.set(-1.4, 3.0, 0);
  stokesPillar.castShadow = true;
  stokesGroup.add(stokesPillarFlange, stokesPillar);

  const glassCylMat = createBorosilicateGlassMaterial(initialLiteMode, {
    color: 0xe8f4fc,
    tintOpacity: 0.34,
    ior: 1.47,
    thickness: 0.55,
  });
  const stokesGlassCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 5.0, 32, 1, true),
    glassCylMat
  );
  stokesGlassCyl.position.set(0, 2.75, 0);
  stokesGroup.add(stokesGlassCyl);

  // Heavy lower glass seat + top flared pouring rim + bottom brass drain spigot
  const stokesBottomSeat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.96, 0.22, 32),
    brushedSteelMat
  );
  stokesBottomSeat.position.set(0, 0.32, 0);
  const stokesTopLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.042, 14, 36),
    glassCylMat
  );
  stokesTopLip.rotation.x = Math.PI / 2;
  stokesTopLip.position.set(0, 5.25, 0);
  const stokesDrainValve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.32, 12),
    brassMat
  );
  stokesDrainValve.rotation.z = Math.PI / 2;
  stokesDrainValve.position.set(0.98, 0.36, 0);
  stokesGroup.add(stokesBottomSeat, stokesTopLip, stokesDrainValve);

  // Dual bosshead & ring clamps structurally connecting vertical pillar (-1.4) to glass tube (0)
  [1.65, 4.35].forEach((cy) => {
    const boss = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.24, 0.24, 2, 0.03), darkFrameMat);
    boss.position.set(-1.4, cy, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.58, 12), brushedSteelMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-1.12, cy, 0);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.035, 10, 32),
      darkFrameMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, cy, 0);
    stokesGroup.add(boss, arm, collar);
  });

  // Graduated centimeter depth scale along the viscometer tube
  const stokesScaleTex = createGraduatedScaleTexture(100, 'cm', 20, {
    invertTopToBottom: true,
    width: 128,
    height: 512,
  });
  disposableTextures.push(stokesScaleTex);
  if (stokesScaleTex) {
    const stokesScaleSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.865, 0.865, 4.4, 24, 1, true, -0.35, 0.7),
      new THREE.MeshBasicMaterial({
        map: stokesScaleTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    stokesScaleSleeve.position.set(0, 2.65, 0);
    stokesGroup.add(stokesScaleSleeve);
  }

  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    transparent: true,
    opacity: 0.65,
    roughness: 0.18,
  });
  const stokesLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.82, 4.65, 32),
    liquidMat
  );
  stokesLiquid.position.set(0, 2.68, 0);
  stokesLiquid.userData = {
    draggableParam: 'fluidViscosity',
    min: 0.1,
    max: 2.0,
    step: 0.05,
    label: 'Viskositas η',
  };
  stokesGroup.add(stokesLiquid);

  const gateTop = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.04, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  gateTop.rotation.x = Math.PI / 2;
  gateTop.position.set(0, 4.2, 0);

  const gateBottom = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.04, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  gateBottom.rotation.x = Math.PI / 2;
  gateBottom.position.set(0, 1.4, 0);
  // Optical sensor pods on timing gates
  [4.2, 1.4].forEach((gy, gIdx) => {
    const pod = new THREE.Mesh(
      new RoundedBoxGeometry(0.22, 0.18, 0.22, 2, 0.02),
      gIdx === 0 ? brushedSteelMat : brassMat
    );
    pod.position.set(0.94, gy, 0);
    stokesGroup.add(pod);
  });
  stokesGroup.add(gateTop, gateBottom);

  const stokesSphere = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 24), brushedSteelMat);
  stokesSphere.position.set(0, 4.5, 0);
  stokesSphere.castShadow = true;
  stokesSphere.userData = {
    draggableParam: 'sphereRadius',
    min: 1,
    max: 20,
    step: 0.5,
    label: 'Jari-jari Bola r',
  };
  stokesGroup.add(stokesSphere);

  // Viscous laminar wake ring trailing behind the falling sphere
  const stokesWakeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.36, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
  );
  stokesWakeRing.rotation.x = Math.PI / 2;
  stokesGroup.add(stokesWakeRing);

  const stokesDragArrow = createVectorArrowGroup(0x38bdf8); // Sky: Stokes viscous drag F_d
  const stokesBuoyancyArrow = createVectorArrowGroup(0x10b981); // Emerald: Archimedes buoyancy F_b
  const stokesGravArrow = createVectorArrowGroup(0xf43f5e); // Rose: Weight W = m·g
  stokesGroup.add(stokesDragArrow, stokesBuoyancyArrow, stokesGravArrow);

  // =========================================================
  // 2. OHM & WHEATSTONE BRIDGE 3D GROUP
  // =========================================================
  const wheatstoneGroup = new THREE.Group();
  scene.add(wheatstoneGroup);

  const circuitTable = new THREE.Mesh(
    new RoundedBoxGeometry(9.0, 0.2, 6.0, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.12 })
  );
  circuitTable.position.set(0, 0.1, 0);
  circuitTable.receiveShadow = true;
  wheatstoneGroup.add(circuitTable);

  const powerSupplyBox = new THREE.Mesh(
    new RoundedBoxGeometry(2.2, 1.4, 1.6, 3, 0.05),
    darkFrameMat
  );
  powerSupplyBox.position.set(-3.2, 0.9, -1.8);
  powerSupplyBox.castShadow = true;
  powerSupplyBox.userData = {
    draggableParam: 'circuitVoltage',
    min: 1,
    max: 24,
    step: 1,
    label: 'Tegangan Sumber V',
  };
  wheatstoneGroup.add(powerSupplyBox);

  // Digital OLED Voltage/Current panel + rotary knob + banana terminals on DC Power Supply front (+Z)
  const psuScreenTex = createInstrumentPanelTexture({
    title: 'DC POWER SUPPLY',
    primaryText: '12.0 V',
    secondaryText: 'CC/CV REGULATED',
    accentHex: '#38bdf8',
  });
  disposableTextures.push(psuScreenTex);
  if (psuScreenTex) {
    const psuScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.38, 0.68),
      new THREE.MeshBasicMaterial({ map: psuScreenTex })
    );
    psuScreen.position.set(-0.28, 0.15, 0.81);
    powerSupplyBox.add(psuScreen);
  }
  const psuDialKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 0.14, 20),
    brassMat
  );
  psuDialKnob.rotation.x = Math.PI / 2;
  psuDialKnob.position.set(0.68, 0.18, 0.84);
  const psuJackRed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
  );
  psuJackRed.rotation.x = Math.PI / 2;
  psuJackRed.position.set(0.45, -0.36, 0.83);
  const psuJackBlack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3 })
  );
  psuJackBlack.rotation.x = Math.PI / 2;
  psuJackBlack.position.set(0.78, -0.36, 0.83);
  powerSupplyBox.add(psuDialKnob, psuJackRed, psuJackBlack);

  globalMultiApparatusEngine.seedDefaultDomainNodes('Fisika');
  const psuTerminalAnchor = new THREE.Object3D();
  psuTerminalAnchor.name = 'anchor-psu-terminal-pos';
  psuTerminalAnchor.position.set(1.1, 0, 0.4);
  powerSupplyBox.add(psuTerminalAnchor);
  globalMultiApparatusEngine.bindPortAnchor('catu-daya-dc-3d', 'terminal-pos', psuTerminalAnchor);

  const nodePositions = {
    left: new THREE.Vector3(-2.35, 0.28, 0),
    top: new THREE.Vector3(0, 0.28, -1.65),
    bottom: new THREE.Vector3(0, 0.28, 1.65),
    right: new THREE.Vector3(2.35, 0.28, 0),
  };
  const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.26, 16);
  Object.values(nodePositions).forEach((pos) => {
    const post = new THREE.Mesh(postGeo, brassMat);
    post.position.copy(pos);
    post.castShadow = true;
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), brushedSteelMat);
    washer.position.set(pos.x, 0.21, pos.z);
    wheatstoneGroup.add(post, washer);
  });

  // Visible copper-clad PCB diamond traces linking the 4 Wheatstone nodes on the board
  const traceMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.78,
    roughness: 0.28,
  });
  [
    [nodePositions.left, nodePositions.bottom],
    [nodePositions.bottom, nodePositions.right],
    [nodePositions.left, nodePositions.top],
    [nodePositions.top, nodePositions.right],
  ].forEach(([pA, pB]) => {
    const dx = pB.x - pA.x;
    const dz = pB.z - pA.z;
    const len = Math.hypot(dx, dz);
    const trace = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.11), traceMat);
    trace.position.set((pA.x + pB.x) * 0.5, 0.205, (pA.z + pB.z) * 0.5);
    trace.rotation.y = -Math.atan2(dz, dx);
    wheatstoneGroup.add(trace);
  });

  const resistorMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.35,
    metalness: 0.2,
  });
  const createResistorAssembly = (
    x: number,
    z: number,
    rotY: number,
    bodyColorMat: THREE.Material,
    draggable?: Record<string, unknown>
  ) => {
    const rGroup = new THREE.Group();
    rGroup.position.set(x, 0.34, z);
    rGroup.rotation.y = rotY;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 18), bodyColorMat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    if (draggable) body.userData = draggable;
    const lead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.8, 12),
      brushedSteelMat
    );
    lead.rotation.z = Math.PI / 2;
    const capLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 18), brushedSteelMat);
    capLeft.rotation.z = Math.PI / 2;
    capLeft.position.x = -0.56;
    const capRight = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 18), brushedSteelMat);
    capRight.rotation.z = Math.PI / 2;
    capRight.position.x = 0.56;
    const band1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.188, 0.188, 0.09, 18),
      new THREE.MeshBasicMaterial({ color: 0x1e293b })
    );
    band1.rotation.z = Math.PI / 2;
    band1.position.x = -0.28;
    const band2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.188, 0.188, 0.09, 18),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    band2.rotation.z = Math.PI / 2;
    band2.position.x = 0.0;
    const band3 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.188, 0.188, 0.09, 18),
      new THREE.MeshBasicMaterial({ color: 0x7c2d12 })
    );
    band3.rotation.z = Math.PI / 2;
    band3.position.x = 0.26;
    rGroup.add(lead, body, capLeft, capRight, band1, band2, band3);
    return rGroup;
  };

  const r1Assembly = createResistorAssembly(-1.18, 0.82, Math.atan2(1.65, 2.35), resistorMat);
  const r2Assembly = createResistorAssembly(1.18, 0.82, -Math.atan2(1.65, 2.35), resistorMat);
  const r3Assembly = createResistorAssembly(-1.18, -0.82, -Math.atan2(1.65, 2.35), resistorMat);
  const rxAssembly = createResistorAssembly(
    1.18,
    -0.82,
    Math.atan2(1.65, 2.35),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.15 }),
    { draggableParam: 'resistorRx', min: 10, max: 1000, step: 10, label: 'Resistor Rx (Ohm)' }
  );
  wheatstoneGroup.add(r1Assembly, r2Assembly, r3Assembly, rxAssembly);

  const resistorTerminalAnchor = new THREE.Object3D();
  resistorTerminalAnchor.name = 'anchor-resistor-terminal-in';
  resistorTerminalAnchor.position.set(-1.1, 0, 0);
  r1Assembly.add(resistorTerminalAnchor);
  globalMultiApparatusEngine.bindPortAnchor(
    'resistor-beban-3d',
    'terminal-in',
    resistorTerminalAnchor
  );

  const addCurvedWire = (pts: THREE.Vector3[], colorHex: number, radius = 0.042) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const wireGeo = new THREE.TubeGeometry(curve, 28, radius, 10, false);
    const wireMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.42,
      metalness: 0.15,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.castShadow = true;
    wheatstoneGroup.add(wireMesh);
  };

  addCurvedWire(
    [
      new THREE.Vector3(-2.75, 0.54, -0.98),
      new THREE.Vector3(-2.85, 0.88, -0.55),
      new THREE.Vector3(-2.6, 0.52, -0.15),
      new THREE.Vector3(-2.35, 0.34, 0),
    ],
    0xef4444
  );
  addCurvedWire(
    [
      new THREE.Vector3(-2.42, 0.54, -0.98),
      new THREE.Vector3(-0.6, 0.76, -2.25),
      new THREE.Vector3(1.65, 0.62, -1.85),
      new THREE.Vector3(2.35, 0.34, 0),
    ],
    0x0ea5e9
  );
  addCurvedWire(
    [
      new THREE.Vector3(0, 0.34, -1.65),
      new THREE.Vector3(-0.28, 0.64, -1.15),
      new THREE.Vector3(-0.18, 0.46, -0.72),
    ],
    0x10b981,
    0.034
  );
  addCurvedWire(
    [
      new THREE.Vector3(0, 0.34, 1.65),
      new THREE.Vector3(0.28, 0.64, 1.15),
      new THREE.Vector3(0.18, 0.46, 0.72),
    ],
    0xf59e0b,
    0.034
  );

  const galvoBox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.98, 0.36, 36),
    brushedSteelMat
  );
  galvoBox.position.set(0, 0.38, 0);
  galvoBox.castShadow = true;
  wheatstoneGroup.add(galvoBox);

  const galvoDialTex = createAnalogGaugeDialTexture({
    min: -45,
    max: 45,
    unit: 'mA',
    title: 'GALVANOMETER',
    zeroCenter: true,
    majorDivisions: 6,
  });
  disposableTextures.push(galvoDialTex);
  const galvoDialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 36),
    new THREE.MeshBasicMaterial({
      map: galvoDialTex ?? null,
      color: galvoDialTex ? 0xffffff : 0x0f172a,
    })
  );
  galvoDialFace.rotation.x = -Math.PI / 2;
  galvoDialFace.position.set(0, 0.565, 0);
  wheatstoneGroup.add(galvoDialFace);

  // Animated electrical current-carrier dots along the 4 diamond arms + central bridge wire
  const WHEATSTONE_DOTS_PER_ARM = 5;
  const WHEATSTONE_TOTAL_DOTS = WHEATSTONE_DOTS_PER_ARM * 5;
  const wheatstoneDotPool = createInstancedParticlePool(
    WHEATSTONE_TOTAL_DOTS,
    new THREE.SphereGeometry(0.048, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    wheatstoneGroup
  );
  wheatstoneDotPool.mesh.frustumCulled = false;

  // Balanced-bridge indicator ring + protective glass cover dome around galvanometer bezel
  const galvoBalanceRingMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.25,
  });
  const galvoBalanceRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.032, 12, 36),
    galvoBalanceRingMat
  );
  galvoBalanceRing.rotation.x = Math.PI / 2;
  galvoBalanceRing.position.set(0, 0.57, 0);
  const galvoGlassCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.06, 32),
    glassCylMat
  );
  galvoGlassCover.position.set(0, 0.61, 0);
  wheatstoneGroup.add(galvoBalanceRing, galvoGlassCover);

  const galvoNeedle = new THREE.Group();
  galvoNeedle.position.set(0, 0.58, 0.15);
  const galvoNeedlePointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.76, 12),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    })
  );
  galvoNeedlePointer.rotation.x = -Math.PI / 2;
  galvoNeedlePointer.position.set(0, 0, -0.34);
  const galvoPivotCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16),
    brassMat
  );
  galvoNeedle.add(galvoNeedlePointer, galvoPivotCap);
  wheatstoneGroup.add(galvoNeedle);

  // =========================================================
  // 3. YOUNG'S DOUBLE SLIT OPTICS 3D GROUP
  // =========================================================
  const youngSlitGroup = new THREE.Group();
  scene.add(youngSlitGroup);

  const optBenchRail = new THREE.Mesh(
    new RoundedBoxGeometry(11.2, 0.2, 0.72, 2, 0.03),
    darkFrameMat
  );
  optBenchRail.position.set(0, 0.1, 0);
  optBenchRail.receiveShadow = true;
  const optBenchSlot = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 0.04, 0.18),
    brushedSteelMat
  );
  optBenchSlot.position.set(0, 0.21, 0);
  youngSlitGroup.add(optBenchRail, optBenchSlot);

  // Composite He-Ne / Diode Cylindrical Laser Emitter Assembly
  const laserEmitter = new THREE.Mesh(
    new RoundedBoxGeometry(1.75, 0.42, 0.88, 2, 0.04),
    darkFrameMat
  );
  laserEmitter.position.set(-4.8, 0.92, 0);
  laserEmitter.castShadow = true;
  laserEmitter.userData = {
    draggableParam: 'lightWavelength',
    min: 400,
    max: 700,
    step: 10,
    label: 'Panjang Gelombang λ',
  };
  const laserBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1.82, 24),
    brushedSteelMat
  );
  laserBarrel.rotation.z = Math.PI / 2;
  laserBarrel.position.set(0.05, 0.28, 0);
  laserBarrel.castShadow = true;
  laserBarrel.userData = laserEmitter.userData;
  const laserNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 0.22, 20),
    brassMat
  );
  laserNozzle.rotation.z = Math.PI / 2;
  laserNozzle.position.set(1.02, 0.28, 0);
  // Cooling fin rings around laser barrel
  [-0.45, -0.15, 0.15, 0.45].forEach((fx) => {
    const fin = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.025, 10, 24),
      darkFrameMat
    );
    fin.rotation.y = Math.PI / 2;
    fin.position.set(fx, 0.28, 0);
    laserEmitter.add(fin);
  });
  laserEmitter.add(laserBarrel, laserNozzle);
  youngSlitGroup.add(laserEmitter);

  const laserMountPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 0.54, 16),
    brushedSteelMat
  );
  laserMountPost.position.set(-4.8, 0.46, 0);
  laserMountPost.castShadow = true;
  const laserRiderClamp = new THREE.Mesh(
    new RoundedBoxGeometry(0.56, 0.18, 0.86, 2, 0.02),
    darkFrameMat
  );
  laserRiderClamp.position.set(-4.8, 0.2, 0);
  youngSlitGroup.add(laserMountPost, laserRiderClamp);

  const laserBeamLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 2.65, 12),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  laserBeamLine.rotation.z = Math.PI / 2;
  laserBeamLine.position.set(-2.5, 1.2, 0);
  youngSlitGroup.add(laserBeamLine);

  // Coherent diffracted fan cone between slit plate (-1.2) and projection screen (+3.8)
  const diffractionConeMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const diffractionCone = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 5.0, 24, 1, true),
    diffractionConeMat
  );
  diffractionCone.rotation.z = Math.PI / 2;
  diffractionCone.position.set(1.3, 1.2, 0);
  youngSlitGroup.add(diffractionCone);

  const slitPlateGroup = new THREE.Group();
  slitPlateGroup.position.set(-1.2, 1.2, 0);
  youngSlitGroup.add(slitPlateGroup);

  const slitPlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.12, 1.84, 1.46, 2, 0.02),
    darkFrameMat
  );
  slitPlate.castShadow = true;
  slitPlate.userData = {
    draggableParam: 'slitDistance',
    min: 0.05,
    max: 0.8,
    step: 0.02,
    label: 'Jarak Celah d',
  };
  // Precision brass optical aperture window + dual illuminated vertical micro-slits
  const slitApertureFrame = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.78, 0.62, 2, 0.015),
    brassMat
  );
  slitApertureFrame.userData = slitPlate.userData;
  const slitLineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const slitLeft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.028), slitLineMat);
  slitLeft.position.set(0, 0, -0.09);
  const slitRight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.028), slitLineMat);
  slitRight.position.set(0, 0, 0.09);
  slitPlateGroup.add(slitPlate, slitApertureFrame, slitLeft, slitRight);

  const slitMountPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.28, 16),
    brushedSteelMat
  );
  slitMountPost.position.set(0, -0.98, 0);
  const slitRiderBase = new THREE.Mesh(
    new RoundedBoxGeometry(0.46, 0.18, 0.86, 2, 0.02),
    darkFrameMat
  );
  slitRiderBase.position.set(0, -1.02, 0);
  slitPlateGroup.add(slitMountPost, slitRiderBase);

  const screenCarrier = new THREE.Group();
  screenCarrier.position.set(3.8, 1.4, 0);
  youngSlitGroup.add(screenCarrier);

  const fringeCanvas = document.createElement('canvas');
  fringeCanvas.width = 512;
  fringeCanvas.height = 256;
  const fringeTexture = new THREE.CanvasTexture(fringeCanvas);
  fringeTexture.colorSpace = THREE.SRGBColorSpace;

  const projScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.45),
    new THREE.MeshBasicMaterial({ map: fringeTexture, side: THREE.DoubleSide })
  );
  projScreen.rotation.y = -Math.PI / 2;
  projScreen.userData = {
    draggableParam: 'screenDistance',
    min: 0.5,
    max: 3.0,
    step: 0.1,
    label: 'Jarak Layar L',
  };
  const projScreenFrame = new THREE.Mesh(
    new RoundedBoxGeometry(0.1, 1.62, 2.78, 2, 0.02),
    darkFrameMat
  );
  projScreenFrame.position.set(0.06, 0, 0);
  projScreenFrame.userData = projScreen.userData;
  const screenMountPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 0.52, 16),
    brushedSteelMat
  );
  screenMountPost.position.set(0.04, -1.04, 0);
  const screenRiderBase = new THREE.Mesh(
    new RoundedBoxGeometry(0.52, 0.18, 0.86, 2, 0.02),
    darkFrameMat
  );
  screenRiderBase.position.set(0.04, -1.22, 0);
  screenCarrier.add(projScreen, projScreenFrame, screenMountPost, screenRiderBase);

  // =========================================================
  // 4. PHOTOELECTRIC PLANCK 3D GROUP
  // =========================================================
  const photoelectricGroup = new THREE.Group();
  scene.add(photoelectricGroup);

  const peBase = new THREE.Mesh(
    new RoundedBoxGeometry(8.2, 0.22, 4.2, 3, 0.04),
    darkFrameMat
  );
  peBase.position.set(0, 0.11, 0);
  peBase.receiveShadow = true;
  photoelectricGroup.add(peBase);

  const peCradleLeft = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.48, 1.25, 2, 0.03),
    darkFrameMat
  );
  peCradleLeft.position.set(-1.1, 0.42, 0);
  const peCradleRight = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.48, 1.25, 2, 0.03),
    darkFrameMat
  );
  peCradleRight.position.set(1.1, 0.42, 0);
  photoelectricGroup.add(peCradleLeft, peCradleRight);

  const peBulb = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 2.8, 32, 1, true), glassCylMat);
  peBulb.rotation.z = Math.PI / 2;
  peBulb.position.set(0, 1.6, 0);
  photoelectricGroup.add(peBulb);

  // Hemispherical quartz vacuum phototube domes & machined end-caps
  const peDomeLeft = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glassCylMat
  );
  peDomeLeft.rotation.z = Math.PI / 2;
  peDomeLeft.position.set(-1.4, 1.6, 0);
  const peDomeRight = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glassCylMat
  );
  peDomeRight.rotation.z = -Math.PI / 2;
  peDomeRight.position.set(1.4, 1.6, 0);
  const peCapLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.24, 20), brassMat);
  peCapLeft.rotation.z = Math.PI / 2;
  peCapLeft.position.set(-2.52, 1.6, 0);
  const peCapRight = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.24, 20), brassMat);
  peCapRight.rotation.z = Math.PI / 2;
  peCapRight.position.set(2.52, 1.6, 0);
  photoelectricGroup.add(peDomeLeft, peDomeRight, peCapLeft, peCapRight);

  const peCathode = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 0.06, 24, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 })
  );
  peCathode.rotation.x = Math.PI / 2;
  peCathode.position.set(-1.1, 1.6, 0);
  peCathode.userData = {
    draggableParam: 'targetMetalWorkFunction',
    min: 2.0,
    max: 5.5,
    step: 0.1,
    label: 'Fungsi Kerja W (eV)',
  };
  const peCathodeStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.35, 12),
    brushedSteelMat
  );
  peCathodeStem.rotation.z = Math.PI / 2;
  peCathodeStem.position.set(-1.82, 1.6, 0);
  photoelectricGroup.add(peCathode, peCathodeStem);

  // Grounded UV Monochromator Lamp Housing on Articulated Stand at top-left
  const uvStandRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 3.3, 16),
    brushedSteelMat
  );
  uvStandRod.position.set(-3.1, 1.75, 0);
  const uvLampHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.95, 22),
    darkFrameMat
  );
  uvLampHousing.position.set(-2.58, 3.22, 0);
  uvLampHousing.rotation.z = -0.65;
  const uvLampLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.1, 20),
    new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x8b5cf6,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    })
  );
  uvLampLens.position.set(-2.3, 2.86, 0);
  uvLampLens.rotation.z = -0.65;
  photoelectricGroup.add(uvStandRod, uvLampHousing, uvLampLens);

  // UV / Monochromatic Incident Photon Beam Cone illuminating Cathode from top-left
  const peIncidentBeamMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const peIncidentBeam = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 2.15, 20, 1, true),
    peIncidentBeamMat
  );
  peIncidentBeam.position.set(-1.75, 2.35, 0);
  peIncidentBeam.rotation.z = -0.65;
  photoelectricGroup.add(peIncidentBeam);

  const peAnode = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 12, 28), brassMat);
  peAnode.rotation.y = Math.PI / 2;
  peAnode.position.set(1.1, 1.6, 0);
  peAnode.userData = {
    draggableParam: 'stoppingPotential',
    min: 0,
    max: 5.0,
    step: 0.1,
    label: 'Potensial Penghenti V₀',
  };
  const peAnodeStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.35, 12),
    brassMat
  );
  peAnodeStem.rotation.z = Math.PI / 2;
  peAnodeStem.position.set(1.82, 1.6, 0);
  photoelectricGroup.add(peAnode, peAnodeStem);

  // Grounded Digital Picoammeter & Stopping-Potential Console wired to phototube
  const peMeterConsole = new THREE.Mesh(
    new RoundedBoxGeometry(1.85, 0.92, 1.1, 3, 0.04),
    darkFrameMat
  );
  peMeterConsole.position.set(2.6, 0.65, 1.15);
  peMeterConsole.castShadow = true;
  const peMeterTex = createInstrumentPanelTexture({
    title: 'PICOAMMETER & V₀',
    primaryText: 'V₀ = 1.50 V',
    secondaryText: 'Ek = 0.80 eV',
    accentHex: '#38bdf8',
  });
  disposableTextures.push(peMeterTex);
  if (peMeterTex) {
    const peScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.62),
      new THREE.MeshBasicMaterial({ map: peMeterTex })
    );
    peScreen.position.set(0, 0.08, 0.56);
    peMeterConsole.add(peScreen);
  }
  photoelectricGroup.add(peMeterConsole);

  const PE_PARTICLES_COUNT = 30;
  const peParticleGeo = new THREE.SphereGeometry(0.06, 10, 10);
  const peParticleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const peParticlePool = createInstancedParticlePool(
    PE_PARTICLES_COUNT,
    peParticleGeo,
    peParticleMat,
    photoelectricGroup
  );
  peParticlePool.mesh.frustumCulled = false;

  // Incident monochromatic photon wave-packets streaming from UV monochromator lens to cathode
  const PE_PHOTONS_COUNT = 10;
  const pePhotonMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
  const pePhotonPool = createInstancedParticlePool(
    PE_PHOTONS_COUNT,
    new THREE.SphereGeometry(0.055, 10, 10),
    pePhotonMat,
    photoelectricGroup
  );
  pePhotonPool.mesh.frustumCulled = false;

  // =========================================================
  // 5. 1D COLLISION MOMENTUM 3D GROUP (AIR-TRACK GLIDER CARTS)
  // =========================================================
  const collisionGroup = new THREE.Group();
  scene.add(collisionGroup);

  const airTrackRail = new THREE.Mesh(
    new RoundedBoxGeometry(11.4, 0.28, 1.85, 3, 0.03),
    darkFrameMat
  );
  airTrackRail.position.set(0, 0.14, 0);
  airTrackRail.receiveShadow = true;
  collisionGroup.add(airTrackRail);

  const airTrackRidge = new THREE.Mesh(
    new RoundedBoxGeometry(11.3, 0.12, 0.72, 2, 0.02),
    brushedSteelMat
  );
  airTrackRidge.position.set(0, 0.32, 0);
  airTrackRidge.receiveShadow = true;
  collisionGroup.add(airTrackRidge);

  // Air blower compressor unit + hose at left end of air-track + dual U-shaped IR Photogate arches
  const airBlowerUnit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.64, 0.92, 24),
    darkFrameMat
  );
  airBlowerUnit.position.set(-5.85, 0.52, -0.85);
  airBlowerUnit.castShadow = true;
  const airHoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.85, 0.72, -0.35),
    new THREE.Vector3(-5.95, 0.55, 0.0),
    new THREE.Vector3(-5.65, 0.24, 0.0),
  ]);
  const airHose = new THREE.Mesh(
    new THREE.TubeGeometry(airHoseCurve, 18, 0.09, 12, false),
    brushedSteelMat
  );
  collisionGroup.add(airBlowerUnit, airHose);

  [-2.05, 2.05].forEach((gx, idx) => {
    const gateArchGroup = new THREE.Group();
    gateArchGroup.position.set(gx, 0.28, 0);
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), darkFrameMat);
    legF.position.set(0, 0.58, 0.76);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), darkFrameMat);
    legB.position.set(0, 0.58, -0.76);
    const crossBar = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.18, 1.68, 2, 0.02),
      darkFrameMat
    );
    crossBar.position.set(0, 1.18, 0);
    const ledDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x38bdf8 : 0xf59e0b })
    );
    ledDot.position.set(0, 1.28, 0);
    gateArchGroup.add(legF, legB, crossBar, ledDot);
    collisionGroup.add(gateArchGroup);
  });

  if (airTrackScaleTex) {
    const airTrackRuler = new THREE.Mesh(
      new THREE.PlaneGeometry(10.8, 0.24),
      new THREE.MeshBasicMaterial({
        map: airTrackScaleTex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    airTrackRuler.rotation.z = -Math.PI / 2;
    airTrackRuler.position.set(0, 0.15, 0.935);
    collisionGroup.add(airTrackRuler);
  }

  const createAirTrackGliderCart = (
    hullMat: THREE.Material,
    facingSign: 1 | -1,
    draggable: Record<string, unknown>
  ) => {
    const cartGroup = new THREE.Group();

    const hullMesh = new THREE.Mesh(
      new RoundedBoxGeometry(1.18, 0.44, 0.92, 3, 0.045),
      hullMat
    );
    hullMesh.position.set(0, 0.02, 0);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    hullMesh.userData = draggable;
    cartGroup.add(hullMesh);

    const topDeck = new THREE.Mesh(
      new RoundedBoxGeometry(0.86, 0.16, 0.74, 2, 0.025),
      brushedSteelMat
    );
    topDeck.position.set(0, 0.31, 0);
    topDeck.castShadow = true;
    topDeck.userData = draggable;
    const flagFin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.05), darkFrameMat);
    flagFin.position.set(0, 0.52, 0);
    cartGroup.add(topDeck, flagFin);

    const skirtGeo = new THREE.BoxGeometry(1.16, 0.16, 0.09);
    const skirtFront = new THREE.Mesh(skirtGeo, darkFrameMat);
    skirtFront.position.set(0, -0.22, 0.41);
    const skirtBack = new THREE.Mesh(skirtGeo, darkFrameMat);
    skirtBack.position.set(0, -0.22, -0.41);
    cartGroup.add(skirtFront, skirtBack);

    const bumperStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.24, 14),
      brushedSteelMat
    );
    bumperStem.rotation.z = Math.PI / 2;
    bumperStem.position.set(facingSign * 0.68, 0.02, 0);

    const bumperCoil = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.032, 10, 20),
      brassMat
    );
    bumperCoil.rotation.y = Math.PI / 2;
    bumperCoil.position.set(facingSign * 0.68, 0.02, 0);

    const bumperPlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.06, 0.32, 0.62, 2, 0.015),
      brushedSteelMat
    );
    bumperPlate.position.set(facingSign * 0.81, 0.02, 0);
    bumperPlate.castShadow = true;
    cartGroup.add(bumperStem, bumperCoil, bumperPlate);

    return cartGroup;
  };

  const cart1Mesh = createAirTrackGliderCart(primaryMassMat, 1, {
    draggableParam: 'initialVelocity',
    min: 1,
    max: 30,
    step: 1,
    label: 'Kecepatan Awal v₁',
  });
  cart1Mesh.position.set(-3.2, 0.62, 0);
  collisionGroup.add(cart1Mesh);

  const cart2Mesh = createAirTrackGliderCart(brassMat, -1, {
    draggableParam: 'collisionMass2',
    min: 0.5,
    max: 25,
    step: 0.5,
    label: 'Massa Benda m₂',
  });
  cart2Mesh.position.set(2.4, 0.62, 0);
  collisionGroup.add(cart2Mesh);

  // Impact Shockwave Ring at collision center
  const shockwaveRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const shockwaveRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.48, 32),
    shockwaveRingMat
  );
  shockwaveRing.position.set(0, 0.72, 0);
  shockwaveRing.rotation.y = Math.PI / 2;
  shockwaveRing.visible = false;
  collisionGroup.add(shockwaveRing);

  // Thermal energy dissipation glow orb at impact point when restitution e < 1 (inelastic heat loss)
  const impactHeatMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const impactHeatOrb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), impactHeatMat);
  impactHeatOrb.position.set(0, 0.62, 0);
  impactHeatOrb.visible = false;
  collisionGroup.add(impactHeatOrb);

  const collVec1 = createVectorArrowGroup(0x38bdf8);
  const collVec2 = createVectorArrowGroup(0xf59e0b);
  collisionGroup.add(collVec1, collVec2);

  // =========================================================
  // 6. UNIVERSAL GRAVITY & ORBITAL 3D GROUP
  // =========================================================
  const orbitalGroup = new THREE.Group();
  scene.add(orbitalGroup);

  const orbitalPlanetTex = createPlanetSurfaceTexture({
    baseHex: '#0284c7',
    accentHex: '#22c55e',
    style: 'terrestrial',
  });
  disposableTextures.push(orbitalPlanetTex);
  const centralPlanetMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: orbitalPlanetTex ?? null,
    roughness: 0.48,
    metalness: 0.1,
  });
  const centralPlanetBody = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 36, 36),
    centralPlanetMat
  );
  centralPlanetBody.position.set(0, 2.2, 0);
  centralPlanetBody.castShadow = true;
  centralPlanetBody.userData = {
    draggableParam: 'mass',
    min: 1,
    max: 50,
    step: 1,
    label: 'Massa Primer M₁',
  };
  const planetAtmoHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1.26, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  centralPlanetBody.add(planetAtmoHalo);
  orbitalGroup.add(centralPlanetBody);

  // 3D Gravitational Potential Well Funnel Grid V(r) = -G*M/r below the orbital plane
  const wellPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const r = 0.7 + u * 4.8;
    const y = 2.0 - 1.55 / Math.pow(r, 0.75);
    wellPts.push(new THREE.Vector2(r, y));
  }
  const gravityWellFunnel = new THREE.Mesh(
    new THREE.LatheGeometry(wellPts, 32),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.24,
    })
  );
  orbitalGroup.add(gravityWellFunnel);

  const satelliteBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), brassMat);
  satelliteBody.position.set(3.8, 2.2, 0);
  satelliteBody.castShadow = true;
  satelliteBody.userData = {
    draggableParam: 'separationDistance',
    min: 2,
    max: 30,
    step: 0.5,
    label: 'Jarak Pisah r',
  };
  // Multi-part Scientific Satellite Solar Wings & Parabolic Dish attached to satelliteBody
  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.65,
  });
  const solarWingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.88), solarPanelMat);
  solarWingLeft.position.set(0, 0, -0.68);
  solarWingLeft.userData = satelliteBody.userData;
  const solarWingRight = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.88), solarPanelMat);
  solarWingRight.position.set(0, 0, 0.68);
  solarWingRight.userData = satelliteBody.userData;
  const satDish = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.14, 16, 1, true),
    brushedSteelMat
  );
  satDish.rotation.z = Math.PI / 2;
  satDish.position.set(-0.34, 0, 0);
  satelliteBody.add(solarWingLeft, solarWingRight, satDish);
  orbitalGroup.add(satelliteBody);

  const orbitRingMesh = new THREE.Mesh(
    new THREE.RingGeometry(3.75, 3.83, 64),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    })
  );
  orbitRingMesh.rotation.x = -Math.PI / 2;
  orbitRingMesh.position.set(0, 2.2, 0);
  orbitalGroup.add(orbitRingMesh);

  const gravVec1 = createVectorArrowGroup(0x10b981);
  const gravVec2 = createVectorArrowGroup(0xf43f5e);
  orbitalGroup.add(gravVec1, gravVec2);

  // =========================================================
  // 7. LIVE 3D MECHANICAL ENERGY COLUMN HUD (Ek / Ep / Etot)
  // =========================================================
  const energyWidgetGroup = new THREE.Group();
  energyWidgetGroup.position.set(3.55, 0.15, -2.05);
  scene.add(energyWidgetGroup);

  const energyPedestal = new THREE.Mesh(
    new RoundedBoxGeometry(1.65, 0.14, 0.72, 2, 0.03),
    darkFrameMat
  );
  energyWidgetGroup.add(energyPedestal);

  const createEnergyBar = (xOffset: number, colorHex: number) => {
    const barMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.3,
    });
    const barGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.8, 18);
    barGeo.translate(0, 0.9, 0);
    const barMesh = new THREE.Mesh(barGeo, barMat);
    barMesh.position.set(xOffset, 0.08, 0);
    energyWidgetGroup.add(barMesh);
    return barMesh;
  };

  const ekBarMesh = createEnergyBar(-0.48, 0x38bdf8); // Kinetic Energy (Cyan)
  const epBarMesh = createEnergyBar(0, 0xf59e0b); // Potential Energy (Amber)
  const etotBarMesh = createEnergyBar(0.48, 0x10b981); // Total Energy (Emerald)

  // =========================================================
  // 8. MELDE STANDING WAVE RESONANCE 3D GROUP
  // =========================================================
  const meldeGroup = new THREE.Group();
  scene.add(meldeGroup);

  const meldeBench = new THREE.Mesh(
    new RoundedBoxGeometry(10.8, 0.22, 1.45, 3, 0.04),
    darkFrameMat
  );
  meldeBench.position.set(0, 0.11, 0);
  meldeBench.receiveShadow = true;
  meldeGroup.add(meldeBench);

  if (airTrackScaleTex) {
    const meldeRuler = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 0.36),
      new THREE.MeshBasicMaterial({
        map: airTrackScaleTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    meldeRuler.rotation.x = -Math.PI / 2;
    meldeRuler.rotation.z = -Math.PI / 2;
    meldeRuler.position.set(0, 0.226, 0.48);
    meldeGroup.add(meldeRuler);
  }

  // Electromagnetic vibrator box on left (-4.2)
  const vibratorHousing = new THREE.Mesh(
    new RoundedBoxGeometry(1.18, 1.32, 1.12, 3, 0.04),
    darkFrameMat
  );
  vibratorHousing.position.set(-4.35, 0.88, 0);
  vibratorHousing.castShadow = true;
  vibratorHousing.userData = {
    draggableParam: 'waveFrequency',
    min: 10,
    max: 120,
    step: 1,
    label: 'Frekuensi Vibrator f (Hz)',
  };
  meldeGroup.add(vibratorHousing);

  const meldeScreenTex = createInstrumentPanelTexture({
    title: 'MELDE GENERATOR',
    primaryText: '50.0 Hz',
    secondaryText: 'n = 2.0 perut',
    accentHex: '#38bdf8',
  });
  disposableTextures.push(meldeScreenTex);
  if (meldeScreenTex) {
    const meldeScreenPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.48),
      new THREE.MeshBasicMaterial({ map: meldeScreenTex })
    );
    meldeScreenPlane.position.set(-4.35, 1.02, 0.57);
    meldeGroup.add(meldeScreenPlane);
  }

  const vibratorProng = new THREE.Mesh(
    new RoundedBoxGeometry(0.55, 0.08, 0.12, 2, 0.02),
    brassMat
  );
  vibratorProng.position.set(-3.6, 1.35, 0);
  vibratorProng.userData = vibratorHousing.userData;
  meldeGroup.add(vibratorProng);

  // Pulley assembly carrier on right (moves with stringLength)
  const meldePulleyCarrier = new THREE.Group();
  meldePulleyCarrier.position.set(3.6, 0.22, 0);
  meldeGroup.add(meldePulleyCarrier);

  const pulleyBracket = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 1.24, 0.42, 2, 0.03),
    brushedSteelMat
  );
  pulleyBracket.position.set(0, 0.62, 0);
  pulleyBracket.userData = {
    draggableParam: 'stringLength',
    min: 0.5,
    max: 2.5,
    step: 0.05,
    label: 'Panjang Dawai L (m)',
  };
  const pulleyWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.12, 28),
    brassMat
  );
  pulleyWheel.rotation.x = Math.PI / 2;
  pulleyWheel.position.set(0.24, 1.13, 0);
  pulleyWheel.userData = pulleyBracket.userData;
  meldePulleyCarrier.add(pulleyBracket, pulleyWheel);

  const verticalDropCord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.0, 10),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  verticalDropCord.position.set(0.56, 0.65, 0);
  meldePulleyCarrier.add(verticalDropCord);

  const meldeHangingMass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.54, 24),
    brassMat
  );
  meldeHangingMass.position.set(0.56, 0.15, 0);
  meldeHangingMass.castShadow = true;
  meldeHangingMass.userData = {
    draggableParam: 'mass',
    min: 0.05,
    max: 1.5,
    step: 0.05,
    label: 'Massa Beban m (kg)',
  };
  meldePulleyCarrier.add(meldeHangingMass);

  const meldeTensionArrow = createVectorArrowGroup(0xf43f5e);
  meldeGroup.add(meldeTensionArrow);

  // 81-vertex dynamic standing wave line + upper & lower ghost envelope lines
  const MELDE_SAMPLES = 81;
  const meldeWavePos = new Float32Array(MELDE_SAMPLES * 3);
  const meldeEnvUpPos = new Float32Array(MELDE_SAMPLES * 3);
  const meldeEnvLowPos = new Float32Array(MELDE_SAMPLES * 3);

  const meldeWaveGeo = new THREE.BufferGeometry();
  meldeWaveGeo.setAttribute('position', new THREE.BufferAttribute(meldeWavePos, 3));
  const meldeWaveLine = new THREE.Line(
    meldeWaveGeo,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
  );

  const meldeEnvUpGeo = new THREE.BufferGeometry();
  meldeEnvUpGeo.setAttribute('position', new THREE.BufferAttribute(meldeEnvUpPos, 3));
  const meldeEnvUpLine = new THREE.Line(
    meldeEnvUpGeo,
    new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 0.14,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.55,
    })
  );

  const meldeEnvLowGeo = new THREE.BufferGeometry();
  meldeEnvLowGeo.setAttribute('position', new THREE.BufferAttribute(meldeEnvLowPos, 3));
  const meldeEnvLowLine = new THREE.Line(
    meldeEnvLowGeo,
    new THREE.LineDashedMaterial({
      color: 0x22d3ee,
      dashSize: 0.14,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.55,
    })
  );
  meldeGroup.add(meldeWaveLine, meldeEnvUpLine, meldeEnvLowLine);

  // Node (cyan spheres) & Antinode (emerald spheres) markers
  const MAX_MELDE_MARKERS = 16;
  const meldeNodePool = createInstancedParticlePool(
    MAX_MELDE_MARKERS,
    new THREE.SphereGeometry(0.068, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
    meldeGroup
  );
  const meldeAntinodePool = createInstancedParticlePool(
    MAX_MELDE_MARKERS,
    new THREE.SphereGeometry(0.075, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    meldeGroup
  );

  // =========================================================
  // 8. FARADAY-LENZ ELECTROMAGNETIC INDUCTION 3D GROUP
  // =========================================================
  const faradayGroup = new THREE.Group();
  faradayGroup.visible = false;
  scene.add(faradayGroup);

  const faradayBase = new THREE.Mesh(
    new RoundedBoxGeometry(8.6, 0.28, 3.4, 3, 0.04),
    darkFrameMat
  );
  faradayBase.position.set(0, 0.14, 0);
  faradayBase.receiveShadow = true;
  faradayGroup.add(faradayBase);

  // Solenoid acrylic bobbin + end flanges centered at (-0.65, 1.48, 0)
  const solenoidPedestal = new THREE.Mesh(
    new RoundedBoxGeometry(2.6, 0.68, 1.35, 2, 0.025),
    darkFrameMat
  );
  solenoidPedestal.position.set(-0.65, 0.62, 0);
  solenoidPedestal.castShadow = true;
  faradayGroup.add(solenoidPedestal);

  const bobbinTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 2.24, 28, 1, true),
    glassCylMat
  );
  bobbinTube.rotation.z = Math.PI / 2;
  bobbinTube.position.set(-0.65, 1.48, 0);
  bobbinTube.name = 'Solenoida Induksi Faraday (N Lilitan)';
  bobbinTube.userData = {
    draggableParam: 'coilTurnsN',
    min: 20,
    max: 400,
    step: 10,
    label: 'Jumlah Lilitan (N)',
  };
  faradayGroup.add(bobbinTube);

  [-1.76, 0.46].forEach((fx) => {
    const flange = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.94, 32),
      new THREE.MeshStandardMaterial({ color: 0x334155, side: THREE.DoubleSide, roughness: 0.45 })
    );
    flange.rotation.y = Math.PI / 2;
    flange.position.set(fx, 1.48, 0);
    faradayGroup.add(flange);
  });

  const copperCoilMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.88,
    roughness: 0.22,
    emissive: 0x78350f,
    emissiveIntensity: 0.15,
  });
  const MAX_FARADAY_COILS = 26;
  const coilRingGeo = new THREE.TorusGeometry(0.7, 0.044, 12, 32);
  coilRingGeo.rotateY(Math.PI / 2);
  const faradayCoilRings: THREE.Mesh[] = [];
  for (let i = 0; i < MAX_FARADAY_COILS; i++) {
    const ring = new THREE.Mesh(coilRingGeo, copperCoilMat);
    ring.position.set(-1.66 + (i / (MAX_FARADAY_COILS - 1)) * 2.02, 1.48, 0);
    ring.castShadow = true;
    ring.userData = bobbinTube.userData;
    faradayGroup.add(ring);
    faradayCoilRings.push(ring);
  }

  // Linear actuator stand + reciprocating Neodymium N-S bar magnet
  const actuatorBox = new THREE.Mesh(
    new RoundedBoxGeometry(1.05, 0.95, 1.2, 2, 0.03),
    darkFrameMat
  );
  actuatorBox.position.set(-3.55, 0.75, 0);
  actuatorBox.castShadow = true;
  actuatorBox.name = 'Aktuator Osilator Magnet Neodymium';
  actuatorBox.userData = {
    draggableParam: 'magnetOscillationHz',
    min: 0.2,
    max: 4.0,
    step: 0.1,
    label: 'Frekuensi Osilasi (Hz)',
  };
  faradayGroup.add(actuatorBox);

  const actuatorShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.2, 12),
    brushedSteelMat
  );
  actuatorShaft.rotation.z = Math.PI / 2;
  actuatorShaft.position.set(-2.95, 1.48, 0);
  faradayGroup.add(actuatorShaft);

  const magnetAssembly = new THREE.Group();
  magnetAssembly.position.set(-2.15, 1.48, 0);
  faradayGroup.add(magnetAssembly);

  const magnetSouth = new THREE.Mesh(
    new RoundedBoxGeometry(0.72, 0.42, 0.42, 2, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.35, roughness: 0.32 })
  );
  magnetSouth.position.x = -0.36;
  magnetSouth.castShadow = true;
  magnetSouth.name = 'Magnet Batang Neodymium (Kutub S–N)';
  magnetSouth.userData = actuatorBox.userData;

  const magnetNorth = new THREE.Mesh(
    new RoundedBoxGeometry(0.72, 0.42, 0.42, 2, 0.025),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.35, roughness: 0.32 })
  );
  magnetNorth.position.x = 0.36;
  magnetNorth.castShadow = true;
  magnetNorth.name = 'Magnet Batang Neodymium (Kutub S–N)';
  magnetNorth.userData = actuatorBox.userData;
  magnetAssembly.add(magnetSouth, magnetNorth);

  // Magnetic flux lines emerging from North pole
  const fluxLineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.68,
  });
  const fluxLines: THREE.Line[] = [];
  [-0.22, -0.1, 0, 0.1, 0.22].forEach((offsetY) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.7, offsetY * 0.5, 0),
      new THREE.Vector3(1.15, offsetY * 1.4, 0),
      new THREE.Vector3(1.65, offsetY * 2.2, 0),
    ]);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(18));
    const line = new THREE.Line(lineGeo, fluxLineMat);
    magnetAssembly.add(line);
    fluxLines.push(line);
  });

  // Lenz Law opposing induced B-field arrow above solenoid
  const lenzOpposeArrow = createVectorArrowGroup(0xf59e0b);
  lenzOpposeArrow.visible = false;
  faradayGroup.add(lenzOpposeArrow);

  // Right-side Galvanometer + Load Resistor + Incandescent Filament Bulb
  const faradayGalvoBox = new THREE.Mesh(
    new RoundedBoxGeometry(1.38, 1.32, 0.92, 3, 0.04),
    darkFrameMat
  );
  faradayGalvoBox.position.set(2.25, 0.94, 0.22);
  faradayGalvoBox.castShadow = true;
  faradayGroup.add(faradayGalvoBox);

  const faradayGalvoDialTex = createAnalogGaugeDialTexture({
    min: -10,
    max: 10,
    majorDivisions: 4,
    title: 'GALVANO ±',
    unit: 'V / mA',
  });
  disposableTextures.push(faradayGalvoDialTex);
  const faradayGalvoDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 36),
    new THREE.MeshBasicMaterial({ map: faradayGalvoDialTex ?? undefined })
  );
  faradayGalvoDial.position.set(2.25, 1.02, 0.695);
  faradayGroup.add(faradayGalvoDial);

  const faradayNeedlePivot = new THREE.Group();
  faradayNeedlePivot.position.set(2.25, 1.02, 0.71);
  const faradayNeedleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.36, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e })
  );
  faradayNeedleMesh.position.y = 0.14;
  faradayNeedlePivot.add(faradayNeedleMesh);
  faradayGroup.add(faradayNeedlePivot);

  // Load resistor + incandescent filament bulb on pedestal
  const bulbSocket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.32, 20),
    brassMat
  );
  bulbSocket.position.set(3.55, 0.44, 0.25);
  bulbSocket.userData = {
    draggableParam: 'loadResistanceOhm',
    min: 2,
    max: 50,
    step: 1,
    label: 'Hambatan Beban R (Ω)',
  };
  const bulbGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 24, 24),
    glassCylMat
  );
  bulbGlass.position.set(3.55, 0.86, 0.25);
  bulbGlass.userData = bulbSocket.userData;

  const bulbFilamentMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });
  const bulbFilament = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.022, 8, 20),
    bulbFilamentMat
  );
  bulbFilament.position.set(3.55, 0.84, 0.25);
  const bulbPointLight = new THREE.PointLight(0xfbbf24, 0, 4.5);
  bulbPointLight.position.set(3.55, 0.9, 0.4);
  faradayGroup.add(bulbSocket, bulbGlass, bulbFilament, bulbPointLight);

  // Connecting copper wire from solenoid to galvanometer & bulb
  const faradayWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.38, 0.78, 0.45),
    new THREE.Vector3(1.1, 0.42, 0.55),
    new THREE.Vector3(1.85, 0.52, 0.45),
    new THREE.Vector3(2.95, 0.42, 0.35),
    new THREE.Vector3(3.55, 0.38, 0.25),
    new THREE.Vector3(2.85, 0.42, -0.35),
    new THREE.Vector3(0.38, 0.78, -0.45),
  ]);
  faradayGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(faradayWireCurve, 36, 0.028, 8, false), copperCoilMat)
  );

  // Live Faraday Oscilloscope Board showing Φ(t) vs ε(t) quadrature + numeric telemetry
  const faradayOscCanvas = document.createElement('canvas');
  faradayOscCanvas.width = 512;
  faradayOscCanvas.height = 224;
  const faradayOscTex = new THREE.CanvasTexture(faradayOscCanvas);
  faradayOscTex.colorSpace = THREE.SRGBColorSpace;
  disposableTextures.push(faradayOscTex);

  const faradayOscHousing = new THREE.Mesh(
    new RoundedBoxGeometry(3.35, 1.56, 0.16, 2, 0.03),
    darkFrameMat
  );
  faradayOscHousing.position.set(1.05, 2.92, -1.28);
  const faradayOscScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.12, 1.36),
    new THREE.MeshBasicMaterial({ map: faradayOscTex })
  );
  faradayOscScreen.position.set(1.05, 2.92, -1.19);
  faradayGroup.add(faradayOscHousing, faradayOscScreen);

  let lastCollisionImpactIndex = -1;
  let lastFringeKey = '';
  let lastPsuKey = '';
  let lastPePanelKey = '';
  let lastMeldePanelKey = '';
  let lastFaradayOscKey = '';

  const _rigOrigin1 = new THREE.Vector3();
  const _rigOrigin2 = new THREE.Vector3();
  const _rigDir1 = new THREE.Vector3();
  const _rigDir2 = new THREE.Vector3();
  const _rigUp = new THREE.Vector3(0, 1, 0);
  const _rigDown = new THREE.Vector3(0, -1, 0);

  const update = (ctx: PhysicsRigUpdateContext, curEk = 0, curEp = 0) => {
    const {
      params: p,
      metrics: m,
      simTime: t,
      nowSec,
      showVectors: showVec,
      isLite,
      particleScale = 1.0,
      isSimTimeAdvancing,
    } = ctx;

    applyBorosilicateLiteMode(glassCylMat, isLite);

    collisionGroup.visible = p.mode === 'collision-momentum';
    orbitalGroup.visible = p.mode === 'orbital-gravity' || (p.mode as string) === 'gravity-orbital';
    stokesGroup.visible = p.mode === 'stokes-viscosity';
    wheatstoneGroup.visible = p.mode === 'ohm-wheatstone';
    youngSlitGroup.visible = p.mode === 'optics-young-slit';
    photoelectricGroup.visible = p.mode === 'photoelectric-planck';
    meldeGroup.visible = p.mode === 'standing-wave-melde';
    faradayGroup.visible = p.mode === 'faraday-induction';

    const showEnergyBars =
      p.mode === 'newton-incline' ||
      p.mode === 'projectile-gravity' ||
      (p.mode as string) === 'projectile-motion' ||
      p.mode === 'spring-hooke' ||
      p.mode === 'pendulum-harmonic';
    energyWidgetGroup.visible = showEnergyBars;

    if (showEnergyBars) {
      const epFallback = m.mode === 'spring-hooke' ? m.springPotentialEnergy : 0;
      const split = computeMechanicalEnergySplit(
        curEk,
        curEp || epFallback
      );
      ekBarMesh.scale.y = THREE.MathUtils.lerp(ekBarMesh.scale.y, split.ekNorm, 0.25);
      epBarMesh.scale.y = THREE.MathUtils.lerp(epBarMesh.scale.y, split.epNorm, 0.25);
      etotBarMesh.scale.y = THREE.MathUtils.lerp(etotBarMesh.scale.y, split.etotNorm, 0.25);
    }

    if (m.mode === 'collision-momentum') {
      const collState = computeCollisionCartKinematics(p, m, t);
      const impactT = 1.5;
      const cycle = ((t % 3.2) + 3.2) % 3.2;

      const compFactor = 1 - collState.bumperCompression * 0.12;
      cart1Mesh.scale.set(collState.cart1Scale * compFactor, collState.cart1Scale, collState.cart1Scale);
      cart2Mesh.scale.set(collState.cart2Scale * compFactor, collState.cart2Scale, collState.cart2Scale);
      cart1Mesh.position.set(collState.cart1X, 0.56, 0);
      cart2Mesh.position.set(collState.cart2X, 0.56, 0);

      const cycleIndex = Math.floor(t / 3.2);
      if (collState.inPostCollision) {
        if (isSimTimeAdvancing && lastCollisionImpactIndex !== cycleIndex) {
          lastCollisionImpactIndex = cycleIndex;
          labSound.playCollisionThud(p.restitutionCoeff ?? 1.0);
        }
      } else if (cycle < 0.4) {
        lastCollisionImpactIndex = -1;
      }

      const shock = computeCollisionShockwaveState(cycle, impactT);
      shockwaveRing.visible = shock.visible;
      if (shock.visible) {
        shockwaveRing.position.x = 0.5 * (collState.cart1X + collState.cart2X);
        shockwaveRing.scale.setScalar(shock.scale);
        shockwaveRingMat.opacity = shock.opacity;
      }

      impactHeatOrb.visible = collState.impactHeatGlow > 0.02;
      if (impactHeatOrb.visible) {
        impactHeatOrb.position.set(0.5 * (collState.cart1X + collState.cart2X), 0.62, 0);
        impactHeatOrb.scale.setScalar(0.8 + collState.impactHeatGlow * 0.85);
        impactHeatMat.opacity = collState.impactHeatGlow * 0.68;
      }

      if (showVec) {
        const len1 = Math.min(2.2, Math.abs(collState.v1Current) * 0.14);
        if (len1 > 0.05) {
          _rigOrigin1.set(collState.cart1X, 1.38, 0);
          _rigDir1.set(collState.v1Current >= 0 ? 1 : -1, 0, 0);
          orientAndScaleVectorArrow(collVec1, _rigOrigin1, _rigDir1, len1);
        } else {
          collVec1.visible = false;
        }
        const len2 = Math.min(2.2, Math.abs(collState.v2Current) * 0.14);
        if (len2 > 0.05) {
          _rigOrigin2.set(collState.cart2X, 1.38, 0);
          _rigDir2.set(collState.v2Current >= 0 ? 1 : -1, 0, 0);
          orientAndScaleVectorArrow(collVec2, _rigOrigin2, _rigDir2, len2);
        } else {
          collVec2.visible = false;
        }
      } else {
        collVec1.visible = false;
        collVec2.visible = false;
      }
    } else if (m.mode === 'orbital-gravity') {
      const sepDist = Math.max(2, p.separationDistance || 5);
      const orbitRadius = Math.max(2.0, Math.min(5.2, sepDist * 0.35));
      const orbDyn = computeOrbitalAngularVelocity(p.mass, sepDist);
      const angle = t * orbDyn.angularSpeedRadS;
      const sx = Math.cos(angle) * orbitRadius;
      const sz = Math.sin(angle) * orbitRadius;
      centralPlanetBody.rotation.y = nowSec * 0.25;
      centralPlanetBody.scale.setScalar(orbDyn.planetScale);
      gravityWellFunnel.scale.set(1, orbDyn.wellDepthScale, 1);
      satelliteBody.position.set(sx, 2.2, sz);
      satelliteBody.rotation.y = -angle;
      orbitRingMesh.scale.setScalar(orbitRadius / 3.79);

      if (showVec) {
        _rigDir1.set(sx, 0, sz).normalize();
        _rigDir2.copy(_rigDir1).negate();
        const arrowLen = Math.max(
          0.55,
          Math.min(2.1, Math.log10(Math.max(10, m.universalGravityForce * 1e4)) * 0.45)
        );
        _rigOrigin1.set(0, 2.2, 0);
        _rigOrigin2.set(sx, 2.2, sz);
        orientAndScaleVectorArrow(gravVec1, _rigOrigin1, _rigDir1, arrowLen);
        orientAndScaleVectorArrow(gravVec2, _rigOrigin2, _rigDir2, arrowLen);
      } else {
        gravVec1.visible = false;
        gravVec2.visible = false;
      }
    } else if (m.mode === 'stokes-viscosity') {
      const stokesState = computeStokesDropState(p, m, t);
      stokesSphere.position.y = stokesState.sphereY;
      const rScale = Math.max(0.32, Math.min(1.65, (p.sphereRadius ?? 5) / 10));
      stokesSphere.scale.setScalar(rScale);
      liquidMat.color.setHex(stokesState.fluidColorHex);
      liquidMat.opacity = stokesState.fluidOpacity;

      stokesWakeRing.visible = !stokesState.isFloating;
      stokesWakeRing.position.set(0, Math.min(4.7, stokesState.sphereY + 0.22 * rScale), 0);
      stokesWakeRing.scale.setScalar((0.75 + 0.18 * Math.sin(nowSec * 6)) * rScale);

      if (showVec) {
        _rigOrigin1.set(0, stokesState.sphereY, 0);
        orientAndScaleVectorArrow(stokesGravArrow, _rigOrigin1, _rigDown, stokesState.weightArrowLen);

        // Upward Archimedes Buoyancy F_b (emerald, slightly left) & Stokes Drag F_d (sky, slightly right)
        // At terminal velocity, F_b + F_d balances W cleanly!
        _rigOrigin2.set(-0.22, stokesState.sphereY, 0);
        orientAndScaleVectorArrow(
          stokesBuoyancyArrow,
          _rigOrigin2,
          _rigUp,
          stokesState.buoyancyArrowLen
        );
        if (stokesState.dragArrowLen > 0.05) {
          _rigOrigin1.set(0.22, stokesState.sphereY, 0);
          orientAndScaleVectorArrow(stokesDragArrow, _rigOrigin1, _rigUp, stokesState.dragArrowLen);
        } else {
          stokesDragArrow.visible = false;
        }
      } else {
        stokesGravArrow.visible = false;
        stokesBuoyancyArrow.visible = false;
        stokesDragArrow.visible = false;
      }
    } else if (m.mode === 'ohm-wheatstone') {
      const r1 = p.resistorR1 ?? 100;
      const r2 = p.resistorR2 ?? 100;
      const r3 = p.resistorR3 ?? 100;
      const rx = p.resistorRx ?? 100;
      const vSource = p.circuitVoltage ?? 12;

      const needleState = computeWheatstoneNeedleAngle(r1, r2, r3, rx, m.galvanometerCurrent);
      galvoNeedle.rotation.y = THREE.MathUtils.lerp(
        galvoNeedle.rotation.y,
        needleState.angleRad + (!needleState.isBalanced ? Math.sin(nowSec * 6) * 0.012 : 0),
        0.16
      );
      galvoBalanceRingMat.color.setHex(needleState.isBalanced ? 0x10b981 : 0xf59e0b);
      galvoBalanceRingMat.opacity = needleState.isBalanced ? 0.82 : 0.25;

      // Animate electrical current carriers along the 4 diamond arms + central bridge wire (halts when balanced!)
      const currents = computeWheatstoneBranchCurrents(r1, r2, r3, rx, vSource);
      const speedTop = Math.min(2.2, currents.iBranchTopMa * 0.012);
      const speedBot = Math.min(2.2, currents.iBranchBottomMa * 0.012);
      const speedGalvo = currents.isBalanced ? 0 : Math.min(1.8, Math.abs(currents.iGalvoSignedMa) * 0.025);
      const galvoDir = currents.iGalvoSignedMa >= 0 ? 1 : -1;

      let dotIdx = 0;
      const placeArmDots = (a: THREE.Vector3, b: THREE.Vector3, spd: number, colorHex: number) => {
        for (let k = 0; k < WHEATSTONE_DOTS_PER_ARM; k++) {
          const u = ((nowSec * spd + k / WHEATSTONE_DOTS_PER_ARM) % 1 + 1) % 1;
          wheatstoneDotPool.setTransform(
            dotIdx,
            a.x + (b.x - a.x) * u,
            0.26,
            a.z + (b.z - a.z) * u,
            1.0
          );
          wheatstoneDotPool.setColor(dotIdx, colorHex);
          dotIdx++;
        }
      };
      placeArmDots(nodePositions.left, nodePositions.bottom, speedTop, 0x38bdf8);
      placeArmDots(nodePositions.bottom, nodePositions.right, speedTop, 0x38bdf8);
      placeArmDots(nodePositions.left, nodePositions.top, speedBot, 0xf59e0b);
      placeArmDots(nodePositions.top, nodePositions.right, speedBot, 0xf59e0b);
      // Central galvanometer bridge wire dots (top <-> bottom)
      for (let k = 0; k < WHEATSTONE_DOTS_PER_ARM; k++) {
        if (currents.isBalanced) {
          wheatstoneDotPool.setTransform(dotIdx, 0, -5, 0, 0.001);
        } else {
          const rawU = (nowSec * speedGalvo * galvoDir + k / WHEATSTONE_DOTS_PER_ARM) % 1;
          const u = (rawU + 1) % 1;
          const zPos = nodePositions.top.z + (nodePositions.bottom.z - nodePositions.top.z) * u;
          wheatstoneDotPool.setTransform(dotIdx, 0, 0.66, zPos, 1.0);
          wheatstoneDotPool.setColor(dotIdx, 0x10b981);
        }
        dotIdx++;
      }
      wheatstoneDotPool.commit(WHEATSTONE_TOTAL_DOTS);

      const psuKey = `${vSource.toFixed(1)}|${m.galvanometerCurrent.toFixed(2)}|${needleState.isBalanced}`;
      if (psuKey !== lastPsuKey) {
        lastPsuKey = psuKey;
        updateInstrumentPanelTexture(psuScreenTex, {
          title: 'DC POWER SUPPLY',
          primaryText: `${vSource.toFixed(1)} V`,
          secondaryText: needleState.isBalanced
            ? 'SEIMBANG (Ig = 0.00 mA)'
            : `Ig = ${m.galvanometerCurrent.toFixed(2)} mA`,
          accentHex: needleState.isBalanced ? '#10b981' : '#38bdf8',
        });
      }
    } else if (m.mode === 'optics-young-slit') {
      const wl = p.lightWavelength ?? 532;
      const dMm = p.slitDistance ?? 0.25;
      const screenLM = p.screenDistance ?? 1.5;
      const beamColor = wavelengthNmToHex(wl);
      (laserBeamLine.material as THREE.MeshBasicMaterial).color.setHex(beamColor);
      slitLineMat.color.setHex(beamColor);
      diffractionConeMat.color.setHex(beamColor);

      // Physically shift micro-slit separation with d (mm) and screen carrier with L (m)
      const visualSlitHalf = Math.max(0.035, Math.min(0.24, 0.035 + (dMm / 0.8) * 0.205));
      slitLeft.position.z = -visualSlitHalf;
      slitRight.position.z = visualSlitHalf;

      const screenX = Math.max(1.2, Math.min(4.8, 1.2 + ((screenLM - 0.5) / 2.5) * 3.6));
      screenCarrier.position.x = screenX;
      const coneLen = Math.max(1.8, screenX - -1.2);
      diffractionCone.scale.set(1, coneLen / 5.0, 1);
      diffractionCone.position.set(-1.2 + coneLen * 0.5, 1.2, 0);

      // Exact mm-calibrated Young interference + single-slit diffraction envelope I(y) = cos²(πdy/λL)·sinc²(πay/λL)
      const fringeKey = `${beamColor}:${dMm.toFixed(3)}:${screenLM.toFixed(2)}`;
      if (fringeKey !== lastFringeKey) {
        lastFringeKey = fringeKey;
        const ctx2d = fringeCanvas.getContext('2d');
        if (ctx2d) {
          ctx2d.fillStyle = '#050811';
          ctx2d.fillRect(0, 0, fringeCanvas.width, fringeCanvas.height);
          const rgbHex = beamColor.toString(16).padStart(6, '0');
          const pxPerMm = 230 / 20; // matches ruler below: ±20mm spans ±230px around center x=256
          for (let x = 0; x < fringeCanvas.width; x++) {
            const yMm = (x - 256) / pxPerMm;
            const { intensity } = computeYoungFringeIntensity(yMm, wl, dMm, screenLM);
            ctx2d.fillStyle = `#${rgbHex}`;
            ctx2d.globalAlpha = intensity;
            ctx2d.fillRect(x, 0, 1, fringeCanvas.height - 26);
          }
          // Calibrated mm scale bar along bottom of projection screen
          ctx2d.globalAlpha = 1.0;
          ctx2d.fillStyle = '#0f172a';
          ctx2d.fillRect(0, fringeCanvas.height - 26, fringeCanvas.width, 26);
          ctx2d.strokeStyle = '#94a3b8';
          ctx2d.fillStyle = '#e2e8f0';
          ctx2d.font = 'bold 12px monospace';
          for (let mm = -20; mm <= 20; mm += 5) {
            const sx = 256 + mm * pxPerMm;
            ctx2d.beginPath();
            ctx2d.moveTo(sx, fringeCanvas.height - 26);
            ctx2d.lineTo(sx, fringeCanvas.height - (mm % 10 === 0 ? 12 : 18));
            ctx2d.stroke();
            if (mm % 10 === 0) {
              ctx2d.fillText(`${mm}mm`, sx - 14, fringeCanvas.height - 2);
            }
          }
          fringeTexture.needsUpdate = true;
        }
      }
    } else if (m.mode === 'photoelectric-planck') {
      const emitted = m.photoelectricEmitted;
      // Derive wavelength strictly from photon frequency slider λ = c / f!
      const freq14 = p.photonFrequency ?? 8.5;
      const wl = photonFrequencyToWavelengthNm(freq14);
      const beamHex = wl < 390 ? 0x8b5cf6 : wavelengthNmToHex(wl);
      peIncidentBeamMat.color.setHex(beamHex);
      pePhotonMat.color.setHex(beamHex);
      (uvLampLens.material as THREE.MeshStandardMaterial).color.setHex(beamHex);
      (uvLampLens.material as THREE.MeshStandardMaterial).emissive.setHex(beamHex);
      const stopV = p.stoppingPotential ?? 1.5;
      const maxKe = m.photoelectricMaxKe;

      // Animate incident photon wave-packets streaming from UV lamp (-2.3, 2.86) to cathode (-1.1, 1.6)
      for (let i = 0; i < PE_PHOTONS_COUNT; i++) {
        const u = (nowSec * 1.45 + i / PE_PHOTONS_COUNT) % 1.0;
        const px = -2.3 + u * 1.22;
        const py = 2.86 - u * 1.26;
        const pz = Math.sin(u * Math.PI * 6 + i) * 0.08;
        pePhotonPool.setTransform(i, px, py, pz, 0.85);
      }
      pePhotonPool.commit(PE_PHOTONS_COUNT);

      const peKey = `${stopV.toFixed(2)}|${maxKe.toFixed(2)}|${freq14.toFixed(1)}|${emitted}`;
      if (peKey !== lastPePanelKey) {
        lastPePanelKey = peKey;
        updateInstrumentPanelTexture(peMeterTex, {
          title: 'PICOAMMETER & V₀',
          primaryText: `V₀ = ${stopV.toFixed(2)} V`,
          secondaryText: emitted
            ? `f=${freq14.toFixed(1)}e14 · Ek=${maxKe.toFixed(2)} eV`
            : `CUTOFF (f < f₀ · I=0)`,
          accentHex: emitted ? '#10b981' : '#f43f5e',
        });
      }

      if (!emitted) {
        peParticlePool.mesh.visible = false;
      } else {
        peParticlePool.mesh.visible = true;
        const activePeCount = Math.max(8, Math.round(PE_PARTICLES_COUNT * particleScale));
        const rateSpeed = 0.55 + Math.sqrt(Math.max(0.1, maxKe)) * 0.45;
        for (let idx = 0; idx < activePeCount; idx++) {
          const pFrac = (nowSec * rateSpeed + idx / activePeCount) % 1.0;
          const { x, reachesAnode } = computePhotoelectricElectronX(pFrac, maxKe, stopV);
          peParticlePool.setTransform(
            idx,
            x,
            1.6 + Math.sin(idx * 2) * 0.32,
            Math.cos(idx * 2) * 0.32,
            reachesAnode ? 1.0 : 0.82
          );
          peParticlePool.setColor(idx, reachesAnode ? 0x38bdf8 : 0xf59e0b);
        }
        peParticlePool.commit(activePeCount);
      }
    } else if (m.mode === 'standing-wave-melde') {
      const L = Math.max(0.5, Math.min(2.5, p.stringLength ?? 1.2));
      const freq = Math.max(5, p.waveFrequency ?? 50);
      const mu = Math.max(0.0005, p.linearMassDensity ?? 0.004);
      const nHarmonic = Math.max(0.5, Math.min(12, m.meldeHarmonicNumber || 2));
      const startX = -3.45;
      const visualSpan = 2.6 + ((L - 0.5) / 2.0) * 4.8; // 2.6 .. 7.4 world units
      const endX = startX + visualSpan;

      meldePulleyCarrier.position.set(endX - 0.24, 0.22, 0);
      pulleyWheel.rotation.z = -nowSec * 1.5;

      // Scale vertical drop cord thickness subtly with sqrt(linearMassDensity μ)
      const cordThickness = Math.max(0.7, Math.min(2.2, Math.sqrt(mu / 0.004)));
      verticalDropCord.scale.set(cordThickness, 1, cordThickness);

      const massScale = 0.72 + Math.min(0.65, (p.mass ?? 0.2) * 0.45);
      meldeHangingMass.scale.set(massScale, massScale, massScale);

      // Resonance amplification when nHarmonic is close to an integer
      const nearestInt = Math.max(1, Math.round(nHarmonic));
      const detune = Math.abs(nHarmonic - nearestInt);
      const resonanceFactor = 0.28 + 0.34 * Math.exp(-detune * detune * 18);
      const phase = Math.cos(nowSec * Math.min(26, freq * 0.38));

      vibratorProng.position.y = 1.35 + Math.sin(nowSec * 28) * 0.035;

      const waveAttr = meldeWaveGeo.getAttribute('position') as THREE.BufferAttribute;
      const envUpAttr = meldeEnvUpGeo.getAttribute('position') as THREE.BufferAttribute;
      const envLowAttr = meldeEnvLowGeo.getAttribute('position') as THREE.BufferAttribute;

      for (let i = 0; i < MELDE_SAMPLES; i++) {
        const u = i / (MELDE_SAMPLES - 1);
        const x = startX + u * visualSpan;
        const spatialSin = Math.sin(nHarmonic * Math.PI * u) * Math.sin(Math.PI * u * 0.98 + 0.03);
        const envY = resonanceFactor * Math.sin(nearestInt * Math.PI * u);
        const liveY = 1.35 + envY * phase + (detune > 0.08 ? 0.06 * spatialSin * Math.sin(nowSec * 15) : 0);

        waveAttr.setXYZ(i, x, liveY, 0);
        envUpAttr.setXYZ(i, x, 1.35 + Math.abs(envY), 0);
        envLowAttr.setXYZ(i, x, 1.35 - Math.abs(envY), 0);
      }
      waveAttr.needsUpdate = true;
      envUpAttr.needsUpdate = true;
      envLowAttr.needsUpdate = true;
      meldeEnvUpLine.computeLineDistances();
      meldeEnvLowLine.computeLineDistances();

      // Update node and antinode markers along string
      const nodeCount = Math.min(MAX_MELDE_MARKERS, nearestInt + 1);
      for (let k = 0; k < nodeCount; k++) {
        const uNode = k / nearestInt;
        meldeNodePool.setTransform(k, startX + uNode * visualSpan, 1.35, 0, 1.0);
      }
      meldeNodePool.commit(nodeCount);

      const antinodeCount = Math.min(MAX_MELDE_MARKERS, nearestInt);
      for (let k = 0; k < antinodeCount; k++) {
        const uAnti = (k + 0.5) / nearestInt;
        const antiY = 1.35 + resonanceFactor * (k % 2 === 0 ? 1 : -1) * phase;
        meldeAntinodePool.setTransform(k, startX + uAnti * visualSpan, antiY, 0, 1.0);
      }
      meldeAntinodePool.commit(antinodeCount);

      if (showVec) {
        _rigOrigin1.set(endX + 0.32, 0.35, 0);
        orientAndScaleVectorArrow(
          meldeTensionArrow,
          _rigOrigin1,
          _rigDown,
          Math.min(1.6, 0.45 + m.meldeTensionForce * 0.08)
        );
      } else {
        meldeTensionArrow.visible = false;
      }

      const meldeKey = `${freq.toFixed(0)}|${nHarmonic.toFixed(2)}|${m.meldeWaveSpeed.toFixed(1)}`;
      if (meldeKey !== lastMeldePanelKey) {
        lastMeldePanelKey = meldeKey;
        updateInstrumentPanelTexture(meldeScreenTex, {
          title: 'MELDE GENERATOR',
          primaryText: `${freq.toFixed(0)} Hz · v=${m.meldeWaveSpeed.toFixed(1)}m/s`,
          secondaryText: `Harmonik n = ${nHarmonic.toFixed(2)} perut`,
          accentHex: detune < 0.12 ? '#10b981' : '#38bdf8',
        });
      }
    } else if (m.mode === 'faraday-induction') {
      const fState = computeFaradayInductionVisualState(p, t);
      const bField = Math.max(0.05, p.magneticFieldTesla ?? 0.45);
      const omega = 2 * Math.PI * Math.max(0.05, p.magnetOscillationHz ?? 1.2);
      const phase = omega * Math.max(0, t);

      magnetAssembly.position.x = fState.magnetCenterX;
      actuatorShaft.scale.y = Math.max(0.4, (fState.magnetCenterX + 3.55) / 2.2);
      actuatorShaft.position.x = -3.55 + (fState.magnetCenterX + 3.55) * 0.5;

      // Update visible solenoid copper windings & cross-section radius
      for (let i = 0; i < MAX_FARADAY_COILS; i++) {
        faradayCoilRings[i].visible = i < fState.coilTurnsVisible;
        faradayCoilRings[i].scale.set(1, fState.coilRadiusScale, fState.coilRadiusScale);
      }
      bobbinTube.scale.set(1, fState.coilRadiusScale, fState.coilRadiusScale);

      // Flux line brightness & reach scales with magnetic field strength B
      fluxLineMat.opacity = Math.min(0.95, 0.25 + bField * 0.55);
      const bStretch = 0.75 + Math.min(0.85, bField * 0.65);
      fluxLines.forEach((fl) => fl.scale.set(bStretch, fState.coilRadiusScale, 1));

      // Center-zero Galvanometer needle & incandescent filament glow
      faradayNeedlePivot.rotation.z = THREE.MathUtils.lerp(
        faradayNeedlePivot.rotation.z,
        fState.galvoNeedleAngleRad,
        0.28
      );
      bulbFilamentMat.emissiveIntensity = 0.12 + fState.bulbGlow * 2.6;
      bulbPointLight.intensity = isLite ? 0 : fState.bulbGlow * 2.4;

      // Lenz Law opposing magnetic field vector above solenoid
      if (showVec && fState.lenzOpposingDirectionX !== 0) {
        _rigOrigin1.set(-0.65, 2.55, 0);
        _rigDir1.set(fState.lenzOpposingDirectionX, 0, 0);
        orientAndScaleVectorArrow(
          lenzOpposeArrow,
          _rigOrigin1,
          _rigDir1,
          Math.min(1.85, 0.55 + Math.abs(fState.instantEmfV) * 0.14)
        );
      } else {
        lenzOpposeArrow.visible = false;
      }

      // Live Faraday Oscilloscope canvas redraw (Φ(t) cyan cosine vs ε(t) amber sine)
      const oscKey = `${Math.round(phase * 18)}_${fState.peakEmfV.toFixed(2)}_${fState.instantFluxMwb.toFixed(2)}`;
      if (oscKey !== lastFaradayOscKey) {
        lastFaradayOscKey = oscKey;
        const oCtx = faradayOscCanvas.getContext('2d');
        if (oCtx) {
          const W = faradayOscCanvas.width;
          const H = faradayOscCanvas.height;
          oCtx.fillStyle = '#070d19';
          oCtx.fillRect(0, 0, W, H);
          oCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          oCtx.lineWidth = 2;
          oCtx.strokeRect(2, 2, W - 4, H - 4);

          oCtx.fillStyle = '#94a3b8';
          oCtx.font = 'bold 13px monospace';
          oCtx.fillText('OSILOSKOP FARADAY–LENZ · Φ(t) vs ε(t)', 16, 22);

          // Zero centerline
          const midY = 104;
          oCtx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
          oCtx.beginPath();
          oCtx.moveTo(16, midY);
          oCtx.lineTo(W - 16, midY);
          oCtx.stroke();

          // Cyan Flux curve cos(θ)
          oCtx.strokeStyle = '#38bdf8';
          oCtx.lineWidth = 2.4;
          oCtx.beginPath();
          for (let px = 16; px <= W - 16; px += 4) {
            const u = (px - 16) / (W - 32);
            const theta = phase - (1 - u) * Math.PI * 4;
            const py = midY - Math.cos(theta) * 44;
            if (px === 16) oCtx.moveTo(px, py);
            else oCtx.lineTo(px, py);
          }
          oCtx.stroke();

          // Amber EMF curve sin(θ) (90 deg quadrature!)
          oCtx.strokeStyle = '#f59e0b';
          oCtx.lineWidth = 2.8;
          oCtx.beginPath();
          for (let px = 16; px <= W - 16; px += 4) {
            const u = (px - 16) / (W - 32);
            const theta = phase - (1 - u) * Math.PI * 4;
            const py = midY - Math.sin(theta) * 52;
            if (px === 16) oCtx.moveTo(px, py);
            else oCtx.lineTo(px, py);
          }
          oCtx.stroke();

          oCtx.fillStyle = '#38bdf8';
          oCtx.font = 'bold 13px monospace';
          oCtx.fillText(`Φ(t) = ${fState.instantFluxMwb.toFixed(2)} mWb`, 16, 184);

          oCtx.fillStyle = '#f59e0b';
          oCtx.fillText(`ε(t) = ${fState.instantEmfV >= 0 ? '+' : ''}${fState.instantEmfV.toFixed(2)} V (εₘₐₓ = ${fState.peakEmfV.toFixed(2)} V)`, 205, 184);

          oCtx.fillStyle = '#34d399';
          oCtx.fillText(`I(t) = ${fState.instantCurrentMa.toFixed(1)} mA · Iₘₐₓ = ${m.faradayPeakCurrentMa.toFixed(1)} mA · P = ${m.faradayAvgPowerW.toFixed(2)} W`, 16, 208);
          faradayOscTex.needsUpdate = true;
        }
      }
    }
  };

  return {
    stokesGroup,
    wheatstoneGroup,
    youngSlitGroup,
    photoelectricGroup,
    collisionGroup,
    orbitalGroup,
    meldeGroup,
    faradayGroup,
    energyWidgetGroup,
    stokesSphere,
    cart1Mesh,
    cart2Mesh,
    satelliteBody,
    meldeHangingMass,
    update,
    dispose: () => {
      fringeTexture.dispose();
      disposableTextures.forEach((tex) => tex?.dispose());
    },
  };
}

