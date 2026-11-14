import crypto from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import type { LabRoom, ParameterLockPayload } from '../../src/utils/collabProtocol';
import type {
  CollabNote,
  GroupTask,
  ServerExperimentRecord,
  ServerNotification,
  StudentProgress,
} from './labServerState';

const requireModule = createRequire(path.resolve(process.cwd(), 'package.json'));

export interface SqliteStatementLike {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => Record<string, unknown> | undefined | null;
  all: (...params: unknown[]) => Array<Record<string, unknown>>;
}

export interface SqliteDatabaseDriver {
  readonly engine: 'bun:sqlite' | 'node:sqlite';
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatementLike;
  close: () => void;
}

export function resolveDefaultDbPath(): string {
  const envPath = process.env.DB_PATH?.trim();
  if (envPath) return envPath;
  return './data/ruanglabmu.db';
}

const PIN_HASH_PREFIX = 'sha256$';

export function hashRoomPin(pin: string, explicitSalt?: string): string {
  const normalized = String(pin ?? '').trim();
  const salt = explicitSalt || crypto.randomBytes(16).toString('hex');
  const digest = crypto
    .createHmac('sha256', salt)
    .update(normalized, 'utf8')
    .digest('hex');
  return `${PIN_HASH_PREFIX}${salt}$${digest}`;
}

export function verifyRoomPinTimingSafe(
  candidatePin: string | undefined | null,
  expectedPinOrHash: string | undefined | null
): boolean {
  const candidate = String(candidatePin ?? '').trim();
  const expected = String(expectedPinOrHash ?? '').trim();
  if (!candidate || !expected) return false;

  if (expected.startsWith(PIN_HASH_PREFIX)) {
    const parts = expected.split('$');
    if (parts.length !== 3) return false;
    const [, salt, storedHex] = parts;
    if (!salt || !storedHex) return false;
    const candidateHex = crypto
      .createHmac('sha256', salt)
      .update(candidate, 'utf8')
      .digest('hex');
    const bufA = Buffer.from(candidateHex, 'hex');
    const bufB = Buffer.from(storedHex, 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // Constant-time comparison via SHA-256 digest when comparing against a plain room PIN
  const digestA = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(expected, 'utf8').digest();
  if (digestA.length !== digestB.length) return false;
  return crypto.timingSafeEqual(digestA, digestB);
}

export function openSqliteDriver(dbPath = resolveDefaultDbPath()): SqliteDatabaseDriver {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(dir, { recursive: true });
  }

  const isBunRuntime = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
  if (isBunRuntime) {
    try {
      const bunSqlite = requireModule('bun:sqlite') as {
        Database: new (filename: string) => {
          exec: (sql: string) => void;
          prepare: (sql: string) => SqliteStatementLike;
          close: () => void;
        };
      };
      const db = new bunSqlite.Database(dbPath);
      return {
        engine: 'bun:sqlite',
        exec: (sql: string) => db.exec(sql),
        prepare: (sql: string) => db.prepare(sql),
        close: () => db.close(),
      };
    } catch {
      // Fallback to node:sqlite if bun:sqlite fails to resolve
    }
  }

  const nodeSqlite = requireModule('node:sqlite') as {
    DatabaseSync: new (filename: string) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => SqliteStatementLike;
      close: () => void;
    };
  };
  const db = new nodeSqlite.DatabaseSync(dbPath);
  return {
    engine: 'node:sqlite',
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => db.prepare(sql),
    close: () => db.close(),
  };
}

