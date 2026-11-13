import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  applyBorosilicateLiteMode,
  createBiologicalMembraneTexture,
  createBorosilicateGlassMaterial,
  createBrushedMetalTextures,
  createLabBenchTextures,
  smoothCameraTransition,
  type CameraSyncPose,
} from '../utils/threeStudioKit';
import {
  BiologyRigHandle,
  buildCatalaseRig,
  buildOsmosisRig,
  buildPhotosynthesisRig,
  buildPredatorPreyRig,
} from './scenes/BiologyRigs';
import { createMeasurementRuler3D } from '../utils/threeMeasurementTools';
import { initThreeStudioHost } from '../utils/threeStudioHost';
import { ThreeInteractionManager } from '../utils/threeInteractionHelper';
import { Maximize2, Minimize2, Focus, Link2, Ruler } from 'lucide-react';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { SpatialCursorManager, attachTeacherCollabBridge } from '../utils/spatialCursorGroup';
import { labSound } from '../utils/soundEngine';
import { triggerDomainApparatusSnap } from '../utils/engines/multiApparatusEngine';
import { toggleImmersiveVRSession } from '../utils/webXRStudioAdapter';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';
import { AnatomySubScene3D, AnatomyModuleId } from './scenes/AnatomySubScene3D';
import {
  ConceptLabelDomRef,
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from './ui/ConceptLabelsOverlay';
import { Scene3DHoverBadge } from './ui/Scene3DHoverBadge';

interface BiologyScene3DProps {
  mode:
    | 'photosynthesis-ingenhousz'
    | 'enzyme-catalase'
    | 'enzyme-kinetics'
    | 'osmosis-plasmolysis'
    | 'cell-osmosis-tonicity'
    | 'predator-prey-dynamics'
    | AnatomyModuleId;
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

function createOrganelleTexture(
  type: 'nucleus' | 'mitochondria' | 'chloroplast'
): ReturnType<typeof createBiologicalMembraneTexture> {
  if (type === 'nucleus') {
    return createBiologicalMembraneTexture('#7e22ce', '#e9d5ff');
  }
  if (type === 'mitochondria') {
    return createBiologicalMembraneTexture('#ea580c', '#fef08a');
  }
  return createBiologicalMembraneTexture('#15803d', '#4ade80');
}

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
  const storeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const showConceptLabels = useUIStore((s) => s.showConceptLabels);
  const showConceptLabelsRef = useRef(showConceptLabels);
  showConceptLabelsRef.current = showConceptLabels;

  const activeComfortTheme = comfortTheme ?? storeComfortTheme;
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Biologi');

  const mountRef = useRef<HTMLDivElement>(null);
  const conceptDomRef = useRef<Record<string, ConceptLabelDomRef>>({});
  const bindConceptSlot = useCallback((id: string, dom: ConceptLabelDomRef | null) => {
    if (dom) conceptDomRef.current[id] = dom;
    else delete conceptDomRef.current[id];
  }, []);

  const cursorManagerRef = useRef<SpatialCursorManager | null>(null);
  const onEmitCursorRef = useRef(onEmitCursor);
  onEmitCursorRef.current = onEmitCursor;
  const onCaptureSnapshotRef = useRef(onCaptureSnapshot);
  onCaptureSnapshotRef.current = onCaptureSnapshot;
  const onUpdateParamRef = useRef(onUpdateParam);
  onUpdateParamRef.current = onUpdateParam;
  const latestParamsRef = useRef(params);
  latestParamsRef.current = params;
  const simTimePropRef = useRef(simTime);
  simTimePropRef.current = simTime;
  const externalSimTimeRef = useRef(simTimeRef);
  externalSimTimeRef.current = simTimeRef;

  const [activePreset, setActivePreset] = useState<BioCameraPreset>('isometric');
  const [clickedBadge, setClickedBadge] = useState<string | null>(null);
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);
  const [hoveredPartLabel, setHoveredPartLabel] = useState<string | null>(null);
  const [snapToast, setSnapToast] = useState<string | null>(null);
  const [showRuler3D, setShowRuler3D] = useState<boolean>(false);
  const showRuler3DRef = useRef<boolean>(false);
  showRuler3DRef.current = showRuler3D;
  const [rulerReadout, setRulerReadout] = useState<string | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);
  const [lensFocus, setLensFocus] = useState<number>(75); // 0 to 100 (optimal crispness near 75-100)
  const lensFocusRef = useRef<number>(75);
  lensFocusRef.current = lensFocus;

  const cameraCtrlRef = useRef<{
    setPreset: (preset: BioCameraPreset) => void;
    setOrbit: (orbit: boolean) => void;
    captureCanvas: () => string | null;
    applyTheme: (colors: ReturnType<typeof getSceneThemeColors>) => void;
  } | null>(null);

  const onCameraSyncChangeRef = useRef(onCameraSyncChange);
  onCameraSyncChangeRef.current = onCameraSyncChange;
  const lastAppliedCamSeqRef = useRef<number>(-1);
  const cameraSyncHandleRef = useRef<{ applyPose: (pose: CameraSyncPose) => void } | null>(null);

  useEffect(() => {
    if (!cameraSyncPose || cameraSyncPose.seq === lastAppliedCamSeqRef.current) return;
    lastAppliedCamSeqRef.current = cameraSyncPose.seq;
    cameraSyncHandleRef.current?.applyPose(cameraSyncPose);
  }, [cameraSyncPose]);

  const syncConceptLabelsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    syncConceptLabelsRef.current?.();
  }, [mode, params, showConceptLabels]);

  useEffect(() => {
    cameraCtrlRef.current?.applyTheme(getSceneThemeColors(activeComfortTheme, 'Biologi'));
  }, [activeComfortTheme]);

  useEffect(() => {
    const handleGlobalSnapshot = () => {
      if (onCaptureSnapshotRef.current && cameraCtrlRef.current) {
        const url = cameraCtrlRef.current.captureCanvas();
        if (url) onCaptureSnapshotRef.current(url);
      }
    };
    const unsubSnapshot = subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, handleGlobalSnapshot);
    const orderedPresets: BioCameraPreset[] = ['isometric', 'front', 'top', 'focus'];
    const unsubPreset = subscribeLabEvent(LAB_EVENTS.SET_CAMERA_PRESET, (detail) => {
      if (!detail) return;
      const preset = orderedPresets[detail.index];
      if (preset) {
        setActivePreset(preset);
        cameraCtrlRef.current?.setPreset(preset);
      }
    });
    return () => {
      unsubSnapshot();
      unsubPreset();
    };
  }, []);

  const isAnatomyMode =
    mode === 'anatomy-cardiovascular-heart' ||
    mode === 'anatomy-respiratory-lungs' ||
    mode === 'anatomy-neural-synapse';

  useEffect(() => {
    if (isAnatomyMode) return;
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let animationFrameId = 0;
    let timeoutId = 0;
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
      onContextRestored: () => setSceneKey((prev) => prev + 1),
      onUserControlsStart: () => {
        camTransitionActive = false;
      },
      onCameraSyncChange: (pose) => onCameraSyncChangeRef.current?.(pose),
    });
    if (!host) return;

    const { scene, camera, renderer, controls, fpsMonitor, isSoftwareGl } = host;
    const gl = renderer.getContext() as WebGL2RenderingContext;

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

    // Collaboration Cursor Group
    const cursorManager = new SpatialCursorManager(scene);
    cursorManagerRef.current = cursorManager;
    const teacherCollabBridge = attachTeacherCollabBridge({
      scene,
      camera,
      controls,
      domElement: renderer.domElement,
    });

    // Studio Lights with Soft Contact Shadows (2048x2048, bias -0.0001)
    const hemiLight = new THREE.HemisphereLight(
      initialColors.ambientSkyHex,
      initialColors.ambientGroundHex,
      0.45
    );
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    const shadowBound = 6;
    dirLight.shadow.camera.left = -shadowBound;
    dirLight.shadow.camera.right = shadowBound;
    dirLight.shadow.camera.top = shadowBound;
    dirLight.shadow.camera.bottom = -shadowBound;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    // =========================================================
    // STAGE CONDENSER SPOTLIGHT FROM BELOW GLASS SLIDE (TAHAP 5)
    // =========================================================
    const condenserTarget = new THREE.Object3D();
    condenserTarget.position.set(0, 1.5, 0);
    scene.add(condenserTarget);

    const stageCondenserLight = new THREE.SpotLight(
      0x38bdf8,
      4.2,
      12,
      Math.PI / 5,
      0.65,
      1.5
    );
    stageCondenserLight.position.set(0, -1.2, 0);
    stageCondenserLight.target = condenserTarget;
    stageCondenserLight.castShadow = true;
    stageCondenserLight.shadow.mapSize.width = 2048;
    stageCondenserLight.shadow.mapSize.height = 2048;
    stageCondenserLight.shadow.bias = -0.0001;
    scene.add(stageCondenserLight);

    // Laboratory Floor & Table Surface with Phenolic PBR Texture & Optical Condenser Collar
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.08;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const bioBenchTex = createLabBenchTextures(0x1e293b, 3, 3);
    const bioMetalTex = createBrushedMetalTextures();
    const tableGeo = new THREE.RingGeometry(0.95, 5.2, 48);
    tableGeo.rotateX(-Math.PI / 2);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      map: bioBenchTex?.map ?? null,
      roughnessMap: bioBenchTex?.roughnessMap ?? null,
      bumpMap: bioBenchTex?.bumpMap ?? null,
      bumpScale: 0.008,
      roughness: 0.65,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = 0.0;
    tableMesh.receiveShadow = true;
    tableMesh.name = 'Meja Mikroskop & Laboratorium Biologi';
    scene.add(tableMesh);

    const condenserBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.055, 14, 48),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughnessMap: bioMetalTex?.roughnessMap ?? null,
        metalness: 0.85,
        roughness: 0.24,
        envMapIntensity: 0.45,
      })
    );
    condenserBezel.rotation.x = Math.PI / 2;
    condenserBezel.position.y = 0.015;
    scene.add(condenserBezel);

    // Optical Condenser Lens Ring embedded in stage center
    const initialLite = useUIStore.getState().liteDeviceMode;
    const condenserLensMat = createBorosilicateGlassMaterial(initialLite, {
      color: 0xe0f2fe,
      tintOpacity: 0.34,
      ior: 1.47,
      thickness: 0.3,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
    });
    const condenserLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.75, 0.16, 32),
      condenserLensMat
    );
    condenserLens.position.set(0, -0.04, 0);
    condenserLens.name = 'Lensa Kondensor Bawah Mikroskop';
    scene.add(condenserLens);

    // Translucent Borosilicate Glass Microscope Slide (Kaca Preparat) above condenser
    const slideGlassMat = createBorosilicateGlassMaterial(initialLite, {
      color: 0xecfeff,
      tintOpacity: 0.30,
      ior: 1.47,
      thickness: 0.28,
    });
    const microscopeSlide = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.06, 1.8),
      slideGlassMat
    );
    microscopeSlide.position.set(0, 0.04, 0);
    microscopeSlide.name = 'Kaca Preparat Mikroskop Optik';
    scene.add(microscopeSlide);

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => host.captureSnapshot(),
      applyTheme: (colors) => {
        scene.background = new THREE.Color(0x0b0f17);
        scene.fog = new THREE.FogExp2(0x0b0f17, 0.02);
        tableMat.color.setHex(colors.tableHex ?? 0x1e293b);
        floorMat.color.setHex(colors.floorHex ?? 0x0f172a);
        hemiLight.color.setHex(colors.ambientSkyHex);
        hemiLight.groundColor.setHex(colors.ambientGroundHex);
        hemiLight.intensity = Math.min(0.45, colors.ambientIntensity);
      },
    };

    // Grid Floor
    const grid = new THREE.GridHelper(9, 18, 0x334155, 0x1e293b);
    grid.position.y = 0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    // Container for dynamic apparatus meshes
    const apparatusGroup = new THREE.Group();
    scene.add(apparatusGroup);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const nucleusTex = createOrganelleTexture('nucleus');
    const mitoTex = createOrganelleTexture('mitochondria');
    const chloroTex = createOrganelleTexture('chloroplast');
    const protoMembraneTex = createBiologicalMembraneTexture('#16a34a', '#bbf7d0');
    [nucleusTex, mitoTex, chloroTex, protoMembraneTex].forEach((t) => {
      if (t) t.anisotropy = maxAniso;
    });

    const nucleusBump = nucleusTex?.bumpMap ?? null;
    const mitoBump = mitoTex?.bumpMap ?? null;
    const chloroBump = chloroTex?.bumpMap ?? null;
    const protoBump = protoMembraneTex?.bumpMap ?? null;

    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: nucleusTex,
      bumpMap: nucleusBump,
      bumpScale: 0.025,
      roughness: 0.28,
      emissive: 0xa855f7,
      emissiveMap: nucleusTex,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.95,
    });
    const mitoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: mitoTex,
      bumpMap: mitoBump,
      bumpScale: 0.028,
      roughness: 0.32,
      emissive: 0xf97316,
      emissiveMap: mitoTex,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.95,
    });
    const chloroMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: chloroTex,
      bumpMap: chloroBump,
      bumpScale: 0.024,
      roughness: 0.26,
      emissive: 0x22c55e,
      emissiveMap: chloroTex,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.95,
    });
    const organelleMaterials = [nucleusMat, mitoMat, chloroMat];

    // Helper to build 3D internal cellular organelles (Nucleus, Mitochondria, Chloroplasts)
    const createCellularOrganellesGroup = (scale = 1.0): THREE.Group => {
      const orgGroup = new THREE.Group();
      orgGroup.scale.setScalar(scale);

      // 1. Inti Sel (Nucleus)
      const nucleusMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 28, 28),
        nucleusMat
      );
      nucleusMesh.position.set(0, 0.05, 0);
      nucleusMesh.castShadow = true;
      nucleusMesh.name = '🧬 Inti Sel (Nukleus & Kromatin)';
      orgGroup.add(nucleusMesh);

      // 2. Mitokondria (3 capsule-like organelles)
      const mitoGeo = new THREE.CapsuleGeometry(0.11, 0.22, 12, 20);
      const mitoCoords: [number, number, number, number][] = [
        [-0.55, 0.15, 0.28, 0.5],
        [0.52, -0.18, 0.25, -0.4],
        [0.35, 0.28, -0.32, 0.8],
      ];
      mitoCoords.forEach(([mx, my, mz, rotZ], idx) => {
        const mMesh = new THREE.Mesh(mitoGeo, mitoMat);
        mMesh.position.set(mx, my, mz);
        mMesh.rotation.set(0.3, idx * 0.8, rotZ);
        mMesh.castShadow = true;
        mMesh.name = `⚡ Mitokondria #${idx + 1} (Respirasi Seluler ATP)`;
        orgGroup.add(mMesh);
      });

      // 3. Kloroplas (6 discoid plastids with thylakoid stacks)
      const chloroGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.07, 20);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const cMesh = new THREE.Mesh(chloroGeo, chloroMat);
        cMesh.position.set(
          Math.cos(angle) * 0.72,
          (i % 2 === 0 ? 1 : -1) * 0.24,
          Math.sin(angle) * 0.42
        );
        cMesh.rotation.set(0.4, angle, 0.25);
        cMesh.castShadow = true;
        cMesh.name = `🌿 Kloroplas & Tilakoid #${i + 1}`;
        orgGroup.add(cMesh);
      }

      return orgGroup;
    };

    const rigSharedCtx = {
      apparatusGroup,
      scene,
      slideGlassMat,
      chloroMat,
      protoMembraneTex,
      protoBump,
      createCellularOrganellesGroup,
    };
    const activeRig: BiologyRigHandle =
      mode === 'photosynthesis-ingenhousz'
        ? buildPhotosynthesisRig(rigSharedCtx)
        : mode === 'enzyme-catalase' || mode === 'enzyme-kinetics'
        ? buildCatalaseRig(rigSharedCtx)
        : mode === 'predator-prey-dynamics'
        ? buildPredatorPreyRig(rigSharedCtx)
        : buildOsmosisRig(rigSharedCtx);

    const conceptProjVec = new THREE.Vector3();

    // Interactive 3D Virtual Caliper Ruler for Specimen Scale & NST Uncertainty
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

    // Unified ThreeInteractionManager (hover highlight, direct 3D drag, click & spatial cursor broadcast)
    let dragToastTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionManager = new ThreeInteractionManager({
      camera,
      domElement: renderer.domElement,
      controls,
      sceneForCursor: scene,
      defaultHoverColor: 0x10b981,
      getInteractiveObjects: () =>
        rulerHandle.group.visible
          ? [...apparatusGroup.children, ...rulerHandle.getInteractiveHandles()]
          : apparatusGroup.children,
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

    // Animation Loop
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    let currentFocusSmooth = lensFocusRef.current;

    const afterDraw = (cb: () => void) => {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    };

    let lastRenderTimestamp = 0;

    const animate = (timestamp?: number) => {
      if (disposed) return;

      const nowMs = typeof timestamp === 'number' && timestamp > 0 ? timestamp : performance.now();
      fpsMonitor.recordFrame(nowMs);

      const isLite = useUIStore.getState().liteDeviceMode;
      applyBorosilicateLiteMode(slideGlassMat, isLite);
      applyBorosilicateLiteMode(condenserLensMat, isLite);
      rulerHandle.group.visible = showRuler3DRef.current;
      if (isLite) {
        const deltaFps = nowMs - lastRenderTimestamp;
        if (deltaFps < 32) {
          if (isSoftwareGl) afterDraw(animate);
          else animationFrameId = requestAnimationFrame(animate);
          return;
        }
        lastRenderTimestamp = nowMs - (deltaFps % 33.3);
      }

      const delta = Math.min((nowMs - lastTimeMs) / 1000, 0.05);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const curParams = latestParamsRef.current;
      const extRef = externalSimTimeRef.current;
      const t =
        extRef && typeof extRef.current === 'number'
          ? extRef.current
          : typeof simTimePropRef.current === 'number'
          ? simTimePropRef.current
          : elapsed;

      // Smoothly interpolate 3D Microscope Lens Focus (Tahap 5)
      currentFocusSmooth = THREE.MathUtils.damp(
        currentFocusSmooth,
        lensFocusRef.current,
        8,
        delta || 0.016
      );
      const focusNormalized = currentFocusSmooth / 100; // 0.0 (defocused/far) -> 1.0 (sharp optical focus)
      const sharpnessFactor = Math.max(0.2, Math.min(1.0, 0.25 + focusNormalized * 0.75));

      // Adjust organelle material sharpness, fluorescence intensity & stage condenser beam
      organelleMaterials.forEach((mat, idx) => {
        mat.roughness = 0.75 - sharpnessFactor * 0.55;
        mat.opacity = 0.45 + sharpnessFactor * 0.53;
        mat.emissiveIntensity = (0.3 + sharpnessFactor * 0.95) * (idx === 2 ? 1.1 : 0.9);
      });
      stageCondenserLight.intensity = 2.2 + sharpnessFactor * 3.6;

      // Coupled focal zoom on camera distance when user adjusts Microscope Focus slider
      const zoomFactor = 1.28 - focusNormalized * 0.46; // zooms in smoothly as focus increases
      desiredCamPos.copy(baseCamPos).multiplyScalar(zoomFactor);

      // Slow gentle rotation for viewing angle
      apparatusGroup.rotation.y = Math.sin(t * 0.15) * 0.25;

      const rigAnchors = activeRig.update(t, curParams, isLite, showConceptLabelsRef.current);

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

      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
      if (dragToastTimer) clearTimeout(dragToastTimer);
      interactionManager.dispose();
      rulerHandle.dispose();
      activeRig.dispose();

      teacherCollabBridge.dispose();
      if (cursorManagerRef.current) {
        cursorManagerRef.current.dispose();
      }

      // Dispose Organelle/Bench Textures
      bioBenchTex?.dispose();
      bioMetalTex?.dispose();
      nucleusTex?.dispose();
      nucleusBump?.dispose();
      mitoTex?.dispose();
      mitoBump?.dispose();
      chloroTex?.dispose();
      chloroBump?.dispose();
      protoMembraneTex?.dispose();
      protoBump?.dispose();
      cameraSyncHandleRef.current = null;
      host.dispose();
    };
  }, [mode, sceneKey]);

  // Sync Remote Cursors
  useEffect(() => {
    if (cursorManagerRef.current) {
      cursorManagerRef.current.update(remoteCursors);
    }
  }, [remoteCursors]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleToggleFullscreen = () => {
    labSound.playClick();
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

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

      {/* Optical Microscope Eyepiece Vignette & Reticle Scale Overlay when activePreset === 'focus' */}
      {activePreset === 'focus' && (
        <div
          data-testid="microscope-eyepiece-vignette"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at center, rgba(2,6,23,0) 46%, rgba(2,6,23,0.45) 68%, rgba(2,6,23,0.88) 92%)',
          }}
        >
          {/* Circular Optical Lens Rim + Micrometer Reticle Crosshair & Scale */}
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
            {/* Horizontal micrometer reticle bar near bottom of lens */}
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

      {/* Unified Top-Right Camera & Fullscreen Pill */}
      {/* Consolidated Top-Right Capsule Bar: Ukur 3D | Snap-to-Port | 🥽 Mode VR | Presets */}
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

      {/* Interactive 3D Microscope Lens Focus Control (Compact Top-Left Pill) */}
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

      {/* Floating Organelle Focus Badge */}
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

