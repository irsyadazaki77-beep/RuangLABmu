import * as THREE from 'three';
import {
  AstronomyMetrics,
  AstronomyParams,
  SOLAR_PLANET_PRESETS,
  SolarPlanetPreset,
} from '../../utils/engines/astronomyEngine';
import {
  auToSceneRadius,
  computeTransitLightCurveSample,
  evaluateKeplerOrbitPoint,
  redshiftToGalaxyColorHex,
  solveKeplerEccentricAnomaly,
} from '../../utils/astronomyVisualHelpers';
import {
  applyBorosilicateLiteMode,
  createBorosilicateGlassMaterial,
  createPlanetSurfaceTexture,
  createVectorArrowGroup,
  orientAndScaleVectorArrow,
  wavelengthNmToHex,
} from '../../utils/threeStudioKit';

export interface AstronomyConceptAnchors {
  c1?: { pos: THREE.Vector3; text: string };
  c2?: { pos: THREE.Vector3; text: string };
  c3?: { pos: THREE.Vector3; text: string };
}

export interface AstronomyRigContext {
  params: AstronomyParams;
  metrics: AstronomyMetrics;
  activePlanet?: SolarPlanetPreset;
  t: number;
  isLite: boolean;
  particleScale?: number;
  showConceptLabels: boolean;
  isFocusPreset: boolean;
  isDragging: boolean;
}

export interface AstronomyRigHandle {
  group: THREE.Group;
  interactiveMeshes: THREE.Object3D[];
  update: (ctx: AstronomyRigContext) => {
    anchors: AstronomyConceptAnchors;
    focusTarget?: THREE.Vector3;
    focusCamPos?: THREE.Vector3;
  };
  onLiteChange?: (isLite: boolean) => void;
  dispose: () => void;
}

/**
 * Generates a procedural photosphere granulation texture for stars.
 */
