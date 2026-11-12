import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createPlanetSurfaceTexture,
  createStudioComposer,
  disposeThreeSceneResources,
} from '../utils/threeStudioKit';
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
import { ComfortThemeMode, getSceneThemeColors } from './ui/VisualComfortToolbar';
import { useUIStore } from '../stores/useUIStore';
import { LAB_EVENTS, subscribeLabEvent } from '../utils/labEventBus';

interface AstronomyScene3DProps {
  params: AstronomyParams;
  metrics: AstronomyMetrics;
  activePlanet?: SolarPlanetPreset;
  simTime?: number;
  remoteCursors?: Record<string, SpatialCursorPayload>;
  onEmitCursor?: (
    pos: [number, number, number],
    normal?: [number, number, number],
    hoveredObject?: string
  ) => void;
  onUpdateParam?: (paramKey: string, value: number) => void;
  onPlanetClick?: (planetName: string) => void;
  onCaptureSnapshot?: (dataUrl: string) => void;
  snapshotCount?: number;
  comfortTheme?: ComfortThemeMode;
}

type CameraPreset = 'isometric' | 'ecliptic' | 'top' | 'focus';

function createSolarPhotosphereTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#fef08a');
    grad.addColorStop(1, '#ea580c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Solar granulation cells & sunspots
    for (let i = 0; i < 220; i++) {
      const x = (i * 73) % 256;
      const y = (i * 41) % 128;
      const r = 3 + (i % 9);
      ctx.fillStyle = i % 7 === 0 ? 'rgba(180, 83, 9, 0.35)' : 'rgba(255, 251, 235, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createFresnelCoronaMaterial(
  coreHex = 0xfef08a,
  rimHex = 0xf97316
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoreColor: { value: new THREE.Color(coreHex) },
      uRimColor: { value: new THREE.Color(rimHex) },
      uIntensity: { value: 1.45 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        float flare = sin(position.x * 4.5 + uTime * 2.2) * cos(position.y * 4.5 - uTime * 1.8) * 0.035;
        vec3 displaced = position + normal * flare;
        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        float viewDot = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float fresnel = pow(1.0 - viewDot, 2.4);
        float pulse = 0.88 + 0.12 * sin(uTime * 3.0 + vLocalPos.y * 3.0);
        vec3 glowColor = mix(uCoreColor, uRimColor, fresnel) * uIntensity * pulse;
        float alpha = clamp(fresnel * 0.85 + 0.12, 0.0, 0.92);
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
}

function createArrowGroup(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.2,
    emissive: colorHex,
    emissiveIntensity: 0.35,
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
  onPlanetClick,
  onCaptureSnapshot,
  snapshotCount = 0,
  comfortTheme,
}) => {
  const storeComfortTheme = useUIStore((s) => s.comfortPrefs.theme);
  const activeComfortTheme = comfortTheme ?? storeComfortTheme;
  const themeColors = getSceneThemeColors(activeComfortTheme, 'Astronomi');

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
    onPlanetClick,
    onCaptureSnapshot,
  });
  latestRef.current = {
    params,
    metrics,
    activePlanet,
    simTime,
    remoteCursors,
    onEmitCursor,
    onUpdateParam,
    onPlanetClick,
    onCaptureSnapshot,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
    setOrbit: (orbit: boolean) => void;
    captureCanvas: () => string | null;
    applyTheme: (colors: ReturnType<typeof getSceneThemeColors>) => void;
  } | null>(null);

  useEffect(() => {
    cameraCtrlRef.current?.applyTheme(getSceneThemeColors(activeComfortTheme, 'Astronomi'));
  }, [activeComfortTheme]);

  useEffect(() => {
    const handleGlobalSnapshot = () => {
      if (latestRef.current.onCaptureSnapshot && cameraCtrlRef.current) {
        const url = cameraCtrlRef.current.captureCanvas();
        if (url) latestRef.current.onCaptureSnapshot(url);
      }
    };
    return subscribeLabEvent(LAB_EVENTS.CAPTURE_SNAPSHOT, handleGlobalSnapshot);
  }, []);

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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(glRenderer);

    const initialColors = getSceneThemeColors(activeComfortTheme, 'Astronomi');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.008);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
    camera.position.set(0, 9.5, 14.5);

    // Post-Processing Pipeline: Hardware MSAA + Balanced Solar Bloom + ACES OutputPass
    const studioComposer = createStudioComposer(
      renderer,
      scene,
      camera,
      width,
      height,
      isSoftwareGl,
      { strength: 0.14, radius: 0.25, threshold: 1.15 }
    );
    const { composer } = studioComposer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 1.2;
    controls.minDistance = 3.5;
    controls.maxDistance = 60;

    let camTransitionActive = false;
    const desiredCamPos = new THREE.Vector3(0, 9.5, 14.5);
    const desiredTarget = new THREE.Vector3(0, 0, 0);

    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    const applyCameraPreset = (presetName: CameraPreset) => {
      if (presetName === 'isometric') {
        desiredCamPos.set(0, 9.5, 14.5);
        desiredTarget.set(0, 0, 0);
      } else if (presetName === 'ecliptic') {
        desiredCamPos.set(0, 1.4, 15.8);
        desiredTarget.set(0, 0, 0);
      } else if (presetName === 'top') {
        desiredCamPos.set(0, 19.5, 0.5);
        desiredTarget.set(0, 0, 0);
      } else {
        desiredCamPos.set(2.5, 4.2, 8.6);
        desiredTarget.set(0, 0, 0);
      }
      camTransitionActive = true;
    };

    // Deep space lighting + High-Intensity Quadratic Decay PointLight + Soft Shadow Directional KeyLight
    const ambientLight = new THREE.AmbientLight(
      initialColors.ambientSkyHex,
      initialColors.ambientIntensity
    );
    scene.add(ambientLight);

    // High-intensity quadratic decay PointLight (decay = 2) at Sun center
    const centralStarLight = new THREE.PointLight(0xfffbeb, 65.0, 140, 2.0);
    centralStarLight.position.set(0, 0, 0);
    scene.add(centralStarLight);

    // Key DirectionalLight with 2048x2048 PCFSoftShadowMap & bias -0.0001
    const astroKeyLight = new THREE.DirectionalLight(0xfff7ed, 1.5);
    astroKeyLight.position.set(8, 14, 10);
    astroKeyLight.castShadow = true;
    astroKeyLight.shadow.mapSize.width = 2048;
    astroKeyLight.shadow.mapSize.height = 2048;
    astroKeyLight.shadow.camera.near = 0.5;
    astroKeyLight.shadow.camera.far = 50;
    const shadowBound = 12;
    astroKeyLight.shadow.camera.left = -shadowBound;
    astroKeyLight.shadow.camera.right = shadowBound;
    astroKeyLight.shadow.camera.top = shadowBound;
    astroKeyLight.shadow.camera.bottom = -shadowBound;
    astroKeyLight.shadow.bias = -0.0001;
    astroKeyLight.shadow.normalBias = 0.02;
    scene.add(astroKeyLight);

    cameraCtrlRef.current = {
      setPreset: applyCameraPreset,
      setOrbit: (orbit: boolean) => {
        controls.autoRotate = orbit;
      },
      captureCanvas: () => {
        composer.render();
        return renderer.domElement.toDataURL('image/png');
      },
      applyTheme: (colors) => {
        scene.background = new THREE.Color(0x0b0f17);
        scene.fog = new THREE.FogExp2(0x0b0f17, 0.008);
        ambientLight.color.setHex(colors.ambientSkyHex);
        ambientLight.intensity = Math.min(0.45, colors.ambientIntensity);
      },
    };

    // =========================================================
    // MULTI-LAYER PARALLAX STARFIELD WITH SPECTRAL COLORS
    // =========================================================
    const spectralPalette = [
      new THREE.Color(0x93c5fd), // O/B Blue-white star
      new THREE.Color(0xf8fafc), // A/F Pure white star
      new THREE.Color(0xfde047), // G/K Warm yellow-gold star
      new THREE.Color(0xfca5a5), // M Dim red dwarf star
    ];

    const createStarfieldLayer = (count: number, minR: number, maxR: number, pointSize: number) => {
      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = minR + ((i * 17.37) % (maxR - minR));
        const theta = (i * 2.3999632) % (Math.PI * 2);
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const c = spectralPalette[i % spectralPalette.length];
        const brightness = 0.72 + ((i * 13) % 28) / 100;
        cols[i * 3] = c.r * brightness;
        cols[i * 3 + 1] = c.g * brightness;
        cols[i * 3 + 2] = c.b * brightness;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const mat = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        sizeAttenuation: true,
      });
      return new THREE.Points(geo, mat);
    };

    const nearStarLayer = createStarfieldLayer(500, 35, 65, 0.28);
    const deepStarLayer = createStarfieldLayer(900, 68, 125, 0.18);
    scene.add(nearStarLayer, deepStarLayer);

    const cursorManager = new SpatialCursorManager(scene);

    // =========================================================
    // 1. SOLAR KEPLER 3D GROUP (DYNAMIC SUN + ASTEROID BELT)
    // =========================================================
    const solarGroup = new THREE.Group();
    scene.add(solarGroup);

    const sunPhotosphereTex = createSolarPhotosphereTexture();
    const sunStdMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      map: sunPhotosphereTex,
      roughness: 0.35,
      metalness: 0.05,
      emissive: new THREE.Color(0xf59e0b),
      emissiveMap: sunPhotosphereTex,
      emissiveIntensity: 2.2,
    });
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 40, 40),
      sunStdMat
    );
    solarGroup.add(sunMesh);

    // Fresnel Glow Corona Shader Layer
    const sunCoronaMat = createFresnelCoronaMaterial(0xfef08a, 0xf97316);
    const sunCorona = new THREE.Mesh(
      new THREE.SphereGeometry(1.72, 36, 36),
      sunCoronaMat
    );
    sunMesh.add(sunCorona);

    // Reference Planet Orbits
    SOLAR_PLANET_PRESETS.slice(0, 8).forEach((pl) => {
      const refR = Math.min(8.6, Math.max(2.1, 2.0 + Math.log10(pl.semiMajorAxisAu + 0.7) * 4.2));
      const ringGeo = new THREE.RingGeometry(refR - 0.02, refR + 0.02, 64);
      ringGeo.rotateX(-Math.PI / 2);
      solarGroup.add(
        new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({
            color: 0x334155,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3,
          })
        )
      );
    });

    // 3D Rotating Asteroid Belt (InstancedMesh Rocky Asteroids + Micro Dust Ring)
    const asteroidBeltGroup = new THREE.Group();
    solarGroup.add(asteroidBeltGroup);

    const ASTEROID_COUNT = 220;
    const asteroidGeo = new THREE.DodecahedronGeometry(0.065, 0);
    const asteroidMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85,
      metalness: 0.2,
    });
    const asteroidInstanced = new THREE.InstancedMesh(asteroidGeo, asteroidMat, ASTEROID_COUNT);
    asteroidInstanced.castShadow = true;
    asteroidInstanced.receiveShadow = true;

    const dummyMatrix = new THREE.Matrix4();
    const dummyPos = new THREE.Vector3();
    const dummyRot = new THREE.Euler();
    const dummyQuat = new THREE.Quaternion();
    const dummyScale = new THREE.Vector3();
    const asteroidColor = new THREE.Color();

    for (let i = 0; i < ASTEROID_COUNT; i++) {
      const angle = (i / ASTEROID_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const beltRadius = 4.25 + (Math.random() - 0.5) * 0.65;
      const yOffset = (Math.random() - 0.5) * 0.28;
      dummyPos.set(Math.cos(angle) * beltRadius, yOffset, Math.sin(angle) * beltRadius);
      dummyRot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummyQuat.setFromEuler(dummyRot);
      const s = 0.55 + Math.random() * 1.15;
      dummyScale.set(s * 1.2, s * 0.8, s);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      asteroidInstanced.setMatrixAt(i, dummyMatrix);

      const shade = 0.5 + Math.random() * 0.4;
      asteroidColor.setRGB(shade, shade * 0.96, shade * 0.9);
      asteroidInstanced.setColorAt(i, asteroidColor);
    }
    asteroidInstanced.instanceMatrix.needsUpdate = true;
    if (asteroidInstanced.instanceColor) asteroidInstanced.instanceColor.needsUpdate = true;
    asteroidInstanced.computeBoundingSphere();
    asteroidBeltGroup.add(asteroidInstanced);

    const orbitGeo = new THREE.BufferGeometry();
    const orbitPositions = new Float32Array(96 * 3);
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    const orbitLine = new THREE.LineLoop(orbitGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
    solarGroup.add(orbitLine);

    const planetSurfaceTex = createPlanetSurfaceTexture({
      baseHex: '#0284c7',
      accentHex: '#22c55e',
      style: 'terrestrial',
    });
    const planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 40, 40),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: planetSurfaceTex,
        roughness: 0.55,
        metalness: 0.08,
      })
    );
    const planetAtmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 32, 32),
      createFresnelCoronaMaterial(0x7dd3fc, 0x0284c7)
    );
    planetMesh.add(planetAtmosphere);
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    planetMesh.userData = {
      draggableParam: 'customSemiMajorAxisAu',
      min: 0.4,
      max: 30.0,
      step: 0.5,
      label: 'Sumbu Semi-Mayor a (AU)',
    };
    solarGroup.add(planetMesh);

    // =========================================================
    // 2. MILKY WAY ROTATION & DARK MATTER 3D GROUP
    // =========================================================
    const milkyWayGroup = new THREE.Group();
    scene.add(milkyWayGroup);

    // Galaxy core Sgr A*
    const sgrABulge = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 28, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.0,
        roughness: 0.3,
      })
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
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfacc15,
        emissiveIntensity: 1.5,
      })
    );
    galacticMarkerStar.userData = {
      draggableParam: 'galactocentricRadiusKpc',
      min: 1.0,
      max: 25.0,
      step: 0.5,
      label: 'Radius Galaksi R (kpc)',
    };
    milkyWayGroup.add(galacticMarkerStar);

    // =========================================================
    // 3. STELLAR WIEN SPECTRUM & DISPERSION PRISM 3D GROUP
    // =========================================================
    const wienGroup = new THREE.Group();
    scene.add(wienGroup);

    // Glowing blackbody Star Sphere with MeshStandardMaterial + Fresnel Corona
    const wienStarMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 1.8,
      roughness: 0.3,
    });
    const wienStar = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 32), wienStarMat);
    wienStar.position.set(-4.5, 0, 0);
    wienStar.userData = {
      draggableParam: 'starEffectiveTempK',
      min: 2500,
      max: 35000,
      step: 250,
      label: 'Suhu Fotosfer T (K)',
    };
    wienGroup.add(wienStar);

    const wienCoronaMat = createFresnelCoronaMaterial(0xfef08a, 0xf59e0b);
    const wienCorona = new THREE.Mesh(
      new THREE.SphereGeometry(2.32, 32, 32),
      wienCoronaMat
    );
    wienStar.add(wienCorona);

    // 3D Glass Dispersion Prism
    const prismGeo = new THREE.CylinderGeometry(0.9, 0.9, 2.2, 3);
    prismGeo.rotateX(Math.PI / 2);
    const prismMesh = new THREE.Mesh(
      prismGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        transmission: 0.96,
        thickness: 0.8,
        ior: 1.52,
        roughness: 0.05,
        reflectivity: 0.5,
      })
    );
    prismMesh.position.set(-0.5, 0, 0);
    wienGroup.add(prismMesh);

    // Collimated ray from star to prism
    const starlightBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.0, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    starlightBeam.rotation.z = Math.PI / 2;
    starlightBeam.position.set(-2.5, 0, 0);
    wienGroup.add(starlightBeam);

    // Projected Rainbow Spectrum Band Screen
    const spectrumCanvas = document.createElement('canvas');
    spectrumCanvas.width = 512;
    spectrumCanvas.height = 128;
    const spectrumTexture = new THREE.CanvasTexture(spectrumCanvas);
    spectrumTexture.colorSpace = THREE.SRGBColorSpace;
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
    const cosmicGrid = new THREE.GridHelper(30, 20, 0x334155, 0x1e293b);
    cosmicGrid.position.y = -2.5;
    (cosmicGrid.material as THREE.Material).transparent = true;
    (cosmicGrid.material as THREE.Material).opacity = 0.35;
    hubbleGroup.add(cosmicGrid);

    // Milky Way Observer at center
    const mwObserver = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.2,
      })
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
      gMesh.castShadow = true;
      gMesh.userData = {
        draggableParam: 'galaxyDistanceMpc',
        min: 20,
        max: 600,
        step: 20,
        label: 'Jarak Galaksi d (Mpc)',
      };
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
    let hoveredMesh: THREE.Mesh | null = null;
    const origEmissive = new THREE.Color();

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

          if (latestRef.current.onPlanetClick) {
            latestRef.current.onPlanetClick(latestRef.current.params.selectedPlanetId || 'Bumi');
          }
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
    let timeoutId = 0;
    const startTimeMs = performance.now();

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

    const tick = () => {
      if (disposed) return;

      const elapsed = (performance.now() - startTimeMs) / 1000;
      const { params: p, metrics: m } = latestRef.current;
      const t = latestRef.current.simTime ?? elapsed;

      solarGroup.visible = p.mode === 'solar-kepler';
      milkyWayGroup.visible = p.mode === 'milkyway-galaxy' || (p.mode as string) === 'milky-way-rotation';
      wienGroup.visible =
        p.mode === 'stellar-wien-spectrum' ||
        p.mode === 'stellar-exoplanet' ||
        (p.mode as string) === 'exoplanet-transit';
      hubbleGroup.visible = p.mode === 'hubble-expansion';

      // Parallax Starfield subtle depth shift & rotation
      nearStarLayer.rotation.y = elapsed * 0.004;
      deepStarLayer.rotation.y = -elapsed * 0.0015;
      nearStarLayer.position.x = -camera.position.x * 0.06;
      nearStarLayer.position.z = -camera.position.z * 0.06;
      deepStarLayer.position.x = -camera.position.x * 0.02;
      deepStarLayer.position.z = -camera.position.z * 0.02;

      // Update Dynamic Sun Shader & Corona
      sunMesh.rotation.y = elapsed * 0.14;
      sunStdMat.emissiveIntensity = 2.0 + Math.sin(elapsed * 3.2) * 0.35;
      sunCoronaMat.uniforms.uTime.value = elapsed;
      wienCoronaMat.uniforms.uTime.value = elapsed;

      // Rotate Asteroid Belt smoothly
      asteroidBeltGroup.rotation.y = elapsed * 0.045;

      // 1. Kepler Orbit
      if (p.mode === 'solar-kepler') {
        const a = p.customSemiMajorAxisAu || 1.0;
        const e = p.customEccentricity ?? 0.017;
        const b = a * Math.sqrt(Math.max(0.01, 1 - e * e));
        const c = a * e;

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
        planetMesh.rotation.y = elapsed * 0.6;
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
      else if (
        p.mode === 'stellar-wien-spectrum' ||
        p.mode === 'stellar-exoplanet' ||
        (p.mode as string) === 'exoplanet-transit'
      ) {
        wienStarMat.color.setStyle(m.starColorHex);
        wienStarMat.emissive.setStyle(m.starColorHex);
        wienCoronaMat.uniforms.uCoreColor.value.setStyle(m.starColorHex);
        wienCoronaMat.uniforms.uRimColor.value.setStyle(m.starColorHex);

        // Render dynamic rainbow spectrum with absorption dark lines on canvas
        const sCtx = spectrumCanvas.getContext('2d');
        if (sCtx) {
          const grad = sCtx.createLinearGradient(0, 0, spectrumCanvas.width, 0);
          grad.addColorStop(0, '#7c3aed');
          grad.addColorStop(0.2, '#2563eb');
          grad.addColorStop(0.4, '#10b981');
          grad.addColorStop(0.65, '#facc15');
          grad.addColorStop(0.85, '#f97316');
          grad.addColorStop(1.0, '#ef4444');
          sCtx.fillStyle = grad;
          sCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);

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
      composer.render();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
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
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        renderer.domElement.style.cursor = 'grab';
        if (hitMesh !== hoveredMesh) {
          if (hoveredMesh && (hoveredMesh.material as any)?.emissive) {
            (hoveredMesh.material as any).emissive.copy(origEmissive);
          }
          hoveredMesh = hitMesh;
          if ((hitMesh.material as any)?.emissive) {
            origEmissive.copy((hitMesh.material as any).emissive);
            (hitMesh.material as any).emissive.setHex(0x38bdf8);
          }
        }
      } else {
        renderer.domElement.style.cursor = 'default';
        if (hoveredMesh && (hoveredMesh.material as any)?.emissive) {
          (hoveredMesh.material as any).emissive.copy(origEmissive);
          hoveredMesh = null;
        }
      }

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

    let lastW = width;
    let lastH = height;
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 500;
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
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      cursorManager.dispose();
      controls.dispose();

      // Dispose Post-Processing & Textures
      studioComposer.dispose();
      planetSurfaceTex?.dispose();
      sunPhotosphereTex.dispose();
      spectrumTexture.dispose();

      // Deep Three.js GPU resource disposal (geometries, materials, textures, renderer)
      disposeThreeSceneResources(scene, renderer, envTexture);
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
      className={`relative w-full h-full overflow-hidden ${themeColors.containerBgClass} touch-none select-none transition-colors duration-300 ${
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
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-sky-950/95 border border-sky-400/40 px-4 py-1.5 shadow-2xl z-30 text-xs font-mono text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>Menyetel Astronomi 3D: {dragToast.label} = <b className="text-white">{dragToast.value}</b></span>
        </div>
      )}

      {/* Unified Top-Right Camera & Fullscreen Pill */}
      <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 px-2 py-1 shadow-lg z-20">
        <div className="hidden md:flex items-center gap-0.5">
          {(
            [
              { id: 'isometric', label: 'Iso' },
              { id: 'ecliptic', label: 'Ekliptika' },
              { id: 'top', label: 'Atas' },
              { id: 'focus', label: 'Fokus' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectCameraPreset(p.id)}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                activePreset === p.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />
        </div>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
          title={isFullscreen ? 'Keluar dari Mode Layar Penuh 3D' : 'Mode Layar Penuh 3D'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          )}
          <span className="hidden sm:inline">{isFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
        </button>
      </div>
    </div>
  );
};
