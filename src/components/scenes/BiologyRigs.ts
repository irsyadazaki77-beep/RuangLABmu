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
  computeCatalasePhHex,
  computeEcosystemVisualCounts,
  computeOsmosisVisualState,
  computePhotosynthesisGasLevel,
} from '../../utils/biologyVisualHelpers';

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
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.43, 1.43, 2.66, 36),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.22,
      roughness: 0.14,
      metalness: 0.05,
      depthWrite: false,
    })
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
      const lux = curParams.lightIntensityLux || 1200;
      const bicarb = curParams.bicarbonateConc ?? 2.5;
      const hex = wavelengthNmToHex(wavelength);

      filterMat.color.setHex(hex);
      filterMat.emissive.setHex(hex);
      beamMat.uniforms.uColor.value.setHex(hex);
      beamMat.uniforms.uOpacity.value = Math.min(0.42, 0.12 + (lux / 3000) * 0.28);
      beamMat.uniforms.uTime.value = t;
      causticMat.color.setHex(hex);
      causticMat.opacity = Math.min(0.24, 0.06 + (lux / 3000) * 0.16) * (0.9 + 0.1 * Math.sin(t * 2.6));
      lightSpot.color.setHex(hex);
      lightSpot.intensity = lux / 300;
      plantGroup.rotation.y = Math.sin(t * 0.7) * 0.045;

      // Dynamic O2 Gas Pocket height at top of inverted tube
      const gasLevel = computePhotosynthesisGasLevel(lux, wavelength, bicarb);
      const pocketHeight = gasLevel * 0.9;
      gasPocket.scale.y = pocketHeight;
      gasPocket.position.y = 2.95 - pocketHeight * 0.5;

      const parKey = `${Math.round(lux)}_${Math.round(wavelength)}_${Math.round(gasLevel * 100)}`;
      if (parKey !== lastParKey) {
        lastParKey = parKey;
        updateInstrumentPanelTexture(parScreenTex, {
          title: 'PAR QUANTUM SENSOR',
          primaryText: `${Math.round(lux)} Lux`,
          secondaryText: `λ = ${Math.round(wavelength)} nm · O₂ ${Math.round(gasLevel * 100)}%`,
          accentHex: '#38bdf8',
        });
      }

      const bubbleSpeed = 0.45 + (lux / 1600) * Math.max(0.25, gasLevel);
      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      const activeCount = Math.max(8, Math.round(BUBBLE_COUNT * effectiveScale));
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

      photonArrow.visible = showConceptLabels;
      if (!showConceptLabels) return emptyAnchors;

      worldPosA.set(-3.2, 3.05, 0).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.set(0, 2.95, 0).applyMatrix4(apparatusGroup.matrixWorld);
      anchors.c1!.text = `Akumulasi O₂ (${Math.round(gasLevel * 100)}%)`;
      anchors.c3!.text = `Foton Cahaya λ = ${Math.round(wavelength)} nm`;
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
      const sub = curParams.substrateConcMm || 10;

      liquidMat.color.setHex(computeCatalasePhHex(ph));
      const thermHex = tempC > 48 ? 0xef4444 : tempC < 22 ? 0x38bdf8 : 0x10b981;
      thermIndicatorMat.color.setHex(thermHex);
      thermIndicatorMat.emissive.setHex(thermHex);

      const thermKey = `${tempC.toFixed(1)}_${ph.toFixed(1)}_${sub}`;
      if (thermKey !== lastThermKey) {
        lastThermKey = thermKey;
        updateInstrumentPanelTexture(thermScreenTex, {
          title: 'ENZYME ASSAY MONITOR',
          primaryText: `${tempC.toFixed(1)} °C`,
          secondaryText: `pH ${ph.toFixed(1)} · [S] = ${Math.round(sub)} mM`,
          accentHex: tempC > 48 ? '#f87171' : '#34d399',
        });
      }

      const phFactor = Math.max(0.08, 1.0 - Math.abs(ph - 7.0) * 0.15);
      const thermalFactor =
        tempC > 45 ? Math.max(0.05, 1.0 - (tempC - 45) / 28) : Math.max(0.25, tempC / 37);
      const activity = Math.min(1.8, (sub / 18) * phFactor * thermalFactor);

      const foamTarget = Math.min(2.05, 0.28 + activity * 1.25);
      foamMesh.scale.y = foamTarget;
      foamMesh.position.y = 0.82 + (1.2 * foamTarget) / 2;

      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      const activeCount = Math.max(12, Math.round(FOAM_BUBBLES * effectiveScale));
      for (let idx = 0; idx < activeCount; idx++) {
        const seed = particleSeeds[idx] ?? idx * 0.7;
        const span = Math.max(0.6, 1.2 * foamTarget + 0.35);
        const phase = (seed + t * Math.max(0.25, activity * 0.9)) % span;
        const py = 0.85 + (phase < 0 ? phase + span : phase);
        const rad = 0.15 + ((idx % 5) / 5) * 0.3;
        const px = Math.cos(seed * 4.3 + t * 0.9) * rad;
        const pz = Math.sin(seed * 3.1 + t * 0.8) * rad;
        instancedPool.setTransform(idx, px, py, pz, 0.65 + (idx % 3) * 0.25);
      }
      instancedPool.commit(activeCount);

      if (!showConceptLabels) return emptyAnchors;
      foamMesh.getWorldPosition(worldPosA);
      worldPosA.y += 0.85;
      worldPosB.set(-0.22, 2.98, 0.15).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.y += 0.35;
      anchors.c1!.text = `Busa O₂ · pH ${ph.toFixed(1)}`;
      anchors.c3!.text = tempC > 45 ? `Suhu ${tempC}°C: Denaturasi Enzim!` : `Suhu ${tempC}°C (Aktif)`;
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
      const alpha = curParams.preyGrowthRateAlpha ?? 1.1;
      const beta = curParams.predationRateBeta ?? 0.04;

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
        const speed = 0.55 + alpha * 0.28;
        const radius = 0.75 + ((i * 19) % 100) / 100 * 1.45;
        const theta = seed + t * speed * (i % 2 === 0 ? 1 : -0.8);
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
        const stalkSpeed = 0.75 + beta * 8.5;
        const radius = 0.9 + ((i * 29) % 100) / 100 * 1.25;
        const theta = seed - t * stalkSpeed;
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

      anchors.c1!.text = `Mangsa (x) = ${Math.round(preyPop)} individu`;
      anchors.c2!.text =
        vis.status === 'seimbang'
          ? 'Ekosistem Seimbang'
          : vis.status === 'ledakan_mangsa'
          ? 'Populasi Mangsa Dominan'
          : 'Tekanan Predasi Tinggi!';
      anchors.c3!.text = `Predator (y) = ${Math.round(predPop)} individu`;
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
      const osmState = computeOsmosisVisualState(sucrose);
      const isHyper = osmState.state === 'hypertonic';
      const isHypo = osmState.state === 'hypotonic';

      const osmKey = `${sucrose.toFixed(2)}_${osmState.state}`;
      if (osmKey !== lastOsmKey) {
        lastOsmKey = osmKey;
        updateInstrumentPanelTexture(osmScreenTex, {
          title: 'DIGITAL OSMOMETER',
          primaryText: `${sucrose.toFixed(2)} M`,
          secondaryText: isHyper
            ? 'HIPERTONIK · Plasmolisis'
            : isHypo
            ? 'HIPOTONIK · Sel Turgid'
            : 'ISOTONIK · Ψs Seimbang',
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

      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      const activeCount = Math.max(12, Math.round(OSMOSIS_DOTS * effectiveScale));
      for (let idx = 0; idx < activeCount; idx++) {
        const seed = particleSeeds[idx] ?? idx * 0.9;
        const px = Math.sin(t * 0.7 + seed) * 1.65;
        const pz = Math.cos(t * 0.65 + seed * 1.3) * 1.65;
        const py = 0.48 + (idx % 7) * 0.22;
        instancedPool.setTransform(idx, px, py, pz, idx % 3 === 0 ? 1.15 : 0.95);
      }
      instancedPool.commit(activeCount);

      if (showConceptLabels && (isHyper || isHypo)) {
        osmosisArrowLeft.visible = true;
        osmosisArrowRight.visible = true;
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
        ? 'Osmosis: H₂O Keluar (Plasmolisis)'
        : isHypo
        ? 'Osmosis: H₂O Masuk (Sel Turgid)'
        : 'Isotonik: Fluks H₂O Seimbang';
      return anchors;
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}

