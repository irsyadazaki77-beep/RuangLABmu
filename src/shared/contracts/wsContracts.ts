import { z } from 'zod';

export const LabDomainSchema = z.enum(['fisika', 'kimia', 'biologi', 'astronomi']);
export const RoomDomainSchema = z.enum(['physics', 'chemistry', 'biology', 'astronomy']);
export const ClientRoleDisplaySchema = z.enum(['Siswa', 'Pengajar']);
export const RoomClientRoleSchema = z.enum(['teacher', 'student']);
export const Vec3Schema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

export const WsSchoolIdSchema = z.string().trim().min(1).max(64).optional().default('default-school');
export const WsClientMutationIdSchema = z.string().trim().uuid().optional();

export const SpatialCursorPayloadSchema = z.object({
  userId: z.string().min(1).max(120),
  userName: z.string().min(1).max(120),
  role: ClientRoleDisplaySchema,
  groupId: z.string().max(120),
  domain: LabDomainSchema,
  color: z.string().min(1).max(40),
  position: Vec3Schema,
  normal: Vec3Schema.optional(),
  hoveredObject: z.string().max(120).optional(),
  updatedAt: z.number().finite(),
  schoolId: WsSchoolIdSchema,
});

export const ParameterLockPayloadSchema = z.object({
  groupId: z.string().max(120),
  domain: LabDomainSchema,
  paramKey: z.string().min(1).max(120),
  lockedByUserId: z.string().min(1).max(120),
  lockedByName: z.string().min(1).max(120),
  expiresAt: z.number().finite(),
});

export const StudentLiveTelemetrySchema = z
  .object({
    domain: z.string().min(1).max(60),
    topic: z.string().max(150).optional(),
    moduleId: z.string().min(1).max(120),
    moduleTitle: z.string().max(200).optional(),
    trialsCount: z.number().finite().optional(),
    recordsCount: z.number().finite().optional(),
    currentParameters: z
      .record(z.string(), z.union([z.number().finite(), z.string(), z.boolean(), z.undefined()]))
      .optional(),
    rSquared: z.number().finite(),
    currentActivity: z.string().max(300).optional(),
    status: z.string().max(60).optional(),
    lastUpdated: z.string().max(60),
    parametersSummary: z.string().max(500).optional(),
    studentName: z.string().max(120).optional(),
  })
  .passthrough();

export const LabRoomClientSchema = z.object({
  socketId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  role: RoomClientRoleSchema,
  groupId: z.string().optional(),
  joinedAt: z.number().finite(),
  telemetry: StudentLiveTelemetrySchema.optional(),
});

export const CustomAIMissionQuestionSchema = z.object({
  id: z.string().min(1),
  questionText: z.string().min(1),
  expectedConceptOrValue: z.string(),
  hint: z.string(),
});

export const CustomAIMissionTargetSchema = z.object({
  variableKey: z.string().min(1),
  variableLabel: z.string().min(1),
  unit: z.string(),
  targetValue: z.number().finite(),
  minSuccessValue: z.number().finite(),
  maxSuccessValue: z.number().finite(),
});

export const CustomAIMissionPayloadSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  domain: RoomDomainSchema,
  caseStudyPrompt: z.string(),
  title: z.string().min(1),
  narrative: z.string(),
  targetVariable: CustomAIMissionTargetSchema,
  contextualQuestions: z.array(CustomAIMissionQuestionSchema).max(20),
  createdByTeacher: z.string(),
  roomId: z.string().min(1),
  createdAt: z.number().finite(),
  source: z.enum(['gemini-api', 'deterministic-engine']).optional(),
});

export const LabRoomSchema = z.object({
  roomId: z.string().min(1).max(32),
  pin: z.string().optional(),
  schoolId: z.string().max(64).optional(),
  domain: RoomDomainSchema,
  moduleId: z.string().min(1),
  teacherSocketId: z.string().optional(),
  teacherName: z.string().optional(),
  isFrozenByTeacher: z.boolean(),
  createdAt: z.number().finite(),
  lastActivityAt: z.number().finite().optional(),
  clients: z.record(z.string(), LabRoomClientSchema),
  customMission: CustomAIMissionPayloadSchema.nullable().optional(),
});

