export type DrLabMuCameraTarget =
  | 'left_ventricle'
  | 'burette_tip'
  | 'pendulum_bob'
  | 'planet_focus';

export type DrLabMuUIAction =
  | { type: 'FOCUS_CAMERA'; target: DrLabMuCameraTarget }
  | { type: 'TOGGLE_XRAY'; enabled: boolean }
  | { type: 'HIGHLIGHT_SLIDER'; paramKey: string; durationMs: number }
  | { type: 'SET_SIMULATION_STATE'; action: 'play' | 'pause' | 'reset' };

const ALLOWED_CAMERA_TARGETS: ReadonlySet<DrLabMuCameraTarget> = new Set([
  'left_ventricle',
  'burette_tip',
  'pendulum_bob',
  'planet_focus',
]);

const ALLOWED_SIM_ACTIONS: ReadonlySet<'play' | 'pause' | 'reset'> = new Set([
  'play',
  'pause',
  'reset',
]);

/**
 * Validates and sanitizes raw `uiActions` arrays from Gemini API or external payloads.
 */
export function sanitizeDrLabMuUIActions(raw: unknown): DrLabMuUIAction[] {
  if (!Array.isArray(raw)) return [];
  const result: DrLabMuUIAction[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const type = obj.type;

    if (
      type === 'FOCUS_CAMERA' &&
      typeof obj.target === 'string' &&
      ALLOWED_CAMERA_TARGETS.has(obj.target as DrLabMuCameraTarget)
    ) {
      result.push({
        type: 'FOCUS_CAMERA',
        target: obj.target as DrLabMuCameraTarget,
      });
    } else if (type === 'TOGGLE_XRAY' && typeof obj.enabled === 'boolean') {
      result.push({
        type: 'TOGGLE_XRAY',
        enabled: obj.enabled,
      });
    } else if (
      type === 'HIGHLIGHT_SLIDER' &&
      typeof obj.paramKey === 'string' &&
      /^[a-zA-Z0-9_-]{1,64}$/.test(obj.paramKey.trim())
    ) {
      const rawMs = typeof obj.durationMs === 'number' && Number.isFinite(obj.durationMs)
        ? obj.durationMs
        : 3000;
      const durationMs = Math.max(500, Math.min(8000, Math.round(rawMs)));
      result.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: obj.paramKey.trim(),
        durationMs,
      });
    } else if (
      type === 'SET_SIMULATION_STATE' &&
      typeof obj.action === 'string' &&
      ALLOWED_SIM_ACTIONS.has(obj.action as 'play' | 'pause' | 'reset')
    ) {
      result.push({
        type: 'SET_SIMULATION_STATE',
        action: obj.action as 'play' | 'pause' | 'reset',
      });
    }

    if (result.length >= 4) break;
  }

  return result;
}

export function formatDrLabMuActionChipLabel(action: DrLabMuUIAction): string {
  switch (action.type) {
    case 'FOCUS_CAMERA': {
      const targetNames: Record<DrLabMuCameraTarget, string> = {
        left_ventricle: 'Ventrikel Kiri Jantung',
        burette_tip: 'Ujung Kran Buret',
        pendulum_bob: 'Beban Bandul 3D',
        planet_focus: 'Fokus Planet Orbit',
      };
      return `Fokus Kamera: ${targetNames[action.target]}`;
    }
    case 'TOGGLE_XRAY':
      return action.enabled ? 'Aktifkan Mode X-Ray' : 'Matikan Mode X-Ray';
    case 'HIGHLIGHT_SLIDER':
      return `Sorot Slider: ${action.paramKey}`;
    case 'SET_SIMULATION_STATE':
      return action.action === 'play'
        ? 'Jalankan Simulasi'
        : action.action === 'pause'
        ? 'Jeda Simulasi'
        : 'Reset Simulasi';
  }
}

export interface TelemetryActionHintInput {
  domain: string;
  topic?: string;
  studentQuery?: string;
  currentParameters?: Record<string, unknown>;
}

/**
 * Generates contextual Hands-On UI Actions deterministically for 3T offline mode
 * or when enriching text-only responses.
 */
