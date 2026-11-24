export const DEFAULT_SCHOOL_ID = 'default-school';

export interface DbSchoolRecord {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface DbRoomRecord {
  pin: string;
  school_id: string;
  host_id: string;
  module_domain: string;
  status: string;
  created_at: number;
  expires_at: number;
}

export interface DbParticipantRecord {
  id: string;
  room_pin: string;
  display_name: string;
  role: 'teacher' | 'student';
  connected: number;
  last_seen: number;
}

export interface DbSimulationSnapshotRecord {
  id: number;
  room_pin: string;
  params_json: string;
  updated_at: number;
}

export interface DbGradebookEntryRecord {
  id: string;
  school_id: string;
  room_pin: string;
  student_id: string;
  student_name: string;
  module_id: string;
  score: number;
  rubric_json: string;
  submitted_at: number;
}

export interface DbSubmissionRecord {
  id: string;
  school_id: string;
  room_id: string;
  student_id: string | null;
  student_name: string;
  domain: string;
  module_id: string;
  score: number | null;
  payload_json: string;
  submitted_at: string;
}

export interface DbAutosaveRecord {
  storage_key: string;
  school_id: string;
  student_id: string | null;
  version: number;
  owner_token_hash: string | null;
  session_json: string;
  updated_at: number;
}

export interface DbIdempotencyKeyRecord {
  key: string;
  school_id: string;
  endpoint: string;
  response_json: string;
  created_at: string;
}

export interface DbAuthCredentialRecord {
  id: string;
  school_id: string;
  role: 'teacher' | 'admin' | 'student';
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface DbAuditLogRecord {
  id: string;
  school_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: string;
  request_id: string | null;
  created_at: string;
}

export type AuditLogRecord = DbAuditLogRecord;

export interface AuditLogInput {
  id?: string;
  schoolId?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  metadataJson?: string;
  requestId?: string | null;
  ipAddress?: string;
  createdAt?: string;
}

export interface SimulationSnapshotView {
  id: number;
  roomPin: string;
  params: Record<string, unknown>;
  paramsJson: string;
  updatedAt: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface SubmissionQueryOptions {
  schoolId?: string;
  roomId?: string;
  studentId?: string;
  domain?: string;
  moduleId?: string;
  status?: 'all' | 'graded' | 'ungraded';
  search?: string;
  sortBy?: 'submittedAt' | 'score' | 'studentName';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GradebookQueryOptions {
  schoolId?: string;
  roomPin?: string;
  moduleId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogQueryOptions {
  schoolId: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface ConsolidatedLabCollections {
  records: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
}

export interface StoredRoomStateRow {
  roomId: string;
  schoolId: string;
  pinHash?: string | null;
  stateJson: string;
  lastActivityAt: number;
  updatedAt: number;
}

export interface StoredParameterLockRow {
  key: string;
  schoolId: string;
  roomId?: string | null;
  payloadJson: string;
  expiresAt: number;
}

export interface LabRepository {
  isAvailable(): boolean;
  healthCheck(): boolean;

  ensureSchool(input: {
    id: string;
    name?: string;
    slug?: string;
    createdAt?: string;
  }): DbSchoolRecord;
  getSchoolById(id: string): DbSchoolRecord | null;
  listSchools(): DbSchoolRecord[];

  upsertRoom(input: {
    pin: string;
    schoolId?: string;
    school_id?: string;
    hostId?: string;
    host_id?: string;
    moduleDomain?: string;
    module_domain?: string;
    status?: string;
    createdAt?: number;
    created_at?: number;
    expiresAt?: number;
    expires_at?: number;
  }): DbRoomRecord;
  ensureRoomPinExists(
    pin: string,
    fallbackDomain?: string,
    fallbackHost?: string,
    schoolId?: string
  ): DbRoomRecord;
  getRoomByPin(pin: string, schoolId?: string): DbRoomRecord | null;
  listActiveRooms(now?: number, schoolId?: string): DbRoomRecord[];
  deleteRoomByPin(pin: string): void;
  pruneExpiredRooms(now?: number): number;

  upsertRoomState(input: {
    roomId: string;
    schoolId?: string;
    pinHash?: string | null;
    stateJson: string;
    lastActivityAt: number;
    updatedAt?: number;
  }): void;
  loadAllRoomStates(schoolId?: string): StoredRoomStateRow[];
  deleteRoomState(roomId: string): void;

  upsertParticipant(input: {
    id: string;
    roomPin?: string;
    room_pin?: string;
    displayName?: string;
    display_name?: string;
    role: 'teacher' | 'student';
    connected?: boolean | number;
    lastSeen?: number;
    last_seen?: number;
  }): DbParticipantRecord;
  getParticipant(roomPin: string, participantId: string): DbParticipantRecord | null;
  listRoomParticipants(roomPin: string): DbParticipantRecord[];
  setParticipantConnected(
    roomPin: string,
    participantId: string,
    connected: boolean,
    now?: number
  ): void;
  removeParticipant(roomPin: string, participantId: string): void;

  saveSimulationSnapshot(
    roomPin: string,
    params: Record<string, unknown>,
    updatedAt?: number
  ): DbSimulationSnapshotRecord;
  getLatestSimulationSnapshot(roomPin: string): SimulationSnapshotView | null;
  rejoinParticipantSession(
    roomPin: string,
    participantId: string,
    now?: number
  ): {
    room: DbRoomRecord;
    participant: DbParticipantRecord;
    latestSnapshot: SimulationSnapshotView | null;
  } | null;

  upsertGradebookEntry(input: {
    id: string;
    schoolId?: string;
    school_id?: string;
    roomPin?: string;
    room_pin?: string;
    studentId?: string;
    student_id?: string;
    studentName?: string;
    student_name?: string;
    moduleId?: string;
    module_id?: string;
    score: number;
    rubricJson?: string;
    rubric_json?: string;
    submittedAt?: number;
    submitted_at?: number;
  }): DbGradebookEntryRecord;
  getGradebookEntryById(id: string): DbGradebookEntryRecord | null;
  listGradebookEntries(roomPin?: string, schoolId?: string): DbGradebookEntryRecord[];
  queryGradebookPaginated(
    options: GradebookQueryOptions
  ): PaginatedResult<DbGradebookEntryRecord>;

  upsertSubmission(input: {
    id: string;
    schoolId?: string;
    roomId: string;
    studentId?: string | null;
    studentName: string;
    domain: string;
    moduleId: string;
    score?: number | null;
    payloadJson: string;
    submittedAt: string;
  }): DbSubmissionRecord;
  getSubmissionById(id: string, schoolId?: string): DbSubmissionRecord | null;
  listSubmissions(schoolId?: string): DbSubmissionRecord[];
  querySubmissionsPaginated(
    options: SubmissionQueryOptions
  ): PaginatedResult<DbSubmissionRecord>;

  upsertAutosave(input: {
    storageKey: string;
    schoolId?: string;
    studentId?: string | null;
    version: number;
    ownerTokenHash?: string | null;
    sessionJson: string;
    updatedAt?: number;
  }): DbAutosaveRecord;
  getAutosaveByKey(storageKey: string, schoolId?: string): DbAutosaveRecord | null;
  listAutosaves(schoolId?: string): DbAutosaveRecord[];
  deleteAutosaveByKey(storageKey: string): void;

  getIdempotencyKey(
    key: string,
    schoolId: string,
    endpoint: string
  ): DbIdempotencyKeyRecord | null;
  saveIdempotencyKey(input: {
    key: string;
    schoolId: string;
    endpoint: string;
    responseJson: string;
    createdAt?: string;
  }): DbIdempotencyKeyRecord;

  // Consolidated lab state tables (replacing legacy JSON / LabSqliteStore)
  syncLabCollections(
    bundle: ConsolidatedLabCollections & {
      schoolId?: string;
      notificationTtlMs?: number;
    }
  ): void;
  loadLabCollections(schoolId?: string, now?: number): ConsolidatedLabCollections;
  pruneExpiredNotifications(now?: number): number;

  upsertParameterLock(input: {
    key: string;
    schoolId?: string;
    roomId?: string | null;
    payloadJson: string;
    expiresAt: number;
  }): void;
  deleteParameterLock(key: string): void;
  loadActiveParameterLocks(now?: number): StoredParameterLockRow[];
  pruneExpiredParameterLocks(now?: number): number;

  // Offline-ready Auth Credentials (scrypt hashed)
  getAuthCredential(
    schoolId: string,
    role: 'teacher' | 'admin' | 'student',
    username?: string
  ): DbAuthCredentialRecord | null;
  hasAnyTeacherCredential(schoolId?: string): boolean;
  upsertAuthCredential(input: {
    id: string;
    schoolId?: string;
    role: 'teacher' | 'admin' | 'student';
    username: string;
    passwordHash: string;
  }): DbAuthCredentialRecord;

  // Immutable Audit Logs
  appendAuditLog(input: {
    id: string;
    schoolId?: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    metadataJson: string;
    requestId?: string | null;
    createdAt?: string;
  }): DbAuditLogRecord;
  queryAuditLogs(options: AuditLogQueryOptions): PaginatedResult<DbAuditLogRecord>;

  checkpointWalTruncate(): void;
  close(): void;
}

/**
 * Promise-based unified repository contract for hybrid deployment:
 * - SqliteAsyncLabRepository (default 3T offline-first WAL mode)
 * - PostgresLabRepository (cloud mode when DATABASE_URL is configured)
 */
export interface AsyncLabRepository {
  readonly driver: 'sqlite' | 'postgres';
  init(): Promise<void>;
  healthCheck(): Promise<boolean>;

  ensureSchool(input: {
    id: string;
    name?: string;
    slug?: string;
    createdAt?: string;
  }): Promise<DbSchoolRecord>;
  getSchoolById(id: string): Promise<DbSchoolRecord | null>;
  listSchools(): Promise<DbSchoolRecord[]>;

  upsertSubmission(input: {
    id: string;
    schoolId?: string;
    roomId: string;
    studentId?: string | null;
    studentName: string;
    domain: string;
    moduleId: string;
    score?: number | null;
    payloadJson: string;
    submittedAt: string;
  }): Promise<DbSubmissionRecord>;
  getSubmissionById(id: string, schoolId?: string): Promise<DbSubmissionRecord | null>;
  querySubmissionsPaginated(
    options: SubmissionQueryOptions
  ): Promise<PaginatedResult<DbSubmissionRecord>>;

  upsertGradebookEntry(input: {
    id: string;
    schoolId?: string;
    roomPin: string;
    studentId: string;
    studentName: string;
    moduleId: string;
    score: number;
    rubricJson: string;
    submittedAt?: number;
  }): Promise<DbGradebookEntryRecord>;
  queryGradebookPaginated(
    options: GradebookQueryOptions
  ): Promise<PaginatedResult<DbGradebookEntryRecord>>;

  getIdempotencyKey(
    key: string,
    schoolId: string,
    endpoint: string
  ): Promise<DbIdempotencyKeyRecord | null>;
  saveIdempotencyKey(input: {
    key: string;
    schoolId: string;
    endpoint: string;
    responseJson: string;
    createdAt?: string;
  }): Promise<DbIdempotencyKeyRecord>;

  getAuthCredential(
    schoolId: string,
    role: 'teacher' | 'admin' | 'student',
    username?: string
  ): Promise<DbAuthCredentialRecord | null>;
  hasAnyTeacherCredential(schoolId?: string): Promise<boolean>;
  upsertAuthCredential(input: {
    id: string;
    schoolId?: string;
    role: 'teacher' | 'admin' | 'student';
    username: string;
    passwordHash: string;
  }): Promise<DbAuthCredentialRecord>;

  appendAuditLog(input: {
    id: string;
    schoolId?: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    metadataJson: string;
    requestId?: string | null;
    createdAt?: string;
  }): Promise<DbAuditLogRecord>;
  queryAuditLogs(options: AuditLogQueryOptions): Promise<PaginatedResult<DbAuditLogRecord>>;

  close(): Promise<void>;
}
