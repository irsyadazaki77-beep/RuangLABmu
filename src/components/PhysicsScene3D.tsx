import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createBrushedMetalTextures,
  createGraduatedScaleTexture,
  createStudioComposer,
  createStudioWorkbenchGroup,
  disposeThreeSceneResources,
  createAdaptiveFpsMonitor,
  configureRendererForLiteMode,
  smoothCameraTransition,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import {
  PhysicsParams,
  PhysicsMetrics,
  KinematicsInstant,
  evaluateKinematicsAtTime,
} from '../utils/scienceEngine';
import { SimulationFrame } from '../utils/simulationBuffer';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { Maximize2, Minimize2, Link2 } from 'lucide-react';
import { labSound } from '../utils/soundEngine';
import { triggerDomainApparatusSnap } from '../utils/engines/multiApparatusEngine';
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

interface PhysicsScene3DProps {
  params: PhysicsParams;
  metrics: PhysicsMetrics;
  instant: KinematicsInstant;
  simTime: number;
  simTimeRef?: React.RefObject<number>;
  showVectorOverlay: boolean;
  simFrame?: SimulationFrame | null;
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

type CameraPreset = 'isometric' | 'front' | 'top' | 'focus';

function createArrowGroup(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.2,
    emissive: colorHex,
    emissiveIntensity: 0.28,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 12);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.name = 'shaft';

  const headGeo = new THREE.ConeGeometry(0.16, 0.36, 14);
  headGeo.translate(0, 0.18, 0);
  const head = new THREE.Mesh(headGeo, mat);
  head.name = 'head';

  group.add(shaft, head);
  return group;
}

function orientAndScaleArrow(
  arrow: THREE.Group,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number
) {
  if (length < 0.08 || dir.lengthSq() < 1e-6) {
    arrow.visible = false;
    return;
  }
  arrow.visible = true;
  arrow.position.copy(origin);
  const normDir = dir.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normDir
  );
  arrow.quaternion.copy(quat);

  const shaftLen = Math.max(0.1, length - 0.34);
  const shaft = arrow.getObjectByName('shaft') as THREE.Mesh;
  const head = arrow.getObjectByName('head') as THREE.Mesh;
  if (shaft) {
    shaft.scale.set(1, shaftLen, 1);
  }
  if (head) {
    head.position.set(0, shaftLen, 0);
  }
}

function wavelengthToHex(wavelengthNm: number): number {
  let r = 0;
  let g = 0;
  let b = 0;
  if (wavelengthNm >= 380 && wavelengthNm < 440) {
    r = -(wavelengthNm - 440) / (440 - 380);
    b = 1;
  } else if (wavelengthNm >= 440 && wavelengthNm < 490) {
    g = (wavelengthNm - 440) / (490 - 440);
    b = 1;
  } else if (wavelengthNm >= 490 && wavelengthNm < 510) {
    g = 1;
    b = -(wavelengthNm - 510) / (510 - 490);
  } else if (wavelengthNm >= 510 && wavelengthNm < 580) {
    r = (wavelengthNm - 510) / (580 - 510);
    g = 1;
  } else if (wavelengthNm >= 580 && wavelengthNm < 645) {
    r = 1;
    g = -(wavelengthNm - 645) / (645 - 580);
  } else if (wavelengthNm >= 645 && wavelengthNm <= 780) {
    r = 1;
  }
  const ir = Math.round(Math.min(255, Math.max(0, r * 255)));
  const ig = Math.round(Math.min(255, Math.max(0, g * 255)));
  const ib = Math.round(Math.min(255, Math.max(0, b * 255)));
  return (ir << 16) | (ig << 8) | ib;
}

interface MotionTrailSystem {
  group: THREE.Group;
  pushSample: (pos: THREE.Vector3) => void;
  reset: (pos: THREE.Vector3) => void;
}

function createMotionTrailSystem(maxPoints: number, baseHex: number): MotionTrailSystem {
  const group = new THREE.Group();
  const positions = new Float32Array(maxPoints * 3);
  const colors = new Float32Array(maxPoints * 3);
  const baseColor = new THREE.Color(baseHex);

  for (let i = 0; i < maxPoints; i++) {
    const fade = Math.pow(1 - i / maxPoints, 1.4);
    colors[i * 3] = baseColor.r * fade * 1.4;
    colors[i * 3 + 1] = baseColor.g * fade * 1.4;
    colors[i * 3 + 2] = baseColor.b * fade * 1.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
  });
  const ribbonLine = new THREE.Line(geo, lineMat);

  const pointsMat = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const neonDots = new THREE.Points(geo, pointsMat);

  group.add(ribbonLine, neonDots);

  let initialized = false;

  const reset = (pos: THREE.Vector3) => {
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < maxPoints; i++) {
      posAttr.setXYZ(i, pos.x, pos.y, pos.z);
    }
    posAttr.needsUpdate = true;
    initialized = true;
  };

  const pushSample = (pos: THREE.Vector3) => {
    if (!initialized) {
      reset(pos);
      return;
    }
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const headX = posAttr.getX(0);
    const headY = posAttr.getY(0);
    const headZ = posAttr.getZ(0);
    const distSq =
      (pos.x - headX) * (pos.x - headX) +
      (pos.y - headY) * (pos.y - headY) +
      (pos.z - headZ) * (pos.z - headZ);

    // If projectile teleported back to cannon origin, reset trail cleanly
    if (distSq > 9.0) {
      reset(pos);
      return;
    }
    if (distSq < 0.0004) return;

    for (let i = maxPoints - 1; i > 0; i--) {
      posAttr.setXYZ(
        i,
        posAttr.getX(i - 1),
        posAttr.getY(i - 1),
        posAttr.getZ(i - 1)
      );
    }
    posAttr.setXYZ(0, pos.x, pos.y, pos.z);
    posAttr.needsUpdate = true;
  };

  return { group, pushSample, reset };
}

