import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import type { WebSocketServer } from 'ws';
import { getAiRuntimeMetrics } from '../services/geminiClient';
import type { LabServerState } from '../state/labServerState';
import { logger } from '../utils/logger';
import type { WsBackpressureStats } from '../ws/wsTypes';

export interface HealthRoutesDeps {
  state: LabServerState;
  wss?: WebSocketServer | null;
  getBackpressureStats?: () => WsBackpressureStats;
  isShuttingDown?: () => boolean;
  isProduction?: () => boolean;
  getMetricsToken?: () => string | undefined;
}

function timingSafeBearerMatch(
  authHeader: string | undefined,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken || !expectedToken.trim()) return false;
  if (!authHeader || typeof authHeader !== 'string') return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const provided = match[1].trim();
  const expected = expectedToken.trim();

  const digestA = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function readSqliteWalSizeBytes(dbPath: string): number {
  if (!dbPath || dbPath === ':memory:') return 0;
  try {
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      return fs.statSync(walPath).size;
    }
  } catch {
    // Ignore stat errors on missing or inaccessible WAL file
  }
  return 0;
}

export function createHealthRouter({
  state,
  wss,
  getBackpressureStats = () => ({ droppedNonCriticalFrames: 0, rateLimitedDrops: 0 }),
  isShuttingDown = () => false,
  isProduction = () => process.env.NODE_ENV === 'production',
  getMetricsToken = () => process.env.METRICS_TOKEN,
}: HealthRoutesDeps): express.Router {
  const router = express.Router();

  router.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/readyz', async (_req, res) => {
    if (isShuttingDown()) {
      res.status(503).json({
        status: 'not_ready',
        driver: state.asyncRepository.driver,
        checks: {
          sqlite: 'shutting_down',
          database: 'shutting_down',
          websocket: 'shutting_down',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let sqliteOk = false;
    let asyncDbOk = false;
    try {
      sqliteOk = state.database.healthCheck();
    } catch (err) {
      logger.error('Readiness check SQLite query failed', { error: err });
      sqliteOk = false;
    }

    try {
      asyncDbOk = await state.asyncRepository.healthCheck();
    } catch (err) {
      logger.error('Readiness check async repository failed', {
        driver: state.asyncRepository.driver,
        error: err,
      });
      asyncDbOk = false;
    }

    const wsOk = Boolean(wss && typeof wss.clients !== 'undefined');
    const ready = sqliteOk && asyncDbOk && wsOk;

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      driver: state.asyncRepository.driver,
      checks: {
        sqlite: sqliteOk ? 'ok' : 'error',
        database: asyncDbOk ? 'ok' : 'error',
        websocket: wsOk ? 'ok' : 'error',
      },
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/metrics', (req, res) => {
    if (isProduction()) {
      const expectedToken = getMetricsToken();
      if (!timingSafeBearerMatch(req.headers.authorization, expectedToken)) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer METRICS_TOKEN is required in production.',
        });
        return;
      }
    }

    state.pruneExpiredLocks();
    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(2));

    const backpressureStats = getBackpressureStats();
    res.status(200).json({
      dbDriver: state.asyncRepository.driver,
      activeRooms: state.activeLabRooms.size,
      connectedClients: wss ? wss.clients.size : 0,
      activeParameterLocks: state.parameterLocks.size,
      wsBackpressureDroppedFrames: backpressureStats.droppedNonCriticalFrames,
      wsRateLimitedDrops: backpressureStats.rateLimitedDrops ?? 0,
      ai: getAiRuntimeMetrics(),
      backup: state.backupService.getStatus(),
      memoryRssMb: toMb(mem.rss),
      heapUsedMb: toMb(mem.heapUsed),
      sqliteWalSizeBytes: readSqliteWalSizeBytes(state.dbPath),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
