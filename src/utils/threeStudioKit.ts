import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SceneThemeColors } from '../components/ui/VisualComfortToolbar';
import { registerActiveXRScene } from './webXRStudioAdapter';
import { attachMultiApparatusAndScaffoldingVisuals } from './engines/multiApparatusEngine';

export interface ProfilePoint2D {
  x: number;
  y: number;
}

export interface GraduationTick {
  value: number;
  isMajor: boolean;
  ratio: number;
}

export interface CameraSyncPose {
  position: [number, number, number];
  target: [number, number, number];
  seq: number;
  sourceId?: string;
}

/**
 * Computes hardware WebGL2 MSAA sample count safely.
 * Software GL (SwiftShader / llvmpipe) receives 0 so it avoids multisampled renderbuffer crashes.
 */
export function computeMsaaSamples(maxSamples: number, isSoftwareGl: boolean): number {
  if (isSoftwareGl || !Number.isFinite(maxSamples) || maxSamples <= 1) {
    return 0;
  }
  return Math.min(4, Math.max(0, Math.floor(maxSamples)));
}

/**
 * Generates pure graduation tick marks from 0..maxValue.
 */
export function buildGraduationTicks(
  maxValue: number,
  majorStep: number,
  minorStep: number
): GraduationTick[] {
  if (maxValue <= 0 || majorStep <= 0 || minorStep <= 0) {
    return [];
  }
  const ticks: GraduationTick[] = [];
  const totalSteps = Math.round(maxValue / minorStep);
  const majorEvery = Math.max(1, Math.round(majorStep / minorStep));
  for (let i = 0; i <= totalSteps; i += 1) {
    const val = Number((i * minorStep).toFixed(4));
    ticks.push({
      value: val,
      isMajor: i % majorEvery === 0,
      ratio: Math.min(1, Math.max(0, val / maxValue)),
    });
  }
  return ticks;
}

/**
 * Generates thick-walled borosilicate beaker lathe points with rolled pouring rim.
 */
export function createBeakerProfilePoints(
  radius: number,
  height: number,
  wallThickness = 0.045
): ProfilePoint2D[] {
  const r = Math.max(0.2, radius);
  const h = Math.max(0.4, height);
  const w = Math.min(r * 0.25, Math.max(0.015, wallThickness));
  const lipOut = r + w * 1.45;
  const bevel = Math.min(0.08, r * 0.14);

  return [
    { x: 0, y: 0 },
    { x: r - bevel, y: 0 },
    { x: r, y: bevel },
    { x: r, y: h - w * 2.2 },
    { x: lipOut, y: h - w * 0.4 },
    { x: lipOut, y: h },
    { x: r - w * 0.5, y: h },
    { x: r - w, y: h - w * 1.5 },
    { x: r - w, y: w + bevel * 0.6 },
    { x: r - w - bevel * 0.5, y: w },
    { x: 0, y: w },
  ];
}

/**
 * Generates smooth thick-walled Erlenmeyer conical flask lathe points with neck collar.
 */
export function createErlenmeyerProfilePoints(
  baseRadius: number,
  neckRadius: number,
  totalHeight: number,
  wallThickness = 0.042
): ProfilePoint2D[] {
  const rb = Math.max(0.3, baseRadius);
  const rn = Math.min(rb * 0.72, Math.max(0.14, neckRadius));
  const h = Math.max(0.8, totalHeight);
  const w = Math.min(rn * 0.28, Math.max(0.015, wallThickness));

  const heelH = h * 0.12;
  const coneTopH = h * 0.66;
  const rimY = h;
  const beadOut = rn + w * 1.35;

  const pts: ProfilePoint2D[] = [{ x: 0, y: 0 }, { x: rb - w * 2.4, y: 0 }];

  // Outer lower heel curve
  for (let i = 1; i <= 5; i += 1) {
    const t = i / 5;
    const angle = (t * Math.PI) / 2;
    pts.push({
      x: rb - w * 2.4 + Math.sin(angle) * (w * 2.4),
      y: heelH * (1 - Math.cos(angle) * 0.85),
    });
  }

  // Conical body tapering to neck shoulder
  for (let i = 1; i <= 6; i += 1) {
    const t = i / 6;
    const smoothT = t * t * (3 - 2 * t);
    pts.push({
      x: rb + (rn - rb) * smoothT,
      y: heelH + (coneTopH - heelH) * t,
    });
  }

  // Cylindrical neck + rolled glass collar
  pts.push({ x: rn, y: rimY - w * 2.2 });
  pts.push({ x: beadOut, y: rimY - w * 0.9 });
  pts.push({ x: beadOut, y: rimY });
  pts.push({ x: rn - w * 0.6, y: rimY });
  pts.push({ x: rn - w, y: rimY - w * 1.4 });
  pts.push({ x: rn - w, y: coneTopH });

  // Inner wall back down to floor
  for (let i = 5; i >= 0; i -= 1) {
    const t = i / 6;
    const smoothT = t * t * (3 - 2 * t);
    pts.push({
      x: Math.max(0.02, rb - w + (rn - rb) * smoothT),
      y: heelH + (coneTopH - heelH) * t,
    });
  }

  pts.push({ x: Math.max(0.02, rb - w * 2.6), y: w });
  pts.push({ x: 0, y: w });

  return pts;
}