export function createSolarPhotosphereTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Photospheric limb-warmed plasma base
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#d97706');
    grad.addColorStop(0.22, '#f59e0b');
    grad.addColorStop(0.5, '#fef08a');
    grad.addColorStop(0.78, '#f59e0b');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Multi-scale convection granulation cells
    for (let i = 0; i < 620; i++) {
      const x = (i * 97.3) % 512;
      const y = (i * 53.7) % 256;
      const r = 2.5 + (i % 11);
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(180, 83, 9, 0.28)'
          : i % 3 === 0
          ? 'rgba(255, 251, 235, 0.36)'
          : 'rgba(251, 191, 36, 0.26)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright magnetic faculae filaments & realistic mid-latitude sunspot umbra/penumbra pairs
    const sunspots = [
      { x: 118, y: 102, r: 9 },
      { x: 132, y: 107, r: 5.5 },
      { x: 274, y: 148, r: 10 },
      { x: 290, y: 143, r: 6 },
      { x: 408, y: 112, r: 7.5 },
    ];
    sunspots.forEach((spot) => {
      const faculae = ctx.createRadialGradient(spot.x, spot.y, spot.r * 0.8, spot.x, spot.y, spot.r * 2.5);
      faculae.addColorStop(0, 'rgba(255, 251, 235, 0.42)');
      faculae.addColorStop(1, 'rgba(255, 251, 235, 0)');
      ctx.fillStyle = faculae;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Penumbra
      ctx.fillStyle = 'rgba(124, 45, 18, 0.62)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
      // Umbra core
      ctx.fillStyle = 'rgba(67, 20, 7, 0.84)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r * 0.52, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Generates a soft radial star-glow sprite for point-cloud galaxies and starfields.
 */
function createRadialGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(224, 242, 254, 0.78)');
    grad.addColorStop(0.65, 'rgba(125, 211, 252, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a procedural spiral galaxy sprite texture for distant galaxies in Hubble expansion.
 */
function createSpiralGalaxyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    const bulge = ctx.createRadialGradient(64, 64, 2, 64, 64, 58);
    bulge.addColorStop(0, 'rgba(255, 255, 255, 1)');
    bulge.addColorStop(0.2, 'rgba(255, 255, 255, 0.65)');
    bulge.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
    bulge.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bulge;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    // Two logarithmic spiral arms
    for (let arm = 0; arm < 2; arm++) {
      const baseAngle = arm * Math.PI;
      for (let s = 0; s < 95; s++) {
        const u = s / 95;
        const r = 6 + u * 48;
        const theta = baseAngle + u * 3.1;
        const x = 64 + Math.cos(theta) * r;
        const y = 64 + Math.sin(theta) * r;
        const radius = 5.5 * (1 - u * 0.65);
        const alpha = 0.55 * (1 - u * 0.72);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.2, radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Physically consistent BackSide volumetric corona / atmospheric halo shader.
 * Computes both normal and view direction in view space so radial intensity fades
 * smoothly to 0.0 at the outer silhouette boundary (zero hard cutoff ring).
 */
export function createFresnelCoronaMaterial(
  coreHex = 0xfef08a,
  rimHex = 0xf97316,
  intensity = 1.45
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoreColor: { value: new THREE.Color(coreHex) },
      uRimColor: { value: new THREE.Color(rimHex) },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        float flare = sin(position.x * 4.2 + uTime * 1.9) * cos(position.y * 4.2 - uTime * 1.6) * 0.024;
        vec3 displaced = position + normal * flare;
        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
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
        // On a BackSide shell, -vNormal faces the camera at center (1.0) and drops to 0.0 at the silhouette edge
        float facing = clamp(dot(-normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
        float halo = pow(facing, 2.9);
        float coreBlend = pow(facing, 4.8);
        float pulse = 0.93 + 0.07 * sin(uTime * 2.6 + vLocalPos.y * 3.2 + vLocalPos.x * 2.4);
        vec3 glowColor = mix(uRimColor, uCoreColor, coreBlend) * uIntensity * pulse;
        float alpha = clamp(halo * 0.9, 0.0, 0.9);
        gl_FragColor = vec4(glowColor * alpha, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
}

function createTerrestrialCloudTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 85; i++) {
    const cx = (i * 83.7) % 512;
    const cy = 26 + ((i * 47.3) % 204);
    const rx = 18 + (i % 28);
    const ry = 6 + (i % 10);
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
    grad.addColorStop(0.55, 'rgba(241, 245, 249, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createHabitableZoneMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x10b981) },
      uOpacity: { value: 0.22 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vLocalPos;

      void main() {
        float r = length(vLocalPos.xy);
        float t = clamp((r - 1.0) / 0.45, 0.0, 1.0);
        float feather = smoothstep(0.0, 0.22, t) * smoothstep(1.0, 0.76, t);
        float rings = 0.85 + 0.15 * sin(t * 18.849 - uTime * 0.9);
        float alpha = feather * uOpacity * rings;
        gl_FragColor = vec4(uColor * 1.15, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// =====================================================================
// RIG 1: SOLAR SYSTEM & KEPLER'S III LAW
// =====================================================================
export function buildSolarKeplerRig(): AstronomyRigHandle {
  const solarGroup = new THREE.Group();
  const sunPhotosphereTex = createSolarPhotosphereTexture();
  const planetSurfaceTex = createPlanetSurfaceTexture({
    baseHex: '#0284c7',
    accentHex: '#22c55e',
    style: 'terrestrial',
  });

  const sunStdMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    map: sunPhotosphereTex,
    roughness: 0.35,
    metalness: 0.05,
    emissive: new THREE.Color(0xf59e0b),
    emissiveMap: sunPhotosphereTex,
    emissiveIntensity: 2.1,
  });
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(0.76, 40, 40), sunStdMat);
  sunMesh.name = 'Bintang Induk (Matahari)';
  solarGroup.add(sunMesh);

  const sunCoronaMat = createFresnelCoronaMaterial(0xfef9c3, 0xf59e0b, 1.48);
  const sunCorona = new THREE.Mesh(new THREE.SphereGeometry(1.26, 44, 44), sunCoronaMat);
  sunMesh.add(sunCorona);

  // Habitable Zone radial-feathered translucent ring in ecliptic XZ plane
  const habitableZoneMat = createHabitableZoneMaterial();
  const habitableZoneMesh = new THREE.Mesh(new THREE.RingGeometry(1, 1.45, 72), habitableZoneMat);
  habitableZoneMesh.rotation.x = -Math.PI / 2;
  habitableZoneMesh.position.y = -0.02;
  solarGroup.add(habitableZoneMesh);

  // Reference Planet Orbits (3D Inclined Ellipses)
  SOLAR_PLANET_PRESETS.slice(0, 8).forEach((pl, idx) => {
    const refR = auToSceneRadius(pl.semiMajorAxisAu);
    const ecc = Math.min(0.35, pl.eccentricity ?? 0.02);
    const incRad = (((idx % 5) - 2) * 1.8 * Math.PI) / 180;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s < 64; s++) {
      const th = (s / 64) * Math.PI * 2;
      const rx = refR * Math.cos(th) - refR * ecc;
      const rz = refR * Math.sqrt(1 - ecc * ecc) * Math.sin(th);
      const ry = Math.sin(th + idx * 0.6) * refR * Math.sin(incRad);
      pts.push(new THREE.Vector3(rx, ry, rz));
    }
    solarGroup.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.32 })
      )
    );
  });

  // Asteroid Belt InstancedMesh
  const asteroidBeltGroup = new THREE.Group();
  solarGroup.add(asteroidBeltGroup);
  const ASTEROID_COUNT = 220;
  const asteroidInstanced = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.06, 0),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.2 }),
    ASTEROID_COUNT
  );
  asteroidInstanced.castShadow = true;
  asteroidInstanced.receiveShadow = true;

  const dummyMatrix = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyRot = new THREE.Euler();
  const dummyQuat = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();
  const asteroidColor = new THREE.Color();

  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const angle = (i / ASTEROID_COUNT) * Math.PI * 2 + ((i % 7) - 3) * 0.03;
    const beltRadius = 4.2 + ((i % 13) - 6) * 0.05;
    const yOffset = ((i % 9) - 4) * 0.035;
    dummyPos.set(Math.cos(angle) * beltRadius, yOffset, Math.sin(angle) * beltRadius);
    dummyRot.set((i * 0.7) % Math.PI, (i * 1.1) % Math.PI, 0);
    dummyQuat.setFromEuler(dummyRot);
    const s = 0.55 + ((i * 17) % 10) * 0.1;
    dummyScale.set(s * 1.2, s * 0.8, s);
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
    asteroidInstanced.setMatrixAt(i, dummyMatrix);

    const shade = 0.52 + ((i % 5) * 0.09);
    asteroidColor.setRGB(shade, shade * 0.95, shade * 0.9);
    asteroidInstanced.setColorAt(i, asteroidColor);
  }
  asteroidInstanced.instanceMatrix.needsUpdate = true;
  if (asteroidInstanced.instanceColor) asteroidInstanced.instanceColor.needsUpdate = true;
  asteroidBeltGroup.add(asteroidInstanced);

  // Active Orbit Line & Glowing Trailing Arc
  const orbitGeo = new THREE.BufferGeometry();
  const orbitPositions = new Float32Array(96 * 3);
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
  solarGroup.add(new THREE.LineLoop(orbitGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8 })));

  const TRAIL_SEGS = 28;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_SEGS * 3), 3));
  const trailLine = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.78 })
  );
  solarGroup.add(trailLine);

  // Kepler's II Law Area Sweep Sector Mesh (Triangle Fan from Sun Focus)
  const SWEEP_STEPS = 12;
  const sweepGeo = new THREE.BufferGeometry();
  sweepGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SWEEP_STEPS * 9), 3));
  const sweepMesh = new THREE.Mesh(
    sweepGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  solarGroup.add(sweepMesh);

  // Planet Assembly (Body + Axial Tilt + Atmosphere + Rings + Moon)
  const planetAssembly = new THREE.Group();
  solarGroup.add(planetAssembly);

  const planetTiltGroup = new THREE.Group();
  planetTiltGroup.rotation.z = 0.32;
  planetAssembly.add(planetTiltGroup);

  const planetMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: planetSurfaceTex,
    roughness: 0.52,
    metalness: 0.08,
  });
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 36, 36), planetMat);
  planetMesh.name = 'Planet Orbit Kepler';
  planetMesh.castShadow = true;
  planetMesh.receiveShadow = true;
  planetMesh.userData = {
    draggableParam: 'customSemiMajorAxisAu',
    min: 0.4,
    max: 30.0,
    step: 0.5,
    label: 'Sumbu Semi-Mayor a (AU)',
  };
  planetTiltGroup.add(planetMesh);

  const planetCloudTex = createTerrestrialCloudTexture();
  const planetClouds = new THREE.Mesh(
    new THREE.SphereGeometry(0.392, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: planetCloudTex,
      transparent: true,
      opacity: 0.72,
      roughness: 0.85,
      depthWrite: false,
    })
  );
  planetTiltGroup.add(planetClouds);

  const planetAtmoMat = createFresnelCoronaMaterial(0xbae6fd, 0x0284c7, 1.05);
  planetTiltGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 32), planetAtmoMat));

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.84, 48),
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.6,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    })
  );
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.visible = false;
  planetTiltGroup.add(ringMesh);

  const moonPivot = new THREE.Group();
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 })
  );
  moonMesh.position.set(0.72, 0.06, 0);
  moonPivot.add(moonMesh);
  planetAssembly.add(moonPivot);

  // Subtle Perihelion & Aphelion Apsis Markers (visible for clearly eccentric orbits)
  const perihelionMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  perihelionMarker.name = 'Titik Perihelion (Terdekat)';
  perihelionMarker.visible = false;
  const aphelionMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  );
  aphelionMarker.name = 'Titik Aphelion (Terjauh)';
  aphelionMarker.visible = false;
  solarGroup.add(perihelionMarker, aphelionMarker);

  const keplerVelArrow = createVectorArrowGroup(0x38bdf8);
  const keplerGravArrow = createVectorArrowGroup(0xf59e0b);
  solarGroup.add(keplerVelArrow, keplerGravArrow);

  const tanDirVec = new THREE.Vector3();
  const gravDirVec = new THREE.Vector3();
  const anchorSunPos = new THREE.Vector3(0, 1.32, 0);
  const anchorPlanetPos = new THREE.Vector3();
  const anchorHzPos = new THREE.Vector3();
  const focusTargetVec = new THREE.Vector3();
  const focusCamPosVec = new THREE.Vector3();
  const anchorsObj: AstronomyConceptAnchors = {
    c1: { pos: anchorSunPos, text: 'Matahari (Fokus Elips)' },
    c2: { pos: anchorPlanetPos, text: '' },
    c3: undefined,
  };
  const anchorHzObj = { pos: anchorHzPos, text: '' };
  const updateResult: {
    anchors: AstronomyConceptAnchors;
    focusTarget?: THREE.Vector3;
    focusCamPos?: THREE.Vector3;
  } = {
    anchors: anchorsObj,
  };

  return {
    group: solarGroup,
    interactiveMeshes: [planetMesh],
    update: ({
      params: p,
      metrics: m,
      activePlanet,
      t,
      isLite,
      particleScale = isLite ? 0.5 : 1,
      showConceptLabels,
      isFocusPreset,
      isDragging,
    }) => {
      asteroidInstanced.count = Math.max(
        40,
        Math.round(ASTEROID_COUNT * (isLite ? Math.min(0.5, particleScale) : particleScale))
      );
      sunMesh.rotation.y = t * 0.14;
      sunStdMat.emissiveIntensity = 2.0 + Math.sin(t * 3.2) * 0.35;
      sunCoronaMat.uniforms.uTime.value = t;
      planetAtmoMat.uniforms.uTime.value = t;
      asteroidBeltGroup.rotation.y = t * 0.045;

      const starScale = 0.78 + Math.min(0.42, (p.centralStarMassSolar || 1) * 0.14);
      sunMesh.scale.setScalar(starScale);

      // Update Planet visual traits based on activePlanet preset
      if (activePlanet) {
        planetMat.color.setStyle(activePlanet.colorHex);
        ringMesh.visible = Boolean(activePlanet.hasRings);
        moonPivot.visible = activePlanet.moonsCount > 0;
        planetClouds.visible =
          activePlanet.id === 'bumi' || activePlanet.id === 'venus' || activePlanet.category === 'Planet Kebumian';
        const sizeBoost =
          activePlanet.category === 'Raksasa Gas'
            ? 1.24
            : activePlanet.category === 'Raksasa Es'
            ? 1.12
            : 0.96;
        planetTiltGroup.scale.setScalar(sizeBoost);
      }

      // Habitable Zone Ring bounds
      const hzIn = auToSceneRadius(m.habitableZoneInnerAu || 0.95);
      const hzOut = Math.max(hzIn + 0.35, auToSceneRadius(m.habitableZoneOuterAu || 1.37));
      const hzMid = (hzIn + hzOut) * 0.5;
      habitableZoneMesh.scale.setScalar(hzMid / 1.225);
      habitableZoneMat.uniforms.uColor.value.setHex(m.isInHabitableZone ? 0x10b981 : 0x38bdf8);
      habitableZoneMat.uniforms.uOpacity.value = m.isInHabitableZone ? 0.28 : 0.14;
      habitableZoneMat.uniforms.uTime.value = t;

      const a = p.customSemiMajorAxisAu || 1.0;
      const e = p.customEccentricity ?? 0.017;
      const incRad = ((3.2 + e * 14.0) * Math.PI) / 180;
      const scaledR = auToSceneRadius(a);

      const posAttr = orbitGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < 96; i++) {
        const eccAnomaly = (i / 96) * Math.PI * 2;
        const pt = evaluateKeplerOrbitPoint(eccAnomaly, a, e, scaledR, incRad);
        posAttr.setXYZ(i, pt.ox, pt.oy, pt.oz);
      }
      posAttr.needsUpdate = true;

      const showApsis = e >= 0.06;
      perihelionMarker.visible = showApsis;
      aphelionMarker.visible = showApsis;
      if (showApsis) {
        const periPt = evaluateKeplerOrbitPoint(0, a, e, scaledR, incRad);
        const aphPt = evaluateKeplerOrbitPoint(Math.PI, a, e, scaledR, incRad);
        perihelionMarker.position.set(periPt.ox, periPt.oy, periPt.oz);
        aphelionMarker.position.set(aphPt.ox, aphPt.oy, aphPt.oz);
      }

      const meanMotion = (Math.PI * 2) / Math.max(0.5, m.orbitalPeriodYears);
      const curM = (t * meanMotion) % (Math.PI * 2);
      const curE = solveKeplerEccentricAnomaly(curM, e);
      const curPt = evaluateKeplerOrbitPoint(curE, a, e, scaledR, incRad);
      planetAssembly.position.set(curPt.ox, curPt.oy, curPt.oz);
      planetMesh.rotation.y = t * 0.65;
      planetClouds.rotation.y = t * 0.84;
      moonPivot.rotation.y = t * 1.9;

      // Trailing orbital ribbon (sampled in equal mean-anomaly time steps)
      const trailAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL_SEGS; i++) {
        const backM = curM - (i / (TRAIL_SEGS - 1)) * 0.95;
        const backE = solveKeplerEccentricAnomaly(backM, e);
        const tp = evaluateKeplerOrbitPoint(backE, a, e, scaledR, incRad);
        trailAttr.setXYZ(i, tp.ox, tp.oy, tp.oz);
      }
      trailAttr.needsUpdate = true;

      // Kepler II Area Sweep Sector (equal ΔM spans sweep genuinely equal areas!)
      sweepMesh.visible = Boolean(p.showKeplerAreaSweep);
      if (sweepMesh.visible) {
        const sweepAttr = sweepGeo.getAttribute('position') as THREE.BufferAttribute;
        const sweepSpan = 0.52;
        for (let i = 0; i < SWEEP_STEPS; i++) {
          const m0 = curM - (i / SWEEP_STEPS) * sweepSpan;
          const m1 = curM - ((i + 1) / SWEEP_STEPS) * sweepSpan;
          const p0 = evaluateKeplerOrbitPoint(solveKeplerEccentricAnomaly(m0, e), a, e, scaledR, incRad);
          const p1 = evaluateKeplerOrbitPoint(solveKeplerEccentricAnomaly(m1, e), a, e, scaledR, incRad);
          const base = i * 9;
          sweepAttr.array[base] = 0;
          sweepAttr.array[base + 1] = 0;
          sweepAttr.array[base + 2] = 0;
          sweepAttr.array[base + 3] = p0.ox;
          sweepAttr.array[base + 4] = p0.oy;
          sweepAttr.array[base + 5] = p0.oz;
          sweepAttr.array[base + 6] = p1.ox;
          sweepAttr.array[base + 7] = p1.oy;
          sweepAttr.array[base + 8] = p1.oz;
        }
        sweepAttr.needsUpdate = true;
      }

      if (showConceptLabels) {
        tanDirVec.set(curPt.tangentX, curPt.tangentY, curPt.tangentZ);
        orientAndScaleVectorArrow(keplerVelArrow, planetAssembly.position, tanDirVec, 1.42);
        const distToSun = planetAssembly.position.length();
        const gravLen = Math.min(1.22, Math.max(0.55, distToSun - starScale * 0.85 - 0.35));
        gravDirVec.copy(planetAssembly.position).negate();
        orientAndScaleVectorArrow(keplerGravArrow, planetAssembly.position, gravDirVec, gravLen);
      } else {
        keplerVelArrow.visible = false;
        keplerGravArrow.visible = false;
      }

      anchorPlanetPos.copy(planetAssembly.position);
      anchorPlanetPos.y += 0.72;
      anchorsObj.c2!.text = `v = ${(m.meanOrbitalVelocityKms ?? 29.8).toFixed(1)} km/s · e = ${e.toFixed(2)}`;
      if (m.isInHabitableZone) {
        anchorHzPos.set(-hzMid * 0.92, -0.35, -hzMid * 0.45);
        anchorHzObj.text = `Zona Laik Huni (${m.habitableZoneInnerAu.toFixed(2)}–${m.habitableZoneOuterAu.toFixed(2)} AU)`;
        anchorsObj.c3 = anchorHzObj;
      } else {
        anchorsObj.c3 = undefined;
      }

      if (isFocusPreset && !isDragging) {
        focusTargetVec.copy(planetAssembly.position);
        focusCamPosVec.set(curPt.ox + 1.9, curPt.oy + 1.4, curPt.oz + 3.2);
        updateResult.focusTarget = focusTargetVec;
        updateResult.focusCamPos = focusCamPosVec;
      } else {
        updateResult.focusTarget = undefined;
        updateResult.focusCamPos = undefined;
      }
      return updateResult;
    },
    dispose: () => {
      sunPhotosphereTex.dispose();
      planetSurfaceTex?.dispose();
    },
  };
}

