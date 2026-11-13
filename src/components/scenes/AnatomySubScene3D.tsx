import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Eye, Layers, Sparkles, X } from 'lucide-react';
import {
  createBiologicalMembraneTexture,
  createStudioComposer,
  disposeThreeSceneResources,
  smoothCameraTransition,
} from '../../utils/threeStudioKit';
import {
  calculateCardiovascularHeart,
  calculateRespiratoryLungs,
  calculateNeuralSynapse,
} from '../../utils/engines/biologyEngine';
import { SpatialCursorPayload } from '../../utils/collabProtocol';
import { ComfortThemeMode } from '../ui/VisualComfortToolbar';
import { useUIStore } from '../../stores/useUIStore';
import {
  ConceptLabelDomRef,
  ConceptLabelToggleButton,
  ConceptLabelsLayer,
  updateProjectedConceptLabels,
} from '../ui/ConceptLabelsOverlay';

export type AnatomyModuleId =
  | 'anatomy-cardiovascular-heart'
  | 'anatomy-respiratory-lungs'
  | 'anatomy-neural-synapse';

export type AnatomyMode = AnatomyModuleId;
export type AnatomyLayerMode = 'outer' | 'xray' | 'cross-section';

export interface AnatomySubScene3DProps {
  mode: AnatomyModuleId;
  params: Record<string, number>;
  isPlaying?: boolean;
  timeScale?: number;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  comfortTheme?: ComfortThemeMode;
}

interface AnatomyPinDef {
  id: string;
  num: number;
  name: string;
  mode: AnatomyModuleId;
  position: [number, number, number];
  cameraTarget: [number, number, number];
  cameraOffset: [number, number, number];
  subtitle: string;
  description: string;
  getLiveMetrics: (p: Record<string, number>) => { label: string; value: string }[];
}

const evalHeart = (p: Record<string, number>, timeSec = 0.5) =>
  calculateCardiovascularHeart({
    heartRateBpm: p.heartRateBpm ?? 72,
    vesselRadiusRatio: p.vesselRadiusRatio ?? 1.0,
    bloodViscosity: p.bloodViscosity ?? 3.2,
    exerciseIntensity: p.exerciseIntensity ?? 15,
    timeSec,
  });

