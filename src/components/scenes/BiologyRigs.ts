import * as THREE from 'three';
import {
  buildLatheFromProfile,
  createBeakerProfilePoints,
  createContactShadowPlane,
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  createInstrumentPanelTexture,
  type InstancedParticlePool,
  updateInstrumentPanelTexture,
  wavelengthNmToHex,
} from '../../utils/threeStudioKit';
import {
  computeCatalaseFormulaVisualState,
  computeDnaPcrVisualState,
  computeEcosystemVisualCounts,
  computeLotkaVolterraVisualState,
  computeOsmosisVisualState,
  computePhotosynthesisVisualState,
} from '../../utils/biologyVisualHelpers';
import { calculateMendelDihybrid } from '../../utils/engines/biologyEngine';

export interface BiologyConceptAnchors {
  c1?: { pos: THREE.Vector3; text: string };
  c2?: { pos: THREE.Vector3; text: string };
  c3?: { pos: THREE.Vector3; text: string };
}

export interface BiologyRigSharedContext {
  apparatusGroup: THREE.Group;
  scene: THREE.Scene;
  slideGlassMat: THREE.Material;
  chloroMat: THREE.Material;
  protoMembraneTex: THREE.Texture | null;
  protoBump: THREE.Texture | null;
  createCellularOrganellesGroup: (scale?: number) => THREE.Group;
  isLiteInitial?: boolean;
}

export interface BiologyRigHandle {
  update: (
    t: number,
    params: Record<string, number>,
    isLite: boolean,
    showConceptLabels: boolean,
    particleScale?: number
  ) => BiologyConceptAnchors;
  dispose: () => void;
}

/**
 * Creates a soft view-space Fresnel-feathered volumetric light cone shader
 * so optical lab beams glow smoothly without hard geometric triangle edges.
 */