// =====================================================================
// RIG 2: MILKY WAY GALAXY ROTATION & DARK MATTER HALO
// =====================================================================
export function buildMilkyWayRig(): AstronomyRigHandle {
  const milkyWayGroup = new THREE.Group();
  const starSpriteTex = createRadialGlowTexture();

  const sgrABulge = new THREE.Mesh(
    new THREE.SphereGeometry(0.88, 28, 28),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.1,
      roughness: 0.25,
    })
  );
  milkyWayGroup.add(sgrABulge);

  const accretionRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.06, 12, 48),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5 })
  );
  accretionRing.rotation.x = Math.PI / 2;
  milkyWayGroup.add(accretionRing);

  // Dark Matter Halo Outer Shell
  const dmHaloMat = createFresnelCoronaMaterial(0x818cf8, 0xa855f7, 0.95);
  const dmHaloMesh = new THREE.Mesh(new THREE.SphereGeometry(8.8, 32, 32), dmHaloMat);
  milkyWayGroup.add(dmHaloMesh);

  // Spiral Arms Particle Disk (1600 colored stars with radial glow map)
  const GALAXY_PARTICLES = 1600;
  const diskPositions = new Float32Array(GALAXY_PARTICLES * 3);
  const diskColors = new Float32Array(GALAXY_PARTICLES * 3);
  const coreCol = new THREE.Color(0xfef08a);
  const armCol = new THREE.Color(0x38bdf8);
  const mixCol = new THREE.Color();

  for (let i = 0; i < GALAXY_PARTICLES; i++) {
    const u = ((i * 73) % 1000) / 1000;
    const r = 1.1 + Math.pow(u, 1.35) * 8.4;
    const arm = (i % 2) * Math.PI + ((i % 4) >= 2 ? 0.35 : 0);
    const scatter = (((i * 31) % 100) / 100 - 0.5) * (0.45 + r * 0.04);
    const spiralTheta = arm + r * 0.85 + scatter;
    diskPositions[i * 3] = r * Math.cos(spiralTheta);
    diskPositions[i * 3 + 1] = ((((i * 19) % 100) / 100) - 0.5) * 0.45 * Math.exp(-r / 4.2);
    diskPositions[i * 3 + 2] = r * Math.sin(spiralTheta);

    mixCol.copy(coreCol).lerp(armCol, Math.min(1, (r - 1.0) / 6.0));
    diskColors[i * 3] = mixCol.r;
    diskColors[i * 3 + 1] = mixCol.g;
    diskColors[i * 3 + 2] = mixCol.b;
  }
  const diskGeo = new THREE.BufferGeometry();
  diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPositions, 3));
  diskGeo.setAttribute('color', new THREE.BufferAttribute(diskColors, 3));
  const diskParticles = new THREE.Points(
    diskGeo,
    new THREE.PointsMaterial({
      size: 0.34,
      map: starSpriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  milkyWayGroup.add(diskParticles);

  // Guide ring at active galactocentric radius
  const radiusGuideRing = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.03, 64),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  radiusGuideRing.rotation.x = -Math.PI / 2;
  milkyWayGroup.add(radiusGuideRing);

  // Observed Marker Star (with Dark Matter boost)
  const galacticMarkerStar = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 1.5,
    })
  );
  galacticMarkerStar.name = 'Bintang Pelacak (Kecepatan Observasi)';
  galacticMarkerStar.userData = {
    draggableParam: 'galactocentricRadiusKpc',
    min: 1.0,
    max: 25.0,
    step: 0.5,
    label: 'Radius Galaksi R (kpc)',
  };
  milkyWayGroup.add(galacticMarkerStar);

  // Theoretical Keplerian Ghost Reference Star (without Dark Matter)
  const keplerGhostStar = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.85,
    })
  );
  milkyWayGroup.add(keplerGhostStar);

  const observedVelArrow = createVectorArrowGroup(0x38bdf8);
  const keplerVelArrow = createVectorArrowGroup(0xf43f5e);
  milkyWayGroup.add(observedVelArrow, keplerVelArrow);

  let obsAngle = 0;
  let kepAngle = 0;
  let prevT = 0;
  const obsDirVec = new THREE.Vector3();
  const kepDirVec = new THREE.Vector3();
  const anchorCorePos = new THREE.Vector3(0, 1.3, 0);
  const anchorObsPos = new THREE.Vector3();
  const anchorKepPos = new THREE.Vector3();
  const anchorsObj: AstronomyConceptAnchors = {
    c1: { pos: anchorCorePos, text: 'Sgr A* (Pusat Bima Sakti)' },
    c2: { pos: anchorObsPos, text: '' },
    c3: { pos: anchorKepPos, text: '' },
  };
  const updateResult = { anchors: anchorsObj };

  return {
    group: milkyWayGroup,
    interactiveMeshes: [galacticMarkerStar],
    update: ({ params: p, metrics: m, t, isLite, particleScale = isLite ? 0.5 : 1, showConceptLabels }) => {
      const dt = Math.max(0, Math.min(0.1, Math.abs(t - prevT)));
      prevT = t;

      const effectiveScale = isLite ? Math.min(0.5, particleScale) : particleScale;
      diskGeo.setDrawRange(0, Math.max(300, Math.round(GALAXY_PARTICLES * effectiveScale)));

      diskParticles.rotation.y = t * 0.12;
      accretionRing.rotation.z = t * 0.7;

      const dmFrac = p.darkMatterHaloFraction ?? 0.5;
      dmHaloMat.uniforms.uTime.value = t;
      dmHaloMat.uniforms.uIntensity.value = 0.2 + dmFrac * 0.85;
      dmHaloMesh.visible = dmFrac > 0.02;

      const rKpc = p.galactocentricRadiusKpc || 8.2;
      const rScaled = Math.min(8.5, Math.max(1.2, (rKpc / 25.0) * 8.5));
      radiusGuideRing.scale.setScalar(rScaled);

      const vObs = m.observedDarkMatterVelocityKms ?? 220;
      const vKep = m.keplerianVelocityKms ?? 140;
      obsAngle += dt * (0.25 + vObs / 320);
      kepAngle += dt * (0.25 + vKep / 320);

      galacticMarkerStar.position.set(rScaled * Math.cos(obsAngle), 0, rScaled * Math.sin(obsAngle));
      keplerGhostStar.position.set(rScaled * Math.cos(kepAngle), 0.35, rScaled * Math.sin(kepAngle));

      if (showConceptLabels) {
        obsDirVec.set(-Math.sin(obsAngle), 0, Math.cos(obsAngle));
        orientAndScaleVectorArrow(
          observedVelArrow,
          galacticMarkerStar.position,
          obsDirVec,
          Math.max(0.6, (vObs / 250) * 2.1)
        );
        kepDirVec.set(-Math.sin(kepAngle), 0, Math.cos(kepAngle));
        orientAndScaleVectorArrow(
          keplerVelArrow,
          keplerGhostStar.position,
          kepDirVec,
          Math.max(0.5, (vKep / 250) * 2.1)
        );
      } else {
        observedVelArrow.visible = false;
        keplerVelArrow.visible = false;
      }

      anchorObsPos.copy(galacticMarkerStar.position);
      anchorObsPos.y += 0.75;
      anchorKepPos.copy(keplerGhostStar.position);
      anchorKepPos.y += 0.7;
      anchorsObj.c2!.text = `v_obs = ${vObs.toFixed(0)} km/s · R = ${rKpc.toFixed(1)} kpc`;
      anchorsObj.c3!.text = `Prediksi Kepler: ${vKep.toFixed(0)} km/s (Tanpa DM)`;
      return updateResult;
    },
    dispose: () => {
      starSpriteTex.dispose();
    },
  };
}