const ANATOMY_PINS: AnatomyPinDef[] = [
  {
    id: 'pin-aorta',
    num: 1,
    name: 'Aorta (Lengkung Aorta)',
    mode: 'anatomy-cardiovascular-heart',
    position: [0.25, 1.55, 0.25],
    cameraTarget: [0.15, 1.25, 0.1],
    cameraOffset: [2.2, 1.8, 3.2],
    subtitle: 'Arteri Elastis Terbesar Tubuh',
    description:
      'Menerima darah kaya oksigen bertekanan tinggi dari Ventrikel Kiri saat sistol dan mendistribusikannya ke seluruh sirkulasi sistemik.',
    getLiveMetrics: (p) => {
      const m = evalHeart(p);
      return [
        { label: 'Tekanan Sistolik / Diastolik', value: `${m.systolicMmHg} / ${m.diastolicMmHg} mmHg` },
        { label: 'Mean Arterial Pressure (MAP)', value: `${m.meanArterialPressure} mmHg` },
        { label: 'Resistensi Vaskular (Poiseuille)', value: `${m.vascularResistance} PRU` },
      ];
    },
  },
  {
    id: 'pin-left-ventricle',
    num: 2,
    name: 'Ventrikel Kiri (Miokardium)',
    mode: 'anatomy-cardiovascular-heart',
    position: [0.68, -0.35, 0.72],
    cameraTarget: [0.4, -0.25, 0.3],
    cameraOffset: [2.4, 0.9, 3.1],
    subtitle: 'Bilik Pompa Utama Sistemik',
    description:
      'Memiliki dinding otot jantung (miokardium) paling tebal untuk memompa Stroke Volume melewati katup aorta melawan resistensi sistemik.',
    getLiveMetrics: (p) => {
      const m = evalHeart(p);
      return [
        { label: 'Stroke Volume (SV)', value: `${m.strokeVolumeMl} mL/detak` },
        { label: 'Curah Jantung (Cardiac Output)', value: `${m.cardiacOutputLMin} L/menit` },
        { label: 'Frekuensi Detak (HR)', value: `${Math.round(p.heartRateBpm ?? 72)} bpm` },
      ];
    },
  },
  {
    id: 'pin-right-atrium',
    num: 3,
    name: 'Atrium Kanan & Vena Cava',
    mode: 'anatomy-cardiovascular-heart',
    position: [-0.95, 0.55, 0.45],
    cameraTarget: [-0.55, 0.35, 0.2],
    cameraOffset: [-2.6, 1.3, 3.2],
    subtitle: 'Muara Aliran Balik Vena & Nodus SA',
    description:
      'Menerima darah deoksigenasi dari Vena Cava Superior/Inferior serta menjadi lokasi Nodus Sinoatrial (pacemaker alami pemicu gelombang P pada EKG).',
    getLiveMetrics: (p) => {
      const m = evalHeart(p, 0.16 * (60 / (p.heartRateBpm ?? 72)));
      return [
        { label: 'Potensial Pacemaker (EKG P-Wave)', value: `${m.ecgVoltageMv.toFixed(2)} mV` },
        { label: 'Viskositas Darah (η)', value: `${(p.bloodViscosity ?? 3.2).toFixed(1)} cP` },
        { label: 'Aliran Balik Vena', value: `${m.cardiacOutputLMin} L/menit` },
      ];
    },
  },
  {
    id: 'pin-alveolus',
    num: 4,
    name: 'Alveolus & Bronkiolus Respiratorius',
    mode: 'anatomy-respiratory-lungs',
    position: [1.15, 0.25, 0.65],
    cameraTarget: [0.4, 0.15, 0.1],
    cameraOffset: [2.2, 1.3, 3.8],
    subtitle: 'Unit Pertukaran Gas Kapiler-Alveolar',
    description:
      'Kantung udara mikroskopis tempat difusi O₂ menuju kapiler paru dan pelepasan CO₂ berdasarkan gradien tekanan parsial barometrik.',
    getLiveMetrics: (p) => {
      const m = calculateRespiratoryLungs({
        respirationRate: p.respirationRate ?? 15,
        diaphragmEffort: p.diaphragmEffort ?? 50,
        airwayResistance: p.airwayResistance ?? 1.0,
        altitudeMeters: p.altitudeMeters ?? 0,
        timeSec: 0.5,
      });
      return [
        { label: 'Tekanan O₂ Alveolus (PAO₂)', value: `${m.alveolarPo2MmHg} mmHg` },
        { label: 'Saturasi Oksihemoglobin (SpO₂)', value: `${m.spo2Percent}%` },
        { label: 'Ventilasi Menit (VE)', value: `${m.minuteVentilationLMin} L/menit` },
      ];
    },
  },
  {
    id: 'pin-ranvier',
    num: 5,
    name: 'Nodus Ranvier & Selubung Mielin',
    mode: 'anatomy-neural-synapse',
    position: [0.35, 0.32, 0.35],
    cameraTarget: [0.2, 0.0, 0.0],
    cameraOffset: [1.6, 1.4, 3.6],
    subtitle: 'Celah Kanal Ion Na⁺/K⁺ Berpintu Tegangan',
    description:
      'Celah mikro di antara segmen selubung mielin tempat terkonsentrasinya kanal Na⁺/K⁺ untuk melompatkan potensial aksi secara saltatorik.',
    getLiveMetrics: (p) => {
      const m = calculateNeuralSynapse({
        stimulusVoltageMv: p.stimulusVoltageMv ?? -35,
        myelinThickness: p.myelinThickness ?? 75,
        extracellularNaMm: p.extracellularNaMm ?? 145,
        extracellularKMm: p.extracellularKMm ?? 4.5,
        timeSec: 0.22,
      });
      return [
        { label: 'Hukum All-or-None', value: m.actionPotentialTriggered ? 'TERPICU (Depolarisasi)' : 'SUB-THRESHOLD' },
        { label: 'Kecepatan Konduksi Saltatorik', value: `${m.conductionVelocityMs} m/s` },
        { label: 'Potensial Nernst (ENa / EK)', value: `${m.nernstNaMv} / ${m.nernstKMv} mV` },
      ];
    },
  },
];

