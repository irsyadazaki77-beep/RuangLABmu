import express from 'express';
import fs from 'fs';
import path from 'path';
import { rateLimit } from 'express-rate-limit';
import { AsyncSubmissionStore } from '../../src/utils/submissionPersistence';
import {
  evaluateSubmissionRubric,
  parseRubricJson,
  serializeRubricJson,
  type EvaluatedRubricReport,
} from '../../src/shared/grading/rubricEngine';
import type { LabServerState, ServerNotification } from '../state/labServerState';
import {
  formatValidationErrorResponse,
  validateCreateSubmissionPayload,
  validateGradebookQuery,
  validateGradeSubmissionPayload,
  validateSubmissionsQuery,
} from '../utils/routePayloadValidators';
import { DEFAULT_SCHOOL_ID } from '../db/LabRepository';
import { rateLimitKeyGenerator } from '../utils/rateLimitKey';
import { logger } from '../utils/logger';

export interface LabSubmissionRecord {
  id: string;
  schoolId?: string;
  studentName: string;
  studentId?: string;
  roomId?: string;
  roomPin?: string;
  domain: string;
  moduleId: string;
  submittedAt: string;
  hypothesisText: string;
  observationData: Array<Record<string, number | string>>;
  regressionMetrics: { rSquared: number; slope: number; equation: string };
  quizAnswers: Array<{
    questionId: string;
    selectedAnswer: number | string;
    isCorrect: boolean;
  }>;
  quizScore: number;
  conclusionText: string;
  telemetryLog?: Array<{
    timestamp: number;
    parameterName: string;
    value: number;
    stepIndex: number;
    domain?: string;
    eventType?: string;
    note?: string;
  }>;
  autoRubric?: EvaluatedRubricReport;
  rubricJson?: string;
  teacherGrade?: { score: number; feedback: string; gradedAt: string };
}

export interface SubmissionRoutesDeps {
  rootDir: string;
  state: LabServerState;
  broadcastAll: (payload: unknown) => void;
}

