import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  smoothCameraDamp,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import { createMeasurementRuler3D } from '../utils/threeMeasurementTools';
import { initThreeStudioHost, startStudioRenderLoop } from '../utils/threeStudioHost';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import { Focus, Ruler } from 'lucide-react';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { labSound } from '../utils/soundEngine';
import { triggerDomainApparatusSnap } from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { AnatomySubScene3D, AnatomyModuleId } from './scenes/AnatomySubScene3D';
import { buildBiologyCoreStage, CoreBiologyStageMode } from './scenes/biologyCoreStage';
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
import { PrecisionSlider } from './controls/PrecisionSlider';

interface BiologyScene3DProps {
  mode: CoreBiologyStageMode | AnatomyModuleId;
  params: Record<string, number>;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  isPlaying?: boolean;
  simTime?: number;
  simTimeRef?: React.RefObject<number>;
  onUpdateParam?: (paramKey: string, value: number) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
  comfortTheme?: ComfortThemeMode;
  cameraSyncPose?: CameraSyncPose | null;
  onCameraSyncChange?: (pose: Omit<CameraSyncPose, 'seq'>) => void;
}

type BioCameraPreset = 'isometric' | 'front' | 'top' | 'focus';
const BIO_ORDERED_PRESETS: readonly BioCameraPreset[] = ['isometric', 'front', 'top', 'focus'];

