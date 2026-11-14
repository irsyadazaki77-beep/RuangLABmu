import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  applyBorosilicateLiteMode,
  createBorosilicateGlassMaterial,
  createVectorArrowGroup,
  orientAndScaleVectorArrow,
  wavelengthNmToHex,
} from '../../utils/threeStudioKit';
import { PhysicsMetrics, PhysicsParams } from '../../utils/scienceEngine';
import { globalMultiApparatusEngine } from '../../utils/engines/multiApparatusEngine';
import { labSound } from '../../utils/soundEngine';
import {
  computeCollisionShockwaveState,
  computeMechanicalEnergySplit,
  computePhotoelectricElectronX,
  computeWheatstoneNeedleAngle,
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
  isSimTimeAdvancing: boolean;
}

export interface PhysicsSpecialRigsHandle {
  stokesGroup: THREE.Group;
  wheatstoneGroup: THREE.Group;
  youngSlitGroup: THREE.Group;
  photoelectricGroup: THREE.Group;
  collisionGroup: THREE.Group;
  orbitalGroup: THREE.Group;
  energyWidgetGroup: THREE.Group;
  stokesSphere: THREE.Mesh;
  cart1Mesh: THREE.Group;
  cart2Mesh: THREE.Group;
  satelliteBody: THREE.Mesh;
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

  // =========================================================
  // 1. STOKES VISCOSITY 3D GROUP
  // =========================================================
  const stokesGroup = new THREE.Group();
  scene.add(stokesGroup);

