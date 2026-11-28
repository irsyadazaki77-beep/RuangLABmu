import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  applyBorosilicateLiteMode,
  createBiologicalMembraneTexture,
  createBorosilicateGlassMaterial,
  createBrushedMetalTextures,
  createContactShadowPlane,
  createCuttingMatOverlayTexture,
  createLabBenchTextures,
  createLabFloorTileTextures,
} from '../../utils/threeStudioKit';
import {
  BiologyRigHandle,
  buildCatalaseRig,
  buildDnaPcrRig,
  buildMendelGeneticsRig,
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
  | 'predator-prey-dynamics'
  | 'mendel-genetics-dihybrid'
  | 'dna-pcr-electrophoresis';

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
  const isMicroCellMode = mode === 'osmosis-plasmolysis' || mode === 'cell-osmosis-tonicity';

  const hemiLight = new THREE.HemisphereLight(
    initialColors.ambientSkyHex,
    initialColors.ambientGroundHex,
    Math.min(0.75, initialColors.ambientIntensity ?? 0.65)
  );
  scene.add(hemiLight);

  const bioShadowSize = isSoftwareGl ? 512 : 1024;
  const dirLight = new THREE.DirectionalLight(0xfff5e4, 1.32);
  dirLight.position.set(5.5, 9.5, 5.2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = bioShadowSize;
  dirLight.shadow.mapSize.height = bioShadowSize;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 26;
  const shadowBound = 6.8;
  dirLight.shadow.camera.left = -shadowBound;
  dirLight.shadow.camera.right = shadowBound;
  dirLight.shadow.camera.top = shadowBound;
  dirLight.shadow.camera.bottom = -shadowBound;
  dirLight.shadow.bias = -0.00045;
  dirLight.shadow.normalBias = 0.02;
  dirLight.shadow.radius = 3.2;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.6);
  rimLight.position.set(-6, 5.8, -5.8);
  scene.add(rimLight);

  // Soft cool front-side studio fill + warm tabletop bounce to open shadows on borosilicate glassware and Hydrilla foliage
  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.34);
  fillLight.position.set(-4.5, 4.5, 6.5);
  scene.add(fillLight);

  const bounceLight = new THREE.DirectionalLight(0xfef3c7, 0.18);
  bounceLight.position.set(3.2, -3.0, 4.5);
  scene.add(bounceLight);

  // Stage condenser spotlight from below glass slide (non-shadow-casting to stay within 1-shadow-light budget)
  const condenserTarget = new THREE.Object3D();
  condenserTarget.position.set(0, 1.5, 0);
  scene.add(condenserTarget);

  const stageCondenserLight = new THREE.SpotLight(
    0x38bdf8,
    isMicroCellMode ? 3.6 : 1.1,
    12,
    Math.PI / 5,
    0.65,
    1.5
  );
  stageCondenserLight.position.set(0, -1.2, 0);
  stageCondenserLight.target = condenserTarget;
  stageCondenserLight.castShadow = false;
  scene.add(stageCondenserLight);

  // Grounded Studio Floor & Architectural Phenolic Biology Workbench
  const benchW = 11.8;
  const benchD = 7.4;
  const benchThick = 0.36;
  const bioFloorY = -2.85;

  const bioBenchTex = createLabBenchTextures(initialColors.tableHex ?? 0x6b7c90, 4, 3, {
    neutralAlbedo: true,
  });
  const bioMetalTex = createBrushedMetalTextures();
  const bioFloorTileTex = createLabFloorTileTextures(14, 14);
  const bioCuttingMatTex = createCuttingMatOverlayTexture();

  const floorGeo = new THREE.PlaneGeometry(52, 52);
  const floorMat = new THREE.MeshStandardMaterial({
    color: initialColors.floorHex ?? 0xc8d2df,
    map: bioFloorTileTex?.map ?? null,
    roughnessMap: bioFloorTileTex?.roughnessMap ?? null,
    bumpMap: bioFloorTileTex?.bumpMap ?? null,
    bumpScale: 0.012,
    roughness: 0.68,
    metalness: 0.06,
    envMapIntensity: 0.65,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = bioFloorY;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Subtle architectural biology studio back-wall & dado rail
  const bioWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialColors.backgroundHex ?? 0xdce4ee).lerp(
      new THREE.Color(initialColors.floorHex ?? 0xc8d2df),
      0.32
    ),
    roughness: 0.9,
    metalness: 0.02,
    envMapIntensity: 0.3,
  });
  const bioBackWall = new THREE.Mesh(new THREE.PlaneGeometry(50, 19), bioWallMat);
  bioBackWall.position.set(0, bioFloorY + 9.5, -13.2);
  bioBackWall.receiveShadow = true;
  scene.add(bioBackWall);

  const tableMat = new THREE.MeshStandardMaterial({
    color: initialColors.tableHex ?? 0x6b7c90,
    map: bioBenchTex?.map ?? null,
    roughnessMap: bioBenchTex?.roughnessMap ?? null,
    bumpMap: bioBenchTex?.bumpMap ?? null,
    bumpScale: 0.007,
    roughness: 0.44,
    metalness: 0.08,
    envMapIntensity: 0.8,
  });
  const tableMesh = new THREE.Mesh(
    new RoundedBoxGeometry(benchW, benchThick, benchD, 4, 0.045),
    tableMat
  );
  tableMesh.position.y = -benchThick / 2;
  tableMesh.castShadow = true;
  tableMesh.receiveShadow = true;
  tableMesh.name = 'Meja Laboratorium Biologi Fenolik';
  scene.add(tableMesh);

  // Recessed anti-static work mat inlay + calibrated metric markings on the benchtop
  const workMatColor = new THREE.Color(initialColors.tableHex ?? 0x6b7c90).multiplyScalar(0.86);
  const workMat = new THREE.MeshStandardMaterial({
    color: workMatColor,
    roughnessMap: bioBenchTex?.roughnessMap ?? null,
    roughness: 0.78,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const workMatMesh = new THREE.Mesh(new THREE.PlaneGeometry(benchW - 0.8, benchD - 0.88), workMat);
  workMatMesh.rotation.x = -Math.PI / 2;
  workMatMesh.position.y = 0.002;
  workMatMesh.receiveShadow = true;
  scene.add(workMatMesh);

  if (bioCuttingMatTex) {
    const bioMatScale = new THREE.Mesh(
      new THREE.PlaneGeometry(benchW - 0.8, benchD - 0.88),
      new THREE.MeshBasicMaterial({
        map: bioCuttingMatTex,
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    bioMatScale.rotation.x = -Math.PI / 2;
    bioMatScale.position.y = 0.004;
    scene.add(bioMatScale);
  }

  // Brushed aluminum perimeter trim rail + rear phenolic backsplash curb + structural legs & underframe
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xdce4ee,
    roughnessMap: bioMetalTex?.roughnessMap ?? null,
    bumpMap: bioMetalTex?.bumpMap ?? null,
    bumpScale: 0.004,
    metalness: 0.84,
    roughness: 0.22,
    envMapIntensity: 1.08,
  });
  const frontRail = new THREE.Mesh(new THREE.BoxGeometry(benchW + 0.06, 0.095, 0.055), railMat);
  frontRail.position.set(0, -0.06, benchD / 2 + 0.015);
  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, benchD + 0.06), railMat);
  leftRail.position.set(-benchW / 2 - 0.015, -0.06, 0);
  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, benchD + 0.06), railMat);
  rightRail.position.set(benchW / 2 + 0.015, -0.06, 0);
  scene.add(frontRail, leftRail, rightRail);

  const bioDadoMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialColors.backgroundHex ?? 0xdce4ee).lerp(
      new THREE.Color(initialColors.floorHex ?? 0xc8d2df),
      0.52
    ),
    roughness: 0.72,
    metalness: 0.12,
  });
  const bioDadoRail = new THREE.Mesh(new THREE.BoxGeometry(50, 0.09, 0.08), bioDadoMat);
  bioDadoRail.position.set(0, 0.56, -13.14);
  scene.add(bioDadoRail);

  const backsplashMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialColors.tableHex ?? 0x6b7c90).multiplyScalar(0.84),
    roughnessMap: bioBenchTex?.roughnessMap ?? null,
    roughness: 0.52,
    metalness: 0.12,
  });
  const backsplash = new THREE.Mesh(new RoundedBoxGeometry(benchW, 0.42, 0.16, 2, 0.02), backsplashMat);
  backsplash.position.set(0, 0.21, -benchD / 2 + 0.08);
  backsplash.receiveShadow = true;
  const backsplashCap = new THREE.Mesh(new THREE.BoxGeometry(benchW + 0.02, 0.048, 0.18), railMat);
  backsplashCap.position.set(0, 0.44, -benchD / 2 + 0.08);
  scene.add(backsplash, backsplashCap);

  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x2b3749,
    roughnessMap: bioMetalTex?.roughnessMap ?? null,
    metalness: 0.72,
    roughness: 0.34,
    envMapIntensity: 0.78,
  });
  const underframe = new THREE.Mesh(
    new RoundedBoxGeometry(benchW - 0.9, 0.28, benchD - 0.8, 2, 0.02),
    apronMat
  );
  underframe.position.set(0, -benchThick - 0.14, 0);
  scene.add(underframe);

  // Grounded tubular steel laboratory legs & rubber leveling feet resting on the tiled floor
  const bioLegH = Math.max(0.4, Math.abs(bioFloorY) - benchThick - 0.08);
  const bioLegGeo = new RoundedBoxGeometry(0.22, bioLegH, 0.22, 2, 0.025);
  const bioFootGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.08, 16);
  const bioFootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.86, metalness: 0.08 });
  const lxBio = benchW * 0.5 - 0.54;
  const lzBio = benchD * 0.5 - 0.54;
  [
    [-lxBio, -lzBio],
    [lxBio, -lzBio],
    [-lxBio, lzBio],
    [lxBio, lzBio],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(bioLegGeo, apronMat);
    leg.position.set(lx, bioFloorY + 0.08 + bioLegH * 0.5, lz);
    const foot = new THREE.Mesh(bioFootGeo, bioFootMat);
    foot.position.set(lx, bioFloorY + 0.04, lz);
    scene.add(leg, foot);
  });

  const benchFloorShadow = createContactShadowPlane(benchW * 0.62, benchD * 0.64, 0.36);
  benchFloorShadow.position.set(0, bioFloorY + 0.01, 0);
  scene.add(benchFloorShadow);

  // Recessed Optical Condenser Collar & Glass Preparat Slide (visible for cellular microscopy modes)
  const condenserBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.055, 14, 48),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughnessMap: bioMetalTex?.roughnessMap ?? null,
      metalness: 0.85,
      roughness: 0.24,
      envMapIntensity: 0.85,
    })
  );
  condenserBezel.rotation.x = Math.PI / 2;
  condenserBezel.position.y = 0.022;
  condenserBezel.visible = isMicroCellMode;
  scene.add(condenserBezel);

  const condenserLensMat = createBorosilicateGlassMaterial(initialLite, {
    color: 0xe0f2fe,
    tintOpacity: 0.38,
    ior: 1.47,
    thickness: 0.3,
    emissive: 0x0284c7,
    emissiveIntensity: 0.48,
  });
  const condenserLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 0.92, 0.026, 36),
    condenserLensMat
  );
  condenserLens.position.set(0, 0.015, 0);
  condenserLens.visible = isMicroCellMode;
  condenserLens.name = 'Lensa Kondensor Bawah Mikroskop';
  scene.add(condenserLens);

  const slideGlassMat = createBorosilicateGlassMaterial(initialLite, {
    color: 0xecfeff,
    tintOpacity: 0.28,
    ior: 1.47,
    thickness: 0.28,
  });
  const microscopeSlide = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.06, 1.8),
    slideGlassMat
  );
  microscopeSlide.position.set(0, 0.048, 0);
  microscopeSlide.visible = isMicroCellMode;
  microscopeSlide.name = 'Kaca Preparat Mikroskop Optik';
  scene.add(microscopeSlide);

  // Metallic stage spring clips securing the glass slide (microscopy modes only)
  const stageClipMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughnessMap: bioMetalTex?.roughnessMap ?? null,
    metalness: 0.86,
    roughness: 0.24,
  });
  [-1.62, 1.62].forEach((cx) => {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.18), stageClipMat);
    clip.position.set(cx, 0.092, -0.58);
    clip.rotation.y = cx < 0 ? 0.22 : -0.22;
    clip.visible = isMicroCellMode;
    scene.add(clip);
  });

  const bioGridDivisions = 18;
  const grid = new THREE.GridHelper(
    9.6,
    bioGridDivisions,
    initialColors.gridPrimaryHex ?? 0x9aa8ba,
    initialColors.gridSecondaryHex ?? 0xc7d0dc
  );
  grid.position.y = 0.005;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.24;
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

  const nucleusMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: nucleusTex,
    bumpMap: nucleusBump,
    bumpScale: 0.028,
    roughness: 0.24,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xe9d5ff),
    emissive: 0xa855f7,
    emissiveMap: nucleusTex,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.95,
  });
  const mitoMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: mitoTex,
    bumpMap: mitoBump,
    bumpScale: 0.032,
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xfef08a),
    emissive: 0xf97316,
    emissiveMap: mitoTex,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.95,
  });
  const chloroMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: chloroTex,
    bumpMap: chloroBump,
    bumpScale: 0.026,
    roughness: 0.22,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14,
    sheen: 0.45,
    sheenColor: new THREE.Color(0x86efac),
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
      : mode === 'mendel-genetics-dihybrid'
      ? buildMendelGeneticsRig(rigSharedCtx)
      : mode === 'dna-pcr-electrophoresis'
      ? buildDnaPcrRig(rigSharedCtx)
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
      scene.fog = new THREE.Fog(fogHex, 24, 58);
      const bgCol = new THREE.Color(bgHex);
      const isDarkScene = bgCol.r * 0.299 + bgCol.g * 0.587 + bgCol.b * 0.114 < 0.35;
      scene.environmentIntensity = isSoftwareGl
        ? isDarkScene
          ? 0.72
          : 0.88
        : isDarkScene
        ? 0.46
        : 0.56;
      const tHex = colors.tableHex ?? 0x6b7c90;
      tableMat.color.setHex(tHex);
      workMat.color.setHex(tHex).multiplyScalar(isDarkScene ? 0.84 : 0.86);
      backsplashMat.color.setHex(tHex).multiplyScalar(isDarkScene ? 0.78 : 0.82);
      floorMat.color.setHex(colors.floorHex ?? 0xc5d0dd);
      bioWallMat.color
        .setHex(bgHex)
        .lerp(new THREE.Color(colors.floorHex ?? 0xc5d0dd), 0.32);
      bioDadoMat.color
        .setHex(bgHex)
        .lerp(new THREE.Color(colors.floorHex ?? 0xc5d0dd), 0.52);
      applyBioGridColors(colors.gridPrimaryHex, colors.gridSecondaryHex);
      hemiLight.color.setHex(colors.ambientSkyHex);
      hemiLight.groundColor.setHex(colors.ambientGroundHex);
      hemiLight.intensity = Math.min(0.68, colors.ambientIntensity * 1.15);
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

      // Keep benchtop glassware firmly grounded; allow subtle inspection sway only on pure cellular osmosis mode
      const isMicroCellMode = mode === 'osmosis-plasmolysis' || mode === 'cell-osmosis-tonicity';
      apparatusGroup.rotation.y = isMicroCellMode ? Math.sin(simTime * 0.14) * 0.14 : 0;
      return activeRig.update(simTime, params, effectiveLite, showConceptLabels, particleScale);
    },
    dispose: () => {
      activeRig.dispose();
      bioBenchTex?.dispose();
      bioMetalTex?.dispose();
      bioFloorTileTex?.dispose();
      bioCuttingMatTex?.dispose();
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