export const TeacherLaserRayPayloadSchema = z.object({
  roomId: z.string().min(1).max(32).optional(),
  teacherName: z.string().max(120).optional(),
  teacherPin: z.string().max(64).optional(),
  pin: z.string().max(64).optional(),
  teacherToken: z.string().max(1024).optional(),
  sessionToken: z.string().max(1024).optional(),
  point: Vec3Schema,
  normal: Vec3Schema.optional(),
  hoveredObject: z.string().max(120).optional(),
  active: z.boolean(),
  updatedAt: z.number().finite().optional(),
});

export const TeacherCameraSyncPayloadSchema = z.object({
  roomId: z.string().min(1).max(32).optional(),
  teacherName: z.string().max(120).optional(),
  teacherPin: z.string().max(64).optional(),
  pin: z.string().max(64).optional(),
  teacherToken: z.string().max(1024).optional(),
  sessionToken: z.string().max(1024).optional(),
  enabled: z.boolean(),
  position: Vec3Schema,
  target: Vec3Schema,
  seq: z.number().finite().optional(),
  updatedAt: z.number().finite().optional(),
});

export const ScienceDomainDisplaySchema = z.enum(['Fisika', 'Kimia', 'Biologi', 'Astronomi']);
export const NotificationDomainSchema = z.enum([
  'Fisika',
  'Kimia',
  'Biologi',
  'Astronomi',
  'Kolaborasi',
  'Pengajar',
]);

export const ServerExperimentRecordSchema = z
  .object({
    id: z.string().min(1).max(120),
    timestamp: z.string().max(60),
    studentName: z.string().min(1).max(120),
    groupId: z.string().max(120),
    domain: ScienceDomainDisplaySchema,
    moduleId: z.string().max(120).optional(),
    experimentTitle: z.string().min(1).max(200),
    parametersSummary: z.string().max(1000).optional().default(''),
    keyMetrics: z.record(z.string(), z.union([z.number().finite(), z.string()])).optional().default({}),
    numericX: z.number().finite().optional(),
    numericY1: z.number().finite().optional(),
    numericY2: z.number().finite().optional(),
    notes: z.string().max(2000).optional().default(''),
  })
  .passthrough();

export const ServerNotificationSchema = z
  .object({
    id: z.string().min(1).max(120),
    timestamp: z.string().max(60),
    severity: z.enum(['nominal', 'elevated', 'critical']),
    domain: NotificationDomainSchema,
    title: z.string().min(1).max(200),
    message: z.string().max(2000),
    formulaHint: z.string().max(500).optional(),
    expiresAt: z.number().finite().optional(),
  })
  .passthrough();

export const ClientIdentifyPayloadSchema = z.object({
  userId: z.string().max(120).optional(),
  userName: z.string().max(120).optional(),
  groupId: z.string().max(120).optional(),
  domain: LabDomainSchema.optional(),
  roomId: z.string().max(32).nullable().optional(),
  schoolId: z.string().trim().min(1).max(64).optional(),
  role: z.string().max(40).optional(),
  teacherPin: z.string().max(64).optional(),
  pin: z.string().max(64).optional(),
  teacherToken: z.string().max(1024).optional(),
  sessionToken: z.string().max(1024).optional(),
});

