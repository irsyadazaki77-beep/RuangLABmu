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
  redshiftToGalaxyColorHex,
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
 * Back-face Fresnel glowing atmospheric / corona shader material.
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
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1.22, 40, 40), sunStdMat);
  sunMesh.name = 'Bintang Induk (Matahari)';
  solarGroup.add(sunMesh);

  const sunCoronaMat = createFresnelCoronaMaterial(0xfef08a, 0xf97316);
  const sunCorona = new THREE.Mesh(new THREE.SphereGeometry(1.68, 36, 36), sunCoronaMat);
  sunMesh.add(sunCorona);

  // Habitable Zone translucent ring in ecliptic XZ plane
  const habitableZoneMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const habitableZoneMesh = new THREE.Mesh(new THREE.RingGeometry(1, 1.45, 64), habitableZoneMat);
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
  const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.56, 36, 36), planetMat);
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

  const planetAtmoMat = createFresnelCoronaMaterial(0x7dd3fc, 0x0284c7, 1.15);
  planetTiltGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 32), planetAtmoMat));

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 1.18, 48),
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
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 })
  );
  moonMesh.position.set(1.05, 0.08, 0);
  moonPivot.add(moonMesh);
  planetAssembly.add(moonPivot);

  const keplerVelArrow = createVectorArrowGroup(0x38bdf8);
  const keplerGravArrow = createVectorArrowGroup(0xf59e0b);
  solarGroup.add(keplerVelArrow, keplerGravArrow);

  const evalOrbitPoint = (theta: number, a: number, e: number, scaledR: number, incRad: number) => {
    const b = a * Math.sqrt(Math.max(0.01, 1 - e * e));
    const c = a * e;
    const x = a * Math.cos(theta) - c;
    const z = b * Math.sin(theta);
    return {
      ox: (x / a) * scaledR,
      oy: Math.sin(theta) * scaledR * Math.sin(incRad),
      oz: (z / b) * scaledR,
      b,
    };
  };

  return {
    group: solarGroup,
    interactiveMeshes: [planetMesh],
    update: ({ params: p, metrics: m, activePlanet, t, showConceptLabels, isFocusPreset, isDragging }) => {
      sunMesh.rotation.y = t * 0.14;
      sunStdMat.emissiveIntensity = 2.0 + Math.sin(t * 3.2) * 0.35;
      sunCoronaMat.uniforms.uTime.value = t;
      planetAtmoMat.uniforms.uTime.value = t;
      asteroidBeltGroup.rotation.y = t * 0.045;

      const starScale = 0.8 + Math.min(0.6, (p.centralStarMassSolar || 1) * 0.18);
      sunMesh.scale.setScalar(starScale);

      // Update Planet visual traits based on activePlanet preset
      if (activePlanet) {
        planetMat.color.setStyle(activePlanet.colorHex);
        ringMesh.visible = Boolean(activePlanet.hasRings);
        moonPivot.visible = activePlanet.moonsCount > 0;
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
      habitableZoneMat.color.setHex(m.isInHabitableZone ? 0x10b981 : 0x38bdf8);
      habitableZoneMat.opacity = m.isInHabitableZone ? 0.22 : 0.1;

      const a = p.customSemiMajorAxisAu || 1.0;
      const e = p.customEccentricity ?? 0.017;
      const incRad = ((3.2 + e * 14.0) * Math.PI) / 180;
      const scaledR = auToSceneRadius(a);

      const posAttr = orbitGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < 96; i++) {
        const theta = (i / 96) * Math.PI * 2;
        const pt = evalOrbitPoint(theta, a, e, scaledR, incRad);
        posAttr.setXYZ(i, pt.ox, pt.oy, pt.oz);
      }
      posAttr.needsUpdate = true;

      const meanMotion = (Math.PI * 2) / Math.max(0.5, m.orbitalPeriodYears);
      const curM = (t * meanMotion) % (Math.PI * 2);
      const curPt = evalOrbitPoint(curM, a, e, scaledR, incRad);
      planetAssembly.position.set(curPt.ox, curPt.oy, curPt.oz);
      planetMesh.rotation.y = t * 0.65;
      moonPivot.rotation.y = t * 1.9;

      // Trailing orbital ribbon
      const trailAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL_SEGS; i++) {
        const backTheta = curM - (i / (TRAIL_SEGS - 1)) * 0.95;
        const tp = evalOrbitPoint(backTheta, a, e, scaledR, incRad);
        trailAttr.setXYZ(i, tp.ox, tp.oy, tp.oz);
      }
      trailAttr.needsUpdate = true;

      // Kepler II Area Sweep Sector
      sweepMesh.visible = Boolean(p.showKeplerAreaSweep);
      if (sweepMesh.visible) {
        const sweepAttr = sweepGeo.getAttribute('position') as THREE.BufferAttribute;
        const sweepSpan = 0.52;
        for (let i = 0; i < SWEEP_STEPS; i++) {
          const th0 = curM - (i / SWEEP_STEPS) * sweepSpan;
          const th1 = curM - ((i + 1) / SWEEP_STEPS) * sweepSpan;
          const p0 = evalOrbitPoint(th0, a, e, scaledR, incRad);
          const p1 = evalOrbitPoint(th1, a, e, scaledR, incRad);
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
        const tanDir = new THREE.Vector3(
          -Math.sin(curM) * scaledR,
          Math.cos(curM) * scaledR * Math.sin(incRad),
          Math.cos(curM) * (curPt.b / a) * scaledR
        );
        orientAndScaleVectorArrow(keplerVelArrow, planetAssembly.position, tanDir, 1.8);
        const gravDir = planetAssembly.position.clone().negate();
        orientAndScaleVectorArrow(keplerGravArrow, planetAssembly.position, gravDir, 1.5);
      } else {
        keplerVelArrow.visible = false;
        keplerGravArrow.visible = false;
      }

      return {
        anchors: {
          c1: { pos: new THREE.Vector3(0, 1.65, 0), text: 'Matahari (Fokus Elips)' },
          c2: {
            pos: planetAssembly.position.clone().add(new THREE.Vector3(0, 0.95, 0)),
            text: `v = ${(m.meanOrbitalVelocityKms ?? 29.8).toFixed(1)} km/s · e = ${e.toFixed(2)}`,
          },
          c3: m.isInHabitableZone
            ? {
                pos: new THREE.Vector3(hzMid, 0.25, 0),
                text: `Zona Laik Huni (${m.habitableZoneInnerAu.toFixed(2)}–${m.habitableZoneOuterAu.toFixed(2)} AU)`,
              }
            : undefined,
        },
        focusTarget: isFocusPreset && !isDragging ? planetAssembly.position.clone() : undefined,
        focusCamPos:
          isFocusPreset && !isDragging
            ? new THREE.Vector3(curPt.ox + 1.9, curPt.oy + 1.4, curPt.oz + 3.2)
            : undefined,
      };
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

  return {
    group: milkyWayGroup,
    interactiveMeshes: [galacticMarkerStar],
    update: ({ params: p, metrics: m, t, showConceptLabels }) => {
      const dt = Math.max(0, Math.min(0.1, Math.abs(t - prevT)));
      prevT = t;

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
        orientAndScaleVectorArrow(
          observedVelArrow,
          galacticMarkerStar.position,
          new THREE.Vector3(-Math.sin(obsAngle), 0, Math.cos(obsAngle)),
          Math.max(0.6, (vObs / 250) * 2.1)
        );
        orientAndScaleVectorArrow(
          keplerVelArrow,
          keplerGhostStar.position,
          new THREE.Vector3(-Math.sin(kepAngle), 0, Math.cos(kepAngle)),
          Math.max(0.5, (vKep / 250) * 2.1)
        );
      } else {
        observedVelArrow.visible = false;
        keplerVelArrow.visible = false;
      }

      return {
        anchors: {
          c1: { pos: new THREE.Vector3(0, 1.3, 0), text: 'Sgr A* (Pusat Bima Sakti)' },
          c2: {
            pos: galacticMarkerStar.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
            text: `v_obs = ${vObs.toFixed(0)} km/s · R = ${rKpc.toFixed(1)} kpc`,
          },
          c3: {
            pos: keplerGhostStar.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
            text: `Prediksi Kepler: ${vKep.toFixed(0)} km/s (Tanpa DM)`,
          },
        },
      };
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

  // Transiting Exoplanet (draggable to tune exoplanetRadiusEarth)
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

  // Photometer Detector Lens Pod
  const telescopePod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 0.9, 20),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 })
  );
  telescopePod.rotation.x = Math.PI / 2;
  telescopePod.position.set(0, 0.85, 7.2);
  transitGroup.add(telescopePod);

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

      // Render crisp 3D Light-Curve Plot on Hologram Canvas
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

      return {
        anchors: {
          c1: {
            pos: new THREE.Vector3(0, 0.85 + starVisualScale * 1.65, 0),
            text: `Bintang R* = ${starR.toFixed(1)} R☉ (${m.spectralClass})`,
          },
          c2: {
            pos: exoplanetMesh.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
            text: `Eksoplanet Rp = ${rp.toFixed(1)} R⊕ · a = ${orbitAu.toFixed(2)} AU`,
          },
          c3: {
            pos: new THREE.Vector3(0, -1.25, 1.5),
            text: `Kedalaman ΔF/F = ${m.transitDepthPct.toFixed(3)}%${sample.inTransit ? ' (Transit!)' : ''}`,
          },
        },
        focusTarget: isFocusPreset && !isDragging ? new THREE.Vector3(0, 0.85, 0) : undefined,
        focusCamPos: isFocusPreset && !isDragging ? new THREE.Vector3(0, 1.3, 8.8) : undefined,
      };
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

  const wienStarMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xfacc15,
    emissiveIntensity: 1.8,
    roughness: 0.3,
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

  // Optical Dispersion Prism with Shared Borosilicate Glass + Lite-Mode Material Control
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

  // Combined Planck Curve + Rainbow Absorption Spectrum Screen
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

      const sCtx = spectrumCanvas.getContext('2d');
      if (sCtx) {
        const W = spectrumCanvas.width;
        const H = spectrumCanvas.height;
        sCtx.fillStyle = '#070b14';
        sCtx.fillRect(0, 0, W, H);

        // Top half (y: 0..108): Planck Blackbody Intensity Curve
        const tempK = Math.max(2500, p.starEffectiveTempK || 5800);
        const peakLambda = m.wienPeakWavelengthNm ?? 2.89777e6 / tempK;
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

      return {
        anchors: {
          c1: {
            pos: new THREE.Vector3(-4.5, 2.35, 0),
            text: `Fotosfer T* = ${Math.round(p.starEffectiveTempK ?? 5778)} K`,
          },
          c2: {
            pos: new THREE.Vector3(3.85, 1.45, 0),
            text: `Puncak Wien λmax = ${(m.wienPeakWavelengthNm ?? 502).toFixed(0)} nm`,
          },
        },
      };
    },
    dispose: () => {
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

  const cosmicGrid = new THREE.GridHelper(30, 20, 0x334155, 0x1e293b);
  cosmicGrid.position.y = -2.5;
  (cosmicGrid.material as THREE.Material).transparent = true;
  (cosmicGrid.material as THREE.Material).opacity = 0.35;
  hubbleGroup.add(cosmicGrid);

  const mwObserver = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.25,
    })
  );
  hubbleGroup.add(mwObserver);

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

  return {
    group: hubbleGroup,
    interactiveMeshes,
    update: ({ params: p, metrics: m, t }) => {
      const dMpc = p.galaxyDistanceMpc ?? 150;
      const dScale = Math.min(10.5, Math.max(2.5, (dMpc / 600) * 10.5));
      const recVel = m.hubbleRecessionVelocityKmS ?? 10500;
      const z = m.hubbleRedshiftZ ?? 0.035;
      const arrowLen = Math.min(3.2, (recVel / 42000) * 3.2);
      const shiftHex = redshiftToGalaxyColorHex(z);
      const waveColorHex = wavelengthNmToHex(Math.min(740, 460 + z * 1650));

      distantGalaxies.forEach((dg, idx) => {
        const ang = dg.baseAngle + idx * 0.1;
        const r = dScale * dg.distMult;
        const gx = r * Math.cos(ang);
        const gz = r * Math.sin(ang);
        dg.group.position.set(gx, dg.yOff, gz);
        dg.group.rotation.y = t * 0.25 * (idx % 2 === 0 ? 1 : -1);
        dg.diskMat.color.setHex(shiftHex);
        dg.coreMat.emissive.setHex(shiftHex);

        orientAndScaleVectorArrow(
          dg.arrow,
          new THREE.Vector3(gx, dg.yOff, gz),
          new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)),
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

      return {
        anchors: {
          c1: {
            pos: targetPos.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.55, 0)),
            text: `Peregangan λ (Redshift z = ${z.toFixed(3)})`,
          },
          c2: { pos: new THREE.Vector3(0, 0.9, 0), text: 'Bumi / Pengamat' },
          c3: {
            pos: targetPos.clone().add(new THREE.Vector3(0, 0.95, 0)),
            text: `v_resesi = ${Math.round(recVel)} km/s →`,
          },
        },
      };
    },
    dispose: () => {
      spiralTex.dispose();
    },
  };
}
