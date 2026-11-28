import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ChemistryParams, ChemistryMetrics } from '../../utils/scienceEngine';
import {
  createAnalogGaugeDialTexture,
  createContactShadowPlane,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  createInstrumentPanelTexture,
  updateInstrumentPanelTexture,
} from '../../utils/threeStudioKit';
import {
  computeArrheniusKineticsState,
  computeBeerLambertBeamState,
  computeElectrolysisVisualState,
  computeGalvanicCellVisualState,
  computeGasPistonVisualState,
} from '../../utils/chemistryVisualHelpers';
import { labSound } from '../../utils/soundEngine';

export interface ChemistryRigsMaterials {
  sharedBeakerGeo: THREE.LatheGeometry;
  flaskGeo: THREE.LatheGeometry;
  glassMat: THREE.Material;
  brushedSteelMat: THREE.Material;
  brassMat: THREE.Material;
  darkFrameMat: THREE.Material;
  beakerScaleTex: THREE.CanvasTexture | null;
  graduationOverlayMat: (tex: THREE.CanvasTexture | null) => THREE.MeshBasicMaterial;
  createLiquidWobbleMaterial: (initialHex: number, initialOpacity?: number) => THREE.ShaderMaterial;
  liquidShaderMaterials: THREE.ShaderMaterial[];
}

export interface ChemistryRigUpdateContext {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  simTime: number;
  isLite: boolean;
  particleScale?: number;
  reacting: boolean;
  redoxPairId?: string;
  isSimTimeAdvancing: boolean;
}

export interface ChemistrySpecialRigsHandle {
  redoxGroup: THREE.Group;
  gasGroup: THREE.Group;
  kineticsGroup: THREE.Group;
  spectroGroup: THREE.Group;
  leChatelierGroup: THREE.Group;
  electrolysisGroup: THREE.Group;
  pistonHead: THREE.Mesh;
  leChatelierPiston: THREE.Mesh;
  update: (ctx: ChemistryRigUpdateContext) => void;
  dispose?: () => void;
}

