import * as THREE from 'three';
import {
  applyBorosilicateLiteMode,
  createBiologicalMembraneTexture,
  createBorosilicateGlassMaterial,
  createBrushedMetalTextures,
  createLabBenchTextures,
} from '../../utils/threeStudioKit';
import {
  BiologyRigHandle,
  buildCatalaseRig,
  buildOsmosisRig,
  buildPhotosynthesisRig,
  buildPredatorPreyRig,
} from './BiologyRigs';

export type CoreBiologyStageMode =
  | 'photosynthesis-ingenhousz'
  | 'enzyme-catalase'
  | 'enzyme-kinetics'
  | 'osmosis-plasmolysis'
  | 'cell-osmosis-tonicity'
  | 'predator-prey-dynamics';

function createOrganelleTexture(
  type: 'nucleus' | 'mitochondria' | 'chloroplast'
): ReturnType<typeof createBiologicalMembraneTexture> {
  if (type === 'nucleus') {
    return createBiologicalMembraneTexture('#7e22ce', '#e9d5ff');
  }
  if (type === 'mitochondria') {
    return createBiologicalMembraneTexture('#ea580c', '#fef08a');
  }
  return createBiologicalMembraneTexture('#15803d', '#4ade80');
}

export interface BiologyThemeColorsInput {
  ambientSkyHex: number;
  ambientGroundHex: number;
  ambientIntensity: number;
  tableHex?: number;
  floorHex?: number;
}

export interface BiologyCoreStageHandle {
  apparatusGroup: THREE.Group;
  applyTheme: (colors: BiologyThemeColorsInput) => void;
  update: (
    simTime: number,
    delta: number,
    params: Record<string, number>,
    effectiveLite: boolean,
    showConceptLabels: boolean,
    lensFocus: number,
    baseCamPos: THREE.Vector3,
    desiredCamPos: THREE.Vector3
  ) => ReturnType<BiologyRigHandle['update']>;
  dispose: () => void;
}

