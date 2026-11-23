import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SceneThemeColors } from '../components/ui/VisualComfortToolbar';
import { registerActiveXRScene } from './webXRStudioAdapter';
import { attachMultiApparatusAndScaffoldingVisuals } from './engines/multiApparatusEngine';
import {
  computeEffectivePassFlags,
  DEFAULT_POST_PROCESSING_SETTINGS,
  getDomainPostProcessingDefaults,
  shouldHideMeshForSsao,
  type EffectivePostProcessingState,
  type PostProcessingDomainPreset,
  type PostProcessingSettings,
} from './threePostProcessing';
import type { QualityTier } from '../hooks/useAdaptiveQuality';

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
  repeatY = 2,
  options?: { neutralAlbedo?: boolean }
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

  // Neutral high-luminance mineral base avoids double color multiplication when MeshStandardMaterial.color applies theme tint
  const baseColor = options?.neutralAlbedo ? new THREE.Color(0xf2f2f2) : new THREE.Color(baseHex);
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
    tex.anisotropy = 8;
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
    tex.anisotropy = 8;
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
 * Frame-rate independent exponential camera damping (`THREE.MathUtils.damp` semantics).
 * Returns true while transition is still active, or false once settled at the target.
 */
export function smoothCameraDamp(
  camera: { position: THREE.Vector3 },
  controls: { target: THREE.Vector3; update?: () => void },
  targetPos: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  dtSeconds: number,
  lambda = 6.5
): boolean {
  const safeDt = Math.min(0.1, Math.max(0.001, Number.isFinite(dtSeconds) ? dtSeconds : 0.016));
  const factor = 1 - Math.exp(-lambda * safeDt);
  return smoothCameraTransition(camera, controls, targetPos, targetLookAt, factor);
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
  const benchTex = createLabBenchTextures(colors.tableHex, 4, 2.5, { neutralAlbedo: true });
  const metalTex = createBrushedMetalTextures();

  const floorGeo = new THREE.PlaneGeometry(46, 46);
  const floorMat = new THREE.MeshStandardMaterial({
    color: colors.floorHex ?? 0xd8e0ea,
    roughness: 0.85,
    metalness: 0.08,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  group.add(floor);

  const gridDivisions = options?.gridDivisions ?? 28;
  const gridHelper = new THREE.GridHelper(
    options?.gridSize ?? 28,
    gridDivisions,
    colors.gridPrimaryHex ?? 0x9aa8ba,
    colors.gridSecondaryHex ?? 0xc7d0dc
  );
  gridHelper.position.y = floorY + 0.01;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.38;
  group.add(gridHelper);

  const applyGridColors = (primaryHex?: number, secondaryHex?: number) => {
    const colorAttr = gridHelper.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colorAttr) return;
    const c1 = new THREE.Color(primaryHex ?? 0x9aa8ba);
    const c2 = new THREE.Color(secondaryHex ?? 0xc7d0dc);
    const halfVerts = colorAttr.count / 2;
    const centerLineStart = Math.floor(gridDivisions / 2) * 4;
    for (let i = 0; i < colorAttr.count; i++) {
      const isAxisLine =
        (i >= centerLineStart && i < centerLineStart + 4) ||
        (i >= halfVerts + centerLineStart && i < halfVerts + centerLineStart + 4);
      const col = isAxisLine ? c1 : c2;
      colorAttr.setXYZ(i, col.r, col.g, col.b);
    }
    colorAttr.needsUpdate = true;
  };

  // Beveled phenolic laboratory benchtop
  const benchGeo = new RoundedBoxGeometry(width, thickness, depth, 4, 0.04);
  const benchTopMat = new THREE.MeshStandardMaterial({
    color: colors.tableHex ?? 0xc2ccd8,
    map: benchTex?.map ?? null,
    roughnessMap: benchTex?.roughnessMap ?? null,
    bumpMap: benchTex?.bumpMap ?? null,
    bumpScale: 0.006,
    roughness: 0.56,
    metalness: 0.08,
    envMapIntensity: 0.68,
  });
  const benchMesh = new THREE.Mesh(benchGeo, benchTopMat);
  benchMesh.position.y = benchY;
  benchMesh.castShadow = true;
  benchMesh.receiveShadow = true;
  group.add(benchMesh);

  // Subtle recessed laboratory anti-static work-mat inset on top of benchtop
  const matInsetW = width - 0.9;
  const matInsetD = depth - 0.85;
  const workMatGeo = new THREE.PlaneGeometry(matInsetW, matInsetD);
  const workMatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.tableHex ?? 0xc2ccd8).multiplyScalar(0.92),
    roughnessMap: benchTex?.roughnessMap ?? null,
    roughness: 0.76,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const workMatMesh = new THREE.Mesh(workMatGeo, workMatMat);
  workMatMesh.rotation.x = -Math.PI / 2;
  workMatMesh.position.y = benchY + thickness * 0.5 + 0.002;
  workMatMesh.receiveShadow = true;
  group.add(workMatMesh);

  // Anodized brushed aluminum front/perimeter trim band
  const trimGeo = new RoundedBoxGeometry(width + 0.12, thickness * 0.44, depth + 0.12, 3, 0.028);
  const trimMat = new THREE.MeshStandardMaterial({
    color: colors.trimHex ?? 0x64748b,
    roughnessMap: metalTex?.roughnessMap ?? null,
    bumpMap: metalTex?.bumpMap ?? null,
    bumpScale: 0.004,
    metalness: 0.82,
    roughness: 0.24,
    envMapIntensity: 0.88,
  });
  const trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.y = benchY - thickness * 0.24;
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  // Rear phenolic laboratory backsplash curb & brushed aluminum cap rail
  const curbGeo = new RoundedBoxGeometry(width - 0.08, 0.22, 0.14, 3, 0.025);
  const curbMesh = new THREE.Mesh(curbGeo, benchTopMat);
  curbMesh.position.set(0, benchY + thickness * 0.5 + 0.09, -depth * 0.5 + 0.12);
  curbMesh.castShadow = true;
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

  const curbRailGeo = new RoundedBoxGeometry(width - 0.04, 0.036, 0.16, 2, 0.012);
  const curbRailMesh = new THREE.Mesh(curbRailGeo, trimMat);
  curbRailMesh.position.set(0, benchY + thickness * 0.5 + 0.205, -depth * 0.5 + 0.12);
  group.add(curbRailMesh);

  // Grounded structural steel underframe apron beneath the benchtop (eliminates floating-slab look)
  const apronH = 0.22;
  const apronGeo = new RoundedBoxGeometry(width - 0.72, apronH, depth - 0.68, 2, 0.02);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughnessMap: metalTex?.roughnessMap ?? null,
    metalness: 0.72,
    roughness: 0.34,
    envMapIntensity: 0.65,
  });
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.y = benchY - thickness * 0.5 - apronH * 0.42;
  group.add(apronMesh);

  // Grounded floor contact shadow spread smoothly under the entire bench footprint
  const benchFloorShadow = createContactShadowPlane(width * 0.56, depth * 0.58, 0.34);
  benchFloorShadow.position.y = floorY + 0.008;
  group.add(benchFloorShadow);

  // Subtle grounded contact-shadow AO pad centered on benchtop for apparatus seating
  const contactPad = createContactShadowPlane(width * 0.36, depth * 0.36, 0.32);
  contactPad.position.y = benchY + thickness * 0.5 + 0.005;
  group.add(contactPad);

  const updateTheme = (nextColors: SceneThemeColors) => {
    benchTopMat.color.setHex(nextColors.tableHex ?? 0xc2ccd8);
    workMatMat.color.setHex(nextColors.tableHex ?? 0xc2ccd8).multiplyScalar(0.92);
    floorMat.color.setHex(nextColors.floorHex ?? 0xd8e0ea);
    trimMat.color.setHex(nextColors.trimHex ?? 0x64748b);
    applyGridColors(nextColors.gridPrimaryHex, nextColors.gridSecondaryHex);
  };

  const dispose = () => {
    floorGeo.dispose();
    floorMat.dispose();
    benchGeo.dispose();
    benchTopMat.dispose();
    workMatGeo.dispose();
    workMatMat.dispose();
    trimGeo.dispose();
    trimMat.dispose();
    curbGeo.dispose();
    curbRailGeo.dispose();
    apronGeo.dispose();
    apronMat.dispose();
    benchFloorShadow.geometry.dispose();
    const bfsMat = benchFloorShadow.material as THREE.MeshBasicMaterial;
    bfsMat.map?.dispose();
    bfsMat.dispose();
    contactPad.geometry.dispose();
    const cMat = contactPad.material as THREE.MeshBasicMaterial;
    cMat.map?.dispose();
    cMat.dispose();
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

export interface LabRendererConfigOptions {
  exposure?: number;
  isSoftwareGl?: boolean;
  isLite?: boolean;
  pixelRatioCap?: number;
  shadowsEnabled?: boolean;
}

/**
 * Calibrates WebGLRenderer with ACESFilmicToneMapping, sRGB output color space,
 * balanced exposure (1.0 - 1.1) to prevent highlights blowout, and PCFSoftShadowMap.
 */
export function configureLabRenderer(
  renderer: THREE.WebGLRenderer,
  options: LabRendererConfigOptions = {}
): THREE.WebGLRenderer {
  if (!renderer) return renderer;
  const isSoftwareGl = options.isSoftwareGl ?? false;
  const isLite = options.isLite ?? false;
  const cap = options.pixelRatioCap ?? 1.5;
  const devicePr =
    typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? Math.max(1, window.devicePixelRatio)
      : 1;

  if (typeof renderer.setPixelRatio === 'function') {
    renderer.setPixelRatio(isSoftwareGl || isLite ? 1 : Math.min(devicePr, cap));
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const rawExposure = options.exposure ?? 1.05;
  renderer.toneMappingExposure = Math.max(1.0, Math.min(1.1, rawExposure));
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = options.shadowsEnabled ?? (!isLite && !isSoftwareGl);
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  return renderer;
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
        : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5)
    );
    renderer.shadowMap.enabled = true;
  }
}

