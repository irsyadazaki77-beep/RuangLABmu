import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Maximize2, Minimize2 } from 'lucide-react';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { labSound } from '../utils/soundEngine';
import { Scene3DTelemetryHUD } from './ui/ScientificEnhancementSuite';
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';

interface BiologyScene3DProps {
  mode:
    | 'photosynthesis-ingenhousz'
    | 'enzyme-catalase'
    | 'enzyme-kinetics'
    | 'osmosis-plasmolysis'
    | 'cell-osmosis-tonicity'
    | 'predator-prey-dynamics';
  params: Record<string, number>;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    position: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  isPlaying?: boolean;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
  comfortTheme?: ComfortThemeMode;
}

type BioCameraPreset = 'isometric' | 'front' | 'top' | 'focus';

function wavelengthToHexColor(wavelengthNm: number): number {
  if (wavelengthNm < 440) return 0x7c3aed; // Violet
  if (wavelengthNm < 490) return 0x2563eb; // Blue
  if (wavelengthNm < 560) return 0x16a34a; // Green
  if (wavelengthNm < 600) return 0xeab308; // Yellow
  if (wavelengthNm < 640) return 0xf97316; // Orange
  return 0xdc2626; // Red
}

export const BiologyScene3D: React.FC<BiologyScene3DProps> = ({
  mode,
  params,
  remoteCursors = {},
  onEmitCursor,
  onCaptureSnapshot,
  snapshotCount = 0,
  comfortTheme,
}) => {
  const storeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const activeComfortTheme = comfortTheme ?? storeComfortTheme;
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Biologi');

  const mountRef = useRef<HTMLDivElement>(null);
  const cursorManagerRef = useRef<SpatialCursorManager | null>(null);
  const onEmitCursorRef = useRef(onEmitCursor);
  onEmitCursorRef.current = onEmitCursor;
  const onCaptureSnapshotRef = useRef(onCaptureSnapshot);
  onCaptureSnapshotRef.current = onCaptureSnapshot;
  const [activePreset, setActivePreset] = useState<BioCameraPreset>('isometric');
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);

  const cameraCtrlRef = useRef<{
    setPreset: (preset: BioCameraPreset) => void;
    setOrbit: (orbit: boolean) => void;
    captureCanvas: () => string | null;
    applyTheme: (colors: ReturnType<typeof getSceneThemeColors>) => void;
  } | null>(null);

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
    window.addEventListener('ruanglab:capture-3d-snapshot', handleGlobalSnapshot);
    return () => window.removeEventListener('ruanglab:capture-3d-snapshot', handleGlobalSnapshot);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // Three.js Scene, Camera, Renderer
    const initialColors = getSceneThemeColors(activeComfortTheme, 'Biologi');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialColors.backgroundHex);
    scene.fog = new THREE.FogExp2(initialColors.fogHex, 0.02);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.8, 3.8, 7.2);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 1.4;
    controls.target.set(0, 1.3, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2.8;
    controls.maxDistance = 20;

    let camTransitionActive = false;
    const desiredCamPos = new THREE.Vector3(2.8, 3.8, 7.2);
    const desiredTarget = new THREE.Vector3(0, 1.3, 0);

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    const applyCameraPreset = (preset: BioCameraPreset) => {
      if (preset === 'isometric') {
        desiredCamPos.set(2.8, 3.8, 7.2);
        desiredTarget.set(0, 1.3, 0);
      } else if (preset === 'front') {
        desiredCamPos.set(0, 2.0, 7.8);
        desiredTarget.set(0, 1.4, 0);
      } else if (preset === 'top') {
        desiredCamPos.set(0, 10.5, 0.5);
        desiredTarget.set(0, 0, 0);
      } else {
        desiredCamPos.set(1.2, 2.1, 4.2);
        desiredTarget.set(0, 1.3, 0);
      }
      camTransitionActive = true;
    };

    // Collaboration Cursor Group
    const cursorManager = new SpatialCursorManager(scene);
    cursorManagerRef.current = cursorManager;

    // Studio Lights
    const hemiLight = new THREE.HemisphereLight(
      initialColors.ambientSkyHex,
      initialColors.ambientGroundHex,
      initialColors.ambientIntensity
    );
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    dirLight.position.set(5, 8, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Laboratory Table Surface
    const tableGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.2, 32);
    const tableMat = new THREE.MeshStandardMaterial({
      color: initialColors.tableHex,
      roughness: 0.4,
      metalness: 0.1,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.1;
    tableMesh.receiveShadow = true;
    tableMesh.name = 'Meja Laboratorium Biologi';
    scene.add(tableMesh);

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      },
      applyTheme: (colors) => {
        scene.background = new THREE.Color(colors.backgroundHex);
        scene.fog = new THREE.FogExp2(colors.fogHex, 0.02);
        tableMat.color.setHex(colors.tableHex);
        hemiLight.color.setHex(colors.ambientSkyHex);
        hemiLight.groundColor.setHex(colors.ambientGroundHex);
        hemiLight.intensity = colors.ambientIntensity;
      },
    };

    // Grid Floor
    const grid = new THREE.GridHelper(9, 18, 0x38bdf8, 0x334155);
    grid.position.y = 0.01;
    scene.add(grid);

    // Container for dynamic apparatus meshes
    const apparatusGroup = new THREE.Group();
    scene.add(apparatusGroup);

    // Particle arrays
    const particles: THREE.Mesh[] = [];
    let lightSpot: THREE.SpotLight | null = null;
    let foamMesh: THREE.Mesh | null = null;
    let protoplastMesh: THREE.Mesh | null = null;

    // SETUP MODE 1: INGENHOUSZ PHOTOSYNTHESIS
    if (mode === 'photosynthesis-ingenhousz') {
      // 1. Glass Beaker
      const beakerGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 32, 1, true);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        transmission: 0.9,
        thickness: 0.5,
      });
      const beaker = new THREE.Mesh(beakerGeo, glassMat);
      beaker.position.y = 1.6;
      beaker.name = 'Gelas Beker Kaca 1000 mL';
      apparatusGroup.add(beaker);

      // Water inside beaker
      const waterGeo = new THREE.CylinderGeometry(1.48, 1.48, 2.8, 32);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.45,
        roughness: 0.2,
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.y = 1.4;
      water.name = 'Larutan Air & NaHCO₃';
      apparatusGroup.add(water);

      // 2. Inverted Glass Funnel
      const funnelConeGeo = new THREE.ConeGeometry(1.1, 1.2, 24, 1, true);
      const funnel = new THREE.Mesh(funnelConeGeo, glassMat);
      funnel.position.y = 0.7;
      funnel.rotation.x = Math.PI; // inverted
      funnel.name = '🎯 Corong Kaca & Tabung O₂';
      apparatusGroup.add(funnel);

      // Funnel Stem & Inverted Test Tube
      const tubeGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.8, 16);
      const tube = new THREE.Mesh(tubeGeo, glassMat);
      tube.position.y = 2.0;
      tube.name = '🎯 Tabung Reaksi Penampung Gas O₂';
      apparatusGroup.add(tube);

      // Gas bubble pocket at top of tube
      const gasPocketGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16);
      const gasPocketMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
      });
      const gasPocket = new THREE.Mesh(gasPocketGeo, gasPocketMat);
      gasPocket.position.y = 2.7;
      gasPocket.name = 'Ruang Gas O₂ Murni';
      apparatusGroup.add(gasPocket);

      // 3. Hydrilla Verticillata Plant
      const plantGroup = new THREE.Group();
      plantGroup.position.set(0, 0.2, 0);
      plantGroup.name = '🌱 Tanaman Hydrilla verticillata';

      const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const stem1 = new THREE.Mesh(stemGeo, stemMat);
      stem1.position.set(0, 0.5, 0);
      plantGroup.add(stem1);

      // Leaves whorls
      const leafGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 });
      for (let i = 0; i < 5; i++) {
        const y = 0.2 + i * 0.18;
        for (let j = 0; j < 4; j++) {
          const angle = (j * Math.PI) / 2 + (i * Math.PI) / 4;
          const leaf = new THREE.Mesh(leafGeo, leafMat);
          leaf.position.set(Math.cos(angle) * 0.12, y, Math.sin(angle) * 0.12);
          leaf.rotation.z = Math.cos(angle) * 0.7;
          leaf.rotation.x = -Math.sin(angle) * 0.7;
          plantGroup.add(leaf);
        }
      }
      apparatusGroup.add(plantGroup);

      // 4. Colored Spotlight source
      const lampGeo = new THREE.CylinderGeometry(0.3, 0.45, 0.5, 16);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(-3.2, 2.5, 0);
      lamp.rotation.z = -Math.PI / 3;
      lamp.name = '💡 Lampu Spektrum Variabel';
      apparatusGroup.add(lamp);

      const lightColor = wavelengthToHexColor(params.wavelengthNm || 660);
      lightSpot = new THREE.SpotLight(lightColor, (params.lightIntensityLux || 1200) / 300, 10, Math.PI / 4, 0.5);
      lightSpot.position.set(-3.2, 2.5, 0);
      lightSpot.target = plantGroup;
      scene.add(lightSpot);

      // 5. Rising Oxygen Bubbles
      const bubbleGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const bubbleMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1,
      });

      for (let i = 0; i < 35; i++) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat);
        b.position.set(
          (Math.random() - 0.5) * 0.4,
          0.3 + Math.random() * 2.4,
          (Math.random() - 0.5) * 0.4
        );
        b.userData = { speed: 0.015 + Math.random() * 0.025, seed: Math.random() * 10 };
        apparatusGroup.add(b);
        particles.push(b);
      }
    }

    // SETUP MODE 2: CATALASE ENZYME
    else if (mode === 'enzyme-catalase') {
      // Test Tube Rack
      const rackBase = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.15, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
      );
      rackBase.position.y = 0.08;
      rackBase.name = 'Rak Tabung Reaksi Kayu';
      apparatusGroup.add(rackBase);

      // Glass Reaction Tube
      const tubeGeo = new THREE.CylinderGeometry(0.55, 0.55, 3.2, 24, 1, true);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        transmission: 0.9,
      });
      const tube = new THREE.Mesh(tubeGeo, glassMat);
      tube.position.y = 1.7;
      tube.name = '🧪 Tabung Reaksi Reaksi Katalase';
      apparatusGroup.add(tube);

      // Substrate Liquid at base
      const liquidGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.6, 24);
      const liquidMat = new THREE.MeshStandardMaterial({
        color: 0xef4444, // Reddish enzyme extract
        transparent: true,
        opacity: 0.75,
      });
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = 0.4;
      liquid.name = 'Campuran Enzim & H₂O₂';
      apparatusGroup.add(liquid);

      // Dynamic Foam Column
      const foamGeo = new THREE.CylinderGeometry(0.53, 0.53, 1.2, 24);
      const foamMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        transparent: true,
        opacity: 0.88,
      });
      foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.position.y = 1.3;
      foamMesh.name = '🎯 Kolom Busa O₂ Berbusa';
      apparatusGroup.add(foamMesh);

      // Foam micro-bubbles
      const bubbleGeo = new THREE.SphereGeometry(0.06, 6, 6);
      const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.4 });
      for (let i = 0; i < 25; i++) {
        const b = new THREE.Mesh(bubbleGeo, bubbleMat);
        b.position.set(
          (Math.random() - 0.5) * 0.8,
          0.7 + Math.random() * 1.5,
          (Math.random() - 0.5) * 0.8
        );
        b.userData = { speed: 0.008 + Math.random() * 0.015, seed: Math.random() * 5 };
        apparatusGroup.add(b);
        particles.push(b);
      }
    }

    // SETUP MODE 3: OSMOSIS & PLASMOLYSIS
    else if (mode === 'osmosis-plasmolysis') {
      // Glass Chamber Petridish
      const petriGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.4, 32);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
      });
      const petri = new THREE.Mesh(petriGeo, glassMat);
      petri.position.y = 0.2;
      petri.name = 'Cawan Petri Larutan Sukrosa';
      apparatusGroup.add(petri);

      // Rigid Plant Cell Wall (Outer Frame)
      const wallFrameGeo = new THREE.BoxGeometry(2.2, 1.6, 1.4);
      const wallFrameMat = new THREE.MeshStandardMaterial({
        color: 0x166534, // Dark green cellulose wall
        wireframe: true,
      });
      const cellWall = new THREE.Mesh(wallFrameGeo, wallFrameMat);
      cellWall.position.y = 1.3;
      cellWall.name = '🧱 Dinding Selulosa Kaku';
      apparatusGroup.add(cellWall);

      // Inner Plasma Membrane & Protoplast (Dynamic Scale based on Turgor/Plasmolysis)
      const protoGeo = new THREE.BoxGeometry(2.1, 1.5, 1.3);
      const protoMat = new THREE.MeshStandardMaterial({
        color: 0x86efac, // Light green vacuole & cytoplasm
        transparent: true,
        opacity: 0.8,
        roughness: 0.3,
      });
      protoplastMesh = new THREE.Mesh(protoGeo, protoMat);
      protoplastMesh.position.y = 1.3;
      protoplastMesh.name = '🎯 Protoplas & Membran Sel Tumbuhan';
      apparatusGroup.add(protoplastMesh);

      // Solute particles (Amber dots) and Water molecules (Blue dots)
      const dotGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
      const soluteMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });

      for (let i = 0; i < 40; i++) {
        const isSolute = i % 3 === 0;
        const dot = new THREE.Mesh(dotGeo, isSolute ? soluteMat : waterMat);
        dot.position.set(
          (Math.random() - 0.5) * 3.8,
          0.3 + Math.random() * 1.8,
          (Math.random() - 0.5) * 3.8
        );
        dot.userData = {
          speedX: (Math.random() - 0.5) * 0.015,
          speedZ: (Math.random() - 0.5) * 0.015,
        };
        apparatusGroup.add(dot);
        particles.push(dot);
      }
    }

    // Raycaster for Pointermove & Laser pointer broadcast
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const handlePointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(apparatusGroup.children, true);

      let targetPos: [number, number, number] | null = null;
      let targetNormal: [number, number, number] | undefined = undefined;
      let hoveredName: string | undefined = undefined;

      if (intersects.length > 0) {
        const hit = intersects[0];
        targetPos = [hit.point.x, hit.point.y, hit.point.z];
        if (hit.face) {
          targetNormal = [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z];
        }
        hoveredName = hit.object.name || 'Peralatan Biologi 3D';
      } else {
        const hitPlane = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, hitPlane)) {
          targetPos = [hitPlane.x, hitPlane.y, hitPlane.z];
          targetNormal = [0, 1, 0];
          hoveredName = 'Meja Laboratorium';
        }
      }

      if (targetPos && onEmitCursorRef.current) {
        const now = performance.now();
        if (now - lastEmitTime >= 50) {
          onEmitCursorRef.current(targetPos, targetNormal, hoveredName);
          lastEmitTime = now;
        }
      }
    };

    let lastEmitTime = 0;
    renderer.domElement.addEventListener('mousemove', handlePointerMove);

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Slow gentle rotation for viewing angle
      apparatusGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.25;

      // Update particle motions
      if (mode === 'photosynthesis-ingenhousz') {
        const bubbleSpeed = (params.lightIntensityLux || 1200) / 60000;
        particles.forEach((p) => {
          p.position.y += p.userData.speed + bubbleSpeed;
          p.position.x += Math.sin(elapsed * 3 + p.userData.seed) * 0.002;
          if (p.position.y > 2.8) {
            p.position.y = 0.4;
            p.position.x = (Math.random() - 0.5) * 0.2;
            p.position.z = (Math.random() - 0.5) * 0.2;
          }
        });

        if (lightSpot) {
          const hex = wavelengthToHexColor(params.wavelengthNm || 660);
          lightSpot.color.setHex(hex);
        }
      } else if (mode === 'enzyme-catalase' && foamMesh) {
        // Scale foam column height based on substrate and pH
        const ph = params.solutionPH || 7.0;
        const phFactor = Math.max(0.1, 1.0 - Math.abs(ph - 7.0) * 0.15);
        const sub = (params.substrateConcMm || 10) / 25;
        const foamTarget = Math.min(2.0, 0.4 + sub * phFactor * 1.6);
        foamMesh.scale.y = foamTarget;
        foamMesh.position.y = 0.5 + (1.2 * foamTarget) / 2;

        particles.forEach((p) => {
          p.position.y += p.userData.speed;
          if (p.position.y > 2.6) p.position.y = 0.8;
        });
      } else if (mode === 'osmosis-plasmolysis' && protoplastMesh) {
        // Scale inner protoplast according to sucrose concentration
        const sucrose = params.sucroseConcMolar || 0.3;
        const shrinkage = Math.max(0.55, 1.0 - sucrose * 0.45);
        protoplastMesh.scale.set(shrinkage, shrinkage, shrinkage);

        particles.forEach((p) => {
          p.position.x += p.userData.speedX;
          p.position.z += p.userData.speedZ;
          if (Math.abs(p.position.x) > 2.0) p.userData.speedX *= -1;
          if (Math.abs(p.position.z) > 2.0) p.userData.speedZ *= -1;
        });
      }

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
    };

    animate();

    // Handle Window & Container Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth || 960;
      const h = container.clientHeight || window.innerHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      controls.dispose();

      if (cursorManagerRef.current) {
        cursorManagerRef.current.dispose();
      }

      // Deep Three.js disposal
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      if (envTexture) envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [mode]);

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

      {/* Top Camera Controls */}
      <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 rounded-full bg-slate-900/90 border border-white/15 px-3 py-1.5 shadow-2xl z-20">
        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mr-1">
          Kamera 3D:
        </span>
        {(
          [
            { id: 'isometric', label: 'Isometrik' },
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
            className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-full transition-colors cursor-pointer ${
              activePreset === preset.id
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* 3D Live Telemetry HUD & Snapshot / Orbit Bar */}
      <Scene3DTelemetryHUD
        domainTitle="Biologi"
        primaryLabel={
          mode === 'photosynthesis-ingenhousz'
            ? 'Intensitas Cahaya'
            : mode === 'enzyme-catalase'
            ? 'pH Larutan'
            : 'Konsentrasi Sukrosa'
        }
        primaryValue={
          mode === 'photosynthesis-ingenhousz'
            ? `${params.lightIntensityLux ?? 1200} lux`
            : mode === 'enzyme-catalase'
            ? `pH ${(params.solutionPH ?? 7.0).toFixed(1)}`
            : `${(params.sucroseConcMolar ?? 0.3).toFixed(2)} M`
        }
        secondaryLabel={
          mode === 'photosynthesis-ingenhousz'
            ? 'Spektrum λ'
            : mode === 'enzyme-catalase'
            ? 'Substrat H₂O₂'
            : 'Suhu Ruang'
        }
        secondaryValue={
          mode === 'photosynthesis-ingenhousz'
            ? `${params.wavelengthNm ?? 660} nm`
            : mode === 'enzyme-catalase'
            ? `${params.substrateConcMm ?? 10} mM`
            : `${params.temperatureC ?? 25} °C`
        }
        energyBarLabel="Aktivitas Biokimia & Seluler"
        energyBarRatio={
          mode === 'photosynthesis-ingenhousz'
            ? Math.min(95, ((params.lightIntensityLux ?? 1200) / 2500) * 100)
            : 68
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
              <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Kecilkan 3D</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-semibold">Layar Penuh 3D</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