export const ClientToServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('client:identify'),
    payload: ClientIdentifyPayloadSchema,
  }),
  z.object({
    type: z.literal('ROOM_CREATE'),
    payload: z.object({
      roomId: z.string().max(32).optional(),
      pin: z.string().max(64).optional(),
      domain: RoomDomainSchema.optional(),
      moduleId: z.string().max(120).optional(),
      teacherName: z.string().max(120).optional(),
      teacherUserId: z.string().max(120).optional(),
      sessionToken: z.string().max(1024).optional(),
      schoolId: WsSchoolIdSchema,
      clientMutationId: WsClientMutationIdSchema,
    }),
  }),
  z.object({
    type: z.literal('ROOM_JOIN'),
    payload: z.object({
      roomId: z.string().trim().min(1).max(32),
      pin: z.union([z.string().max(64), z.number().finite()]).optional(),
      teacherPin: z.string().max(64).optional(),
      teacherToken: z.string().max(1024).optional(),
      sessionToken: z.string().max(1024).optional(),
      name: z.string().max(120).optional(),
      role: z.string().max(40).optional(),
      userId: z.string().max(120).optional(),
      groupId: z.string().max(120).optional(),
      isReconnect: z.boolean().optional(),
      isVerifiedTeacherReconnect: z.boolean().optional(),
      schoolId: WsSchoolIdSchema,
    }),
  }),
  z.object({
    type: z.literal('ROOM_REJOIN'),
    payload: z.object({
      roomPin: z.string().max(64).optional(),
      pin: z.string().max(64).optional(),
      participantId: z.string().max(120).optional(),
      userId: z.string().max(120).optional(),
      roomId: z.string().max(32).optional(),
      name: z.string().max(120).optional(),
      role: z.string().max(40).optional(),
      groupId: z.string().max(120).optional(),
    }),
  }),
  z.object({
    type: z.literal('SIMULATION_SNAPSHOT_PUSH'),
    payload: z.object({
      roomPin: z.string().max(64).optional(),
      roomId: z.string().max(32).optional(),
      params: z.record(z.string(), z.unknown()),
      updatedAt: z.number().finite().optional(),
    }),
  }),
  z.object({
    type: z.literal('ROOM_LEAVE'),
    payload: z
      .object({
        roomId: z.string().max(32).optional(),
        userId: z.string().max(120).optional(),
      })
      .optional()
      .default({}),
  }),
  z.object({
    type: z.literal('TEACHER_FREEZE_TOGGLE'),
    payload: z.object({
      roomId: z.string().max(32).optional(),
      isFrozen: z.boolean(),
      teacherName: z.string().max(120).optional(),
      teacherPin: z.string().max(64).optional(),
      pin: z.string().max(64).optional(),
      teacherToken: z.string().max(1024).optional(),
      sessionToken: z.string().max(1024).optional(),
    }),
  }),
  z.object({
    type: z.literal('TEACHER_LASER_RAY'),
    payload: TeacherLaserRayPayloadSchema,
  }),
  z.object({
    type: z.literal('TEACHER_CAMERA_SYNC'),
    payload: TeacherCameraSyncPayloadSchema,
  }),
  z.object({
    type: z.literal('ROOM_SET_CUSTOM_MISSION'),
    payload: z.object({
      roomId: z.string().max(32).optional(),
      customMission: CustomAIMissionPayloadSchema.nullable(),
      teacherName: z.string().max(120).optional(),
      teacherPin: z.string().max(64).optional(),
      pin: z.string().max(64).optional(),
      teacherToken: z.string().max(1024).optional(),
      sessionToken: z.string().max(1024).optional(),
    }),
  }),
  z.object({
    type: z.literal('STUDENT_TELEMETRY_SYNC'),
    payload: z.object({
      roomId: z.string().max(32).optional(),
      studentName: z.string().max(120).optional(),
      userId: z.string().max(120).optional(),
      telemetry: StudentLiveTelemetrySchema,
    }),
  }),
  z.object({
    type: z.literal('CURSOR_3D_MOVE'),
    payload: SpatialCursorPayloadSchema,
  }),
  z.object({
    type: z.literal('CURSOR_3D_LEAVE'),
    payload: z.object({
      userId: z.string().min(1).max(120),
      groupId: z.string().max(120).optional(),
    }),
  }),
  z.object({
    type: z.literal('PARAM_LOCK_ACQUIRE'),
    payload: ParameterLockPayloadSchema,
  }),
  z.object({
    type: z.literal('PARAM_LOCK_RELEASE'),
    payload: z.object({
      groupId: z.string().max(120),
      domain: z.string().max(60).optional(),
      paramKey: z.string().min(1).max(120),
      userId: z.string().min(1).max(120),
    }),
  }),
  z.object({
    type: z.literal('PARAM_LOCK_RESET_ALL'),
    payload: z
      .object({
        roomId: z.string().max(32).optional(),
        groupId: z.string().max(120).optional(),
        clearedCount: z.number().finite().optional(),
        teacherPin: z.string().max(64).optional(),
        pin: z.string().max(64).optional(),
        teacherToken: z.string().max(1024).optional(),
        sessionToken: z.string().max(1024).optional(),
      })
      .optional()
      .default({}),
  }),
  z.object({
    type: z.literal('PARAM_VALUE_SYNC'),
    payload: z.object({
      groupId: z.string().max(120),
      domain: z.string().max(60).optional(),
      paramKey: z.string().min(1).max(120),
      value: z.number().finite(),
      updatedBy: z.string().max(120).optional(),
      schoolId: WsSchoolIdSchema,
      clientMutationId: WsClientMutationIdSchema,
    }),
  }),
  z.object({
    type: z.literal('record:create'),
    payload: ServerExperimentRecordSchema,
  }),
  z.object({
    type: z.literal('record:delete'),
    payload: z.object({
      id: z.string().min(1).max(120),
    }),
  }),
  z.object({
    type: z.literal('task:toggle'),
    payload: z.object({
      id: z.string().min(1).max(120),
      studentName: z.string().max(120).optional(),
    }),
  }),
  z.object({
    type: z.literal('task:create'),
    payload: z.object({
      id: z.string().max(120).optional(),
      groupId: z.string().max(120).optional(),
      title: z.string().trim().min(1).max(400),
      domain: z.string().max(60).optional(),
      completed: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal('note:create'),
    payload: z.object({
      id: z.string().max(120).optional(),
      groupId: z.string().max(120).optional(),
      author: z.string().max(120).optional(),
      role: ClientRoleDisplaySchema.optional(),
      text: z.string().trim().min(1).max(2000),
      timestamp: z.string().max(60).optional(),
    }),
  }),
  z.object({
    type: z.literal('quiz:submit'),
    payload: z.object({
      studentName: z.string().max(120).optional(),
      score: z.number().finite().min(0).max(100),
      correctCount: z.number().finite().min(0).optional(),
    }),
  }),
  z.object({
    type: z.literal('notification:push'),
    payload: ServerNotificationSchema,
  }),
  z.object({
    type: z.literal('teacher:feedback'),
    payload: z.object({
      targetStudentId: z.string().max(120).optional(),
      message: z
        .string()
        .trim()
        .min(1, 'Pesan feedback pengajar wajib diisi.')
        .max(2000),
      author: z.string().max(120).optional(),
      roomId: z.string().max(32).optional(),
      teacherPin: z.string().max(64).optional(),
      pin: z.string().max(64).optional(),
      teacherToken: z.string().max(1024).optional(),
      sessionToken: z.string().max(1024).optional(),
    }),
  }),
  z.object({
    type: z.literal('mystery:broadcast'),
    payload: z.object({
      challenge: z
        .object({
          id: z.string().trim().max(120).optional(),
          codename: z.string().trim().max(120).optional(),
          codeName: z.string().trim().max(120).optional(),
          title: z.string().trim().min(1).max(200).optional(),
          domain: z.string().trim().max(60).optional(),
        })
        .passthrough(),
      author: z.string().max(120).optional(),
      roomId: z.string().max(32).optional(),
      teacherPin: z.string().max(64).optional(),
      pin: z.string().max(64).optional(),
      teacherToken: z.string().max(1024).optional(),
      sessionToken: z.string().max(1024).optional(),
    }),
  }),
  z.object({
    type: z.literal('mystery:submit'),
    payload: z.object({
      studentName: z.string().max(120).optional(),
      challengeTitle: z.string().max(200).optional(),
      result: z
        .object({
          score: z.number().finite().min(0).max(100),
          passed: z.boolean().optional(),
          studentGuess: z.union([z.number().finite(), z.string().max(120)]).optional(),
          submittedValue: z.union([z.number().finite(), z.string().max(120)]).optional(),
          unit: z.string().max(40).optional(),
          errorPercentage: z.number().finite().optional(),
          errorPercent: z.number().finite().optional(),
        })
        .passthrough(),
    }),
  }),
]);

