-- 002_multitenant_and_idempotency.sql
-- Multi-tenant school_id isolation, durable submissions/autosaves tables, and idempotency_keys

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
