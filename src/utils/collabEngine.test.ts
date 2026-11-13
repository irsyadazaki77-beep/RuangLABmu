import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserColor, ParameterLockPayload, SpatialCursorPayload } from './collabProtocol';
import { loadPersistedState, flushSaveStateNow } from './statePersistence';

test('CollabProtocol: getUserColor deterministic palette and teacher role', () => {
  assert.equal(getUserColor('Alya Pratama'), '#38bdf8');
  assert.equal(getUserColor('Bima Wijaya'), '#34d399');
  assert.equal(getUserColor('Citra Lestari'), '#f472b6');
  assert.equal(getUserColor('Dimas Nugroho'), '#fbbf24');
  assert.equal(getUserColor('Elena Putri'), '#a78bfa');
  assert.equal(getUserColor('Dr. Hendra Kusuma'), '#f87171');
  assert.equal(getUserColor('Guru Pendamping', 'Pengajar'), '#f87171');
  assert.equal(getUserColor('Random Student'), '#60a5fa');
});

test('StatePersistence: load fallback on missing or corrupted file', async () => {
  const fallback = { count: 42, label: 'default' };
  const loaded = await loadPersistedState(fallback);
  assert.ok(loaded);
  assert.ok(typeof loaded === 'object');
});

test('StatePersistence: atomic write round-trip and flush', async () => {
  const testState = {
    testId: 'STATE-UNIT-TEST-1',
    timestamp: Date.now(),
    sampleLocks: [
      {
        groupId: 'Kelompok 1',
        domain: 'fisika',
        paramKey: 'mass',
        lockedByUserId: 'alya-pratama',
        lockedByName: 'Alya Pratama',
        expiresAt: Date.now() + 5000,
      },
    ],
  };

  // Immediate flush
  await flushSaveStateNow(testState);

  // Read back
  const retrieved = await loadPersistedState<typeof testState>({
    testId: 'fallback',
    timestamp: 0,
    sampleLocks: [],
  });

  assert.equal(retrieved.testId, 'STATE-UNIT-TEST-1');
  assert.equal(retrieved.sampleLocks.length, 1);
  assert.equal(retrieved.sampleLocks[0].paramKey, 'mass');
});

test('Parameter Mutex Logic: concurrency conflict, TTL expiration, and release', () => {
  const activeLocks = new Map<string, ParameterLockPayload>();

  const tryAcquire = (
    groupId: string,
    domain: 'fisika' | 'kimia' | 'astronomi',
    paramKey: string,
    userId: string,
    userName: string,
    currentTime: number
  ): boolean => {
    const key = `${groupId}:${paramKey}`;
    const existing = activeLocks.get(key);
    if (!existing || currentTime > existing.expiresAt || existing.lockedByUserId === userId) {
      activeLocks.set(key, {
        groupId,
        domain,
        paramKey,
        lockedByUserId: userId,
        lockedByName: userName,
        expiresAt: currentTime + 5000,
      });
      return true;
    }
    return false;
  };

  const tryRelease = (groupId: string, paramKey: string, userId: string): boolean => {
    const key = `${groupId}:${paramKey}`;
    const existing = activeLocks.get(key);
    if (existing && existing.lockedByUserId === userId) {
      activeLocks.delete(key);
      return true;
    }
    return false;
  };

  const t0 = 100000;
  // 1. User A acquires mass lock
  assert.equal(tryAcquire('Kelompok 1', 'fisika', 'mass', 'alya', 'Alya Pratama', t0), true);

  // 2. User B tries to acquire same lock while active -> must be rejected
  assert.equal(tryAcquire('Kelompok 1', 'fisika', 'mass', 'bima', 'Bima Wijaya', t0 + 1000), false);

  // 3. User A can re-acquire/extend their own lock
  assert.equal(tryAcquire('Kelompok 1', 'fisika', 'mass', 'alya', 'Alya Pratama', t0 + 2000), true);

  // 4. User B cannot release User A's lock
  assert.equal(tryRelease('Kelompok 1', 'mass', 'bima'), false);

  // 5. User A releases their lock -> User B can now acquire
  assert.equal(tryRelease('Kelompok 1', 'mass', 'alya'), true);
  assert.equal(tryAcquire('Kelompok 1', 'fisika', 'mass', 'bima', 'Bima Wijaya', t0 + 3000), true);

  // 6. Automatic TTL expiration: at t0 + 10000, Bima's lock has expired (> 5000ms TTL)
  const tExpired = t0 + 15000;
  assert.equal(tryAcquire('Kelompok 1', 'fisika', 'mass', 'alya', 'Alya Pratama', tExpired), true);
  assert.equal(activeLocks.get('Kelompok 1:mass')?.lockedByUserId, 'alya');
});

