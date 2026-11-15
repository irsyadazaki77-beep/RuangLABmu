import express from 'express';
import rateLimit from 'express-rate-limit';
import os from 'os';
import { getSessionStorageKey } from '../../src/utils/sessionRecovery';
import {
  hashRoomPin,
  verifyRoomPinTimingSafe,
  type LabServerState,
} from '../state/labServerState';
import { sanitizeRoomForBroadcast } from '../utils/collabReconnectSync';
import { detectLanIps } from '../utils/lanNetwork';
import { rateLimitKeyGenerator } from '../utils/rateLimitKey';

export interface LabRoutesDeps {
  state: LabServerState;
  getPort: () => number;
  rejoinRateLimitMax?: number;
  rejoinRateLimitWindowMs?: number;
}

export function createLabRouter({
  state,
  getPort,
  rejoinRateLimitMax = 20,
  rejoinRateLimitWindowMs = 60 * 1000,
}: LabRoutesDeps): express.Router {
  const router = express.Router();

  const rejoinRateLimiter = rateLimit({
    windowMs: rejoinRateLimitWindowMs,
    max: rejoinRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    message: {
      error:
        'Terlalu banyak permintaan pemulihan sesi ruangan (/api/rooms/rejoin). Silakan coba lagi dalam 1 menit.',
      code: 'RATE_LIMITED',
    },
  });

  router.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      activeRooms: state.activeLabRooms.size,
      recordsCount: state.experimentRecords.length,
      port: getPort(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/api/lan-info', (_req, res) => {
    res.json(detectLanIps(os.networkInterfaces(), getPort()));
  });

  router.get('/api/rooms', (_req, res) => {
    const rooms = Array.from(state.activeLabRooms.values()).map((room) => ({
      roomId: room.roomId,
      domain: room.domain,
      moduleId: room.moduleId,
      teacherName: room.teacherName,
      isFrozenByTeacher: room.isFrozenByTeacher,
      createdAt: room.createdAt,
      clientCount: Object.keys(room.clients || {}).length,
      customMission: room.customMission || null,
    }));
    res.json({ rooms });
  });

  router.get('/api/lab-state', (_req, res) => {
    state.pruneExpiredLocks();
    res.json({
      records: state.experimentRecords,
      tasks: state.groupTasks,
      notes: state.collabNotes,
      students: state.studentRoster,
      notifications: state.notifications,
      paramLocks: Array.from(state.parameterLocks.values()),
    });
  });

  router.post('/api/session/autosave', (req, res) => {
    const { storageKey, version, session, sessionToken: bodyToken, studentId: bodyStudentId } =
      req.body || {};
    if (
      !storageKey ||
      typeof storageKey !== 'string' ||
      storageKey.trim().length === 0 ||
      storageKey.length > 180 ||
      typeof version !== 'number' ||
      !Number.isFinite(version)
    ) {
      res.status(400).json({ error: 'Invalid session autosave payload' });
      return;
    }

    const cleanStorageKey = storageKey.trim();
    const headerToken = req.headers['x-session-token'];
    const rawToken =
      typeof bodyToken === 'string' && bodyToken.trim()
        ? bodyToken.trim()
        : typeof headerToken === 'string' && headerToken.trim()
          ? headerToken.trim()
          : '';

    const sessionObj =
      session && typeof session === 'object' && !Array.isArray(session)
        ? (session as Record<string, unknown>)
        : null;
    const claimedStudentId =
      typeof bodyStudentId === 'string' && bodyStudentId.trim()
        ? bodyStudentId.trim()
        : sessionObj && typeof sessionObj.studentId === 'string' && sessionObj.studentId.trim()
          ? sessionObj.studentId.trim()
          : '';
    const claimedModuleId =
      sessionObj && typeof sessionObj.moduleId === 'string' && sessionObj.moduleId.trim()
        ? sessionObj.moduleId.trim()
        : '';

    // Verify storageKey matches the canonical key for (studentId, moduleId) when prefixed
    if (
      cleanStorageKey.startsWith('ruanglab_session_') &&
      claimedStudentId &&
      claimedModuleId
    ) {
      const expectedKey = getSessionStorageKey(claimedStudentId, claimedModuleId);
      if (cleanStorageKey !== expectedKey) {
        res.status(403).json({
          error: 'Kunci penyimpanan sesi tidak sesuai dengan identitas pemilik sesi.',
          code: 'SESSION_OWNERSHIP_MISMATCH',
        });
        return;
      }
    }

    const effectiveOwnerSecret = rawToken
      ? `token:${rawToken}`
      : claimedStudentId
        ? `student:${claimedStudentId}:ip:${rateLimitKeyGenerator(req)}`
        : `ip:${rateLimitKeyGenerator(req)}`;

    const existing = state.sessionSnapshots.get(cleanStorageKey);
    if (existing) {
      if (
        existing.ownerStudentId &&
        claimedStudentId &&
        existing.ownerStudentId !== claimedStudentId
      ) {
        res.status(403).json({
          error: 'Akses ditolak: Anda tidak berhak menimpa sesi praktikum milik siswa lain.',
          code: 'SESSION_OWNERSHIP_MISMATCH',
        });
        return;
      }

      if (
        existing.ownerTokenHash &&
        !verifyRoomPinTimingSafe(effectiveOwnerSecret, existing.ownerTokenHash)
      ) {
        res.status(403).json({
          error: 'Akses ditolak: Token kepemilikan sesi (sessionToken) tidak valid.',
          code: 'SESSION_OWNERSHIP_MISMATCH',
        });
        return;
      }

      if (existing.version > version) {
        res.status(409).json({
          status: 'stale_rejected',
          latestVersion: existing.version,
        });
        return;
      }
    }

    const now = Date.now();
    const ownerTokenHash =
      existing?.ownerTokenHash || hashRoomPin(effectiveOwnerSecret, 'autosave-owner-salt');
    const ownerStudentId = claimedStudentId || existing?.ownerStudentId;

    state.sessionSnapshots.set(cleanStorageKey, {
      version,
      session,
      updatedAt: now,
      ownerStudentId,
      ownerTokenHash,
    });
    state.pruneSessionSnapshots(now);
    res.json({
      status: 'ok',
      version,
      savedAt: now,
    });
  });

  /**
   * Unstable 3T Network Reconnect Endpoint:
   * Accepts (roomPin, participantId, optional roomId) and restores `connected = 1` in SQLite
   * while immediately returning the latest `simulation_snapshots` payload.
   */
  router.post('/api/rooms/rejoin', rejoinRateLimiter, (req, res) => {
    const { roomPin, participantId, roomId } = req.body || {};
    const cleanPin = typeof roomPin === 'string' ? roomPin.trim() : '';
    const cleanParticipantId =
      typeof participantId === 'string' ? participantId.trim() : '';
    const cleanRoomId = typeof roomId === 'string' ? roomId.trim() : undefined;

    if (!cleanPin || !cleanParticipantId) {
      res.status(400).json({
        error: 'Parameter roomPin dan participantId wajib diisi untuk pemulihan sesi 3T.',
        code: 'INVALID_REJOIN_PAYLOAD',
      });
      return;
    }

    const restored = state.rejoinParticipantSession(
      cleanPin,
      cleanParticipantId,
      cleanRoomId
    );
    if (!restored) {
      res.status(404).json({
        error: 'Sesi ruangan tidak ditemukan atau telah kedaluwarsa.',
        code: 'ROOM_SESSION_EXPIRED',
      });
      return;
    }

    res.json({
      status: 'rejoined',
      roomPin: restored.dbRoom.pin,
      room: restored.room ? sanitizeRoomForBroadcast(restored.room) : null,
      participant: restored.participant,
      latestSimulationSnapshot: restored.latestSnapshot?.params ?? null,
      snapshotUpdatedAt: restored.latestSnapshot?.updatedAt ?? null,
    });
  });

  /**
   * Save or query room simulation parameters snapshot in `simulation_snapshots` table
   */
  router.post('/api/rooms/snapshot', (req, res) => {
    const { roomPin, params } = req.body || {};
    const cleanPin = typeof roomPin === 'string' ? roomPin.trim() : '';
    if (!cleanPin || !params || typeof params !== 'object') {
      res.status(400).json({ error: 'Invalid simulation snapshot payload' });
      return;
    }
    const saved = state.saveRoomSimulationSnapshot(
      cleanPin,
      params as Record<string, unknown>
    );
    res.json({
      status: 'ok',
      snapshotId: saved.id,
      roomPin: saved.room_pin,
      updatedAt: saved.updated_at,
    });
  });

  return router;
}
