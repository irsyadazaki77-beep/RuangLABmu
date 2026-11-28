import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createBiologicalMembraneTexture,
  createContactShadowPlane,
  createInstrumentPanelTexture,
  smoothCameraDamp,
  updateInstrumentPanelTexture,
  type CameraSyncPose,
} from '../../utils/threeStudioKit';
import { initThreeStudioHost, startStudioRenderLoop } from '../../utils/threeStudioHost';
import { ThreeInteractionManager } from '../../utils/threeInteractionHelper';
import { labSound } from '../../utils/soundEngine';
import {
  calculateRespiratoryLungs,
  calculateNeuralSynapse,
} from '../../utils/engines/biologyEngine';
import {
  computeHeartVisualKinematics,
  computeLungsVisualKinematics,
  computeNeuronVisualKinematics,
} from '../../utils/biologyVisualHelpers';
import { SpatialCursorPayload } from '../../utils/collabProtocol';
import { attachTeacherCollabBridge } from '../../utils/spatialCursorGroup';
import { ComfortThemeMode, getSceneThemeColors, type SceneThemeColors } from '../ui/VisualComfortToolbar';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../stores/useUIStore';
import { WebGLErrorBoundary } from '../three/WebGLErrorBoundary';
import { LAB_EVENTS, subscribeLabEvent } from '../../utils/labEventBus';
import {
  ConceptLabelDomRef,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from '../ui/ConceptLabelsOverlay';
import {
  ANATOMY_PINS,
  evalHeart,
  type AnatomyLayerMode,
  type AnatomyMode,
  type AnatomyModuleId,
  type AnatomyPinDef,
} from './anatomy/AnatomyPinsData';
import { AnatomyHudOverlay } from './anatomy/AnatomyHudOverlay';
import { Scene3DInspectorCard } from '../ui/Scene3DInspectorCard';
import { Scene3DHoverBadge } from '../ui/Scene3DHoverBadge';
import {
  getAdaptiveCameraPose,
  resolveApparatusInspection,
  type ApparatusInspectionInfo,
} from '../../utils/studio3DCatalog';

export type { AnatomyLayerMode, AnatomyMode, AnatomyModuleId };

export interface AnatomySubScene3DProps {
  mode: AnatomyModuleId;
  params: Record<string, number>;
  isPlaying?: boolean;
  timeScale?: number;
  simTime?: number;
  simTimeRef?: React.RefObject<number>;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onUpdateParam?: (paramKey: string, value: number) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  comfortTheme?: ComfortThemeMode;
  cameraSyncPose?: CameraSyncPose | null;
  onCameraSyncChange?: (pose: Omit<CameraSyncPose, 'seq'>) => void;
}

export const AnatomySubScene3D: React.FC<AnatomySubScene3DProps> = ({
  mode,
  params,
  isPlaying = true,
  timeScale = 1,
  simTime,
  simTimeRef,
  onEmitCursor,
  onUpdateParam,
  cameraSyncPose,
  onCameraSyncChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { showConceptLabels, leftDrawerOpen, rightTelemetryOpen, zenMode } = useUIStore(
    useShallow((s) => ({
      showConceptLabels: s.showConceptLabels,
      leftDrawerOpen: s.leftDrawerOpen,
      rightTelemetryOpen: s.rightTelemetryOpen,
      zenMode: s.zenMode,
    }))
  );
  const showConceptLabelsRef = useRef(showConceptLabels);
  showConceptLabelsRef.current = showConceptLabels;

  const conceptDomRef = useRef<Record<string, ConceptLabelDomRef>>({});
  const bindConceptSlot = useCallback((id: string, dom: ConceptLabelDomRef | null) => {
    if (dom) conceptDomRef.current[id] = dom;
    else delete conceptDomRef.current[id];
  }, []);

  const paramsRef = useRef<Record<string, number>>(params);
  const onUpdateParamRef = useRef(onUpdateParam);
  onUpdateParamRef.current = onUpdateParam;
  const onEmitCursorRef = useRef(onEmitCursor);
  onEmitCursorRef.current = onEmitCursor;
  const playingRef = useRef(isPlaying);
  const timeScaleRef = useRef(timeScale);
  const simTimePropRef = useRef(simTime);
  simTimePropRef.current = simTime;
  const externalSimTimeRef = useRef(simTimeRef);
  externalSimTimeRef.current = simTimeRef;

  const [layerMode, setLayerMode] = useState<AnatomyLayerMode>('outer');
  const layerModeRef = useRef<AnatomyLayerMode>('outer');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [inspectedPart, setInspectedPart] = useState<ApparatusInspectionInfo | null>(null);
  const [hoveredPartLabel, setHoveredPartLabel] = useState<string | null>(null);
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);
  const cameraLerpRef = useRef<{ target: THREE.Vector3; pos: THREE.Vector3; active: boolean }>({
    target: new THREE.Vector3(0, 0, 0),
    pos: new THREE.Vector3(0, 1.4, 5.2),
    active: false,
  });

  const activeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Biologi');

  const onCameraSyncChangeRef = useRef(onCameraSyncChange);
  onCameraSyncChangeRef.current = onCameraSyncChange;
  const lastAppliedCamSeqRef = useRef<number>(-1);
  const cameraSyncHandleRef = useRef<{ applyPose: (pose: CameraSyncPose) => void } | null>(null);
  const themeApplyRef = useRef<((colors: SceneThemeColors) => void) | null>(null);

  useEffect(() => {
    themeApplyRef.current?.(getSceneThemeColors(activeComfortTheme, 'Biologi'));
  }, [activeComfortTheme]);

  useEffect(() => {
    if (!cameraSyncPose || cameraSyncPose.seq === lastAppliedCamSeqRef.current) return;
    lastAppliedCamSeqRef.current = cameraSyncPose.seq;
    cameraSyncHandleRef.current?.applyPose(cameraSyncPose);
  }, [cameraSyncPose]);

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { timeScaleRef.current = timeScale; }, [timeScale]);
  useEffect(() => { layerModeRef.current = layerMode; }, [layerMode]);
  useEffect(() => {
    setSelectedPinId(null);
    setInspectedPart(null);
    setLayerMode('outer');
    cameraLerpRef.current.active = false;
  }, [mode]);

  useEffect(() => {
    return subscribeLabEvent(LAB_EVENTS.AI_UI_ACTION, (action) => {
      if (!action) return;
      if (action.type === 'FOCUS_CAMERA' && action.target === 'left_ventricle') {
        cameraLerpRef.current = {
          target: new THREE.Vector3(0.35, -0.35, 0.2),
          pos: new THREE.Vector3(1.5, 0.45, 2.55),
          active: true,
        };
        if (mode === 'anatomy-cardiovascular-heart') {
          setSelectedPinId('pin-left-ventricle');
        }
      } else if (action.type === 'TOGGLE_XRAY') {
        setLayerMode(action.enabled ? 'xray' : 'outer');
      }
    });
  }, [mode]);

  const activePins = ANATOMY_PINS.filter((pin) => pin.mode === mode);
  const selectedPin = ANATOMY_PINS.find((pin) => pin.id === selectedPinId) ?? null;

  const handleSelectPin = (pin: AnatomyPinDef) => {
    setInspectedPart(null);
    setSelectedPinId(pin.id);
    cameraLerpRef.current = {
      target: new THREE.Vector3(...pin.cameraTarget),
      pos: new THREE.Vector3(...pin.cameraOffset),
      active: true,
    };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 460;
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Biologi');
    const initialPose = getAdaptiveCameraPose('biology', mode, 'isometric');
    const host = initThreeStudioHost({
      container,
      fallbackSize: { width: 720, height: 460 },
      backgroundHex: initialColors.backgroundHex,
      fogDensity: 0.045,
      domainPreset: 'anatomy',
      camera: {
        fov: 44,
        near: 0.1,
        far: 100,
        position: initialPose.pos,
      },
      controls: {
        target: initialPose.target,
        maxPolarAngle: Math.PI * 0.48,
        minDistance: 2.2,
        maxDistance: 16,
      },
      onContextRestored: () => setSceneKey((prev) => prev + 1),
      onUserControlsStart: () => {
        cameraLerpRef.current.active = false;
      },
      onCameraSyncChange: (pose) => onCameraSyncChangeRef.current?.(pose),
    });
    if (!host) return;

    const { scene, camera, renderer, controls, fpsMonitor, isSoftwareGl } = host;

    cameraSyncHandleRef.current = {
      applyPose: (pose) => {
        cameraLerpRef.current.active = false;
        host.applyExternalCameraPose(pose);
      },
    };
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    const anatomyHemiLight = new THREE.HemisphereLight(
      initialColors.ambientSkyHex,
      initialColors.ambientGroundHex,
      Math.min(0.75, initialColors.ambientIntensity)
    );
    scene.add(anatomyHemiLight);
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    const anatomyShadowSize = isSoftwareGl ? 512 : 1024;
    keyLight.shadow.mapSize.set(anatomyShadowSize, anatomyShadowSize);
    keyLight.shadow.bias = -0.0002;
    scene.add(keyLight);
    host.registerShadowLight(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);
    const subLight = new THREE.PointLight(0xf43f5e, 0.8, 12);
    subLight.position.set(0, -2.1, 2.5);
    scene.add(subLight);

    // Studio Circular Pedestal Stage receiving crisp shadow
    const pedestalGeo = new THREE.CylinderGeometry(2.6, 2.9, 0.16, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: initialColors.tableHex,
      roughness: 0.85,
      metalness: 0.08,
      envMapIntensity: 0.35,
    });
    themeApplyRef.current = (colors) => {
      if (scene.background instanceof THREE.Color) {
        scene.background.setHex(colors.backgroundHex);
      } else {
        scene.background = new THREE.Color(colors.backgroundHex);
      }
      scene.fog = new THREE.FogExp2(colors.fogHex, 0.045);
      pedestalMat.color.setHex(colors.tableHex);
      anatomyHemiLight.color.setHex(colors.ambientSkyHex);
      anatomyHemiLight.groundColor.setHex(colors.ambientGroundHex);
      anatomyHemiLight.intensity = Math.min(0.75, colors.ambientIntensity);
    };
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -2.28;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const pedestalContactShadow = createContactShadowPlane(4.4, 4.4, 0.24);
    pedestalContactShadow.position.set(0, -2.195, 0);
    scene.add(pedestalContactShadow);

    const haloTrim = new THREE.Mesh(
      new THREE.TorusGeometry(2.62, 0.022, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        roughness: 0.3,
      })
    );
    haloTrim.rotation.x = Math.PI / 2;
    haloTrim.position.y = -2.2;
    scene.add(haloTrim);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    const outerMaterials: THREE.MeshPhysicalMaterial[] = [];
    const innerGroup = new THREE.Group();
    rootGroup.add(innerGroup);
    const disposableBioTextures: THREE.Texture[] = [];

    const interactiveAnatomyMeshes: THREE.Object3D[] = [];
    const pinMeshes: { mesh: THREE.Mesh; halo: THREE.Mesh; pin: AnatomyPinDef }[] = [];
    const pinGroup = new THREE.Group();
    rootGroup.add(pinGroup);

    ANATOMY_PINS.filter((p) => p.mode === mode).forEach((pin) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.9, roughness: 0.2 })
      );
      sphere.position.set(...pin.position);
      sphere.name = pin.name;
      sphere.userData = {
        type: 'clickable',
        pinId: pin.id,
        onClick: () => {
          labSound.playClick(680);
          handleSelectPin(pin);
        },
      };
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.22, 24),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      halo.position.set(...pin.position);
      pinGroup.add(sphere, halo);
      pinMeshes.push({ mesh: sphere, halo, pin });
      interactiveAnatomyMeshes.push(sphere);
    });

    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x22d3ee,
      getInteractiveObjects: () => interactiveAnatomyMeshes,
      getParamValue: (paramKey) => {
        const val = paramsRef.current[paramKey];
        return typeof val === 'number' ? val : undefined;
      },
      onHoverChange: (obj) => {
        setHoveredPartLabel(obj ? String(obj.userData?.label ?? obj.name ?? 'Organ Anatomi 3D') : null);
      },
      onDragStart: () => {
        labSound.playClick(620);
      },
      onDragUpdate: (_obj, paramKey, newValue, label) => {
        onUpdateParamRef.current?.(paramKey, newValue);
        const unitMap: Record<string, string> = {
          heartRateBpm: 'bpm',
          vesselRadiusRatio: '×',
          diaphragmEffort: '%',
          airwayResistance: '×',
          stimulusVoltageMv: 'mV',
          myelinThickness: '%',
        };
        const unit = unitMap[paramKey] ?? '';
        const formatted = Number.isInteger(newValue) ? `${newValue}` : newValue.toFixed(2);
        setDragToast({ label: label ?? paramKey, value: `${formatted}${unit ? ` ${unit}` : ''}` });
        if (dragToastTimer) clearTimeout(dragToastTimer);
      },
      onDragEnd: () => {
        if (dragToastTimer) clearTimeout(dragToastTimer);
        dragToastTimer = setTimeout(() => setDragToast(null), 1400);
      },
      onClick: (obj) => {
        labSound.playClick(640);
        setSelectedPinId(null);
        const hint = String(obj.userData?.label ?? obj.name ?? '');
        setInspectedPart(resolveApparatusInspection('biology', mode, hint || undefined));
      },
      onCursorMove3D: (pos, normal, hoveredName) => {
        onEmitCursorRef.current?.(pos, normal, hoveredName);
      },
    });

    const dummy = new THREE.Object3D();
    const conceptProjVec = new THREE.Vector3();
    let updateFrame = (_t: number, _dt: number, _particleScale: number) => {};

    // 3D physiological directional arrows per anatomy mode
    let heartO2Arrow: THREE.ArrowHelper | null = null;
    let heartCo2Arrow: THREE.ArrowHelper | null = null;
    let lungAirArrow: THREE.ArrowHelper | null = null;
    let lungDiaphArrow: THREE.ArrowHelper | null = null;
    let neuronImpulseArrow: THREE.ArrowHelper | null = null;

    if (mode === 'anatomy-cardiovascular-heart') {
      heartO2Arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0.22, 1, 0).normalize(),
        new THREE.Vector3(0.25, 1.55, 0.14),
        0.78,
        0xf43f5e,
        0.22,
        0.12
      );
      heartCo2Arrow = new THREE.ArrowHelper(
        new THREE.Vector3(-0.25, -1, 0).normalize(),
        new THREE.Vector3(-0.76, 1.55, -0.1),
        0.78,
        0x38bdf8,
        0.22,
        0.12
      );
      rootGroup.add(heartO2Arrow, heartCo2Arrow);
    } else if (mode === 'anatomy-respiratory-lungs') {
      lungAirArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0.36, 1.9, 0.1),
        0.75,
        0x38bdf8,
        0.22,
        0.12
      );
      lungDiaphArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, -1.15, 0.42),
        0.55,
        0xfb7185,
        0.18,
        0.1
      );
      rootGroup.add(lungAirArrow, lungDiaphArrow);
    } else {
      neuronImpulseArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-0.9, 0.48, 0),
        1.7,
        0x22d3ee,
        0.24,
        0.12
      );
      rootGroup.add(neuronImpulseArrow);
    }

    if (mode === 'anatomy-cardiovascular-heart') {
      const heartMembraneTex = createBiologicalMembraneTexture('#be123c', '#fda4af');
      const heartBump = heartMembraneTex?.bumpMap ?? null;
      if (heartMembraneTex) disposableBioTextures.push(heartMembraneTex);
      if (heartBump) disposableBioTextures.push(heartBump);

      const initialCanTransmit = !isSoftwareGl && !useUIStore.getState().liteDeviceMode;
      const myoMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: heartMembraneTex,
        bumpMap: heartBump,
        bumpScale: 0.018,
        roughness: 0.3,
        clearcoat: 0.72,
        clearcoatRoughness: 0.18,
        transmission: initialCanTransmit ? 0.06 : 0,
        transparent: true,
        opacity: 1.0,
        sheen: 0.35,
        sheenColor: new THREE.Color(0xfda4af),
      });
      const rightMyoMat = myoMat.clone(); rightMyoMat.color.setHex(0xfecdd3);
      const aortaMat = myoMat.clone(); aortaMat.color.setHex(0xe11d48);
      const venaMat = myoMat.clone(); venaMat.color.setHex(0x2563eb);
      outerMaterials.push(myoMat, rightMyoMat, aortaMat, venaMat);

      // Organic conical tapered ventricular myocardium via LatheGeometry (apical curve)
      const ventriclePts: THREE.Vector2[] = [];
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        const y = -1.1 + t * 1.9;
        const r = Math.max(0.01, Math.sin(Math.pow(t, 0.65) * Math.PI) * 0.78 * (0.45 + 0.55 * t));
        ventriclePts.push(new THREE.Vector2(r, y));
      }
      const leftVentGeo = new THREE.LatheGeometry(ventriclePts, 36);
      const leftVentricle = new THREE.Mesh(leftVentGeo, myoMat);
      leftVentricle.position.set(0.32, -0.25, 0);
      leftVentricle.rotation.z = -0.24;
      leftVentricle.castShadow = true;

      const rightVentricle = new THREE.Mesh(leftVentGeo, rightMyoMat);
      rightVentricle.scale.set(0.86, 0.9, 0.84);
      rightVentricle.position.set(-0.38, -0.22, 0.14);
      rightVentricle.rotation.z = 0.22;
      rightVentricle.castShadow = true;

      const leftAtrium = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 24), myoMat);
      leftAtrium.scale.set(1.05, 0.88, 0.92);
      leftAtrium.position.set(0.52, 0.6, -0.1);
      leftAtrium.castShadow = true;

      const rightAtrium = new THREE.Mesh(new THREE.SphereGeometry(0.54, 28, 24), rightMyoMat);
      rightAtrium.scale.set(1.05, 0.9, 0.95);
      rightAtrium.position.set(-0.58, 0.54, 0.12);
      rightAtrium.castShadow = true;

      // Sculpted curved Aortic Arch with 3 superior arterial trunks
      const aortaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.18, 0.55, 0.05),
        new THREE.Vector3(0.32, 1.25, 0.08),
        new THREE.Vector3(0.05, 1.62, 0),
        new THREE.Vector3(-0.32, 1.4, -0.18),
        new THREE.Vector3(-0.36, 0.72, -0.26),
      ]);
      const aortaArch = new THREE.Mesh(new THREE.TubeGeometry(aortaCurve, 32, 0.17, 16, false), aortaMat);
      aortaArch.castShadow = true;

      [-0.08, 0.08, 0.24].forEach((bx, bIdx) => {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.42, 12), aortaMat);
        branch.position.set(bx, 1.72, -0.02 * bIdx);
        branch.rotation.z = (bx - 0.08) * -0.4;
        rootGroup.add(branch);
      });

      // Left Anterior Descending (LAD) Coronary Vessel wrapping interventricular groove
      const coronaryCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.02, 0.48, 0.52),
        new THREE.Vector3(-0.04, 0.05, 0.68),
        new THREE.Vector3(0.08, -0.45, 0.56),
        new THREE.Vector3(0.18, -0.95, 0.25),
      ]);
      const coronaryArtery = new THREE.Mesh(
        new THREE.TubeGeometry(coronaryCurve, 20, 0.036, 10, false),
        new THREE.MeshPhysicalMaterial({ color: 0xfb7185, roughness: 0.28, clearcoat: 0.6 })
      );

      const venaCava = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 1.65, 20), venaMat);
      venaCava.position.set(-0.76, 0.85, -0.15);
      venaCava.castShadow = true;

      // Inferior Vena Cava entering Right Atrium from below
      const infVenaCava = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.92, 18), venaMat);
      infVenaCava.position.set(-0.72, -0.38, -0.15);
      infVenaCava.castShadow = true;

      // Superior & Inferior Pulmonary Veins entering Left Atrium
      [-0.08, 0.12].forEach((pvy) => {
        const pvLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.72, 14), aortaMat);
        pvLeft.rotation.z = Math.PI / 2;
        pvLeft.position.set(0.92, 0.56 + pvy, -0.16);
        rootGroup.add(pvLeft);
      });

      const pulmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.18, 0.35, 0.36),
        new THREE.Vector3(-0.12, 0.92, 0.28),
        new THREE.Vector3(-0.55, 1.1, 0.1),
      ]);
      const pulmArtery = new THREE.Mesh(new THREE.TubeGeometry(pulmCurve, 20, 0.145, 14, false), venaMat);
      pulmArtery.castShadow = true;

      // Grounded 3D Clinical ECG / Hemodynamic Monitor on Pedestal
      const ecgStandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.34 });
      const ecgPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 14), ecgStandMat);
      ecgPole.position.set(1.85, -1.78, 0.65);
      const ecgBox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.64, 0.16), ecgStandMat);
      ecgBox.position.set(1.85, -1.32, 0.65);
      ecgBox.rotation.y = -0.35;
      const ecgScreenTex = createInstrumentPanelTexture({
        title: 'HEMODYNAMIC MONITOR',
        primaryText: '72 bpm',
        secondaryText: 'CO 5.0 L/m · MAP 93 mmHg',
        accentHex: '#fb7185',
      });
      if (ecgScreenTex) disposableBioTextures.push(ecgScreenTex);
      const ecgScreenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.02, 0.48),
        new THREE.MeshBasicMaterial({ map: ecgScreenTex })
      );
      ecgScreenMesh.position.set(0, 0, 0.086);
      ecgBox.add(ecgScreenMesh);
      rootGroup.add(ecgPole, ecgBox);

      rootGroup.add(
        leftVentricle,
        rightVentricle,
        leftAtrium,
        rightAtrium,
        aortaArch,
        coronaryArtery,
        venaCava,
        infVenaCava,
        pulmArtery
      );

      // Direct 3D organ parameter interactions
      leftVentricle.name = 'Ventrikel Kiri (Seret untuk ubah HR)';
      leftVentricle.userData = {
        draggableParam: 'heartRateBpm',
        min: 40,
        max: 180,
        step: 2,
        label: 'Detak Jantung (bpm)',
      };
      aortaArch.name = 'Arkus Aorta (Seret untuk ubah radius pembuluh)';
      aortaArch.userData = {
        draggableParam: 'vesselRadiusRatio',
        min: 0.5,
        max: 1.5,
        step: 0.05,
        label: 'Rasio Radius Aorta',
      };
      interactiveAnatomyMeshes.push(leftVentricle, aortaArch);

      // Tapered muscular Interventricular Septum (no blocky rectangle)
      const septum = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, 1.05, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.42 })
      );
      septum.scale.set(0.7, 1.0, 2.8);
      septum.position.set(0, -0.32, 0.04);
      innerGroup.add(septum);

      // Mitral & Aortic Valve Leaflets (animated opening/closing synced to systole/diastole)
      const valveMat = new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        roughness: 0.35,
        side: THREE.DoubleSide,
      });
      const mitralLeaflets: THREE.Mesh[] = [];
      [-1, 1].forEach((side) => {
        const leaflet = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12, 0, Math.PI), valveMat);
        leaflet.position.set(0.28 + side * 0.06, 0.25, 0.02);
        leaflet.rotation.y = side > 0 ? 0 : Math.PI;
        mitralLeaflets.push(leaflet);
        innerGroup.add(leaflet);
      });
      const aorticLeaflets: THREE.Mesh[] = [];
      [-1, 1].forEach((side) => {
        const leaflet = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12, 0, Math.PI), valveMat);
        leaflet.position.set(0.18 + side * 0.05, 0.56, 0.05);
        leaflet.rotation.y = side > 0 ? 0 : Math.PI;
        aorticLeaflets.push(leaflet);
        innerGroup.add(leaflet);
      });

      const rbcCount = 120;
      const rbcGeo = new THREE.SphereGeometry(0.055, 10, 10);
      rbcGeo.scale(1, 0.45, 1);
      const sysRbcMat = new THREE.MeshStandardMaterial({
        color: 0xff2a55,
        emissive: 0x991b1b,
        emissiveIntensity: 0.55,
      });
      const sysStream = new THREE.InstancedMesh(rbcGeo, sysRbcMat, rbcCount);
      const pulStream = new THREE.InstancedMesh(
        rbcGeo,
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.45 }),
        rbcCount
      );
      innerGroup.add(sysStream, pulStream);

      // Visible yellow lipid atherosclerotic plaque collar inside/around ascending aorta when vesselRadiusRatio < 1
      const plaqueMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.25,
        roughness: 0.55,
        transparent: true,
        opacity: 0.85,
      });
      const plaqueCollar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.045, 12, 24), plaqueMat);
      plaqueCollar.position.set(0.28, 1.05, 0.08);
      plaqueCollar.rotation.set(Math.PI / 2 - 0.18, 0, -0.15);
      plaqueCollar.visible = false;
      plaqueCollar.name = 'Plak Aterosklerosis (Penyempitan Lumen Poiseuille)';
      innerGroup.add(plaqueCollar);

      let lastEcgKey = '';

      updateFrame = (t) => {
        const hr = paramsRef.current.heartRateBpm ?? 72;
        const radiusRatio = paramsRef.current.vesselRadiusRatio ?? 1.0;
        const viscosity = paramsRef.current.bloodViscosity ?? 3.5;
        const exercise = paramsRef.current.exerciseIntensity ?? 20;
        const hk = computeHeartVisualKinematics(paramsRef.current, t);

        const ecgKey = `${Math.round(hr)}_${radiusRatio.toFixed(2)}_${viscosity.toFixed(1)}_${Math.round(exercise)}`;
        if (ecgKey !== lastEcgKey) {
          lastEcgKey = ecgKey;
          updateInstrumentPanelTexture(ecgScreenTex, {
            title: 'HEMODYNAMIC MONITOR',
            primaryText: `${Math.round(hr)} bpm`,
            secondaryText: `CO ${hk.metrics.cardiacOutputLMin.toFixed(1)}L · SV ${Math.round(hk.metrics.strokeVolumeMl)} · MAP ${Math.round(hk.metrics.meanArterialPressure)}`,
            accentHex: hk.metrics.meanArterialPressure > 115 ? '#f97316' : '#fb7185',
          });
        }
        const phase = (t * (hr / 60)) % 1.0;
        const sysPulse = phase < 0.32 ? Math.sin((phase / 0.32) * Math.PI) : 0;
        const atrPulse = phase > 0.78 ? Math.sin(((phase - 0.78) / 0.22) * Math.PI) : 0;
        const strokeAmp = Math.min(0.22, Math.max(0.07, 0.14 * hk.svRatio));

        leftVentricle.scale.set(
          0.85 * (1 - strokeAmp * sysPulse),
          1.35 * (1 - strokeAmp * 0.65 * sysPulse),
          0.85 * (1 - strokeAmp * sysPulse)
        );
        rightVentricle.scale.set(
          0.82 * (1 - strokeAmp * 0.92 * sysPulse),
          1.22 * (1 - strokeAmp * 0.58 * sysPulse),
          0.78 * (1 - strokeAmp * 0.92 * sysPulse)
        );
        leftAtrium.scale.setScalar(1 - 0.11 * atrPulse);
        rightAtrium.scale.setScalar(1 - 0.11 * atrPulse);
        aortaArch.scale.set(radiusRatio, 1 + 0.06 * sysPulse, radiusRatio);

        // Atherosclerotic plaque buildup & darker viscous blood when viscosity/stenosis increase
        plaqueCollar.visible = hk.plaqueSeverity > 0.06;
        if (plaqueCollar.visible) {
          plaqueCollar.scale.setScalar(0.55 + hk.plaqueSeverity * 0.95);
        }
        const viscDarken = Math.min(1, Math.max(0, (viscosity - 3.5) / 5.5));
        sysRbcMat.color.setRGB(1.0 - viscDarken * 0.32, 0.16 * (1 - viscDarken * 0.4), 0.33 * (1 - viscDarken * 0.35));

        // Valve aperture kinematics: Aortic opens on systole, Mitral opens during diastole filling
        aorticLeaflets.forEach((lf, idx) => {
          const dir = idx === 0 ? 1 : -1;
          lf.rotation.z = dir * (0.15 + sysPulse * 0.95);
        });
        mitralLeaflets.forEach((lf, idx) => {
          const dir = idx === 0 ? 1 : -1;
          const diastoleOpen = Math.max(atrPulse, sysPulse < 0.05 ? 0.55 : 0);
          lf.rotation.z = dir * (0.15 + diastoleOpen * 0.85);
        });

        // Poiseuille-synced RBC stream speed (drops steeply with vasoconstriction or high viscosity!)
        const speed = hk.rbcFlowSpeed;
        for (let i = 0; i < rbcCount; i++) {
          const u = (i / rbcCount + t * speed) % 1;
          const ang = u * Math.PI * 2;
          dummy.position.set(0.35 + Math.cos(ang) * 0.62, 0.2 + Math.sin(ang) * 1.15, Math.sin(ang * 2) * 0.28);
          dummy.rotation.set(ang, u * 3, 0);
          dummy.updateMatrix();
          sysStream.setMatrixAt(i, dummy.matrix);

          const u2 = (i / rbcCount + t * speed + 0.5) % 1;
          const ang2 = u2 * Math.PI * 2;
          dummy.position.set(-0.42 - Math.cos(ang2) * 0.55, 0.15 + Math.sin(ang2) * 1.05, Math.cos(ang2 * 2) * 0.28);
          dummy.updateMatrix();
          pulStream.setMatrixAt(i, dummy.matrix);
        }
        sysStream.instanceMatrix.needsUpdate = true;
        pulStream.instanceMatrix.needsUpdate = true;
      };
    } else if (mode === 'anatomy-respiratory-lungs') {
      const lungMembraneTex = createBiologicalMembraneTexture('#fb7185', '#fecdd3');
      const lungBump = lungMembraneTex?.bumpMap ?? null;
      if (lungMembraneTex) disposableBioTextures.push(lungMembraneTex);
      if (lungBump) disposableBioTextures.push(lungBump);

      const initialCanTransmitLungs = !isSoftwareGl && !useUIStore.getState().liteDeviceMode;
      const lobeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: lungMembraneTex,
        bumpMap: lungBump,
        bumpScale: 0.016,
        roughness: 0.28,
        transmission: initialCanTransmitLungs ? 0.72 : 0,
        thickness: 0.85,
        transparent: true,
        opacity: initialCanTransmitLungs ? 0.8 : 0.68,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
      });
      outerMaterials.push(lobeMat);

      // Sculpted conical anatomical lung lobe LatheGeometry (narrower apex, broad concave basal seat)
      const lungPts: THREE.Vector2[] = [
        new THREE.Vector2(0.01, 1.32),
        new THREE.Vector2(0.32, 1.18),
        new THREE.Vector2(0.62, 0.78),
        new THREE.Vector2(0.84, 0.15),
        new THREE.Vector2(0.92, -0.68),
        new THREE.Vector2(0.86, -1.16),
        new THREE.Vector2(0.55, -1.24),
        new THREE.Vector2(0.01, -1.08),
      ];
      const lungGeo = new THREE.LatheGeometry(lungPts, 36);
      const rightLung = new THREE.Mesh(lungGeo, lobeMat);
      rightLung.scale.set(0.92, 1.0, 0.78);
      rightLung.position.set(-1.05, 0.28, 0);
      rightLung.castShadow = true;

      const leftLung = new THREE.Mesh(lungGeo, lobeMat);
      leftLung.scale.set(0.85, 0.96, 0.76);
      leftLung.position.set(1.05, 0.28, 0);
      leftLung.castShadow = true;
      rootGroup.add(rightLung, leftLung);

      // Translucent Anatomical Thoracic Ribcage & Sternum Frame around Lungs
      const ribBoneMat = new THREE.MeshPhysicalMaterial({
        color: 0xf1f5f9,
        roughness: 0.42,
        transparent: true,
        opacity: 0.34,
        clearcoat: 0.3,
      });
      const sternumPlate = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 1.15, 8, 16),
        ribBoneMat
      );
      sternumPlate.scale.set(1.1, 1.0, 0.35);
      sternumPlate.position.set(0, 0.28, 0.82);
      rootGroup.add(sternumPlate);
      for (let r = 0; r < 5; r += 1) {
        const ribY = 0.88 - r * 0.36;
        const ribWidth = 1.65 + Math.sin((r / 4) * Math.PI) * 0.38;
        [-1, 1].forEach((side) => {
          const ribCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * 0.12, ribY, 0.8),
            new THREE.Vector3(side * (ribWidth * 0.65), ribY - 0.04, 0.62),
            new THREE.Vector3(side * ribWidth, ribY - 0.08, 0.0),
            new THREE.Vector3(side * (ribWidth * 0.55), ribY - 0.04, -0.68),
          ]);
          const ribMesh = new THREE.Mesh(
            new THREE.TubeGeometry(ribCurve, 18, 0.036, 8, false),
            ribBoneMat
          );
          rootGroup.add(ribMesh);
        });
      }

      // Grounded 3D Digital Spirometer Monitor on Pedestal
      const spiroStandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.34 });
      const spiroPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 14), spiroStandMat);
      spiroPole.position.set(1.85, -1.78, 0.65);
      const spiroBox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.64, 0.16), spiroStandMat);
      spiroBox.position.set(1.85, -1.32, 0.65);
      spiroBox.rotation.y = -0.35;
      const spiroScreenTex = createInstrumentPanelTexture({
        title: 'DIGITAL SPIROMETER',
        primaryText: '500 mL',
        secondaryText: 'RR 15 /m · MV 7.5 L/m',
        accentHex: '#38bdf8',
      });
      if (spiroScreenTex) disposableBioTextures.push(spiroScreenTex);
      const spiroScreenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.02, 0.48),
        new THREE.MeshBasicMaterial({ map: spiroScreenTex })
      );
      spiroScreenMesh.position.set(0, 0, 0.086);
      spiroBox.add(spiroScreenMesh);
      rootGroup.add(spiroPole, spiroBox);

      const airwayMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.34, clearcoat: 0.25 } as any);
      const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.45, 20), airwayMat);
      trachea.position.set(0, 1.35, 0);
      innerGroup.add(trachea);

      // Cartilaginous tracheal C-rings
      for (let r = 0; r < 7; r += 1) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.025, 8, 24), airwayMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.8 + r * 0.18, 0);
        innerGroup.add(ring);
      }

      const leftBronchusCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.65, 0),
        new THREE.Vector3(0.45, 0.42, 0),
        new THREE.Vector3(0.98, 0.05, 0.05),
      ]);
      const rightBronchusCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.65, 0),
        new THREE.Vector3(-0.45, 0.42, 0),
        new THREE.Vector3(-0.98, 0.05, 0.05),
      ]);
      const leftBronchus = new THREE.Mesh(new THREE.TubeGeometry(leftBronchusCurve, 16, 0.095, 12, false), airwayMat);
      const rightBronchus = new THREE.Mesh(new THREE.TubeGeometry(rightBronchusCurve, 16, 0.095, 12, false), airwayMat);
      innerGroup.add(leftBronchus, rightBronchus);

      const diaphragm = new THREE.Mesh(
        new THREE.SphereGeometry(1.65, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
        new THREE.MeshPhysicalMaterial({ color: 0xbe123c, roughness: 0.45, side: THREE.DoubleSide })
      );
      diaphragm.scale.set(1.15, 0.42, 0.82);
      diaphragm.position.set(0, -1.35, 0);
      diaphragm.name = 'Diafragma (Seret untuk ubah usaha kontraksi)';
      diaphragm.userData = {
        draggableParam: 'diaphragmEffort',
        min: 20,
        max: 100,
        step: 5,
        label: 'Usaha Diafragma (%)',
      };
      trachea.name = 'Trakea (Seret untuk ubah resistensi jalan napas)';
      trachea.userData = {
        draggableParam: 'airwayResistance',
        min: 0.5,
        max: 4.0,
        step: 0.25,
        label: 'Resistensi Jalan Napas',
      };
      interactiveAnatomyMeshes.push(diaphragm, trachea);
      rootGroup.add(diaphragm);

      // Bronchiole branches & grape-like Alveolar Acini Clusters inside lungs
      const alveoliClusters: THREE.Group[] = [];
      const alvMat = new THREE.MeshPhysicalMaterial({
        color: 0xfda4af,
        emissive: 0x9f1239,
        emissiveIntensity: 0.22,
        roughness: 0.32,
      });
      const alvSacGeo = new THREE.SphereGeometry(0.11, 12, 12);
      [-1, 1].forEach((side) => {
        const cluster = new THREE.Group();
        cluster.position.set(side * 1.02, -0.05, 0.05);
        const offsets = [
          [0, 0, 0],
          [0.14 * side, 0.14, 0.1],
          [-0.12 * side, -0.15, 0.08],
          [0.08 * side, -0.18, -0.12],
          [-0.14 * side, 0.12, -0.1],
          [0, -0.32, 0],
        ];
        offsets.forEach(([ox, oy, oz]) => {
          const sac = new THREE.Mesh(alvSacGeo, alvMat);
          sac.position.set(ox, oy, oz);
          cluster.add(sac);
        });
        alveoliClusters.push(cluster);
        innerGroup.add(cluster);
      });

      const gasCount = 110;
      const gasGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const o2Mesh = new THREE.InstancedMesh(gasGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), gasCount);
      const co2Mesh = new THREE.InstancedMesh(gasGeo, new THREE.MeshBasicMaterial({ color: 0xfb923c }), gasCount);
      innerGroup.add(o2Mesh, co2Mesh);
      const alvHealthyColor = new THREE.Color(0xfda4af);
      const alvHypoxicColor = new THREE.Color(0x6366f1);
      const alvHealthyEmissive = new THREE.Color(0x9f1239);
      const alvHypoxicEmissive = new THREE.Color(0x312e81);
      let lastSpiroKey = '';

      updateFrame = (t, _dt, particleScale) => {
        const rr = paramsRef.current.respirationRate ?? 15;
        const effort = paramsRef.current.diaphragmEffort ?? 50;
        const resistance = paramsRef.current.airwayResistance ?? 1.0;
        const altitude = paramsRef.current.altitudeMeters ?? 0;
        const lk = computeLungsVisualKinematics(paramsRef.current, t);

        const spiroKey = `${Math.round(rr)}_${Math.round(effort)}_${resistance.toFixed(2)}_${Math.round(altitude)}`;
        if (spiroKey !== lastSpiroKey) {
          lastSpiroKey = spiroKey;
          updateInstrumentPanelTexture(spiroScreenTex, {
            title: 'DIGITAL SPIROMETER',
            primaryText: `SpO₂ ${lk.metrics.spo2Percent.toFixed(0)}%`,
            secondaryText: `VT ${Math.round(lk.metrics.tidalVolumeMl)}mL · MV ${lk.metrics.minuteVentilationLMin.toFixed(1)} L/m`,
            accentHex: lk.metrics.spo2Percent < 88 ? '#f87171' : lk.metrics.spo2Percent < 94 ? '#fbbf24' : '#38bdf8',
          });
        }

        const bronchusCaliber = Math.max(0.55, 1.15 - (resistance - 1) * 0.18);
        leftBronchus.scale.set(1, bronchusCaliber, bronchusCaliber);
        rightBronchus.scale.set(1, bronchusCaliber, bronchusCaliber);

        // Exact Boyle volume-driven thoracic expansion & diaphragm excursion
        const exp = lk.deltaVolFrac * 0.24;
        rightLung.scale.set(0.88 * (1 + exp), 1.42 * (1 + exp * 0.72), 0.78 * (1 + exp));
        leftLung.scale.set(0.82 * (1 + exp), 1.38 * (1 + exp * 0.72), 0.76 * (1 + exp));
        diaphragm.position.y = -1.28 - lk.deltaVolFrac * 0.34;
        alveoliClusters.forEach((cluster) => cluster.scale.setScalar(0.88 + lk.deltaVolFrac * 0.38));

        // Altitude/hypoxia capillary color shift (healthy rose -> cyanotic violet as SpO2 drops)
        alvMat.color.copy(alvHealthyColor).lerp(alvHypoxicColor, lk.hypoxiaRatio);
        alvMat.emissive.copy(alvHealthyEmissive).lerp(alvHypoxicEmissive, lk.hypoxiaRatio);

        const activeGas = Math.max(30, Math.round(gasCount * particleScale));
        o2Mesh.count = activeGas;
        co2Mesh.count = activeGas;
        const gasFlowSpeed = Math.max(0.18, (rr / 60) * (0.45 / Math.sqrt(Math.max(0.5, resistance))));
        for (let i = 0; i < activeGas; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const u = ((i / activeGas) + t * gasFlowSpeed) % 1;
          dummy.position.set(side * (0.35 + u * 0.95), 1.15 - u * 1.35 + Math.sin(t * 2 + i) * 0.08, Math.cos(i * 1.7 + t) * 0.35);
          dummy.updateMatrix();
          o2Mesh.setMatrixAt(i, dummy.matrix);

          const u2 = (1 - u + 0.5) % 1;
          dummy.position.set(side * (0.35 + u2 * 0.92), 1.1 - u2 * 1.3 + Math.cos(t * 2 + i) * 0.08, Math.sin(i * 1.5 + t) * 0.35);
          dummy.updateMatrix();
          co2Mesh.setMatrixAt(i, dummy.matrix);
        }
        o2Mesh.instanceMatrix.needsUpdate = true;
        co2Mesh.instanceMatrix.needsUpdate = true;
      };
    } else {
      const neuronMembraneTex = createBiologicalMembraneTexture('#6366f1', '#a5b4fc');
      const neuronBump = neuronMembraneTex?.bumpMap ?? null;
      if (neuronMembraneTex) disposableBioTextures.push(neuronMembraneTex);
      if (neuronBump) disposableBioTextures.push(neuronBump);

      const initialCanTransmitNeuron = !isSoftwareGl && !useUIStore.getState().liteDeviceMode;
      const somaMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: neuronMembraneTex,
        bumpMap: neuronBump,
        bumpScale: 0.018,
        roughness: 0.32,
        clearcoat: 0.65,
        transmission: initialCanTransmitNeuron ? 0.18 : 0,
        transparent: true,
        opacity: 1.0,
      });
      const myelinMat = new THREE.MeshPhysicalMaterial({
        color: 0xfacc15,
        roughness: 0.28,
        clearcoat: 0.55,
        transmission: initialCanTransmitNeuron ? 0.35 : 0,
        transparent: true,
        opacity: 0.92,
      });
      outerMaterials.push(somaMat, myelinMat);

      const soma = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 3), somaMat);
      soma.position.set(-2.1, 0, 0);
      soma.name = 'Soma Neuron (Seret untuk ubah stimulus mV)';
      soma.userData = {
        draggableParam: 'stimulusVoltageMv',
        min: -80,
        max: 30,
        step: 5,
        label: 'Tegangan Stimulus (mV)',
      };
      interactiveAnatomyMeshes.push(soma);
      rootGroup.add(soma);

      const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 })
      );
      nucleus.position.set(-2.1, 0, 0);
      innerGroup.add(nucleus);

      // Rough Endoplasmic Reticulum (Nissl Bodies) & Soma Mitochondria around Nucleus
      const nisslMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      });
      [0.36, 0.44].forEach((r, idx) => {
        const erRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.032, 10, 24, Math.PI * 1.35), nisslMat);
        erRing.position.set(-2.1, 0, 0);
        erRing.rotation.set(idx * 0.7, idx * 1.1, 0.4);
        innerGroup.add(erRing);
      });

      for (let d = 0; d < 6; d++) {
        const ang = (d / 6) * Math.PI * 2;
        const dendCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-2.1 + Math.cos(ang) * 0.45, Math.sin(ang) * 0.45, Math.sin(ang * 2) * 0.25),
          new THREE.Vector3(-2.45 + Math.cos(ang) * 0.85, Math.sin(ang) * 0.92, Math.sin(ang * 2) * 0.45),
          new THREE.Vector3(-2.72 + Math.cos(ang) * 1.15, Math.sin(ang) * 1.25, Math.cos(ang) * 0.52),
        ]);
        const dendrite = new THREE.Mesh(new THREE.TubeGeometry(dendCurve, 12, 0.045, 8, false), somaMat);
        rootGroup.add(dendrite);
      }

      const axonCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 4.1, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0369a1, emissiveIntensity: 0.5 })
      );
      axonCore.rotation.z = Math.PI / 2;
      axonCore.position.set(0.15, 0, 0);
      innerGroup.add(axonCore);

      // Rounded Schwann capsule myelin sheaths separated by Ranvier nodes + Na+ Channel Rings
      const myelinSegments: THREE.Mesh[] = [];
      const ranvierNodeMats: THREE.MeshStandardMaterial[] = [];
      const ranvierNodeXs: number[] = [];
      for (let s = 0; s < 4; s++) {
        const segX = -1.05 + s * 0.88;
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.44, 8, 20), myelinMat);
        seg.rotation.z = Math.PI / 2;
        seg.position.set(segX, 0, 0);
        seg.castShadow = true;
        seg.name = 'Selubung Mielin (Seret untuk ubah ketebalan)';
        seg.userData = {
          draggableParam: 'myelinThickness',
          min: 0,
          max: 100,
          step: 5,
          label: 'Ketebalan Mielin (%)',
        };
        myelinSegments.push(seg);
        interactiveAnatomyMeshes.push(seg);
        rootGroup.add(seg);

        if (s < 3) {
          const nodeMat = new THREE.MeshStandardMaterial({
            color: 0x22d3ee,
            emissive: 0x0891b2,
            emissiveIntensity: 0.65,
            roughness: 0.25,
          });
          const ranvierRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.115, 0.024, 10, 20),
            nodeMat
          );
          ranvierRing.rotation.y = Math.PI / 2;
          ranvierRing.position.set(segX + 0.44, 0, 0);
          ranvierNodeMats.push(nodeMat);
          ranvierNodeXs.push(segX + 0.44);
          innerGroup.add(ranvierRing);
        }
      }

      const bouton = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), somaMat);
      bouton.scale.set(1.2, 0.95, 0.95);
      bouton.position.set(2.25, 0, 0);
      rootGroup.add(bouton);

      // Presynaptic Synaptic Vesicles clustered inside the terminal bouton
      const vesicleMat = new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x16a34a,
        emissiveIntensity: 0.6,
        roughness: 0.25,
      });
      [
        [2.12, 0.14, 0.08],
        [2.28, -0.12, 0.1],
        [2.32, 0.11, -0.09],
        [2.18, -0.08, -0.12],
        [2.38, 0.0, 0.04],
      ].forEach(([vx, vy, vz]) => {
        const vesicle = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), vesicleMat);
        vesicle.position.set(vx, vy, vz);
        innerGroup.add(vesicle);
      });

      // Grounded 3D Patch-Clamp Electrophysiology Monitor on Pedestal
      const patchStandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.34 });
      const patchPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 14), patchStandMat);
      patchPole.position.set(1.85, -1.78, 0.65);
      const patchBox = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.64, 0.16), patchStandMat);
      patchBox.position.set(1.85, -1.32, 0.65);
      patchBox.rotation.y = -0.35;
      const patchScreenTex = createInstrumentPanelTexture({
        title: 'PATCH-CLAMP AMPLIFIER',
        primaryText: '-35 mV',
        secondaryText: 'POTENSIAL AKSI · Mielin 75%',
        accentHex: '#22d3ee',
      });
      if (patchScreenTex) disposableBioTextures.push(patchScreenTex);
      const patchScreenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.04, 0.48),
        new THREE.MeshBasicMaterial({ map: patchScreenTex })
      );
      patchScreenMesh.position.set(0, 0, 0.086);
      patchBox.add(patchScreenMesh);
      rootGroup.add(patchPole, patchBox);

      // Postsynaptic Membrane Spine & Voltage/Ligand-Gated Ion Channels across synaptic cleft
      const postsynapse = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.36, 0.75, 10, 20),
        new THREE.MeshPhysicalMaterial({ color: 0x334155, roughness: 0.4, clearcoat: 0.3 })
      );
      postsynapse.position.set(3.45, 0, 0);
      rootGroup.add(postsynapse);

      const channelReceptors: THREE.MeshStandardMaterial[] = [];
      [-0.36, -0.12, 0.12, 0.36].forEach((cy) => {
        const chMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          emissive: 0x0f172a,
          emissiveIntensity: 0.4,
          roughness: 0.3,
        });
        const channel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), chMat);
        channel.rotation.z = Math.PI / 2;
        channel.position.set(3.08, cy, cy * 0.35);
        channelReceptors.push(chMat);
        innerGroup.add(channel);
      });

      const pulseRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.055, 16, 32),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      pulseRing.rotation.y = Math.PI / 2;
      innerGroup.add(pulseRing);

      const ntCount = 60;
      const ntMesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
        ntCount
      );
      innerGroup.add(ntMesh);
      let lastPatchKey = '';

      updateFrame = (t, _dt, particleScale) => {
        const stim = paramsRef.current.stimulusVoltageMv ?? -35;
        const myelin = paramsRef.current.myelinThickness ?? 75;
        const naOut = paramsRef.current.extracellularNaMm ?? 145;
        const kOut = paramsRef.current.extracellularKMm ?? 4.5;
        const nk = computeNeuronVisualKinematics(paramsRef.current, t);
        const fired = nk.metrics.actionPotentialTriggered;

        const patchKey = `${Math.round(stim)}_${Math.round(myelin)}_${Math.round(naOut)}_${kOut.toFixed(1)}_${fired}`;
        if (patchKey !== lastPatchKey) {
          lastPatchKey = patchKey;
          updateInstrumentPanelTexture(patchScreenTex, {
            title: 'PATCH-CLAMP AMPLIFIER',
            primaryText: `${nk.metrics.conductionVelocityMs.toFixed(0)} m/s`,
            secondaryText: fired
              ? `${stim >= 0 ? '+' : ''}${Math.round(stim)}mV · ENa +${Math.round(nk.metrics.nernstNaMv)}mV`
              : `${stim}mV · SUB-AMBANG`,
            accentHex: fired ? '#22d3ee' : '#fb923c',
          });
        }
        const showMyelin = myelin > 2;
        const scaleMyelin = 0.42 + (myelin / 100) * 0.78;
        myelinSegments.forEach((seg) => {
          seg.visible = showMyelin;
          seg.scale.set(scaleMyelin, 1, scaleMyelin);
        });

        channelReceptors.forEach((chMat) => {
          chMat.color.setHex(fired ? 0x4ade80 : 0x64748b);
          chMat.emissive.setHex(fired ? 0x22d3ee : 0x0f172a);
          chMat.emissiveIntensity = fired ? 1.15 : 0.2;
        });

        if (fired && nk.pulseRateHz > 0) {
          const u = (t * nk.pulseRateHz) % 1;
          const pulseX = -1.6 + u * 3.85;
          pulseRing.visible = true;
          // Saltatory arc jumps higher when heavily myelinated, slides flat along axon when unmyelinated
          const jumpAmp = showMyelin ? 0.06 + (myelin / 100) * 0.18 : 0.015;
          pulseRing.position.set(pulseX, Math.abs(Math.sin(u * Math.PI * 4)) * jumpAmp, 0);

          // Flash each Node of Ranvier Na+ channel brightly as the depolarizing wave leaps across it
          for (let rIdx = 0; rIdx < ranvierNodeMats.length; rIdx++) {
            const dist = Math.abs(pulseX - ranvierNodeXs[rIdx]);
            const flash = Math.max(0, 1 - dist / 0.42);
            ranvierNodeMats[rIdx].emissiveIntensity = 0.55 + flash * 2.4;
            ranvierNodeMats[rIdx].color.setHex(flash > 0.35 ? 0xfef08a : 0x22d3ee);
          }
        } else {
          pulseRing.visible = false;
          for (let rIdx = 0; rIdx < ranvierNodeMats.length; rIdx++) {
            ranvierNodeMats[rIdx].emissiveIntensity = 0.35;
            ranvierNodeMats[rIdx].color.setHex(0x22d3ee);
          }
        }

        const activeNt = Math.max(16, Math.round(ntCount * particleScale));
        ntMesh.count = activeNt;
        for (let i = 0; i < activeNt; i++) {
          const prog = fired ? ((t * Math.max(0.8, nk.pulseRateHz * 0.9) + i / activeNt) % 1) : 0.05;
          dummy.position.set(2.45 + prog * 0.58, Math.sin(i * 2.1 + t * 3) * 0.32 * prog, Math.cos(i * 1.7 + t * 2) * 0.32 * prog);
          dummy.scale.setScalar(fired ? 1 : 0.35);
          dummy.updateMatrix();
          ntMesh.setMatrixAt(i, dummy.matrix);
        }
        ntMesh.instanceMatrix.needsUpdate = true;
      };
    }

    const downDir = new THREE.Vector3(0, -1, 0);
    const upDir = new THREE.Vector3(0, 1, 0);
    const cPos1 = new THREE.Vector3();
    const cPos2 = new THREE.Vector3();
    const cPos3 = new THREE.Vector3();
    const cEntries = [
      { dom: conceptDomRef.current.c1, worldPos: cPos1, text: '', active: false },
      { dom: conceptDomRef.current.c2, worldPos: cPos2, text: '', active: false },
      { dom: conceptDomRef.current.c3, worldPos: cPos3, text: '', active: false },
    ];
    let simAccumTime = 0;

    const loopHandle = startStudioRenderLoop({
      renderer,
      isSoftwareGl,
      fpsMonitor,
      onFrame: ({ nowMs, dt: rawDt, elapsed, isLite, particleScale }) => {
        const dt = rawDt * (playingRef.current ? timeScaleRef.current : 0);
        simAccumTime += dt;
        const extRef = externalSimTimeRef.current;
        const effectiveT =
          extRef && typeof extRef.current === 'number'
            ? extRef.current
            : typeof simTimePropRef.current === 'number'
            ? simTimePropRef.current
            : simAccumTime || elapsed;

        const lm = layerModeRef.current;
        const canTransmit = !isSoftwareGl && !isLite;
        outerMaterials.forEach((mat) => {
          if (lm === 'xray') {
            mat.opacity = 0.26;
            mat.transmission = canTransmit ? 0.85 : 0;
            mat.depthWrite = false;
          } else if (lm === 'cross-section') {
            mat.opacity = 0.55;
            mat.transmission = canTransmit ? 0.45 : 0;
            mat.depthWrite = true;
          } else {
            mat.opacity = mode === 'anatomy-respiratory-lungs' ? (canTransmit ? 0.78 : 0.68) : 1.0;
            mat.transmission = canTransmit ? (mode === 'anatomy-respiratory-lungs' ? 0.75 : 0.12) : 0;
            mat.depthWrite = true;
          }
        });
        rootGroup.scale.z = lm === 'cross-section' ? 0.55 : 1.0;

        pinMeshes.forEach(({ halo }, idx) => {
          halo.lookAt(camera.position);
          halo.scale.setScalar(1 + 0.18 * Math.sin(effectiveT * 3.5 + idx));
        });

        if (cameraLerpRef.current.active) {
          cameraLerpRef.current.active = smoothCameraDamp(
            camera,
            controls,
            cameraLerpRef.current.pos,
            cameraLerpRef.current.target,
            rawDt,
            10
          );
        }

        updateFrame(effectiveT, dt, particleScale);
        teacherCollabBridge.tick(nowMs, rawDt);
        controls.update();

        const showLabels = showConceptLabelsRef.current;
        const cw = container.clientWidth || width;
        const ch = container.clientHeight || height;
        const cDom = conceptDomRef.current;
        const pCur = paramsRef.current;
        cEntries[0].dom = cDom.c1;
        cEntries[0].active = false;
        cEntries[1].dom = cDom.c2;
        cEntries[1].active = false;
        cEntries[2].dom = cDom.c3;
        cEntries[2].active = false;

        if (mode === 'anatomy-cardiovascular-heart') {
          if (heartO2Arrow) heartO2Arrow.visible = showLabels;
          if (heartCo2Arrow) heartCo2Arrow.visible = showLabels;
          if (showLabels) {
            const hm = evalHeart(pCur);
            cPos1.set(1.15, 1.35, 0.2);
            cEntries[0].text = 'Aorta · Darah Kaya O₂ ↑';
            cEntries[0].active = true;

            cPos2.set(-0.85, 1.5, 0);
            cEntries[1].text = 'Vena & Pulmonal · CO₂ ↓';
            cEntries[1].active = true;

            cPos3.set(0.42, -0.5, 0.45);
            cEntries[2].text = `MAP ${hm.meanArterialPressure} mmHg · HR ${Math.round(pCur.heartRateBpm ?? 72)} bpm`;
            cEntries[2].active = true;
          }
        } else if (mode === 'anatomy-respiratory-lungs') {
          const rr = pCur.respirationRate ?? 15;
          const inhaling = Math.sin(2 * Math.PI * (rr / 60) * effectiveT) >= 0;
          if (lungAirArrow) {
            lungAirArrow.visible = showLabels;
            lungAirArrow.setDirection(inhaling ? downDir : upDir);
            lungAirArrow.setColor(inhaling ? 0x38bdf8 : 0xfb923c);
            lungAirArrow.position.set(0.36, inhaling ? 1.95 : 1.15, 0.1);
          }
          if (lungDiaphArrow) {
            lungDiaphArrow.visible = showLabels;
            lungDiaphArrow.setDirection(inhaling ? downDir : upDir);
          }
          if (showLabels) {
            const lmStats = calculateRespiratoryLungs({
              respirationRate: rr,
              diaphragmEffort: pCur.diaphragmEffort ?? 50,
              airwayResistance: pCur.airwayResistance ?? 1.0,
              altitudeMeters: pCur.altitudeMeters ?? 0,
              timeSec: effectiveT,
            });
            cPos1.set(0, -1.25, 0.35);
            cEntries[0].text = 'Diafragma (Hukum Boyle)';
            cEntries[0].active = true;

            cPos2.set(0.15, 1.85, 0.1);
            cEntries[1].text = inhaling ? 'Inspirasi: O₂ Masuk ↓' : 'Ekspirasi: CO₂ Keluar ↑';
            cEntries[1].active = true;

            cPos3.set(1.1, 0.35, 0.35);
            cEntries[2].text = `Alveolus · SpO₂ ${lmStats.spo2Percent}%`;
            cEntries[2].active = true;
          }
        } else {
          const stim = pCur.stimulusVoltageMv ?? -35;
          const fired = stim >= -55;
          if (neuronImpulseArrow) {
            neuronImpulseArrow.visible = showLabels && fired;
          }
          if (showLabels) {
            const nm = calculateNeuralSynapse({
              stimulusVoltageMv: stim,
              myelinThickness: pCur.myelinThickness ?? 75,
              extracellularNaMm: pCur.extracellularNaMm ?? 145,
              extracellularKMm: pCur.extracellularKMm ?? 4.5,
              timeSec: effectiveT,
            });
            cPos1.set(-2.1, 0.85, 0);
            cEntries[0].text = `Soma · Stimulus ${stim} mV`;
            cEntries[0].active = true;

            cPos2.set(0.1, 0.55, 0);
            cEntries[1].text = fired
              ? `Impuls Saltatorik → (${nm.conductionVelocityMs} m/s)`
              : 'Di Bawah Ambang (-55 mV)';
            cEntries[1].active = true;

            cPos3.set(2.25, 0.65, 0);
            cEntries[2].text = 'Sinapsis Terminal';
            cEntries[2].active = true;
          }
        }
        updateProjectedConceptLabels(cEntries, camera, cw, ch, showLabels, conceptProjVec);

        host.renderFrame(rawDt);
      },
    });

    return () => {
      themeApplyRef.current = null;
      loopHandle.stop();
      cameraSyncHandleRef.current = null;
      if (dragToastTimer) clearTimeout(dragToastTimer);
      interactionManager.dispose();
      teacherCollabBridge.dispose();
      disposableBioTextures.forEach((tex) => tex.dispose());
      host.dispose();
    };
  }, [mode, sceneKey]);

  return (
    <div className={`relative w-full h-full min-h-[420px] ${themeColors.containerBgClass} overflow-hidden select-none transition-colors duration-300`}>
      <WebGLErrorBoundary sceneTitle="Anatomi 3D Interaktif">
        <div ref={mountRef} data-testid="anatomy-simulation-canvas" className="w-full h-full min-h-[420px]" />
      </WebGLErrorBoundary>

      <ConceptLabelsLayer
        slots={[
          { id: 'c1', accentHex: '#f43f5e' },
          { id: 'c2', accentHex: '#38bdf8' },
          { id: 'c3', accentHex: '#4ade80' },
        ]}
        visible={showConceptLabels}
        onBindSlot={bindConceptSlot}
        onSelectSlot={(slotId, labelText) => {
          setSelectedPinId(null);
          setInspectedPart(resolveApparatusInspection('biology', mode, `${slotId} ${labelText}`));
        }}
      />

      <Scene3DInspectorCard
        info={inspectedPart}
        onClose={() => setInspectedPart(null)}
      />

      <AnatomyHudOverlay
        zenMode={zenMode}
        leftDrawerOpen={leftDrawerOpen}
        rightTelemetryOpen={rightTelemetryOpen}
        layerMode={layerMode}
        onChangeLayerMode={setLayerMode}
        activePins={activePins}
        selectedPinId={selectedPinId}
        selectedPin={selectedPin}
        onSelectPin={handleSelectPin}
        onClosePinCard={() => setSelectedPinId(null)}
        onResetCamera={() => {
          labSound.playClick();
          setSelectedPinId(null);
          setInspectedPart(null);
          const pose = getAdaptiveCameraPose('biology', mode, 'isometric');
          cameraLerpRef.current.target.set(...pose.target);
          cameraLerpRef.current.pos.set(...pose.pos);
          cameraLerpRef.current.active = true;
        }}
        dragToast={dragToast}
        params={params}
      />

      <Scene3DHoverBadge hoveredLabel={dragToast ? null : hoveredPartLabel} accent="emerald" />
    </div>
  );
};

export default AnatomySubScene3D;
