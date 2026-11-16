import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';

export type QualityTier = 'high' | 'balanced' | '3t-saver';
export type LegacyQualityTier = 'high' | 'medium' | 'low';
export type QualityModePreference = 'auto' | '3t-saver' | 'high';

export interface QualityTierSpec {
  tier: QualityTier;
  pixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: 512 | 1024;
  particleDensityScale: number;
  postProcessingEnabled: boolean;
}

export interface AdaptiveQualityState {
  tier: QualityTier;
  pixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: 512 | 1024;
  particleDensityScale: number;
  postProcessingEnabled: boolean;
  rollingFps: number;
}

export interface AdaptiveQualityController {
  recordFrameDelta: (dtSeconds: number, renderer?: THREE.WebGLRenderer | null) => QualityTier;
  getTier: () => QualityTier;
  getSpec: () => QualityTierSpec;
  getRollingFps: () => number;
  getMode: () => QualityModePreference;
  setMode: (mode: QualityModePreference, renderer?: THREE.WebGLRenderer | null) => void;
  setTier: (tier: QualityTier | LegacyQualityTier, renderer?: THREE.WebGLRenderer | null) => void;
  reset: () => void;
}

const SAMPLE_WINDOW_SIZE = 60;
const HIGH_MIN_FPS = 45;
const BALANCED_MIN_FPS = 25;
const SUSTAINED_STEP_DOWN_SECONDS = 1.5;
const SUSTAINED_STEP_UP_SECONDS = 4.0;

export function normalizeQualityTier(tier: QualityTier | LegacyQualityTier): QualityTier {
  if (tier === 'medium') return 'balanced';
  if (tier === 'low') return '3t-saver';
  return tier;
}

export function getPixelRatioForTier(
  tier: QualityTier | LegacyQualityTier,
  devicePixelRatioOverride?: number
): number {
  const normalized = normalizeQualityTier(tier);
  const rawRatio =
    typeof devicePixelRatioOverride === 'number' && Number.isFinite(devicePixelRatioOverride)
      ? devicePixelRatioOverride
      : typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
        ? window.devicePixelRatio
        : 1;
  const deviceRatio = Math.max(1, rawRatio);
  if (normalized === 'high') {
    return Math.min(deviceRatio, 1.5);
  }
  return 1.0;
}

export function getQualityTierSpec(
  tier: QualityTier | LegacyQualityTier,
  devicePixelRatioOverride?: number
): QualityTierSpec {
  const normalized = normalizeQualityTier(tier);
  const pixelRatio = getPixelRatioForTier(normalized, devicePixelRatioOverride);
  if (normalized === 'high') {
    return {
      tier: 'high',
      pixelRatio,
      shadowsEnabled: true,
      shadowMapSize: 1024,
      particleDensityScale: 1.0,
      postProcessingEnabled: true,
    };
  }
  if (normalized === 'balanced') {
    return {
      tier: 'balanced',
      pixelRatio,
      shadowsEnabled: true,
      shadowMapSize: 512,
      particleDensityScale: 0.85,
      postProcessingEnabled: true,
    };
  }
  return {
    tier: '3t-saver',
    pixelRatio,
    shadowsEnabled: false,
    shadowMapSize: 512,
    particleDensityScale: 0.5,
    postProcessingEnabled: false,
  };
}

export function applyQualityTierToRenderer(
  renderer: THREE.WebGLRenderer | null | undefined,
  tier: QualityTier | LegacyQualityTier,
  options?: { isSoftwareGl?: boolean; shadowLights?: THREE.Light[] }
): QualityTierSpec {
  const spec = getQualityTierSpec(tier);
  if (!renderer) return spec;

  const targetPixelRatio = options?.isSoftwareGl ? 1.0 : spec.pixelRatio;
  if (typeof renderer.setPixelRatio === 'function') {
    renderer.setPixelRatio(targetPixelRatio);
  }
  if (renderer.shadowMap) {
    if (renderer.shadowMap.enabled !== spec.shadowsEnabled) {
      renderer.shadowMap.enabled = spec.shadowsEnabled;
      renderer.shadowMap.needsUpdate = true;
    }
  }
  if (options?.shadowLights && options.shadowLights.length > 0) {
    for (const light of options.shadowLights) {
      const shadow = (light as THREE.DirectionalLight).shadow;
      if (shadow?.mapSize && (shadow.mapSize.width !== spec.shadowMapSize || shadow.mapSize.height !== spec.shadowMapSize)) {
        shadow.mapSize.set(spec.shadowMapSize, spec.shadowMapSize);
        if (shadow.map) {
          shadow.map.dispose();
          shadow.map = null as unknown as THREE.WebGLRenderTarget;
        }
        if (renderer.shadowMap) {
          renderer.shadowMap.needsUpdate = true;
        }
      }
    }
  }
  return spec;
}

