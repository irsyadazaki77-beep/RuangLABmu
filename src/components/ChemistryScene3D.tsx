import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChemistryParams,
  ChemistryMetrics,
  ThermoReactionPreset,
  RedoxCouplePreset,
} from '../utils/scienceEngine';
import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { Maximize2, Minimize2 } from 'lucide-react';
import { labSound } from '../utils/soundEngine';
import { Scene3DTelemetryHUD } from './ui/ScientificEnhancementSuite';

interface ChemistryScene3DProps {
  params: ChemistryParams;
  metrics: ChemistryMetrics;
  preset: ThermoReactionPreset;
  redoxPreset: RedoxCouplePreset;
  reactionProgress: number;
  isReacting: boolean;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onUpdateParam?: (paramKey: string, value: number) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
}

type CameraPreset = 'isometric' | 'front' | 'top' | 'closeup';

export const ChemistryScene3D: React.FC<ChemistryScene3DProps> = ({
  params,
  metrics,
  preset,
  redoxPreset,
  reactionProgress,
  isReacting,
  remoteCursors,
  onEmitCursor,
  onUpdateParam,
  onCaptureSnapshot,
  snapshotCount = 0,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);

  const latestRef = useRef({
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
  });
  latestRef.current = {
    params,
    metrics,
    preset,
    redoxPreset,
    reactionProgress,
    isReacting,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
    setOrbit: (orbit: boolean) => void;
    captureCanvas: () => string | null;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    scene.fog = new THREE.FogExp2(0x0b1120, 0.018);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(4.2, 5.8, 10.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 1.4;
    controls.target.set(0, 1.4, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3.5;
    controls.maxDistance = 30;

    let camTransitionActive = false;
    const desiredCamPos = new THREE.Vector3(4.2, 5.8, 10.5);
    const desiredTarget = new THREE.Vector3(0, 1.4, 0);

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

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
    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      },
    };

    // Lighting
    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.65));
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    keyLight.position.set(6, 12, 8);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    fillLight.position.set(-7, 5, -6);
    scene.add(fillLight);

    // Floor & Lab Bench Table
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.28, 6.0),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.1 })
    );
    tableTop.position.set(0, 0.14, 0);
    tableTop.receiveShadow = true;
    scene.add(tableTop);

    // Shared Materials
    const darkFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
    const brushedSteelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.25 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.9,
    });

    const cursorManager = new SpatialCursorManager(scene);

    // =========================================================
    // 1. THERMO CALORIMETRY 3D GROUP
    // =========================================================
    const thermoGroup = new THREE.Group();
    scene.add(thermoGroup);

    const calVessel = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 2.6, 32),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 })
    );
    calVessel.position.set(0, 1.5, 0);
    thermoGroup.add(calVessel);

    const calLid = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.2, 32),
      brushedSteelMat
    );
    calLid.position.set(0, 2.85, 0);
    thermoGroup.add(calLid);

    const calThermometer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.2, roughness: 0.2 })
    );
    calThermometer.position.set(0.6, 3.2, 0);
    calThermometer.userData = { draggableParam: 'initialTempC', min: 10, max: 90, step: 1, label: 'Suhu Awal T₀' };
    thermoGroup.add(calThermometer);

    // =========================================================
    // 2. ACID-BASE TITRATION 3D GROUP
    // =========================================================
    const titrationGroup = new THREE.Group();
    scene.add(titrationGroup);

    // Retort Stand
    const retBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 3.2), darkFrameMat);
    retBase.position.set(-1.4, 0.38, 0);
    titrationGroup.add(retBase);
    const retRod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.4, 16), brushedSteelMat);
    retRod.position.set(-2.2, 3.4, 0);
    titrationGroup.add(retRod);

    // Burette Glass Tube
    const buretteTube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 24), glassMat);
    buretteTube.position.set(0, 4.4, 0);
    titrationGroup.add(buretteTube);

    // Titrant liquid inside burette
    const buretteLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 4.0, 24),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
    );
    buretteLiquid.position.set(0, 4.4, 0);
    titrationGroup.add(buretteLiquid);

    // Stopcock valve tap
    const stopcock = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 16), brassMat);
    stopcock.rotation.z = Math.PI / 2;
    stopcock.position.set(0, 2.2, 0);
    stopcock.userData = { draggableParam: 'titrantAddedMl', min: 0, max: 50, step: 0.5, label: 'Volume Titran Vb' };
    titrationGroup.add(stopcock);

    // Erlenmeyer Flask at bottom
    const flaskGeo = new THREE.CylinderGeometry(0.4, 1.4, 1.8, 32);
    const flaskMesh = new THREE.Mesh(flaskGeo, glassMat);
    flaskMesh.position.set(0, 1.2, 0);
    titrationGroup.add(flaskMesh);

    // Analyte Solution inside flask with dynamic indicator color
    const analyteSolution = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 1.35, 1.0, 32),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.75 })
    );
    analyteSolution.position.set(0, 0.8, 0);
    titrationGroup.add(analyteSolution);

    // =========================================================
    // 3. ELECTROCHEMISTRY GALVANIC CELL 3D GROUP
    // =========================================================
    const redoxGroup = new THREE.Group();
    scene.add(redoxGroup);

    // Left beaker (Anode)
    const beakerLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 28), glassMat);
    beakerLeft.position.set(-1.8, 1.2, 0);
    const anodeElectrode = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 0.08), brushedSteelMat);
    anodeElectrode.position.set(-1.8, 1.4, 0);
    anodeElectrode.userData = { draggableParam: 'anodeConcM', min: 0.01, max: 2.0, step: 0.05, label: '[Anoda]' };
    redoxGroup.add(beakerLeft, anodeElectrode);

    // Right beaker (Cathode)
    const beakerRight = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 28), glassMat);
    beakerRight.position.set(1.8, 1.2, 0);
    const cathodeElectrode = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 0.08), brassMat);
    cathodeElectrode.position.set(1.8, 1.4, 0);
    cathodeElectrode.userData = { draggableParam: 'cathodeConcM', min: 0.01, max: 2.0, step: 0.05, label: '[Katoda]' };
    redoxGroup.add(beakerRight, cathodeElectrode);

    // Salt Bridge U-Tube
    const saltBridge = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.12, 12, 32, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.8 })
    );
    saltBridge.position.set(0, 1.6, 0);
    redoxGroup.add(saltBridge);

    // Digital Voltmeter
    const voltMeter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.8), darkFrameMat);
    voltMeter.position.set(0, 2.8, -1.2);
    redoxGroup.add(voltMeter);

    // =========================================================
    // 4. IDEAL GAS & BOYLE COMPRESSION 3D GROUP
    // =========================================================
    const gasGroup = new THREE.Group();
    scene.add(gasGroup);

    // Heavy glass cylinder
    const gasCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 4.4, 32, 1, true),
      glassMat
    );
    gasCylinder.position.set(0, 2.5, 0);
    gasGroup.add(gasCylinder);

    const gasCylBase = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.25, 32), darkFrameMat);
    gasCylBase.position.set(0, 0.4, 0);
    gasGroup.add(gasCylBase);

    // Movable metallic piston head
    const pistonHead = new THREE.Mesh(
      new THREE.CylinderGeometry(1.58, 1.58, 0.35, 32),
      brushedSteelMat
    );
    pistonHead.position.set(0, 3.2, 0);
    pistonHead.userData = { draggableParam: 'gasVolumeL', min: 2.0, max: 25.0, step: 0.5, label: 'Volume Gas V (L)' };
    gasGroup.add(pistonHead);

    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 16), brushedSteelMat);
    pistonRod.position.set(0, 4.4, 0);
    gasGroup.add(pistonRod);

    // Analog dial pressure gauge
    const pressureDial = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.2, 28), brassMat);
    pressureDial.rotation.x = Math.PI / 2;
    pressureDial.position.set(2.2, 2.6, 0);
    gasGroup.add(pressureDial);

    const pressureNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    pressureNeedle.position.set(2.2, 2.6, 0.12);
    gasGroup.add(pressureNeedle);

    // Kinetic gas bouncing particles
    const GAS_PARTICLES_COUNT = 24;
    const gasParticles: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
    const gasPartGeo = new THREE.SphereGeometry(0.08, 12, 12);
    for (let i = 0; i < GAS_PARTICLES_COUNT; i++) {
      const pMesh = new THREE.Mesh(gasPartGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 }));
      pMesh.position.set((Math.random() - 0.5) * 2.2, 0.6 + Math.random() * 2.2, (Math.random() - 0.5) * 2.2);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
      gasGroup.add(pMesh);
      gasParticles.push({ mesh: pMesh, vel });
    }

    // =========================================================
    // 5. REACTION KINETICS & ARRHENIUS 3D GROUP
    // =========================================================
    const kineticsGroup = new THREE.Group();
    scene.add(kineticsGroup);

    // Magnetic hotplate stirrer
    const hotplateBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 3.6), darkFrameMat);
    hotplateBase.position.set(0, 0.68, 0);
    kineticsGroup.add(hotplateBase);

    const hotplateCeramicTop = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    hotplateCeramicTop.position.set(0, 1.12, 0);
    kineticsGroup.add(hotplateCeramicTop);

    // Temp control knob on hotplate
    const tempKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 16), brassMat);
    tempKnob.rotation.x = Math.PI / 2;
    tempKnob.position.set(0, 0.68, 1.85);
    tempKnob.userData = { draggableParam: 'kineticsTempC', min: 10, max: 70, step: 5, label: 'Suhu Pemanas T (°C)' };
    kineticsGroup.add(tempKnob);

    // Reaction flask on hotplate
    const kFlask = new THREE.Mesh(flaskGeo, glassMat);
    kFlask.position.set(0, 2.1, 0);
    kineticsGroup.add(kFlask);

    // Liquid whose color turns to sulfur precipitate
    const kLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 1.35, 1.0, 32),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.7 })
    );
    kLiquid.position.set(0, 1.7, 0);
    kineticsGroup.add(kLiquid);

    // Magnetic stir bar inside flask
    const stirBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stirBar.rotation.z = Math.PI / 2;
    stirBar.position.set(0, 1.25, 0);
    kineticsGroup.add(stirBar);

    // =========================================================
    // 6. SPECTROPHOTOMETRY UV-VIS (BEER'S LAW) 3D GROUP
    // =========================================================
    const spectroGroup = new THREE.Group();
    scene.add(spectroGroup);

    // Main Spectrophotometer Chassis
    const spectroChassis = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 4.8), darkFrameMat);
    spectroChassis.position.set(0, 1.38, 0);
    spectroGroup.add(spectroChassis);

    // Sample Compartment Lid (openable)
    const spectroLid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 2.2), brushedSteelMat);
    spectroLid.position.set(-0.8, 2.55, 0.4);
    spectroGroup.add(spectroLid);

    // Optical Cuvette
    const cuvetteMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, transmission: 0.95 });
    const cuvette = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.65), cuvetteMat);
    cuvette.position.set(-0.8, 2.8, 0.4);
    spectroGroup.add(cuvette);

    // Colored analyte inside cuvette (KMnO4 magenta / CuSO4 cyan)
    const analyteSolutionCuvette = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.6, 0.58),
      new THREE.MeshStandardMaterial({ color: 0xd946ef, transparent: true, opacity: 0.75 })
    );
    analyteSolutionCuvette.position.set(-0.8, 2.8, 0.4);
    analyteSolutionCuvette.userData = { draggableParam: 'spectroConcMm', min: 0.01, max: 0.25, step: 0.01, label: 'Konsentrasi c (mM)' };
    spectroGroup.add(analyteSolutionCuvette);

    // Incident light beam line
    const spectroBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.8, 12),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    spectroBeam.rotation.z = Math.PI / 2;
    spectroBeam.position.set(-0.8, 2.8, 0.4);
    spectroGroup.add(spectroBeam);

    // =========================================================
    // DIRECT 3D MESH DRAGGING (RAYCASTER GIZMOS)
    // =========================================================
    let isDragging = false;
    let dragParamKey = '';
    let dragStartPos = { x: 0, y: 0 };
    let dragStartVal = 0;
    let dragConfig = { min: 0, max: 100, step: 1, label: '' };
    const dragRaycaster = new THREE.Raycaster();
    const dragMouse = new THREE.Vector2();

    const getInteractiveMeshes = (): THREE.Object3D[] => {
      const list: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible && obj.userData?.draggableParam) {
          list.push(obj);
        }
      });
      return list;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      dragMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      dragRaycaster.setFromCamera(dragMouse, camera);

      const hits = dragRaycaster.intersectObjects(getInteractiveMeshes(), false);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const paramKey = hitObj.userData.draggableParam;
        if (paramKey && latestRef.current.onUpdateParam) {
          isDragging = true;
          dragParamKey = paramKey;
          dragStartPos = { x: e.clientX, y: e.clientY };
          dragConfig = {
            min: hitObj.userData.min ?? 0,
            max: hitObj.userData.max ?? 100,
            step: hitObj.userData.step ?? 1,
            label: hitObj.userData.label ?? paramKey,
          };
          const curVal = (latestRef.current.params as unknown as Record<string, number>)[paramKey] ?? 0;
          dragStartVal = curVal;
          controls.enabled = false;
          renderer.domElement.style.cursor = 'grabbing';
          labSound.playClick(600);
          setDragToast({ label: dragConfig.label, value: `${curVal}` });
        }
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        isDragging = false;
        dragParamKey = '';
        controls.enabled = true;
        renderer.domElement.style.cursor = 'grab';
        setTimeout(() => setDragToast(null), 1200);
      }
    };

    let disposed = false;
    let rafId = 0;

    const tick = () => {
      if (disposed) return;

      const { params: p, metrics: m, isReacting: reacting } = latestRef.current;

      thermoGroup.visible = p.mode === 'thermo-calorimetry';
      titrationGroup.visible = p.mode === 'acid-base-titration';
      redoxGroup.visible = p.mode === 'electrochemistry-cell' || (p.mode as string) === 'redox-electrochemistry';
      gasGroup.visible = p.mode === 'ideal-gas-boyle';
      kineticsGroup.visible = p.mode === 'reaction-kinetics-arrhenius';
      spectroGroup.visible = p.mode === 'spectrophotometry-beer';

      // 1. Titration color update
      if (p.mode === 'acid-base-titration') {
        const mat = analyteSolution.material as THREE.MeshStandardMaterial;
        mat.color.setStyle(m.indicatorColorHex);
        const vb = p.titrantAddedMl ?? 0;
        const level = Math.max(0.1, 4.0 * (1 - vb / 50));
        buretteLiquid.scale.set(1, level / 4.0, 1);
        buretteLiquid.position.set(0, 2.4 + level / 2, 0);
      }

      // 2. Gas Boyle update
      else if (p.mode === 'ideal-gas-boyle') {
        const vL = p.gasVolumeL ?? 10.0;
        const pistonY = 0.8 + (vL / 25.0) * 3.2;
        pistonHead.position.y = pistonY;
        pistonRod.position.y = pistonY + 1.2;

        const pAtm = m.gasPressureAtm ?? 1.0;
        const needleAngle = Math.max(-1.4, Math.min(1.4, (pAtm / 5.0) * Math.PI - Math.PI / 2));
        pressureNeedle.rotation.z = -needleAngle;

        // Kinetic particles bounce
        const speed = Math.sqrt((p.gasTemperatureK ?? 300) / 300) * 0.04;
        gasParticles.forEach((part) => {
          part.mesh.position.addScaledVector(part.vel, speed);
          if (part.mesh.position.y > pistonY - 0.2 || part.mesh.position.y < 0.6) {
            part.vel.y *= -1;
          }
          if (Math.abs(part.mesh.position.x) > 1.2) part.vel.x *= -1;
          if (Math.abs(part.mesh.position.z) > 1.2) part.vel.z *= -1;
        });
      }

      // 3. Reaction Kinetics update
      else if (p.mode === 'reaction-kinetics-arrhenius') {
        stirBar.rotation.y += reacting ? 0.35 : 0.05;
        const eaFraction = Math.min(1, Math.max(0, (p.kineticsTempC ?? 25) / 70));
        (kLiquid.material as THREE.MeshStandardMaterial).opacity = 0.5 + eaFraction * 0.45;
      }

      // 4. Spectrophotometry update
      else if (p.mode === 'spectrophotometry-beer') {
        const absVal = m.spectroAbsorbance ?? 0.8;
        const opacity = Math.min(0.95, Math.max(0.2, absVal * 0.4));
        (analyteSolutionCuvette.material as THREE.MeshStandardMaterial).opacity = opacity;
        (spectroBeam.material as THREE.MeshBasicMaterial).color.setHex(absVal > 2 ? 0xef4444 : 0x22c55e);
      }

      cursorManager.update(
        latestRef.current.remoteCursors || {},
        camera.position
      );

      if (camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamPos.x, 6, 0.016);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamPos.y, 6, 0.016);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamPos.z, 6, 0.016);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredTarget.x, 6, 0.016);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredTarget.y, 6, 0.016);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredTarget.z, 6, 0.016);
        if (camera.position.distanceToSquared(desiredCamPos) < 0.01) {
          camTransitionActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    let lastEmitTime = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (isDragging && dragParamKey && latestRef.current.onUpdateParam) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = dragStartPos.y - e.clientY;
        const sensitivity = (dragConfig.max - dragConfig.min) / 280;
        const delta = (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * sensitivity;
        let nextVal = dragStartVal + delta;
        nextVal = Math.max(dragConfig.min, Math.min(dragConfig.max, nextVal));
        if (dragConfig.step >= 1) {
          nextVal = Math.round(nextVal / dragConfig.step) * dragConfig.step;
        } else {
          nextVal = Number((Math.round(nextVal / dragConfig.step) * dragConfig.step).toFixed(2));
        }
        latestRef.current.onUpdateParam(dragParamKey, nextVal);
        setDragToast({ label: dragConfig.label, value: `${nextVal}` });
        return;
      }

      dragMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      dragMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      dragRaycaster.setFromCamera(dragMouse, camera);
      const hits = dragRaycaster.intersectObjects(getInteractiveMeshes(), false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'grab' : 'default';

      if (latestRef.current.onEmitCursor) {
        const now = performance.now();
        if (now - lastEmitTime > 40) {
          const intersects = dragRaycaster.intersectObjects(scene.children, true);
          if (intersects.length > 0) {
            const hit = intersects[0];
            latestRef.current.onEmitCursor(
              [hit.point.x, hit.point.y, hit.point.z],
              hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : undefined,
              hit.object.name
            );
            lastEmitTime = now;
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      cursorManager.dispose();
      controls.dispose();

      // Deep Three.js GPU resource disposal
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m?.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      if (envTexture) {
        envTexture.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSelectCameraPreset = (presetName: CameraPreset) => {
    setActivePreset(presetName);
    cameraCtrlRef.current?.setPreset(presetName);
  };

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

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#0B1120] touch-none select-none ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="chemistry-simulation-canvas"
        className="w-full h-full block touch-none"
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full backdrop-blur-xl bg-sky-950/90 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 animate-pulse text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel Kimia 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      {/* Top Camera Controls */}
      <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 rounded-full backdrop-blur-xl bg-slate-900/75 border border-white/15 px-3 py-1.5 shadow-2xl z-20">
        <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold mr-1">
          Kamera 3D:
        </span>
        {(
          [
            { id: 'isometric', label: 'Isometrik' },
            { id: 'front', label: 'Depan' },
            { id: 'top', label: 'Atas' },
            { id: 'closeup', label: 'Fokus' },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleSelectCameraPreset(p.id)}
            className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-full transition-colors cursor-pointer ${
              activePreset === p.id
                ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 3D Live Telemetry HUD & Snapshot / Orbit Bar */}
      <Scene3DTelemetryHUD
        domainTitle="Kimia"
        primaryLabel={
          params.mode === 'acid-base-titration'
            ? 'pH Larutan'
            : params.mode === 'electrochemistry-cell'
            ? 'Potensial Sel (E_sel)'
            : 'Suhu Akhir (T_akhir)'
        }
        primaryValue={
          params.mode === 'acid-base-titration'
            ? `${metrics.currentPh.toFixed(2)}`
            : params.mode === 'electrochemistry-cell'
            ? `${metrics.nernstCellPotentialE.toFixed(3)} V`
            : `${metrics.finalTempC.toFixed(1)} °C`
        }
        secondaryLabel={
          params.mode === 'acid-base-titration'
            ? 'Volume Titran Vb'
            : params.mode === 'electrochemistry-cell'
            ? 'Energi Gibbs (ΔG)'
            : 'Entalpi (ΔH)'
        }
        secondaryValue={
          params.mode === 'acid-base-titration'
            ? `${params.titrantAddedMl.toFixed(1)} mL`
            : params.mode === 'electrochemistry-cell'
            ? `${metrics.electroFreeEnergyDeltaG.toFixed(1)} kJ`
            : `${metrics.deltaHReaction.toFixed(1)} kJ/mol`
        }
        energyBarLabel="Progres & Keseimbangan Reaksi"
        energyBarRatio={
          params.mode === 'acid-base-titration'
            ? (metrics.currentPh / 14) * 100
            : Math.min(95, Math.max(15, (metrics.finalTempC / 90) * 100))
        }
        isOrbiting={isOrbiting}
        onToggleOrbit={() => {
          const next = !isOrbiting;
          setIsOrbiting(next);
          cameraCtrlRef.current?.setOrbit(next);
        }}
        onCaptureSnapshot={
          onCaptureSnapshot
            ? () => {
                const url = cameraCtrlRef.current?.captureCanvas();
                if (url) onCaptureSnapshot(url);
              }
            : undefined
        }
        snapshotCount={snapshotCount}
      />

      {/* Top-Right Fullscreen Toggle Button */}
      <div className="pointer-events-auto absolute top-4 right-4 z-30">
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-xs font-mono text-white shadow-2xl transition-all cursor-pointer"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D (Sentuh & Mobile)'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Kecilkan 3D</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline font-semibold">Layar Penuh 3D</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