// =====================================================================
// RIG 3: EXOPLANET TRANSIT PHOTOMETRY & 3D LIGHT-CURVE
// =====================================================================
export function buildExoplanetTransitRig(): AstronomyRigHandle {
  const transitGroup = new THREE.Group();
  const hostStarTex = createSolarPhotosphereTexture();
  const exoSurfaceTex = createPlanetSurfaceTexture({
    baseHex: '#1d4ed8',
    accentHex: '#38bdf8',
    style: 'gas-giant',
  });

  // Limb-darkened Host Star
  const hostStarMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    map: hostStarTex,
    emissive: 0xf59e0b,
    emissiveMap: hostStarTex,
    emissiveIntensity: 2.0,
    roughness: 0.3,
  });
  const hostStarMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, 40, 40), hostStarMat);
  hostStarMesh.position.set(0, 0.85, 0);
  hostStarMesh.name = 'Bintang Induk Transit';
  transitGroup.add(hostStarMesh);

  const hostCoronaMat = createFresnelCoronaMaterial(0xfef08a, 0xf97316, 1.35);
  hostStarMesh.add(new THREE.Mesh(new THREE.SphereGeometry(1.92, 32, 32), hostCoronaMat));

  // Equatorial Orbital Ring around Host Star
  const orbitRingMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
  const orbitRingPts: THREE.Vector3[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    orbitRingPts.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
  }
  const transitOrbitLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(orbitRingPts),
    orbitRingMat
  );
  transitOrbitLine.position.set(0, 0.85, 0);
  transitGroup.add(transitOrbitLine);

  // Transiting Exoplanet (draggable to tune exoplanetRadiusEarth) + Atmospheric Limb Halo
  const exoplanetMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: exoSurfaceTex,
    roughness: 0.65,
    metalness: 0.1,
  });
  const exoplanetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 32), exoplanetMat);
  exoplanetMesh.name = 'Eksoplanet Transit';
  exoplanetMesh.userData = {
    draggableParam: 'exoplanetRadiusEarth',
    min: 0.5,
    max: 15.0,
    step: 0.5,
    label: 'Radius Eksoplanet Rp (R⊕)',
  };
  const exoAtmoMat = createFresnelCoronaMaterial(0x7dd3fc, 0x0284c7, 1.15);
  exoplanetMesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.365, 24, 24), exoAtmoMat));
  transitGroup.add(exoplanetMesh);

  // Observer Telescope Sightline Cone (+Z Photometer Collector)
  const sightConeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sightCone = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.25, 5.5, 24, 1, true), sightConeMat);
  sightCone.rotation.x = Math.PI / 2;
  sightCone.position.set(0, 0.85, 4.2);
  transitGroup.add(sightCone);

  // Multi-Part Space Photometer Observatory (Kepler / TESS Style Spacecraft)
  const observatoryGroup = new THREE.Group();
  observatoryGroup.position.set(0, 0.85, 7.2);
  const telescopePod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.46, 0.95, 24),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.28 })
  );
  telescopePod.rotation.x = Math.PI / 2;
  telescopePod.name = 'Teleskop Fotometer Ruang Angkasa';
  const sunshieldBaffle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.38, 0.42, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.86,
      roughness: 0.22,
      side: THREE.DoubleSide,
    })
  );
  sunshieldBaffle.rotation.x = Math.PI / 2;
  sunshieldBaffle.position.z = -0.66;
  const ccdPrimaryMirror = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 24),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      metalness: 0.9,
      roughness: 0.1,
      side: THREE.DoubleSide,
    })
  );
  ccdPrimaryMirror.position.z = -0.46;
  const kaptonBus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.48, 8),
    new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.26 })
  );
  kaptonBus.rotation.x = Math.PI / 2;
  kaptonBus.position.z = 0.56;
  const solarArrayMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.32,
    metalness: 0.55,
    roughness: 0.24,
  });
  [-1, 1].forEach((side) => {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    strut.rotation.z = Math.PI / 2;
    strut.position.set(side * 0.65, 0, 0.35);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.44, 0.035), solarArrayMat);
    wing.position.set(side * 1.32, 0, 0.35);
    wing.rotation.x = 0.25;
    observatoryGroup.add(strut, wing);
  });
  observatoryGroup.add(telescopePod, sunshieldBaffle, ccdPrimaryMirror, kaptonBus);
  transitGroup.add(observatoryGroup);

  // 3D Live Light-Curve Dip Hologram Board below the star
  const lcCanvas = document.createElement('canvas');
  lcCanvas.width = 512;
  lcCanvas.height = 180;
  const lcTex = new THREE.CanvasTexture(lcCanvas);
  lcTex.colorSpace = THREE.SRGBColorSpace;
  const lcBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.95),
    new THREE.MeshBasicMaterial({ map: lcTex, transparent: true, opacity: 0.94, side: THREE.DoubleSide })
  );
  lcBoard.position.set(0, -2.35, 1.2);
  lcBoard.rotation.x = -0.28;
  transitGroup.add(lcBoard);

  let lastLcParamKey = '';
  let lastLcPhase = -1;
  const anchorStarPos = new THREE.Vector3();
  const anchorPlanetPos = new THREE.Vector3();
  const anchorCurvePos = new THREE.Vector3(0, -1.25, 1.5);
  const focusTargetConst = new THREE.Vector3(0, 0.85, 0);
  const focusCamPosConst = new THREE.Vector3(0, 1.3, 8.8);
  const anchorsObj: AstronomyConceptAnchors = {
    c1: { pos: anchorStarPos, text: '' },
    c2: { pos: anchorPlanetPos, text: '' },
    c3: { pos: anchorCurvePos, text: '' },
  };
  const updateResult: {
    anchors: AstronomyConceptAnchors;
    focusTarget?: THREE.Vector3;
    focusCamPos?: THREE.Vector3;
  } = {
    anchors: anchorsObj,
  };

  return {
    group: transitGroup,
    interactiveMeshes: [exoplanetMesh],
    update: ({ params: p, metrics: m, t, isFocusPreset, isDragging }) => {
      const starR = p.starRadiusSolar || 1.0;
      const starVisualScale = Math.min(1.65, Math.max(0.65, 0.92 * Math.pow(starR, 0.35)));
      hostStarMesh.scale.setScalar(starVisualScale);
      hostStarMat.color.setStyle(m.starColorHex);
      hostStarMat.emissive.setStyle(m.starColorHex);
      hostCoronaMat.uniforms.uTime.value = t;
      hostCoronaMat.uniforms.uCoreColor.value.setStyle(m.starColorHex);
      hostCoronaMat.uniforms.uRimColor.value.setStyle(m.starColorHex);
      exoAtmoMat.uniforms.uTime.value = t;

      const orbitAu = p.exoplanetOrbitAu || 0.05;
      const orbitVisualScale = Math.min(4.8, Math.max(1.8, 1.85 + Math.log10(orbitAu + 0.25) * 1.45));
      transitOrbitLine.scale.set(orbitVisualScale, 1, orbitVisualScale);

      const rp = p.exoplanetRadiusEarth || 1.0;
      const planetVisualScale = Math.min(1.5, Math.max(0.32, 0.28 + rp * 0.075));
      exoplanetMesh.scale.setScalar(planetVisualScale);

      const phase01 = (t * 0.16) % 1;
      const angle = (phase01 - 0.5) * Math.PI * 2;
      exoplanetMesh.position.set(
        Math.sin(angle) * orbitVisualScale,
        0.85,
        Math.cos(angle) * orbitVisualScale
      );
      exoplanetMesh.rotation.y = t * 0.8;

      const sample = computeTransitLightCurveSample(phase01, starR, rp, orbitAu);
      sightConeMat.color.setHex(sample.inTransit ? 0xf59e0b : 0x38bdf8);
      sightConeMat.opacity = sample.inTransit ? 0.16 : 0.07;

      const lcParamKey = `${starR.toFixed(2)}|${rp.toFixed(2)}|${orbitAu.toFixed(3)}|${sample.inTransit}`;
      const phaseMoved =
        lastLcPhase < 0 ||
        Math.abs(phase01 - lastLcPhase) >= 0.008 ||
        phase01 < lastLcPhase;
      if (lcParamKey !== lastLcParamKey || phaseMoved) {
        lastLcParamKey = lcParamKey;
        lastLcPhase = phase01;
        // Render crisp 3D Light-Curve Plot on Hologram Canvas (memoized + throttled)
        const ctx = lcCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#070d19';
          ctx.fillRect(0, 0, lcCanvas.width, lcCanvas.height);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(2, 2, lcCanvas.width - 4, lcCanvas.height - 4);

          // Baseline grid & label
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(28, 46);
          ctx.lineTo(lcCanvas.width - 18, 46);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 12px monospace';
          ctx.fillText('KURVA CAHAYA FOTOMETRI TRANSIT (FLuks Relatif)', 28, 22);
          ctx.fillStyle = sample.inTransit ? '#fbbf24' : '#38bdf8';
          ctx.fillText(
            `ΔF/F = ${m.transitDepthPct.toFixed(3)}% (${Math.round(m.transitDepthPpm)} ppm)${sample.inTransit ? ' · TRANSIT AKTIF' : ''}`,
            28,
            164
          );

          // Plot curve across phase [0..1]
          const plotL = 28;
          const plotW = lcCanvas.width - 46;
          const plotTop = 46;
          const plotRangeY = 84;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i <= 100; i++) {
            const ph = i / 100;
            const pt = computeTransitLightCurveSample(ph, starR, rp, orbitAu);
            const x = plotL + ph * plotW;
            const y = plotTop + (1 - pt.visualFluxRatio) * (plotRangeY / 0.32);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Live Phase Marker Dot
          const curX = plotL + phase01 * plotW;
          const curY = plotTop + (1 - sample.visualFluxRatio) * (plotRangeY / 0.32);
          ctx.fillStyle = sample.inTransit ? '#fbbf24' : '#f8fafc';
          ctx.beginPath();
          ctx.arc(curX, curY, 6, 0, Math.PI * 2);
          ctx.fill();
          lcTex.needsUpdate = true;
        }
      }

      anchorStarPos.set(0, 0.85 + starVisualScale * 1.65, 0);
      anchorsObj.c1!.text = `Bintang R* = ${starR.toFixed(1)} R☉ (${m.spectralClass})`;
      anchorPlanetPos.copy(exoplanetMesh.position);
      anchorPlanetPos.y += 0.75;
      anchorsObj.c2!.text = `Eksoplanet Rp = ${rp.toFixed(1)} R⊕ · a = ${orbitAu.toFixed(2)} AU`;
      anchorsObj.c3!.text = `Kedalaman ΔF/F = ${m.transitDepthPct.toFixed(3)}%${sample.inTransit ? ' (Transit!)' : ''}`;

      if (isFocusPreset && !isDragging) {
        updateResult.focusTarget = focusTargetConst;
        updateResult.focusCamPos = focusCamPosConst;
      } else {
        updateResult.focusTarget = undefined;
        updateResult.focusCamPos = undefined;
      }
      return updateResult;
    },
    dispose: () => {
      hostStarTex.dispose();
      exoSurfaceTex?.dispose();
      lcTex.dispose();
    },
  };
}