/**
 * Zero-allocation 60-frame rolling FPS monitor designed to run inside `requestAnimationFrame`
 * without triggering per-frame React re-renders.
 * Tiers:
 * - High (>= 45 FPS): DPR <= 1.5, shadows ON (1024px), 100% particle density
 * - Balanced (25-44 FPS): DPR = 1.0, shadows ON (512px)
 * - 3T-Saver (< 25 FPS): DPR = 1.0, shadows OFF, 50% particle density, post-processing OFF
 */
export function createAdaptiveQualityController(options?: {
  initialTier?: QualityTier | LegacyQualityTier;
  initialMode?: QualityModePreference;
  isSoftwareGl?: boolean;
  shadowLights?: THREE.Light[];
  onTierChange?: (nextTier: QualityTier, rollingFps: number, spec: QualityTierSpec) => void;
}): AdaptiveQualityController {
  let qualityMode: QualityModePreference = options?.initialMode ?? 'auto';
  let currentTier: QualityTier =
    qualityMode === '3t-saver'
      ? '3t-saver'
      : qualityMode === 'high'
        ? 'high'
        : normalizeQualityTier(options?.initialTier ?? 'high');
  const frameDeltas = new Float32Array(SAMPLE_WINDOW_SIZE);
  let writeIdx = 0;
  let sampleCount = 0;
  let stepDownAccumulatedSeconds = 0;
  let stepUpAccumulatedSeconds = 0;
  let currentRollingFps = 60;

  const commitTier = (
    nextTier: QualityTier,
    renderer?: THREE.WebGLRenderer | null,
    notify = true
  ) => {
    currentTier = nextTier;
    stepDownAccumulatedSeconds = 0;
    stepUpAccumulatedSeconds = 0;
    const spec = applyQualityTierToRenderer(renderer, nextTier, {
      isSoftwareGl: options?.isSoftwareGl,
      shadowLights: options?.shadowLights,
    });
    if (notify) {
      options?.onTierChange?.(nextTier, currentRollingFps, spec);
    }
    return spec;
  };

  return {
    recordFrameDelta: (dtSeconds: number, renderer?: THREE.WebGLRenderer | null): QualityTier => {
      if (!Number.isFinite(dtSeconds) || dtSeconds <= 0 || dtSeconds > 0.5) {
        return currentTier;
      }

      frameDeltas[writeIdx] = dtSeconds;
      writeIdx = (writeIdx + 1) % SAMPLE_WINDOW_SIZE;
      if (sampleCount < SAMPLE_WINDOW_SIZE) {
        sampleCount += 1;
      }

      let sumDt = 0;
      for (let i = 0; i < sampleCount; i += 1) {
        sumDt += frameDeltas[i];
      }
      const avgDt = sumDt / Math.max(1, sampleCount);
      currentRollingFps = avgDt > 0 ? 1 / avgDt : 60;

      if (qualityMode !== 'auto') {
        const lockedTier: QualityTier = qualityMode === '3t-saver' ? '3t-saver' : 'high';
        if (currentTier !== lockedTier) {
          commitTier(lockedTier, renderer, true);
        }
        return currentTier;
      }

      if (sampleCount >= 20) {
        if (currentRollingFps < BALANCED_MIN_FPS) {
          stepDownAccumulatedSeconds += dtSeconds;
          stepUpAccumulatedSeconds = 0;
          if (stepDownAccumulatedSeconds >= SUSTAINED_STEP_DOWN_SECONDS && currentTier !== '3t-saver') {
            commitTier('3t-saver', renderer, true);
          }
        } else if (currentRollingFps < HIGH_MIN_FPS) {
          stepUpAccumulatedSeconds = 0;
          if (currentTier === 'high') {
            stepDownAccumulatedSeconds += dtSeconds;
            if (stepDownAccumulatedSeconds >= SUSTAINED_STEP_DOWN_SECONDS) {
              commitTier('balanced', renderer, true);
            }
          } else {
            stepDownAccumulatedSeconds = Math.max(0, stepDownAccumulatedSeconds - dtSeconds * 0.5);
          }
        } else {
          stepDownAccumulatedSeconds = Math.max(0, stepDownAccumulatedSeconds - dtSeconds * 0.5);
          if (currentRollingFps >= 52 && currentTier !== 'high') {
            stepUpAccumulatedSeconds += dtSeconds;
            if (stepUpAccumulatedSeconds >= SUSTAINED_STEP_UP_SECONDS) {
              const promoted: QualityTier = currentTier === '3t-saver' ? 'balanced' : 'high';
              commitTier(promoted, renderer, true);
            }
          } else {
            stepUpAccumulatedSeconds = 0;
          }
        }
      }

      return currentTier;
    },
    getTier: () => currentTier,
    getSpec: () => getQualityTierSpec(currentTier),
    getRollingFps: () => currentRollingFps,
    getMode: () => qualityMode,
    setMode: (mode: QualityModePreference, renderer?: THREE.WebGLRenderer | null) => {
      qualityMode = mode;
      if (mode === '3t-saver') {
        commitTier('3t-saver', renderer, true);
      } else if (mode === 'high') {
        commitTier('high', renderer, true);
      } else {
        commitTier(options?.isSoftwareGl ? 'balanced' : 'high', renderer, true);
      }
    },
    setTier: (tier: QualityTier | LegacyQualityTier, renderer?: THREE.WebGLRenderer | null) => {
      commitTier(normalizeQualityTier(tier), renderer, true);
    },
    reset: () => {
      sampleCount = 0;
      writeIdx = 0;
      stepDownAccumulatedSeconds = 0;
      stepUpAccumulatedSeconds = 0;
      currentRollingFps = 60;
    },
  };
}

