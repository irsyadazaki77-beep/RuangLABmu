import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';

export type QualityTier = 'high' | 'medium' | 'low';

export interface AdaptiveQualityState {
  tier: QualityTier;
  pixelRatio: number;
  shadowsEnabled: boolean;
  rollingFps: number;
}

export interface AdaptiveQualityController {
  recordFrameDelta: (dtSeconds: number, renderer?: THREE.WebGLRenderer | null) => QualityTier;
  getTier: () => QualityTier;
  getRollingFps: () => number;
  setTier: (tier: QualityTier, renderer?: THREE.WebGLRenderer | null) => void;
  reset: () => void;
}

const SAMPLE_WINDOW_SIZE = 60;
const LOW_FPS_THRESHOLD = 30;
const SUSTAINED_LOW_FPS_SECONDS = 2.0;

export function getPixelRatioForTier(tier: QualityTier): number {
  const deviceRatio =
    typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
  if (tier === 'high') {
    return Math.min(deviceRatio, 2);
  }
  if (tier === 'medium') {
    return 1.0;
  }
  return 0.75;
}

export function applyQualityTierToRenderer(
  renderer: THREE.WebGLRenderer | null | undefined,
  tier: QualityTier
): void {
  if (!renderer) return;
  const targetPixelRatio = getPixelRatioForTier(tier);
  if (typeof renderer.setPixelRatio === 'function') {
    renderer.setPixelRatio(targetPixelRatio);
  }
  if (renderer.shadowMap) {
    const shouldEnableShadows = tier !== 'low';
    if (renderer.shadowMap.enabled !== shouldEnableShadows) {
      renderer.shadowMap.enabled = shouldEnableShadows;
      renderer.shadowMap.needsUpdate = true;
    }
  }
}

/**
 * Zero-allocation frame-time monitor designed to run directly inside `requestAnimationFrame`
 * without triggering React re-renders on every frame.
 * Steps down quality tier (`high -> medium -> low`) when rolling average FPS stays below 30
 * for 2 consecutive seconds.
 */
export function createAdaptiveQualityController(options?: {
  initialTier?: QualityTier;
  onTierChange?: (nextTier: QualityTier, rollingFps: number) => void;
}): AdaptiveQualityController {
  let currentTier: QualityTier = options?.initialTier ?? 'high';
  const frameDeltas = new Float32Array(SAMPLE_WINDOW_SIZE);
  let writeIdx = 0;
  let sampleCount = 0;
  let lowFpsAccumulatedSeconds = 0;
  let currentRollingFps = 60;

  const stepDown = (tier: QualityTier): QualityTier => {
    if (tier === 'high') return 'medium';
    if (tier === 'medium') return 'low';
    return 'low';
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

      if (sampleCount >= 20 && currentRollingFps < LOW_FPS_THRESHOLD) {
        lowFpsAccumulatedSeconds += dtSeconds;
        if (
          lowFpsAccumulatedSeconds >= SUSTAINED_LOW_FPS_SECONDS &&
          currentTier !== 'low'
        ) {
          const nextTier = stepDown(currentTier);
          currentTier = nextTier;
          lowFpsAccumulatedSeconds = 0;
          applyQualityTierToRenderer(renderer, nextTier);
          options?.onTierChange?.(nextTier, currentRollingFps);
        }
      } else {
        lowFpsAccumulatedSeconds = Math.max(0, lowFpsAccumulatedSeconds - dtSeconds * 0.5);
      }

      return currentTier;
    },
    getTier: () => currentTier,
    getRollingFps: () => currentRollingFps,
    setTier: (tier: QualityTier, renderer?: THREE.WebGLRenderer | null) => {
      currentTier = tier;
      lowFpsAccumulatedSeconds = 0;
      applyQualityTierToRenderer(renderer, tier);
      options?.onTierChange?.(tier, currentRollingFps);
    },
    reset: () => {
      sampleCount = 0;
      writeIdx = 0;
      lowFpsAccumulatedSeconds = 0;
      currentRollingFps = 60;
    },
  };
}

/**
 * React hook wrapper for Adaptive Quality & Resolution Scaling.
 * Updates React state ONLY when a quality tier transition (`high -> medium -> low`) occurs,
 * never per frame.
 */
export function useAdaptiveQuality(initialLiteMode: boolean = false) {
  const initialTier: QualityTier = initialLiteMode ? 'low' : 'high';
  const [tier, setTierState] = useState<QualityTier>(initialTier);
  const controllerRef = useRef<AdaptiveQualityController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createAdaptiveQualityController({
      initialTier,
      onTierChange: (nextTier) => {
        setTierState(nextTier);
      },
    });
  }

  useEffect(() => {
    const targetTier: QualityTier = initialLiteMode ? 'low' : 'high';
    if (controllerRef.current && controllerRef.current.getTier() !== targetTier) {
      controllerRef.current.setTier(targetTier);
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
    (nextTier: QualityTier, renderer?: THREE.WebGLRenderer | null) => {
      controllerRef.current?.setTier(nextTier, renderer);
    },
    []
  );

  return {
    tier,
    pixelRatio: getPixelRatioForTier(tier),
    shadowsEnabled: tier !== 'low',
    recordFrame,
    setQualityTier,
    controller: controllerRef.current,
  };
}