export const AnatomySubScene3D: React.FC<AnatomySubScene3DProps> = ({
  mode,
  params,
  isPlaying = true,
  timeScale = 1,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const showConceptLabels = useUIStore((s) => s.showConceptLabels);
  const showConceptLabelsRef = useRef(showConceptLabels);
  showConceptLabelsRef.current = showConceptLabels;

  const conceptDomRef = useRef<Record<string, ConceptLabelDomRef>>({});
  const bindConceptSlot = useCallback((id: string, dom: ConceptLabelDomRef | null) => {
    if (dom) conceptDomRef.current[id] = dom;
    else delete conceptDomRef.current[id];
  }, []);

  const paramsRef = useRef<Record<string, number>>(params);
  const playingRef = useRef(isPlaying);
  const timeScaleRef = useRef(timeScale);

  const [layerMode, setLayerMode] = useState<AnatomyLayerMode>('outer');
  const layerModeRef = useRef<AnatomyLayerMode>('outer');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [sceneKey, setSceneKey] = useState<number>(0);
  const cameraLerpRef = useRef<{ target: THREE.Vector3; pos: THREE.Vector3; active: boolean }>({
    target: new THREE.Vector3(0, 0, 0),
    pos: new THREE.Vector3(0, 1.4, 5.2),
    active: false,
  });

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { timeScaleRef.current = timeScale; }, [timeScale]);
  useEffect(() => { layerModeRef.current = layerMode; }, [layerMode]);
  useEffect(() => {
    setSelectedPinId(null);
    setLayerMode('outer');
    cameraLerpRef.current.active = false;
  }, [mode]);

  const activePins = ANATOMY_PINS.filter((pin) => pin.mode === mode);
  const selectedPin = ANATOMY_PINS.find((pin) => pin.id === selectedPinId) ?? null;

  const handleSelectPin = (pin: AnatomyPinDef) => {
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
    while (container.firstChild) container.removeChild(container.firstChild);

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 460;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.045);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    camera.position.set(0, 1.3, 5.2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      return;
    }
    renderer.setSize(width, height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    const handleWebGLContextLost = (event: Event) => {
      event.preventDefault();
    };
    const handleWebGLContextRestored = () => {
      setSceneKey((prev) => prev + 1);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleWebGLContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleWebGLContextRestored, false);
    container.appendChild(renderer.domElement);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    const studioComposer = createStudioComposer(
      renderer,
      scene,
      camera,
      width,
      height,
      isSoftwareGl,
      { strength: 0.14, radius: 0.25, threshold: 1.15 }
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.1, 0);

    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.45));
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0002;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);
    const subLight = new THREE.PointLight(0xf43f5e, 0.8, 12);
    subLight.position.set(0, -2.1, 2.5);
    scene.add(subLight);

    // Studio Circular Pedestal Stage receiving crisp shadow
    const pedestalGeo = new THREE.CylinderGeometry(2.6, 2.9, 0.16, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.08,
      envMapIntensity: 0.35,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -2.28;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

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

    const pinMeshes: { mesh: THREE.Mesh; halo: THREE.Mesh; pin: AnatomyPinDef }[] = [];
    const pinGroup = new THREE.Group();
    rootGroup.add(pinGroup);

    ANATOMY_PINS.filter((p) => p.mode === mode).forEach((pin) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.9, roughness: 0.2 })
      );
      sphere.position.set(...pin.position);
      sphere.userData = { pinId: pin.id };
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.22, 24),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      halo.position.set(...pin.position);
      pinGroup.add(sphere, halo);
      pinMeshes.push({ mesh: sphere, halo, pin });
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pinMeshes.map((p) => p.mesh));
      if (hits.length > 0) {
        const found = ANATOMY_PINS.find((p) => p.id === hits[0].object.userData?.pinId);
        if (found) handleSelectPin(found);
      }
    };
    renderer.domElement.addEventListener('mousedown', onPointerDown);

    const dummy = new THREE.Object3D();
    const conceptProjVec = new THREE.Vector3();
    let updateFrame = (_t: number, _dt: number) => {};

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

      const myoMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: heartMembraneTex,
        bumpMap: heartBump,
        bumpScale: 0.018,
        roughness: 0.3,
        clearcoat: 0.72,
        clearcoatRoughness: 0.18,
        transmission: 0.06,
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

      const pulmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.18, 0.35, 0.36),
        new THREE.Vector3(-0.12, 0.92, 0.28),
        new THREE.Vector3(-0.55, 1.1, 0.1),
      ]);
      const pulmArtery = new THREE.Mesh(new THREE.TubeGeometry(pulmCurve, 20, 0.145, 14, false), venaMat);
      pulmArtery.castShadow = true;

      rootGroup.add(
        leftVentricle,
        rightVentricle,
        leftAtrium,
        rightAtrium,
        aortaArch,
        coronaryArtery,
        venaCava,
        pulmArtery
      );

      // Tapered muscular Interventricular Septum (no blocky rectangle)
      const septum = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, 1.05, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.42 })
      );
      septum.scale.set(0.7, 1.0, 2.8);
      septum.position.set(0, -0.32, 0.04);
      innerGroup.add(septum);

      const rbcCount = 120;
      const rbcGeo = new THREE.SphereGeometry(0.055, 10, 10);
      rbcGeo.scale(1, 0.45, 1);
      const sysStream = new THREE.InstancedMesh(
        rbcGeo,
        new THREE.MeshStandardMaterial({ color: 0xff2a55, emissive: 0x991b1b, emissiveIntensity: 0.55 }),
        rbcCount
      );
      const pulStream = new THREE.InstancedMesh(
        rbcGeo,
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.45 }),
        rbcCount
      );
      innerGroup.add(sysStream, pulStream);

      let phase = 0;
      updateFrame = (t, dt) => {
        const hr = paramsRef.current.heartRateBpm ?? 72;
        const radiusRatio = paramsRef.current.vesselRadiusRatio ?? 1.0;
        phase = (phase + dt * (hr / 60)) % 1.0;
        const sysPulse = phase < 0.32 ? Math.sin((phase / 0.32) * Math.PI) : 0;
        const atrPulse = phase > 0.78 ? Math.sin(((phase - 0.78) / 0.22) * Math.PI) : 0;

        leftVentricle.scale.set(0.85 * (1 - 0.14 * sysPulse), 1.35 * (1 - 0.09 * sysPulse), 0.85 * (1 - 0.14 * sysPulse));
        rightVentricle.scale.set(0.82 * (1 - 0.13 * sysPulse), 1.22 * (1 - 0.08 * sysPulse), 0.78 * (1 - 0.13 * sysPulse));
        leftAtrium.scale.setScalar(1 - 0.11 * atrPulse);
        rightAtrium.scale.setScalar(1 - 0.11 * atrPulse);
        aortaArch.scale.set(radiusRatio, 1 + 0.06 * sysPulse, radiusRatio);

        const speed = (hr / 60) * 0.65;
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

      const lobeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: lungMembraneTex,
        bumpMap: lungBump,
        bumpScale: 0.016,
        roughness: 0.28,
        transmission: 0.72,
        thickness: 0.85,
        transparent: true,
        opacity: 0.8,
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
      rootGroup.add(diaphragm);

      const gasCount = 110;
      const gasGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const o2Mesh = new THREE.InstancedMesh(gasGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), gasCount);
      const co2Mesh = new THREE.InstancedMesh(gasGeo, new THREE.MeshBasicMaterial({ color: 0xfb923c }), gasCount);
      innerGroup.add(o2Mesh, co2Mesh);

      updateFrame = (t) => {
        const rr = paramsRef.current.respirationRate ?? 15;
        const effort = paramsRef.current.diaphragmEffort ?? 50;
        const breath = 0.5 - 0.5 * Math.cos(2 * Math.PI * (rr / 60) * t);
        const amp = 0.08 + (effort / 100) * 0.22;

        rightLung.scale.set(0.88 * (1 + amp * breath), 1.42 * (1 + amp * 0.75 * breath), 0.78 * (1 + amp * breath));
        leftLung.scale.set(0.82 * (1 + amp * breath), 1.38 * (1 + amp * 0.75 * breath), 0.76 * (1 + amp * breath));
        diaphragm.position.y = -1.28 - breath * amp * 1.1;

        for (let i = 0; i < gasCount; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const u = ((i / gasCount) + t * (rr / 60) * 0.45) % 1;
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

      const somaMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: neuronMembraneTex,
        bumpMap: neuronBump,
        bumpScale: 0.018,
        roughness: 0.32,
        clearcoat: 0.65,
        transmission: 0.18,
        transparent: true,
        opacity: 1.0,
      });
      const myelinMat = new THREE.MeshPhysicalMaterial({
        color: 0xfacc15, roughness: 0.28, clearcoat: 0.55, transmission: 0.35, transparent: true, opacity: 0.92,
      });
      outerMaterials.push(somaMat, myelinMat);

      const soma = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 3), somaMat);
      soma.position.set(-2.1, 0, 0);
      rootGroup.add(soma);

      const nucleus = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 })
      );
      nucleus.position.set(-2.1, 0, 0);
      innerGroup.add(nucleus);

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

      // Rounded Schwann capsule myelin sheaths separated by Ranvier nodes
      const myelinSegments: THREE.Mesh[] = [];
      for (let s = 0; s < 4; s++) {
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.44, 8, 20), myelinMat);
        seg.rotation.z = Math.PI / 2;
        seg.position.set(-1.05 + s * 0.88, 0, 0);
        seg.castShadow = true;
        myelinSegments.push(seg);
        rootGroup.add(seg);
      }

      const bouton = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), somaMat);
      bouton.scale.set(1.2, 0.95, 0.95);
      bouton.position.set(2.25, 0, 0);
      rootGroup.add(bouton);

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

      updateFrame = (t) => {
        const stim = paramsRef.current.stimulusVoltageMv ?? -35;
        const myelin = paramsRef.current.myelinThickness ?? 75;
        const fired = stim >= -55;
        const scaleMyelin = 0.45 + (myelin / 100) * 0.75;
        myelinSegments.forEach((seg) => seg.scale.set(scaleMyelin, 1, scaleMyelin));

        if (fired) {
          const speed = 0.8 + (myelin / 100) * 1.8;
          const u = (t * speed) % 1;
          pulseRing.visible = true;
          pulseRing.position.set(-1.6 + u * 3.85, Math.abs(Math.sin(u * Math.PI * 4)) * (0.06 + (myelin / 100) * 0.14), 0);
        } else {
          pulseRing.visible = false;
        }

        for (let i = 0; i < ntCount; i++) {
          const prog = fired ? ((t * 1.4 + i / ntCount) % 1) : 0.05;
          dummy.position.set(2.45 + prog * 0.85, Math.sin(i * 2.1 + t * 3) * 0.35 * prog, Math.cos(i * 1.7 + t * 2) * 0.35 * prog);
          dummy.scale.setScalar(fired ? 1 : 0.35);
          dummy.updateMatrix();
          ntMesh.setMatrixAt(i, dummy.matrix);
        }
        ntMesh.instanceMatrix.needsUpdate = true;
      };
    }

    const clock = new THREE.Clock();
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05) * (playingRef.current ? timeScaleRef.current : 0);
      const elapsed = clock.getElapsedTime();

      const lm = layerModeRef.current;
      outerMaterials.forEach((mat) => {
        if (lm === 'xray') {
          mat.opacity = 0.25; mat.transmission = 0.85; mat.depthWrite = false;
        } else if (lm === 'cross-section') {
          mat.opacity = 0.55; mat.transmission = 0.45; mat.depthWrite = true;
        } else {
          mat.opacity = mode === 'anatomy-respiratory-lungs' ? 0.78 : 1.0;
          mat.transmission = mode === 'anatomy-respiratory-lungs' ? 0.75 : 0.12;
          mat.depthWrite = true;
        }
      });
      rootGroup.scale.z = lm === 'cross-section' ? 0.55 : 1.0;

      pinMeshes.forEach(({ halo }, idx) => {
        halo.lookAt(camera.position);
        halo.scale.setScalar(1 + 0.18 * Math.sin(elapsed * 3.5 + idx));
      });

      if (cameraLerpRef.current.active) {
        cameraLerpRef.current.active = smoothCameraTransition(
          camera,
          controls,
          cameraLerpRef.current.pos,
          cameraLerpRef.current.target,
          0.1
        );
      }

      updateFrame(elapsed, dt);
      controls.update();

      const showLabels = showConceptLabelsRef.current;
      const cw = container.clientWidth || width;
      const ch = container.clientHeight || height;
      const cDom = conceptDomRef.current;
      const pCur = paramsRef.current;
      const cEntries = [
        { dom: cDom.c1, worldPos: new THREE.Vector3(), text: '', active: false },
        { dom: cDom.c2, worldPos: new THREE.Vector3(), text: '', active: false },
        { dom: cDom.c3, worldPos: new THREE.Vector3(), text: '', active: false },
      ];

      if (mode === 'anatomy-cardiovascular-heart') {
        if (heartO2Arrow) heartO2Arrow.visible = showLabels;
        if (heartCo2Arrow) heartCo2Arrow.visible = showLabels;
        if (showLabels) {
          const hm = evalHeart(pCur);
          cEntries[0] = {
            dom: cDom.c1,
            worldPos: new THREE.Vector3(1.15, 1.35, 0.2),
            text: `Aorta · Darah Kaya O₂ ↑`,
            active: true,
          };
          cEntries[1] = {
            dom: cDom.c2,
            worldPos: new THREE.Vector3(-0.85, 1.5, 0),
            text: `Vena & Pulmonal · CO₂ ↓`,
            active: true,
          };
          cEntries[2] = {
            dom: cDom.c3,
            worldPos: new THREE.Vector3(0.42, -0.5, 0.45),
            text: `MAP ${hm.meanArterialPressure} mmHg · HR ${Math.round(pCur.heartRateBpm ?? 72)} bpm`,
            active: true,
          };
        }
      } else if (mode === 'anatomy-respiratory-lungs') {
        const rr = pCur.respirationRate ?? 15;
        const inhaling = Math.sin(2 * Math.PI * (rr / 60) * elapsed) >= 0;
        if (lungAirArrow) {
          lungAirArrow.visible = showLabels;
          lungAirArrow.setDirection(new THREE.Vector3(0, inhaling ? -1 : 1, 0));
          lungAirArrow.setColor(inhaling ? 0x38bdf8 : 0xfb923c);
          lungAirArrow.position.set(0.36, inhaling ? 1.95 : 1.15, 0.1);
        }
        if (lungDiaphArrow) {
          lungDiaphArrow.visible = showLabels;
          lungDiaphArrow.setDirection(new THREE.Vector3(0, inhaling ? -1 : 1, 0));
        }
        if (showLabels) {
          const lm = calculateRespiratoryLungs({
            respirationRate: rr,
            diaphragmEffort: pCur.diaphragmEffort ?? 50,
            airwayResistance: pCur.airwayResistance ?? 1.0,
            altitudeMeters: pCur.altitudeMeters ?? 0,
            timeSec: elapsed,
          });
          cEntries[1] = {
            dom: cDom.c2,
            worldPos: new THREE.Vector3(0.15, 1.85, 0.1),
            text: inhaling ? `Inspirasi: O₂ Masuk ↓` : `Ekspirasi: CO₂ Keluar ↑`,
            active: true,
          };
          cEntries[2] = {
            dom: cDom.c3,
            worldPos: new THREE.Vector3(1.1, 0.35, 0.35),
            text: `Alveolus · SpO₂ ${lm.spo2Percent}%`,
            active: true,
          };
          cEntries[0] = {
            dom: cDom.c1,
            worldPos: new THREE.Vector3(0, -1.25, 0.35),
            text: `Diafragma (Hukum Boyle)`,
            active: true,
          };
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
            timeSec: elapsed,
          });
          cEntries[0] = {
            dom: cDom.c1,
            worldPos: new THREE.Vector3(-2.1, 0.85, 0),
            text: `Soma · Stimulus ${stim} mV`,
            active: true,
          };
          cEntries[1] = {
            dom: cDom.c2,
            worldPos: new THREE.Vector3(0.1, 0.55, 0),
            text: fired
              ? `Impuls Saltatorik → (${nm.conductionVelocityMs} m/s)`
              : `Di Bawah Ambang (-55 mV)`,
            active: true,
          };
          cEntries[2] = {
            dom: cDom.c3,
            worldPos: new THREE.Vector3(2.25, 0.65, 0),
            text: `Sinapsis Terminal`,
            active: true,
          };
        }
      }
      updateProjectedConceptLabels(cEntries, camera, cw, ch, showLabels, conceptProjVec);

      studioComposer.render();
    };
    animate();

    let lastW = width;
    let lastH = height;
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 460;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      const pr = renderer.getPixelRatio();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      studioComposer.resize(w, h, pr);
      studioComposer.render();
    };
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onPointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleWebGLContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', handleWebGLContextRestored, false);
      controls.dispose();
      studioComposer.dispose();
      disposableBioTextures.forEach((tex) => tex.dispose());
      disposeThreeSceneResources(scene, renderer, envTexture);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [mode, sceneKey]);

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 select-none">
      <div ref={mountRef} data-testid="anatomy-simulation-canvas" className="w-full h-full min-h-[420px]" />

      <ConceptLabelsLayer
        slots={[
          { id: 'c1', accentHex: '#f43f5e' },
          { id: 'c2', accentHex: '#38bdf8' },
          { id: 'c3', accentHex: '#4ade80' },
        ]}
        visible={showConceptLabels}
        onBindSlot={bindConceptSlot}
      />

      {/* Top HUD: X-Ray & Cross-Section Layer Toggle */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-lg">
          {([
            { id: 'outer', label: 'Lapisan Luar', Icon: Eye, activeBg: 'bg-rose-600' },
            { id: 'xray', label: 'Mode X-Ray Transparan', Icon: Sparkles, activeBg: 'bg-cyan-600' },
            { id: 'cross-section', label: 'Penampang Dalam', Icon: Layers, activeBg: 'bg-indigo-600' },
          ] as const).map(({ id, label, Icon, activeBg }) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayerMode(id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                layerMode === id ? `${activeBg} text-white shadow-sm` : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Interactive Anatomical Pins Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-lg">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 px-1.5">
            Pin Anatomi 3D:
          </span>
          {activePins.map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => handleSelectPin(pin)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedPinId === pin.id
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/90 text-cyan-200 hover:bg-slate-700'
              }`}
            >
              [{pin.num}] {pin.name.split(' ')[0]}
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px bg-slate-700/80" aria-hidden="true" />
          <ConceptLabelToggleButton accentClass="bg-cyan-500 text-slate-950 font-bold" />
        </div>
      </div>

      {/* Floating Anatomical Pin Info Card */}
      {selectedPin && (
        <div className="absolute bottom-16 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 rounded-xl p-3.5 text-slate-100 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span className="inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-1">
                Pin #{selectedPin.num} • Inspeksi Organ 3D
              </span>
              <h4 className="text-sm font-bold text-white leading-tight">{selectedPin.name}</h4>
              <p className="text-[11px] text-cyan-300/90">{selectedPin.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPinId(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Tutup kartu pin"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-2.5">{selectedPin.description}</p>
          <div className="space-y-1.5 border-t border-slate-800 pt-2">
            {selectedPin.getLiveMetrics(params).map((m) => (
              <div key={m.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{m.label}</span>
                <span className="font-mono font-semibold text-cyan-300">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnatomySubScene3D;
