/**
 * Circular Ring Buffer for Deterministic Time-Scrubbing & Replay
 * Stores simulation frames in a fixed-capacity memory-safe buffer.
 */

export interface Vector3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface SimulationFrame {
  frameIndex: number;
  timestamp: number; // in seconds
  positions: Record<string, Vector3Tuple>;
  velocities: Record<string, Vector3Tuple>;
  accelerations: Record<string, Vector3Tuple>;
  energies: {
    kinetic: number;
    potential: number;
    thermal: number;
    total: number;
  };
  scalars?: Record<string, number>; // e.g., springExtension, angleRad, orbitalDistance
}

export class SimulationRingBuffer {
  private readonly capacity: number;
  private readonly buffer: (SimulationFrame | null)[];
  private writeIndex = 0;
  private count = 0;
  private minFrame = 0;
  private maxFrame = 0;

  constructor(capacity = 1800) {
    if (capacity <= 0) {
      throw new Error('SimulationRingBuffer capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.buffer = new Array<SimulationFrame | null>(capacity).fill(null);
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getCount(): number {
    return this.count;
  }

  public push(frame: SimulationFrame): void {
    const isFirst = this.count === 0;

    this.buffer[this.writeIndex] = frame;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;

    if (isFirst) {
      this.count = 1;
      this.minFrame = frame.frameIndex;
      this.maxFrame = frame.frameIndex;
      return;
    }

    if (this.count < this.capacity) {
      this.count++;
      this.minFrame = Math.min(this.minFrame, frame.frameIndex);
      this.maxFrame = Math.max(this.maxFrame, frame.frameIndex);
    } else {
      // Overwrote oldest item in full circular buffer.
      // The oldest item is now at current writeIndex
      const oldest = this.buffer[this.writeIndex];
      this.minFrame = oldest ? oldest.frameIndex : frame.frameIndex - (this.capacity - 1);
      this.maxFrame = frame.frameIndex;
    }
  }

  public getByFrameIndex(frameIndex: number): SimulationFrame | null {
    if (this.count === 0) return null;
    if (frameIndex < this.minFrame || frameIndex > this.maxFrame) return null;

    // Fast-path O(1) modulo index check for sequential frame indices
    const candidateIdx = ((frameIndex % this.capacity) + this.capacity) % this.capacity;
    const candidate = this.buffer[candidateIdx];
    if (candidate && candidate.frameIndex === frameIndex) {
      return candidate;
    }

    // Fallback scan across active frames in case of non-unit increments
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIndex - this.count + i + this.capacity) % this.capacity;
      const f = this.buffer[idx];
      if (f && f.frameIndex === frameIndex) {
        return f;
      }
    }

    return null;
  }

  public getLatest(): SimulationFrame | null {
    if (this.count === 0) return null;
    const latestIdx = (this.writeIndex - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIdx];
  }

  public getAllOrdered(): SimulationFrame[] {
    if (this.count === 0) return [];
    const result: SimulationFrame[] = new Array(this.count);
    const startIdx = (this.writeIndex - this.count + this.capacity) % this.capacity;

    for (let i = 0; i < this.count; i++) {
      const idx = (startIdx + i) % this.capacity;
      result[i] = this.buffer[idx] as SimulationFrame;
    }
    return result;
  }

  public getBounds(): { minFrame: number; maxFrame: number; count: number } {
    return {
      minFrame: this.count > 0 ? this.minFrame : 0,
      maxFrame: this.count > 0 ? this.maxFrame : 0,
      count: this.count,
    };
  }

  public clear(): void {
    this.buffer.fill(null);
    this.writeIndex = 0;
    this.count = 0;
    this.minFrame = 0;
    this.maxFrame = 0;
  }
}
