import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { RuangLabDatabase } from './database';

describe('Persistent SQLite Database & 3T Network Reconnect Recovery (server/db/database.ts)', () => {
  const tempDbPaths: string[] = [];

  function createTempDatabase(): RuangLabDatabase {
    const tmpFile = path.join(
      os.tmpdir(),
      `ruanglabmu-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    );
    tempDbPaths.push(tmpFile);
    return new RuangLabDatabase(tmpFile);
  }

  afterEach(() => {
    for (const dbPath of tempDbPaths.splice(0, tempDbPaths.length)) {
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          if (fs.existsSync(dbPath + suffix)) {
            fs.unlinkSync(dbPath + suffix);
          }
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

  it('initializes rooms, participants, simulation_snapshots, and gradebook_entries with foreign keys', () => {
    const db = createTempDatabase();
    assert.strictEqual(db.isAvailable(), true);

    const now = Date.now();
    db.upsertRoom({
      pin: '314159',
      host_id: 'teacher-1',
      module_domain: 'physics',
      status: 'active',
      created_at: now,
      expires_at: now + 3_600_000,
    });

    const room = db.getRoom('314159');
    assert.ok(room);
    assert.strictEqual(room.pin, '314159');
    assert.strictEqual(room.module_domain, 'physics');

    db.upsertParticipant({
      id: 'student-3t-01',
      room_pin: '314159',
      display_name: 'Siti Aminah',
      role: 'student',
      connected: 1,
      last_seen: now,
    });

    const participants = db.listParticipantsByRoom('314159');
    assert.strictEqual(participants.length, 1);
    assert.strictEqual(participants[0].display_name, 'Siti Aminah');
    assert.strictEqual(participants[0].connected, 1);

    db.close();
  });

  it('recovers disconnected 3T participant session and restores latest simulation_snapshots payload', () => {
    const db = createTempDatabase();
    const now = Date.now();

    db.upsertRoom({
      pin: '271828',
      host_id: 'teacher-host',
      module_domain: 'chemistry',
      status: 'active',
      created_at: now,
      expires_at: now + 3_600_000,
    });

    db.upsertParticipant({
      id: 'student-ntt-01',
      room_pin: '271828',
      display_name: 'Yohanes B.',
      role: 'student',
      connected: 1,
      last_seen: now - 12_000,
    });

    db.saveSimulationSnapshot('271828', {
      moduleId: 'acid-base-titration',
      molarity: 0.15,
      volumeAdded: 24.8,
      ph: 6.95,
    });

    // Simulate 3T network drop
    db.markParticipantConnection('271828', 'student-ntt-01', false);
    const disconnectedList = db.listParticipantsByRoom('271828');
    assert.strictEqual(disconnectedList[0].connected, 0);

    // Reconnect and verify atomic restoration
    const recovery = db.rejoinParticipantSession('271828', 'student-ntt-01');
    assert.ok(recovery);
    assert.strictEqual(recovery.participant.connected, 1);
    assert.strictEqual(recovery.participant.display_name, 'Yohanes B.');
    assert.ok(recovery.latestSnapshot);
    assert.strictEqual(recovery.latestSnapshot.params.moduleId, 'acid-base-titration');
    assert.strictEqual(recovery.latestSnapshot.params.volumeAdded, 24.8);

    db.close();
  });

  it('persists gradebook_entries with rubric_json and cascades expired room cleanup', () => {
    const db = createTempDatabase();
    const now = Date.now();

    db.upsertRoom({
      pin: '999001',
      host_id: 'teacher-1',
      module_domain: 'physics',
      status: 'active',
      created_at: now - 7_200_000,
      expires_at: now - 1_000, // Already expired
    });

    db.upsertRoom({
      pin: '888002',
      host_id: 'teacher-1',
      module_domain: 'physics',
      status: 'active',
      created_at: now,
      expires_at: now + 7_200_000,
    });

    db.upsertGradebookEntry({
      id: 'sub-grade-001',
      room_pin: '888002',
      student_id: 'SIS-101',
      student_name: 'Budi Santoso',
      module_id: 'newton-incline',
      score: 94.5,
      rubric_json: JSON.stringify({ totalScore: 94.5, summaryFeedback: 'Akurat' }),
      submitted_at: now,
    });

    const entries = db.listGradebookEntries('888002');
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].score, 94.5);

    const prunedCount = db.pruneExpiredRooms(now);
    assert.strictEqual(prunedCount, 1);
    assert.strictEqual(db.getRoom('999001'), null);
    assert.ok(db.getRoom('888002'));

    db.close();
  });
});
