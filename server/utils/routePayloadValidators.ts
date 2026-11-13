export interface ValidationErrorResult {
  ok: false;
  status: 400;
  error: string;
  code: 'INVALID_PAYLOAD';
  details: string[];
}

export interface ValidationSuccessResult<T> {
  ok: true;
  data: T;
}

export type ValidationResult<T> = ValidationSuccessResult<T> | ValidationErrorResult;

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

function fail(error: string, details: string[] = []): ValidationErrorResult {
  return {
    ok: false,
    status: 400,
    error,
    code: 'INVALID_PAYLOAD',
    details: details.length > 0 ? details : [error],
  };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function checkOptionalString(
  obj: Record<string, unknown>,
  key: string,
  maxLen: number,
  errors: string[],
  allowEmpty = true
): string | undefined {
  const val = obj[key];
  if (val === undefined) return undefined;
  if (typeof val !== 'string') {
    errors.push(`Field "${key}" harus berupa string.`);
    return undefined;
  }
  const trimmed = val.trim();
  if (!allowEmpty && trimmed.length === 0) {
    errors.push(`Field "${key}" tidak boleh kosong.`);
    return undefined;
  }
  if (trimmed.length > maxLen) {
    errors.push(`Field "${key}" melebihi batas panjang maksimum (${maxLen} karakter).`);
    return undefined;
  }
  return trimmed;
}

export function validateGenerateMissionPayload(
  body: unknown
): ValidationResult<ValidatedGenerateMissionPayload> {
  if (!isPlainObject(body)) {
    return fail('Payload pembuatan misi AI harus berupa objek JSON.');
  }

  const errors: string[] = [];
  const promptKeys = ['caseStudyPrompt', 'storyPrompt', 'prompt'] as const;
  let resolvedPrompt = '';

  for (const key of promptKeys) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string') {
        errors.push(`Field "${key}" harus berupa string.`);
      } else if (!resolvedPrompt) {
        resolvedPrompt = body[key].trim();
      }
    }
  }

  if (!resolvedPrompt) {
    errors.push('Deskripsi studi kasus cerita (caseStudyPrompt) wajib diisi.');
  } else if (resolvedPrompt.length > 2000) {
    errors.push('Deskripsi studi kasus cerita melebihi batas maksimum 2000 karakter.');
  }

  const moduleId = checkOptionalString(body, 'moduleId', 100, errors, false);
  const teacherName = checkOptionalString(body, 'teacherName', 120, errors, true);
  const roomId = checkOptionalString(body, 'roomId', 32, errors, false);

  if (body.publishToRoom !== undefined && typeof body.publishToRoom !== 'boolean') {
    errors.push('Field "publishToRoom" harus berupa boolean.');
  }

  if (errors.length > 0) {
    return fail(errors[0], errors);
  }

  return {
    ok: true,
    data: {
      moduleId: moduleId || 'acid-base-titration',
      caseStudyPrompt: resolvedPrompt,
      teacherName: teacherName || 'Dr. Hendra Kusuma',
      roomId: (roomId || 'LAB-ALPHA').toUpperCase(),
      publishToRoom: body.publishToRoom !== false,
    },
  };
}

const ALLOWED_MISSION_DOMAINS = new Set(['physics', 'chemistry', 'biology', 'astronomy']);

