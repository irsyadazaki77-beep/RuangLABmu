import fs from 'fs';
import path from 'path';
import type { SqliteDatabaseDriver } from './database';
import { logger } from '../utils/logger';

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: string;
}

interface MigrationFileEntry {
  version: number;
  name: string;
  sql: string;
}

const MIGRATION_FILENAME_RE = /^(\d+)_(.+)\.sql$/i;

const FALLBACK_001_INITIAL_SCHEMA = `
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
`;

const FALLBACK_002_MULTITENANT_SCHEMA = `
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schools (id, name, slug, created_at)
VALUES ('default-school', 'Sekolah Default 3T', 'default-school', '2026-01-01T00:00:00.000Z');

ALTER TABLE rooms ADD COLUMN school_id TEXT NOT NULL DEFAULT 'default-school';
CREATE INDEX IF NOT EXISTS idx_rooms_school_id ON rooms(school_id);

ALTER TABLE gradebook_entries ADD COLUMN school_id TEXT NOT NULL DEFAULT 'default-school';
CREATE INDEX IF NOT EXISTS idx_gradebook_school_id ON gradebook_entries(school_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT NOT NULL,
  student_id TEXT,
  student_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  module_id TEXT NOT NULL,
  score REAL,
  payload_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_school_id
  ON submissions(school_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS autosaves (
  storage_key TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  student_id TEXT,
  version INTEGER NOT NULL,
  owner_token_hash TEXT,
  session_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_autosaves_school_id
  ON autosaves(school_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_school_endpoint
  ON idempotency_keys(school_id, endpoint);
`;

const FALLBACK_003_CONSOLIDATION_AUTH_AUDIT = `
CREATE TABLE IF NOT EXISTS lab_rooms_state (
  room_id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  pin_hash TEXT,
  state_json TEXT NOT NULL,
  last_activity_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_rooms_state_school ON lab_rooms_state(school_id, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS lab_records (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  student_name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  module_id TEXT,
  experiment_title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_records_school_created ON lab_records(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS group_tasks (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  group_id TEXT NOT NULL,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_by TEXT,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_tasks_school_updated ON group_tasks(school_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS collab_notes (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  group_id TEXT NOT NULL,
  author TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp_label TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collab_notes_school_created ON collab_notes(school_id, created_at ASC);

CREATE TABLE IF NOT EXISTS student_roster (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  active_domain TEXT NOT NULL,
  status TEXT NOT NULL,
  completion_pct REAL NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_student_roster_school ON student_roster(school_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  severity TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_school_expires ON notifications(school_id, expires_at, created_at DESC);

CREATE TABLE IF NOT EXISTS parameter_locks (
  lock_key TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  payload_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parameter_locks_expires ON parameter_locks(expires_at);

CREATE TABLE IF NOT EXISTS auth_credentials (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  role TEXT NOT NULL CHECK(role IN ('teacher', 'admin', 'student')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_credentials_school_role_user ON auth_credentials(school_id, role, username);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created ON audit_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(school_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_school_domain_module ON submissions(school_id, domain, module_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_school_room ON submissions(school_id, room_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_gradebook_school_room_submitted ON gradebook_entries(school_id, room_pin, submitted_at DESC);
`;

export function resolveMigrationsDirectory(explicitDir?: string): string | null {
  const candidates: string[] = [];
  if (explicitDir) {
    candidates.push(path.resolve(explicitDir));
  }
  candidates.push(
    path.join(process.cwd(), 'server', 'db', 'migrations'),
    path.join(path.dirname(process.execPath), 'server', 'db', 'migrations'),
    path.resolve(process.cwd(), 'migrations')
  );

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      // Ignore unreadable candidate path
    }
  }
  return null;
}

function loadMigrationEntries(explicitDir?: string): MigrationFileEntry[] {
  const resolvedDir = resolveMigrationsDirectory(explicitDir);
  if (!resolvedDir) {
    if (explicitDir) {
      throw new Error(`Direktori migrasi SQLite tidak ditemukan: ${explicitDir}`);
    }
    return [
      {
        version: 1,
        name: '001_initial_schema.sql',
        sql: FALLBACK_001_INITIAL_SCHEMA,
      },
      {
        version: 2,
        name: '002_multitenant_and_idempotency.sql',
        sql: FALLBACK_002_MULTITENANT_SCHEMA,
      },
      {
        version: 3,
        name: '003_consolidation_auth_audit.sql',
        sql: FALLBACK_003_CONSOLIDATION_AUTH_AUDIT,
      },
    ];
  }

  const files = fs.readdirSync(resolvedDir);
  const entries: MigrationFileEntry[] = [];

  for (const filename of files) {
    const match = MIGRATION_FILENAME_RE.exec(filename);
    if (!match) continue;
    const version = Number(match[1]);
    if (!Number.isInteger(version) || version <= 0) continue;
    const fullPath = path.join(resolvedDir, filename);
    if (!fs.statSync(fullPath).isFile()) continue;
    const sql = fs.readFileSync(fullPath, 'utf-8');
    entries.push({
      version,
      name: filename,
      sql,
    });
  }

  entries.sort((a, b) => a.version - b.version);
  return entries;
}