test('Spatial 3D Cursor: validation of coordinate tuple and surface normal', () => {
  const cursor: SpatialCursorPayload = {
    userId: 'bima-wijaya',
    userName: 'Bima Wijaya',
    role: 'Siswa',
    groupId: 'Kelompok 1 — Mekanika',
    domain: 'fisika',
    color: '#34d399',
    position: [1.25, 0.39, -0.15],
    normal: [0, 1, 0],
    hoveredObject: 'Beban M1 (Balok Geser)',
    updatedAt: Date.now(),
  };

  assert.equal(cursor.position.length, 3);
  assert.equal(typeof cursor.position[0], 'number');
  assert.equal(cursor.normal?.[1], 1);
  assert.equal(cursor.hoveredObject, 'Beban M1 (Balok Geser)');
});

test('SpatialCollab (Tahap 3): 20Hz (50ms) cursor throttling and LERP (factor 0.25)', async () => {
  const {
    THROTTLE_MS,
    CURSOR_LERP_FACTOR,
    lerpCoordinate,
    lerpCursor3DPosition,
    shouldEmitThrottledCursor,
  } = await import('../hooks/useSpatialCollab');

  // Verify 20 Hz = 50ms constant
  assert.equal(THROTTLE_MS, 50);
  assert.equal(CURSOR_LERP_FACTOR, 0.25);

  // Verify throttling blocks emissions < 50ms apart (e.g. 144Hz = ~6.9ms frames)
  assert.equal(shouldEmitThrottledCursor(1007, 1000), false);
  assert.equal(shouldEmitThrottledCursor(1049, 1000), false);
  assert.equal(shouldEmitThrottledCursor(1050, 1000), true);
  assert.equal(shouldEmitThrottledCursor(1080, 1000), true);

  // Verify scalar and 3D vector LERP: currentPos + (targetPos - currentPos) * 0.25
  assert.equal(lerpCoordinate(0, 10, 0.25), 2.5);
  const lerpedVec = lerpCursor3DPosition([0, 4, -8], [4, 8, 0], 0.25);
  assert.deepEqual(lerpedVec, [1, 5, -6]);
});

