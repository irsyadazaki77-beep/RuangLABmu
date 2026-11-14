import * as THREE from 'three';
import {
  createGraduatedScaleTexture,
  createInstancedParticlePool,
  type InstancedParticlePool,
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
    showConceptLabels: boolean
  ) => BiologyConceptAnchors;
  dispose: () => void;
}

// =====================================================================
// RIG 1: INGENHOUSZ PHOTOSYNTHESIS (HYDRILLA + VOLUMETRIC BEAM + O2 TRAP)
// =====================================================================
export function buildPhotosynthesisRig(ctx: BiologyRigSharedContext): BiologyRigHandle {
  const { apparatusGroup, scene, slideGlassMat, chloroMat, createCellularOrganellesGroup } = ctx;
  const disposableItems: { dispose: () => void }[] = [];

  const beaker = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 3.2, 32, 1, true),
    slideGlassMat
  );
  beaker.position.y = 1.6;
  beaker.castShadow = true;
  beaker.name = 'Gelas Beker Kaca 1000 mL';
  apparatusGroup.add(beaker);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 2.8, 32),
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.36,
      roughness: 0.2,
    })
  );
  water.position.y = 1.4;
  water.name = 'Larutan Air & NaHCO₃';
  apparatusGroup.add(water);

  const funnel = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 1.2, 24, 1, true),
    slideGlassMat
  );
  funnel.position.y = 0.7;
  funnel.rotation.x = Math.PI;
  funnel.name = '🎯 Corong Kaca & Tabung O₂';
  funnel.userData = {
    draggableParam: 'wavelengthNm',
    min: 400,
    max: 700,
    step: 10,
    label: 'Panjang Gelombang λ (nm)',
  };
  apparatusGroup.add(funnel);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 1.9, 18, 1, true),
    slideGlassMat
  );
  tube.position.y = 2.05;
  tube.name = '🎯 Tabung Reaksi Penampung Gas O₂';
  apparatusGroup.add(tube);

  // Calibrated mL scale strip along the inverted tube
  const tubeScaleTex = createGraduatedScaleTexture(10, 'mL', 10, {
    invertTopToBottom: true,
    width: 128,
    height: 512,
  });
  if (tubeScaleTex) disposableItems.push(tubeScaleTex);
  const tubeScaleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.245, 0.245, 1.7, 16, 1, true, -0.5, 1.0),
    new THREE.MeshBasicMaterial({
      map: tubeScaleTex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  tubeScaleMesh.position.y = 2.05;
  apparatusGroup.add(tubeScaleMesh);

  // Expanding O2 Gas Pocket trapped at top of inverted test tube
  const gasPocketMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.78,
    roughness: 0.12,
  });
  const gasPocket = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 1.0, 16), gasPocketMat);
  gasPocket.position.y = 2.8;
  gasPocket.name = 'Ruang Akumulasi Gas O₂ Murni';
  apparatusGroup.add(gasPocket);

  // Articulated Hydrilla Stems & Whorled Leaves
  const plantGroup = new THREE.Group();
  plantGroup.position.set(0, 0.2, 0);
  plantGroup.name = '🌱 Tanaman Hydrilla verticillata';
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
  [
    { x: 0, z: 0, h: 1.08, tilt: 0 },
    { x: -0.18, z: 0.14, h: 0.85, tilt: 0.14 },
    { x: 0.16, z: -0.12, h: 0.9, tilt: -0.12 },
  ].forEach((branch) => {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, branch.h, 8), stemMat);
    stem.position.set(branch.x, branch.h * 0.5, branch.z);
    stem.rotation.z = branch.tilt;
    plantGroup.add(stem);

    const leafGeo = new THREE.ConeGeometry(0.11, 0.34, 4);
    const levels = 5;
    for (let i = 0; i < levels; i++) {
      const y = 0.18 + i * (branch.h / levels);
      for (let j = 0; j < 4; j++) {
        const angle = (j * Math.PI) / 2 + (i * Math.PI) / 4;
        const leaf = new THREE.Mesh(leafGeo, chloroMat);
        leaf.position.set(
          branch.x + Math.cos(angle) * 0.11,
          y,
          branch.z + Math.sin(angle) * 0.11
        );
        leaf.rotation.z = Math.cos(angle) * 0.72;
        leaf.rotation.x = -Math.sin(angle) * 0.72;
        leaf.name = '🌿 Daun Hydrilla & Kloroplas Fotosistem II';
        plantGroup.add(leaf);
      }
    }
  });
  apparatusGroup.add(plantGroup);

  const organellesGroup = createCellularOrganellesGroup(0.55);
  organellesGroup.position.set(2.2, 1.3, 0);
  apparatusGroup.add(organellesGroup);

  // Variable Spectrum Lamp Housing + Filter Ring + Glowing Bulb + Photon Cone
  const lampGroup = new THREE.Group();
  lampGroup.position.set(-3.2, 2.5, 0);
  lampGroup.rotation.z = -Math.PI / 3;
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 0.55, 18),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 })
  );
  lamp.name = '💡 Lampu Spektrum Variabel';
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
  const filterLens = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 20), filterMat);
  filterLens.position.y = -0.28;
  lampGroup.add(lamp, filterLens);
  apparatusGroup.add(lampGroup);

  // Translucent Volumetric Light Beam Cone aimed toward Hydrilla
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamCone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.3, 24, 1, true), beamMat);
  beamCone.position.set(-1.75, 1.75, 0);
  beamCone.rotation.z = Math.PI / 2 - 0.52;
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

  return {
    update: (t, curParams, isLite, showConceptLabels) => {
      const wavelength = curParams.wavelengthNm || 660;
      const lux = curParams.lightIntensityLux || 1200;
      const bicarb = curParams.bicarbonateConc ?? 2.5;
      const hex = wavelengthNmToHex(wavelength);

      filterMat.color.setHex(hex);
      filterMat.emissive.setHex(hex);
      beamMat.color.setHex(hex);
      beamMat.opacity = Math.min(0.24, 0.05 + (lux / 3000) * 0.18);
      lightSpot.color.setHex(hex);
      lightSpot.intensity = lux / 300;

      // Dynamic O2 Gas Pocket height at top of inverted tube
      const gasLevel = computePhotosynthesisGasLevel(lux, wavelength, bicarb);
      const pocketHeight = gasLevel * 0.9;
      gasPocket.scale.y = pocketHeight;
      gasPocket.position.y = 2.95 - pocketHeight * 0.5;

      const bubbleSpeed = 0.45 + (lux / 1600) * Math.max(0.25, gasLevel);
      const activeCount = isLite ? Math.floor(BUBBLE_COUNT / 2) : BUBBLE_COUNT;
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
      if (!showConceptLabels) return {};

      worldPosA.set(-3.2, 3.05, 0).applyMatrix4(apparatusGroup.matrixWorld);
      worldPosB.set(0, 2.95, 0).applyMatrix4(apparatusGroup.matrixWorld);
      return {
        c1: { pos: worldPosB.clone(), text: `Akumulasi O₂ (${Math.round(gasLevel * 100)}%)` },
        c3: { pos: worldPosA.clone(), text: `Foton Cahaya λ = ${Math.round(wavelength)} nm` },
      };
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

  const rackBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.15, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  rackBase.position.y = 0.08;
  rackBase.castShadow = true;
  rackBase.name = 'Rak Tabung Reaksi Kayu';
  apparatusGroup.add(rackBase);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 3.2, 24, 1, true),
    slideGlassMat
  );
  tube.position.y = 1.7;
  tube.castShadow = true;
  tube.name = '🧪 Tabung Reaksi Reaksi Katalase';
  tube.userData = {
    draggableParam: 'substrateConcMm',
    min: 1,
    max: 50,
    step: 1,
    label: 'Konsentrasi Substrat [S] (mM)',
  };
  apparatusGroup.add(tube);

  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
    roughness: 0.2,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.65, 24), liquidMat);
  liquid.position.y = 0.45;
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
  foamMesh.position.y = 1.3;
  foamMesh.name = '🎯 Kolom Busa O₂ Berbusa';
  apparatusGroup.add(foamMesh);

  // Digital Immersion Thermal Probe beside reaction tube (draggable temperatureC)
  const thermStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.3, 12),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.25 })
  );
  thermStem.position.set(-0.92, 1.35, 0.25);
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
  const thermBulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), thermIndicatorMat);
  thermBulb.position.set(-0.92, 2.52, 0.25);
  apparatusGroup.add(thermStem, thermBulb);

  const organellesGroup = createCellularOrganellesGroup(0.6);
  organellesGroup.position.set(1.85, 1.35, 0);
  apparatusGroup.add(organellesGroup);

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

  return {
    update: (t, curParams, isLite, showConceptLabels) => {
      const ph = curParams.solutionPH ?? curParams.solutionPh ?? 7.0;
      const tempC = curParams.temperatureC ?? curParams.tempCelsius ?? 37;
      const sub = curParams.substrateConcMm || 10;

      liquidMat.color.setHex(computeCatalasePhHex(ph));
      const thermHex = tempC > 48 ? 0xef4444 : tempC < 22 ? 0x38bdf8 : 0x10b981;
      thermIndicatorMat.color.setHex(thermHex);
      thermIndicatorMat.emissive.setHex(thermHex);

      const phFactor = Math.max(0.08, 1.0 - Math.abs(ph - 7.0) * 0.15);
      const thermalFactor =
        tempC > 45 ? Math.max(0.05, 1.0 - (tempC - 45) / 28) : Math.max(0.25, tempC / 37);
      const activity = Math.min(1.8, (sub / 18) * phFactor * thermalFactor);

      const foamTarget = Math.min(2.05, 0.28 + activity * 1.25);
      foamMesh.scale.y = foamTarget;
      foamMesh.position.y = 0.72 + (1.2 * foamTarget) / 2;

      const activeCount = isLite ? Math.floor(FOAM_BUBBLES / 2) : FOAM_BUBBLES;
      for (let idx = 0; idx < activeCount; idx++) {
        const seed = particleSeeds[idx] ?? idx * 0.7;
        const span = Math.max(0.6, 1.2 * foamTarget + 0.35);
        const phase = (seed + t * Math.max(0.25, activity * 0.9)) % span;
        const py = 0.78 + (phase < 0 ? phase + span : phase);
        const rad = 0.15 + ((idx % 5) / 5) * 0.3;
        const px = Math.cos(seed * 4.3 + t * 0.9) * rad;
        const pz = Math.sin(seed * 3.1 + t * 0.8) * rad;
        instancedPool.setTransform(idx, px, py, pz, 0.65 + (idx % 3) * 0.25);
      }
      instancedPool.commit(activeCount);

      if (!showConceptLabels) return {};
      foamMesh.getWorldPosition(worldPosA);
      worldPosB.set(-0.92, 2.52, 0.25).applyMatrix4(apparatusGroup.matrixWorld);
      return {
        c1: {
          pos: worldPosA.clone().add(new THREE.Vector3(0, 0.85, 0)),
          text: `Busa O₂ · pH ${ph.toFixed(1)}`,
        },
        c3: {
          pos: worldPosB.clone().add(new THREE.Vector3(0, 0.45, 0)),
          text: tempC > 45 ? `Suhu ${tempC}°C: Denaturasi Enzim!` : `Suhu ${tempC}°C (Aktif)`,
        },
      };
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

  return {
    update: (t, curParams, isLite, showConceptLabels) => {
      const preyPop = curParams.preyPopulationX ?? 40;
      const predPop = curParams.predatorPopulationY ?? 9;
      const alpha = curParams.preyGrowthRateAlpha ?? 1.1;
      const beta = curParams.predationRateBeta ?? 0.04;

      const vis = computeEcosystemVisualCounts(preyPop, predPop, isLite, MAX_PREY, MAX_PRED);

      statusRingMat.color.setHex(
        vis.status === 'seimbang'
          ? 0x10b981
          : vis.status === 'ledakan_mangsa'
          ? 0x38bdf8
          : 0xf43f5e
      );

      // Vegetative richness fades slightly if herbivore load is extreme
      meadowMat.color.setHex(preyPop > 90 ? 0x65a30d : 0x16a34a);

      preyMesh.count = vis.preyInstances;
      for (let i = 0; i < vis.preyInstances; i++) {
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

      predMesh.count = vis.predatorInstances;
      for (let i = 0; i < vis.predatorInstances; i++) {
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

      if (!showConceptLabels) return {};
      preyBeacon.getWorldPosition(worldPosA);
      predBeacon.getWorldPosition(worldPosB);
      return {
        c1: {
          pos: worldPosA.clone().add(new THREE.Vector3(0, 0.65, 0)),
          text: `Mangsa (x) = ${Math.round(preyPop)} individu`,
        },
        c2: {
          pos: new THREE.Vector3(0.2, 1.35, 0.15).applyMatrix4(apparatusGroup.matrixWorld),
          text:
            vis.status === 'seimbang'
              ? 'Ekosistem Seimbang'
              : vis.status === 'ledakan_mangsa'
              ? 'Populasi Mangsa Dominan'
              : 'Tekanan Predasi Tinggi!',
        },
        c3: {
          pos: worldPosB.clone().add(new THREE.Vector3(0, 0.65, 0)),
          text: `Predator (y) = ${Math.round(predPop)} individu`,
        },
      };
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

  const petri = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.36, 36), slideGlassMat);
  petri.position.y = 0.22;
  petri.castShadow = true;
  petri.name = 'Cawan Petri & Kaca Preparat Sukrosa';
  apparatusGroup.add(petri);

  // Architectural Rigid Plant Cell Wall Pillars & Rim Frame (non-wireframe solid beams)
  const cellWallGroup = new THREE.Group();
  cellWallGroup.position.y = 1.35;
  cellWallGroup.name = '🧱 Dinding Selulosa Kaku';
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x15803d,
    emissiveIntensity: 0.32,
    roughness: 0.55,
  });
  const wallWire = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 1.68, 1.48),
    new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true, transparent: true, opacity: 0.32 })
  );
  cellWallGroup.add(wallWire);

  // Corner cellulose columns for structural realism
  const postGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.68, 10);
  [
    [-1.16, -0.73],
    [1.16, -0.73],
    [-1.16, 0.73],
    [1.16, 0.73],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(postGeo, wallMat);
    col.position.set(cx, 0, cz);
    cellWallGroup.add(col);
  });
  apparatusGroup.add(cellWallGroup);

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
  let cyclosisAngle = 0;
  let lastT = 0;

  return {
    update: (t, curParams, isLite, showConceptLabels) => {
      const dt = Math.max(0, Math.min(0.1, Math.abs(t - lastT)));
      lastT = t;

      const sucrose = curParams.sucroseConcMolar ?? 0.3;
      const osmState = computeOsmosisVisualState(sucrose);

      protoplastMesh.scale.setScalar(osmState.protoplastScale);
      vacuoleMesh.scale.set(
        1.35 * osmState.vacuoleScale,
        0.85 * osmState.vacuoleScale,
        0.8 * osmState.vacuoleScale
      );

      // Cytoplasmic streaming (cyclosis) rotation inside protoplast
      cyclosisAngle += dt * osmState.cyclosisSpeed * 0.8;
      organellesGroup.rotation.y = cyclosisAngle;

      const activeCount = isLite ? Math.floor(OSMOSIS_DOTS / 2) : OSMOSIS_DOTS;
      for (let idx = 0; idx < activeCount; idx++) {
        const seed = particleSeeds[idx] ?? idx * 0.9;
        const px = Math.sin(t * 0.7 + seed) * 1.65;
        const pz = Math.cos(t * 0.65 + seed * 1.3) * 1.65;
        const py = 0.48 + (idx % 7) * 0.22;
        instancedPool.setTransform(idx, px, py, pz, idx % 3 === 0 ? 1.15 : 0.95);
      }
      instancedPool.commit(activeCount);

      const isHyper = osmState.state === 'hypertonic';
      const isHypo = osmState.state === 'hypotonic';
      if (showConceptLabels && (isHyper || isHypo)) {
        osmosisArrowLeft.visible = true;
        osmosisArrowRight.visible = true;
        if (isHyper) {
          osmosisArrowLeft.position.set(-1.1, 1.35, 0.2);
          osmosisArrowLeft.setDirection(new THREE.Vector3(-1, 0, 0));
          osmosisArrowLeft.setColor(0xf97316);
          osmosisArrowRight.position.set(1.1, 1.35, 0.2);
          osmosisArrowRight.setDirection(new THREE.Vector3(1, 0, 0));
          osmosisArrowRight.setColor(0xf97316);
        } else {
          osmosisArrowLeft.position.set(-2.0, 1.35, 0.2);
          osmosisArrowLeft.setDirection(new THREE.Vector3(1, 0, 0));
          osmosisArrowLeft.setColor(0x38bdf8);
          osmosisArrowRight.position.set(2.0, 1.35, 0.2);
          osmosisArrowRight.setDirection(new THREE.Vector3(-1, 0, 0));
          osmosisArrowRight.setColor(0x38bdf8);
        }
      } else {
        osmosisArrowLeft.visible = false;
        osmosisArrowRight.visible = false;
      }

      if (!showConceptLabels) return {};
      protoplastMesh.getWorldPosition(worldPosA);
      return {
        c2: {
          pos: worldPosA.clone().add(new THREE.Vector3(0, 1.08, 0)),
          text: isHyper
            ? 'Osmosis: H₂O Keluar (Plasmolisis)'
            : isHypo
            ? 'Osmosis: H₂O Masuk (Sel Turgid)'
            : 'Isotonik: Fluks H₂O Seimbang',
        },
      };
    },
    dispose: () => {
      disposableItems.forEach((d) => d.dispose());
    },
  };
}