export interface StudioComposerHandle {
  composer?: EffectComposer;
  renderTarget?: THREE.WebGLRenderTarget;
  ssaoPass?: SSAOPass;
  bloomPass?: UnrealBloomPass;
  smaaPass?: SMAAPass;
  fxaaPass?: ShaderPass;
  outputPass?: OutputPass;
  applySettings: (
    settings: PostProcessingSettings,
    qualityTier?: QualityTier,
    liteDeviceMode?: boolean
  ) => EffectivePostProcessingState;
  getEffectiveState: () => EffectivePostProcessingState;
  resize: (width: number, height: number, pixelRatio: number) => void;
  render: (liteDeviceMode?: boolean, dt?: number) => void;
  dispose: () => void;
}

/**
 * Configures a studio-grade EffectComposer pipeline:
 * 1. RenderPass into HalfFloat WebGL2 MSAA target (up to 4x hardware samples)
 * 2. Glass-safe SSAOPass (screen-space ambient occlusion that excludes transparent glassware/liquids)
 * 3. UnrealBloomPass (HDR selective glow for OLEDs, lasers, plasma, and stars)
 * 4. SMAAPass (linear-sRGB subpixel morphological anti-aliasing before OutputPass)
 * 5. OutputPass (ACESFilmicToneMapping + sRGB output conversion)
 * 6. FXAA ShaderPass (optional sRGB anti-aliasing mode)
 *
 * On software WebGL (SwiftShader/llvmpipe), bypasses multi-pass shaders and renders directly
 * so scene startup and interaction remain responsive.
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
  },
  pipelineOptions?: {
    domainPreset?: PostProcessingDomainPreset;
    initialSettings?: PostProcessingSettings;
    initialQualityTier?: QualityTier;
  }
): StudioComposerHandle {
  const xrRig = registerActiveXRScene(renderer, scene, camera);
  const sandboxVisuals = attachMultiApparatusAndScaffoldingVisuals(scene, camera);
  const domainPreset = pipelineOptions?.domainPreset ?? 'benchtop';
  const domainProfile = getDomainPostProcessingDefaults(domainPreset);

  let effectiveState = computeEffectivePassFlags({
    settings: pipelineOptions?.initialSettings ?? DEFAULT_POST_PROCESSING_SETTINGS,
    qualityTier: pipelineOptions?.initialQualityTier ?? 'high',
    liteDeviceMode: false,
    isSoftwareGl,
    domainPreset,
    bloomOverride: bloomOptions,
  });

  if (isSoftwareGl) {
    return {
      applySettings: (settings, qualityTier = 'high', liteDeviceMode = false) => {
        effectiveState = computeEffectivePassFlags({
          settings,
          qualityTier,
          liteDeviceMode,
          isSoftwareGl: true,
          domainPreset,
          bloomOverride: bloomOptions,
        });
        return effectiveState;
      },
      getEffectiveState: () => effectiveState,
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

  const safeInitW = Math.max(1, width);
  const safeInitH = Math.max(1, height);
  const pixelRatio = renderer.getPixelRatio();
  const maxSamples = renderer.capabilities?.maxSamples ?? 4;
  const samples = computeMsaaSamples(maxSamples, isSoftwareGl);

  const renderTarget = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(safeInitW * pixelRatio)),
    Math.max(1, Math.floor(safeInitH * pixelRatio)),
    {
      type: THREE.HalfFloatType,
      samples,
    }
  );

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(safeInitW, safeInitH);

  // 1. HDR Linear Scene Render
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Glass-Safe Screen-Space Ambient Occlusion (SSAO) for contact depth & crevice realism
  let ssaoPass: SSAOPass | undefined;
  if (domainProfile.ssaoAllowed) {
    ssaoPass = new SSAOPass(
      scene,
      camera,
      safeInitW,
      safeInitH,
      effectiveState.ssaoKernelSize
    );
    ssaoPass.output = SSAOPass.OUTPUT.Default;
    ssaoPass.kernelRadius = effectiveState.ssaoKernelRadius;
    ssaoPass.minDistance = effectiveState.ssaoMinDistance;
    ssaoPass.maxDistance = effectiveState.ssaoMaxDistance;
    ssaoPass.enabled = effectiveState.useSsao;

    // Exclude transparent glassware, liquid shaders, lines, and particles from SSAO normal/depth pass
    const ssaoWithCache = ssaoPass as unknown as {
      _visibilityCache: THREE.Object3D[];
      _overrideVisibility: () => void;
    };
    ssaoWithCache._overrideVisibility = () => {
      const cache = ssaoWithCache._visibilityCache;
      scene.traverse((object) => {
        if (shouldHideMeshForSsao(object)) {
          object.visible = false;
          cache.push(object);
        }
      });
    };
    composer.addPass(ssaoPass);
  }

  // 3. Selective HDR Bloom (linear space)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(safeInitW, safeInitH),
    effectiveState.bloomStrength,
    effectiveState.bloomRadius,
    effectiveState.bloomThreshold
  );
  bloomPass.enabled = effectiveState.useBloom;
  composer.addPass(bloomPass);

  // 4. SMAA Anti-Aliasing (operates in linear-sRGB before OutputPass in Three.js r187+)
  const smaaPass = new SMAAPass();
  smaaPass.setSize(
    Math.max(1, Math.floor(safeInitW * pixelRatio)),
    Math.max(1, Math.floor(safeInitH * pixelRatio))
  );
  smaaPass.enabled = effectiveState.useSmaa;
  composer.addPass(smaaPass);

  // 5. ACES Filmic Tone Mapping + sRGB Conversion
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // 6. Lightweight FXAA fallback (operates in sRGB after OutputPass when aaMode === 'fxaa')
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms['resolution'].value.set(
    1 / Math.max(1, safeInitW * pixelRatio),
    1 / Math.max(1, safeInitH * pixelRatio)
  );
  fxaaPass.enabled = effectiveState.useFxaa;
  composer.addPass(fxaaPass);

  const applySettings = (
    settings: PostProcessingSettings,
    qualityTier: QualityTier = 'high',
    liteDeviceMode = false
  ): EffectivePostProcessingState => {
    effectiveState = computeEffectivePassFlags({
      settings,
      qualityTier,
      liteDeviceMode,
      isSoftwareGl: false,
      domainPreset,
      bloomOverride: bloomOptions,
    });
    if (ssaoPass) {
      ssaoPass.enabled = effectiveState.useSsao;
      ssaoPass.kernelRadius = effectiveState.ssaoKernelRadius;
      ssaoPass.minDistance = effectiveState.ssaoMinDistance;
      ssaoPass.maxDistance = effectiveState.ssaoMaxDistance;
    }
    bloomPass.enabled = effectiveState.useBloom;
    bloomPass.strength = effectiveState.bloomStrength;
    bloomPass.radius = effectiveState.bloomRadius;
    bloomPass.threshold = effectiveState.bloomThreshold;
    smaaPass.enabled = effectiveState.useSmaa;
    fxaaPass.enabled = effectiveState.useFxaa;
    return effectiveState;
  };

  const resize = (nextW: number, nextH: number, nextPr: number) => {
    const safeW = Math.max(1, nextW);
    const safeH = Math.max(1, nextH);
    const safePixelW = Math.max(1, Math.floor(safeW * nextPr));
    const safePixelH = Math.max(1, Math.floor(safeH * nextPr));
    composer.setPixelRatio(nextPr);
    composer.setSize(safeW, safeH);
    ssaoPass?.setSize(safeW, safeH);
    bloomPass.setSize(safeW, safeH);
    smaaPass.setSize(safePixelW, safePixelH);
    fxaaPass.uniforms['resolution'].value.set(1 / safePixelW, 1 / safePixelH);
  };

  return {
    composer,
    renderTarget,
    ssaoPass,
    bloomPass,
    smaaPass,
    fxaaPass,
    outputPass,
    applySettings,
    getEffectiveState: () => effectiveState,
    resize,
    render: (liteDeviceMode?: boolean, dt = 0.016) => {
      const safeDt = Number.isFinite(dt) ? Math.min(0.05, Math.max(0, dt)) : 0.016;
      xrRig.updateSpatialRaycasters();
      sandboxVisuals.updatePerFrame(safeDt);
      if (renderer.xr?.isPresenting || liteDeviceMode || effectiveState.bypassComposer) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }
    },
    dispose: () => {
      sandboxVisuals.dispose();
      xrRig.dispose();
      ssaoPass?.dispose();
      bloomPass.dispose();
      smaaPass.dispose();
      outputPass.dispose();
      fxaaPass.dispose();
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
  'clearcoatMap',
  'clearcoatRoughnessMap',
  'clearcoatNormalMap',
  'transmissionMap',
  'thicknessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'iridescenceMap',
] as const;

/**
 * Consistently traverses a Three.js Scene, disposes all geometries, InstancedMesh buffers,
 * materials, material texture maps, environment map, extra render targets, render lists,
 * and WebGLRenderer context resources.
 */