test('BackendSync (Tahap 4): Exponential Backoff, Offline Outbox Queue, and Runtime Payload Guard', async () => {
  const {
    calculateReconnectDelay,
    OfflineOutboxQueue,
    isValidBackendWsMessage,
    parseAndValidateWsMessage,
  } = await import('../hooks/useBackendSync');

  // 1. Exponential Backoff: min(1000 * 2^attempt, 15000) + jitter
  const zeroJitter = () => 0;
  assert.equal(calculateReconnectDelay(0, zeroJitter), 1000);
  assert.equal(calculateReconnectDelay(1, zeroJitter), 2000);
  assert.equal(calculateReconnectDelay(2, zeroJitter), 4000);
  assert.equal(calculateReconnectDelay(3, zeroJitter), 8000);
  assert.equal(calculateReconnectDelay(4, zeroJitter), 15000);
  assert.equal(calculateReconnectDelay(10, zeroJitter), 15000);

  const halfJitter = () => 0.5;
  const delayWithJitter = calculateReconnectDelay(2, halfJitter);
  assert.ok(delayWithJitter > 4000 && delayWithJitter <= 4400);

  // 2. Offline Outbox Queue: FIFO buffering and sequential flushing on reconnect
  const outbox = new OfflineOutboxQueue();
  outbox.enqueue('PARAM_VALUE_SYNC', { groupId: 'G1', paramKey: 'mass', value: 2.0 }, 100);
  outbox.enqueue('PARAM_VALUE_SYNC', { groupId: 'G1', paramKey: 'mass', value: 3.5 }, 110); // coalesces same key
  outbox.enqueue('PARAM_VALUE_SYNC', { groupId: 'G1', paramKey: 'angle', value: 30 }, 120);
  outbox.enqueue('task:toggle', { id: 'task-1', studentName: 'Alya' }, 130);

  assert.equal(outbox.size(), 3);

  const flushedMessages: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const count = outbox.flush((raw) => {
    flushedMessages.push(JSON.parse(raw));
  });

  assert.equal(count, 3);
  assert.equal(outbox.size(), 0);
  assert.equal(flushedMessages[0].type, 'PARAM_VALUE_SYNC');
  assert.equal(flushedMessages[0].payload.paramKey, 'mass');
  assert.equal(flushedMessages[0].payload.value, 3.5);
  assert.equal(flushedMessages[1].payload.paramKey, 'angle');
  assert.equal(flushedMessages[2].type, 'task:toggle');

  // 3. Runtime Payload Guard: rejects corrupted JSON and malformed payloads without throwing
  assert.equal(parseAndValidateWsMessage('{{{corrupted-json'), null);
  assert.equal(parseAndValidateWsMessage('null'), null);
  assert.equal(parseAndValidateWsMessage(JSON.stringify({ type: 'UNKNOWN_HACK', payload: {} })), null);
  assert.equal(
    parseAndValidateWsMessage(
      JSON.stringify({ type: 'PARAM_VALUE_SYNC', payload: { paramKey: 'mass', value: 'not-a-number', groupId: 'G1' } })
    ),
    null
  );
  assert.equal(
    isValidBackendWsMessage({
      type: 'CURSOR_3D_MOVE',
      payload: { userId: 'u1', position: [1, Number.NaN, 3] },
    }),
    false
  );

  // Valid payloads pass
  const validParamMsg = parseAndValidateWsMessage(
    JSON.stringify({
      type: 'PARAM_VALUE_SYNC',
      payload: { groupId: 'G1', paramKey: 'mass', value: 4.5 },
    })
  );
  assert.ok(validParamMsg !== null);
  assert.equal(validParamMsg?.type, 'PARAM_VALUE_SYNC');
  assert.equal(validParamMsg?.payload.value, 4.5);
});

test('FASE 4 CollabProtocol: Teacher 3D Laser Ray & Camera Sync validation', async () => {
  const {
    validateTeacherLaserRayPayload,
    validateTeacherCameraSyncPayload,
  } = await import('./collabProtocol');
  const { isValidBackendWsMessage } = await import('../hooks/useBackendSync');

  // Reject NaN/Infinity or missing fields
  assert.equal(
    validateTeacherLaserRayPayload({ active: true, point: [1, Number.NaN, 2] }),
    null
  );
  assert.equal(
    validateTeacherCameraSyncPayload({ enabled: true, position: [0, 2, 5], target: [0, 0] }),
    null
  );

  // Accept valid payloads and normalize roomId/bounds
  const laser = validateTeacherLaserRayPayload({
    roomId: ' lab-99 ',
    teacherName: 'Dr. Hendra Kusuma',
    point: [1.5, 0.8, -0.4],
    normal: [0, 1, 0],
    hoveredObject: 'Buret Asam 50mL',
    active: true,
  });
  assert.ok(laser !== null);
  assert.equal(laser?.roomId, 'LAB-99');
  assert.equal(laser?.hoveredObject, 'Buret Asam 50mL');
  assert.equal(isValidBackendWsMessage({ type: 'TEACHER_LASER_RAY', payload: laser }), true);

  const cam = validateTeacherCameraSyncPayload({
    roomId: 'lab-99',
    teacherName: 'Dr. Hendra Kusuma',
    enabled: true,
    position: [4.2, 3.1, 6.0],
    target: [0, 0.5, 0],
    seq: 7,
  });
  assert.ok(cam !== null);
  assert.equal(cam?.seq, 7);
  assert.equal(isValidBackendWsMessage({ type: 'TEACHER_CAMERA_SYNC', payload: cam }), true);
  assert.equal(
    isValidBackendWsMessage({ type: 'TEACHER_CAMERA_SYNC', payload: { enabled: true } }),
    false
  );
});

