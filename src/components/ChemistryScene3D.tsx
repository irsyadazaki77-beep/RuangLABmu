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
import { Thermometer } from 'lucide-react';
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
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { buildChemistryCoreStage } from './scenes/chemistryCoreStage';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';
import { Scene3DControlDock } from './ui/Scene3DControlDock';
import { Scene3DInspectorCard } from './ui/Scene3DInspectorCard';
import {
  getAdaptiveCameraPose,
  resolveApparatusInspection,
  type ApparatusInspectionInfo,
} from '../utils/studio3DCatalog';
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

type CameraPreset = 'isometric' | 'front' | 'top' | 'focus';
const CHEM_ORDERED_PRESETS: readonly CameraPreset[] = ['isometric', 'front', 'top', 'focus'];

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

  const { leftDrawerOpen, zenMode } = useUIStore(
    useShallow((s) => ({
      leftDrawerOpen: s.leftDrawerOpen,
      zenMode: s.zenMode,
    }))
  );

  const [showProbe3D, setShowProbe3D] = useState<boolean>(false);
  const showProbe3DRef = useRef<boolean>(false);
  showProbe3DRef.current = showProbe3D;
  const [probeHudText, setProbeHudText] = useState<{ text: string; color: string } | null>(null);
  const [inspectedPart, setInspectedPart] = useState<ApparatusInspectionInfo | null>(null);
  const prevChemModeRef = useRef<string>(params.mode);
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
    if (prevChemModeRef.current !== params.mode) {
      prevChemModeRef.current = params.mode;
      setInspectedPart(null);
      cameraCtrlRef.current?.setPreset('isometric');
    }
  }, [params.mode, cameraCtrlRef]);

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

    const initialPose = getAdaptiveCameraPose('chemistry', latestRef.current.params.mode, 'isometric');
    let camTransitionActive = false;
    let syncChemLabelsOnResize: ((w: number, h: number) => void) | null = null;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 760, height: 380 },
      backgroundHex: initialColors.backgroundHex,
      fogDensity: 0.015,
      domainPreset: 'chemistry',
      camera: {
        fov: 45,
        near: 0.1,
        far: 200,
        position: initialPose.pos,
      },
      controls: {
        target: initialPose.target,
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 3.5,
        maxDistance: 24,
        autoRotateSpeed: 1.4,
      },
      onContextRestored: triggerSceneRebuild,
      onResize: (w, h) => {
        syncChemLabelsOnResize?.(w, h);
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

    const applyCameraPreset = (presetName: CameraPreset) => {
      const pose = getAdaptiveCameraPose('chemistry', latestRef.current.params.mode, presetName);
      desiredCamPos.set(...pose.pos);
      desiredTarget.set(...pose.target);
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
          coreStage.triggerWobbleBoost(0.06);
        }
      },
      onDragUpdate: (_obj, paramKey, newValue, label) => {
        if (!latestRef.current.onUpdateParam) return;
        latestRef.current.onUpdateParam(paramKey, newValue);
        coreStage.triggerWobbleBoost(0.065);
        if (paramKey === 'titrantAddedMl') {
          coreStage.playBuretteDropSound();
        }
        setDragToast({ label: label ?? paramKey, value: `${newValue}` });
      },
      onDragEnd: () => {
        if (dragToastTimer) clearTimeout(dragToastTimer);
        dragToastTimer = setTimeout(() => setDragToast(null), 1200);
      },
      onClick: (obj) => {
        if (obj.userData?.measurementHandle) return;
        labSound.playClick(640);
        const hint = String(obj.userData?.label ?? obj.name ?? '');
        setInspectedPart(
          resolveApparatusInspection('chemistry', latestRef.current.params.mode, hint || undefined)
        );
      },
      onCursorMove3D: (pos, normal, hoveredObject) => {
        latestRef.current.onEmitCursor?.(pos, normal, hoveredObject);
      },
    });
    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;

    let prevSimTime = -1;
    let wasProbeVisible = false;
    let lastProbeHudMs = -1;

    syncChemLabelsOnResize = (rw: number, rh: number) => {
      const cDom = conceptDomRef.current;
      const showLabels = showConceptLabelsRef.current;
      const { params: p, metrics: m } = latestRef.current;
      const cEntries = coreStage.buildConceptEntries(p, m, showLabels, cDom);
      updateProjectedConceptLabels(cEntries, camera, rw, rh, showLabels, conceptProjVec);
    };

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
        onSelectSlot={(slotId, labelText) => {
          setInspectedPart(resolveApparatusInspection('chemistry', params.mode, `${slotId} ${labelText}`));
        }}
      />

      {showProbe3D && (
        <div
          className={`pointer-events-none absolute flex items-center gap-2 rounded-xl studio-hud-surface border px-3 py-1.5 shadow-xl z-20 text-xs font-mono ${
            isFullscreen
              ? 'bottom-16 left-4'
              : `bottom-[118px] lg:bottom-[104px] ${!zenMode && leftDrawerOpen ? 'left-3 lg:left-[336px] xl:left-[348px]' : 'left-3'}`
          }`}
        >
          <Thermometer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="text-[var(--comfort-hud-muted)]">Sensor Probe 3D:</span>
          <span className="font-bold" style={{ color: probeHudText?.color ?? '#0284c7' }}>
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
        <div className="pointer-events-none absolute bottom-[118px] lg:bottom-[104px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl studio-hud-surface border border-teal-500/45 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-[var(--comfort-hud-text)]">
          <span>
            Menyetel Kimia 3D: {dragToast.label} ={' '}
            <b className="text-teal-700 dark:text-teal-300">{dragToast.value}</b>
          </span>
        </div>
      )}

      <Scene3DInspectorCard
        info={inspectedPart}
        liveMetricSummary={
          params.mode === 'acid-base-titration'
            ? `pH = ${(metrics.currentPh ?? 7.0).toFixed(2)}`
            : params.mode === 'thermo-calorimetry'
            ? `T akhir = ${(metrics.finalTempC ?? params.initialTempC ?? 25).toFixed(1)} °C`
            : undefined
        }
        onClose={() => setInspectedPart(null)}
      />

      <Scene3DControlDock
        accentTone="teal"
        activePreset={activePreset}
        onResetCamera={() => handleSelectCameraPreset('isometric')}
        onSelectPreset={handleSelectCameraPreset}
        isVRSupported={true}
        onEnterVR={() => {
          labSound.playClick(700);
          void toggleImmersiveVRSession();
        }}
        onSnapApparatus={() => {
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
        tools={[
          {
            id: 'probe-3d',
            testId: 'toggle-3d-probe-btn',
            label: 'Probe',
            title: 'Tampilkan / Sembunyikan Probe Sensor pH & Termokopel Digital 3D (Seret probe di meja)',
            active: showProbe3D,
            icon: <Thermometer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
            onClick: () => {
              labSound.playClick(700);
              setShowProbe3D((prev) => !prev);
            },
          },
        ]}
        onOpenInspector={() =>
          setInspectedPart((prev) =>
            prev ? null : resolveApparatusInspection('chemistry', params.mode, hoveredPartLabel ?? undefined)
          )
        }
        inspectorActive={Boolean(inspectedPart)}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="emerald" />
    </div>
  );
};

export default ChemistryScene3D;