/**
 * Generates lab glass funnel profile points (for burette top or filtration).
 */
export function createFunnelProfilePoints(
  topRadius: number,
  stemRadius: number,
  coneHeight: number,
  stemHeight: number,
  wall = 0.024
): ProfilePoint2D[] {
  const tr = Math.max(0.12, topRadius);
  const sr = Math.min(tr * 0.45, Math.max(0.04, stemRadius));
  const ch = Math.max(0.12, coneHeight);
  const sh = Math.max(0.08, stemHeight);

  return [
    { x: sr * 0.45, y: 0 },
    { x: sr, y: 0 },
    { x: sr, y: sh },
    { x: tr, y: sh + ch - wall * 1.2 },
    { x: tr + wall * 0.7, y: sh + ch },
    { x: tr - wall * 0.3, y: sh + ch },
    { x: Math.max(0.015, sr - wall * 0.7), y: sh },
    { x: Math.max(0.015, sr - wall * 0.7), y: 0 },
  ];
}

/**
 * Deterministic 2D hash noise for procedural PBR lab textures.
 */
function seededNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function toVec2Points(pts: ProfilePoint2D[]): THREE.Vector2[] {
  return pts.map((p) => new THREE.Vector2(p.x, p.y));
}

export function buildLatheFromProfile(
  pts: ProfilePoint2D[],
  segments = 48
): THREE.LatheGeometry {
  const geo = new THREE.LatheGeometry(toVec2Points(pts), segments);
  geo.computeVertexNormals();
  return geo;
}

export interface LabBenchTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Builds procedural phenolic/granite laboratory workbench PBR maps.
 */
export function createLabBenchTextures(
  baseHex: string | number,
  repeatX = 3,
  repeatY = 2
): LabBenchTextureSet | null {
  if (typeof document === 'undefined') return null;
  const size = 256;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (!aCtx || !rCtx || !bCtx) return null;

  const baseColor = new THREE.Color(baseHex);
  const rBase = Math.round(baseColor.r * 255);
  const gBase = Math.round(baseColor.g * 255);
  const bBase = Math.round(baseColor.b * 255);

  aCtx.fillStyle = `rgb(${rBase},${gBase},${bBase})`;
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = 'rgb(148,148,148)';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);

  // Subtle mineral epoxy speckle & micro-grain
  for (let i = 0; i < 1600; i += 1) {
    const px = seededNoise(i, 1, 3) * size;
    const py = seededNoise(i, 2, 7) * size;
    const rad = 0.6 + seededNoise(i, 3, 11) * 1.4;
    const lum = (seededNoise(i, 4, 17) - 0.5) * 26;

    const rr = Math.max(0, Math.min(255, Math.round(rBase + lum)));
    const gg = Math.max(0, Math.min(255, Math.round(gBase + lum)));
    const bb = Math.max(0, Math.min(255, Math.round(bBase + lum)));
    aCtx.fillStyle = `rgba(${rr},${gg},${bb},0.35)`;
    aCtx.fillRect(px, py, rad, rad);

    const roughVal = Math.max(95, Math.min(205, Math.round(145 + lum * 1.4)));
    rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
    rCtx.fillRect(px, py, rad, rad);

    const bumpVal = Math.max(90, Math.min(165, Math.round(128 + lum * 0.9)));
    bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
    bCtx.fillRect(px, py, rad, rad);
  }

  // Faint wiped benchtop seam grid
  aCtx.strokeStyle = 'rgba(255,255,255,0.035)';
  aCtx.lineWidth = 1;
  aCtx.strokeRect(0.5, 0.5, size - 1, size - 1);

  rCtx.strokeStyle = 'rgb(190,190,190)';
  rCtx.lineWidth = 1;
  rCtx.strokeRect(0.5, 0.5, size - 1, size - 1);

  const configure = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const map = configure(albedoCanvas, true);
  const roughnessMap = configure(roughCanvas, false);
  const bumpMap = configure(bumpCanvas, false);

  return {
    map,
    roughnessMap,
    bumpMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
    },
  };
}

export interface BrushedMetalTextureSet {
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates directional brushed stainless steel / anodized aluminum textures.
 */
export function createBrushedMetalTextures(): BrushedMetalTextureSet | null {
  if (typeof document === 'undefined') return null;
  const size = 256;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');

  if (!rCtx || !bCtx) return null;

  rCtx.fillStyle = 'rgb(84,84,84)';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    const jitter = (seededNoise(y, 13, 29) - 0.5) * 44;
    const rVal = Math.max(46, Math.min(132, Math.round(86 + jitter)));
    const bVal = Math.max(96, Math.min(160, Math.round(128 + jitter * 0.65)));
    rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
    rCtx.fillRect(0, y, size, 1);
    bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.fillRect(0, y, size, 1);
  }

