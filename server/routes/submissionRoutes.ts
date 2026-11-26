import express from 'express';
import fs from 'fs';
import path from 'path';
import { rateLimit } from 'express-rate-limit';
import {
  evaluateSubmissionRubric,
  parseRubricJson,
  serializeRubricJson,
  type EvaluatedRubricReport,
} from '../../src/shared/grading/rubricEngine';
import {
  requireAuthMiddleware,
  requireTeacherAuthMiddleware,
} from '../auth/sessionToken';
import {
  DEFAULT_SCHOOL_ID,
  type DbSubmissionRecord,
} from '../db/LabRepository';
import type { LabServerState, ServerNotification } from '../state/labServerState';
import {
  formatValidationErrorResponse,
  validateBatchGradeSubmissionsPayload,
  validateCreateSubmissionPayload,
  validateGradebookQuery,
  validateGradeSubmissionPayload,
  validateSubmissionsQuery,
} from '../utils/routePayloadValidators';
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
  broadcastSchool?: (schoolId: string, payload: unknown) => void;
  broadcastSchoolTeachers?: (schoolId: string, payload: unknown) => void;
}

function hydrateSubmissionFromRow(row: DbSubmissionRecord): LabSubmissionRecord | null {
  try {
    const parsed = JSON.parse(row.payload_json) as LabSubmissionRecord;
    return {
      ...parsed,
      id: parsed.id || row.id,
      schoolId: row.school_id || parsed.schoolId || DEFAULT_SCHOOL_ID,
      roomId: parsed.roomId || row.room_id,
      studentId: parsed.studentId || row.student_id || undefined,
      studentName: parsed.studentName || row.student_name,
      domain: parsed.domain || row.domain,
      moduleId: parsed.moduleId || row.module_id,
      submittedAt: parsed.submittedAt || row.submitted_at,
    };
  } catch {
    return null;
  }
}

