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
import {
  enhanceSceneTextureAnisotropy,
  type PostProcessingDomainPreset,
} from './threePostProcessing';
import { useUIStore } from '../stores/useUIStore';

export interface ThreeStudioHostOptions {
  container: HTMLElement;
  fallbackSize?: { width: number; height: number };
  backgroundHex?: number;
  fogDensity?: number;
  domainPreset?: PostProcessingDomainPreset;
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

  // Probe software WebGL (SwiftShader/llvmpipe) before constructing the main WebGLRenderer
  // so antialias and damping are configured optimally without creating an MSAA backbuffer on CPU rasterizers.
  let probedSoftwareGl = false;
  if (typeof document !== 'undefined') {
    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl = (probeCanvas.getContext('webgl2') ||
        probeCanvas.getContext('webgl')) as WebGLRenderingContext | null;
      const probeDbg = probeGl?.getExtension?.('WEBGL_debug_renderer_info');
      const probeName =
        probeDbg && probeGl ? String(probeGl.getParameter(probeDbg.UNMASKED_RENDERER_WEBGL)) : '';
      probedSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(probeName);
      probeGl?.getExtension?.('WEBGL_lose_context')?.loseContext();
    } catch {
      probedSoftwareGl = false;
    }
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !probedSoftwareGl,
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
  const isSoftwareGl = probedSoftwareGl || /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

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
      'position:absolute;bottom:144px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;padding:3px 10px;border-radius:8px;font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:700;background:rgba(15,23,42,0.92);border:1px solid rgba(56,189,248,0.35);color:#bae6fd;display:none;align-items:center;gap:6px;white-space:nowrap;';
    container.appendChild(hudStatusBadge);
  }

  const syncHudBadge = (_tier: QualityTier, contextLost = false, _measuredFps?: number) => {
    if (!hudStatusBadge) return;
    if (contextLost) {
      hudStatusBadge.style.display = 'inline-flex';
      hudStatusBadge.style.borderColor = 'rgba(245,158,11,0.65)';
      hudStatusBadge.style.color = '#fde68a';
      hudStatusBadge.textContent = 'Memulihkan Tampilan WebGL 3D...';
      return;
    }
    hudStatusBadge.style.display = 'none';
    hudStatusBadge.textContent = '';
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
  const requestedFogDensity = options.fogDensity ?? 0.015;
  if (requestedFogDensity > 0) {
    // Use linear horizon fog starting behind the workbench (24..58) for studio labs so apparatus
    // at 5..18 units has 0% milky haze; keep FogExp2 only for deep-space / ultra-low density scenes.
    scene.fog =
      requestedFogDensity <= 0.01
        ? new THREE.FogExp2(bgHex, requestedFogDensity)
        : new THREE.Fog(bgHex, 24, 58);
  }

  let envTexture: THREE.Texture;
  if (isSoftwareGl) {
    // High-contrast 128x64 architectural studio softbox equirectangular reflection map (<1ms)
    // Gives brushed steel, brass, ceramic, and borosilicate glass crisp specular reflections on SwiftShader/3T devices.
    const w = 128;
    const h = 64;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1); // 0 = floor, 1 = zenith
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const idx = (y * w + x) * 4;

        // Smooth laboratory room ambient gradient (grounded dark bench bounce below horizon, bright studio ceiling above)
        const horizonBand = Math.exp(-Math.pow((v - 0.48) / 0.12, 2));
        const upperSky = Math.max(0, (v - 0.46) / 0.54);
        const floorBounce = Math.max(0, (0.48 - v) / 0.48);

        let r = 34 + upperSky * 126 + horizonBand * 42 - floorBounce * 12;
        let g = 40 + upperSky * 130 + horizonBand * 44 - floorBounce * 10;
        let b = 52 + upperSky * 138 + horizonBand * 46 - floorBounce * 6;

        // Twin overhead laboratory LED diffuser strips
        const strip1 = Math.exp(-Math.pow((v - 0.84) / 0.055, 2)) * (u > 0.16 && u < 0.44 ? 1 : 0);
        const strip2 = Math.exp(-Math.pow((v - 0.84) / 0.055, 2)) * (u > 0.56 && u < 0.84 ? 1 : 0);
        const overhead = (strip1 + strip2) * 118;

        // Warm studio key softbox (upper right)
        const keyBox =
          Math.exp(-Math.pow((u - 0.24) / 0.1, 2)) *
          Math.exp(-Math.pow((v - 0.64) / 0.11, 2)) *
          96;

        // Cool laboratory window rim softbox (opposite flank)
        const rimBox =
          Math.exp(-Math.pow((u - 0.76) / 0.12, 2)) *
          Math.exp(-Math.pow((v - 0.58) / 0.12, 2)) *
          78;

        r += overhead + keyBox * 1.08 + rimBox * 0.72;
        g += overhead * 0.99 + keyBox * 0.98 + rimBox * 0.94;
        b += overhead * 0.97 + keyBox * 0.84 + rimBox * 1.18;

        data[idx] = Math.min(255, Math.max(0, Math.round(r)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
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
  scene.userData.isSoftwareGl = isSoftwareGl;
  // Calibrate RoomEnvironment (much brighter on real GPUs) vs procedural softbox DataTexture parity
  scene.environmentIntensity = options.environmentIntensity ?? (isSoftwareGl ? 0.68 : 0.42);

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

  const initialPostProcessing = useUIStore.getState().postProcessing;
  const studioComposer = createStudioComposer(
    renderer,
    scene,
    camera,
    width,
    height,
    isSoftwareGl,
    options.bloom,
    {
      domainPreset: options.domainPreset ?? 'benchtop',
      initialSettings: initialPostProcessing,
      initialQualityTier: qualityController.getTier(),
    }
  );

  let lastAppliedPostFxRef = initialPostProcessing;
  let lastAppliedPostTier = qualityController.getTier();
  let lastAppliedLiteMode = useUIStore.getState().liteDeviceMode;
  let anisotropyApplied = false;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
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
    if (!anisotropyApplied) {
      anisotropyApplied = true;
      enhanceSceneTextureAnisotropy(
        scene,
        isSoftwareGl ? 1 : renderer.capabilities?.getMaxAnisotropy?.() ?? 4
      );
    }
    if (!isSoftwareGl && dt > 0) {
      qualityController.recordFrameDelta(dt, renderer);
    }
    const spec = qualityController.getSpec();
    const uiState = useUIStore.getState();
    const postFx = uiState.postProcessing;
    if (
      postFx !== lastAppliedPostFxRef ||
      spec.tier !== lastAppliedPostTier ||
      uiState.liteDeviceMode !== lastAppliedLiteMode
    ) {
      lastAppliedPostFxRef = postFx;
      lastAppliedPostTier = spec.tier;
      lastAppliedLiteMode = uiState.liteDeviceMode;
      studioComposer.applySettings(postFx, spec.tier, uiState.liteDeviceMode);
    }
    const bypassComposer =
      uiState.liteDeviceMode || !spec.postProcessingEnabled || !postFx.enabled;
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
      backgroundHex?: number;
      fogHex?: number;
      floorHex?: number;
      tableHex?: number;
      trimHex?: number;
      gridPrimaryHex?: number;
      gridSecondaryHex?: number;
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
  initialColors: {
    ambientSkyHex: number;
    ambientGroundHex: number;
    ambientIntensity?: number;
  },
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
    Math.min(0.62, initialColors.ambientIntensity ?? 0.48)
  );
  scene.add(hemiLight);

  const keyPos = options?.keyPosition ?? [6, 12, 8];
  const shadowSize = options?.shadowMapSize ?? 1024;
  const keyLight = new THREE.DirectionalLight(0xfff7ea, 1.12);
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

  // Soft cool front-side fill light to sculpt brushed metal and ceramic contours without washing shadows
  const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.26);
  fillLight.position.set(-keyPos[0] * 0.85, keyPos[1] * 0.55, keyPos[2] * 0.7);
  scene.add(fillLight);

  const rimPos = options?.rimPosition ?? [-7, 5, -6];
  const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.48);
  rimLight.position.set(rimPos[0], rimPos[1], rimPos[2]);
  scene.add(rimLight);

  return {
    hemiLight,
    keyLight,
    rimLight,
    applyTheme: (colors, targetScene, fogDensity = 0.015, workbench) => {
      const bgHex = colors.backgroundHex ?? 0xdbe3ec;
      const fogHex = colors.fogHex ?? bgHex;
      if (targetScene.background instanceof THREE.Color) {
        targetScene.background.setHex(bgHex);
      } else {
        targetScene.background = new THREE.Color(bgHex);
      }
      targetScene.fog =
        fogDensity <= 0.01
          ? new THREE.FogExp2(fogHex, fogDensity)
          : new THREE.Fog(fogHex, 24, 58);
      const bgCol = new THREE.Color(bgHex);
      const isDarkScene = bgCol.r * 0.299 + bgCol.g * 0.587 + bgCol.b * 0.114 < 0.35;
      const isSw = Boolean(targetScene.userData?.isSoftwareGl);
      targetScene.environmentIntensity = isSw
        ? isDarkScene
          ? 0.56
          : 0.68
        : isDarkScene
        ? 0.36
        : 0.42;
      workbench?.updateTheme(colors);
      hemiLight.color.setHex(colors.ambientSkyHex);
      hemiLight.groundColor.setHex(colors.ambientGroundHex);
      hemiLight.intensity = Math.min(0.62, colors.ambientIntensity);
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


