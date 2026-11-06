import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AstronomyParams,
  AstronomyMetrics,
  SolarPlanetPreset,
  SOLAR_PLANET_PRESETS,
  calculateAstronomyMetrics,
} from '../utils/scienceEngine';

import { SpatialCursorManager } from '../utils/spatialCursorGroup';
import { SpatialCursorPayload } from '../utils/collabProtocol';

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
}

type CameraPreset = 'isometric' | 'ecliptic' | 'top' | 'focus';

function createPlanetCanvasTexture(baseColorHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const base = new THREE.Color(baseColorHex);
  const dark = base.clone().multiplyScalar(0.68);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.32);

  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let y = 0; y < c.height; y += 8) {
    const band = Math.sin(y * 0.18) * 0.5 + 0.5;
    ctx.fillStyle =
      band > 0.55
        ? `#${light.getHexString()}`
        : band < 0.35
        ? `#${dark.getHexString()}`
        : `#${base.getHexString()}`;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, y, c.width, 6);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const AstronomyScene3D: React.FC<AstronomyScene3DProps> = ({
  params,
  metrics,
  activePlanet,
  simTime,
  remoteCursors,
  onEmitCursor,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const miniPlotRef = useRef<HTMLCanvasElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [showMiniPlot, setShowMiniPlot] = useState(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>('isometric');

  const latestRef = useRef({
    params,
    metrics,
    activePlanet,
    simTime,
    remoteCursors,
    onEmitCursor,
  });
  latestRef.current = {
    params,
    metrics,
    activePlanet,
    simTime,
    remoteCursors,
    onEmitCursor,
  };

  const cameraCtrlRef = useRef<{
    setPreset: (preset: CameraPreset) => void;
  } | null>(null);

  // Companion 2D Quantitative Astro Plot (Rotation Curve / H-R & Transit / Kepler Harmony)
  useEffect(() => {
    const canvas = miniPlotRef.current;
    if (!canvas || !showMiniPlot) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, w, h);

    const padL = 30;
    const padR = 12;
    const padT = 22;
    const padB = 20;
    const cw = w - padL - padR;
    const ch = h - padT - padB;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + ch);
    ctx.lineTo(padL + cw, padT + ch);
    ctx.stroke();

    if (params.mode === 'milkyway-galaxy') {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText('KURVA ROTASI GALAKSI v(R) [km/s]', padL - 6, 14);

      const toX = (r: number) => padL + (r / 25) * cw;
      const toY = (v: number) => padT + ch - (Math.min(300, v) / 300) * ch;

      // Keplerian expectation (dashed amber)
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let r = 0.5; r <= 25; r += 1) {
        const pt = calculateAstronomyMetrics({
          ...params,
          galactocentricRadiusKpc: r,
        });
        const sx = toX(r);
        const sy = toY(pt.keplerianVelocityKms);
        if (r === 0.5) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();

      // Observed + Dark Matter Halo (solid cyan)
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let r = 0.5; r <= 25; r += 1) {
        const pt = calculateAstronomyMetrics({
          ...params,
          galactocentricRadiusKpc: r,
        });
        const sx = toX(r);
        const sy = toY(pt.observedDarkMatterVelocityKms);
        if (r === 0.5) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      const curX = toX(params.galactocentricRadiusKpc);
      const curY = toY(metrics.observedDarkMatterVelocityKms);
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(
        `R=${params.galactocentricRadiusKpc} kpc | v_obs=${metrics.observedDarkMatterVelocityKms} km/s`,
        padL,
        h - 5
      );
    } else if (params.mode === 'stellar-exoplanet') {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(
        `KURVA CAHAYA TRANSIT (ΔF/F = -${metrics.transitDepthPct}%)`,
        padL - 8,
        14
      );

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const u = (i / 50) * 2 - 1;
        const sx = padL + (i / 50) * cw;
        const inTransit = Math.abs(u) < 0.34;
        const dip = inTransit ? Math.cos((u / 0.34) * (Math.PI / 2)) : 0;
        const dropPx =
          Math.min(ch * 0.72, Math.max(8, metrics.transitDepthPct * 18)) * dip;
        const sy = padT + 14 + dropPx;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      ctx.fillStyle = '#10B981';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(
        `Kelas ${metrics.spectralClass} (${params.starEffectiveTempK}K) · ${metrics.transitDepthPpm} ppm`,
        padL,
        h - 5
      );
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(`HUKUM III KEPLER (T²/a³ = ${metrics.keplerRatioT2OverA3})`, padL - 6, 14);

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(padL, padT + ch);
      ctx.lineTo(padL + cw, padT + 6);
      ctx.stroke();

      SOLAR_PLANET_PRESETS.slice(0, 6).forEach((pl, idx) => {
        const frac = (idx + 1) / 6.5;
        const px = padL + frac * cw;
        const py = padT + ch - frac * (ch - 8);
        ctx.fillStyle =
          pl.id === params.selectedPlanetId ? '#FACC15' : '#38BDF8';
        ctx.beginPath();
        ctx.arc(px, py, pl.id === params.selectedPlanetId ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillText(
        `${activePlanet.name}: a=${params.customSemiMajorAxisAu} AU, T=${metrics.orbitalPeriodYears} thn`,
        padL,
        h - 5
      );
    }
  }, [params, metrics, activePlanet, showMiniPlot]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 740;
    const height = container.clientHeight || 390;

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

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const glRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glRenderer);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);

    const cursorManager = new SpatialCursorManager(scene);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 350);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 45;

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

    // Ambient & Central Star Point Light
    scene.add(new THREE.AmbientLight(0x94a3b8, 0.55));
    const centralLight = new THREE.PointLight(0xfffbeb, 3.2, 80, 0.6);
    scene.add(centralLight);

    // 3D Deep Space Starfield Background (600 stars)
    const bgStarCount = 600;
    const bgStarPos = new Float32Array(bgStarCount * 3);
    for (let i = 0; i < bgStarCount; i++) {
      const r = 45 + (i % 40);
      const theta = (i * 2.39996) % (Math.PI * 2);
      const phi = Math.acos(1 - (2 * (i + 0.5)) / bgStarCount);
      bgStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      bgStarPos[i * 3 + 1] = r * Math.cos(phi);
      bgStarPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const bgStarGeo = new THREE.BufferGeometry();
    bgStarGeo.setAttribute('position', new THREE.BufferAttribute(bgStarPos, 3));
    const bgStars = new THREE.Points(
      bgStarGeo,
      new THREE.PointsMaterial({
        color: 0xe2e8f0,
        size: 0.25,
        transparent: true,
        opacity: 0.65,
      })
    );
    scene.add(bgStars);

    // =========================================================
    // 1. SOLAR SYSTEM & KEPLER 3D GROUP
    // =========================================================
    const solarGroup = new THREE.Group();
    scene.add(solarGroup);

    // Glowing 3D Sun + Corona Shell
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    solarGroup.add(sunMesh);

    const sunCorona = new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 28, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.26,
      })
    );
    sunMesh.add(sunCorona);

    // Reference Planet Orbit Rings
    SOLAR_PLANET_PRESETS.slice(0, 8).forEach((pl) => {
      const refR = Math.min(
        8.6,
        Math.max(2.1, 2.0 + Math.log10(pl.semiMajorAxisAu + 0.7) * 4.2)
      );
      const ringGeo = new THREE.RingGeometry(refR - 0.02, refR + 0.02, 64);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x334155,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.35,
        })
      );
      solarGroup.add(ringMesh);
    });

    // Dynamic 3D Keplerian Elliptical Orbit Path
    const ORBIT_SEGMENTS = 96;
    const orbitPositions = new Float32Array(ORBIT_SEGMENTS * 3);
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(orbitPositions, 3)
    );
    const orbitLine = new THREE.LineLoop(
      orbitGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8 })
    );
    solarGroup.add(orbitLine);

    // Kepler's 2nd Law Equal-Area Sweep Wedges (Perihelion & Aphelion 3D Sector Meshes)
    const sweepPeriGeo = new THREE.BufferGeometry();
    const sweepPeriVerts = new Float32Array(24 * 3);
    sweepPeriGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(sweepPeriVerts, 3)
    );
    const sweepPeriMesh = new THREE.Mesh(
      sweepPeriGeo,
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      })
    );
    solarGroup.add(sweepPeriMesh);

    const sweepAphGeo = new THREE.BufferGeometry();
    const sweepAphVerts = new Float32Array(24 * 3);
    sweepAphGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(sweepAphVerts, 3)
    );
    const sweepAphMesh = new THREE.Mesh(
      sweepAphGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    solarGroup.add(sweepAphMesh);

    // Active 3D Planet Group (Sphere + Saturn/Uranus 3D Ring System)
    const planetGroup = new THREE.Group();
    solarGroup.add(planetGroup);

    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.45,
      metalness: 0.1,
    });
    const planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 28, 28),
      planetMat
    );
    planetGroup.add(planetMesh);

    const planetRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.35, 48),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
        roughness: 0.4,
      })
    );
    planetRingMesh.rotation.x = Math.PI * 0.42;
    planetGroup.add(planetRingMesh);

    // Radius Vector Line connecting Sun to Planet
    const radiusVecGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const radiusVecLine = new THREE.Line(
      radiusVecGeo,
      new THREE.LineBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.65,
      })
    );
    solarGroup.add(radiusVecLine);

    // =========================================================
    // 2. MILKY WAY BARRED SPIRAL GALAXY & SGR A* 3D GROUP
    // =========================================================
    const galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);

    const GALAXY_STARS = 2200;
    const galPositions = new Float32Array(GALAXY_STARS * 3);
    const galColors = new Float32Array(GALAXY_STARS * 3);
    const cCore = new THREE.Color(0xfef08a);
    const cArmCyan = new THREE.Color(0x38bdf8);
    const cArmViolet = new THREE.Color(0xa855f7);

    for (let i = 0; i < GALAXY_STARS; i++) {
      const arm = i % 4;
      const frac = Math.pow((i / GALAXY_STARS), 0.85);
      const r = 0.6 + frac * 7.8;
      const branchAngle = (arm * Math.PI * 2) / 4;
      const spinAngle = r * 0.72;
      const scatter = (Math.sin(i * 12.9898) * 0.42) * (1 - frac * 0.35);
      const ySpread = Math.cos(i * 78.233) * (0.45 * Math.exp(-r * 0.25));

      galPositions[i * 3] = Math.cos(branchAngle + spinAngle + scatter) * r;
      galPositions[i * 3 + 1] = ySpread;
      galPositions[i * 3 + 2] = Math.sin(branchAngle + spinAngle + scatter) * r;

      const mixed = cCore
        .clone()
        .lerp(arm % 2 === 0 ? cArmCyan : cArmViolet, Math.min(1, frac * 1.25));
      galColors[i * 3] = mixed.r;
      galColors[i * 3 + 1] = mixed.g;
      galColors[i * 3 + 2] = mixed.b;
    }

    const galGeo = new THREE.BufferGeometry();
    galGeo.setAttribute('position', new THREE.BufferAttribute(galPositions, 3));
    galGeo.setAttribute('color', new THREE.BufferAttribute(galColors, 3));
    const spiralDiskPoints = new THREE.Points(
      galGeo,
      new THREE.PointsMaterial({
        size: 0.16,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
      })
    );
    galaxyGroup.add(spiralDiskPoints);

    // Central Galactic Bar & Bulge
    const galacticBulge = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.35,
      })
    );
    galacticBulge.scale.set(1.5, 0.55, 0.85);
    galaxyGroup.add(galacticBulge);

    // Supermassive Black Hole Sagittarius A* + Glowing Accretion Disk
    const sgrABlackHole = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    galaxyGroup.add(sgrABlackHole);

    const accretionDisk = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.92, 36),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    accretionDisk.rotation.x = Math.PI * 0.44;
    galaxyGroup.add(accretionDisk);

    // Spherical Translucent Dark Matter Halo
    const darkMatterHalo = new THREE.Mesh(
      new THREE.SphereGeometry(8.6, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.12,
        wireframe: true,
      })
    );
    galaxyGroup.add(darkMatterHalo);

    // Active Galactocentric Radius R Orbit Ring & Marker Star
    const galOrbitRing = new THREE.Mesh(
      new THREE.RingGeometry(0.98, 1.02, 64),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
      })
    );
    galOrbitRing.rotation.x = -Math.PI / 2;
    galaxyGroup.add(galOrbitRing);

    const testStarMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.6,
      })
    );
    galaxyGroup.add(testStarMarker);

    // =========================================================
    // 3. STELLAR H-R & EXOPLANET TRANSIT 3D GROUP
    // =========================================================
    const exoplanetGroup = new THREE.Group();
    scene.add(exoplanetGroup);

    const spectralStarMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const spectralStarMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 36, 36),
      spectralStarMat
    );
    exoplanetGroup.add(spectralStarMesh);

    const spectralCoronaMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.25,
    });
    const spectralCorona = new THREE.Mesh(
      new THREE.SphereGeometry(2.05, 32, 32),
      spectralCoronaMat
    );
    spectralStarMesh.add(spectralCorona);

    // Translucent Emerald 3D Habitable Zone Ring
    const hzRing = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 5.4, 64),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
      })
    );
    hzRing.rotation.x = -Math.PI / 2;
    exoplanetGroup.add(hzRing);

    // Exoplanet Orbit Track & Transiting Exoplanet Sphere
    const exoOrbitRing = new THREE.Mesh(
      new THREE.RingGeometry(4.18, 4.24, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      })
    );
    exoOrbitRing.rotation.x = -Math.PI / 2;
    exoplanetGroup.add(exoOrbitRing);

    const exoPlanetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.2,
        emissive: 0x0284c7,
        emissiveIntensity: 0.25,
      })
    );
    exoplanetGroup.add(exoPlanetMesh);

    // Cache procedural planet textures by id
    const planetTexCache: Record<string, THREE.CanvasTexture> = {};
    SOLAR_PLANET_PRESETS.forEach((pl) => {
      planetTexCache[pl.id] = createPlanetCanvasTexture(pl.colorHex);
    });
    let currentTexPlanetId = '';

    // =========================================================
    // ANIMATION LOOP WITH SOFTWARE-GL FENCE PACING
    // =========================================================
    let disposed = false;
    let rafId = 0;

    function afterDraw(cb: () => void) {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        if (!sync) {
          setTimeout(cb, 80);
          return;
        }
        const status = gl.clientWaitSync(sync, 0, 0);
        if (
          status === gl.ALREADY_SIGNALED ||
          status === gl.CONDITION_SATISFIED
        ) {
          gl.deleteSync(sync);
          setTimeout(cb, 80);
        } else {
          setTimeout(poll, 16);
        }
      };
      setTimeout(poll, 16);
    }

    const tick = () => {
      if (disposed) return;
      const {
        params: p,
        metrics: m,
        activePlanet: pl,
        simTime: t,
      } = latestRef.current;

      solarGroup.visible = p.mode === 'solar-kepler';
      galaxyGroup.visible = p.mode === 'milkyway-galaxy';
      exoplanetGroup.visible = p.mode === 'stellar-exoplanet';

      if (p.mode === 'solar-kepler') {
        const a = Math.max(0.2, p.customSemiMajorAxisAu);
        const e = Math.max(0, Math.min(0.88, p.customEccentricity));

        const rx = Math.min(
          8.4,
          Math.max(2.6, 2.1 + Math.log10(a + 0.7) * 4.2)
        );
        const rz = rx * Math.sqrt(Math.max(0.08, 1 - e * e));
        const focalShift = rx * e;

        sunMesh.position.set(focalShift, 0, 0);
        centralLight.position.set(focalShift, 0, 0);
        const sunScale = Math.min(
          1.45,
          Math.max(0.75, Math.pow(p.centralStarMassSolar, 0.28))
        );
        sunMesh.scale.setScalar(sunScale);

        // Update 3D elliptical orbit loop
        const oAttr = orbitGeo.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        for (let i = 0; i < ORBIT_SEGMENTS; i++) {
          const ang = (i / ORBIT_SEGMENTS) * Math.PI * 2;
          oAttr.setXYZ(i, rx * Math.cos(ang), 0, rz * Math.sin(ang));
        }
        oAttr.needsUpdate = true;

        // Kepler's 2nd Law equal-area sweep wedges
        sweepPeriMesh.visible = p.showKeplerAreaSweep;
        sweepAphMesh.visible = p.showKeplerAreaSweep;
        if (p.showKeplerAreaSweep) {
          const pAttr = sweepPeriGeo.getAttribute(
            'position'
          ) as THREE.BufferAttribute;
          for (let i = 0; i < 8; i++) {
            const a1 = -0.42 + (i / 8) * 0.84;
            const a2 = -0.42 + ((i + 1) / 8) * 0.84;
            pAttr.setXYZ(i * 3, focalShift, 0.02, 0);
            pAttr.setXYZ(i * 3 + 1, rx * Math.cos(a1), 0.02, rz * Math.sin(a1));
            pAttr.setXYZ(i * 3 + 2, rx * Math.cos(a2), 0.02, rz * Math.sin(a2));
          }
          pAttr.needsUpdate = true;

          const aAttr = sweepAphGeo.getAttribute(
            'position'
          ) as THREE.BufferAttribute;
          for (let i = 0; i < 8; i++) {
            const a1 = Math.PI - 0.2 + (i / 8) * 0.4;
            const a2 = Math.PI - 0.2 + ((i + 1) / 8) * 0.4;
            aAttr.setXYZ(i * 3, focalShift, 0.02, 0);
            aAttr.setXYZ(i * 3 + 1, rx * Math.cos(a1), 0.02, rz * Math.sin(a1));
            aAttr.setXYZ(i * 3 + 2, rx * Math.cos(a2), 0.02, rz * Math.sin(a2));
          }
          aAttr.needsUpdate = true;
        }

        // Planet texture & position
        if (currentTexPlanetId !== pl.id) {
          currentTexPlanetId = pl.id;
          planetMat.map = planetTexCache[pl.id] || null;
          planetMat.color.set(0xffffff);
          planetMat.needsUpdate = true;
        }
        planetRingMesh.visible = Boolean(pl.hasRings);

        const angRate = 1.25 / Math.max(0.35, Math.pow(a, 0.55));
        const meanAnom = t * angRate;
        const eccAnom = meanAnom + e * Math.sin(meanAnom);
        const px = rx * Math.cos(eccAnom);
        const pz = -rz * Math.sin(eccAnom);

        planetGroup.position.set(px, 0, pz);
        planetMesh.rotation.y = t * 1.8;

        const rAttr = radiusVecGeo.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        rAttr.setXYZ(0, focalShift, 0, 0);
        rAttr.setXYZ(1, px, 0, pz);
        rAttr.needsUpdate = true;
      } else if (p.mode === 'milkyway-galaxy') {
        const rot = t * 0.25;
        spiralDiskPoints.rotation.y = rot;
        galacticBulge.rotation.y = rot * 0.7;
        accretionDisk.rotation.z = t * 2.4;

        (darkMatterHalo.material as THREE.MeshBasicMaterial).opacity = Math.min(
          0.24,
          p.darkMatterHaloFraction * 0.14
        );
        darkMatterHalo.visible = p.darkMatterHaloFraction > 0.05;

        const rGal =
          (Math.min(25, Math.max(0.5, p.galactocentricRadiusKpc)) / 25) * 8.2;
        galOrbitRing.scale.setScalar(rGal);

        const starAng = -t * (m.observedDarkMatterVelocityKms / 180);
        testStarMarker.position.set(
          Math.cos(starAng) * rGal,
          0,
          Math.sin(starAng) * rGal
        );
      } else if (p.mode === 'stellar-exoplanet') {
        spectralStarMat.color.set(m.starColorHex);
        spectralCoronaMat.color.set(m.starColorHex);

        const rStarScale = Math.min(
          1.65,
          Math.max(0.55, 0.75 + Math.log10(Math.max(0.2, p.starRadiusSolar) + 0.8) * 0.75)
        );
        spectralStarMesh.scale.setScalar(rStarScale);

        const rExoScale = Math.min(
          1.5,
          Math.max(0.5, 0.5 + (p.exoplanetRadiusEarth / 15) * 0.95)
        );
        exoPlanetMesh.scale.setScalar(rExoScale);

        const orbitDist = Math.min(
          7.6,
          Math.max(3.1, 3.0 + p.exoplanetOrbitAu * 1.1)
        );
        exoOrbitRing.scale.setScalar(orbitDist / 4.2);

        const orbAng = t * 1.15;
        exoPlanetMesh.position.set(
          Math.sin(orbAng) * orbitDist,
          Math.sin(orbAng * 2) * 0.08,
          Math.cos(orbAng) * orbitDist
        );
      }

      // Update Phase 3 3D laser cursors for remote lab partners
      cursorManager.update(
        latestRef.current.remoteCursors || {},
        camera.position
      );

      controls.update();
      renderer.render(scene, camera);
      afterDraw(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Raycast surface interaction for multiplayer laser pointer
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planeIntersect = new THREE.Vector3();

    const handlePointerMove = (e: PointerEvent) => {
      if (!latestRef.current.onEmitCursor) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);

      const targets: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.visible &&
          obj.name !== 'SpatialLaserCursors' &&
          !obj.name.startsWith('cursor-')
        ) {
          targets.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(targets, false);
      let hitPos: [number, number, number] | null = null;
      let hitNormal: [number, number, number] | undefined = undefined;
      let hoveredName: string | undefined = undefined;

      if (intersects.length > 0) {
        const hit = intersects[0];
        hitPos = [
          Number(hit.point.x.toFixed(3)),
          Number(hit.point.y.toFixed(3)),
          Number(hit.point.z.toFixed(3)),
        ];
        if (hit.face) {
          hitNormal = [
            Number(hit.face.normal.x.toFixed(3)),
            Number(hit.face.normal.y.toFixed(3)),
            Number(hit.face.normal.z.toFixed(3)),
          ];
        }
        if (hit.object.name) {
          hoveredName = hit.object.name;
        } else if (
          hit.object.parent &&
          hit.object.parent.name &&
          !hit.object.parent.name.startsWith('cursor') &&
          hit.object.parent.name !== 'SpatialLaserCursors'
        ) {
          hoveredName = hit.object.parent.name;
        }
      } else {
        const hit = raycaster.ray.intersectPlane(groundPlane, planeIntersect);
        if (hit) {
          hitPos = [Number(hit.x.toFixed(3)), 0.05, Number(hit.z.toFixed(3))];
        }
      }

      if (hitPos) {
        latestRef.current.onEmitCursor(hitPos, hitNormal, hoveredName);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 740;
      const h = container.clientHeight || 390;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      cursorManager.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const handleSelectCameraPreset = (presetName: CameraPreset) => {
    setActivePreset(presetName);
    cameraCtrlRef.current?.setPreset(presetName);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-[#060913]">
      <div
        ref={mountRef}
        data-testid="astronomy-simulation-canvas"
        className="w-full h-[340px] sm:h-[390px] block cursor-grab active:cursor-grabbing"
      />

      {/* Top-Left 3D Observatory HUD Badge */}
      <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-slate-700 bg-[#0F172A] px-3 py-2 text-xs shadow-md">
        <div className="font-mono text-[11px] font-semibold text-sky-400">
          {params.mode === 'solar-kepler'
            ? `ORBIT 3D HUKUM KEPLER — ${activePlanet.name.toUpperCase()}`
            : params.mode === 'milkyway-galaxy'
            ? 'GALAKSI BIMA SAKTI 3D & LUBANG HITAM SGR A*'
            : `BINTANG KELAS SPEKTRAL ${metrics.spectralClass} & TRANSIT 3D`}
        </div>
        <div className="mt-0.5 font-mono text-xs font-semibold text-slate-100 tabular-nums">
          {params.mode === 'solar-kepler'
            ? `a = ${params.customSemiMajorAxisAu} AU · e = ${params.customEccentricity} · T = ${metrics.orbitalPeriodYears} thn`
            : params.mode === 'milkyway-galaxy'
            ? `v_obs = ${metrics.observedDarkMatterVelocityKms} km/s · M(<R) = ${metrics.enclosedMassBillionSolar}×10⁹ M☉`
            : `L = ${metrics.stellarLuminositySolar} L☉ · Zona Laik Huni: ${metrics.habitableZoneInnerAu}–${metrics.habitableZoneOuterAu} AU`}
        </div>
      </div>

      {/* Top-Right Companion 2D Astro Plot PiP */}
      {showMiniPlot && !hudCollapsed && (
        <div className="pointer-events-none absolute top-3 right-3 hidden md:block overflow-hidden rounded-md border border-slate-700 bg-[#090D16] shadow-lg">
          <canvas
            ref={miniPlotRef}
            width={255}
            height={128}
            className="block"
          />
        </div>
      )}

      {/* Collapsible Bottom 3D Camera & Plot Dock */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-10">
        {!hudCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 shadow-lg">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">
              Kamera 3D:
            </span>
            {(
              [
                { id: 'isometric', label: 'Isometrik 3D' },
                { id: 'ecliptic', label: 'Bidang Ekliptika' },
                { id: 'top', label: 'Kutub Utara' },
                { id: 'focus', label: 'Fokus Inti' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectCameraPreset(p.id)}
                className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                  activePreset === p.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowMiniPlot((s) => !s)}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                showMiniPlot
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {showMiniPlot ? 'Grafik Astro: Aktif' : 'Grafik Astro: Nonaktif'}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          className="rounded border border-slate-700 bg-[#0F172A] px-2.5 py-0.5 text-[10px] font-mono text-slate-300 hover:text-white shadow"
        >
          {hudCollapsed ? '▴ Tampilkan Kontrol Kamera 3D' : '▾ Sembunyikan HUD'}
        </button>
      </div>
    </div>
  );
};