export function buildBiologyCoreStage(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  mode: CoreBiologyStageMode,
  initialColors: BiologyThemeColorsInput,
  initialLite: boolean,
  isSoftwareGl: boolean
): BiologyCoreStageHandle {
  const hemiLight = new THREE.HemisphereLight(
    initialColors.ambientSkyHex,
    initialColors.ambientGroundHex,
    0.45
  );
  scene.add(hemiLight);

  const bioShadowSize = isSoftwareGl ? 512 : 2048;
  const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
  dirLight.position.set(5, 8, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = bioShadowSize;
  dirLight.shadow.mapSize.height = bioShadowSize;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 25;
  const shadowBound = 6;
  dirLight.shadow.camera.left = -shadowBound;
  dirLight.shadow.camera.right = shadowBound;
  dirLight.shadow.camera.top = shadowBound;
  dirLight.shadow.camera.bottom = -shadowBound;
  dirLight.shadow.bias = -0.0001;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  // Stage condenser spotlight from below glass slide
  const condenserTarget = new THREE.Object3D();
  condenserTarget.position.set(0, 1.5, 0);
  scene.add(condenserTarget);

  const stageCondenserLight = new THREE.SpotLight(
    0x38bdf8,
    4.2,
    12,
    Math.PI / 5,
    0.65,
    1.5
  );
  stageCondenserLight.position.set(0, -1.2, 0);
  stageCondenserLight.target = condenserTarget;
  stageCondenserLight.castShadow = true;
  stageCondenserLight.shadow.mapSize.width = bioShadowSize;
  stageCondenserLight.shadow.mapSize.height = bioShadowSize;
  stageCondenserLight.shadow.bias = -0.0001;
  scene.add(stageCondenserLight);

  // Laboratory Floor & Table Surface with Phenolic PBR Texture & Optical Condenser Collar
  const floorGeo = new THREE.PlaneGeometry(36, 36);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.08,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.08;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const bioBenchTex = createLabBenchTextures(0x1e293b, 3, 3);
  const bioMetalTex = createBrushedMetalTextures();
  const tableGeo = new THREE.RingGeometry(0.95, 5.2, 48);
  tableGeo.rotateX(-Math.PI / 2);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    map: bioBenchTex?.map ?? null,
    roughnessMap: bioBenchTex?.roughnessMap ?? null,
    bumpMap: bioBenchTex?.bumpMap ?? null,
    bumpScale: 0.008,
    roughness: 0.65,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.y = 0.0;
  tableMesh.receiveShadow = true;
  tableMesh.name = 'Meja Mikroskop & Laboratorium Biologi';
  scene.add(tableMesh);

  const condenserBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.055, 14, 48),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughnessMap: bioMetalTex?.roughnessMap ?? null,
      metalness: 0.85,
      roughness: 0.24,
      envMapIntensity: 0.45,
    })
  );
  condenserBezel.rotation.x = Math.PI / 2;
  condenserBezel.position.y = 0.015;
  scene.add(condenserBezel);

  const condenserLensMat = createBorosilicateGlassMaterial(initialLite, {
    color: 0xe0f2fe,
    tintOpacity: 0.34,
    ior: 1.47,
    thickness: 0.3,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
  });
  const condenserLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.75, 0.16, 32),
    condenserLensMat
  );
  condenserLens.position.set(0, -0.04, 0);
  condenserLens.name = 'Lensa Kondensor Bawah Mikroskop';
  scene.add(condenserLens);

  const slideGlassMat = createBorosilicateGlassMaterial(initialLite, {
    color: 0xecfeff,
    tintOpacity: 0.3,
    ior: 1.47,
    thickness: 0.28,
  });
  const microscopeSlide = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.06, 1.8),
    slideGlassMat
  );
  microscopeSlide.position.set(0, 0.04, 0);
  microscopeSlide.name = 'Kaca Preparat Mikroskop Optik';
  scene.add(microscopeSlide);

  const grid = new THREE.GridHelper(9, 18, 0x334155, 0x1e293b);
  grid.position.y = 0.01;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const apparatusGroup = new THREE.Group();
  scene.add(apparatusGroup);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const nucleusTex = createOrganelleTexture('nucleus');
  const mitoTex = createOrganelleTexture('mitochondria');
  const chloroTex = createOrganelleTexture('chloroplast');
  const protoMembraneTex = createBiologicalMembraneTexture('#16a34a', '#bbf7d0');
  [nucleusTex, mitoTex, chloroTex, protoMembraneTex].forEach((t) => {
    if (t) t.anisotropy = maxAniso;
  });

  const nucleusBump = nucleusTex?.bumpMap ?? null;
  const mitoBump = mitoTex?.bumpMap ?? null;
  const chloroBump = chloroTex?.bumpMap ?? null;
  const protoBump = protoMembraneTex?.bumpMap ?? null;

  const nucleusMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: nucleusTex,
    bumpMap: nucleusBump,
    bumpScale: 0.025,
    roughness: 0.28,
    emissive: 0xa855f7,
    emissiveMap: nucleusTex,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.95,
  });
  const mitoMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: mitoTex,
    bumpMap: mitoBump,
    bumpScale: 0.028,
    roughness: 0.32,
    emissive: 0xf97316,
    emissiveMap: mitoTex,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.95,
  });
  const chloroMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: chloroTex,
    bumpMap: chloroBump,
    bumpScale: 0.024,
    roughness: 0.26,
    emissive: 0x22c55e,
    emissiveMap: chloroTex,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.95,
  });
  const organelleMaterials = [nucleusMat, mitoMat, chloroMat];

  const createCellularOrganellesGroup = (scale = 1.0): THREE.Group => {
    const orgGroup = new THREE.Group();
    orgGroup.scale.setScalar(scale);

    const nucleusMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 28, 28),
      nucleusMat
    );
    nucleusMesh.position.set(0, 0.05, 0);
    nucleusMesh.castShadow = true;
    nucleusMesh.name = '🧬 Inti Sel (Nukleus & Kromatin)';
    orgGroup.add(nucleusMesh);

    const mitoGeo = new THREE.CapsuleGeometry(0.11, 0.22, 12, 20);
    const mitoCoords: [number, number, number, number][] = [
      [-0.55, 0.15, 0.28, 0.5],
      [0.52, -0.18, 0.25, -0.4],
      [0.35, 0.28, -0.32, 0.8],
    ];
    mitoCoords.forEach(([mx, my, mz, rotZ], idx) => {
      const mMesh = new THREE.Mesh(mitoGeo, mitoMat);
      mMesh.position.set(mx, my, mz);
      mMesh.rotation.set(0.3, idx * 0.8, rotZ);
      mMesh.castShadow = true;
      mMesh.name = `⚡ Mitokondria #${idx + 1} (Respirasi Seluler ATP)`;
      orgGroup.add(mMesh);
    });

    const chloroGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.07, 20);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cMesh = new THREE.Mesh(chloroGeo, chloroMat);
      cMesh.position.set(
        Math.cos(angle) * 0.72,
        (i % 2 === 0 ? 1 : -1) * 0.24,
        Math.sin(angle) * 0.42
      );
      cMesh.rotation.set(0.4, angle, 0.25);
      cMesh.castShadow = true;
      cMesh.name = `🌿 Kloroplas & Tilakoid #${i + 1}`;
      orgGroup.add(cMesh);
    }

    return orgGroup;
  };

  const rigSharedCtx = {
    apparatusGroup,
    scene,
    slideGlassMat,
    chloroMat,
    protoMembraneTex,
    protoBump,
    createCellularOrganellesGroup,
    isLiteInitial: initialLite,
  };
  const activeRig: BiologyRigHandle =
    mode === 'photosynthesis-ingenhousz'
      ? buildPhotosynthesisRig(rigSharedCtx)
      : mode === 'enzyme-catalase' || mode === 'enzyme-kinetics'
      ? buildCatalaseRig(rigSharedCtx)
      : mode === 'predator-prey-dynamics'
      ? buildPredatorPreyRig(rigSharedCtx)
      : buildOsmosisRig(rigSharedCtx);

  let currentFocusSmooth = 75;

  return {
    apparatusGroup,
    applyTheme: (colors) => {
      scene.background = new THREE.Color(0x0b0f17);
      scene.fog = new THREE.FogExp2(0x0b0f17, 0.02);
      tableMat.color.setHex(colors.tableHex ?? 0x1e293b);
      floorMat.color.setHex(colors.floorHex ?? 0x0f172a);
      hemiLight.color.setHex(colors.ambientSkyHex);
      hemiLight.groundColor.setHex(colors.ambientGroundHex);
      hemiLight.intensity = Math.min(0.45, colors.ambientIntensity);
    },
    update: (
      simTime,
      delta,
      params,
      effectiveLite,
      showConceptLabels,
      lensFocus,
      baseCamPos,
      desiredCamPos
    ) => {
      applyBorosilicateLiteMode(slideGlassMat, effectiveLite);
      applyBorosilicateLiteMode(condenserLensMat, effectiveLite);

      currentFocusSmooth = THREE.MathUtils.damp(
        currentFocusSmooth,
        lensFocus,
        8,
        delta || 0.016
      );
      const focusNormalized = currentFocusSmooth / 100;
      const sharpnessFactor = Math.max(0.2, Math.min(1.0, 0.25 + focusNormalized * 0.75));

      organelleMaterials.forEach((mat, idx) => {
        mat.roughness = 0.75 - sharpnessFactor * 0.55;
        mat.opacity = 0.45 + sharpnessFactor * 0.53;
        mat.emissiveIntensity = (0.3 + sharpnessFactor * 0.95) * (idx === 2 ? 1.1 : 0.9);
      });
      stageCondenserLight.intensity = 2.2 + sharpnessFactor * 3.6;

      const zoomFactor = 1.28 - focusNormalized * 0.46;
      desiredCamPos.copy(baseCamPos).multiplyScalar(zoomFactor);

      apparatusGroup.rotation.y = Math.sin(simTime * 0.15) * 0.25;
      return activeRig.update(simTime, params, effectiveLite, showConceptLabels);
    },
    dispose: () => {
      activeRig.dispose();
      bioBenchTex?.dispose();
      bioMetalTex?.dispose();
      nucleusTex?.dispose();
      nucleusBump?.dispose();
      mitoTex?.dispose();
      mitoBump?.dispose();
      chloroTex?.dispose();
      chloroBump?.dispose();
      protoMembraneTex?.dispose();
      protoBump?.dispose();
    },
  };
}
