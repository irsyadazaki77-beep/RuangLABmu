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
    state.sessionSnapshots.set(storageKey, {
      version,
      session,
      updatedAt: Date.now(),
    });
    res.json({
      status: 'ok',
      version,
      savedAt: Date.now(),
    });
  });

  return router;
}
