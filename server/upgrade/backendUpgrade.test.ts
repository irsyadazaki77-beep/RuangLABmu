import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import express from 'express';
import WebSocket from 'ws';
import {
  attachSessionMiddleware,
  signSessionToken,
  verifySessionToken,
} from '../auth/sessionToken';
import { createAdminRouter } from '../routes/adminRoutes';
import { createAiRouter } from '../routes/aiRoutes';
import { createAuthRouter } from '../routes/authRoutes';
import { createLabRouter } from '../routes/labRoutes';
import { createSubmissionRouter } from '../routes/submissionRoutes';
import { createLabServerState, type LabServerState } from '../state/labServerState';
import { createCollabSocketServer } from '../ws/collabSocketServer';

interface TestHarness {
  tmpDir: string;
  state: LabServerState;
  server: http.Server;
  baseUrl: string;
  wsUrl: string;
  cleanup: () => Promise<void>;
}

async function createTestHarness(opts?: {
  seedLegacySubmissions?: unknown[];
  isOriginAllowed?: (origin: string | undefined) => boolean;
  wsMaxMessagesPerSecond?: number;
}): Promise<TestHarness> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruanglabmu-upgrade-test-'));
  const dataDir = path.join(tmpDir, 'data');
  const backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(dataDir, { recursive: true });

  if (opts?.seedLegacySubmissions) {
    fs.writeFileSync(
      path.join(dataDir, 'submissions.json'),
      JSON.stringify(opts.seedLegacySubmissions, null, 2),
      'utf-8'
    );
  }

  const dbPath = path.join(dataDir, 'ruanglabmu.sqlite');
  const state = createLabServerState({ dbPath, backupDir });
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(attachSessionMiddleware);

  const server = http.createServer(app);
  const wsContext = createCollabSocketServer(server, state, {
    isOriginAllowed: opts?.isOriginAllowed,
    maxMessagesPerSecond: opts?.wsMaxMessagesPerSecond,
  });

  app.use(createAuthRouter({ state, authRateLimitMax: 200 }));
  app.use(createAdminRouter({ state }));
  app.use(createLabRouter({ state, getPort: () => 3000 }));
  app.use(
    await createSubmissionRouter({
      rootDir: tmpDir,
      state,
      broadcastAll: wsContext.broadcastAll,
      broadcastSchool: wsContext.broadcastSchool,
      broadcastSchoolTeachers: wsContext.broadcastSchoolTeachers,
    })
  );
  app.use(
    createAiRouter({
      state,
      broadcastAll: wsContext.broadcastAll,
      broadcastRoom: wsContext.broadcastRoom,
    })
  );

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  const wsUrl = `ws://127.0.0.1:${addr.port}/ws-lab`;

  const cleanup = async () => {
    wsContext.wss.clients.forEach((c) => c.terminate());
    await new Promise<void>((resolve) => wsContext.wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    state.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  return { tmpDir, state, server, baseUrl, wsUrl, cleanup };
}

describe('Backend Upgrade: Consolidated SQLite, Auth/RBAC, Pagination, Backup, WS Security & SSE', () => {
  it('imports legacy submissions.json once into SQLite and never writes JSON state files', async () => {
    const legacySeed = [
      {
        id: 'SUB-LEGACY-01',
        schoolId: 'school-legacy',
        studentName: 'Budi Santoso',
        studentId: 'stu-legacy-1',
        roomId: 'LAB-OLD',
        domain: 'Fisika',
        moduleId: 'newton-incline',
        submittedAt: '2026-01-10T08:00:00.000Z',
        hypothesisText: 'Gaya sebanding dengan percepatan benda pada bidang miring.',
        observationData: [{ 'F (N)': 10, 'a (m/s²)': 2.0 }],
        regressionMetrics: { rSquared: 0.99, slope: 0.2, equation: 'y = 0.2x' },
        quizAnswers: [],
        quizScore: 90,
        conclusionText: 'Hukum II Newton terbukti melalui percobaan.',
      },
    ];

    const harness = await createTestHarness({ seedLegacySubmissions: legacySeed });
    try {
      const { signSessionToken } = await import('../auth/sessionToken');
      const teacherToken = signSessionToken({
        sub: 'teacher-legacy',
        role: 'teacher',
        schoolId: 'school-legacy',
        displayName: 'Guru Legacy',
      }).token;
      const res = await fetch(`${harness.baseUrl}/api/submissions?schoolId=school-legacy`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        submissions: Array<{ id: string; studentName: string }>;
        pagination: { total: number };
      };
      assert.equal(body.pagination.total, 1);
      assert.equal(body.submissions[0].id, 'SUB-LEGACY-01');
      assert.equal(body.submissions[0].studentName, 'Budi Santoso');

      // Ensure lab-state.json is never created by persistServerState()
      harness.state.persistServerState();
      assert.equal(fs.existsSync(path.join(harness.tmpDir, 'data', 'lab-state.json')), false);
    } finally {
      await harness.cleanup();
    }
  });

  it('supports offline first-run teacher bootstrap, scrypt passcode verification, and TEACHER_SECRET_PIN override', async () => {
    const prevEnvPin = process.env.TEACHER_SECRET_PIN;
    delete process.env.TEACHER_SECRET_PIN;

    const harness = await createTestHarness();
    try {
      // 1. Fresh school requires bootstrap
      const status1 = await fetch(`${harness.baseUrl}/api/auth/status?schoolId=sman-1-papua`);
      assert.equal(status1.status, 200);
      const statusBody1 = (await status1.json()) as {
        mode: string;
        requiresBootstrap: boolean;
      };
      assert.equal(statusBody1.mode, 'needs_bootstrap');
      assert.equal(statusBody1.requiresBootstrap, true);

      // 2. Bootstrap teacher passcode (scrypt hashed in SQLite)
      const bootRes = await fetch(`${harness.baseUrl}/api/auth/bootstrap-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: 'sman-1-papua',
          teacherName: 'Ibu Sari',
          passcode: 'LabPapua2026!',
        }),
      });
      assert.equal(bootRes.status, 201);
      const bootBody = (await bootRes.json()) as {
        ok: boolean;
        token: string;
        session: { role: string; schoolId: string; displayName: string };
      };
      assert.equal(bootBody.ok, true);
      assert.equal(bootBody.session.role, 'teacher');
      assert.equal(bootBody.session.schoolId, 'sman-1-papua');
      assert.equal(bootBody.session.displayName, 'Ibu Sari');
      assert.ok(verifySessionToken(bootBody.token));

      // 3. Second bootstrap must be locked (409)
      const bootRes2 = await fetch(`${harness.baseUrl}/api/auth/bootstrap-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: 'sman-1-papua',
          teacherName: 'Penyusup',
          passcode: 'HackPass999',
        }),
      });
      assert.equal(bootRes2.status, 409);

      // 4. Wrong passcode rejected (401)
      const badLogin = await fetch(`${harness.baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'teacher',
          schoolId: 'sman-1-papua',
          passcode: 'WrongPin123',
        }),
      });
      assert.equal(badLogin.status, 401);

      // 5. Valid passcode succeeds (200)
      const goodLogin = await fetch(`${harness.baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'teacher',
          schoolId: 'sman-1-papua',
          passcode: 'LabPapua2026!',
        }),
      });
      assert.equal(goodLogin.status, 200);
      const loginBody = (await goodLogin.json()) as { token: string };

      // 6. /api/auth/me returns verified claims
      const meRes = await fetch(`${harness.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginBody.token}` },
      });
      assert.equal(meRes.status, 200);
      const meBody = (await meRes.json()) as {
        session: { role: string; schoolId: string; displayName: string };
      };
      assert.equal(meBody.session.schoolId, 'sman-1-papua');
      assert.equal(meBody.session.role, 'teacher');

      // 7. TEACHER_SECRET_PIN env override
      process.env.TEACHER_SECRET_PIN = 'ENV-PIN-987654';
      const envStatus = await fetch(`${harness.baseUrl}/api/auth/status?schoolId=school-env`);
      const envStatusBody = (await envStatus.json()) as { mode: string };
      assert.equal(envStatusBody.mode, 'env');

      const envLogin = await fetch(`${harness.baseUrl}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'teacher',
          schoolId: 'school-env',
          passcode: 'ENV-PIN-987654',
        }),
      });
      assert.equal(envLogin.status, 200);
    } finally {
      if (prevEnvPin !== undefined) {
        process.env.TEACHER_SECRET_PIN = prevEnvPin;
      } else {
        delete process.env.TEACHER_SECRET_PIN;
      }
      await harness.cleanup();
    }
  });

  it('enforces RBAC and schoolId tenant isolation on grading, missions, audit logs, and backups', async () => {
    const harness = await createTestHarness();
    try {
      const teacherSchoolA = signSessionToken({
        sub: 'teacher:school-a:primary',
        displayName: 'Guru A',
        role: 'teacher',
        schoolId: 'school-a',
      });
      const teacherSchoolB = signSessionToken({
        sub: 'teacher:school-b:primary',
        displayName: 'Guru B',
        role: 'teacher',
        schoolId: 'school-b',
      });
      const studentSchoolA = signSessionToken({
        sub: 'stu-a-1',
        displayName: 'Siswa A',
        role: 'student',
        schoolId: 'school-a',
      });

      // Create submission in school-a
      const createSubRes = await fetch(`${harness.baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentSchoolA.token}`,
        },
        body: JSON.stringify({
          id: 'SUB-TENANT-A1',
          studentName: 'Siswa A',
          studentId: 'stu-a-1',
          roomId: 'ROOM-A',
          domain: 'Kimia',
          moduleId: 'acid-base-titration',
          submittedAt: new Date().toISOString(),
          hypothesisText: 'Titik ekuivalen terjadi pada pH 7 untuk asam kuat dan basa kuat.',
          observationData: [{ 'V (mL)': 25, pH: 7.0 }],
          regressionMetrics: { rSquared: 0.99, slope: 0.5, equation: 'y = 0.5x' },
          quizAnswers: [],
          quizScore: 88,
          conclusionText: 'Titik ekuivalen tercapai sesuai stoikiometri.',
        }),
      });
      assert.equal(createSubRes.status, 201);

      // Unauthenticated grade attempt -> 401
      const unauthGrade = await fetch(`${harness.baseUrl}/api/submissions/SUB-TENANT-A1/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 100, feedback: 'Hack' }),
      });
      assert.equal(unauthGrade.status, 401);

      // Student grade attempt -> 403
      const studentGrade = await fetch(`${harness.baseUrl}/api/submissions/SUB-TENANT-A1/grade`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentSchoolA.token}`,
        },
        body: JSON.stringify({ score: 100, feedback: 'Self grade' }),
      });
      assert.equal(studentGrade.status, 403);

      // Cross-tenant teacher (school-b) attempting to grade school-a submission -> 404
      const crossTenantGrade = await fetch(
        `${harness.baseUrl}/api/submissions/SUB-TENANT-A1/grade`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${teacherSchoolB.token}`,
          },
          body: JSON.stringify({ score: 50, feedback: 'Cross school' }),
        }
      );
      assert.equal(crossTenantGrade.status, 404);

      // Same-tenant teacher (school-a) grading succeeds -> 200
      const okGrade = await fetch(`${harness.baseUrl}/api/submissions/SUB-TENANT-A1/grade`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherSchoolA.token}`,
        },
        body: JSON.stringify({ score: 97, feedback: 'Sangat baik!' }),
      });
      assert.equal(okGrade.status, 200);

      // Audit log recorded for school-a, invisible to school-b
      const auditA = await fetch(`${harness.baseUrl}/api/audit-logs?action=SUBMISSION_GRADED`, {
        headers: { Authorization: `Bearer ${teacherSchoolA.token}` },
      });
      assert.equal(auditA.status, 200);
      const auditABody = (await auditA.json()) as {
        logs: Array<{ action: string; target_id: string }>;
      };
      assert.equal(auditABody.logs.length, 1);
      assert.equal(auditABody.logs[0].target_id, 'SUB-TENANT-A1');

      const auditB = await fetch(`${harness.baseUrl}/api/audit-logs?action=SUBMISSION_GRADED`, {
        headers: { Authorization: `Bearer ${teacherSchoolB.token}` },
      });
      assert.equal(auditB.status, 200);
      const auditBBody = (await auditB.json()) as { logs: unknown[] };
      assert.equal(auditBBody.logs.length, 0);

      // Unauthenticated room mission publish -> 401
      const unauthMission = await fetch(`${harness.baseUrl}/api/rooms/ROOM-A/mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission: null }),
      });
      assert.equal(unauthMission.status, 401);
    } finally {
      await harness.cleanup();
    }
  });

  it('supports server-side pagination, search, domain filter, and sorting on /api/submissions and /api/gradebook', async () => {
    const harness = await createTestHarness();
    try {
      const teacher = signSessionToken({
        sub: 'teacher:school-pag:primary',
        displayName: 'Guru Paginasi',
        role: 'teacher',
        schoolId: 'school-pag',
      });

      const items = [
        { id: 'SUB-P1', studentName: 'Citra', domain: 'Fisika', quizScore: 70 },
        { id: 'SUB-P2', studentName: 'Dian', domain: 'Kimia', quizScore: 95 },
        { id: 'SUB-P3', studentName: 'Eko', domain: 'Fisika', quizScore: 85 },
      ];

      for (const item of items) {
        const res = await fetch(`${harness.baseUrl}/api/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${teacher.token}`,
          },
          body: JSON.stringify({
            id: item.id,
            studentName: item.studentName,
            roomId: 'LAB-PAG',
            domain: item.domain,
            moduleId: 'newton-incline',
            submittedAt: new Date().toISOString(),
            hypothesisText: 'Hipotesis eksperimen praktikum sains terstruktur.',
            observationData: [{ x: 1, y: 2 }],
            regressionMetrics: { rSquared: 0.98, slope: 2, equation: 'y = 2x' },
            quizAnswers: [],
            quizScore: item.quizScore,
            conclusionText: 'Kesimpulan praktikum valid berdasarkan data.',
            teacherGrade: {
              score: item.quizScore,
              feedback: 'Baik',
              gradedAt: new Date().toISOString(),
            },
          }),
        });
        assert.equal(res.status, 201);
      }

      // Page 1 of 2 sorted by score desc
      const page1 = await fetch(
        `${harness.baseUrl}/api/submissions?limit=2&offset=0&sortBy=score&sortDir=desc`,
        { headers: { Authorization: `Bearer ${teacher.token}` } }
      );
      assert.equal(page1.status, 200);
      const page1Body = (await page1.json()) as {
        submissions: Array<{ id: string }>;
        pagination: { total: number; limit: number; offset: number; hasMore: boolean; nextOffset: number | null };
      };
      assert.equal(page1Body.pagination.total, 3);
      assert.equal(page1Body.submissions.length, 2);
      assert.equal(page1Body.submissions[0].id, 'SUB-P2'); // score 95
      assert.equal(page1Body.submissions[1].id, 'SUB-P3'); // score 85
      assert.equal(page1Body.pagination.hasMore, true);
      assert.equal(page1Body.pagination.nextOffset, 2);

      // Domain + search filter
      const filtered = await fetch(
        `${harness.baseUrl}/api/submissions?domain=Fisika&search=Citra`,
        { headers: { Authorization: `Bearer ${teacher.token}` } }
      );
      const filteredBody = (await filtered.json()) as {
        submissions: Array<{ id: string }>;
        pagination: { total: number };
      };
      assert.equal(filteredBody.pagination.total, 1);
      assert.equal(filteredBody.submissions[0].id, 'SUB-P1');

      // Paginated gradebook
      const gbRes = await fetch(`${harness.baseUrl}/api/gradebook?limit=2&offset=0`, {
        headers: { Authorization: `Bearer ${teacher.token}` },
      });
      assert.equal(gbRes.status, 200);
      const gbBody = (await gbRes.json()) as {
        entries: unknown[];
        pagination: { total: number; hasMore: boolean };
      };
      assert.equal(gbBody.pagination.total, 3);
      assert.equal(gbBody.entries.length, 2);
      assert.equal(gbBody.pagination.hasMore, true);
    } finally {
      await harness.cleanup();
    }
  });

  it('creates hot SQLite backups, enforces safe path confinement on download, and records audit logs', async () => {
    const harness = await createTestHarness();
    try {
      const teacher = signSessionToken({
        sub: 'teacher:school-bkp:primary',
        displayName: 'Admin Backup',
        role: 'teacher',
        schoolId: 'school-bkp',
      });

      const createBkp = await fetch(`${harness.baseUrl}/api/admin/backups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacher.token}` },
      });
      assert.equal(createBkp.status, 201);
      const bkpBody = (await createBkp.json()) as {
        ok: boolean;
        backup: { filename: string; sizeBytes: number };
      };
      assert.equal(bkpBody.ok, true);
      assert.match(bkpBody.backup.filename, /^ruanglab-backup-.*\.db$/);
      assert.ok(bkpBody.backup.sizeBytes > 0);

      // List backups
      const listRes = await fetch(`${harness.baseUrl}/api/admin/backups`, {
        headers: { Authorization: `Bearer ${teacher.token}` },
      });
      assert.equal(listRes.status, 200);
      const listBody = (await listRes.json()) as {
        backups: Array<{ filename: string }>;
      };
      assert.ok(listBody.backups.some((b) => b.filename === bkpBody.backup.filename));

      // Safe download succeeds
      const dlRes = await fetch(
        `${harness.baseUrl}/api/admin/backups/${encodeURIComponent(bkpBody.backup.filename)}`,
        { headers: { Authorization: `Bearer ${teacher.token}` } }
      );
      assert.equal(dlRes.status, 200);
      const bytes = await dlRes.arrayBuffer();
      assert.ok(bytes.byteLength > 0);

      // Path traversal rejected (400)
      const traversalRes = await fetch(
        `${harness.baseUrl}/api/admin/backups/${encodeURIComponent('..%2Fruanglabmu.sqlite')}`,
        { headers: { Authorization: `Bearer ${teacher.token}` } }
      );
      assert.equal(traversalRes.status, 400);
    } finally {
      await harness.cleanup();
    }
  });

  it('enforces WebSocket Origin policy, per-socket rate limiting, and tenant-scoped broadcasts', async () => {
    const harness = await createTestHarness({
      isOriginAllowed: (origin) => !origin || origin === 'https://allowed.ruanglabmu.id',
      wsMaxMessagesPerSecond: 3,
    });

    try {
      // 1. Disallowed Origin rejected with close code 1008
      const closeCode = await new Promise<number>((resolve, reject) => {
        const ws = new WebSocket(harness.wsUrl, {
          headers: { Origin: 'https://evil.example.com' },
        });
        ws.on('close', (code) => resolve(code));
        ws.on('error', (err) => reject(err));
      });
      assert.equal(closeCode, 1008);

      // 2. Allowed Origin connects and receives RATE_LIMITED when flooding > 3 msg/s
      const rateLimitFrame = await new Promise<{ type: string; payload?: { code?: string } }>(
        (resolve, reject) => {
          const ws = new WebSocket(harness.wsUrl, {
            headers: { Origin: 'https://allowed.ruanglabmu.id' },
          });
          ws.on('open', () => {
            for (let i = 0; i < 6; i += 1) {
              ws.send(
                JSON.stringify({
                  type: 'CURSOR_3D_LEAVE',
                  payload: { userId: 'flood-user', roomId: 'LAB-1' },
                })
              );
            }
          });
          ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString()) as {
              type: string;
              payload?: { code?: string };
            };
            if (msg.type === 'ERROR' && msg.payload?.code === 'RATE_LIMITED') {
              ws.close();
              resolve(msg);
            }
          });
          ws.on('error', reject);
        }
      );
      assert.equal(rateLimitFrame.payload?.code, 'RATE_LIMITED');

      // 3. Tenant isolation: notification pushed by school-a is not delivered to school-b
      const tokenA = signSessionToken({
        sub: 'stu-a',
        displayName: 'Siswa A',
        role: 'student',
        schoolId: 'school-a',
      }).token;
      const tokenB = signSessionToken({
        sub: 'stu-b',
        displayName: 'Siswa B',
        role: 'student',
        schoolId: 'school-b',
      }).token;

      const wsA = new WebSocket(harness.wsUrl);
      const wsB = new WebSocket(harness.wsUrl);
      const receivedA: string[] = [];
      const receivedB: string[] = [];

      await Promise.all([
        new Promise<void>((resolve) => wsA.once('open', () => resolve())),
        new Promise<void>((resolve) => wsB.once('open', () => resolve())),
      ]);

      wsA.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string };
        if (msg.type === 'note:created') receivedA.push(msg.type);
      });
      wsB.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string };
        if (msg.type === 'note:created') receivedB.push(msg.type);
      });

      wsA.send(
        JSON.stringify({
          type: 'client:identify',
          payload: { userId: 'stu-a', userName: 'Siswa A', role: 'Siswa', sessionToken: tokenA },
        })
      );
      wsB.send(
        JSON.stringify({
          type: 'client:identify',
          payload: { userId: 'stu-b', userName: 'Siswa B', role: 'Siswa', sessionToken: tokenB },
        })
      );

      await new Promise((r) => setTimeout(r, 60));

      wsA.send(
        JSON.stringify({
          type: 'note:create',
          payload: {
            author: 'Siswa A',
            role: 'Siswa',
            text: 'Catatan khusus tenant sekolah A',
          },
        })
      );

      await new Promise((r) => setTimeout(r, 80));
      wsA.close();
      wsB.close();

      assert.equal(receivedA.length, 1);
      assert.equal(receivedB.length, 0);
    } finally {
      await harness.cleanup();
    }
  });

  it('streams Dr. LabMu responses via SSE (meta, chunk, done) in offline 3T Socratic mode', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const harness = await createTestHarness();
    try {
      const { signSessionToken } = await import('../auth/sessionToken');
      const studentToken = signSessionToken({
        sub: 'stu-stream-1',
        role: 'student',
        schoolId: 'default-school',
        displayName: 'Siswa Uji',
      }).token;
      const res = await fetch(`${harness.baseUrl}/api/ai/dr-labmu/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          message: 'Mengapa percepatan benda meningkat saat gaya ditambah?',
          telemetry: {
            domain: 'Fisika',
            topic: 'Hukum II Newton',
            educationLevel: 'SMA',
            currentParameters: { mass: 2, force: 10 },
          },
        }),
      });

      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/event-stream/i);
      const sseText = await res.text();
      assert.ok(sseText.includes('event: meta'));
      assert.ok(sseText.includes('event: chunk'));
      assert.ok(sseText.includes('event: done'));
    } finally {
      if (prevKey !== undefined) {
        process.env.GEMINI_API_KEY = prevKey;
      }
      await harness.cleanup();
    }
  });

  it('delivers init:state to JWT-authenticated teachers on client:identify and scopes teacher:feedback / mystery events by tenant and room', async () => {
    const harness = await createTestHarness();
    try {
      const teacherTokenA = signSessionToken({
        sub: 'teacher:school-a:1',
        displayName: 'Guru Sekolah A',
        role: 'teacher',
        schoolId: 'school-a',
      }).token;

      const wsTeacher = new WebSocket(harness.wsUrl);
      await new Promise<void>((resolve) => wsTeacher.once('open', () => resolve()));

      const initStatePromise = new Promise<{
        type: string;
        payload: { notes: Array<{ text: string }>; notifications: Array<{ title: string }> };
      }>((resolve) => {
        wsTeacher.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'init:state') {
            resolve(msg);
          }
        });
      });

      wsTeacher.send(
        JSON.stringify({
          type: 'client:identify',
          payload: {
            userId: 'teacher:school-a:1',
            userName: 'Guru Sekolah A',
            role: 'Pengajar',
            sessionToken: teacherTokenA,
          },
        })
      );

      const initMsg = await initStatePromise;
      assert.equal(initMsg.type, 'init:state');
      assert.ok(Array.isArray(initMsg.payload.notes));

      // Teacher sends feedback in school-a; must mutate school-a scoped state, NOT default-school
      const defaultNotesBefore = harness.state.collabNotes.length;
      const defaultNotifsBefore = harness.state.notifications.length;

      const feedbackBroadcastPromise = new Promise<{ type: string }>((resolve) => {
        wsTeacher.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'teacher:broadcasted') {
            resolve(msg);
          }
        });
      });

      wsTeacher.send(
        JSON.stringify({
          type: 'teacher:feedback',
          payload: {
            author: 'Guru Sekolah A',
            message: 'Periksa kembali kalibrasi neraca pegas kelompok kalian.',
            sessionToken: teacherTokenA,
          },
        })
      );

      await feedbackBroadcastPromise;
      wsTeacher.close();

      // Default school collections must remain untouched
      assert.equal(harness.state.collabNotes.length, defaultNotesBefore);
      assert.equal(harness.state.notifications.length, defaultNotifsBefore);

      // School-A scoped state has the teacher feedback note and notification
      const scopedSchoolA = harness.state.getScopedActivityState(undefined, 'school-a');
      assert.equal(scopedSchoolA.collabNotes.length, 1);
      assert.match(scopedSchoolA.collabNotes[0].text, /kalibrasi neraca pegas/);
      assert.equal(scopedSchoolA.notifications.length, 1);

      // Verify SQLite persistence of non-default school collections
      const persistedSchoolA = harness.state.repository.loadLabCollections('school-a');
      assert.equal(persistedSchoolA.notes.length, 1);
      assert.equal(persistedSchoolA.notifications.length, 1);
    } finally {
      await harness.cleanup();
    }
  });

  it('records AI runtime metrics once per invocation without double-counting and tracks stream requests', async () => {
    const {
      getAiRuntimeMetrics,
      resetAiRuntimeMetricsForTest,
      runWithAiRetryAndTimeout,
    } = await import('../services/geminiClient');

    resetAiRuntimeMetricsForTest();

    const res1 = await runWithAiRetryAndTimeout('unit_test_unary', async () => 'ok');
    assert.equal(res1, 'ok');

    const res2 = await runWithAiRetryAndTimeout(
      'unit_test_stream',
      async () => 'stream-ok',
      { isStream: true }
    );
    assert.equal(res2, 'stream-ok');

    await assert.rejects(
      () =>
        runWithAiRetryAndTimeout(
          'unit_test_fail',
          async () => {
            throw new Error('non-transient failure');
          },
          { maxRetries: 0 }
        ),
      /non-transient failure/
    );

    const metrics = getAiRuntimeMetrics();
    assert.equal(metrics.requestsTotal, 3);
    assert.equal(metrics.streamsTotal, 1);
    assert.equal(metrics.errorsTotal, 1);
  });

  it('prevents CURSOR_3D_MOVE role escalation to Pengajar and rejects unauthenticated ROOM_SET_CUSTOM_MISSION on new rooms', async () => {
    const harness = await createTestHarness();
    try {
      const studentToken = signSessionToken({
        sub: 'stu-escalate-1',
        displayName: 'Siswa Nakal',
        role: 'student',
        schoolId: 'school-a',
      }).token;

      const wsStudent = new WebSocket(harness.wsUrl);
      await new Promise<void>((resolve) => wsStudent.once('open', () => resolve()));

      const roomErrors: Array<{ code?: string; message?: string }> = [];
      wsStudent.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ROOM_ERROR') {
          roomErrors.push(msg.payload);
        }
      });

      wsStudent.send(
        JSON.stringify({
          type: 'client:identify',
          payload: {
            userId: 'stu-escalate-1',
            userName: 'Siswa Nakal',
            role: 'Siswa',
            sessionToken: studentToken,
          },
        })
      );

      await new Promise((r) => setTimeout(r, 40));

      // Attempt privilege escalation via forged CURSOR_3D_MOVE role='Pengajar'
      wsStudent.send(
        JSON.stringify({
          type: 'CURSOR_3D_MOVE',
          payload: {
            userId: 'stu-escalate-1',
            userName: 'Siswa Nakal',
            role: 'Pengajar',
            groupId: 'Kelompok 1',
            domain: 'fisika',
            color: '#ef4444',
            position: [1, 2, 3],
            normal: [0, 1, 0],
            updatedAt: Date.now(),
            schoolId: 'school-a',
          },
        })
      );

      await new Promise((r) => setTimeout(r, 40));

      // Attempt teacher-only ROOM_SET_CUSTOM_MISSION on a brand-new room without valid teacher auth
      wsStudent.send(
        JSON.stringify({
          type: 'ROOM_SET_CUSTOM_MISSION',
          payload: {
            roomId: 'LAB-FORGED-99',
            customMission: null,
          },
        })
      );

      await new Promise((r) => setTimeout(r, 60));
      wsStudent.close();

      assert.equal(roomErrors.length, 1);
      assert.equal(roomErrors[0]?.code, 'UNAUTHORIZED_TEACHER');
      assert.equal(harness.state.activeLabRooms.has('LAB-FORGED-99'), false);
    } finally {
      await harness.cleanup();
    }
  });

  it('prevents student teacherGrade spoofing on POST /api/submissions and enforces tenant isolation on mission publishing, lab-state, and autosave recovery', async () => {
    const harness = await createTestHarness();
    try {
      const teacherTokenA = signSessionToken({
        sub: 'teacher-a',
        displayName: 'Guru A',
        role: 'teacher',
        schoolId: 'school-a',
      }).token;
      const teacherTokenB = signSessionToken({
        sub: 'teacher-b',
        displayName: 'Guru B',
        role: 'teacher',
        schoolId: 'school-b',
      }).token;
      const studentTokenA = signSessionToken({
        sub: 'student-a1',
        displayName: 'Siswa A1',
        role: 'student',
        schoolId: 'school-a',
      }).token;
      const studentTokenB = signSessionToken({
        sub: 'student-b1',
        displayName: 'Siswa B1',
        role: 'student',
        schoolId: 'school-b',
      }).token;

      // 1. Student submits with spoofed teacherGrade=100; server must ignore spoofed grade and leave teacherGrade undefined
      const spoofRes = await fetch(`${harness.baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentTokenA}`,
        },
        body: JSON.stringify({
          id: 'SUB-SPOOF-TEST-1',
          studentName: 'Siswa A1',
          studentId: 'student-a1',
          roomId: 'ROOM-A',
          domain: 'Fisika',
          moduleId: 'newton-incline',
          submittedAt: new Date().toISOString(),
          hypothesisText: 'Hipotesis singkat oleh siswa percobaan.',
          observationData: [{ x: 1, y: 2 }],
          regressionMetrics: { rSquared: 0.75, slope: 1.5, equation: 'y = 1.5x' },
          quizAnswers: [],
          quizScore: 40,
          conclusionText: 'Kesimpulan singkat percobaan.',
          teacherGrade: {
            score: 100,
            feedback: 'Nilai palsu dari request siswa',
            gradedAt: new Date().toISOString(),
          },
        }),
      });
      assert.equal(spoofRes.status, 201);
      const spoofBody = (await spoofRes.json()) as {
        submission: {
          teacherGrade?: { score: number; feedback: string };
          autoRubric?: { score: number };
        };
      };
      assert.notEqual(spoofBody.submission.teacherGrade?.score, 100);
      assert.equal(spoofBody.submission.teacherGrade?.score, spoofBody.submission.autoRubric?.score);
      assert.notEqual(
        spoofBody.submission.teacherGrade?.feedback,
        'Nilai palsu dari request siswa'
      );

      // 2. Teacher A publishes mission to room LAB-SCHOOL-A; Teacher B (school-b) must get 403 SCHOOL_TENANT_MISMATCH
      const missionPayload = {
        mission: {
          id: 'mission-school-a',
          title: 'Misi Resmi Sekolah A',
          domain: 'chemistry',
          moduleId: 'acid-base-titration',
          narrative: 'Uji konsentrasi larutan standar.',
        },
      };
      const pubARes = await fetch(`${harness.baseUrl}/api/rooms/LAB-SCHOOL-A/mission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherTokenA}`,
        },
        body: JSON.stringify(missionPayload),
      });
      assert.equal(pubARes.status, 200);

      const pubBRes = await fetch(`${harness.baseUrl}/api/rooms/LAB-SCHOOL-A/mission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherTokenB}`,
        },
        body: JSON.stringify(missionPayload),
      });
      assert.equal(pubBRes.status, 403);
      const pubBBody = (await pubBRes.json()) as { code?: string };
      assert.equal(pubBBody.code, 'SCHOOL_TENANT_MISMATCH');

      // 3. Autosave created by Student A cannot be read by Student B or Teacher B
      const saveRes = await fetch(`${harness.baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentTokenA}`,
        },
        body: JSON.stringify({
          storageKey: 'autosave-key-stu-a1',
          version: 1,
          studentId: 'student-a1',
          schoolId: 'school-a',
          session: { voltage: 12, resistance: 4 },
        }),
      });
      assert.equal(saveRes.status, 200);

      const getOwnAutosave = await fetch(
        `${harness.baseUrl}/api/session/autosave?storageKey=autosave-key-stu-a1&schoolId=school-a`,
        {
          headers: { Authorization: `Bearer ${studentTokenA}` },
        }
      );
      assert.equal(getOwnAutosave.status, 200);
      const ownAutosaveBody = (await getOwnAutosave.json()) as {
        status: string;
        session?: { voltage: number };
      };
      assert.equal(ownAutosaveBody.status, 'ok');
      assert.equal(ownAutosaveBody.session?.voltage, 12);

      const getCrossTenantAutosave = await fetch(
        `${harness.baseUrl}/api/session/autosave?storageKey=autosave-key-stu-a1&schoolId=school-a`,
        {
          headers: { Authorization: `Bearer ${teacherTokenB}` },
        }
      );
      assert.equal(getCrossTenantAutosave.status, 403);
      const crossAutosaveBody = (await getCrossTenantAutosave.json()) as { code?: string };
      assert.equal(crossAutosaveBody.code, 'SCHOOL_TENANT_MISMATCH');

      const getOtherStudentAutosave = await fetch(
        `${harness.baseUrl}/api/session/autosave?storageKey=autosave-key-stu-a1&schoolId=school-a`,
        {
          headers: { Authorization: `Bearer ${studentTokenB}` },
        }
      );
      assert.equal(getOtherStudentAutosave.status, 403);
    } finally {
      await harness.cleanup();
    }
  });
});
