import * as THREE from 'three';

export const DEFAULT_CM_PER_WORLD_UNIT = 10;

export interface RulerReadoutResult {
  worldDistance: number;
  distanceCm: number;
  uncertaintyCm: number;
  formatted: string;
}

export interface ProtractorReadoutResult {
  angleDeg: number;
  uncertaintyDeg: number;
  formatted: string;
}

export interface ProbeReadoutResult {
  formatted: string;
  severityHex: string;
}

/**
 * Pure helper computing physical ruler length and NST half-smallest-division uncertainty.
 */
export function computeRulerReadout(
  pointA: [number, number, number],
  pointB: [number, number, number],
  cmPerUnit = DEFAULT_CM_PER_WORLD_UNIT,
  nstCm = 0.1
): RulerReadoutResult {
  const dx = pointB[0] - pointA[0];
  const dy = pointB[1] - pointA[1];
  const dz = pointB[2] - pointA[2];
  const worldDistance = Number(Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(4));
  const safeScale = Number.isFinite(cmPerUnit) && cmPerUnit > 0 ? cmPerUnit : DEFAULT_CM_PER_WORLD_UNIT;
  const safeNst = Number.isFinite(nstCm) && nstCm > 0 ? nstCm : 0.1;
  const distanceCm = Number((worldDistance * safeScale).toFixed(2));
  const uncertaintyCm = Number((safeNst / 2).toFixed(3));
  return {
    worldDistance,
    distanceCm,
    uncertaintyCm,
    formatted: `${distanceCm.toFixed(2)} ± ${uncertaintyCm.toFixed(2)} cm`,
  };
}

/**
 * Pure helper computing angle between two arms from a common vertex in degrees (0..180°).
 */
export function computeProtractorReadout(
  vertex: [number, number, number],
  armA: [number, number, number],
  armB: [number, number, number],
  nstDeg = 1.0
): ProtractorReadoutResult {
  const ux = armA[0] - vertex[0];
  const uy = armA[1] - vertex[1];
  const uz = armA[2] - vertex[2];
  const vx = armB[0] - vertex[0];
  const vy = armB[1] - vertex[1];
  const vz = armB[2] - vertex[2];

  const magU = Math.sqrt(ux * ux + uy * uy + uz * uz);
  const magV = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (magU < 1e-6 || magV < 1e-6) {
    const uncertaintyDeg = Number((nstDeg / 2).toFixed(2));
    return {
      angleDeg: 0,
      uncertaintyDeg,
      formatted: `0.0 ± ${uncertaintyDeg.toFixed(1)}°`,
    };
  }

  const dot = ux * vx + uy * vy + uz * vz;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magU * magV)));
  const angleDeg = Number(((Math.acos(cosTheta) * 180) / Math.PI).toFixed(1));
  const safeNst = Number.isFinite(nstDeg) && nstDeg > 0 ? nstDeg : 1.0;
  const uncertaintyDeg = Number((safeNst / 2).toFixed(2));
  return {
    angleDeg,
    uncertaintyDeg,
    formatted: `${angleDeg.toFixed(1)} ± ${uncertaintyDeg.toFixed(1)}°`,
  };
}

/**
 * Pure helper formatting digital pH meter or thermocouple probe readings with instrument uncertainty.
 */
export function formatProbeReadout(
  mode: 'ph' | 'thermometer',
  value: number
): ProbeReadoutResult {
  const safeVal = Number.isFinite(value) ? value : mode === 'ph' ? 7 : 25;
  if (mode === 'ph') {
    const clampedPh = Math.max(0, Math.min(14, safeVal));
    const severityHex =
      clampedPh < 6.5 ? '#f43f5e' : clampedPh <= 7.5 ? '#10b981' : '#38bdf8';
    return {
      formatted: `pH ${clampedPh.toFixed(2)} ± 0.02`,
      severityHex,
    };
  }

  const severityHex =
    safeVal >= 65 ? '#ef4444' : safeVal >= 38 ? '#f59e0b' : '#38bdf8';
  return {
    formatted: `${safeVal.toFixed(1)} ± 0.1 °C`,
    severityHex,
  };
}

