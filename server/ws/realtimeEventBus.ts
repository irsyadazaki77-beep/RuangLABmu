/**
 * Scalable Pub/Sub Realtime Event Bus abstraction for WebSocket fan-out.
 * - Default: `InMemoryRealtimeEventBus` for zero-dependency single-node / 3T portable deployments.
 * - Cloud Ready: Implements `RealtimeEventBus` so multi-instance Redis Pub/Sub can be plugged in
 *   without changing WebSocket or REST route handlers.
 */
export interface RealtimeBusEnvelope {
  channel: string;
  payload: unknown;
  originNodeId?: string;
}

export type RealtimeBusListener = (envelope: RealtimeBusEnvelope) => void;

export interface RealtimeEventBus {
  readonly driver: 'memory' | 'redis';
  publish(channel: string, payload: unknown): void;
  subscribe(channel: string, listener: RealtimeBusListener): () => void;
  close(): Promise<void>;
}

export class InMemoryRealtimeEventBus implements RealtimeEventBus {
  public readonly driver = 'memory' as const;
  private readonly listeners = new Map<string, Set<RealtimeBusListener>>();

  public publish(channel: string, payload: unknown): void {
    const channelListeners = this.listeners.get(channel);
    if (!channelListeners || channelListeners.size === 0) return;
    const envelope: RealtimeBusEnvelope = { channel, payload };
    for (const listener of channelListeners) {
      listener(envelope);
    }
  }

  public subscribe(channel: string, listener: RealtimeBusListener): () => void {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  public async close(): Promise<void> {
    this.listeners.clear();
  }
}

export function createRealtimeEventBus(): RealtimeEventBus {
  return new InMemoryRealtimeEventBus();
}