function getTableColumnNames(db: SqliteDatabaseDriver, tableName: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set(rows.map((r) => String(r.name)));
}

function tableExists(db: SqliteDatabaseDriver, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

const LEGACY_COLLIDING_TABLES = [
  'group_tasks',
  'collab_notes',
  'student_roster',
  'notifications',
  'parameter_locks',
] as const;

function stashLegacyTablesBeforeV3(db: SqliteDatabaseDriver): Set<string> {
  const stashed = new Set<string>();
  for (const table of LEGACY_COLLIDING_TABLES) {
    if (!tableExists(db, table)) continue;
    const cols = getTableColumnNames(db, table);
    if (!cols.has('school_id')) {
      const legacyName = `${table}_legacy_v2`;
      db.exec(`DROP TABLE IF EXISTS ${legacyName}; ALTER TABLE ${table} RENAME TO ${legacyName};`);
      stashed.add(table);
    }
  }
  return stashed;
}

function migrateLegacyTablesAfterV3(db: SqliteDatabaseDriver, stashed: Set<string>): void {
  const now = Date.now();
  const safeParse = (raw: unknown): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(String(raw || '{}'));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };

  if (stashed.has('group_tasks')) {
    const rows = db.prepare('SELECT id, room_id, group_id, domain, completed, created_at, payload_json FROM group_tasks_legacy_v2').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO group_tasks (id, school_id, room_id, group_id, title, domain, completed, completed_by, payload_json, updated_at)
       VALUES (?, 'default-school', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      const p = safeParse(row.payload_json);
      ins.run(
        String(row.id),
        row.room_id != null ? String(row.room_id) : null,
        String(row.group_id || p.groupId || 'Kelompok 1'),
        String(p.title || 'Tugas Praktikum'),
        String(row.domain || p.domain || 'Fisika'),
        Number(row.completed ? 1 : 0),
        typeof p.completedBy === 'string' ? p.completedBy : null,
        String(row.payload_json || '{}'),
        Number(row.created_at || now)
      );
    }
    db.exec('DROP TABLE IF EXISTS group_tasks_legacy_v2;');
  }

  if (stashed.has('collab_notes')) {
    const rows = db.prepare('SELECT id, room_id, group_id, author, created_at, payload_json FROM collab_notes_legacy_v2').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO collab_notes (id, school_id, room_id, group_id, author, role, text, timestamp_label, payload_json, created_at)
       VALUES (?, 'default-school', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      const p = safeParse(row.payload_json);
      ins.run(
        String(row.id),
        row.room_id != null ? String(row.room_id) : null,
        String(row.group_id || p.groupId || 'Kelompok 1'),
        String(row.author || p.author || 'Praktikan'),
        String(p.role || 'Siswa'),
        String(p.text || ''),
        String(p.timestamp || ''),
        String(row.payload_json || '{}'),
        Number(row.created_at || now)
      );
    }
    db.exec('DROP TABLE IF EXISTS collab_notes_legacy_v2;');
  }

  if (stashed.has('student_roster')) {
    const rows = db.prepare('SELECT id, room_id, group_id, name, created_at, payload_json FROM student_roster_legacy_v2').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO student_roster (id, school_id, room_id, name, group_id, active_domain, status, completion_pct, payload_json, updated_at)
       VALUES (?, 'default-school', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      const p = safeParse(row.payload_json);
      ins.run(
        String(row.id),
        row.room_id != null ? String(row.room_id) : null,
        String(row.name || p.name || 'Siswa'),
        String(row.group_id || p.groupId || 'Kelompok 1'),
        String(p.activeDomain || 'Fisika'),
        String(p.status || 'Nominal'),
        Number(p.completionPct ?? 0),
        String(row.payload_json || '{}'),
        Number(row.created_at || now)
      );
    }
    db.exec('DROP TABLE IF EXISTS student_roster_legacy_v2;');
  }

  if (stashed.has('notifications')) {
    const rows = db.prepare('SELECT id, room_id, severity, domain, created_at, expires_at, payload_json FROM notifications_legacy_v2').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO notifications (id, school_id, room_id, severity, domain, title, message, payload_json, expires_at, created_at)
       VALUES (?, 'default-school', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      const p = safeParse(row.payload_json);
      ins.run(
        String(row.id),
        row.room_id != null ? String(row.room_id) : null,
        String(row.severity || p.severity || 'nominal'),
        String(row.domain || p.domain || 'Fisika'),
        String(p.title || 'Notifikasi'),
        String(p.message || ''),
        String(row.payload_json || '{}'),
        Number.isFinite(Number(row.expires_at)) ? Number(row.expires_at) : now + 3600_000,
        Number(row.created_at || now)
      );
    }
    db.exec('DROP TABLE IF EXISTS notifications_legacy_v2;');
  }

  if (stashed.has('parameter_locks')) {
    const rows = db.prepare('SELECT lock_key, room_id, expires_at, payload_json FROM parameter_locks_legacy_v2').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO parameter_locks (lock_key, school_id, room_id, payload_json, expires_at)
       VALUES (?, 'default-school', ?, ?, ?)`
    );
    for (const row of rows) {
      ins.run(
        String(row.lock_key),
        row.room_id != null ? String(row.room_id) : null,
        String(row.payload_json || '{}'),
        Number.isFinite(Number(row.expires_at)) ? Number(row.expires_at) : now + 60_000
      );
    }
    db.exec('DROP TABLE IF EXISTS parameter_locks_legacy_v2;');
  }

  // Migrate legacy active_lab_rooms -> lab_rooms_state & experiment_records -> lab_records if present
  if (tableExists(db, 'active_lab_rooms')) {
    const rows = db.prepare('SELECT room_id, pin_hash, last_activity_at, payload_json FROM active_lab_rooms').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO lab_rooms_state (room_id, school_id, pin_hash, state_json, last_activity_at, updated_at)
       VALUES (?, 'default-school', ?, ?, ?, ?)`
    );
    for (const row of rows) {
      const lastAct = Number(row.last_activity_at || now);
      ins.run(
        String(row.room_id),
        row.pin_hash != null ? String(row.pin_hash) : null,
        String(row.payload_json || '{}'),
        lastAct,
        now
      );
    }
  }

  if (tableExists(db, 'experiment_records')) {
    const rows = db.prepare('SELECT id, room_id, group_id, domain, student_name, created_at, payload_json FROM experiment_records').all();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO lab_records (id, school_id, room_id, student_name, group_id, domain, module_id, experiment_title, payload_json, created_at)
       VALUES (?, 'default-school', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      const p = safeParse(row.payload_json);
      ins.run(
        String(row.id),
        row.room_id != null ? String(row.room_id) : null,
        String(row.student_name || p.studentName || 'Praktikan'),
        String(row.group_id || p.groupId || 'Kelompok 1'),
        String(row.domain || p.domain || 'Fisika'),
        typeof p.moduleId === 'string' ? p.moduleId : null,
        String(p.experimentTitle || 'Eksperimen'),
        String(row.payload_json || '{}'),
        Number(row.created_at || now)
      );
    }
  }
}