function drawBadgeCanvas(
  canvas: HTMLCanvasElement,
  title: string,
  valueText: string,
  accentHex = '#38bdf8'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 36);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 30px monospace';
  ctx.fillText(valueText, canvas.width / 2, 80);
}

export interface MeasurementRuler3DHandle {
  group: THREE.Group;
  pinA: THREE.Mesh;
  pinB: THREE.Mesh;
  setEndpoints: (posA: THREE.Vector3, posB: THREE.Vector3) => RulerReadoutResult;
  getEndpoints: () => { posA: THREE.Vector3; posB: THREE.Vector3 };
  getInteractiveHandles: () => THREE.Object3D[];
  dispose: () => void;
}

/**
 * Interactive 3D Virtual Caliper/Ruler with draggable pins and live NST readout billboard.
 */
export function createMeasurementRuler3D(options?: {
  initialA?: [number, number, number];
  initialB?: [number, number, number];
  cmPerUnit?: number;
}): MeasurementRuler3DHandle {
  const cmPerUnit = options?.cmPerUnit ?? DEFAULT_CM_PER_WORLD_UNIT;
  const posA = new THREE.Vector3(...(options?.initialA ?? [-1.5, 0.45, 1.4]));
  const posB = new THREE.Vector3(...(options?.initialB ?? [1.5, 0.45, 1.4]));

  const group = new THREE.Group();
  group.name = 'ruanglab-ruler-3d';

  const pinGeo = new THREE.CylinderGeometry(0.11, 0.04, 0.46, 16);
  const pinMatA = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.65,
  });
  const pinMatB = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.65,
  });

  const pinA = new THREE.Mesh(pinGeo, pinMatA);
  pinA.name = 'Pin Mistar 3D (A)';
  pinA.userData = {
    measurementHandle: 'ruler-a',
    interactive: true,
    type: 'draggable',
    label: 'Pin Mistar A',
  };

  const pinB = new THREE.Mesh(pinGeo, pinMatB);
  pinB.name = 'Pin Mistar 3D (B)';
  pinB.userData = {
    measurementHandle: 'ruler-b',
    interactive: true,
    type: 'draggable',
    label: 'Pin Mistar B',
  };

  const beamGeo = new THREE.BoxGeometry(1, 0.055, 0.14);
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.18,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);

  let badgeCanvas: HTMLCanvasElement | null = null;
  let badgeTexture: THREE.CanvasTexture | null = null;
  let badgeSprite: THREE.Sprite | null = null;
  let badgeMat: THREE.SpriteMaterial | null = null;

  if (typeof document !== 'undefined') {
    badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 360;
    badgeCanvas.height = 104;
    badgeTexture = new THREE.CanvasTexture(badgeCanvas);
    badgeMat = new THREE.SpriteMaterial({ map: badgeTexture, depthTest: false });
    badgeSprite = new THREE.Sprite(badgeMat);
    badgeSprite.scale.set(1.85, 0.54, 1);
    group.add(badgeSprite);
  }

  group.add(beamMesh, pinA, pinB);

  const upAxis = new THREE.Vector3(1, 0, 0);
  const diffVec = new THREE.Vector3();
  const midVec = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  const setEndpoints = (nextA: THREE.Vector3, nextB: THREE.Vector3): RulerReadoutResult => {
    posA.copy(nextA);
    posB.copy(nextB);
    pinA.position.copy(posA);
    pinB.position.copy(posB);

    diffVec.subVectors(posB, posA);
    const len = Math.max(0.05, diffVec.length());
    midVec.addVectors(posA, posB).multiplyScalar(0.5);

    beamMesh.position.copy(midVec);
    beamMesh.scale.set(len, 1, 1);
    if (diffVec.lengthSq() > 1e-6) {
      quat.setFromUnitVectors(upAxis, diffVec.clone().normalize());
      beamMesh.quaternion.copy(quat);
    }

    const readout = computeRulerReadout(
      [posA.x, posA.y, posA.z],
      [posB.x, posB.y, posB.z],
      cmPerUnit
    );

    if (badgeSprite && badgeCanvas && badgeTexture) {
      badgeSprite.position.set(midVec.x, midVec.y + 0.52, midVec.z);
      drawBadgeCanvas(badgeCanvas, 'MISTAR 3D (NST 0.1 cm)', readout.formatted, '#38bdf8');
      badgeTexture.needsUpdate = true;
    }

    return readout;
  };

  setEndpoints(posA, posB);

  return {
    group,
    pinA,
    pinB,
    setEndpoints,
    getEndpoints: () => ({ posA: posA.clone(), posB: posB.clone() }),
    getInteractiveHandles: () => [pinA, pinB],
    dispose: () => {
      pinGeo.dispose();
      pinMatA.dispose();
      pinMatB.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      badgeTexture?.dispose();
      badgeMat?.dispose();
    },
  };
}

