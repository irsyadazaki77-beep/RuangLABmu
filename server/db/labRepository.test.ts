import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqliteLabRepository } from './database';
import { DEFAULT_SCHOOL_ID } from './LabRepository';
import { createLabServerState } from '../state/labServerState';
import { createLabRouter } from '../routes/labRoutes';
import { createSubmissionRouter } from '../routes/submissionRoutes';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('Multi-Tenant LabRepository, Migration 002 & Idempotency Keys', () => {
  it('seeds default-school in migration 002 and isolates rooms, gradebook, submissions, and autosaves by school_id', () => {
    const repo = new SqliteLabRepository(':memory:');
    try {
      const defaultSchool = repo.getSchoolById(DEFAULT_SCHOOL_ID);
      assert.ok(defaultSchool);
      assert.equal(defaultSchool.slug, 'default-school');

      repo.ensureSchool({ id: 'sman-1-ambon', name: 'SMAN 1 Ambon', slug: 'sman-1-ambon' });
      repo.ensureSchool({ id: 'sman-2-kupang', name: 'SMAN 2 Kupang', slug: 'sman-2-kupang' });

      // Rooms isolated by school_id
      repo.upsertRoom({
        pin: '111222',
        schoolId: 'sman-1-ambon',
        hostId: 'guru-ambon',
        moduleDomain: 'physics:newton-incline',
        status: 'active',
      });
      repo.upsertRoom({
        pin: '333444',
        schoolId: 'sman-2-kupang',
        hostId: 'guru-kupang',
        moduleDomain: 'chemistry:acid-base-titration',
        status: 'active',
      });

      const ambonRooms = repo.listActiveRooms(Date.now(), 'sman-1-ambon');
      const kupangRooms = repo.listActiveRooms(Date.now(), 'sman-2-kupang');
      assert.equal(ambonRooms.length, 1);
      assert.equal(ambonRooms[0].pin, '111222');
      assert.equal(kupangRooms.length, 1);
      assert.equal(kupangRooms[0].pin, '333444');
      assert.equal(repo.getRoomByPin('111222', 'sman-2-kupang'), null);

      // Submissions isolated by school_id
      repo.upsertSubmission({
        id: 'SUB-AMBON-1',
        schoolId: 'sman-1-ambon',
        roomId: '111222',
        studentId: 'stu-ambon',
        studentName: 'Yohanes Pattimura',
        domain: 'Fisika',
        moduleId: 'newton-incline',
        score: 91,
        payloadJson: JSON.stringify({ id: 'SUB-AMBON-1' }),
        submittedAt: new Date().toISOString(),
      });
      repo.upsertSubmission({
        id: 'SUB-KUPANG-1',
        schoolId: 'sman-2-kupang',
        roomId: '333444',
        studentId: 'stu-kupang',
        studentName: 'Maria Lopo',
        domain: 'Kimia',
        moduleId: 'acid-base-titration',
        score: 88,
        payloadJson: JSON.stringify({ id: 'SUB-KUPANG-1' }),
        submittedAt: new Date().toISOString(),
      });

      assert.equal(repo.listSubmissions('sman-1-ambon').length, 1);
      assert.equal(repo.listSubmissions('sman-2-kupang').length, 1);
      assert.equal(repo.getSubmissionById('SUB-AMBON-1', 'sman-2-kupang'), null);

      // Autosaves isolated by school_id
      repo.upsertAutosave({
        storageKey: 'ruanglab_session_yohanes_newton-incline',
        schoolId: 'sman-1-ambon',
        studentId: 'yohanes',
        version: 3,
        sessionJson: JSON.stringify({ step: 3 }),
      });
      assert.ok(repo.getAutosaveByKey('ruanglab_session_yohanes_newton-incline', 'sman-1-ambon'));
      assert.equal(
        repo.getAutosaveByKey('ruanglab_session_yohanes_newton-incline', 'sman-2-kupang'),
        null
      );

      // Gradebook entries isolated by school_id
      repo.upsertGradebookEntry({
        id: 'GB-AMBON-1',
        schoolId: 'sman-1-ambon',
        roomPin: '111222',
        studentId: 'stu-ambon',
        studentName: 'Yohanes Pattimura',
        moduleId: 'newton-incline',
        score: 91,
      });
      repo.upsertGradebookEntry({
        id: 'GB-KUPANG-1',
        schoolId: 'sman-2-kupang',
        roomPin: '333444',
        studentId: 'stu-kupang',
        studentName: 'Maria Lopo',
        moduleId: 'acid-base-titration',
        score: 88,
      });
      assert.equal(repo.listGradebookEntries(undefined, 'sman-1-ambon').length, 1);
      assert.equal(repo.listGradebookEntries(undefined, 'sman-2-kupang').length, 1);
    } finally {
      repo.close();
    }
  });

  it('replays duplicate clientMutationId requests idempotently on POST /api/submissions and POST /api/session/autosave and filters GET by schoolId', async () => {
    const tmpDir = createTempDir('ruanglabmu-idempotency-routes-');
    const dbFile = path.join(tmpDir, 'lab.db');
    const state = createLabServerState({ dbPath: dbFile });

    const app = express();
    app.use(express.json());
    app.use(createLabRouter({ state, getPort: () => 0 }));
    app.use(
      await createSubmissionRouter({
        rootDir: tmpDir,
        state,
        broadcastAll: () => {},
      })
    );

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // 1. Duplicate submission with same clientMutationId returns identical ticketCode without duplicate rows
      const subMutationId = crypto.randomUUID();
      const subPayload = {
        schoolId: 'school-ntt-01',
        clientMutationId: subMutationId,
        studentName: 'Petrus Ndolu',
        studentId: 'stu-ntt-1',
        roomId: 'LAB-NTT',
        domain: 'Fisika',
        moduleId: 'newton-incline',
        hypothesisText: 'Gaya berbanding lurus dengan percepatan.',
        conclusionText: 'Terbukti dari grafik F vs a dengan R² mendekati 1.',
        quizScore: 90,
      };

      const res1 = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subPayload),
      });
      assert.equal(res1.status, 201);
      const json1 = (await res1.json()) as { ticketCode: string; schoolId: string };
      assert.equal(json1.schoolId, 'school-ntt-01');

      const res2 = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subPayload),
      });
      assert.equal(res2.status, 200);
      const json2 = (await res2.json()) as {
        ticketCode: string;
        idempotentReplay?: boolean;
      };
      assert.equal(json2.ticketCode, json1.ticketCode);
      assert.equal(json2.idempotentReplay, true);

      // Verify schoolId query filtering on GET /api/submissions and GET /api/gradebook
      const listSchoolNtt = await fetch(`${baseUrl}/api/submissions?schoolId=school-ntt-01`);
      const listSchoolNttJson = (await listSchoolNtt.json()) as {
        submissions: Array<{ id: string }>;
      };
      assert.equal(listSchoolNttJson.submissions.length, 1);
      assert.equal(listSchoolNttJson.submissions[0].id, json1.ticketCode);

      const listOtherSchool = await fetch(`${baseUrl}/api/submissions?schoolId=school-other`);
      const listOtherJson = (await listOtherSchool.json()) as {
        submissions: Array<{ id: string }>;
      };
      assert.equal(listOtherJson.submissions.length, 0);

      // 2. Duplicate autosave with same clientMutationId replays cached response cleanly
      const autoMutationId = crypto.randomUUID();
      const autoPayload = {
        storageKey: 'ruanglab_session_petrus_newton-incline',
        schoolId: 'school-ntt-01',
        clientMutationId: autoMutationId,
        version: 4,
        studentId: 'petrus',
        session: { studentId: 'petrus', moduleId: 'newton-incline', activeWorkflowStep: 2 },
      };

      const auto1 = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'tok-petrus-1',
        },
        body: JSON.stringify(autoPayload),
      });
      assert.equal(auto1.status, 200);
      const autoJson1 = (await auto1.json()) as { savedAt: number; version: number };

      const auto2 = await fetch(`${baseUrl}/api/session/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': 'tok-petrus-1',
        },
        body: JSON.stringify(autoPayload),
      });
      assert.equal(auto2.status, 200);
      const autoJson2 = (await auto2.json()) as {
        savedAt: number;
        version: number;
        idempotentReplay?: boolean;
      };
      assert.equal(autoJson2.savedAt, autoJson1.savedAt);
      assert.equal(autoJson2.idempotentReplay, true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      state.dispose();
    }
  });
});
