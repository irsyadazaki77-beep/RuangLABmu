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
  backgroundHex?: number;
  fogHex?: number;
  ambientSkyHex: number;
  ambientGroundHex: number;
  ambientIntensity: number;
  tableHex?: number;
  floorHex?: number;
  gridPrimaryHex?: number;
  gridSecondaryHex?: number;
}

export interface BiologyCoreStageHandle {
  apparatusGroup: THREE.Group;
  keyLight: THREE.DirectionalLight;
  applyTheme: (colors: BiologyThemeColorsInput) => void;
  update: (
    simTime: number,
    delta: number,
    params: Record<string, number>,
    effectiveLite: boolean,
    showConceptLabels: boolean,
    lensFocus: number,
    baseCamPos: THREE.Vector3,
    desiredCamPos: THREE.Vector3,
    particleScale?: number
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
    Math.min(0.75, initialColors.ambientIntensity ?? 0.65)
  );
  scene.add(hemiLight);

  const bioShadowSize = isSoftwareGl ? 512 : 1024;
  const dirLight = new THREE.DirectionalLight(0xfffaf2, 1.15);
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
  dirLight.shadow.bias = -0.0004;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.45);
  rimLight.position.set(-6, 5, -5);
  scene.add(rimLight);

  // Stage condenser spotlight from below glass slide (non-shadow-casting to stay within 1-shadow-light budget)
  const condenserTarget = new THREE.Object3D();
  condenserTarget.position.set(0, 1.5, 0);
  scene.add(condenserTarget);

  const stageCondenserLight = new THREE.SpotLight(
    0x38bdf8,
    3.6,
    12,
    Math.PI / 5,
    0.65,
    1.5
  );
  stageCondenserLight.position.set(0, -1.2, 0);
  stageCondenserLight.target = condenserTarget;
  stageCondenserLight.castShadow = false;
  scene.add(stageCondenserLight);

  // Laboratory Floor & Table Surface with Phenolic PBR Texture & Optical Condenser Collar
  const floorGeo = new THREE.PlaneGeometry(36, 36);
  const floorMat = new THREE.MeshStandardMaterial({
    color: initialColors.floorHex ?? 0xd8e0ea,
    roughness: 0.85,
    metalness: 0.08,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.08;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const bioBenchTex = createLabBenchTextures(initialColors.tableHex ?? 0xc2ccd8, 3, 3, {
    neutralAlbedo: true,
  });
  const bioMetalTex = createBrushedMetalTextures();
  const tableGeo = new THREE.RingGeometry(0.95, 5.2, 48);
  tableGeo.rotateX(-Math.PI / 2);
  const tableMat = new THREE.MeshStandardMaterial({
    color: initialColors.tableHex ?? 0xc2ccd8,
    map: bioBenchTex?.map ?? null,
    roughnessMap: bioBenchTex?.roughnessMap ?? null,
    bumpMap: bioBenchTex?.bumpMap ?? null,
    bumpScale: 0.006,
    roughness: 0.62,
    metalness: 0.08,
    envMapIntensity: 0.55,
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

  const bioGridDivisions = 18;
  const grid = new THREE.GridHelper(
    9,
    bioGridDivisions,
    initialColors.gridPrimaryHex ?? 0x9aa8ba,
    initialColors.gridSecondaryHex ?? 0xc7d0dc
  );
  grid.position.y = 0.01;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const applyBioGridColors = (primaryHex?: number, secondaryHex?: number) => {
    const colorAttr = grid.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colorAttr) return;
    const c1 = new THREE.Color(primaryHex ?? 0x9aa8ba);
    const c2 = new THREE.Color(secondaryHex ?? 0xc7d0dc);
    const halfVerts = colorAttr.count / 2;
    const centerLineStart = Math.floor(bioGridDivisions / 2) * 4;
    for (let i = 0; i < colorAttr.count; i++) {
      const isAxisLine =
        (i >= centerLineStart && i < centerLineStart + 4) ||
        (i >= halfVerts + centerLineStart && i < halfVerts + centerLineStart + 4);
      const col = isAxisLine ? c1 : c2;
      colorAttr.setXYZ(i, col.r, col.g, col.b);
    }
    colorAttr.needsUpdate = true;
  };

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
    keyLight: dirLight,
    applyTheme: (colors) => {
      const bgHex = colors.backgroundHex ?? 0xe6ecf3;
      const fogHex = colors.fogHex ?? bgHex;
      if (scene.background instanceof THREE.Color) {
        scene.background.setHex(bgHex);
      } else {
        scene.background = new THREE.Color(bgHex);
      }
      scene.fog = new THREE.FogExp2(fogHex, 0.02);
      const bgCol = new THREE.Color(bgHex);
      const isDarkScene = bgCol.r * 0.299 + bgCol.g * 0.587 + bgCol.b * 0.114 < 0.35;
      scene.environmentIntensity = isDarkScene ? 0.46 : 0.6;
      tableMat.color.setHex(colors.tableHex ?? 0xc2ccd8);
      floorMat.color.setHex(colors.floorHex ?? 0xd8e0ea);
      applyBioGridColors(colors.gridPrimaryHex, colors.gridSecondaryHex);
      hemiLight.color.setHex(colors.ambientSkyHex);
      hemiLight.groundColor.setHex(colors.ambientGroundHex);
      hemiLight.intensity = Math.min(0.78, colors.ambientIntensity);
    },
    update: (
      simTime,
      delta,
      params,
      effectiveLite,
      showConceptLabels,
      lensFocus,
      baseCamPos,
      desiredCamPos,
      particleScale
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
      stageCondenserLight.intensity = 2.0 + sharpnessFactor * 3.0;

      // Keep default lensFocus (75%) at exact 1.0x framing so studio3DCatalog poses stay accurate
      const zoomFactor = 1.0 + (0.75 - focusNormalized) * 0.44;
      desiredCamPos.copy(baseCamPos).multiplyScalar(zoomFactor);

      apparatusGroup.rotation.y = Math.sin(simTime * 0.15) * 0.25;
      return activeRig.update(simTime, params, effectiveLite, showConceptLabels, particleScale);
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