export async function createSubmissionRouter({
  rootDir,
  state,
  broadcastAll,
}: SubmissionRoutesDeps): Promise<express.Router> {
  const router = express.Router();

  const submissionsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    message: {
      error:
        'Terlalu banyak pengiriman laporan dalam 1 menit (maksimal 30 permintaan/menit).',
    },
  });

  router.use('/api/submissions', submissionsLimiter);

  const DATA_DIR = path.join(rootDir, 'data');
  const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

  const seedRubric = evaluateSubmissionRubric({
    moduleId: 'newton-incline',
    domain: 'physics',
    hypothesisText:
      'Percepatan benda berbanding lurus dengan resultan gaya dan berbanding terbalik dengan massa total.',
    observationData: [
      { 'No / ID': '1', 'F (N)': 15, 'a (m/s²)': 2.45, Status: 'Valid' },
      { 'No / ID': '2', 'F (N)': 30, 'a (m/s²)': 4.9, Status: 'Valid' },
      { 'No / ID': '3', 'F (N)': 45, 'a (m/s²)': 7.3, Status: 'Valid' },
    ],
    regressionMetrics: {
      rSquared: 0.998,
      slope: 0.162,
      equation: 'y = 0.162x + 0.015',
    },
    quizScore: 95,
    conclusionText:
      'Data hasil percobaan membuktikan keabsahan Hukum II Newton secara empiris dengan korelasi R² = 0.998.',
  });

  const initialSubmissionsSeed: LabSubmissionRecord[] = [
    {
      id: 'SUB-2026-001',
      studentName: 'Alya Pratama',
      studentId: 'stu-1',
      roomId: 'LAB-ALPHA',
      domain: 'Fisika',
      moduleId: 'newton-incline',
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      hypothesisText:
        'Percepatan benda berbanding lurus dengan resultan gaya dan berbanding terbalik dengan massa total.',
      observationData: [
        { 'No / ID': '1', 'F (N)': 15, 'a (m/s²)': 2.45, Status: 'Valid' },
        { 'No / ID': '2', 'F (N)': 30, 'a (m/s²)': 4.9, Status: 'Valid' },
        { 'No / ID': '3', 'F (N)': 45, 'a (m/s²)': 7.3, Status: 'Valid' },
      ],
      regressionMetrics: {
        rSquared: 0.998,
        slope: 0.162,
        equation: 'y = 0.162x + 0.015',
      },
      quizAnswers: [
        { questionId: 'q-newton-1', selectedAnswer: '9.0', isCorrect: true },
        { questionId: 'q-collision-2', selectedAnswer: '4.0', isCorrect: true },
      ],
      quizScore: 95,
      conclusionText:
        'Data hasil percobaan membuktikan keabsahan Hukum II Newton secara empiris dengan korelasi R² = 0.998.',
      autoRubric: seedRubric,
      rubricJson: serializeRubricJson(seedRubric),
      telemetryLog: [
        {
          timestamp: Date.now() - 3900000,
          parameterName: 'inclineAngle',
          value: 15,
          stepIndex: 1,
          domain: 'Fisika',
          eventType: 'slider',
          note: 'Mengatur sudut kemiringan bidang miring θ = 15°',
        },
        {
          timestamp: Date.now() - 3840000,
          parameterName: 'appliedForce',
          value: 15,
          stepIndex: 2,
          domain: 'Fisika',
          eventType: 'record',
          note: 'Mencatat titik uji 1 (F = 15 N, a = 2.45 m/s²)',
        },
        {
          timestamp: Date.now() - 3780000,
          parameterName: 'appliedForce',
          value: 30,
          stepIndex: 2,
          domain: 'Fisika',
          eventType: 'record',
          note: 'Mencatat titik uji 2 (F = 30 N, a = 4.90 m/s²)',
        },
        {
          timestamp: Date.now() - 3720000,
          parameterName: 'appliedForce',
          value: 45,
          stepIndex: 2,
          domain: 'Fisika',
          eventType: 'record',
          note: 'Mencatat titik uji 3 (F = 45 N, a = 7.30 m/s²)',
        },
        {
          timestamp: Date.now() - 3650000,
          parameterName: 'regressionR2',
          value: 0.998,
          stepIndex: 3,
          domain: 'Fisika',
          eventType: 'record',
          note: 'Menyelesaikan regresi OLS (R² = 0.998) & LKS',
        },
      ],
      teacherGrade: {
        score: 96,
        feedback:
          'Analisis regresi luar biasa teliti, penarikan kesimpulan ilmiah sangat komprehensif!',
        gradedAt: new Date(Date.now() - 1800000).toISOString(),
      },
    },
  ];

  // Ensure data/ directory and data/submissions.json exist asynchronously without blocking
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.promises.access(SUBMISSIONS_FILE);
  } catch {
    await fs.promises.writeFile(SUBMISSIONS_FILE, '[]\n', 'utf-8');
  }

  const submissionStore = new AsyncSubmissionStore<LabSubmissionRecord>(
    SUBMISSIONS_FILE,
    initialSubmissionsSeed
  );
  const submissionsList: LabSubmissionRecord[] = await submissionStore.init();
  if (submissionsList.length === 0 && initialSubmissionsSeed.length > 0) {
    submissionsList.push(...initialSubmissionsSeed);
  }

  // Merge any persisted SQLite repository submissions and ensure gradebook sync
  const dbSubmissions = state.repository.listSubmissions();
  const seenIds = new Set(submissionsList.map((s) => s.id));
  for (const row of dbSubmissions) {
    if (!seenIds.has(row.id)) {
      try {
        const parsed = JSON.parse(row.payload_json) as LabSubmissionRecord;
        submissionsList.push({
          ...parsed,
          schoolId: row.school_id || parsed.schoolId || DEFAULT_SCHOOL_ID,
        });
        seenIds.add(row.id);
      } catch {
        // Ignore malformed legacy payload_json
      }
    }
  }

  for (const sub of submissionsList) {
    if (!sub.schoolId) {
      sub.schoolId = DEFAULT_SCHOOL_ID;
    }
    if (!sub.autoRubric) {
      sub.autoRubric =
        parseRubricJson(sub.rubricJson) ??
        evaluateSubmissionRubric({
          moduleId: sub.moduleId,
          domain: sub.domain,
          hypothesisText: sub.hypothesisText,
          observationData: sub.observationData,
          regressionMetrics: sub.regressionMetrics,
          quizScore: sub.quizScore,
          conclusionText: sub.conclusionText,
        });
      sub.rubricJson = serializeRubricJson(sub.autoRubric);
    }
    state.repository.upsertSubmission({
      id: sub.id,
      schoolId: sub.schoolId,
      roomId: sub.roomId || 'LAB-ALPHA',
      studentId: sub.studentId || null,
      studentName: sub.studentName,
      domain: sub.domain,
      moduleId: sub.moduleId,
      score: sub.teacherGrade?.score ?? sub.autoRubric.score,
      payloadJson: JSON.stringify(sub),
      submittedAt: sub.submittedAt,
    });
    state.saveGradebookEntry({
      id: sub.id,
      schoolId: sub.schoolId,
      roomPin: sub.roomPin || sub.roomId || 'LAB-ALPHA',
      studentId: sub.studentId || 'stu-anon',
      studentName: sub.studentName,
      moduleId: sub.moduleId,
      score: sub.teacherGrade?.score ?? sub.autoRubric.score,
      rubricJson: sub.rubricJson || serializeRubricJson(sub.autoRubric),
      submittedAt: Number.isFinite(Date.parse(sub.submittedAt))
        ? Date.parse(sub.submittedAt)
        : Date.now(),
    });
  }

  const persistSubmissions = (): Promise<void> => submissionStore.enqueuePersist();

  router.post('/api/submissions', (req, res) => {
    try {
      const headerIdemKey = req.headers['x-idempotency-key'];
      const rawBodyObj =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : null;
      const bodyWithIdem =
        rawBodyObj && !rawBodyObj.clientMutationId && typeof headerIdemKey === 'string' && headerIdemKey.trim()
          ? { ...rawBodyObj, clientMutationId: headerIdemKey.trim() }
          : req.body;

      const check = validateCreateSubmissionPayload(bodyWithIdem);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const payload = check.data;
      const schoolId = payload.schoolId || DEFAULT_SCHOOL_ID;

      if (payload.clientMutationId) {
        const existingIdem = state.repository.getIdempotencyKey(
          payload.clientMutationId,
          schoolId,
          'POST /api/submissions'
        );
        if (existingIdem) {
          try {
            const cachedResponse = JSON.parse(existingIdem.response_json) as Record<
              string,
              unknown
            >;
            res.status(200).json({ ...cachedResponse, idempotentReplay: true });
            return;
          } catch {
            // Fall through if cached payload cannot be parsed
          }
        }
      }
      const id =
        payload.id ||
        `SUB-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const autoRubric = evaluateSubmissionRubric({
        moduleId: payload.moduleId,
        domain: payload.domain,
        hypothesisText: payload.hypothesisText,
        observationData: payload.observationData,
        regressionMetrics: payload.regressionMetrics,
        quizScore: payload.quizScore,
        conclusionText: payload.conclusionText,
      });
      const rubricJson = serializeRubricJson(autoRubric);

      const newSubmission: LabSubmissionRecord = {
        id,
        schoolId,
        studentName: payload.studentName,
        studentId: payload.studentId,
        roomId: payload.roomId,
        domain: payload.domain,
        moduleId: payload.moduleId,
        submittedAt: payload.submittedAt,
        hypothesisText: payload.hypothesisText,
        observationData: payload.observationData,
        regressionMetrics: payload.regressionMetrics,
        quizAnswers: payload.quizAnswers,
        quizScore: payload.quizScore,
        conclusionText: payload.conclusionText,
        telemetryLog: payload.telemetryLog,
        autoRubric,
        rubricJson,
        teacherGrade: payload.teacherGrade ?? {
          score: autoRubric.score,
          feedback: autoRubric.summaryFeedback,
          gradedAt: new Date().toISOString(),
        },
      };

      submissionsList.unshift(newSubmission);
      persistSubmissions();

      // Persist to SQLite `submissions` and `gradebook_entries` via LabRepository
      state.repository.upsertSubmission({
        id: newSubmission.id,
        schoolId,
        roomId: newSubmission.roomId || 'LAB-ALPHA',
        studentId: newSubmission.studentId || null,
        studentName: newSubmission.studentName,
        domain: newSubmission.domain,
        moduleId: newSubmission.moduleId,
        score: newSubmission.teacherGrade?.score ?? autoRubric.score,
        payloadJson: JSON.stringify(newSubmission),
        submittedAt: newSubmission.submittedAt,
      });
      state.saveGradebookEntry({
        id: newSubmission.id,
        schoolId,
        roomPin: newSubmission.roomId || 'LAB-ALPHA',
        studentId: newSubmission.studentId || 'stu-anon',
        studentName: newSubmission.studentName,
        moduleId: newSubmission.moduleId,
        score: newSubmission.teacherGrade?.score ?? autoRubric.score,
        rubricJson,
        submittedAt: Number.isFinite(Date.parse(newSubmission.submittedAt))
          ? Date.parse(newSubmission.submittedAt)
          : Date.now(),
      });

      const notif: ServerNotification = {
        id: `notif-sub-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        severity: 'nominal',
        domain: 'Pengajar',
        title: `Laporan Dikumpulkan: ${newSubmission.studentName}`,
        message: `${newSubmission.studentName} mengumpulkan laporan [${newSubmission.moduleId}] — Skor Rubrik: ${autoRubric.score}/100 (Tiket: ${newSubmission.id}).`,
      };
      state.notifications.unshift(notif);
      state.persistServerState();
      broadcastAll({
        type: 'submission:created',
        payload: { submission: newSubmission, notification: notif },
      });

      const responseBody = {
        success: true,
        ticketCode: newSubmission.id,
        schoolId,
        submission: newSubmission,
        autoRubric,
      };
      if (payload.clientMutationId) {
        state.repository.saveIdempotencyKey({
          key: payload.clientMutationId,
          schoolId,
          endpoint: 'POST /api/submissions',
          responseJson: JSON.stringify(responseBody),
        });
      }

      res.status(201).json(responseBody);
    } catch (err) {
      logger.error('Error saving submission', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res.status(500).json({ error: 'Gagal menyimpan laporan praktikum' });
    }
  });

  router.get('/api/submissions', (req, res) => {
    const check = validateSubmissionsQuery(req.query);
    if (!check.ok) {
      res.status(400).json(formatValidationErrorResponse(check));
      return;
    }
    const requestedSchoolId = check.data.schoolId;
    if (!requestedSchoolId) {
      res.json({ submissions: submissionsList });
      return;
    }
    const filtered = submissionsList.filter(
      (s) => (s.schoolId || DEFAULT_SCHOOL_ID) === requestedSchoolId
    );
    res.json({ submissions: filtered });
  });

  router.get('/api/gradebook', (req, res) => {
    const check = validateGradebookQuery(req.query);
    if (!check.ok) {
      res.status(400).json(formatValidationErrorResponse(check));
      return;
    }
    const entries = state.getGradebookEntries(check.data.roomPin, check.data.schoolId);
    res.json({ entries });
  });

  router.patch('/api/submissions/:id/grade', (req, res) => {
    try {
      const check = validateGradeSubmissionPayload(req.params.id, req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const { id, score, feedback, schoolId } = check.data;
      const item = submissionsList.find((s) => s.id === id);
      if (!item) {
        res.status(404).json({ error: 'Laporan tidak ditemukan' });
        return;
      }
      if ((item.schoolId || DEFAULT_SCHOOL_ID) !== schoolId) {
        res.status(404).json({ error: 'Laporan tidak ditemukan pada sekolah ini' });
        return;
      }

      item.teacherGrade = {
        score,
        feedback,
        gradedAt: new Date().toISOString(),
      };
      persistSubmissions();

      state.repository.upsertSubmission({
        id: item.id,
        schoolId: item.schoolId || DEFAULT_SCHOOL_ID,
        roomId: item.roomId || 'LAB-ALPHA',
        studentId: item.studentId || null,
        studentName: item.studentName,
        domain: item.domain,
        moduleId: item.moduleId,
        score,
        payloadJson: JSON.stringify(item),
        submittedAt: item.submittedAt,
      });
      state.saveGradebookEntry({
        id: item.id,
        schoolId: item.schoolId || DEFAULT_SCHOOL_ID,
        roomPin: item.roomId || 'LAB-ALPHA',
        studentId: item.studentId || 'stu-anon',
        studentName: item.studentName,
        moduleId: item.moduleId,
        score,
        rubricJson:
          item.rubricJson ||
          (item.autoRubric ? serializeRubricJson(item.autoRubric) : '{}'),
        submittedAt: Date.now(),
      });

      broadcastAll({
        type: 'submission:graded',
        payload: { submission: item },
      });

      res.json({ success: true, submission: item });
    } catch (err) {
      logger.error('Error grading submission', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res.status(500).json({ error: 'Gagal memperbarui nilai laporan' });
    }
  });

  return router;
}
