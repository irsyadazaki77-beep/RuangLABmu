import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createBrushedMetalTextures,
  createLabBenchTextures,
  createStudioComposer,
} from '../utils/threeStudioKit';
import { Maximize2, Minimize2, Focus } from 'lucide-react';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { labSound } from '../utils/soundEngine';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { AnatomySubScene3D, AnatomyModuleId } from './scenes/AnatomySubScene3D';

interface BiologyScene3DProps {
  mode:
    | 'photosynthesis-ingenhousz'
    | 'enzyme-catalase'
    | 'enzyme-kinetics'
    | 'osmosis-plasmolysis'
    | 'cell-osmosis-tonicity'
    | 'predator-prey-dynamics'
    | AnatomyModuleId;
  params: Record<string, number>;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  isPlaying?: boolean;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
  comfortTheme?: ComfortThemeMode;
}

type BioCameraPreset = 'isometric' | 'front' | 'top' | 'focus';

function wavelengthToHexColor(wavelengthNm: number): number {
  if (wavelengthNm < 440) return 0x7c3aed; // Violet
  if (wavelengthNm < 490) return 0x2563eb; // Blue
  if (wavelengthNm < 560) return 0x16a34a; // Green
  if (wavelengthNm < 600) return 0xeab308; // Yellow
  if (wavelengthNm < 640) return 0xf97316; // Orange
  return 0xdc2626; // Red
}

