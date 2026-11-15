import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  JSON_BODY_LIMITS,
  isOriginAllowed,
  parseAllowedOrigins,
  resolvePreferredPort,
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
  it('resolves preferred port from CLI --port, npm_config_port, or DEFAULT_APP_PORT when PORT collides with NGINX_PORT', () => {
    assert.equal(resolvePreferredPort(['node', 'server.ts', '--port', '4100'], { PORT: '8080' }), 4100);
    assert.equal(resolvePreferredPort(['node', 'server.ts'], { npm_config_port: '3000', PORT: '8080' }), 3000);
    assert.equal(
      resolvePreferredPort(['node', 'server.ts'], {
        PORT: '8080',
        NGINX_PORT: '8080',
        DEFAULT_APP_PORT: '3000',
      }),
      3000
    );
    assert.equal(resolvePreferredPort(['node', 'server.ts'], { PORT: '5000' }), 5000);
    assert.equal(resolvePreferredPort(['node', 'server.ts'], {}), 3000);
  });

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

  it('prevents unauthorized teacher role escalation via ROOM_JOIN, sanitizes pin from ROOM_STATE_SYNC, and rate-limits failed PIN attempts', async () => {
    const {
      handleRoomCreate,
      handleRoomJoin,
      resetJoinPinAttemptsForTest,
    } = await import('../ws/wsRoomManager');
    const typeRoomHandlers = await import('../ws/roomHandlers');
    assert.equal(typeRoomHandlers.handleRoomJoin, handleRoomJoin);

    resetJoinPinAttemptsForTest();
    const state = createLabServerState({ dbPath: ':memory:' });
    try {
      const sentTeacher: Array<{ type: string; payload: Record<string, unknown> }> = [];
      const sentStudent: Array<{ type: string; payload: Record<string, unknown> }> = [];
      const roomBroadcasts: Array<{ roomId: string; msg: { type: string; payload: Record<string, unknown> } }> = [];

      const teacherWs = {
        socketId: 'sock-teacher-host',
        userId: 'teacher-hendra',
        userName: 'Dr. Hendra Kusuma',
        remoteIp: '10.0.0.1',
        send: (raw: string) => sentTeacher.push(JSON.parse(raw)),
      } as unknown as import('../ws/wsTypes').ExtWebSocket;

      const services: import('../ws/wsTypes').WsHandlerServices = {
        state,
        broadcastAll: () => {},
        broadcastRoom: (roomId, payload) => {
          roomBroadcasts.push({
            roomId,
            msg: JSON.parse(JSON.stringify(payload)),
          });
        },
        broadcastGroup: () => {},
      };

      // 1. Teacher creates room with PIN 842619
      handleRoomCreate(
        teacherWs,
        {
          roomId: 'LAB-SEC-01',
          pin: '842619',
          domain: 'physics',
          moduleId: 'newton-incline',
          teacherName: 'Dr. Hendra Kusuma',
          teacherUserId: 'teacher-hendra',
        },
        services
      );

      // Private ROOM_CREATED to creator includes PIN
      const createdMsg = sentTeacher.find((m) => m.type === 'ROOM_CREATED');
      assert.ok(createdMsg);
      assert.equal((createdMsg.payload.room as { pin?: string }).pin, '842619');

      // Broadcast ROOM_STATE_SYNC NEVER exposes pin or pinHash
      const createSync = roomBroadcasts.find((b) => b.msg.type === 'ROOM_STATE_SYNC');
      assert.ok(createSync);
      const syncedRoomOnCreate = createSync.msg.payload.room as Record<string, unknown>;
      assert.equal('pin' in syncedRoomOnCreate, false);
      assert.equal('pinHash' in syncedRoomOnCreate, false);

      // 2. Unverified client attempts role escalation by sending role: 'teacher' with room PIN
      const spoofWs = {
        socketId: 'sock-spoof-student',
        userId: 'stu-spoof',
        userName: 'Attacker Student',
        role: 'Siswa',
        remoteIp: '10.0.0.2',
        send: (raw: string) => sentStudent.push(JSON.parse(raw)),
      } as unknown as import('../ws/wsTypes').ExtWebSocket;

      handleRoomJoin(
        spoofWs,
        {
          roomId: 'LAB-SEC-01',
          pin: '842619',
          name: 'Attacker Student',
          role: 'teacher',
          userId: 'stu-spoof',
        },
        services
      );

      // Must be rejected with UNAUTHORIZED_TEACHER_ROLE and forced to Siswa
      const errMsg = sentStudent.find((m) => m.type === 'ROOM_ERROR');
      assert.ok(errMsg);
      assert.equal(errMsg.payload.code, 'UNAUTHORIZED_TEACHER_ROLE');
      assert.equal(spoofWs.role, 'Siswa');
      const activeRoom = state.activeLabRooms.get('LAB-SEC-01')!;
      assert.equal(activeRoom.teacherSocketId, 'sock-teacher-host');
      assert.equal(activeRoom.clients['sock-spoof-student'], undefined);

      // 3. Normal student join succeeds and ROOM_STATE_SYNC has no pin
      sentStudent.length = 0;
      roomBroadcasts.length = 0;
      handleRoomJoin(
        spoofWs,
        {
          roomId: 'LAB-SEC-01',
          pin: '842619',
          name: 'Alya Pratama',
          role: 'student',
          userId: 'stu-alya',
        },
        services
      );
      const joinedMsg = sentStudent.find((m) => m.type === 'ROOM_JOINED');
      assert.ok(joinedMsg);
      assert.equal('pin' in (joinedMsg.payload.room as Record<string, unknown>), false);
      const joinSync = roomBroadcasts.find((b) => b.msg.type === 'ROOM_STATE_SYNC');
      assert.ok(joinSync);
      assert.equal('pin' in (joinSync.msg.payload.room as Record<string, unknown>), false);

      // 4. Brute-force PIN attempt limiter blocks after 5 wrong PIN attempts
      const bruteMessages: Array<{ type: string; payload: Record<string, unknown> }> = [];
      const bruteWs = {
        socketId: 'sock-brute',
        remoteIp: '10.0.0.99',
        send: (raw: string) => bruteMessages.push(JSON.parse(raw)),
      } as unknown as import('../ws/wsTypes').ExtWebSocket;

      for (let i = 0; i < 6; i += 1) {
        handleRoomJoin(
          bruteWs,
          {
            roomId: 'LAB-SEC-01',
            pin: '000000',
            name: 'Brute',
            role: 'student',
            userId: `brute-${i}`,
          },
          services
        );
      }
      const lastBruteError = bruteMessages[bruteMessages.length - 1];
      assert.equal(lastBruteError.type, 'ROOM_ERROR');
      assert.equal(lastBruteError.payload.code, 'RATE_LIMITED');
    } finally {
      resetJoinPinAttemptsForTest();
      state.dispose();
    }
  });

  it('cleans up zombie 3T sockets on WebSocket heartbeat sweep and supports teacher PARAM_LOCK_RESET_ALL', async () => {
    const { runWsHeartbeatSweep } = await import('../ws/collabSocketServer');
    const { handleParamLockResetAll } = await import('../ws/wsSpatialSync');

    const state = createLabServerState({ dbPath: ':memory:' });
    try {
      const now = Date.now();
      state.activeLabRooms.set('LAB-HB-1', {
        roomId: 'LAB-HB-1',
        pin: '654321',
        domain: 'physics',
        moduleId: 'newton-incline',
        teacherSocketId: 'sock-zombie-teacher',
        teacherName: 'Guru Zombie',
        isFrozenByTeacher: false,
        createdAt: now,
        lastActivityAt: now,
        clients: {
          'sock-zombie-teacher': {
            socketId: 'sock-zombie-teacher',
            userId: 'user-zombie',
            name: 'Guru Zombie',
            role: 'teacher',
            joinedAt: now,
          },
        },
      });
      state.parameterLocks.set('LAB-HB-1:gravity', {
        groupId: 'Kelompok 1',
        domain: 'fisika',
        paramKey: 'gravity',
        lockedByUserId: 'user-zombie',
        lockedByName: 'Guru Zombie',
        expiresAt: now + 60_000,
      });

      let terminated = false;
      let pinged = false;
      const zombieSocket = {
        socketId: 'sock-zombie-teacher',
        userId: 'user-zombie',
        roomId: 'LAB-HB-1',
        groupId: 'Kelompok 1',
        isAlive: false,
        readyState: 1,
        terminate: () => {
          terminated = true;
        },
        ping: () => {},
      } as unknown as import('ws').WebSocket;

      const healthySocket = {
        socketId: 'sock-healthy',
        userId: 'user-healthy',
        roomId: 'LAB-HB-1',
        isAlive: true,
        readyState: 1,
        terminate: () => {},
        ping: () => {
          pinged = true;
        },
      } as unknown as import('ws').WebSocket;

      const services: import('../ws/wsTypes').WsHandlerServices = {
        state,
        broadcastAll: () => {},
        broadcastRoom: () => {},
        broadcastGroup: () => {},
      };

      const count = runWsHeartbeatSweep([zombieSocket, healthySocket], services);
      assert.equal(count, 1);
      assert.equal(terminated, true);
      assert.equal(pinged, true);
      assert.equal((healthySocket as unknown as { isAlive: boolean }).isAlive, false);
      assert.equal(state.parameterLocks.has('LAB-HB-1:gravity'), false);
      assert.equal(state.activeLabRooms.get('LAB-HB-1')?.teacherSocketId, undefined);

      // Verify PARAM_LOCK_RESET_ALL by authorized teacher clears all room locks
      state.parameterLocks.set('LAB-HB-1:mass', {
        groupId: 'Kelompok 1',
        domain: 'fisika',
        paramKey: 'mass',
        lockedByUserId: 'stu-hang',
        lockedByName: 'Siswa Hang',
        expiresAt: now + 60_000,
      });
      const teacherWs = {
        socketId: 'sock-auth-teacher',
        role: 'Pengajar',
        roomId: 'LAB-HB-1',
        send: () => {},
      } as unknown as import('../ws/wsTypes').ExtWebSocket;

      handleParamLockResetAll(teacherWs, { roomId: 'LAB-HB-1' }, services);
      assert.equal(state.parameterLocks.has('LAB-HB-1:mass'), false);
    } finally {
      state.dispose();
    }
  });

  it('enforces rate limiting (429) on POST /api/rooms/rejoin and session ownership (403/409) on POST /api/session/autosave', async () => {
    const express = (await import('express')).default;
    const http = await import('http');
    const { createLabRouter } = await import('../routes/labRoutes');

    const state = createLabServerState({ dbPath: ':memory:' });
    const app = express();
    app.use(express.json());
    app.use(
      createLabRouter({
        state,
        getPort: () => 0,
        rejoinRateLimitMax: 3,
        rejoinRateLimitWindowMs: 60_000,
      })
    );

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // 1. Session Autosave Ownership Validation
      const storageKey = 'ruanglab_session_alya_newton-incline';
      const save1 = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'secret-token-alya-001',
        },
        body: JSON.stringify({
          storageKey,
          version: 1,
          studentId: 'alya',
          session: { studentId: 'alya', moduleId: 'newton-incline', activeWorkflowStep: 2 },
        }),
      });
      assert.equal(save1.status, 200);

      // Attacker trying to spoof storageKey for another student -> 403
      const spoofedKeyAttempt = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'attacker-token-999',
        },
        body: JSON.stringify({
          storageKey: 'ruanglab_session_bima_newton-incline',
          version: 1,
          studentId: 'attacker',
          session: { studentId: 'attacker', moduleId: 'newton-incline', activeWorkflowStep: 2 },
        }),
      });
      assert.equal(spoofedKeyAttempt.status, 403);

      // Attacker with different sessionToken and higher version tries to overwrite Alya's session -> 403
      const hijackAttempt = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'attacker-token-999',
        },
        body: JSON.stringify({
          storageKey,
          version: 50,
          studentId: 'alya',
          session: { studentId: 'alya', moduleId: 'newton-incline', activeWorkflowStep: 4 },
        }),
      });
      assert.equal(hijackAttempt.status, 403);
      const hijackJson = (await hijackAttempt.json()) as { code?: string };
      assert.equal(hijackJson.code, 'SESSION_OWNERSHIP_MISMATCH');

      // Legitimate owner with stale version -> 409 stale_rejected
      const ownerSave2 = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'secret-token-alya-001',
        },
        body: JSON.stringify({
          storageKey,
          version: 5,
          studentId: 'alya',
          session: { studentId: 'alya', moduleId: 'newton-incline', activeWorkflowStep: 3 },
        }),
      });
      assert.equal(ownerSave2.status, 200);

      const staleSave = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'secret-token-alya-001',
        },
        body: JSON.stringify({
          storageKey,
          version: 2,
          studentId: 'alya',
          session: { studentId: 'alya', moduleId: 'newton-incline', activeWorkflowStep: 1 },
        }),
      });
      assert.equal(staleSave.status, 409);

      // 2. Rate Limiting on POST /api/rooms/rejoin (max 3 in test router)
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        const res = await fetch(`${baseUrl}/api/rooms/rejoin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomPin: '000000',
            participantId: `stu-${i}`,
          }),
        });
        statuses.push(res.status);
      }
      assert.deepEqual(statuses.slice(0, 3), [404, 404, 404]);
      assert.equal(statuses[3], 429);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      state.dispose();
    }
  });
});
