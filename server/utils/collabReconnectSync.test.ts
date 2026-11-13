import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomReconnectSnapshot,
  getRoomScopedLocks,
} from './collabReconnectSync';
import { buildReconnectRoomJoinMessage } from '../../src/hooks/useBackendSync';
import type { LabRoom, LabRoomClient, ParameterLockPayload } from '../../src/utils/collabProtocol';

describe('WebSocket Room Reconnect & Snapshot Resync Helpers', () => {
  it('filters expired locks and returns only locks belonging to the active room/group', () => {
    const now = 1_700_000_000_000;
    const locks = new Map<string, ParameterLockPayload>();
    locks.set('LAB-42:gravity', {
      groupId: 'Kelompok 1',
      domain: 'fisika',
      paramKey: 'gravity',
      lockedByUserId: 'user-bima',
      lockedByName: 'Bima',
      expiresAt: now + 4000,
    });
    locks.set('LAB-42:mass', {
      groupId: 'Kelompok 1',
      domain: 'fisika',
      paramKey: 'mass',
      lockedByUserId: 'user-alya',
      lockedByName: 'Alya',
      expiresAt: now - 500, // expired
    });
    locks.set('LAB-99:inclineAngle', {
      groupId: 'Kelompok 9',
      domain: 'fisika',
      paramKey: 'inclineAngle',
      lockedByUserId: 'user-citra',
      lockedByName: 'Citra',
      expiresAt: now + 4000,
    });

    const roomLocks = getRoomScopedLocks(locks, 'lab-42', 'Kelompok 1', now);
    assert.equal(roomLocks.length, 1);
    assert.equal(roomLocks[0].paramKey, 'gravity');
  });

  it('builds a full reconnect snapshot preserving isFrozenByTeacher, customMission, and room locks', () => {
    const now = 1_700_000_000_000;
    const locks = new Map<string, ParameterLockPayload>();
    locks.set('LAB-A1:titrantAddedMl', {
      groupId: 'Kelompok 2',
      domain: 'kimia',
      paramKey: 'titrantAddedMl',
      lockedByUserId: 'user-bima',
      lockedByName: 'Bima',
      expiresAt: now + 3500,
    });

    const client: LabRoomClient = {
      socketId: 'sock-new',
      userId: 'user-alya',
      name: 'Alya Pratama',
      role: 'student',
      groupId: 'Kelompok 2',
      joinedAt: now,
    };

    const room: LabRoom = {
      roomId: 'LAB-A1',
      pin: '4321',
      domain: 'chemistry',
      moduleId: 'acid-base-titration',
      teacherName: 'Dr. Hendra Kusuma',
      isFrozenByTeacher: true,
      createdAt: now - 60000,
      clients: { 'sock-new': client },
      customMission: {
        id: 'mission-1',
        moduleId: 'acid-base-titration',
        moduleTitle: 'Titrasi Asam-Basa',
        domain: 'chemistry',
        caseStudyPrompt: 'Uji sampel air danau',
        title: 'Misi Air Danau',
        narrative: 'Netralkan sampel hingga pH 7.0',
        targetVariable: {
          variableKey: 'currentPh',
          variableLabel: 'pH',
          unit: 'pH',
          targetValue: 7.0,
          minSuccessValue: 6.8,
          maxSuccessValue: 7.2,
        },
        contextualQuestions: [],
        createdByTeacher: 'Dr. Hendra Kusuma',
        roomId: 'LAB-A1',
        createdAt: now - 30000,
      },
    };

    const snapshot = buildRoomReconnectSnapshot(room, client, locks, true, now);
    assert.equal(snapshot.roomJoinedMessage.type, 'ROOM_JOINED');
    assert.equal(snapshot.roomJoinedMessage.payload.isReconnect, true);
    assert.equal(snapshot.roomJoinedMessage.payload.room.isFrozenByTeacher, true);
    assert.equal(snapshot.roomJoinedMessage.payload.room.customMission?.title, 'Misi Air Danau');
    assert.equal(snapshot.roomJoinedMessage.payload.paramLocks.length, 1);

    assert.equal(snapshot.paramLocksSyncMessage.type, 'PARAM_LOCKS_SYNC');
    assert.equal(snapshot.paramLocksSyncMessage.payload.roomId, 'LAB-A1');
    assert.equal(snapshot.paramLocksSyncMessage.payload.locks[0].paramKey, 'titrantAddedMl');
  });

  it('builds client ROOM_JOIN reconnect payload only when roomId and pin are present', () => {
    const missing = buildReconnectRoomJoinMessage(null, null, null, {
      userId: 'user-alya',
      name: 'Alya',
      role: 'Siswa',
      groupId: 'G1',
    });
    assert.equal(missing, null);

    const fromFallback = buildReconnectRoomJoinMessage(null, 'lab-xy', '1234', {
      userId: 'user-hendra',
      name: 'Dr. Hendra',
      role: 'Pengajar',
      groupId: 'G1',
    });
    assert.ok(fromFallback);
    assert.equal(fromFallback.type, 'ROOM_JOIN');
    assert.equal(fromFallback.payload.roomId, 'LAB-XY');
    assert.equal(fromFallback.payload.pin, '1234');
    assert.equal(fromFallback.payload.role, 'teacher');
    assert.equal(fromFallback.payload.isReconnect, true);
  });
});
