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

export interface SimulationSnapshotView {
  id: number;
  roomPin: string;
  params: Record<string, unknown>;
  paramsJson: string;
  updatedAt: number;
}

export interface LabRepository {
  isAvailable(): boolean;

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

  checkpointWalTruncate(): void;
  close(): void;
}
