import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed, parseAllowedOrigins } from '../../server';
import { createLabServerState, generateSecureRoomPin } from '../state/labServerState';
import { applyCustomMissionToRoom } from '../ws/collabSocketServer';
import { verifyTeacherAuthorization } from '../../src/utils/submissionPersistence';

describe('Backend Security Hardening & Bounded Memory State', () => {
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

  it('never falls back to hardcoded PIN 1234 in verifyTeacherAuthorization, LAB-ALPHA, or applyCustomMissionToRoom', () => {
    const authWithDefaultPin = verifyTeacherAuthorization({
      socketId: 'sock-spoof',
      claimedRole: 'Pengajar',
      providedPin: '1234',
      roomPin: '998877',
    });
    assert.equal(authWithDefaultPin.authorized, false);
    assert.equal(authWithDefaultPin.effectiveRole, 'Praktikan');

    const prevDemoPin = process.env.DEMO_ROOM_PIN;
    delete process.env.DEMO_ROOM_PIN;
    const state = createLabServerState();
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

      const pinA = generateSecureRoomPin();
      const pinB = generateSecureRoomPin();
      assert.match(pinA, /^\d{6}$/);
      assert.match(pinB, /^\d{6}$/);
    } finally {
      state.dispose();
      if (prevDemoPin !== undefined) {
        process.env.DEMO_ROOM_PIN = prevDemoPin;
      }
    }
  });

  it('evicts idle rooms, expired session snapshots, and enforces collection capacity bounds', () => {
    const state = createLabServerState({
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
