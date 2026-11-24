import fs from 'fs';
import path from 'path';
import type { RuangLabDatabase } from '../db/database';
import { logger } from '../utils/logger';

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupServiceStatus {
  enabled: boolean;
  backupDir: string;
  retentionCount: number;
  intervalMs: number;
  lastBackupAt: string | null;
  lastBackupFilename: string | null;
  lastError: string | null;
  backupCount: number;
}

const SAFE_BACKUP_FILENAME_RE = /^ruanglab-backup-[0-9T-]+(?:-[a-z0-9]+)?\.db$/;
export const DEFAULT_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const DEFAULT_BACKUP_RETENTION = 10;

export class DatabaseBackupService {
  private readonly database: RuangLabDatabase;
  private readonly backupDir: string;
  private readonly retentionCount: number;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastBackupAt: string | null = null;
  private lastBackupFilename: string | null = null;
  private lastError: string | null = null;

  constructor(options: {
    database: RuangLabDatabase;
    backupDir?: string;
    retentionCount?: number;
    intervalMs?: number;
  }) {
    this.database = options.database;
    this.backupDir = path.resolve(
      options.backupDir ||
        process.env.RUANGLAB_BACKUP_DIR ||
        path.join(process.cwd(), 'data', 'backups')
    );
    const envRetention = Number(process.env.BACKUP_RETENTION_COUNT);
    this.retentionCount = Math.max(
      1,
      Math.min(
        100,
        options.retentionCount ??
          (Number.isFinite(envRetention) && envRetention > 0
            ? Math.floor(envRetention)
            : DEFAULT_BACKUP_RETENTION)
      )
    );
    const envInterval = Number(process.env.BACKUP_INTERVAL_MS);
    this.intervalMs = Math.max(
      60_000,
      options.intervalMs ??
        (Number.isFinite(envInterval) && envInterval >= 60_000
          ? Math.floor(envInterval)
          : DEFAULT_BACKUP_INTERVAL_MS)
    );
  }

  public getBackupDir(): string {
    return this.backupDir;
  }

  public isFileBacked(): boolean {
    return Boolean(this.database.dbPath && this.database.dbPath !== ':memory:');
  }

  public startScheduler(): void {
    if (this.timer || !this.isFileBacked()) return;
    this.timer = setInterval(() => {
      try {
        this.createBackup('scheduled');
      } catch (err) {
        logger.error('Scheduled SQLite backup failed', { error: err });
      }
    }, this.intervalMs);
    this.timer.unref?.();
    logger.info('Automated SQLite hot-backup scheduler started', {
      intervalMs: this.intervalMs,
      retentionCount: this.retentionCount,
    });
  }

  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public createBackup(tag: string = 'manual'): BackupEntry {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const safeTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'manual';
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace(/Z$/, '');
    const filename = `ruanglab-backup-${stamp}-${safeTag}.db`;
    const targetPath = this.resolveSafeBackupPath(filename);
    if (!targetPath) {
      throw new Error('Nama berkas backup tidak valid.');
    }

    try {
      this.database.backupDatabase(targetPath);
      const stat = fs.statSync(targetPath);
      const createdAt = stat.mtime.toISOString();
      this.lastBackupAt = createdAt;
      this.lastBackupFilename = filename;
      this.lastError = null;
      this.rotateRetention();
      logger.info('SQLite hot backup completed via VACUUM INTO', {
        filename,
        sizeBytes: stat.size,
      });
      return {
        filename,
        sizeBytes: stat.size,
        createdAt,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Backup gagal dijalankan';
      throw err;
    }
  }

  public listBackups(): BackupEntry[] {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }
    const entries: BackupEntry[] = [];
    for (const name of fs.readdirSync(this.backupDir)) {
      if (!SAFE_BACKUP_FILENAME_RE.test(name)) continue;
      const fullPath = this.resolveSafeBackupPath(name);
      if (!fullPath) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        entries.push({
          filename: name,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      } catch {
        // Ignore transient stat error
      }
    }
    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries;
  }

  /**
   * Resolves a backup filename strictly inside `this.backupDir` using path.resolve + trailing path.sep check.
   */
  public resolveSafeBackupPath(filename: string): string | null {
    const clean = String(filename || '').trim();
    if (!SAFE_BACKUP_FILENAME_RE.test(clean)) {
      return null;
    }
    const resolved = path.resolve(this.backupDir, clean);
    const confinedPrefix = this.backupDir.endsWith(path.sep)
      ? this.backupDir
      : `${this.backupDir}${path.sep}`;
    if (!resolved.startsWith(confinedPrefix)) {
      return null;
    }
    return resolved;
  }

  public rotateRetention(): number {
    const backups = this.listBackups();
    if (backups.length <= this.retentionCount) return 0;
    let deleted = 0;
    for (const stale of backups.slice(this.retentionCount)) {
      const resolved = this.resolveSafeBackupPath(stale.filename);
      if (!resolved) continue;
      try {
        fs.unlinkSync(resolved);
        deleted += 1;
      } catch {
        // Ignore unlink errors
      }
    }
    return deleted;
  }

  public getStatus(): BackupServiceStatus {
    const backups = this.listBackups();
    return {
      enabled: this.isFileBacked(),
      backupDir: this.backupDir,
      retentionCount: this.retentionCount,
      intervalMs: this.intervalMs,
      lastBackupAt: this.lastBackupAt ?? backups[0]?.createdAt ?? null,
      lastBackupFilename: this.lastBackupFilename ?? backups[0]?.filename ?? null,
      lastError: this.lastError,
      backupCount: backups.length,
    };
  }
}
