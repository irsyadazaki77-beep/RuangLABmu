import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Maximize2, Minimize2, Link2 } from 'lucide-react';
import { smoothCameraTransition, type CameraSyncPose } from '../utils/threeStudioKit';
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
  buildSolarKeplerRig,
  buildWienSpectrumRig,
} from './scenes/AstronomyRigs';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { labSound } from '../utils/soundEngine';
import { triggerDomainApparatusSnap } from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import {
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';
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
  const liteDeviceMode = useUIStore((s) => s.liteDeviceMode);

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

  useEffect(() => {
    cameraCtrlRef.current?.applyLiteMode?.(liteDeviceMode);
  }, [liteDeviceMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Astronomi');

    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 760, height: 380 },
      backgroundHex: 0x0b0f17,
      fogDensity: 0.008,
      camera: {
        fov: 45,
        near: 0.1,
        far: 400,
        position: [0, 9.5, 14.5],
      },
      controls: {
        autoRotateSpeed: 1.2,
        minDistance: 3.5,
        maxDistance: 60,
      },
      onContextRestored: triggerSceneRebuild,
      onUserControlsStart: () => {
        camTransitionActive = false;
      },
      onCameraSyncChange: (pose) => onCameraSyncChangeRef.current?.(pose),
    });
    if (!host) return;

    const { scene, camera, renderer, controls, fpsMonitor, isSoftwareGl } = host;

    const desiredCamPos = new THREE.Vector3(0, 9.5, 14.5);
    const desiredTarget = new THREE.Vector3(0, 0, 0);

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        camTransitionActive = false;
        host.applyExternalCameraPose(pose);
      },
    };

    const applyCameraPreset = (presetName: CameraPreset) => {
      const canonical = normalizeAstronomyMode(latestRef.current.params.mode);
      if (canonical === 'stellar-exoplanet') {
        if (presetName === 'isometric') {
          desiredCamPos.set(3.4, 3.2, 10.2);
          desiredTarget.set(0, 0.2, 0);
        } else if (presetName === 'ecliptic') {
          desiredCamPos.set(0, 0.9, 10.6);
          desiredTarget.set(0, 0.4, 0);
        } else if (presetName === 'top') {
          desiredCamPos.set(0, 13.0, 0.5);
          desiredTarget.set(0, 0.5, 0);
        } else {
          desiredCamPos.set(0, 1.3, 8.8);
          desiredTarget.set(0, 0.85, 0);
        }
        camTransitionActive = true;
        return;
      }

      if (presetName === 'isometric') {
        desiredCamPos.set(0, 9.5, 14.5);
        desiredTarget.set(0, 0, 0);
      } else if (presetName === 'ecliptic') {
        desiredCamPos.set(0, 1.4, 15.8);
        desiredTarget.set(0, 0, 0);
      } else if (presetName === 'top') {
        desiredCamPos.set(0, 19.5, 0.5);
        desiredTarget.set(0, 0, 0);
      } else {
        desiredCamPos.set(2.5, 4.2, 8.6);
        desiredTarget.set(0, 0, 0);
      }
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
    const ambientLight = new THREE.AmbientLight(
      initialColors.ambientSkyHex,
      initialColors.ambientIntensity
    );
    scene.add(ambientLight);

    const centralStarLight = new THREE.PointLight(0xfffbeb, 65.0, 140, 2.0);
    centralStarLight.position.set(0, 0, 0);
    scene.add(centralStarLight);

    const astroShadowSize = isSoftwareGl ? 512 : 2048;
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
    astroKeyLight.shadow.bias = -0.0001;
    astroKeyLight.shadow.normalBias = 0.02;
    scene.add(astroKeyLight);

    // Multi-Layer Parallax Starfield
    const spectralPalette = [
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xf8fafc),
      new THREE.Color(0xfde047),
      new THREE.Color(0xfca5a5),
    ];
    const createStarfieldLayer = (count: number, minR: number, maxR: number, pointSize: number) => {
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
        const brightness = 0.72 + ((i * 13) % 28) / 100;
        cols[i * 3] = c.r * brightness;
        cols[i * 3 + 1] = c.g * brightness;
        cols[i * 3 + 2] = c.b * brightness;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const mat = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        sizeAttenuation: true,
      });
      return new THREE.Points(geo, mat);
    };

    const nearStarLayer = createStarfieldLayer(500, 35, 65, 0.28);
    const deepStarLayer = createStarfieldLayer(900, 68, 125, 0.18);
    scene.add(nearStarLayer, deepStarLayer);

    // Modular Per-Experiment Rigs
    const rigs: Record<AstronomyMode, AstronomyRigHandle> = {
      'solar-kepler': buildSolarKeplerRig(),
      'milkyway-galaxy': buildMilkyWayRig(),
      'stellar-exoplanet': buildExoplanetTransitRig(),
      'stellar-wien-spectrum': buildWienSpectrumRig(useUIStore.getState().liteDeviceMode || isSoftwareGl),
      'hubble-expansion': buildHubbleExpansionRig(),
    };
    (Object.values(rigs) as AstronomyRigHandle[]).forEach((rig) => scene.add(rig.group));

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => host.captureSnapshot(),
      applyTheme: (colors) => {
        scene.background = new THREE.Color(0x0b0f17);
        scene.fog = new THREE.FogExp2(0x0b0f17, 0.008);
        ambientLight.color.setHex(colors.ambientSkyHex);
        ambientLight.intensity = Math.min(0.45, colors.ambientIntensity);
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
      onCursorMove3D: (pos, normal, hoveredName) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredName);
      },
    });

    const conceptProjVec = new THREE.Vector3();
    let prevActiveMode = normalizeAstronomyMode(latestRef.current.params.mode);

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ dt, elapsed, isLite }) => {
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

        // Parallax Starfield depth shift
        nearStarLayer.rotation.y = t * 0.004;
        deepStarLayer.rotation.y = -t * 0.0015;
        nearStarLayer.position.x = -camera.position.x * 0.06;
        nearStarLayer.position.z = -camera.position.z * 0.06;
        deepStarLayer.position.x = -camera.position.x * 0.02;
        deepStarLayer.position.z = -camera.position.z * 0.02;

        const activeRig = rigs[activeMode];
        const rigFrame = activeRig.update({
          params: p,
          metrics: m,
          activePlanet: ap,
          t,
          isLite: isLite || isSoftwareGl,
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
          camTransitionActive = smoothCameraTransition(camera, controls, desiredCamPos, desiredTarget, 0.12);
        }

        teacherCollabBridge.tick();
        controls.update();

        const showLabels = showConceptLabelsRef.current;
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;
        const cDom = conceptDomRef.current;
        const cEntries = [
          {
            dom: cDom.c1,
            worldPos: rigFrame.anchors.c1?.pos ?? new THREE.Vector3(),
            text: rigFrame.anchors.c1?.text ?? '',
            active: Boolean(showLabels && rigFrame.anchors.c1),
          },
          {
            dom: cDom.c2,
            worldPos: rigFrame.anchors.c2?.pos ?? new THREE.Vector3(),
            text: rigFrame.anchors.c2?.text ?? '',
            active: Boolean(showLabels && rigFrame.anchors.c2),
          },
          {
            dom: cDom.c3,
            worldPos: rigFrame.anchors.c3?.pos ?? new THREE.Vector3(),
            text: rigFrame.anchors.c3?.text ?? '',
            active: Boolean(showLabels && rigFrame.anchors.c3),
          },
        ];
        updateProjectedConceptLabels(cEntries, camera, cw, ch, showLabels, conceptProjVec);

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
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>
            Menyetel Astronomi 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b>
          </span>
        </div>
      )}

      {/* Visual Scale Comparison Badge for Orbital Readability */}
      <div
        data-testid="astronomy-scale-badge"
        className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700/60 px-2.5 py-1 text-[10px] font-mono text-slate-300 shadow-md"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span>
          Skala Visual: Diameter benda langit diperbesar untuk keterbacaan orbit & transit · Drag objek 3D aktif
        </span>
      </div>

      {/* Consolidated Top-Right Capsule Bar */}
      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={() => {
            const { docked, transfer } = triggerDomainApparatusSnap('Astronomi');
            if (docked) {
              setDragToast({
                label: `Port Docked (${docked.portType.toUpperCase()})`,
                value: `Φ = ${(transfer?.opticalIntensityMw ?? 0).toFixed(1)} mW`,
              });
              setTimeout(() => setDragToast(null), 1800);
            }
          }}
          title="Snap-to-Port: Sambung & Transfer Aparatus Teleskop 3D"
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
              { id: 'ecliptic', label: 'Depan' },
              { id: 'top', label: 'Atas' },
              { id: 'focus', label: 'Fokus' },
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
      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="violet" />
    </div>
  );
};

export default AstronomyScene3D;