export interface Protractor3DHandle {
  group: THREE.Group;
  armHandle: THREE.Mesh;
  setAngleDeg: (deg: number) => ProtractorReadoutResult;
  getAngleDeg: () => number;
  getInteractiveHandles: () => THREE.Object3D[];
  dispose: () => void;
}

/**
 * Interactive 3D Protractor Arc with rotatable pointer arm and live angular uncertainty readout.
 */
export function createProtractor3D(initialAngleDeg = 30): Protractor3DHandle {
  let currentAngleDeg = Math.max(0, Math.min(180, initialAngleDeg));
  const group = new THREE.Group();
  group.name = 'ruanglab-protractor-3d';

  const arcGeo = new THREE.RingGeometry(0.82, 1.02, 48, 1, 0, Math.PI);
  const arcMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.4,
  });
  const arcMesh = new THREE.Mesh(arcGeo, arcMat);
  group.add(arcMesh);

  const baseArmGeo = new THREE.BoxGeometry(1.06, 0.04, 0.05);
  baseArmGeo.translate(0.53, 0, 0);
  const baseArmMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
  const baseArm = new THREE.Mesh(baseArmGeo, baseArmMat);
  group.add(baseArm);

  const pointerPivot = new THREE.Group();
  const pointerArmGeo = new THREE.BoxGeometry(1.12, 0.045, 0.06);
  pointerArmGeo.translate(0.56, 0, 0);
  const pointerArmMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.5,
  });
  const pointerArm = new THREE.Mesh(pointerArmGeo, pointerArmMat);

  const armHandleGeo = new THREE.SphereGeometry(0.11, 14, 14);
  const armHandleMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.6,
  });
  const armHandle = new THREE.Mesh(armHandleGeo, armHandleMat);
  armHandle.position.set(1.12, 0, 0);
  armHandle.name = 'Lengan Busur Derajat 3D';
  armHandle.userData = {
    measurementHandle: 'protractor-arm',
    interactive: true,
    type: 'draggable',
    label: 'Sudut Busur 3D',
  };

  pointerPivot.add(pointerArm, armHandle);
  group.add(pointerPivot);

  let badgeCanvas: HTMLCanvasElement | null = null;
  let badgeTexture: THREE.CanvasTexture | null = null;
  let badgeSprite: THREE.Sprite | null = null;
  let badgeMat: THREE.SpriteMaterial | null = null;

  if (typeof document !== 'undefined') {
    badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 340;
    badgeCanvas.height = 104;
    badgeTexture = new THREE.CanvasTexture(badgeCanvas);
    badgeMat = new THREE.SpriteMaterial({ map: badgeTexture, depthTest: false });
    badgeSprite = new THREE.Sprite(badgeMat);
    badgeSprite.position.set(0, 1.32, 0);
    badgeSprite.scale.set(1.65, 0.5, 1);
    group.add(badgeSprite);
  }

  const setAngleDeg = (deg: number): ProtractorReadoutResult => {
    currentAngleDeg = Math.max(0, Math.min(180, Number(deg.toFixed(1))));
    const rad = (currentAngleDeg * Math.PI) / 180;
    pointerPivot.rotation.z = rad;

    const readout = computeProtractorReadout(
      [0, 0, 0],
      [1, 0, 0],
      [Math.cos(rad), Math.sin(rad), 0]
    );

    if (badgeCanvas && badgeTexture) {
      drawBadgeCanvas(badgeCanvas, 'BUSUR DERAJAT 3D (NST 1°)', readout.formatted, '#fbbf24');
      badgeTexture.needsUpdate = true;
    }

    return readout;
  };

  setAngleDeg(currentAngleDeg);

  return {
    group,
    armHandle,
    setAngleDeg,
    getAngleDeg: () => currentAngleDeg,
    getInteractiveHandles: () => [armHandle],
    dispose: () => {
      arcGeo.dispose();
      arcMat.dispose();
      baseArmGeo.dispose();
      baseArmMat.dispose();
      pointerArmGeo.dispose();
      pointerArmMat.dispose();
      armHandleGeo.dispose();
      armHandleMat.dispose();
      badgeTexture?.dispose();
      badgeMat?.dispose();
    },
  };
}

