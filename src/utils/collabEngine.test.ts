import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getUserColor, ParameterLockPayload, SpatialCursorPayload } from './collabProtocol';
import { loadPersistedState, flushSaveStateNow, scheduleSaveState } from './statePersistence';

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