export const WsValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const WsErrorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  issues: z.array(WsValidationIssueSchema).optional(),
});

export const ServerToClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init:state'),
    payload: z.object({
      records: z.array(z.record(z.string(), z.unknown())).optional(),
      tasks: z.array(z.record(z.string(), z.unknown())).optional(),
      notes: z.array(z.record(z.string(), z.unknown())).optional(),
      students: z.array(z.record(z.string(), z.unknown())).optional(),
      notifications: z.array(z.record(z.string(), z.unknown())).optional(),
      paramLocks: z.array(ParameterLockPayloadSchema).optional(),
    }),
  }),
  z.object({
    type: z.literal('ROOM_CREATED'),
    payload: z.object({
      room: LabRoomSchema.extend({ pin: z.string() }),
    }),
  }),
  z.object({
    type: z.literal('ROOM_JOINED'),
    payload: z.object({
      room: LabRoomSchema,
      client: LabRoomClientSchema,
      isReconnect: z.boolean().optional(),
      latestSimulationSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
      paramLocks: z.array(ParameterLockPayloadSchema).optional(),
    }),
  }),
  z.object({
    type: z.literal('ROOM_STATE_SYNC'),
    payload: z.object({
      room: LabRoomSchema,
    }),
  }),
  z.object({
    type: z.literal('ROOM_MISSION_UPDATED'),
    payload: z.object({
      roomId: z.string().min(1),
      customMission: CustomAIMissionPayloadSchema.nullable(),
      room: LabRoomSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('ROOM_ERROR'),
    payload: z.object({
      message: z.string().min(1),
      code: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal('ERROR'),
    payload: WsErrorPayloadSchema,
  }),
  z.object({
    type: z.literal('SIMULATION_SNAPSHOT_RESTORE'),
    payload: z.object({
      roomPin: z.string(),
      roomId: z.string().optional(),
      params: z.record(z.string(), z.unknown()),
      updatedAt: z.number().finite(),
    }),
  }),
  z.object({
    type: z.literal('TEACHER_FREEZE_TOGGLE'),
    payload: z.object({
      roomId: z.string().optional(),
      isFrozen: z.boolean(),
      teacherName: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('TEACHER_LASER_RAY'),
    payload: TeacherLaserRayPayloadSchema.extend({
      roomId: z.string().min(1),
      teacherName: z.string().min(1),
      updatedAt: z.number().finite(),
    }),
  }),
  z.object({
    type: z.literal('TEACHER_CAMERA_SYNC'),
    payload: TeacherCameraSyncPayloadSchema.extend({
      roomId: z.string().min(1),
      teacherName: z.string().min(1),
      seq: z.number().finite(),
      updatedAt: z.number().finite(),
    }),
  }),
  z.object({
    type: z.literal('STUDENT_TELEMETRY_SYNC'),
    payload: z.object({
      roomId: z.string().optional(),
      studentName: z.string().optional(),
      telemetry: StudentLiveTelemetrySchema.extend({
        studentName: z.string().min(1),
      }),
    }),
  }),
  z.object({
    type: z.literal('CURSOR_3D_MOVE'),
    payload: SpatialCursorPayloadSchema,
  }),
  z.object({
    type: z.literal('CURSOR_3D_LEAVE'),
    payload: z.object({
      userId: z.string().min(1),
      groupId: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('PARAM_LOCK_ACQUIRE'),
    payload: ParameterLockPayloadSchema,
  }),
  z.object({
    type: z.literal('PARAM_LOCK_RELEASE'),
    payload: z.object({
      groupId: z.string(),
      domain: z.string().optional(),
      paramKey: z.string().min(1),
      userId: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('PARAM_LOCKS_SYNC'),
    payload: z.object({
      roomId: z.string().optional(),
      locks: z.array(ParameterLockPayloadSchema),
    }),
  }),
  z.object({
    type: z.literal('PARAM_LOCK_RESET_ALL'),
    payload: z.object({
      roomId: z.string().optional(),
      groupId: z.string().optional(),
      clearedCount: z.number().finite().optional(),
    }),
  }),
  z.object({
    type: z.literal('PARAM_VALUE_SYNC'),
    payload: z.object({
      groupId: z.string(),
      domain: z.string().optional(),
      paramKey: z.string().min(1),
      value: z.number().finite(),
      updatedBy: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('record:created'),
    payload: z.object({
      record: ServerExperimentRecordSchema,
      students: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  }),
  z.object({
    type: z.literal('record:deleted'),
    payload: z.object({
      id: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal('task:updated'),
    payload: z.object({
      tasks: z.array(z.record(z.string(), z.unknown())),
    }),
  }),
  z.object({
    type: z.literal('note:created'),
    payload: z.object({
      note: z
        .object({
          id: z.string().min(1),
          text: z.string(),
        })
        .passthrough(),
    }),
  }),
  z.object({
    type: z.literal('notification:pushed'),
    payload: z.object({
      notification: ServerNotificationSchema,
    }),
  }),
  z.object({
    type: z.literal('quiz:submitted'),
    payload: z.object({
      students: z.array(z.record(z.string(), z.unknown())).optional(),
      notification: ServerNotificationSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('teacher:broadcasted'),
    payload: z.object({
      notification: ServerNotificationSchema.optional(),
      note: z.record(z.string(), z.unknown()).optional(),
      students: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  }),
  z.object({
    type: z.literal('mystery:broadcasted'),
    payload: z.object({
      challenge: z.record(z.string(), z.unknown()).optional(),
      notification: ServerNotificationSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('mystery:submitted'),
    payload: z.object({
      studentName: z.string().optional(),
      result: z.record(z.string(), z.unknown()).optional(),
      students: z.array(z.record(z.string(), z.unknown())).optional(),
      notification: ServerNotificationSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('submission:created'),
    payload: z.object({
      submission: z.record(z.string(), z.unknown()),
      notification: ServerNotificationSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal('submission:graded'),
    payload: z.object({
      submission: z.record(z.string(), z.unknown()),
    }),
  }),
  z.object({
    type: z.literal('session:autosaved'),
    payload: z.object({
      sessionKey: z.string().min(1),
      version: z.number().finite(),
    }),
  }),
]);

export type ClientIdentifyPayload = z.infer<typeof ClientIdentifyPayloadSchema>;
export type ClientToServerMessage = z.infer<typeof ClientToServerMessageSchema>;
export type ServerToClientMessage = z.infer<typeof ServerToClientMessageSchema>;
export type WsValidationIssue = z.infer<typeof WsValidationIssueSchema>;
export type WsErrorPayload = z.infer<typeof WsErrorPayloadSchema>;
export type SpatialCursorContract = z.infer<typeof SpatialCursorPayloadSchema>;
export type ParameterLockContract = z.infer<typeof ParameterLockPayloadSchema>;
export type CustomAIMissionContract = z.infer<typeof CustomAIMissionPayloadSchema>;
export type LabRoomContract = z.infer<typeof LabRoomSchema>;
export type LabRoomClientContract = z.infer<typeof LabRoomClientSchema>;
export type StudentLiveTelemetryContract = z.infer<typeof StudentLiveTelemetrySchema>;
export type TeacherLaserRayContract = z.infer<typeof TeacherLaserRayPayloadSchema>;
export type TeacherCameraSyncContract = z.infer<typeof TeacherCameraSyncPayloadSchema>;
export type WsMessageOf<T extends ClientToServerMessage['type']> = Extract<
  ClientToServerMessage,
  { type: T }
>;
export type WsPayloadOf<T extends ClientToServerMessage['type']> = WsMessageOf<T>['payload'];