export function disposeThreeScene(
  scene: THREE.Scene,
  renderer?: THREE.WebGLRenderer | null,
  envTexture?: THREE.Texture | null,
  renderTargets?: Array<THREE.WebGLRenderTarget | null | undefined>
): DisposalStats {
  let geometriesDisposed = 0;
  let materialsDisposed = 0;
  let texturesDisposed = 0;

  const disposedGeometries = new Set<unknown>();
  const disposedMaterials = new Set<unknown>();
  const disposedTextures = new Set<unknown>();

  const disposeTextureOnce = (tex: any) => {
    if (!tex || typeof tex.dispose !== 'function' || disposedTextures.has(tex)) return;
    disposedTextures.add(tex);
    tex.dispose();
    texturesDisposed += 1;
  };

  const disposeMaterialInstance = (mat: any) => {
    if (!mat || typeof mat !== 'object' || disposedMaterials.has(mat)) return;
    disposedMaterials.add(mat);
    for (const slot of MATERIAL_TEXTURE_SLOTS) {
      disposeTextureOnce(mat[slot]);
    }
    if (typeof mat.dispose === 'function') {
      mat.dispose();
      materialsDisposed += 1;
    }
  };

  scene.traverse((obj: any) => {
    if (obj?.geometry && typeof obj.geometry.dispose === 'function' && !disposedGeometries.has(obj.geometry)) {
      disposedGeometries.add(obj.geometry);
      obj.geometry.dispose();
      geometriesDisposed += 1;
    }
    if (obj?.isInstancedMesh && typeof obj.dispose === 'function') {
      obj.dispose();
    }
    if (Array.isArray(obj?.material)) {
      obj.material.forEach((m: any) => disposeMaterialInstance(m));
    } else if (obj?.material) {
      disposeMaterialInstance(obj.material);
    }
  });

  if (envTexture) {
    disposeTextureOnce(envTexture);
  }

  if (renderTargets && renderTargets.length > 0) {
    for (const target of renderTargets) {
      if (target && typeof target.dispose === 'function') {
        target.dispose();
      }
    }
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

export const disposeThreeSceneResources = disposeThreeScene;

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
  emissiveIntensity = 0.22
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.22,
    metalness: 0.32,
    emissive: colorHex,
    emissiveIntensity,
  });
  const collarGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.045, 16);
  collarGeo.translate(0, 0.022, 0);
  const collar = new THREE.Mesh(collarGeo, mat);
  collar.name = 'collar';

  const shaftGeo = new THREE.CylinderGeometry(0.036, 0.036, 1, 14);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  shaft.name = 'shaft';

  const headGeo = new THREE.ConeGeometry(0.115, 0.34, 18);
  headGeo.translate(0, 0.17, 0);
  const head = new THREE.Mesh(headGeo, mat);
  head.name = 'head';

  group.add(collar, shaft, head);
  return group;
}

