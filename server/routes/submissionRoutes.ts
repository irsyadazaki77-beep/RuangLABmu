import express from 'express';
import fs from 'fs';
import path from 'path';
import { rateLimit } from 'express-rate-limit';
import { AsyncSubmissionStore } from '../../src/utils/submissionPersistence';
import type { LabServerState, ServerNotification } from '../state/labServerState';
import {
  validateCreateSubmissionPayload,
  validateGradeSubmissionPayload,
} from '../utils/routePayloadValidators';
import { rateLimitKeyGenerator } from '../utils/rateLimitKey';

export interface LabSubmissionRecord {
  id: string;
  studentName: string;
  studentId?: string;
  roomId?: string;
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

  const persistSubmissions = (): Promise<void> => submissionStore.enqueuePersist();

  router.post('/api/submissions', (req, res) => {
    try {
      const check = validateCreateSubmissionPayload(req.body);
      if (!check.ok) {
        res.status(400).json({
          error: check.error,
          code: check.code,
          details: check.details,
        });
        return;
      }

      const payload = check.data;
      const id =
        payload.id ||
        `SUB-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const newSubmission: LabSubmissionRecord = {
        id,
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
        teacherGrade: payload.teacherGrade,
      };

      submissionsList.unshift(newSubmission);
      persistSubmissions();

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
        message: `${newSubmission.studentName} mengumpulkan laporan [${newSubmission.moduleId}] (Tiket: ${newSubmission.id}).`,
      };
      state.notifications.unshift(notif);
      state.persistServerState();
      broadcastAll({
        type: 'submission:created',
        payload: { submission: newSubmission, notification: notif },
      });

      res.status(201).json({
        success: true,
        ticketCode: newSubmission.id,
        submission: newSubmission,
      });
    } catch (err) {
      console.error('Error saving submission:', err);
      res.status(500).json({ error: 'Gagal menyimpan laporan praktikum' });
    }
  });

  router.get('/api/submissions', (_req, res) => {
    res.json({ submissions: submissionsList });
  });

  router.patch('/api/submissions/:id/grade', (req, res) => {
    try {
      const check = validateGradeSubmissionPayload(req.params.id, req.body);
      if (!check.ok) {
        res.status(400).json({
          error: check.error,
          code: check.code,
          details: check.details,
        });
        return;
      }

      const { id, score, feedback } = check.data;
      const item = submissionsList.find((s) => s.id === id);
      if (!item) {
        res.status(404).json({ error: 'Laporan tidak ditemukan' });
        return;
      }

      item.teacherGrade = {
        score,
        feedback,
        gradedAt: new Date().toISOString(),
      };
      persistSubmissions();

      broadcastAll({
        type: 'submission:graded',
        payload: { submission: item },
      });

      res.json({ success: true, submission: item });
    } catch (err) {
      console.error('Error grading submission:', err);
      res.status(500).json({ error: 'Gagal memperbarui nilai laporan' });
    }
  });

  return router;
}
