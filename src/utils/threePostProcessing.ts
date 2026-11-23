import * as THREE from 'three';
import type { QualityTier } from '../hooks/useAdaptiveQuality';

export type AntiAliasingMode = 'smaa' | 'fxaa' | 'off';

export type PostProcessingDomainPreset =
  | 'benchtop'
  | 'chemistry'
  | 'physics'
  | 'biology'
  | 'anatomy'
  | 'observatory';

export interface PostProcessingSettings {
  enabled: boolean;
  bloomEnabled: boolean;
  ssaoEnabled: boolean;
  aaMode: AntiAliasingMode;
  bloomStrength: number;
  ssaoRadius: number;
}

export interface DomainPostProcessingProfile {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  ssaoAllowed: boolean;
  ssaoKernelRadius: number;
  ssaoMinDistance: number;
  ssaoMaxDistance: number;
  ssaoKernelSize: number;
}

export interface EffectivePostProcessingState {
  bypassComposer: boolean;
  useSsao: boolean;
  useBloom: boolean;
  useSmaa: boolean;
  useFxaa: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  ssaoKernelRadius: number;
  ssaoMinDistance: number;
  ssaoMaxDistance: number;
  ssaoKernelSize: number;
}

export const DEFAULT_POST_PROCESSING_SETTINGS: PostProcessingSettings = {
  enabled: true,
  bloomEnabled: true,
  ssaoEnabled: true,
  aaMode: 'smaa',
  bloomStrength: 0.18,
  ssaoRadius: 0.55,
};

const DOMAIN_PROFILES: Record<PostProcessingDomainPreset, DomainPostProcessingProfile> = {
  benchtop: {
    bloomStrength: 0.18,
    bloomRadius: 0.3,
    bloomThreshold: 1.08,
    ssaoAllowed: true,
    ssaoKernelRadius: 0.55,
    ssaoMinDistance: 0.0005,
    ssaoMaxDistance: 0.014,
    ssaoKernelSize: 16,
  },
  chemistry: {
    bloomStrength: 0.16,
    bloomRadius: 0.28,
    bloomThreshold: 1.08,
    ssaoAllowed: true,
    ssaoKernelRadius: 0.52,
    ssaoMinDistance: 0.0005,
    ssaoMaxDistance: 0.012,
    ssaoKernelSize: 16,
  },
  physics: {
    bloomStrength: 0.22,
    bloomRadius: 0.34,
    bloomThreshold: 1.02,
    ssaoAllowed: true,
    ssaoKernelRadius: 0.58,
    ssaoMinDistance: 0.0006,
    ssaoMaxDistance: 0.015,
    ssaoKernelSize: 16,
  },
  biology: {
    bloomStrength: 0.16,
    bloomRadius: 0.3,
    bloomThreshold: 1.08,
    ssaoAllowed: true,
    ssaoKernelRadius: 0.5,
    ssaoMinDistance: 0.0005,
    ssaoMaxDistance: 0.012,
    ssaoKernelSize: 16,
  },
  anatomy: {
    bloomStrength: 0.14,
    bloomRadius: 0.26,
    bloomThreshold: 1.12,
    ssaoAllowed: true,
    ssaoKernelRadius: 0.48,
    ssaoMinDistance: 0.0004,
    ssaoMaxDistance: 0.012,
    ssaoKernelSize: 16,
  },
  observatory: {
    bloomStrength: 0.38,
    bloomRadius: 0.45,
    bloomThreshold: 0.85,
    ssaoAllowed: false,
    ssaoKernelRadius: 0.5,
    ssaoMinDistance: 0.001,
    ssaoMaxDistance: 0.02,
    ssaoKernelSize: 16,
  },
};

