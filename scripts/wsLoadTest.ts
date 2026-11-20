import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import { createLabServerState } from '../server/state/labServerState';
import { createCollabSocketServer } from '../server/ws/collabSocketServer';
import { createHealthRouter } from '../server/routes/healthRoutes';

interface LoadTestSummary {
  totalClients: number;
  connectedClientsPeak: number;
  durationMs: number;
  totalSentFrames: number;
  totalReceivedFrames: number;
  errorFrames: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  wsBackpressureDroppedFrames: number;
  postDisconnectConnectedClients: number;
  postDisconnectActiveLocks: number;
  readyzStatus: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`Timeout connecting WebSocket to ${url}`));
    }, 10_000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForMessageType(
  ws: WebSocket,
  expectedType: string,
  timeoutMs = 10_000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout waiting for WS message type ${expectedType}`));
    }, timeoutMs);

    const handler = (raw: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { type?: string; payload?: Record<string, unknown> };
        if (parsed.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(parsed.payload ?? {});
        }
      } catch {
        // ignore non-JSON frames
      }
    };
    ws.on('message', handler);
  });
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      ws.terminate();
      resolve();
    }, 2000);
    ws.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.close();
  });
}

async function runLoadTest(): Promise<LoadTestSummary> {
  const externalUrl = process.env.LOAD_TEST_URL?.trim();
  const studentCount = Number(process.env.LOAD_TEST_CLIENTS || 100);
  const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 4000);
  const hz = Number(process.env.LOAD_TEST_HZ || 20);
  const tickMs = Math.max(20, Math.round(1000 / hz));

  let ephemeralServer: http.Server | null = null;
  let ephemeralWss: ReturnType<typeof createCollabSocketServer>['wss'] | null = null;
  let ephemeralState: ReturnType<typeof createLabServerState> | null = null;
  let baseHttpUrl = externalUrl || '';

  if (!externalUrl) {
    const app = express();
    const state = createLabServerState({ dbPath: ':memory:' });
    await state.hydrateServerState();
    const server = http.createServer(app);
    const { wss, getBackpressureStats } = createCollabSocketServer(server, state);
    app.use(
      createHealthRouter({
        state,
        wss,
        getBackpressureStats,
        isShuttingDown: () => false,
      })
    );

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind ephemeral load test server');
    }
    baseHttpUrl = `http://127.0.0.1:${addr.port}`;
    ephemeralServer = server;
    ephemeralWss = wss;
    ephemeralState = state;
  }

  const parsedUrl = new URL(baseHttpUrl);
  const wsProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${parsedUrl.host}/ws-lab`;

  const roomId = `LOAD${Math.floor(1000 + Math.random() * 8999)}`;
  const pin = '4321';

  const teacherWs = await openWs(wsUrl);
  const studentSockets: WebSocket[] = [];

  try {
    // 1. Teacher creates the classroom room
    teacherWs.send(
      JSON.stringify({
        type: 'client:identify',
        payload: {
          userId: 'teacher-load',
          userName: 'Guru LoadTest',
          role: 'Pengajar',
          groupId: 'Kelompok-0',
          domain: 'fisika',
          roomId,
          teacherPin: pin,
        },
      })
    );
    const createdPromise = waitForMessageType(teacherWs, 'ROOM_CREATED');
    teacherWs.send(
      JSON.stringify({
        type: 'ROOM_CREATE',
        payload: {
          roomId,
          schoolId: 'default-school',
          pin,
          domain: 'physics',
          moduleId: 'newton-2nd-law',
          teacherName: 'Guru LoadTest',
          teacherUserId: 'teacher-load',
        },
      })
    );
    await createdPromise;

    // 2. Connect 100 concurrent student clients & join room
    const joinPromises: Promise<unknown>[] = [];
    for (let i = 0; i < studentCount; i += 1) {
      const ws = await openWs(wsUrl);
      studentSockets.push(ws);
      const groupIdx = i % 10;
      const groupId = `Kelompok-${groupIdx}`;
      const userId = `student-load-${i}`;
      const userName = `Siswa ${i + 1}`;

      const joinedPromise = waitForMessageType(ws, 'ROOM_JOINED', 15_000);
      joinPromises.push(joinedPromise);

      ws.send(
        JSON.stringify({
          type: 'client:identify',
          payload: {
            userId,
            userName,
            role: 'Siswa',
            groupId,
            domain: 'fisika',
            roomId,
          },
        })
      );
      ws.send(
        JSON.stringify({
          type: 'ROOM_JOIN',
          payload: {
            roomId,
            pin,
            name: userName,
            role: 'student',
            userId,
            groupId,
            schoolId: 'default-school',
          },
        })
      );
    }
    await Promise.all(joinPromises);

    // Acquire temporary parameter locks to confirm disconnect cleanup removes them
    for (let i = 0; i < 5; i += 1) {
      studentSockets[i].send(
        JSON.stringify({
          type: 'PARAM_LOCK_ACQUIRE',
          payload: {
            groupId: `Kelompok-${i}`,
            domain: 'fisika',
            paramKey: `load-param-${i}`,
            lockedByUserId: `student-load-${i}`,
            lockedByName: `Siswa ${i + 1}`,
            expiresAt: Date.now() + 8000,
          },
        })
      );
    }

    const latenciesMs: number[] = [];
    let totalSentFrames = 0;
    let totalReceivedFrames = 0;
    let errorFrames = 0;

    studentSockets.forEach((ws, idx) => {
      const sampleLatency = idx % 5 === 0;
      ws.on('message', (raw) => {
        totalReceivedFrames += 1;
        const text = raw.toString();
        if (text.includes('"type":"ERROR"')) {
          errorFrames += 1;
          return;
        }
        if (!sampleLatency || !text.includes('"CURSOR_3D_MOVE"')) {
          return;
        }
        try {
          const msg = JSON.parse(text) as {
            type?: string;
            payload?: { updatedAt?: number };
          };
          if (msg.type === 'CURSOR_3D_MOVE' && typeof msg.payload?.updatedAt === 'number') {
            const delta = Date.now() - msg.payload.updatedAt;
            if (delta >= 0 && delta < 30_000) {
              latenciesMs.push(delta);
            }
          }
        } catch {
          // ignore
        }
      });
    });

    // 3. Burst high-frequency telemetry (20 Hz across all 100 concurrent sockets)
    const burstStart = Date.now();
    let tick = 0;
    while (Date.now() - burstStart < durationMs) {
      const now = Date.now();
      for (let i = 0; i < studentSockets.length; i += 1) {
        const ws = studentSockets[i];
        if (ws.readyState !== WebSocket.OPEN) continue;
        const groupId = `Kelompok-${i % 10}`;
        const userId = `student-load-${i}`;
        const userName = `Siswa ${i + 1}`;

        if ((tick + i) % 2 === 0) {
          ws.send(
            JSON.stringify({
              type: 'CURSOR_3D_MOVE',
              payload: {
                userId,
                userName,
                role: 'Siswa',
                groupId,
                domain: 'fisika',
                color: '#38bdf8',
                position: [Math.sin(tick * 0.1), 1.2, Math.cos(tick * 0.1)],
                updatedAt: now,
                schoolId: 'default-school',
              },
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: 'PARAM_VALUE_SYNC',
              payload: {
                groupId,
                domain: 'fisika',
                paramKey: 'gravity',
                value: Number((9.5 + (tick % 10) * 0.05).toFixed(2)),
                updatedBy: userId,
                schoolId: 'default-school',
              },
            })
          );
        }
        totalSentFrames += 1;
      }
      tick += 1;
      await new Promise((r) => setTimeout(r, tickMs));
    }

    // Allow in-flight broadcasts to settle briefly
    await new Promise((r) => setTimeout(r, 150));

    const peakMetricsRes = await fetch(`${baseHttpUrl}/metrics`);
    const peakMetrics = (await peakMetricsRes.json()) as {
      connectedClients: number;
      wsBackpressureDroppedFrames: number;
    };

    // 4. Clean disconnect for all 101 sockets (teacher + 100 students)
    await Promise.all([closeWs(teacherWs), ...studentSockets.map(closeWs)]);
    await new Promise((r) => setTimeout(r, 120));

    const readyzRes = await fetch(`${baseHttpUrl}/readyz`);
    const postMetricsRes = await fetch(`${baseHttpUrl}/metrics`);
    const postMetrics = (await postMetricsRes.json()) as {
      connectedClients: number;
      activeParameterLocks: number;
    };

    latenciesMs.sort((a, b) => a - b);

    const summary: LoadTestSummary = {
      totalClients: studentCount,
      connectedClientsPeak: peakMetrics.connectedClients,
      durationMs: Date.now() - burstStart,
      totalSentFrames,
      totalReceivedFrames,
      errorFrames,
      p50LatencyMs: percentile(latenciesMs, 50),
      p95LatencyMs: percentile(latenciesMs, 95),
      maxLatencyMs: latenciesMs.length > 0 ? latenciesMs[latenciesMs.length - 1] : 0,
      wsBackpressureDroppedFrames: peakMetrics.wsBackpressureDroppedFrames ?? 0,
      postDisconnectConnectedClients: postMetrics.connectedClients,
      postDisconnectActiveLocks: postMetrics.activeParameterLocks,
      readyzStatus: readyzRes.status,
    };

    if (summary.errorFrames > 0) {
      throw new Error(`Load test received ${summary.errorFrames} WS ERROR frames`);
    }
    if (summary.readyzStatus !== 200) {
      throw new Error(`Expected /readyz 200 after disconnect, got ${summary.readyzStatus}`);
    }
    if (summary.postDisconnectConnectedClients !== 0) {
      throw new Error(
        `Expected 0 connectedClients after cleanup, got ${summary.postDisconnectConnectedClients}`
      );
    }
    if (summary.postDisconnectActiveLocks !== 0) {
      throw new Error(
        `Expected 0 activeParameterLocks after disconnect cleanup, got ${summary.postDisconnectActiveLocks}`
      );
    }
    const maxP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS || 750);
    if (summary.p95LatencyMs > maxP95Ms) {
      throw new Error(`p95 broadcast latency too high: ${summary.p95LatencyMs}ms (limit ${maxP95Ms}ms)`);
    }

    return summary;
  } finally {
    await Promise.allSettled([closeWs(teacherWs), ...studentSockets.map(closeWs)]);
    if (ephemeralWss) {
      await new Promise<void>((resolve) => ephemeralWss!.close(() => resolve()));
    }
    if (ephemeralServer) {
      await new Promise<void>((resolve) => ephemeralServer!.close(() => resolve()));
    }
    if (ephemeralState) {
      ephemeralState.dispose();
    }
  }
}

runLoadTest()
  .then((summary) => {
    console.log(JSON.stringify({ ok: true, summary }, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('[wsLoadTest] FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
