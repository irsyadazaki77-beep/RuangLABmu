import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  buildLatheFromProfile,
  createBeakerProfilePoints,
  createBrushedMetalTextures,
  createBuretteClampAssembly,
  createErlenmeyerProfilePoints,
  createFunnelProfilePoints,
  createGraduatedScaleTexture,
  createStudioComposer,
  createStudioWorkbenchGroup,
  disposeThreeSceneResources,
  createAdaptiveFpsMonitor,
  configureRendererForLiteMode,
  smoothCameraTransition,
} from '../utils/threeStudioKit';
import {
  ChemistryParams,
  ChemistryMetrics,
  ThermoReactionPreset,
  RedoxCouplePreset,
} from '../utils/scienceEngine';
import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { Maximize2, Minimize2, Link2 } from 'lucide-react';
import { labSound } from '../utils/soundEngine';
import { globalMultiApparatusEngine } from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import {
  ConceptLabelDomRef,
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';

interface ChemistryScene3DProps {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  preset: ThermoReactionPreset;
  redoxPreset: RedoxCouplePreset;
  reactionProgress: number;
  isReacting: boolean;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onUpdateParam?: (paramKey: string, value: number) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
  comfortTheme?: ComfortThemeMode;
}

type CameraPreset = 'isometric' | 'front' | 'top' | 'closeup';

function createLiquidWobbleMaterial(initialHex: number, initialOpacity = 0.78): THREE.ShaderMaterial {
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

        // Apply procedural surface wobble & concave meniscus near top of cylinder (y > 0)
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

        // Subtle internal depth gradient + meniscus highlight
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

function createBubbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(28, 24, 2, 32, 32, 28);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.65)');
    grad.addColorStop(0.85, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const ChemistryScene3D: React.FC<ChemistryScene3DProps> = ({
  params,
  metrics,
  preset,
  redoxPreset,
  reactionProgress,
  isReacting,
  remoteCursors,
  onEmitCursor,
  onUpdateParam,
  onCaptureSnapshot,
  comfortTheme,
}) => {
  const storeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const showConceptLabels = useUIStore((s) => s.showConceptLabels);
  const showConceptLabelsRef = useRef(showConceptLabels);
  showConceptLabelsRef.current = showConceptLabels;

  const activeComfortTheme = comfortTheme ?? storeComfortTheme;
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Kimia');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const conceptDomRef = useRef<Record<string, ConceptLabelDomRef>>({});
  const bindConceptSlot = useCallback((id: string, dom: ConceptLabelDomRef | null) => {
    if (dom) conceptDomRef.current[id] = dom;
    else delete conceptDomRef.current[id];
  }, []);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);

  const latestRef = useRef({
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
    onCaptureSnapshot,
  });
  latestRef.current = {
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
    onCaptureSnapshot,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
    setOrbit: (orbit: boolean) => void;
    captureCanvas: () => string | null;
    applyTheme: (colors: ReturnType<typeof getSceneThemeColors>) => void;
  } | null>(null);

  useEffect(() => {
    cameraCtrlRef.current?.applyTheme(getSceneThemeColors(activeComfortTheme, 'Kimia'));
  }, [activeComfortTheme]);

  useEffect(() => {
    const handleGlobalSnapshot = () => {
      if (latestRef.current.onCaptureSnapshot && cameraCtrlRef.current) {
        const url = cameraCtrlRef.current.captureCanvas();
        if (url) latestRef.current.onCaptureSnapshot(url);
      }
    };
    return subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, handleGlobalSnapshot);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    const handleWebGLContextLost = (event: Event) => {
      event.preventDefault();
    };
    const handleWebGLContextRestored = () => {
      setSceneKey((prev) => prev + 1);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleWebGLContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleWebGLContextRestored, false);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const initialLite = useUIStore.getState().liteDeviceMode;
    configureRendererForLiteMode(renderer, initialLite);

    const fpsMonitor = createAdaptiveFpsMonitor(() => {
      if (!useUIStore.getState().liteDeviceMode) {
        useUIStore.getState().setLiteDeviceMode(true);
        useUIStore.getState().setLiteModeNotification(
          'Mode Hemat Daya diaktifkan otomatis agar simulasi tetap lancar di perangkatmu.'
        );
      }
    }, 25, 3000);

    const unsubLite = useUIStore.subscribe((state, prev) => {
      if (state.liteDeviceMode !== prev.liteDeviceMode) {
        configureRendererForLiteMode(renderer, state.liteDeviceMode);
        if (!state.liteDeviceMode) {
          fpsMonitor.resetMonitor();
        }
      }
    });

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

    const initialColors = getSceneThemeColors(activeComfortTheme, 'Kimia');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.015);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(4.2, 5.8, 10.5);

    // Post-Processing Pipeline: Hardware MSAA RenderTarget + RenderPass + Subtle Bloom + ACES OutputPass
    const studioComposer = createStudioComposer(
      renderer,
      scene,
      camera,
      width,
      height,
      isSoftwareGl,
      { strength: 0.14, radius: 0.25, threshold: 1.15 }
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 1.4;
    controls.target.set(0, 1.4, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3.5;
    controls.maxDistance = 30;

    let camTransitionActive = false;
    const desiredCamPos = new THREE.Vector3(4.2, 5.8, 10.5);
    const desiredTarget = new THREE.Vector3(0, 1.4, 0);

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    const applyCameraPreset = (presetName: CameraPreset) => {
      if (presetName === 'isometric') {
        desiredCamPos.set(4.2, 5.8, 10.5);
        desiredTarget.set(0, 1.4, 0);
      } else if (presetName === 'front') {
        desiredCamPos.set(0, 2.8, 11.2);
        desiredTarget.set(0, 1.5, 0);
      } else if (presetName === 'top') {
        desiredCamPos.set(0, 14.5, 0.5);
        desiredTarget.set(0, 0, 0);
      } else {
        desiredCamPos.set(1.5, 2.5, 5.2);
        desiredTarget.set(0, 1.4, 0);
      }
      camTransitionActive = true;
    };

    // Lighting with Soft Contact Shadows (2048x2048, bias -0.0001)
    const hemiLight = new THREE.HemisphereLight(
      initialColors.ambientSkyHex,
      initialColors.ambientGroundHex,
      0.45
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
    keyLight.position.set(6, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 35;
    const shadowD = 8;
    keyLight.shadow.camera.left = -shadowD;
    keyLight.shadow.camera.right = shadowD;
    keyLight.shadow.camera.top = shadowD;
    keyLight.shadow.camera.bottom = -shadowD;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-7, 5, -6);
    scene.add(fillLight);

    // Studio Laboratory Bench & Brushed PBR Materials
    const workbench = createStudioWorkbenchGroup(initialColors, {
      width: 11.2,
      depth: 6.4,
      thickness: 0.3,
      benchY: 0.14,
      floorY: -0.02,
    });
    scene.add(workbench.group);

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => {
        const isLite = useUIStore.getState().liteDeviceMode;
        studioComposer.render(isLite);
        return renderer.domElement.toDataURL('image/png');
      },
      applyTheme: (colors) => {
        scene.background = new THREE.Color(0x0b0f17);
        scene.fog = new THREE.FogExp2(0x0b0f17, 0.015);
        workbench.updateTheme(colors);
        hemiLight.color.setHex(colors.ambientSkyHex);
        hemiLight.groundColor.setHex(colors.ambientGroundHex);
        hemiLight.intensity = Math.min(0.45, colors.ambientIntensity);
      },
    };

    // Shared PBR Materials & Refractive Borosilicate Glass Material
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
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.92,
      transparent: true,
      opacity: 0.30,
      ior: 1.48,
      thickness: 0.2,
      envMapIntensity: 0.35,
      reflectivity: 0.25,
      depthWrite: false,
    });
    const graduationOverlayMat = (tex: THREE.CanvasTexture | null) =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0.88,
      });

    const cursorManager = new SpatialCursorManager(scene);

    // Track dynamic liquid shader materials for wobble updates
    const liquidShaderMaterials: THREE.ShaderMaterial[] = [];
    let wobbleBoost = 0;
    let lastTitrantMl = latestRef.current.params.titrantAddedMl ?? 0;

    // =========================================================
    // 1. THERMO CALORIMETRY 3D GROUP
    // =========================================================
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

    // Concave Meniscus Ring inside Calorimeter Beaker
    const calMeniscusRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.31, 0.024, 12, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.62,
        roughness: 0.08,
        transmission: 0.5,
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

    // =========================================================
    // 2. ACID-BASE TITRATION 3D GROUP
    // =========================================================
    const titrationGroup = new THREE.Group();
    scene.add(titrationGroup);

    // Cast-iron Beveled Retort Base + Porcelain Tile Stage + Chrome Stand Rod
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

    // Articulated Twin Burette Clamps attaching Burette physically to Retort Rod
    titrationGroup.add(createBuretteClampAssembly(-2.2, 0, 5.2, brushedSteelMat, darkFrameMat));
    titrationGroup.add(createBuretteClampAssembly(-2.2, 0, 3.3, brushedSteelMat, darkFrameMat));

    // Burette Glass Tube + Graduated 0-50 mL Scale Sleeve + Tapered Drip Tip + Funnel
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

    const buretteFunnel = new THREE.Mesh(
      buildLatheFromProfile(createFunnelProfilePoints(0.32, 0.08, 0.36, 0.22), 32),
      glassMat
    );
    buretteFunnel.position.set(0, 6.38, 0);
    titrationGroup.add(buretteFunnel);

    // Titrant liquid inside burette + Concave Meniscus Ring at top of column
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

    // Stopcock PTFE valve body + Brass tap handle with 3D Positional Audio Emitter
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

    // Falling Titrant Droplet from Burette Tip -> Erlenmeyer Surface
    const fallingDropMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.88,
      roughness: 0.05,
      transmission: 0.75,
      ior: 1.33,
    });
    const fallingDropMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 14, 14),
      fallingDropMat
    );
    fallingDropMesh.scale.set(0.82, 1.38, 0.82);
    fallingDropMesh.position.set(0, 1.82, 0);
    titrationGroup.add(fallingDropMesh);

    // True Thick-Walled Lathe Erlenmeyer Flask at bottom
    const flaskGeo = buildLatheFromProfile(createErlenmeyerProfilePoints(1.24, 0.38, 2.15, 0.045), 48);
    const flaskMesh = new THREE.Mesh(flaskGeo, glassMat);
    flaskMesh.position.set(0, 0.56, 0);
    flaskMesh.castShadow = true;
    titrationGroup.add(flaskMesh);

    if (beakerScaleTex) {
      const flaskScaleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.76, 1.12, 1.15, 32, 1, true),
        graduationOverlayMat(beakerScaleTex)
      );
      flaskScaleMesh.position.set(0, 1.16, 0);
      flaskScaleMesh.rotation.y = -Math.PI * 0.45;
      titrationGroup.add(flaskScaleMesh);
    }

    // Analyte Solution inside flask with dynamic meniscus & surface wobble shader
    const analyteLiquidMat = createLiquidWobbleMaterial(0xf8fafc, 0.82);
    liquidShaderMaterials.push(analyteLiquidMat);
    const analyteSolution = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 1.15, 0.96, 36, 16),
      analyteLiquidMat
    );
    analyteSolution.position.set(0, 1.06, 0);
    titrationGroup.add(analyteSolution);

    // Concave Meniscus Ring at top of Erlenmeyer liquid column
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

    // Radial Indicator Color Spread Disc + Expanding Ripple Rings on Liquid Surface
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

    // 3D Universal pH Scale Strip beside Erlenmeyer (shown when Label Konsep is active)
    const phScaleCanvas = document.createElement('canvas');
    phScaleCanvas.width = 96;
    phScaleCanvas.height = 512;
    const phCtx = phScaleCanvas.getContext('2d');
    if (phCtx) {
      const grad = phCtx.createLinearGradient(0, 512, 0, 0);
      grad.addColorStop(0.0, '#ef4444'); // pH 0
      grad.addColorStop(0.25, '#f59e0b'); // pH 3.5
      grad.addColorStop(0.5, '#22c55e'); // pH 7
      grad.addColorStop(0.75, '#0ea5e9'); // pH 10.5
      grad.addColorStop(1.0, '#8b5cf6'); // pH 14
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

    // =========================================================
    // 3. ELECTROCHEMISTRY GALVANIC CELL 3D GROUP
    // =========================================================
    const redoxGroup = new THREE.Group();
    scene.add(redoxGroup);

    const sharedBeakerGeo = buildLatheFromProfile(createBeakerProfilePoints(0.92, 1.85, 0.045), 40);

    // Left beaker (Anode) with Graduations
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
    const anodeLiquidMat = createLiquidWobbleMaterial(0x94a3b8, 0.72);
    liquidShaderMaterials.push(anodeLiquidMat);
    const anodeLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 1.25, 32, 12),
      anodeLiquidMat
    );
    anodeLiquid.position.set(-1.8, 0.96, 0);
    const anodeElectrode = new THREE.Mesh(new RoundedBoxGeometry(0.28, 2.0, 0.09, 2, 0.015), brushedSteelMat);
    anodeElectrode.position.set(-1.8, 1.4, 0);
    anodeElectrode.castShadow = true;
    anodeElectrode.userData = { draggableParam: 'anodeConcM', min: 0.01, max: 2.0, step: 0.05, label: '[Anoda]' };
    redoxGroup.add(beakerLeft, anodeLiquid, anodeElectrode);

    // Right beaker (Cathode) with Graduations
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
    const cathodeLiquidMat = createLiquidWobbleMaterial(0x0284c7, 0.76);
    liquidShaderMaterials.push(cathodeLiquidMat);
    const cathodeLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 1.25, 32, 12),
      cathodeLiquidMat
    );
    cathodeLiquid.position.set(1.8, 0.96, 0);
    const cathodeElectrode = new THREE.Mesh(new RoundedBoxGeometry(0.28, 2.0, 0.09, 2, 0.015), brassMat);
    cathodeElectrode.position.set(1.8, 1.4, 0);
    cathodeElectrode.castShadow = true;
    cathodeElectrode.userData = { draggableParam: 'cathodeConcM', min: 0.01, max: 2.0, step: 0.05, label: '[Katoda]' };
    redoxGroup.add(beakerRight, cathodeLiquid, cathodeElectrode);

    // Salt Bridge U-Tube
    const saltBridge = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.12, 14, 36, Math.PI),
      glassMat
    );
    saltBridge.position.set(0, 1.6, 0);
    saltBridge.castShadow = true;
    redoxGroup.add(saltBridge);

    // Digital Voltmeter Housing
    const voltMeter = new THREE.Mesh(new RoundedBoxGeometry(1.65, 1.0, 0.82, 3, 0.05), darkFrameMat);
    voltMeter.position.set(0, 2.8, -1.2);
    voltMeter.castShadow = true;
    redoxGroup.add(voltMeter);

    // =========================================================
    // 4. IDEAL GAS & BOYLE COMPRESSION 3D GROUP
    // =========================================================
    const gasGroup = new THREE.Group();
    scene.add(gasGroup);

    // Heavy glass cylinder
    const gasCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 4.4, 32, 1, true),
      glassMat
    );
    gasCylinder.position.set(0, 2.5, 0);
    gasCylinder.castShadow = true;
    gasGroup.add(gasCylinder);

    const gasCylBase = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.25, 32), darkFrameMat);
    gasCylBase.position.set(0, 0.4, 0);
    gasCylBase.castShadow = true;
    gasCylBase.receiveShadow = true;
    gasGroup.add(gasCylBase);

    // Movable metallic piston head
    const pistonHead = new THREE.Mesh(
      new THREE.CylinderGeometry(1.58, 1.58, 0.35, 32),
      brushedSteelMat
    );
    pistonHead.position.set(0, 3.2, 0);
    pistonHead.castShadow = true;
    pistonHead.userData = { draggableParam: 'gasVolumeL', min: 2.0, max: 25.0, step: 0.5, label: 'Volume Gas V (L)' };
    gasGroup.add(pistonHead);

    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 16), brushedSteelMat);
    pistonRod.position.set(0, 4.4, 0);
    pistonRod.castShadow = true;
    gasGroup.add(pistonRod);

    // Analog dial pressure gauge
    const pressureDial = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.2, 28), brassMat);
    pressureDial.rotation.x = Math.PI / 2;
    pressureDial.position.set(2.2, 2.6, 0);
    pressureDial.castShadow = true;
    gasGroup.add(pressureDial);

    const pressureNeedle = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.5, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    pressureNeedle.position.set(2.2, 2.6, 0.12);
    gasGroup.add(pressureNeedle);

    // Kinetic gas bouncing particles
    const GAS_PARTICLES_COUNT = 24;
    const gasParticles: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
    const gasPartGeo = new THREE.SphereGeometry(0.08, 12, 12);
    for (let i = 0; i < GAS_PARTICLES_COUNT; i++) {
      const pMesh = new THREE.Mesh(
        gasPartGeo,
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.9 })
      );
      pMesh.position.set((Math.random() - 0.5) * 2.2, 0.6 + Math.random() * 2.2, (Math.random() - 0.5) * 2.2);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
      gasGroup.add(pMesh);
      gasParticles.push({ mesh: pMesh, vel });
    }

    // =========================================================
    // 5. REACTION KINETICS & ARRHENIUS 3D GROUP
    // =========================================================
    const kineticsGroup = new THREE.Group();
    scene.add(kineticsGroup);

    // Magnetic hotplate stirrer & Bunsen heater
    const hotplateBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 3.6), darkFrameMat);
    hotplateBase.position.set(0, 0.68, 0);
    hotplateBase.castShadow = true;
    hotplateBase.receiveShadow = true;
    hotplateBase.userData = { draggableParam: 'kineticsTempC', min: 10, max: 90, step: 5, label: 'Suhu Pemanas T (°C)' };
    kineticsGroup.add(hotplateBase);

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
    hotplateCeramicTop.userData = { draggableParam: 'kineticsTempC', min: 10, max: 90, step: 5, label: 'Suhu Pemanas T (°C)' };
    kineticsGroup.add(hotplateCeramicTop);

    // Warm orange heater PointLight (capped at max 0.8 intensity, distance = 3.0)
    const heaterLight = new THREE.PointLight(0xf97316, 0.8, 3.0);
    heaterLight.position.set(0, 1.35, 0);
    kineticsGroup.add(heaterLight);

    // Glowing heater ring with capped emissiveIntensity <= 0.6
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

    // Temp control knob on hotplate
    const tempKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 16), brassMat);
    tempKnob.rotation.x = Math.PI / 2;
    tempKnob.position.set(0, 0.68, 1.85);
    tempKnob.userData = { draggableParam: 'kineticsTempC', min: 10, max: 90, step: 5, label: 'Suhu Pemanas T (°C)' };
    kineticsGroup.add(tempKnob);

    // Reaction flask on hotplate
    const kFlask = new THREE.Mesh(flaskGeo, glassMat);
    kFlask.position.set(0, 1.18, 0);
    kFlask.castShadow = true;
    kineticsGroup.add(kFlask);

    // Liquid whose color turns to sulfur precipitate with procedural surface wobble
    const kLiquidMat = createLiquidWobbleMaterial(0xfef08a, 0.8);
    liquidShaderMaterials.push(kLiquidMat);
    const kLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 1.32, 1.0, 32, 16),
      kLiquidMat
    );
    kLiquid.position.set(0, 1.7, 0);
    kineticsGroup.add(kLiquid);

    // Magnetic stir bar inside flask
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

    // Main Spectrophotometer Chassis
    const spectroChassis = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 4.8), darkFrameMat);
    spectroChassis.position.set(0, 1.38, 0);
    spectroChassis.castShadow = true;
    spectroChassis.receiveShadow = true;
    spectroGroup.add(spectroChassis);

    // Sample Compartment Lid (openable)
    const spectroLid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 2.2), brushedSteelMat);
    spectroLid.position.set(-0.8, 2.55, 0.4);
    spectroLid.castShadow = true;
    spectroGroup.add(spectroLid);

    // Optical Cuvette (Refractive Glass)
    const cuvette = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.65), glassMat);
    cuvette.position.set(-0.8, 2.8, 0.4);
    cuvette.castShadow = true;
    spectroGroup.add(cuvette);

    // Colored analyte inside cuvette (KMnO4 magenta / CuSO4 cyan)
    const analyteSolutionCuvette = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.6, 0.58),
      new THREE.MeshStandardMaterial({ color: 0xd946ef, transparent: true, opacity: 0.75 })
    );
    analyteSolutionCuvette.position.set(-0.8, 2.8, 0.4);
    analyteSolutionCuvette.userData = { draggableParam: 'spectroConcMm', min: 0.01, max: 0.25, step: 0.01, label: 'Konsentrasi c (mM)' };
    spectroGroup.add(analyteSolutionCuvette);

    // Incident light beam line (glows with Bloom)
    const spectroBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.8, 12),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    spectroBeam.rotation.z = Math.PI / 2;
    spectroBeam.position.set(-0.8, 2.8, 0.4);
    spectroGroup.add(spectroBeam);

    // =========================================================
    // 7. RISING GAS BUBBLE PARTICLE SYSTEM (THREE.Points)
    // =========================================================
    const BUBBLE_COUNT = 120;
    const bubblePositions = new Float32Array(BUBBLE_COUNT * 3);
    const bubbleSpeeds = new Float32Array(BUBBLE_COUNT);
    const bubbleSeeds = new Float32Array(BUBBLE_COUNT);
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      bubblePositions[i * 3] = (Math.random() - 0.5) * 1.4;
      bubblePositions[i * 3 + 1] = Math.random() * 1.2;
      bubblePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
      bubbleSpeeds[i] = 0.35 + Math.random() * 0.65;
      bubbleSeeds[i] = Math.random() * Math.PI * 2;
    }
    const bubbleGeo = new THREE.BufferGeometry();
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
    const bubbleTex = createBubbleTexture();
    const bubbleMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.14,
      map: bubbleTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const gasBubblePoints = new THREE.Points(bubbleGeo, bubbleMat);
    scene.add(gasBubblePoints);

    // =========================================================
    // DIRECT 3D MESH DRAGGING (RAYCASTER GIZMOS)
    // =========================================================
    let isDragging = false;
    let dragParamKey = '';
    let dragStartPos = { x: 0, y: 0 };
    let dragStartVal = 0;
    let dragConfig = { min: 0, max: 100, step: 1, label: '' };
    const dragRaycaster = new THREE.Raycaster();
    const dragMouse = new THREE.Vector2();
    let hoveredMesh: THREE.Mesh | null = null;
    const origEmissive = new THREE.Color();
    const conceptProjVec = new THREE.Vector3();

    const getInteractiveMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible && obj.userData?.draggableParam) {
          list.push(obj);
        }
      });
      return list;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      dragMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      dragRaycaster.setFromCamera(dragMouse, camera);

      const hits = dragRaycaster.intersectObjects(getInteractiveMeshes(), false);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const paramKey = hitObj.userData.draggableParam;
        if (paramKey && latestRef.current.onUpdateParam) {
          isDragging = true;
          dragParamKey = paramKey;
          dragStartPos = { x: e.clientX, y: e.clientY };
          dragConfig = {
            min: hitObj.userData.min ?? 0,
            max: hitObj.userData.max ?? 100,
            step: hitObj.userData.step ?? 1,
            label: hitObj.userData.label ?? paramKey,
          };
          const curVal = (latestRef.current.params as unknown as Record<string, number>)[paramKey] ?? 0;
          dragStartVal = curVal;
          controls.enabled = false;
          renderer.domElement.style.cursor = 'grabbing';
          labSound.playClick(600);
          wobbleBoost = 0.08;

          if (paramKey === 'titrantAddedMl') {
            const nextVal = Math.min(50, Number((curVal + 1.0).toFixed(1)));
            latestRef.current.onUpdateParam(paramKey, nextVal);
            buretSoundEmitter.play();
            setDragToast({ label: 'Kran Buret Diteteskan (+1 mL)', value: `${nextVal} mL` });
          } else if (paramKey === 'kineticsTempC') {
            const nextVal = Math.min(90, Number((curVal + 5).toFixed(1)));
            latestRef.current.onUpdateParam(paramKey, nextVal);
            setDragToast({ label: 'Pemanas Bunsen (+5 °C)', value: `${nextVal} °C` });
          } else {
            setDragToast({ label: dragConfig.label, value: `${curVal}` });
          }
        }
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        isDragging = false;
        dragParamKey = '';
        controls.enabled = true;
        renderer.domElement.style.cursor = 'grab';
        setTimeout(() => setDragToast(null), 1200);
      }
    };

    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;

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

    let lastRenderTimestamp = 0;

    const tick = (timestamp?: number) => {
      if (disposed) return;

      const nowMs = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
      fpsMonitor.recordFrame(nowMs);

      const isLite = useUIStore.getState().liteDeviceMode;
      if (isLite) {
        const delta = nowMs - lastRenderTimestamp;
        if (delta < 32) {
          if (isSoftwareGl) afterDraw(tick);
          else rafId = requestAnimationFrame(tick);
          return;
        }
        lastRenderTimestamp = nowMs - (delta % 33.3);
      }

      const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.05);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const { params: p, metrics: m, isReacting: reacting } = latestRef.current;

      const isRedox = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
      thermoGroup.visible = p.mode === 'thermo-calorimetry';
      titrationGroup.visible = p.mode === 'acid-base-titration';
      redoxGroup.visible = isRedox;
      gasGroup.visible = p.mode === 'ideal-gas-boyle';
      kineticsGroup.visible = p.mode === 'reaction-kinetics-arrhenius';
      spectroGroup.visible = p.mode === 'spectrophotometry-beer';

      // Detect titrant addition for surface ripple wobble
      const curVb = p.titrantAddedMl ?? 0;
      if (Math.abs(curVb - lastTitrantMl) > 0.01) {
        wobbleBoost = 0.085;
        lastTitrantMl = curVb;
      }
      wobbleBoost = Math.max(0, wobbleBoost - dt * 0.06);

      const baseWobble = reacting ? 0.05 : 0.018;
      const totalWobble = baseWobble + wobbleBoost;
      for (const mat of liquidShaderMaterials) {
        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uWobbleAmp.value = totalWobble;
      }

      // 1. Titration color, meniscus, falling droplets & surface ripples update
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

        // Animate droplet falling from burette tip (y=1.92) to Erlenmeyer liquid surface (y=1.54)
        const dropRate = reacting || wobbleBoost > 0.01 ? 2.4 : vb > 0 ? 1.15 : 0;
        if (dropRate > 0 && vb < 50) {
          const dropPhase = (elapsed * dropRate) % 1.0;
          fallingDropMesh.visible = dropPhase < 0.72;
          if (fallingDropMesh.visible) {
            const fallProgress = dropPhase / 0.72;
            const dropY = 1.92 - fallProgress * fallProgress * 0.39;
            fallingDropMesh.position.set(0, dropY, 0);
          }

          // Ripple rings & radial color bloom triggered at droplet impact (phase >= 0.72 or continuous wave)
          const ripplePhase1 = ((elapsed * dropRate - 0.72 + 1.0) % 1.0);
          const ripplePhase2 = ((elapsed * dropRate - 0.32 + 1.0) % 1.0);
          rippleRing1.visible = true;
          rippleRing1.scale.setScalar(0.35 + ripplePhase1 * 5.8);
          rippleRingMat1.opacity = Math.max(0, (1 - ripplePhase1) * 0.68);

          rippleRing2.visible = !isLite;
          if (!isLite) {
            rippleRing2.scale.setScalar(0.35 + ripplePhase2 * 5.8);
            rippleRingMat2.opacity = Math.max(0, (1 - ripplePhase2) * 0.45);
          }

          // Radial indicator color spread from impact center outward
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

        phScaleGroup.visible = showConceptLabelsRef.current;
        const phFrac = Math.min(1, Math.max(0, (m.currentPh ?? 7) / 14));
        phPointerMesh.position.y = -1.15 + phFrac * 2.3;
      }

      // 2. Gas Boyle update
      else if (p.mode === 'ideal-gas-boyle') {
        const vL = p.gasVolumeL ?? 10.0;
        const pistonY = 0.8 + (vL / 25.0) * 3.2;
        pistonHead.position.y = pistonY;
        pistonRod.position.y = pistonY + 1.2;

        const pAtm = m.gasPressureAtm ?? 1.0;
        const needleAngle = Math.max(-1.4, Math.min(1.4, (pAtm / 5.0) * Math.PI - Math.PI / 2));
        pressureNeedle.rotation.z = -needleAngle;

        const speed = Math.sqrt((p.gasTemperatureK ?? 300) / 300) * 0.04;
        gasParticles.forEach((part, idx) => {
          if (isLite && idx >= 12) {
            part.mesh.visible = false;
            return;
          }
          part.mesh.visible = true;
          part.mesh.position.addScaledVector(part.vel, speed);
          if (part.mesh.position.y > pistonY - 0.2 || part.mesh.position.y < 0.6) {
            part.vel.y *= -1;
          }
          if (Math.abs(part.mesh.position.x) > 1.2) part.vel.x *= -1;
          if (Math.abs(part.mesh.position.z) > 1.2) part.vel.z *= -1;
        });
      }

      // 3. Reaction Kinetics update
      else if (p.mode === 'reaction-kinetics-arrhenius') {
        stirBar.rotation.y += reacting ? 0.35 : 0.08;
        const tempC = p.kineticsTempC ?? 25;
        const eaFraction = Math.min(1, Math.max(0, tempC / 70));
        kLiquidMat.uniforms.uOpacity.value = 0.55 + eaFraction * 0.4;
        hotplateCeramicTopMat.emissiveIntensity = Math.min(0.6, 0.15 + eaFraction * 0.45);
        heaterRingMat.emissiveIntensity = Math.min(0.6, 0.25 + eaFraction * 0.35);
        heaterLight.intensity = Math.min(0.8, 0.3 + eaFraction * 0.5);
      }

      // 4. Spectrophotometry update
      else if (p.mode === 'spectrophotometry-beer') {
        const absVal = m.spectroAbsorbance ?? 0.8;
        const opacity = Math.min(0.95, Math.max(0.2, absVal * 0.4));
        (analyteSolutionCuvette.material as THREE.MeshStandardMaterial).opacity = opacity;
        (spectroBeam.material as THREE.MeshBasicMaterial).color.setHex(absVal > 2 ? 0xef4444 : 0x22c55e);
      }

      // 5. Rising Gas Bubbles (THREE.Points) in active chemical vessels
      const showBubbles =
        reacting ||
        isRedox ||
        p.mode === 'reaction-kinetics-arrhenius' ||
        p.mode === 'thermo-calorimetry' ||
        (p.mode === 'acid-base-titration' && wobbleBoost > 0.01);

      gasBubblePoints.visible = showBubbles;
      if (showBubbles) {
        const bPos = bubbleGeo.getAttribute('position') as THREE.BufferAttribute;
        const rateMultiplier = reacting ? 1.8 : 0.85;
        const activeBubbles = isLite ? Math.floor(BUBBLE_COUNT / 2) : BUBBLE_COUNT;
        bubbleGeo.setDrawRange(0, activeBubbles);
        for (let i = 0; i < activeBubbles; i++) {
          let bx = bPos.getX(i);
          let by = bPos.getY(i) + bubbleSpeeds[i] * dt * rateMultiplier;
          let bz = bPos.getZ(i);

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

          if (by > maxY || by < minY) {
            by = minY + Math.random() * 0.15;
            const angle = bubbleSeeds[i] + elapsed;
            const rad = Math.random() * 0.55;
            bx = centerX + Math.cos(angle) * rad;
            bz = Math.sin(angle) * rad;
          } else {
            bx += Math.sin(elapsed * 3.5 + bubbleSeeds[i]) * 0.003;
          }

          bPos.setXYZ(i, bx, by, bz);
        }
        bPos.needsUpdate = true;
      }

      cursorManager.update(
        latestRef.current.remoteCursors || {},
        camera.position
      );

      if (camTransitionActive) {
        camTransitionActive = smoothCameraTransition(
          camera,
          controls,
          desiredCamPos,
          desiredTarget,
          0.14
        );
      }

      controls.update();

      const showLabels = showConceptLabelsRef.current;
      const cDom = conceptDomRef.current;
      const cw = container.clientWidth || width;
      const ch = container.clientHeight || height;
      const cEntries = [
        { dom: cDom.c1, worldPos: new THREE.Vector3(), text: '', active: false },
        { dom: cDom.c2, worldPos: new THREE.Vector3(), text: '', active: false },
        { dom: cDom.c3, worldPos: new THREE.Vector3(), text: '', active: false },
      ];
      if (showLabels) {
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
            text: `Pemanas & Pengaduk Magnetik`,
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
            text: `Anoda (-) Oksidasi`,
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
      }
      updateProjectedConceptLabels(cEntries, camera, cw, ch, showLabels, conceptProjVec);

      studioComposer.render(isLite);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    let lastEmitTime = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (isDragging && dragParamKey && latestRef.current.onUpdateParam) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = dragStartPos.y - e.clientY;
        const sensitivity = (dragConfig.max - dragConfig.min) / 280;
        const delta = (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * sensitivity;
        let nextVal = dragStartVal + delta;
        nextVal = Math.max(dragConfig.min, Math.min(dragConfig.max, nextVal));
        if (dragConfig.step >= 1) {
          nextVal = Math.round(nextVal / dragConfig.step) * dragConfig.step;
        } else {
          nextVal = Number((Math.round(nextVal / dragConfig.step) * dragConfig.step).toFixed(2));
        }
        latestRef.current.onUpdateParam(dragParamKey, nextVal);
        wobbleBoost = 0.065;
        setDragToast({ label: dragConfig.label, value: `${nextVal}` });
        return;
      }

      dragMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      dragRaycaster.setFromCamera(dragMouse, camera);
      const hits = dragRaycaster.intersectObjects(getInteractiveMeshes(), false);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        renderer.domElement.style.cursor = 'grab';
        if (hitMesh !== hoveredMesh) {
          if (hoveredMesh && (hoveredMesh.material as any)?.emissive) {
            (hoveredMesh.material as any).emissive.copy(origEmissive);
          }
          hoveredMesh = hitMesh;
          if ((hitMesh.material as any)?.emissive) {
            origEmissive.copy((hitMesh.material as any).emissive);
            (hitMesh.material as any).emissive.setHex(0x14b8a6);
          }
        }
      } else {
        renderer.domElement.style.cursor = 'default';
        if (hoveredMesh && (hoveredMesh.material as any)?.emissive) {
          (hoveredMesh.material as any).emissive.copy(origEmissive);
          hoveredMesh = null;
        }
      }

      if (latestRef.current.onEmitCursor) {
        const now = performance.now();
        if (now - lastEmitTime > 40) {
          const intersects = dragRaycaster.intersectObjects(scene.children, true);
          if (intersects.length > 0) {
            const hit = intersects[0];
            latestRef.current.onEmitCursor(
              [hit.point.x, hit.point.y, hit.point.z],
              hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : undefined,
              hit.object.name
            );
            lastEmitTime = now;
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    let lastW = width;
    let lastH = height;
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 500;
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
      unsubLite();
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleWebGLContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', handleWebGLContextRestored, false);
      cursorManager.dispose();
      controls.dispose();

      // Dispose Post-Processing Pipeline, Studio Workbench & Textures
      studioComposer.dispose();
      workbench.dispose();
      metalTex?.dispose();
      buretteScaleTex?.dispose();
      beakerScaleTex?.dispose();
      phScaleTex.dispose();
      bubbleTex.dispose();

      // Deep Three.js GPU resource disposal (geometries, materials, textures, renderer)
      disposeThreeSceneResources(scene, renderer, envTexture);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [sceneKey]);

  const handleSelectCameraPreset = (presetName: CameraPreset) => {
    setActivePreset(presetName);
    cameraCtrlRef.current?.setPreset(presetName);
  };

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

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${themeColors.containerBgClass} touch-none select-none transition-colors duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="chemistry-simulation-canvas"
        className="w-full h-full block touch-none"
      />

      <ConceptLabelsLayer
        slots={[
          { id: 'c1', accentHex: '#14b8a6' },
          { id: 'c2', accentHex: '#f59e0b' },
          { id: 'c3', accentHex: '#38bdf8' },
        ]}
        visible={showConceptLabels}
        onBindSlot={bindConceptSlot}
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel Kimia 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      {/* Consolidated Top-Right Capsule Bar: Snap-to-Port | 🥽 Mode VR | Presets (Iso | Depan | Atas | Fokus | ⛶) */}
      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={() => {
            labSound.playClick(760);
            const allNodes = globalMultiApparatusEngine.getAllNodes();
            if (allNodes.length < 2) {
              globalMultiApparatusEngine.seedDefaultDomainNodes('Kimia');
            }
            const nodes = globalMultiApparatusEngine.getAllNodes();
            if (nodes.length >= 2) {
              const src = nodes[0];
              const tgt = nodes[1];
              const srcPort = src.ports[0];
              const tgtPort = tgt.ports[0];
              if (srcPort && tgtPort) {
                globalMultiApparatusEngine.moveNodeAndEvaluateSnap(src.id, {
                  [srcPort.id]: [tgtPort.position[0] - 0.18, tgtPort.position[1] + 0.08, tgtPort.position[2]],
                });
                globalMultiApparatusEngine.commitActiveSnapOnRelease();
                globalMultiApparatusEngine.stepTransfer(1.5);
              }
            }
          }}
          title="Snap-to-Port: Sambung & Transfer Reagen Kimia 3D"
          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Snap</span>
        </button>

        <button
          type="button"
          data-testid="enter-vr-lab-btn"
          onClick={() => {
            labSound.playClick(700);
            void toggleImmersiveVRSession();
          }}
          title="Mode VR Spasial 3D (WebXR Immersive-VR)"
          className="px-1.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span aria-hidden="true">🥽</span>
        </button>

        <span className="mx-0.5 h-3.5 w-px bg-white/15" aria-hidden="true" />

        <div className="hidden md:flex items-center gap-0.5">
          {(
            [
              { id: 'isometric', label: 'Iso' },
              { id: 'front', label: 'Depan' },
              { id: 'top', label: 'Atas' },
              { id: 'closeup', label: 'Fokus' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectCameraPreset(p.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                activePreset === p.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="mx-1 h-3.5 w-px bg-white/15" aria-hidden="true" />
        </div>

        <ConceptLabelToggleButton accentClass="bg-teal-500 text-slate-950 font-bold" />

        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChemistryScene3D;

