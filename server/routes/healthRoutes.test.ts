import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createHealthRouter } from './healthRoutes';
import { createLabServerState } from '../state/labServerState';
import { createGracefulShutdownHandler } from '../../server';
import {
  formatStructuredLogLine,
  requestCorrelationMiddleware,
  sanitizeLogContext,
} from '../utils/logger';

describe('SRE Health Probes, Metrics Security & Structured Logger Redaction', () => {
  it('redacts PINs, tokens, API keys, and handles circular objects safely in structured logs', () => {
    const circular: Record<string, unknown> = { label: 'node-a' };
    circular.self = circular;

    const sanitized = sanitizeLogContext({
      pin: '842619',
      roomPin: '991122',
      teacherPin: 'secret-teacher',
      pinHash: 'sha256$salt$hash',
      sessionToken: 'tok-session-123',
      teacherToken: 'tok-teacher-456',
      metricsToken: 'tok-metrics-789',
      authorization: 'Bearer my-secret-jwt',
      geminiApiKey: 'AIzaSyTestFakeKey1234567890',
      note: 'Key AIzaSyInlineLeak9876543210 appeared here',
      safeRoomId: 'LAB-01',
      circular,
    });

    assert.equal(sanitized.pin, '[REDACTED]');
    assert.equal(sanitized.roomPin, '[REDACTED]');
    assert.equal(sanitized.teacherPin, '[REDACTED]');
    assert.equal(sanitized.pinHash, '[REDACTED]');
    assert.equal(sanitized.sessionToken, '[REDACTED]');
    assert.equal(sanitized.teacherToken, '[REDACTED]');
    assert.equal(sanitized.metricsToken, '[REDACTED]');
    assert.equal(sanitized.authorization, '[REDACTED]');
    assert.equal(sanitized.geminiApiKey, '[REDACTED]');
    assert.equal(sanitized.safeRoomId, 'LAB-01');
    assert.ok(String(sanitized.note).includes('[REDACTED_API_KEY]'));
    assert.equal(String(sanitized.note).includes('AIzaSyInlineLeak'), false);
    assert.equal((sanitized.circular as Record<string, unknown>).self, '[CIRCULAR]');

    const jsonLine = formatStructuredLogLine('info', 'Room synced with AIzaSyLeak1234567890', {
      roomId: 'LAB-01',
      pin: '112233',
    });
    const parsed = JSON.parse(jsonLine) as Record<string, unknown>;
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.roomId, 'LAB-01');
    assert.equal(parsed.pin, '[REDACTED]');
    assert.equal(String(parsed.message).includes('AIzaSyLeak'), false);
  });

  it('serves /healthz, /readyz, /metrics with Bearer token protection in production and X-Request-Id header', async () => {
    const state = createLabServerState({ dbPath: ':memory:' });
    const server = http.createServer();
    const wss = new WebSocketServer({ noServer: true });
    let shuttingDown = false;
    let prodMode = false;

    const app = express();
    app.use(requestCorrelationMiddleware);
    app.use(
      createHealthRouter({
        state,
        wss,
        isShuttingDown: () => shuttingDown,
        isProduction: () => prodMode,
        getMetricsToken: () => 'super-secret-metrics-token',
      })
    );
    server.on('request', app);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // 1. /healthz + X-Request-Id correlation header propagation
      const healthRes = await fetch(`${baseUrl}/healthz`, {
        headers: { 'X-Request-Id': 'req-corr-test-001' },
      });
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.headers.get('x-request-id'), 'req-corr-test-001');
      const healthJson = (await healthRes.json()) as { status: string; uptimeSeconds: number };
      assert.equal(healthJson.status, 'ok');
      assert.equal(typeof healthJson.uptimeSeconds, 'number');

      // 2. /readyz ready -> 200; shutting down -> 503
      const readyRes = await fetch(`${baseUrl}/readyz`);
      assert.equal(readyRes.status, 200);
      const readyJson = (await readyRes.json()) as {
        status: string;
        checks: { sqlite: string; websocket: string };
      };
      assert.equal(readyJson.status, 'ready');
      assert.equal(readyJson.checks.sqlite, 'ok');
      assert.equal(readyJson.checks.websocket, 'ok');

      shuttingDown = true;
      const drainingRes = await fetch(`${baseUrl}/readyz`);
      assert.equal(drainingRes.status, 503);
      shuttingDown = false;

      // 3. /metrics open in non-prod
      const devMetricsRes = await fetch(`${baseUrl}/metrics`);
      assert.equal(devMetricsRes.status, 200);
      const metricsJson = (await devMetricsRes.json()) as {
        activeRooms: number;
        connectedClients: number;
        activeParameterLocks: number;
        memoryRssMb: number;
        heapUsedMb: number;
        sqliteWalSizeBytes: number;
      };
      assert.ok(metricsJson.activeRooms >= 1);
      assert.equal(typeof metricsJson.connectedClients, 'number');
      assert.equal(typeof metricsJson.activeParameterLocks, 'number');
      assert.ok(metricsJson.memoryRssMb > 0);
      assert.ok(metricsJson.heapUsedMb > 0);
      assert.equal(typeof metricsJson.sqliteWalSizeBytes, 'number');

      // 4. /metrics protected in production by Bearer METRICS_TOKEN
      prodMode = true;
      const unauthMetrics = await fetch(`${baseUrl}/metrics`);
      assert.equal(unauthMetrics.status, 401);

      const badTokenMetrics = await fetch(`${baseUrl}/metrics`, {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      assert.equal(badTokenMetrics.status, 401);

      const authedMetrics = await fetch(`${baseUrl}/metrics`, {
        headers: { Authorization: 'Bearer super-secret-metrics-token' },
      });
      assert.equal(authedMetrics.status, 200);
    } finally {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      state.dispose();
    }
  });

  it('performs graceful shutdown cleanly: flips readiness, closes HTTP/WS, checkpoints WAL, and disposes state', async () => {
    const state = createLabServerState({ dbPath: ':memory:' });
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    const wss = new WebSocketServer({ server });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    let shuttingDown = false;
    let exitCode: number | null = null;
    const shutdown = createGracefulShutdownHandler({
      server,
      wss,
      state,
      setShuttingDown: (val) => {
        shuttingDown = val;
      },
      exitFn: (code) => {
        exitCode = code;
      },
    });

    await shutdown('SIGTERM');
    assert.equal(shuttingDown, true);
    assert.equal(exitCode, 0);
  });
});
