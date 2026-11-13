import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  createStudioWorkbenchGroup,
  smoothCameraTransition,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import { createDigitalProbe3D } from '../utils/threeMeasurementTools';
import { initThreeStudioHost } from '../utils/threeStudioHost';
import {
  ChemistryParams,
  ChemistryMetrics,
  ThermoReactionPreset,
  RedoxCouplePreset,
  evaluateSafetyHazard,
} from '../utils/scienceEngine';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { Maximize2, Minimize2, Link2, Thermometer } from 'lucide-react';
import { labSound } from '../utils/soundEngine';
import {
  globalMultiApparatusEngine,
  triggerDomainApparatusSnap,
} from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import {
  ConceptLabelDomRef,
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { buildChemistrySpecialRigs } from './scenes/ChemistryRigs';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';

interface ChemistryScene3DProps {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  preset: ThermoReactionPreset;
  redoxPreset: RedoxCouplePreset;
  reactionProgress: number;
  isReacting: boolean;
  simTime?: number;
  simTimeRef?: React.RefObject<number>;
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
  cameraSyncPose?: CameraSyncPose | null;
  onCameraSyncChange?: (pose: Omit<CameraSyncPose, 'seq'>) => void;
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



export const ChemistryScene3D: React.FC<ChemistryScene3DProps> = ({
  params,
  metrics,
  preset,
  redoxPreset,
  reactionProgress,
  isReacting,
  simTime,
  simTimeRef,
  remoteCursors,
  onEmitCursor,
  onUpdateParam,
  onCaptureSnapshot,
  comfortTheme,
  cameraSyncPose,
  onCameraSyncChange,
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
  const [hoveredPartLabel, setHoveredPartLabel] = useState<string | null>(null);
  const [showProbe3D, setShowProbe3D] = useState<boolean>(false);
  const showProbe3DRef = useRef<boolean>(false);
  showProbe3DRef.current = showProbe3D;
  const [probeHudText, setProbeHudText] = useState<{ text: string; color: string } | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);

  const latestRef = useRef({
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
    simTime,
    simTimeRef,
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
    simTime,
    simTimeRef,
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

  const onCameraSyncChangeRef = useRef(onCameraSyncChange);
  onCameraSyncChangeRef.current = onCameraSyncChange;
  const lastAppliedCamSeqRef = useRef<number>(-1);
  const cameraSyncHandleRef = useRef<{ applyPose: (pose: CameraSyncPose) => void } | null>(null);

  useEffect(() => {
    if (!cameraSyncPose || cameraSyncPose.seq === lastAppliedCamSeqRef.current) return;
    lastAppliedCamSeqRef.current = cameraSyncPose.seq;
    cameraSyncHandleRef.current?.applyPose(cameraSyncPose);
  }, [cameraSyncPose]);

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
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Kimia');

    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 760, height: 380 },
      backgroundHex: 0x0b0f17,
      fogDensity: 0.015,
      camera: {
        fov: 45,
        near: 0.1,
        far: 200,
        position: [4.2, 5.8, 10.5],
      },
      controls: {
        target: [0, 1.4, 0],
        maxPolarAngle: Math.PI * 0.49,
        minDistance: 3.5,
        maxDistance: 30,
        autoRotateSpeed: 1.4,
      },
      onContextRestored: () => setSceneKey((prev) => prev + 1),
      onUserControlsStart: () => {
        camTransitionActive = false;
      },
      onCameraSyncChange: (pose) => onCameraSyncChangeRef.current?.(pose),
    });
    if (!host) return;

    const { scene, camera, renderer, controls, fpsMonitor, isSoftwareGl } = host;
    const gl = renderer.getContext() as WebGL2RenderingContext;

    const desiredCamPos = new THREE.Vector3(4.2, 5.8, 10.5);
    const desiredTarget = new THREE.Vector3(0, 1.4, 0);

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        camTransitionActive = false;
        host.applyExternalCameraPose(pose);
      },
    };

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

    const unsubAiAction = subscribeLabEvent(LAB_EVENTS.AI_UI_ACTION, (action) => {
      if (!action) return;
      if (action.type === 'FOCUS_CAMERA' && action.target === 'burette_tip') {
        desiredTarget.set(0, 1.85, 0);
        desiredCamPos.set(1.35, 2.25, 2.45);
        camTransitionActive = true;
      }
    });

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
      captureCanvas: () => host.captureSnapshot(),
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
    const glassMat = createBorosilicateGlassMaterial(useUIStore.getState().liteDeviceMode, {
      color: 0xecfeff,
      tintOpacity: 0.30,
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

    const cursorManager = new SpatialCursorManager(scene);
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

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
    // 3-6. SPECIAL CHEMISTRY RIGS (Redox, Ideal Gas, Kinetics, Spectrophotometry)
    // =========================================================
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

    // =========================================================
    // 7. RISING GAS MICRO-BUBBLE SYSTEM (Single Draw-Call InstancedMesh)
    // =========================================================
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

    // Interactive 3D Immersion Probe (pH Meter / Digital Thermocouple)
    const probeHandle = createDigitalProbe3D('ph');
    probeHandle.group.position.set(1.35, 2.25, 0.35);
    probeHandle.group.visible = showProbe3DRef.current;
    scene.add(probeHandle.group);

    // =========================================================
    // 8. K3 SAFETY HAZARD 3D VAPOR, WARNING RING & BEACON LIGHT
    // =========================================================
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

    // =========================================================
    // DIRECT 3D MESH DRAGGING (ThreeInteractionManager)
    // =========================================================
    const conceptProjVec = new THREE.Vector3();
    let probeStartX = probeHandle.group.position.x;
    let probeStartZ = probeHandle.group.position.z;

    probeHandle.bodyMesh.userData.onDrag = (dx: number, dy: number) => {
      probeHandle.group.position.x = Math.max(-3.6, Math.min(3.6, probeStartX + dx * 0.02));
      probeHandle.group.position.z = Math.max(-2.6, Math.min(2.6, probeStartZ + dy * 0.02));
    };

    const getInteractiveMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.visible &&
          (obj.userData?.draggableParam || obj.userData?.measurementHandle || obj.userData?.interactive)
        ) {
          let parentVisible = true;
          let cur: THREE.Object3D | null = obj.parent;
          while (cur) {
            if (!cur.visible) {
              parentVisible = false;
              break;
            }
            cur = cur.parent;
          }
          if (parentVisible) list.push(obj);
        }
      });
      if (probeHandle.group.visible) {
        list.push(...probeHandle.getInteractiveHandles());
      }
      return list;
    };

    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x14b8a6,
      dragSpanPx: 280,
      getInteractiveObjects: getInteractiveMeshes,
      getParamValue: (key) => (latestRef.current.params as unknown as Record<string, number>)[key],
      onHoverChange: (obj) => {
        setHoveredPartLabel(obj ? (obj.userData?.label ?? obj.name ?? 'Aparatus Kimia 3D') : null);
      },
      onDragStart: (obj, paramKey) => {
        if (obj.userData?.measurementHandle === 'probe-body') {
          probeStartX = probeHandle.group.position.x;
          probeStartZ = probeHandle.group.position.z;
          labSound.playClick(720);
          return;
        }
        if (paramKey && latestRef.current.onUpdateParam) {
          labSound.playClick(600);
          wobbleBoost = 0.08;
          const curVal = (latestRef.current.params as unknown as Record<string, number>)[paramKey] ?? 0;
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
            setDragToast({ label: obj.userData?.label ?? paramKey, value: `${curVal}` });
          }
        }
      },
      onDragUpdate: (_obj, paramKey, newValue, label) => {
        if (!latestRef.current.onUpdateParam) return;
        latestRef.current.onUpdateParam(paramKey, newValue);
        wobbleBoost = 0.065;
        setDragToast({ label: label ?? paramKey, value: `${newValue}` });
      },
      onDragEnd: () => {
        setTimeout(() => setDragToast(null), 1200);
      },
      onCursorMove3D: (pos, normal, hoveredObject) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredObject);
      },
    });

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
    let prevSimTime = -1;
    let lastDropImpactCycle = -1;

    const tick = (timestamp?: number) => {
      if (disposed) return;

      const nowMs = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
      fpsMonitor.recordFrame(nowMs);

      const isLite = useUIStore.getState().liteDeviceMode;
      applyBorosilicateLiteMode(glassMat, isLite);
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
      const { params: p, metrics: m, isReacting: reacting, simTime: propSimTime, simTimeRef: propSimTimeRef } = latestRef.current;
      const t =
        propSimTimeRef && typeof propSimTimeRef.current === 'number'
          ? propSimTimeRef.current
          : typeof propSimTime === 'number'
          ? propSimTime
          : elapsed;
      const isSimTimeAdvancing = prevSimTime >= 0 && t > prevSimTime + 0.0005;
      prevSimTime = t;

      const isRedox = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
      thermoGroup.visible = p.mode === 'thermo-calorimetry';
      titrationGroup.visible = p.mode === 'acid-base-titration';

      // K3 Safety Hazard 3D Visuals (Thermal Runaway / Overpressure / Corrosive Overflow)
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
        mat.uniforms.uTime.value = t;
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

          // Ripple rings & radial color bloom triggered at droplet impact (phase >= 0.72 or continuous wave)
          const ripplePhase1 = ((t * dropRate - 0.72 + 1.0) % 1.0);
          const ripplePhase2 = ((t * dropRate - 0.32 + 1.0) % 1.0);
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

      // 2-4. Special Chemistry Rigs update (Redox, Ideal Gas, Kinetics, Spectrophotometry)
      specialRigs.update({
        params: p,
        metrics: m,
        simTime: t,
        isLite,
        reacting,
        isSimTimeAdvancing,
      });

      // 5. Rising Gas Micro-Bubbles (Single Draw-Call InstancedMesh) in active chemical vessels
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
          const growthScale = 0.65 + (by - minY) / spanY * 0.75;

          bubblePool.setTransform(i, bx, by, bz, growthScale);
          bubblePool.setColor(i, bubbleColorHex);
        }
        bubblePool.commit(activeBubbles);
      }

      // 6. Interactive 3D Digital Immersion Probe (pH / Thermocouple)
      probeHandle.group.visible = showProbe3DRef.current;
      if (probeHandle.group.visible) {
        const usePh =
          p.mode === 'acid-base-titration' ||
          isRedox ||
          p.mode === 'spectrophotometry-beer';
        const probeVal = usePh
          ? m.currentPh ?? 7.0
          : p.mode === 'reaction-kinetics-arrhenius'
          ? p.kineticsTempC ?? 25
          : p.mode === 'ideal-gas-boyle'
          ? (p.gasTemperatureK ?? 300) - 273.15
          : m.finalTempC ?? p.initialTempC ?? 25;
        const probeOut = probeHandle.setReading(
          usePh ? 'ph' : 'thermometer',
          probeVal
        );
        if (Math.floor(nowMs / 150) !== Math.floor((nowMs - dt * 1000) / 150)) {
          setProbeHudText({ text: probeOut.formatted, color: probeOut.severityHex });
        }
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

      teacherCollabBridge.tick();
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

      host.renderFrame(dt);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      unsubAiAction();
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      interactionManager.dispose();
      teacherCollabBridge.dispose();
      cursorManager.dispose();
      cameraSyncHandleRef.current = null;

      // Dispose Studio Workbench & Textures
      globalMultiApparatusEngine.clearPortAnchors();
      probeHandle.dispose();
      workbench.dispose();
      metalTex?.dispose();
      buretteScaleTex?.dispose();
      beakerScaleTex?.dispose();
      phScaleTex.dispose();
      host.dispose();
    };
  }, [sceneKey]);

  const handleSelectCameraPreset = (presetName: CameraPreset) => {
    setActivePreset(presetName);
    cameraCtrlRef.current?.setPreset(presetName);
  };

  useEffect(() => {
    const orderedPresets: CameraPreset[] = ['isometric', 'front', 'top', 'closeup'];
    return subscribeLabEvent(LAB_EVENTS.SET_CAMERA_PRESET, (detail) => {
      if (!detail) return;
      const preset = orderedPresets[detail.index];
      if (preset) {
        setActivePreset(preset);
        cameraCtrlRef.current?.setPreset(preset);
      }
    });
  }, []);

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

      {/* Interactive 3D Probe Telemetry Badge */}
      {showProbe3D && probeHudText && (
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-slate-950/90 border border-white/15 px-3 py-1.5 shadow-xl z-20 text-xs font-mono">
          <Thermometer className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400">Sensor Probe 3D:</span>
          <span className="font-bold" style={{ color: probeHudText.color }}>
            {probeHudText.text}
          </span>
        </div>
      )}

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel Kimia 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      {/* Consolidated Top-Right Capsule Bar: Snap-to-Port | Probe 3D | 🥽 Mode VR | Presets (Iso | Depan | Atas | Fokus | ⛶) */}
      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-testid="toggle-3d-probe-btn"
          onClick={() => {
            labSound.playClick(700);
            setShowProbe3D((prev) => !prev);
          }}
          title="Tampilkan / Sembunyikan Probe Sensor pH & Termokopel Digital 3D (Seret probe di meja)"
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
            showProbe3D
              ? 'bg-sky-500 text-slate-950 font-bold'
              : 'text-sky-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Probe</span>
        </button>

        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={() => {
            const { docked, transfer } = triggerDomainApparatusSnap('Kimia');
            if (docked) {
              setDragToast({
                label: `Port Docked (${docked.portType.toUpperCase()})`,
                value: `ΔV = +${(transfer?.fluidTransferredMl ?? 0).toFixed(1)} mL`,
              });
              setTimeout(() => setDragToast(null), 1800);
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
      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="emerald" />
    </div>
  );
};

export default ChemistryScene3D;

