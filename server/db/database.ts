/**
 * Persistent SQLite Database Layer (server/db/database.ts)
 * Uses `bun:sqlite` natively on Bun runtime with automatic fallback to `node:sqlite`
 * when executed under Node.js / tsx test runners.
 * Enforces WAL mode (`PRAGMA journal_mode = WAL;`) and relational integrity (`PRAGMA foreign_keys = ON;`).
 * Implements the `LabRepository` interface via `SqliteLabRepository` (`RuangLabDatabase` alias).
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { runMigrations } from './migrator';
import {
  DEFAULT_SCHOOL_ID,
  type DbAutosaveRecord,
  type DbGradebookEntryRecord,
  type DbIdempotencyKeyRecord,
  type DbParticipantRecord,
  type DbRoomRecord,
  type DbSchoolRecord,
  type DbSimulationSnapshotRecord,
  type DbSubmissionRecord,
  type LabRepository,
  type SimulationSnapshotView,
} from './LabRepository';

export type {
  DbAutosaveRecord,
  DbGradebookEntryRecord,
  DbIdempotencyKeyRecord,
  DbParticipantRecord,
  DbRoomRecord,
  DbSchoolRecord,
  DbSimulationSnapshotRecord,
  DbSubmissionRecord,
  LabRepository,
  SimulationSnapshotView,
};

const requireModule = createRequire(path.resolve(process.cwd(), 'package.json'));

export interface SqlitePreparedStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Record<string, unknown> | undefined | null;
  all(...params: unknown[]): Array<Record<string, unknown>>;
}

export interface SqliteDatabaseDriver {
  exec(sql: string): void;
  prepare(sql: string): SqlitePreparedStatement;
  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
  ): (...args: TArgs) => TResult;
  close(): void;
}

const DEFAULT_DB_FILE = path.join(process.cwd(), 'data', 'ruanglabmu.db');
const DEFAULT_ROOM_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function normalizeSchoolId(schoolId?: string | null): string {
  const clean = typeof schoolId === 'string' ? schoolId.trim() : '';
  return clean || DEFAULT_SCHOOL_ID;
}

function createSqliteDriver(dbFilePath: string): SqliteDatabaseDriver {
  const isMemory = dbFilePath === ':memory:';
  if (!isMemory) {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const isBunRuntime =
    typeof (globalThis as Record<string, unknown>).Bun !== 'undefined';

  if (isBunRuntime) {
    // Native bun:sqlite initialization: import { Database } from "bun:sqlite"
    const { Database } = requireModule('bun:sqlite') as {
      Database: new (filename: string) => {
        exec(sql: string): void;
        prepare(sql: string): SqlitePreparedStatement;
        transaction<TArgs extends unknown[], TResult>(
          fn: (...args: TArgs) => TResult
        ): (...args: TArgs) => TResult;
        close(): void;
      };
    };
    const db = new Database(dbFilePath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    return db;
  }

  // Fallback for Node.js 22+ (`tsx server.ts` / `node --test`)
  const { DatabaseSync } = requireModule('node:sqlite') as {
    DatabaseSync: new (filename: string) => {
      exec(sql: string): void;
      prepare(sql: string): SqlitePreparedStatement;
      close(): void;
    };
  };
  const nodeDb = new DatabaseSync(dbFilePath);
  nodeDb.exec('PRAGMA journal_mode = WAL;');
  nodeDb.exec('PRAGMA foreign_keys = ON;');
  nodeDb.exec('PRAGMA synchronous = NORMAL;');
  nodeDb.exec('PRAGMA busy_timeout = 5000;');

  let txDepth = 0;
  return {
    exec: (sql: string) => nodeDb.exec(sql),
    prepare: (sql: string) => nodeDb.prepare(sql),
    transaction: <TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult
    ) => {
      return (...args: TArgs): TResult => {
        const isOuter = txDepth === 0;
        txDepth += 1;
        if (isOuter) {
          nodeDb.exec('BEGIN IMMEDIATE TRANSACTION;');
        }
        try {
          const result = fn(...args);
          if (isOuter) {
            nodeDb.exec('COMMIT;');
          }
          return result;
        } catch (err) {
          if (isOuter) {
            try {
              nodeDb.exec('ROLLBACK;');
            } catch {
              // ignore rollback error
            }
          }
          throw err;
        } finally {
          txDepth = Math.max(0, txDepth - 1);
        }
      };
    },
    close: () => nodeDb.close(),
  };
}

function ensureColumnExists(
  db: SqliteDatabaseDriver,
  tableName: string,
  columnName: string,
  columnDefSql: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((col) => String(col.name) === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefSql};`);
  }
}

export class SqliteLabRepository implements LabRepository {
  public readonly db: SqliteDatabaseDriver;
  public readonly dbPath: string;

  private stmtEnsureSchool!: SqlitePreparedStatement;
  private stmtGetSchoolById!: SqlitePreparedStatement;
  private stmtListSchools!: SqlitePreparedStatement;

  private stmtUpsertRoom!: SqlitePreparedStatement;
  private stmtGetRoomByPin!: SqlitePreparedStatement;
  private stmtGetRoomByPinScoped!: SqlitePreparedStatement;
  private stmtListActiveRooms!: SqlitePreparedStatement;
  private stmtListActiveRoomsBySchool!: SqlitePreparedStatement;
  private stmtDeleteRoomByPin!: SqlitePreparedStatement;
  private stmtPruneExpiredRooms!: SqlitePreparedStatement;

  private stmtUpsertParticipant!: SqlitePreparedStatement;
  private stmtGetParticipant!: SqlitePreparedStatement;
  private stmtListRoomParticipants!: SqlitePreparedStatement;
  private stmtSetParticipantConnected!: SqlitePreparedStatement;
  private stmtDeleteParticipant!: SqlitePreparedStatement;

  private stmtInsertSimulationSnapshot!: SqlitePreparedStatement;
  private stmtGetLatestSimulationSnapshot!: SqlitePreparedStatement;
  private stmtPruneOldSnapshotsForRoom!: SqlitePreparedStatement;

  private stmtUpsertGradebookEntry!: SqlitePreparedStatement;
  private stmtGetGradebookEntryById!: SqlitePreparedStatement;
  private stmtListAllGradebookEntries!: SqlitePreparedStatement;
  private stmtListGradebookEntriesBySchool!: SqlitePreparedStatement;
  private stmtListRoomGradebookEntries!: SqlitePreparedStatement;
  private stmtListRoomGradebookEntriesBySchool!: SqlitePreparedStatement;

  private stmtUpsertSubmission!: SqlitePreparedStatement;
  private stmtGetSubmissionById!: SqlitePreparedStatement;
  private stmtGetSubmissionByIdScoped!: SqlitePreparedStatement;
  private stmtListSubmissions!: SqlitePreparedStatement;
  private stmtListSubmissionsBySchool!: SqlitePreparedStatement;

  private stmtUpsertAutosave!: SqlitePreparedStatement;
  private stmtGetAutosaveByKey!: SqlitePreparedStatement;
  private stmtGetAutosaveByKeyScoped!: SqlitePreparedStatement;
  private stmtListAutosaves!: SqlitePreparedStatement;
  private stmtListAutosavesBySchool!: SqlitePreparedStatement;

  private stmtGetIdempotencyKey!: SqlitePreparedStatement;
  private stmtSaveIdempotencyKey!: SqlitePreparedStatement;

  constructor(customDbPath?: string) {
    this.dbPath = customDbPath || process.env.RUANGLAB_DB_PATH || DEFAULT_DB_FILE;
    this.db = createSqliteDriver(this.dbPath);
    this.migrateSchema();
    this.prepareStatements();
  }

  private migrateSchema(): void {
    // Check if legacy `rooms` table exists with `room_id` primary key instead of `pin` primary key.
    const existingRoomsCols = this.db.prepare('PRAGMA table_info(rooms)').all();
    if (existingRoomsCols.length > 0) {
      const hasHostId = existingRoomsCols.some((c) => String(c.name) === 'host_id');
      if (!hasHostId) {
        this.db.exec('PRAGMA foreign_keys = OFF;');
        this.db.exec('DROP TABLE IF EXISTS rooms_legacy_backup;');
        this.db.exec('ALTER TABLE rooms RENAME TO rooms_legacy_backup;');
        this.db.exec('PRAGMA foreign_keys = ON;');
      }
    }

    runMigrations(this.db);

    // Incremental safety-net columns if upgrading an older hand-rolled database
    ensureColumnExists(this.db, 'rooms', 'host_id', "TEXT NOT NULL DEFAULT 'host'");
    ensureColumnExists(this.db, 'rooms', 'module_domain', "TEXT NOT NULL DEFAULT 'physics'");
    ensureColumnExists(this.db, 'rooms', 'status', "TEXT NOT NULL DEFAULT 'active'");
    ensureColumnExists(this.db, 'rooms', 'created_at', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumnExists(this.db, 'rooms', 'expires_at', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumnExists(
      this.db,
      'rooms',
      'school_id',
      `TEXT NOT NULL DEFAULT '${DEFAULT_SCHOOL_ID}'`
    );
    ensureColumnExists(
      this.db,
      'gradebook_entries',
      'school_id',
      `TEXT NOT NULL DEFAULT '${DEFAULT_SCHOOL_ID}'`
    );
  }

  private prepareStatements(): void {
    this.stmtEnsureSchool = this.db.prepare(`
      INSERT OR IGNORE INTO schools (id, name, slug, created_at)
      VALUES (?, ?, ?, ?)
    `);

    this.stmtGetSchoolById = this.db.prepare(`
      SELECT id, name, slug, created_at
      FROM schools
      WHERE id = ?
    `);

    this.stmtListSchools = this.db.prepare(`
      SELECT id, name, slug, created_at
      FROM schools
      ORDER BY created_at ASC
    `);

    this.stmtUpsertRoom = this.db.prepare(`
      INSERT INTO rooms (pin, school_id, host_id, module_domain, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pin) DO UPDATE SET
        school_id = excluded.school_id,
        host_id = excluded.host_id,
        module_domain = excluded.module_domain,
        status = excluded.status,
        expires_at = excluded.expires_at
    `);

    this.stmtGetRoomByPin = this.db.prepare(`
      SELECT pin, school_id, host_id, module_domain, status, created_at, expires_at
      FROM rooms
      WHERE pin = ?
    `);

    this.stmtGetRoomByPinScoped = this.db.prepare(`
      SELECT pin, school_id, host_id, module_domain, status, created_at, expires_at
      FROM rooms
      WHERE pin = ? AND school_id = ?
    `);

    this.stmtListActiveRooms = this.db.prepare(`
      SELECT pin, school_id, host_id, module_domain, status, created_at, expires_at
      FROM rooms
      WHERE expires_at >= ?
      ORDER BY created_at DESC
    `);

    this.stmtListActiveRoomsBySchool = this.db.prepare(`
      SELECT pin, school_id, host_id, module_domain, status, created_at, expires_at
      FROM rooms
      WHERE expires_at >= ? AND school_id = ?
      ORDER BY created_at DESC
    `);

    this.stmtDeleteRoomByPin = this.db.prepare(`
      DELETE FROM rooms WHERE pin = ?
    `);

    this.stmtPruneExpiredRooms = this.db.prepare(`
      DELETE FROM rooms WHERE expires_at < ?
    `);

    this.stmtUpsertParticipant = this.db.prepare(`
      INSERT INTO participants (id, room_pin, display_name, role, connected, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        room_pin = excluded.room_pin,
        display_name = excluded.display_name,
        role = excluded.role,
        connected = excluded.connected,
        last_seen = excluded.last_seen
    `);

    this.stmtGetParticipant = this.db.prepare(`
      SELECT id, room_pin, display_name, role, connected, last_seen
      FROM participants
      WHERE id = ? AND room_pin = ?
    `);

    this.stmtListRoomParticipants = this.db.prepare(`
      SELECT id, room_pin, display_name, role, connected, last_seen
      FROM participants
      WHERE room_pin = ?
      ORDER BY last_seen DESC
    `);

    this.stmtSetParticipantConnected = this.db.prepare(`
      UPDATE participants
      SET connected = ?, last_seen = ?
      WHERE id = ? AND room_pin = ?
    `);

    this.stmtDeleteParticipant = this.db.prepare(`
      DELETE FROM participants WHERE id = ? AND room_pin = ?
    `);

    this.stmtInsertSimulationSnapshot = this.db.prepare(`
      INSERT INTO simulation_snapshots (room_pin, params_json, updated_at)
      VALUES (?, ?, ?)
    `);

    this.stmtGetLatestSimulationSnapshot = this.db.prepare(`
      SELECT id, room_pin, params_json, updated_at
      FROM simulation_snapshots
      WHERE room_pin = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);

    this.stmtPruneOldSnapshotsForRoom = this.db.prepare(`
      DELETE FROM simulation_snapshots
      WHERE room_pin = ?
        AND id NOT IN (
          SELECT id FROM simulation_snapshots
          WHERE room_pin = ?
          ORDER BY updated_at DESC, id DESC
          LIMIT 25
        )
    `);

    this.stmtUpsertGradebookEntry = this.db.prepare(`
      INSERT INTO gradebook_entries (
        id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        school_id = excluded.school_id,
        room_pin = excluded.room_pin,
        student_id = excluded.student_id,
        student_name = excluded.student_name,
        module_id = excluded.module_id,
        score = excluded.score,
        rubric_json = excluded.rubric_json,
        submitted_at = excluded.submitted_at
    `);

    this.stmtGetGradebookEntryById = this.db.prepare(`
      SELECT id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      WHERE id = ?
    `);

    this.stmtListAllGradebookEntries = this.db.prepare(`
      SELECT id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      ORDER BY submitted_at DESC
    `);

    this.stmtListGradebookEntriesBySchool = this.db.prepare(`
      SELECT id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      WHERE school_id = ?
      ORDER BY submitted_at DESC
    `);

    this.stmtListRoomGradebookEntries = this.db.prepare(`
      SELECT id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      WHERE room_pin = ?
      ORDER BY submitted_at DESC
    `);

    this.stmtListRoomGradebookEntriesBySchool = this.db.prepare(`
      SELECT id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      WHERE room_pin = ? AND school_id = ?
      ORDER BY submitted_at DESC
    `);

    this.stmtUpsertSubmission = this.db.prepare(`
      INSERT INTO submissions (
        id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        school_id = excluded.school_id,
        room_id = excluded.room_id,
        student_id = excluded.student_id,
        student_name = excluded.student_name,
        domain = excluded.domain,
        module_id = excluded.module_id,
        score = excluded.score,
        payload_json = excluded.payload_json,
        submitted_at = excluded.submitted_at
    `);

    this.stmtGetSubmissionById = this.db.prepare(`
      SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
      FROM submissions
      WHERE id = ?
    `);

    this.stmtGetSubmissionByIdScoped = this.db.prepare(`
      SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
      FROM submissions
      WHERE id = ? AND school_id = ?
    `);

    this.stmtListSubmissions = this.db.prepare(`
      SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
      FROM submissions
      ORDER BY submitted_at DESC
    `);

    this.stmtListSubmissionsBySchool = this.db.prepare(`
      SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
      FROM submissions
      WHERE school_id = ?
      ORDER BY submitted_at DESC
    `);

    this.stmtUpsertAutosave = this.db.prepare(`
      INSERT INTO autosaves (
        storage_key, school_id, student_id, version, owner_token_hash, session_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(storage_key) DO UPDATE SET
        school_id = excluded.school_id,
        student_id = excluded.student_id,
        version = excluded.version,
        owner_token_hash = excluded.owner_token_hash,
        session_json = excluded.session_json,
        updated_at = excluded.updated_at
    `);

    this.stmtGetAutosaveByKey = this.db.prepare(`
      SELECT storage_key, school_id, student_id, version, owner_token_hash, session_json, updated_at
      FROM autosaves
      WHERE storage_key = ?
    `);

    this.stmtGetAutosaveByKeyScoped = this.db.prepare(`
      SELECT storage_key, school_id, student_id, version, owner_token_hash, session_json, updated_at
      FROM autosaves
      WHERE storage_key = ? AND school_id = ?
    `);

    this.stmtListAutosaves = this.db.prepare(`
      SELECT storage_key, school_id, student_id, version, owner_token_hash, session_json, updated_at
      FROM autosaves
      ORDER BY updated_at DESC
    `);

    this.stmtListAutosavesBySchool = this.db.prepare(`
      SELECT storage_key, school_id, student_id, version, owner_token_hash, session_json, updated_at
      FROM autosaves
      WHERE school_id = ?
      ORDER BY updated_at DESC
    `);

    this.stmtGetIdempotencyKey = this.db.prepare(`
      SELECT key, school_id, endpoint, response_json, created_at
      FROM idempotency_keys
      WHERE key = ? AND school_id = ? AND endpoint = ?
    `);

    this.stmtSaveIdempotencyKey = this.db.prepare(`
      INSERT OR IGNORE INTO idempotency_keys (key, school_id, endpoint, response_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
  }

  public isAvailable(): boolean {
    return Boolean(this.db);
  }

  public ensureSchool(input: {
    id: string;
    name?: string;
    slug?: string;
    createdAt?: string;
  }): DbSchoolRecord {
    const id = normalizeSchoolId(input.id);
    const slug = (input.slug || id).trim().toLowerCase();
    const name = (input.name || `Sekolah ${id}`).trim();
    const createdAt = input.createdAt || new Date().toISOString();
    this.stmtEnsureSchool.run(id, name, slug, createdAt);
    return this.getSchoolById(id) ?? { id, name, slug, created_at: createdAt };
  }

  public getSchoolById(id: string): DbSchoolRecord | null {
    const row = this.stmtGetSchoolById.get(normalizeSchoolId(id));
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      created_at: String(row.created_at),
    };
  }

  public listSchools(): DbSchoolRecord[] {
    return this.stmtListSchools.all().map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      created_at: String(row.created_at),
    }));
  }

  public upsertRoom(input: {
    pin: string;
    schoolId?: string;
    school_id?: string;
    hostId?: string;
    host_id?: string;
    moduleDomain?: string;
    module_domain?: string;
    status?: string;
    createdAt?: number;
    created_at?: number;
    expiresAt?: number;
    expires_at?: number;
  }): DbRoomRecord {
    const now = Date.now();
    const createdAt = input.createdAt ?? input.created_at ?? now;
    const expiresAt = input.expiresAt ?? input.expires_at ?? createdAt + DEFAULT_ROOM_TTL_MS;
    const record: DbRoomRecord = {
      pin: String(input.pin).trim(),
      school_id: normalizeSchoolId(input.schoolId ?? input.school_id),
      host_id: String(input.hostId || input.host_id || 'host').trim(),
      module_domain: String(input.moduleDomain || input.module_domain || 'physics').trim(),
      status: String(input.status || 'active').trim(),
      created_at: createdAt,
      expires_at: expiresAt,
    };

    const tx = this.db.transaction((r: DbRoomRecord) => {
      this.stmtUpsertRoom.run(
        r.pin,
        r.school_id,
        r.host_id,
        r.module_domain,
        r.status,
        r.created_at,
        r.expires_at
      );
    });
    tx(record);
    return record;
  }

  public ensureRoomPinExists(
    pin: string,
    fallbackDomain: string = 'physics',
    fallbackHost: string = 'host',
    schoolId: string = DEFAULT_SCHOOL_ID
  ): DbRoomRecord {
    const cleanPin = String(pin || 'DEFAULT').trim() || 'DEFAULT';
    const existing = this.getRoomByPin(cleanPin);
    if (existing) {
      return existing;
    }
    return this.upsertRoom({
      pin: cleanPin,
      schoolId: normalizeSchoolId(schoolId),
      hostId: fallbackHost,
      moduleDomain: fallbackDomain,
      status: 'active',
    });
  }

  public getRoomByPin(pin: string, schoolId?: string): DbRoomRecord | null {
    const row = schoolId
      ? this.stmtGetRoomByPinScoped.get(String(pin).trim(), normalizeSchoolId(schoolId))
      : this.stmtGetRoomByPin.get(String(pin).trim());
    if (!row) return null;
    return {
      pin: String(row.pin),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      host_id: String(row.host_id),
      module_domain: String(row.module_domain),
      status: String(row.status),
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
    };
  }

  public getRoom(pin: string, schoolId?: string): DbRoomRecord | null {
    return this.getRoomByPin(pin, schoolId);
  }

  public listActiveRooms(now: number = Date.now(), schoolId?: string): DbRoomRecord[] {
    const rows = schoolId
      ? this.stmtListActiveRoomsBySchool.all(now, normalizeSchoolId(schoolId))
      : this.stmtListActiveRooms.all(now);
    return rows.map((row) => ({
      pin: String(row.pin),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      host_id: String(row.host_id),
      module_domain: String(row.module_domain),
      status: String(row.status),
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
    }));
  }

  public deleteRoomByPin(pin: string): void {
    this.stmtDeleteRoomByPin.run(String(pin).trim());
  }

  public pruneExpiredRooms(now: number = Date.now()): number {
    const beforeCount = this.db
      .prepare('SELECT COUNT(*) as cnt FROM rooms WHERE expires_at < ?')
      .get(now);
    const count = Number(beforeCount?.cnt ?? 0);
    if (count > 0) {
      this.stmtPruneExpiredRooms.run(now);
    }
    return count;
  }

  public upsertParticipant(input: {
    id: string;
    roomPin?: string;
    room_pin?: string;
    displayName?: string;
    display_name?: string;
    role: 'teacher' | 'student';
    connected?: boolean | number;
    lastSeen?: number;
    last_seen?: number;
  }): DbParticipantRecord {
    const now = input.lastSeen ?? input.last_seen ?? Date.now();
    const role: 'teacher' | 'student' = input.role === 'teacher' ? 'teacher' : 'student';
    const connected = input.connected === false || input.connected === 0 ? 0 : 1;
    const roomPin = String(input.roomPin || input.room_pin || '').trim();
    const displayName = String(input.displayName || input.display_name || 'Praktikan').trim();

    const tx = this.db.transaction(() => {
      this.ensureRoomPinExists(roomPin, 'physics', role === 'teacher' ? displayName : 'host');
      this.stmtUpsertParticipant.run(
        String(input.id).trim(),
        roomPin,
        displayName,
        role,
        connected,
        now
      );
    });
    tx();

    return {
      id: String(input.id).trim(),
      room_pin: roomPin,
      display_name: displayName,
      role,
      connected,
      last_seen: now,
    };
  }

  public getParticipant(roomPin: string, participantId: string): DbParticipantRecord | null {
    const row = this.stmtGetParticipant.get(
      String(participantId).trim(),
      String(roomPin).trim()
    );
    if (!row) return null;
    return {
      id: String(row.id),
      room_pin: String(row.room_pin),
      display_name: String(row.display_name),
      role: String(row.role) === 'teacher' ? 'teacher' : 'student',
      connected: Number(row.connected),
      last_seen: Number(row.last_seen),
    };
  }

  public listRoomParticipants(roomPin: string): DbParticipantRecord[] {
    const rows = this.stmtListRoomParticipants.all(String(roomPin).trim());
    return rows.map((row) => ({
      id: String(row.id),
      room_pin: String(row.room_pin),
      display_name: String(row.display_name),
      role: String(row.role) === 'teacher' ? 'teacher' : 'student',
      connected: Number(row.connected),
      last_seen: Number(row.last_seen),
    }));
  }

  public listParticipantsByRoom(roomPin: string): DbParticipantRecord[] {
    return this.listRoomParticipants(roomPin);
  }

  public setParticipantConnected(
    roomPin: string,
    participantId: string,
    connected: boolean,
    now: number = Date.now()
  ): void {
    this.stmtSetParticipantConnected.run(
      connected ? 1 : 0,
      now,
      String(participantId).trim(),
      String(roomPin).trim()
    );
  }

  public markParticipantConnection(
    roomPin: string,
    participantId: string,
    connected: boolean,
    now: number = Date.now()
  ): void {
    this.setParticipantConnected(roomPin, participantId, connected, now);
  }

  public removeParticipant(roomPin: string, participantId: string): void {
    this.stmtDeleteParticipant.run(String(participantId).trim(), String(roomPin).trim());
  }

  public saveSimulationSnapshot(
    roomPin: string,
    params: Record<string, unknown>,
    updatedAt: number = Date.now()
  ): DbSimulationSnapshotRecord {
    const cleanPin = String(roomPin).trim();
    const paramsJson = JSON.stringify(params ?? {});

    const tx = this.db.transaction(() => {
      this.ensureRoomPinExists(cleanPin);
      this.stmtInsertSimulationSnapshot.run(cleanPin, paramsJson, updatedAt);
      this.stmtPruneOldSnapshotsForRoom.run(cleanPin, cleanPin);
      return this.stmtGetLatestSimulationSnapshot.get(cleanPin);
    });

    const row = tx();
    return {
      id: Number(row?.id ?? 0),
      room_pin: cleanPin,
      params_json: String(row?.params_json ?? paramsJson),
      updated_at: Number(row?.updated_at ?? updatedAt),
    };
  }

  public getLatestSimulationSnapshot(roomPin: string): SimulationSnapshotView | null {
    const row = this.stmtGetLatestSimulationSnapshot.get(String(roomPin).trim());
    if (!row) return null;
    const paramsJson = String(row.params_json || '{}');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(paramsJson) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    return {
      id: Number(row.id),
      roomPin: String(row.room_pin),
      params: parsed,
      paramsJson,
      updatedAt: Number(row.updated_at),
    };
  }

  /**
   * Unstable 3T Reconnect Recovery transaction:
   * Restores participant session (`connected = 1`, `last_seen = now`) and returns the room record,
   * participant record, and latest `simulation_snapshots` payload atomically.
   */
  public rejoinParticipantSession(
    roomPin: string,
    participantId: string,
    now: number = Date.now()
  ): {
    room: DbRoomRecord;
    participant: DbParticipantRecord;
    latestSnapshot: SimulationSnapshotView | null;
  } | null {
    const cleanPin = String(roomPin).trim();
    const cleanParticipantId = String(participantId).trim();

    const tx = this.db.transaction(() => {
      const room = this.getRoomByPin(cleanPin);
      if (!room || room.expires_at < now) {
        return null;
      }

      let participant = this.getParticipant(cleanPin, cleanParticipantId);
      if (participant) {
        this.stmtSetParticipantConnected.run(1, now, cleanParticipantId, cleanPin);
        participant = {
          ...participant,
          connected: 1,
          last_seen: now,
        };
      } else {
        participant = this.upsertParticipant({
          id: cleanParticipantId,
          roomPin: cleanPin,
          displayName: 'Praktikan 3T',
          role: 'student',
          connected: true,
          lastSeen: now,
        });
      }

      const latestSnapshot = this.getLatestSimulationSnapshot(cleanPin);
      return {
        room,
        participant,
        latestSnapshot,
      };
    });

    return tx();
  }

  public upsertGradebookEntry(input: {
    id: string;
    schoolId?: string;
    school_id?: string;
    roomPin?: string;
    room_pin?: string;
    studentId?: string;
    student_id?: string;
    studentName?: string;
    student_name?: string;
    moduleId?: string;
    module_id?: string;
    score: number;
    rubricJson?: string;
    rubric_json?: string;
    submittedAt?: number;
    submitted_at?: number;
  }): DbGradebookEntryRecord {
    const cleanPin = String(input.roomPin || input.room_pin || 'MANDIRI').trim() || 'MANDIRI';
    const schoolId = normalizeSchoolId(input.schoolId ?? input.school_id);
    const submittedAt = input.submittedAt ?? input.submitted_at ?? Date.now();
    const record: DbGradebookEntryRecord = {
      id: String(input.id).trim(),
      school_id: schoolId,
      room_pin: cleanPin,
      student_id: String(input.studentId || input.student_id || 'student-anon').trim(),
      student_name: String(input.studentName || input.student_name || 'Praktikan').trim(),
      module_id: String(input.moduleId || input.module_id || 'newton-incline').trim(),
      score: Number.isFinite(input.score) ? Number(input.score) : 0,
      rubric_json: String(input.rubricJson || input.rubric_json || '{}'),
      submitted_at: submittedAt,
    };

    const tx = this.db.transaction(() => {
      this.ensureRoomPinExists(cleanPin, 'physics', 'host', schoolId);
      this.stmtUpsertGradebookEntry.run(
        record.id,
        record.school_id,
        record.room_pin,
        record.student_id,
        record.student_name,
        record.module_id,
        record.score,
        record.rubric_json,
        record.submitted_at
      );
    });
    tx();

    return record;
  }

  public getGradebookEntryById(id: string): DbGradebookEntryRecord | null {
    const row = this.stmtGetGradebookEntryById.get(String(id).trim());
    if (!row) return null;
    return {
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      room_pin: String(row.room_pin),
      student_id: String(row.student_id),
      student_name: String(row.student_name),
      module_id: String(row.module_id),
      score: Number(row.score),
      rubric_json: String(row.rubric_json),
      submitted_at: Number(row.submitted_at),
    };
  }

  public listGradebookEntries(roomPin?: string, schoolId?: string): DbGradebookEntryRecord[] {
    const cleanPin = roomPin && roomPin.trim().length > 0 ? roomPin.trim() : undefined;
    const cleanSchool = schoolId && schoolId.trim().length > 0 ? schoolId.trim() : undefined;

    const rows = cleanPin && cleanSchool
      ? this.stmtListRoomGradebookEntriesBySchool.all(cleanPin, cleanSchool)
      : cleanPin
        ? this.stmtListRoomGradebookEntries.all(cleanPin)
        : cleanSchool
          ? this.stmtListGradebookEntriesBySchool.all(cleanSchool)
          : this.stmtListAllGradebookEntries.all();

    return rows.map((row) => ({
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      room_pin: String(row.room_pin),
      student_id: String(row.student_id),
      student_name: String(row.student_name),
      module_id: String(row.module_id),
      score: Number(row.score),
      rubric_json: String(row.rubric_json),
      submitted_at: Number(row.submitted_at),
    }));
  }

  public upsertSubmission(input: {
    id: string;
    schoolId?: string;
    roomId: string;
    studentId?: string | null;
    studentName: string;
    domain: string;
    moduleId: string;
    score?: number | null;
    payloadJson: string;
    submittedAt: string;
  }): DbSubmissionRecord {
    const record: DbSubmissionRecord = {
      id: String(input.id).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      room_id: String(input.roomId || 'LAB-ALPHA').trim(),
      student_id: input.studentId ? String(input.studentId).trim() : null,
      student_name: String(input.studentName).trim(),
      domain: String(input.domain || 'Fisika').trim(),
      module_id: String(input.moduleId).trim(),
      score: typeof input.score === 'number' && Number.isFinite(input.score) ? input.score : null,
      payload_json: String(input.payloadJson),
      submitted_at: String(input.submittedAt),
    };

    const tx = this.db.transaction(() => {
      this.stmtUpsertSubmission.run(
        record.id,
        record.school_id,
        record.room_id,
        record.student_id,
        record.student_name,
        record.domain,
        record.module_id,
        record.score,
        record.payload_json,
        record.submitted_at
      );
    });
    tx();
    return record;
  }

  public getSubmissionById(id: string, schoolId?: string): DbSubmissionRecord | null {
    const row = schoolId
      ? this.stmtGetSubmissionByIdScoped.get(String(id).trim(), normalizeSchoolId(schoolId))
      : this.stmtGetSubmissionById.get(String(id).trim());
    if (!row) return null;
    return {
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      room_id: String(row.room_id),
      student_id: row.student_id != null ? String(row.student_id) : null,
      student_name: String(row.student_name),
      domain: String(row.domain),
      module_id: String(row.module_id),
      score: row.score != null ? Number(row.score) : null,
      payload_json: String(row.payload_json),
      submitted_at: String(row.submitted_at),
    };
  }

  public listSubmissions(schoolId?: string): DbSubmissionRecord[] {
    const rows =
      schoolId && schoolId.trim().length > 0
        ? this.stmtListSubmissionsBySchool.all(schoolId.trim())
        : this.stmtListSubmissions.all();
    return rows.map((row) => ({
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      room_id: String(row.room_id),
      student_id: row.student_id != null ? String(row.student_id) : null,
      student_name: String(row.student_name),
      domain: String(row.domain),
      module_id: String(row.module_id),
      score: row.score != null ? Number(row.score) : null,
      payload_json: String(row.payload_json),
      submitted_at: String(row.submitted_at),
    }));
  }

  public upsertAutosave(input: {
    storageKey: string;
    schoolId?: string;
    studentId?: string | null;
    version: number;
    ownerTokenHash?: string | null;
    sessionJson: string;
    updatedAt?: number;
  }): DbAutosaveRecord {
    const record: DbAutosaveRecord = {
      storage_key: String(input.storageKey).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      student_id: input.studentId ? String(input.studentId).trim() : null,
      version: Number(input.version),
      owner_token_hash: input.ownerTokenHash ? String(input.ownerTokenHash) : null,
      session_json: String(input.sessionJson),
      updated_at: input.updatedAt ?? Date.now(),
    };

    const tx = this.db.transaction(() => {
      this.stmtUpsertAutosave.run(
        record.storage_key,
        record.school_id,
        record.student_id,
        record.version,
        record.owner_token_hash,
        record.session_json,
        record.updated_at
      );
    });
    tx();
    return record;
  }

  public getAutosaveByKey(storageKey: string, schoolId?: string): DbAutosaveRecord | null {
    const row = schoolId
      ? this.stmtGetAutosaveByKeyScoped.get(String(storageKey).trim(), normalizeSchoolId(schoolId))
      : this.stmtGetAutosaveByKey.get(String(storageKey).trim());
    if (!row) return null;
    return {
      storage_key: String(row.storage_key),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      student_id: row.student_id != null ? String(row.student_id) : null,
      version: Number(row.version),
      owner_token_hash: row.owner_token_hash != null ? String(row.owner_token_hash) : null,
      session_json: String(row.session_json),
      updated_at: Number(row.updated_at),
    };
  }

  public listAutosaves(schoolId?: string): DbAutosaveRecord[] {
    const rows =
      schoolId && schoolId.trim().length > 0
        ? this.stmtListAutosavesBySchool.all(schoolId.trim())
        : this.stmtListAutosaves.all();
    return rows.map((row) => ({
      storage_key: String(row.storage_key),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      student_id: row.student_id != null ? String(row.student_id) : null,
      version: Number(row.version),
      owner_token_hash: row.owner_token_hash != null ? String(row.owner_token_hash) : null,
      session_json: String(row.session_json),
      updated_at: Number(row.updated_at),
    }));
  }

  public getIdempotencyKey(
    key: string,
    schoolId: string,
    endpoint: string
  ): DbIdempotencyKeyRecord | null {
    const cleanKey = String(key || '').trim();
    if (!cleanKey) return null;
    const row = this.stmtGetIdempotencyKey.get(
      cleanKey,
      normalizeSchoolId(schoolId),
      String(endpoint).trim()
    );
    if (!row) return null;
    return {
      key: String(row.key),
      school_id: normalizeSchoolId(row.school_id as string | undefined),
      endpoint: String(row.endpoint),
      response_json: String(row.response_json),
      created_at: String(row.created_at),
    };
  }

  public saveIdempotencyKey(input: {
    key: string;
    schoolId: string;
    endpoint: string;
    responseJson: string;
    createdAt?: string;
  }): DbIdempotencyKeyRecord {
    const record: DbIdempotencyKeyRecord = {
      key: String(input.key).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      endpoint: String(input.endpoint).trim(),
      response_json: String(input.responseJson),
      created_at: input.createdAt || new Date().toISOString(),
    };
    this.stmtSaveIdempotencyKey.run(
      record.key,
      record.school_id,
      record.endpoint,
      record.response_json,
      record.created_at
    );
    return record;
  }

  public checkpointWalTruncate(): void {
    if (this.dbPath === ':memory:') return;
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Ignore checkpoint error on closing or read-only filesystems
    }
  }

  public backupDatabase(destPath: string): string {
    return backupDatabase(this.db, destPath);
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // ignore close errors
    }
  }
}

export class RuangLabDatabase extends SqliteLabRepository {}

export function backupDatabase(
  source: SqliteDatabaseDriver | SqliteLabRepository,
  destPath: string
): string {
  const driver = source instanceof SqliteLabRepository ? source.db : source;
  const resolvedDest = path.resolve(String(destPath || '').trim());
  if (!resolvedDest) {
    throw new Error('Path tujuan backup database SQLite wajib diisi.');
  }
  const destDir = path.dirname(resolvedDest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  if (fs.existsSync(resolvedDest)) {
    fs.unlinkSync(resolvedDest);
  }
  driver.prepare('VACUUM INTO ?').run(resolvedDest);
  return resolvedDest;
}

let sharedDatabaseInstance: RuangLabDatabase | null = null;

export function getRuangLabDatabase(): RuangLabDatabase {
  if (!sharedDatabaseInstance) {
    sharedDatabaseInstance = new RuangLabDatabase();
  }
  return sharedDatabaseInstance;
}
