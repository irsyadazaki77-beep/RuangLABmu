export const WS_BASE_RECONNECT_MS = 1000;
export const WS_MAX_RECONNECT_MS = 15000;
export const WS_MAX_JITTER_MS = 400;
export const MAX_OUTBOX_QUEUE_SIZE = 250;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function shouldScheduleWsReconnect(params: {
  unmounted: boolean;
  isOnline: boolean;
}): boolean {
  return !params.unmounted && params.isOnline;
}

/**
 * Computes exponential backoff reconnect delay:
 * min(1000 * 2^attempt, 15000) ms + random jitter
 */
export function calculateReconnectDelay(
  attempt: number,
  randomFn: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const baseDelay = Math.min(
    WS_BASE_RECONNECT_MS * Math.pow(2, safeAttempt),
    WS_MAX_RECONNECT_MS
  );
  const clampedRand = Math.max(0, Math.min(1, randomFn()));
  const jitter = Math.round(clampedRand * WS_MAX_JITTER_MS);
  return baseDelay + jitter;
}

export interface OutboxQueuedEvent {
  type: string;
  payload: unknown;
  queuedAt: number;
}

/**
 * FIFO Offline Outbox Queue for buffering parameter/state changes while
 * WebSocket connection is offline or reconnecting, and flushing sequentially upon reconnect.
 */
export class OfflineOutboxQueue {
  private queue: OutboxQueuedEvent[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity: number = MAX_OUTBOX_QUEUE_SIZE) {
    this.maxCapacity = Math.max(1, maxCapacity);
  }

  public enqueue(type: string, payload: unknown, nowMs: number = Date.now()): void {
    if (type === 'PARAM_VALUE_SYNC' && isPlainObject(payload)) {
      const paramKey = payload.paramKey;
      const groupId = payload.groupId;
      if (typeof paramKey === 'string') {
        const existingIdx = this.queue.findIndex(
          (item) =>
            item.type === 'PARAM_VALUE_SYNC' &&
            isPlainObject(item.payload) &&
            item.payload.paramKey === paramKey &&
            item.payload.groupId === groupId
        );
        if (existingIdx !== -1) {
          this.queue.splice(existingIdx, 1);
        }
      }
    }

    if (this.queue.length >= this.maxCapacity) {
      this.queue.shift();
    }

    this.queue.push({
      type,
      payload,
      queuedAt: nowMs,
    });
  }

  public flush(sendFn: (serializedMessage: string) => void): number {
    let flushedCount = 0;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        sendFn(JSON.stringify({ type: item.type, payload: item.payload }));
        flushedCount += 1;
      }
    }
    return flushedCount;
  }

  public size(): number {
    return this.queue.length;
  }

  public peekAll(): ReadonlyArray<OutboxQueuedEvent> {
    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
  }
}
