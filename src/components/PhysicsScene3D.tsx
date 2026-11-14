import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createStudioWorkbenchGroup,
  smoothCameraTransition,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import {
  createMeasurementRuler3D,
  createProtractor3D,
} from '../utils/threeMeasurementTools';
import {
  createStudioThreePointLighting,
  initThreeStudioHost,
  startStudioRenderLoop,
} from '../utils/threeStudioHost';
import {
  PhysicsParams,
  PhysicsMetrics,
  KinematicsInstant,
} from '../utils/scienceEngine';
import { SimulationFrame } from '../utils/simulationBuffer';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { Maximize2, Minimize2, Link2, Ruler } from 'lucide-react';
import { labSound } from '../utils/soundEngine';
import {
  globalMultiApparatusEngine,
  triggerDomainApparatusSnap,
} from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import { buildPhysicsCoreStage } from './scenes/physicsCoreStage';
import {
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';
import { useThreeStudioScene } from './scenes/useThreeStudioScene';
import { useUIStore } from '../stores/useUIStore';

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
const PHYSICS_ORDERED_PRESETS: readonly CameraPreset[] = ['isometric', 'front', 'top', 'focus'];

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
    domain: 'Fisika',
    orderedPresets: PHYSICS_ORDERED_PRESETS,
    defaultPreset: 'isometric',
    comfortTheme,
    cameraSyncPose,
    onCameraSyncChange,
    onCaptureSnapshot,
  });

  const [hudCollapsed] = useState(false);
  const [followCamEnabled, setFollowCamEnabled] = useState<boolean>(true);
  const followCamRef = useRef<boolean>(true);
  followCamRef.current = followCamEnabled;
  const [showMeasureTools, setShowMeasureTools] = useState<boolean>(false);
  const showMeasureToolsRef = useRef<boolean>(false);
  showMeasureToolsRef.current = showMeasureTools;
  const [measureHud, setMeasureHud] = useState<{ ruler: string; protractor: string }>({
    ruler: '40.00 ± 0.05 cm',
    protractor: '30.0 ± 0.5°',
  });

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

  const syncConceptLabelsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    syncConceptLabelsRef.current?.();
  }, [params, metrics, showConceptLabels]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;
    const initialThemeColors = getSceneThemeColors(activeComfortTheme, 'Fisika');

    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 760, height: 380 },
      backgroundHex: 0x0b0f17,
      fogDensity: 0.014,
      camera: {
        fov: 45,
        near: 0.1,
        far: 250,
        position: [4.8, 6.2, 12.8],
      },
      controls: {
        target: [0, 1.4, 0],
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 1.2,
        maxDistance: 18,
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

    const desiredCamPos = new THREE.Vector3(4.8, 6.2, 12.8);
    const desiredTarget = new THREE.Vector3(0, 1.4, 0);

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        camTransitionActive = false;
        host.applyExternalCameraPose(pose);
      },
    };

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

    const lightingRig = createStudioThreePointLighting(scene, initialThemeColors, {
      keyPosition: [8, 14, 9],
      rimPosition: [-9, 6, -8],
      shadowBound: 12,
      shadowNear: 1,
      shadowFar: 35,
      shadowMapSize: isSoftwareGl ? 512 : 2048,
    });

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
      captureCanvas: () => host.captureSnapshot(),
      applyTheme: (colors) => lightingRig.applyTheme(colors, scene, 0.014, workbench),
    };

    const cursorManager = new SpatialCursorManager(scene);
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    const coreStage = buildPhysicsCoreStage(
      scene,
      camera,
      useUIStore.getState().liteDeviceMode || isSoftwareGl
    );

    const unsubAiAction = subscribeLabEvent(LAB_EVENTS.AI_UI_ACTION, (action) => {
      if (!action) return;
      if (action.type === 'FOCUS_CAMERA' && action.target === 'pendulum_bob') {
        const targetPos =
          coreStage.pendBobWorldPos.lengthSq() > 0.001
            ? coreStage.pendBobWorldPos
            : new THREE.Vector3(0.6, 2.4, 0);
        desiredTarget.copy(targetPos);
        desiredCamPos.set(targetPos.x + 1.8, targetPos.y + 0.85, targetPos.z + 3.8);
        camTransitionActive = true;
      }
    });

    let isDragging = false;
    let activeDragMesh: THREE.Object3D | null = null;
    let hoveredMesh: THREE.Object3D | null = null;
    const conceptProjVec = new THREE.Vector3();

    const rulerHandle = createMeasurementRuler3D({
      initialA: [-2.0, 0.38, 2.1],
      initialB: [2.0, 0.38, 2.1],
      cmPerUnit: 10,
    });
    rulerHandle.group.visible = showMeasureToolsRef.current;
    scene.add(rulerHandle.group);

    const protractorHandle = createProtractor3D(30);
    protractorHandle.group.position.set(-3.2, 1.05, 2.1);
    protractorHandle.group.visible = showMeasureToolsRef.current;
    scene.add(protractorHandle.group);

    let measurePinStartA = rulerHandle.getEndpoints().posA;
    let measurePinStartB = rulerHandle.getEndpoints().posB;
    let measureStartAngleDeg = protractorHandle.getAngleDeg();

    rulerHandle.pinA.userData.onDrag = (dx: number, dy: number) => {
      const nextA = new THREE.Vector3(
        Math.max(-5.5, Math.min(5.5, measurePinStartA.x + dx * 0.02)),
        Math.max(0.25, Math.min(4.8, measurePinStartA.y - dy * 0.02)),
        measurePinStartA.z
      );
      const readout = rulerHandle.setEndpoints(nextA, rulerHandle.getEndpoints().posB);
      setMeasureHud((prev) => ({ ...prev, ruler: readout.formatted }));
    };
    rulerHandle.pinB.userData.onDrag = (dx: number, dy: number) => {
      const nextB = new THREE.Vector3(
        Math.max(-5.5, Math.min(5.5, measurePinStartB.x + dx * 0.02)),
        Math.max(0.25, Math.min(4.8, measurePinStartB.y - dy * 0.02)),
        measurePinStartB.z
      );
      const readout = rulerHandle.setEndpoints(rulerHandle.getEndpoints().posA, nextB);
      setMeasureHud((prev) => ({ ...prev, ruler: readout.formatted }));
    };
    protractorHandle.armHandle.userData.onDrag = (dx: number, dy: number) => {
      const readout = protractorHandle.setAngleDeg(measureStartAngleDeg - dy * 0.45 + dx * 0.3);
      setMeasureHud((prev) => ({ ...prev, protractor: readout.formatted }));
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
      return list;
    };

    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x38bdf8,
      dragSpanPx: 300,
      getInteractiveObjects: getInteractiveMeshes,
      getParamValue: (key) => (latestRef.current.params as unknown as Record<string, number>)[key],
      onHoverChange: (obj) => {
        hoveredMesh = obj;
        setHoveredPartLabel(obj ? (obj.userData?.label ?? obj.name ?? 'Alat Fisika 3D') : null);
      },
      onDragStart: (obj, paramKey) => {
        if (obj.userData?.measurementHandle) {
          const ends = rulerHandle.getEndpoints();
          measurePinStartA = ends.posA;
          measurePinStartB = ends.posB;
          measureStartAngleDeg = protractorHandle.getAngleDeg();
          labSound.playClick(720);
          return;
        }
        if (paramKey && latestRef.current.onUpdateParam) {
          isDragging = true;
          activeDragMesh = obj;
          if (paramKey === 'launchAngle' || paramKey === 'initialVelocity') {
            coreStage.playCannonLaunchSound();
          } else {
            labSound.playClick(600);
          }
          const curVal = (latestRef.current.params as unknown as Record<string, number>)[paramKey] ?? 0;
          setDragToast({ label: obj.userData?.label ?? paramKey, value: `${curVal}` });
        }
      },
      onDragUpdate: (_obj, paramKey, newValue, label) => {
        if (!latestRef.current.onUpdateParam) return;
        latestRef.current.onUpdateParam(paramKey, newValue);
        setDragToast({ label: label ?? paramKey, value: `${newValue}` });
      },
      onDragEnd: (_obj, paramKey) => {
        if (paramKey === 'springDisplacement' || paramKey === 'springConstantK') {
          labSound.playSpringTwang(latestRef.current.params.springDisplacement ?? 0.8);
        }
        isDragging = false;
        activeDragMesh = null;
        setTimeout(() => setDragToast(null), 1200);
      },
      onCursorMove3D: (pos, normal, hoveredObject) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredObject);
      },
    });

    let prevSimTime = -1;

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ nowMs, dt: frameDt, isLite }) => {
        rulerHandle.group.visible = showMeasureToolsRef.current;
        protractorHandle.group.visible = showMeasureToolsRef.current;

        const {
          params: p,
          metrics: m,
          simTime: baseTime,
          showVectorOverlay: rawShowVec,
        } = latestRef.current;

        const nowSec = performance.now() / 1000;
        const t = simTimeRef && typeof simTimeRef.current === 'number' ? simTimeRef.current : baseTime;
        const isSimTimeAdvancing = prevSimTime >= 0 && t > prevSimTime + 0.0005;
        prevSimTime = t;

        const showLabels = showConceptLabelsRef.current;
        const showVec = rawShowVec || showLabels;

        coreStage.update({
          params: p,
          metrics: m,
          simTime: t,
          nowSec,
          showVectors: showVec,
          isLite: isLite || isSoftwareGl,
          isSimTimeAdvancing,
          followCamEnabled: followCamRef.current,
          camTransitionActive,
          isDragging,
          activeDragMesh,
          hoveredMesh,
          controlsTarget: controls.target,
        });

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
          const cEntries = coreStage.buildConceptEntries(curP, curM, activeLabels, cDom);
          updateProjectedConceptLabels(cEntries, camera, cw, ch, activeLabels, conceptProjVec);
        };

        syncConceptLabelsRef.current = syncConceptLabelsNow;
        syncConceptLabelsNow();

        host.renderFrame(frameDt);
      },
    });

    return () => {
      loopHandle.stop();
      unsubAiAction();
      interactionManager.dispose();
      teacherCollabBridge.dispose();
      cursorManager.dispose();
      cameraSyncHandleRef.current = null;

      globalMultiApparatusEngine.clearPortAnchors();
      rulerHandle.dispose();
      protractorHandle.dispose();
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

      {showMeasureTools && (
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-950/90 border border-sky-400/35 px-3 py-1.5 shadow-xl z-20 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-sky-300">
            <Ruler className="w-3.5 h-3.5 text-sky-400" />
            <span>Mistar:</span>
            <b className="text-white">{measureHud.ruler}</b>
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="text-amber-300">
            Busur: <b className="text-white">{measureHud.protractor}</b>
          </span>
        </div>
      )}

      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-testid="toggle-3d-measure-btn"
          onClick={() => {
            labSound.playClick(700);
            setShowMeasureTools((prev) => !prev);
          }}
          title="Tampilkan / Sembunyikan Mistar Kaliper & Busur Derajat 3D (Seret pin/lengan di layar)"
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
            showMeasureTools
              ? 'bg-sky-500 text-slate-950 font-bold'
              : 'text-sky-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Ukur 3D</span>
        </button>

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
      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="sky" />
    </div>
  );
};

export default PhysicsScene3D;
