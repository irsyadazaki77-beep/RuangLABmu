import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createStudioWorkbenchGroup,
  smoothCameraDamp,
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
import { Eye, EyeOff, Ruler } from 'lucide-react';
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
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../stores/useUIStore';

interface PhysicsScene3DProps {
  params: PhysicsParams;
  metrics: PhysicsMetrics;
  instant: KinematicsInstant;
  simTime: number;
  simTimeRef?: React.RefObject<number>;
  showVectorOverlay: boolean;
  onToggleVectorOverlay?: () => void;
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
  onToggleVectorOverlay,
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

  const { leftDrawerOpen, zenMode } = useUIStore(
    useShallow((s) => ({
      leftDrawerOpen: s.leftDrawerOpen,
      zenMode: s.zenMode,
    }))
  );

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
  const [inspectedPart, setInspectedPart] = useState<ApparatusInspectionInfo | null>(null);
  const prevPhysicsModeRef = useRef<string>(params.mode);

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
    syncConceptLabelsRef.current?.();
  }, [params, metrics, showConceptLabels]);

  useEffect(() => {
    if (prevPhysicsModeRef.current !== params.mode) {
      prevPhysicsModeRef.current = params.mode;
      setInspectedPart(null);
      cameraCtrlRef.current?.setPreset('isometric');
    }
  }, [params.mode, cameraCtrlRef]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;
    const initialThemeColors = getSceneThemeColors(activeComfortTheme, 'Fisika');

    const initialPose = getAdaptiveCameraPose('physics', latestRef.current.params.mode, 'isometric');
    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 760, height: 380 },
      backgroundHex: initialThemeColors.backgroundHex,
      fogDensity: 0.014,
      domainPreset: 'physics',
      camera: {
        fov: 45,
        near: 0.1,
        far: 250,
        position: initialPose.pos,
      },
      controls: {
        target: initialPose.target,
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 1.2,
        maxDistance: 18,
        autoRotateSpeed: 1.4,
      },
      onContextRestored: triggerSceneRebuild,
      onResize: () => {
        syncConceptLabelsRef.current?.();
      },
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

    const applyCameraPreset = (preset: CameraPreset) => {
      const pose = getAdaptiveCameraPose('physics', latestRef.current.params.mode, preset);
      desiredCamPos.set(...pose.pos);
      desiredTarget.set(...pose.target);
      camTransitionActive = true;
    };

    const lightingRig = createStudioThreePointLighting(scene, initialThemeColors, {
      keyPosition: [8, 14, 9],
      rimPosition: [-9, 6, -8],
      shadowBound: 12,
      shadowNear: 1,
      shadowFar: 35,
      shadowMapSize: isSoftwareGl ? 512 : 1024,
    });
    host.registerShadowLight(lightingRig.keyLight);

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
    const scratchDragA = new THREE.Vector3();
    const scratchDragB = new THREE.Vector3();

    rulerHandle.pinA.userData.onDrag = (dx: number, dy: number) => {
      scratchDragA.set(
        Math.max(-5.5, Math.min(5.5, measurePinStartA.x + dx * 0.02)),
        Math.max(0.25, Math.min(4.8, measurePinStartA.y - dy * 0.02)),
        measurePinStartA.z
      );
      const readout = rulerHandle.setEndpoints(scratchDragA, rulerHandle.getEndpoints().posB);
      setMeasureHud((prev) => ({ ...prev, ruler: readout.formatted }));
    };
    rulerHandle.pinB.userData.onDrag = (dx: number, dy: number) => {
      scratchDragB.set(
        Math.max(-5.5, Math.min(5.5, measurePinStartB.x + dx * 0.02)),
        Math.max(0.25, Math.min(4.8, measurePinStartB.y - dy * 0.02)),
        measurePinStartB.z
      );
      const readout = rulerHandle.setEndpoints(rulerHandle.getEndpoints().posA, scratchDragB);
      setMeasureHud((prev) => ({ ...prev, ruler: readout.formatted }));
    };
    protractorHandle.armHandle.userData.onDrag = (dx: number, dy: number) => {
      const readout = protractorHandle.setAngleDeg(measureStartAngleDeg - dy * 0.45 + dx * 0.3);
      setMeasureHud((prev) => ({ ...prev, protractor: readout.formatted }));
    };

    const cachedBaseInteractive: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        (obj.userData?.draggableParam || obj.userData?.measurementHandle || obj.userData?.interactive)
      ) {
        cachedBaseInteractive.push(obj);
      }
    });

    const isObjChainVisible = (obj: THREE.Object3D): boolean => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    };

    const activeInteractiveList: THREE.Object3D[] = [];
    const getInteractiveMeshes = (): THREE.Object3D[] => {
      activeInteractiveList.length = 0;
      for (let i = 0; i < cachedBaseInteractive.length; i++) {
        const obj = cachedBaseInteractive[i];
        if (isObjChainVisible(obj)) {
          activeInteractiveList.push(obj);
        }
      }
      return activeInteractiveList;
    };

    let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const scheduleClearToast = (delayMs: number) => {
      if (toastTimeoutId) clearTimeout(toastTimeoutId);
      toastTimeoutId = setTimeout(() => {
        toastTimeoutId = null;
        setDragToast(null);
      }, delayMs);
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
        scheduleClearToast(1200);
      },
      onClick: (obj) => {
        if (obj.userData?.measurementHandle) return;
        labSound.playClick(640);
        const hint = String(obj.userData?.label ?? obj.name ?? '');
        setInspectedPart(
          resolveApparatusInspection('physics', latestRef.current.params.mode, hint || undefined)
        );
      },
      onCursorMove3D: (pos, normal, hoveredObject) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredObject);
      },
    });

    let prevSimTime = -1;

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

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ nowMs, dt: frameDt, isLite, particleScale }) => {
        rulerHandle.group.visible = showMeasureToolsRef.current;
        protractorHandle.group.visible = showMeasureToolsRef.current;

        const {
          params: p,
          metrics: m,
          simTime: baseTime,
          showVectorOverlay: rawShowVec,
        } = latestRef.current;

        const nowSec = nowMs * 0.001;
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
          particleScale,
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
          camTransitionActive = smoothCameraDamp(
            camera,
            controls,
            desiredCamPos,
            desiredTarget,
            frameDt,
            7.2
          );
        }

        teacherCollabBridge.tick(nowMs, frameDt);
        controls.update();

        syncConceptLabelsNow();

        host.renderFrame(frameDt);
      },
    });

    return () => {
      loopHandle.stop();
      if (toastTimeoutId) clearTimeout(toastTimeoutId);
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
        onSelectSlot={(slotId, labelText) => {
          setInspectedPart(resolveApparatusInspection('physics', params.mode, `${slotId} ${labelText}`));
        }}
      />

      {showMeasureTools && (
        <div
          className={`pointer-events-none absolute flex flex-wrap items-center gap-3 rounded-xl studio-hud-surface border px-3 py-1.5 shadow-xl z-20 text-xs font-mono ${
            isFullscreen
              ? 'bottom-16 left-4'
              : `bottom-[96px] lg:bottom-[100px] ${!zenMode && leftDrawerOpen ? 'left-3 lg:left-[320px] xl:left-[340px]' : 'left-3'}`
          }`}
        >
          <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
            <Ruler className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Mistar:</span>
            <b className="text-[var(--comfort-hud-text)]">{measureHud.ruler}</b>
          </span>
          <span className="h-3 w-px bg-[var(--comfort-border)]" />
          <span className="text-amber-700 dark:text-amber-300">
            Busur: <b className="text-[var(--comfort-hud-text)]">{measureHud.protractor}</b>
          </span>
        </div>
      )}

      {dragToast && (
        <div className="pointer-events-none absolute bottom-[96px] lg:bottom-[100px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl studio-hud-surface border border-sky-500/45 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-[var(--comfort-hud-text)]">
          <span>
            Menyetel 3D: {dragToast.label} ={' '}
            <b className="text-sky-700 dark:text-sky-300">{dragToast.value}</b>
          </span>
        </div>
      )}

      <Scene3DInspectorCard
        info={inspectedPart}
        liveMetricSummary={
          Number.isFinite(metrics.acceleration) && params.mode === 'newton-incline'
            ? `a = ${metrics.acceleration.toFixed(2)} m/s²`
            : Number.isFinite(instant.speed)
            ? `v = ${instant.speed.toFixed(2)} m/s`
            : undefined
        }
        onClose={() => setInspectedPart(null)}
      />

      <Scene3DControlDock
        accentTone="sky"
        activePreset={activePreset}
        onResetCamera={() => handleSelectCameraPreset('isometric')}
        onSelectPreset={handleSelectCameraPreset}
        isVRSupported={true}
        onEnterVR={() => {
          labSound.playClick(700);
          void toggleImmersiveVRSession();
        }}
        onSnapApparatus={() => {
          const { docked, transfer } = triggerDomainApparatusSnap('Fisika');
          if (docked) {
            setDragToast({
              label: `Port Docked (${docked.portType.toUpperCase()})`,
              value: `I = ${(transfer?.electricCurrentAmp ?? 0).toFixed(2)} A`,
            });
            if (snapToastTimerRef.current) clearTimeout(snapToastTimerRef.current);
            snapToastTimerRef.current = setTimeout(() => {
              snapToastTimerRef.current = null;
              setDragToast(null);
            }, 1800);
          }
        }}
        tools={[
          ...(onToggleVectorOverlay
            ? [
                {
                  id: 'vector-3d',
                  testId: 'toggle-3d-vectors-btn',
                  label: 'Vektor',
                  title: 'Tampilkan / Sembunyikan Panah Vektor Gaya 3D',
                  active: showVectorOverlay,
                  icon: showVectorOverlay ? (
                    <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ),
                  onClick: () => {
                    labSound.playClick(showVectorOverlay ? 520 : 680);
                    onToggleVectorOverlay();
                  },
                },
              ]
            : []),
          {
            id: 'measure-3d',
            testId: 'toggle-3d-measure-btn',
            label: 'Ukur 3D',
            title: 'Tampilkan / Sembunyikan Mistar Kaliper & Busur Derajat 3D (Seret pin/lengan di layar)',
            active: showMeasureTools,
            icon: <Ruler className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
            onClick: () => {
              labSound.playClick(700);
              setShowMeasureTools((prev) => !prev);
            },
          },
        ]}
        extraControl={
          params.mode === 'projectile-gravity' || (params.mode as string) === 'projectile-motion' ? (
            <button
              type="button"
              data-testid="projectile-follow-cam-toggle"
              aria-pressed={followCamEnabled}
              onClick={() => {
                labSound.playClick(680);
                setFollowCamEnabled((prev) => !prev);
              }}
              title="Follow Cam: Ikuti lintasan proyektil secara halus"
              className={`px-2 py-1 text-2xs font-mono rounded-lg transition-colors cursor-pointer shrink-0 ${
                followCamEnabled
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-[var(--comfort-hud-text)]/80 hover:text-[var(--comfort-hud-text)] hover:bg-sky-500/12'
              }`}
            >
              Follow
            </button>
          ) : undefined
        }
        onOpenInspector={() =>
          setInspectedPart((prev) =>
            prev ? null : resolveApparatusInspection('physics', params.mode, hoveredPartLabel ?? undefined)
          )
        }
        inspectorActive={Boolean(inspectedPart)}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="sky" />
    </div>
  );
};

export default PhysicsScene3D;
