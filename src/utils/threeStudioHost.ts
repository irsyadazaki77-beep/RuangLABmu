import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  captureComposerSnapshot,
  configureLabRenderer,
  createAdaptiveFpsMonitor,
  createStudioComposer,
  disposeThreeScene,
  type CameraSyncPose,
  type StudioComposerHandle,
} from './threeStudioKit';
import {
  applyQualityTierToRenderer,
  createAdaptiveQualityController,
  getQualityTierSpec,
  type AdaptiveQualityController,
  type QualityTier,
} from '../hooks/useAdaptiveQuality';
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
  onContextLost?: () => void;
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
  qualityController: AdaptiveQualityController;
  isSoftwareGl: boolean;
  getQualityTier: () => QualityTier;
  getParticleDensityScale: () => number;
  registerShadowLight: (light: THREE.Light) => void;
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

  const uiState = useUIStore.getState();
  const initialLite = uiState.liteDeviceMode || uiState.qualityMode === '3t-saver';

  renderer.setSize(width, height);
  configureLabRenderer(renderer, {
    exposure: options.toneMappingExposure ?? 1.05,
    isSoftwareGl,
    isLite: initialLite,
    pixelRatioCap: 1.5,
  });
  renderer.domElement.style.touchAction = 'none';

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const shadowLights: THREE.Light[] = [];

  // Non-intrusive HUD badge for Adaptive 3T Quality Tier & WebGL Context Recovery
  const hudStatusBadge =
    typeof document !== 'undefined' ? document.createElement('div') : null;
  if (hudStatusBadge) {
    hudStatusBadge.setAttribute('data-testid', 'hud-performance-tier-badge');
    hudStatusBadge.style.cssText =
      'position:absolute;bottom:108px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:3px 10px;border-radius:8px;font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:700;background:rgba(15,23,42,0.92);border:1px solid rgba(56,189,248,0.35);color:#bae6fd;display:none;align-items:center;gap:6px;white-space:nowrap;';
    container.appendChild(hudStatusBadge);
  }

  const syncHudBadge = (tier: QualityTier, contextLost = false, measuredFps?: number) => {
    if (!hudStatusBadge) return;
    if (contextLost) {
      hudStatusBadge.style.display = 'inline-flex';
      hudStatusBadge.style.borderColor = 'rgba(245,158,11,0.65)';
      hudStatusBadge.style.color = '#fde68a';
      hudStatusBadge.textContent = '⚡ Memulihkan Konteks WebGL 3D...';
      return;
    }
    if (tier === '3t-saver') {
      hudStatusBadge.style.display = 'inline-flex';
      hudStatusBadge.style.borderColor = 'rgba(56,189,248,0.35)';
      hudStatusBadge.style.color = '#bae6fd';
      const fpsTag =
        typeof measuredFps === 'number' && Number.isFinite(measuredFps)
          ? ` (${Math.round(measuredFps)} FPS)`
          : '';
      hudStatusBadge.textContent = `Mode 3T-Saver • DPR 1x • Shadow Nonaktif${fpsTag}`;
    } else {
      hudStatusBadge.style.display = 'none';
      hudStatusBadge.textContent = '';
    }
  };

  const qualityController = createAdaptiveQualityController({
    initialTier: initialLite ? '3t-saver' : isSoftwareGl ? 'balanced' : 'high',
    initialMode: uiState.qualityMode,
    isSoftwareGl,
    shadowLights,
    onTierChange: (nextTier, avgFps) => {
      syncHudBadge(nextTier, false, avgFps);
      useUIStore.getState().setLivePerfStats({
        fps: Math.max(1, Math.round(avgFps)),
        qualityTier: nextTier,
      });
    },
  });

  applyQualityTierToRenderer(renderer, qualityController.getTier(), {
    isSoftwareGl,
    shadowLights,
  });
  syncHudBadge(qualityController.getTier(), false);

  let isContextLost = false;
  const handleWebGLContextLost = (event: Event) => {
    event.preventDefault();
    isContextLost = true;
    syncHudBadge(qualityController.getTier(), true);
    options.onContextLost?.();
  };
  const handleWebGLContextRestored = () => {
    isContextLost = false;
    configureLabRenderer(renderer, {
      exposure: options.toneMappingExposure ?? 1.05,
      isSoftwareGl,
      isLite: qualityController.getTier() === '3t-saver',
      pixelRatioCap: 1.5,
    });
    applyQualityTierToRenderer(renderer, qualityController.getTier(), {
      isSoftwareGl,
      shadowLights,
    });
    syncHudBadge(qualityController.getTier(), false);
    options.onContextRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleWebGLContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', handleWebGLContextRestored, false);

  const fpsMonitor = createAdaptiveFpsMonitor(
    (avgFps) => {
      if (useUIStore.getState().qualityMode === 'high') {
        return;
      }
      qualityController.setTier('3t-saver', renderer);
      syncHudBadge('3t-saver', false, avgFps);
      if (!useUIStore.getState().liteDeviceMode) {
        useUIStore.getState().setLiteDeviceMode(true);
        useUIStore.getState().setLiteModeNotification(
          `Mode Hemat Daya 3T diaktifkan otomatis (${Math.round(avgFps)} FPS < 25 FPS) agar simulasi tetap lancar di perangkatmu.`
        );
      }
    },
    options.lowFpsThreshold ?? 25,
    options.lowFpsWindowMs ?? 2000
  );

  const unsubUI = useUIStore.subscribe((state, prev) => {
    if (state.qualityMode !== prev.qualityMode) {
      qualityController.setMode(state.qualityMode, renderer);
      syncHudBadge(qualityController.getTier(), false);
      if (state.qualityMode !== '3t-saver') {
        fpsMonitor.resetMonitor();
        qualityController.reset();
      }
    } else if (state.liteDeviceMode !== prev.liteDeviceMode) {
      const targetMode = state.liteDeviceMode ? '3t-saver' : 'auto';
      qualityController.setMode(targetMode, renderer);
      syncHudBadge(qualityController.getTier(), false);
      if (!state.liteDeviceMode) {
        fpsMonitor.resetMonitor();
        qualityController.reset();
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
      const v = y / (h - 1);
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

  const baseFov = options.camera.fov ?? 45;
  const computePortraitSafeFov = (aspect: number) => {
    if (!Number.isFinite(aspect) || aspect >= 0.85) return baseFov;
    return Math.min(72, baseFov / Math.pow(Math.max(0.45, aspect), 0.55));
  };

  const initialAspect = width / Math.max(1, height);
  const camera = new THREE.PerspectiveCamera(
    computePortraitSafeFov(initialAspect),
    initialAspect,
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
  controls.dampingFactor = options.controls?.dampingFactor ?? 0.08;
  if (options.controls?.autoRotateSpeed !== undefined) {
    controls.autoRotateSpeed = options.controls.autoRotateSpeed;
  }
  if (options.controls?.target) {
    controls.target.set(...options.controls.target);
  }
  controls.maxPolarAngle = Math.min(options.controls?.maxPolarAngle ?? Math.PI * 0.48, Math.PI * 0.48);
  controls.minDistance = options.controls?.minDistance ?? 2.2;
  controls.maxDistance = options.controls?.maxDistance ?? 42;

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
  let lastPerfSyncAt = 0;

  const renderFrame = (dt = 0.016) => {
    if (disposed || isContextLost) return;
    if (!isSoftwareGl && dt > 0) {
      qualityController.recordFrameDelta(dt, renderer);
    }
    const spec = qualityController.getSpec();
    const bypassComposer =
      useUIStore.getState().liteDeviceMode || !spec.postProcessingEnabled;
    studioComposer.render(bypassComposer, dt);

    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (dt > 0 && nowPerf - lastPerfSyncAt >= 900) {
      lastPerfSyncAt = nowPerf;
      const avgFps = fpsMonitor.getAverageFps() || qualityController.getRollingFps();
      useUIStore.getState().setLivePerfStats({
        fps: Math.max(1, Math.round(avgFps)),
        qualityTier: qualityController.getTier(),
      });
    }
  };

  const handleResize = () => {
    if (disposed || isContextLost) return;
    const w = container.clientWidth || fallbackW;
    const h = container.clientHeight || fallbackH;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    const pr = renderer.getPixelRatio();
    const nextAspect = w / Math.max(1, h);
    camera.fov = computePortraitSafeFov(nextAspect);
    camera.aspect = nextAspect;
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
    qualityController,
    isSoftwareGl,
    getQualityTier: () => qualityController.getTier(),
    getParticleDensityScale: () => getQualityTierSpec(qualityController.getTier()).particleDensityScale,
    registerShadowLight: (light: THREE.Light) => {
      if (!shadowLights.includes(light)) {
        shadowLights.push(light);
        applyQualityTierToRenderer(renderer, qualityController.getTier(), {
          isSoftwareGl,
          shadowLights,
        });
      }
    },
    renderFrame,
    captureSnapshot: () =>
      captureComposerSnapshot(
        renderer,
        studioComposer,
        useUIStore.getState().liteDeviceMode || !qualityController.getSpec().postProcessingEnabled
      ),
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
      unsubUI();
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
      disposeThreeScene(scene, renderer, envTexture, [studioComposer.renderTarget]);
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
    0.52
  );
  scene.add(hemiLight);

  const keyPos = options?.keyPosition ?? [6, 12, 8];
  const shadowSize = options?.shadowMapSize ?? 1024;
  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.02);
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
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimPos = options?.rimPosition ?? [-7, 5, -6];
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.38);
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
      hemiLight.intensity = Math.min(0.55, colors.ambientIntensity);
    },
  };
}

export interface StudioRenderLoopHandle {
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
}

export function startStudioRenderLoop(options: {
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  fpsMonitor: ReturnType<typeof createAdaptiveFpsMonitor>;
  onFrame: (ctx: {
    nowMs: number;
    dt: number;
    elapsed: number;
    isLite: boolean;
    particleScale: number;
  }) => void;
}): StudioRenderLoopHandle {
  const { renderer, isSoftwareGl, fpsMonitor, onFrame } = options;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  let disposed = false;
  let paused = false;
  let rafId = 0;
  let timeoutId = 0;
  let activeSync: WebGLSync | null = null;
  const startTimeMs = performance.now();
  let lastTimeMs = startTimeMs;
  let lastRenderTimestamp = 0;

  const cancelScheduled = () => {
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
  };

  const afterDraw = (cb: () => void) => {
    if (disposed || paused) return;
    const sync = typeof gl.fenceSync === 'function' ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    activeSync = sync;
    gl.flush();
    const poll = () => {
      if (disposed || paused) return;
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
    if (disposed || paused) return;
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      rafId = requestAnimationFrame(tick);
    }
  };

  const tick = (timestamp?: number) => {
    if (disposed || paused) return;
    const nowMs = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
    fpsMonitor.recordFrame(nowMs);

    const ui = useUIStore.getState();
    const isLite = ui.liteDeviceMode || ui.qualityMode === '3t-saver';
    const particleScale = isLite ? 0.5 : ui.livePerfStats.qualityTier === 'balanced' ? 0.85 : 1.0;

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

    onFrame({ nowMs, dt, elapsed, isLite, particleScale });
    scheduleNext();
  };

  const pause = () => {
    if (disposed || paused) return;
    paused = true;
    cancelScheduled();
  };

  const resume = () => {
    if (disposed || !paused) return;
    paused = false;
    lastTimeMs = performance.now();
    rafId = requestAnimationFrame(tick);
  };

  const onCanvasContextLost = (e: Event) => {
    e.preventDefault();
    pause();
  };
  const onCanvasContextRestored = () => {
    resume();
  };

  renderer.domElement.addEventListener('webglcontextlost', onCanvasContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', onCanvasContextRestored, false);

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (disposed) return;
      disposed = true;
      paused = true;
      renderer.domElement.removeEventListener('webglcontextlost', onCanvasContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', onCanvasContextRestored, false);
      cancelScheduled();
    },
    pause,
    resume,
    isPaused: () => paused,
  };
}


