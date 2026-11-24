-- 003_consolidation_auth_audit.sql
-- Consolidates legacy JSON & KV stores into single relational schema,
-- adds offline-ready auth credentials, immutable audit_logs, and pagination indexes.

CREATE TABLE IF NOT EXISTS lab_rooms_state (
  room_id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  pin_hash TEXT,
  state_json TEXT NOT NULL,
  last_activity_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lab_rooms_state_school
  ON lab_rooms_state(school_id, last_activity_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_lab_records_school_created
  ON lab_records(school_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_group_tasks_school_updated
  ON group_tasks(school_id, updated_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_collab_notes_school_created
  ON collab_notes(school_id, created_at ASC);

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

CREATE INDEX IF NOT EXISTS idx_student_roster_school
  ON student_roster(school_id, updated_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_notifications_school_expires
  ON notifications(school_id, expires_at, created_at DESC);

CREATE TABLE IF NOT EXISTS parameter_locks (
  lock_key TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT,
  payload_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parameter_locks_expires
  ON parameter_locks(expires_at);

CREATE TABLE IF NOT EXISTS auth_credentials (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  role TEXT NOT NULL CHECK(role IN ('teacher', 'admin', 'student')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_credentials_school_role_user
  ON auth_credentials(school_id, role, username);

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created
  ON audit_logs(school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(school_id, action, created_at DESC);

-- Composite pagination & filtering indexes for submissions & gradebook
CREATE INDEX IF NOT EXISTS idx_submissions_school_domain_module
  ON submissions(school_id, domain, module_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_school_room
  ON submissions(school_id, room_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_gradebook_school_room_submitted
  ON gradebook_entries(school_id, room_pin, submitted_at DESC);