export function runMigrations(
  db: SqliteDatabaseDriver,
  migrationsDir?: string
): AppliedMigration[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all();
  const appliedVersions = new Set<number>(
    appliedRows.map((row) => Number(row.version))
  );

  const entries = loadMigrationEntries(migrationsDir);
  const newlyApplied: AppliedMigration[] = [];
  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const entry of entries) {
    if (appliedVersions.has(entry.version)) {
      continue;
    }

    const appliedAt = new Date().toISOString();
    const runSingleMigration = db.transaction(() => {
      const stashed =
        entry.version === 3 ? stashLegacyTablesBeforeV3(db) : new Set<string>();
      db.exec(entry.sql);
      if (entry.version === 3) {
        migrateLegacyTablesAfterV3(db, stashed);
      }
      insertMigration.run(entry.version, entry.name, appliedAt);
    });
    runSingleMigration();

    appliedVersions.add(entry.version);
    const appliedRecord: AppliedMigration = {
      version: entry.version,
      name: entry.name,
      appliedAt,
    };
    newlyApplied.push(appliedRecord);
    logger.info('Applied SQLite migration', {
      version: entry.version,
      name: entry.name,
    });
  }

  return newlyApplied;
}

export function listAppliedMigrations(db: SqliteDatabaseDriver): AppliedMigration[] {
  const rows = db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all();
  return rows.map((row) => ({
    version: Number(row.version),
    name: String(row.name),
    appliedAt: String(row.applied_at),
  }));
}