function createVolumetricBeamMaterial(initialHex = 0xef4444): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(initialHex) },
      uOpacity: { value: 0.24 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float edgeFeather = pow(facing, 1.85);
        float axialFade = smoothstep(0.0, 0.26, vUv.y) * smoothstep(1.0, 0.08, vUv.y);
        float shimmer = 0.92 + 0.08 * sin(vUv.y * 18.0 - uTime * 2.8 + vUv.x * 6.283);
        float alpha = edgeFeather * axialFade * uOpacity * shimmer;
        vec3 col = uColor * (1.1 + 0.35 * edgeFeather);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// =====================================================================
// RIG 1: INGENHOUSZ PHOTOSYNTHESIS (HYDRILLA + VOLUMETRIC BEAM + O2 TRAP)
// =====================================================================
export function buildPhotosynthesisRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const { apparatusGroup, scene, slideGlassMat, chloroMat, createCellularOrganellesGroup } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  // Grounded AO contact shadows under beaker, lamp stand, and specimen pedestal
  const beakerShadow = createContactShadowPlane(1.92, 1.92, 0.32);
  beakerShadow.position.set(0, 0.008, 0);
  const lampShadow = createContactShadowPlane(0.92, 0.92, 0.28);
  lampShadow.position.set(-3.75, 0.008, 0);
  const specimenShadow = createContactShadowPlane(0.95, 0.95, 0.28);
  specimenShadow.position.set(2.45, 0.008, 0);
  apparatusGroup.add(beakerShadow, lampShadow, specimenShadow);

  // Thick-walled 1000 mL Borosilicate Glass Beaker (LatheGeometry with poured lip)
  const beakerGeo = buildLatheFromProfile(createBeakerProfilePoints(1.5, 3.2, 0.055), 48);
  const beaker = new THREE.Mesh(beakerGeo, slideGlassMat);
  beaker.position.y = 0.01;
  beaker.renderOrder = 3;
  beaker.name = 'Gelas Beker Kaca Borosilikat 1000 mL';
  apparatusGroup.add(beaker);

  // Etched 1000 mL graduation scale along front of beaker
  const beakerScaleTex = createGraduatedScaleTexture(1000, 'mL', 10, {
    width: 256,
    height: 512,
  });
  if (beakerScaleTex) disposableItems.push(beakerScaleTex);
  const beakerScaleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.512, 1.512, 2.52, 28, 1, true, -0.34, 0.68),
    new THREE.MeshBasicMaterial({
      map: beakerScaleTex,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beakerScaleMesh.position.y = 1.52;
  beakerScaleMesh.renderOrder = 4;
  apparatusGroup.add(beakerScaleMesh);

  const glassRimMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.12,
    metalness: 0.22,
    transparent: true,
    opacity: 0.62,
  });

  // Translucent NaHCO3 aqueous column + crisp meniscus ring + underwater caustic light pool
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.22,
    roughness: 0.14,
    metalness: 0.05,
    depthWrite: false,
  });
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.43, 1.43, 2.66, 36),
    waterMat
  );
  water.position.y = 1.4;
  water.renderOrder = 1;
  water.name = 'Larutan Air & NaHCO₃';
  apparatusGroup.add(water);

  const meniscusRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.425, 0.02, 10, 48),
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
    })
  );
  meniscusRing.rotation.x = Math.PI / 2;
  meniscusRing.position.y = 2.73;
  meniscusRing.renderOrder = 2;
  apparatusGroup.add(meniscusRing);

  const causticMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const causticDisc = new THREE.Mesh(new THREE.CircleGeometry(1.32, 32), causticMat);
  causticDisc.rotation.x = -Math.PI / 2;
  causticDisc.position.y = 0.072;
  causticDisc.renderOrder = 1;
  apparatusGroup.add(causticDisc);

  const funnel = new THREE.Mesh(
    new THREE.ConeGeometry(1.06, 1.18, 32, 1, true),
    glassRimMat
  );
  funnel.position.y = 0.74;
  funnel.rotation.x = Math.PI;
  funnel.renderOrder = 2;
  funnel.name = 'Corong Kaca & Tabung O₂';
  funnel.userData = {
    draggableParam: 'wavelengthNm',
    min: 400,
    max: 700,
    step: 10,
    label: 'Panjang Gelombang λ (nm)',
  };
  const funnelRim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.026, 10, 36), glassRimMat);
  funnelRim.rotation.x = Math.PI / 2;
  funnelRim.position.y = 0.16;
  apparatusGroup.add(funnel, funnelRim);

  // Brass support blocks under funnel rim so water & NaHCO3 circulate freely
  const brassSpacerMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.84,
    roughness: 0.24,
  });
  [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].forEach((ang) => {
    const spacer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), brassSpacerMat);
    spacer.position.set(Math.cos(ang) * 1.02, 0.11, Math.sin(ang) * 1.02);
    spacer.rotation.y = -ang;
    apparatusGroup.add(spacer);
  });

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 1.9, 24, 1, true),
    glassRimMat
  );
  tube.position.y = 2.05;
  tube.renderOrder = 2;
  tube.name = 'Tabung Reaksi Penampung Gas O₂';
  const tubeTopDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    glassRimMat
  );
  tubeTopDome.position.y = 3.0;
  tubeTopDome.renderOrder = 2;
  apparatusGroup.add(tube, tubeTopDome);

  // Calibrated mL scale strip along the inverted tube
  const tubeScaleTex = createGraduatedScaleTexture(10, 'mL', 10, {
    invertTopToBottom: true,
    width: 128,
    height: 512,
  });
  if (tubeScaleTex) disposableItems.push(tubeScaleTex);
  const tubeScaleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.252, 0.252, 1.7, 18, 1, true, -0.5, 1.0),
    new THREE.MeshBasicMaterial({
      map: tubeScaleTex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  tubeScaleMesh.position.y = 2.05;
  tubeScaleMesh.renderOrder = 3;
  apparatusGroup.add(tubeScaleMesh);

  // Expanding O2 Gas Pocket trapped at top of inverted test tube
  const gasPocketMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.85,
    roughness: 0.12,
  });
  const gasPocket = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 1.0, 18), gasPocketMat);
  gasPocket.position.y = 2.8;
  gasPocket.renderOrder = 2;
  gasPocket.name = 'Ruang Akumulasi Gas O₂ Murni';
  apparatusGroup.add(gasPocket);

  // Organic Articulated Hydrilla verticillata Stems & Whorled Lanceolate Leaves
  const plantGroup = new THREE.Group();
  plantGroup.position.set(0, 0.16, 0);
  plantGroup.name = '🌱 Tanaman Hydrilla verticillata';
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.48, metalness: 0.04 });
  // Flattened botanical lance-shaped leaf pivoted cleanly at its stem node
  const leafGeo = new THREE.SphereGeometry(1, 8, 6);
  leafGeo.scale(0.044, 0.19, 0.014);
  leafGeo.translate(0, 0.16, 0);
  disposableItems.push(leafGeo);

  const leafTipMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.36,
    metalness: 0.04,
    emissive: 0x15803d,
    emissiveIntensity: 0.28,
  });

  [
    { x: 0, z: 0, h: 1.12, tiltZ: 0.03, tiltX: -0.02 },
    { x: -0.2, z: 0.15, h: 0.88, tiltZ: 0.15, tiltX: 0.08 },
    { x: 0.18, z: -0.13, h: 0.94, tiltZ: -0.14, tiltX: -0.06 },
    { x: 0.06, z: 0.2, h: 0.78, tiltZ: -0.05, tiltX: 0.14 },
  ].forEach((branch, bIdx) => {
    const branchGroup = new THREE.Group();
    branchGroup.position.set(branch.x, 0, branch.z);
    branchGroup.rotation.set(branch.tiltX, bIdx * 0.7, branch.tiltZ);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, branch.h, 8), stemMat);
    stem.position.y = branch.h * 0.5;
    branchGroup.add(stem);

    const whorls = 6;
    for (let i = 0; i < whorls; i++) {
      const y = 0.14 + i * ((branch.h - 0.16) / whorls);
      const leafScale = 1.0 - (i / whorls) * 0.28;
      const leavesPerWhorl = 5;
      for (let j = 0; j < leavesPerWhorl; j++) {
        const angle = (j * Math.PI * 2) / leavesPerWhorl + i * 0.48;
        const leafPivot = new THREE.Group();
        leafPivot.position.set(0, y, 0);
        leafPivot.rotation.y = angle;
        const leaf = new THREE.Mesh(leafGeo, (i + j) % 3 === 0 ? leafTipMat : chloroMat);
        leaf.rotation.z = -1.08 + (i / whorls) * 0.24;
        leaf.scale.setScalar(leafScale);
        leaf.name = '🌿 Daun Hydrilla & Kloroplas Fotosistem II';
        leafPivot.add(leaf);
        branchGroup.add(leafPivot);
      }
    }
    plantGroup.add(branchGroup);
  });
  apparatusGroup.add(plantGroup);

  // Grounded circular specimen pedestal for zoomed cellular chloroplast & organelle inspection
  const specimenStandGroup = new THREE.Group();
  specimenStandGroup.position.set(2.45, 0, 0);
  const pedestalBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.76, 0.14, 32),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.3 })
  );
  pedestalBase.position.y = 0.07;
  pedestalBase.castShadow = true;
  pedestalBase.receiveShadow = true;
  const pedestalStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.56, 18),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.82, roughness: 0.24 })
  );
  pedestalStem.position.y = 0.42;
  pedestalStem.castShadow = true;
  const specimenDishRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.032, 12, 36),
    brassSpacerMat
  );
  specimenDishRim.rotation.x = Math.PI / 2;
  specimenDishRim.position.y = 0.72;
  const specimenGlassDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.08, 32),
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.52,
      roughness: 0.15,
      metalness: 0.15,
    })
  );
  specimenGlassDisc.position.y = 0.72;
  const organellesGroup = createCellularOrganellesGroup(0.42);
  organellesGroup.position.set(0, 0.84, 0);
  specimenStandGroup.add(pedestalBase, pedestalStem, specimenDishRim, specimenGlassDisc, organellesGroup);
  specimenStandGroup.name = 'Pembesaran Sel & Kloroplas Hydrilla';
  apparatusGroup.add(specimenStandGroup);

  // Grounded Laboratory Stand + Digital PAR/Spectrum Console + Articulated Arm for Variable Spectrum Lamp
  const standDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.34 });
  const standSteelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.22 });
  const lampStandBase = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 0.14, 24), standDarkMat);
  lampStandBase.position.set(-3.75, 0.07, 0);
  lampStandBase.castShadow = true;
  lampStandBase.receiveShadow = true;
  const lampStandRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 16), standSteelMat);
  lampStandRod.position.set(-3.75, 1.4, 0);
  lampStandRod.castShadow = true;
  const lampBosshead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), standDarkMat);
  lampBosshead.position.set(-3.75, 2.68, 0);
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 12), standSteelMat);
  lampArm.rotation.z = Math.PI / 2 - 0.28;
  lampArm.position.set(-3.48, 2.6, 0);
  apparatusGroup.add(lampStandBase, lampStandRod, lampBosshead, lampArm);

  // Digital PAR / Lux Meter Console mounted on the lamp stand
  const parConsoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.56, 0.42), standDarkMat);
  parConsoleBox.position.set(-3.45, 0.46, 0.42);
  parConsoleBox.castShadow = true;
  const parScreenTex = createInstrumentPanelTexture({
    title: 'PAR QUANTUM SENSOR',
    primaryText: '1200 Lux',
    secondaryText: 'λ = 660 nm · O₂ 65%',
    accentHex: '#38bdf8',
  });
  if (parScreenTex) disposableItems.push(parScreenTex);
  const parScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.42),
    new THREE.MeshBasicMaterial({ map: parScreenTex })
  );
  parScreenMesh.position.set(-3.45, 0.46, 0.64);
  apparatusGroup.add(parConsoleBox, parScreenMesh);

  // Variable Spectrum Lamp Housing + Filter Ring + Glowing Bulb + Soft Volumetric Photon Cone
  const lampGroup = new THREE.Group();
  lampGroup.position.set(-3.2, 2.5, 0);
  lampGroup.rotation.z = -Math.PI / 3;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 0.55, 24),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.72, roughness: 0.28 })
  );
  lamp.castShadow = true;
  lamp.name = 'Lampu Spektrum Variabel';
  lamp.userData = {
    draggableParam: 'lightIntensityLux',
    min: 100,
    max: 3000,
    step: 50,
    label: 'Intensitas Cahaya (Lux)',
  };
  const filterMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  const filterLens = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 24), filterMat);
  filterLens.position.y = -0.28;
  lampGroup.add(lamp, filterLens);
  apparatusGroup.add(lampGroup);

  // Soft Volumetric Fresnel-Feathered Light Beam Cone aimed toward Hydrilla
  const beamMat = createVolumetricBeamMaterial(0xef4444);
  disposableItems.push(beamMat);
  const beamCone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 1.28, 3.35, 32, 1, true), beamMat);
  beamCone.position.set(-1.72, 1.72, 0);
  beamCone.rotation.z = Math.PI / 2 - 0.52;
  beamCone.renderOrder = 4;
  apparatusGroup.add(beamCone);

  const lightSpot = new THREE.SpotLight(0xef4444, 4.0, 10, Math.PI / 4, 0.5);
  lightSpot.position.set(-3.2, 2.5, 0);
  lightSpot.target = plantGroup;
  scene.add(lightSpot);

  const photonArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, -0.45, 0).normalize(),
    new THREE.Vector3(-2.6, 2.25, 0),
    1.45,
    0xfacc15,
    0.28,
    0.14
  );
  apparatusGroup.add(photonArrow);

  const BUBBLE_COUNT = 44;
  const particleGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const particleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
  });
  disposableItems.push(particleGeo, particleMat);
  const instancedPool: InstancedParticlePool = createInstancedParticlePool(
    BUBBLE_COUNT,
    particleGeo,
    particleMat,
    apparatusGroup
  );
  const particleSeeds = new Float32Array(BUBBLE_COUNT);
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    particleSeeds[i] = ((i * 19) % 100) / 10;
  }

  const worldPosA = new THREE.Vector3();
  const worldPosB = new THREE.Vector3();
  const anchors: BiologyConceptAnchors = {
    c1: { pos: worldPosB, text: '' },
    c3: { pos: worldPosA, text: '' },
  };
  const emptyAnchors: BiologyConceptAnchors = {};
  let lastParKey = '';

  return {
    update: (t, curParams, isLite, showConceptLabels, particleScale = isLite ? 0.5 : 1) => {
      const wavelength = curParams.wavelengthNm || 660;
      const lux = curParams.lightIntensityLux ?? 1200;
      const bicarb = curParams.bicarbonateConc ?? 2.5;
      const waterTempC = curParams.waterTempC ?? 28;
      const hex = wavelengthNmToHex(wavelength);

      filterMat.color.setHex(hex);
      filterMat.emissive.setHex(hex);
      beamMat.uniforms.uColor.value.setHex(hex);
      beamMat.uniforms.uOpacity.value = Math.min(0.42, 0.06 + (lux / 3000) * 0.34);
      beamMat.uniforms.uTime.value = t;
      causticMat.color.setHex(hex);
      causticMat.opacity = Math.min(0.24, 0.04 + (lux / 3000) * 0.18) * (0.9 + 0.1 * Math.sin(t * 2.6));
      lightSpot.color.setHex(hex);
      lightSpot.intensity = lux / 300;
      plantGroup.rotation.y = Math.sin(t * 0.7) * 0.045;

      // Subtle thermal tint on water bath (cold icy blue -> optimal cyan -> overheated warm teal)
      waterMat.color.setHex(waterTempC >= 38 ? 0x2dd4bf : waterTempC <= 18 ? 0x38bdf8 : 0x0ea5e9);

      // Exact Ingenhousz formula state (light saturation * chlorophyll action spectrum * CO2 * thermal enzyme curve)
      const photoState = computePhotosynthesisVisualState(lux, wavelength, bicarb, waterTempC);
      const pocketHeight = photoState.gasPocketLevel * 0.9;
      gasPocket.scale.y = pocketHeight;
      gasPocket.position.y = 2.95 - pocketHeight * 0.5;

      const parKey = `${Math.round(lux)}_${Math.round(wavelength)}_${Math.round(waterTempC)}_${photoState.bubbleRatePerMin.toFixed(1)}`;
      if (parKey !== lastParKey) {
        lastParKey = parKey;
        updateInstrumentPanelTexture(parScreenTex, {
          title: 'PAR QUANTUM SENSOR',
          primaryText: `${photoState.bubbleRatePerMin.toFixed(1)} gel/m`,
          secondaryText: `${Math.round(lux)}Lx · ${Math.round(wavelength)}nm · ${Math.round(waterTempC)}°C`,
          accentHex: photoState.tempFactor < 0.45 ? '#fb923c' : '#38bdf8',
        });
      }

      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      if (photoState.bubbleRatePerMin < 0.5) {
        instancedPool.commit(0);
      } else {
        const rateNorm = Math.min(1, photoState.bubbleRatePerMin / 95);
        const bubbleSpeed = 0.25 + rateNorm * 1.95;
        const activeCount = Math.max(
          4,
          Math.round(BUBBLE_COUNT * effectiveScale * (0.2 + 0.8 * rateNorm))
        );
        for (let idx = 0; idx < activeCount; idx++) {
          const seed = particleSeeds[idx] ?? idx;
          const span = 2.4;
          const phase = (seed * 0.41 + t * bubbleSpeed) % span;
          const py = 0.4 + (phase < 0 ? phase + span : phase);
          const px = Math.sin(t * 3 + seed) * 0.12;
          const pz = Math.cos(seed * 1.7) * 0.1;
          instancedPool.setTransform(idx, px, py, pz, 0.72 + (py / 2.8) * 0.45);
        }
        instancedPool.commit(activeCount);
      }

      photonArrow.visible = showConceptLabels;
      if (!showConceptLabels) return emptyAnchors;

      worldPosA.set(-3.2, 3.05, 0).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.set(0, 2.95, 0).applyMatrix4(apparatusGroup.matrixWorld);
      anchors.c1!.text = `O₂: ${photoState.o2VolumeProducedMl.toFixed(2)} mL/m (${photoState.bubbleRatePerMin.toFixed(0)} gel/m)`;
      anchors.c3!.text = `λ = ${Math.round(wavelength)} nm · Ef. Klorofil ${photoState.chlorophyllEfficiencyPct.toFixed(0)}%`;
      return anchors;
    },
    dispose: () => {
      scene.remove(lightSpot);
      disposableItems.forEach((d) => d.dispose());
    },
  };
}