/**
 * React hook wrapper for Adaptive Quality & Resolution Scaling.
 * Updates React state ONLY when a quality tier transition occurs, never per frame.
 */
export function useAdaptiveQuality(initialLiteMode: boolean = false) {
  const initialTier: QualityTier = initialLiteMode ? '3t-saver' : 'high';
  const [tier, setTierState] = useState<QualityTier>(initialTier);
  const controllerRef = useRef<AdaptiveQualityController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createAdaptiveQualityController({
      initialTier,
      initialMode: initialLiteMode ? '3t-saver' : 'auto',
      onTierChange: (nextTier) => {
        setTierState(nextTier);
      },
    });
  }

  useEffect(() => {
    const targetMode: QualityModePreference = initialLiteMode ? '3t-saver' : 'auto';
    if (controllerRef.current && controllerRef.current.getMode() !== targetMode) {
      controllerRef.current.setMode(targetMode);
    }
  }, [initialLiteMode]);

  const recordFrame = useCallback(
    (dtSeconds: number, renderer?: THREE.WebGLRenderer | null): QualityTier => {
      return controllerRef.current
        ? controllerRef.current.recordFrameDelta(dtSeconds, renderer)
        : tier;
    },
    [tier]
  );

  const setQualityTier = useCallback(
    (nextTier: QualityTier | LegacyQualityTier, renderer?: THREE.WebGLRenderer | null) => {
      controllerRef.current?.setTier(nextTier, renderer);
    },
    []
  );

  const spec = getQualityTierSpec(tier);

  return {
    tier,
    pixelRatio: spec.pixelRatio,
    shadowsEnabled: spec.shadowsEnabled,
    shadowMapSize: spec.shadowMapSize,
    particleDensityScale: spec.particleDensityScale,
    postProcessingEnabled: spec.postProcessingEnabled,
    recordFrame,
    setQualityTier,
    controller: controllerRef.current,
  };
}

