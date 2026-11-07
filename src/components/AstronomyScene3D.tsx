import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AstronomyParams,
  AstronomyMetrics,
  SolarPlanetPreset,
  SOLAR_PLANET_PRESETS,
} from '../utils/scienceEngine';
import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';
import { Maximize2, Minimize2 } from 'lucide-react';
import { labSound } from '../utils/soundEngine';

interface AstronomyScene3DProps {
  params: AstronomyParams;
  metrics: AstronomyMetrics;
  activePlanet: SolarPlanetPreset;
  simTime: number;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onUpdateParam?: (paramKey: string, value: number) => void;
}

type CameraPreset = 'isometric' | 'ecliptic' | 'top' | 'focus';

function createArrowGroup(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.2,
    emissive: colorHex,
    emissiveIntensity: 0.22,
  });
  const shaftGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 12);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.name = 'shaft';

  const headGeo = new THREE.ConeGeometry(0.16, 0.36, 14);
  headGeo.translate(0, 0.18, 0);
  const head = new THREE.Mesh(headGeo, mat);
  head.name = 'head';

  group.add(shaft, head);
  return group;
}

function orientAndScaleArrow(
  arrow: THREE.Group,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number
) {
  if (length < 0.08 || dir.lengthSq() < 1e-6) {
    arrow.visible = false;
    return;
  }
  arrow.visible = true;
  arrow.position.copy(origin);
  const normDir = dir.clone().normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normDir
  );
  arrow.quaternion.copy(quat);

  const shaft = arrow.getObjectByName('shaft') as THREE.Mesh;
  const head = arrow.getObjectByName('head') as THREE.Mesh;
  if (shaft && head) {
    const headLen = 0.36;
    const shaftLen = Math.max(0.01, length - headLen);
    shaft.scale.set(1, shaftLen, 1);
    head.position.set(0, shaftLen, 0);
  }
}

