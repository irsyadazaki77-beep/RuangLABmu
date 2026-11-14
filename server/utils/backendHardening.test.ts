import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  JSON_BODY_LIMITS,
  isOriginAllowed,
  parseAllowedOrigins,
  selectJsonBodyLimit,
} from '../../server';
import {
  createLabServerState,
  generateSecureRoomPin,
  hashRoomPin,
  verifyRoomPinTimingSafe,
} from '../state/labServerState';
import { applyCustomMissionToRoom } from '../ws/collabSocketServer';
import { verifyTeacherAuthorization } from '../../src/utils/submissionPersistence';

describe('Backend Security Hardening & SQLite Persistence', () => {
  it('enforces ALLOWED_ORIGINS whitelist strictly in production and permits localhost/LAN only in non-production', () => {
    const allowed = parseAllowedOrigins(
      'https://lab.sekolah.sch.id, https://ruanglabmu.id/',
      'https://app.ruanglabmu.id/portal'
    );

    assert.equal(isOriginAllowed('https://lab.sekolah.sch.id', allowed, true), true);
    assert.equal(isOriginAllowed('https://ruanglabmu.id', allowed, true), true);
    assert.equal(isOriginAllowed('https://app.ruanglabmu.id', allowed, true), true);
    assert.equal(isOriginAllowed('https://evil.example.com', allowed, true), false);
    assert.equal(isOriginAllowed('http://localhost:3000', allowed, true), false);

    // Non-production dev/LAN fallback
    assert.equal(isOriginAllowed('http://localhost:3000', allowed, false), true);
    assert.equal(isOriginAllowed('http://192.168.43.1:3000', allowed, false), true);
    assert.equal(isOriginAllowed('https://evil.example.com', allowed, false), false);
  });

  it('enforces 1mb JSON payload limit by default and 20mb strictly on /api/ai/vision-diagnose', () => {
    assert.equal(JSON_BODY_LIMITS.standard, '1mb');
    assert.equal(JSON_BODY_LIMITS.visionUpload, '20mb');
    assert.equal(selectJsonBodyLimit('/api/lab/state'), '1mb');
    assert.equal(selectJsonBodyLimit('/api/submissions'), '1mb');
    assert.equal(selectJsonBodyLimit('/api/ai/chat'), '1mb');
    assert.equal(selectJsonBodyLimit('/api/ai/vision-diagnose'), '20mb');
  });

  it('never falls back to hardcoded PIN 1234 and verifies hashed/plain PINs via timingSafeEqual', () => {
    const authWithDefaultPin = verifyTeacherAuthorization({
      socketId: 'sock-spoof',
      claimedRole: 'Pengajar',
      providedPin: '1234',
      roomPin: '998877',
    });
    assert.equal(authWithDefaultPin.authorized, false);
    assert.equal(authWithDefaultPin.effectiveRole, 'Praktikan');

    const secretPin = generateSecureRoomPin();
    const hashedPin = hashRoomPin(secretPin);
    assert.ok(hashedPin.startsWith('sha256$'));
    assert.equal(verifyRoomPinTimingSafe(secretPin, hashedPin), true);
    assert.equal(verifyRoomPinTimingSafe('1234', hashedPin), false);
    assert.equal(verifyRoomPinTimingSafe(secretPin, secretPin), true);

    const authWithValidHash = verifyTeacherAuthorization({
      socketId: 'sock-teacher',
      claimedRole: 'Pengajar',
      providedPin: secretPin,
      roomPinHash: hashedPin,
    });
    assert.equal(authWithValidHash.authorized, true);
    assert.equal(authWithValidHash.effectiveRole, 'Pengajar');

    const prevDemoPin = process.env.DEMO_ROOM_PIN;
    delete process.env.DEMO_ROOM_PIN;
    const state = createLabServerState({ dbPath: ':memory:' });
    try {
      const alphaRoom = state.activeLabRooms.get('LAB-ALPHA');
      assert.ok(alphaRoom);
      assert.notEqual(alphaRoom.pin, '1234');
      assert.match(alphaRoom.pin, /^\d{6}$/);

      const adHocRoom = applyCustomMissionToRoom(
        state.activeLabRooms,
        'LAB-CUSTOM-9',
        null,
        'Ibu Sari'
      );
      assert.notEqual(adHocRoom.pin, '1234');
      assert.match(adHocRoom.pin, /^\d{6}$/);
    } finally {
      state.dispose();
      if (prevDemoPin !== undefined) {
        process.env.DEMO_ROOM_PIN = prevDemoPin;
      }
    }
  });

  it('persists CRUD state to SQLite disk file and restores across server restarts with TTL pruning', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruanglabmu-sqlite-test-'));
    const dbFile = path.join(tmpDir, 'ruanglabmu.db');

    try {
      const now = Date.now();
      const state1 = createLabServerState({ dbPath: dbFile });
      try {
        state1.activeLabRooms.set('ROOM-SQLITE-1', {
          roomId: 'ROOM-SQLITE-1',
          pin: '784512',
          domain: 'physics',
          moduleId: 'newton-incline',
          teacherName: 'Pak Budi',
          isFrozenByTeacher: true,
          createdAt: now,
          lastActivityAt: now,
          clients: {},
        });

        state1.sessionSnapshots.set('snap-sqlite-1', {
          version: 7,
          session: { domain: 'physics', mass: 6.5 },
          updatedAt: now,
        });

        state1.parameterLocks.set('ROOM-SQLITE-1:mass', {
          groupId: 'Kelompok 1',
          domain: 'fisika',
          paramKey: 'mass',
          lockedByUserId: 'stu-10',
          lockedByName: 'Raka',
          expiresAt: now + 60_000,
        });

        state1.parameterLocks.set('ROOM-SQLITE-1:expiredParam', {
          groupId: 'Kelompok 1',
          domain: 'fisika',
          paramKey: 'expiredParam',
          lockedByUserId: 'stu-11',
          lockedByName: 'Sinta',
          expiresAt: now - 5_000,
        });

        state1.experimentRecords.unshift({
          id: 'EXP-SQLITE-99',
          timestamp: '11:20:00',
          studentName: 'Nadia Putri',
          groupId: 'Kelompok 1',
          domain: 'Fisika',
          experimentTitle: 'Uji SQLite Persistence',
          parametersSummary: 'm=6.5 kg',
          keyMetrics: { Percepatan: '4.90 m/s²' },
          notes: 'Tersimpan di SQLite.',
        });

        state1.notifications.unshift({
          id: 'NOTIF-EXPIRED-1',
          timestamp: '11:00:00',
          severity: 'nominal',
          domain: 'Fisika',
          title: 'Expired Notif',
          message: 'Should be pruned',
          expiresAt: now - 10_000,
        });

        state1.persistServerState();
      } finally {
        state1.dispose();
      }

      // Re-open from the same SQLite database file
      const state2 = createLabServerState({ dbPath: dbFile });
      try {
        await state2.hydrateServerState();
        const restoredRoom = state2.activeLabRooms.get('ROOM-SQLITE-1') as
          | { isFrozenByTeacher: boolean; teacherName?: string; pinHash?: string }
          | undefined;
        assert.ok(restoredRoom);
        assert.equal(restoredRoom.isFrozenByTeacher, true);
        assert.equal(restoredRoom.teacherName, 'Pak Budi');
        assert.ok(restoredRoom.pinHash?.startsWith('sha256$'));

        const restoredSnap = state2.sessionSnapshots.get('snap-sqlite-1');
        assert.ok(restoredSnap);
        assert.equal(restoredSnap.version, 7);

        // Active lock is preserved, expired lock was pruned by SQLite TTL
        assert.equal(state2.parameterLocks.has('ROOM-SQLITE-1:mass'), true);
        assert.equal(state2.parameterLocks.has('ROOM-SQLITE-1:expiredParam'), false);

        assert.equal(
          state2.experimentRecords.some((r) => r.id === 'EXP-SQLITE-99'),
          true
        );
        assert.equal(
          state2.notifications.some((n) => n.id === 'NOTIF-EXPIRED-1'),
          false
        );
      } finally {
        state2.dispose();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('evicts idle rooms, expired session snapshots, and enforces collection capacity bounds', () => {
    const state = createLabServerState({
      dbPath: ':memory:',
      maxActiveRooms: 3,
      roomIdleTtlMs: 1000,
      maxSessionSnapshots: 3,
      snapshotTtlMs: 1000,
      maxRecords: 4,
      maxTasks: 4,
      maxNotes: 4,
      maxStudents: 5,
      maxNotifications: 3,
    });

    try {
      const now = Date.now();
      state.activeLabRooms.set('ROOM-OLD-IDLE', {
        roomId: 'ROOM-OLD-IDLE',
        pin: '551122',
        domain: 'physics',
        moduleId: 'newton-incline',
        isFrozenByTeacher: false,
        createdAt: now - 5000,
        lastActivityAt: now - 5000,
        clients: {},
      });
      state.activeLabRooms.set('ROOM-NEW-1', {
        roomId: 'ROOM-NEW-1',
        pin: '551123',
        domain: 'chemistry',
        moduleId: 'acid-base-titration',
        isFrozenByTeacher: false,
        createdAt: now - 100,
        lastActivityAt: now - 100,
        clients: {},
      });
      state.activeLabRooms.set('ROOM-NEW-2', {
        roomId: 'ROOM-NEW-2',
        pin: '551124',
        domain: 'biology',
        moduleId: 'photosynthesis-ingenhousz',
        isFrozenByTeacher: false,
        createdAt: now - 50,
        lastActivityAt: now - 50,
        clients: {},
      });
      state.activeLabRooms.set('ROOM-NEW-3', {
        roomId: 'ROOM-NEW-3',
        pin: '551125',
        domain: 'astronomy',
        moduleId: 'solar-kepler',
        isFrozenByTeacher: false,
        createdAt: now,
        lastActivityAt: now,
        clients: {},
      });

      state.pruneIdleRooms(now);
      assert.equal(state.activeLabRooms.has('ROOM-OLD-IDLE'), false);
      assert.ok(state.activeLabRooms.size <= 3);

      // Snapshots TTL + LRU
      state.sessionSnapshots.set('snap-expired', {
        version: 1,
        session: {},
        updatedAt: now - 5000,
      });
      for (let i = 1; i <= 5; i += 1) {
        state.sessionSnapshots.set(`snap-${i}`, {
          version: i,
          session: {},
          updatedAt: now - (6 - i) * 10,
        });
      }
      state.pruneSessionSnapshots(now);
      assert.equal(state.sessionSnapshots.has('snap-expired'), false);
      assert.equal(state.sessionSnapshots.size, 3);
      assert.equal(state.sessionSnapshots.has('snap-5'), true);

      // Collection caps
      for (let i = 0; i < 8; i += 1) {
        state.experimentRecords.unshift({
          id: `EXP-TEST-${i}`,
          timestamp: '10:00:00',
          studentName: 'Alya Pratama',
          groupId: 'G1',
          domain: 'Fisika',
          experimentTitle: 'Test',
          parametersSummary: 'm=1',
          keyMetrics: {},
          notes: '',
        });
        state.notifications.unshift({
          id: `NOTIF-TEST-${i}`,
          timestamp: '10:00:00',
          severity: 'nominal',
          domain: 'Fisika',
          title: 'T',
          message: 'M',
        });
      }
      state.enforceCollectionBounds();
      assert.equal(state.experimentRecords.length, 4);
      assert.equal(state.notifications.length, 3);
    } finally {
      state.dispose();
    }
  });
});
