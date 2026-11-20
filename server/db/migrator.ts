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
      db.exec(entry.sql);
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