export function deriveContextualDrLabMuActions(
  telemetry: TelemetryActionHintInput
): DrLabMuUIAction[] {
  const domain = (telemetry.domain || '').toLowerCase();
  const topic = (telemetry.topic || '').toLowerCase();
  const query = (telemetry.studentQuery || '').toLowerCase();
  const combined = `${topic} ${query}`;
  const actions: DrLabMuUIAction[] = [];

  if (domain.includes('kimia')) {
    if (
      combined.includes('titrasi') ||
      combined.includes('buret') ||
      combined.includes('ph') ||
      combined.includes('asam') ||
      combined.includes('basa')
    ) {
      actions.push({ type: 'FOCUS_CAMERA', target: 'burette_tip' });
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'titrantAddedMl',
        durationMs: 3000,
      });
    } else if (combined.includes('gas') || combined.includes('boyle') || combined.includes('tekanan')) {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'gasVolumeL',
        durationMs: 3000,
      });
    } else {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'initialTempC',
        durationMs: 3000,
      });
    }
  } else if (domain.includes('biologi')) {
    if (
      combined.includes('jantung') ||
      combined.includes('kardio') ||
      combined.includes('ventrikel') ||
      combined.includes('nadi') ||
      combined.includes('darah') ||
      combined.includes('pembuluh')
    ) {
      actions.push({ type: 'FOCUS_CAMERA', target: 'left_ventricle' });
      actions.push({ type: 'TOGGLE_XRAY', enabled: true });
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'vesselRadiusRatio',
        durationMs: 3000,
      });
    } else if (combined.includes('paru') || combined.includes('respirasi')) {
      actions.push({ type: 'TOGGLE_XRAY', enabled: true });
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'diaphragmEffort',
        durationMs: 3000,
      });
    } else if (combined.includes('sinaps') || combined.includes('saraf')) {
      actions.push({ type: 'TOGGLE_XRAY', enabled: true });
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'stimulusVoltageMv',
        durationMs: 3000,
      });
    } else if (
      combined.includes('osmosis') ||
      combined.includes('plasmolisis') ||
      combined.includes('vakuola')
    ) {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'sucroseConcMolar',
        durationMs: 3000,
      });
    } else if (
      combined.includes('katalase') ||
      combined.includes('enzim') ||
      combined.includes('enzyme')
    ) {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: combined.includes('ph') ? 'enzymePh' : 'enzymeSubstrateS',
        durationMs: 3000,
      });
    } else if (
      combined.includes('predator') ||
      combined.includes('mangsa') ||
      combined.includes('lotka') ||
      combined.includes('ekosistem')
    ) {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: combined.includes('mangsa') || combined.includes('prey')
          ? 'preyPopulationX'
          : 'predatorPopulationY',
        durationMs: 3000,
      });
    } else {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'lightIntensityLux',
        durationMs: 3000,
      });
    }
  } else if (domain.includes('astronomi')) {
    actions.push({ type: 'FOCUS_CAMERA', target: 'planet_focus' });
    const astroParamKey = combined.includes('hubble')
      ? 'galaxyDistanceMpc'
      : combined.includes('wien')
      ? 'starEffectiveTempK'
      : combined.includes('exoplanet') || combined.includes('eksoplanet') || combined.includes('transit')
      ? 'exoplanetRadiusEarth'
      : combined.includes('milky') || combined.includes('bima sakti') || combined.includes('galaksi') || combined.includes('dark matter')
      ? 'darkMatterHaloFraction'
      : 'customSemiMajorAxisAu';
    actions.push({
      type: 'HIGHLIGHT_SLIDER',
      paramKey: astroParamKey,
      durationMs: 3000,
    });
  } else {
    // Fisika
    if (combined.includes('bandul') || combined.includes('pendulum') || combined.includes('periode')) {
      actions.push({ type: 'FOCUS_CAMERA', target: 'pendulum_bob' });
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'pendulumLength',
        durationMs: 3000,
      });
    } else if (combined.includes('pegas') || combined.includes('hooke')) {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'springDisplacement',
        durationMs: 3000,
      });
    } else if (combined.includes('parabola') || combined.includes('proyektil')) {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'launchAngle',
        durationMs: 3000,
      });
    } else {
      actions.push({
        type: 'HIGHLIGHT_SLIDER',
        paramKey: 'appliedForce',
        durationMs: 3000,
      });
    }
  }

  return sanitizeDrLabMuUIActions(actions);
}