export const DEFAULT_NOTIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class LabSqliteStore {
  public readonly dbPath: string;
  public readonly driver: SqliteDatabaseDriver;
  private isClosed = false;

  constructor(dbPath = resolveDefaultDbPath()) {
    this.dbPath = dbPath;
    this.driver = openSqliteDriver(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    try {
      if (this.dbPath !== ':memory:') {
        this.driver.exec('PRAGMA journal_mode = WAL;');
        this.driver.exec('PRAGMA synchronous = NORMAL;');
      }
    } catch {
      // Ignore pragma errors on special filesystems
    }

    this.driver.exec(`
      CREATE TABLE IF NOT EXISTS active_lab_rooms (
        room_id TEXT PRIMARY KEY,
        pin_hash TEXT NOT NULL,
        domain TEXT NOT NULL,
        module_id TEXT NOT NULL,
        teacher_name TEXT,
        is_frozen INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_active_lab_rooms_room_id ON active_lab_rooms(room_id);
      CREATE INDEX IF NOT EXISTS idx_active_lab_rooms_created_at ON active_lab_rooms(created_at);
      CREATE INDEX IF NOT EXISTS idx_active_lab_rooms_last_activity ON active_lab_rooms(last_activity_at);

      CREATE TABLE IF NOT EXISTS session_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL DEFAULT 'GLOBAL',
        version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_snapshots_room_id ON session_snapshots(room_id);
      CREATE INDEX IF NOT EXISTS idx_session_snapshots_created_at ON session_snapshots(created_at);
      CREATE INDEX IF NOT EXISTS idx_session_snapshots_updated_at ON session_snapshots(updated_at);

      CREATE TABLE IF NOT EXISTS parameter_locks (
        lock_key TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        param_key TEXT NOT NULL,
        locked_by_user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_parameter_locks_room_id ON parameter_locks(room_id);
      CREATE INDEX IF NOT EXISTS idx_parameter_locks_created_at ON parameter_locks(created_at);
      CREATE INDEX IF NOT EXISTS idx_parameter_locks_expires_at ON parameter_locks(expires_at);

      CREATE TABLE IF NOT EXISTS experiment_records (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL DEFAULT 'LAB-ALPHA',
        group_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        student_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_experiment_records_room_id ON experiment_records(room_id);
      CREATE INDEX IF NOT EXISTS idx_experiment_records_created_at ON experiment_records(created_at);

      CREATE TABLE IF NOT EXISTS group_tasks (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL DEFAULT 'LAB-ALPHA',
        group_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_group_tasks_room_id ON group_tasks(room_id);
      CREATE INDEX IF NOT EXISTS idx_group_tasks_created_at ON group_tasks(created_at);

      CREATE TABLE IF NOT EXISTS collab_notes (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL DEFAULT 'LAB-ALPHA',
        group_id TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_collab_notes_room_id ON collab_notes(room_id);
      CREATE INDEX IF NOT EXISTS idx_collab_notes_created_at ON collab_notes(created_at);

      CREATE TABLE IF NOT EXISTS student_roster (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL DEFAULT 'LAB-ALPHA',
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_student_roster_room_id ON student_roster(room_id);
      CREATE INDEX IF NOT EXISTS idx_student_roster_created_at ON student_roster(created_at);

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL DEFAULT 'LAB-ALPHA',
        severity TEXT NOT NULL,
        domain TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_room_id ON notifications(room_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
    `);
  }

  public upsertRoom(room: LabRoom): void {
    if (this.isClosed) return;
    const pinHash =
      room.pin && room.pin.startsWith(PIN_HASH_PREFIX)
        ? room.pin
        : hashRoomPin(room.pin);
    const createdAt = Number.isFinite(room.createdAt) ? room.createdAt : Date.now();
    const lastActivityAt = Number.isFinite(room.lastActivityAt)
      ? (room.lastActivityAt as number)
      : createdAt;
    const persistedRoom: LabRoom & { pinHash?: string } = {
      ...room,
      pinHash,
    };

    const stmt = this.driver.prepare(`
      INSERT INTO active_lab_rooms (
        room_id, pin_hash, domain, module_id, teacher_name, is_frozen, created_at, last_activity_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        pin_hash = excluded.pin_hash,
        domain = excluded.domain,
        module_id = excluded.module_id,
        teacher_name = excluded.teacher_name,
        is_frozen = excluded.is_frozen,
        last_activity_at = excluded.last_activity_at,
        payload_json = excluded.payload_json
    `);
    stmt.run(
      room.roomId,
      pinHash,
      room.domain,
      room.moduleId,
      room.teacherName || null,
      room.isFrozenByTeacher ? 1 : 0,
      createdAt,
      lastActivityAt,
      JSON.stringify(persistedRoom)
    );
  }

  public deleteRoom(roomId: string): void {
    if (this.isClosed) return;
    this.driver.prepare('DELETE FROM active_lab_rooms WHERE room_id = ?').run(roomId);
  }

  public loadAllRooms(): LabRoom[] {
    if (this.isClosed) return [];
    const rows = this.driver
      .prepare('SELECT payload_json, pin_hash FROM active_lab_rooms ORDER BY last_activity_at ASC')
      .all();
    const rooms: LabRoom[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(String(row.payload_json)) as LabRoom & { pinHash?: string };
        if (parsed && typeof parsed.roomId === 'string') {
          parsed.pinHash = String(row.pin_hash || parsed.pinHash || '');
          rooms.push(parsed);
        }
      } catch {
        // Ignore malformed row
      }
    }
    return rooms;
  }

  public upsertSessionSnapshot(
    snapshotId: string,
    entry: { version: number; session: unknown; updatedAt: number },
    roomId = 'GLOBAL'
  ): void {
    if (this.isClosed) return;
    const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now();
    const stmt = this.driver.prepare(`
      INSERT INTO session_snapshots (
        snapshot_id, room_id, version, updated_at, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_id) DO UPDATE SET
        room_id = excluded.room_id,
        version = excluded.version,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `);
    stmt.run(
      snapshotId,
      roomId,
      entry.version,
      updatedAt,
      updatedAt,
      JSON.stringify(entry)
    );
  }

  public deleteSessionSnapshot(snapshotId: string): void {
    if (this.isClosed) return;
    this.driver
      .prepare('DELETE FROM session_snapshots WHERE snapshot_id = ?')
      .run(snapshotId);
  }

  public loadAllSessionSnapshots(): Array<{
    key: string;
    value: { version: number; session: unknown; updatedAt: number };
  }> {
    if (this.isClosed) return [];
    const rows = this.driver
      .prepare('SELECT snapshot_id, payload_json FROM session_snapshots ORDER BY updated_at ASC')
      .all();
    const out: Array<{
      key: string;
      value: { version: number; session: unknown; updatedAt: number };
    }> = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(String(row.payload_json)) as {
          version: number;
          session: unknown;
          updatedAt: number;
        };
        if (parsed && typeof parsed.version === 'number') {
          out.push({ key: String(row.snapshot_id), value: parsed });
        }
      } catch {
        // Ignore malformed snapshot
      }
    }
    return out;
  }

  public upsertParameterLock(lockKey: string, lock: ParameterLockPayload, now = Date.now()): void {
    if (this.isClosed) return;
    const roomPrefix = lockKey.includes(':') ? lockKey.split(':')[0] : lock.groupId;
    const stmt = this.driver.prepare(`
      INSERT INTO parameter_locks (
        lock_key, room_id, group_id, param_key, locked_by_user_id, expires_at, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(lock_key) DO UPDATE SET
        room_id = excluded.room_id,
        group_id = excluded.group_id,
        param_key = excluded.param_key,
        locked_by_user_id = excluded.locked_by_user_id,
        expires_at = excluded.expires_at,
        payload_json = excluded.payload_json
    `);
    stmt.run(
      lockKey,
      roomPrefix || 'LAB-ALPHA',
      lock.groupId,
      lock.paramKey,
      lock.lockedByUserId,
      lock.expiresAt,
      now,
      JSON.stringify(lock)
    );
  }

  public deleteParameterLock(lockKey: string): void {
    if (this.isClosed) return;
    this.driver.prepare('DELETE FROM parameter_locks WHERE lock_key = ?').run(lockKey);
  }

  public pruneExpiredParameterLocks(now = Date.now()): void {
    if (this.isClosed) return;
    this.driver.prepare('DELETE FROM parameter_locks WHERE expires_at < ?').run(now);
  }

  public loadActiveParameterLocks(now = Date.now()): Array<{ key: string; lock: ParameterLockPayload }> {
    if (this.isClosed) return [];
    this.pruneExpiredParameterLocks(now);
    const rows = this.driver
      .prepare('SELECT lock_key, payload_json FROM parameter_locks WHERE expires_at >= ? ORDER BY created_at ASC')
      .all(now);
    const result: Array<{ key: string; lock: ParameterLockPayload }> = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(String(row.payload_json)) as ParameterLockPayload;
        if (parsed && typeof parsed.paramKey === 'string') {
          result.push({ key: String(row.lock_key), lock: parsed });
        }
      } catch {
        // Ignore malformed row
      }
    }
    return result;
  }

  public pruneExpiredNotifications(now = Date.now()): void {
    if (this.isClosed) return;
    this.driver.prepare('DELETE FROM notifications WHERE expires_at < ?').run(now);
  }

  public syncCollections(params: {
    records: ServerExperimentRecord[];
    tasks: GroupTask[];
    notes: CollabNote[];
    students: StudentProgress[];
    notifications: ServerNotification[];
    now?: number;
    notificationTtlMs?: number;
  }): void {
    if (this.isClosed) return;
    const now = params.now ?? Date.now();
    const notifTtl = params.notificationTtlMs ?? DEFAULT_NOTIFICATION_TTL_MS;

    this.driver.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      this.driver.exec('DELETE FROM experiment_records;');
      const insertRecord = this.driver.prepare(`
        INSERT INTO experiment_records (id, room_id, group_id, domain, student_name, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      params.records.forEach((rec, index) => {
        insertRecord.run(
          rec.id,
          'LAB-ALPHA',
          rec.groupId,
          rec.domain,
          rec.studentName,
          now - index,
          JSON.stringify(rec)
        );
      });

      this.driver.exec('DELETE FROM group_tasks;');
      const insertTask = this.driver.prepare(`
        INSERT INTO group_tasks (id, room_id, group_id, domain, completed, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      params.tasks.forEach((task, index) => {
        insertTask.run(
          task.id,
          'LAB-ALPHA',
          task.groupId,
          task.domain,
          task.completed ? 1 : 0,
          now + index,
          JSON.stringify(task)
        );
      });

      this.driver.exec('DELETE FROM collab_notes;');
      const insertNote = this.driver.prepare(`
        INSERT INTO collab_notes (id, room_id, group_id, author, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      params.notes.forEach((note, index) => {
        insertNote.run(
          note.id,
          'LAB-ALPHA',
          note.groupId,
          note.author,
          now + index,
          JSON.stringify(note)
        );
      });

      this.driver.exec('DELETE FROM student_roster;');
      const insertStudent = this.driver.prepare(`
        INSERT INTO student_roster (id, room_id, group_id, name, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      params.students.forEach((stu, index) => {
        insertStudent.run(
          stu.id,
          'LAB-ALPHA',
          stu.groupId,
          stu.name,
          now + index,
          JSON.stringify(stu)
        );
      });

      this.driver.exec('DELETE FROM notifications;');
      const insertNotif = this.driver.prepare(`
        INSERT INTO notifications (id, room_id, severity, domain, created_at, expires_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      params.notifications.forEach((notif, index) => {
        const exp = (notif as ServerNotification & { expiresAt?: number }).expiresAt ?? now + notifTtl;
        if (exp >= now) {
          insertNotif.run(
            notif.id,
            'LAB-ALPHA',
            notif.severity,
            notif.domain,
            now - index,
            exp,
            JSON.stringify(notif)
          );
        }
      });

      this.driver.exec('COMMIT;');
    } catch (err) {
      try {
        this.driver.exec('ROLLBACK;');
      } catch {
        // Ignore rollback error
      }
      throw err;
    }
  }

  public loadCollections(now = Date.now()): {
    records: ServerExperimentRecord[];
    tasks: GroupTask[];
    notes: CollabNote[];
    students: StudentProgress[];
    notifications: ServerNotification[];
  } {
    if (this.isClosed) {
      return { records: [], tasks: [], notes: [], students: [], notifications: [] };
    }
    this.pruneExpiredNotifications(now);

    const parseRows = <T>(sql: string, ...args: unknown[]): T[] => {
      const rows = this.driver.prepare(sql).all(...args);
      const list: T[] = [];
      for (const row of rows) {
        try {
          list.push(JSON.parse(String(row.payload_json)) as T);
        } catch {
          // Ignore malformed row
        }
      }
      return list;
    };

    return {
      records: parseRows<ServerExperimentRecord>(
        'SELECT payload_json FROM experiment_records ORDER BY created_at DESC'
      ),
      tasks: parseRows<GroupTask>(
        'SELECT payload_json FROM group_tasks ORDER BY created_at ASC'
      ),
      notes: parseRows<CollabNote>(
        'SELECT payload_json FROM collab_notes ORDER BY created_at ASC'
      ),
      students: parseRows<StudentProgress>(
        'SELECT payload_json FROM student_roster ORDER BY created_at ASC'
      ),
      notifications: parseRows<ServerNotification>(
        'SELECT payload_json FROM notifications WHERE expires_at >= ? ORDER BY created_at DESC',
        now
      ),
    };
  }

  public close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    try {
      this.driver.close();
    } catch {
      // Ignore close error
    }
  }
}