const _arrowDir = new THREE.Vector3();
const _arrowQuat = new THREE.Quaternion();
const _arrowUpAxis = new THREE.Vector3(0, 1, 0);

/**
 * Orients and scales a 3D vector arrow created by `createVectorArrowGroup` with zero per-frame allocations.
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
  _arrowDir.copy(dir).normalize();
  _arrowQuat.setFromUnitVectors(_arrowUpAxis, _arrowDir);
  arrow.quaternion.copy(_arrowQuat);

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
    // High-gloss optical borosilicate look with zero extra transmission/physical shader pass (fast on 3T/SwiftShader)
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.16,
      roughness: 0.05,
      transparent: true,
      opacity: Math.max(0.24, Math.min(0.42, tintOpacity)),
      envMapIntensity: 1.65,
      emissive,
      emissiveIntensity,
      depthWrite: false,
    });
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.93,
    transparent: true,
    opacity: tintOpacity,
    ior,
    thickness,
    attenuationColor: new THREE.Color(0xcce6f8),
    attenuationDistance: 3.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.35,
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

/**
 * Creates a soft radial ambient-occlusion contact shadow disc so 3D laboratory apparatus
 * visually seats firmly on the studio workbench even when real-time shadow maps are off (3T-Saver / Lite).
 */
export function createContactShadowPlane(
  radiusX = 1.6,
  radiusZ = 1.6,
  opacity = 0.28
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2);
  let tex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.08,
        size / 2,
        size / 2,
        size * 0.5
      );
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
      grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.28)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    }
  }
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: tex ? 0xffffff : 0x0f172a,
    transparent: true,
    opacity: Math.max(0.08, Math.min(0.6, opacity)),
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  mesh.name = 'studio-contact-shadow';
  return mesh;
}