export const PhysicsScene3D: React.FC<PhysicsScene3DProps> = ({
  params,
  metrics,
  instant,
  simTime,
  simTimeRef,
  showVectorOverlay,
  simFrame,
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
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Fisika');

  const mountRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const conceptDomRef = useRef<Record<string, ConceptLabelDomRef>>({});
  const bindConceptSlot = useCallback((id: string, dom: ConceptLabelDomRef | null) => {
    if (dom) conceptDomRef.current[id] = dom;
    else delete conceptDomRef.current[id];
  }, []);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hudCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');
  const [followCamEnabled, setFollowCamEnabled] = useState<boolean>(true);
  const followCamRef = useRef<boolean>(true);
  followCamRef.current = followCamEnabled;
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);

  const latestRef = useRef({
    params,
    metrics,
    instant,
    simTime,
    showVectorOverlay,
    simFrame,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
    onCaptureSnapshot,
  });
  latestRef.current = {
    params,
    metrics,
    instant,
    simTime,
    showVectorOverlay,
    simFrame,
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
    cameraCtrlRef.current?.applyTheme(getSceneThemeColors(activeComfortTheme, 'Fisika'));
  }, [activeComfortTheme]);

  const syncConceptLabelsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    syncConceptLabelsRef.current?.();
  }, [params, metrics, showConceptLabels]);

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

    const initialThemeColors = getSceneThemeColors(activeComfortTheme, 'Fisika');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.014);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 250);
    camera.position.set(4.8, 6.2, 12.8);

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

    // Bounded OrbitControls (Tahap 4)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 1.4;
    controls.target.set(0, 1.4, 0);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 1.2;
    controls.maxDistance = 18;

    let camTransitionActive = false;
    const desiredCamPos = new THREE.Vector3(4.8, 6.2, 12.8);
    const desiredTarget = new THREE.Vector3(0, 1.4, 0);

    let isApplyingExternalCam = false;
    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        isApplyingExternalCam = true;
        camTransitionActive = false;
        camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
        controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
        controls.update();
        isApplyingExternalCam = false;
      },
    };
    const handleControlsChange = () => {
      if (isApplyingExternalCam || !onCameraSyncChangeRef.current) return;
      onCameraSyncChangeRef.current({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      });
    };
    controls.addEventListener('change', handleControlsChange);

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    const applyCameraPreset = (preset: CameraPreset) => {
      if (preset === 'isometric') {
        desiredCamPos.set(4.8, 6.2, 12.8);
        desiredTarget.set(0, 1.4, 0);
      } else if (preset === 'front') {
        desiredCamPos.set(0, 2.6, 14.2);
        desiredTarget.set(0, 1.5, 0);
      } else if (preset === 'top') {
        desiredCamPos.set(0, 16.5, 0.8);
        desiredTarget.set(0, 0, 0);
      } else {
        desiredCamPos.set(1.8, 3.4, 8.2);
        desiredTarget.set(0, 1.6, 0);
      }
      camTransitionActive = true;
    };

    const unsubAiAction = subscribeLabEvent(LAB_EVENTS.AI_UI_ACTION, (action) => {
      if (!action) return;
      if (action.type === 'FOCUS_CAMERA' && action.target === 'pendulum_bob') {
        const targetPos = pendBobWorldPos.lengthSq() > 0.001
          ? pendBobWorldPos
          : new THREE.Vector3(0.6, 2.4, 0);
        desiredTarget.copy(targetPos);
        desiredCamPos.set(targetPos.x + 1.8, targetPos.y + 0.85, targetPos.z + 3.8);
        camTransitionActive = true;
      }
    });

    // Studio 3-Point Lighting with Soft Contact Shadows (2048x2048, bias -0.0001)
    const hemiLight = new THREE.HemisphereLight(
      initialThemeColors.ambientSkyHex,
      initialThemeColors.ambientGroundHex,
      0.45
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
    keyLight.position.set(8, 14, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    const d = 12;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-9, 6, -8);
    scene.add(rimLight);

    // Studio Lab Bench, Floor & Calibration Grid
    const workbench = createStudioWorkbenchGroup(initialThemeColors, {
      width: 14.0,
      depth: 7.4,
      thickness: 0.28,
      benchY: -0.14,
      floorY: -0.28,
      gridSize: 32,
      gridDivisions: 32,
    });
    workbench.group.name = 'Meja & Lantai Laboratorium';
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
        scene.fog = new THREE.FogExp2(0x0b0f17, 0.014);
        workbench.updateTheme(colors);
        hemiLight.color.setHex(colors.ambientSkyHex);
        hemiLight.groundColor.setHex(colors.ambientGroundHex);
        hemiLight.intensity = Math.min(0.45, colors.ambientIntensity);
      },
    };

    // Collaborative 3D Laser Pointer Manager
    const cursorManager = new SpatialCursorManager(scene);
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    // Shared PBR Materials & Precision Textures
    const metalTex = createBrushedMetalTextures();
    const rampScaleTex = createGraduatedScaleTexture(200, 'cm', 20, {
      width: 256,
      height: 512,
    });
    const airTrackScaleTex = createGraduatedScaleTexture(120, 'cm', 24, {
      width: 256,
      height: 512,
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
    const darkFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughnessMap: metalTex?.roughnessMap ?? null,
      bumpMap: metalTex?.bumpMap ?? null,
      bumpScale: 0.005,
      metalness: 0.62,
      roughness: 0.36,
      envMapIntensity: 1.05,
    });
    const primaryMassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.28,
      roughness: 0.2,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.25,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughnessMap: metalTex?.roughnessMap ?? null,
      metalness: 0.84,
      roughness: 0.24,
      envMapIntensity: 1.3,
    });

    // =========================================================
    // FLOATING ACCENT GLOW RING GIZMO FOR HOVER & DRAG (TAHAP 4)
    // =========================================================
    const hoverGizmoGroup = new THREE.Group();
    hoverGizmoGroup.visible = false;
    const outerGizmoRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.032, 16, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.92,
      })
    );
    outerGizmoRing.rotation.x = Math.PI / 2;
    const innerGizmoRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.68, 36),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.32,
      })
    );
    innerGizmoRing.rotation.x = Math.PI / 2;
    hoverGizmoGroup.add(outerGizmoRing, innerGizmoRing);
    scene.add(hoverGizmoGroup);

    // =========================================================
    // 1. NEWTON INCLINE 3D GROUP
    // =========================================================
    const inclineGroup = new THREE.Group();
    scene.add(inclineGroup);

    const basePedestal = new THREE.Mesh(
      new RoundedBoxGeometry(10.6, 0.24, 2.7, 3, 0.04),
      darkFrameMat
    );
    basePedestal.position.set(0, 0.12, 0);
    basePedestal.receiveShadow = true;
    inclineGroup.add(basePedestal);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(-4.6, 0.24, 0);
    inclineGroup.add(pivotGroup);

    // Hinge pin axle connecting base pedestal & ramp pivot cleanly
    const hingeAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 2.24, 20),
      brassMat
    );
    hingeAxle.rotation.x = Math.PI / 2;
    pivotGroup.add(hingeAxle);

    const rampBoard = new THREE.Mesh(
      new RoundedBoxGeometry(9.2, 0.22, 2.1, 3, 0.03),
      brushedSteelMat
    );
    rampBoard.position.set(4.6, -0.11, 0);
    rampBoard.castShadow = true;
    rampBoard.receiveShadow = true;
    rampBoard.userData = { draggableParam: 'inclineAngle', min: 0, max: 60, step: 1, label: 'Kemiringan θ' };
    pivotGroup.add(rampBoard);

    if (rampScaleTex) {
      const rampScaleStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(8.8, 0.55),
        new THREE.MeshBasicMaterial({ map: rampScaleTex, transparent: true, opacity: 0.85, depthWrite: false })
      );
      rampScaleStrip.rotation.x = -Math.PI / 2;
      rampScaleStrip.rotation.z = -Math.PI / 2;
      rampScaleStrip.position.set(4.6, 0.008, 0.76);
      pivotGroup.add(rampScaleStrip);
    }

    const railGeo = new RoundedBoxGeometry(9.2, 0.13, 0.08, 2, 0.02);
    const railFront = new THREE.Mesh(railGeo, darkFrameMat);
    railFront.position.set(4.6, 0.06, 1.0);
    const railBack = new THREE.Mesh(railGeo, darkFrameMat);
    railBack.position.set(4.6, 0.06, -1.0);
    pivotGroup.add(railFront, railBack);

    const blockGroup = new THREE.Group();
    pivotGroup.add(blockGroup);

    const massBox = new THREE.Mesh(
      new RoundedBoxGeometry(1.18, 0.76, 1.18, 4, 0.06),
      primaryMassMat
    );
    massBox.position.set(0, 0.39, 0);
    massBox.castShadow = true;
    massBox.receiveShadow = true;
    massBox.userData = { draggableParam: 'appliedForce', min: -100, max: 200, step: 5, label: 'Gaya Dorong F' };
    blockGroup.add(massBox);

    // Metallic brass hook loop & optical flag pin atop carriage block
    const blockCapRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.032, 12, 24),
      brassMat
    );
    blockCapRing.position.set(0, 0.82, 0);
    blockCapRing.castShadow = true;
    blockGroup.add(blockCapRing);

    const arrowApplied = createArrowGroup(0x10b981);
    const arrowFriction = createArrowGroup(0xf59e0b);
    const arrowNormal = createArrowGroup(0x38bdf8);
    const arrowWeight = createArrowGroup(0xf43f5e);
    blockGroup.add(arrowApplied, arrowFriction, arrowNormal, arrowWeight);

    const supportPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1, 16),
      brushedSteelMat
    );
    supportPillar.position.set(3.2, 0.5, 0);
    supportPillar.castShadow = true;
    inclineGroup.add(supportPillar);

    // =========================================================
    // 2. PROJECTILE GRAVITY 3D GROUP + REALTIME MOTION TRAIL
    // =========================================================
    const projectileGroup = new THREE.Group();
    scene.add(projectileGroup);

    const launchTower = new THREE.Mesh(
      new RoundedBoxGeometry(1.24, 1, 1.24, 3, 0.05),
      darkFrameMat
    );
    launchTower.position.set(-5.2, 0.5, 0);
    launchTower.castShadow = true;
    launchTower.receiveShadow = true;
    projectileGroup.add(launchTower);

    const cannonPivot = new THREE.Group();
    cannonPivot.position.set(-5.2, 1.0, 0);
    projectileGroup.add(cannonPivot);

    const cannonBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.32, 1.6, 18),
      brushedSteelMat
    );
    cannonBarrel.rotation.z = -Math.PI / 2;
    cannonBarrel.position.set(0.8, 0, 0);
    cannonBarrel.castShadow = true;
    cannonBarrel.userData = { draggableParam: 'launchAngle', min: 10, max: 85, step: 1, label: 'Sudut Elevasi θ' };
    cannonPivot.add(cannonBarrel);

    const cannonSoundEmitter = labSound.createPositionalSoundEmitter(camera, 'collision-thud');
    cannonBarrel.add(cannonSoundEmitter.sound);

    const projectileBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        metalness: 0.7,
        roughness: 0.2,
        emissive: 0xef4444,
        emissiveIntensity: 0.55,
      })
    );
    projectileBall.castShadow = true;
    projectileBall.userData = { draggableParam: 'initialVelocity', min: 5, max: 50, step: 1, label: 'Kecepatan Awal v₀' };
    projectileGroup.add(projectileBall);

    // Real-time Neon Motion Trail for Projectile
    const projectileMotionTrail = createMotionTrailSystem(54, 0x38bdf8);
    projectileGroup.add(projectileMotionTrail.group);

    const trajGeo = new THREE.BufferGeometry();
    const trajPositions = new Float32Array(61 * 3);
    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));
    const trajLine = new THREE.Line(
      trajGeo,
      new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.3, gapSize: 0.15 })
    );
    trajLine.computeLineDistances();
    projectileGroup.add(trajLine);

    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.65, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
    );
    targetRing.rotation.x = -Math.PI / 2;
    projectileGroup.add(targetRing);

    // =========================================================
    // 3. SPRING HOOKE 3D GROUP
    // =========================================================
    const springGroup = new THREE.Group();
    scene.add(springGroup);

    const springWall = new THREE.Mesh(
      new RoundedBoxGeometry(0.42, 2.5, 2.5, 3, 0.04),
      darkFrameMat
    );
    springWall.position.set(-5.2, 1.25, 0);
    springWall.castShadow = true;
    springGroup.add(springWall);

    const springTrackBed = new THREE.Mesh(
      new RoundedBoxGeometry(10.8, 0.21, 2.2, 3, 0.03),
      darkFrameMat
    );
    springTrackBed.position.set(0.2, 0.105, 0);
    springTrackBed.receiveShadow = true;
    springGroup.add(springTrackBed);

    const COIL_POINTS = 96;
    const coilPositions = new Float32Array(COIL_POINTS * 3);
    const coilGeo = new THREE.BufferGeometry();
    coilGeo.setAttribute('position', new THREE.BufferAttribute(coilPositions, 3));
    const coilLine = new THREE.Line(coilGeo, new THREE.LineBasicMaterial({ color: 0xe2e8f0 }));
    springGroup.add(coilLine);

    const springRings: THREE.Mesh[] = [];
    const springRingGeo = new THREE.TorusGeometry(0.38, 0.055, 10, 20);
    springRingGeo.rotateY(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const rMesh = new THREE.Mesh(springRingGeo, brushedSteelMat);
      rMesh.castShadow = true;
      springRings.push(rMesh);
      springGroup.add(rMesh);
    }

    const springMassBlock = new THREE.Mesh(
      new RoundedBoxGeometry(1.32, 1.32, 1.32, 4, 0.07),
      primaryMassMat
    );
    springMassBlock.castShadow = true;
    springMassBlock.userData = { draggableParam: 'springDisplacement', min: -2.0, max: 2.0, step: 0.1, label: 'Simpangan x' };
    springGroup.add(springMassBlock);

    const springForceArrow = createArrowGroup(0x10b981);
    springGroup.add(springForceArrow);

    // =========================================================
    // 4. PENDULUM HARMONIC 3D GROUP + REALTIME MOTION TRAIL
    // =========================================================
    const pendulumGroup = new THREE.Group();
    scene.add(pendulumGroup);

    const pendStandBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.2, 2.4),
      darkFrameMat
    );
    pendStandBase.position.set(0, 0.1, 0);
    pendStandBase.receiveShadow = true;
    pendulumGroup.add(pendStandBase);

    const pendVerticalPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.2, 16),
      brushedSteelMat
    );
    pendVerticalPillar.position.set(-0.8, 2.2, 0);
    pendVerticalPillar.castShadow = true;
    pendulumGroup.add(pendVerticalPillar);

    const pendHorizontalArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.8, 16),
      brushedSteelMat
    );
    pendHorizontalArm.rotation.z = Math.PI / 2;
    pendHorizontalArm.position.set(0, 4.2, 0);
    pendulumGroup.add(pendHorizontalArm);

    // Pivot mount
    const pendPivotGroup = new THREE.Group();
    pendPivotGroup.position.set(0.6, 4.2, 0);
    pendulumGroup.add(pendPivotGroup);

    const pendRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
    );
    pendRod.position.set(0, -0.5, 0);
    pendPivotGroup.add(pendRod);

    const pendBob = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      brassMat
    );
    pendBob.position.set(0, -1.0, 0);
    pendBob.castShadow = true;
    pendBob.userData = { draggableParam: 'pendulumAngle', min: 5, max: 75, step: 1, label: 'Sudut Awal θ₀' };
    pendPivotGroup.add(pendBob);

    // Real-time Neon Motion Trail for Pendulum Bob
    const pendulumMotionTrail = createMotionTrailSystem(48, 0xf59e0b);
    pendulumGroup.add(pendulumMotionTrail.group);

    const pendRestoringArrow = createArrowGroup(0x10b981);
    const pendGravityArrow = createArrowGroup(0xf43f5e);
    pendulumGroup.add(pendRestoringArrow, pendGravityArrow);

    // Semicircular protractor degree scale
    const protractorGeo = new THREE.RingGeometry(0.5, 0.7, 32, 1, 0, Math.PI);
    protractorGeo.rotateZ(Math.PI);
    const protractor = new THREE.Mesh(
      protractorGeo,
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
    );
    protractor.position.set(0.6, 4.2, 0.05);
    pendulumGroup.add(protractor);

    // Shadow guide arc on ground
    const arcGeo = new THREE.BufferGeometry();
    const arcPositions = new Float32Array(41 * 3);
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
    const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.1, gapSize: 0.05 }));
    pendulumGroup.add(arcLine);

    // =========================================================
    // 5. STOKES VISCOSITY 3D GROUP
    // =========================================================
    const stokesGroup = new THREE.Group();
    scene.add(stokesGroup);

    const stokesStand = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.25, 3.0),
      darkFrameMat
    );
    stokesStand.position.set(0, 0.125, 0);
    stokesStand.receiveShadow = true;
    stokesGroup.add(stokesStand);

    const stokesPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 6.2, 16),
      brushedSteelMat
    );
    stokesPillar.position.set(-1.4, 3.1, 0);
    stokesPillar.castShadow = true;
    stokesGroup.add(stokesPillar);

    // Glass cylinder
    const glassCylMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      roughness: 0.05,
      transmission: 0.96,
      thickness: 0.8,
      ior: 1.52,
      reflectivity: 0.5,
    });
    const stokesGlassCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 5.2, 32, 1, true),
      glassCylMat
    );
    stokesGlassCyl.position.set(0, 2.7, 0);
    stokesGroup.add(stokesGlassCyl);

    // Liquid inside
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.65,
      roughness: 0.2,
    });
    const stokesLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 4.8, 32),
      liquidMat
    );
    stokesLiquid.position.set(0, 2.5, 0);
    stokesLiquid.userData = { draggableParam: 'fluidViscosity', min: 0.1, max: 2.0, step: 0.05, label: 'Viskositas η' };
    stokesGroup.add(stokesLiquid);

    // Laser timing gate rings
    const gateTop = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    gateTop.rotation.x = Math.PI / 2;
    gateTop.position.set(0, 4.2, 0);
    const gateBottom = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    gateBottom.rotation.x = Math.PI / 2;
    gateBottom.position.set(0, 1.4, 0);
    stokesGroup.add(gateTop, gateBottom);

    // Falling metal sphere
    const stokesSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 24, 24),
      brushedSteelMat
    );
    stokesSphere.position.set(0, 4.5, 0);
    stokesSphere.castShadow = true;
    stokesSphere.userData = { draggableParam: 'sphereRadius', min: 1, max: 20, step: 0.5, label: 'Jari-jari Bola r' };
    stokesGroup.add(stokesSphere);

    const stokesDragArrow = createArrowGroup(0x38bdf8);
    const stokesGravArrow = createArrowGroup(0xf43f5e);
    stokesGroup.add(stokesDragArrow, stokesGravArrow);

    // =========================================================
    // 6. OHM & WHEATSTONE BRIDGE 3D GROUP
    // =========================================================
    const wheatstoneGroup = new THREE.Group();
    scene.add(wheatstoneGroup);

    const circuitTable = new THREE.Mesh(
      new THREE.BoxGeometry(9.0, 0.2, 6.0),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    circuitTable.position.set(0, 0.1, 0);
    circuitTable.receiveShadow = true;
    wheatstoneGroup.add(circuitTable);

    // DC Power Supply sitting flush on circuitTable (y = 0.2)
    const powerSupplyBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 1.6),
      darkFrameMat
    );
    powerSupplyBox.position.set(-3.2, 0.9, -1.8);
    powerSupplyBox.castShadow = true;
    powerSupplyBox.userData = { draggableParam: 'circuitVoltage', min: 1, max: 24, step: 1, label: 'Tegangan Sumber V' };
    wheatstoneGroup.add(powerSupplyBox);

    // Binding Post Terminals on Bridge Nodes (Left: A, Top: B, Bottom: D, Right: C)
    const nodePositions = {
      left: new THREE.Vector3(-2.35, 0.28, 0),
      top: new THREE.Vector3(0, 0.28, -1.65),
      bottom: new THREE.Vector3(0, 0.28, 1.65),
      right: new THREE.Vector3(2.35, 0.28, 0),
    };
    const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.26, 16);
    Object.values(nodePositions).forEach((pos) => {
      const post = new THREE.Mesh(postGeo, brassMat);
      post.position.copy(pos);
      post.castShadow = true;
      wheatstoneGroup.add(post);
    });

    // Resistor cylinders arranged in diamond with metallic axial leads resting on posts
    const resistorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.2 });
    const createResistorAssembly = (
      x: number,
      z: number,
      rotY: number,
      bodyColorMat: THREE.Material,
      draggable?: Record<string, unknown>
    ) => {
      const rGroup = new THREE.Group();
      rGroup.position.set(x, 0.34, z);
      rGroup.rotation.y = rotY;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 18), bodyColorMat);
      body.rotation.z = Math.PI / 2;
      body.castShadow = true;
      if (draggable) body.userData = draggable;
      const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 12), brushedSteelMat);
      lead.rotation.z = Math.PI / 2;
      const band1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.186, 0.186, 0.09, 18),
        new THREE.MeshBasicMaterial({ color: 0x1e293b })
      );
      band1.rotation.z = Math.PI / 2;
      band1.position.x = -0.32;
      const band2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.186, 0.186, 0.09, 18),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      band2.rotation.z = Math.PI / 2;
      band2.position.x = 0.28;
      rGroup.add(lead, body, band1, band2);
      return rGroup;
    };

    const r1Assembly = createResistorAssembly(-1.18, 0.82, Math.atan2(1.65, 2.35), resistorMat);
    const r2Assembly = createResistorAssembly(1.18, 0.82, -Math.atan2(1.65, 2.35), resistorMat);
    const r3Assembly = createResistorAssembly(-1.18, -0.82, -Math.atan2(1.65, 2.35), resistorMat);
    const rxAssembly = createResistorAssembly(
      1.18,
      -0.82,
      Math.atan2(1.65, 2.35),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.15 }),
      { draggableParam: 'resistorRx', min: 10, max: 1000, step: 10, label: 'Resistor Rx (Ohm)' }
    );
    wheatstoneGroup.add(r1Assembly, r2Assembly, r3Assembly, rxAssembly);

    // Realistic Curved Electrical Wires (THREE.TubeGeometry + CatmullRomCurve3)
    const addCurvedWire = (pts: THREE.Vector3[], colorHex: number, radius = 0.042) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const wireGeo = new THREE.TubeGeometry(curve, 28, radius, 10, false);
      const wireMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.42,
        metalness: 0.15,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      wireMesh.castShadow = true;
      wheatstoneGroup.add(wireMesh);
    };

    // Red positive lead from DC Power Supply to Left Bridge Node
    addCurvedWire(
      [
        new THREE.Vector3(-2.4, 0.68, -1.1),
        new THREE.Vector3(-2.85, 0.92, -0.55),
        new THREE.Vector3(-2.6, 0.52, -0.15),
        new THREE.Vector3(-2.35, 0.34, 0),
      ],
      0xef4444
    );
    // Blue/Black negative return lead from Right Bridge Node to DC Power Supply
    addCurvedWire(
      [
        new THREE.Vector3(-2.1, 0.68, -1.1),
        new THREE.Vector3(-0.6, 0.76, -2.25),
        new THREE.Vector3(1.65, 0.62, -1.85),
        new THREE.Vector3(2.35, 0.34, 0),
      ],
      0x0ea5e9
    );
    // Center Galvanometer sense leads (Top Node B -> Galvo, Bottom Node D -> Galvo)
    addCurvedWire(
      [
        new THREE.Vector3(0, 0.34, -1.65),
        new THREE.Vector3(-0.28, 0.64, -1.15),
        new THREE.Vector3(-0.18, 0.46, -0.72),
      ],
      0x10b981,
      0.034
    );
    addCurvedWire(
      [
        new THREE.Vector3(0, 0.34, 1.65),
        new THREE.Vector3(0.28, 0.64, 1.15),
        new THREE.Vector3(0.18, 0.46, 0.72),
      ],
      0xf59e0b,
      0.034
    );

    // 3D Galvanometer at center with Calibrated Dial & Pivoting 3D Needle
    const galvoBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.96, 0.36, 32),
      brushedSteelMat
    );
    galvoBox.position.set(0, 0.38, 0);
    galvoBox.castShadow = true;
    wheatstoneGroup.add(galvoBox);

    const galvoDialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 32),
      new THREE.MeshBasicMaterial({ color: 0x0f172a })
    );
    galvoDialFace.rotation.x = -Math.PI / 2;
    galvoDialFace.position.set(0, 0.565, 0);
    wheatstoneGroup.add(galvoDialFace);

    const galvoZeroTick = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    galvoZeroTick.rotation.x = -Math.PI / 2;
    galvoZeroTick.position.set(0, 0.57, -0.54);
    wheatstoneGroup.add(galvoZeroTick);

    const galvoNeedle = new THREE.Group();
    galvoNeedle.position.set(0, 0.58, 0.15);
    const galvoNeedlePointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.78, 12),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      })
    );
    galvoNeedlePointer.rotation.x = -Math.PI / 2;
    galvoNeedlePointer.position.set(0, 0, -0.34);
    const galvoPivotCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16),
      brassMat
    );
    galvoNeedle.add(galvoNeedlePointer, galvoPivotCap);
    wheatstoneGroup.add(galvoNeedle);

    // =========================================================
    // 7. YOUNG'S DOUBLE SLIT OPTICS 3D GROUP
    // =========================================================
    const youngSlitGroup = new THREE.Group();
    scene.add(youngSlitGroup);

    const optBenchRail = new THREE.Mesh(
      new THREE.BoxGeometry(11.0, 0.18, 0.6),
      darkFrameMat
    );
    optBenchRail.position.set(0, 0.09, 0);
    optBenchRail.receiveShadow = true;
    youngSlitGroup.add(optBenchRail);

    // Laser Emitter Housing at left + Grounded Optical Post Pedestal (zero floating)
    const laserEmitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 1.0),
      brushedSteelMat
    );
    laserEmitter.position.set(-4.8, 1.2, 0);
    laserEmitter.castShadow = true;
    laserEmitter.userData = { draggableParam: 'lightWavelength', min: 400, max: 700, step: 10, label: 'Panjang Gelombang λ' };
    youngSlitGroup.add(laserEmitter);

    const laserMountPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 0.52, 16),
      darkFrameMat
    );
    laserMountPost.position.set(-4.8, 0.42, 0);
    laserMountPost.castShadow = true;
    youngSlitGroup.add(laserMountPost);

    const laserBeamLine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 3.2, 12),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    laserBeamLine.rotation.z = Math.PI / 2;
    laserBeamLine.position.set(-2.8, 1.2, 0);
    youngSlitGroup.add(laserBeamLine);

    // Double Slit Aperture Plate + Grounded Post
    const slitPlateGroup = new THREE.Group();
    slitPlateGroup.position.set(-1.2, 1.2, 0);
    youngSlitGroup.add(slitPlateGroup);

    const slitPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.8, 1.4),
      darkFrameMat
    );
    slitPlate.castShadow = true;
    slitPlate.userData = { draggableParam: 'slitDistance', min: 0.05, max: 0.8, step: 0.02, label: 'Jarak Celah d' };
    slitPlateGroup.add(slitPlate);

    const slitMountPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.16, 0.28, 16),
      brushedSteelMat
    );
    slitMountPost.position.set(0, -0.98, 0);
    slitPlateGroup.add(slitMountPost);

    // Screen + Grounded Post
    const screenCarrier = new THREE.Group();
    screenCarrier.position.set(3.8, 1.4, 0);
    youngSlitGroup.add(screenCarrier);

    // Fringe texture canvas
    const fringeCanvas = document.createElement('canvas');
    fringeCanvas.width = 512;
    fringeCanvas.height = 256;
    const fringeTexture = new THREE.CanvasTexture(fringeCanvas);
    fringeTexture.colorSpace = THREE.SRGBColorSpace;

    const projScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 2.6),
      new THREE.MeshBasicMaterial({ map: fringeTexture, side: THREE.DoubleSide })
    );
    projScreen.rotation.y = -Math.PI / 2;
    projScreen.userData = { draggableParam: 'screenDistance', min: 0.5, max: 3.0, step: 0.1, label: 'Jarak Layar L' };
    const screenMountPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.18, 0.26, 16),
      brushedSteelMat
    );
    screenMountPost.position.set(0, -1.2, 0);
    screenCarrier.add(projScreen, screenMountPost);

    // =========================================================
    // 8. PHOTOELECTRIC PLANCK 3D GROUP
    // =========================================================
    const photoelectricGroup = new THREE.Group();
    scene.add(photoelectricGroup);

    const peBase = new THREE.Mesh(
      new THREE.BoxGeometry(8.0, 0.2, 4.0),
      darkFrameMat
    );
    peBase.position.set(0, 0.1, 0);
    peBase.receiveShadow = true;
    photoelectricGroup.add(peBase);

    // Dual cradle mounts supporting the glass phototube flush onto peBase (zero floating)
    const peCradleLeft = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.42, 1.2, 2, 0.03),
      darkFrameMat
    );
    peCradleLeft.position.set(-1.1, 0.38, 0);
    const peCradleRight = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.42, 1.2, 2, 0.03),
      darkFrameMat
    );
    peCradleRight.position.set(1.1, 0.38, 0);
    photoelectricGroup.add(peCradleLeft, peCradleRight);

    // Glass Phototube bulb
    const peBulb = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 3.2, 28),
      glassCylMat
    );
    peBulb.rotation.z = Math.PI / 2;
    peBulb.position.set(0, 1.6, 0);
    photoelectricGroup.add(peBulb);

    // Cathode plate
    const peCathode = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.15 })
    );
    peCathode.rotation.x = Math.PI / 2;
    peCathode.position.set(-1.1, 1.6, 0);
    peCathode.userData = { draggableParam: 'targetMetalWorkFunction', min: 2.0, max: 5.5, step: 0.1, label: 'Fungsi Kerja W (eV)' };
    photoelectricGroup.add(peCathode);

    // Anode collector ring
    const peAnode = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.06, 12, 28),
      brassMat
    );
    peAnode.rotation.y = Math.PI / 2;
    peAnode.position.set(1.1, 1.6, 0);
    peAnode.userData = { draggableParam: 'stoppingPotential', min: 0, max: 5.0, step: 0.1, label: 'Potensial Penghenti V₀' };
    photoelectricGroup.add(peAnode);

    // Photoelectron particles
    const PE_PARTICLES_COUNT = 30;
    const peParticles: THREE.Mesh[] = [];
    const peParticleGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const peParticleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let i = 0; i < PE_PARTICLES_COUNT; i++) {
      const pMesh = new THREE.Mesh(peParticleGeo, peParticleMat);
      peParticles.push(pMesh);
      photoelectricGroup.add(pMesh);
    }

    // =========================================================
    // 8b. 1D COLLISION MOMENTUM 3D GROUP (AIR-TRACK GLIDER CARTS)
    // =========================================================
    const collisionGroup = new THREE.Group();
    scene.add(collisionGroup);

    const airTrackRail = new THREE.Mesh(
      new RoundedBoxGeometry(11.4, 0.28, 1.85, 3, 0.03),
      darkFrameMat
    );
    airTrackRail.position.set(0, 0.14, 0);
    airTrackRail.receiveShadow = true;
    collisionGroup.add(airTrackRail);

    // Anodized V-ridge aluminum air-track extrusion & graduated cm ruler strip
    const airTrackRidge = new THREE.Mesh(
      new RoundedBoxGeometry(11.3, 0.12, 0.72, 2, 0.02),
      brushedSteelMat
    );
    airTrackRidge.position.set(0, 0.32, 0);
    airTrackRidge.receiveShadow = true;
    collisionGroup.add(airTrackRidge);

    if (airTrackScaleTex) {
      const airTrackRuler = new THREE.Mesh(
        new THREE.PlaneGeometry(10.8, 0.24),
        new THREE.MeshBasicMaterial({
          map: airTrackScaleTex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      );
      airTrackRuler.rotation.z = -Math.PI / 2;
      airTrackRuler.position.set(0, 0.15, 0.935);
      collisionGroup.add(airTrackRuler);
    }

    // Helper: Composite Precision Dynamics Cart / Glider Air-Track (Trapezoidal Saddle + Spring Bumpers + Photogate Flag)
    const createAirTrackGliderCart = (
      hullMat: THREE.Material,
      facingSign: 1 | -1,
      draggable: Record<string, unknown>
    ) => {
      const cartGroup = new THREE.Group();

      // 1. Primary precision glider saddle hull
      const hullMesh = new THREE.Mesh(
        new RoundedBoxGeometry(1.18, 0.44, 0.92, 3, 0.045),
        hullMat
      );
      hullMesh.position.set(0, 0.02, 0);
      hullMesh.castShadow = true;
      hullMesh.receiveShadow = true;
      hullMesh.userData = draggable;
      cartGroup.add(hullMesh);

      // 2. Trapezoidal beveled top mass deck & photogate optical interruption fin
      const topDeck = new THREE.Mesh(
        new RoundedBoxGeometry(0.86, 0.16, 0.74, 2, 0.025),
        brushedSteelMat
      );
      topDeck.position.set(0, 0.31, 0);
      topDeck.castShadow = true;
      topDeck.userData = draggable;
      const flagFin = new THREE.Mesh(
        new BoxGeometry(0.22, 0.34, 0.05),
        darkFrameMat
      );
      flagFin.position.set(0, 0.52, 0);
      cartGroup.add(topDeck, flagFin);

      // 3. Low-friction air-cushion skirt rails hugging the track ridge
      const skirtGeo = new THREE.BoxGeometry(1.16, 0.16, 0.09);
      const skirtFront = new THREE.Mesh(skirtGeo, darkFrameMat);
      skirtFront.position.set(0, -0.22, 0.41);
      const skirtBack = new THREE.Mesh(skirtGeo, darkFrameMat);
      skirtBack.position.set(0, -0.22, -0.41);
      cartGroup.add(skirtFront, skirtBack);

      // 4. Precision spring bumper assembly on impact face
      const bumperStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.24, 14),
        brushedSteelMat
      );
      bumperStem.rotation.z = Math.PI / 2;
      bumperStem.position.set(facingSign * 0.68, 0.02, 0);

      const bumperCoil = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.032, 10, 20),
        brassMat
      );
      bumperCoil.rotation.y = Math.PI / 2;
      bumperCoil.position.set(facingSign * 0.68, 0.02, 0);

      const bumperPlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.06, 0.32, 0.62, 2, 0.015),
        brushedSteelMat
      );
      bumperPlate.position.set(facingSign * 0.81, 0.02, 0);
      bumperPlate.castShadow = true;
      cartGroup.add(bumperStem, bumperCoil, bumperPlate);

      return cartGroup;
    };

    const { BoxGeometry } = THREE;
    const cart1Mesh = createAirTrackGliderCart(primaryMassMat, 1, {
      draggableParam: 'initialVelocity',
      min: 1,
      max: 30,
      step: 1,
      label: 'Kecepatan Awal v₁',
    });
    cart1Mesh.position.set(-3.2, 0.62, 0);
    collisionGroup.add(cart1Mesh);

    const cart2Mesh = createAirTrackGliderCart(brassMat, -1, {
      draggableParam: 'collisionMass2',
      min: 0.5,
      max: 25,
      step: 0.5,
      label: 'Massa Benda m₂',
    });
    cart2Mesh.position.set(2.4, 0.62, 0);
    collisionGroup.add(cart2Mesh);

    const collVec1 = createArrowGroup(0x38bdf8);
    const collVec2 = createArrowGroup(0xf59e0b);
    collisionGroup.add(collVec1, collVec2);

    // =========================================================
    // 8c. UNIVERSAL GRAVITY & ORBITAL 3D GROUP
    // =========================================================
    const orbitalGroup = new THREE.Group();
    scene.add(orbitalGroup);

    const centralPlanetBody = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 32, 32),
      primaryMassMat
    );
    centralPlanetBody.position.set(0, 2.2, 0);
    centralPlanetBody.castShadow = true;
    centralPlanetBody.userData = { draggableParam: 'mass', min: 1, max: 50, step: 1, label: 'Massa Primer M₁' };
    orbitalGroup.add(centralPlanetBody);

    const satelliteBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 24),
      brassMat
    );
    satelliteBody.position.set(3.8, 2.2, 0);
    satelliteBody.castShadow = true;
    satelliteBody.userData = { draggableParam: 'separationDistance', min: 2, max: 30, step: 0.5, label: 'Jarak Pisah r' };
    orbitalGroup.add(satelliteBody);

    const orbitRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(3.75, 3.83, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    orbitRingMesh.rotation.x = -Math.PI / 2;
    orbitRingMesh.position.set(0, 2.2, 0);
    orbitalGroup.add(orbitRingMesh);

    const gravVec1 = createArrowGroup(0x10b981);
    const gravVec2 = createArrowGroup(0xf43f5e);
    orbitalGroup.add(gravVec1, gravVec2);

    // =========================================================
    // 9. SAFETY HAZARD 3D SMOKE & ALARM LIGHT GROUP (FITUR 5)
    // =========================================================
    const hazardGroup = new THREE.Group();
    hazardGroup.visible = false;
    scene.add(hazardGroup);

    const hazardLight = new THREE.PointLight(0xff1e42, 0, 18);
    hazardLight.position.set(0, 4.5, 2.0);
    hazardGroup.add(hazardLight);

    const hazardRingGeo = new THREE.TorusGeometry(2.75, 0.048, 12, 48);
    const hazardRingMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.78,
    });
    const hazardPerimeterRing = new THREE.Mesh(hazardRingGeo, hazardRingMat);
    hazardPerimeterRing.rotation.x = Math.PI / 2;
    hazardPerimeterRing.position.set(0, 0.25, 0);
    hazardGroup.add(hazardPerimeterRing);

    const HAZARD_SMOKE_COUNT = 28;
    const hazardSmokeMeshes: THREE.Mesh[] = [];
    const smokeGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.45,
    });
    for (let i = 0; i < HAZARD_SMOKE_COUNT; i++) {
      const sMesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      sMesh.position.set(
        (Math.random() - 0.5) * 4.5,
        0.5 + Math.random() * 3.5,
        (Math.random() - 0.5) * 2.5
      );
      hazardSmokeMeshes.push(sMesh);
      hazardGroup.add(sMesh);
    }

    // =========================================================
    // DIRECT 3D MESH DRAGGING (RAYCASTER GIZMOS)
    // =========================================================
    let isDragging = false;
    let activeDragMesh: THREE.Object3D | null = null;
    let dragParamKey = '';
    let dragStartPos = { x: 0, y: 0 };
    let dragStartVal = 0;
    let dragConfig = { min: 0, max: 100, step: 1, label: '' };
    const dragRaycaster = new THREE.Raycaster();
    const dragMouse = new THREE.Vector2();
    let hoveredMesh: THREE.Mesh | null = null;
    const origEmissive = new THREE.Color();
    const gizmoWorldPos = new THREE.Vector3();
    const pendBobWorldPos = new THREE.Vector3();
    const conceptProjVec = new THREE.Vector3();
    const conceptBlockWorldPos = new THREE.Vector3();
    const conceptPivotWorldPos = new THREE.Vector3();

    const getInteractiveMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible && obj.userData?.draggableParam) {
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
          activeDragMesh = hitObj;
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
          if (paramKey === 'launchAngle' || paramKey === 'initialVelocity') {
            cannonSoundEmitter.play();
          } else {
            labSound.playClick(600);
          }
          setDragToast({ label: dragConfig.label, value: `${curVal}` });
        }
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        if (dragParamKey === 'springDisplacement' || dragParamKey === 'springConstantK') {
          labSound.playSpringTwang(latestRef.current.params.springDisplacement ?? 0.8);
        }
        isDragging = false;
        activeDragMesh = null;
        dragParamKey = '';
        controls.enabled = true;
        renderer.domElement.style.cursor = hoveredMesh ? 'grab' : 'default';
        setTimeout(() => setDragToast(null), 1200);
      }
    };

    // Main Tick Loop
    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;

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
    let lastCollisionImpactIndex = -1;

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

      const {
        params: p,
        metrics: m,
        simTime: baseTime,
        showVectorOverlay: rawShowVec,
      } = latestRef.current;

      const nowSec = performance.now() / 1000;
      const t = simTimeRef && typeof simTimeRef.current === 'number' ? simTimeRef.current : baseTime;

      const isKnownSpecialMode =
        p.mode === 'projectile-gravity' ||
        (p.mode as string) === 'projectile-motion' ||
        p.mode === 'spring-hooke' ||
        p.mode === 'pendulum-harmonic' ||
        p.mode === 'collision-momentum' ||
        p.mode === 'orbital-gravity' ||
        (p.mode as string) === 'gravity-orbital' ||
        p.mode === 'stokes-viscosity' ||
        p.mode === 'ohm-wheatstone' ||
        p.mode === 'optics-young-slit' ||
        p.mode === 'photoelectric-planck';

      inclineGroup.visible = p.mode === 'newton-incline' || !isKnownSpecialMode;
      projectileGroup.visible = p.mode === 'projectile-gravity' || (p.mode as string) === 'projectile-motion';
      springGroup.visible = p.mode === 'spring-hooke';
      pendulumGroup.visible = p.mode === 'pendulum-harmonic';
      collisionGroup.visible = p.mode === 'collision-momentum';
      orbitalGroup.visible = p.mode === 'orbital-gravity' || (p.mode as string) === 'gravity-orbital';
      stokesGroup.visible = p.mode === 'stokes-viscosity';
      wheatstoneGroup.visible = p.mode === 'ohm-wheatstone';
      youngSlitGroup.visible = p.mode === 'optics-young-slit';
      photoelectricGroup.visible = p.mode === 'photoelectric-planck';

      const isSimTimeAdvancing = prevSimTime >= 0 && t > prevSimTime + 0.0005;
      prevSimTime = t;

      // Safety Hazard 3D Smoke, Perimeter Halo & Pulsing Red Light
      const isHazardous =
        (p.mode === 'pendulum-harmonic' && Math.abs(p.pendulumAngle ?? 0) > 80) ||
        (p.mass >= 24 && Math.abs(p.appliedForce) >= 180) ||
        (p.mode === 'spring-hooke' && Math.abs(p.springDisplacement) >= 1.8 && p.springConstantK >= 180);

      hazardGroup.visible = isHazardous;
      if (isHazardous) {
        hazardLight.intensity = isLite ? 0 : 3.5 + Math.sin(nowSec * 14) * 2.5;
        const pulse = 1 + Math.sin(nowSec * 9) * 0.08;
        hazardPerimeterRing.scale.set(pulse, pulse, 1);
        hazardRingMat.opacity = 0.48 + 0.35 * Math.abs(Math.sin(nowSec * 7));
        hazardSmokeMeshes.forEach((sMesh, idx) => {
          const cycle = (nowSec * 1.4 + idx * 0.17) % 1.0;
          sMesh.position.y = 0.4 + cycle * 4.2;
          sMesh.position.x = Math.sin(nowSec * 2.2 + idx) * (1.2 + cycle * 1.6);
          sMesh.position.z = Math.cos(nowSec * 1.8 + idx) * (0.8 + cycle * 1.1);
          sMesh.scale.setScalar(0.6 + cycle * 1.8);
          (sMesh.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.55;
        });
      }

      const showLabels = showConceptLabelsRef.current;
      const showVec = rawShowVec || showLabels;

      // 1. Incline & General Mechanics update
      if (inclineGroup.visible) {
        const effectiveAngle = p.mode === 'newton-incline' ? p.inclineAngle : 0;
        const thetaRad = (effectiveAngle * Math.PI) / 180;
        pivotGroup.rotation.z = thetaRad;
        const strutH = Math.max(0.15, 7.8 * Math.tan(thetaRad));
        supportPillar.scale.set(1, strutH, 1);
        supportPillar.position.set(3.2, 0.24 + strutH / 2, 0);

        const cycleT = t % 3.2;
        const rawDisp = p.initialVelocity * cycleT + 0.5 * m.acceleration * cycleT * cycleT;
        const wrappedDisp = ((rawDisp % 26) + 26) % 26;
        const rampPos = 1.6 + Math.max(-1.0, Math.min(26, Math.abs(m.acceleration) > 0.05 ? wrappedDisp : rawDisp)) * 0.22;
        blockGroup.position.set(rampPos, 0, 0);

        if (showVec) {
          const origin = new THREE.Vector3(0, 0.45, 0);
          orientAndScaleArrow(
            arrowApplied,
            origin,
            new THREE.Vector3(p.appliedForce >= 0 ? 1 : -1, 0, 0),
            Math.min(2.6, Math.abs(p.appliedForce) / 35)
          );
          orientAndScaleArrow(
            arrowFriction,
            origin,
            new THREE.Vector3(m.netForce >= 0 ? -1 : 1, 0, 0),
            Math.min(2.2, Math.abs(m.frictionForce) / 25)
          );
          orientAndScaleArrow(
            arrowNormal,
            origin,
            new THREE.Vector3(0, 1, 0),
            Math.min(2.4, m.normalForce / 45)
          );
          orientAndScaleArrow(
            arrowWeight,
            origin,
            new THREE.Vector3(-Math.sin(thetaRad), -Math.cos(thetaRad), 0),
            Math.min(2.5, m.weightForce / 45)
          );
        } else {
          arrowApplied.visible = false;
          arrowFriction.visible = false;
          arrowNormal.visible = false;
          arrowWeight.visible = false;
        }
      }

      // 2. Projectile update + Real-time Motion Trail
      else if (p.mode === 'projectile-gravity' || (p.mode as string) === 'projectile-motion') {
        const maxRange = Math.max(35, m.projectileRange * 1.1);
        const scaleX = 10.4 / maxRange;
        const scaleY = 4.8 / Math.max(18, m.maxProjectileHeight * 1.15);
        cannonPivot.rotation.z = (p.launchAngle * Math.PI) / 180;

        const flightT = Math.max(0.5, m.timeOfFlight);
        const posAttr = trajGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= 60; i++) {
          const sampleT = (i / 60) * flightT;
          const sampleInst = evaluateKinematicsAtTime(p, sampleT);
          const sx = -5.2 + sampleInst.positionX * scaleX;
          const sy = Math.max(0.05, 0.25 + sampleInst.positionY * scaleY);
          posAttr.setXYZ(i, sx, sy, 0);
        }
        posAttr.needsUpdate = true;
        trajLine.computeLineDistances();

        const loopT = t % Math.max(1.5, flightT + 0.35);
        const loopInst = evaluateKinematicsAtTime(p, Math.min(loopT, flightT));
        const curX = -5.2 + loopInst.positionX * scaleX;
        const curY = 0.25 + loopInst.positionY * scaleY;
        projectileBall.position.set(curX, curY, 0);
        projectileMotionTrail.pushSample(projectileBall.position);
        targetRing.position.set(-5.2 + m.projectileRange * scaleX, 0.03, 0);

        if (followCamRef.current && !camTransitionActive && !isDragging) {
          const followTargetX = THREE.MathUtils.clamp(curX * 0.45, -3.2, 3.8);
          const followTargetY = THREE.MathUtils.clamp(Math.max(1.2, curY * 0.55), 1.1, 4.2);
          controls.target.x = THREE.MathUtils.lerp(controls.target.x, followTargetX, 0.08);
          controls.target.y = THREE.MathUtils.lerp(controls.target.y, followTargetY, 0.08);
        }
      }

      // 3. Spring update
      else if (p.mode === 'spring-hooke') {
        const omega = Math.sqrt(Math.max(1, p.springConstantK) / Math.max(0.2, p.mass));
        const amp = Math.abs(p.springDisplacement) > 0.05 ? p.springDisplacement : 0.85;
        const damp = Math.exp(-0.04 * (p.dampingCoeff ?? 0.15) * (t % 6.0));
        const liveX = amp * damp * Math.cos(omega * t);
        const massX = 0.5 + liveX * 2.1;
        springMassBlock.position.set(massX, 0.87, 0);
        const span = Math.max(0.8, massX - 0.65 - -4.95);
        springRings.forEach((ring, idx) => {
          ring.position.set(-4.95 + ((idx + 0.5) / springRings.length) * span, 0.87, 0);
        });
        if (showVec) {
          const fSpring = -(p.springConstantK) * liveX;
          orientAndScaleArrow(
            springForceArrow,
            new THREE.Vector3(massX, 1.85, 0),
            new THREE.Vector3(fSpring >= 0 ? 1 : -1, 0, 0),
            Math.min(2.4, Math.abs(fSpring) / 60)
          );
        } else {
          springForceArrow.visible = false;
        }
      }

      // 4. Pendulum update + Real-time Motion Trail
      else if (p.mode === 'pendulum-harmonic') {
        const L = Math.max(0.3, p.pendulumLength ?? 1.2);
        const omegaP = Math.sqrt(Math.max(1.0, p.gravity) / L);
        const maxAngleRad = ((p.pendulumAngle ?? 25) * Math.PI) / 180;
        const thetaRad = maxAngleRad * Math.cos(omegaP * t);
        pendPivotGroup.rotation.z = thetaRad;
        pendRod.scale.set(1, L * 1.5, 1);
        pendRod.position.set(0, -L * 0.75, 0);
        pendBob.position.set(0, -L * 1.5, 0);
        pendBob.getWorldPosition(pendBobWorldPos);
        pendulumMotionTrail.pushSample(pendBobWorldPos);

        if (showVec) {
          orientAndScaleArrow(
            pendGravityArrow,
            pendBobWorldPos,
            new THREE.Vector3(0, -1, 0),
            0.95
          );
          const signT = thetaRad >= 0 ? 1 : -1;
          orientAndScaleArrow(
            pendRestoringArrow,
            pendBobWorldPos,
            new THREE.Vector3(-Math.cos(thetaRad) * signT, -Math.sin(thetaRad) * signT, 0),
            Math.min(1.6, Math.abs(Math.sin(thetaRad)) * 2.2)
          );
        } else {
          pendGravityArrow.visible = false;
          pendRestoringArrow.visible = false;
        }
      }

      // 4b. 1D Collision Momentum update (Glider Air-Track)
      else if (p.mode === 'collision-momentum') {
        const cycle = (t % 3.4);
        const r1 = 0.46 + Math.min(0.32, p.mass * 0.014);
        const r2 = 0.46 + Math.min(0.32, (p.collisionMass2 || 2) * 0.014);
        cart1Mesh.scale.set(r1 / 0.52, 1, 1);
        cart2Mesh.scale.set(r2 / 0.52, 1, 1);

        const v1Init = p.initialVelocity !== 0 ? p.initialVelocity : 8;
        const v2Init = p.velocity2Initial ?? -4;
        const impactT = 1.4;
        let x1 = 0;
        let x2 = 0;
        let curV1 = v1Init;
        let curV2 = v2Init;

        if (cycle < impactT) {
          const dtToImpact = impactT - cycle;
          x1 = -r1 - Math.max(0.5, Math.abs(v1Init) * 0.22) * dtToImpact;
          x2 = r2 + Math.max(0.5, Math.abs(v2Init) * 0.22) * dtToImpact;
        } else {
          const postT = cycle - impactT;
          curV1 = m.v1Final;
          curV2 = m.v2Final;
          x1 = Math.max(-5.0, Math.min(5.0, -r1 + curV1 * 0.22 * postT));
          x2 = Math.max(-5.0, Math.min(5.0, r2 + curV2 * 0.22 * postT));
        }

        const cycleIndex = Math.floor(t / 3.4);
        if (cycle >= impactT) {
          if (isSimTimeAdvancing && lastCollisionImpactIndex !== cycleIndex) {
            lastCollisionImpactIndex = cycleIndex;
            labSound.playCollisionThud(p.restitutionCoeff ?? 1.0);
          }
        } else if (cycle < 0.4) {
          lastCollisionImpactIndex = -1;
        }

        // Seated flush on air-track ridge at y = 0.56
        cart1Mesh.position.set(x1, 0.56, 0);
        cart2Mesh.position.set(x2, 0.56, 0);

        if (showVec) {
          orientAndScaleArrow(
            collVec1,
            new THREE.Vector3(x1, 1.38, 0),
            new THREE.Vector3(curV1 >= 0 ? 1 : -1, 0, 0),
            Math.min(2.2, Math.abs(curV1) * 0.14)
          );
          orientAndScaleArrow(
            collVec2,
            new THREE.Vector3(x2, 1.38, 0),
            new THREE.Vector3(curV2 >= 0 ? 1 : -1, 0, 0),
            Math.min(2.2, Math.abs(curV2) * 0.14)
          );
        } else {
          collVec1.visible = false;
          collVec2.visible = false;
        }
      }

      // 4c. Universal Gravity & Orbital update
      else if (p.mode === 'orbital-gravity' || (p.mode as string) === 'gravity-orbital') {
        const orbitRadius = Math.max(2.0, Math.min(5.2, (p.separationDistance || 5) * 0.35));
        const angle = nowSec * 1.15;
        const sx = Math.cos(angle) * orbitRadius;
        const sz = Math.sin(angle) * orbitRadius;
        satelliteBody.position.set(sx, 2.2, sz);
        orbitRingMesh.scale.setScalar(orbitRadius / 3.79);

        if (showVec) {
          const dirToSat = new THREE.Vector3(sx, 0, sz).normalize();
          const dirToCenter = dirToSat.clone().negate();
          const arrowLen = Math.max(0.6, Math.min(2.0, Math.log10(Math.max(10, m.universalGravityForce * 1e4)) * 0.45));
          orientAndScaleArrow(gravVec1, new THREE.Vector3(0, 2.2, 0), dirToSat, arrowLen);
          orientAndScaleArrow(gravVec2, new THREE.Vector3(sx, 2.2, sz), dirToCenter, arrowLen);
        } else {
          gravVec1.visible = false;
          gravVec2.visible = false;
        }
      }

      // 5. Stokes update
      else if (p.mode === 'stokes-viscosity') {
        const vt = m.stokesTerminalVelocity ?? 0.8;
        const yPos = 4.6 - ((t * Math.max(0.35, vt)) % 3.6);
        stokesSphere.position.y = yPos;
        const rScale = (p.sphereRadius ?? 5) / 10;
        stokesSphere.scale.setScalar(rScale);
        if (showVec) {
          orientAndScaleArrow(stokesGravArrow, new THREE.Vector3(0, yPos, 0), new THREE.Vector3(0, -1, 0), 1.2);
          orientAndScaleArrow(stokesDragArrow, new THREE.Vector3(0, yPos, 0), new THREE.Vector3(0, 1, 0), Math.min(1.8, (m.stokesDragForce ?? 0.05) * 8));
        } else {
          stokesGravArrow.visible = false;
          stokesDragArrow.visible = false;
        }
      }

      // 6. Wheatstone update (Signed Galvanometer Deflection)
      else if (p.mode === 'ohm-wheatstone') {
        const ig = m.galvanometerCurrent ?? 0;
        const r1Val = Math.max(1, p.resistorR1 ?? 100);
        const r2Val = Math.max(1, p.resistorR2 ?? 100);
        const r3Val = Math.max(1, p.resistorR3 ?? 100);
        const rxVal = Math.max(1, p.resistorRx ?? 100);
        const vDiff = (r2Val / (r1Val + r2Val)) - (rxVal / (r3Val + rxVal));
        const dirSign = Math.abs(vDiff) < 1e-4 ? 0 : Math.sign(vDiff);
        const targetNeedleAngle = Math.max(-0.68, Math.min(0.68, dirSign * (ig / 45) * Math.PI * 0.42));
        galvoNeedle.rotation.y = THREE.MathUtils.lerp(
          galvoNeedle.rotation.y,
          targetNeedleAngle + (dirSign !== 0 ? Math.sin(nowSec * 6) * 0.012 : 0),
          0.16
        );
      }

      // 7. Young's slit update
      else if (p.mode === 'optics-young-slit') {
        const wl = p.lightWavelength ?? 532;
        const beamColor = wavelengthToHex(wl);
        (laserBeamLine.material as THREE.MeshBasicMaterial).color.setHex(beamColor);

        const ctx = fringeCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#050811';
          ctx.fillRect(0, 0, fringeCanvas.width, fringeCanvas.height);
          const fringeSpacing = Math.max(8, (m.fringeSpacingMm ?? 3.5) * 8);
          const rgbHex = beamColor.toString(16).padStart(6, '0');
          for (let x = 0; x < fringeCanvas.width; x++) {
            const intensity = Math.pow(Math.cos(((x - 256) / fringeSpacing) * Math.PI), 2);
            ctx.fillStyle = `#${rgbHex}`;
            ctx.globalAlpha = intensity;
            ctx.fillRect(x, 0, 1, fringeCanvas.height);
          }
          ctx.globalAlpha = 1.0;
          fringeTexture.needsUpdate = true;
        }
      }

      // 8. Photoelectric update
      else if (p.mode === 'photoelectric-planck') {
        const emitted = m.photoelectricEmitted ?? true;
        peParticles.forEach((particle, idx) => {
          if (!emitted) {
            particle.visible = false;
            return;
          }
          particle.visible = true;
          const pFrac = (nowSec * 0.85 + idx / PE_PARTICLES_COUNT) % 1.0;
          const stopV = p.stoppingPotential ?? 1.5;
          const maxKe = m.photoelectricMaxKe ?? 1.2;
          if (stopV > maxKe) {
            const turnX = -1.1 + (maxKe / stopV) * 2.0;
            const x = pFrac < 0.5 ? -1.1 + (turnX - -1.1) * (pFrac * 2) : turnX - (turnX - -1.1) * ((pFrac - 0.5) * 2);
            particle.position.set(x, 1.6 + Math.sin(idx * 2) * 0.35, Math.cos(idx * 2) * 0.35);
          } else {
            particle.position.set(-1.1 + pFrac * 2.2, 1.6 + Math.sin(idx) * 0.3, Math.cos(idx) * 0.3);
          }
        });
      }

      // Update Floating Accent Glow Ring Gizmo on Hovered / Active Drag Object
      const gizmoTarget = activeDragMesh || hoveredMesh;
      if (gizmoTarget) {
        gizmoTarget.getWorldPosition(gizmoWorldPos);
        hoverGizmoGroup.visible = true;
        hoverGizmoGroup.position.copy(gizmoWorldPos);
        hoverGizmoGroup.rotation.y = nowSec * 2.2;
        const pulseScale = (isDragging ? 1.18 : 1.0) + Math.sin(nowSec * 6.0) * 0.08;
        hoverGizmoGroup.scale.setScalar(pulseScale);
        (outerGizmoRing.material as THREE.MeshBasicMaterial).color.setHex(
          isDragging ? 0x10b981 : 0x38bdf8
        );
      } else {
        hoverGizmoGroup.visible = false;
      }

      // Update cursors
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

      teacherCollabBridge.tick(nowMs);
      controls.update();

      const syncConceptLabelsNow = () => {
        const { params: curP, metrics: curM } = latestRef.current;
        const activeLabels = showConceptLabelsRef.current;
        const cDom = conceptDomRef.current;
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;
        const cEntries = [
          { dom: cDom.c1, worldPos: new THREE.Vector3(), text: '', active: false },
          { dom: cDom.c2, worldPos: new THREE.Vector3(), text: '', active: false },
          { dom: cDom.c3, worldPos: new THREE.Vector3(), text: '', active: false },
          { dom: cDom.c4, worldPos: new THREE.Vector3(), text: '', active: false },
        ];

        if (activeLabels) {
          if (inclineGroup.visible) {
            massBox.getWorldPosition(conceptBlockWorldPos);
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(0, 1.35, 0)),
              text: `Gaya Dorong F = ${curP.appliedForce.toFixed(0)} N`,
              active: true,
            };
            cEntries[1] = {
              dom: cDom.c2,
              worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(-0.9, 0.35, 0)),
              text: `Gesek fₖ = ${curM.frictionForce.toFixed(1)} N`,
              active: true,
            };
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(0.75, 0.9, 0)),
              text: `Normal N = ${curM.normalForce.toFixed(1)} N`,
              active: true,
            };
            cEntries[3] = {
              dom: cDom.c4,
              worldPos: conceptBlockWorldPos.clone().add(new THREE.Vector3(0.4, -0.75, 0)),
              text: `Berat W = ${curM.weightForce.toFixed(1)} N`,
              active: true,
            };
          } else if (curP.mode === 'pendulum-harmonic') {
            pendPivotGroup.getWorldPosition(conceptPivotWorldPos);
            pendBob.getWorldPosition(pendBobWorldPos);
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: conceptPivotWorldPos.clone().add(new THREE.Vector3(-0.45, -0.35, 0)),
              text: `Panjang Tali L = ${(curP.pendulumLength ?? 1.2).toFixed(2)} m`,
              active: true,
            };
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: pendBobWorldPos.clone().add(new THREE.Vector3(0.55, 0.25, 0)),
              text: `Gaya Pemulih · Periode T = ${(curM.pendulumPeriod ?? 0).toFixed(2)} s`,
              active: true,
            };
            cEntries[3] = {
              dom: cDom.c4,
              worldPos: pendBobWorldPos.clone().add(new THREE.Vector3(0, -0.65, 0)),
              text: `Gravitasi g = ${curP.gravity.toFixed(1)} m/s²`,
              active: true,
            };
          } else if (curP.mode === 'spring-hooke') {
            const sp = springMassBlock.position;
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: new THREE.Vector3(sp.x, sp.y + 1.35, sp.z),
              text: `Gaya Pegas Fₚ = -k·Δx · k = ${curP.springConstantK} N/m`,
              active: true,
            };
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: new THREE.Vector3(sp.x, sp.y + 0.5, sp.z),
              text: `Massa m = ${curP.mass.toFixed(1)} kg`,
              active: true,
            };
          } else if (curP.mode === 'projectile-gravity' || (curP.mode as string) === 'projectile-motion') {
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: projectileBall.position.clone().add(new THREE.Vector3(0, 0.55, 0)),
              text: `Proyektil v₀ = ${curP.initialVelocity} m/s · θ = ${curP.launchAngle}°`,
              active: true,
            };
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: targetRing.position.clone().add(new THREE.Vector3(0, 0.45, 0)),
              text: `Jarak Jatuh R = ${curM.projectileRange.toFixed(1)} m`,
              active: true,
            };
          } else if (curP.mode === 'collision-momentum') {
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: cart1Mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
              text: `Momentum p₁ = ${(curP.mass * curM.v1Final).toFixed(1)} kg·m/s`,
              active: true,
            };
            cEntries[1] = {
              dom: cDom.c2,
              worldPos: cart2Mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
              text: `Momentum p₂ = ${((curP.collisionMass2 || 2) * curM.v2Final).toFixed(1)} kg·m/s`,
              active: true,
            };
          } else if (curP.mode === 'stokes-viscosity') {
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: stokesSphere.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
              text: `Gaya Hambat Stokes ↑ · vₜ = ${(curM.stokesTerminalVelocity ?? 0).toFixed(2)} m/s`,
              active: true,
            };
            cEntries[3] = {
              dom: cDom.c4,
              worldPos: stokesSphere.position.clone().add(new THREE.Vector3(0, -0.75, 0)),
              text: `Gaya Berat Bola ↓`,
              active: true,
            };
          } else if (curP.mode === 'ohm-wheatstone') {
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: new THREE.Vector3(0, 1.0, 0),
              text: `Galvanometer I_g = ${(curM.galvanometerCurrent ?? 0).toFixed(2)} mA`,
              active: true,
            };
            cEntries[1] = {
              dom: cDom.c2,
              worldPos: new THREE.Vector3(1.4, 0.9, -0.8),
              text: `Resistor Uji Rx = ${curP.resistorRx ?? 100} Ω`,
              active: true,
            };
          } else if (curP.mode === 'optics-young-slit') {
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: new THREE.Vector3(-1.2, 2.3, 0),
              text: `Celah Ganda d = ${(curP.slitDistance ?? 0.2).toFixed(2)} mm`,
              active: true,
            };
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: new THREE.Vector3(3.8, 2.9, 0),
              text: `Jarak Frinji Δy = ${(curM.fringeSpacingMm ?? 0).toFixed(2)} mm`,
              active: true,
            };
          } else if (curP.mode === 'photoelectric-planck') {
            cEntries[0] = {
              dom: cDom.c1,
              worldPos: new THREE.Vector3(-1.1, 2.7, 0),
              text: `Katoda Logam (W₀ = ${(curP.targetMetalWorkFunction ?? 2.3).toFixed(1)} eV)`,
              active: true,
            };
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: new THREE.Vector3(0.4, 2.3, 0),
              text: `Ek Maks = ${(curM.photoelectricMaxKe ?? 0).toFixed(2)} eV`,
              active: true,
            };
          } else if (curP.mode === 'orbital-gravity' || (curP.mode as string) === 'gravity-orbital') {
            cEntries[2] = {
              dom: cDom.c3,
              worldPos: satelliteBody.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
              text: `Gaya Gravitasi F_G ∝ 1/r²`,
              active: true,
            };
          }
        }
        updateProjectedConceptLabels(cEntries, camera, cw, ch, activeLabels, conceptProjVec);
      };

      syncConceptLabelsRef.current = syncConceptLabelsNow;
      syncConceptLabelsNow();

      studioComposer.render(isLite);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    let lastEmitTime = 0;

    // Pointer move & Drag Handler
    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (isDragging && dragParamKey && latestRef.current.onUpdateParam) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = dragStartPos.y - e.clientY;
        const sensitivity = (dragConfig.max - dragConfig.min) / 300;
        const delta = (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * sensitivity;
        let nextVal = dragStartVal + delta;
        nextVal = Math.max(dragConfig.min, Math.min(dragConfig.max, nextVal));
        if (dragConfig.step >= 1) {
          nextVal = Math.round(nextVal / dragConfig.step) * dragConfig.step;
        } else {
          nextVal = Number((Math.round(nextVal / dragConfig.step) * dragConfig.step).toFixed(2));
        }
        latestRef.current.onUpdateParam(dragParamKey, nextVal);
        setDragToast({ label: dragConfig.label, value: `${nextVal}` });
        return;
      }

      // Hover check for pointer cursor, emissive glow & floating accent gizmo ring
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
            (hitMesh.material as any).emissive.setHex(0x38bdf8);
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
      unsubAiAction();
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
      teacherCollabBridge.dispose();
      cursorManager.dispose();
      controls.removeEventListener('change', handleControlsChange);
      cameraSyncHandleRef.current = null;
      controls.dispose();

      // Dispose Post-Processing, Workbench & Textures
      studioComposer.dispose();
      workbench.dispose();
      metalTex?.dispose();
      rampScaleTex?.dispose();
      airTrackScaleTex?.dispose();
      fringeTexture.dispose();

      // Deep Three.js GPU resource disposal (geometries, materials, textures, renderer)
      disposeThreeSceneResources(scene, renderer, envTexture);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [sceneKey]);

  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    cameraCtrlRef.current?.setPreset(preset);
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
        data-testid="physics-simulation-canvas"
        className="w-full h-full block touch-none"
      />

      <ConceptLabelsLayer
        slots={[
          { id: 'c1', accentHex: '#38bdf8' },
          { id: 'c2', accentHex: '#f59e0b' },
          { id: 'c3', accentHex: '#10b981' },
          { id: 'c4', accentHex: '#f43f5e' },
        ]}
        visible={showConceptLabels}
        onBindSlot={bindConceptSlot}
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      {/* Consolidated Top-Right Capsule Bar: Snap-to-Port | 🥽 Mode VR | Presets (Iso | Depan | Atas | Fokus | ⛶) */}
      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={() => {
            const { docked, transfer } = triggerDomainApparatusSnap('Fisika');
            if (docked) {
              setDragToast({
                label: `Port Docked (${docked.portType.toUpperCase()})`,
                value: `I = ${(transfer?.electricCurrentAmp ?? 0).toFixed(2)} A`,
              });
              setTimeout(() => setDragToast(null), 1800);
            }
          }}
          title="Snap-to-Port: Sambung & Transfer Aparatus 3D"
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
              { id: 'focus', label: 'Fokus' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectCameraPreset(preset.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                activePreset === preset.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {preset.label}
            </button>
          ))}
          {(params.mode === 'projectile-gravity' || (params.mode as string) === 'projectile-motion') && (
            <button
              type="button"
              data-testid="projectile-follow-cam-toggle"
              onClick={() => {
                labSound.playClick(680);
                setFollowCamEnabled((prev) => !prev);
              }}
              title="Follow Cam: Ikuti lintasan proyektil secara halus"
              className={`px-2 py-1 text-[10px] font-mono rounded-lg transition-colors cursor-pointer ${
                followCamEnabled
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Follow
            </button>
          )}
          {!hudCollapsed && showVectorOverlay && (
            <span className="hidden xl:flex items-center gap-1 px-2 text-[10px] font-mono text-emerald-300 border-l border-white/15">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Vektor
            </span>
          )}
          <span className="mx-1 h-3.5 w-px bg-white/15" aria-hidden="true" />
        </div>

        <ConceptLabelToggleButton accentClass="bg-sky-500 text-slate-950 font-bold" />

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

export default PhysicsScene3D;

