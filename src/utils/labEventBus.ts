/**
 * Strictly-typed Event Bus for synchronizing 3D simulation controls
 * (Play/Pause, Reset Trial, and 3D Canvas Snapshot) across LabControlDock
 * and domain LabViews without raw string literals.
 */

export const LAB_EVENTS = {
  TOGGLE_SIMULATION: 'ruanglab:toggle-simulation',
  CAPTURE_SNAPSHOT: 'ruanglab:capture-snapshot',
  RESET_TRIAL: 'ruanglab:reset-trial',
  CHANGE_SPEED: 'ruanglab:change-speed',
  APPARATUS_DOCKED: 'ruanglab:apparatus-docked',
  SCAFFOLDING_FOCUS_INSTRUMENT: 'ruanglab:scaffolding-focus-instrument',
  SCAFFOLDING_ASK_DR_LABMU: 'ruanglab:scaffolding-ask-dr-labmu',
} as const;

export type LabEventName = (typeof LAB_EVENTS)[keyof typeof LAB_EVENTS];

export interface LabEventPayloadMap {
  [LAB_EVENTS.TOGGLE_SIMULATION]: { isSimulating?: boolean };
  [LAB_EVENTS.CAPTURE_SNAPSHOT]: { timestamp: number };
  [LAB_EVENTS.RESET_TRIAL]: { timestamp: number };
  [LAB_EVENTS.CHANGE_SPEED]: { speed: number };
  [LAB_EVENTS.APPARATUS_DOCKED]: {
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
    portType: 'fluid' | 'electric' | 'optical';
    snappedPosition: [number, number, number];
    timestamp: number;
  };
  [LAB_EVENTS.SCAFFOLDING_FOCUS_INSTRUMENT]: {
    instrumentId: string;
    targetPosition: [number, number, number];
    cameraOffset?: [number, number, number];
    reason: string;
  };
  [LAB_EVENTS.SCAFFOLDING_ASK_DR_LABMU]: {
    prompt: string;
    tier: 1 | 2 | 3;
    condition: 'stagnant_trial' | 'erratic_outliers' | 'safety_violation';
  };
}

export function emitLabEvent<K extends LabEventName>(
  eventName: K,
  detail?: LabEventPayloadMap[K]
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function subscribeLabEvent<K extends LabEventName>(
  eventName: K,
  handler: (detail: LabEventPayloadMap[K] | undefined) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<LabEventPayloadMap[K]>;
    handler(customEvent.detail);
  };
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}

