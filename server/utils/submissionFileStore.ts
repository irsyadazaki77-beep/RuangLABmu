import fs from 'fs';
import path from 'path';

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
   * Initializes the store from disk asynchronously.
   * Automatically creates an empty `[]` JSON file if `this.filePath` does not exist at startup.
   */
  async init(): Promise<T[]> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      let fileExists = false;
      try {
        await fs.promises.access(this.filePath, fs.constants.F_OK);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      if (!fileExists) {
        await fs.promises.writeFile(this.filePath, '[]\n', 'utf-8');
        this.items = [...this.seedData];
        return this.items;
      }

      try {
        const raw = await fs.promises.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 || this.seedData.length === 0) {
            this.items = parsed;
            return this.items;
          }
          this.items = [...this.seedData];
          return this.items;
        }
      } catch {
        await fs.promises.writeFile(this.filePath, '[]\n', 'utf-8');
      }
      this.items = [...this.seedData];
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
