import type { ZodError } from 'zod';
import {
  AiConversationalSchema,
  AutosavePayloadSchema,
  DrLabMuTelemetrySchema,
  GenerateMissionSchema,
  RoomMissionUpdateSchema,
  RoomRejoinSchema,
  RoomSnapshotSchema,
  SubmissionCreateSchema,
  SubmissionGradeSchema,
  VisionDiagnoseSchema,
  type ValidationIssue,
} from '../../src/shared/contracts/restContracts';

export type { ValidationIssue };

export interface ValidationErrorResult {
  ok: false;
  status: 400;
  error: string;
  code: 'INVALID_PAYLOAD';
  issues: ValidationIssue[];
  details: string[];
}

export interface ValidationSuccessResult<T> {
  ok: true;
  data: T;
}

export type ValidationResult<T> = ValidationSuccessResult<T> | ValidationErrorResult;

export interface ValidatedAutosavePayload {
  storageKey: string;
  version: number;
  session: unknown;
  sessionToken?: string;
  studentId?: string;
}

export interface ValidatedRoomRejoinPayload {
  roomPin: string;
  participantId: string;
  roomId?: string;
}

export interface ValidatedRoomSnapshotPayload {
  roomPin: string;
  params: Record<string, unknown>;
}

export interface ValidatedGenerateMissionPayload {
  moduleId: string;
  caseStudyPrompt: string;
  teacherName: string;
  roomId: string;
  publishToRoom: boolean;
}

export interface ValidatedRoomMissionPayload {
  roomId: string;
  teacherName?: string;
  mission: Record<string, unknown> | null;
}

export interface ValidatedDrLabMuAskPayload {
  kind: 'mission' | 'socratic';
  missionInput?: ValidatedGenerateMissionPayload;
  rawBody?: Record<string, unknown>;
}

export interface ValidatedConversationalDrLabMuPayload {
  message: string;
  telemetry?: Record<string, unknown>;
  history?: Array<{ role?: string; text?: string }>;
}

export interface ValidatedVisionDiagnosePayload {
  image: string;
  studentQuery: string;
  telemetry?: Record<string, unknown>;
}

export interface ValidatedSubmissionCreatePayload {
  id?: string;
  studentName: string;
  studentId?: string;
  roomId: string;
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

export interface ValidatedSubmissionGradePayload {
  id: string;
  score: number;
  feedback: string;
}

function fail(
  error: string,
  issues: ValidationIssue[] = [{ path: '', message: error }]
): ValidationErrorResult {
  const normalizedIssues = issues.length > 0 ? issues : [{ path: '', message: error }];
  return {
    ok: false,
    status: 400,
    error,
    code: 'INVALID_PAYLOAD',
    issues: normalizedIssues,
    details: normalizedIssues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)),
  };
}

function failFromZod(zodError: ZodError, fallbackMessage: string): ValidationErrorResult {
  const issues: ValidationIssue[] = zodError.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  const primary = issues[0]?.message || fallbackMessage;
  return fail(primary, issues);
}

export function formatValidationErrorResponse(errResult: ValidationErrorResult): {
  error: 'VALIDATION_ERROR';
  code: 'INVALID_PAYLOAD';
  message: string;
  issues: ValidationIssue[];
  details: string[];
} {
  return {
    error: 'VALIDATION_ERROR',
    code: errResult.code,
    message: errResult.error,
    issues: errResult.issues,
    details: errResult.details,
  };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateAutosavePayload(
  body: unknown
): ValidationResult<ValidatedAutosavePayload> {
  if (!isPlainObject(body)) {
    return fail('Payload autosave sesi harus berupa objek JSON.');
  }
  const parsed = AutosavePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Invalid session autosave payload');
  }
  return {
    ok: true,
    data: {
      storageKey: parsed.data.storageKey,
      version: parsed.data.version,
      session: parsed.data.session,
      sessionToken: parsed.data.sessionToken || undefined,
      studentId: parsed.data.studentId || undefined,
    },
  };
}

export function validateRoomRejoinPayload(
  body: unknown
): ValidationResult<ValidatedRoomRejoinPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload pemulihan sesi ruangan harus berupa objek JSON.');
  }
  const parsed = RoomRejoinSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(
      parsed.error,
      'Parameter roomPin dan participantId wajib diisi untuk pemulihan sesi 3T.'
    );
  }
  return {
    ok: true,
    data: {
      roomPin: parsed.data.roomPin,
      participantId: parsed.data.participantId,
      roomId: parsed.data.roomId || undefined,
    },
  };
}

export function validateRoomSnapshotPayload(
  body: unknown
): ValidationResult<ValidatedRoomSnapshotPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload snapshot simulasi harus berupa objek JSON.');
  }
  const parsed = RoomSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Invalid simulation snapshot payload');
  }
  return {
    ok: true,
    data: {
      roomPin: parsed.data.roomPin,
      params: parsed.data.params,
    },
  };
}

export function validateGenerateMissionPayload(
  body: unknown
): ValidationResult<ValidatedGenerateMissionPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload pembuatan misi AI harus berupa objek JSON.');
  }
  const parsed = GenerateMissionSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload pembuatan misi AI tidak valid.');
  }

  const resolvedPrompt = (
    parsed.data.caseStudyPrompt ||
    parsed.data.storyPrompt ||
    parsed.data.prompt ||
    ''
  ).trim();

  return {
    ok: true,
    data: {
      moduleId: parsed.data.moduleId || 'acid-base-titration',
      caseStudyPrompt: resolvedPrompt,
      teacherName: parsed.data.teacherName || 'Dr. Hendra Kusuma',
      roomId: (parsed.data.roomId || 'LAB-ALPHA').toUpperCase(),
      publishToRoom: parsed.data.publishToRoom !== false,
    },
  };
}

