/**
 * Lightweight Ring Buffer for 3D Simulation Time-Travel Scrubbing.
 * Stores up to 600 historical frames (10s @ 60Hz or 20s @ 30Hz)
 * with O(1) push, binary-search seek by timestamp, and branching timeline truncation.
 */

export const DEFAULT_TIMELINE_CAPACITY = 600;

export interface TimelineFrame<
  TParams = Record<string, unknown>,
  TState = Record<string, unknown>
> {
  seq: number;
  simTime: number;
  parameters: TParams;
  stateSnapshot: TState;
}

function cloneSnapshot<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneSnapshot(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== null && typeof v === 'object') {
      out[k] = cloneSnapshot(v);
    } else if (typeof v !== 'function') {
      out[k] = v;
    }
  }
  return out as T;
}

export class SimulationTimelineBuffer<
  TParams = Record<string, unknown>,
  TState = Record<string, unknown>
> {
  public readonly capacity: number;
  private buffer: Array<TimelineFrame<TParams, TState> | undefined>;
  private head = 0; // index of oldest element
  private count = 0;
  private nextSeq = 1;

  constructor(capacity = DEFAULT_TIMELINE_CAPACITY) {
    this.capacity = Math.max(2, Math.floor(capacity));
    this.buffer = new Array<TimelineFrame<TParams, TState> | undefined>(this.capacity);
  }

  public push(
    simTime: number,
    parameters: TParams,
    stateSnapshot: TState
  ): TimelineFrame<TParams, TState> {
    const safeTime = Number.isFinite(simTime) ? simTime : 0;
    const frame: TimelineFrame<TParams, TState> = {
      seq: this.nextSeq++,
      simTime: safeTime,
      parameters: cloneSnapshot(parameters),
      stateSnapshot: cloneSnapshot(stateSnapshot),
    };

    const writeIdx = (this.head + this.count) % this.capacity;
    this.buffer[writeIdx] = frame;

    if (this.count < this.capacity) {
      this.count += 1;
    } else {
      // Ring wrap-around: advance oldest pointer
      this.head = (this.head + 1) % this.capacity;
    }

    return frame;
  }

  public getCount(): number {
    return this.count;
  }

  public getAt(logicalIndex: number): TimelineFrame<TParams, TState> | null {
    if (this.count === 0) return null;
    const clamped = Math.max(0, Math.min(this.count - 1, Math.floor(logicalIndex)));
    const physIdx = (this.head + clamped) % this.capacity;
    return this.buffer[physIdx] ?? null;
  }

  public getLatest(): TimelineFrame<TParams, TState> | null {
    if (this.count === 0) return null;
    return this.getAt(this.count - 1);
  }

  public getOldest(): TimelineFrame<TParams, TState> | null {
    if (this.count === 0) return null;
    return this.getAt(0);
  }

  /**
   * Binary-search nearest frame by simulation timestamp.
   */
  public getByTime(
    targetSimTime: number
  ): { index: number; frame: TimelineFrame<TParams, TState> } | null {
    if (this.count === 0) return null;
    let lo = 0;
    let hi = this.count - 1;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const midFrame = this.getAt(mid);
      if (!midFrame) break;
      if (midFrame.simTime < targetSimTime) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    const curr = this.getAt(lo);
    if (!curr) return null;
    if (lo > 0) {
      const prev = this.getAt(lo - 1);
      if (
        prev &&
        Math.abs(prev.simTime - targetSimTime) <= Math.abs(curr.simTime - targetSimTime)
      ) {
        return { index: lo - 1, frame: prev };
      }
    }
    return { index: lo, frame: curr };
  }

  /**
   * Truncate all future frames strictly after `logicalIndex` to enable clean
   * branching timelines when resuming Play after scrubbing backward.
   * Returns the new frame count.
   */
  public truncateAfter(logicalIndex: number): number {
    if (this.count === 0) return 0;
    const keepCount = Math.max(1, Math.min(this.count, Math.floor(logicalIndex) + 1));
    for (let i = keepCount; i < this.count; i++) {
      const physIdx = (this.head + i) % this.capacity;
      this.buffer[physIdx] = undefined;
    }
    this.count = keepCount;
    return this.count;
  }

  public getRange(): { minTime: number; maxTime: number; count: number } {
    if (this.count === 0) {
      return { minTime: 0, maxTime: 0, count: 0 };
    }
    const oldest = this.getAt(0);
    const latest = this.getAt(this.count - 1);
    return {
      minTime: oldest?.simTime ?? 0,
      maxTime: latest?.simTime ?? 0,
      count: this.count,
    };
  }

  public clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}

const domainBuffers = new Map<string, SimulationTimelineBuffer<any, any>>();

export function getDomainTimelineBuffer<
  TParams = Record<string, unknown>,
  TState = Record<string, unknown>
>(domain: string): SimulationTimelineBuffer<TParams, TState> {
  let existing = domainBuffers.get(domain);
  if (!existing) {
    existing = new SimulationTimelineBuffer<TParams, TState>(DEFAULT_TIMELINE_CAPACITY);
    domainBuffers.set(domain, existing);
  }
  return existing as SimulationTimelineBuffer<TParams, TState>;
}

export function clearAllTimelineBuffers(): void {
  domainBuffers.forEach((buf) => buf.clear());
}