export const BiologyScene3D: React.FC<BiologyScene3DProps> = ({
  mode,
  params,
  remoteCursors = {},
  onEmitCursor,
  isPlaying = true,
  simTime,
  simTimeRef,
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
    setActivePreset,
    dragToast,
    setDragToast,
    hoveredPartLabel,
    setHoveredPartLabel,
    sceneKey,
    triggerSceneRebuild,
    cameraCtrlRef,
    cameraSyncHandleRef,
    onCameraSyncChangeRef,
  } = useThreeStudioScene<BioCameraPreset>({
    domain: 'Biologi',
    orderedPresets: BIO_ORDERED_PRESETS,
    defaultPreset: 'isometric',
    comfortTheme,
    cameraSyncPose,
    onCameraSyncChange,
    onCaptureSnapshot,
  });

  const cursorManagerRef = useRef<SpatialCursorManager | null>(null);
  const onEmitCursorRef = useRef(onEmitCursor);
  onEmitCursorRef.current = onEmitCursor;
  const onUpdateParamRef = useRef(onUpdateParam);
  onUpdateParamRef.current = onUpdateParam;
  const latestParamsRef = useRef(params);
  latestParamsRef.current = params;
  const simTimePropRef = useRef(simTime);
  simTimePropRef.current = simTime;
  const externalSimTimeRef = useRef(simTimeRef);
  externalSimTimeRef.current = simTimeRef;

  const { leftDrawerOpen, zenMode } = useUIStore(
    useShallow((s) => ({
      leftDrawerOpen: s.leftDrawerOpen,
      zenMode: s.zenMode,
    }))
  );

  const [inspectedPart, setInspectedPart] = useState<ApparatusInspectionInfo | null>(null);
  const [snapToast, setSnapToast] = useState<string | null>(null);
  const [showRuler3D, setShowRuler3D] = useState<boolean>(false);
  const showRuler3DRef = useRef<boolean>(false);
  showRuler3DRef.current = showRuler3D;
  const [rulerReadout, setRulerReadout] = useState<string | null>(null);
  const [showFocusLens, setShowFocusLens] = useState<boolean>(false);
  const [lensFocus, setLensFocus] = useState<number>(75);
  const lensFocusRef = useRef<number>(75);
  lensFocusRef.current = lensFocus;

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
    setInspectedPart(null);
  }, [mode]);

  useEffect(() => {
    syncConceptLabelsRef.current?.();
  }, [mode, params, showConceptLabels]);

  const isAnatomyMode =
    mode === 'anatomy-cardiovascular-heart' ||
    mode === 'anatomy-respiratory-lungs' ||
    mode === 'anatomy-neural-synapse';

  useEffect(() => {
    if (isAnatomyMode) return;
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Biologi');

    const initialPose = getAdaptiveCameraPose('biology', mode, 'isometric');
    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 600, height: 450 },
      backgroundHex: initialColors.backgroundHex,
      fogDensity: 0.02,
      camera: {
        fov: 45,
        near: 0.1,
        far: 100,
        position: initialPose.pos,
        lookAt: initialPose.target,
      },
      controls: {
        target: initialPose.target,
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 2.0,
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

    const baseCamPos = new THREE.Vector3(...initialPose.pos);
    const desiredCamPos = new THREE.Vector3(...initialPose.pos);
    const desiredTarget = new THREE.Vector3(...initialPose.target);

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        camTransitionActive = false;
        host.applyExternalCameraPose(pose);
      },
    };

    const applyCameraPreset = (preset: BioCameraPreset) => {
      const pose = getAdaptiveCameraPose('biology', mode, preset);
      baseCamPos.set(...pose.pos);
      desiredTarget.set(...pose.target);
      desiredCamPos.copy(baseCamPos);
      camTransitionActive = true;
    };

    const cursorManager = new SpatialCursorManager(scene);
    cursorManagerRef.current = cursorManager;
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    const initialLite = useUIStore.getState().liteDeviceMode || isSoftwareGl;
    const coreStage = buildBiologyCoreStage(
      scene,
      renderer,
      mode as CoreBiologyStageMode,
      initialColors,
      initialLite,
      isSoftwareGl
    );
    host.registerShadowLight(coreStage.keyLight);

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => host.captureSnapshot(),
      applyTheme: (colors) => coreStage.applyTheme(colors),
    };

    const conceptProjVec = new THREE.Vector3();
    const zeroConceptVec = new THREE.Vector3();

    const rulerHandle = createMeasurementRuler3D({
      initialA: [-1.15, 0.42, 1.35],
      initialB: [1.15, 0.42, 1.35],
      cmPerUnit: 10,
    });
    rulerHandle.group.visible = showRuler3DRef.current;
    scene.add(rulerHandle.group);

    let dragPinStartA = rulerHandle.getEndpoints().posA;
    let dragPinStartB = rulerHandle.getEndpoints().posB;
    const scratchPinA = new THREE.Vector3();
    const scratchPinB = new THREE.Vector3();
    rulerHandle.pinA.userData = {
      ...rulerHandle.pinA.userData,
      onDrag: (dx: number, dy: number) => {
        scratchPinA.set(
          Math.max(-3.2, Math.min(3.2, dragPinStartA.x + dx * 0.015)),
          dragPinStartA.y,
          Math.max(-2.6, Math.min(2.6, dragPinStartA.z + dy * 0.015))
        );
        const currentB = rulerHandle.getEndpoints().posB;
        const res = rulerHandle.setEndpoints(scratchPinA, currentB);
        setRulerReadout(res.formatted);
      },
    };
    rulerHandle.pinB.userData = {
      ...rulerHandle.pinB.userData,
      onDrag: (dx: number, dy: number) => {
        scratchPinB.set(
          Math.max(-3.2, Math.min(3.2, dragPinStartB.x + dx * 0.015)),
          dragPinStartB.y,
          Math.max(-2.6, Math.min(2.6, dragPinStartB.z + dy * 0.015))
        );
        const currentA = rulerHandle.getEndpoints().posA;
        const res = rulerHandle.setEndpoints(currentA, scratchPinB);
        setRulerReadout(res.formatted);
      },
    };

    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;
    const cachedRulerHandles = rulerHandle.getInteractiveHandles();
    const interactiveScratch: THREE.Object3D[] = [];

    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x10b981,
      getInteractiveObjects: () => {
        if (!rulerHandle.group.visible) {
          return coreStage.apparatusGroup.children;
        }
        interactiveScratch.length = 0;
        const appChildren = coreStage.apparatusGroup.children;
        for (let i = 0; i < appChildren.length; i += 1) {
          interactiveScratch.push(appChildren[i]);
        }
        for (let i = 0; i < cachedRulerHandles.length; i += 1) {
          interactiveScratch.push(cachedRulerHandles[i]);
        }
        return interactiveScratch;
      },
      getParamValue: (paramKey) => {
        const val = (latestParamsRef.current as unknown as Record<string, unknown>)[paramKey];
        return typeof val === 'number' ? val : undefined;
      },
      onHoverChange: (obj) => {
        setHoveredPartLabel(obj ? (obj.userData?.label ?? obj.name ?? 'Spesimen Biologi 3D') : null);
      },
      onDragStart: () => {
        const ends = rulerHandle.getEndpoints();
        dragPinStartA = ends.posA;
        dragPinStartB = ends.posB;
      },
      onDragUpdate: (_obj, paramKey, newValue, label) => {
        if (onUpdateParamRef.current) {
          onUpdateParamRef.current(paramKey, newValue);
        }
        const unitMap: Record<string, string> = {
          wavelengthNm: 'nm',
          lightIntensityLux: 'lux',
          substrateConcMm: 'mM',
          solutionPH: 'pH',
          temperatureC: '°C',
          sucroseConcMolar: 'M',
          preyPopulationX: 'ind',
          predatorPopulationY: 'ind',
        };
        const unit = unitMap[paramKey] || '';
        const formatted = Number.isInteger(newValue) ? `${newValue}` : newValue.toFixed(2);
        setDragToast({ label: label ?? paramKey, value: `${formatted}${unit ? ` ${unit}` : ''}` });
        if (dragToastTimer) clearTimeout(dragToastTimer);
      },
      onDragEnd: () => {
        if (dragToastTimer) clearTimeout(dragToastTimer);
        dragToastTimer = setTimeout(() => setDragToast(null), 1600);
      },
      onClick: (obj) => {
        const name = obj.userData?.label || obj.name || 'Spesimen Biologi 3D';
        setInspectedPart(resolveApparatusInspection('biology', mode, name));
        labSound.playClick(680);
      },
      onCursorMove3D: (pos, normal, hoveredName) => {
        if (onEmitCursorRef.current) {
          onEmitCursorRef.current(pos, normal, hoveredName);
        }
      },
    });

    const reusableConceptEntries = [
      { dom: conceptDomRef.current.c1, worldPos: zeroConceptVec, text: '', active: false },
      { dom: conceptDomRef.current.c2, worldPos: zeroConceptVec, text: '', active: false },
      { dom: conceptDomRef.current.c3, worldPos: zeroConceptVec, text: '', active: false },
    ];
    let latestRigAnchors: ReturnType<typeof coreStage.update> | null = null;

    const syncBioLabelsNow = () => {
      if (!latestRigAnchors) return;
      const showLabels = showConceptLabelsRef.current;
      const cw = container.clientWidth || width;
      const ch = container.clientHeight || height;
      const cDom = conceptDomRef.current;

      reusableConceptEntries[0].dom = cDom.c1;
      reusableConceptEntries[0].worldPos = latestRigAnchors.c1?.pos ?? zeroConceptVec;
      reusableConceptEntries[0].text = latestRigAnchors.c1?.text ?? '';
      reusableConceptEntries[0].active = Boolean(showLabels && latestRigAnchors.c1);

      reusableConceptEntries[1].dom = cDom.c2;
      reusableConceptEntries[1].worldPos = latestRigAnchors.c2?.pos ?? zeroConceptVec;
      reusableConceptEntries[1].text = latestRigAnchors.c2?.text ?? '';
      reusableConceptEntries[1].active = Boolean(showLabels && latestRigAnchors.c2);

      reusableConceptEntries[2].dom = cDom.c3;
      reusableConceptEntries[2].worldPos = latestRigAnchors.c3?.pos ?? zeroConceptVec;
      reusableConceptEntries[2].text = latestRigAnchors.c3?.text ?? '';
      reusableConceptEntries[2].active = Boolean(showLabels && latestRigAnchors.c3);

      updateProjectedConceptLabels(
        reusableConceptEntries,
        camera,
        cw,
        ch,
        showLabels,
        conceptProjVec
      );
    };
    syncConceptLabelsRef.current = syncBioLabelsNow;

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ nowMs, dt: delta, elapsed, isLite, particleScale }) => {
        const effectiveLite = isLite || isSoftwareGl;
        rulerHandle.group.visible = showRuler3DRef.current;

        const curParams = latestParamsRef.current;
        const extRef = externalSimTimeRef.current;
        const t =
          extRef && typeof extRef.current === 'number'
            ? extRef.current
            : typeof simTimePropRef.current === 'number'
            ? simTimePropRef.current
            : elapsed;

        latestRigAnchors = coreStage.update(
          t,
          delta,
          curParams,
          effectiveLite,
          showConceptLabelsRef.current,
          lensFocusRef.current,
          baseCamPos,
          desiredCamPos,
          particleScale
        );

        if (camTransitionActive) {
          camTransitionActive = smoothCameraDamp(
            camera,
            controls,
            desiredCamPos,
            desiredTarget,
            delta,
            10
          );
        }

        teacherCollabBridge.tick(nowMs, delta);
        controls.update();

        syncBioLabelsNow();

        host.renderFrame(delta);
      },
    });

    return () => {
      loopHandle.stop();
      if (dragToastTimer) clearTimeout(dragToastTimer);
      interactionManager.dispose();
      rulerHandle.dispose();
      coreStage.dispose();

      teacherCollabBridge.dispose();
      if (cursorManagerRef.current) {
        cursorManagerRef.current.dispose();
      }

      cameraSyncHandleRef.current = null;
      host.dispose();
    };
  }, [mode, sceneKey]);

  useEffect(() => {
    if (cursorManagerRef.current) {
      cursorManagerRef.current.update(remoteCursors);
    }
  }, [remoteCursors]);

  if (isAnatomyMode) {
    return (
      <AnatomySubScene3D
        mode={mode as AnatomyModuleId}
        params={params}
        isPlaying={isPlaying}
        simTime={simTime}
        simTimeRef={simTimeRef}
        remoteCursors={remoteCursors}
        onEmitCursor={onEmitCursor}
        onUpdateParam={onUpdateParam}
        onCaptureSnapshot={onCaptureSnapshot}
        comfortTheme={comfortTheme}
        cameraSyncPose={cameraSyncPose}
        onCameraSyncChange={onCameraSyncChange}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${themeColors.containerBgClass} touch-none select-none transition-colors duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="biology-simulation-canvas"
        className="w-full h-full block cursor-crosshair touch-none"
      />

      <ConceptLabelsLayer
        slots={[
          { id: 'c1', accentHex: '#10b981' },
          { id: 'c2', accentHex: '#38bdf8' },
          { id: 'c3', accentHex: '#f59e0b' },
        ]}
        visible={showConceptLabels}
        onBindSlot={bindConceptSlot}
        onSelectSlot={(slotId, labelText) => {
          setInspectedPart(resolveApparatusInspection('biology', mode, `${slotId} ${labelText}`));
        }}
      />

      {activePreset === 'focus' && (
        <div
          data-testid="microscope-eyepiece-vignette"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at center, rgba(2,6,23,0) 46%, rgba(2,6,23,0.45) 68%, rgba(2,6,23,0.88) 92%)',
          }}
        >
          <svg
            viewBox="0 0 400 400"
            className="w-[84%] h-[84%] max-w-[440px] max-h-[440px] opacity-75"
            aria-hidden="true"
          >
            <circle
              cx="200"
              cy="200"
              r="182"
              fill="none"
              stroke="rgba(52, 211, 153, 0.42)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <circle
              cx="200"
              cy="200"
              r="190"
              fill="none"
              stroke="rgba(148, 163, 184, 0.28)"
              strokeWidth="2.5"
            />
            <line
              x1="130"
              y1="332"
              x2="270"
              y2="332"
              stroke="rgba(167, 243, 208, 0.75)"
              strokeWidth="1.5"
            />
            {[0, 25, 50, 75, 100].map((um, idx) => {
              const x = 130 + idx * 35;
              return (
                <g key={um}>
                  <line
                    x1={x}
                    y1="326"
                    x2={x}
                    y2="338"
                    stroke="rgba(167, 243, 208, 0.85)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y="350"
                    textAnchor="middle"
                    fill="rgba(167, 243, 208, 0.85)"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {um}μm
                  </text>
                </g>
              );
            })}
            <text
              x="200"
              y="366"
              textAnchor="middle"
              fill="rgba(52, 211, 153, 0.78)"
              fontSize="9"
              fontFamily="monospace"
              letterSpacing="1"
            >
              LENSA OKULER MIKROSKOP · 400×
            </text>
          </svg>
        </div>
      )}

      {showRuler3D && (
        <div
          className={`pointer-events-none absolute flex items-center gap-2 rounded-xl studio-hud-surface border px-3 py-1.5 shadow-xl z-20 text-xs font-mono ${
            isFullscreen
              ? 'bottom-16 left-4'
              : `bottom-[118px] lg:bottom-[104px] ${!zenMode && leftDrawerOpen ? 'left-3 lg:left-[336px] xl:left-[348px]' : 'left-3'}`
          }`}
        >
          <Ruler className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[var(--comfort-hud-muted)]">Mistar 3D:</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-300">
            {rulerReadout ?? '23.00 ± 0.05 cm'}
          </span>
        </div>
      )}

      {dragToast && (
        <div className="pointer-events-none absolute bottom-[118px] lg:bottom-[104px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl studio-hud-surface border border-emerald-500/45 px-3.5 py-1.5 shadow-xl z-30 text-xs font-mono text-[var(--comfort-hud-text)]">
          <span className="text-[var(--comfort-hud-muted)]">{dragToast.label}:</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-300">{dragToast.value}</span>
        </div>
      )}

      {snapToast && (
        <div className="pointer-events-none absolute bottom-[118px] lg:bottom-[104px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl studio-hud-surface border border-emerald-500/45 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-[var(--comfort-hud-text)]">
          <span>{snapToast}</span>
        </div>
      )}

      {showFocusLens && (
        <div
          className={`pointer-events-auto absolute w-52 sm:w-56 rounded-xl studio-hud-surface p-2 shadow-xl z-20 ${
            isFullscreen
              ? 'bottom-16 left-4'
              : `${showRuler3D ? 'bottom-[162px] lg:bottom-[148px]' : 'bottom-[118px] lg:bottom-[104px]'} ${!zenMode && leftDrawerOpen ? 'left-3 lg:left-[336px] xl:left-[348px]' : 'left-3'}`
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 px-1 pb-0.5 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
            <span className="flex items-center gap-1.5">
              <Focus className="w-3 h-3 shrink-0" />
              <span>Fokus Lensa Mikroskop</span>
            </span>
          </div>
          <PrecisionSlider
            compact
            accentColor="emerald"
            label="Fokus Lensa"
            min={0}
            max={100}
            step={1}
            unit="%"
            defaultValue={75}
            value={lensFocus}
            onChange={(nextFocus) => {
              setLensFocus(nextFocus);
              cameraCtrlRef.current?.setPreset(activePreset);
            }}
          />
        </div>
      )}

      <Scene3DInspectorCard
        info={inspectedPart}
        onClose={() => setInspectedPart(null)}
      />

      <Scene3DControlDock
        accentTone="emerald"
        activePreset={activePreset}
        onResetCamera={() => {
          setActivePreset('isometric');
          setShowFocusLens(false);
          setLensFocus(75);
          cameraCtrlRef.current?.setPreset('isometric');
        }}
        onSelectPreset={(preset) => {
          setActivePreset(preset);
          if (preset === 'focus') {
            setShowFocusLens(true);
          }
          cameraCtrlRef.current?.setPreset(preset);
        }}
        isVRSupported={true}
        onEnterVR={() => {
          labSound.playClick(700);
          void toggleImmersiveVRSession();
        }}
        onSnapApparatus={() => {
          const { docked, transfer } = triggerDomainApparatusSnap('Biologi');
          if (docked) {
            setSnapToast(
              `Port Docked (${docked.portType.toUpperCase()}): Φ = ${(transfer?.opticalIntensityMw ?? 0).toFixed(1)} mW`
            );
            if (snapToastTimerRef.current) clearTimeout(snapToastTimerRef.current);
            snapToastTimerRef.current = setTimeout(() => {
              snapToastTimerRef.current = null;
              setSnapToast(null);
            }, 2000);
          }
        }}
        tools={[
          {
            id: 'focus-lens',
            testId: 'toggle-focus-lens-btn',
            label: 'Lensa',
            title: 'Buka / Tutup Pengatur Fokus Lensa Mikroskop',
            active: showFocusLens,
            icon: <Focus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
            onClick: () => {
              labSound.playClick(700);
              setShowFocusLens((prev) => !prev);
            },
          },
          {
            id: 'ruler-3d',
            testId: 'toggle-3d-ruler-btn',
            label: 'Ukur',
            title: 'Tampilkan / Sembunyikan Mistar Kaliper 3D di Meja Spesimen',
            active: showRuler3D,
            icon: <Ruler className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
            onClick: () => {
              labSound.playClick(700);
              setShowRuler3D((prev) => !prev);
            },
          },
        ]}
        onOpenInspector={() =>
          setInspectedPart((prev) =>
            prev ? null : resolveApparatusInspection('biology', mode, hoveredPartLabel ?? undefined)
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

export default BiologyScene3D;