export interface DigitalProbe3DHandle {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  setReading: (
    mode: 'ph' | 'thermometer',
    value: number,
    subtitle?: string
  ) => ProbeReadoutResult;
  getInteractiveHandles: () => THREE.Object3D[];
  dispose: () => void;
}

/**
 * Interactive 3D Digital pH / Thermocouple Immersion Probe with live OLED readout texture.
 */
export function createDigitalProbe3D(
  initialMode: 'ph' | 'thermometer' = 'ph'
): DigitalProbe3DHandle {
  const group = new THREE.Group();
  group.name = 'ruanglab-digital-probe-3d';

  const needleGeo = new THREE.CylinderGeometry(0.032, 0.018, 1.45, 14);
  const needleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18,
  });
  const needleMesh = new THREE.Mesh(needleGeo, needleMat);
  needleMesh.position.y = -0.65;

  const tipGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.5,
    roughness: 0.15,
  });
  const tipMesh = new THREE.Mesh(tipGeo, tipMat);
  tipMesh.position.y = -1.38;

  const bodyGeo = new THREE.BoxGeometry(0.42, 0.78, 0.2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.38,
    metalness: 0.3,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.42;
  bodyMesh.name = 'Probe Sensor Digital 3D';
  bodyMesh.userData = {
    measurementHandle: 'probe-body',
    interactive: true,
    type: 'draggable',
    label: 'Probe Sensor Digital 3D',
  };

  group.add(needleMesh, tipMesh, bodyMesh);

  let oledCanvas: HTMLCanvasElement | null = null;
  let oledTex: THREE.CanvasTexture | null = null;
  let oledMat: THREE.MeshBasicMaterial | null = null;
  let oledGeo: THREE.PlaneGeometry | null = null;

  if (typeof document !== 'undefined') {
    oledCanvas = document.createElement('canvas');
    oledCanvas.width = 320;
    oledCanvas.height = 112;
    oledTex = new THREE.CanvasTexture(oledCanvas);
    oledGeo = new THREE.PlaneGeometry(0.86, 0.32);
    oledMat = new THREE.MeshBasicMaterial({ map: oledTex, side: THREE.DoubleSide });
    const oledMesh = new THREE.Mesh(oledGeo, oledMat);
    oledMesh.position.set(0, 1.06, 0.12);
    group.add(oledMesh);
  }

  let lastFormatted = '';

  const setReading = (
    mode: 'ph' | 'thermometer',
    value: number,
    subtitle?: string
  ): ProbeReadoutResult => {
    const res = formatProbeReadout(mode, value);
    tipMat.emissive.set(res.severityHex);
    const title = subtitle || (mode === 'ph' ? 'PROBE pH METER 3D' : 'TERMOKOPEL DIGITAL 3D');
    const cacheKey = `${title}|${res.formatted}`;
    if (oledCanvas && oledTex && cacheKey !== lastFormatted) {
      lastFormatted = cacheKey;
      drawBadgeCanvas(oledCanvas, title, res.formatted, res.severityHex);
      oledTex.needsUpdate = true;
    }
    return res;
  };

  setReading(initialMode, initialMode === 'ph' ? 7.0 : 25.0);

  return {
    group,
    bodyMesh,
    setReading,
    getInteractiveHandles: () => [bodyMesh],
    dispose: () => {
      needleGeo.dispose();
      needleMat.dispose();
      tipGeo.dispose();
      tipMat.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      oledGeo?.dispose();
      oledMat?.dispose();
      oledTex?.dispose();
    },
  };
}
