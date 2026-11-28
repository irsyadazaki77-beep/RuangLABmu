import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  applyBorosilicateLiteMode,
  buildLatheFromProfile,
  createBeakerProfilePoints,
  createBorosilicateGlassMaterial,
  createBrushedMetalTextures,
  createBuretteClampAssembly,
  createContactShadowPlane,
  createErlenmeyerProfilePoints,
  createFunnelProfilePoints,
  createGlassRimHighlightMaterial,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  createInstrumentPanelTexture,
  updateInstrumentPanelTexture,
} from '../../utils/threeStudioKit';
import {
  ChemistryParams,
  ChemistryMetrics,
  evaluateSafetyHazard,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { globalMultiApparatusEngine } from '../../utils/engines/multiApparatusEngine';
import {
  computeCalorimeterVisualState,
  computeTitrationVisualState,
} from '../../utils/chemistryVisualHelpers';
import { buildChemistrySpecialRigs } from './ChemistryRigs';
import type {
  ConceptLabelDomRef,
  ConceptLabelProjectionEntry,
} from '../ui/ConceptLabelsOverlay';

export function createLiquidWobbleMaterial(initialHex: number, initialOpacity = 0.78): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWobbleAmp: { value: 0.007 },
      uColor: { value: new THREE.Color(initialHex) },
      uRimColor: { value: new THREE.Color(0xffffff) },
      uOpacity: { value: initialOpacity },
      uMeniscusStrength: { value: 0.016 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWobbleAmp;
      uniform float uMeniscusStrength;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;
      varying float vWaveHeight;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float topFactor = smoothstep(-0.1, 0.48, pos.y);
        float radialDist = length(pos.xz);
        // Smooth low-frequency swell avoids jagged radial triangle-fan distortion on CylinderGeometry caps
        float wave1 = sin(pos.x * 2.4 + uTime * 2.2) * cos(pos.z * 2.4 + uTime * 1.8);
        float wave2 = sin(radialDist * 3.8 - uTime * 2.6) * 0.35;
        float ripple = (wave1 + wave2) * uWobbleAmp * topFactor;
        float meniscus = pow(radialDist, 2.2) * uMeniscusStrength * topFactor;

        pos.y += ripple + meniscus;
        vWaveHeight = ripple + meniscus;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uRimColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;
      varying float vWaveHeight;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPos);
        float ndotv = abs(dot(viewDir, normal));
        float fresnel = pow(1.0 - ndotv, 2.5);
        float topSheen = smoothstep(0.62, 0.99, normal.y) * 0.22;

        // Crisp studio softbox specular glint across liquid surface & meniscus
        vec3 keyLightDir = normalize(vec3(0.48, 0.78, 0.42));
        vec3 halfVec = normalize(keyLightDir + viewDir);
        float specGlint = pow(max(dot(normal, halfVec), 0.0), 44.0) * 0.55;

        // Subtle Beer-Lambert vertical optical depth + capillary meniscus rim sheen
        vec3 deepColor = uColor * (0.72 + 0.34 * vUv.y);
        vec3 surfaceHighlight = mix(
          deepColor,
          uRimColor,
          clamp(fresnel * 0.44 + topSheen + clamp(vWaveHeight * 1.8, 0.0, 0.12), 0.0, 0.68)
        ) + uRimColor * specGlint;

        gl_FragColor = vec4(surfaceHighlight, clamp(uOpacity + fresnel * 0.14 + specGlint * 0.15, 0.0, 0.94));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

export interface ChemistryCoreStageUpdateInput {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  simTime: number;
  elapsed: number;
  dt: number;
  isLite: boolean;
  particleScale?: number;
  reacting: boolean;
  reactionProgress?: number;
  redoxPairId?: string;
  isSimTimeAdvancing: boolean;
  showConceptLabels: boolean;
}

export interface ChemistryCoreStageHandle {
  triggerWobbleBoost: (amount?: number) => void;
  playBuretteDropSound: () => void;
  update: (input: ChemistryCoreStageUpdateInput) => void;
  buildConceptEntries: (
    params: ChemistryParams,
    metrics: ChemistryMetrics,
    showLabels: boolean,
    cDom: Record<string, ConceptLabelDomRef>
  ) => ConceptLabelProjectionEntry[];
  dispose: () => void;
}

export function buildChemistryCoreStage(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  initialLiteOrSw: boolean,
  initialTitrantMl: number
): ChemistryCoreStageHandle {
  const metalTex = createBrushedMetalTextures();
  const buretteScaleTex = createGraduatedScaleTexture(100, 'mL', 25, {
    invertTopToBottom: true,
  });
  const beakerScaleTex = createGraduatedScaleTexture(250, 'mL', 25);

  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x2c3a4e,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.005,
    metalness: 0.72,
    roughness: 0.28,
    envMapIntensity: 0.88,
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
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe5a524,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.004,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.18,
  });
  const glassMat = createBorosilicateGlassMaterial(initialLiteOrSw, {
    color: 0xecfeff,
    tintOpacity: 0.32,
    ior: 1.47,
    thickness: 0.36,
  });
  const glassRimMat = createGlassRimHighlightMaterial(0xeef8ff);
  const graduationOverlayMat = (tex: THREE.CanvasTexture | null) =>
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.88,
    });

  const liquidShaderMaterials: THREE.ShaderMaterial[] = [];
  let wobbleBoost = 0;
  let lastTitrantMl = initialTitrantMl;
  let lastDropImpactCycle = -1;

  // 1. Thermo Calorimetry 3D Group
  const thermoGroup = new THREE.Group();
  scene.add(thermoGroup);

  const calVesselGeo = buildLatheFromProfile(createBeakerProfilePoints(1.42, 2.55, 0.065), 48);
  const calVessel = new THREE.Mesh(calVesselGeo, glassMat);
  calVessel.position.set(0, 0.29, 0);
  calVessel.castShadow = true;
  thermoGroup.add(calVessel);

  // Realistic lab Dewar insulating jacket with front observation cutout window so students see liquid volume & catalyst pellets
  const calJacketMat = new THREE.MeshStandardMaterial({
    color: 0x526275,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.005,
    metalness: 0.34,
    roughness: 0.46,
    side: THREE.DoubleSide,
  });
  const calJacket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 1.58, 40, 1, true, 0.46, Math.PI * 2 - 0.92),
    calJacketMat
  );
  calJacket.position.set(0, 1.12, 0);
  calJacket.castShadow = true;
  const calJacketTopBand = new THREE.Mesh(new THREE.TorusGeometry(1.485, 0.026, 10, 44), brassMat);
  calJacketTopBand.rotation.x = Math.PI / 2;
  calJacketTopBand.position.set(0, 1.91, 0);
  const calJacketBotBand = new THREE.Mesh(new THREE.TorusGeometry(1.485, 0.028, 10, 44), brassMat);
  calJacketBotBand.rotation.x = Math.PI / 2;
  calJacketBotBand.position.set(0, 0.33, 0);
  thermoGroup.add(calJacket, calJacketTopBand, calJacketBotBand);

  const calLiquidMat = createLiquidWobbleMaterial(0x38bdf8, 0.76);
  liquidShaderMaterials.push(calLiquidMat);
  const calLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.33, 1.33, 1.6, 36, 16),
    calLiquidMat
  );
  calLiquid.position.set(0, 1.12, 0);
  thermoGroup.add(calLiquid);

  const calMeniscusRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.31, 0.024, 12, 36),
    new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.62,
      roughness: 0.08,
      ...(initialLiteOrSw ? {} : { transmission: 0.5 }),
    })
  );
  calMeniscusRing.rotation.x = Math.PI / 2;
  calMeniscusRing.position.set(0, 1.91, 0);
  thermoGroup.add(calMeniscusRing);

  if (beakerScaleTex) {
    const calScaleSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(1.43, 1.43, 1.8, 36, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    calScaleSleeve.position.set(0, 1.35, 0);
    calScaleSleeve.rotation.y = -Math.PI * 0.42;
    thermoGroup.add(calScaleSleeve);
  }

  const calLid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.52, 0.18, 40),
    brushedSteelMat
  );
  calLid.position.set(0, 2.86, 0);
  calLid.castShadow = true;
  thermoGroup.add(calLid);

  const calLidKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.14, 0.22, 18),
    darkFrameMat
  );
  calLidKnob.position.set(-0.45, 3.04, 0);
  thermoGroup.add(calLidKnob);

  const calStirBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.62, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  calStirBar.rotation.z = Math.PI / 2;
  calStirBar.position.set(0, 0.42, 0);
  thermoGroup.add(calStirBar);

  const calGrommet = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.035, 12, 24),
    darkFrameMat
  );
  calGrommet.rotation.x = Math.PI / 2;
  calGrommet.position.set(0.6, 2.95, 0);
  thermoGroup.add(calGrommet);

  // Composite Laboratory Glass Thermometer with dynamic red alcohol column
  const calThermometerGroup = new THREE.Group();
  calThermometerGroup.position.set(0.6, 1.55, 0);
  const calThermGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 3.25, 18),
    glassMat
  );
  calThermGlass.position.set(0, 1.45, 0);
  calThermGlass.userData = { draggableParam: 'initialTempC', min: 10, max: 90, step: 1, label: 'Suhu Awal T₀' };
  const calThermBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.45, roughness: 0.18 })
  );
  calThermBulb.position.set(0, -0.18, 0);
  const calThermColumnGeo = new THREE.CylinderGeometry(0.026, 0.026, 2.7, 12);
  calThermColumnGeo.translate(0, 1.35, 0);
  const calThermColumn = new THREE.Mesh(
    calThermColumnGeo,
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4, roughness: 0.2 })
  );
  calThermColumn.position.set(0, -0.12, 0);
  calThermColumn.scale.y = 0.45;
  const calThermTopCap = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.018, 10, 18),
    brassMat
  );
  calThermTopCap.position.set(0, 3.12, 0);
  calThermometerGroup.add(calThermGlass, calThermBulb, calThermColumn, calThermTopCap);
  thermoGroup.add(calThermometerGroup);

  // Digital Calorimeter OLED Display Console beside calorimeter vessel
  const calOledTex = createInstrumentPanelTexture({
    title: 'DIGITAL CALORIMETER',
    primaryText: '25.0 °C',
    secondaryText: 'ΔT = 0.0 °C · STABIL',
    accentHex: '#38bdf8',
    width: 256,
    height: 128,
  });
  let lastCalOledKey = '';
  const calConsoleBox = new THREE.Mesh(
    new RoundedBoxGeometry(1.42, 0.72, 0.68, 3, 0.04),
    darkFrameMat
  );
  calConsoleBox.position.set(2.35, 0.65, 0.35);
  calConsoleBox.rotation.y = -0.32;
  calConsoleBox.castShadow = true;
  const calOledPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 0.52),
    new THREE.MeshBasicMaterial({ map: calOledTex })
  );
  calOledPlane.position.set(0, 0.04, 0.348);
  calConsoleBox.add(calOledPlane);
  thermoGroup.add(calConsoleBox);

  // Exothermic rising heat shimmer vapor particles + Endothermic icy frost condensation sleeve + Catalyst pellets
  const CAL_VAPOR_COUNT = 16;
  const calVaporMat = new THREE.MeshBasicMaterial({
    color: 0xfed7aa,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const calVaporPool = createInstancedParticlePool(
    CAL_VAPOR_COUNT,
    new THREE.SphereGeometry(0.14, 10, 10),
    calVaporMat,
    thermoGroup
  );
  calVaporPool.mesh.visible = false;

  const calFrostMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0,
    roughness: 0.78,
    metalness: 0.05,
    depthWrite: false,
  });
  const calFrostRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.495, 1.495, 1.56, 36, 1, true),
    calFrostMat
  );
  calFrostRing.position.set(0, 1.15, 0);
  calFrostRing.visible = false;
  thermoGroup.add(calFrostRing);

  const calCatalystGroup = new THREE.Group();
  const catPelletMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.78,
    roughness: 0.32,
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 0.38 + (i % 3) * 0.22;
    const pellet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.085, 0), catPelletMat);
    pellet.position.set(Math.cos(a) * r, 0.41, Math.sin(a) * r);
    calCatalystGroup.add(pellet);
  }
  calCatalystGroup.visible = false;
  thermoGroup.add(calCatalystGroup);

  // 2. Acid-Base Titration 3D Group
  const titrationGroup = new THREE.Group();
  scene.add(titrationGroup);

  const retBase = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.22, 3.2, 3, 0.04), darkFrameMat);
  retBase.position.set(-1.35, 0.4, 0);
  retBase.castShadow = true;
  retBase.receiveShadow = true;
  titrationGroup.add(retBase);

  const retContactShadow = createContactShadowPlane(1.65, 1.9, 0.34);
  retContactShadow.position.set(-1.35, 0.296, 0);
  titrationGroup.add(retContactShadow);

  // Grounded Compact Magnetic Stirrer Base + Sloped Digital Control Bezel + Ceramic Top Plate
  const stirrerChassis = new THREE.Mesh(
    new RoundedBoxGeometry(2.38, 0.26, 2.38, 3, 0.04),
    darkFrameMat
  );
  stirrerChassis.position.set(0, 0.42, 0);
  stirrerChassis.castShadow = true;
  stirrerChassis.receiveShadow = true;

  const stirrerContactShadow = createContactShadowPlane(1.52, 1.52, 0.36);
  stirrerContactShadow.position.set(0, 0.297, 0);
  titrationGroup.add(stirrerContactShadow);

  const stirrerFrontBezel = new THREE.Mesh(
    new RoundedBoxGeometry(2.2, 0.22, 0.32, 2, 0.03),
    darkFrameMat
  );
  stirrerFrontBezel.position.set(0, 0.39, 1.24);
  stirrerFrontBezel.rotation.x = -0.35;

  const stirrerOledTex = createInstrumentPanelTexture({
    title: 'STIRRER PRO',
    primaryText: '420 RPM',
    secondaryText: '25.0 °C · STABIL',
    accentHex: '#2dd4bf',
    width: 256,
    height: 112,
  });
  const stirrerOledScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.19),
    new THREE.MeshBasicMaterial({ map: stirrerOledTex })
  );
  stirrerOledScreen.position.set(-0.34, 0, 0.158);
  stirrerFrontBezel.add(stirrerOledScreen);

  const stirrerKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.098, 0.13, 20),
    brassMat
  );
  stirrerKnob.rotation.x = Math.PI / 2 - 0.35;
  stirrerKnob.position.set(0.48, 0.43, 1.4);
  const knobTick1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.02, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  knobTick1.position.set(0, 0.068, -0.028);
  stirrerKnob.add(knobTick1);

  const stirrerKnob2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.098, 0.13, 20),
    brushedSteelMat
  );
  stirrerKnob2.rotation.x = Math.PI / 2 - 0.35;
  stirrerKnob2.position.set(0.8, 0.43, 1.4);
  const knobTick2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.02, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x0f172a })
  );
  knobTick2.position.set(0, 0.068, -0.028);
  stirrerKnob2.add(knobTick2);

  // Machined aluminum chassis trim band + glazed white ceramic top plate with heating target ring
  const stirrerTrimBand = new THREE.Mesh(
    new RoundedBoxGeometry(2.43, 0.045, 2.43, 2, 0.014),
    brushedSteelMat
  );
  stirrerTrimBand.position.set(0, 0.525, 0);

  const porcelainTile = new THREE.Mesh(
    new RoundedBoxGeometry(2.12, 0.06, 2.12, 2, 0.02),
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.14,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.05,
    })
  );
  porcelainTile.position.set(0, 0.56, 0);
  porcelainTile.receiveShadow = true;

  const hotplateRing = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 0.96, 40),
    new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  hotplateRing.rotation.x = -Math.PI / 2;
  hotplateRing.position.set(0, 0.593, 0);

  const titrationStirBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.52, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18 })
  );
  titrationStirBar.rotation.z = Math.PI / 2;
  titrationStirBar.position.set(0, 0.68, 0);
  titrationGroup.add(
    stirrerChassis,
    stirrerTrimBand,
    stirrerFrontBezel,
    stirrerKnob,
    stirrerKnob2,
    porcelainTile,
    hotplateRing,
    titrationStirBar
  );

  const rodCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 20), brushedSteelMat);
  rodCollar.position.set(-2.2, 0.57, 0);
  titrationGroup.add(rodCollar);

  const retRod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.4, 20), brushedSteelMat);
  retRod.position.set(-2.2, 3.6, 0);
  retRod.castShadow = true;
  titrationGroup.add(retRod);

  titrationGroup.add(createBuretteClampAssembly(-2.2, 0, 5.2, brushedSteelMat, darkFrameMat));
  titrationGroup.add(createBuretteClampAssembly(-2.2, 0, 3.3, brushedSteelMat, darkFrameMat));

  const buretteTube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.1, 28), glassMat);
  buretteTube.position.set(0, 4.45, 0);
  buretteTube.castShadow = true;
  titrationGroup.add(buretteTube);

  if (buretteScaleTex) {
    const buretteScaleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.186, 0.186, 3.7, 28, 1, true),
      graduationOverlayMat(buretteScaleTex)
    );
    buretteScaleMesh.position.set(0, 4.45, 0);
    buretteScaleMesh.rotation.y = -Math.PI * 0.45;
    titrationGroup.add(buretteScaleMesh);
  }

  const buretteTip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.032, 0.48, 20), glassMat);
  buretteTip.position.set(0, 1.98, 0);
  titrationGroup.add(buretteTip);

  globalMultiApparatusEngine.seedDefaultDomainNodes('Kimia');
  const buretteNozzleAnchor = new THREE.Object3D();
  buretteNozzleAnchor.name = 'anchor-burette-nozzle-out';
  buretteNozzleAnchor.position.set(0, -0.24, 0);
  buretteTip.add(buretteNozzleAnchor);
  globalMultiApparatusEngine.bindPortAnchor('buret-titran-3d', 'nozzle-out', buretteNozzleAnchor);

  const buretteFunnel = new THREE.Mesh(
    buildLatheFromProfile(createFunnelProfilePoints(0.32, 0.08, 0.36, 0.22), 32),
    glassMat
  );
  buretteFunnel.position.set(0, 6.38, 0);
  titrationGroup.add(buretteFunnel);

  const buretteLiquidMat = createLiquidWobbleMaterial(0x38bdf8, 0.75);
  liquidShaderMaterials.push(buretteLiquidMat);
  const buretteLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 3.8, 24, 12),
    buretteLiquidMat
  );
  buretteLiquid.position.set(0, 4.4, 0);
  titrationGroup.add(buretteLiquid);

  const buretteMeniscusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.142, 0.015, 12, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.82,
      roughness: 0.06,
    })
  );
  buretteMeniscusRing.rotation.x = Math.PI / 2;
  buretteMeniscusRing.position.set(0, 6.26, 0);
  titrationGroup.add(buretteMeniscusRing);

  const stopcockBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  stopcockBody.rotation.z = Math.PI / 2;
  stopcockBody.position.set(0, 2.26, 0);
  titrationGroup.add(stopcockBody);

  const stopcock = new THREE.Group();
  stopcock.position.set(0, 2.26, 0);
  const stopcockAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.72, 16), brassMat);
  stopcockAxle.rotation.z = Math.PI / 2;
  stopcockAxle.castShadow = true;
  stopcockAxle.userData = { draggableParam: 'titrantAddedMl', min: 0, max: 100, step: 0.5, label: 'Volume Titran Vb' };
  const stopcockWing = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.36, 0.06, 2, 0.015), darkFrameMat);
  stopcockWing.position.set(0.38, 0, 0);
  stopcockWing.userData = { draggableParam: 'titrantAddedMl', min: 0, max: 100, step: 0.5, label: 'Volume Titran Vb' };
  stopcock.add(stopcockAxle, stopcockWing);
  titrationGroup.add(stopcock);

  const buretSoundEmitter = labSound.createPositionalSoundEmitter(camera, 'titration-drop');
  stopcock.add(buretSoundEmitter.sound);

  const fallingDropMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.88,
    roughness: 0.05,
    ...(initialLiteOrSw ? {} : { transmission: 0.75, ior: 1.33 }),
  });
  const fallingDropMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 14, 14),
    fallingDropMat
  );
  fallingDropMesh.scale.set(0.82, 1.38, 0.82);
  fallingDropMesh.position.set(0, 1.82, 0);
  titrationGroup.add(fallingDropMesh);

  const flaskGeo = buildLatheFromProfile(createErlenmeyerProfilePoints(1.24, 0.38, 2.15, 0.045), 48);
  const flaskMesh = new THREE.Mesh(flaskGeo, glassMat);
  flaskMesh.position.set(0, 0.56, 0);
  flaskMesh.castShadow = true;
  titrationGroup.add(flaskMesh);

  // Luminous borosilicate rolled rim rings on Erlenmeyer lip, base heel, and burette top
  const flaskLipRing = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.026, 12, 36), glassRimMat);
  flaskLipRing.rotation.x = Math.PI / 2;
  flaskLipRing.position.set(0, 2.69, 0);
  const flaskBaseRim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.024, 12, 44), glassRimMat);
  flaskBaseRim.rotation.x = Math.PI / 2;
  flaskBaseRim.position.set(0, 0.61, 0);
  const buretteLipRing = new THREE.Mesh(new THREE.TorusGeometry(0.184, 0.018, 10, 28), glassRimMat);
  buretteLipRing.rotation.x = Math.PI / 2;
  buretteLipRing.position.set(0, 6.49, 0);
  titrationGroup.add(flaskLipRing, flaskBaseRim, buretteLipRing);

  // Realistic glass pH electrode probe dipped into the Erlenmeyer flask with arched coaxial cable to pH meter
  const phProbeGroup = new THREE.Group();
  const phProbeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.038, 1.85, 16),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.32,
      metalness: 0.25,
    })
  );
  phProbeBody.position.set(0.32, 1.98, 0.04);
  phProbeBody.rotation.z = -0.22;
  const phProbeGlassTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 14, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      roughness: 0.08,
      envMapIntensity: 1.5,
    })
  );
  phProbeGlassTip.position.set(0.12, 1.09, 0.04);
  const phProbeCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.048, 0.22, 16),
    brassMat
  );
  phProbeCap.position.set(0.52, 2.88, 0.04);
  phProbeCap.rotation.z = -0.22;

  const probeCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.55, 2.98, 0.04),
    new THREE.Vector3(1.08, 3.28, -0.18),
    new THREE.Vector3(1.72, 2.62, -0.28),
    new THREE.Vector3(2.12, 1.25, -0.16),
    new THREE.Vector3(2.18, 0.68, -0.05),
  ]);
  const probeCableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(probeCableCurve, 28, 0.022, 10, false),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.15 })
  );
  probeCableMesh.castShadow = true;
  phProbeGroup.add(phProbeBody, phProbeGlassTip, phProbeCap, probeCableMesh);
  titrationGroup.add(phProbeGroup);

  const flaskNeckAnchor = new THREE.Object3D();
  flaskNeckAnchor.name = 'anchor-flask-neck-in';
  flaskNeckAnchor.position.set(0, 2.15, 0);
  flaskMesh.add(flaskNeckAnchor);
  globalMultiApparatusEngine.bindPortAnchor('erlenmeyer-analit-3d', 'neck-in', flaskNeckAnchor);

  if (beakerScaleTex) {
    const flaskScaleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 1.12, 1.15, 32, 1, true),
      graduationOverlayMat(beakerScaleTex)
    );
    flaskScaleMesh.position.set(0, 1.16, 0);
    flaskScaleMesh.rotation.y = -Math.PI * 0.45;
    titrationGroup.add(flaskScaleMesh);
  }

  const analyteLiquidMat = createLiquidWobbleMaterial(0xf8fafc, 0.82);
  liquidShaderMaterials.push(analyteLiquidMat);
  const analyteSolution = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 1.15, 0.96, 36, 16),
    analyteLiquidMat
  );
  analyteSolution.position.set(0, 1.06, 0);
  titrationGroup.add(analyteSolution);

  const flaskMeniscusMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.72,
    roughness: 0.08,
  });
  const flaskMeniscusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.675, 0.022, 12, 36),
    flaskMeniscusMat
  );
  flaskMeniscusRing.rotation.x = Math.PI / 2;
  flaskMeniscusRing.position.set(0, 1.54, 0);
  titrationGroup.add(flaskMeniscusRing);

  const radialColorDiscMat = new THREE.MeshBasicMaterial({
    color: 0xf472b6,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const radialColorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.64, 32),
    radialColorDiscMat
  );
  radialColorDisc.rotation.x = -Math.PI / 2;
  radialColorDisc.position.set(0, 1.543, 0);
  titrationGroup.add(radialColorDisc);

  const rippleRingMat1 = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rippleRing1 = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.095, 32),
    rippleRingMat1
  );
  rippleRing1.rotation.x = -Math.PI / 2;
  rippleRing1.position.set(0, 1.546, 0);
  titrationGroup.add(rippleRing1);

  const rippleRingMat2 = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rippleRing2 = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.09, 32),
    rippleRingMat2
  );
  rippleRing2.rotation.x = -Math.PI / 2;
  rippleRing2.position.set(0, 1.547, 0);
  titrationGroup.add(rippleRing2);

  const phScaleCanvas = document.createElement('canvas');
  phScaleCanvas.width = 128;
  phScaleCanvas.height = 512;
  const phCtx = phScaleCanvas.getContext('2d');
  if (phCtx) {
    phCtx.fillStyle = '#0f172a';
    phCtx.fillRect(0, 0, 128, 512);
    const grad = phCtx.createLinearGradient(0, 494, 0, 18);
    grad.addColorStop(0.0, '#ef4444');
    grad.addColorStop(0.25, '#f59e0b');
    grad.addColorStop(0.5, '#10b981');
    grad.addColorStop(0.75, '#0ea5e9');
    grad.addColorStop(1.0, '#8b5cf6');
    phCtx.fillStyle = grad;
    phCtx.fillRect(14, 18, 42, 476);

    phCtx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
    phCtx.fillStyle = '#e2e8f0';
    phCtx.font = 'bold 20px "IBM Plex Mono", monospace';
    phCtx.textBaseline = 'middle';
    for (let phVal = 0; phVal <= 14; phVal += 1) {
      const y = 494 - (phVal / 14) * 476;
      const isMajor = phVal % 2 === 0 || phVal === 7;
      phCtx.lineWidth = isMajor ? 2.2 : 1.2;
      phCtx.beginPath();
      phCtx.moveTo(58, y);
      phCtx.lineTo(isMajor ? 74 : 66, y);
      phCtx.stroke();
      if (isMajor) {
        phCtx.fillText(`${phVal}`, 80, y);
      }
    }
  }
  const phScaleTex = new THREE.CanvasTexture(phScaleCanvas);
  phScaleTex.colorSpace = THREE.SRGBColorSpace;
  phScaleTex.anisotropy = 4;

  const phMeterOledTex = createInstrumentPanelTexture({
    title: 'DIGITAL pH METER',
    primaryText: 'pH 7.00',
    secondaryText: 'NETRAL · 25.0 °C',
    accentHex: '#34d399',
    width: 256,
    height: 128,
  });
  let lastPhOledKey = '';
  let lastStirrerOledKey = '';

  const phScaleGroup = new THREE.Group();
  phScaleGroup.position.set(2.35, 0.29, 0.12);
  phScaleGroup.rotation.y = -0.22;

  const phContactShadow = createContactShadowPlane(0.95, 0.72, 0.34);
  phContactShadow.position.set(0, 0.008, 0);

  // Sloped benchtop Digital pH Meter console + upright colorimetric comparator tower
  const phStandFoot = new THREE.Mesh(
    new RoundedBoxGeometry(1.26, 0.26, 0.92, 3, 0.04),
    darkFrameMat
  );
  phStandFoot.position.set(0, 0.13, 0.08);
  phStandFoot.castShadow = true;
  phStandFoot.receiveShadow = true;

  const phConsoleSlope = new THREE.Mesh(
    new RoundedBoxGeometry(1.18, 0.48, 0.64, 3, 0.03),
    darkFrameMat
  );
  phConsoleSlope.position.set(0, 0.36, 0.14);
  phConsoleSlope.rotation.x = -0.52;
  phConsoleSlope.castShadow = true;

  const phOledScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, 0.41),
    new THREE.MeshBasicMaterial({ map: phMeterOledTex })
  );
  phOledScreen.position.set(0, 0, 0.328);
  phConsoleSlope.add(phOledScreen);

  const phBackHousing = new THREE.Mesh(
    new RoundedBoxGeometry(0.62, 2.32, 0.12, 3, 0.025),
    darkFrameMat
  );
  phBackHousing.position.set(0, 1.56, -0.2);
  phBackHousing.castShadow = true;

  const phTrimBezel = new THREE.Mesh(
    new RoundedBoxGeometry(0.66, 0.05, 0.15, 2, 0.01),
    brushedSteelMat
  );
  phTrimBezel.position.set(0, 2.72, -0.2);

  const phScalePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 2.18),
    new THREE.MeshBasicMaterial({ map: phScaleTex, side: THREE.DoubleSide })
  );
  phScalePlane.position.set(0, 1.56, -0.135);

  const phPointerMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.2, 14),
    brassMat
  );
  phPointerMesh.rotation.z = -Math.PI / 2;
  phPointerMesh.position.set(-0.37, 1.56, -0.12);
  phScaleGroup.add(
    phContactShadow,
    phStandFoot,
    phConsoleSlope,
    phBackHousing,
    phTrimBezel,
    phScalePlane,
    phPointerMesh
  );
  titrationGroup.add(phScaleGroup);

  // 3-6. Special Chemistry Rigs
  const sharedBeakerGeo = buildLatheFromProfile(createBeakerProfilePoints(0.92, 1.85, 0.045), 40);
  const specialRigs = buildChemistrySpecialRigs(scene, {
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
  });
  const { pistonHead, leChatelierPiston } = specialRigs;

  // 7. Rising Gas Micro-Bubble Pool
  const BUBBLE_COUNT = 96;
  const bubbleSpeeds = new Float32Array(BUBBLE_COUNT);
  const bubbleSeeds = new Float32Array(BUBBLE_COUNT);
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    bubbleSpeeds[i] = 0.35 + Math.random() * 0.65;
    bubbleSeeds[i] = Math.random() * Math.PI * 2;
  }
  const bubbleInstGeo = new THREE.SphereGeometry(0.032, 10, 10);
  const bubbleInstMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.78,
    roughness: 0.08,
    metalness: 0.1,
  });
  const bubblePool = createInstancedParticlePool(BUBBLE_COUNT, bubbleInstGeo, bubbleInstMat, scene);

  // 8. K3 Safety Hazard 3D Vapor, Warning Ring & Beacon Light
  const hazardGroup = new THREE.Group();
  hazardGroup.visible = false;
  scene.add(hazardGroup);

  const hazardLight = new THREE.PointLight(0xf43f5e, 0, 14);
  hazardLight.position.set(0, 3.8, 1.8);
  hazardGroup.add(hazardLight);

  const chemHazardRingGeo = new THREE.TorusGeometry(2.1, 0.045, 12, 48);
  const chemHazardRingMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.82,
  });
  const chemHazardRing = new THREE.Mesh(chemHazardRingGeo, chemHazardRingMat);
  chemHazardRing.rotation.x = Math.PI / 2;
  chemHazardRing.position.set(0, 0.3, 0);
  hazardGroup.add(chemHazardRing);

  const overpressureHaloGeo = new THREE.TorusGeometry(1.42, 0.036, 12, 36);
  const overpressureHaloMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.72,
  });
  const overpressureHalo = new THREE.Mesh(overpressureHaloGeo, overpressureHaloMat);
  overpressureHalo.rotation.x = Math.PI / 2;
  overpressureHalo.position.set(0, 2.0, 0);
  hazardGroup.add(overpressureHalo);

  const CHEM_VAPOR_COUNT = 18;
  const chemVaporGeo = new THREE.SphereGeometry(0.2, 10, 10);
  const chemVaporMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const chemVaporPool = createInstancedParticlePool(
    CHEM_VAPOR_COUNT,
    chemVaporGeo,
    chemVaporMat,
    hazardGroup
  );
  for (let i = 0; i < CHEM_VAPOR_COUNT; i++) {
    chemVaporPool.setColor(i, i % 2 === 0 ? 0xef4444 : 0xf97316);
  }
  chemVaporPool.commit(CHEM_VAPOR_COUNT);

  const reusableConceptPos = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const reusableConceptEntries: ConceptLabelProjectionEntry[] = [
    { dom: undefined, worldPos: reusableConceptPos[0], text: '', active: false },
    { dom: undefined, worldPos: reusableConceptPos[1], text: '', active: false },
    { dom: undefined, worldPos: reusableConceptPos[2], text: '', active: false },
  ];

  const update = (input: ChemistryCoreStageUpdateInput) => {
    const {
      params: p,
      metrics: m,
      simTime: t,
      elapsed,
      dt,
      isLite,
      particleScale = isLite ? 0.5 : 1,
      reacting,
      isSimTimeAdvancing,
    } = input;

    applyBorosilicateLiteMode(glassMat, isLite);

    const isRedox = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
    thermoGroup.visible = p.mode === 'thermo-calorimetry';
    titrationGroup.visible = p.mode === 'acid-base-titration';

    const safetyAlert = evaluateSafetyHazard('Kimia', undefined, p);
    hazardGroup.visible = safetyAlert.isHazardous;
    if (safetyAlert.isHazardous) {
      const nowSec = elapsed;
      const [fx, fy, fz] = safetyAlert.hazardFocusPoint ?? [0, 1.5, 0];
      hazardLight.intensity = isLite ? 0 : 2.8 + Math.sin(nowSec * 12) * 2.2;
      const ringPulse = 1 + Math.sin(nowSec * 8) * 0.08;
      chemHazardRing.scale.set(ringPulse, ringPulse, 1);
      chemHazardRingMat.opacity = 0.52 + 0.32 * Math.abs(Math.sin(nowSec * 6));
      overpressureHalo.visible = safetyAlert.hazardCode === 'CHEM_OVERPRESSURE_VESSEL';
      if (overpressureHalo.visible) {
        const opScale = 1 + Math.sin(nowSec * 10) * 0.1;
        overpressureHalo.scale.set(opScale, opScale, 1);
      }
      const activeVapor = Math.max(5, Math.round(CHEM_VAPOR_COUNT * particleScale));
      chemVaporMat.opacity = 0.32 + 0.12 * Math.abs(Math.sin(nowSec * 4));
      for (let idx = 0; idx < activeVapor; idx++) {
        const cycle = (nowSec * 1.25 + idx * 0.19) % 1.0;
        const vx = fx + Math.sin(nowSec * 2.1 + idx) * (0.35 + cycle * 0.9);
        const vy = fy + cycle * 2.6;
        const vz = fz + Math.cos(nowSec * 1.7 + idx) * (0.35 + cycle * 0.8);
        const vScale = (0.55 + cycle * 1.4) * (1 - cycle * 0.35);
        chemVaporPool.setTransform(idx, vx, vy, vz, vScale);
      }
      chemVaporPool.commit(activeVapor);
    }

    const curVb = p.titrantAddedMl ?? 0;
    if (Math.abs(curVb - lastTitrantMl) > 0.01) {
      wobbleBoost = 0.085;
      lastTitrantMl = curVb;
    }
    wobbleBoost = Math.max(0, wobbleBoost - dt * 0.06);

    const baseWobble = reacting ? 0.05 : 0.018;
    const totalWobble = baseWobble + wobbleBoost;
    for (const mat of liquidShaderMaterials) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uWobbleAmp.value = totalWobble;
    }

    if (p.mode === 'acid-base-titration') {
      analyteLiquidMat.uniforms.uColor.value.setStyle(m.indicatorColorHex);
      flaskMeniscusMat.color.setStyle(m.indicatorColorHex);
      radialColorDiscMat.color.setStyle(m.indicatorColorHex);

      const va = p.analyteVolumeMl ?? 50;
      const vb = p.titrantAddedMl ?? 0;
      const rpm = p.stirringRpm ?? 420;
      const tempC = p.initialTempC ?? 25;
      const titState = computeTitrationVisualState(va, vb, rpm);

      // Burette liquid drains over full 0..100 mL slider capacity
      const level = Math.max(0.14, 3.8 * titState.buretteFillFrac);
      buretteLiquid.scale.set(1, level / 3.8, 1);
      const liquidCenterY = 2.45 + level / 2;
      buretteLiquid.position.set(0, liquidCenterY, 0);
      buretteMeniscusRing.position.set(0, liquidCenterY + level / 2 - 0.02, 0);

      // Erlenmeyer flask liquid level visibly rises as total volume (Va + Vb) increases
      const flaskH = 0.96 * titState.flaskVolumeScale;
      const flaskBottomY = 0.58;
      const flaskSurfaceY = flaskBottomY + flaskH;
      analyteSolution.scale.set(1, titState.flaskVolumeScale, 1);
      analyteSolution.position.set(0, flaskBottomY + flaskH * 0.5, 0);
      flaskMeniscusRing.position.set(0, flaskSurfaceY, 0);
      const meniscusRadiusScale = Math.max(0.62, Math.min(1.12, 1.16 - titState.flaskVolumeScale * 0.22));
      flaskMeniscusRing.scale.set(meniscusRadiusScale, meniscusRadiusScale, 1);
      radialColorDisc.position.set(0, flaskSurfaceY + 0.004, 0);
      rippleRing1.position.set(0, flaskSurfaceY + 0.007, 0);
      rippleRing2.position.set(0, flaskSurfaceY + 0.008, 0);

      const dropRate = reacting || wobbleBoost > 0.01 ? 2.4 : vb > 0 ? 1.15 : 0;
      if (dropRate > 0 && vb < 100) {
        const dropPhase = (t * dropRate) % 1.0;
        const dropCycle = Math.floor(t * dropRate);
        fallingDropMesh.visible = dropPhase < 0.72;
        if (fallingDropMesh.visible) {
          const fallProgress = dropPhase / 0.72;
          const fallSpan = Math.max(0.18, 1.92 - flaskSurfaceY);
          const dropY = 1.92 - fallProgress * fallProgress * fallSpan;
          fallingDropMesh.position.set(0, dropY, 0);
        } else if (isSimTimeAdvancing && reacting && lastDropImpactCycle !== dropCycle) {
          lastDropImpactCycle = dropCycle;
          labSound.playTitrationDrop(m.currentPh ?? 7.0);
        }

        const ripplePhase1 = (t * dropRate - 0.72 + 1.0) % 1.0;
        const ripplePhase2 = (t * dropRate - 0.32 + 1.0) % 1.0;
        rippleRing1.visible = true;
        rippleRing1.scale.setScalar((0.35 + ripplePhase1 * 5.2) * meniscusRadiusScale);
        rippleRingMat1.opacity = Math.max(0, (1 - ripplePhase1) * 0.68);

        rippleRing2.visible = !isLite;
        if (!isLite) {
          rippleRing2.scale.setScalar((0.35 + ripplePhase2 * 5.2) * meniscusRadiusScale);
          rippleRingMat2.opacity = Math.max(0, (1 - ripplePhase2) * 0.45);
        }

        const radialPulse = 0.35 + 0.65 * Math.sin(ripplePhase1 * Math.PI);
        radialColorDisc.visible = true;
        radialColorDisc.scale.setScalar((0.28 + ripplePhase1 * 0.72) * meniscusRadiusScale);
        radialColorDiscMat.opacity = 0.25 + radialPulse * 0.35;
      } else {
        fallingDropMesh.visible = false;
        rippleRing1.visible = false;
        rippleRing2.visible = false;
        radialColorDisc.visible = vb > 0;
        radialColorDisc.scale.setScalar(0.95 * meniscusRadiusScale);
        radialColorDiscMat.opacity = 0.32;
      }

      phScaleGroup.visible = true;
      const currentPhVal = m.currentPh ?? 7;
      const phFrac = Math.min(1, Math.max(0, currentPhVal / 14));
      phPointerMesh.position.y = 0.54 + phFrac * 2.04;
      const phKey = `${currentPhVal.toFixed(2)}|${tempC.toFixed(1)}`;
      if (phKey !== lastPhOledKey) {
        lastPhOledKey = phKey;
        const zoneLabel =
          currentPhVal < 6.4 ? 'ZONA ASAM' : currentPhVal > 7.6 ? 'ZONA BASA' : 'EKUIVALEN';
        const accentHex =
          currentPhVal < 6.4 ? '#fb923c' : currentPhVal > 7.6 ? '#c084fc' : '#34d399';
        updateInstrumentPanelTexture(phMeterOledTex, {
          title: 'DIGITAL pH METER',
          primaryText: `pH ${currentPhVal.toFixed(2)}`,
          secondaryText: `${zoneLabel} · ${tempC.toFixed(1)} °C`,
          accentHex,
        });
      }

      const stirrerKey = `${Math.round(rpm)}|${tempC.toFixed(1)}`;
      if (stirrerKey !== lastStirrerOledKey) {
        lastStirrerOledKey = stirrerKey;
        updateInstrumentPanelTexture(stirrerOledTex, {
          title: 'STIRRER PRO',
          primaryText: `${Math.round(rpm)} RPM`,
          secondaryText: `${tempC.toFixed(1)} °C · V=${(va + vb).toFixed(0)}mL`,
          accentHex: '#2dd4bf',
        });
      }

      // Rotate PTFE stir bar using live RPM & visibly open/close stopcock valve when dripping
      titrationStirBar.rotation.y += titState.stirAngularStep * (reacting || wobbleBoost > 0.01 ? 1.45 : 0.75);
      stopcockWing.rotation.x = THREE.MathUtils.lerp(
        stopcockWing.rotation.x,
        dropRate > 0 && vb < 100 ? 0 : Math.PI / 2,
        0.18
      );
    } else if (p.mode === 'thermo-calorimetry') {
      const calState = computeCalorimeterVisualState(
        p.initialTempC ?? 25,
        m.finalTempC ?? p.initialTempC ?? 25,
        p.solutionVolumeMl ?? 200,
        p.stirringRpm ?? 400,
        input.reactionProgress ?? 1,
        reacting
      );

      // Update live liquid height from solutionVolumeMl & thermal color from Exo/Endo T(t)
      const liqH = 1.6 * calState.liquidHeightScale;
      calLiquid.scale.set(1, calState.liquidHeightScale, 1);
      calLiquid.position.set(0, 0.34 + liqH * 0.5, 0);
      calMeniscusRing.position.set(0, 0.34 + liqH - 0.01, 0);
      calLiquidMat.uniforms.uColor.value.setHex(calState.liquidColorHex);
      (calMeniscusRing.material as THREE.MeshPhysicalMaterial).color.setHex(calState.liquidColorHex);

      // Thermometer alcohol/mercury column matches live T(t)
      calThermColumn.scale.y = THREE.MathUtils.lerp(calThermColumn.scale.y, calState.mercuryFillScale, 0.16);
      calStirBar.rotation.y += calState.stirAngularStep;
      calCatalystGroup.visible = Boolean(p.useCatalyst);

      // Exothermic heat vapor particles rising from lid vent
      calVaporPool.mesh.visible = calState.thermalVaporIntensity > 0.05;
      if (calVaporPool.mesh.visible) {
        calVaporMat.opacity = calState.thermalVaporIntensity * 0.42;
        const activeV = Math.max(6, Math.round(CAL_VAPOR_COUNT * particleScale));
        for (let i = 0; i < activeV; i++) {
          const cyc = (elapsed * 0.75 + i / activeV) % 1.0;
          const vx = Math.sin(elapsed * 2.0 + i * 1.7) * (0.18 + cyc * 0.42);
          const vy = 2.95 + cyc * 1.65;
          const vz = Math.cos(elapsed * 1.8 + i * 1.3) * (0.18 + cyc * 0.42);
          calVaporPool.setTransform(i, vx, vy, vz, 0.5 + cyc * 1.15);
        }
        calVaporPool.commit(activeV);
      }

      // Endothermic icy frost condensation ring on outer calorimeter jacket
      calFrostRing.visible = calState.frostCondensationIntensity > 0.05;
      if (calFrostRing.visible) {
        calFrostMat.opacity = calState.frostCondensationIntensity * 0.52;
      }

      const calKey = `${calState.liveTempC.toFixed(1)}|${calState.deltaTempLiveC.toFixed(1)}|${Boolean(p.useCatalyst)}`;
      if (calKey !== lastCalOledKey) {
        lastCalOledKey = calKey;
        const signStr = calState.deltaTempLiveC >= 0 ? '+' : '';
        const modeTag = calState.isExothermic ? 'EKSOTERM' : calState.isEndothermic ? 'ENDOTERM' : 'STABIL';
        updateInstrumentPanelTexture(calOledTex, {
          title: 'DIGITAL CALORIMETER',
          primaryText: `${calState.liveTempC.toFixed(1)} °C`,
          secondaryText: `ΔT=${signStr}${calState.deltaTempLiveC.toFixed(1)}°C · ${modeTag}`,
          accentHex: calState.isExothermic ? '#fb923c' : calState.isEndothermic ? '#38bdf8' : '#34d399',
        });
      }
    }

    specialRigs.update({
      params: p,
      metrics: m,
      simTime: t,
      isLite,
      particleScale,
      reacting,
      redoxPairId: input.redoxPairId,
      isSimTimeAdvancing,
    });

    const showBubbles =
      reacting ||
      isRedox ||
      p.mode === 'reaction-kinetics-arrhenius' ||
      p.mode === 'thermo-calorimetry' ||
      (p.mode === 'acid-base-titration' && wobbleBoost > 0.01);

    bubblePool.mesh.visible = showBubbles;
    if (showBubbles) {
      const rateMultiplier = reacting ? 1.85 : 0.9;
      const effectiveBubbleScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      const activeBubbles = Math.max(16, Math.round(BUBBLE_COUNT * effectiveBubbleScale));
      const bubbleColorHex =
        p.mode === 'acid-base-titration' && typeof m.indicatorColorHex === 'string'
          ? parseInt(m.indicatorColorHex.replace('#', ''), 16) || 0xe0f2fe
          : 0xe0f2fe;

      for (let i = 0; i < activeBubbles; i++) {
        let minY = 0.4;
        let maxY = 1.65;
        let centerX = 0;

        if (isRedox) {
          centerX = i % 2 === 0 ? -1.8 : 1.8;
          minY = 0.4;
          maxY = 1.48;
        } else if (p.mode === 'reaction-kinetics-arrhenius') {
          centerX = 0;
          minY = 1.25;
          maxY = 2.15;
        } else if (p.mode === 'acid-base-titration') {
          centerX = 0;
          minY = 0.6;
          maxY = 1.45;
        } else {
          centerX = 0;
          minY = 0.45;
          maxY = 1.82;
        }

        const spanY = Math.max(0.2, maxY - minY);
        const phase = (bubbleSeeds[i] * 0.37 + t * bubbleSpeeds[i] * rateMultiplier) % spanY;
        const by = minY + (phase < 0 ? phase + spanY : phase);
        const angle = bubbleSeeds[i] * 2.1;
        const rad = 0.1 + ((bubbleSeeds[i] * 13.7) % 0.45);
        const bx = centerX + Math.cos(angle) * rad + Math.sin(t * 3.5 + bubbleSeeds[i]) * 0.04;
        const bz = Math.sin(angle) * rad;
        const growthScale = 0.65 + ((by - minY) / spanY) * 0.75;

        bubblePool.setTransform(i, bx, by, bz, growthScale);
        bubblePool.setColor(i, bubbleColorHex);
      }
      bubblePool.commit(activeBubbles);
    }
  };

  const buildConceptEntries = (
    p: ChemistryParams,
    m: ChemistryMetrics,
    showLabels: boolean,
    cDom: Record<string, ConceptLabelDomRef>
  ): ConceptLabelProjectionEntry[] => {
    reusableConceptEntries[0].dom = cDom.c1;
    reusableConceptEntries[0].active = false;
    reusableConceptEntries[0].text = '';
    reusableConceptEntries[1].dom = cDom.c2;
    reusableConceptEntries[1].active = false;
    reusableConceptEntries[1].text = '';
    reusableConceptEntries[2].dom = cDom.c3;
    reusableConceptEntries[2].active = false;
    reusableConceptEntries[2].text = '';
    if (!showLabels) return reusableConceptEntries;

    const isRedox = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
    if (p.mode === 'acid-base-titration') {
      reusableConceptPos[0].set(0, 3.3, 0);
      reusableConceptEntries[0].text = `Buret Titran: Vb = ${(p.titrantAddedMl ?? 0).toFixed(1)} mL ↓`;
      reusableConceptEntries[0].active = true;

      reusableConceptPos[1].set(0, 1.35, 0);
      reusableConceptEntries[1].text = `Larutan Analit pH ${(m.currentPh ?? 7).toFixed(2)}`;
      reusableConceptEntries[1].active = true;

      reusableConceptPos[2].set(2.05, 3.25, 0);
      reusableConceptEntries[2].text = `Skala pH (Ekivalen: ${(m.equivalenceVolumeMl ?? 25).toFixed(1)} mL)`;
      reusableConceptEntries[2].active = true;
    } else if (p.mode === 'reaction-kinetics-arrhenius') {
      reusableConceptPos[0].set(0, 2.85, 0);
      reusableConceptEntries[0].text = `T = ${p.kineticsTempC ?? 25} °C · Laju v = ${(m.reactionRate ?? 0).toFixed(3)} M/s`;
      reusableConceptEntries[0].active = true;

      reusableConceptPos[1].set(0, 0.9, 1.6);
      reusableConceptEntries[1].text = 'Pemanas & Pengaduk Magnetik';
      reusableConceptEntries[1].active = true;
    } else if (p.mode === 'thermo-calorimetry') {
      reusableConceptPos[0].set(0.6, 4.1, 0);
      reusableConceptEntries[0].text = `Termometer T = ${(m.finalTempC ?? p.initialTempC ?? 25).toFixed(1)} °C`;
      reusableConceptEntries[0].active = true;

      reusableConceptPos[2].set(0, 1.5, 0);
      reusableConceptEntries[2].text = `Kalor Q = ${(m.heatReleasedJoules ?? 0).toFixed(0)} J`;
      reusableConceptEntries[2].active = true;
    } else if (isRedox) {
      reusableConceptPos[0].set(-2.18, 2.74, 0.08);
      reusableConceptEntries[0].text = 'Anoda (-) Zn · Oksidasi';
      reusableConceptEntries[0].active = true;

      reusableConceptPos[2].set(2.18, 2.74, 0.08);
      reusableConceptEntries[2].text = `Katoda (+) Cu · E = ${(m.nernstCellPotentialE ?? 1.1).toFixed(2)} V`;
      reusableConceptEntries[2].active = true;
    } else if (p.mode === 'ideal-gas-boyle') {
      reusableConceptPos[0].set(0, pistonHead.position.y + 0.55, 0);
      reusableConceptEntries[0].text = `Piston Gas: V = ${(p.gasVolumeL ?? 10).toFixed(1)} L`;
      reusableConceptEntries[0].active = true;

      reusableConceptPos[1].set(2.2, 3.35, 0);
      reusableConceptEntries[1].text = `Tekanan P = ${(m.gasPressureAtm ?? 1).toFixed(2)} atm`;
      reusableConceptEntries[1].active = true;
    } else if (p.mode === 'spectrophotometry-beer') {
      reusableConceptPos[2].set(-0.8, 3.9, 0.4);
      reusableConceptEntries[2].text = `Kuvet Sampel A = ${(m.spectroAbsorbance ?? 0).toFixed(2)}`;
      reusableConceptEntries[2].active = true;
    } else if (p.mode === 'chemical-equilibrium-lechatelier') {
      reusableConceptPos[0].set(0, leChatelierPiston.position.y + 0.55, 0);
      reusableConceptEntries[0].text = `Piston Tekanan P = ${(p.equilibriumPressureAtm ?? 1.0).toFixed(1)} atm`;
      reusableConceptEntries[0].active = true;

      reusableConceptPos[1].set(0, 2.15, 0);
      reusableConceptEntries[1].text = `N₂O₄ ⇌ 2 NO₂ (${(m.no2MoleFractionPct ?? 31.6).toFixed(1)}% NO₂ · α = ${(m.no2DissociationAlpha ?? 0.19).toFixed(2)})`;
      reusableConceptEntries[1].active = true;

      reusableConceptPos[2].set(0, 0.95, 1.55);
      reusableConceptEntries[2].text = `Penangas T = ${(p.equilibriumTempC ?? 25).toFixed(0)} °C · Kp = ${(m.leChatelierKp ?? 0.142).toFixed(3)}`;
      reusableConceptEntries[2].active = true;
    } else if (p.mode === 'electrolysis-faraday') {
      reusableConceptPos[0].set(-1.05, 2.85, 0.15);
      reusableConceptEntries[0].text = `Katoda (−) · Endapan m = ${(m.electrolysisMassDepositedG ?? 0).toFixed(3)} g`;
      reusableConceptEntries[0].active = true;

      reusableConceptPos[1].set(1.05, 2.85, 0.15);
      reusableConceptEntries[1].text = `Anoda (+) Grafit · Gas O₂ = ${(m.electrolysisAnodeGasMl ?? 0).toFixed(1)} mL`;
      reusableConceptEntries[1].active = true;

      reusableConceptPos[2].set(3.0, 2.35, -0.05);
      reusableConceptEntries[2].text = `Arus I = ${(p.electrolysisCurrentA ?? 2.5).toFixed(2)} A · Q = ${(m.electrolysisChargeC ?? 0).toFixed(0)} C`;
      reusableConceptEntries[2].active = true;
    }
    return reusableConceptEntries;
  };

  return {
    triggerWobbleBoost: (amount = 0.08) => {
      wobbleBoost = Math.max(wobbleBoost, amount);
    },
    playBuretteDropSound: () => buretSoundEmitter.play(),
    update,
    buildConceptEntries,
    dispose: () => {
      metalTex?.dispose();
      buretteScaleTex?.dispose();
      beakerScaleTex?.dispose();
      stirrerOledTex?.dispose();
      phMeterOledTex?.dispose();
      calOledTex?.dispose();
      phScaleTex.dispose();
    },
  };
}