// =====================================================================
// RIG 4: STELLAR WIEN SPECTRUM & BOROSILICATE DISPERSION PRISM
// =====================================================================
export function buildWienSpectrumRig(initialLite: boolean): AstronomyRigHandle {
  const wienGroup = new THREE.Group();
  const wienPhotosphereTex = createSolarPhotosphereTexture();

  const wienStarMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    map: wienPhotosphereTex,
    emissive: 0xfacc15,
    emissiveMap: wienPhotosphereTex,
    emissiveIntensity: 1.8,
    roughness: 0.34,
  });
  const wienStar = new THREE.Mesh(new THREE.SphereGeometry(1.75, 32, 32), wienStarMat);
  wienStar.position.set(-4.5, 0, 0);
  wienStar.name = 'Fotosfer Bintang Wien';
  wienStar.userData = {
    draggableParam: 'starEffectiveTempK',
    min: 2500,
    max: 35000,
    step: 250,
    label: 'Suhu Fotosfer T (K)',
  };
  wienGroup.add(wienStar);

  const wienCoronaMat = createFresnelCoronaMaterial(0xfef08a, 0xf59e0b);
  wienStar.add(new THREE.Mesh(new THREE.SphereGeometry(2.26, 32, 32), wienCoronaMat));

  // Optical Dispersion Prism with Shared Borosilicate Glass + Grounded Optical Stand
  const opticalBenchMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.34,
  });
  const brassCollarMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.85,
    roughness: 0.28,
  });

  const prismGeo = new THREE.CylinderGeometry(0.92, 0.92, 2.2, 3);
  prismGeo.rotateX(Math.PI / 2);
  const prismMat = createBorosilicateGlassMaterial(initialLite, {
    color: 0xe0f2fe,
    tintOpacity: 0.24,
    ior: 1.52,
    thickness: 0.9,
  });
  const prismMesh = new THREE.Mesh(prismGeo, prismMat);
  prismMesh.position.set(-0.5, 0, 0);
  prismMesh.name = 'Prisma Dispersi Borosilikat';
  wienGroup.add(prismMesh);

  // Grounded Anodized Pedestal under Optical Prism
  const prismPedestalGroup = new THREE.Group();
  prismPedestalGroup.position.set(-0.5, -1.35, 0);
  const prismTable = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.94, 0.14, 24), opticalBenchMat);
  prismTable.position.y = 0.82;
  const prismCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 18), brassCollarMat);
  prismCollar.position.y = 0.66;
  const prismStem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.35, 16), opticalBenchMat);
  prismStem.position.y = -0.04;
  const prismFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.16, 24), opticalBenchMat);
  prismFoot.position.y = -0.74;
  prismPedestalGroup.add(prismTable, prismCollar, prismStem, prismFoot);
  wienGroup.add(prismPedestalGroup);

  // Incoming starlight beam + dispersed fan rays
  const starlightBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
  });
  const starlightBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.8, 12), starlightBeamMat);
  starlightBeam.rotation.z = Math.PI / 2;
  starlightBeam.position.set(-2.5, 0, 0);
  wienGroup.add(starlightBeam);

  // Dispersed fan beam bands (Violet, Cyan, Yellow, Red) from prism to screen
  const fanColors = [0x8b5cf6, 0x06b6d4, 0xfacc15, 0xef4444];
  fanColors.forEach((hex, idx) => {
    const offset = (idx - 1.5) * 0.26;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 4.1, 8),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.42 })
    );
    beam.rotation.z = Math.PI / 2 - offset * 0.22;
    beam.position.set(1.65, offset * 0.45, 0);
    wienGroup.add(beam);
  });

  // Combined Planck Curve + Rainbow Absorption Spectrum Screen inside Grounded Metallic Frame
  const spectrumCanvas = document.createElement('canvas');
  spectrumCanvas.width = 512;
  spectrumCanvas.height = 192;
  const spectrumTexture = new THREE.CanvasTexture(spectrumCanvas);
  spectrumTexture.colorSpace = THREE.SRGBColorSpace;
  const spectrumScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 2.25),
    new THREE.MeshBasicMaterial({ map: spectrumTexture, side: THREE.DoubleSide })
  );
  spectrumScreen.position.set(3.85, 0, 0);
  wienGroup.add(spectrumScreen);

  const screenFrameGroup = new THREE.Group();
  screenFrameGroup.position.set(3.85, 0, -0.05);
  const frameBackplate = new THREE.Mesh(new THREE.BoxGeometry(4.22, 2.46, 0.08), opticalBenchMat);
  const frameLeftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 12), opticalBenchMat);
  frameLeftPost.position.set(-1.55, -1.62, 0);
  const frameRightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 12), opticalBenchMat);
  frameRightPost.position.set(1.55, -1.62, 0);
  const frameRailBase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 0.72), opticalBenchMat);
  frameRailBase.position.set(0, -2.12, 0);
  screenFrameGroup.add(frameBackplate, frameLeftPost, frameRightPost, frameRailBase);
  wienGroup.add(screenFrameGroup);

  let lastSpectrumKey = '';
  const anchorStarPos = new THREE.Vector3(-4.5, 2.35, 0);
  const anchorScreenPos = new THREE.Vector3(3.85, 1.45, 0);
  const anchorsObj: AstronomyConceptAnchors = {
    c1: { pos: anchorStarPos, text: '' },
    c2: { pos: anchorScreenPos, text: '' },
  };
  const updateResult = { anchors: anchorsObj };

  return {
    group: wienGroup,
    interactiveMeshes: [wienStar],
    onLiteChange: (isLite) => {
      applyBorosilicateLiteMode(prismMat, isLite);
    },
    update: ({ params: p, metrics: m, t }) => {
      wienStarMat.color.setStyle(m.starColorHex);
      wienStarMat.emissive.setStyle(m.starColorHex);
      starlightBeamMat.color.setStyle(m.starColorHex);
      wienCoronaMat.uniforms.uTime.value = t;
      wienCoronaMat.uniforms.uCoreColor.value.setStyle(m.starColorHex);
      wienCoronaMat.uniforms.uRimColor.value.setStyle(m.starColorHex);

      const tempK = Math.max(2500, p.starEffectiveTempK || 5800);
      const peakLambda = m.wienPeakWavelengthNm ?? 2.89777e6 / tempK;
      const specKey = `${Math.round(tempK)}|${peakLambda.toFixed(0)}|${m.starColorHex}|${m.spectralClass}`;
      if (specKey !== lastSpectrumKey) {
        lastSpectrumKey = specKey;
        const sCtx = spectrumCanvas.getContext('2d');
        if (sCtx) {
          const W = spectrumCanvas.width;
          const H = spectrumCanvas.height;
          sCtx.fillStyle = '#070b14';
          sCtx.fillRect(0, 0, W, H);

          // Top half (y: 0..108): Planck Blackbody Intensity Curve
          const lambdaMin = 150;
          const lambdaMax = 1100;

          const planckRaw = (nm: number) => {
            const x = (nm / 1000) * (tempK / 5800);
            return Math.pow(1 / Math.max(0.15, x), 5) / (Math.exp(2.47 / Math.max(0.15, x)) - 1);
          };
          let maxCurveVal = 1e-6;
          for (let nm = lambdaMin; nm <= lambdaMax; nm += 15) {
            maxCurveVal = Math.max(maxCurveVal, planckRaw(nm));
          }

          sCtx.strokeStyle = m.starColorHex || '#facc15';
          sCtx.lineWidth = 3;
          sCtx.beginPath();
          for (let px = 0; px <= W; px += 4) {
            const nm = lambdaMin + (px / W) * (lambdaMax - lambdaMin);
            const norm = Math.min(1, planckRaw(nm) / maxCurveVal);
            const py = 102 - norm * 82;
            if (px === 0) sCtx.moveTo(px, py);
            else sCtx.lineTo(px, py);
          }
          sCtx.stroke();

          // Peak λmax dashed marker
          const peakNormX = Math.max(
            8,
            Math.min(W - 8, ((peakLambda - lambdaMin) / (lambdaMax - lambdaMin)) * W)
          );
          sCtx.strokeStyle = '#38bdf8';
          sCtx.setLineDash([4, 3]);
          sCtx.beginPath();
          sCtx.moveTo(peakNormX, 12);
          sCtx.lineTo(peakNormX, 108);
          sCtx.stroke();
          sCtx.setLineDash([]);

          sCtx.fillStyle = '#e2e8f0';
          sCtx.font = 'bold 12px monospace';
          sCtx.fillText(`λmax = ${peakLambda.toFixed(0)} nm (${m.spectralClass})`, 12, 18);

          // Bottom half (y: 112..192): Rainbow Spectrum with Fraunhofer Absorption Lines
          const grad = sCtx.createLinearGradient(0, 0, W, 0);
          grad.addColorStop(0, '#7c3aed');
          grad.addColorStop(0.22, '#2563eb');
          grad.addColorStop(0.42, '#10b981');
          grad.addColorStop(0.66, '#facc15');
          grad.addColorStop(0.84, '#f97316');
          grad.addColorStop(1.0, '#ef4444');
          sCtx.fillStyle = grad;
          sCtx.fillRect(0, 112, W, 80);

          sCtx.fillStyle = '#050811';
          const lineAnchor = ((Math.max(380, Math.min(720, peakLambda)) - 380) / 340) * W;
          [lineAnchor - 35, lineAnchor, lineAnchor + 45, 310, 415].forEach((lx, idx) => {
            const clampedX = Math.max(10, Math.min(W - 14, lx));
            sCtx.fillRect(clampedX, 112, idx === 1 ? 4 : 2, 80);
          });
          spectrumTexture.needsUpdate = true;
        }
      }

      anchorsObj.c1!.text = `Fotosfer T* = ${Math.round(p.starEffectiveTempK ?? 5778)} K`;
      anchorsObj.c2!.text = `Puncak Wien λmax = ${(m.wienPeakWavelengthNm ?? 502).toFixed(0)} nm`;
      return updateResult;
    },
    dispose: () => {
      wienPhotosphereTex.dispose();
      spectrumTexture.dispose();
    },
  };
}

