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
} as const;

export type LabEventName = (typeof LAB_EVENTS)[keyof typeof LAB_EVENTS];

export interface LabEventPayloadMap {
  [LAB_EVENTS.TOGGLE_SIMULATION]: { isSimulating?: boolean };
  [LAB_EVENTS.CAPTURE_SNAPSHOT]: { timestamp: number };
  [LAB_EVENTS.RESET_TRIAL]: { timestamp: number };
  [LAB_EVENTS.CHANGE_SPEED]: { speed: number };
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
