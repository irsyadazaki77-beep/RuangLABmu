import fs from 'fs';
import path from 'path';

export interface TeacherAuthContext {
  socketId: string;
  claimedRole?: string;
  providedPin?: string;
  providedToken?: string;
  roomPin?: string;
  roomTeacherSocketId?: string;
  isSocketAlreadyVerifiedTeacher?: boolean;
  expectedMasterPin?: string;
}

export interface TeacherAuthResult {
  authorized: boolean;
  effectiveRole: 'Pengajar' | 'Praktikan';
  reason?: string;
}

/**
 * Validates whether a WebSocket client is authorized to claim the 'Pengajar' (teacher) role
 * or execute privileged teacher actions (e.g., freeze class, broadcast mystery challenge, send teacher feedback).
 */
export function verifyTeacherAuthorization(ctx: TeacherAuthContext): TeacherAuthResult {
  const masterPin = (ctx.expectedMasterPin || process.env.TEACHER_SECRET_PIN || '1234').trim();
  const wantsTeacher =
    ctx.claimedRole === 'Pengajar' ||
    ctx.claimedRole === 'teacher' ||
    ctx.claimedRole === 'Guru';

  if (ctx.isSocketAlreadyVerifiedTeacher) {
    return { authorized: true, effectiveRole: 'Pengajar' };
  }

  if (ctx.roomTeacherSocketId && ctx.roomTeacherSocketId === ctx.socketId) {
    return { authorized: true, effectiveRole: 'Pengajar' };
  }

  const candidatePin = (ctx.providedPin || ctx.providedToken || '').trim();
  if (candidatePin) {
    if (ctx.roomPin && candidatePin === ctx.roomPin.trim()) {
      return { authorized: true, effectiveRole: 'Pengajar' };
    }
    if (candidatePin === masterPin) {
      return { authorized: true, effectiveRole: 'Pengajar' };
    }
  }

  if (wantsTeacher) {
    return {
      authorized: false,
      effectiveRole: 'Praktikan',
      reason: 'Klaim peran Pengajar ditolak: PIN Guru atau otorisasi pemilik ruangan tidak valid.',
    };
  }

  return {
    authorized: false,
    effectiveRole: 'Praktikan',
    reason: 'Aksi khusus Pengajar membutuhkan verifikasi PIN Guru.',
  };
}

/**
 * Non-blocking, atomic, sequential write-queued JSON store for student submissions.
 * Eliminates `fs.writeFileSync` event-loop blocking and prevents race conditions / data loss
 * when multiple students submit simultaneously.
 */
export class AsyncSubmissionStore<T extends { id: string }> {
  private readonly filePath: string;
  private readonly seedData: T[];
  private items: T[] = [];
  private writeQueue: Promise<void> = Promise.resolve();
  private writeCount = 0;

  constructor(filePath: string, seedData: T[] = []) {
    this.filePath = filePath;
    this.seedData = seedData;
    this.items = [...seedData];
  }

  /**
   * Initializes the store from disk asynchronously (or seeds it if missing).
   */
  async init(): Promise<T[]> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      try {
        const raw = await fs.promises.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.items = parsed;
          return this.items;
        }
      } catch {
        // File does not exist or is invalid JSON; seed below
      }
      this.items = [...this.seedData];
      await this.enqueuePersist();
    } catch (err) {
      console.error('Failed to initialize AsyncSubmissionStore:', err);
    }
    return this.items;
  }

  getAll(): T[] {
    return this.items;
  }

  setAll(nextItems: T[]): Promise<void> {
    this.items = nextItems;
    return this.enqueuePersist();
  }

  /**
   * Inserts or updates a submission in memory immediately and queues an atomic disk write.
   */
  async upsert(entry: T, matchFn?: (existing: T) => boolean): Promise<T[]> {
    const idx = matchFn
      ? this.items.findIndex(matchFn)
      : this.items.findIndex((item) => item.id === entry.id);

    if (idx >= 0) {
      this.items[idx] = entry;
    } else {
      this.items.unshift(entry);
    }

    await this.enqueuePersist();
    return this.items;
  }

  /**
   * Enqueues an atomic write operation (`writeFile` to temp file + `rename` to target path)
   * on a strict FIFO promise chain so concurrent requests never interleave or corrupt the file.
   */
  enqueuePersist(): Promise<void> {
    const snapshotJson = JSON.stringify(this.items, null, 2);
    const nextOp = this.writeQueue.then(async () => {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      this.writeCount += 1;
      const tempFile = `${this.filePath}.${process.pid}.${Date.now()}.${this.writeCount}.tmp`;
      await fs.promises.writeFile(tempFile, snapshotJson, 'utf-8');
      await fs.promises.rename(tempFile, this.filePath);
    });

    // Keep the queue alive even if an individual write fails
    this.writeQueue = nextOp.catch((err) => {
      console.error('Failed to persist submissions asynchronously:', err);
    });

    return nextOp;
  }

  /**
   * Waits for all pending queued writes to flush to disk.
   */
  async flush(): Promise<void> {
    await this.writeQueue;
  }
}
