-- 001_initial_schema.sql
-- RuangLABmu Core Relational Schema (Rooms, 3T Participants, Simulation Snapshots, Gradebook)

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
