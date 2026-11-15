import express from 'express';
import os from 'os';
import { detectLanIps } from '../utils/lanNetwork';
import type { LabServerState } from '../state/labServerState';

export interface LabRoutesDeps {
  state: LabServerState;
  getPort: () => number;
}

export function createLabRouter({ state, getPort }: LabRoutesDeps): express.Router {
  const router = express.Router();

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
    const { storageKey, version, session } = req.body || {};
    if (!storageKey || typeof storageKey !== 'string' || typeof version !== 'number') {
      res.status(400).json({ error: 'Invalid session autosave payload' });
      return;
    }
    const existing = state.sessionSnapshots.get(storageKey);
    if (existing && existing.version > version) {
      res.status(409).json({
        status: 'stale_rejected',
        latestVersion: existing.version,
      });
      return;
    }
    const now = Date.now();
    state.sessionSnapshots.set(storageKey, {
      version,
      session,
      updatedAt: now,
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
  router.post('/api/rooms/rejoin', (req, res) => {
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
      room: restored.room,
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