export function validateRoomMissionPayload(
  roomIdParam: unknown,
  body: unknown
): ValidationResult<ValidatedRoomMissionPayload> {
  const errors: string[] = [];

  if (typeof roomIdParam !== 'string' || !roomIdParam.trim()) {
    errors.push('Parameter "roomId" wajib diisi.');
  } else if (roomIdParam.trim().length > 32) {
    errors.push('Parameter "roomId" melebihi batas 32 karakter.');
  }

  if (!isPlainObject(body)) {
    return fail('Payload misi room harus berupa objek JSON.', errors);
  }

  const teacherName = checkOptionalString(body, 'teacherName', 120, errors, true);
  const missionRaw = body.mission;

  if (missionRaw !== undefined && missionRaw !== null) {
    if (!isPlainObject(missionRaw)) {
      errors.push('Field "mission" harus berupa objek atau null.');
    } else {
      if (typeof missionRaw.title !== 'string' || !missionRaw.title.trim()) {
        errors.push('Field "mission.title" wajib berupa string tidak kosong.');
      } else if (missionRaw.title.trim().length > 200) {
        errors.push('Field "mission.title" melebihi batas 200 karakter.');
      }
      if (missionRaw.narrative !== undefined) {
        if (typeof missionRaw.narrative !== 'string') {
          errors.push('Field "mission.narrative" harus berupa string.');
        } else if (missionRaw.narrative.length > 3000) {
          errors.push('Field "mission.narrative" melebihi batas 3000 karakter.');
        }
      }
      if (missionRaw.moduleId !== undefined) {
        if (typeof missionRaw.moduleId !== 'string' || !missionRaw.moduleId.trim()) {
          errors.push('Field "mission.moduleId" harus berupa string tidak kosong.');
        } else if (missionRaw.moduleId.length > 100) {
          errors.push('Field "mission.moduleId" melebihi batas 100 karakter.');
        }
      }
      if (
        missionRaw.domain !== undefined &&
        (typeof missionRaw.domain !== 'string' || !ALLOWED_MISSION_DOMAINS.has(missionRaw.domain))
      ) {
        errors.push('Field "mission.domain" tidak valid.');
      }
      if (missionRaw.targetVariable !== undefined) {
        if (!isPlainObject(missionRaw.targetVariable)) {
          errors.push('Field "mission.targetVariable" harus berupa objek.');
        } else {
          const tv = missionRaw.targetVariable;
          for (const k of ['targetValue', 'minSuccessValue', 'maxSuccessValue'] as const) {
            if (tv[k] !== undefined && !isFiniteNum(tv[k])) {
              errors.push(`Field "mission.targetVariable.${k}" harus berupa angka valid.`);
            }
          }
        }
      }
      if (missionRaw.contextualQuestions !== undefined) {
        if (!Array.isArray(missionRaw.contextualQuestions)) {
          errors.push('Field "mission.contextualQuestions" harus berupa array.');
        } else if (missionRaw.contextualQuestions.length > 20) {
          errors.push('Field "mission.contextualQuestions" melebihi batas 20 pertanyaan.');
        }
      }
    }
  }

  if (errors.length > 0) {
    return fail(errors[0], errors);
  }

  return {
    ok: true,
    data: {
      roomId: String(roomIdParam).trim().toUpperCase(),
      teacherName,
      mission: (missionRaw as Record<string, unknown> | null | undefined) ?? null,
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

  const errors: string[] = [];
  if (body.telemetry !== undefined && !isPlainObject(body.telemetry)) {
    return fail('Field "telemetry" harus berupa objek JSON.');
  }

  const raw = isPlainObject(body.telemetry) ? body.telemetry : body;
  if (typeof raw.domain !== 'string' || !raw.domain.trim()) {
    errors.push('Field "domain" pada telemetri wajib berupa string tidak kosong.');
  } else if (raw.domain.trim().length > 50) {
    errors.push('Field "domain" melebihi batas 50 karakter.');
  }

  checkOptionalString(raw, 'topic', 150, errors, true);
  checkOptionalString(raw, 'moduleId', 150, errors, true);
  checkOptionalString(raw, 'educationLevel', 50, errors, true);
  checkOptionalString(raw, 'educationTier', 50, errors, true);
  checkOptionalString(raw, 'studentQuery', 2000, errors, true);

  if (raw.currentParameters !== undefined && !isPlainObject(raw.currentParameters)) {
    errors.push('Field "currentParameters" harus berupa objek.');
  }
  if (raw.currentParams !== undefined && !isPlainObject(raw.currentParams)) {
    errors.push('Field "currentParams" harus berupa objek.');
  }
  if (raw.recordedData !== undefined) {
    if (!Array.isArray(raw.recordedData)) {
      errors.push('Field "recordedData" harus berupa array.');
    } else if (raw.recordedData.length > 200) {
      errors.push('Field "recordedData" melebihi batas 200 baris.');
    }
  }
  if (raw.analytics !== undefined) {
    if (!isPlainObject(raw.analytics)) {
      errors.push('Field "analytics" harus berupa objek.');
    } else {
      for (const k of ['rSquared', 'slope', 'intercept', 'stdDev'] as const) {
        if (raw.analytics[k] !== undefined && !isFiniteNum(raw.analytics[k])) {
          errors.push(`Field "analytics.${k}" harus berupa angka valid.`);
        }
      }
      if (
        raw.analytics.equation !== undefined &&
        (typeof raw.analytics.equation !== 'string' || raw.analytics.equation.length > 200)
      ) {
        errors.push('Field "analytics.equation" harus berupa string maksimal 200 karakter.');
      }
    }
  }

  if (errors.length > 0) {
    return fail(errors[0], errors);
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

  const errors: string[] = [];
  const message = checkOptionalString(body, 'message', 2000, errors, true);

  let telemetry: Record<string, unknown> | undefined;
  if (body.telemetry !== undefined) {
    if (!isPlainObject(body.telemetry)) {
      errors.push('Field "telemetry" harus berupa objek.');
    } else {
      telemetry = body.telemetry;
      checkOptionalString(telemetry, 'domain', 50, errors, true);
      checkOptionalString(telemetry, 'topic', 150, errors, true);
      checkOptionalString(telemetry, 'studentQuery', 2000, errors, true);
    }
  }

  let history: Array<{ role?: string; text?: string }> | undefined;
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      errors.push('Field "history" harus berupa array.');
    } else if (body.history.length > 20) {
      errors.push('Field "history" melebihi batas 20 giliran.');
    } else {
      history = [];
      for (let i = 0; i < body.history.length; i++) {
        const entry = body.history[i];
        if (!isPlainObject(entry)) {
          errors.push(`Item "history[${i}]" harus berupa objek.`);
          break;
        }
        if (entry.role !== undefined && typeof entry.role !== 'string') {
          errors.push(`Field "history[${i}].role" harus berupa string.`);
        }
        if (
          entry.text !== undefined &&
          (typeof entry.text !== 'string' || entry.text.length > 4000)
        ) {
          errors.push(`Field "history[${i}].text" harus berupa string maksimal 4000 karakter.`);
        }
        history.push({
          role: typeof entry.role === 'string' ? entry.role : undefined,
          text: typeof entry.text === 'string' ? entry.text : undefined,
        });
      }
    }
  }

  const telemetryQuery =
    telemetry && typeof telemetry.studentQuery === 'string' ? telemetry.studentQuery.trim() : '';

  if (!message && !telemetry && !telemetryQuery) {
    errors.push('Minimal salah satu field "message" atau "telemetry" wajib disediakan.');
  }

  if (errors.length > 0) {
    return fail(errors[0], errors);
  }

  return {
    ok: true,
    data: {
      message: message || '',
      telemetry,
      history,
    },
  };
}

const IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
const MAX_VISION_IMAGE_CHARS = 5_000_000;

export function validateVisionDiagnosePayload(
  body: unknown
): ValidationResult<ValidatedVisionDiagnosePayload> {
  if (!isPlainObject(body)) {
    return fail('Payload diagnostik visual harus berupa objek JSON.');
  }

  const errors: string[] = [];
  if (typeof body.image !== 'string' || !body.image.trim()) {
    errors.push('Data gambar tangkapan layar 3D (image) wajib berupa string base64.');
  } else {
    const trimmedImg = body.image.trim();
    if (trimmedImg.length > MAX_VISION_IMAGE_CHARS) {
      errors.push('Ukuran gambar tangkapan layar melebihi batas maksimum.');
    } else if (!IMAGE_DATA_URL_RE.test(trimmedImg)) {
      errors.push('Format gambar harus berupa data URL base64 image (PNG/JPEG/WEBP).');
    }
  }

  const studentQuery = checkOptionalString(body, 'studentQuery', 1000, errors, true);

  let telemetry: Record<string, unknown> | undefined;
  if (body.telemetry !== undefined) {
    if (!isPlainObject(body.telemetry)) {
      errors.push('Field "telemetry" harus berupa objek.');
    } else {
      telemetry = body.telemetry;
      checkOptionalString(telemetry, 'domain', 50, errors, true);
      checkOptionalString(telemetry, 'topic', 150, errors, true);
    }
  }

  if (errors.length > 0) {
    return fail(errors[0], errors);
  }

  return {
    ok: true,
    data: {
      image: (body.image as string).trim(),
      studentQuery:
        studentQuery ||
        'Periksa penataan alat laboratorium 3D saya dan berikan analisis saintifik.',
      telemetry,
    },
  };
}

export function validateCreateSubmissionPayload(
  body: unknown
): ValidationResult<ValidatedSubmissionCreatePayload> {
  if (!isPlainObject(body)) {
    return fail('Payload laporan praktikum harus berupa objek JSON.');
  }

  const errors: string[] = [];
  const studentName = checkOptionalString(body, 'studentName', 120, errors, false);
  if (body.studentName === undefined) {
    errors.push('Field "studentName" wajib diisi.');
  }

  const moduleId = checkOptionalString(body, 'moduleId', 100, errors, false);
  if (body.moduleId === undefined) {
    errors.push('Field "moduleId" wajib diisi.');
  }

  const id = checkOptionalString(body, 'id', 80, errors, false);
  const studentId = checkOptionalString(body, 'studentId', 80, errors, true);
  const roomId = checkOptionalString(body, 'roomId', 32, errors, false);
  const domain = checkOptionalString(body, 'domain', 50, errors, false);
  const submittedAt = checkOptionalString(body, 'submittedAt', 64, errors, false);
  const hypothesisText = checkOptionalString(body, 'hypothesisText', 3000, errors, true);
  const conclusionText = checkOptionalString(body, 'conclusionText', 5000, errors, true);

  let observationData: Array<Record<string, number | string>> = [];
  if (body.observationData !== undefined) {
    if (!Array.isArray(body.observationData)) {
      errors.push('Field "observationData" harus berupa array.');
    } else if (body.observationData.length > 200) {
      errors.push('Field "observationData" melebihi batas 200 baris.');
    } else {
      for (let i = 0; i < body.observationData.length; i++) {
        if (!isPlainObject(body.observationData[i])) {
          errors.push(`Baris "observationData[${i}]" harus berupa objek.`);
          break;
        }
      }
      observationData = body.observationData as Array<Record<string, number | string>>;
    }
  }

  let regressionMetrics = {
    rSquared: 0.98,
    slope: 1.0,
    equation: 'y = mx + c',
  };
  if (body.regressionMetrics !== undefined) {
    if (!isPlainObject(body.regressionMetrics)) {
      errors.push('Field "regressionMetrics" harus berupa objek.');
    } else {
      const rm = body.regressionMetrics;
      if (rm.rSquared !== undefined && !isFiniteNum(rm.rSquared)) {
        errors.push('Field "regressionMetrics.rSquared" harus berupa angka valid.');
      }
      if (rm.slope !== undefined && !isFiniteNum(rm.slope)) {
        errors.push('Field "regressionMetrics.slope" harus berupa angka valid.');
      }
      if (
        rm.equation !== undefined &&
        (typeof rm.equation !== 'string' || rm.equation.length > 200)
      ) {
        errors.push('Field "regressionMetrics.equation" harus berupa string maksimal 200 karakter.');
      }
      regressionMetrics = {
        rSquared: isFiniteNum(rm.rSquared) ? rm.rSquared : 0,
        slope: isFiniteNum(rm.slope) ? rm.slope : 0,
        equation: typeof rm.equation === 'string' ? rm.equation.trim() : 'N/A',
      };
    }
  }

  let quizAnswers: ValidatedSubmissionCreatePayload['quizAnswers'] = [];
  if (body.quizAnswers !== undefined) {
    if (!Array.isArray(body.quizAnswers)) {
      errors.push('Field "quizAnswers" harus berupa array.');
    } else if (body.quizAnswers.length > 100) {
      errors.push('Field "quizAnswers" melebihi batas 100 item.');
    } else {
      for (let i = 0; i < body.quizAnswers.length; i++) {
        const qa = body.quizAnswers[i];
        if (!isPlainObject(qa)) {
          errors.push(`Item "quizAnswers[${i}]" harus berupa objek.`);
          break;
        }
        if (typeof qa.questionId !== 'string' || !qa.questionId.trim()) {
          errors.push(`Field "quizAnswers[${i}].questionId" wajib berupa string tidak kosong.`);
          break;
        }
        if (
          typeof qa.selectedAnswer !== 'string' &&
          !isFiniteNum(qa.selectedAnswer)
        ) {
          errors.push(`Field "quizAnswers[${i}].selectedAnswer" harus berupa string atau angka.`);
          break;
        }
        if (typeof qa.isCorrect !== 'boolean') {
          errors.push(`Field "quizAnswers[${i}].isCorrect" harus berupa boolean.`);
          break;
        }
      }
      quizAnswers = body.quizAnswers as ValidatedSubmissionCreatePayload['quizAnswers'];
    }
  }

  let quizScore = 100;
  if (body.quizScore !== undefined) {
    if (!isFiniteNum(body.quizScore) || body.quizScore < 0 || body.quizScore > 100) {
      errors.push('Field "quizScore" harus berupa angka antara 0 dan 100.');
    } else {
      quizScore = body.quizScore;
    }
  }

  let telemetryLog: ValidatedSubmissionCreatePayload['telemetryLog'];
  if (body.telemetryLog !== undefined) {
    if (!Array.isArray(body.telemetryLog)) {
      errors.push('Field "telemetryLog" harus berupa array.');
    } else if (body.telemetryLog.length > 1000) {
      errors.push('Field "telemetryLog" melebihi batas 1000 entri.');
    } else {
      for (let i = 0; i < body.telemetryLog.length; i++) {
        const entry = body.telemetryLog[i];
        if (!isPlainObject(entry)) {
          errors.push(`Item "telemetryLog[${i}]" harus berupa objek.`);
          break;
        }
        if (
          !isFiniteNum(entry.timestamp) ||
          typeof entry.parameterName !== 'string' ||
          !isFiniteNum(entry.value) ||
          !isFiniteNum(entry.stepIndex)
        ) {
          errors.push(`Entri "telemetryLog[${i}]" tidak memiliki tipe data yang valid.`);
          break;
        }
      }
      telemetryLog = body.telemetryLog as ValidatedSubmissionCreatePayload['telemetryLog'];
    }
  }

  let teacherGrade: ValidatedSubmissionCreatePayload['teacherGrade'];
  if (body.teacherGrade !== undefined) {
    if (!isPlainObject(body.teacherGrade)) {
      errors.push('Field "teacherGrade" harus berupa objek.');
    } else {
      const tg = body.teacherGrade;
      if (!isFiniteNum(tg.score) || tg.score < 0 || tg.score > 100) {
        errors.push('Field "teacherGrade.score" harus berupa angka antara 0 dan 100.');
      }
      if (
        tg.feedback !== undefined &&
        (typeof tg.feedback !== 'string' || tg.feedback.length > 2000)
      ) {
        errors.push('Field "teacherGrade.feedback" harus berupa string maksimal 2000 karakter.');
      }
      teacherGrade = {
        score: isFiniteNum(tg.score) ? tg.score : 0,
        feedback: typeof tg.feedback === 'string' ? tg.feedback.trim() : '',
        gradedAt:
          typeof tg.gradedAt === 'string' && tg.gradedAt.trim()
            ? tg.gradedAt.trim()
            : new Date().toISOString(),
      };
    }
  }

  if (errors.length > 0) {
    return fail(errors[0], errors);
  }

  return {
    ok: true,
    data: {
      id,
      studentName: studentName!,
      studentId,
      roomId: roomId || 'LAB-ALPHA',
      domain: domain || 'Fisika',
      moduleId: moduleId!,
      submittedAt: submittedAt || new Date().toISOString(),
      hypothesisText: hypothesisText || '',
      observationData,
      regressionMetrics,
      quizAnswers,
      quizScore,
      conclusionText: conclusionText || '',
      telemetryLog,
      teacherGrade,
    },
  };
}

export function validateGradeSubmissionPayload(
  idParam: unknown,
  body: unknown
): ValidationResult<ValidatedSubmissionGradePayload> {
  const errors: string[] = [];

  if (typeof idParam !== 'string' || !idParam.trim()) {
    errors.push('Parameter ID laporan wajib diisi.');
  } else if (idParam.trim().length > 80) {
    errors.push('Parameter ID laporan melebihi batas 80 karakter.');
  }

  if (!isPlainObject(body)) {
    return fail('Payload penilaian harus berupa objek JSON.', errors);
  }

  if (!isFiniteNum(body.score) || body.score < 0 || body.score > 100) {
    errors.push('Nilai (score) harus berupa angka antara 0 dan 100.');
  }

  const feedback = checkOptionalString(body, 'feedback', 2000, errors, true);

  if (errors.length > 0) {
    return fail(errors[0], errors);
  }

  return {
    ok: true,
    data: {
      id: String(idParam).trim(),
      score: body.score as number,
      feedback: feedback || '',
    },
  };
}
