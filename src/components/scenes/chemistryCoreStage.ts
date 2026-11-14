import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  applyBorosilicateLiteMode,
  buildLatheFromProfile,
  createBeakerProfilePoints,
  createBorosilicateGlassMaterial,
  createBrushedMetalTextures,
  createBuretteClampAssembly,
  createErlenmeyerProfilePoints,
  createFunnelProfilePoints,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
} from '../../utils/threeStudioKit';
import {
  ChemistryParams,
  ChemistryMetrics,
  evaluateSafetyHazard,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { globalMultiApparatusEngine } from '../../utils/engines/multiApparatusEngine';
import { buildChemistrySpecialRigs } from './ChemistryRigs';
import type {
  ConceptLabelDomRef,
  ConceptLabelProjectionEntry,
} from '../ui/ConceptLabelsOverlay';

export function createLiquidWobbleMaterial(initialHex: number, initialOpacity = 0.78): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWobbleAmp: { value: 0.025 },
      uColor: { value: new THREE.Color(initialHex) },
      uRimColor: { value: new THREE.Color(0xffffff) },
      uOpacity: { value: initialOpacity },
      uMeniscusStrength: { value: 0.045 },
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

        float topFactor = smoothstep(-0.1, 0.45, pos.y);
        float radialDist = length(pos.xz);
        float wave1 = sin(pos.x * 6.5 + uTime * 4.2) * cos(pos.z * 6.5 + uTime * 3.6);
        float wave2 = sin(radialDist * 10.0 - uTime * 5.5) * 0.5;
        float ripple = (wave1 + wave2) * uWobbleAmp * topFactor;
        float meniscus = pow(radialDist, 2.0) * uMeniscusStrength * topFactor;

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
        float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.2);

        vec3 deepColor = uColor * (0.78 + 0.25 * vUv.y);
        vec3 surfaceHighlight = mix(deepColor, uRimColor, fresnel * 0.42 + clamp(vWaveHeight * 4.5, 0.0, 0.25));

        gl_FragColor = vec4(surfaceHighlight, uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export interface ChemistryCoreStageUpdateInput {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  simTime: number;
  elapsed: number;
  dt: number;
  isLite: boolean;
  reacting: boolean;
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
  const buretteScaleTex = createGraduatedScaleTexture(50, 'mL', 25, {
    invertTopToBottom: true,
  });
  const beakerScaleTex = createGraduatedScaleTexture(250, 'mL', 25);

  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.005,
    metalness: 0.62,
    roughness: 0.36,
    envMapIntensity: 1.05,
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
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughnessMap: metalTex?.roughnessMap ?? null,
    metalness: 0.84,
    roughness: 0.26,
    envMapIntensity: 1.25,
  });
  const glassMat = createBorosilicateGlassMaterial(initialLiteOrSw, {
    color: 0xecfeff,
    tintOpacity: 0.3,
    ior: 1.47,
    thickness: 0.35,
  });
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

  const calJacket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 1.65, 40, 1, true),
    darkFrameMat
  );
  calJacket.position.set(0, 1.15, 0);
  calJacket.castShadow = true;
  thermoGroup.add(calJacket);

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

  const calGrommet = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.035, 12, 24),
    darkFrameMat
  );
  calGrommet.rotation.x = Math.PI / 2;
  calGrommet.position.set(0.6, 2.95, 0);
  thermoGroup.add(calGrommet);

  const calThermometer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 2.75, 16),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.2,
      roughness: 0.2,
      emissive: 0xef4444,
      emissiveIntensity: 0.35,
    })
  );
  calThermometer.position.set(0.6, 3.2, 0);
  calThermometer.castShadow = true;
  calThermometer.userData = { draggableParam: 'initialTempC', min: 10, max: 90, step: 1, label: 'Suhu Awal T₀' };
  thermoGroup.add(calThermometer);

  // 2. Acid-Base Titration 3D Group
  const titrationGroup = new THREE.Group();
  scene.add(titrationGroup);

  const retBase = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.22, 3.2, 3, 0.04), darkFrameMat);
  retBase.position.set(-1.35, 0.4, 0);
  retBase.castShadow = true;
  retBase.receiveShadow = true;
  titrationGroup.add(retBase);

  const porcelainTile = new THREE.Mesh(
    new RoundedBoxGeometry(2.2, 0.06, 2.2, 2, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.02 })
  );
  porcelainTile.position.set(0, 0.53, 0);
  porcelainTile.receiveShadow = true;
  titrationGroup.add(porcelainTile);

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

  const stopcock = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.78, 16), brassMat);
  stopcock.rotation.z = Math.PI / 2;
  stopcock.position.set(0, 2.26, 0);
  stopcock.castShadow = true;
  stopcock.userData = { draggableParam: 'titrantAddedMl', min: 0, max: 50, step: 0.5, label: 'Volume Titran Vb' };
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
  phScaleCanvas.width = 96;
  phScaleCanvas.height = 512;
  const phCtx = phScaleCanvas.getContext('2d');
  if (phCtx) {
    const grad = phCtx.createLinearGradient(0, 512, 0, 0);
    grad.addColorStop(0.0, '#ef4444');
    grad.addColorStop(0.25, '#f59e0b');
    grad.addColorStop(0.5, '#22c55e');
    grad.addColorStop(0.75, '#0ea5e9');
    grad.addColorStop(1.0, '#8b5cf6');
    phCtx.fillStyle = grad;
    phCtx.fillRect(0, 0, 96, 512);
    phCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    phCtx.font = 'bold 20px monospace';
    phCtx.fillText('14', 60, 26);
    phCtx.fillText('7', 68, 262);
    phCtx.fillText('0', 68, 502);
  }
  const phScaleTex = new THREE.CanvasTexture(phScaleCanvas);
  phScaleTex.colorSpace = THREE.SRGBColorSpace;
  const phScaleGroup = new THREE.Group();
  phScaleGroup.position.set(2.05, 1.9, 0);
  const phScalePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 2.4),
    new THREE.MeshBasicMaterial({ map: phScaleTex, side: THREE.DoubleSide })
  );
  const phPointerMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.24, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  phPointerMesh.rotation.z = -Math.PI / 2;
  phPointerMesh.position.set(-0.28, 0, 0.02);
  phScaleGroup.add(phScalePlane, phPointerMesh);
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
  const { pistonHead } = specialRigs;

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
  const chemVaporMeshes: THREE.Mesh[] = [];
  const chemVaporGeo = new THREE.SphereGeometry(0.2, 10, 10);
  for (let i = 0; i < CHEM_VAPOR_COUNT; i++) {
    const vMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xef4444 : 0xf97316,
      transparent: true,
      opacity: 0.42,
    });
    const vMesh = new THREE.Mesh(chemVaporGeo, vMat);
    hazardGroup.add(vMesh);
    chemVaporMeshes.push(vMesh);
  }

  const update = (input: ChemistryCoreStageUpdateInput) => {
    const {
      params: p,
      metrics: m,
      simTime: t,
      elapsed,
      dt,
      isLite,
      reacting,
      isSimTimeAdvancing,
      showConceptLabels,
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
      chemVaporMeshes.forEach((vMesh, idx) => {
        const cycle = (nowSec * 1.25 + idx * 0.19) % 1.0;
        vMesh.position.set(
          fx + Math.sin(nowSec * 2.1 + idx) * (0.35 + cycle * 0.9),
          fy + cycle * 2.6,
          fz + Math.cos(nowSec * 1.7 + idx) * (0.35 + cycle * 0.8)
        );
        vMesh.scale.setScalar(0.55 + cycle * 1.4);
        (vMesh.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.45;
      });
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

      const vb = p.titrantAddedMl ?? 0;
      const level = Math.max(0.1, 3.8 * (1 - vb / 50));
      buretteLiquid.scale.set(1, level / 3.8, 1);
      const liquidCenterY = 2.45 + level / 2;
      buretteLiquid.position.set(0, liquidCenterY, 0);
      buretteMeniscusRing.position.set(0, liquidCenterY + level / 2 - 0.02, 0);

      const dropRate = reacting || wobbleBoost > 0.01 ? 2.4 : vb > 0 ? 1.15 : 0;
      if (dropRate > 0 && vb < 50) {
        const dropPhase = (t * dropRate) % 1.0;
        const dropCycle = Math.floor(t * dropRate);
        fallingDropMesh.visible = dropPhase < 0.72;
        if (fallingDropMesh.visible) {
          const fallProgress = dropPhase / 0.72;
          const dropY = 1.92 - fallProgress * fallProgress * 0.39;
          fallingDropMesh.position.set(0, dropY, 0);
        } else if (isSimTimeAdvancing && reacting && lastDropImpactCycle !== dropCycle) {
          lastDropImpactCycle = dropCycle;
          labSound.playTitrationDrop(m.currentPh ?? 7.0);
        }

        const ripplePhase1 = (t * dropRate - 0.72 + 1.0) % 1.0;
        const ripplePhase2 = (t * dropRate - 0.32 + 1.0) % 1.0;
        rippleRing1.visible = true;
        rippleRing1.scale.setScalar(0.35 + ripplePhase1 * 5.8);
        rippleRingMat1.opacity = Math.max(0, (1 - ripplePhase1) * 0.68);

        rippleRing2.visible = !isLite;
        if (!isLite) {
          rippleRing2.scale.setScalar(0.35 + ripplePhase2 * 5.8);
          rippleRingMat2.opacity = Math.max(0, (1 - ripplePhase2) * 0.45);
        }

        const radialPulse = 0.35 + 0.65 * Math.sin(ripplePhase1 * Math.PI);
        radialColorDisc.visible = true;
        radialColorDisc.scale.setScalar(0.28 + ripplePhase1 * 0.72);
        radialColorDiscMat.opacity = 0.25 + radialPulse * 0.35;
      } else {
        fallingDropMesh.visible = false;
        rippleRing1.visible = false;
        rippleRing2.visible = false;
        radialColorDisc.visible = vb > 0;
        radialColorDisc.scale.setScalar(0.95);
        radialColorDiscMat.opacity = 0.32;
      }

      phScaleGroup.visible = showConceptLabels;
      const phFrac = Math.min(1, Math.max(0, (m.currentPh ?? 7) / 14));
      phPointerMesh.position.y = -1.15 + phFrac * 2.3;
    }

    specialRigs.update({
      params: p,
      metrics: m,
      simTime: t,
      isLite,
      reacting,
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
      const activeBubbles = isLite ? Math.floor(BUBBLE_COUNT / 2) : BUBBLE_COUNT;
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
    const cEntries: ConceptLabelProjectionEntry[] = [
      { dom: cDom.c1, worldPos: new THREE.Vector3(), text: '', active: false },
      { dom: cDom.c2, worldPos: new THREE.Vector3(), text: '', active: false },
      { dom: cDom.c3, worldPos: new THREE.Vector3(), text: '', active: false },
    ];
    if (!showLabels) return cEntries;

    const isRedox = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
    if (p.mode === 'acid-base-titration') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(0, 3.3, 0),
        text: `Buret Titran: Vb = ${(p.titrantAddedMl ?? 0).toFixed(1)} mL ↓`,
        active: true,
      };
      cEntries[1] = {
        dom: cDom.c2,
        worldPos: new THREE.Vector3(0, 1.35, 0),
        text: `Larutan Analit pH ${(m.currentPh ?? 7).toFixed(2)}`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(2.05, 3.25, 0),
        text: `Skala pH (Ekivalen: ${(m.equivalenceVolumeMl ?? 25).toFixed(1)} mL)`,
        active: true,
      };
    } else if (p.mode === 'reaction-kinetics-arrhenius') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(0, 2.85, 0),
        text: `T = ${p.kineticsTempC ?? 25} °C · Laju v = ${(m.reactionRate ?? 0).toFixed(3)} M/s`,
        active: true,
      };
      cEntries[1] = {
        dom: cDom.c2,
        worldPos: new THREE.Vector3(0, 0.9, 1.6),
        text: 'Pemanas & Pengaduk Magnetik',
        active: true,
      };
    } else if (p.mode === 'thermo-calorimetry') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(0.6, 4.1, 0),
        text: `Termometer T = ${(m.finalTempC ?? p.initialTempC ?? 25).toFixed(1)} °C`,
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(0, 1.5, 0),
        text: `Kalor Q = ${(m.heatReleasedJoules ?? 0).toFixed(0)} J`,
        active: true,
      };
    } else if (isRedox) {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(-1.8, 2.55, 0),
        text: 'Anoda (-) Oksidasi',
        active: true,
      };
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(1.8, 2.55, 0),
        text: `Katoda (+) Reduksi · E = ${(m.nernstCellPotentialE ?? 1.1).toFixed(2)} V`,
        active: true,
      };
    } else if (p.mode === 'ideal-gas-boyle') {
      cEntries[0] = {
        dom: cDom.c1,
        worldPos: new THREE.Vector3(0, pistonHead.position.y + 0.55, 0),
        text: `Piston Gas: V = ${(p.gasVolumeL ?? 10).toFixed(1)} L`,
        active: true,
      };
      cEntries[1] = {
        dom: cDom.c2,
        worldPos: new THREE.Vector3(2.2, 3.35, 0),
        text: `Tekanan P = ${(m.gasPressureAtm ?? 1).toFixed(2)} atm`,
        active: true,
      };
    } else if (p.mode === 'spectrophotometry-beer') {
      cEntries[2] = {
        dom: cDom.c3,
        worldPos: new THREE.Vector3(-0.8, 3.9, 0.4),
        text: `Kuvet Sampel A = ${(m.spectroAbsorbance ?? 0).toFixed(2)}`,
        active: true,
      };
    }
    return cEntries;
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
      phScaleTex.dispose();
    },
  };
}