function createOrganelleTexture(type: 'nucleus' | 'mitochondria' | 'chloroplast'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (type === 'nucleus') {
      const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 128);
      grad.addColorStop(0, '#c084fc');
      grad.addColorStop(0.55, '#7e22ce');
      grad.addColorStop(1, '#3b0764');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      // Chromatin fine network lines
      ctx.strokeStyle = 'rgba(243, 232, 255, 0.55)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        ctx.arc(
          40 + ((i * 53) % 176),
          40 + ((i * 71) % 176),
          14 + (i % 12),
          0,
          Math.PI * 1.4
        );
        ctx.stroke();
      }
    } else if (type === 'mitochondria') {
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, 256, 256);
      // Cristae folded inner membrane stripes
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 6;
      for (let y = 16; y < 240; y += 22) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.bezierCurveTo(90, y - 12, 166, y + 12, 236, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, 0, 256, 256);
      // Grana / Thylakoid stacks
      ctx.fillStyle = '#4ade80';
      for (let i = 0; i < 18; i++) {
        const gx = 32 + ((i * 61) % 192);
        const gy = 32 + ((i * 83) % 192);
        ctx.beginPath();
        ctx.arc(gx, gy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const BiologyScene3D: React.FC<BiologyScene3DProps> = ({
  mode,
  params,
  remoteCursors = {},
  onEmitCursor,
  onCaptureSnapshot,
  snapshotCount = 0,
  comfortTheme,
}) => {
  const storeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const activeComfortTheme = comfortTheme ?? storeComfortTheme;
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Biologi');

  const mountRef = useRef<HTMLDivElement>(null);
  const cursorManagerRef = useRef<SpatialCursorManager | null>(null);
  const onEmitCursorRef = useRef(onEmitCursor);
  onEmitCursorRef.current = onEmitCursor;
  const onCaptureSnapshotRef = useRef(onCaptureSnapshot);
  onCaptureSnapshotRef.current = onCaptureSnapshot;
  const latestParamsRef = useRef(params);
  latestParamsRef.current = params;

  const [activePreset, setActivePreset] = useState<BioCameraPreset>('isometric');
  const [clickedBadge, setClickedBadge] = useState<string | null>(null);
  const [lensFocus, setLensFocus] = useState<number>(75); // 0 to 100 (optimal crispness near 75-100)
  const lensFocusRef = useRef<number>(75);
  lensFocusRef.current = lensFocus;

  const cameraCtrlRef = useRef<{
    setPreset: (preset: BioCameraPreset) => void;
    setOrbit: (orbit: boolean) => void;
    captureCanvas: () => string | null;
    applyTheme: (colors: ReturnType<typeof getSceneThemeColors>) => void;
  } | null>(null);

  useEffect(() => {
    cameraCtrlRef.current?.applyTheme(getSceneThemeColors(activeComfortTheme, 'Biologi'));
  }, [activeComfortTheme]);

  useEffect(() => {
    const handleGlobalSnapshot = () => {
      if (onCaptureSnapshotRef.current && cameraCtrlRef.current) {
        const url = cameraCtrlRef.current.captureCanvas();
        if (url) onCaptureSnapshotRef.current(url);
      }
    };
    return subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, handleGlobalSnapshot);
  }, []);

  const isAnatomyMode =
    mode === 'anatomy-cardiovascular-heart' ||
    mode === 'anatomy-respiratory-lungs' ||
    mode === 'anatomy-neural-synapse';

  useEffect(() => {
    if (isAnatomyMode) return;
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let animationFrameId = 0;
    let timeoutId = 0;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // Three.js Scene, Camera, Renderer
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Biologi');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialColors.backgroundHex);
    scene.fog = new THREE.FogExp2(initialColors.fogHex, 0.02);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.8, 3.8, 7.2);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    // Post-Processing Pipeline: Hardware MSAA RenderTarget + RenderPass + Subtle Bloom + ACES OutputPass
    const studioComposer = createStudioComposer(
      renderer,
      scene,
      camera,
      width,
      height,
      isSoftwareGl,
      { strength: 0.25, radius: 0.36, threshold: 0.88 }
    );
    const { composer } = studioComposer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 1.4;
    controls.target.set(0, 1.3, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2.0;
    controls.maxDistance = 20;

    let camTransitionActive = false;
    const baseCamPos = new THREE.Vector3(2.8, 3.8, 7.2);
    const desiredCamPos = new THREE.Vector3(2.8, 3.8, 7.2);
    const desiredTarget = new THREE.Vector3(0, 1.3, 0);

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    const applyCameraPreset = (preset: BioCameraPreset) => {
      if (preset === 'isometric') {
        baseCamPos.set(2.8, 3.8, 7.2);
        desiredTarget.set(0, 1.3, 0);
      } else if (preset === 'front') {
        baseCamPos.set(0, 2.0, 7.8);
        desiredTarget.set(0, 1.4, 0);
      } else if (preset === 'top') {
        baseCamPos.set(0, 10.5, 0.5);
        desiredTarget.set(0, 0, 0);
      } else {
        baseCamPos.set(1.2, 2.1, 4.2);
        desiredTarget.set(0, 1.3, 0);
      }
      desiredCamPos.copy(baseCamPos);
      camTransitionActive = true;
    };

    // Collaboration Cursor Group
    const cursorManager = new SpatialCursorManager(scene);
    cursorManagerRef.current = cursorManager;

    // Studio Lights with Soft Contact Shadows (2048x2048, bias -0.0001)
    const hemiLight = new THREE.HemisphereLight(
      initialColors.ambientSkyHex,
      initialColors.ambientGroundHex,
      initialColors.ambientIntensity
    );
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
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

    // =========================================================
    // STAGE CONDENSER SPOTLIGHT FROM BELOW GLASS SLIDE (TAHAP 5)
    // =========================================================
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
    stageCondenserLight.shadow.mapSize.width = 2048;
    stageCondenserLight.shadow.mapSize.height = 2048;
    stageCondenserLight.shadow.bias = -0.0001;
    scene.add(stageCondenserLight);

    // Laboratory Table Surface with Phenolic PBR Texture & Optical Condenser Collar
    const bioBenchTex = createLabBenchTextures(initialColors.tableHex, 3, 3);
    const bioMetalTex = createBrushedMetalTextures();
    const tableGeo = new THREE.RingGeometry(0.95, 5.2, 48);
    tableGeo.rotateX(-Math.PI / 2);
    const tableMat = new THREE.MeshStandardMaterial({
      color: initialColors.tableHex,
      map: bioBenchTex?.map ?? null,
      roughnessMap: bioBenchTex?.roughnessMap ?? null,
      bumpMap: bioBenchTex?.bumpMap ?? null,
      bumpScale: 0.008,
      roughness: 0.52,
      metalness: 0.08,
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
        envMapIntensity: 1.25,
      })
    );
    condenserBezel.rotation.x = Math.PI / 2;
    condenserBezel.position.y = 0.015;
    scene.add(condenserBezel);

    // Optical Condenser Lens Ring embedded in stage center
    const condenserLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.75, 0.16, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        roughness: 0.05,
        transmission: 0.94,
        thickness: 0.6,
        ior: 1.52,
        transparent: true,
        opacity: 1,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
      })
    );
    condenserLens.position.set(0, -0.04, 0);
    condenserLens.name = 'Lensa Kondensor Bawah Mikroskop';
    scene.add(condenserLens);

    // Translucent Glass Microscope Slide (Kaca Preparat) above condenser
    const slideGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      transmission: 0.96,
      thickness: 0.4,
      ior: 1.52,
      transparent: true,
      opacity: 1,
      reflectivity: 0.5,
    });
    const microscopeSlide = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.06, 1.8),
      slideGlassMat
    );
    microscopeSlide.position.set(0, 0.04, 0);
    microscopeSlide.name = 'Kaca Preparat Mikroskop Optik';
    scene.add(microscopeSlide);

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => {
        composer.render();
        return renderer.domElement.toDataURL('image/png');
      },
      applyTheme: (colors) => {
        scene.background = new THREE.Color(colors.backgroundHex);
        scene.fog = new THREE.FogExp2(colors.fogHex, 0.02);
        tableMat.color.setHex(colors.tableHex);
        hemiLight.color.setHex(colors.ambientSkyHex);
        hemiLight.groundColor.setHex(colors.ambientGroundHex);
        hemiLight.intensity = colors.ambientIntensity;
      },
    };

    // Grid Floor
    const grid = new THREE.GridHelper(9, 18, 0x38bdf8, 0x334155);
    grid.position.y = 0.01;
    scene.add(grid);

    // Container for dynamic apparatus meshes
    const apparatusGroup = new THREE.Group();
    scene.add(apparatusGroup);

    // Organelle textures & materials for interactive lens focus sharpness (Tahap 5)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const nucleusTex = createOrganelleTexture('nucleus');
    const mitoTex = createOrganelleTexture('mitochondria');
    const chloroTex = createOrganelleTexture('chloroplast');
    [nucleusTex, mitoTex, chloroTex].forEach((t) => {
      t.anisotropy = maxAniso;
    });

    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: nucleusTex,
      roughness: 0.25,
      emissive: 0xa855f7,
      emissiveMap: nucleusTex,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.95,
    });
    const mitoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: mitoTex,
      roughness: 0.3,
      emissive: 0xf97316,
      emissiveMap: mitoTex,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.95,
    });
    const chloroMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: chloroTex,
      roughness: 0.25,
      emissive: 0x22c55e,
      emissiveMap: chloroTex,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.95,
    });
    const organelleMaterials = [nucleusMat, mitoMat, chloroMat];

    // Helper to build 3D internal cellular organelles (Nucleus, Mitochondria, Chloroplasts)
    const createCellularOrganellesGroup = (scale = 1.0): THREE.Group => {
      const orgGroup = new THREE.Group();
      orgGroup.scale.setScalar(scale);

      // 1. Inti Sel (Nucleus)
      const nucleusMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 28, 28),
        nucleusMat
      );
      nucleusMesh.position.set(0, 0.05, 0);
      nucleusMesh.castShadow = true;
      nucleusMesh.name = '🧬 Inti Sel (Nukleus & Kromatin)';
      orgGroup.add(nucleusMesh);

      // 2. Mitokondria (3 capsule-like organelles)
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

      // 3. Kloroplas (6 discoid plastids with thylakoid stacks)
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

    // Particle arrays
    const particles: THREE.Mesh[] = [];
    let lightSpot: THREE.SpotLight | null = null;
    let foamMesh: THREE.Mesh | null = null;
    let protoplastMesh: THREE.Mesh | null = null;
    let cellOrganellesGroup: THREE.Group | null = null;

    // SETUP MODE 1: INGENHOUSZ PHOTOSYNTHESIS
    if (mode === 'photosynthesis-ingenhousz') {
      const beakerGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 32, 1, true);
      const beakerGlassMat = slideGlassMat;
      const beaker = new THREE.Mesh(beakerGeo, beakerGlassMat);
      beaker.position.y = 1.6;
      beaker.castShadow = true;
      beaker.name = 'Gelas Beker Kaca 1000 mL';
      apparatusGroup.add(beaker);

      const waterGeo = new THREE.CylinderGeometry(1.48, 1.48, 2.8, 32);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.38,
        roughness: 0.2,
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.y = 1.4;
      water.name = 'Larutan Air & NaHCO₃';
      apparatusGroup.add(water);

      const funnelConeGeo = new THREE.ConeGeometry(1.1, 1.2, 24, 1, true);
      const funnel = new THREE.Mesh(funnelConeGeo, slideGlassMat);
      funnel.position.y = 0.7;
      funnel.rotation.x = Math.PI;
      funnel.name = '🎯 Corong Kaca & Tabung O₂';
      apparatusGroup.add(funnel);

      const tubeGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.8, 16);
      const tube = new THREE.Mesh(tubeGeo, slideGlassMat);
      tube.position.y = 2.0;
      tube.name = '🎯 Tabung Reaksi Penampung Gas O₂';
      apparatusGroup.add(tube);

      const gasPocketGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16);
      const gasPocketMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
      });
      const gasPocket = new THREE.Mesh(gasPocketGeo, gasPocketMat);
      gasPocket.position.y = 2.7;
      gasPocket.name = 'Ruang Gas O₂ Murni';
      apparatusGroup.add(gasPocket);

      const plantGroup = new THREE.Group();
      plantGroup.position.set(0, 0.2, 0);
      plantGroup.name = '🌱 Tanaman Hydrilla verticillata';

      const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const stem1 = new THREE.Mesh(stemGeo, stemMat);
      stem1.position.set(0, 0.5, 0);
      plantGroup.add(stem1);

      const leafGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
      for (let i = 0; i < 5; i++) {
        const y = 0.2 + i * 0.18;
        for (let j = 0; j < 4; j++) {
          const angle = (j * Math.PI) / 2 + (i * Math.PI) / 4;
          const leaf = new THREE.Mesh(leafGeo, chloroMat);
          leaf.position.set(Math.cos(angle) * 0.12, y, Math.sin(angle) * 0.12);
          leaf.rotation.z = Math.cos(angle) * 0.7;
          leaf.rotation.x = -Math.sin(angle) * 0.7;
          leaf.name = '🌿 Daun Hydrilla & Kloroplas Fotosistem II';
          plantGroup.add(leaf);
        }
      }
      apparatusGroup.add(plantGroup);

      // Sub-cellular organelle magnification holo-inset next to beaker
      cellOrganellesGroup = createCellularOrganellesGroup(0.55);
      cellOrganellesGroup.position.set(2.2, 1.3, 0);
      apparatusGroup.add(cellOrganellesGroup);

      const lampGeo = new THREE.CylinderGeometry(0.3, 0.45, 0.5, 16);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(-3.2, 2.5, 0);
      lamp.rotation.z = -Math.PI / 3;
      lamp.name = '💡 Lampu Spektrum Variabel';
      apparatusGroup.add(lamp);

      const lightColor = wavelengthToHexColor(latestParamsRef.current.wavelengthNm || 660);
      lightSpot = new THREE.SpotLight(
        lightColor,
        (latestParamsRef.current.lightIntensityLux || 1200) / 300,
        10,
        Math.PI / 4,
        0.5
      );
      lightSpot.position.set(-3.2, 2.5, 0);
      lightSpot.target = plantGroup;
      scene.add(lightSpot);

      const bubbleGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const bubbleMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1,
      });

      for (let i = 0; i < 35; i++) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat);
        b.position.set(
          (Math.random() - 0.5) * 0.4,
          0.3 + Math.random() * 2.4,
          (Math.random() - 0.5) * 0.4
        );
        b.userData = { speed: 0.015 + Math.random() * 0.025, seed: Math.random() * 10 };
        apparatusGroup.add(b);
        particles.push(b);
      }
    }

    // SETUP MODE 2: CATALASE ENZYME
    else if (mode === 'enzyme-catalase' || mode === 'enzyme-kinetics') {
      const rackBase = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.15, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
      );
      rackBase.position.y = 0.08;
      rackBase.castShadow = true;
      rackBase.name = 'Rak Tabung Reaksi Kayu';
      apparatusGroup.add(rackBase);

      const tubeGeo = new THREE.CylinderGeometry(0.55, 0.55, 3.2, 24, 1, true);
      const tube = new THREE.Mesh(tubeGeo, slideGlassMat);
      tube.position.y = 1.7;
      tube.castShadow = true;
      tube.name = '🧪 Tabung Reaksi Reaksi Katalase';
      apparatusGroup.add(tube);

      const liquidGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.6, 24);
      const liquidMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.75,
      });
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = 0.4;
      liquid.name = 'Campuran Enzim & H₂O₂';
      apparatusGroup.add(liquid);

      const foamGeo = new THREE.CylinderGeometry(0.53, 0.53, 1.2, 24);
      const foamMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        transparent: true,
        opacity: 0.88,
      });
      foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.position.y = 1.3;
      foamMesh.name = '🎯 Kolom Busa O₂ Berbusa';
      apparatusGroup.add(foamMesh);

      cellOrganellesGroup = createCellularOrganellesGroup(0.6);
      cellOrganellesGroup.position.set(1.85, 1.35, 0);
      apparatusGroup.add(cellOrganellesGroup);

      const bubbleGeo = new THREE.SphereGeometry(0.06, 6, 6);
      const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.4 });
      for (let i = 0; i < 25; i++) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat);
        b.position.set(
          (Math.random() - 0.5) * 0.8,
          0.7 + Math.random() * 1.5,
          (Math.random() - 0.5) * 0.8
        );
        b.userData = { speed: 0.008 + Math.random() * 0.015, seed: Math.random() * 5 };
        apparatusGroup.add(b);
        particles.push(b);
      }
    }

    // SETUP MODE 3 & OTHERS: OSMOSIS, PLASMOLYSIS & MICROSCOPIC CELL ORGANELLES
    else {
      const petriGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.4, 32);
      const petri = new THREE.Mesh(petriGeo, slideGlassMat);
      petri.position.y = 0.25;
      petri.castShadow = true;
      petri.name = 'Cawan Petri & Kaca Preparat Sukrosa';
      apparatusGroup.add(petri);

      // Rigid Plant Cell Wall (Outer Frame)
      const wallFrameGeo = new THREE.BoxGeometry(2.3, 1.65, 1.45);
      const wallFrameMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x15803d,
        emissiveIntensity: 0.4,
        wireframe: true,
      });
      const cellWall = new THREE.Mesh(wallFrameGeo, wallFrameMat);
      cellWall.position.y = 1.35;
      cellWall.name = '🧱 Dinding Selulosa Kaku';
      apparatusGroup.add(cellWall);

      // Inner Plasma Membrane & Protoplast (Translucent so Condenser Light & Organelles shine through)
      const protoGeo = new THREE.BoxGeometry(2.1, 1.5, 1.3);
      const protoMat = new THREE.MeshPhysicalMaterial({
        color: 0x86efac,
        transparent: true,
        opacity: 0.42,
        roughness: 0.15,
        transmission: 0.72,
        thickness: 0.5,
      });
      protoplastMesh = new THREE.Mesh(protoGeo, protoMat);
      protoplastMesh.position.y = 1.35;
      protoplastMesh.name = '🎯 Protoplas & Membran Sel Tumbuhan';
      apparatusGroup.add(protoplastMesh);

      // 3D Organelles inside the Plant Cell (Nucleus, Mitochondria, Chloroplasts)
      cellOrganellesGroup = createCellularOrganellesGroup(0.95);
      protoplastMesh.add(cellOrganellesGroup);

      // Solute particles (Amber dots) and Water molecules (Blue dots)
      const dotGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
      });
      const soluteMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.5,
      });

      for (let i = 0; i < 40; i++) {
        const isSolute = i % 3 === 0;
        const dot = new THREE.Mesh(dotGeo, isSolute ? soluteMat : waterMat);
        dot.position.set(
          (Math.random() - 0.5) * 3.8,
          0.3 + Math.random() * 1.8,
          (Math.random() - 0.5) * 3.8
        );
        dot.userData = {
          speedX: (Math.random() - 0.5) * 0.015,
          speedZ: (Math.random() - 0.5) * 0.015,
        };
        apparatusGroup.add(dot);
        particles.push(dot);
      }
    }

    // Raycaster for Pointermove & Laser pointer broadcast
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let hoveredMesh: THREE.Mesh | null = null;
    const origEmissive = new THREE.Color();

    const handlePointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(apparatusGroup.children, true);

      let targetPos: [number, number, number] | null = null;
      let targetNormal: [number, number, number] | undefined = undefined;
      let hoveredName: string | undefined = undefined;

      if (intersects.length > 0) {
        const hit = intersects[0];
        targetPos = [hit.point.x, hit.point.y, hit.point.z];
        if (hit.face) {
          targetNormal = [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z];
        }
        hoveredName = hit.object.name || 'Peralatan Biologi 3D';
        renderer.domElement.style.cursor = 'pointer';

        const hitMesh = hit.object as THREE.Mesh;
        if (hitMesh !== hoveredMesh) {
          if (hoveredMesh && (hoveredMesh.material as any)?.emissive) {
            (hoveredMesh.material as any).emissive.copy(origEmissive);
          }
          hoveredMesh = hitMesh;
          if ((hitMesh.material as any)?.emissive) {
            origEmissive.copy((hitMesh.material as any).emissive);
            (hitMesh.material as any).emissive.setHex(0x10b981);
          }
        }
      } else {
        renderer.domElement.style.cursor = 'default';
        if (hoveredMesh && (hoveredMesh.material as any)?.emissive) {
          (hoveredMesh.material as any).emissive.copy(origEmissive);
          hoveredMesh = null;
        }

        const hitPlane = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, hitPlane)) {
          targetPos = [hitPlane.x, hitPlane.y, hitPlane.z];
          targetNormal = [0, 1, 0];
          hoveredName = 'Meja Laboratorium';
        }
      }

      if (targetPos && onEmitCursorRef.current) {
        const now = performance.now();
        if (now - lastEmitTime >= 50) {
          onEmitCursorRef.current(targetPos, targetNormal, hoveredName);
          lastEmitTime = now;
        }
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(apparatusGroup.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const name = hit.object.name || 'Organel Sel Tumbuhan';
        setClickedBadge(name);
        labSound.playClick(680);
        setTimeout(() => setClickedBadge(null), 3500);
      }
    };

    let lastEmitTime = 0;
    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Animation Loop
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    let currentFocusSmooth = lensFocusRef.current;

    const afterDraw = (cb: () => void) => {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    };

    const animate = () => {
      if (disposed) return;

      const nowMs = performance.now();
      const delta = Math.min((nowMs - lastTimeMs) / 1000, 0.05);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const curParams = latestParamsRef.current;

      // Smoothly interpolate 3D Microscope Lens Focus (Tahap 5)
      currentFocusSmooth = THREE.MathUtils.damp(
        currentFocusSmooth,
        lensFocusRef.current,
        8,
        delta || 0.016
      );
      const focusNormalized = currentFocusSmooth / 100; // 0.0 (defocused/far) -> 1.0 (sharp optical focus)
      const sharpnessFactor = Math.max(0.2, Math.min(1.0, 0.25 + focusNormalized * 0.75));

      // Adjust organelle material sharpness, fluorescence intensity & stage condenser beam
      organelleMaterials.forEach((mat, idx) => {
        mat.roughness = 0.75 - sharpnessFactor * 0.55;
        mat.opacity = 0.45 + sharpnessFactor * 0.53;
        mat.emissiveIntensity = (0.3 + sharpnessFactor * 0.95) * (idx === 2 ? 1.1 : 0.9);
      });
      stageCondenserLight.intensity = 2.2 + sharpnessFactor * 3.6;

      // Coupled focal zoom on camera distance when user adjusts Microscope Focus slider
      const zoomFactor = 1.28 - focusNormalized * 0.46; // zooms in smoothly as focus increases
      desiredCamPos.copy(baseCamPos).multiplyScalar(zoomFactor);

      // Slow gentle rotation for viewing angle
      apparatusGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.25;

      // Update particle motions
      if (mode === 'photosynthesis-ingenhousz') {
        const bubbleSpeed = (curParams.lightIntensityLux || 1200) / 60000;
        particles.forEach((p) => {
          p.position.y += p.userData.speed + bubbleSpeed;
          p.position.x += Math.sin(elapsed * 3 + p.userData.seed) * 0.002;
          if (p.position.y > 2.8) {
            p.position.y = 0.4;
            p.position.x = (Math.random() - 0.5) * 0.2;
            p.position.z = (Math.random() - 0.5) * 0.2;
          }
        });

        if (lightSpot) {
          const hex = wavelengthToHexColor(curParams.wavelengthNm || 660);
          lightSpot.color.setHex(hex);
          lightSpot.intensity = (curParams.lightIntensityLux || 1200) / 300;
        }
      } else if ((mode === 'enzyme-catalase' || mode === 'enzyme-kinetics') && foamMesh) {
        const ph = curParams.solutionPH || 7.0;
        const phFactor = Math.max(0.1, 1.0 - Math.abs(ph - 7.0) * 0.15);
        const sub = (curParams.substrateConcMm || 10) / 25;
        const foamTarget = Math.min(2.0, 0.4 + sub * phFactor * 1.6);
        foamMesh.scale.y = foamTarget;
        foamMesh.position.y = 0.5 + (1.2 * foamTarget) / 2;

        particles.forEach((p) => {
          p.position.y += p.userData.speed;
          if (p.position.y > 2.6) p.position.y = 0.8;
        });
      } else if (protoplastMesh) {
        const sucrose = curParams.sucroseConcMolar ?? 0.3;
        const shrinkage = Math.max(0.55, 1.0 - sucrose * 0.45);
        protoplastMesh.scale.set(shrinkage, shrinkage, shrinkage);

        particles.forEach((p) => {
          p.position.x += p.userData.speedX;
          p.position.z += p.userData.speedZ;
          if (Math.abs(p.position.x) > 2.0) p.userData.speedX *= -1;
          if (Math.abs(p.position.z) > 2.0) p.userData.speedZ *= -1;
        });
      }

      if (camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamPos.x, 6, 0.016);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamPos.y, 6, 0.016);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamPos.z, 6, 0.016);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredTarget.x, 6, 0.016);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredTarget.y, 6, 0.016);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredTarget.z, 6, 0.016);
        if (camera.position.distanceToSquared(desiredCamPos) < 0.01) {
          camTransitionActive = false;
        }
      }

      controls.update();
      composer.render();

      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Handle Window & Container Resize
    let lastW = width;
    let lastH = height;
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth || 960;
      const h = container.clientHeight || window.innerHeight || 600;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      const pr = renderer.getPixelRatio();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      studioComposer.resize(w, h, pr);
      studioComposer.render();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();

      if (cursorManagerRef.current) {
        cursorManagerRef.current.dispose();
      }

      // Dispose Post-Processing & Organelle/Bench Textures
      studioComposer.dispose();
      bioBenchTex?.dispose();
      bioMetalTex?.dispose();
      nucleusTex.dispose();
      mitoTex.dispose();
      chloroTex.dispose();

      // Deep Three.js disposal
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m?.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      if (envTexture) envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [mode]);

  // Sync Remote Cursors
  useEffect(() => {
    if (cursorManagerRef.current) {
      cursorManagerRef.current.update(remoteCursors);
    }
  }, [remoteCursors]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleToggleFullscreen = () => {
    labSound.playClick();
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  if (isAnatomyMode) {
    return (
      <AnatomySubScene3D
        mode={mode as AnatomyModuleId}
        params={params}
        remoteCursors={remoteCursors}
        onEmitCursor={onEmitCursor}
        onCaptureSnapshot={onCaptureSnapshot}
        comfortTheme={comfortTheme}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${themeColors.containerBgClass} touch-none select-none transition-colors duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="biology-simulation-canvas"
        className="w-full h-full block cursor-crosshair touch-none"
      />

      {/* Unified Top-Right Camera & Fullscreen Pill */}
      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20">
        <div className="hidden md:flex items-center gap-0.5">
          {(
            [
              { id: 'isometric', label: 'Iso' },
              { id: 'front', label: 'Depan' },
              { id: 'top', label: 'Atas' },
              { id: 'focus', label: 'Fokus' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                labSound.playClick();
                setActivePreset(preset.id);
                cameraCtrlRef.current?.setPreset(preset.id);
              }}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                activePreset === preset.id
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />
        </div>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="hidden sm:inline">{isFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
        </button>
      </div>

      {/* Interactive 3D Microscope Lens Focus Control (Compact Top-Left Pill) */}
      <div className="pointer-events-auto absolute top-3 left-3 flex items-center gap-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 shadow-lg z-20">
        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
          <Focus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fokus Lensa</span>
        </div>
        <input
          type="range"
          aria-label="Fokus Lensa Mikroskop 3D"
          min={0}
          max={100}
          step={1}
          value={lensFocus}
          onChange={(e) => {
            const nextFocus = Number(e.target.value);
            setLensFocus(nextFocus);
            cameraCtrlRef.current?.setPreset(activePreset);
          }}
          className="w-20 sm:w-28 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
        />
        <span className="text-[11px] font-mono tabular-nums text-emerald-200 font-bold min-w-[32px] text-right">
          {lensFocus}%
        </span>
      </div>

      {/* Floating Organelle Focus Badge */}
      {clickedBadge && (
        <div className="absolute top-14 left-3 z-30 px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-medium shadow-lg flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{clickedBadge}</span>
        </div>
      )}
    </div>
  );
};