export function buildChemistrySpecialRigs(
  scene: THREE.Scene,
  mats: ChemistryRigsMaterials
): ChemistrySpecialRigsHandle {
  const {
    sharedBeakerGeo,
    flaskGeo,
    glassMat,
    brushedSteelMat,
    brassMat,
    darkFrameMat,
    beakerScaleTex,
    graduationOverlayMat,
    createLiquidWobbleMaterial,
    liquidShaderMaterials,
  } = mats;

  // =========================================================
  // 3. ELECTROCHEMISTRY GALVANIC CELL 3D GROUP
  // =========================================================
  const redoxGroup = new THREE.Group();
  scene.add(redoxGroup);

  // Grounded AO contact shadows beneath both half-cell beakers and potentiometer base
  const leftBeakerShadow = createContactShadowPlane(1.18, 1.18, 0.38);
  leftBeakerShadow.position.set(-1.8, 0.296, 0);
  const rightBeakerShadow = createContactShadowPlane(1.18, 1.18, 0.38);
  rightBeakerShadow.position.set(1.8, 0.296, 0);
  const voltBaseShadow = createContactShadowPlane(0.88, 0.68, 0.38);
  voltBaseShadow.position.set(0, 0.296, -1.2);
  redoxGroup.add(leftBeakerShadow, rightBeakerShadow, voltBaseShadow);

  const beakerLeft = new THREE.Mesh(sharedBeakerGeo, glassMat);
  beakerLeft.position.set(-1.8, 0.29, 0);
  beakerLeft.castShadow = true;
  if (beakerScaleTex) {
    const beakerLeftScale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.926, 0.926, 1.5, 32, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    beakerLeftScale.position.set(-1.8, 1.15, 0);
    beakerLeftScale.rotation.y = -Math.PI * 0.4;
    redoxGroup.add(beakerLeftScale);
  }
  const anodeLiquidMat = createLiquidWobbleMaterial(0x94a3b8, 0.64);
  liquidShaderMaterials.push(anodeLiquidMat);
  const anodeLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.835, 0.835, 1.24, 32, 8),
    anodeLiquidMat
  );
  anodeLiquid.position.set(-1.8, 0.96, 0);
  const zincMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ee,
    metalness: 0.86,
    roughness: 0.24,
  });
  const anodeElectrode = new THREE.Mesh(
    new RoundedBoxGeometry(0.28, 2.04, 0.09, 2, 0.015),
    zincMat
  );
  // Positioned on outer half of left beaker so it never clips with the inner salt bridge leg
  anodeElectrode.position.set(-2.18, 1.42, 0.08);
  anodeElectrode.castShadow = true;
  anodeElectrode.userData = {
    draggableParam: 'anodeConcM',
    min: 0.01,
    max: 2.0,
    step: 0.05,
    label: '[Anoda]',
  };
  redoxGroup.add(beakerLeft, anodeLiquid, anodeElectrode);

  const beakerRight = new THREE.Mesh(sharedBeakerGeo, glassMat);
  beakerRight.position.set(1.8, 0.29, 0);
  beakerRight.castShadow = true;
  if (beakerScaleTex) {
    const beakerRightScale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.926, 0.926, 1.5, 32, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    beakerRightScale.position.set(1.8, 1.15, 0);
    beakerRightScale.rotation.y = -Math.PI * 0.4;
    redoxGroup.add(beakerRightScale);
  }
  const cathodeLiquidMat = createLiquidWobbleMaterial(0x0284c7, 0.78);
  liquidShaderMaterials.push(cathodeLiquidMat);
  const cathodeLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.835, 0.835, 1.24, 32, 8),
    cathodeLiquidMat
  );
  cathodeLiquid.position.set(1.8, 0.96, 0);
  // Authentic burnished metallic Copper cathode bar
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xc86432,
    metalness: 0.88,
    roughness: 0.2,
  });
  const cathodeElectrode = new THREE.Mesh(
    new RoundedBoxGeometry(0.28, 2.04, 0.09, 2, 0.015),
    copperMat
  );
  // Positioned on outer half of right beaker so it never clips with the inner salt bridge leg
  cathodeElectrode.position.set(2.18, 1.42, 0.08);
  cathodeElectrode.castShadow = true;
  cathodeElectrode.userData = {
    draggableParam: 'cathodeConcM',
    min: 0.01,
    max: 2.0,
    step: 0.05,
    label: '[Katoda]',
  };
  redoxGroup.add(beakerRight, cathodeLiquid, cathodeElectrode);

  // Subtle capillary meniscus rim rings hugging each Pyrex beaker wall (replaces flat arcade discs)
  const anodeGlowMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.34,
  });
  const anodeGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.835, 0.012, 8, 40), anodeGlowMat);
  anodeGlowRing.rotation.x = Math.PI / 2;
  anodeGlowRing.position.set(-1.8, 1.585, 0);
  redoxGroup.add(anodeGlowRing);

  const cathodeGlowMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.36,
  });
  const cathodeGlowRing = new THREE.Mesh(new THREE.TorusGeometry(0.835, 0.012, 8, 40), cathodeGlowMat);
  cathodeGlowRing.rotation.x = Math.PI / 2;
  cathodeGlowRing.position.set(1.8, 1.585, 0);
  redoxGroup.add(cathodeGlowRing);

  // Salt Bridge U-Tube + vertical submerged glass legs (inner side at x = ±1.38) + KNO3 agar core + porous frit plugs
  const SALT_BRIDGE_RADIUS = 1.38;
  const SALT_BRIDGE_ARCH_Y = 1.54;
  const saltBridge = new THREE.Mesh(
    new THREE.TorusGeometry(SALT_BRIDGE_RADIUS, 0.115, 18, 44, Math.PI),
    glassMat
  );
  saltBridge.position.set(0, SALT_BRIDGE_ARCH_Y, 0);
  saltBridge.castShadow = true;
  redoxGroup.add(saltBridge);

  const agarGelMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x0284c7,
    emissiveIntensity: 0.14,
    transparent: true,
    opacity: 0.52,
    roughness: 0.22,
  });
  const fritPlugMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.82,
    metalness: 0.05,
  });
  const saltBridgeAgarArch = new THREE.Mesh(
    new THREE.TorusGeometry(SALT_BRIDGE_RADIUS, 0.074, 12, 36, Math.PI),
    agarGelMat
  );
  saltBridgeAgarArch.position.set(0, SALT_BRIDGE_ARCH_Y, 0);
  redoxGroup.add(saltBridgeAgarArch);

  [-SALT_BRIDGE_RADIUS, SALT_BRIDGE_RADIUS].forEach((legX) => {
    const legGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.88, 18, 1, true),
      glassMat
    );
    legGlass.position.set(legX, 1.1, 0);
    const legAgar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074, 0.074, 0.82, 14),
      agarGelMat
    );
    legAgar.position.set(legX, 1.13, 0);
    const fritPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.106, 0.098, 0.14, 16),
      fritPlugMat
    );
    fritPlug.position.set(legX, 0.69, 0);
    redoxGroup.add(legGlass, legAgar, fritPlug);
  });

  // Salt Bridge Migrating Ions (InstancedMesh: K+ cations moving right to cathode, NO3- anions moving left to anode)
  const SALT_ION_COUNT = 6;
  const saltIonGeo = new THREE.SphereGeometry(0.05, 10, 10);
  const cationMat = new THREE.MeshBasicMaterial({ color: 0xc084fc }); // K+
  const anionMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee }); // NO3-
  const cationPool = createInstancedParticlePool(SALT_ION_COUNT, saltIonGeo, cationMat, redoxGroup);
  const anionPool = createInstancedParticlePool(SALT_ION_COUNT, saltIonGeo, anionMat, redoxGroup);

  // Digital Voltmeter Housing + Grounded Bench Pedestal Stand + OLED Screen + Alligator Leads
  const voltChassisMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.45,
    roughness: 0.36,
  });
  const voltStandBase = new THREE.Mesh(
    new RoundedBoxGeometry(1.24, 0.15, 0.92, 3, 0.03),
    voltChassisMat
  );
  voltStandBase.position.set(0, 0.365, -1.2);
  voltStandBase.castShadow = true;
  voltStandBase.receiveShadow = true;
  const voltBaseCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 0.12, 20),
    brushedSteelMat
  );
  voltBaseCollar.position.set(0, 0.48, -1.2);
  const voltStandPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.135, 2.38, 20),
    brushedSteelMat
  );
  voltStandPillar.position.set(0, 1.65, -1.2);
  voltStandPillar.castShadow = true;
  redoxGroup.add(voltStandBase, voltBaseCollar, voltStandPillar);

  const voltMeter = new THREE.Mesh(
    new RoundedBoxGeometry(1.88, 1.1, 0.82, 3, 0.05),
    voltChassisMat
  );
  voltMeter.position.set(0, 3.26, -1.2);
  voltMeter.castShadow = true;
  const voltTopTrim = new THREE.Mesh(
    new RoundedBoxGeometry(1.9, 0.05, 0.84, 2, 0.015),
    brushedSteelMat
  );
  voltTopTrim.position.set(0, 3.81, -1.2);
  redoxGroup.add(voltMeter, voltTopTrim);

  const voltScreenTex = createInstrumentPanelTexture({
    title: 'NERNST POTENTIOMETER',
    primaryText: '+1.10 V',
    secondaryText: 'Anoda (-) -> Katoda (+)',
    accentHex: '#34d399',
  });
  const voltScreenPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.56, 0.64),
    new THREE.MeshBasicMaterial({ map: voltScreenTex })
  );
  voltScreenPlane.position.set(0, 3.34, -0.78);
  redoxGroup.add(voltScreenPlane);

  const blackTermMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 });
  const redTermMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.32 });
  const negBindingPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.14, 14),
    blackTermMat
  );
  negBindingPost.rotation.x = Math.PI / 2;
  negBindingPost.position.set(-0.55, 2.88, -0.76);
  const posBindingPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.14, 14),
    redTermMat
  );
  posBindingPost.rotation.x = Math.PI / 2;
  posBindingPost.position.set(0.55, 2.88, -0.76);
  redoxGroup.add(negBindingPost, posBindingPost);

  // Alligator clips on top of Anode & Cathode + Curved Flexible Test Leads
  const anodeClip = new THREE.Mesh(
    new RoundedBoxGeometry(0.34, 0.16, 0.16, 2, 0.02),
    blackTermMat
  );
  anodeClip.position.set(-2.18, 2.38, 0.08);
  const cathodeClip = new THREE.Mesh(
    new RoundedBoxGeometry(0.34, 0.16, 0.16, 2, 0.02),
    redTermMat
  );
  cathodeClip.position.set(2.18, 2.38, 0.08);
  redoxGroup.add(anodeClip, cathodeClip);

  const anodeLeadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.18, 2.44, 0.08),
    new THREE.Vector3(-2.02, 3.12, -0.26),
    new THREE.Vector3(-1.32, 3.04, -0.64),
    new THREE.Vector3(-0.55, 2.88, -0.74),
  ]);
  const anodeLeadWire = new THREE.Mesh(
    new THREE.TubeGeometry(anodeLeadCurve, 24, 0.028, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45 })
  );
  const cathodeLeadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.18, 2.44, 0.08),
    new THREE.Vector3(2.02, 3.12, -0.26),
    new THREE.Vector3(1.32, 3.04, -0.64),
    new THREE.Vector3(0.55, 2.88, -0.74),
  ]);
  const cathodeLeadWire = new THREE.Mesh(
    new THREE.TubeGeometry(cathodeLeadCurve, 24, 0.028, 8, false),
    redTermMat
  );
  redoxGroup.add(anodeLeadWire, cathodeLeadWire);

  // Glowing e- electron carrier beads flowing along the external wire between Anode -> Voltmeter -> Cathode
  const ELECTRON_WIRE_COUNT = 10;
  const electronBeadPool = createInstancedParticlePool(
    ELECTRON_WIRE_COUNT,
    new THREE.SphereGeometry(0.048, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    redoxGroup
  );
  const _ePos = new THREE.Vector3();

  // =========================================================
  // 4. IDEAL GAS & BOYLE COMPRESSION 3D GROUP
  // =========================================================
  const gasGroup = new THREE.Group();
  scene.add(gasGroup);

  const gasCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 4.4, 36, 1, true),
    glassMat
  );
  gasCylinder.position.set(0, 2.5, 0);
  gasCylinder.castShadow = true;
  gasGroup.add(gasCylinder);

  const gasScaleTex = createGraduatedScaleTexture(25, 'L', 15);
  if (gasScaleTex) {
    const gasScaleSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(1.615, 1.615, 4.0, 32, 1, true),
      graduationOverlayMat(gasScaleTex)
    );
    gasScaleSleeve.position.set(0, 2.5, 0);
    gasScaleSleeve.rotation.y = -Math.PI * 0.45;
    gasGroup.add(gasScaleSleeve);
  }

  const gasCylBase = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.86, 0.28, 36), darkFrameMat);
  gasCylBase.position.set(0, 0.4, 0);
  gasCylBase.castShadow = true;
  gasCylBase.receiveShadow = true;
  gasGroup.add(gasCylBase);

  // Top structural cylinder flange + rod gland bushing + 4 stainless tie-rods
  const gasCylTopFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(1.82, 1.82, 0.16, 36),
    darkFrameMat
  );
  gasCylTopFlange.position.set(0, 4.72, 0);
  gasCylTopFlange.castShadow = true;
  const gasRodBushing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.28, 20),
    brassMat
  );
  gasRodBushing.position.set(0, 4.84, 0);
  gasGroup.add(gasCylTopFlange, gasRodBushing);

  const tieRodOffsets: [number, number][] = [
    [-1.24, -1.24],
    [1.24, -1.24],
    [-1.24, 1.24],
    [1.24, 1.24],
  ];
  tieRodOffsets.forEach(([tx, tz]) => {
    const tieRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 4.46, 12),
      brushedSteelMat
    );
    tieRod.position.set(tx, 2.58, tz);
    const topNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.09, 6),
      brassMat
    );
    topNut.position.set(tx, 4.84, tz);
    gasGroup.add(tieRod, topNut);
  });

  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(1.56, 1.56, 0.38, 36),
    brushedSteelMat
  );
  pistonHead.position.set(0, 3.2, 0);
  pistonHead.castShadow = true;
  pistonHead.userData = {
    draggableParam: 'gasVolumeL',
    min: 2.0,
    max: 25.0,
    step: 0.5,
    label: 'Volume Gas V (L)',
  };
  gasGroup.add(pistonHead);

  // Dual Viton O-ring elastomer seals attached as children of pistonHead
  const vitonSealMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.1,
  });
  [-0.11, 0.11].forEach((sealY) => {
    const oRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.555, 0.038, 12, 36),
      vitonSealMat
    );
    oRing.rotation.x = Math.PI / 2;
    oRing.position.y = sealY;
    pistonHead.add(oRing);
  });

  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 2.2, 18),
    brushedSteelMat
  );
  pistonRod.position.set(0, 4.4, 0);
  pistonRod.castShadow = true;
  // T-Handle & compression load collar at the top of pistonRod
  const pistonTHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1.35, 16),
    darkFrameMat
  );
  pistonTHandle.rotation.z = Math.PI / 2;
  pistonTHandle.position.y = 1.08;
  const pistonLoadPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.38, 0.16, 24),
    brassMat
  );
  pistonLoadPlate.position.y = 0.95;
  pistonRod.add(pistonTHandle, pistonLoadPlate);
  gasGroup.add(pistonRod);

  // Brass Manifold Pipe & Valve connecting chamber to Bourdon Pressure Gauge
  const manifoldHorizontal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.68, 14),
    brassMat
  );
  manifoldHorizontal.rotation.z = Math.PI / 2;
  manifoldHorizontal.position.set(1.88, 1.75, 0);
  const manifoldVertical = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.88, 14),
    brassMat
  );
  manifoldVertical.position.set(2.2, 2.15, 0);
  const bleedValveWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.032, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.3 })
  );
  bleedValveWheel.position.set(1.94, 1.94, 0.12);
  gasGroup.add(manifoldHorizontal, manifoldVertical, bleedValveWheel);

  const pressureDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 0.22, 32),
    brassMat
  );
  pressureDial.rotation.x = Math.PI / 2;
  pressureDial.position.set(2.2, 2.6, 0);
  pressureDial.castShadow = true;
  gasGroup.add(pressureDial);

  let currentManometerMaxAtm = 6;
  let manometerFaceTex = createAnalogGaugeDialTexture({
    min: 0,
    max: 6,
    majorDivisions: 6,
    title: 'BOURDON',
    unit: 'atm',
  });
  const manometerFaceMat = new THREE.MeshBasicMaterial({ map: manometerFaceTex });
  const manometerFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.59, 32),
    manometerFaceMat
  );
  manometerFace.position.set(2.2, 2.6, 0.114);
  const manometerGlassCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.04, 28),
    glassMat
  );
  manometerGlassCover.rotation.x = Math.PI / 2;
  manometerGlassCover.position.set(2.2, 2.6, 0.135);
  // Subtle insulating thermal collar ring around gas cylinder when adiabatic mode is toggled
  const adiabaticJacketMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.42,
    roughness: 0.6,
  });
  const adiabaticJacketRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.66, 1.66, 3.9, 32, 1, true),
    adiabaticJacketMat
  );
  adiabaticJacketRing.position.set(0, 2.5, 0);
  adiabaticJacketRing.visible = false;
  gasGroup.add(manometerFace, manometerGlassCover, adiabaticJacketRing);

  // Pivot group at (2.2, 2.6, 0.122) so the needle sweeps around its base hub
  const pressureNeedlePivot = new THREE.Group();
  pressureNeedlePivot.position.set(2.2, 2.6, 0.122);
  const pressureNeedleBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.44, 0.015),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  pressureNeedleBlade.position.y = 0.18;
  const pressureNeedleCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14),
    darkFrameMat
  );
  pressureNeedleCap.rotation.x = Math.PI / 2;
  pressureNeedlePivot.add(pressureNeedleBlade, pressureNeedleCap);
  gasGroup.add(pressureNeedlePivot);

  const GAS_PARTICLES_MAX = 48;
  const gasParticleStates: { pos: THREE.Vector3; vel: THREE.Vector3 }[] = [];
  const gasPartGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const gasPartMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  const gasPool = createInstancedParticlePool(
    GAS_PARTICLES_MAX,
    gasPartGeo,
    gasPartMat,
    gasGroup
  );
  for (let i = 0; i < GAS_PARTICLES_MAX; i++) {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      0.6 + Math.random() * 2.2,
      (Math.random() - 0.5) * 2.2
    );
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize();
    gasParticleStates.push({ pos, vel });
    gasPool.setTransform(i, pos.x, pos.y, pos.z, 1);
  }
  gasPool.commit(GAS_PARTICLES_MAX);

  // =========================================================
  // 5. REACTION KINETICS & ARRHENIUS 3D GROUP
  // =========================================================
  const kineticsGroup = new THREE.Group();
  scene.add(kineticsGroup);

  const hotplateBase = new THREE.Mesh(
    new RoundedBoxGeometry(3.6, 0.8, 3.6, 3, 0.06),
    darkFrameMat
  );
  hotplateBase.position.set(0, 0.68, 0);
  hotplateBase.castShadow = true;
  hotplateBase.receiveShadow = true;
  hotplateBase.userData = {
    draggableParam: 'kineticsTempC',
    min: 10,
    max: 90,
    step: 5,
    label: 'Suhu Pemanas T (°C)',
  };
  kineticsGroup.add(hotplateBase);

  // Hotplate Digital OLED Readout & Dual Rotary Control Knobs (Temp & Stir RPM)
  const hotplateScreenTex = createInstrumentPanelTexture({
    title: 'IKA HOTPLATE STIRRER',
    primaryText: '25 °C',
    secondaryText: '240 RPM · ARRHENIUS',
    accentHex: '#fb923c',
  });
  const hotplateScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.48),
    new THREE.MeshBasicMaterial({ map: hotplateScreenTex })
  );
  hotplateScreenMesh.position.set(-0.62, 0.68, 1.81);
  kineticsGroup.add(hotplateScreenMesh);

  const hotplateCeramicTopMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.15,
    emissive: 0xf97316,
    emissiveIntensity: 0.25,
  });
  const hotplateCeramicTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32),
    hotplateCeramicTopMat
  );
  hotplateCeramicTop.position.set(0, 1.12, 0);
  hotplateCeramicTop.userData = {
    draggableParam: 'kineticsTempC',
    min: 10,
    max: 90,
    step: 5,
    label: 'Suhu Pemanas T (°C)',
  };
  kineticsGroup.add(hotplateCeramicTop);

  const heaterLight = new THREE.PointLight(0xf97316, 0.8, 3.0);
  heaterLight.position.set(0, 1.35, 0);
  kineticsGroup.add(heaterLight);

  const heaterRingMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.3,
    metalness: 0.2,
    emissive: 0xf97316,
    emissiveIntensity: 0.6,
  });
  const heaterFlameRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.05, 12, 32),
    heaterRingMat
  );
  heaterFlameRing.rotation.x = Math.PI / 2;
  heaterFlameRing.position.set(0, 1.17, 0);
  kineticsGroup.add(heaterFlameRing);

  const tempKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 20), brassMat);
  tempKnob.rotation.x = Math.PI / 2;
  tempKnob.position.set(0.58, 0.68, 1.85);
  tempKnob.userData = {
    draggableParam: 'kineticsTempC',
    min: 10,
    max: 90,
    step: 5,
    label: 'Suhu Pemanas T (°C)',
  };
  const stirKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 20), brushedSteelMat);
  stirKnob.rotation.x = Math.PI / 2;
  stirKnob.position.set(1.22, 0.68, 1.85);
  stirKnob.userData = {
    draggableParam: 'stirringRpm',
    min: 60,
    max: 600,
    step: 30,
    label: 'Kecepatan Aduk (RPM)',
  };
  kineticsGroup.add(tempKnob, stirKnob);

  // Rear PT100 Thermocouple Support Rod, Bosshead Clamp & Immersion Temperature Probe
  const kSupportRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3.35, 14),
    brushedSteelMat
  );
  kSupportRod.position.set(-1.35, 2.65, -1.25);
  const kBosshead = new THREE.Mesh(
    new RoundedBoxGeometry(0.26, 0.22, 0.26, 2, 0.02),
    darkFrameMat
  );
  kBosshead.position.set(-1.35, 3.85, -1.25);
  const kProbeArmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.35, 3.85, -1.25),
    new THREE.Vector3(-0.65, 3.85, -0.55),
    new THREE.Vector3(0.08, 3.72, 0),
  ]);
  const kProbeArm = new THREE.Mesh(
    new THREE.TubeGeometry(kProbeArmCurve, 16, 0.038, 10, false),
    brushedSteelMat
  );
  const kPt100Handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.065, 0.36, 14),
    darkFrameMat
  );
  kPt100Handle.position.set(0.08, 3.56, 0);
  const kPt100Shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 1.95, 12),
    brushedSteelMat
  );
  kPt100Shaft.position.set(0.08, 2.46, 0);
  kineticsGroup.add(kSupportRod, kBosshead, kProbeArm, kPt100Handle, kPt100Shaft);

  const kFlask = new THREE.Mesh(flaskGeo, glassMat);
  kFlask.position.set(0, 1.18, 0);
  kFlask.castShadow = true;
  kineticsGroup.add(kFlask);

  if (beakerScaleTex) {
    const kFlaskScale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 1.25, 1.1, 32, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    kFlaskScale.position.set(0, 1.85, 0);
    kFlaskScale.rotation.y = -Math.PI * 0.42;
    kineticsGroup.add(kFlaskScale);
  }

  const kLiquidMat = createLiquidWobbleMaterial(0xfef08a, 0.8);
  liquidShaderMaterials.push(kLiquidMat);
  const kLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 1.32, 1.0, 32, 16),
    kLiquidMat
  );
  kLiquid.position.set(0, 1.7, 0);
  kineticsGroup.add(kLiquid);

  // Swirling convection vortex ring on top of solution
  const vortexMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const vortexRing = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.58, 28), vortexMat);
  vortexRing.rotation.x = -Math.PI / 2;
  vortexRing.position.set(0, 2.21, 0);
  kineticsGroup.add(vortexRing);

  const stirBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  stirBar.rotation.z = Math.PI / 2;
  stirBar.position.set(0, 1.25, 0);
  kineticsGroup.add(stirBar);

  // =========================================================
  // 6. SPECTROPHOTOMETRY UV-VIS (BEER'S LAW) 3D GROUP
  // =========================================================
  const spectroGroup = new THREE.Group();
  scene.add(spectroGroup);

  const spectroChassis = new THREE.Mesh(
    new RoundedBoxGeometry(7.2, 2.2, 4.8, 3, 0.08),
    darkFrameMat
  );
  spectroChassis.position.set(0, 1.38, 0);
  spectroChassis.castShadow = true;
  spectroChassis.receiveShadow = true;
  spectroGroup.add(spectroChassis);

  // Optical Bench Bay Deck & Baffle Walls on top of spectroChassis
  const opticalBenchMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.72,
    metalness: 0.32,
  });
  const opticalDeckPlate = new THREE.Mesh(
    new RoundedBoxGeometry(5.6, 0.08, 2.1, 2, 0.02),
    opticalBenchMat
  );
  opticalDeckPlate.position.set(-0.65, 2.5, 0.4);
  const rearBaffleWall = new THREE.Mesh(
    new RoundedBoxGeometry(5.6, 0.92, 0.14, 2, 0.02),
    darkFrameMat
  );
  rearBaffleWall.position.set(-0.65, 2.94, -0.58);
  const leftBaffleWall = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.92, 2.1, 2, 0.02),
    darkFrameMat
  );
  leftBaffleWall.position.set(-3.4, 2.94, 0.4);
  const rightBaffleWall = new THREE.Mesh(
    new RoundedBoxGeometry(0.14, 0.92, 2.1, 2, 0.02),
    darkFrameMat
  );
  rightBaffleWall.position.set(2.1, 2.94, 0.4);
  spectroGroup.add(opticalDeckPlate, rearBaffleWall, leftBaffleWall, rightBaffleWall);

  // Hinged Compartment Lid swung open behind the sample chamber
  const spectroLid = new THREE.Mesh(
    new RoundedBoxGeometry(2.2, 0.12, 1.65, 2, 0.02),
    brushedSteelMat
  );
  spectroLid.position.set(-0.8, 3.65, -0.35);
  spectroLid.rotation.x = -0.85;
  spectroLid.castShadow = true;
  spectroGroup.add(spectroLid);

  // Dual Tungsten-Deuterium Light Source Module at x = -2.95
  const lampSourceHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.68, 24),
    brushedSteelMat
  );
  lampSourceHousing.rotation.z = Math.PI / 2;
  lampSourceHousing.position.set(-2.95, 2.8, 0.4);
  const lampApertureLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  lampApertureLens.position.set(-2.6, 2.8, 0.4);
  spectroGroup.add(lampSourceHousing, lampApertureLens);

  // Monochromator Turret & Dispersion Prism + Collimating Slit Plates
  const monoTurretBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 0.14, 24),
    brassMat
  );
  monoTurretBase.position.set(-2.05, 2.58, 0.4);
  const monoPrism = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.72, 3),
    glassMat
  );
  monoPrism.position.set(-2.05, 2.95, 0.4);
  monoPrism.userData = {
    draggableParam: 'spectroWavelengthNm',
    min: 380,
    max: 750,
    step: 5,
    label: 'Panjang Gelombang λ (nm)',
  };
  const exitSlitPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.78, 0.68),
    opticalBenchMat
  );
  exitSlitPlate.position.set(-1.52, 2.88, 0.4);
  spectroGroup.add(monoTurretBase, monoPrism, exitSlitPlate);

  // Cuvette Cell Holder Well + Quartz Cuvette
  const cuvetteHolderWell = new THREE.Mesh(
    new RoundedBoxGeometry(0.88, 0.62, 0.88, 2, 0.02),
    opticalBenchMat
  );
  cuvetteHolderWell.position.set(-0.8, 2.8, 0.4);
  spectroGroup.add(cuvetteHolderWell);

  const cuvette = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.65), glassMat);
  cuvette.position.set(-0.8, 2.95, 0.4);
  cuvette.castShadow = true;
  const cuvetteCap = new THREE.Mesh(
    new RoundedBoxGeometry(0.68, 0.12, 0.68, 2, 0.015),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  cuvetteCap.position.set(-0.8, 3.88, 0.4);
  spectroGroup.add(cuvette, cuvetteCap);

  const analyteSolutionCuvette = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 1.5, 0.58),
    new THREE.MeshStandardMaterial({ color: 0xd946ef, transparent: true, opacity: 0.75 })
  );
  analyteSolutionCuvette.position.set(-0.8, 2.86, 0.4);
  analyteSolutionCuvette.userData = {
    draggableParam: 'spectroConcMm',
    min: 0.01,
    max: 0.25,
    step: 0.01,
    label: 'Konsentrasi c (mM)',
  };
  spectroGroup.add(analyteSolutionCuvette);

  // Silicon Photodiode Detector Module at x = 1.25
  const photodiodeHousing = new THREE.Mesh(
    new RoundedBoxGeometry(0.62, 0.76, 0.78, 2, 0.03),
    darkFrameMat
  );
  photodiodeHousing.position.set(1.25, 2.86, 0.4);
  const photodiodeSensorWindow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20),
    brassMat
  );
  photodiodeSensorWindow.rotation.z = Math.PI / 2;
  photodiodeSensorWindow.position.set(0.92, 2.8, 0.4);
  spectroGroup.add(photodiodeHousing, photodiodeSensorWindow);

  // Front Digital OLED Spectrophotometer Readout Panel
  const spectroScreenTex = createInstrumentPanelTexture({
    title: 'UV-VIS SPECTROPHOTOMETER',
    primaryText: 'A = 0.800',
    secondaryText: 'λ = 525 nm · %T = 15.8%',
    accentHex: '#38bdf8',
  });
  const spectroScreenPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 0.82),
    new THREE.MeshBasicMaterial({ map: spectroScreenTex })
  );
  spectroScreenPlane.position.set(1.55, 1.55, 2.42);
  spectroGroup.add(spectroScreenPlane);

  // Split beam: Incident beam (full brightness) & Transmitted beam (attenuated by Beer-Lambert 10^-A)
  const incidentBeamMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.85,
  });
  const incidentBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.45, 12),
    incidentBeamMat
  );
  incidentBeam.rotation.z = Math.PI / 2;
  incidentBeam.position.set(-1.82, 2.8, 0.4);
  spectroGroup.add(incidentBeam);

  const transmittedBeamMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.5,
  });
  const transmittedBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 1.38, 12),
    transmittedBeamMat
  );
  transmittedBeam.rotation.z = Math.PI / 2;
  transmittedBeam.position.set(0.22, 2.8, 0.4);
  spectroGroup.add(transmittedBeam);

  // =========================================================
  // 7. LE CHATELIER CHEMICAL EQUILIBRIUM (N2O4 <-> 2 NO2) 3D GROUP
  // =========================================================
  const leChatelierGroup = new THREE.Group();
  scene.add(leChatelierGroup);

  const lcBathBase = new THREE.Mesh(
    new RoundedBoxGeometry(3.8, 0.72, 3.4, 3, 0.05),
    darkFrameMat
  );
  lcBathBase.position.set(0, 0.64, 0);
  lcBathBase.castShadow = true;
  lcBathBase.receiveShadow = true;
  lcBathBase.userData = {
    draggableParam: 'equilibriumTempC',
    min: 0,
    max: 100,
    step: 2,
    label: 'Suhu Reaktor T (°C)',
  };
  leChatelierGroup.add(lcBathBase);

  const lcScreenTex = createInstrumentPanelTexture({
    title: 'LE CHATELIER REACTOR',
    primaryText: '25 °C · 1.0 atm',
    secondaryText: 'Kp = 0.142 · NO₂ = 31.6%',
    accentHex: '#f59e0b',
  });
  const lcScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.52),
    new THREE.MeshBasicMaterial({ map: lcScreenTex })
  );
  lcScreenMesh.position.set(0, 0.65, 1.71);
  leChatelierGroup.add(lcScreenMesh);

  // Thermal water-bath outer glass jacket + dynamic cold/hot bath thermal glow ring
  const lcOuterJacket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.58, 1.58, 3.5, 36, 1, true),
    glassMat
  );
  lcOuterJacket.position.set(0, 2.75, 0);
  const lcBathWaterMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.22,
    roughness: 0.2,
    depthWrite: false,
  });
  const lcBathWaterSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.52, 2.8, 32, 1, true),
    lcBathWaterMat
  );
  lcBathWaterSleeve.position.set(0, 2.45, 0);
  leChatelierGroup.add(lcOuterJacket, lcBathWaterSleeve);

  // Inner sealed borosilicate reactor vessel
  const lcInnerReactor = new THREE.Mesh(
    new THREE.CylinderGeometry(1.22, 1.22, 3.4, 36, 1, true),
    glassMat
  );
  lcInnerReactor.position.set(0, 2.75, 0);
  lcInnerReactor.castShadow = true;
  leChatelierGroup.add(lcInnerReactor);

  // Dynamic volumetric NO2/N2O4 gas core cylinder ( anchored at bottom y = 1.05 )
  const lcGasGeo = new THREE.CylinderGeometry(1.17, 1.17, 1.0, 32);
  lcGasGeo.translate(0, 0.5, 0);
  const lcGasMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0x92400e,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.48,
    roughness: 0.3,
    depthWrite: false,
  });
  const lcGasCore = new THREE.Mesh(lcGasGeo, lcGasMat);
  lcGasCore.position.set(0, 1.05, 0);
  lcGasCore.scale.y = 2.4;
  leChatelierGroup.add(lcGasCore);

  // Movable pressure piston at top of reactor
  const leChatelierPiston = new THREE.Mesh(
    new THREE.CylinderGeometry(1.19, 1.19, 0.34, 32),
    brushedSteelMat
  );
  leChatelierPiston.position.set(0, 3.45, 0);
  leChatelierPiston.castShadow = true;
  leChatelierPiston.userData = {
    draggableParam: 'equilibriumPressureAtm',
    min: 0.2,
    max: 5.0,
    step: 0.1,
    label: 'Tekanan Sistem P (atm)',
  };
  const lcPistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.65, 16),
    brushedSteelMat
  );
  lcPistonRod.position.set(0, 0.95, 0);
  const lcPistonHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.36, 0.16, 24),
    brassMat
  );
  lcPistonHandle.position.set(0, 1.75, 0);
  lcPistonHandle.userData = leChatelierPiston.userData;
  leChatelierPiston.add(lcPistonRod, lcPistonHandle);
  leChatelierGroup.add(leChatelierPiston);

  // Floating N2O4 dimer (2-sphere pairs) & NO2 monomer particles inside chamber
  const LC_PARTICLES_MAX = 40;
  const lcParticleStates: { pos: THREE.Vector3; vel: THREE.Vector3 }[] = [];
  const lcPartPool = createInstancedParticlePool(
    LC_PARTICLES_MAX * 2,
    new THREE.SphereGeometry(0.085, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.1,
    }),
    leChatelierGroup
  );
  for (let i = 0; i < LC_PARTICLES_MAX; i++) {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 1.7,
      1.2 + Math.random() * 2.0,
      (Math.random() - 0.5) * 1.7
    );
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.5) * 1.6
    ).normalize();
    lcParticleStates.push({ pos, vel });
    lcPartPool.setTransform(i, pos.x, pos.y, pos.z, 1);
  }
  lcPartPool.commit(LC_PARTICLES_MAX);

  // =========================================================
  // 7. ELECTROLYSIS CELL & FARADAY ELECTROPLATING 3D GROUP
  // =========================================================
  const electrolysisGroup = new THREE.Group();
  electrolysisGroup.visible = false;
  scene.add(electrolysisGroup);

  const elecTankShadow = createContactShadowPlane(3.8, 2.2, 0.36);
  elecTankShadow.position.set(0, 0.296, 0.15);
  const elecPsuShadow = createContactShadowPlane(2.2, 1.25, 0.38);
  elecPsuShadow.position.set(3.0, 0.296, -0.05);
  electrolysisGroup.add(elecTankShadow, elecPsuShadow);

  const elecTankBase = new THREE.Mesh(
    new RoundedBoxGeometry(3.75, 0.16, 2.15, 2, 0.03),
    darkFrameMat
  );
  elecTankBase.position.set(0, 0.37, 0.15);
  elecTankBase.receiveShadow = true;
  electrolysisGroup.add(elecTankBase);

  const elecGlassTank = new THREE.Mesh(
    new THREE.BoxGeometry(3.52, 2.15, 1.92),
    glassMat
  );
  elecGlassTank.position.set(0, 1.52, 0.15);
  elecGlassTank.renderOrder = 3;
  elecGlassTank.name = 'Tangki Sel Elektrolisis Borosilikat';
  electrolysisGroup.add(elecGlassTank);

  const elecLiquidMat = createLiquidWobbleMaterial(0x0284c7, 0.56);
  liquidShaderMaterials.push(elecLiquidMat);
  const elecLiquid = new THREE.Mesh(
    new THREE.BoxGeometry(3.38, 1.56, 1.78),
    elecLiquidMat
  );
  elecLiquid.position.set(0, 1.24, 0.15);
  electrolysisGroup.add(elecLiquid);

  // Cathode (-): inert core + growing metallic electroplating sheath
  const elecCathodeCore = new THREE.Mesh(
    new RoundedBoxGeometry(0.18, 2.12, 0.44, 2, 0.02),
    brushedSteelMat
  );
  elecCathodeCore.position.set(-1.05, 1.74, 0.15);
  elecCathodeCore.castShadow = true;
  elecCathodeCore.name = 'Katoda (−) Pelapisan Logam Faraday';
  elecCathodeCore.userData = {
    draggableParam: 'electrolysisTimeMin',
    min: 5,
    max: 120,
    step: 5,
    label: 'Durasi Elektrolisis t (menit)',
  };

  const elecPlatingMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.9,
    roughness: 0.18,
  });
  const elecCathodePlating = new THREE.Mesh(
    new RoundedBoxGeometry(0.22, 1.44, 0.48, 2, 0.02),
    elecPlatingMat
  );
  elecCathodePlating.position.set(-1.05, 1.3, 0.15);
  elecCathodePlating.castShadow = true;
  elecCathodePlating.userData = elecCathodeCore.userData;

  // Anode (+): inert carbon graphite electrode generating O2 gas bubbles
  const graphiteMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.25,
    roughness: 0.72,
  });
  const elecAnodeRod = new THREE.Mesh(
    new RoundedBoxGeometry(0.2, 2.12, 0.44, 2, 0.02),
    graphiteMat
  );
  elecAnodeRod.position.set(1.05, 1.74, 0.15);
  elecAnodeRod.castShadow = true;
  elecAnodeRod.name = 'Anoda Inert Grafit (+) Penghasil O₂';
  electrolysisGroup.add(elecCathodeCore, elecCathodePlating, elecAnodeRod);

  // Anode O2 rising micro-bubble pool
  const ELEC_BUBBLES_MAX = 48;
  const elecBubblePool = createInstancedParticlePool(
    ELEC_BUBBLES_MAX,
    new THREE.SphereGeometry(0.036, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.84,
      roughness: 0.1,
    }),
    electrolysisGroup
  );

  // Electrolyte M^n+ cation drift pool migrating toward cathode
  const ELEC_CATIONS_MAX = 22;
  const elecCationPool = createInstancedParticlePool(
    ELEC_CATIONS_MAX,
    new THREE.SphereGeometry(0.055, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    }),
    electrolysisGroup
  );

  // DC Power Supply + Analog Ammeter Console beside tank (x = 3.0) for unobstructed legibility
  const elecPsuHousing = new THREE.Mesh(
    new RoundedBoxGeometry(2.05, 1.92, 0.96, 3, 0.04),
    darkFrameMat
  );
  elecPsuHousing.position.set(3.0, 1.26, -0.05);
  elecPsuHousing.castShadow = true;
  elecPsuHousing.name = 'Catu Daya DC & Amperemeter Elektrolisis';
  elecPsuHousing.userData = {
    draggableParam: 'electrolysisCurrentA',
    min: 0.5,
    max: 8.0,
    step: 0.25,
    label: 'Kuat Arus DC I (A)',
  };
  electrolysisGroup.add(elecPsuHousing);

  const elecScreenTex = createInstrumentPanelTexture({
    title: 'FARADAY DC RECTIFIER',
    primaryText: 'I = 2.50 A · Q = 4500 C',
    secondaryText: 'm(Cu) = 1.482 g · V(O₂) = 261.4 mL',
    accentHex: '#38bdf8',
  });
  const elecScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.72, 0.74),
    new THREE.MeshBasicMaterial({ map: elecScreenTex ?? undefined })
  );
  elecScreenMesh.position.set(3.0, 0.84, 0.445);
  elecScreenMesh.userData = elecPsuHousing.userData;
  electrolysisGroup.add(elecScreenMesh);

  const elecAmmeterTex = createAnalogGaugeDialTexture({
    min: 0,
    max: 8,
    majorDivisions: 4,
    title: 'DC AMMETER',
    unit: 'Ampere',
  });
  const elecAmmeterDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({ map: elecAmmeterTex ?? undefined })
  );
  elecAmmeterDial.position.set(3.0, 1.66, 0.445);
  elecAmmeterDial.userData = elecPsuHousing.userData;
  electrolysisGroup.add(elecAmmeterDial);

  const elecAmmeterNeedlePivot = new THREE.Group();
  elecAmmeterNeedlePivot.position.set(3.0, 1.66, 0.46);
  const elecAmmeterNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.34, 0.018),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e })
  );
  elecAmmeterNeedle.position.y = 0.13;
  elecAmmeterNeedlePivot.add(elecAmmeterNeedle);
  electrolysisGroup.add(elecAmmeterNeedlePivot);

  // External leads connecting Anode (+) -> DC (+) and DC (-) -> Cathode (-)
  const elecAnodeLeadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.05, 2.8, 0.15),
    new THREE.Vector3(1.75, 2.95, 0.08),
    new THREE.Vector3(2.45, 2.55, 0.0),
    new THREE.Vector3(2.55, 2.22, -0.05),
  ]);
  const elecCathodeLeadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.45, 2.22, -0.05),
    new THREE.Vector3(2.25, 3.35, -0.55),
    new THREE.Vector3(0.0, 3.45, -0.45),
    new THREE.Vector3(-1.05, 2.8, 0.15),
  ]);
  const elecWireAnodeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
  const elecWireCathodeMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.45 });
  electrolysisGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(elecAnodeLeadCurve, 28, 0.036, 8, false), elecWireAnodeMat),
    new THREE.Mesh(new THREE.TubeGeometry(elecCathodeLeadCurve, 28, 0.036, 8, false), elecWireCathodeMat)
  );

  const ELEC_WIRE_ELECTRONS = 18;
  const elecElectronPool = createInstancedParticlePool(
    ELEC_WIRE_ELECTRONS,
    new THREE.SphereGeometry(0.052, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    electrolysisGroup
  );
  const _elecWirePos = new THREE.Vector3();

  let lastVoltKey = '';
  let lastHotplateKey = '';
  let lastSpectroKey = '';
  let lastLcKey = '';
  let lastElecKey = '';

  const update = (ctx: ChemistryRigUpdateContext) => {
    const {
      params: p,
      metrics: m,
      simTime: t,
      isLite,
      particleScale = isLite ? 0.5 : 1,
      reacting,
      isSimTimeAdvancing,
    } = ctx;

    const isRedox =
      p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
    redoxGroup.visible = isRedox;
    gasGroup.visible = p.mode === 'ideal-gas-boyle';
    kineticsGroup.visible = p.mode === 'reaction-kinetics-arrhenius';
    spectroGroup.visible = p.mode === 'spectrophotometry-beer';
    leChatelierGroup.visible = p.mode === 'chemical-equilibrium-lechatelier';
    electrolysisGroup.visible = p.mode === 'electrolysis-faraday';

    if (isRedox) {
      const rawECell = m.nernstCellPotentialE ?? 1.1;
      const eCell = Math.max(0.15, Math.abs(rawECell));
      const cA = p.anodeConcM ?? 1.0;
      const cC = p.cathodeConcM ?? 1.0;
      const pairId = ctx.redoxPairId ?? 'zn-cu-daniell';

      const galv = computeGalvanicCellVisualState(pairId, rawECell, cA, cC, t);
      zincMat.color.setHex(galv.anodeMetalHex);
      copperMat.color.setHex(galv.cathodeMetalHex);
      anodeLiquidMat.uniforms.uColor.value.setHex(galv.anodeSolutionHex);
      anodeLiquidMat.uniforms.uOpacity.value = galv.anodeSolutionOpacity;
      cathodeLiquidMat.uniforms.uColor.value.setHex(galv.cathodeSolutionHex);
      cathodeLiquidMat.uniforms.uOpacity.value = galv.cathodeSolutionOpacity;

      // Progressive oxidation (thinning anode) and reduction plating (thickening cathode)
      anodeElectrode.scale.set(galv.anodeWidthScale, 1, galv.anodeWidthScale);
      cathodeElectrode.scale.set(galv.cathodeWidthScale, 1, galv.cathodeWidthScale);

      // Animate glowing e- beads along external circuit wire (anode -> voltmeter -> cathode)
      const activeElectrons = Math.max(4, Math.round(ELECTRON_WIRE_COUNT * particleScale));
      if (galv.electronFlowSign === 0) {
        electronBeadPool.mesh.visible = false;
      } else {
        electronBeadPool.mesh.visible = true;
        for (let idx = 0; idx < activeElectrons; idx++) {
          const rawU = (t * galv.electronSpeed * 0.45 * galv.electronFlowSign + idx / activeElectrons) % 1;
          const u = (rawU + 1) % 1;
          if (u < 0.5) {
            anodeLeadCurve.getPoint(u * 2, _ePos);
          } else {
            // cathodeLeadCurve goes from cathode(0) to voltmeter(1), so traverse 1 -> 0 for anode->cathode flow
            cathodeLeadCurve.getPoint(1 - (u - 0.5) * 2, _ePos);
          }
          electronBeadPool.setTransform(idx, _ePos.x, _ePos.y, _ePos.z, 1.0);
          electronBeadPool.setColor(idx, galv.electronFlowSign > 0 ? 0x38bdf8 : 0xf43f5e);
        }
        electronBeadPool.commit(activeElectrons);
      }

      const voltKey = `${pairId}_${rawECell.toFixed(2)}_${cA.toFixed(2)}_${cC.toFixed(2)}`;
      if (voltKey !== lastVoltKey) {
        lastVoltKey = voltKey;
        updateInstrumentPanelTexture(voltScreenTex, {
          title: 'NERNST POTENTIOMETER',
          primaryText: `${rawECell >= 0 ? '+' : ''}${rawECell.toFixed(2)} V`,
          secondaryText: `[A]=${cA.toFixed(2)}M · [K]=${cC.toFixed(2)}M`,
          accentHex: rawECell >= 0 ? '#34d399' : '#f87171',
        });
      }
      const activeIons = Math.max(2, Math.round(SALT_ION_COUNT * particleScale));
      const ionSign = galv.electronFlowSign || 1;
      for (let idx = 0; idx < activeIons; idx++) {
        const rawU = (t * 0.25 * eCell * ionSign + idx / activeIons) % 1.0;
        const u = (rawU + 1) % 1.0;
        const cAngle = Math.PI * (1 - u); // pi (left) -> 0 (right)
        cationPool.setTransform(
          idx,
          SALT_BRIDGE_RADIUS * Math.cos(cAngle),
          SALT_BRIDGE_ARCH_Y + SALT_BRIDGE_RADIUS * Math.sin(cAngle),
          0.025,
          1
        );
        const aAngle = Math.PI * u; // 0 (right) -> pi (left)
        anionPool.setTransform(
          idx,
          SALT_BRIDGE_RADIUS * Math.cos(aAngle),
          SALT_BRIDGE_ARCH_Y + SALT_BRIDGE_RADIUS * Math.sin(aAngle),
          -0.025,
          1
        );
      }
      cationPool.commit(activeIons);
      anionPool.commit(activeIons);
      const pulse = 0.28 + 0.08 * Math.sin(t * 2.4);
      anodeGlowMat.opacity = pulse;
      cathodeGlowMat.opacity = pulse + 0.04;
    } else if (p.mode === 'ideal-gas-boyle') {
      const pAtm = m.gasPressureAtm ?? 1.0;
      const gasState = computeGasPistonVisualState(
        p.gasVolumeL ?? 10.0,
        p.gasTemperatureK ?? 300,
        p.gasMoles ?? 1.0,
        pAtm,
        GAS_PARTICLES_MAX
      );
      pistonHead.position.y = gasState.pistonY;
      pistonRod.position.y = gasState.rodY;
      adiabaticJacketRing.visible = Boolean(p.gasIsAdiabatic);

      // Auto-range Bourdon pressure dial face cleanly if compression exceeds 6 or 25 atm
      if (gasState.manometerMaxAtm !== currentManometerMaxAtm) {
        currentManometerMaxAtm = gasState.manometerMaxAtm;
        const oldTex = manometerFaceTex;
        manometerFaceTex = createAnalogGaugeDialTexture({
          min: 0,
          max: currentManometerMaxAtm,
          majorDivisions: 5,
          title: 'BOURDON',
          unit: 'atm',
        });
        manometerFaceMat.map = manometerFaceTex;
        manometerFaceMat.needsUpdate = true;
        oldTex?.dispose();
      }
      pressureNeedlePivot.rotation.z = gasState.manometerNeedleAngleRad;

      const effectiveScale = isLite ? Math.min(0.65, particleScale) : particleScale;
      const activeGasCount = Math.max(
        6,
        Math.min(GAS_PARTICLES_MAX, Math.round(gasState.activeMoleculeCount * effectiveScale))
      );
      for (let idx = 0; idx < activeGasCount; idx++) {
        const part = gasParticleStates[idx];
        part.pos.addScaledVector(part.vel, gasState.particleSpeed);
        if (part.pos.y > gasState.pistonY - 0.2 || part.pos.y < 0.6) {
          part.vel.y *= -1;
          part.pos.y = Math.max(0.6, Math.min(gasState.pistonY - 0.2, part.pos.y));
        }
        if (Math.abs(part.pos.x) > 1.2) {
          part.vel.x *= -1;
          part.pos.x = Math.sign(part.pos.x) * 1.2;
        }
        if (Math.abs(part.pos.z) > 1.2) {
          part.vel.z *= -1;
          part.pos.z = Math.sign(part.pos.z) * 1.2;
        }
        gasPool.setTransform(idx, part.pos.x, part.pos.y, part.pos.z, 1);
        gasPool.setColor(idx, gasState.gasColorHex);
      }
      gasPool.commit(activeGasCount);
    } else if (p.mode === 'reaction-kinetics-arrhenius') {
      const tempC = p.kineticsTempC ?? 25;
      const rpmVal = p.stirringRpm ?? 240;
      const arrK = m.arrheniusK ?? 0.08;
      const c0 = p.kineticsConcA ?? 0.5;
      const kinState = computeArrheniusKineticsState(tempC, rpmVal, reacting, arrK, c0, t);

      const hotplateKey = `${tempC}_${rpmVal}_${(m.reactionRate ?? 0).toFixed(3)}_${(kinState.reactionConversion * 100).toFixed(0)}`;
      if (hotplateKey !== lastHotplateKey) {
        lastHotplateKey = hotplateKey;
        updateInstrumentPanelTexture(hotplateScreenTex, {
          title: 'IKA HOTPLATE STIRRER',
          primaryText: `${tempC.toFixed(0)} °C · ${(kinState.reactionConversion * 100).toFixed(0)}%`,
          secondaryText: `${rpmVal} RPM · v=${(m.reactionRate ?? 0).toFixed(3)} M/s`,
          accentHex: tempC >= 60 ? '#f97316' : '#38bdf8',
        });
      }

      stirBar.rotation.y += kinState.stirAngularStep;
      vortexRing.rotation.z -= kinState.stirAngularStep * 0.85;
      vortexMat.opacity = kinState.vortexOpacity;

      // First-order conversion [A](t) = [A]0 * exp(-k*t) drives turbidity & sulfur-colloid amber color
      kLiquidMat.uniforms.uOpacity.value = kinState.turbidityOpacity;
      kLiquidMat.uniforms.uColor.value.setHex(kinState.solutionColorHex);
      vortexMat.color.setHex(kinState.solutionColorHex);

      const eaFraction = Math.min(1, Math.max(0, (tempC - 15) / 75));
      hotplateCeramicTopMat.emissiveIntensity = Math.min(0.68, 0.12 + eaFraction * 0.56);
      heaterRingMat.emissiveIntensity = Math.min(0.75, 0.2 + eaFraction * 0.55);
      heaterLight.intensity = Math.min(1.1, 0.25 + kinState.heaterIntensity * 0.65);
      if (isSimTimeAdvancing && tempC >= 60) {
        labSound.playThermalBubbling((tempC - 55) / 45);
      }
    } else if (p.mode === 'spectrophotometry-beer') {
      const absVal = m.spectroAbsorbance ?? 0.8;
      const wlNm = p.spectroWavelengthNm ?? 525;
      const pathB = p.spectroPathLengthCm ?? 1.0;
      const beamState = computeBeerLambertBeamState(wlNm, absVal, pathB);
      const transPct = beamState.transmittance * 100;

      const spectroKey = `${absVal.toFixed(3)}_${wlNm}_${pathB.toFixed(1)}`;
      if (spectroKey !== lastSpectroKey) {
        lastSpectroKey = spectroKey;
        updateInstrumentPanelTexture(spectroScreenTex, {
          title: 'UV-VIS SPECTROPHOTOMETER',
          primaryText: `A = ${absVal.toFixed(3)}`,
          secondaryText: `λ=${wlNm}nm · b=${pathB.toFixed(1)}cm · T=${transPct.toFixed(1)}%`,
          accentHex: '#38bdf8',
        });
      }

      // Physically widen/narrow cuvette optical path length along X axis matching b (cm)
      cuvette.scale.set(beamState.cuvettePathScale, 1, 1);
      cuvetteCap.scale.set(beamState.cuvettePathScale, 1, 1);
      analyteSolutionCuvette.scale.set(beamState.cuvettePathScale, 1, 1);
      const cuvMat = analyteSolutionCuvette.material as THREE.MeshStandardMaterial;
      cuvMat.color.setHex(beamState.solutionComplementaryHex);
      cuvMat.opacity = beamState.solutionOpacity;

      incidentBeamMat.color.setHex(beamState.beamColorHex);
      incidentBeamMat.opacity = beamState.incidentOpacity;
      transmittedBeamMat.color.setHex(beamState.beamColorHex);
      transmittedBeamMat.opacity = beamState.transmittedOpacity;
      lampApertureLens.material.color.setHex(beamState.beamColorHex);
      monoPrism.rotation.y = ((wlNm - 380) / 370) * 0.85;
    } else if (p.mode === 'chemical-equilibrium-lechatelier') {
      const tempC = p.equilibriumTempC ?? 25;
      const pressAtm = p.equilibriumPressureAtm ?? 1.0;
      const no2Pct = m.no2MoleFractionPct ?? 31.6;
      const kpVal = m.leChatelierKp ?? 0.142;
      const colorStyle = m.no2GasColorHex || '#d97706';

      // Thermal water bath color visually contrasts ice bath (<20°C) vs hot bath (>50°C)
      const bathHex = tempC < 20 ? 0x38bdf8 : tempC > 50 ? 0xf97316 : 0x64748b;
      lcBathWaterMat.color.setHex(bathHex);
      lcBathWaterMat.emissive.setHex(bathHex);
      lcBathWaterMat.opacity = tempC < 20 || tempC > 50 ? 0.34 : 0.16;

      // Piston height compresses as pressure increases from 0.2 -> 5.0 atm
      const normP = Math.max(0, Math.min(1, (pressAtm - 0.2) / 4.8));
      const gasHeight = 2.85 - normP * 1.35; // 2.85 down to 1.50
      const pistonY = 1.05 + gasHeight;
      leChatelierPiston.position.y = THREE.MathUtils.lerp(leChatelierPiston.position.y, pistonY, 0.22);
      lcGasCore.scale.y = THREE.MathUtils.lerp(lcGasCore.scale.y, gasHeight, 0.22);

      lcGasMat.color.setStyle(colorStyle);
      lcGasMat.emissive.setStyle(colorStyle);
      lcGasMat.opacity = 0.22 + (no2Pct / 100) * 0.64;

      const lcKey = `${tempC.toFixed(0)}_${pressAtm.toFixed(1)}_${no2Pct.toFixed(1)}`;
      if (lcKey !== lastLcKey) {
        lastLcKey = lcKey;
        updateInstrumentPanelTexture(lcScreenTex, {
          title: 'LE CHATELIER REACTOR',
          primaryText: `${tempC.toFixed(0)}°C · P=${pressAtm.toFixed(1)}atm`,
          secondaryText: `Kp=${kpVal.toFixed(2)} · NO₂=${no2Pct.toFixed(1)}%`,
          accentHex: no2Pct >= 50 ? '#ea580c' : '#38bdf8',
        });
      }

      const activeCount = Math.max(14, Math.round(LC_PARTICLES_MAX * (isLite ? 0.5 : particleScale)));
      const speed = 0.016 + (tempC / 100) * 0.032;
      const no2Cutoff = Math.round((no2Pct / 100) * activeCount);
      let instIdx = 0;
      for (let i = 0; i < activeCount; i++) {
        const st = lcParticleStates[i];
        st.pos.addScaledVector(st.vel, speed);
        const maxY = pistonY - 0.22;
        if (st.pos.y > maxY || st.pos.y < 1.18) {
          st.vel.y *= -1;
          st.pos.y = Math.max(1.18, Math.min(maxY, st.pos.y));
        }
        if (Math.abs(st.pos.x) > 0.92) {
          st.vel.x *= -1;
          st.pos.x = Math.sign(st.pos.x) * 0.92;
        }
        if (Math.abs(st.pos.z) > 0.92) {
          st.vel.z *= -1;
          st.pos.z = Math.sign(st.pos.z) * 0.92;
        }
        const isNo2Monomer = i < no2Cutoff;
        if (isNo2Monomer) {
          // Single brown NO2 monomer sphere
          lcPartPool.setTransform(instIdx, st.pos.x, st.pos.y, st.pos.z, 0.85);
          lcPartPool.setColor(instIdx, 0xc2410c);
          instIdx++;
        } else {
          // Paired colorless pale-cream N2O4 dimer (2 bonded spheres moving together)
          lcPartPool.setTransform(instIdx, st.pos.x - 0.065, st.pos.y, st.pos.z, 0.92);
          lcPartPool.setColor(instIdx, 0xfef3c7);
          instIdx++;
          lcPartPool.setTransform(instIdx, st.pos.x + 0.065, st.pos.y, st.pos.z, 0.92);
          lcPartPool.setColor(instIdx, 0xe2e8f0);
          instIdx++;
        }
      }
      lcPartPool.commit(instIdx);
    } else if (p.mode === 'electrolysis-faraday') {
      const eState = computeElectrolysisVisualState(p, m, t);
      elecLiquidMat.uniforms.uColor.value.setHex(eState.solutionHex);
      elecLiquidMat.uniforms.uOpacity.value = 0.56;
      elecPlatingMat.color.setHex(eState.depositMetalHex);
      elecCathodePlating.scale.set(
        eState.cathodePlatingThicknessScale,
        1,
        eState.cathodePlatingThicknessScale
      );
      elecAmmeterNeedlePivot.rotation.z = THREE.MathUtils.lerp(
        elecAmmeterNeedlePivot.rotation.z,
        eState.ammeterNeedleAngleRad,
        0.22
      );

      // Anode O2 rising micro-bubbles around x = 1.05
      const activeElecBubbles = Math.max(10, Math.round(ELEC_BUBBLES_MAX * particleScale));
      for (let i = 0; i < activeElecBubbles; i++) {
        const u = ((t * eState.anodeBubbleSpeed + i * 0.13) % 1 + 1) % 1;
        const bx = 1.05 + Math.sin(i * 2.3 + t * 2.8) * 0.24;
        const by = 0.58 + u * 1.44;
        const bz = 0.15 + Math.cos(i * 1.7) * 0.22;
        elecBubblePool.setTransform(i, bx, by, bz, 0.7 + u * 0.6);
      }
      elecBubblePool.commit(activeElecBubbles);

      // Electrolyte M^n+ cations migrating from bulk/anode toward cathode plating surface
      const activeCations = Math.max(8, Math.round(ELEC_CATIONS_MAX * particleScale));
      for (let i = 0; i < activeCations; i++) {
        const u = ((t * eState.electronDriftSpeed * 0.35 + i / activeCations) % 1 + 1) % 1;
        const cx = 0.92 - u * 1.85;
        const cy = 0.72 + ((i * 0.37) % 1.05) + Math.sin(t * 2.2 + i) * 0.06;
        const cz = 0.15 + Math.sin(i * 3.1) * 0.42;
        elecCationPool.setTransform(i, cx, cy, cz, 1.0);
        elecCationPool.setColor(i, eState.depositMetalHex);
      }
      elecCationPool.commit(activeCations);

      // Electron drift beads along external wires (Anode -> PSU -> Cathode)
      const activeWireE = Math.max(6, Math.round(ELEC_WIRE_ELECTRONS * particleScale));
      for (let i = 0; i < activeWireE; i++) {
        const u = ((t * eState.electronDriftSpeed * 0.42 + i / activeWireE) % 1 + 1) % 1;
        if (u < 0.5) {
          elecAnodeLeadCurve.getPoint(u * 2, _elecWirePos);
        } else {
          elecCathodeLeadCurve.getPoint((u - 0.5) * 2, _elecWirePos);
        }
        elecElectronPool.setTransform(i, _elecWirePos.x, _elecWirePos.y, _elecWirePos.z, 1.0);
      }
      elecElectronPool.commit(activeWireE);

      const currentA = p.electrolysisCurrentA ?? 2.5;
      const elecKey = `${eState.electrolyteId}_${currentA.toFixed(2)}_${eState.massDepositedG.toFixed(3)}`;
      if (elecKey !== lastElecKey) {
        lastElecKey = elecKey;
        updateInstrumentPanelTexture(elecScreenTex, {
          title: 'FARADAY DC RECTIFIER',
          primaryText: `I=${currentA.toFixed(2)}A · Q=${eState.chargeC} C`,
          secondaryText: `m(${eState.metalSymbol})=${eState.massDepositedG.toFixed(3)}g · O₂=${eState.anodeGasO2Ml.toFixed(1)}mL`,
          accentHex: '#38bdf8',
        });
      }
    }
  };

  return {
    redoxGroup,
    gasGroup,
    kineticsGroup,
    spectroGroup,
    leChatelierGroup,
    electrolysisGroup,
    pistonHead,
    leChatelierPiston,
    update,
    dispose: () => {
      voltScreenTex?.dispose();
      gasScaleTex?.dispose();
      manometerFaceTex?.dispose();
      hotplateScreenTex?.dispose();
      spectroScreenTex?.dispose();
      lcScreenTex?.dispose();
      elecScreenTex?.dispose();
      elecAmmeterTex?.dispose();
    },
  };
}