export interface InstrumentPanelTextureOptions {
  title: string;
  primaryText: string;
  secondaryText?: string;
  accentHex?: string;
  width?: number;
  height?: number;
}

/**
 * Renders or updates a dark-glass OLED/LED laboratory digital readout panel onto a CanvasTexture.
 */
export function drawInstrumentPanelCanvas(
  canvas: HTMLCanvasElement,
  options: InstrumentPanelTextureOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const accent = options.accentHex ?? '#38bdf8';

  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, w, h);

  // Subtle recessed metallic bezel & inner LCD window
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  ctx.fillStyle = '#091220';
  ctx.fillRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.globalAlpha = 1;

  // Power / active status LED indicator dot
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(24, 24, 5, 0, Math.PI * 2);
  ctx.fill();

  // Header model title
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(options.title.toUpperCase(), 36, 24);

  // Primary high-contrast digital readout
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText(options.primaryText, 22, h * 0.56);

  // Secondary telemetry line
  if (options.secondaryText) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 15px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(options.secondaryText, 22, h - 24);
  }
}

export function createInstrumentPanelTexture(
  options: InstrumentPanelTextureOptions
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 256;
  canvas.height = options.height ?? 128;
  drawInstrumentPanelCanvas(canvas, options);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function updateInstrumentPanelTexture(
  tex: THREE.CanvasTexture | null,
  options: InstrumentPanelTextureOptions
): void {
  if (!tex || !(tex.image instanceof HTMLCanvasElement)) return;
  drawInstrumentPanelCanvas(tex.image, options);
  tex.needsUpdate = true;
}

export interface AnalogGaugeDialOptions {
  min: number;
  max: number;
  unit: string;
  title?: string;
  zeroCenter?: boolean;
  majorDivisions?: number;
}

/**
 * Generates a calibrated radial analog meter face texture (for galvanometers, pressure manometers, etc.).
 */
export function createAnalogGaugeDialTexture(
  options: AnalogGaugeDialOptions
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  ctx.clearRect(0, 0, size, size);

  // Dial face plate
  const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, r);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.85, '#090f1d');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Arc span (-125 deg to +125 deg from top -90 deg)
  const startAngle = -Math.PI * 0.5 - Math.PI * 0.68;
  const endAngle = -Math.PI * 0.5 + Math.PI * 0.68;
  const majorDivs = Math.max(4, options.majorDivisions ?? 6);
  const minorPerMajor = 4;
  const totalTicks = majorDivs * minorPerMajor;

  for (let i = 0; i <= totalTicks; i++) {
    const u = i / totalTicks;
    const ang = startAngle + u * (endAngle - startAngle);
    const isMajor = i % minorPerMajor === 0;
    const isZeroCenter = options.zeroCenter && Math.abs(u - 0.5) < 0.01;
    const outerR = r * 0.86;
    const innerR = isMajor ? r * 0.68 : r * 0.77;

    ctx.strokeStyle = isZeroCenter
      ? '#10b981'
      : u > 0.8 && !options.zeroCenter
      ? '#ef4444'
      : '#e2e8f0';
    ctx.lineWidth = isMajor ? 3 : 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
    ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
    ctx.stroke();

    if (isMajor) {
      const val = options.min + u * (options.max - options.min);
      const label = Number.isInteger(val) ? `${val}` : val.toFixed(1);
      const textR = r * 0.52;
      ctx.fillStyle = isZeroCenter ? '#34d399' : '#cbd5e1';
      ctx.font = 'bold 15px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + Math.cos(ang) * textR, cy + Math.sin(ang) * textR);
    }
  }

  // Unit & title in center-lower dial
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(options.unit, cx, cy + r * 0.34);

  if (options.title) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(options.title.toUpperCase(), cx, cy + r * 0.54);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}



