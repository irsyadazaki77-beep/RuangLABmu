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

  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
  const glRenderer = dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

  renderer.setSize(width, height);
  const pixelRatio = isSoftwareGl
    ? 1
    : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.toneMappingExposure ?? 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.touchAction = 'none';

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Non-intrusive HUD badge for Adaptive 3T Quality Tier & WebGL Context Recovery
  const hudStatusBadge =
    typeof document !== 'undefined' ? document.createElement('div') : null;
  if (hudStatusBadge) {
    hudStatusBadge.setAttribute('data-testid', 'hud-performance-tier-badge');
    hudStatusBadge.style.cssText =
      'position:absolute;bottom:10px;left:10px;z-index:12;pointer-events:none;padding:3px 8px;border-radius:8px;font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:700;background:rgba(15,23,42,0.82);border:1px solid rgba(56,189,248,0.35);color:#bae6fd;display:none;align-items:center;gap:6px;backdrop-filter:blur(4px);';
    container.appendChild(hudStatusBadge);
  }

  const syncHudBadge = (isLite: boolean, contextLost = false, measuredFps?: number) => {
    if (!hudStatusBadge) return;
    if (contextLost) {
      hudStatusBadge.style.display = 'inline-flex';
      hudStatusBadge.style.borderColor = 'rgba(245,158,11,0.65)';
      hudStatusBadge.style.color = '#fde68a';
      hudStatusBadge.textContent = '⚡ Memulihkan Konteks WebGL 3D...';
      return;
    }
    if (isLite) {
      hudStatusBadge.style.display = 'inline-flex';
      hudStatusBadge.style.borderColor = 'rgba(56,189,248,0.35)';
      hudStatusBadge.style.color = '#bae6fd';
      const fpsTag =
        typeof measuredFps === 'number' && Number.isFinite(measuredFps)
          ? ` (${Math.round(measuredFps)} FPS)`
          : '';
      hudStatusBadge.textContent = `Mode 3T Adaptif • 1x PixelRatio • Shadow Nonaktif${fpsTag}`;
    } else {
      hudStatusBadge.style.display = 'none';
      hudStatusBadge.textContent = '';
    }
  };

  const initialLite = useUIStore.getState().liteDeviceMode;
  configureRendererForLiteMode(renderer, initialLite, isSoftwareGl);
  syncHudBadge(initialLite, false);

  const handleWebGLContextLost = (event: Event) => {
    event.preventDefault();
    syncHudBadge(useUIStore.getState().liteDeviceMode, true);
  };
  const handleWebGLContextRestored = () => {
    configureRendererForLiteMode(
      renderer,
      useUIStore.getState().liteDeviceMode,
      isSoftwareGl
    );
    syncHudBadge(useUIStore.getState().liteDeviceMode, false);
    options.onContextRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleWebGLContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', handleWebGLContextRestored, false);

  const fpsMonitor = createAdaptiveFpsMonitor(
    (avgFps) => {
      configureRendererForLiteMode(renderer, true, isSoftwareGl);
      syncHudBadge(true, false, avgFps);
      if (!useUIStore.getState().liteDeviceMode) {
        useUIStore.getState().setLiteDeviceMode(true);
        useUIStore.getState().setLiteModeNotification(
          `Mode Hemat Daya 3T diaktifkan otomatis (${Math.round(avgFps)} FPS < 30 FPS) agar simulasi tetap lancar di perangkatmu.`
        );
      }
    },
    options.lowFpsThreshold ?? 30,
    options.lowFpsWindowMs ?? 2000
  );

  const unsubLite = useUIStore.subscribe((state, prev) => {
    if (state.liteDeviceMode !== prev.liteDeviceMode) {
      configureRendererForLiteMode(renderer, state.liteDeviceMode, isSoftwareGl);
      syncHudBadge(state.liteDeviceMode, false);
      if (!state.liteDeviceMode) {
        fpsMonitor.resetMonitor();
      }
    }
  });

  const bgHex = options.backgroundHex ?? 0x0b0f17;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgHex);
  if ((options.fogDensity ?? 0.015) > 0) {
    scene.fog = new THREE.FogExp2(bgHex, options.fogDensity ?? 0.015);
  }

  let envTexture: THREE.Texture;
  if (isSoftwareGl) {
    // Fast equirectangular studio reflection gradient (<0.1ms) avoids multi-second CPU PMREM convolution on SwiftShader
    const w = 16;
    const h = 8;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1); // 0 = bottom, 1 = top (DataTexture flipY default false)
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const sky = Math.pow(v, 1.3);
        data[idx] = Math.round(28 + sky * 195);
        data[idx + 1] = Math.round(38 + sky * 195);
        data[idx + 2] = Math.round(56 + sky * 190);
        data[idx + 3] = 255;
      }
    }
    const fastEnv = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    fastEnv.mapping = THREE.EquirectangularReflectionMapping;
    fastEnv.colorSpace = THREE.SRGBColorSpace;
    fastEnv.magFilter = THREE.LinearFilter;
    fastEnv.minFilter = THREE.LinearFilter;
    fastEnv.needsUpdate = true;
    envTexture = fastEnv;
  } else {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  scene.environment = envTexture;
  scene.environmentIntensity = options.environmentIntensity ?? 0.35;

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

export interface StudioLightingRig {
  hemiLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  applyTheme: (
    colors: {
      ambientSkyHex: number;
      ambientGroundHex: number;
      ambientIntensity: number;
    },
    scene: THREE.Scene,
    fogDensity?: number,
    workbench?: { updateTheme: (c: any) => void }
  ) => void;
}

export function createStudioThreePointLighting(
  scene: THREE.Scene,
  initialColors: { ambientSkyHex: number; ambientGroundHex: number },
  options?: {
    keyPosition?: [number, number, number];
    rimPosition?: [number, number, number];
    shadowBound?: number;
    shadowNear?: number;
    shadowFar?: number;
    shadowMapSize?: number;
  }
): StudioLightingRig {
  const hemiLight = new THREE.HemisphereLight(
    initialColors.ambientSkyHex,
    initialColors.ambientGroundHex,
    0.45
  );
  scene.add(hemiLight);

  const keyPos = options?.keyPosition ?? [6, 12, 8];
  const shadowSize = options?.shadowMapSize ?? 2048;
  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
  keyLight.position.set(keyPos[0], keyPos[1], keyPos[2]);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = shadowSize;
  keyLight.shadow.mapSize.height = shadowSize;
  keyLight.shadow.camera.near = options?.shadowNear ?? 0.5;
  keyLight.shadow.camera.far = options?.shadowFar ?? 35;
  const shadowBound = options?.shadowBound ?? 8;
  keyLight.shadow.camera.left = -shadowBound;
  keyLight.shadow.camera.right = shadowBound;
  keyLight.shadow.camera.top = shadowBound;
  keyLight.shadow.camera.bottom = -shadowBound;
  keyLight.shadow.bias = -0.0001;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimPos = options?.rimPosition ?? [-7, 5, -6];
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
  rimLight.position.set(rimPos[0], rimPos[1], rimPos[2]);
  scene.add(rimLight);

  return {
    hemiLight,
    keyLight,
    rimLight,
    applyTheme: (colors, targetScene, fogDensity = 0.015, workbench) => {
      targetScene.background = new THREE.Color(0x0b0f17);
      targetScene.fog = new THREE.FogExp2(0x0b0f17, fogDensity);
      workbench?.updateTheme(colors);
      hemiLight.color.setHex(colors.ambientSkyHex);
      hemiLight.groundColor.setHex(colors.ambientGroundHex);
      hemiLight.intensity = Math.min(0.45, colors.ambientIntensity);
    },
  };
}

export interface StudioRenderLoopHandle {
  stop: () => void;
}

export function startStudioRenderLoop(options: {
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  fpsMonitor: ReturnType<typeof createAdaptiveFpsMonitor>;
  onFrame: (ctx: { nowMs: number; dt: number; elapsed: number; isLite: boolean }) => void;
}): StudioRenderLoopHandle {
  const { renderer, isSoftwareGl, fpsMonitor, onFrame } = options;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  let disposed = false;
  let rafId = 0;
  let timeoutId = 0;
  let activeSync: WebGLSync | null = null;
  const startTimeMs = performance.now();
  let lastTimeMs = startTimeMs;
  let lastRenderTimestamp = 0;

  const afterDraw = (cb: () => void) => {
    const sync = typeof gl.fenceSync === 'function' ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    activeSync = sync;
    gl.flush();
    const poll = () => {
      if (disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        timeoutId = window.setTimeout(poll, 5);
      } else {
        if (sync) {
          gl.deleteSync(sync);
          if (activeSync === sync) activeSync = null;
        }
        timeoutId = window.setTimeout(cb, 80);
      }
    };
    timeoutId = window.setTimeout(poll, 5);
  };

  const scheduleNext = () => {
    if (disposed) return;
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      rafId = requestAnimationFrame(tick);
    }
  };

  const tick = (timestamp?: number) => {
    if (disposed) return;
    const nowMs = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
    fpsMonitor.recordFrame(nowMs);

    const isLite = useUIStore.getState().liteDeviceMode;
    if (isLite) {
      const delta = nowMs - lastRenderTimestamp;
      if (delta < 32) {
        scheduleNext();
        return;
      }
      lastRenderTimestamp = nowMs - (delta % 33.3);
    }

    const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.05);
    lastTimeMs = nowMs;
    const elapsed = (nowMs - startTimeMs) / 1000;

    onFrame({ nowMs, dt, elapsed, isLite });
    scheduleNext();
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      if (activeSync && typeof gl.deleteSync === 'function') {
        try {
          gl.deleteSync(activeSync);
        } catch {
          // ignore if context was lost
        }
        activeSync = null;
      }
    },
  };
}