export const AstronomyScene3D: React.FC<AstronomyScene3DProps> = ({
  params,
  metrics,
  activePlanet,
  simTime,
  remoteCursors,
  onEmitCursor,
  onUpdateParam,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');
  const [dragToast, setDragToast] = useState<{ label: string; value: string } | null>(null);

  const latestRef = useRef({
    params,
    metrics,
    activePlanet,
    simTime,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
  });
  latestRef.current = {
    params,
    metrics,
    activePlanet,
    simTime,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 380;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.012);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
    camera.position.set(0, 9.5, 14.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.5;
    controls.maxDistance = 60;

    const applyCameraPreset = (presetName: CameraPreset) => {
      if (presetName === 'isometric') {
        camera.position.set(0, 9.5, 14.5);
        controls.target.set(0, 0, 0);
      } else if (presetName === 'ecliptic') {
        camera.position.set(0, 1.4, 15.8);
        controls.target.set(0, 0, 0);
      } else if (presetName === 'top') {
        camera.position.set(0, 19.5, 0.5);
        controls.target.set(0, 0, 0);
      } else {
        camera.position.set(2.5, 4.2, 8.6);
        controls.target.set(0, 0, 0);
      }
      controls.update();
    };
    cameraCtrlRef.current = { setPreset: applyCameraPreset };
    applyCameraPreset('isometric');

    // Deep space lighting
    scene.add(new THREE.AmbientLight(0x94a3b8, 0.45));
    const centralStarLight = new THREE.PointLight(0xfffbeb, 3.5, 90, 0.5);
    scene.add(centralStarLight);

    // Background 3D Starfield (800 stars)
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 55 + (i % 35);
      const theta = (i * 2.39996) % (Math.PI * 2);
      const phi = Math.acos(1 - (2 * (i + 0.5)) / starCount);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xe2e8f0, size: 0.22, transparent: true, opacity: 0.7 })
      )
    );

    const cursorManager = new SpatialCursorManager(scene);

    // =========================================================
    // 1. SOLAR KEPLER 3D GROUP
    // =========================================================
    const solarGroup = new THREE.Group();
    scene.add(solarGroup);

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    solarGroup.add(sunMesh);

    const sunCorona = new THREE.Mesh(
      new THREE.SphereGeometry(1.65, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.24 })
    );
    sunMesh.add(sunCorona);

    SOLAR_PLANET_PRESETS.slice(0, 8).forEach((pl) => {
      const refR = Math.min(8.6, Math.max(2.1, 2.0 + Math.log10(pl.semiMajorAxisAu + 0.7) * 4.2));
      const ringGeo = new THREE.RingGeometry(refR - 0.02, refR + 0.02, 64);
      ringGeo.rotateX(-Math.PI / 2);
      solarGroup.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })));
    });

    const orbitGeo = new THREE.BufferGeometry();
    const orbitPositions = new Float32Array(96 * 3);
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    const orbitLine = new THREE.LineLoop(orbitGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
    solarGroup.add(orbitLine);

    const planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 28, 28),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 })
    );
    planetMesh.userData = { draggableParam: 'customSemiMajorAxisAu', min: 0.4, max: 30.0, step: 0.5, label: 'Sumbu Semi-Mayor a (AU)' };
    solarGroup.add(planetMesh);

    // =========================================================
    // 2. MILKY WAY ROTATION & DARK MATTER 3D GROUP
    // =========================================================
    const milkyWayGroup = new THREE.Group();
    scene.add(milkyWayGroup);

    // Galaxy core Sgr A*
    const sgrABulge = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    milkyWayGroup.add(sgrABulge);

    // Spiral Arms Particle Disk (1200 particles)
    const GALAXY_PARTICLES = 1200;
    const diskPositions = new Float32Array(GALAXY_PARTICLES * 3);
    for (let i = 0; i < GALAXY_PARTICLES; i++) {
      const r = 1.2 + Math.pow(Math.random(), 1.5) * 8.5;
      const arm = (i % 2) * Math.PI;
      const spiralTheta = arm + r * 0.9 + (Math.random() - 0.5) * 0.5;
      diskPositions[i * 3] = r * Math.cos(spiralTheta);
      diskPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.4 * Math.exp(-r / 4);
      diskPositions[i * 3 + 2] = r * Math.sin(spiralTheta);
    }
    const diskGeo = new THREE.BufferGeometry();
    diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPositions, 3));
    const diskParticles = new THREE.Points(
      diskGeo,
      new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.16, transparent: true, opacity: 0.75 })
    );
    milkyWayGroup.add(diskParticles);

    // Marker Star in Galaxy Disk (e.g. Solar System radius)
    const galacticMarkerStar = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    galacticMarkerStar.userData = { draggableParam: 'galactocentricRadiusKpc', min: 1.0, max: 25.0, step: 0.5, label: 'Radius Galaksi R (kpc)' };
    milkyWayGroup.add(galacticMarkerStar);

    // =========================================================
    // 3. STELLAR WIEN SPECTRUM & DISPERSION PRISM 3D GROUP
    // =========================================================
    const wienGroup = new THREE.Group();
    scene.add(wienGroup);

    // Glowing blackbody Star Sphere
    const wienStarMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const wienStar = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 32), wienStarMat);
    wienStar.position.set(-4.5, 0, 0);
    wienStar.userData = { draggableParam: 'starEffectiveTempK', min: 2500, max: 35000, step: 250, label: 'Suhu Fotosfer T (K)' };
    wienGroup.add(wienStar);

    const wienCorona = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.28 })
    );
    wienStar.add(wienCorona);

    // 3D Glass Dispersion Prism
    const prismGeo = new THREE.CylinderGeometry(0.9, 0.9, 2.2, 3);
    prismGeo.rotateX(Math.PI / 2);
    const prismMesh = new THREE.Mesh(
      prismGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, transmission: 0.95, roughness: 0.05 })
    );
    prismMesh.position.set(-0.5, 0, 0);
    wienGroup.add(prismMesh);

    // Collimated ray from star to prism
    const starlightBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.0, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    starlightBeam.rotation.z = Math.PI / 2;
    starlightBeam.position.set(-2.5, 0, 0);
    wienGroup.add(starlightBeam);

    // Projected Rainbow Spectrum Band Screen
    const spectrumCanvas = document.createElement('canvas');
    spectrumCanvas.width = 512;
    spectrumCanvas.height = 128;
    const spectrumTexture = new THREE.CanvasTexture(spectrumCanvas);
    const spectrumScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.8),
      new THREE.MeshBasicMaterial({ map: spectrumTexture, side: THREE.DoubleSide })
    );
    spectrumScreen.position.set(3.8, 0, 0);
    wienGroup.add(spectrumScreen);

    // =========================================================
    // 4. HUBBLE EXPANSION & COSMIC REDSHIFT 3D GROUP
    // =========================================================
    const hubbleGroup = new THREE.Group();
    scene.add(hubbleGroup);

    // Expanding Cosmic Web grid
    const cosmicGrid = new THREE.GridHelper(30, 20, 0x1e293b, 0x0f172a);
    cosmicGrid.position.y = -2.5;
    hubbleGroup.add(cosmicGrid);

    // Milky Way Observer at center
    const mwObserver = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    mwObserver.position.set(0, 0, 0);
    hubbleGroup.add(mwObserver);

    // 4 Distant Spiral Galaxies receding radially
    const GALAXY_COUNT = 4;
    const distantGalaxies: { mesh: THREE.Mesh; arrow: THREE.Group; baseAngle: number }[] = [];
    for (let i = 0; i < GALAXY_COUNT; i++) {
      const gMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 0.1, 20),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
      );
      gMesh.rotation.x = 0.4;
      gMesh.userData = { draggableParam: 'galaxyDistanceMpc', min: 20, max: 600, step: 20, label: 'Jarak Galaksi d (Mpc)' };
      hubbleGroup.add(gMesh);

      const arrow = createArrowGroup(0xef4444);
      hubbleGroup.add(arrow);

      distantGalaxies.push({ mesh: gMesh, arrow, baseAngle: (i * Math.PI * 2) / GALAXY_COUNT });
    }

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

      const { params: p, metrics: m, simTime: t } = latestRef.current;

      solarGroup.visible = p.mode === 'solar-kepler';
      milkyWayGroup.visible = p.mode === 'milkyway-galaxy' || (p.mode as string) === 'milky-way-rotation';
      wienGroup.visible = p.mode === 'stellar-wien-spectrum' || p.mode === 'stellar-exoplanet' || (p.mode as string) === 'exoplanet-transit';
      hubbleGroup.visible = p.mode === 'hubble-expansion';

      // 1. Kepler Orbit
      if (p.mode === 'solar-kepler') {
        const a = p.customSemiMajorAxisAu || 1.0;
        const e = p.customEccentricity ?? 0.017;
        const b = a * Math.sqrt(Math.max(0.01, 1 - e * e));
        const c = a * e;

        // Render elliptical orbit path
        const posAttr = orbitGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < 96; i++) {
          const theta = (i / 96) * Math.PI * 2;
          const x = a * Math.cos(theta) - c;
          const z = b * Math.sin(theta);
          const scaledR = Math.min(8.6, 2.0 + Math.log10(Math.max(0.2, a)) * 3.5);
          posAttr.setXYZ(i, (x / a) * scaledR, 0, (z / b) * scaledR);
        }
        posAttr.needsUpdate = true;

        const meanMotion = (Math.PI * 2) / Math.max(0.5, m.orbitalPeriodYears);
        const curM = (t * meanMotion) % (Math.PI * 2);
        const curX = a * Math.cos(curM) - c;
        const curZ = b * Math.sin(curM);
        const scaledR = Math.min(8.6, 2.0 + Math.log10(Math.max(0.2, a)) * 3.5);
        planetMesh.position.set((curX / a) * scaledR, 0, (curZ / b) * scaledR);
      }

      // 2. Milky Way Galaxy
      else if (p.mode === 'milkyway-galaxy' || (p.mode as string) === 'milky-way-rotation') {
        diskParticles.rotation.y += 0.002;
        const rKpc = p.galactocentricRadiusKpc || 8.2;
        const rScaled = Math.min(8.5, Math.max(1.2, (rKpc / 25.0) * 8.5));
        const angle = t * 0.15;
        galacticMarkerStar.position.set(rScaled * Math.cos(angle), 0, rScaled * Math.sin(angle));
      }

      // 3. Wien Spectrum
      else if (p.mode === 'stellar-wien-spectrum' || p.mode === 'stellar-exoplanet' || (p.mode as string) === 'exoplanet-transit') {
        wienStarMat.color.setStyle(m.starColorHex);
        (wienCorona.material as THREE.MeshBasicMaterial).color.setStyle(m.starColorHex);

        // Render dynamic rainbow spectrum with absorption dark lines on canvas
        const sCtx = spectrumCanvas.getContext('2d');
        if (sCtx) {
          const grad = sCtx.createLinearGradient(0, 0, spectrumCanvas.width, 0);
          grad.addColorStop(0, '#7c3aed'); // violet ~400nm
          grad.addColorStop(0.2, '#2563eb'); // blue ~470nm
          grad.addColorStop(0.4, '#10b981'); // green ~530nm
          grad.addColorStop(0.65, '#facc15'); // yellow ~580nm
          grad.addColorStop(0.85, '#f97316'); // orange ~620nm
          grad.addColorStop(1.0, '#ef4444'); // red ~700nm
          sCtx.fillStyle = grad;
          sCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);

          // Draw Fraunhofer dark absorption lines
          sCtx.fillStyle = '#050811';
          const peakLambda = m.wienPeakWavelengthNm ?? 500;
          const peakX = ((peakLambda - 380) / (720 - 380)) * spectrumCanvas.width;
          sCtx.fillRect(Math.max(10, Math.min(spectrumCanvas.width - 15, peakX - 2)), 0, 4, spectrumCanvas.height);
          sCtx.fillRect(Math.max(10, Math.min(spectrumCanvas.width - 15, peakX + 45)), 0, 2, spectrumCanvas.height);
          sCtx.fillRect(Math.max(10, Math.min(spectrumCanvas.width - 15, peakX - 35)), 0, 3, spectrumCanvas.height);
          spectrumTexture.needsUpdate = true;
        }
      }

      // 4. Hubble Expansion
      else if (p.mode === 'hubble-expansion') {
        const dMpc = p.galaxyDistanceMpc ?? 150;
        const dScale = Math.min(10.5, Math.max(2.5, (dMpc / 600) * 10.5));
        const recVel = m.hubbleRecessionVelocityKmS ?? 10500;
        const arrowLen = Math.min(3.2, (recVel / 42000) * 3.2);

        distantGalaxies.forEach((dg, idx) => {
          const ang = dg.baseAngle + idx * 0.1;
          const gx = dScale * Math.cos(ang);
          const gz = dScale * Math.sin(ang);
          dg.mesh.position.set(gx, 0, gz);
          orientAndScaleArrow(
            dg.arrow,
            new THREE.Vector3(gx, 0, gz),
            new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)),
            arrowLen
          );
        });
      }

      cursorManager.update(
        latestRef.current.remoteCursors || {},
        camera.position
      );

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
      className={`relative w-full h-full overflow-hidden bg-[#050811] touch-none select-none ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
      }`}
    >
      <div
        ref={mountRef}
        data-testid="astronomy-simulation-canvas"
        className="w-full h-full block touch-none"
      />

      {/* Interactive Raycaster Drag Toast */}
      {dragToast && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full backdrop-blur-xl bg-sky-950/90 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 animate-pulse text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel Astronomi 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
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
            { id: 'ecliptic', label: 'Ekliptika' },
            { id: 'top', label: 'Atas' },
            { id: 'focus', label: 'Fokus' },
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

      {/* Top-Right Fullscreen Toggle Button */}
      <div className="pointer-events-auto absolute top-4 right-4 z-30">
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-xl bg-slate-900/80 hover:bg-slate-800 border border-white/20 text-xs font-mono text-white shadow-2xl transition-all cursor-pointer"
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
