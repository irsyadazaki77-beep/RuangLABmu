import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  captureComposerSnapshot,
  configureRendererForLiteMode,
  createAdaptiveFpsMonitor,
  createStudioComposer,
  disposeThreeSceneResources,
  type CameraSyncPose,
  type StudioComposerHandle,
} from './threeStudioKit';
import { useUIStore } from '../stores/useUIStore';

export interface ThreeStudioHostOptions {
  container: HTMLElement;
  fallbackSize?: { width: number; height: number };
  backgroundHex?: number;
  fogDensity?: number;
  camera: {
    fov?: number;
    near?: number;
    far?: number;
    position: [number, number, number];
    lookAt?: [number, number, number];
  };
  controls?: {
    target?: [number, number, number];
    minDistance?: number;
    maxDistance?: number;
    maxPolarAngle?: number;
    autoRotateSpeed?: number;
    dampingFactor?: number;
  };
  bloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
  };
  toneMappingExposure?: number;
  environmentIntensity?: number;
  alpha?: boolean;
  lowFpsThreshold?: number;
  lowFpsWindowMs?: number;
  onContextRestored?: () => void;
  onUserControlsStart?: () => void;
  onCameraSyncChange?: (pose: Omit<CameraSyncPose, 'seq'>) => void;
  onResize?: (width: number, height: number) => void;
}

export interface ThreeStudioHost {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  studioComposer: StudioComposerHandle;
  envTexture: THREE.Texture;
  fpsMonitor: ReturnType<typeof createAdaptiveFpsMonitor>;
  isSoftwareGl: boolean;
  renderFrame: (dt?: number) => void;
  captureSnapshot: () => string | null;
  applyExternalCameraPose: (pose: CameraSyncPose) => void;
  dispose: () => void;
}

/**
 * Unified WebGL2 Studio bootstrap for all 5 RuangLABmu 3D scenes.
 * Eliminates duplicated renderer, RoomEnvironment PMREM, OrbitControls,
 * Adaptive FPS 3T protection, ResizeObserver, context-loss recovery, and disposal logic.
 */
export function initThreeStudioHost(options: ThreeStudioHostOptions): ThreeStudioHost | null {
  const { container } = options;
  const fallbackW = options.fallbackSize?.width ?? 760;
  const fallbackH = options.fallbackSize?.height ?? 380;
  const width = container.clientWidth || fallbackW;
  const height = container.clientHeight || fallbackH;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: options.alpha ?? false,
      powerPreference: 'high-performance',
      // Disabled intentionally to preserve GPU swap-buffer performance on mobile/3T devices;
      // captureSnapshot() renders synchronously right before calling toDataURL().
      preserveDrawingBuffer: false,
    });
  } catch {
    return null;
  }

  renderer.setSize(width, height);
  const pixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.toneMappingExposure ?? 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';

  const handleWebGLContextLost = (event: Event) => {
    event.preventDefault();
  };
  const handleWebGLContextRestored = () => {
    options.onContextRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleWebGLContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', handleWebGLContextRestored, false);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const initialLite = useUIStore.getState().liteDeviceMode;
  configureRendererForLiteMode(renderer, initialLite);

  const fpsMonitor = createAdaptiveFpsMonitor(
    () => {
      if (!useUIStore.getState().liteDeviceMode) {
        useUIStore.getState().setLiteDeviceMode(true);
        useUIStore.getState().setLiteModeNotification(
          'Mode Hemat Daya diaktifkan otomatis agar simulasi tetap lancar di perangkatmu.'
        );
      }
    },
    options.lowFpsThreshold ?? 25,
    options.lowFpsWindowMs ?? 3000
  );

  const unsubLite = useUIStore.subscribe((state, prev) => {
    if (state.liteDeviceMode !== prev.liteDeviceMode) {
      configureRendererForLiteMode(renderer, state.liteDeviceMode);
      if (!state.liteDeviceMode) {
        fpsMonitor.resetMonitor();
      }
    }
  });

  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
  const glRenderer = dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

  const bgHex = options.backgroundHex ?? 0x0b0f17;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgHex);
  if ((options.fogDensity ?? 0.015) > 0) {
    scene.fog = new THREE.FogExp2(bgHex, options.fogDensity ?? 0.015);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = options.environmentIntensity ?? 0.35;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(
    options.camera.fov ?? 45,
    width / height,
    options.camera.near ?? 0.1,
    options.camera.far ?? 250
  );
  camera.position.set(...options.camera.position);
  if (options.camera.lookAt) {
    camera.lookAt(...options.camera.lookAt);
  }

  const studioComposer = createStudioComposer(
    renderer,
    scene,
    camera,
    width,
    height,
    isSoftwareGl,
    options.bloom ?? { strength: 0.14, radius: 0.25, threshold: 1.15 }
  );

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = options.controls?.dampingFactor ?? 0.06;
  if (options.controls?.autoRotateSpeed !== undefined) {
    controls.autoRotateSpeed = options.controls.autoRotateSpeed;
  }
  if (options.controls?.target) {
    controls.target.set(...options.controls.target);
  }
  if (options.controls?.maxPolarAngle !== undefined) {
    controls.maxPolarAngle = options.controls.maxPolarAngle;
  }
  if (options.controls?.minDistance !== undefined) {
    controls.minDistance = options.controls.minDistance;
  }
  if (options.controls?.maxDistance !== undefined) {
    controls.maxDistance = options.controls.maxDistance;
  }

  let isApplyingExternalCam = false;
  const handleControlsChange = () => {
    if (isApplyingExternalCam || !options.onCameraSyncChange) return;
    options.onCameraSyncChange({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    });
  };
  const handleControlsStart = () => {
    options.onUserControlsStart?.();
  };
  controls.addEventListener('change', handleControlsChange);
  controls.addEventListener('start', handleControlsStart);

  let disposed = false;
  let lastW = width;
  let lastH = height;

  const renderFrame = (dt = 0.016) => {
    if (disposed) return;
    studioComposer.render(useUIStore.getState().liteDeviceMode, dt);
  };

  const handleResize = () => {
    if (disposed) return;
    const w = container.clientWidth || fallbackW;
    const h = container.clientHeight || fallbackH;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    const pr = renderer.getPixelRatio();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    studioComposer.resize(w, h, pr);
    options.onResize?.(w, h);
    renderFrame(0);
  };

  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : null;
  resizeObserver?.observe(container);
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    studioComposer,
    envTexture,
    fpsMonitor,
    isSoftwareGl,
    renderFrame,
    captureSnapshot: () =>
      captureComposerSnapshot(renderer, studioComposer, useUIStore.getState().liteDeviceMode),
    applyExternalCameraPose: (pose: CameraSyncPose) => {
      isApplyingExternalCam = true;
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
      controls.update();
      isApplyingExternalCam = false;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubLite();
      resizeObserver?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
      controls.removeEventListener('change', handleControlsChange);
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleWebGLContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', handleWebGLContextRestored, false);
      studioComposer.dispose();
      disposeThreeSceneResources(scene, renderer, envTexture);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    },
  };
}
