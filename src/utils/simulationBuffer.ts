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
  private readonly sharedBuffer: SharedArrayBuffer | ArrayBuffer;
  private readonly headerView: Int32Array;
  private readonly frameMetricsView: Float64Array;
  private readonly usesSharedArrayBuffer: boolean;
  private writeIndex = 0;
  private count = 0;
  private minFrame = 0;
  private maxFrame = 0;

  // Header indices: [0] = writeIndex, [1] = count, [2] = minFrame, [3] = maxFrame
  private static readonly HEADER_INTS = 4;
  private static readonly HEADER_BYTES = 16; // 4 * 4 bytes (aligned to 8 bytes for Float64Array)
  // Per-frame Float64 slots: [frameIndex, timestamp, kinetic, potential, thermal, total]
  private static readonly FLOATS_PER_FRAME = 6;

  constructor(capacity = 1800, existingSharedBuffer?: SharedArrayBuffer) {
    if (capacity <= 0) {
      throw new Error('SimulationRingBuffer capacity must be greater than 0');
    }
    this.capacity = capacity;
    this.buffer = new Array<SimulationFrame | null>(capacity).fill(null);

    const totalBytes =
      SimulationRingBuffer.HEADER_BYTES +
      capacity * SimulationRingBuffer.FLOATS_PER_FRAME * Float64Array.BYTES_PER_ELEMENT;

    if (existingSharedBuffer && existingSharedBuffer.byteLength >= totalBytes) {
      this.sharedBuffer = existingSharedBuffer;
      this.usesSharedArrayBuffer = true;
    } else if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        this.sharedBuffer = new SharedArrayBuffer(totalBytes);
        this.usesSharedArrayBuffer = true;
      } catch {
        this.sharedBuffer = new ArrayBuffer(totalBytes);
        this.usesSharedArrayBuffer = false;
      }
    } else {
      this.sharedBuffer = new ArrayBuffer(totalBytes);
      this.usesSharedArrayBuffer = false;
    }

    this.headerView = new Int32Array(
      this.sharedBuffer,
      0,
      SimulationRingBuffer.HEADER_INTS
    );
    this.frameMetricsView = new Float64Array(
      this.sharedBuffer,
      SimulationRingBuffer.HEADER_BYTES,
      capacity * SimulationRingBuffer.FLOATS_PER_FRAME
    );
  }

  public isSharedMemoryBacked(): boolean {
    return this.usesSharedArrayBuffer;
  }

  public getSharedBuffer(): SharedArrayBuffer | ArrayBuffer {
    return this.sharedBuffer;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getCount(): number {
    return this.count;
  }

  private syncHeaderToSharedMemory(): void {
    if (this.usesSharedArrayBuffer && typeof Atomics !== 'undefined') {
      Atomics.store(this.headerView, 0, this.writeIndex);
      Atomics.store(this.headerView, 1, this.count);
      Atomics.store(this.headerView, 2, this.minFrame);
      Atomics.store(this.headerView, 3, this.maxFrame);
    } else {
      this.headerView[0] = this.writeIndex;
      this.headerView[1] = this.count;
      this.headerView[2] = this.minFrame;
      this.headerView[3] = this.maxFrame;
    }
  }

  public push(frame: SimulationFrame): void {
    const isFirst = this.count === 0;
    const slotIndex = this.writeIndex;

    this.buffer[slotIndex] = frame;
    const floatOffset = slotIndex * SimulationRingBuffer.FLOATS_PER_FRAME;
    this.frameMetricsView[floatOffset] = frame.frameIndex;
    this.frameMetricsView[floatOffset + 1] = frame.timestamp;
    this.frameMetricsView[floatOffset + 2] = frame.energies.kinetic;
    this.frameMetricsView[floatOffset + 3] = frame.energies.potential;
    this.frameMetricsView[floatOffset + 4] = frame.energies.thermal;
    this.frameMetricsView[floatOffset + 5] = frame.energies.total;

    this.writeIndex = (this.writeIndex + 1) % this.capacity;

    if (isFirst) {
      this.count = 1;
      this.minFrame = frame.frameIndex;
      this.maxFrame = frame.frameIndex;
      this.syncHeaderToSharedMemory();
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

    this.syncHeaderToSharedMemory();
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
    this.frameMetricsView.fill(0);
    this.writeIndex = 0;
    this.count = 0;
    this.minFrame = 0;
    this.maxFrame = 0;
    this.syncHeaderToSharedMemory();
  }
}