// =====================================================================
// RIG 2: CATALASE ENZYME KINETICS (PH COLORIMETRY + THERMAL PROBE + FROTH)
// =====================================================================
export function buildCatalaseRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const { apparatusGroup, slideGlassMat, createCellularOrganellesGroup } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  const woodRackMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.65,
    metalness: 0.08,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.84,
    roughness: 0.25,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.34,
  });
  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.86,
    roughness: 0.24,
  });

  // Complete 2-Tier Laboratory Wooden & Brass Test-Tube Rack
  const rackBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.16, 1.3),
    woodRackMat
  );
  rackBase.position.y = 0.08;
  rackBase.castShadow = true;
  rackBase.receiveShadow = true;
  rackBase.name = 'Rak Tabung Reaksi Kayu 2-Tingkat';
  apparatusGroup.add(rackBase);

  [-1.62, 1.62].forEach((px) => {
    const rackPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.56, 1.05),
      woodRackMat
    );
    rackPillar.position.set(px, 0.88, 0);
    rackPillar.castShadow = true;
    apparatusGroup.add(rackPillar);
  });

  const rackUpperDeck = new THREE.Mesh(
    new THREE.BoxGeometry(3.52, 0.14, 1.15),
    woodRackMat
  );
  rackUpperDeck.position.y = 1.65;
  rackUpperDeck.castShadow = true;
  apparatusGroup.add(rackUpperDeck);

  // Brass guide collar grommets for 3 test-tube slots (x = -1.1, 0, +1.1)
  [-1.1, 0, 1.1].forEach((slotX, idx) => {
    const holeRadius = idx === 1 ? 0.56 : 0.36;
    const grommet = new THREE.Mesh(
      new THREE.TorusGeometry(holeRadius, 0.032, 12, 28),
      brassMat
    );
    grommet.rotation.x = Math.PI / 2;
    grommet.position.set(slotX, 1.73, 0);
    apparatusGroup.add(grommet);
  });

  // Main Central Catalase Reaction Test Tube (x = 0) with hemispherical bottom, top rolled lip & scale
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 3.0, 28, 1, true),
    slideGlassMat
  );
  tube.position.y = 1.85;
  tube.castShadow = true;
  tube.name = '🧪 Tabung Reaksi Utama Katalase';
  tube.userData = {
    draggableParam: 'substrateConcMm',
    min: 1,
    max: 50,
    step: 1,
    label: 'Konsentrasi Substrat [S] (mM)',
  };
  const tubeBottomDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    slideGlassMat
  );
  tubeBottomDome.position.y = 0.35;
  const tubeTopRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.035, 12, 32),
    slideGlassMat
  );
  tubeTopRim.rotation.x = Math.PI / 2;
  tubeTopRim.position.y = 3.35;
  apparatusGroup.add(tube, tubeBottomDome, tubeTopRim);

  const catalaseScaleTex = createGraduatedScaleTexture(25, 'mL', 10);
  if (catalaseScaleTex) {
    disposableItems.push(catalaseScaleTex);
    const catalaseScaleSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.562, 0.562, 2.7, 24, 1, true, -0.55, 1.1),
      new THREE.MeshBasicMaterial({
        map: catalaseScaleTex,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    catalaseScaleSleeve.position.y = 1.85;
    apparatusGroup.add(catalaseScaleSleeve);
  }

  // Two flanking control test tubes (x = -1.1 Acid Control, x = +1.1 Neutral Blank Control)
  [
    { x: -1.1, colorHex: 0xf43f5e, label: 'Tabung Kontrol A (pH Asam)' },
    { x: 1.1, colorHex: 0x38bdf8, label: 'Tabung Kontrol B (Blanko H₂O₂)' },
  ].forEach((ctrl) => {
    const ctrlTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 2.45, 22, 1, true),
      slideGlassMat
    );
    ctrlTube.position.set(ctrl.x, 1.55, 0);
    ctrlTube.name = ctrl.label;
    const ctrlDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      slideGlassMat
    );
    ctrlDome.position.set(ctrl.x, 0.325, 0);
    const ctrlRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 10, 24),
      slideGlassMat
    );
    ctrlRim.rotation.x = Math.PI / 2;
    ctrlRim.position.set(ctrl.x, 2.775, 0);
    const ctrlLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.305, 0.305, 0.72, 20),
      new THREE.MeshStandardMaterial({
        color: ctrl.colorHex,
        transparent: true,
        opacity: 0.72,
        roughness: 0.2,
      })
    );
    ctrlLiquid.position.set(ctrl.x, 0.72, 0);
    apparatusGroup.add(ctrlTube, ctrlDome, ctrlRim, ctrlLiquid);
  });

  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
    roughness: 0.2,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.65, 24), liquidMat);
  liquid.position.y = 0.55;
  liquid.name = 'Campuran Enzim & H₂O₂';
  liquid.userData = {
    draggableParam: 'solutionPH',
    min: 2,
    max: 12,
    step: 0.5,
    label: 'pH Larutan',
  };
  apparatusGroup.add(liquid);

  // Cloudy coagulated protein flocculation haze visible when catalase thermally/pH denatures
  const denatFlocMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.92,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposableItems.push(denatFlocMat);
  const denatFlocMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.47, 0.62, 20), denatFlocMat);
  denatFlocMesh.position.y = 0.55;
  denatFlocMesh.visible = false;
  denatFlocMesh.name = 'Koagulasi Protein Enzim Terdenaturasi';
  apparatusGroup.add(denatFlocMesh);

  const foamMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 1.2, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfefce8,
      roughness: 0.85,
      transparent: true,
      opacity: 0.86,
    })
  );
  foamMesh.position.y = 1.38;
  foamMesh.name = '🎯 Kolom Busa O₂ Berbusa';
  apparatusGroup.add(foamMesh);

  // Grounded Digital Incubation Thermometer Console + Stand + Immersion Probe
  const thermConsoleBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.68, 0.56),
    darkMetalMat
  );
  thermConsoleBox.position.set(-2.55, 0.34, 0.15);
  thermConsoleBox.castShadow = true;
  const thermScreenTex = createInstrumentPanelTexture({
    title: 'ENZYME ASSAY MONITOR',
    primaryText: '37.0 °C',
    secondaryText: 'pH 7.0 · [S] = 10 mM',
    accentHex: '#34d399',
  });
  if (thermScreenTex) disposableItems.push(thermScreenTex);
  const thermScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 0.48),
    new THREE.MeshBasicMaterial({ map: thermScreenTex })
  );
  thermScreenMesh.position.set(-2.55, 0.36, 0.44);

  const thermSupportPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 2.35, 14),
    brushedSteelMat
  );
  thermSupportPost.position.set(-2.25, 1.55, 0.15);
  const thermSupportArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 2.1, 12),
    brushedSteelMat
  );
  thermSupportArm.rotation.z = Math.PI / 2;
  thermSupportArm.position.set(-1.22, 2.68, 0.15);
  apparatusGroup.add(thermConsoleBox, thermScreenMesh, thermSupportPost, thermSupportArm);

  // Digital Immersion Thermal Probe dipping into the central reaction tube (draggable temperatureC)
  const thermStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 2.35, 14),
    brushedSteelMat
  );
  thermStem.position.set(-0.22, 1.82, 0.15);
  thermStem.name = '🌡️ Probe Termometer Inkubasi';
  thermStem.userData = {
    draggableParam: 'temperatureC',
    min: 5,
    max: 75,
    step: 5,
    label: 'Suhu Inkubasi (°C)',
  };
  const thermIndicatorMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.8,
  });
  const thermBulb = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 16), thermIndicatorMat);
  thermBulb.position.set(-0.22, 2.98, 0.15);
  apparatusGroup.add(thermStem, thermBulb);

  // Grounded specimen pedestal for cellular peroxisome & organelle zoom view (never floating!)
  const catPedestalGroup = new THREE.Group();
  catPedestalGroup.position.set(2.55, 0, 0);
  const catPedBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.76, 0.14, 32),
    darkMetalMat
  );
  catPedBase.position.y = 0.07;
  catPedBase.castShadow = true;
  catPedBase.receiveShadow = true;
  const catPedStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.62, 18),
    brushedSteelMat
  );
  catPedStem.position.y = 0.45;
  catPedStem.castShadow = true;
  const catDishRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.032, 12, 36),
    brassMat
  );
  catDishRim.rotation.x = Math.PI / 2;
  catDishRim.position.y = 0.78;
  const catGlassDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.08, 32),
    slideGlassMat
  );
  catGlassDisc.position.y = 0.78;
  const organellesGroup = createCellularOrganellesGroup(0.46);
  organellesGroup.position.set(0, 0.92, 0);
  catPedestalGroup.add(catPedBase, catPedStem, catDishRim, catGlassDisc, organellesGroup);
  apparatusGroup.add(catPedestalGroup);

  const FOAM_BUBBLES = 64;
  const particleGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const particleMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.2,
    roughness: 0.35,
  });
  disposableItems.push(particleGeo, particleMat);
  const instancedPool = createInstancedParticlePool(
    FOAM_BUBBLES,
    particleGeo,
    particleMat,
    apparatusGroup
  );
  const particleSeeds = new Float32Array(FOAM_BUBBLES);
  for (let i = 0; i < FOAM_BUBBLES; i++) {
    particleSeeds[i] = ((i * 23) % 100) / 10;
  }

  const worldPosA = new THREE.Vector3();
  const worldPosB = new THREE.Vector3();
  const anchors: BiologyConceptAnchors = {
    c1: { pos: worldPosA, text: '' },
    c3: { pos: worldPosB, text: '' },
  };
  const emptyAnchors: BiologyConceptAnchors = {};
  let lastThermKey = '';

  return {
    update: (t, curParams, isLite, showConceptLabels, particleScale = isLite ? 0.5 : 1) => {
      const ph = curParams.solutionPH ?? curParams.solutionPh ?? 7.0;
      const tempC = curParams.temperatureC ?? curParams.tempCelsius ?? 37;
      const sub = curParams.substrateConcMm ?? 10;
      const enzymeVol = curParams.enzymeVolumeMl ?? 1.0;

      // Exact Michaelis-Menten + Arrhenius + Bell pH + Thermal Denaturation state
      const catState = computeCatalaseFormulaVisualState({
        substrateConcMm: sub,
        solutionPH: ph,
        temperatureC: tempC,
        enzymeVolumeMl: enzymeVol,
      });

      liquidMat.color.setHex(catState.liquidPhHex);
      const thermHex = catState.isDenatured ? 0xef4444 : tempC < 22 ? 0x38bdf8 : 0x10b981;
      thermIndicatorMat.color.setHex(thermHex);
      thermIndicatorMat.emissive.setHex(thermHex);

      // Visible protein coagulation/cloudiness when enzyme denatures (>15%)
      denatFlocMesh.visible = catState.denaturationDegreePct > 15;
      denatFlocMat.opacity = Math.min(0.62, Math.max(0, (catState.denaturationDegreePct - 15) / 85) * 0.62);

      const thermKey = `${tempC.toFixed(1)}_${ph.toFixed(1)}_${sub.toFixed(1)}_${enzymeVol.toFixed(1)}`;
      if (thermKey !== lastThermKey) {
        lastThermKey = thermKey;
        updateInstrumentPanelTexture(thermScreenTex, {
          title: 'ENZYME ASSAY MONITOR',
          primaryText: `${catState.reactionRateV.toFixed(1)} μM/s`,
          secondaryText: `${tempC.toFixed(0)}°C · pH ${ph.toFixed(1)} · Denat ${Math.round(catState.denaturationDegreePct)}%`,
          accentHex: catState.isDenatured ? '#f87171' : '#34d399',
        });
      }

      // Exact foam column height scaled from Michaelis-Menten v (0..15 cm)
      const foamTarget = catState.foamScaleY;
      foamMesh.visible = catState.foamHeightCm > 0.08;
      foamMesh.scale.y = foamTarget;
      foamMesh.position.y = 0.82 + (1.2 * foamTarget) / 2;

      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      if (catState.bubbleRiseSpeed <= 0.01) {
        instancedPool.commit(0);
      } else {
        const activeCount = Math.max(
          6,
          Math.round(FOAM_BUBBLES * effectiveScale * Math.min(1, 0.25 + catState.relativeActivityPct / 100))
        );
        for (let idx = 0; idx < activeCount; idx++) {
          const seed = particleSeeds[idx] ?? idx * 0.7;
          const span = Math.max(0.45, 1.2 * foamTarget + 0.25);
          const phase = (seed + t * catState.bubbleRiseSpeed) % span;
          const py = 0.85 + (phase < 0 ? phase + span : phase);
          const rad = 0.15 + ((idx % 5) / 5) * 0.3;
          const px = Math.cos(seed * 4.3 + t * 0.9) * rad;
          const pz = Math.sin(seed * 3.1 + t * 0.8) * rad;
          instancedPool.setTransform(idx, px, py, pz, 0.65 + (idx % 3) * 0.25);
        }
        instancedPool.commit(activeCount);
      }

      if (!showConceptLabels) return emptyAnchors;
      foamMesh.getWorldPosition(worldPosA);
      worldPosA.y += 0.85;
      worldPosB.set(-0.22, 2.98, 0.15).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.y += 0.35;
      anchors.c1!.text = `Busa O₂: ${catState.foamHeightCm.toFixed(1)} cm (v = ${catState.reactionRateV.toFixed(1)} μM/s)`;
      anchors.c3!.text = catState.isDenatured
        ? `Denaturasi ${Math.round(catState.denaturationDegreePct)}% (T=${tempC.toFixed(0)}°C, pH ${ph.toFixed(1)})`
        : `Aktivitas ${catState.relativeActivityPct.toFixed(0)}% · T=${tempC.toFixed(0)}°C`;
      return anchors;
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}

// =====================================================================
// RIG 3: LOTKA-VOLTERRA ECOSYSTEM TERRARIUM (PREY + PREDATOR BOIDS)
// =====================================================================
export function buildPredatorPreyRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const { apparatusGroup, slideGlassMat } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  // Glass-rimmed soil & meadow terrarium base
  const soilBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.65, 2.7, 0.34, 40),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
  );
  soilBase.position.y = 0.22;
  soilBase.receiveShadow = true;
  soilBase.name = 'Substrat Tanah Ekosistem';
  apparatusGroup.add(soilBase);

  const meadowMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.78,
    metalness: 0.02,
  });
  const meadowTop = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 40), meadowMat);
  meadowTop.position.y = 0.42;
  meadowTop.receiveShadow = true;
  meadowTop.name = 'Padang Rumput Ekosistem';
  apparatusGroup.add(meadowTop);

  // Glass enclosure wall
  const terrariumWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.66, 2.66, 1.1, 40, 1, true),
    slideGlassMat
  );
  terrariumWall.position.y = 0.85;
  terrariumWall.name = 'Dinding Kaca Terarium Bioma';
  apparatusGroup.add(terrariumWall);

  // Brass terrarium top & bottom reinforcing rings
  const terrariumBrassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.82,
    roughness: 0.26,
  });
  const terrariumTopRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.66, 0.038, 12, 48),
    terrariumBrassMat
  );
  terrariumTopRim.rotation.x = Math.PI / 2;
  terrariumTopRim.position.y = 1.4;
  apparatusGroup.add(terrariumTopRim);

  // Oasis water pond + dynamic ecological balance ring
  const pond = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.62, 0.06, 28),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.84,
    })
  );
  pond.position.set(0.2, 0.46, 0.15);
  pond.name = 'Sumber Air Ekosistem';
  apparatusGroup.add(pond);

  const statusRingMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const statusRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.8, 36), statusRingMat);
  statusRing.rotation.x = -Math.PI / 2;
  statusRing.position.set(0.2, 0.49, 0.15);
  apparatusGroup.add(statusRing);

  // Interactive Pasture Rock / Flora Beacon -> drags preyPopulationX
  const preyBeacon = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.26, 1),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 })
  );
  preyBeacon.position.set(-1.35, 0.62, 0.75);
  preyBeacon.castShadow = true;
  preyBeacon.name = '🌿 Zona Padang Rumput Mangsa';
  preyBeacon.userData = {
    draggableParam: 'preyPopulationX',
    min: 5,
    max: 120,
    step: 5,
    label: 'Populasi Mangsa (x)',
  };
  apparatusGroup.add(preyBeacon);

  // Interactive Predator Den Outcrop -> drags predatorPopulationY
  const predBeacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.48, 6),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 })
  );
  predBeacon.position.set(1.42, 0.68, -0.78);
  predBeacon.castShadow = true;
  predBeacon.name = '🦊 Sarang Predator Ekosistem';
  predBeacon.userData = {
    draggableParam: 'predatorPopulationY',
    min: 2,
    max: 50,
    step: 1,
    label: 'Populasi Predator (y)',
  };
  apparatusGroup.add(predBeacon);

  // Stylized Trees/Shrubs for Habitat Depth
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
  [
    [-1.6, -1.1, 1.0],
    [-1.95, 0.25, 0.85],
    [1.75, 0.9, 1.1],
    [0.65, -1.75, 0.92],
  ].forEach(([tx, tz, s]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.42 * s, 8), trunkMat);
    trunk.position.set(tx, 0.65 * s, tz);
    const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * s, 0), canopyMat);
    canopy.position.set(tx, 0.96 * s, tz);
    canopy.castShadow = true;
    apparatusGroup.add(trunk, canopy);
  });

  // Prey InstancedMesh (up to 64 ivory-tan herbivores)
  const MAX_PREY = 64;
  const preyGeo = new THREE.CapsuleGeometry(0.06, 0.09, 6, 10);
  const preyMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 });
  disposableItems.push(preyGeo, preyMat);
  const preyMesh = new THREE.InstancedMesh(preyGeo, preyMat, MAX_PREY);
  preyMesh.castShadow = true;
  apparatusGroup.add(preyMesh);

  // Predator InstancedMesh (up to 28 amber-crimson carnivores)
  const MAX_PRED = 28;
  const predGeo = new THREE.ConeGeometry(0.09, 0.26, 8);
  predGeo.rotateX(Math.PI / 2);
  const predMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 });
  disposableItems.push(predGeo, predMat);
  const predMesh = new THREE.InstancedMesh(predGeo, predMat, MAX_PRED);
  predMesh.castShadow = true;
  apparatusGroup.add(predMesh);

  const dummy = new THREE.Object3D();
  const worldPosA = new THREE.Vector3();
  const worldPosB = new THREE.Vector3();
  const worldPosC = new THREE.Vector3();
  const anchors: BiologyConceptAnchors = {
    c1: { pos: worldPosA, text: '' },
    c2: { pos: worldPosC, text: '' },
    c3: { pos: worldPosB, text: '' },
  };
  const emptyAnchors: BiologyConceptAnchors = {};

  return {
    update: (t, curParams, isLite, showConceptLabels, particleScale = isLite ? 0.5 : 1) => {
      const preyPop = curParams.preyPopulationX ?? 40;
      const predPop = curParams.predatorPopulationY ?? 9;

      const lvState = computeLotkaVolterraVisualState(curParams);
      const vis = computeEcosystemVisualCounts(preyPop, predPop, isLite, MAX_PREY, MAX_PRED);
      const scaleMult = isLite ? 1 : particleScale;
      const preyCount = Math.max(4, Math.min(MAX_PREY, Math.round(vis.preyInstances * scaleMult)));
      const predCount = Math.max(1, Math.min(MAX_PRED, Math.round(vis.predatorInstances * scaleMult)));

      statusRingMat.color.setHex(
        vis.status === 'seimbang'
          ? 0x10b981
          : vis.status === 'ledakan_mangsa'
          ? 0x38bdf8
          : 0xf43f5e
      );

      // Vegetative richness fades slightly if herbivore load is extreme
      meadowMat.color.setHex(preyPop > 90 ? 0x65a30d : 0x16a34a);

      preyMesh.count = preyCount;
      for (let i = 0; i < preyCount; i++) {
        const seed = i * 1.37;
        const radius = 0.75 + ((i * 19) % 100) / 100 * 1.45;
        const theta = seed + t * lvState.grazeSpeed * (i % 2 === 0 ? 1 : -0.8);
        const hop = Math.abs(Math.sin(t * 5.2 + seed * 3)) * 0.08;
        const px = Math.cos(theta) * radius + Math.sin(seed * 2 + t * 0.5) * 0.18;
        const pz = Math.sin(theta) * radius + Math.cos(seed * 2 + t * 0.4) * 0.18;
        dummy.position.set(px, 0.54 + hop, pz);
        dummy.rotation.set(0, -theta, Math.PI / 2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        preyMesh.setMatrixAt(i, dummy.matrix);
      }
      preyMesh.instanceMatrix.needsUpdate = true;

      predMesh.count = predCount;
      for (let i = 0; i < predCount; i++) {
        const seed = i * 2.13;
        const radius = 0.9 + ((i * 29) % 100) / 100 * 1.25;
        const theta = seed - t * lvState.chaseSpeed;
        const px = Math.cos(theta) * radius;
        const pz = Math.sin(theta) * radius;
        dummy.position.set(px, 0.57, pz);
        dummy.rotation.set(0, -theta + Math.PI, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        predMesh.setMatrixAt(i, dummy.matrix);
      }
      predMesh.instanceMatrix.needsUpdate = true;

      if (!showConceptLabels) return emptyAnchors;
      preyBeacon.getWorldPosition(worldPosA);
      worldPosA.y += 0.65;
      predBeacon.getWorldPosition(worldPosB);
      worldPosB.y += 0.65;
      worldPosC.set(0.2, 1.35, 0.15).applyMatrix4(apparatusGroup.matrixWorld);

      anchors.c1!.text = `Mangsa x=${Math.round(preyPop)} (dx/dt ${lvState.dPreyDt >= 0 ? '+' : ''}${lvState.dPreyDt.toFixed(1)})`;
      anchors.c2!.text = `Ekuilibrium (x*=${Math.round(lvState.equilibriumPreyX)}, y*=${Math.round(lvState.equilibriumPredatorY)})`;
      anchors.c3!.text = `Predator y=${Math.round(predPop)} (dy/dt ${lvState.dPredatorDt >= 0 ? '+' : ''}${lvState.dPredatorDt.toFixed(1)})`;
      return anchors;
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}

// =====================================================================
// RIG 4: PLANT CELL OSMOSIS, CENTRAL VACUOLE & CHLOROPLAST CYCLOSIS
// =====================================================================
export function buildOsmosisRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const {
    apparatusGroup,
    slideGlassMat,
    protoMembraneTex,
    protoBump,
    createCellularOrganellesGroup,
  } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  const petri = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.36, 36, 1, true),
    slideGlassMat
  );
  petri.position.y = 0.22;
  petri.castShadow = true;
  petri.name = 'Cawan Petri & Kaca Preparat Sukrosa';
  const petriBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.04, 36),
    slideGlassMat
  );
  petriBottom.position.y = 0.05;
  const petriRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.028, 12, 48),
    slideGlassMat
  );
  petriRim.rotation.x = Math.PI / 2;
  petriRim.position.y = 0.4;
  const sucroseBath = new THREE.Mesh(
    new THREE.CylinderGeometry(2.33, 2.33, 0.22, 36),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.2,
      roughness: 0.15,
      depthWrite: false,
    })
  );
  sucroseBath.position.y = 0.18;
  apparatusGroup.add(petri, petriBottom, petriRim, sucroseBath);

  // Architectural Rigid Plant Cell Wall Pillars & Solid 3D Cellulose Frame Beams (with Plasmodesmata pores)
  const cellWallGroup = new THREE.Group();
  cellWallGroup.position.y = 1.35;
  cellWallGroup.name = '🧱 Dinding Selulosa Kaku';
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x15803d,
    emissiveIntensity: 0.32,
    roughness: 0.48,
  });

  // 4 Vertical corner cellulose columns extending down to the Petri dish base so the cell is grounded
  const postGeo = new THREE.CylinderGeometry(0.062, 0.068, 1.98, 12);
  const cornerX = 1.16;
  const cornerY = 0.84;
  const cornerZ = 0.73;
  [
    [-cornerX, -cornerZ],
    [cornerX, -cornerZ],
    [-cornerX, cornerZ],
    [cornerX, cornerZ],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(postGeo, wallMat);
    col.position.set(cx, -0.14, cz);
    col.castShadow = true;
    cellWallGroup.add(col);
  });

  // 4 Top & 4 Bottom Horizontal Cellulose Frame Beams + 8 Corner Nodes
  const beamXGeo = new THREE.CylinderGeometry(0.052, 0.052, cornerX * 2, 12);
  beamXGeo.rotateZ(Math.PI / 2);
  const beamZGeo = new THREE.CylinderGeometry(0.052, 0.052, cornerZ * 2, 12);
  beamZGeo.rotateX(Math.PI / 2);
  const nodeGeo = new THREE.SphereGeometry(0.082, 12, 12);

  [-cornerY, cornerY].forEach((cy) => {
    [-cornerZ, cornerZ].forEach((cz) => {
      const bx = new THREE.Mesh(beamXGeo, wallMat);
      bx.position.set(0, cy, cz);
      cellWallGroup.add(bx);
    });
    [-cornerX, cornerX].forEach((cx) => {
      const bz = new THREE.Mesh(beamZGeo, wallMat);
      bz.position.set(cx, cy, 0);
      cellWallGroup.add(bz);
      [-cornerZ, cornerZ].forEach((cz) => {
        const node = new THREE.Mesh(nodeGeo, wallMat);
        node.position.set(cx, cy, cz);
        cellWallGroup.add(node);
      });
    });
  });

  // Golden Plasmodesmata intercellular channel rings on left and right cell walls
  const plasmodesmataMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  [-cornerX, cornerX].forEach((px) => {
    [-0.28, 0.28].forEach((py) => {
      const pore = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.024, 10, 20), plasmodesmataMat);
      pore.rotation.y = Math.PI / 2;
      pore.position.set(px, py, 0);
      pore.name = 'Kanal Plasmodesmata Dinding Sel';
      cellWallGroup.add(pore);
    });
  });
  apparatusGroup.add(cellWallGroup);

  // Grounded Digital Osmometer & Refractometer Console on the left side of the Petri dish
  const osmConsoleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.34,
  });
  const osmConsoleBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.64, 0.48),
    osmConsoleMat
  );
  osmConsoleBox.position.set(-2.95, 0.32, 0.2);
  osmConsoleBox.castShadow = true;
  const osmScreenTex = createInstrumentPanelTexture({
    title: 'DIGITAL OSMOMETER',
    primaryText: '0.30 M',
    secondaryText: 'ISOTONIK · Ψs Seimbang',
    accentHex: '#38bdf8',
  });
  if (osmScreenTex) disposableItems.push(osmScreenTex);
  const osmScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 0.46),
    new THREE.MeshBasicMaterial({ map: osmScreenTex })
  );
  osmScreenMesh.position.set(-2.95, 0.34, 0.45);
  apparatusGroup.add(osmConsoleBox, osmScreenMesh);

  // Inner Plasma Membrane & Protoplast (draggable sucroseConcMolar)
  const protoMat = new THREE.MeshPhysicalMaterial({
    color: 0x86efac,
    map: protoMembraneTex,
    bumpMap: protoBump,
    bumpScale: 0.015,
    transparent: true,
    opacity: ctx.isLiteInitial ? 0.56 : 0.44,
    roughness: 0.16,
    ...(ctx.isLiteInitial ? {} : { transmission: 0.62, thickness: 0.5 }),
  });
  const protoplastMesh = new THREE.Mesh(new THREE.BoxGeometry(2.12, 1.48, 1.32), protoMat);
  protoplastMesh.position.y = 1.35;
  protoplastMesh.name = '🎯 Protoplas & Membran Sel Tumbuhan';
  protoplastMesh.userData = {
    draggableParam: 'sucroseConcMolar',
    min: 0.0,
    max: 1.0,
    step: 0.05,
    label: 'Molaritas Sukrosa (M)',
  };
  apparatusGroup.add(protoplastMesh);

  // Translucent Central Vacuole nested inside Protoplast
  const vacuoleMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.42,
    roughness: 0.1,
  });
  const vacuoleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 24), vacuoleMat);
  vacuoleMesh.scale.set(1.35, 0.85, 0.8);
  vacuoleMesh.name = '💧 Vakuola Sentral (Penyimpan Air & Turgor)';
  protoplastMesh.add(vacuoleMesh);

  const organellesGroup = createCellularOrganellesGroup(0.92);
  protoplastMesh.add(organellesGroup);

  // Solute (amber) & Water (cyan) InstancedPool
  const OSMOSIS_DOTS = 56;
  const particleGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const particleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.35,
    roughness: 0.25,
  });
  disposableItems.push(particleGeo, particleMat);
  const instancedPool = createInstancedParticlePool(
    OSMOSIS_DOTS,
    particleGeo,
    particleMat,
    apparatusGroup
  );
  const particleSeeds = new Float32Array(OSMOSIS_DOTS);
  for (let i = 0; i < OSMOSIS_DOTS; i++) {
    particleSeeds[i] = i * 0.9 + ((i * 7) % 10) * 0.05;
    instancedPool.setColor(i, i % 3 === 0 ? 0xf59e0b : 0x38bdf8);
  }
  instancedPool.commit(OSMOSIS_DOTS);

  const osmosisArrowLeft = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(-1.35, 1.35, 0.2),
    0.85,
    0xf97316,
    0.22,
    0.11
  );
  const osmosisArrowRight = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1.35, 1.35, 0.2),
    0.85,
    0xf97316,
    0.22,
    0.11
  );
  apparatusGroup.add(osmosisArrowLeft, osmosisArrowRight);

  const worldPosA = new THREE.Vector3();
  const dirNegX = new THREE.Vector3(-1, 0, 0);
  const dirPosX = new THREE.Vector3(1, 0, 0);
  const anchors: BiologyConceptAnchors = {
    c2: { pos: worldPosA, text: '' },
  };
  const emptyAnchors: BiologyConceptAnchors = {};
  let cyclosisAngle = 0;
  let lastT = 0;
  let lastOsmKey = '';

  return {
    update: (t, curParams, isLite, showConceptLabels, particleScale = isLite ? 0.5 : 1) => {
      const dt = Math.max(0, Math.min(0.1, Math.abs(t - lastT)));
      lastT = t;

      const sucrose = curParams.sucroseConcMolar ?? 0.3;
      const solutionTempC = curParams.solutionTempC ?? 25;
      const osmState = computeOsmosisVisualState(sucrose, solutionTempC);
      const isHyper = osmState.state === 'hypertonic';
      const isHypo = osmState.state === 'hypotonic';

      const osmKey = `${sucrose.toFixed(2)}_${Math.round(solutionTempC)}_${osmState.state}`;
      if (osmKey !== lastOsmKey) {
        lastOsmKey = osmKey;
        updateInstrumentPanelTexture(osmScreenTex, {
          title: 'DIGITAL OSMOMETER',
          primaryText: `${osmState.solutePotentialMpa.toFixed(2)} MPa`,
          secondaryText: `Ψs · ${sucrose.toFixed(2)}M · ${Math.round(solutionTempC)}°C · ${
            isHyper ? 'PLASMOLISIS' : isHypo ? 'TURGID' : 'ISOTONIK'
          }`,
          accentHex: isHyper ? '#fb923c' : isHypo ? '#38bdf8' : '#34d399',
        });
      }

      protoplastMesh.scale.setScalar(osmState.protoplastScale);
      vacuoleMesh.scale.set(
        1.35 * osmState.vacuoleScale,
        0.85 * osmState.vacuoleScale,
        0.8 * osmState.vacuoleScale
      );

      // Cytoplasmic streaming (cyclosis) rotation inside protoplast
      cyclosisAngle += dt * osmState.cyclosisSpeed * 0.8;
      organellesGroup.rotation.y = cyclosisAngle;

      // Directional water diffusion across plasma membrane + extracellular sucrose solutes
      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      const activeCount = Math.max(12, Math.round(OSMOSIS_DOTS * effectiveScale));
      const fluxDir = osmState.netWaterPotentialAtm < -0.15 ? 1 : osmState.netWaterPotentialAtm > 0.15 ? -1 : 0;
      const fluxSpeed = 0.28 + osmState.fluxArrowScale * 0.55;
      for (let idx = 0; idx < activeCount; idx++) {
        const seed = particleSeeds[idx] ?? idx * 0.9;
        const isSolute = idx % 3 === 0;
        const angle = seed * 1.45 + t * (isSolute ? 0.35 : 0.25);
        let radial: number;
        if (isSolute) {
          // Impermeant sucrose molecules remain outside the semipermeable cell wall (r = 1.4..2.2)
          const showSolute = sucrose > 0.02;
          radial = showSolute ? 1.42 + ((idx * 17) % 10) * 0.078 : 0;
          const px = Math.cos(angle) * radial;
          const pz = Math.sin(angle) * radial;
          const py = 0.42 + (idx % 7) * 0.22;
          instancedPool.setTransform(
            idx,
            px,
            py,
            pz,
            showSolute ? Math.min(1.45, 0.72 + sucrose * 0.7) : 0.001
          );
        } else {
          // Water molecules migrate radially outward (plasmolysis) or inward (turgor) along ΔΨ
          const u = ((t * fluxSpeed + seed * 0.19) % 1 + 1) % 1;
          radial =
            fluxDir > 0
              ? 0.45 + u * 1.65 // H2O exiting cell into hypertonic bath
              : fluxDir < 0
              ? 2.1 - u * 1.65 // H2O entering cell from hypotonic bath
              : 0.75 + Math.abs(Math.sin(t * 0.9 + seed)) * 1.15;
          const px = Math.cos(angle) * radial;
          const pz = Math.sin(angle) * radial;
          const py = 0.58 + (idx % 6) * 0.24;
          instancedPool.setTransform(idx, px, py, pz, 0.92);
        }
      }
      instancedPool.commit(activeCount);

      if (showConceptLabels && (isHyper || isHypo)) {
        const arrowLen = 0.45 + osmState.fluxArrowScale * 0.55;
        osmosisArrowLeft.visible = true;
        osmosisArrowRight.visible = true;
        osmosisArrowLeft.setLength(arrowLen, 0.22, 0.11);
        osmosisArrowRight.setLength(arrowLen, 0.22, 0.11);
        if (isHyper) {
          osmosisArrowLeft.position.set(-1.1, 1.35, 0.2);
          osmosisArrowLeft.setDirection(dirNegX);
          osmosisArrowLeft.setColor(0xf97316);
          osmosisArrowRight.position.set(1.1, 1.35, 0.2);
          osmosisArrowRight.setDirection(dirPosX);
          osmosisArrowRight.setColor(0xf97316);
        } else {
          osmosisArrowLeft.position.set(-2.0, 1.35, 0.2);
          osmosisArrowLeft.setDirection(dirPosX);
          osmosisArrowLeft.setColor(0x38bdf8);
          osmosisArrowRight.position.set(2.0, 1.35, 0.2);
          osmosisArrowRight.setDirection(dirNegX);
          osmosisArrowRight.setColor(0x38bdf8);
        }
      } else {
        osmosisArrowLeft.visible = false;
        osmosisArrowRight.visible = false;
      }

      if (!showConceptLabels) return emptyAnchors;
      protoplastMesh.getWorldPosition(worldPosA);
      worldPosA.y += 1.08;
      anchors.c2!.text = isHyper
        ? `Plasmolisis · Ψs=${osmState.solutePotentialMpa.toFixed(2)} MPa · H₂O Keluar`
        : isHypo
        ? `Sel Turgid · P_turgor=${osmState.turgorPressureAtm.toFixed(1)} atm · H₂O Masuk`
        : `Isotonik · Ψs=${osmState.solutePotentialMpa.toFixed(2)} MPa (Fluks Seimbang)`;
      return anchors;
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}

// =====================================================================
// RIG 5: MENDEL DIHYBRID GENETICS (4x4 PUNNETT 3D + DNA HELIX + CHI-SQUARE)
// =====================================================================
export function buildMendelGeneticsRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const { apparatusGroup, slideGlassMat } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  const darkFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.62,
    roughness: 0.34,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.84,
    roughness: 0.24,
  });
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.35,
    roughness: 0.45,
  });

  // 1. Center 4x4 Punnett Square 3D Matrix Board
  const boardBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.22, 3.2),
    darkFrameMat
  );
  boardBase.position.set(0, 0.11, 0);
  boardBase.castShadow = true;
  boardBase.receiveShadow = true;
  boardBase.name = 'Matriks Punnett 3D 4×4 (RrYy × RrYy)';
  boardBase.userData = {
    draggableParam: 'sampleSizeN',
    min: 32,
    max: 640,
    step: 16,
    label: 'Ukuran Sampel Keturunan N',
  };
  apparatusGroup.add(boardBase);

  const glassCover = new THREE.Mesh(
    new THREE.BoxGeometry(3.08, 0.04, 3.08),
    slideGlassMat
  );
  glassCover.position.set(0, 0.24, 0);
  apparatusGroup.add(glassCover);

  // 16 Dihybrid Seed Phenotype pattern in classic 4x4 Punnett layout:
  // 0 = Round-Yellow (9), 1 = Round-Green (3), 2 = Wrinkled-Yellow (3), 3 = Wrinkled-Green (1)
  const punnettPhenotypeGrid = [
    0, 0, 0, 0,
    0, 1, 0, 1,
    0, 0, 2, 2,
    0, 1, 2, 3,
  ];

  const roundGeo = new THREE.SphereGeometry(0.21, 20, 20);
  const wrinkledGeo = new THREE.DodecahedronGeometry(0.21, 1);
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.1,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x15803d,
    emissiveIntensity: 0.2,
    roughness: 0.32,
    metalness: 0.08,
  });
  disposableItems.push(roundGeo, wrinkledGeo, yellowMat, greenMat);

  const seedMeshes: THREE.Mesh[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const idx = row * 4 + col;
      const pheno = punnettPhenotypeGrid[idx];
      const cx = -1.05 + col * 0.7;
      const cz = -1.05 + row * 0.7;

      const cellPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.04, 0.62),
        tileMat
      );
      cellPad.position.set(cx, 0.25, cz);
      apparatusGroup.add(cellPad);

      const isRound = pheno === 0 || pheno === 1;
      const isYellow = pheno === 0 || pheno === 2;
      const seed = new THREE.Mesh(
        isRound ? roundGeo : wrinkledGeo,
        isYellow ? yellowMat : greenMat
      );
      seed.position.set(cx, 0.48, cz);
      seed.castShadow = true;
      seed.name = isRound
        ? isYellow
          ? '🟡 Biji Bulat-Kuning (R_Y_ · 9/16)'
          : '🟢 Biji Bulat-Hijau (R_yy · 3/16)'
        : isYellow
        ? '🟨 Biji Keriput-Kuning (rrY_ · 3/16)'
        : '🟩 Biji Keriput-Hijau (rryy · 1/16)';
      seed.userData = boardBase.userData;
      apparatusGroup.add(seed);
      seedMeshes.push(seed);
    }
  }

  // 2. Left Rotating 3D Double-Helix DNA Pedestal (x = -2.45)
  const dnaPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.74, 0.18, 28),
    darkFrameMat
  );
  dnaPedestal.position.set(-2.45, 0.09, 0);
  dnaPedestal.castShadow = true;
  apparatusGroup.add(dnaPedestal);

  const dnaHelixGroup = new THREE.Group();
  dnaHelixGroup.position.set(-2.45, 0.25, 0);
  dnaHelixGroup.name = '🧬 Heliks Ganda DNA Lokus R/r & Y/y';
  apparatusGroup.add(dnaHelixGroup);

  const strandAMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.4,
    roughness: 0.22,
  });
  const strandBMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.4,
    roughness: 0.22,
  });
  const nodeGeo = new THREE.SphereGeometry(0.075, 12, 12);
  const rungGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.76, 8);
  rungGeo.rotateZ(Math.PI / 2);
  disposableItems.push(strandAMat, strandBMat, nodeGeo, rungGeo);

  const DNA_RUNGS = 14;
  for (let i = 0; i < DNA_RUNGS; i++) {
    const y = 0.12 + i * 0.18;
    const angle = i * 0.52;
    const pairGroup = new THREE.Group();
    pairGroup.position.y = y;
    pairGroup.rotation.y = angle;

    const nodeA = new THREE.Mesh(nodeGeo, strandAMat);
    nodeA.position.x = -0.38;
    nodeA.userData = {
      draggableParam: 'alleleFreqR',
      min: 0.2,
      max: 0.8,
      step: 0.05,
      label: 'Frekuensi Alel Dominan p(R)',
    };
    const nodeB = new THREE.Mesh(nodeGeo, strandBMat);
    nodeB.position.x = 0.38;
    nodeB.userData = nodeA.userData;
    const rung = new THREE.Mesh(rungGeo, brassMat);
    rung.userData = nodeA.userData;
    pairGroup.add(nodeA, nodeB, rung);
    dnaHelixGroup.add(pairGroup);
  }

  // 3. Right 3D Phenotype Ratio Bar Columns & Chi-Square Console (x = 2.45)
  const chartBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.18, 2.55),
    darkFrameMat
  );
  chartBase.position.set(2.45, 0.09, 0);
  chartBase.castShadow = true;
  apparatusGroup.add(chartBase);

  const chiScreenTex = createInstrumentPanelTexture({
    title: 'CHI-SQUARE (χ²) TEST',
    primaryText: 'χ² = 0.42 · N=160',
    secondaryText: '9:3:3:1 · H₀ DITERIMA',
    accentHex: '#10b981',
  });
  if (chiScreenTex) disposableItems.push(chiScreenTex);
  const chiScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 0.56),
    new THREE.MeshBasicMaterial({ map: chiScreenTex })
  );
  chiScreenMesh.position.set(2.45, 2.38, 0);
  chiScreenMesh.rotation.y = -0.35;
  apparatusGroup.add(chiScreenMesh);

  const barColors = [0xfacc15, 0x22c55e, 0xeab308, 0x15803d];
  const phenoBars: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const barGeo = new THREE.BoxGeometry(0.32, 1.0, 0.32);
    barGeo.translate(0, 0.5, 0);
    const barMat = new THREE.MeshStandardMaterial({
      color: barColors[i],
      emissive: barColors[i],
      emissiveIntensity: 0.25,
      roughness: 0.25,
    });
    disposableItems.push(barGeo, barMat);
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(2.45, 0.18, -0.82 + i * 0.55);
    bar.castShadow = true;
    apparatusGroup.add(bar);
    phenoBars.push(bar);
  }

  const worldPosA = new THREE.Vector3();
  const worldPosB = new THREE.Vector3();
  const worldPosC = new THREE.Vector3();
  const anchors: BiologyConceptAnchors = {
    c1: { pos: worldPosA, text: '' },
    c2: { pos: worldPosB, text: '' },
    c3: { pos: worldPosC, text: '' },
  };
  const emptyAnchors: BiologyConceptAnchors = {};
  let lastChiKey = '';

  return {
    update: (t, curParams, _isLite, showConceptLabels) => {
      const sampleSizeN = curParams.sampleSizeN ?? 160;
      const alleleFreqR = curParams.dominantAlleleFreqR ?? curParams.alleleFreqR ?? 0.5;
      const alleleFreqY = curParams.dominantAlleleFreqY ?? curParams.alleleFreqY ?? 0.5;

      const metrics = calculateMendelDihybrid({
        sampleSizeN,
        dominantAlleleFreqR: alleleFreqR,
        dominantAlleleFreqY: alleleFreqY,
      });

      dnaHelixGroup.rotation.y = t * 0.75;

      // Subtle floating hover pulse on the 16 Punnett seeds
      for (let i = 0; i < seedMeshes.length; i++) {
        seedMeshes[i].position.y = 0.48 + Math.sin(t * 2.2 + i * 0.45) * 0.035;
        seedMeshes[i].rotation.y = t * 0.4 + i * 0.3;
      }

      // Scale 4 phenotype bars according to observed counts relative to sampleSizeN
      const counts = [
        metrics.observedRoundYellow,
        metrics.observedRoundGreen,
        metrics.observedWrinkledYellow,
        metrics.observedWrinkledGreen,
      ];
      const maxCount = Math.max(1, sampleSizeN * 0.62);
      for (let i = 0; i < 4; i++) {
        const targetH = Math.max(0.14, (counts[i] / maxCount) * 1.75);
        phenoBars[i].scale.y = THREE.MathUtils.lerp(phenoBars[i].scale.y, targetH, 0.2);
      }

      const chiKey = `${sampleSizeN}_${alleleFreqR.toFixed(2)}_${alleleFreqY.toFixed(2)}`;
      if (chiKey !== lastChiKey) {
        lastChiKey = chiKey;
        updateInstrumentPanelTexture(chiScreenTex, {
          title: 'CHI-SQUARE (χ²) TEST',
          primaryText: `χ² = ${metrics.chiSquareValue.toFixed(2)} (N=${Math.round(sampleSizeN)})`,
          secondaryText: `${metrics.observedRoundYellow}:${metrics.observedRoundGreen}:${metrics.observedWrinkledYellow}:${metrics.observedWrinkledGreen} · ${
            metrics.mendelHypothesisAccepted ? 'H₀ DITERIMA' : 'H₀ DITOLAK'
          }`,
          accentHex: metrics.mendelHypothesisAccepted ? '#10b981' : '#f43f5e',
        });
      }

      if (!showConceptLabels) return emptyAnchors;
      worldPosA.set(-2.45, 2.85, 0).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.set(0, 1.1, 0).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosC.set(2.45, 2.85, 0).applyMatrix4(apparatusGroup.matrixWorld);

      anchors.c1!.text = `Lokus Gen p(R)=${alleleFreqR.toFixed(2)} · q(Y)=${alleleFreqY.toFixed(2)}`;
      anchors.c2!.text = `Kisi Punnett F₂: ${metrics.observedRoundYellow} : ${metrics.observedRoundGreen} : ${metrics.observedWrinkledYellow} : ${metrics.observedWrinkledGreen}`;
      anchors.c3!.text = `Uji χ² = ${metrics.chiSquareValue.toFixed(2)} (${
        metrics.mendelHypothesisAccepted ? '< 7,815 Valid' : '> 7,815 Menyimpang'
      })`;
      return anchors;
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}

// =====================================================================
// RIG 6: DNA PCR THERMAL CYCLER & AGAROSE GEL ELECTROPHORESIS
// =====================================================================
export function buildDnaPcrRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const { apparatusGroup, slideGlassMat } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  const cyclerShadow = createContactShadowPlane(2.4, 2.2, 0.36);
  cyclerShadow.position.set(-2.35, 0.008, 0);
  const gelShadow = createContactShadowPlane(4.2, 2.7, 0.36);
  gelShadow.position.set(1.25, 0.008, 0);
  apparatusGroup.add(cyclerShadow, gelShadow);

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.38,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.3,
    roughness: 0.35,
  });
  const platinumMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18,
  });
  disposableItems.push(chassisMat, accentMat, platinumMat);

  // 1. Left PCR Thermal Cycler Machine (x = -2.35)
  const cyclerBodyGeo = new THREE.BoxGeometry(2.1, 0.92, 1.92);
  const cyclerBody = new THREE.Mesh(cyclerBodyGeo, chassisMat);
  cyclerBody.position.set(-2.35, 0.46, 0);
  cyclerBody.castShadow = true;
  cyclerBody.name = 'Mesin Thermal Cycler PCR';
  cyclerBody.userData = {
    draggableParam: 'annealingTempC',
    min: 42,
    max: 72,
    step: 1,
    label: 'Suhu Annealing Tₐ (°C)',
  };
  disposableItems.push(cyclerBodyGeo);
  apparatusGroup.add(cyclerBody);

  const cyclerLidGeo = new THREE.BoxGeometry(1.75, 0.22, 1.48);
  const cyclerLid = new THREE.Mesh(cyclerLidGeo, chassisMat);
  cyclerLid.position.set(-2.35, 1.08, -0.15);
  cyclerLid.rotation.x = -0.18;
  cyclerLid.castShadow = true;
  cyclerLid.userData = cyclerBody.userData;
  disposableItems.push(cyclerLidGeo);
  apparatusGroup.add(cyclerLid);

  // 8-strip glowing PCR microcentrifuge reaction tubes inside thermal block
  const tubeGeo = new THREE.CylinderGeometry(0.055, 0.032, 0.24, 12);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.88,
  });
  disposableItems.push(tubeGeo, tubeMat);
  for (let i = 0; i < 6; i++) {
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(-2.75 + i * 0.16, 0.94, 0.26);
    tube.userData = cyclerBody.userData;
    apparatusGroup.add(tube);
  }

  const pcrScreenTex = createInstrumentPanelTexture({
    title: 'THERMAL CYCLER PCR',
    primaryText: 'Denaturasi 95°C · c=25',
    secondaryText: 'Eff=96% · Amp=10^7.3x',
    accentHex: '#38bdf8',
  });
  if (pcrScreenTex) disposableItems.push(pcrScreenTex);
  const pcrScreenGeo = new THREE.PlaneGeometry(1.72, 0.68);
  const pcrScreenMat = new THREE.MeshBasicMaterial({ map: pcrScreenTex ?? undefined });
  disposableItems.push(pcrScreenGeo, pcrScreenMat);
  const pcrScreen = new THREE.Mesh(pcrScreenGeo, pcrScreenMat);
  pcrScreen.position.set(-2.35, 0.52, 0.97);
  pcrScreen.userData = cyclerBody.userData;
  apparatusGroup.add(pcrScreen);

  // 2. Right UV Transilluminator & Agarose Gel Electrophoresis Box (x = 1.25)
  const gelBaseGeo = new THREE.BoxGeometry(3.85, 0.34, 2.45);
  const gelBase = new THREE.Mesh(gelBaseGeo, chassisMat);
  gelBase.position.set(1.25, 0.17, 0);
  gelBase.castShadow = true;
  gelBase.name = 'Tangki Elektroforesis Gel Agarosa UV';
  disposableItems.push(gelBaseGeo);
  apparatusGroup.add(gelBase);

  const uvBedGeo = new THREE.BoxGeometry(3.32, 0.08, 1.96);
  const uvBedMat = new THREE.MeshStandardMaterial({
    color: 0x312e81,
    emissive: 0x6d28d9,
    emissiveIntensity: 0.72,
    roughness: 0.25,
  });
  const uvBed = new THREE.Mesh(uvBedGeo, uvBedMat);
  uvBed.position.set(1.25, 0.36, 0);
  disposableItems.push(uvBedGeo, uvBedMat);
  apparatusGroup.add(uvBed);

  // Agarose gel slab
  const gelSlabGeo = new THREE.BoxGeometry(2.96, 0.14, 1.72);
  const gelSlabMat = new THREE.MeshPhysicalMaterial({
    color: 0xc7d2fe,
    transparent: true,
    opacity: 0.44,
    roughness: 0.12,
    transmission: 0.35,
  });
  const gelSlab = new THREE.Mesh(gelSlabGeo, gelSlabMat);
  gelSlab.position.set(1.25, 0.46, 0);
  gelSlab.name = 'Gel Agarosa & Pita DNA UV';
  gelSlab.userData = {
    draggableParam: 'dnaFragmentBp',
    min: 100,
    max: 3000,
    step: 50,
    label: 'Ukuran Fragmen DNA (bp)',
  };
  disposableItems.push(gelSlabGeo, gelSlabMat);
  apparatusGroup.add(gelSlab);

  // Clear acrylic electrophoresis lid
  const gelCoverGeo = new THREE.BoxGeometry(3.65, 0.42, 2.28);
  const gelCover = new THREE.Mesh(gelCoverGeo, slideGlassMat);
  gelCover.position.set(1.25, 0.62, 0);
  gelCover.renderOrder = 3;
  disposableItems.push(gelCoverGeo);
  apparatusGroup.add(gelCover);

  // Platinum cathode (-) & anode (+) electrodes
  const elecBarGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.72, 10);
  elecBarGeo.rotateX(Math.PI / 2);
  disposableItems.push(elecBarGeo);
  const cathodeBar = new THREE.Mesh(elecBarGeo, platinumMat);
  cathodeBar.position.set(-0.22, 0.48, 0);
  const anodeBar = new THREE.Mesh(elecBarGeo, platinumMat);
  anodeBar.position.set(2.72, 0.48, 0);
  apparatusGroup.add(cathodeBar, anodeBar);

  // Sample comb loading wells at x = -0.02
  const wellGeo = new THREE.BoxGeometry(0.08, 0.08, 0.44);
  const wellMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  disposableItems.push(wellGeo, wellMat);
  [-0.44, 0.14, 0.62].forEach((wz) => {
    const well = new THREE.Mesh(wellGeo, wellMat);
    well.position.set(-0.02, 0.52, wz);
    apparatusGroup.add(well);
  });

  // Lane 1: 5 reference DNA Ladder rungs (3000, 1500, 750, 400, 150 bp)
  const bandGeo = new THREE.BoxGeometry(0.085, 0.065, 0.42);
  const ladderMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });
  disposableItems.push(bandGeo, ladderMat);
  const ladderBands: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(bandGeo, ladderMat);
    rung.position.set(0.35 + i * 0.45, 0.51, -0.44);
    apparatusGroup.add(rung);
    ladderBands.push(rung);
  }

  // Lane 2: Amplified Target DNA Band (brightness tracks UV fluorescence %, position tracks bp & V)
  const sampleBandMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x22c55e,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  disposableItems.push(sampleBandMat);
  const sampleBand = new THREE.Mesh(bandGeo, sampleBandMat);
  sampleBand.position.set(1.2, 0.515, 0.14);
  sampleBand.name = 'Pita DNA Target PCR (UV Fluoresen)';
  sampleBand.userData = gelSlab.userData;
  apparatusGroup.add(sampleBand);

  // DC Electrophoresis Power Supply elevated cleanly behind gel box (x = 1.25, z = -1.65)
  const psuGeo = new THREE.BoxGeometry(2.35, 1.15, 0.68);
  const psuBox = new THREE.Mesh(psuGeo, chassisMat);
  psuBox.position.set(1.25, 0.72, -1.62);
  psuBox.castShadow = true;
  psuBox.userData = {
    draggableParam: 'electrophoresisVoltageV',
    min: 30,
    max: 200,
    step: 10,
    label: 'Tegangan Elektroforesis V (Volt)',
  };
  disposableItems.push(psuGeo);
  apparatusGroup.add(psuBox);

  const gelPsuTex = createInstrumentPanelTexture({
    title: 'ELECTROPHORESIS DC',
    primaryText: '100 V · Agarosa 1.2%',
    secondaryText: 'd=41.2 mm · Rf=0.55',
    accentHex: '#22c55e',
  });
  if (gelPsuTex) disposableItems.push(gelPsuTex);
  const gelPsuGeo = new THREE.PlaneGeometry(2.05, 0.68);
  const gelPsuMat = new THREE.MeshBasicMaterial({ map: gelPsuTex ?? undefined });
  disposableItems.push(gelPsuGeo, gelPsuMat);
  const gelPsuScreen = new THREE.Mesh(gelPsuGeo, gelPsuMat);
  gelPsuScreen.position.set(1.25, 0.92, -1.27);
  gelPsuScreen.userData = psuBox.userData;
  apparatusGroup.add(gelPsuScreen);

  // Drifting negative DNA-buffer ion indicator pool moving from Cathode (-) -> Anode (+)
  const PCR_IONS_MAX = 18;
  const ionGeo = new THREE.SphereGeometry(0.038, 10, 10);
  const ionMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa });
  disposableItems.push(ionGeo, ionMat);
  const ionPool = createInstancedParticlePool(PCR_IONS_MAX, ionGeo, ionMat, apparatusGroup);

  const worldPosA = new THREE.Vector3();
  const worldPosB = new THREE.Vector3();
  const worldPosC = new THREE.Vector3();
  const anchors: BiologyConceptAnchors = {
    c1: { pos: worldPosA, text: '' },
    c2: { pos: worldPosB, text: '' },
    c3: { pos: worldPosC, text: '' },
  };
  const emptyAnchors: BiologyConceptAnchors = {};
  let lastCyclerKey = '';
  let lastGelPsuKey = '';

  return {
    update: (t, curParams, _isLite, showConceptLabels, particleScale = 1) => {
      const pcrState = computeDnaPcrVisualState(curParams, t);
      const { metrics } = pcrState;
      const voltage = curParams.electrophoresisVoltageV ?? 100;
      const agarose = curParams.agaroseConcPct ?? 1.2;
      const bp = curParams.dnaFragmentBp ?? 750;
      const cycles = curParams.pcrCycles ?? 25;

      // Tube thermal glow color tracks current PCR thermal cycler phase (red 95°C, cyan Ta, emerald 72°C)
      const phaseHex =
        pcrState.liveCyclerTempC >= 90
          ? 0xf43f5e
          : pcrState.liveCyclerTempC >= 70
          ? 0x10b981
          : 0x38bdf8;
      tubeMat.color.setHex(phaseHex);
      tubeMat.emissive.setHex(phaseHex);

      // Update DNA Ladder bands & amplified sample band along the agarose gel span (x = 0.08 -> 2.52)
      const gelStartX = 0.08;
      const gelSpanX = 2.44;
      for (let i = 0; i < ladderBands.length; i++) {
        const frac = pcrState.ladderMigrationFracs[i] ?? 0.5;
        ladderBands[i].position.x = gelStartX + frac * gelSpanX;
      }

      const targetBandX = gelStartX + pcrState.bandMigrationFrac * gelSpanX;
      sampleBand.position.x = THREE.MathUtils.lerp(sampleBand.position.x, targetBandX, 0.25);
      sampleBandMat.emissiveIntensity = 0.18 + pcrState.uvGlowIntensity * 2.2;
      sampleBandMat.opacity = 0.35 + pcrState.uvGlowIntensity * 0.65;
      sampleBandMat.transparent = true;

      // Drifting DNA/TAE buffer ions from - cathode toward + anode
      const activeIons = Math.max(6, Math.round(PCR_IONS_MAX * particleScale));
      const driftSpd = 0.2 + (voltage / 180) * 0.9;
      for (let i = 0; i < activeIons; i++) {
        const u = ((t * driftSpd + i / activeIons) % 1 + 1) % 1;
        ionPool.setTransform(
          i,
          -0.02 + u * 2.58,
          0.5,
          -0.65 + ((i * 0.29) % 1.3),
          0.85
        );
      }
      ionPool.commit(activeIons);

      const cyclerKey = `${pcrState.liveCyclerTempC}_${pcrState.activeCycleNumber}_${Math.round(cycles)}_${metrics.log10DnaCopies.toFixed(1)}`;
      if (cyclerKey !== lastCyclerKey) {
        lastCyclerKey = cyclerKey;
        const shortPhase = pcrState.cyclePhaseName.startsWith('Denat')
          ? 'Denat'
          : pcrState.cyclePhaseName.startsWith('Anneal')
          ? 'Anneal'
          : 'Ekst';
        updateInstrumentPanelTexture(pcrScreenTex, {
          title: 'THERMAL CYCLER PCR',
          primaryText: `${pcrState.liveCyclerTempC.toFixed(0)}°C · ${shortPhase} (${pcrState.activeCycleNumber}/${Math.round(cycles)})`,
          secondaryText: `Eff=${metrics.pcrEfficiencyPct.toFixed(0)}% · N=10^${metrics.log10DnaCopies.toFixed(1)}`,
          accentHex: pcrState.liveCyclerTempC >= 90 ? '#f43f5e' : '#38bdf8',
        });
      }

      const gelKey = `${Math.round(voltage)}_${agarose.toFixed(1)}_${Math.round(bp)}_${metrics.migrationDistanceMm.toFixed(1)}`;
      if (gelKey !== lastGelPsuKey) {
        lastGelPsuKey = gelKey;
        updateInstrumentPanelTexture(gelPsuTex, {
          title: 'ELECTROPHORESIS UV',
          primaryText: `${Math.round(voltage)} V · Gel ${agarose.toFixed(1)}% · ${Math.round(bp)} bp`,
          secondaryText: `d=${metrics.migrationDistanceMm.toFixed(1)}mm · Rf=${metrics.relativeMobilityRf.toFixed(2)} · UV=${metrics.bandFluorescencePct.toFixed(0)}%`,
          accentHex: '#22c55e',
        });
      }

      if (!showConceptLabels) return emptyAnchors;
      worldPosA.set(-2.35, 1.85, 0).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.set(sampleBand.position.x, 1.15, 0.14).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosC.set(1.25, 1.45, -1.45).applyMatrix4(apparatusGroup.matrixWorld);

      anchors.c1!.text = `PCR ${pcrState.cyclePhaseName} · Eff=${metrics.pcrEfficiencyPct.toFixed(0)}%`;
      anchors.c2!.text = `Pita ${Math.round(bp)} bp · Jarak ${metrics.migrationDistanceMm.toFixed(1)} mm`;
      anchors.c3!.text = `Gel ${agarose.toFixed(1)}% · ${Math.round(voltage)} V · Rf=${metrics.relativeMobilityRf.toFixed(2)}`;
      return anchors;
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}