function clampNumber(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

export function getDomainPostProcessingDefaults(
  preset: PostProcessingDomainPreset = 'benchtop'
): DomainPostProcessingProfile {
  return DOMAIN_PROFILES[preset] ?? DOMAIN_PROFILES.benchtop;
}

export function clampPostProcessingSettings(
  input?: Partial<PostProcessingSettings> | null
): PostProcessingSettings {
  const aaRaw = input?.aaMode;
  const aaMode: AntiAliasingMode =
    aaRaw === 'smaa' || aaRaw === 'fxaa' || aaRaw === 'off'
      ? aaRaw
      : DEFAULT_POST_PROCESSING_SETTINGS.aaMode;

  return {
    enabled:
      typeof input?.enabled === 'boolean'
        ? input.enabled
        : DEFAULT_POST_PROCESSING_SETTINGS.enabled,
    bloomEnabled:
      typeof input?.bloomEnabled === 'boolean'
        ? input.bloomEnabled
        : DEFAULT_POST_PROCESSING_SETTINGS.bloomEnabled,
    ssaoEnabled:
      typeof input?.ssaoEnabled === 'boolean'
        ? input.ssaoEnabled
        : DEFAULT_POST_PROCESSING_SETTINGS.ssaoEnabled,
    aaMode,
    bloomStrength: Number(
      clampNumber(
        typeof input?.bloomStrength === 'number'
          ? input.bloomStrength
          : DEFAULT_POST_PROCESSING_SETTINGS.bloomStrength,
        0,
        0.75,
        DEFAULT_POST_PROCESSING_SETTINGS.bloomStrength
      ).toFixed(2)
    ),
    ssaoRadius: Number(
      clampNumber(
        typeof input?.ssaoRadius === 'number'
          ? input.ssaoRadius
          : DEFAULT_POST_PROCESSING_SETTINGS.ssaoRadius,
        0.15,
        1.4,
        DEFAULT_POST_PROCESSING_SETTINGS.ssaoRadius
      ).toFixed(2)
    ),
  };
}

export function computeEffectivePassFlags(params: {
  settings: PostProcessingSettings;
  qualityTier: QualityTier;
  liteDeviceMode: boolean;
  isSoftwareGl: boolean;
  domainPreset?: PostProcessingDomainPreset;
  bloomOverride?: {
    strength?: number;
    radius?: number;
    threshold?: number;
  };
}): EffectivePostProcessingState {
  const {
    settings: rawSettings,
    qualityTier,
    liteDeviceMode,
    isSoftwareGl,
    domainPreset = 'benchtop',
    bloomOverride,
  } = params;

  const settings = clampPostProcessingSettings(rawSettings);
  const profile = getDomainPostProcessingDefaults(domainPreset);

  const baseBloomStrength = bloomOverride?.strength ?? profile.bloomStrength;
  const baseBloomRadius = bloomOverride?.radius ?? profile.bloomRadius;
  const baseBloomThreshold = bloomOverride?.threshold ?? profile.bloomThreshold;

  const strengthScale =
    DEFAULT_POST_PROCESSING_SETTINGS.bloomStrength > 0
      ? settings.bloomStrength / DEFAULT_POST_PROCESSING_SETTINGS.bloomStrength
      : 1;
  const resolvedBloomStrength = Number(
    clampNumber(baseBloomStrength * strengthScale, 0, 0.85, baseBloomStrength).toFixed(3)
  );

  const radiusScale =
    DEFAULT_POST_PROCESSING_SETTINGS.ssaoRadius > 0
      ? settings.ssaoRadius / DEFAULT_POST_PROCESSING_SETTINGS.ssaoRadius
      : 1;
  const resolvedSsaoRadius = Number(
    clampNumber(profile.ssaoKernelRadius * radiusScale, 0.15, 1.6, profile.ssaoKernelRadius).toFixed(3)
  );

  const bypassComposer =
    isSoftwareGl || liteDeviceMode || qualityTier === '3t-saver' || !settings.enabled;

  if (bypassComposer) {
    return {
      bypassComposer: true,
      useSsao: false,
      useBloom: false,
      useSmaa: false,
      useFxaa: false,
      bloomStrength: resolvedBloomStrength,
      bloomRadius: baseBloomRadius,
      bloomThreshold: baseBloomThreshold,
      ssaoKernelRadius: resolvedSsaoRadius,
      ssaoMinDistance: profile.ssaoMinDistance,
      ssaoMaxDistance: profile.ssaoMaxDistance,
      ssaoKernelSize: profile.ssaoKernelSize,
    };
  }

  // SSAO runs on 'high' tier for benchtop/anatomical labs; auto-disabled on 'balanced' to keep 45+ FPS smooth
  const useSsao = qualityTier === 'high' && profile.ssaoAllowed && settings.ssaoEnabled;
  const useBloom = settings.bloomEnabled && resolvedBloomStrength > 0.005;
  const useSmaa = settings.aaMode === 'smaa';
  const useFxaa = settings.aaMode === 'fxaa';

  return {
    bypassComposer: false,
    useSsao,
    useBloom,
    useSmaa,
    useFxaa,
    bloomStrength: resolvedBloomStrength,
    bloomRadius: baseBloomRadius,
    bloomThreshold: baseBloomThreshold,
    ssaoKernelRadius: resolvedSsaoRadius,
    ssaoMinDistance: profile.ssaoMinDistance,
    ssaoMaxDistance: profile.ssaoMaxDistance,
    ssaoKernelSize: profile.ssaoKernelSize,
  };
}

function isTransparentOrNonOccluderMaterial(mat: THREE.Material | null | undefined): boolean {
  if (!mat) return false;
  if (mat.transparent || mat.depthWrite === false || mat.opacity < 0.98) {
    return true;
  }
  const physical = mat as THREE.MeshPhysicalMaterial;
  if (typeof physical.transmission === 'number' && physical.transmission > 0.01) {
    return true;
  }
  return false;
}

/**
 * Determines whether an Object3D should be temporarily hidden during the SSAO normal/depth pass.
 * Excludes lines, particles, sprites, borosilicate glass vessels, liquid shaders, and contact shadow planes
 * so SSAO only deepens crevices on opaque apparatus and benches without muddying transparent glassware.
 */
export function shouldHideMeshForSsao(obj: THREE.Object3D): boolean {
  if (!obj.visible) return false;
  const anyObj = obj as unknown as {
    isPoints?: boolean;
    isLine?: boolean;
    isLine2?: boolean;
    isSprite?: boolean;
    isMesh?: boolean;
    material?: THREE.Material | THREE.Material[];
  };
  if (anyObj.isPoints || anyObj.isLine || anyObj.isLine2 || anyObj.isSprite) {
    return true;
  }
  if (anyObj.isMesh && anyObj.material) {
    if (Array.isArray(anyObj.material)) {
      return anyObj.material.length > 0 && anyObj.material.every(isTransparentOrNonOccluderMaterial);
    }
    return isTransparentOrNonOccluderMaterial(anyObj.material);
  }
  return false;
}

const ANISO_TEXTURE_SLOTS = ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap'] as const;

/**
 * Boosts texture anisotropy across scene materials (up to 8x) so procedural bench grain,
 * graduated glass scales, and analog/digital instrument dials stay razor-sharp at grazing angles.
 */
export function enhanceSceneTextureAnisotropy(
  scene: THREE.Scene,
  maxAnisotropy: number
): number {
  const targetAniso = Math.min(8, Math.max(1, Math.floor(maxAnisotropy || 1)));
  if (targetAniso <= 1) return 0;

  let updatedCount = 0;
  const seen = new Set<THREE.Texture>();

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      const record = mat as unknown as Record<string, unknown>;
      for (const slot of ANISO_TEXTURE_SLOTS) {
        const tex = record[slot];
        if (tex instanceof THREE.Texture && !seen.has(tex)) {
          seen.add(tex);
          if (tex.anisotropy < targetAniso) {
            tex.anisotropy = targetAniso;
            tex.needsUpdate = true;
            updatedCount += 1;
          }
        }
      }
    }
  });

  return updatedCount;
}