// =====================================================================
// RIG 5: HUBBLE EXPANSION & DOPPLER REDSHIFT WAVEFRONT
// =====================================================================
export function buildHubbleExpansionRig(): AstronomyRigHandle {
  const hubbleGroup = new THREE.Group();
  const spiralTex = createSpiralGalaxyTexture();
  const earthObserverTex = createPlanetSurfaceTexture({
    baseHex: '#0284c7',
    accentHex: '#22c55e',
    style: 'terrestrial',
  });

  const cosmicGrid = new THREE.GridHelper(30, 20, 0x334155, 0x1e293b);
  cosmicGrid.position.y = -2.5;
  (cosmicGrid.material as THREE.Material).transparent = true;
  (cosmicGrid.material as THREE.Material).opacity = 0.35;
  hubbleGroup.add(cosmicGrid);

  // Terrestrial Earth Observer + Atmospheric Corona + Orbiting Space Telescope (HST/JWST)
  const mwObserver = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 28, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: earthObserverTex,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.48,
    })
  );
  mwObserver.name = 'Bumi & Observatorium Antariksa';
  const earthAtmoMat = createFresnelCoronaMaterial(0x7dd3fc, 0x0284c7, 1.15);
  mwObserver.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 24), earthAtmoMat));
  hubbleGroup.add(mwObserver);

  const observerOrbitPivot = new THREE.Group();
  observerOrbitPivot.rotation.z = 0.28;
  const observerOrbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.012, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
  );
  observerOrbitRing.rotation.x = Math.PI / 2;
  const hstBus = new THREE.Group();
  hstBus.position.set(0.95, 0, 0);
  const hstTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.095, 0.28, 14),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.22 })
  );
  hstTube.rotation.z = Math.PI / 2;
  const hstMirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.03, 6),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 })
  );
  hstMirror.rotation.z = Math.PI / 2;
  hstMirror.position.x = 0.14;
  const hstSolarWings = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.015, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x1e3a8a, emissiveIntensity: 0.35 })
  );
  hstBus.add(hstTube, hstMirror, hstSolarWings);
  observerOrbitPivot.add(observerOrbitRing, hstBus);
  hubbleGroup.add(observerOrbitPivot);

  // 3D Cosmological Redshift Spectrograph Comparison Board below the observer
  const rsCanvas = document.createElement('canvas');
  rsCanvas.width = 512;
  rsCanvas.height = 140;
  const rsTex = new THREE.CanvasTexture(rsCanvas);
  rsTex.colorSpace = THREE.SRGBColorSpace;
  const rsBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.42),
    new THREE.MeshBasicMaterial({ map: rsTex, transparent: true, opacity: 0.94, side: THREE.DoubleSide })
  );
  rsBoard.position.set(0, -1.72, 2.35);
  rsBoard.rotation.x = -0.32;
  hubbleGroup.add(rsBoard);

  const GALAXY_COUNT = 6;
  const distantGalaxies: {
    group: THREE.Group;
    diskMat: THREE.MeshBasicMaterial;
    coreMat: THREE.MeshStandardMaterial;
    arrow: THREE.Group;
    baseAngle: number;
    distMult: number;
    yOff: number;
  }[] = [];

  for (let i = 0; i < GALAXY_COUNT; i++) {
    const gGroup = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.3,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), coreMat);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      map: spiralTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const disk = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), diskMat);
    disk.rotation.x = -Math.PI / 2 + 0.42 * (i % 2 === 0 ? 1 : -1);
    disk.rotation.z = i * 0.7;
    gGroup.add(core, disk);

    // Hit proxy sphere so user can drag any receding galaxy smoothly
    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitMesh.name = `Galaksi Jauh #${i + 1}`;
    hitMesh.userData = {
      draggableParam: 'galaxyDistanceMpc',
      min: 20,
      max: 600,
      step: 20,
      label: 'Jarak Galaksi d (Mpc)',
    };
    gGroup.add(hitMesh);
    hubbleGroup.add(gGroup);

    const arrow = createVectorArrowGroup(0xef4444);
    hubbleGroup.add(arrow);

    distantGalaxies.push({
      group: gGroup,
      diskMat,
      coreMat,
      arrow,
      baseAngle: (i * Math.PI * 2) / GALAXY_COUNT,
      distMult: i === 0 ? 1.0 : 0.72 + ((i * 19) % 40) / 100,
      yOff: ((i % 3) - 1) * 0.55,
    });
  }

  // Stretched Redshifted Electromagnetic Wave Ribbon from Galaxy #0 to Observer
  const WAVE_PTS = 48;
  const waveGeo = new THREE.BufferGeometry();
  waveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WAVE_PTS * 3), 3));
  const waveMat = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 });
  const waveLine = new THREE.Line(waveGeo, waveMat);
  hubbleGroup.add(waveLine);

  const interactiveMeshes: THREE.Object3D[] = [];
  distantGalaxies.forEach((dg) => {
    const proxy = dg.group.children.find((c) => c.userData?.draggableParam);
    if (proxy) interactiveMeshes.push(proxy);
  });

  const arrowOriginVec = new THREE.Vector3();
  const arrowDirVec = new THREE.Vector3();
  const anchorMidPos = new THREE.Vector3();
  const anchorObsPos = new THREE.Vector3(0, 0.9, 0);
  const anchorGalPos = new THREE.Vector3();
  const anchorsObj: AstronomyConceptAnchors = {
    c1: { pos: anchorMidPos, text: '' },
    c2: { pos: anchorObsPos, text: 'Bumi / Pengamat' },
    c3: { pos: anchorGalPos, text: '' },
  };
  const updateResult = { anchors: anchorsObj };
  let lastRsKey = '';

  return {
    group: hubbleGroup,
    interactiveMeshes,
    update: ({ params: p, metrics: m, t }) => {
      mwObserver.rotation.y = t * 0.35;
      earthAtmoMat.uniforms.uTime.value = t;
      observerOrbitPivot.rotation.y = t * 0.95;

      const dMpc = p.galaxyDistanceMpc ?? 150;
      const dScale = Math.min(10.5, Math.max(2.5, (dMpc / 600) * 10.5));
      const recVel = m.hubbleRecessionVelocityKmS ?? 10500;
      const z = m.hubbleRedshiftZ ?? 0.035;
      const arrowLen = Math.min(3.2, (recVel / 42000) * 3.2);
      const shiftHex = redshiftToGalaxyColorHex(z);
      const waveColorHex = wavelengthNmToHex(Math.min(740, 460 + z * 1650));

      const rsKey = `${dMpc.toFixed(0)}_${z.toFixed(4)}_${Math.round(recVel)}`;
      if (rsKey !== lastRsKey) {
        lastRsKey = rsKey;
        const rCtx = rsCanvas.getContext('2d');
        if (rCtx) {
          const W = rsCanvas.width;
          const H = rsCanvas.height;
          rCtx.fillStyle = '#070b14';
          rCtx.fillRect(0, 0, W, H);
          rCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          rCtx.lineWidth = 2;
          rCtx.strokeRect(2, 2, W - 4, H - 4);

          const specGrad = rCtx.createLinearGradient(24, 0, W - 24, 0);
          specGrad.addColorStop(0, '#7c3aed');
          specGrad.addColorStop(0.25, '#2563eb');
          specGrad.addColorStop(0.5, '#10b981');
          specGrad.addColorStop(0.72, '#facc15');
          specGrad.addColorStop(1.0, '#ef4444');

          rCtx.fillStyle = '#94a3b8';
          rCtx.font = 'bold 11px monospace';
          rCtx.fillText('SPEKTROGRAF REDSHIFT H-ALPHA (Lab λ₀=656.3nm vs Galaksi λ_obs)', 20, 20);

          // Rest-frame spectrum bar & H-alpha line
          rCtx.fillStyle = specGrad;
          rCtx.fillRect(24, 30, W - 48, 28);
          const restX = 24 + ((656.3 - 380) / 380) * (W - 48);
          rCtx.fillStyle = '#020617';
          rCtx.fillRect(restX - 2, 30, 4, 28);

          // Observed redshifted spectrum bar & shifted H-alpha line
          rCtx.fillStyle = specGrad;
          rCtx.fillRect(24, 70, W - 48, 28);
          const obsLambda = 656.3 * (1 + z);
          const obsX = Math.min(W - 28, 24 + ((obsLambda - 380) / 380) * (W - 48));
          rCtx.fillStyle = '#020617';
          rCtx.fillRect(obsX - 2, 70, 4, 28);

          // Redshift displacement arrow between restX and obsX
          rCtx.strokeStyle = '#f87171';
          rCtx.lineWidth = 2;
          rCtx.beginPath();
          rCtx.moveTo(restX, 64);
          rCtx.lineTo(obsX, 64);
          rCtx.stroke();

          rCtx.fillStyle = '#f87171';
          rCtx.font = 'bold 12px monospace';
          rCtx.fillText(
            `z = ${z.toFixed(3)} · λ_obs = ${obsLambda.toFixed(1)} nm · v = ${Math.round(recVel)} km/s (d = ${Math.round(dMpc)} Mpc)`,
            20,
            122
          );
          rsTex.needsUpdate = true;
        }
      }

      distantGalaxies.forEach((dg, idx) => {
        const ang = dg.baseAngle + idx * 0.1;
        const r = dScale * dg.distMult;
        const gx = r * Math.cos(ang);
        const gz = r * Math.sin(ang);
        dg.group.position.set(gx, dg.yOff, gz);
        dg.group.rotation.y = t * 0.25 * (idx % 2 === 0 ? 1 : -1);
        dg.diskMat.color.setHex(shiftHex);
        dg.coreMat.emissive.setHex(shiftHex);

        arrowOriginVec.set(gx, dg.yOff, gz);
        arrowDirVec.set(Math.cos(ang), 0, Math.sin(ang));
        orientAndScaleVectorArrow(
          dg.arrow,
          arrowOriginVec,
          arrowDirVec,
          arrowLen * dg.distMult
        );
      });

      // Stretch wave oscillation inversely with distance expansion (fewer cycles = longer λ!)
      const targetPos = distantGalaxies[0].group.position;
      const waveAttr = waveGeo.getAttribute('position') as THREE.BufferAttribute;
      const cycles = Math.max(3.5, 11.5 - (dScale / 10.5) * 6.5);
      for (let i = 0; i < WAVE_PTS; i++) {
        const u = i / (WAVE_PTS - 1);
        const amp = 0.22 * Math.sin(u * Math.PI);
        const px = targetPos.x * u;
        const pz = targetPos.z * u;
        const py = targetPos.y * u + Math.sin(u * Math.PI * 2 * cycles - t * 4.5) * amp;
        waveAttr.setXYZ(i, px, py, pz);
      }
      waveAttr.needsUpdate = true;
      waveMat.color.setHex(waveColorHex);

      anchorMidPos.copy(targetPos).multiplyScalar(0.5);
      anchorMidPos.y += 0.55;
      anchorGalPos.copy(targetPos);
      anchorGalPos.y += 0.95;
      anchorsObj.c1!.text = `Peregangan λ (Redshift z = ${z.toFixed(3)})`;
      anchorsObj.c3!.text = `v_resesi = ${Math.round(recVel)} km/s →`;
      return updateResult;
    },
    dispose: () => {
      spiralTex.dispose();
      earthObserverTex?.dispose();
      rsTex.dispose();
    },
  };
}

