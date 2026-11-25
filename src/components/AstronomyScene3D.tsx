import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { smoothCameraDamp, type CameraSyncPose } from '../utils/threeStudioKit';
import { initThreeStudioHost, startStudioRenderLoop } from '../utils/threeStudioHost';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import {
  AstronomyMetrics,
  AstronomyMode,
  AstronomyParams,
  SolarPlanetPreset,
} from '../utils/scienceEngine';
import { normalizeAstronomyMode } from '../utils/astronomyVisualHelpers';
import {
  AstronomyRigHandle,
  buildExoplanetTransitRig,
  buildHubbleExpansionRig,
  buildMilkyWayRig,
  buildPlanetaryGreenhouseRig,
  buildSolarKeplerRig,
  buildWienSpectrumRig,
} from './scenes/AstronomyRigs';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { labSound } from '../utils/soundEngine';
import { triggerDomainApparatusSnap } from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import {
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';
import { Scene3DControlDock } from './ui/Scene3DControlDock';
import { Scene3DInspectorCard } from './ui/Scene3DInspectorCard';
import {
  getAdaptiveCameraPose,
  resolveApparatusInspection,
  type ApparatusInspectionInfo,
} from '../utils/studio3DCatalog';
import { useThreeStudioScene } from './scenes/useThreeStudioScene';

interface AstronomyScene3DProps {
  params: AstronomyParams;
  metrics: AstronomyMetrics;
  activePlanet?: SolarPlanetPreset;
  simTime?: number;
  simTimeRef?: React.RefObject<number>;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onUpdateParam?: (paramKey: string, value: number) => void;
  onPlanetClick?: (planetName: string) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
  comfortTheme?: ComfortThemeMode;
  cameraSyncPose?: CameraSyncPose | null;
  onCameraSyncChange?: (pose: Omit<CameraSyncPose, 'seq'>) => void;
}

type CameraPreset = 'isometric' | 'ecliptic' | 'top' | 'focus';
const ASTRO_ORDERED_PRESETS: readonly CameraPreset[] = ['isometric', 'ecliptic', 'top', 'focus'];

const PARAM_UNIT_MAP: Record<string, string> = {
  customSemiMajorAxisAu: 'AU',
  galactocentricRadiusKpc: 'kpc',
  starEffectiveTempK: 'K',
  exoplanetRadiusEarth: 'R⊕',
  exoplanetOrbitAu: 'AU',
  galaxyDistanceMpc: 'Mpc',
  planetaryAlbedo: '',
  greenhouseGasPpm: 'ppm',
  stellarFluxFactor: 'S☉',
};

export const AstronomyScene3D: React.FC<AstronomyScene3DProps> = ({
  params,
  metrics,
  activePlanet,
  simTime,
  simTimeRef,
  remoteCursors,
  onEmitCursor,
  onUpdateParam,
  onPlanetClick,
  onCaptureSnapshot,
  comfortTheme,
  cameraSyncPose,
  onCameraSyncChange,
}) => {
  const { liteDeviceMode, leftDrawerOpen, rightTelemetryOpen, zenMode } = useUIStore(
    useShallow((s) => ({
      liteDeviceMode: s.liteDeviceMode,
      leftDrawerOpen: s.leftDrawerOpen,
      rightTelemetryOpen: s.rightTelemetryOpen,
      zenMode: s.zenMode,
    }))
  );

  const {
    activeComfortTheme,
    themeColors,
    showConceptLabels,
    showConceptLabelsRef,
    mountRef,
    containerRef,
    conceptDomRef,
    bindConceptSlot,
    isFullscreen,
    handleToggleFullscreen,
    activePreset,
    activePresetRef,
    setActivePreset,
    handleSelectCameraPreset,
    dragToast,
    setDragToast,
    hoveredPartLabel,
    setHoveredPartLabel,
    sceneKey,
    triggerSceneRebuild,
    cameraCtrlRef,
    cameraSyncHandleRef,
    onCameraSyncChangeRef,
  } = useThreeStudioScene<CameraPreset>({
    domain: 'Astronomi',
    orderedPresets: ASTRO_ORDERED_PRESETS,
    defaultPreset: 'isometric',
    comfortTheme,
    cameraSyncPose,
    onCameraSyncChange,
    onCaptureSnapshot,
  });

  const latestRef = useRef({
    params,
    metrics,
    activePlanet,
    simTime,
    simTimeRef,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
    onPlanetClick,
    onCaptureSnapshot,
  });
  latestRef.current = {
    params,
    metrics,
    activePlanet,
    simTime,
    simTimeRef,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
    onPlanetClick,
    onCaptureSnapshot,
  };

  const [inspectedPart, setInspectedPart] = useState<ApparatusInspectionInfo | null>(null);
  const snapToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (snapToastTimerRef.current) {
        clearTimeout(snapToastTimerRef.current);
        snapToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setInspectedPart(null);
  }, [params.mode]);

  useEffect(() => {
    cameraCtrlRef.current?.applyLiteMode?.(liteDeviceMode);
  }, [liteDeviceMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Astronomi');

    const initialPose = getAdaptiveCameraPose(
      'astronomy',
      normalizeAstronomyMode(latestRef.current.params.mode),
      'isometric'
    );
    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 760, height: 380 },
      backgroundHex: initialColors.backgroundHex,
      fogDensity: 0.008,
      domainPreset: 'observatory',
      camera: {
        fov: 45,
        near: 0.1,
        far: 400,
        position: initialPose.pos,
      },
      controls: {
        target: initialPose.target,
        autoRotateSpeed: 1.2,
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 3.5,
        maxDistance: 50,
      },
      onContextRestored: triggerSceneRebuild,
      onUserControlsStart: () => {
        camTransitionActive = false;
      },
      onCameraSyncChange: (pose) => onCameraSyncChangeRef.current?.(pose),
    });
    if (!host) return;

    const { scene, camera, renderer, controls, fpsMonitor, isSoftwareGl } = host;

    const desiredCamPos = new THREE.Vector3(...initialPose.pos);
    const desiredTarget = new THREE.Vector3(...initialPose.target);

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        camTransitionActive = false;
        host.applyExternalCameraPose(pose);
      },
    };

    const applyCameraPreset = (presetName: CameraPreset) => {
      const canonical = normalizeAstronomyMode(latestRef.current.params.mode);
      const pose = getAdaptiveCameraPose('astronomy', canonical, presetName);
      desiredCamPos.set(...pose.pos);
      desiredTarget.set(...pose.target);
      camTransitionActive = true;
    };

    const unsubAiAction = subscribeLabEvent(LAB_EVENTS.AI_UI_ACTION, (action) => {
      if (!action) return;
      if (action.type === 'FOCUS_CAMERA' && action.target === 'planet_focus') {
        setActivePreset('focus');
        activePresetRef.current = 'focus';
        applyCameraPreset('focus');
      }
    });

    // Deep-space photometric lighting
    const ambientLight = new THREE.HemisphereLight(
      initialColors.ambientSkyHex,
      initialColors.ambientGroundHex,
      Math.min(0.6, initialColors.ambientIntensity)
    );
    scene.add(ambientLight);

    const centralStarLight = new THREE.PointLight(0xfffbeb, 65.0, 140, 2.0);
    centralStarLight.position.set(0, 0, 0);
    scene.add(centralStarLight);

    const astroShadowSize = isSoftwareGl ? 512 : 1024;
    const astroKeyLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
    astroKeyLight.position.set(8, 14, 10);
    astroKeyLight.castShadow = true;
    astroKeyLight.shadow.mapSize.width = astroShadowSize;
    astroKeyLight.shadow.mapSize.height = astroShadowSize;
    astroKeyLight.shadow.camera.near = 0.5;
    astroKeyLight.shadow.camera.far = 50;
    const shadowBound = 12;
    astroKeyLight.shadow.camera.left = -shadowBound;
    astroKeyLight.shadow.camera.right = shadowBound;
    astroKeyLight.shadow.camera.top = shadowBound;
    astroKeyLight.shadow.camera.bottom = -shadowBound;
    astroKeyLight.shadow.bias = -0.0005;
    astroKeyLight.shadow.normalBias = 0.02;
    scene.add(astroKeyLight);
    host.registerShadowLight(astroKeyLight);

    // Procedural Deep-Space Observatory Sky Dome (2048x1024 crisp Milky Way dust lane + galactic core glow)
    const createDeepSpaceSkyTexture = (): THREE.CanvasTexture | null => {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Observatory zenith-to-nadir dark sky gradient
      const bg = ctx.createLinearGradient(0, 0, 0, 1024);
      bg.addColorStop(0, '#020611');
      bg.addColorStop(0.45, '#050b1a');
      bg.addColorStop(0.55, '#060e21');
      bg.addColorStop(1, '#020510');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 2048, 1024);

      // Subtle inclined Milky Way band
      ctx.save();
      ctx.translate(1024, 512);
      ctx.rotate(-0.34);
      const bandGrad = ctx.createLinearGradient(0, -220, 0, 220);
      bandGrad.addColorStop(0, 'rgba(30, 58, 138, 0)');
      bandGrad.addColorStop(0.32, 'rgba(56, 189, 248, 0.055)');
      bandGrad.addColorStop(0.5, 'rgba(148, 163, 184, 0.11)');
      bandGrad.addColorStop(0.68, 'rgba(99, 102, 241, 0.055)');
      bandGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(-1400, -220, 2800, 440);

      // Warm galactic bulge glow near Sagittarius sector
      const coreGlow = ctx.createRadialGradient(280, 0, 16, 280, 0, 390);
      coreGlow.addColorStop(0, 'rgba(253, 224, 71, 0.12)');
      coreGlow.addColorStop(0.4, 'rgba(245, 158, 11, 0.05)');
      coreGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(-240, -360, 1040, 720);

      // Delicate dark interstellar dust rift along the galactic equator
      for (let i = 0; i < 28; i++) {
        const rx = -1040 + i * 80;
        const ry = Math.sin(i * 0.7) * 28;
        const dust = ctx.createRadialGradient(rx, ry, 8, rx, ry, 88);
        dust.addColorStop(0, 'rgba(2, 6, 18, 0.42)');
        dust.addColorStop(1, 'rgba(2, 6, 18, 0)');
        ctx.fillStyle = dust;
        ctx.beginPath();
        ctx.arc(rx, ry, 88, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Pinpoint distant background star dust baked onto high-res sky dome
      for (let i = 0; i < 1400; i++) {
        const sx = (i * 797.3) % 2048;
        const sy = (i * 421.7) % 1024;
        const r = i % 15 === 0 ? 1.1 : 0.65;
        const a = 0.18 + ((i * 29) % 44) / 100;
        ctx.fillStyle =
          i % 9 === 0
            ? `rgba(186, 230, 253, ${a.toFixed(2)})`
            : i % 13 === 0
            ? `rgba(254, 240, 138, ${a.toFixed(2)})`
            : `rgba(241, 245, 249, ${a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const skyDomeTex = createDeepSpaceSkyTexture();
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(185, 36, 24),
      new THREE.MeshBasicMaterial({
        map: skyDomeTex,
        color: 0xffffff,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    skyDome.renderOrder = -2;
    scene.add(skyDome);

    // Tight optical pinpoint radial star-glow sprite (zero blocky squares in WebGL/SwiftShader)
    const createStarSpriteTexture = (): THREE.CanvasTexture | null => {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const g = ctx.createRadialGradient(32, 32, 0.5, 32, 32, 26);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.16, 'rgba(240, 249, 255, 0.88)');
      g.addColorStop(0.38, 'rgba(148, 163, 184, 0.14)');
      g.addColorStop(0.72, 'rgba(0, 0, 0, 0)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const starSpriteTex = createStarSpriteTexture();

    // Multi-Layer Parallax Starfield (fog: false so distant stars stay razor sharp)
    const spectralPalette = [
      new THREE.Color(0x93c5fd), // O/B blue-white
      new THREE.Color(0xf8fafc), // A pure white
      new THREE.Color(0xfef08a), // G solar yellow
      new THREE.Color(0xfdba74), // K warm amber
      new THREE.Color(0xfca5a5), // M red giant
    ];
    const createStarfieldLayer = (
      count: number,
      minR: number,
      maxR: number,
      pointSize: number,
      opacity = 0.94
    ) => {
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = minR + ((i * 17.37) % (maxR - minR));
        const theta = (i * 2.3999632) % (Math.PI * 2);
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const c = spectralPalette[i % spectralPalette.length];
        const brightness = 0.78 + ((i * 13) % 22) / 100;
        cols[i * 3] = c.r * brightness;
        cols[i * 3 + 1] = c.g * brightness;
        cols[i * 3 + 2] = c.b * brightness;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const mat = new THREE.PointsMaterial({
        size: pointSize,
        map: starSpriteTex,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      });
      return new THREE.Points(geo, mat);
    };

    const nearStarLayer = createStarfieldLayer(460, 40, 74, 0.48, 0.92);
    const deepStarLayer = createStarfieldLayer(920, 78, 148, 0.34, 0.85);
    const heroStarLayer = createStarfieldLayer(90, 58, 120, 0.86, 0.96);
    scene.add(nearStarLayer, deepStarLayer, heroStarLayer);

    // Modular Per-Experiment Rigs
    const rigs: Record<AstronomyMode, AstronomyRigHandle> = {
      'solar-kepler': buildSolarKeplerRig(),
      'milkyway-galaxy': buildMilkyWayRig(),
      'stellar-exoplanet': buildExoplanetTransitRig(),
      'stellar-wien-spectrum': buildWienSpectrumRig(useUIStore.getState().liteDeviceMode || isSoftwareGl),
      'hubble-expansion': buildHubbleExpansionRig(),
      'planetary-atmosphere-greenhouse': buildPlanetaryGreenhouseRig(),
    };
    (Object.values(rigs) as AstronomyRigHandle[]).forEach((rig) => scene.add(rig.group));

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => host.captureSnapshot(),
      applyTheme: (colors) => {
        if (scene.background instanceof THREE.Color) {
          scene.background.setHex(colors.backgroundHex);
        } else {
          scene.background = new THREE.Color(colors.backgroundHex);
        }
        scene.fog = new THREE.FogExp2(colors.fogHex, 0.008);
        ambientLight.color.setHex(colors.ambientSkyHex);
        ambientLight.groundColor.setHex(colors.ambientGroundHex);
        ambientLight.intensity = Math.min(0.6, colors.ambientIntensity);
      },
      applyLiteMode: (isLite) => {
        (Object.values(rigs) as AstronomyRigHandle[]).forEach((rig) => rig.onLiteChange?.(isLite || isSoftwareGl));
      },
    };

    const cursorManager = new SpatialCursorManager(scene);
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    // Centralized ThreeInteractionManager (replaces legacy manual raycaster)
    let isDraggingInteractive = false;
    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x38bdf8,
      getInteractiveObjects: () => {
        const activeMode = normalizeAstronomyMode(latestRef.current.params.mode);
        return rigs[activeMode]?.interactiveMeshes ?? [];
      },
      getParamValue: (paramKey) => {
        const val = (latestRef.current.params as unknown as Record<string, unknown>)[paramKey];
        return typeof val === 'number' ? val : 0;
      },
      onHoverChange: (obj) => {
        setHoveredPartLabel(obj ? (obj.userData?.label ?? obj.name ?? 'Objek Astronomi 3D') : null);
      },
      onDragStart: () => {
        isDraggingInteractive = true;
        labSound.playClick(600);
        if (latestRef.current.onPlanetClick) {
          latestRef.current.onPlanetClick(latestRef.current.params.selectedPlanetId || 'Bumi');
        }
      },
      onDragUpdate: (_obj, paramKey, newValue, label) => {
        if (latestRef.current.onUpdateParam) {
          latestRef.current.onUpdateParam(paramKey, newValue);
        }
        const unit = PARAM_UNIT_MAP[paramKey] ?? '';
        const formatted = Number.isInteger(newValue) ? `${newValue}` : newValue.toFixed(2);
        setDragToast({
          label: label ?? paramKey,
          value: `${formatted}${unit ? ` ${unit}` : ''}`,
        });
        if (dragToastTimer) clearTimeout(dragToastTimer);
      },
      onDragEnd: () => {
        isDraggingInteractive = false;
        if (dragToastTimer) clearTimeout(dragToastTimer);
        dragToastTimer = setTimeout(() => setDragToast(null), 1300);
      },
      onClick: (obj) => {
        labSound.playClick(640);
        const hint = String(obj.userData?.label ?? obj.name ?? '');
        setInspectedPart(
          resolveApparatusInspection(
            'astronomy',
            normalizeAstronomyMode(latestRef.current.params.mode),
            hint || undefined
          )
        );
      },
      onCursorMove3D: (pos, normal, hoveredName) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredName);
      },
    });

    const conceptProjVec = new THREE.Vector3();
    const zeroConceptVec = new THREE.Vector3();
    const reusableConceptEntries = [
      { dom: conceptDomRef.current.c1, worldPos: zeroConceptVec, text: '', active: false },
      { dom: conceptDomRef.current.c2, worldPos: zeroConceptVec, text: '', active: false },
      { dom: conceptDomRef.current.c3, worldPos: zeroConceptVec, text: '', active: false },
    ];
    let prevActiveMode = normalizeAstronomyMode(latestRef.current.params.mode);

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ nowMs, dt, elapsed, isLite, particleScale }) => {
        const {
          params: p,
          metrics: m,
          activePlanet: ap,
          simTime: propSimTime,
          simTimeRef: propSimTimeRef,
        } = latestRef.current;
        const t =
          propSimTimeRef && typeof propSimTimeRef.current === 'number'
            ? propSimTimeRef.current
            : typeof propSimTime === 'number'
            ? propSimTime
            : elapsed;

        const activeMode = normalizeAstronomyMode(p.mode);
        if (activeMode !== prevActiveMode) {
          prevActiveMode = activeMode;
          applyCameraPreset(activePresetRef.current);
        }

        (Object.entries(rigs) as [AstronomyMode, AstronomyRigHandle][]).forEach(([modeKey, rig]) => {
          rig.group.visible = modeKey === activeMode;
        });

        const effectiveStarScale = isLite || isSoftwareGl ? Math.min(0.65, particleScale) : particleScale;
        nearStarLayer.geometry.setDrawRange(0, Math.max(180, Math.round(460 * effectiveStarScale)));
        deepStarLayer.geometry.setDrawRange(0, Math.max(360, Math.round(920 * effectiveStarScale)));
        heroStarLayer.geometry.setDrawRange(0, Math.max(48, Math.round(90 * effectiveStarScale)));

        // Parallax Starfield & Sky Dome depth shift
        skyDome.rotation.y = t * 0.0006;
        nearStarLayer.rotation.y = t * 0.004;
        deepStarLayer.rotation.y = -t * 0.0015;
        heroStarLayer.rotation.y = t * 0.0022;
        nearStarLayer.position.x = -camera.position.x * 0.06;
        nearStarLayer.position.z = -camera.position.z * 0.06;
        deepStarLayer.position.x = -camera.position.x * 0.02;
        deepStarLayer.position.z = -camera.position.z * 0.02;
        heroStarLayer.position.x = -camera.position.x * 0.035;
        heroStarLayer.position.z = -camera.position.z * 0.035;

        const activeRig = rigs[activeMode];
        const rigFrame = activeRig.update({
          params: p,
          metrics: m,
          activePlanet: ap,
          t,
          isLite: isLite || isSoftwareGl,
          particleScale,
          showConceptLabels: showConceptLabelsRef.current,
          isFocusPreset: activePresetRef.current === 'focus',
          isDragging: isDraggingInteractive,
        });

        if (rigFrame.focusTarget && rigFrame.focusCamPos) {
          desiredTarget.copy(rigFrame.focusTarget);
          desiredCamPos.copy(rigFrame.focusCamPos);
          camTransitionActive = true;
        }

        cursorManager.update(latestRef.current.remoteCursors || {}, camera.position);

        if (camTransitionActive) {
          camTransitionActive = smoothCameraDamp(
            camera,
            controls,
            desiredCamPos,
            desiredTarget,
            dt,
            10
          );
        }

        teacherCollabBridge.tick(nowMs, dt);
        controls.update();

        const showLabels = showConceptLabelsRef.current;
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;
        const cDom = conceptDomRef.current;

        reusableConceptEntries[0].dom = cDom.c1;
        reusableConceptEntries[0].worldPos = rigFrame.anchors.c1?.pos ?? zeroConceptVec;
        reusableConceptEntries[0].text = rigFrame.anchors.c1?.text ?? '';
        reusableConceptEntries[0].active = Boolean(showLabels && rigFrame.anchors.c1);

        reusableConceptEntries[1].dom = cDom.c2;
        reusableConceptEntries[1].worldPos = rigFrame.anchors.c2?.pos ?? zeroConceptVec;
        reusableConceptEntries[1].text = rigFrame.anchors.c2?.text ?? '';
        reusableConceptEntries[1].active = Boolean(showLabels && rigFrame.anchors.c2);

        reusableConceptEntries[2].dom = cDom.c3;
        reusableConceptEntries[2].worldPos = rigFrame.anchors.c3?.pos ?? zeroConceptVec;
        reusableConceptEntries[2].text = rigFrame.anchors.c3?.text ?? '';
        reusableConceptEntries[2].active = Boolean(showLabels && rigFrame.anchors.c3);

        updateProjectedConceptLabels(
          reusableConceptEntries,
          camera,
          cw,
          ch,
          showLabels,
          conceptProjVec
        );

        host.renderFrame(dt);
      },
    });

    return () => {
      loopHandle.stop();
      unsubAiAction();
      if (dragToastTimer) clearTimeout(dragToastTimer);
      interactionManager.dispose();
      teacherCollabBridge.dispose();
      cursorManager.dispose();
      cameraSyncHandleRef.current = null;
      (Object.values(rigs) as AstronomyRigHandle[]).forEach((rig) => rig.dispose());
      host.dispose();
    };
  }, [sceneKey]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${themeColors.containerBgClass} touch-none select-none transition-colors duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="astronomy-simulation-canvas"
        className="w-full h-full block touch-none"
      />

      <ConceptLabelsLayer
        slots={[
          { id: 'c1', accentHex: '#facc15' },
          { id: 'c2', accentHex: '#38bdf8' },
          { id: 'c3', accentHex: '#f97316' },
        ]}
        visible={showConceptLabels}
        onBindSlot={bindConceptSlot}
        onSelectSlot={(slotId, labelText) => {
          setInspectedPart(
            resolveApparatusInspection('astronomy', normalizeAstronomyMode(params.mode), `${slotId} ${labelText}`)
          );
        }}
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-[126px] lg:bottom-[92px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl studio-hud-surface border border-sky-500/45 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-[var(--comfort-hud-text)]">
          <span>
            Menyetel Astronomi 3D: {dragToast.label} ={' '}
            <b className="text-sky-700 dark:text-sky-300">{dragToast.value}</b>
          </span>
        </div>
      )}

      {/* Visual Scale Comparison Caption for Orbital Readability */}
      <div
        data-testid="astronomy-scale-badge"
        className={`pointer-events-none absolute z-20 flex items-center gap-1.5 rounded-lg bg-slate-950/75 border border-slate-700/60 px-2.5 py-1 text-2xs font-mono text-slate-300 shadow-md max-w-[calc(100vw-24px)] ${
          isFullscreen
            ? 'bottom-16 left-3'
            : `bottom-[118px] lg:bottom-[104px] ${
                !zenMode && leftDrawerOpen && rightTelemetryOpen
                  ? 'left-3 lg:left-[336px] xl:left-[348px] lg:max-w-[calc(100%-700px)] xl:max-w-[calc(100%-732px)]'
                  : !zenMode && leftDrawerOpen
                  ? 'left-3 lg:left-[336px] xl:left-[348px] lg:max-w-[calc(100%-368px)]'
                  : 'left-3'
              }`
        }`}
      >
        <span className="truncate">
          Skala Visual: Diameter benda langit diperbesar untuk keterbacaan orbit · Klik/Drag objek 3D
        </span>
      </div>

      <Scene3DInspectorCard
        info={inspectedPart}
        onClose={() => setInspectedPart(null)}
      />

      <Scene3DControlDock
        accentTone="indigo"
        activePreset={activePreset}
        frontLabel="Depan"
        onResetCamera={() => handleSelectCameraPreset('isometric')}
        onSelectPreset={(preset) =>
          handleSelectCameraPreset(preset === 'front' ? 'ecliptic' : preset)
        }
        isVRSupported={true}
        onEnterVR={() => {
          labSound.playClick(700);
          void toggleImmersiveVRSession();
        }}
        onSnapApparatus={() => {
          const { docked, transfer } = triggerDomainApparatusSnap('Astronomi');
          if (docked) {
            setDragToast({
              label: `Port Docked (${docked.portType.toUpperCase()})`,
              value: `Φ = ${(transfer?.opticalIntensityMw ?? 0).toFixed(1)} mW`,
            });
            if (snapToastTimerRef.current) clearTimeout(snapToastTimerRef.current);
            snapToastTimerRef.current = setTimeout(() => {
              snapToastTimerRef.current = null;
              setDragToast(null);
            }, 1800);
          }
        }}
        onOpenInspector={() =>
          setInspectedPart((prev) =>
            prev
              ? null
              : resolveApparatusInspection(
                  'astronomy',
                  normalizeAstronomyMode(params.mode),
                  hoveredPartLabel ?? undefined
                )
          )
        }
        inspectorActive={Boolean(inspectedPart)}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="violet" />
    </div>
  );
};

export default AstronomyScene3D;
