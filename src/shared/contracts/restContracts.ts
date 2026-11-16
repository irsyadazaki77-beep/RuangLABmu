import { z } from 'zod';

const IMAGE_DATA_URL_RE = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
export const MAX_VISION_IMAGE_CHARS = 5_000_000;

export const ValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const ApiValidationErrorResponseSchema = z.object({
  error: z.literal('VALIDATION_ERROR'),
  code: z.literal('INVALID_PAYLOAD'),
  message: z.string(),
  issues: z.array(ValidationIssueSchema),
  details: z.array(z.string()),
});

export const AutosavePayloadSchema = z.object({
  storageKey: z
    .string({ error: 'Field "storageKey" wajib berupa string.' })
    .trim()
    .min(1, 'Field "storageKey" tidak boleh kosong.')
    .max(180, 'Field "storageKey" melebihi batas 180 karakter.'),
  version: z
    .number({ error: 'Field "version" wajib berupa angka.' })
    .finite('Field "version" harus berupa angka valid.'),
  session: z.unknown(),
  sessionToken: z.string().trim().max(256).optional(),
  studentId: z.string().trim().max(120).optional(),
});

export const RoomRejoinSchema = z.object({
  roomPin: z
    .string({ error: 'Parameter "roomPin" wajib berupa string.' })
    .trim()
    .min(1, 'Parameter roomPin wajib diisi untuk pemulihan sesi 3T.')
    .max(64, 'Parameter "roomPin" melebihi batas 64 karakter.'),
  participantId: z
    .string({ error: 'Parameter "participantId" wajib berupa string.' })
    .trim()
    .min(1, 'Parameter participantId wajib diisi untuk pemulihan sesi 3T.')
    .max(120, 'Parameter "participantId" melebihi batas 120 karakter.'),
  roomId: z.string().trim().max(32).optional(),
});

export const RoomSnapshotSchema = z.object({
  roomPin: z
    .string({ error: 'Parameter "roomPin" wajib berupa string.' })
    .trim()
    .min(1, 'Parameter "roomPin" tidak boleh kosong.')
    .max(64, 'Parameter "roomPin" melebihi batas 64 karakter.'),
  params: z.record(z.string(), z.unknown(), {
    error: 'Field "params" harus berupa objek JSON.',
  }),
});

export const GenerateMissionSchema = z
  .object({
    moduleId: z.string().trim().min(1, 'Field "moduleId" tidak boleh kosong.').max(100).optional(),
    caseStudyPrompt: z.string().max(2000).optional(),
    storyPrompt: z.string().max(2000).optional(),
    prompt: z.string().max(2000).optional(),
    teacherName: z.string().trim().max(120).optional(),
    roomId: z.string().trim().min(1, 'Field "roomId" tidak boleh kosong.').max(32).optional(),
    publishToRoom: z.boolean({ error: 'Field "publishToRoom" harus berupa boolean.' }).optional(),
  })
  .superRefine((val, ctx) => {
    const resolved = (val.caseStudyPrompt || val.storyPrompt || val.prompt || '').trim();
    if (!resolved) {
      ctx.addIssue({
        code: 'custom',
        path: ['caseStudyPrompt'],
        message: 'Deskripsi studi kasus cerita (caseStudyPrompt) wajib diisi.',
      });
    } else if (resolved.length > 2000) {
      ctx.addIssue({
        code: 'custom',
        path: ['caseStudyPrompt'],
        message: 'Deskripsi studi kasus cerita melebihi batas maksimum 2000 karakter.',
      });
    }
  });