// =====================================================================
// RIG 6: PLANETARY ATMOSPHERE, ALBEDO & RADIATIVE GREENHOUSE EFFECT
// =====================================================================
export function buildPlanetaryGreenhouseRig(): AstronomyRigHandle {
  const ghGroup = new THREE.Group();
  const planetSurfaceTex = createPlanetSurfaceTexture({
    baseHex: '#0284c7',
    accentHex: '#16a34a',
    style: 'terrestrial',
  });
  const cloudTex = createTerrestrialCloudTexture();

  // Central Terrestrial Planet Globe (r = 1.65)
  const planetMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: planetSurfaceTex,
    roughness: 0.55,
    metalness: 0.08,
  });
  const planetGlobe = new THREE.Mesh(new THREE.SphereGeometry(1.65, 40, 40), planetMat);
  planetGlobe.position.set(0, 0.75, 0);
  planetGlobe.castShadow = true;
  planetGlobe.receiveShadow = true;
  planetGlobe.name = 'Bola Planet & Lapisan Albedo';
  planetGlobe.userData = {
    draggableParam: 'planetaryAlbedo',
    min: 0.05,
    max: 0.85,
    step: 0.02,
    label: 'Albedo Planet A',
  };
  ghGroup.add(planetGlobe);

  // Dynamic North & South Polar Ice Caps that scale with Albedo
  const iceCapMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.22,
    roughness: 0.25,
  });
  const northIceCap = new THREE.Mesh(
    new THREE.SphereGeometry(1.668, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.32),
    iceCapMat
  );
  northIceCap.userData = planetGlobe.userData;
  const southIceCap = new THREE.Mesh(
    new THREE.SphereGeometry(1.668, 32, 16, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32),
    iceCapMat
  );
  southIceCap.userData = planetGlobe.userData;
  planetGlobe.add(northIceCap, southIceCap);

  // Cloud layer
  const cloudShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.71, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: cloudTex,
      transparent: true,
      opacity: 0.68,
      roughness: 0.85,
      depthWrite: false,
    })
  );
  planetGlobe.add(cloudShell);

  // Greenhouse Atmosphere Shell (r = 2.15, draggable greenhouseGasPpm)
  const ghAtmoMat = createFresnelCoronaMaterial(0x38bdf8, 0xf97316, 1.25);
  const ghAtmoShell = new THREE.Mesh(new THREE.SphereGeometry(2.18, 36, 36), ghAtmoMat);
  ghAtmoShell.position.set(0, 0.75, 0);
  ghAtmoShell.name = 'Selubung Atmosfer Gas Rumah Kaca (CO₂)';
  ghAtmoShell.userData = {
    draggableParam: 'greenhouseGasPpm',
    min: 100,
    max: 5000,
    step: 50,
    label: 'Konsentrasi CO₂ (ppm)',
  };
  ghGroup.add(ghAtmoShell);

  // Incoming Solar Shortwave Arrows (Yellow) & Reflected Albedo Arrow (Cyan-White)
  const solarInArrow1 = createVectorArrowGroup(0xfacc15);
  const solarInArrow2 = createVectorArrowGroup(0xfacc15);
  const albedoReflectArrow = createVectorArrowGroup(0x7dd3fc);
  // Outgoing & Back-Radiation Longwave Infrared Arrows (Orange-Red)
  const irOutArrow = createVectorArrowGroup(0xf97316);
  const irBackArrow1 = createVectorArrowGroup(0xef4444);
  const irBackArrow2 = createVectorArrowGroup(0xef4444);
  ghGroup.add(
    solarInArrow1,
    solarInArrow2,
    albedoReflectArrow,
    irOutArrow,
    irBackArrow1,
    irBackArrow2
  );

  // 3D Radiative Energy Balance Hologram Board below the planet
  const ghCanvas = document.createElement('canvas');
  ghCanvas.width = 512;
  ghCanvas.height = 160;
  const ghTex = new THREE.CanvasTexture(ghCanvas);
  ghTex.colorSpace = THREE.SRGBColorSpace;
  const ghBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.75),
    new THREE.MeshBasicMaterial({
      map: ghTex,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    })
  );
  ghBoard.position.set(0, -2.05, 1.1);
  ghBoard.rotation.x = -0.25;
  ghGroup.add(ghBoard);

  const vecOrigin = new THREE.Vector3();
  const vecDir = new THREE.Vector3();
  const anchorSolarPos = new THREE.Vector3(-3.1, 1.65, 0);
  const anchorPlanetPos = new THREE.Vector3(0, 2.75, 0);
  const anchorIrPos = new THREE.Vector3(2.45, 1.55, 0);
  const anchorsObj: AstronomyConceptAnchors = {
    c1: { pos: anchorSolarPos, text: '' },
    c2: { pos: anchorPlanetPos, text: '' },
    c3: { pos: anchorIrPos, text: '' },
  };
  const updateResult = { anchors: anchorsObj };
  let lastGhKey = '';

  return {
    group: ghGroup,
    interactiveMeshes: [planetGlobe, ghAtmoShell],
    update: ({ params: p, metrics: m, t }) => {
      const albedo = p.planetaryAlbedo ?? 0.3;
      const co2Ppm = p.greenhouseGasPpm ?? 420;
      const sFactor = p.stellarFluxFactor ?? 1.0;
      const eps = m.infraredEmissivity ?? 0.78;
      const tsK = m.surfaceTempK ?? 288;
      const tsC = m.surfaceTempC ?? 15;
      const teqK = m.equilibriumTempK ?? 255;
      const deltaK = m.greenhouseWarmingDeltaK ?? 33;

      planetGlobe.rotation.y = t * 0.28;
      cloudShell.rotation.y = t * 0.38;

      // Polar ice caps expand with high albedo / cold temperature
      const iceScale = Math.max(0.25, Math.min(1.18, 0.45 + albedo * 0.95));
      northIceCap.scale.set(1, iceScale, 1);
      southIceCap.scale.set(1, iceScale, 1);
      (cloudShell.material as THREE.MeshStandardMaterial).opacity = 0.25 + albedo * 0.65;

      // Greenhouse shell color shifts from cyan-blue (low CO2) to amber-red (high CO2)
      ghAtmoMat.uniforms.uTime.value = t;
      ghAtmoMat.uniforms.uIntensity.value = 0.65 + eps * 1.15;
      ghAtmoMat.uniforms.uCoreColor.value.setHex(co2Ppm >= 1200 ? 0xf97316 : 0x38bdf8);
      ghAtmoMat.uniforms.uRimColor.value.setHex(co2Ppm >= 1200 ? 0xef4444 : 0xf59e0b);

      // Update Incoming Solar, Reflected Albedo & Trapped IR Vector Arrows
      const solarLen = Math.min(2.4, 1.1 + sFactor * 0.55);
      vecOrigin.set(-4.35, 1.35, 0);
      vecDir.set(1, -0.15, 0).normalize();
      orientAndScaleVectorArrow(solarInArrow1, vecOrigin, vecDir, solarLen);

      vecOrigin.set(-4.35, 0.25, 0);
      vecDir.set(1, 0.12, 0).normalize();
      orientAndScaleVectorArrow(solarInArrow2, vecOrigin, vecDir, solarLen);

      // Reflected shortwave Albedo arrow
      vecOrigin.set(-1.55, 1.45, 0);
      vecDir.set(-0.85, 0.55, 0).normalize();
      orientAndScaleVectorArrow(albedoReflectArrow, vecOrigin, vecDir, Math.max(0.45, albedo * 2.2));

      // Outgoing IR & Trapped Back-Radiation arrows
      vecOrigin.set(1.65, 1.15, 0);
      vecDir.set(1, 0.35, 0).normalize();
      orientAndScaleVectorArrow(irOutArrow, vecOrigin, vecDir, Math.max(0.55, (1 - eps * 0.5) * 1.7));

      const backLen = Math.max(0.5, eps * 1.65);
      vecOrigin.set(2.05, 0.55, 0.35);
      vecDir.set(-1, 0.15, -0.1).normalize();
      orientAndScaleVectorArrow(irBackArrow1, vecOrigin, vecDir, backLen);

      vecOrigin.set(0.35, 2.55, 0);
      vecDir.set(-0.15, -1, 0).normalize();
      orientAndScaleVectorArrow(irBackArrow2, vecOrigin, vecDir, backLen);

      const ghKey = `${albedo.toFixed(2)}_${Math.round(co2Ppm)}_${sFactor.toFixed(2)}`;
      if (ghKey !== lastGhKey) {
        lastGhKey = ghKey;
        const gCtx = ghCanvas.getContext('2d');
        if (gCtx) {
          const W = ghCanvas.width;
          const H = ghCanvas.height;
          gCtx.fillStyle = '#070d19';
          gCtx.fillRect(0, 0, W, H);
          gCtx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
          gCtx.lineWidth = 2;
          gCtx.strokeRect(2, 2, W - 4, H - 4);

          gCtx.fillStyle = '#94a3b8';
          gCtx.font = 'bold 12px monospace';
          gCtx.fillText('NERACA RADIASI TERMAL PLANET & EFEK RUMAH KACA', 20, 24);

          gCtx.fillStyle = '#facc15';
          gCtx.font = 'bold 13px monospace';
          gCtx.fillText(
            `Fluks Terserap = ${(m.absorbedSolarFluxWm2 ?? 238).toFixed(0)} W/m² · Albedo A = ${albedo.toFixed(2)}`,
            20,
            56
          );

          gCtx.fillStyle = '#38bdf8';
          gCtx.fillText(
            `Suhu Ekuilibrium Tanpa Atmosfer: Teq = ${teqK.toFixed(1)} K (${(teqK - 273.15).toFixed(1)} °C)`,
            20,
            88
          );

          gCtx.fillStyle = tsC > 45 ? '#f87171' : '#34d399';
          gCtx.font = 'bold 14px monospace';
          gCtx.fillText(
            `Suhu Permukaan Aktual: Ts = ${tsK.toFixed(1)} K (${tsC >= 0 ? '+' : ''}${tsC.toFixed(1)} °C) · ΔT_GH = +${deltaK.toFixed(1)} K`,
            20,
            122
          );

          gCtx.fillStyle = '#cbd5e1';
          gCtx.font = '11px monospace';
          gCtx.fillText(
            `CO₂ = ${Math.round(co2Ppm)} ppm · Emisivitas Inframerah Atmosfer ε = ${eps.toFixed(3)}`,
            20,
            146
          );
          ghTex.needsUpdate = true;
        }
      }

      anchorsObj.c1!.text = `Surya Masuk & Pantulan Albedo A = ${albedo.toFixed(2)}`;
      anchorsObj.c2!.text = `Suhu Permukaan Ts = ${tsK.toFixed(1)} K (${tsC.toFixed(1)} °C)`;
      anchorsObj.c3!.text = `Pemanasan Rumah Kaca +${deltaK.toFixed(1)} K (CO₂ ${Math.round(co2Ppm)} ppm)`;
      return updateResult;
    },
    dispose: () => {
      planetSurfaceTex?.dispose();
      cloudTex?.dispose();
      ghTex.dispose();
    },
  };
}