  const makeTex = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const roughnessMap = makeTex(rCanvas);
  const bumpMap = makeTex(bCanvas);

  return {
    roughnessMap,
    bumpMap,
    dispose: () => {
      roughnessMap.dispose();
      bumpMap.dispose();
    },
  };
}

export interface GraduationTextureOptions {
  maxValue: number;
  majorStep: number;
  minorStep: number;
  unit?: string;
  strokeColor?: string;
  invertTopToBottom?: boolean;
  width?: number;
  height?: number;
}

/**
 * Draws crisp calibrated mL / cm / degree markings onto a transparent CanvasTexture.
 */
export function createGraduationScaleTexture(
  options: GraduationTextureOptions
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = options.width ?? 256;
  const h = options.height ?? 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, w, h);
  const stroke = options.strokeColor ?? 'rgba(226, 240, 255, 0.9)';
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.font = 'bold 20px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';

  const padY = 28;
  const usableH = h - padY * 2;
  const ticks = buildGraduationTicks(
    options.maxValue,
    options.majorStep,
    options.minorStep
  );

  for (const tick of ticks) {
    const norm = options.invertTopToBottom ? tick.ratio : 1 - tick.ratio;
    const y = padY + norm * usableH;
    const len = tick.isMajor ? 48 : 24;
    ctx.lineWidth = tick.isMajor ? 2.6 : 1.5;

    ctx.beginPath();
    ctx.moveTo(w * 0.25, y);
    ctx.lineTo(w * 0.25 + len, y);
    ctx.stroke();

    if (tick.isMajor) {
      const label =
        options.unit && tick.value === options.maxValue
          ? `${tick.value} ${options.unit}`
          : `${tick.value}`;
      ctx.fillText(label, w * 0.25 + len + 10, y);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a sharp transparent graduated scale texture (mL for burette/beaker, cm for physics track/ruler).
 */
export function createGraduatedScaleTexture(
  maxVal: number,
  unit: string,
  steps = 20,
  options?: {
    invertTopToBottom?: boolean;
    strokeColor?: string;
    width?: number;
    height?: number;
  }
): THREE.CanvasTexture | null {
  const safeMax = Math.max(1, Number.isFinite(maxVal) ? maxVal : 50);
  const safeSteps = Math.max(2, Math.round(Number.isFinite(steps) ? steps : 20));
  const minorStep = safeMax / safeSteps;
  const majorInterval = Math.max(1, Math.round(safeSteps / 5));
  const majorStep = minorStep * majorInterval;

  return createGraduationScaleTexture({
    maxValue: safeMax,
    majorStep,
    minorStep,
    unit,
    invertTopToBottom: options?.invertTopToBottom ?? false,
    strokeColor: options?.strokeColor ?? 'rgba(226, 240, 255, 0.94)',
    width: options?.width ?? 256,
    height: options?.height ?? 512,
  });
}

export type BiologicalMembraneTexture = THREE.CanvasTexture & {
  bumpMap?: THREE.CanvasTexture;
};

/**
 * Generates an organic cellular/cristae procedural CanvasTexture (+ companion bumpMap)
 * for mitochondria, chloroplasts, nuclei, and biological tissues so they never look like flat plastic capsules.
 */
export function createBiologicalMembraneTexture(
  baseColor: string | number,
  accentColor: string | number
): BiologicalMembraneTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (!ctx || !bCtx) return null;

  const base = new THREE.Color(baseColor);
  const accent = new THREE.Color(accentColor);
  const darkBase = base.clone().multiplyScalar(0.58);

  const grad = ctx.createRadialGradient(size * 0.45, size * 0.45, 18, size * 0.5, size * 0.5, size * 0.72);
  grad.addColorStop(0, accent.clone().lerp(base, 0.35).getStyle());
  grad.addColorStop(0.55, base.getStyle());
  grad.addColorStop(1, darkBase.getStyle());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = 'rgb(124,124,124)';
  bCtx.fillRect(0, 0, size, size);

  // Undulating cristae / endomembrane folds
  for (let y = 14; y < size - 10; y += 20) {
    const phase = seededNoise(y, 3, 19) * Math.PI * 2;
    const foldColor = accent.clone().lerp(new THREE.Color('#ffffff'), 0.22);
    ctx.strokeStyle = `rgba(${Math.round(foldColor.r * 255)},${Math.round(foldColor.g * 255)},${Math.round(foldColor.b * 255)},0.48)`;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.3,
      y + Math.sin(phase) * 14,
      size * 0.7,
      y - Math.cos(phase) * 14,
      size,
      y
    );
    ctx.stroke();

    bCtx.strokeStyle = 'rgb(196,196,196)';
    bCtx.lineWidth = 5;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.bezierCurveTo(
      size * 0.3,
      y + Math.sin(phase) * 14,
      size * 0.7,
      y - Math.cos(phase) * 14,
      size,
      y
    );
    bCtx.stroke();
  }

  // Cellular vesicles, thylakoid grana & membrane pores
  for (let i = 0; i < 48; i += 1) {
    const cx = seededNoise(i, 7, 13) * size;
    const cy = seededNoise(i, 11, 29) * size;
    const rx = 5 + seededNoise(i, 5, 37) * 14;
    const ry = 4 + seededNoise(i, 9, 43) * 10;
    const rot = seededNoise(i, 15, 53) * Math.PI;

    const cellTint = i % 2 === 0 ? accent : darkBase;
    ctx.strokeStyle = `rgba(${Math.round(cellTint.r * 255)},${Math.round(cellTint.g * 255)},${Math.round(cellTint.b * 255)},0.42)`;
    ctx.fillStyle = `rgba(${Math.round(accent.r * 255)},${Math.round(accent.g * 255)},${Math.round(accent.b * 255)},0.18)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    bCtx.fillStyle = i % 2 === 0 ? 'rgb(168,168,168)' : 'rgb(96,96,96)';
    bCtx.beginPath();
    bCtx.ellipse(cx, cy, rx * 0.85, ry * 0.85, rot, 0, Math.PI * 2);
    bCtx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas) as BiologicalMembraneTexture;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.colorSpace = THREE.NoColorSpace;
  bumpTex.needsUpdate = true;
  tex.bumpMap = bumpTex;

  return tex;
}

/**
 * Smoothly interpolates camera position and OrbitControls target using Vector3.lerp.
 * Returns true while transition is still in progress, or false once settled at the target.
 */
export function smoothCameraTransition(
  camera: { position: THREE.Vector3 },
  controls: { target: THREE.Vector3; update?: () => void },
  targetPos: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  alpha = 0.12
): boolean {
  const safeAlpha = Math.min(1, Math.max(0.01, Number.isFinite(alpha) ? alpha : 0.12));
  camera.position.lerp(targetPos, safeAlpha);
  controls.target.lerp(targetLookAt, safeAlpha);

  const posDistSq = camera.position.distanceToSquared(targetPos);
  const targetDistSq = controls.target.distanceToSquared(targetLookAt);
  if (posDistSq < 0.0025 && targetDistSq < 0.0025) {
    camera.position.copy(targetPos);
    controls.target.copy(targetLookAt);
    return false;
  }
  return true;
}

/**
 * Generates procedural banded/cloudy/cratered planet surface textures so celestial spheres have organic detail.
 */
export function createPlanetSurfaceTexture(options: {
  baseHex: string;
  accentHex: string;
  style: 'terrestrial' | 'gas-giant' | 'rocky' | 'ice';
}): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const base = new THREE.Color(options.baseHex);
  const accent = new THREE.Color(options.accentHex);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, accent.clone().lerp(base, 0.45).getStyle());
  grad.addColorStop(0.5, base.getStyle());
  grad.addColorStop(1, accent.clone().lerp(base, 0.35).getStyle());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (options.style === 'gas-giant') {
    for (let y = 0; y < h; y += 3) {
      const wave = Math.sin(y * 0.16) * 0.5 + 0.5;
      const bandColor = base.clone().lerp(accent, wave * 0.72);
      ctx.fillStyle = `rgba(${Math.round(bandColor.r * 255)},${Math.round(bandColor.g * 255)},${Math.round(bandColor.b * 255)},0.55)`;
      ctx.fillRect(0, y, w, 3 + (seededNoise(y, 4, 2) > 0.7 ? 2 : 0));
    }
    // Great storm oval
    ctx.fillStyle = accent.clone().lerp(new THREE.Color('#ffffff'), 0.25).getStyle();
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.58, 28, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (options.style === 'terrestrial') {
    for (let i = 0; i < 42; i += 1) {
      const cx = seededNoise(i, 1, 9) * w;
      const cy = 24 + seededNoise(i, 2, 5) * (h - 48);
      const rx = 18 + seededNoise(i, 3, 12) * 52;
      const ry = 10 + seededNoise(i, 4, 15) * 28;
      ctx.fillStyle = accent.clone().lerp(base, 0.25).getStyle();
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, seededNoise(i, 5, 2) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 24; i += 1) {
      const cx = seededNoise(i, 9, 41) * w;
      const cy = seededNoise(i, 8, 23) * h;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 34, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    // Crater / icy rift detail
    for (let i = 0; i < 75; i += 1) {
      const cx = seededNoise(i, 1, 31) * w;
      const cy = seededNoise(i, 2, 17) * h;
      const rad = 4 + seededNoise(i, 3, 21) * 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.fillStyle = 'rgba(15,23,42,0.18)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export interface StudioWorkbenchResult {
  group: THREE.Group;
  benchTopMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  floorMat: THREE.MeshStandardMaterial;
  gridHelper: THREE.GridHelper;
  updateTheme: (colors: SceneThemeColors) => void;
  dispose: () => void;
}

/**
 * Builds a clean, studio-grade laboratory bench with phenolic texture, brushed aluminum rail edge,
 * contact shadow floor, and unobtrusive metric GridHelper.
 */
export function createStudioWorkbenchGroup(
  colors: SceneThemeColors,
  options?: {
    width?: number;
    depth?: number;
    thickness?: number;
    benchY?: number;
    floorY?: number;
    gridSize?: number;
    gridDivisions?: number;
  }
): StudioWorkbenchResult {
  const width = options?.width ?? 11.2;
  const depth = options?.depth ?? 6.4;
  const thickness = options?.thickness ?? 0.32;
  const benchY = options?.benchY ?? 0.16;
  const floorY = options?.floorY ?? -0.02;

  const group = new THREE.Group();
  const benchTex = createLabBenchTextures(colors.tableHex, 4, 2.5);
  const metalTex = createBrushedMetalTextures();

  const floorGeo = new THREE.PlaneGeometry(46, 46);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.08,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  group.add(floor);

  const gridHelper = new THREE.GridHelper(
    options?.gridSize ?? 28,
    options?.gridDivisions ?? 28,
    0x334155,
    0x1e293b
  );
  gridHelper.position.y = floorY + 0.01;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.35;
  group.add(gridHelper);

  // Beveled phenolic laboratory benchtop
  const benchGeo = new RoundedBoxGeometry(width, thickness, depth, 4, 0.04);
  const benchTopMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    map: benchTex?.map ?? null,
    roughnessMap: benchTex?.roughnessMap ?? null,
    bumpMap: benchTex?.bumpMap ?? null,
    bumpScale: 0.008,
    roughness: 0.65,
    metalness: 0.12,
    envMapIntensity: 0.35,
  });
  const benchMesh = new THREE.Mesh(benchGeo, benchTopMat);
  benchMesh.position.y = benchY;
  benchMesh.castShadow = true;
  benchMesh.receiveShadow = true;
  group.add(benchMesh);

  // Anodized brushed aluminum front/perimeter trim band
  const trimGeo = new RoundedBoxGeometry(width + 0.1, thickness * 0.42, depth + 0.1, 3, 0.025);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.004,
    metalness: 0.82,
    roughness: 0.34,
    envMapIntensity: 0.45,
  });
  const trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.y = benchY - thickness * 0.25;
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  const updateTheme = (nextColors: SceneThemeColors) => {
    benchTopMat.color.setHex(nextColors.tableHex ?? 0x1e293b);
    floorMat.color.setHex(nextColors.floorHex ?? 0x0f172a);
  };

  const dispose = () => {
    floorGeo.dispose();
    floorMat.dispose();
    benchGeo.dispose();
    benchTopMat.dispose();
    trimGeo.dispose();
    trimMat.dispose();
    gridHelper.dispose();
    benchTex?.dispose();
    metalTex?.dispose();
  };

  return {
    group,
    benchTopMat,
    trimMat,
    floorMat,
    gridHelper,
    updateTheme,
    dispose,
  };
}

/**
 * Builds an articulated bosshead collar + horizontal rod + dual-prong burette clamp
 * so suspended laboratory glassware visually attaches cleanly to the retort stand.
 */
export function createBuretteClampAssembly(
  standX: number,
  buretteX: number,
  clampY: number,
  steelMat: THREE.Material,
  collarMat: THREE.Material
): THREE.Group {
  const clampGroup = new THREE.Group();
  const armSpan = Math.abs(buretteX - standX);
  const midX = (standX + buretteX) / 2;

  // Bosshead block mounted around vertical retort rod
  const bossGeo = new RoundedBoxGeometry(0.28, 0.26, 0.24, 2, 0.03);
  const boss = new THREE.Mesh(bossGeo, collarMat);
  boss.position.set(standX, clampY, 0);
  boss.castShadow = true;
  clampGroup.add(boss);

  // Thumbscrew knob on bosshead
  const knobGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.14, 16);
  const knob = new THREE.Mesh(knobGeo, steelMat);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(standX - 0.18, clampY, 0);
  clampGroup.add(knob);

  // Horizontal steel arm reaching burette
  const armGeo = new THREE.CylinderGeometry(0.045, 0.045, armSpan, 16);
  const arm = new THREE.Mesh(armGeo, steelMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(midX, clampY, 0);
  arm.castShadow = true;
  clampGroup.add(arm);

  // Split V-jaw clamp ring gripping the burette cylinder
  const jawGeo = new THREE.TorusGeometry(0.21, 0.036, 14, 28, Math.PI * 1.48);
  const jaw = new THREE.Mesh(jawGeo, collarMat);
  jaw.rotation.x = Math.PI / 2;
  jaw.rotation.z = -Math.PI * 0.24;
  jaw.position.set(buretteX, clampY, 0);
  jaw.castShadow = true;
  clampGroup.add(jaw);

  return clampGroup;
}

export interface AdaptiveFpsMonitor {
  recordFrame: (nowMs?: number) => void;
  reset: () => void;
  resetMonitor: () => void;
  getAverageFps: () => number;
  isTriggered: () => boolean;
}

/**
 * Creates a rolling-window adaptive FPS monitor to detect underperforming GPU hardware (e.g. low-end devices in 3T areas).
 * If rolling average FPS over sampleDurationMs (>2000ms default) drops below targetFps (30 fps default), triggers onLowFpsTrigger.
 * Ignores tab backgrounding and long frame deltas (> 250ms) to avoid false-positives.
 */
export function createAdaptiveFpsMonitor(
  onLowFpsTrigger: (avgFps: number) => void,
  targetFps = 30,
  sampleDurationMs = 2000
): AdaptiveFpsMonitor {
  let frameTimestamps: number[] = [];
  let lastFrameTime = 0;
  let rollingAvgFps = 60;
  let triggered = false;

  const reset = () => {
    frameTimestamps = [];
    lastFrameTime = 0;
    rollingAvgFps = 60;
    triggered = false;
  };

  return {
    recordFrame: (nowMs?: number) => {
      // 1. Ignore frame sample if document is hidden (tab switch or browser minimize)
      if (typeof document !== 'undefined' && document.hidden) {
        frameTimestamps = [];
        lastFrameTime = 0;
        return;
      }

      const now =
        typeof nowMs === 'number' && nowMs > 0
          ? nowMs
          : typeof performance !== 'undefined'
          ? performance.now()
          : Date.now();

      // 2. Ignore frame if deltaMs > 250 (browser throttled or tab resumed)
      if (lastFrameTime > 0) {
        const deltaMs = now - lastFrameTime;
        if (deltaMs > 250) {
          frameTimestamps = [now];
          lastFrameTime = now;
          return;
        }
      }

      lastFrameTime = now;
      frameTimestamps.push(now);

      // Keep rolling window of timestamps spanning at least sampleDurationMs
      const maxWindowSpan = Math.max(sampleDurationMs, 250);
      while (frameTimestamps.length > 2 && now - frameTimestamps[1] >= maxWindowSpan) {
        frameTimestamps.shift();
      }

      if (frameTimestamps.length >= 2) {
        const elapsed = now - frameTimestamps[0];
        if (elapsed > 0) {
          rollingAvgFps = ((frameTimestamps.length - 1) * 1000) / elapsed;
        }
        if (!triggered && elapsed >= sampleDurationMs) {
          const windowAvgFps = ((frameTimestamps.length - 1) * 1000) / elapsed;
          rollingAvgFps = windowAvgFps;
          if (windowAvgFps < targetFps) {
            triggered = true;
            onLowFpsTrigger(windowAvgFps);
          }
        }
      }
    },
    reset,
    resetMonitor: reset,
    getAverageFps: () => rollingAvgFps,
    isTriggered: () => triggered,
  };
}

/**
 * Applies lightweight rendering properties for low-end hardware in 3T regions.
 * Disables shadows, forces pixel ratio to 1, and limits memory pressure.
 */
export function configureRendererForLiteMode(
  renderer: THREE.WebGLRenderer,
  isLite: boolean,
  isSoftwareGl = false
): void {
  if (!renderer) return;
  if (isLite) {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
  } else {
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    );
    renderer.shadowMap.enabled = true;
  }
}

export interface StudioComposerHandle {
  composer?: EffectComposer;
  renderTarget?: THREE.WebGLRenderTarget;
  bloomPass?: UnrealBloomPass;
  resize: (width: number, height: number, pixelRatio: number) => void;
  render: (liteDeviceMode?: boolean, dt?: number) => void;
  dispose: () => void;
}

/**
 * Configures an EffectComposer with hardware WebGL2 MSAA (when supported) + subtle Bloom + ACES OutputPass.
 * Includes OutputPass so renderer.toneMapping (ACESFilmicToneMapping) and sRGB output color space apply cleanly.
 * On software WebGL (SwiftShader/llvmpipe), bypasses HalfFloat RenderTarget + multi-pass Bloom/Output shaders
 * and renders directly so scene startup and interaction remain responsive.
 */
export function createStudioComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  isSoftwareGl: boolean,
  bloomOptions?: {
    strength?: number;
    radius?: number;
    threshold?: number;
  }
): StudioComposerHandle {
  const xrRig = registerActiveXRScene(renderer, scene, camera);
  const sandboxVisuals = attachMultiApparatusAndScaffoldingVisuals(scene, camera);

  if (isSoftwareGl) {
    return {
      resize: () => {},
      render: (_liteDeviceMode?: boolean, dt = 0.016) => {
        const safeDt = Number.isFinite(dt) ? Math.min(0.05, Math.max(0, dt)) : 0.016;
        xrRig.updateSpatialRaycasters();
        sandboxVisuals.updatePerFrame(safeDt);
        renderer.render(scene, camera);
      },
      dispose: () => {
        sandboxVisuals.dispose();
        xrRig.dispose();
      },
    };
  }

  const pixelRatio = renderer.getPixelRatio();
  const maxSamples = renderer.capabilities?.maxSamples ?? 4;
  const samples = computeMsaaSamples(maxSamples, isSoftwareGl);

  const renderTarget = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(width * pixelRatio)),
    Math.max(1, Math.floor(height * pixelRatio)),
    {
      type: THREE.HalfFloatType,
      samples,
    }
  );

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(Math.max(1, width), Math.max(1, height));

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, width), Math.max(1, height)),
    bloomOptions?.strength ?? 0.14,
    bloomOptions?.radius ?? 0.25,
    bloomOptions?.threshold ?? 1.15
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  let fxaaPass: ShaderPass | null = null;
  if (samples === 0) {
    fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(
      1 / Math.max(1, width * pixelRatio),
      1 / Math.max(1, height * pixelRatio)
    );
    composer.addPass(fxaaPass);
  }

  const resize = (nextW: number, nextH: number, nextPr: number) => {
    const safeW = Math.max(1, nextW);
    const safeH = Math.max(1, nextH);
    composer.setPixelRatio(nextPr);
    composer.setSize(safeW, safeH);
    bloomPass.setSize(safeW, safeH);
    if (fxaaPass) {
      fxaaPass.uniforms['resolution'].value.set(
        1 / Math.max(1, safeW * nextPr),
        1 / Math.max(1, safeH * nextPr)
      );
    }
  };

  return {
    composer,
    renderTarget,
    bloomPass,
    resize,
    render: (liteDeviceMode?: boolean, dt = 0.016) => {
      const safeDt = Number.isFinite(dt) ? Math.min(0.05, Math.max(0, dt)) : 0.016;
      xrRig.updateSpatialRaycasters();
      sandboxVisuals.updatePerFrame(safeDt);
      if (renderer.xr?.isPresenting || liteDeviceMode) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }
    },
    dispose: () => {
      sandboxVisuals.dispose();
      xrRig.dispose();
      renderTarget.dispose();
      composer.dispose();
    },
  };
}

export interface DisposalStats {
  geometriesDisposed: number;
  materialsDisposed: number;
  texturesDisposed: number;
}

const MATERIAL_TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'envMap',
  'lightMap',
  'specularMap',
] as const;

/**
 * Consistently traverses a Three.js Scene, disposes all geometries, materials,
 * material texture maps, environment map, render lists, and WebGLRenderer context resources.
 */
export function disposeThreeSceneResources(
  scene: THREE.Scene,
  renderer?: THREE.WebGLRenderer | null,
  envTexture?: THREE.Texture | null
): DisposalStats {
  let geometriesDisposed = 0;
  let materialsDisposed = 0;
  let texturesDisposed = 0;

  const disposeMaterialInstance = (mat: any) => {
    if (!mat || typeof mat !== 'object') return;
    for (const slot of MATERIAL_TEXTURE_SLOTS) {
      const tex = mat[slot];
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
        texturesDisposed += 1;
      }
    }
    if (typeof mat.dispose === 'function') {
      mat.dispose();
      materialsDisposed += 1;
    }
  };

  scene.traverse((obj: any) => {
    if (obj?.geometry && typeof obj.geometry.dispose === 'function') {
      obj.geometry.dispose();
      geometriesDisposed += 1;
    }
    if (Array.isArray(obj?.material)) {
      obj.material.forEach((m: any) => disposeMaterialInstance(m));
    } else if (obj?.material) {
      disposeMaterialInstance(obj.material);
    }
  });

  if (envTexture && typeof envTexture.dispose === 'function') {
    envTexture.dispose();
    texturesDisposed += 1;
  }

  scene.clear();

  if (renderer) {
    renderer.renderLists?.dispose?.();
    renderer.dispose();
  }

  return {
    geometriesDisposed,
    materialsDisposed,
    texturesDisposed,
  };
}

/**
 * Renders a synchronous frame immediately before extracting a PNG data URL,
 * eliminating the need for `preserveDrawingBuffer: true` on WebGLRenderer.
 */
export function captureComposerSnapshot(
  renderer: THREE.WebGLRenderer,
  studioComposer: StudioComposerHandle,
  isLite: boolean
): string | null {
  try {
    studioComposer.render(isLite, 0);
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Creates a standardized 3D vector arrow group (`shaft` + `head`) used across Physics and Astronomy scenes.
 */
export function createVectorArrowGroup(
  colorHex: number,
  emissiveIntensity = 0.28
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.2,
    emissive: colorHex,
    emissiveIntensity,
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

/**
 * Orients and scales a 3D vector arrow created by `createVectorArrowGroup`.
 */
export function orientAndScaleVectorArrow(
  arrow: THREE.Group,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number
): void {
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

  const shaftLen = Math.max(0.1, length - 0.34);
  const shaft = arrow.getObjectByName('shaft') as THREE.Mesh | undefined;
  const head = arrow.getObjectByName('head') as THREE.Mesh | undefined;
  if (shaft) {
    shaft.scale.set(1, shaftLen, 1);
  }
  if (head) {
    head.position.set(0, shaftLen, 0);
  }
}

/**
 * Converts a visible-spectrum wavelength in nanometers (380..780nm) to a 24-bit RGB hex integer.
 */
export function wavelengthNmToHex(wavelengthNm: number): number {
  let r = 0;
  let g = 0;
  let b = 0;
  if (wavelengthNm >= 380 && wavelengthNm < 440) {
    r = -(wavelengthNm - 440) / (440 - 380);
    b = 1;
  } else if (wavelengthNm >= 440 && wavelengthNm < 490) {
    g = (wavelengthNm - 440) / (490 - 440);
    b = 1;
  } else if (wavelengthNm >= 490 && wavelengthNm < 510) {
    g = 1;
    b = -(wavelengthNm - 510) / (510 - 490);
  } else if (wavelengthNm >= 510 && wavelengthNm < 580) {
    r = (wavelengthNm - 510) / (580 - 510);
    g = 1;
  } else if (wavelengthNm >= 580 && wavelengthNm < 645) {
    r = 1;
    g = -(wavelengthNm - 645) / (645 - 580);
  } else if (wavelengthNm >= 645 && wavelengthNm <= 780) {
    r = 1;
  }
  const ir = Math.round(Math.min(255, Math.max(0, r * 255)));
  const ig = Math.round(Math.min(255, Math.max(0, g * 255)));
  const ib = Math.round(Math.min(255, Math.max(0, b * 255)));
  return (ir << 16) | (ig << 8) | ib;
}

export interface BorosilicateGlassOptions {
  color?: number;
  tintOpacity?: number;
  ior?: number;
  thickness?: number;
  emissive?: number;
  emissiveIntensity?: number;
}

/**
 * Creates a physically realistic borosilicate glassware material (`ior: 1.47`, `transmission`, `clearcoat`)
 * for desktop/GPU rigs, automatically falling back to lightweight transparent `MeshStandardMaterial`
 * in `liteDeviceMode` (3T schools) so no extra transmission render pass is incurred.
 */
export function createBorosilicateGlassMaterial(
  liteDeviceMode = false,
  options: BorosilicateGlassOptions = {}
): THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial {
  const {
    color = 0xe8f4fc,
    tintOpacity = 0.3,
    ior = 1.47,
    thickness = 0.35,
    emissive = 0x000000,
    emissiveIntensity = 0,
  } = options;

  if (liteDeviceMode) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.16,
      roughness: 0.12,
      transparent: true,
      opacity: Math.max(0.28, tintOpacity),
      emissive,
      emissiveIntensity,
      depthWrite: false,
    });
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.93,
    transparent: true,
    opacity: tintOpacity,
    ior,
    thickness,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.55,
    emissive,
    emissiveIntensity,
    depthWrite: false,
  });
  mat.userData = {
    baseTransmission: 0.93,
    baseOpacity: tintOpacity,
  };
  return mat;
}

/**
 * Synchronizes runtime `liteDeviceMode` transitions on glass materials created with
 * `createBorosilicateGlassMaterial`.
 */
export function applyBorosilicateLiteMode(
  material: THREE.Material,
  liteDeviceMode: boolean
): void {
  if (material instanceof THREE.MeshPhysicalMaterial) {
    const baseTrans =
      typeof material.userData?.baseTransmission === 'number'
        ? material.userData.baseTransmission
        : 0.93;
    const baseOpacity =
      typeof material.userData?.baseOpacity === 'number'
        ? material.userData.baseOpacity
        : 0.3;
    const nextTrans = liteDeviceMode ? 0 : baseTrans;
    const nextOpacity = liteDeviceMode ? Math.max(0.32, baseOpacity) : baseOpacity;
    if (material.transmission !== nextTrans || material.opacity !== nextOpacity) {
      material.transmission = nextTrans;
      material.opacity = nextOpacity;
      material.needsUpdate = true;
    }
  }
}

export interface InstancedParticlePool {
  mesh: THREE.InstancedMesh;
  maxCount: number;
  setTransform: (
    index: number,
    x: number,
    y: number,
    z: number,
    scale?: number,
    rotX?: number,
    rotY?: number,
    rotZ?: number
  ) => void;
  setColor: (index: number, hex: number) => void;
  commit: (activeCount?: number) => void;
}

/**
 * Wraps `THREE.InstancedMesh` with pre-allocated dummy Object3D and Color helpers
 * for zero-allocation single-draw-call particle simulations (gas molecules, bubbles, solutes).
 */
export function createInstancedParticlePool(
  maxCount: number,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent?: THREE.Object3D
): InstancedParticlePool {
  const safeCount = Math.max(1, Math.floor(maxCount));
  const mesh = new THREE.InstancedMesh(geometry, material, safeCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = safeCount;

  const dummy = new THREE.Object3D();
  const scratchColor = new THREE.Color(0xffffff);

  for (let i = 0; i < safeCount; i++) {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, scratchColor);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  if (parent) {
    parent.add(mesh);
  }

  return {
    mesh,
    maxCount: safeCount,
    setTransform: (
      index: number,
      x: number,
      y: number,
      z: number,
      scale = 1,
      rotX = 0,
      rotY = 0,
      rotZ = 0
    ) => {
      if (index < 0 || index >= safeCount) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rotX, rotY, rotZ);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    },
    setColor: (index: number, hex: number) => {
      if (index < 0 || index >= safeCount) return;
      scratchColor.setHex(hex);
      mesh.setColorAt(index, scratchColor);
    },
    commit: (activeCount?: number) => {
      if (typeof activeCount === 'number') {
        mesh.count = Math.max(0, Math.min(safeCount, Math.floor(activeCount)));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}