export const RoomMissionObjectSchema = z
  .object({
    title: z
      .string({ error: 'Field "mission.title" wajib berupa string.' })
      .trim()
      .min(1, 'Field "mission.title" wajib berupa string tidak kosong.')
      .max(200, 'Field "mission.title" melebihi batas 200 karakter.'),
    narrative: z.string().max(3000, 'Field "mission.narrative" melebihi batas 3000 karakter.').optional(),
    moduleId: z
      .string()
      .trim()
      .min(1, 'Field "mission.moduleId" harus berupa string tidak kosong.')
      .max(100, 'Field "mission.moduleId" melebihi batas 100 karakter.')
      .optional(),
    domain: z.enum(['physics', 'chemistry', 'biology', 'astronomy']).optional(),
    targetVariable: z
      .object({
        variableKey: z.string().optional(),
        variableLabel: z.string().optional(),
        unit: z.string().optional(),
        targetValue: z.number().finite().optional(),
        minSuccessValue: z.number().finite().optional(),
        maxSuccessValue: z.number().finite().optional(),
      })
      .passthrough()
      .optional(),
    contextualQuestions: z.array(z.unknown()).max(20).optional(),
  })
  .passthrough();

export const RoomMissionUpdateSchema = z.object({
  roomId: z
    .string({ error: 'Parameter "roomId" wajib diisi.' })
    .trim()
    .min(1, 'Parameter "roomId" wajib diisi.')
    .max(32, 'Parameter "roomId" melebihi batas 32 karakter.'),
  teacherName: z.string().trim().max(120).optional(),
  mission: RoomMissionObjectSchema.nullable().optional(),
});

export const TelemetryAnalyticsSchema = z
  .object({
    rSquared: z.number().finite().optional(),
    slope: z.number().finite().optional(),
    intercept: z.number().finite().optional(),
    stdDev: z.number().finite().optional(),
    equation: z.string().max(200).optional(),
  })
  .passthrough();

export const DrLabMuTelemetrySchema = z
  .object({
    domain: z
      .string({ error: 'Field "domain" pada telemetri wajib berupa string tidak kosong.' })
      .trim()
      .min(1, 'Field "domain" pada telemetri wajib berupa string tidak kosong.')
      .max(50, 'Field "domain" melebihi batas 50 karakter.'),
    topic: z.string().trim().max(150).optional(),
    moduleId: z.string().trim().max(150).optional(),
    educationLevel: z.string().trim().max(50).optional(),
    educationTier: z.string().trim().max(50).optional(),
    studentQuery: z.string().trim().max(2000).optional(),
    currentParameters: z.record(z.string(), z.unknown()).optional(),
    currentParams: z.record(z.string(), z.unknown()).optional(),
    recordedData: z.array(z.unknown()).max(200).optional(),
    analytics: TelemetryAnalyticsSchema.optional(),
  })
  .passthrough();

export const AiConversationalSchema = z
  .object({
    message: z.string().trim().max(2000).optional(),
    telemetry: z
      .object({
        domain: z.string().trim().max(50).optional(),
        topic: z.string().trim().max(150).optional(),
        studentQuery: z.string().trim().max(2000).optional(),
      })
      .passthrough()
      .optional(),
    history: z
      .array(
        z.object({
          role: z.string().optional(),
          text: z.string().max(4000).optional(),
        })
      )
      .max(20)
      .optional(),
  })
  .superRefine((val, ctx) => {
    const telemetryQuery =
      val.telemetry && typeof val.telemetry.studentQuery === 'string'
        ? val.telemetry.studentQuery.trim()
        : '';
    if (!val.message && !val.telemetry && !telemetryQuery) {
      ctx.addIssue({
        code: 'custom',
        path: ['message'],
        message: 'Minimal salah satu field "message" atau "telemetry" wajib disediakan.',
      });
    }
  });

export const VisionDiagnoseSchema = z.object({
  image: z
    .string({ error: 'Data gambar tangkapan layar 3D (image) wajib berupa string base64.' })
    .trim()
    .min(1, 'Data gambar tangkapan layar 3D (image) wajib berupa string base64.')
    .max(MAX_VISION_IMAGE_CHARS, 'Ukuran gambar tangkapan layar melebihi batas maksimum.')
    .regex(
      IMAGE_DATA_URL_RE,
      'Format gambar harus berupa data URL base64 image (PNG/JPEG/WEBP).'
    ),
  studentQuery: z.string().trim().max(1000).optional(),
  telemetry: z
    .object({
      domain: z.string().trim().max(50).optional(),
      topic: z.string().trim().max(150).optional(),
    })
    .passthrough()
    .optional(),
});

