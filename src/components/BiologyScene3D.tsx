import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  smoothCameraTransition,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import { createMeasurementRuler3D } from '../utils/threeMeasurementTools';
import { initThreeStudioHost, startStudioRenderLoop } from '../utils/threeStudioHost';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import { Maximize2, Minimize2, Focus, Link2, Ruler } from 'lucide-react';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { labSound } from '../utils/soundEngine';
import { triggerDomainApparatusSnap } from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { AnatomySubScene3D, AnatomyModuleId } from './scenes/AnatomySubScene3D';
import { buildBiologyCoreStage, CoreBiologyStageMode } from './scenes/biologyCoreStage';
import {
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';
import { useThreeStudioScene } from './scenes/useThreeStudioScene';
import { useUIStore } from '../stores/useUIStore';

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

  const [clickedBadge, setClickedBadge] = useState<string | null>(null);
  const [snapToast, setSnapToast] = useState<string | null>(null);
  const [showRuler3D, setShowRuler3D] = useState<boolean>(false);
  const showRuler3DRef = useRef<boolean>(false);
  showRuler3DRef.current = showRuler3D;
  const [rulerReadout, setRulerReadout] = useState<string | null>(null);
  const [lensFocus, setLensFocus] = useState<number>(75);
  const lensFocusRef = useRef<number>(75);
  lensFocusRef.current = lensFocus;

  const syncConceptLabelsRef = useRef<(() => void) | null>(null);

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

    let camTransitionActive = false;
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 600, height: 450 },
      backgroundHex: 0x0b0f17,
      fogDensity: 0.02,
      camera: {
        fov: 45,
        near: 0.1,
        far: 100,
        position: [2.8, 3.8, 7.2],
        lookAt: [0, 1.2, 0],
      },
      controls: {
        target: [0, 1.3, 0],
        maxPolarAngle: Math.PI * 0.49,
        minDistance: 2.0,
        maxDistance: 20,
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

    const baseCamPos = new THREE.Vector3(2.8, 3.8, 7.2);
    const desiredCamPos = new THREE.Vector3(2.8, 3.8, 7.2);
    const desiredTarget = new THREE.Vector3(0, 1.3, 0);

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        camTransitionActive = false;
        host.applyExternalCameraPose(pose);
      },
    };

    const applyCameraPreset = (preset: BioCameraPreset) => {
      if (preset === 'isometric') {
        baseCamPos.set(2.8, 3.8, 7.2);
        desiredTarget.set(0, 1.3, 0);
      } else if (preset === 'front') {
        baseCamPos.set(0, 2.0, 7.8);
        desiredTarget.set(0, 1.4, 0);
      } else if (preset === 'top') {
        baseCamPos.set(0, 10.5, 0.5);
        desiredTarget.set(0, 0, 0);
      } else {
        baseCamPos.set(1.2, 2.1, 4.2);
        desiredTarget.set(0, 1.3, 0);
      }
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

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => host.captureSnapshot(),
      applyTheme: (colors) => coreStage.applyTheme(colors),
    };

    const conceptProjVec = new THREE.Vector3();

    const rulerHandle = createMeasurementRuler3D({
      initialA: [-1.15, 0.42, 1.35],
      initialB: [1.15, 0.42, 1.35],
      cmPerUnit: 10,
    });
    rulerHandle.group.visible = showRuler3DRef.current;
    scene.add(rulerHandle.group);

    let dragPinStartA = rulerHandle.getEndpoints().posA;
    let dragPinStartB = rulerHandle.getEndpoints().posB;
    rulerHandle.pinA.userData = {
      ...rulerHandle.pinA.userData,
      onDrag: (dx: number, dy: number) => {
        const nextA = new THREE.Vector3(
          Math.max(-3.2, Math.min(3.2, dragPinStartA.x + dx * 0.015)),
          dragPinStartA.y,
          Math.max(-2.6, Math.min(2.6, dragPinStartA.z + dy * 0.015))
        );
        const currentB = rulerHandle.getEndpoints().posB;
        const res = rulerHandle.setEndpoints(nextA, currentB);
        setRulerReadout(res.formatted);
      },
    };
    rulerHandle.pinB.userData = {
      ...rulerHandle.pinB.userData,
      onDrag: (dx: number, dy: number) => {
        const nextB = new THREE.Vector3(
          Math.max(-3.2, Math.min(3.2, dragPinStartB.x + dx * 0.015)),
          dragPinStartB.y,
          Math.max(-2.6, Math.min(2.6, dragPinStartB.z + dy * 0.015))
        );
        const currentA = rulerHandle.getEndpoints().posA;
        const res = rulerHandle.setEndpoints(currentA, nextB);
        setRulerReadout(res.formatted);
      },
    };

    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x10b981,
      getInteractiveObjects: () =>
        rulerHandle.group.visible
          ? [...coreStage.apparatusGroup.children, ...rulerHandle.getInteractiveHandles()]
          : coreStage.apparatusGroup.children,
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
        const name = obj.name || 'Organel Sel Tumbuhan';
        setClickedBadge(name);
        labSound.playClick(680);
        setTimeout(() => setClickedBadge(null), 3500);
      },
      onCursorMove3D: (pos, normal, hoveredName) => {
        if (onEmitCursorRef.current) {
          onEmitCursorRef.current(pos, normal, hoveredName);
        }
      },
    });

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ dt: delta, elapsed, isLite }) => {
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

        const rigAnchors = coreStage.update(
          t,
          delta,
          curParams,
          effectiveLite,
          showConceptLabelsRef.current,
          lensFocusRef.current,
          baseCamPos,
          desiredCamPos
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

        teacherCollabBridge.tick();
        controls.update();

        const syncBioLabelsNow = () => {
          const showLabels = showConceptLabelsRef.current;
          const cw = container.clientWidth || width;
          const ch = container.clientHeight || height;
          const cDom = conceptDomRef.current;
          const cEntries = [
            {
              dom: cDom.c1,
              worldPos: rigAnchors.c1?.pos ?? new THREE.Vector3(),
              text: rigAnchors.c1?.text ?? '',
              active: Boolean(showLabels && rigAnchors.c1),
            },
            {
              dom: cDom.c2,
              worldPos: rigAnchors.c2?.pos ?? new THREE.Vector3(),
              text: rigAnchors.c2?.text ?? '',
              active: Boolean(showLabels && rigAnchors.c2),
            },
            {
              dom: cDom.c3,
              worldPos: rigAnchors.c3?.pos ?? new THREE.Vector3(),
              text: rigAnchors.c3?.text ?? '',
              active: Boolean(showLabels && rigAnchors.c3),
            },
          ];
          updateProjectedConceptLabels(cEntries, camera, cw, ch, showLabels, conceptProjVec);
        };

        syncConceptLabelsRef.current = syncBioLabelsNow;
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
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-slate-950/90 border border-emerald-400/40 px-3 py-1.5 shadow-xl z-20 text-xs font-mono">
          <Ruler className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Mistar 3D:</span>
          <span className="font-bold text-emerald-300">{rulerReadout ?? '23.00 ± 0.05 cm'}</span>
        </div>
      )}

      {dragToast && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-slate-950/90 border border-emerald-400/50 px-3.5 py-1.5 shadow-xl z-30 text-xs font-mono text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">{dragToast.label}:</span>
          <span className="font-bold text-emerald-300">{dragToast.value}</span>
        </div>
      )}

      {snapToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-emerald-950/95 border border-emerald-400/50 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>{snapToast}</span>
        </div>
      )}

      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20 opacity-80 hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-testid="toggle-3d-ruler-btn"
          onClick={() => {
            labSound.playClick(700);
            setShowRuler3D((prev) => !prev);
          }}
          title="Tampilkan / Sembunyikan Mistar Kaliper 3D di Meja Spesimen"
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
            showRuler3D
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'text-emerald-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Ukur 3D</span>
        </button>

        <button
          type="button"
          data-testid="snap-dock-apparatus-btn"
          onClick={() => {
            const { docked, transfer } = triggerDomainApparatusSnap('Biologi');
            if (docked) {
              setSnapToast(
                `Port Docked (${docked.portType.toUpperCase()}): Φ = ${(transfer?.opticalIntensityMw ?? 0).toFixed(1)} mW`
              );
              setTimeout(() => setSnapToast(null), 2000);
            }
          }}
          title="Snap-to-Port: Sambung & Transfer Spesimen Biologi 3D"
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
              onClick={() => {
                labSound.playClick();
                setActivePreset(preset.id);
                cameraCtrlRef.current?.setPreset(preset.id);
              }}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                activePreset === preset.id
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className="mx-1 h-3.5 w-px bg-white/15" aria-hidden="true" />
        </div>

        <ConceptLabelToggleButton accentClass="bg-emerald-500 text-slate-950 font-bold" />

        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
        </button>
      </div>

      <div className="pointer-events-auto absolute top-3 left-3 flex items-center gap-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 shadow-lg z-20">
        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
          <Focus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fokus Lensa</span>
        </div>
        <input
          type="range"
          aria-label="Fokus Lensa Mikroskop 3D"
          min={0}
          max={100}
          step={1}
          value={lensFocus}
          onChange={(e) => {
            const nextFocus = Number(e.target.value);
            setLensFocus(nextFocus);
            cameraCtrlRef.current?.setPreset(activePreset);
          }}
          className="w-20 sm:w-28 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
        />
        <span className="text-[11px] font-mono tabular-nums text-emerald-200 font-bold min-w-[32px] text-right">
          {lensFocus}%
        </span>
      </div>

      {clickedBadge && (
        <div className="absolute top-14 left-3 z-30 px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-medium shadow-lg flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{clickedBadge}</span>
        </div>
      )}
      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="emerald" />
    </div>
  );
};

export default BiologyScene3D;