export async function createSubmissionRouter({
  rootDir,
  state,
  broadcastAll,
  broadcastSchool,
  broadcastSchoolTeachers,
}: SubmissionRoutesDeps): Promise<express.Router> {
  const router = express.Router();

  const emitSchoolEvent = (schoolId: string, payload: unknown) => {
    if (broadcastSchoolTeachers) {
      broadcastSchoolTeachers(schoolId, payload);
    } else if (broadcastSchool) {
      broadcastSchool(schoolId, payload);
    } else {
      broadcastAll(payload);
    }
  };

  const submissionsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    message: {
      error: 'RATE_LIMITED',
      message:
        'Terlalu banyak permintaan laporan dalam 1 menit (maksimal 60 permintaan/menit).',
    },
  });

  router.use('/api/submissions', submissionsLimiter);

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
      schoolId: DEFAULT_SCHOOL_ID,
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

  const persistSingleSubmissionToDb = async (sub: LabSubmissionRecord): Promise<void> => {
    const schoolId = sub.schoolId || DEFAULT_SCHOOL_ID;
    const rubric =
      sub.autoRubric ??
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
    sub.autoRubric = rubric;
    sub.rubricJson = sub.rubricJson || serializeRubricJson(rubric);
    sub.schoolId = schoolId;

    const score = sub.teacherGrade?.score ?? rubric.score;
    const submissionInput = {
      id: sub.id,
      schoolId,
      roomId: sub.roomId || 'LAB-ALPHA',
      studentId: sub.studentId || null,
      studentName: sub.studentName,
      domain: sub.domain,
      moduleId: sub.moduleId,
      score,
      payloadJson: JSON.stringify(sub),
      submittedAt: sub.submittedAt,
    };

    state.repository.upsertSubmission(submissionInput);
    if (state.asyncRepository.driver === 'postgres') {
      await state.asyncRepository.upsertSubmission(submissionInput);
    }

    state.saveGradebookEntry({
      id: sub.id,
      schoolId,
      roomPin: sub.roomPin || sub.roomId || 'LAB-ALPHA',
      studentId: sub.studentId || 'stu-anon',
      studentName: sub.studentName,
      moduleId: sub.moduleId,
      score,
      rubricJson: sub.rubricJson,
      submittedAt: Number.isFinite(Date.parse(sub.submittedAt))
        ? Date.parse(sub.submittedAt)
        : Date.now(),
    });
  };

  // Single-source-of-truth startup migration:
  // If consolidated SQLite `submissions` table is empty, import legacy `data/submissions.json` once
  // (read-only migration, never writing JSON back). If no legacy data exists, insert initial demo seed.
  const existingDbRows = state.repository.listSubmissions();
  if (existingDbRows.length === 0) {
    const legacyJsonPath = path.join(rootDir, 'data', 'submissions.json');
    let migratedRecords: LabSubmissionRecord[] = [];
    if (fs.existsSync(legacyJsonPath)) {
      try {
        const raw = await fs.promises.readFile(legacyJsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          migratedRecords = parsed.filter(
            (item): item is LabSubmissionRecord =>
              Boolean(item && typeof item === 'object' && typeof item.id === 'string')
          );
          logger.info('Imported legacy submissions.json into consolidated SQLite database', {
            importedCount: migratedRecords.length,
          });
        }
      } catch (err) {
        logger.warn('Skipping malformed legacy submissions.json during startup import', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const bootstrapRecords =
      migratedRecords.length > 0 ? migratedRecords : initialSubmissionsSeed;
    for (const sub of bootstrapRecords) {
      await persistSingleSubmissionToDb(sub);
    }
  }

  router.post('/api/submissions', async (req, res) => {
    try {
      const headerIdemKey = req.headers['x-idempotency-key'];
      const rawBodyObj =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : null;
      const bodyWithIdem =
        rawBodyObj &&
        !rawBodyObj.clientMutationId &&
        typeof headerIdemKey === 'string' &&
        headerIdemKey.trim()
          ? { ...rawBodyObj, clientMutationId: headerIdemKey.trim() }
          : req.body;

      const check = validateCreateSubmissionPayload(bodyWithIdem);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const payload = check.data;
      const schoolId = req.authSession?.schoolId || payload.schoolId || DEFAULT_SCHOOL_ID;

      if (payload.clientMutationId) {
        const existingIdem = await state.asyncRepository.getIdempotencyKey(
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

      const isVerifiedTeacherOrAdmin = Boolean(
        req.authSession &&
          (req.authSession.role === 'teacher' || req.authSession.role === 'admin')
      );

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
        teacherGrade:
          isVerifiedTeacherOrAdmin && payload.teacherGrade
            ? payload.teacherGrade
            : {
                score: autoRubric.score,
                feedback: autoRubric.summaryFeedback,
                gradedAt: new Date().toISOString(),
              },
      };

      await persistSingleSubmissionToDb(newSubmission);

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
      const scopedRoomState = state.getScopedActivityState(newSubmission.roomId, schoolId);
      scopedRoomState.notifications.unshift(notif);
      const scopedLobbyState = state.getScopedActivityState(undefined, schoolId);
      if (scopedLobbyState !== scopedRoomState) {
        scopedLobbyState.notifications.unshift(notif);
      }
      state.persistServerState();

      emitSchoolEvent(schoolId, {
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
        const idemRecord = {
          key: payload.clientMutationId,
          schoolId,
          endpoint: 'POST /api/submissions',
          responseJson: JSON.stringify(responseBody),
        };
        state.repository.saveIdempotencyKey(idemRecord);
        if (state.asyncRepository.driver === 'postgres') {
          await state.asyncRepository.saveIdempotencyKey(idemRecord);
        }
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

  router.get('/api/submissions', requireAuthMiddleware, async (req, res) => {
    try {
      const check = validateSubmissionsQuery(req.query);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const session = req.authSession;
      const effectiveSchoolId = session ? session.schoolId : check.data.schoolId;
      const effectiveStudentId =
        session && session.role === 'student' ? session.sub : check.data.studentId;

      const normalizedSortBy: 'submittedAt' | 'score' | 'studentName' | undefined =
        check.data.sortBy === 'student_name'
          ? 'studentName'
          : check.data.sortBy === 'submitted_at'
          ? 'submittedAt'
          : check.data.sortBy;

      const paginated = await state.asyncRepository.querySubmissionsPaginated({
        schoolId: effectiveSchoolId,
        roomId: check.data.roomId,
        studentId: effectiveStudentId,
        domain: check.data.domain,
        moduleId: check.data.moduleId,
        status: check.data.status,
        search: check.data.search,
        sortBy: normalizedSortBy,
        sortDir: check.data.sortDir,
        limit: check.data.limit ?? 50,
        offset: check.data.offset ?? 0,
      });

      const submissions: LabSubmissionRecord[] = [];
      for (const row of paginated.items) {
        const hydrated = hydrateSubmissionFromRow(row);
        if (hydrated) submissions.push(hydrated);
      }

      res.json({
        submissions,
        pagination: paginated.pagination,
      });
    } catch (err) {
      logger.error('Error querying submissions', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res.status(500).json({ error: 'Gagal memuat daftar laporan praktikum' });
    }
  });

  router.get('/api/gradebook', requireAuthMiddleware, async (req, res) => {
    try {
      const check = validateGradebookQuery(req.query);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const session = req.authSession;
      const effectiveSchoolId = session ? session.schoolId : check.data.schoolId;
      const effectiveRoomPin = check.data.roomPin
        ? state.activeLabRooms.get(check.data.roomPin.toUpperCase())?.pin || check.data.roomPin
        : undefined;

      const paginated = await state.asyncRepository.queryGradebookPaginated({
        roomPin: effectiveRoomPin,
        schoolId: effectiveSchoolId,
        moduleId: check.data.moduleId,
        limit: check.data.limit ?? 50,
        offset: check.data.offset ?? 0,
      });

      res.json({
        entries: paginated.items,
        pagination: paginated.pagination,
      });
    } catch (err) {
      logger.error('Error querying gradebook', {
        requestId: res.locals?.requestId,
        error: err,
      });
      res.status(500).json({ error: 'Gagal memuat data buku nilai' });
    }
  });

  router.patch('/api/submissions/:id/grade', requireTeacherAuthMiddleware, async (req, res) => {
    try {
      const check = validateGradeSubmissionPayload(req.params.id, req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const session = req.authSession!;
      const { id, score, feedback } = check.data;
      const schoolId = session.schoolId;

      const row = await state.asyncRepository.getSubmissionById(id, schoolId);
      if (!row) {
        res.status(404).json({ error: 'Laporan tidak ditemukan pada sekolah ini' });
        return;
      }

      const item = hydrateSubmissionFromRow(row);
      if (!item) {
        res.status(500).json({ error: 'Data laporan tidak dapat dibaca' });
        return;
      }

      const previousScore = item.teacherGrade?.score ?? null;
      item.teacherGrade = {
        score,
        feedback,
        gradedAt: new Date().toISOString(),
      };

      await persistSingleSubmissionToDb(item);

      state.recordAuditLog({
        schoolId,
        actorId: session.sub,
        actorName: session.displayName,
        actorRole: session.role,
        action: 'SUBMISSION_GRADED',
        targetType: 'submission',
        targetId: item.id,
        metadata: {
          studentName: item.studentName,
          moduleId: item.moduleId,
          previousScore,
          newScore: score,
        },
        ipAddress: rateLimitKeyGenerator(req),
      });

      emitSchoolEvent(schoolId, {
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

  router.post(
    '/api/submissions/batch-grade',
    requireTeacherAuthMiddleware,
    async (req, res) => {
      try {
        const check = validateBatchGradeSubmissionsPayload(req.body);
        if (!check.ok) {
          res.status(400).json(formatValidationErrorResponse(check));
          return;
        }

        const session = req.authSession!;
        const schoolId = session.schoolId;
        const { submissionIds, onlyUngraded, feedbackPrefix } = check.data;
        const targetIdSet = submissionIds ? new Set(submissionIds) : null;

        const queried = await state.asyncRepository.querySubmissionsPaginated({
          schoolId,
          status: onlyUngraded ? 'ungraded' : 'all',
          limit: 200,
          offset: 0,
        });

        const targets: LabSubmissionRecord[] = [];
        for (const row of queried.items) {
          if (targetIdSet && !targetIdSet.has(row.id)) continue;
          const hydrated = hydrateSubmissionFromRow(row);
          if (!hydrated) continue;
          if (onlyUngraded && hydrated.teacherGrade) continue;
          targets.push(hydrated);
        }

        const gradedAt = new Date().toISOString();
        const updatedItems: LabSubmissionRecord[] = [];

        for (const item of targets) {
          const rubric =
            item.autoRubric ??
            parseRubricJson(item.rubricJson) ??
            evaluateSubmissionRubric({
              moduleId: item.moduleId,
              domain: item.domain,
              hypothesisText: item.hypothesisText,
              observationData: item.observationData,
              regressionMetrics: item.regressionMetrics,
              quizScore: item.quizScore,
              conclusionText: item.conclusionText,
            });
          item.autoRubric = rubric;
          item.rubricJson = serializeRubricJson(rubric);

          const feedbackText = feedbackPrefix
            ? `${feedbackPrefix} — ${rubric.summaryFeedback}`
            : rubric.summaryFeedback;

          item.teacherGrade = {
            score: rubric.score,
            feedback: feedbackText,
            gradedAt,
          };

          await persistSingleSubmissionToDb(item);

          emitSchoolEvent(schoolId, {
            type: 'submission:graded',
            payload: { submission: item },
          });
          updatedItems.push(item);
        }

        state.recordAuditLog({
          schoolId,
          actorId: session.sub,
          actorName: session.displayName,
          actorRole: session.role,
          action: 'SUBMISSION_BATCH_GRADED',
          targetType: 'submission',
          targetId: `${updatedItems.length} submissions`,
          metadata: {
            gradedCount: updatedItems.length,
            submissionIds: updatedItems.map((i) => i.id).slice(0, 50),
          },
          ipAddress: rateLimitKeyGenerator(req),
        });

        res.json({
          ok: true,
          success: true,
          gradedCount: updatedItems.length,
          submissions: updatedItems,
        });
      } catch (err) {
        logger.error('Error batch grading submissions', {
          requestId: res.locals?.requestId,
          error: err,
        });
        res.status(500).json({ error: 'Gagal menerapkan penilaian rubrik massal' });
      }
    }
  );

  return router;
}
