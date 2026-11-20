import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createStudioWorkbenchGroup,
  smoothCameraDamp,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import { createDigitalProbe3D } from '../utils/threeMeasurementTools';
import {
  createStudioThreePointLighting,
  initThreeStudioHost,
  startStudioRenderLoop,
} from '../utils/threeStudioHost';
import {
  ChemistryParams,
  ChemistryMetrics,
  ThermoReactionPreset,
  RedoxCouplePreset,
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
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import {
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { buildChemistryCoreStage } from './scenes/chemistryCoreStage';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';
import { useThreeStudioScene } from './scenes/useThreeStudioScene';

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
const CHEM_ORDERED_PRESETS: readonly CameraPreset[] = ['isometric', 'front', 'top', 'closeup'];

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
    domain: 'Kimia',
    orderedPresets: CHEM_ORDERED_PRESETS,
    defaultPreset: 'isometric',
    comfortTheme,
    cameraSyncPose,
    onCameraSyncChange,
    onCaptureSnapshot,
  });

  const { leftDrawerOpen, rightTelemetryOpen, zenMode } = useUIStore(
    useShallow((s) => ({
      leftDrawerOpen: s.leftDrawerOpen,
      rightTelemetryOpen: s.rightTelemetryOpen,
      zenMode: s.zenMode,
    }))
  );

  const [showProbe3D, setShowProbe3D] = useState<boolean>(false);
  const showProbe3DRef = useRef<boolean>(false);
  showProbe3DRef.current = showProbe3D;
  const [probeHudText, setProbeHudText] = useState<{ text: string; color: string } | null>(null);
  const snapToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (snapToastTimerRef.current) {
        clearTimeout(snapToastTimerRef.current);
        snapToastTimerRef.current = null;
      }
    };
  }, []);

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
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 3.5,
        maxDistance: 24,
        autoRotateSpeed: 1.4,
      },
      onContextRestored: triggerSceneRebuild,
      onUserControlsStart: () => {
        camTransitionActive = false;
      },
      onCameraSyncChange: (pose) => onCameraSyncChangeRef.current?.(pose),
    });
    if (!host) return;

    const { scene, camera, renderer, controls, fpsMonitor, isSoftwareGl } = host;

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

    const lightingRig = createStudioThreePointLighting(scene, initialColors, {
      keyPosition: [6, 12, 8],
      rimPosition: [-7, 5, -6],
      shadowBound: 8,
      shadowNear: 0.5,
      shadowFar: 35,
      shadowMapSize: isSoftwareGl ? 512 : 1024,
    });
    host.registerShadowLight(lightingRig.keyLight);

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
      applyTheme: (colors) => lightingRig.applyTheme(colors, scene, 0.015, workbench),
    };

    const initialLiteOrSw = useUIStore.getState().liteDeviceMode || isSoftwareGl;
    const cursorManager = new SpatialCursorManager(scene);
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    const coreStage = buildChemistryCoreStage(
      scene,
      camera,
      initialLiteOrSw,
      latestRef.current.params.titrantAddedMl ?? 0
    );

    const cachedStageInteractiveMeshes: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        (obj.userData?.draggableParam || obj.userData?.measurementHandle || obj.userData?.interactive)
      ) {
        cachedStageInteractiveMeshes.push(obj);
      }
    });

    const probeHandle = createDigitalProbe3D('ph');
    probeHandle.group.position.set(1.35, 2.25, 0.35);
    probeHandle.group.visible = showProbe3DRef.current;
    scene.add(probeHandle.group);

    const conceptProjVec = new THREE.Vector3();
    let probeStartX = probeHandle.group.position.x;
    let probeStartZ = probeHandle.group.position.z;

    probeHandle.bodyMesh.userData.onDrag = (dx: number, dy: number) => {
      probeHandle.group.position.x = Math.max(-3.6, Math.min(3.6, probeStartX + dx * 0.02));
      probeHandle.group.position.z = Math.max(-2.6, Math.min(2.6, probeStartZ + dy * 0.02));
    };

    const cachedProbeHandles = probeHandle.getInteractiveHandles();
    const interactiveScratch: THREE.Object3D[] = [];
    const isHierarchyVisible = (obj: THREE.Object3D): boolean => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    };
    const getInteractiveMeshes = (): THREE.Object3D[] => {
      interactiveScratch.length = 0;
      for (let i = 0; i < cachedStageInteractiveMeshes.length; i += 1) {
        const mesh = cachedStageInteractiveMeshes[i];
        if (isHierarchyVisible(mesh)) {
          interactiveScratch.push(mesh);
        }
      }
      if (probeHandle.group.visible) {
        for (let i = 0; i < cachedProbeHandles.length; i += 1) {
          interactiveScratch.push(cachedProbeHandles[i]);
        }
      }
      return interactiveScratch;
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
          coreStage.triggerWobbleBoost(0.08);
          const curVal = (latestRef.current.params as unknown as Record<string, number>)[paramKey] ?? 0;
          if (paramKey === 'titrantAddedMl') {
            const nextVal = Math.min(50, Number((curVal + 1.0).toFixed(1)));
            latestRef.current.onUpdateParam(paramKey, nextVal);
            coreStage.playBuretteDropSound();
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
        coreStage.triggerWobbleBoost(0.065);
        setDragToast({ label: label ?? paramKey, value: `${newValue}` });
      },
      onDragEnd: () => {
        if (dragToastTimer) clearTimeout(dragToastTimer);
        dragToastTimer = setTimeout(() => setDragToast(null), 1200);
      },
      onCursorMove3D: (pos, normal, hoveredObject) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredObject);
      },
    });
    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;

    let prevSimTime = -1;
    let wasProbeVisible = false;
    let lastProbeHudMs = -1;

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ nowMs, dt, elapsed, isLite, particleScale }) => {
        const {
          params: p,
          metrics: m,
          isReacting: reacting,
          simTime: propSimTime,
          simTimeRef: propSimTimeRef,
        } = latestRef.current;

        const t =
          propSimTimeRef && typeof propSimTimeRef.current === 'number'
            ? propSimTimeRef.current
            : typeof propSimTime === 'number'
            ? propSimTime
            : elapsed;
        const isSimTimeAdvancing = prevSimTime >= 0 && t > prevSimTime + 0.0005;
        prevSimTime = t;

        const isRedox = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
        const showLabels = showConceptLabelsRef.current;

        coreStage.update({
          params: p,
          metrics: m,
          simTime: t,
          elapsed,
          dt,
          isLite: isLite || isSoftwareGl,
          particleScale,
          reacting,
          isSimTimeAdvancing,
          showConceptLabels: showLabels,
        });

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
          if (!wasProbeVisible || lastProbeHudMs < 0 || nowMs - lastProbeHudMs >= 150) {
            wasProbeVisible = true;
            lastProbeHudMs = nowMs;
            setProbeHudText({ text: probeOut.formatted, color: probeOut.severityHex });
          }
        } else {
          wasProbeVisible = false;
        }

        cursorManager.update(
          latestRef.current.remoteCursors || {},
          camera.position
        );

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

        const cDom = conceptDomRef.current;
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;
        const cEntries = coreStage.buildConceptEntries(p, m, showLabels, cDom);
        updateProjectedConceptLabels(cEntries, camera, cw, ch, showLabels, conceptProjVec);

        host.renderFrame(dt);
      },
    });

    return () => {
      loopHandle.stop();
      if (dragToastTimer) clearTimeout(dragToastTimer);
      unsubAiAction();
      interactionManager.dispose();
      teacherCollabBridge.dispose();
      cursorManager.dispose();
      cameraSyncHandleRef.current = null;

      globalMultiApparatusEngine.clearPortAnchors();
      probeHandle.dispose();
      workbench.dispose();
      coreStage.dispose();
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

      {showProbe3D && (
        <div
          className={`pointer-events-none absolute flex items-center gap-2 rounded-xl bg-slate-950/92 border border-white/15 px-3 py-1.5 shadow-xl z-20 text-xs font-mono ${
            isFullscreen
              ? 'bottom-4 left-4'
              : `bottom-24 lg:bottom-20 ${!zenMode && leftDrawerOpen ? 'left-3 lg:left-[356px]' : 'left-3'}`
          }`}
        >
          <Thermometer className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400">Sensor Probe 3D:</span>
          <span className="font-bold" style={{ color: probeHudText?.color ?? '#38bdf8' }}>
            {probeHudText?.text ??
              (params.mode === 'acid-base-titration' ||
              params.mode === 'electrochemistry-cell' ||
              params.mode === 'spectrophotometry-beer'
                ? `pH ${(metrics.currentPh ?? 7.0).toFixed(2)}`
                : `${(metrics.finalTempC ?? params.initialTempC ?? 25).toFixed(1)} °C`)}
          </span>
        </div>
      )}

      {dragToast && (
        <div className="pointer-events-none absolute bottom-24 lg:bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel Kimia 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      <div
        className={`pointer-events-auto absolute flex items-center gap-1 rounded-xl bg-slate-900/92 border border-white/15 px-2 py-1 shadow-lg z-20 opacity-90 hover:opacity-100 transition-all ${
          isFullscreen
            ? 'top-3 right-3'
            : `top-16 ${!zenMode && rightTelemetryOpen ? 'right-3 lg:right-[368px]' : 'right-3'}`
        }`}
      >
        <button
          type="button"
          data-testid="toggle-3d-probe-btn"
          aria-pressed={showProbe3D}
          onClick={() => {
            labSound.playClick(700);
            setShowProbe3D((prev) => !prev);
          }}
          title="Tampilkan / Sembunyikan Probe Sensor pH & Termokopel Digital 3D (Seret probe di meja)"
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            showProbe3D
              ? 'bg-sky-500 text-slate-950 font-bold'
              : 'text-sky-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
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
              if (snapToastTimerRef.current) clearTimeout(snapToastTimerRef.current);
              snapToastTimerRef.current = setTimeout(() => {
                snapToastTimerRef.current = null;
                setDragToast(null);
              }, 1800);
            }
          }}
          title="Snap-to-Port: Sambung & Transfer Reagen Kimia 3D"
          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">Snap</span>
        </button>

        <button
          type="button"
          data-testid="enter-vr-lab-btn"
          aria-label="Mode VR Spasial 3D"
          onClick={() => {
            labSound.playClick(700);
            void toggleImmersiveVRSession();
          }}
          title="Mode VR Spasial 3D (WebXR Immersive-VR)"
          className="px-1.5 py-1 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span aria-hidden="true">🥽</span>
        </button>

        <span className="mx-0.5 h-3.5 w-px bg-white/15" aria-hidden="true" />

        <div className="hidden md:flex items-center gap-0.5">
          <button
            type="button"
            data-testid="camera-reset-btn"
            aria-label="Reset View Kamera 3D"
            onClick={() => handleSelectCameraPreset('isometric')}
            title="Reset View ke Sudut 3D Awal"
            className="px-2 py-1 text-[11px] font-medium rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Reset
          </button>
          {(
            [
              { id: 'isometric', label: '3D' },
              { id: 'front', label: 'Depan' },
              { id: 'top', label: 'Atas' },
              { id: 'closeup', label: 'Fokus' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              title={`Sudut Kamera ${p.label}`}
              aria-pressed={activePreset === p.id}
              onClick={() => handleSelectCameraPreset(p.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
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
          aria-label={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D'}
          aria-pressed={isFullscreen}
          className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
          )}
        </button>
      </div>
      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="emerald" />
    </div>
  );
};

export default ChemistryScene3D;