export function validateRoomMissionPayload(
  roomIdParam: unknown,
  body: unknown
): ValidationResult<ValidatedRoomMissionPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload misi room harus berupa objek JSON.');
  }
  const parsed = RoomMissionUpdateSchema.safeParse({
    roomId: roomIdParam,
    teacherName: body.teacherName,
    mission: body.mission,
  });
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload misi room tidak valid.');
  }

  return {
    ok: true,
    data: {
      roomId: parsed.data.roomId.toUpperCase(),
      teacherName: parsed.data.teacherName || undefined,
      mission: (parsed.data.mission as Record<string, unknown> | null | undefined) ?? null,
    },
  };
}

export function validateDrLabMuAskPayload(
  body: unknown
): ValidationResult<ValidatedDrLabMuAskPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload Dr. LabMu harus berupa objek JSON.');
  }

  if (
    body.mode === 'generate-mission' ||
    body.action === 'generate-mission' ||
    body.caseStudyPrompt !== undefined
  ) {
    const missionCheck = validateGenerateMissionPayload(body);
    if (!missionCheck.ok) return missionCheck;
    return {
      ok: true,
      data: {
        kind: 'mission',
        missionInput: missionCheck.data,
      },
    };
  }

  if (body.telemetry !== undefined && !isPlainObject(body.telemetry)) {
    return fail('Field "telemetry" harus berupa objek JSON.');
  }

  const rawTelemetry = isPlainObject(body.telemetry) ? body.telemetry : body;
  const parsed = DrLabMuTelemetrySchema.safeParse(rawTelemetry);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload telemetri Dr. LabMu tidak valid.');
  }

  return {
    ok: true,
    data: {
      kind: 'socratic',
      rawBody: body,
    },
  };
}

export function validateConversationalDrLabMuPayload(
  body: unknown
): ValidationResult<ValidatedConversationalDrLabMuPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload percakapan Dr. LabMu harus berupa objek JSON.');
  }

  const parsed = AiConversationalSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload percakapan Dr. LabMu tidak valid.');
  }

  return {
    ok: true,
    data: {
      message: parsed.data.message || '',
      telemetry: parsed.data.telemetry as Record<string, unknown> | undefined,
      history: parsed.data.history,
    },
  };
}

export function validateVisionDiagnosePayload(
  body: unknown
): ValidationResult<ValidatedVisionDiagnosePayload> {
  if (!isPlainObject(body)) {
    return fail('Payload diagnostik visual harus berupa objek JSON.');
  }

  const parsed = VisionDiagnoseSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload diagnostik visual tidak valid.');
  }

  return {
    ok: true,
    data: {
      image: parsed.data.image,
      studentQuery:
        parsed.data.studentQuery ||
        'Periksa penataan alat laboratorium 3D saya dan berikan analisis saintifik.',
      telemetry: parsed.data.telemetry as Record<string, unknown> | undefined,
    },
  };
}

export function validateCreateSubmissionPayload(
  body: unknown
): ValidationResult<ValidatedSubmissionCreatePayload> {
  if (!isPlainObject(body)) {
    return fail('Payload laporan praktikum harus berupa objek JSON.');
  }

  const parsed = SubmissionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload laporan praktikum tidak valid.');
  }

  const d = parsed.data;
  const rm = d.regressionMetrics;
  const normalizedRm = rm
    ? {
        rSquared: typeof rm.rSquared === 'number' ? rm.rSquared : 0,
        slope: typeof rm.slope === 'number' ? rm.slope : 0,
        equation: typeof rm.equation === 'string' ? rm.equation.trim() : 'N/A',
      }
    : {
        rSquared: 0.98,
        slope: 1.0,
        equation: 'y = mx + c',
      };

  const normalizedGrade = d.teacherGrade
    ? {
        score: d.teacherGrade.score,
        feedback: typeof d.teacherGrade.feedback === 'string' ? d.teacherGrade.feedback.trim() : '',
        gradedAt:
          typeof d.teacherGrade.gradedAt === 'string' && d.teacherGrade.gradedAt.trim()
            ? d.teacherGrade.gradedAt.trim()
            : new Date().toISOString(),
      }
    : undefined;

  return {
    ok: true,
    data: {
      id: d.id,
      studentName: d.studentName,
      studentId: d.studentId,
      roomId: d.roomId || 'LAB-ALPHA',
      domain: d.domain || 'Fisika',
      moduleId: d.moduleId,
      submittedAt: d.submittedAt || new Date().toISOString(),
      hypothesisText: d.hypothesisText || '',
      observationData: d.observationData || [],
      regressionMetrics: normalizedRm,
      quizAnswers: d.quizAnswers || [],
      quizScore: d.quizScore ?? 100,
      conclusionText: d.conclusionText || '',
      telemetryLog: d.telemetryLog,
      teacherGrade: normalizedGrade,
    },
  };
}

export function validateGradeSubmissionPayload(
  idParam: unknown,
  body: unknown
): ValidationResult<ValidatedSubmissionGradePayload> {
  if (!isPlainObject(body)) {
    return fail('Payload penilaian harus berupa objek JSON.');
  }

  const parsed = SubmissionGradeSchema.safeParse({
    id: idParam,
    score: body.score,
    feedback: body.feedback,
  });
  if (!parsed.success) {
    return failFromZod(parsed.error, 'Payload penilaian tidak valid.');
  }

  return {
    ok: true,
    data: {
      id: parsed.data.id,
      score: parsed.data.score,
      feedback: parsed.data.feedback || '',
    },
  };
}
