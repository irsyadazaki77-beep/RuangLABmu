/**
 * Persistent SQLite Database Layer (server/db/database.ts)
 * Uses `bun:sqlite` natively on Bun runtime with automatic fallback to `node:sqlite`
 * when executed under Node.js / tsx test runners.
 * Enforces WAL mode (`PRAGMA journal_mode = WAL;`) and relational integrity (`PRAGMA foreign_keys = ON;`).
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

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

export interface DbRoomRecord {
  pin: string;
  host_id: string;
  module_domain: string;
  status: string;
  created_at: number;
  expires_at: number;
}

export interface DbParticipantRecord {
  id: string;
  room_pin: string;
  display_name: string;
  role: 'teacher' | 'student';
  connected: number;
  last_seen: number;
}

export interface DbSimulationSnapshotRecord {
  id: number;
  room_pin: string;
  params_json: string;
  updated_at: number;
}

export interface DbGradebookEntryRecord {
  id: string;
  room_pin: string;
  student_id: string;
  student_name: string;
  module_id: string;
  score: number;
  rubric_json: string;
  submitted_at: number;
}

const DEFAULT_DB_FILE = path.join(process.cwd(), 'data', 'ruanglabmu.db');
const DEFAULT_ROOM_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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

export class RuangLabDatabase {
  public readonly db: SqliteDatabaseDriver;
  public readonly dbPath: string;

  private stmtUpsertRoom!: SqlitePreparedStatement;
  private stmtGetRoomByPin!: SqlitePreparedStatement;
  private stmtListActiveRooms!: SqlitePreparedStatement;
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
  private stmtListRoomGradebookEntries!: SqlitePreparedStatement;

  constructor(customDbPath?: string) {
    this.dbPath = customDbPath || process.env.RUANGLAB_DB_PATH || DEFAULT_DB_FILE;
    this.db = createSqliteDriver(this.dbPath);
    this.migrateSchema();
    this.prepareStatements();
  }

  private migrateSchema(): void {
    // 1. Check if legacy `rooms` table exists with `room_id` primary key instead of `pin` primary key.
    // We ensure the canonical `rooms` schema:
    // pin TEXT PRIMARY KEY, host_id TEXT NOT NULL, module_domain TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    const existingRoomsCols = this.db.prepare('PRAGMA table_info(rooms)').all();
    if (existingRoomsCols.length > 0) {
      const hasHostId = existingRoomsCols.some((c) => String(c.name) === 'host_id');
      if (!hasHostId) {
        // Migrate legacy rooms table safely
        this.db.exec('PRAGMA foreign_keys = OFF;');
        this.db.exec('DROP TABLE IF EXISTS rooms_legacy_backup;');
        this.db.exec('ALTER TABLE rooms RENAME TO rooms_legacy_backup;');
        this.db.exec('PRAGMA foreign_keys = ON;');
      }
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        pin TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        module_domain TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        room_pin TEXT NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
        connected INTEGER NOT NULL DEFAULT 1,
        last_seen INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_participants_room_pin ON participants(room_pin);

      CREATE TABLE IF NOT EXISTS simulation_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_pin TEXT NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,
        params_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_room_pin_updated
        ON simulation_snapshots(room_pin, updated_at DESC);

      CREATE TABLE IF NOT EXISTS gradebook_entries (
        id TEXT PRIMARY KEY,
        room_pin TEXT NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        module_id TEXT NOT NULL,
        score REAL NOT NULL,
        rubric_json TEXT NOT NULL,
        submitted_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_gradebook_room_pin
        ON gradebook_entries(room_pin, submitted_at DESC);
    `);

    // Ensure any incremental columns exist if upgrading an older database
    ensureColumnExists(this.db, 'rooms', 'host_id', "TEXT NOT NULL DEFAULT 'host'");
    ensureColumnExists(this.db, 'rooms', 'module_domain', "TEXT NOT NULL DEFAULT 'physics'");
    ensureColumnExists(this.db, 'rooms', 'status', "TEXT NOT NULL DEFAULT 'active'");
    ensureColumnExists(this.db, 'rooms', 'created_at', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumnExists(this.db, 'rooms', 'expires_at', 'INTEGER NOT NULL DEFAULT 0');
  }

  private prepareStatements(): void {
    this.stmtUpsertRoom = this.db.prepare(`
      INSERT INTO rooms (pin, host_id, module_domain, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(pin) DO UPDATE SET
        host_id = excluded.host_id,
        module_domain = excluded.module_domain,
        status = excluded.status,
        expires_at = excluded.expires_at
    `);

    this.stmtGetRoomByPin = this.db.prepare(`
      SELECT pin, host_id, module_domain, status, created_at, expires_at
      FROM rooms
      WHERE pin = ?
    `);

    this.stmtListActiveRooms = this.db.prepare(`
      SELECT pin, host_id, module_domain, status, created_at, expires_at
      FROM rooms
      WHERE expires_at >= ?
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
        id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        room_pin = excluded.room_pin,
        student_id = excluded.student_id,
        student_name = excluded.student_name,
        module_id = excluded.module_id,
        score = excluded.score,
        rubric_json = excluded.rubric_json,
        submitted_at = excluded.submitted_at
    `);

    this.stmtGetGradebookEntryById = this.db.prepare(`
      SELECT id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      WHERE id = ?
    `);

    this.stmtListAllGradebookEntries = this.db.prepare(`
      SELECT id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      ORDER BY submitted_at DESC
    `);

    this.stmtListRoomGradebookEntries = this.db.prepare(`
      SELECT id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      FROM gradebook_entries
      WHERE room_pin = ?
      ORDER BY submitted_at DESC
    `);
  }

  public isAvailable(): boolean {
    return Boolean(this.db);
  }

  public upsertRoom(input: {
    pin: string;
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
      host_id: String(input.hostId || input.host_id || 'host').trim(),
      module_domain: String(input.moduleDomain || input.module_domain || 'physics').trim(),
      status: String(input.status || 'active').trim(),
      created_at: createdAt,
      expires_at: expiresAt,
    };

    const tx = this.db.transaction((r: DbRoomRecord) => {
      this.stmtUpsertRoom.run(
        r.pin,
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
    fallbackHost: string = 'host'
  ): DbRoomRecord {
    const cleanPin = String(pin || 'DEFAULT').trim() || 'DEFAULT';
    const existing = this.getRoomByPin(cleanPin);
    if (existing) {
      return existing;
    }
    return this.upsertRoom({
      pin: cleanPin,
      hostId: fallbackHost,
      moduleDomain: fallbackDomain,
      status: 'active',
    });
  }

  public getRoomByPin(pin: string): DbRoomRecord | null {
    const row = this.stmtGetRoomByPin.get(String(pin).trim());
    if (!row) return null;
    return {
      pin: String(row.pin),
      host_id: String(row.host_id),
      module_domain: String(row.module_domain),
      status: String(row.status),
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
    };
  }

  public getRoom(pin: string): DbRoomRecord | null {
    return this.getRoomByPin(pin);
  }

  public listActiveRooms(now: number = Date.now()): DbRoomRecord[] {
    const rows = this.stmtListActiveRooms.all(now);
    return rows.map((row) => ({
      pin: String(row.pin),
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

  public getLatestSimulationSnapshot(roomPin: string): {
    id: number;
    roomPin: string;
    params: Record<string, unknown>;
    paramsJson: string;
    updatedAt: number;
  } | null {
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
    latestSnapshot: {
      id: number;
      roomPin: string;
      params: Record<string, unknown>;
      paramsJson: string;
      updatedAt: number;
    } | null;
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
    const submittedAt = input.submittedAt ?? input.submitted_at ?? Date.now();
    const record: DbGradebookEntryRecord = {
      id: String(input.id).trim(),
      room_pin: cleanPin,
      student_id: String(input.studentId || input.student_id || 'student-anon').trim(),
      student_name: String(input.studentName || input.student_name || 'Praktikan').trim(),
      module_id: String(input.moduleId || input.module_id || 'newton-incline').trim(),
      score: Number.isFinite(input.score) ? Number(input.score) : 0,
      rubric_json: String(input.rubricJson || input.rubric_json || '{}'),
      submitted_at: submittedAt,
    };

    const tx = this.db.transaction(() => {
      this.ensureRoomPinExists(cleanPin);
      this.stmtUpsertGradebookEntry.run(
        record.id,
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
      room_pin: String(row.room_pin),
      student_id: String(row.student_id),
      student_name: String(row.student_name),
      module_id: String(row.module_id),
      score: Number(row.score),
      rubric_json: String(row.rubric_json),
      submitted_at: Number(row.submitted_at),
    };
  }

  public listGradebookEntries(roomPin?: string): DbGradebookEntryRecord[] {
    const rows =
      roomPin && roomPin.trim().length > 0
        ? this.stmtListRoomGradebookEntries.all(roomPin.trim())
        : this.stmtListAllGradebookEntries.all();
    return rows.map((row) => ({
      id: String(row.id),
      room_pin: String(row.room_pin),
      student_id: String(row.student_id),
      student_name: String(row.student_name),
      module_id: String(row.module_id),
      score: Number(row.score),
      rubric_json: String(row.rubric_json),
      submitted_at: Number(row.submitted_at),
    }));
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // ignore close errors
    }
  }
}

let sharedDatabaseInstance: RuangLabDatabase | null = null;

export function getRuangLabDatabase(): RuangLabDatabase {
  if (!sharedDatabaseInstance) {
    sharedDatabaseInstance = new RuangLabDatabase();
  }
  return sharedDatabaseInstance;
}