export const SubmissionCreateSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  studentName: z
    .string({ error: 'Field "studentName" wajib diisi.' })
    .trim()
    .min(1, 'Field "studentName" tidak boleh kosong.')
    .max(120, 'Field "studentName" melebihi batas 120 karakter.'),
  studentId: z.string().trim().max(80).optional(),
  roomId: z.string().trim().min(1).max(32).optional(),
  domain: z.string().trim().min(1).max(50).optional(),
  moduleId: z
    .string({ error: 'Field "moduleId" wajib diisi.' })
    .trim()
    .min(1, 'Field "moduleId" tidak boleh kosong.')
    .max(100, 'Field "moduleId" melebihi batas 100 karakter.'),
  submittedAt: z.string().trim().min(1).max(64).optional(),
  hypothesisText: z.string().trim().max(3000).optional(),
  conclusionText: z.string().trim().max(5000).optional(),
  observationData: z
    .array(z.record(z.string(), z.union([z.number().finite(), z.string()])))
    .max(200)
    .optional(),
  regressionMetrics: z
    .object({
      rSquared: z.number().finite().optional(),
      slope: z.number().finite().optional(),
      equation: z.string().max(200).optional(),
    })
    .optional(),
  quizAnswers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        selectedAnswer: z.union([z.string(), z.number().finite()]),
        isCorrect: z.boolean(),
      })
    )
    .max(100)
    .optional(),
  quizScore: z.number().finite().min(0).max(100).optional(),
  telemetryLog: z
    .array(
      z.object({
        timestamp: z.number().finite(),
        parameterName: z.string(),
        value: z.number().finite(),
        stepIndex: z.number().finite(),
        domain: z.string().optional(),
        eventType: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .max(1000)
    .optional(),
  teacherGrade: z
    .object({
      score: z.number().finite().min(0).max(100),
      feedback: z.string().max(2000).optional(),
      gradedAt: z.string().optional(),
    })
    .optional(),
});

export const SubmissionGradeSchema = z.object({
  id: z
    .string({ error: 'Parameter ID laporan wajib diisi.' })
    .trim()
    .min(1, 'Parameter ID laporan wajib diisi.')
    .max(80, 'Parameter ID laporan melebihi batas 80 karakter.'),
  score: z
    .number({ error: 'Nilai (score) harus berupa angka antara 0 dan 100.' })
    .finite('Nilai (score) harus berupa angka valid.')
    .min(0, 'Nilai (score) minimal 0.')
    .max(100, 'Nilai (score) maksimal 100.'),
  feedback: z.string().trim().max(2000).optional(),
});

export type AutosavePayload = z.infer<typeof AutosavePayloadSchema>;
export type RoomRejoinPayload = z.infer<typeof RoomRejoinSchema>;
export type RoomSnapshotPayload = z.infer<typeof RoomSnapshotSchema>;
export type GenerateMissionPayload = z.infer<typeof GenerateMissionSchema>;
export type RoomMissionUpdatePayload = z.infer<typeof RoomMissionUpdateSchema>;
export type DrLabMuTelemetryPayload = z.infer<typeof DrLabMuTelemetrySchema>;
export type AiConversationalPayload = z.infer<typeof AiConversationalSchema>;
export type VisionDiagnosePayload = z.infer<typeof VisionDiagnoseSchema>;
export type SubmissionCreatePayload = z.infer<typeof SubmissionCreateSchema>;
export type SubmissionGradePayload = z.infer<typeof SubmissionGradeSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