  const stokesStand = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.25, 3.0), darkFrameMat);
  stokesStand.position.set(0, 0.125, 0);
  stokesStand.receiveShadow = true;
  stokesGroup.add(stokesStand);

  const stokesPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 6.2, 16),
    brushedSteelMat
  );
  stokesPillar.position.set(-1.4, 3.1, 0);
  stokesPillar.castShadow = true;
  stokesGroup.add(stokesPillar);

  const glassCylMat = createBorosilicateGlassMaterial(initialLiteMode, {
    color: 0xe8f4fc,
    tintOpacity: 0.34,
    ior: 1.47,
    thickness: 0.55,
  });
  const stokesGlassCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 5.2, 32, 1, true),
    glassCylMat
  );
  stokesGlassCyl.position.set(0, 2.7, 0);
  stokesGroup.add(stokesGlassCyl);

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
  stokesLiquid.userData = {
    draggableParam: 'fluidViscosity',
    min: 0.1,
    max: 2.0,
    step: 0.05,
    label: 'Viskositas η',
  };
  stokesGroup.add(stokesLiquid);

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

  const stokesDragArrow = createVectorArrowGroup(0x38bdf8);
  const stokesGravArrow = createVectorArrowGroup(0xf43f5e);
  stokesGroup.add(stokesDragArrow, stokesGravArrow);

  // =========================================================
  // 2. OHM & WHEATSTONE BRIDGE 3D GROUP
  // =========================================================
  const wheatstoneGroup = new THREE.Group();
  scene.add(wheatstoneGroup);

  const circuitTable = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 0.2, 6.0),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
  );
  circuitTable.position.set(0, 0.1, 0);
  circuitTable.receiveShadow = true;
  wheatstoneGroup.add(circuitTable);

  const powerSupplyBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), darkFrameMat);
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
    wheatstoneGroup.add(post);
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
      new THREE.CylinderGeometry(0.035, 0.035, 2.2, 12),
      brushedSteelMat
    );
    lead.rotation.z = Math.PI / 2;
    const band1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.186, 0.186, 0.09, 18),
      new THREE.MeshBasicMaterial({ color: 0x1e293b })
    );
    band1.rotation.z = Math.PI / 2;
    band1.position.x = -0.32;
    const band2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.186, 0.186, 0.09, 18),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    band2.rotation.z = Math.PI / 2;
    band2.position.x = 0.28;
    rGroup.add(lead, body, band1, band2);
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
      new THREE.Vector3(-2.4, 0.68, -1.1),
      new THREE.Vector3(-2.85, 0.92, -0.55),
      new THREE.Vector3(-2.6, 0.52, -0.15),
      new THREE.Vector3(-2.35, 0.34, 0),
    ],
    0xef4444
  );
  addCurvedWire(
    [
      new THREE.Vector3(-2.1, 0.68, -1.1),
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
    new THREE.CylinderGeometry(0.92, 0.96, 0.36, 32),
    brushedSteelMat
  );
  galvoBox.position.set(0, 0.38, 0);
  galvoBox.castShadow = true;
  wheatstoneGroup.add(galvoBox);

  const galvoDialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 32),
    new THREE.MeshBasicMaterial({ color: 0x0f172a })
  );
  galvoDialFace.rotation.x = -Math.PI / 2;
  galvoDialFace.position.set(0, 0.565, 0);
  wheatstoneGroup.add(galvoDialFace);

  const galvoZeroTick = new THREE.Mesh(
    new THREE.PlaneGeometry(0.04, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  galvoZeroTick.rotation.x = -Math.PI / 2;
  galvoZeroTick.position.set(0, 0.57, -0.54);
  wheatstoneGroup.add(galvoZeroTick);

  // Balanced-bridge indicator ring around galvanometer bezel
  const galvoBalanceRingMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.25,
  });
  const galvoBalanceRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.84, 0.03, 12, 36),
    galvoBalanceRingMat
  );
  galvoBalanceRing.rotation.x = Math.PI / 2;
  galvoBalanceRing.position.set(0, 0.57, 0);
  wheatstoneGroup.add(galvoBalanceRing);

  const galvoNeedle = new THREE.Group();
  galvoNeedle.position.set(0, 0.58, 0.15);
  const galvoNeedlePointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.78, 12),
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

  const optBenchRail = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.18, 0.6), darkFrameMat);
  optBenchRail.position.set(0, 0.09, 0);
  optBenchRail.receiveShadow = true;
  youngSlitGroup.add(optBenchRail);

  const laserEmitter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.0), brushedSteelMat);
  laserEmitter.position.set(-4.8, 1.2, 0);
  laserEmitter.castShadow = true;
  laserEmitter.userData = {
    draggableParam: 'lightWavelength',
    min: 400,
    max: 700,
    step: 10,
    label: 'Panjang Gelombang λ',
  };
  youngSlitGroup.add(laserEmitter);

  const laserMountPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 0.52, 16),
    darkFrameMat
  );
  laserMountPost.position.set(-4.8, 0.42, 0);
  laserMountPost.castShadow = true;
  youngSlitGroup.add(laserMountPost);

  const laserBeamLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 3.2, 12),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  laserBeamLine.rotation.z = Math.PI / 2;
  laserBeamLine.position.set(-2.8, 1.2, 0);
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

  const slitPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 1.4), darkFrameMat);
  slitPlate.castShadow = true;
  slitPlate.userData = {
    draggableParam: 'slitDistance',
    min: 0.05,
    max: 0.8,
    step: 0.02,
    label: 'Jarak Celah d',
  };
  slitPlateGroup.add(slitPlate);

  const slitMountPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.16, 0.28, 16),
    brushedSteelMat
  );
  slitMountPost.position.set(0, -0.98, 0);
  slitPlateGroup.add(slitMountPost);

  const screenCarrier = new THREE.Group();
  screenCarrier.position.set(3.8, 1.4, 0);
  youngSlitGroup.add(screenCarrier);

  const fringeCanvas = document.createElement('canvas');
  fringeCanvas.width = 512;
  fringeCanvas.height = 256;
  const fringeTexture = new THREE.CanvasTexture(fringeCanvas);
  fringeTexture.colorSpace = THREE.SRGBColorSpace;

  const projScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 2.6),
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
  const screenMountPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.18, 0.26, 16),
    brushedSteelMat
  );
  screenMountPost.position.set(0, -1.2, 0);
  screenCarrier.add(projScreen, screenMountPost);

  // =========================================================
  // 4. PHOTOELECTRIC PLANCK 3D GROUP
  // =========================================================
  const photoelectricGroup = new THREE.Group();
  scene.add(photoelectricGroup);

  const peBase = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.2, 4.0), darkFrameMat);
  peBase.position.set(0, 0.1, 0);
  peBase.receiveShadow = true;
  photoelectricGroup.add(peBase);

  const peCradleLeft = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.42, 1.2, 2, 0.03),
    darkFrameMat
  );
  peCradleLeft.position.set(-1.1, 0.38, 0);
  const peCradleRight = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.42, 1.2, 2, 0.03),
    darkFrameMat
  );
  peCradleRight.position.set(1.1, 0.38, 0);
  photoelectricGroup.add(peCradleLeft, peCradleRight);

  const peBulb = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 28), glassCylMat);
  peBulb.rotation.z = Math.PI / 2;
  peBulb.position.set(0, 1.6, 0);
  photoelectricGroup.add(peBulb);

  const peCathode = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24, 1, false, 0, Math.PI),
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
  photoelectricGroup.add(peCathode);

  // UV / Monochromatic Incident Photon Beam Cone illuminating Cathode from top-left
  const peIncidentBeamMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const peIncidentBeam = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 2.4, 20, 1, true),
    peIncidentBeamMat
  );
  peIncidentBeam.position.set(-1.95, 2.55, 0);
  peIncidentBeam.rotation.z = -0.65;
  photoelectricGroup.add(peIncidentBeam);

  const peAnode = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 12, 28), brassMat);
  peAnode.rotation.y = Math.PI / 2;
  peAnode.position.set(1.1, 1.6, 0);
  peAnode.userData = {
    draggableParam: 'stoppingPotential',
    min: 0,
    max: 5.0,
    step: 0.1,
    label: 'Potensial Penghenti V₀',
  };
  photoelectricGroup.add(peAnode);

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

  const collVec1 = createVectorArrowGroup(0x38bdf8);
  const collVec2 = createVectorArrowGroup(0xf59e0b);
  collisionGroup.add(collVec1, collVec2);

  // =========================================================
  // 6. UNIVERSAL GRAVITY & ORBITAL 3D GROUP
  // =========================================================
  const orbitalGroup = new THREE.Group();
  scene.add(orbitalGroup);

  const centralPlanetBody = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 32, 32),
    primaryMassMat
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
  orbitalGroup.add(centralPlanetBody);

  const satelliteBody = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), brassMat);
  satelliteBody.position.set(3.8, 2.2, 0);
  satelliteBody.castShadow = true;
  satelliteBody.userData = {
    draggableParam: 'separationDistance',
    min: 2,
    max: 30,
    step: 0.5,
    label: 'Jarak Pisah r',
  };
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
  energyWidgetGroup.position.set(4.5, 0.15, -2.1);
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

  let lastCollisionImpactIndex = -1;

  const update = (ctx: PhysicsRigUpdateContext, curEk = 0, curEp = 0) => {
    const { params: p, metrics: m, simTime: t, nowSec, showVectors: showVec, isLite, isSimTimeAdvancing } = ctx;

    applyBorosilicateLiteMode(glassCylMat, isLite);

    collisionGroup.visible = p.mode === 'collision-momentum';
    orbitalGroup.visible = p.mode === 'orbital-gravity' || (p.mode as string) === 'gravity-orbital';
    stokesGroup.visible = p.mode === 'stokes-viscosity';
    wheatstoneGroup.visible = p.mode === 'ohm-wheatstone';
    youngSlitGroup.visible = p.mode === 'optics-young-slit';
    photoelectricGroup.visible = p.mode === 'photoelectric-planck';

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
      const cycle = t % 3.4;
      const r1 = 0.46 + Math.min(0.32, p.mass * 0.014);
      const r2 = 0.46 + Math.min(0.32, (p.collisionMass2 || 2) * 0.014);
      cart1Mesh.scale.set(r1 / 0.52, 1, 1);
      cart2Mesh.scale.set(r2 / 0.52, 1, 1);

      const v1Init = p.initialVelocity !== 0 ? p.initialVelocity : 8;
      const v2Init = p.velocity2Initial ?? -4;
      const impactT = 1.4;
      let x1 = 0;
      let x2 = 0;
      let curV1 = v1Init;
      let curV2 = v2Init;

      if (cycle < impactT) {
        const dtToImpact = impactT - cycle;
        x1 = -r1 - Math.max(0.5, Math.abs(v1Init) * 0.22) * dtToImpact;
        x2 = r2 + Math.max(0.5, Math.abs(v2Init) * 0.22) * dtToImpact;
      } else {
        const postT = cycle - impactT;
        curV1 = m.v1Final;
        curV2 = m.v2Final;
        x1 = Math.max(-5.0, Math.min(5.0, -r1 + curV1 * 0.22 * postT));
        x2 = Math.max(-5.0, Math.min(5.0, r2 + curV2 * 0.22 * postT));
      }

      const cycleIndex = Math.floor(t / 3.4);
      if (cycle >= impactT) {
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
        shockwaveRing.scale.setScalar(shock.scale);
        shockwaveRingMat.opacity = shock.opacity;
      }

      cart1Mesh.position.set(x1, 0.56, 0);
      cart2Mesh.position.set(x2, 0.56, 0);

      if (showVec) {
        orientAndScaleVectorArrow(
          collVec1,
          new THREE.Vector3(x1, 1.38, 0),
          new THREE.Vector3(curV1 >= 0 ? 1 : -1, 0, 0),
          Math.min(2.2, Math.abs(curV1) * 0.14)
        );
        orientAndScaleVectorArrow(
          collVec2,
          new THREE.Vector3(x2, 1.38, 0),
          new THREE.Vector3(curV2 >= 0 ? 1 : -1, 0, 0),
          Math.min(2.2, Math.abs(curV2) * 0.14)
        );
      } else {
        collVec1.visible = false;
        collVec2.visible = false;
      }
    } else if (m.mode === 'orbital-gravity') {
      const orbitRadius = Math.max(2.0, Math.min(5.2, (p.separationDistance || 5) * 0.35));
      const angle = nowSec * 1.15;
      const sx = Math.cos(angle) * orbitRadius;
      const sz = Math.sin(angle) * orbitRadius;
      satelliteBody.position.set(sx, 2.2, sz);
      orbitRingMesh.scale.setScalar(orbitRadius / 3.79);

      if (showVec) {
        const dirToSat = new THREE.Vector3(sx, 0, sz).normalize();
        const dirToCenter = dirToSat.clone().negate();
        const arrowLen = Math.max(
          0.6,
          Math.min(2.0, Math.log10(Math.max(10, m.universalGravityForce * 1e4)) * 0.45)
        );
        orientAndScaleVectorArrow(gravVec1, new THREE.Vector3(0, 2.2, 0), dirToSat, arrowLen);
        orientAndScaleVectorArrow(gravVec2, new THREE.Vector3(sx, 2.2, sz), dirToCenter, arrowLen);
      } else {
        gravVec1.visible = false;
        gravVec2.visible = false;
      }
    } else if (m.mode === 'stokes-viscosity') {
      const vt = m.stokesTerminalVelocity;
      const yPos = 4.6 - ((t * Math.max(0.35, vt)) % 3.6);
      stokesSphere.position.y = yPos;
      const rScale = (p.sphereRadius ?? 5) / 10;
      stokesSphere.scale.setScalar(rScale);
      stokesWakeRing.position.set(0, Math.min(4.7, yPos + 0.22), 0);
      stokesWakeRing.scale.setScalar(0.8 + 0.18 * Math.sin(nowSec * 6));

      if (showVec) {
        orientAndScaleVectorArrow(
          stokesGravArrow,
          new THREE.Vector3(0, yPos, 0),
          new THREE.Vector3(0, -1, 0),
          1.2
        );
        orientAndScaleVectorArrow(
          stokesDragArrow,
          new THREE.Vector3(0, yPos, 0),
          new THREE.Vector3(0, 1, 0),
          Math.min(1.8, m.stokesDragForce * 8)
        );
      } else {
        stokesGravArrow.visible = false;
        stokesDragArrow.visible = false;
      }
    } else if (m.mode === 'ohm-wheatstone') {
      const needleState = computeWheatstoneNeedleAngle(
        p.resistorR1 ?? 100,
        p.resistorR2 ?? 100,
        p.resistorR3 ?? 100,
        p.resistorRx ?? 100,
        m.galvanometerCurrent
      );
      galvoNeedle.rotation.y = THREE.MathUtils.lerp(
        galvoNeedle.rotation.y,
        needleState.angleRad + (!needleState.isBalanced ? Math.sin(nowSec * 6) * 0.012 : 0),
        0.16
      );
      galvoBalanceRingMat.color.setHex(needleState.isBalanced ? 0x10b981 : 0xf59e0b);
      galvoBalanceRingMat.opacity = needleState.isBalanced ? 0.78 : 0.25;
    } else if (m.mode === 'optics-young-slit') {
      const wl = p.lightWavelength ?? 532;
      const beamColor = wavelengthNmToHex(wl);
      (laserBeamLine.material as THREE.MeshBasicMaterial).color.setHex(beamColor);
      diffractionConeMat.color.setHex(beamColor);

      const ctx2d = fringeCanvas.getContext('2d');
      if (ctx2d) {
        ctx2d.fillStyle = '#050811';
        ctx2d.fillRect(0, 0, fringeCanvas.width, fringeCanvas.height);
        const fringeSpacing = Math.max(8, m.fringeSpacingMm * 8);
        const rgbHex = beamColor.toString(16).padStart(6, '0');
        for (let x = 0; x < fringeCanvas.width; x++) {
          const intensity = Math.pow(Math.cos(((x - 256) / fringeSpacing) * Math.PI), 2);
          ctx2d.fillStyle = `#${rgbHex}`;
          ctx2d.globalAlpha = intensity;
          ctx2d.fillRect(x, 0, 1, fringeCanvas.height);
        }
        ctx2d.globalAlpha = 1.0;
        fringeTexture.needsUpdate = true;
      }
    } else if (m.mode === 'photoelectric-planck') {
      const emitted = m.photoelectricEmitted;
      const wl = p.lightWavelength ?? 400;
      peIncidentBeamMat.color.setHex(wavelengthNmToHex(wl));
      const stopV = p.stoppingPotential ?? 1.5;
      const maxKe = m.photoelectricMaxKe;

      peParticles.forEach((particle, idx) => {
        if (!emitted) {
          particle.visible = false;
          return;
        }
        particle.visible = true;
        const pFrac = (nowSec * 0.85 + idx / PE_PARTICLES_COUNT) % 1.0;
        const { x } = computePhotoelectricElectronX(pFrac, maxKe, stopV);
        particle.position.set(
          x,
          1.6 + Math.sin(idx * 2) * 0.32,
          Math.cos(idx * 2) * 0.32
        );
      });
    }
  };

  return {
    stokesGroup,
    wheatstoneGroup,
    youngSlitGroup,
    photoelectricGroup,
    collisionGroup,
    orbitalGroup,
    energyWidgetGroup,
    stokesSphere,
    cart1Mesh,
    cart2Mesh,
    satelliteBody,
    update,
    dispose: () => {
      fringeTexture.dispose();
    },
  };
}
