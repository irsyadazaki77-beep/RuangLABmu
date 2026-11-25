import crypto from 'crypto';
import { loadPersistedState } from '../../src/utils/statePersistence';
import {
  LabRoom,
  ParameterLockPayload,
} from '../../src/utils/collabProtocol';
import {
  DEFAULT_NOTIFICATION_TTL_MS,
  hashRoomPin,
  resolveDefaultDbPath,
  verifyRoomPinTimingSafe,
} from './sqliteAdapter';
import {
  RuangLabDatabase,
  type DbGradebookEntryRecord,
  type DbParticipantRecord,
  type DbRoomRecord,
  type DbSimulationSnapshotRecord,
  type LabRepository,
} from '../db/database';
import {
  DEFAULT_SCHOOL_ID,
  type AsyncLabRepository,
  type AuditLogInput,
  type AuditLogRecord,
} from '../db/LabRepository';
import { createHybridAsyncRepository } from '../db/repositoryFactory';
import { DatabaseBackupService } from '../services/backupService';
import { logger } from '../utils/logger';
import { createInitialSeedData } from './defaultSeedData';

export {
  DEFAULT_NOTIFICATION_TTL_MS,
  RuangLabDatabase,
  hashRoomPin,
  resolveDefaultDbPath,
  verifyRoomPinTimingSafe,
};

export const SERVER_STATE_LIMITS = {
  MAX_ACTIVE_ROOMS: 200,
  ROOM_IDLE_TTL_MS: 12 * 60 * 60 * 1000,
  MAX_SESSION_SNAPSHOTS: 500,
  SNAPSHOT_TTL_MS: 24 * 60 * 60 * 1000,
  MAX_PARAMETER_LOCKS: 500,
  MAX_EXPERIMENT_RECORDS: 500,
  MAX_GROUP_TASKS: 300,
  MAX_COLLAB_NOTES: 300,
  MAX_STUDENT_ROSTER: 300,
  MAX_NOTIFICATIONS: 100,
  NOTIFICATION_TTL_MS: DEFAULT_NOTIFICATION_TTL_MS,
} as const;

export function generateSecureRoomPin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export interface GroupTask {
  id: string;
  groupId: string;
  title: string;
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  completed: boolean;
  completedBy?: string;
}

export interface CollabNote {
  id: string;
  groupId: string;
  author: string;
  role: 'Siswa' | 'Pengajar';
  text: string;
  timestamp: string;
}

export interface StudentProgress {
  id: string;
  name: string;
  groupId: string;
  activeDomain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  currentActivity: string;
  trialsRecorded: number;
  tasksCompleted: number;
  totalTasks: number;
  completionPct: number;
  lastActive: string;
  status: 'Nominal' | 'Butuh Bantuan' | 'Selesai';
}

export interface ServerExperimentRecord {
  id: string;
  timestamp: string;
  studentName: string;
  groupId: string;
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  moduleId?: string;
  experimentTitle: string;
  parametersSummary: string;
  keyMetrics: Record<string, number | string>;
  numericX?: number;
  numericY1?: number;
  numericY2?: number;
  notes: string;
}

export interface ServerNotification {
  id: string;
  timestamp: string;
  severity: 'nominal' | 'elevated' | 'critical';
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi' | 'Kolaborasi' | 'Pengajar';
  title: string;
  message: string;
  formulaHint?: string;
  expiresAt?: number;
}

class SqliteBackedMap<K extends string, V> extends Map<K, V> {
  private readonly onSet?: (key: K, value: V) => void;
  private readonly onDelete?: (key: K) => void;
  private suppressHooks = false;

  constructor(hooks?: {
    onSet?: (key: K, value: V) => void;
    onDelete?: (key: K) => void;
  }) {
    super();
    this.onSet = hooks?.onSet;
    this.onDelete = hooks?.onDelete;
  }

  public setSilent(key: K, value: V): this {
    this.suppressHooks = true;
    try {
      super.set(key, value);
    } finally {
      this.suppressHooks = false;
    }
    return this;
  }

  public override set(key: K, value: V): this {
    super.set(key, value);
    if (!this.suppressHooks && this.onSet) {
      this.onSet(key, value);
    }
    return this;
  }

  public override delete(key: K): boolean {
    const existed = super.delete(key);
    if (existed && !this.suppressHooks && this.onDelete) {
      this.onDelete(key);
    }
    return existed;
  }
}

export interface RoomActivityState {
  experimentRecords: ServerExperimentRecord[];
  groupTasks: GroupTask[];
  collabNotes: CollabNote[];
  studentRoster: StudentProgress[];
  notifications: ServerNotification[];
}

export interface LabServerState {
  readonly dbPath: string;
  readonly database: RuangLabDatabase;
  readonly repository: LabRepository;
  readonly asyncRepository: AsyncLabRepository;
  readonly backupService: DatabaseBackupService;
  experimentRecords: ServerExperimentRecord[];
  groupTasks: GroupTask[];
  collabNotes: CollabNote[];
  studentRoster: StudentProgress[];
  notifications: ServerNotification[];
  parameterLocks: Map<string, ParameterLockPayload>;
  activeLabRooms: Map<string, LabRoom>;
  sessionSnapshots: Map<
    string,
    {
      version: number;
      session: unknown;
      updatedAt: number;
      schoolId?: string;
      ownerStudentId?: string;
      ownerTokenHash?: string;
    }
  >;
  recordAuditLog: (input: AuditLogInput) => AuditLogRecord;
  touchLabRoom: (roomId: string, now?: number) => void;
  rejoinParticipantSession: (
    roomPin: string,
    participantId: string,
    roomIdHint?: string,
    now?: number
  ) => {
    room: LabRoom | null;
    dbRoom: DbRoomRecord;
    participant: DbParticipantRecord;
    latestSnapshot: {
      id: number;
      roomPin: string;
      params: Record<string, unknown>;
      paramsJson: string;
      updatedAt: number;
    } | null;
  } | null;
  saveRoomSimulationSnapshot: (
    roomPin: string,
    params: Record<string, unknown>,
    now?: number
  ) => DbSimulationSnapshotRecord;
  getLatestRoomSimulationSnapshot: (roomPin: string) => {
    id: number;
    roomPin: string;
    params: Record<string, unknown>;
    paramsJson: string;
    updatedAt: number;
  } | null;
  saveGradebookEntry: (entry: {
    id: string;
    schoolId?: string;
    roomPin: string;
    studentId: string;
    studentName: string;
    moduleId: string;
    score: number;
    rubricJson: string;
    submittedAt?: number;
  }) => DbGradebookEntryRecord;
  getGradebookEntries: (roomPin?: string, schoolId?: string) => DbGradebookEntryRecord[];
  pruneExpiredDatabaseRooms: (now?: number) => number;
  pruneExpiredLocks: (now?: number) => void;
  pruneExpiredNotifications: (now?: number) => void;
  pruneIdleRooms: (now?: number) => void;
  pruneSessionSnapshots: (now?: number) => void;
  enforceCollectionBounds: () => void;
  getScopedActivityState: (roomId?: string, schoolId?: string) => RoomActivityState;
  persistServerState: () => void;
  hydrateServerState: () => Promise<void>;
  dispose: () => void;
}

export function createLabServerState(options?: {
  dbPath?: string;
  backupDir?: string;
  databaseUrl?: string;
  maxActiveRooms?: number;
  roomIdleTtlMs?: number;
  maxSessionSnapshots?: number;
  snapshotTtlMs?: number;
  maxRecords?: number;
  maxTasks?: number;
  maxNotes?: number;
  maxStudents?: number;
  maxNotifications?: number;
  notificationTtlMs?: number;
  maxParameterLocks?: number;
}): LabServerState {
  const limits = {
    MAX_ACTIVE_ROOMS: options?.maxActiveRooms ?? SERVER_STATE_LIMITS.MAX_ACTIVE_ROOMS,
    ROOM_IDLE_TTL_MS: options?.roomIdleTtlMs ?? SERVER_STATE_LIMITS.ROOM_IDLE_TTL_MS,
    MAX_SESSION_SNAPSHOTS:
      options?.maxSessionSnapshots ?? SERVER_STATE_LIMITS.MAX_SESSION_SNAPSHOTS,
    SNAPSHOT_TTL_MS: options?.snapshotTtlMs ?? SERVER_STATE_LIMITS.SNAPSHOT_TTL_MS,
    MAX_PARAMETER_LOCKS:
      options?.maxParameterLocks ?? SERVER_STATE_LIMITS.MAX_PARAMETER_LOCKS,
    MAX_EXPERIMENT_RECORDS:
      options?.maxRecords ?? SERVER_STATE_LIMITS.MAX_EXPERIMENT_RECORDS,
    MAX_GROUP_TASKS: options?.maxTasks ?? SERVER_STATE_LIMITS.MAX_GROUP_TASKS,
    MAX_COLLAB_NOTES: options?.maxNotes ?? SERVER_STATE_LIMITS.MAX_COLLAB_NOTES,
    MAX_STUDENT_ROSTER: options?.maxStudents ?? SERVER_STATE_LIMITS.MAX_STUDENT_ROSTER,
    MAX_NOTIFICATIONS:
      options?.maxNotifications ?? SERVER_STATE_LIMITS.MAX_NOTIFICATIONS,
    NOTIFICATION_TTL_MS:
      options?.notificationTtlMs ?? SERVER_STATE_LIMITS.NOTIFICATION_TTL_MS,
  };

  const resolvedDbPath = options?.dbPath || resolveDefaultDbPath();
  const database = new RuangLabDatabase(resolvedDbPath);
  const repository: LabRepository = database;
  const asyncRepository: AsyncLabRepository = createHybridAsyncRepository(
    database,
    options?.databaseUrl !== undefined ? options.databaseUrl : process.env.DATABASE_URL
  );
  const backupService = new DatabaseBackupService({
    database,
    backupDir: options?.backupDir,
  });

  const syncRoomToRelationalTables = (room: LabRoom) => {
    const cleanPin = String(room.pin || room.roomId).trim();
    if (!cleanPin) return;
    const now = Date.now();
    const createdAt = room.createdAt || now;
    const lastActive = room.lastActivityAt ?? createdAt;
    const expiresAt = lastActive + limits.ROOM_IDLE_TTL_MS;
    repository.upsertRoom({
      pin: cleanPin,
      schoolId: room.schoolId || DEFAULT_SCHOOL_ID,
      hostId: room.teacherName || room.roomId || 'host',
      moduleDomain: `${room.domain}:${room.moduleId}`,
      status: room.isFrozenByTeacher ? 'frozen' : 'active',
      createdAt,
      expiresAt,
    });

    const clients = Object.values(room.clients || {});
    for (const client of clients) {
      if (!client || !client.userId) continue;
      database.upsertParticipant({
        id: client.userId,
        roomPin: cleanPin,
        displayName: client.name || 'Praktikan',
        role: client.role === 'teacher' ? 'teacher' : 'student',
        connected: true,
        lastSeen: now,
      });
    }
  };

  const {
    experimentRecords,
    groupTasks,
    collabNotes,
    studentRoster,
    notifications,
  } = createInitialSeedData();

  const parameterLocks = new SqliteBackedMap<string, ParameterLockPayload>({
    onSet: (key, lock) =>
      repository.upsertParameterLock({
        key,
        schoolId: DEFAULT_SCHOOL_ID,
        roomId: (lock as ParameterLockPayload & { roomId?: string }).roomId || null,
        payloadJson: JSON.stringify(lock),
        expiresAt: Number.isFinite(lock.expiresAt) ? lock.expiresAt : Date.now() + 60_000,
      }),
    onDelete: (key) => repository.deleteParameterLock(key),
  });

  const activeLabRooms = new SqliteBackedMap<string, LabRoom>({
    onSet: (_key, room) => {
      const now = Date.now();
      const roomWithHash = room as LabRoom & { pinHash?: string };
      repository.upsertRoomState({
        roomId: room.roomId,
        schoolId: room.schoolId || DEFAULT_SCHOOL_ID,
        pinHash: roomWithHash.pinHash || (room.pin ? hashRoomPin(room.pin) : null),
        stateJson: JSON.stringify(room),
        lastActivityAt: room.lastActivityAt ?? room.createdAt ?? now,
        updatedAt: now,
      });
      syncRoomToRelationalTables(room);
    },
    onDelete: (key) => {
      repository.deleteRoomState(key);
    },
  });

  const sessionSnapshots = new SqliteBackedMap<
    string,
    {
      version: number;
      session: unknown;
      updatedAt: number;
      schoolId?: string;
      ownerStudentId?: string;
      ownerTokenHash?: string;
    }
  >({
    onSet: (key, snap) => {
      repository.upsertAutosave({
        storageKey: key,
        schoolId: snap.schoolId || DEFAULT_SCHOOL_ID,
        studentId: snap.ownerStudentId || null,
        version: snap.version,
        ownerTokenHash: snap.ownerTokenHash || null,
        sessionJson: JSON.stringify(snap.session ?? {}),
        updatedAt: snap.updatedAt,
      });
      if (snap.session && typeof snap.session === 'object') {
        repository.saveSimulationSnapshot(
          key,
          snap.session as Record<string, unknown>,
          snap.updatedAt
        );
      }
    },
    onDelete: (key) => {
      repository.deleteAutosaveByKey(key);
    },
  });

  // Hydrate rooms, autosave snapshots, and active parameter locks from consolidated SQLite
  for (const row of repository.loadAllRoomStates()) {
    try {
      const parsedRoom = JSON.parse(row.stateJson) as LabRoom & { pinHash?: string };
      if (parsedRoom && parsedRoom.roomId) {
        if (row.pinHash && !parsedRoom.pinHash) {
          parsedRoom.pinHash = row.pinHash;
        }
        activeLabRooms.setSilent(parsedRoom.roomId, parsedRoom);
        syncRoomToRelationalTables(parsedRoom);
      }
    } catch {
      // Ignore malformed room state row
    }
  }
  for (const row of repository.listAutosaves()) {
    let parsedSession: unknown = {};
    try {
      parsedSession = JSON.parse(row.session_json);
    } catch {
      parsedSession = {};
    }
    sessionSnapshots.setSilent(row.storage_key, {
      version: row.version,
      session: parsedSession,
      updatedAt: row.updated_at,
      schoolId: row.school_id,
      ownerStudentId: row.student_id || undefined,
      ownerTokenHash: row.owner_token_hash || undefined,
    });
  }
  for (const lockEntry of repository.loadActiveParameterLocks()) {
    try {
      const parsedLock = JSON.parse(lockEntry.payloadJson) as ParameterLockPayload;
      if (parsedLock && typeof parsedLock === 'object') {
        parameterLocks.setSilent(lockEntry.key, parsedLock);
      }
    } catch {
      // Ignore malformed parameter lock row
    }
  }

  const demoRoomPin =
    process.env.NODE_ENV !== 'production' && process.env.DEMO_ROOM_PIN?.trim()
      ? process.env.DEMO_ROOM_PIN.trim()
      : generateSecureRoomPin();

  const initialNow = Date.now();
  if (!activeLabRooms.has('LAB-ALPHA')) {
    activeLabRooms.set('LAB-ALPHA', {
      roomId: 'LAB-ALPHA',
      pin: demoRoomPin,
      schoolId: DEFAULT_SCHOOL_ID,
      domain: 'physics',
      moduleId: 'newton-incline',
      teacherSocketId: undefined,
      teacherName: 'Dr. Hendra Kusuma',
      isFrozenByTeacher: false,
      createdAt: initialNow,
      lastActivityAt: initialNow,
      clients: {},
    });
  } else if (process.env.NODE_ENV !== 'production' && process.env.DEMO_ROOM_PIN?.trim()) {
    const existingAlpha = activeLabRooms.get('LAB-ALPHA')!;
    existingAlpha.pin = process.env.DEMO_ROOM_PIN.trim();
    activeLabRooms.set('LAB-ALPHA', existingAlpha);
  } else {
    const existingAlpha = activeLabRooms.get('LAB-ALPHA')!;
    if (!existingAlpha.pin || existingAlpha.pin === '1234') {
      existingAlpha.pin = generateSecureRoomPin();
      activeLabRooms.set('LAB-ALPHA', existingAlpha);
    }
  }

  const recordAuditLog = (input: AuditLogInput): AuditLogRecord => {
    const normalizedMetadata =
      input.metadataJson ||
      JSON.stringify({
        ...(input.metadata || {}),
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      });
    const payload = {
      id: input.id && input.id.trim() ? input.id.trim() : `audit-${crypto.randomUUID()}`,
      schoolId: input.schoolId || DEFAULT_SCHOOL_ID,
      actorId: input.actorId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadataJson: normalizedMetadata,
      requestId: input.requestId ?? null,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    const saved = repository.appendAuditLog(payload);
    if (asyncRepository.driver === 'postgres') {
      void asyncRepository.appendAuditLog(payload).catch((err) => {
        logger.warn('Failed to mirror audit log to PostgreSQL', {
          action: input.action,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return saved;
  };

  const findRoomByPinOrId = (pinOrRoomId: string): LabRoom | null => {
    const needle = String(pinOrRoomId || '').trim();
    if (!needle) return null;
    const direct = activeLabRooms.get(needle.toUpperCase());
    if (direct) return direct;
    for (const room of activeLabRooms.values()) {
      if (room.pin === needle || room.roomId === needle.toUpperCase()) {
        return room;
      }
    }
    return null;
  };

  const rejoinParticipantSession = (
    roomPin: string,
    participantId: string,
    roomIdHint?: string,
    now = Date.now()
  ) => {
    const cleanPin = String(roomPin || '').trim();
    const cleanParticipantId = String(participantId || '').trim();
    if (!cleanPin || !cleanParticipantId) return null;

    const matchedRoom =
      (roomIdHint ? findRoomByPinOrId(roomIdHint) : null) || findRoomByPinOrId(cleanPin);

    if (matchedRoom) {
      syncRoomToRelationalTables(matchedRoom);
    }

    const effectivePin = matchedRoom?.pin || cleanPin;
    const rejoined = database.rejoinParticipantSession(effectivePin, cleanParticipantId, now);
    if (!rejoined) return null;

    return {
      room: matchedRoom,
      dbRoom: rejoined.room,
      participant: rejoined.participant,
      latestSnapshot: rejoined.latestSnapshot,
    };
  };

  const saveRoomSimulationSnapshot = (
    roomPin: string,
    params: Record<string, unknown>,
    now = Date.now()
  ) => {
    const matchedRoom = findRoomByPinOrId(roomPin);
    const effectivePin = matchedRoom?.pin || String(roomPin).trim();
    return database.saveSimulationSnapshot(effectivePin, params, now);
  };

  const getLatestRoomSimulationSnapshot = (roomPin: string) => {
    const matchedRoom = findRoomByPinOrId(roomPin);
    const effectivePin = matchedRoom?.pin || String(roomPin).trim();
    return database.getLatestSimulationSnapshot(effectivePin);
  };

  const saveGradebookEntry = (entry: {
    id: string;
    schoolId?: string;
    roomPin: string;
    studentId: string;
    studentName: string;
    moduleId: string;
    score: number;
    rubricJson: string;
    submittedAt?: number;
  }) => {
    const matchedRoom = findRoomByPinOrId(entry.roomPin);
    const effectivePin = matchedRoom?.pin || String(entry.roomPin || 'MANDIRI').trim();
    const effectiveSchoolId =
      entry.schoolId || matchedRoom?.schoolId || DEFAULT_SCHOOL_ID;
    const saved = repository.upsertGradebookEntry({
      ...entry,
      schoolId: effectiveSchoolId,
      roomPin: effectivePin,
    });
    if (asyncRepository.driver === 'postgres') {
      void asyncRepository
        .upsertGradebookEntry({
          ...entry,
          schoolId: effectiveSchoolId,
          roomPin: effectivePin,
        })
        .catch((err) => {
          logger.warn('Failed to mirror gradebook entry to PostgreSQL', {
            id: entry.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
    return saved;
  };

  const getGradebookEntries = (roomPin?: string, schoolId?: string) => {
    if (!roomPin) {
      return repository.listGradebookEntries(undefined, schoolId);
    }
    const matchedRoom = findRoomByPinOrId(roomPin);
    const effectivePin = matchedRoom?.pin || roomPin.trim();
    return repository.listGradebookEntries(effectivePin, schoolId);
  };

  const pruneExpiredDatabaseRooms = (now = Date.now()) => {
    return database.pruneExpiredRooms(now);
  };

  const touchLabRoom = (roomId: string, now = Date.now()) => {
    const existing = activeLabRooms.get(roomId);
    if (!existing) return;
    existing.lastActivityAt = now;
    activeLabRooms.delete(roomId);
    activeLabRooms.set(roomId, existing);
  };

  const pruneExpiredLocks = (now = Date.now()) => {
    repository.pruneExpiredParameterLocks(now);
    for (const [key, lock] of parameterLocks.entries()) {
      if (now > lock.expiresAt) {
        parameterLocks.delete(key);
      }
    }
    while (parameterLocks.size > limits.MAX_PARAMETER_LOCKS) {
      const oldestKey = parameterLocks.keys().next().value;
      if (!oldestKey) break;
      parameterLocks.delete(oldestKey);
    }
  };

  const pruneExpiredNotifications = (now = Date.now()) => {
    repository.pruneExpiredNotifications(now);
    for (let i = notifications.length - 1; i >= 0; i -= 1) {
      const exp = notifications[i].expiresAt;
      if (typeof exp === 'number' && now > exp) {
        notifications.splice(i, 1);
      }
    }
  };

  const pruneIdleRooms = (now = Date.now()) => {
    database.pruneExpiredRooms(now);
    for (const [roomId, room] of activeLabRooms.entries()) {
      if (roomId === 'LAB-ALPHA') continue;
      const clientCount = Object.keys(room.clients || {}).length;
      const lastActive = room.lastActivityAt ?? room.createdAt;
      if (clientCount === 0 && now - lastActive > limits.ROOM_IDLE_TTL_MS) {
        if (room.pin) {
          database.deleteRoomByPin(room.pin);
        }
        activeLabRooms.delete(roomId);
      }
    }

    if (activeLabRooms.size > limits.MAX_ACTIVE_ROOMS) {
      const sortedEntries = Array.from(activeLabRooms.entries()).sort((a, b) => {
        const aClients = Object.keys(a[1].clients || {}).length;
        const bClients = Object.keys(b[1].clients || {}).length;
        if ((aClients === 0) !== (bClients === 0)) {
          return aClients === 0 ? -1 : 1;
        }
        return (a[1].lastActivityAt ?? a[1].createdAt) - (b[1].lastActivityAt ?? b[1].createdAt);
      });
      for (const [roomId, room] of sortedEntries) {
        if (activeLabRooms.size <= limits.MAX_ACTIVE_ROOMS) break;
        if (roomId === 'LAB-ALPHA' && activeLabRooms.size <= limits.MAX_ACTIVE_ROOMS + 1) continue;
        if (room.pin) {
          database.deleteRoomByPin(room.pin);
        }
        activeLabRooms.delete(roomId);
      }
    }
  };

  const pruneSessionSnapshots = (now = Date.now()) => {
    const cutoff = now - limits.SNAPSHOT_TTL_MS;
    for (const [key, entry] of sessionSnapshots.entries()) {
      if (entry.updatedAt < cutoff) {
        sessionSnapshots.delete(key);
      }
    }
    if (sessionSnapshots.size > limits.MAX_SESSION_SNAPSHOTS) {
      const sorted = Array.from(sessionSnapshots.entries()).sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt
      );
      for (const [key] of sorted) {
        if (sessionSnapshots.size <= limits.MAX_SESSION_SNAPSHOTS) break;
        sessionSnapshots.delete(key);
      }
    }
  };

  const enforceCollectionBounds = () => {
    pruneExpiredNotifications();
    if (experimentRecords.length > limits.MAX_EXPERIMENT_RECORDS) {
      experimentRecords.length = limits.MAX_EXPERIMENT_RECORDS;
    }
    if (groupTasks.length > limits.MAX_GROUP_TASKS) {
      groupTasks.splice(0, groupTasks.length - limits.MAX_GROUP_TASKS);
    }
    if (collabNotes.length > limits.MAX_COLLAB_NOTES) {
      collabNotes.splice(0, collabNotes.length - limits.MAX_COLLAB_NOTES);
    }
    if (studentRoster.length > limits.MAX_STUDENT_ROSTER) {
      studentRoster.splice(0, studentRoster.length - limits.MAX_STUDENT_ROSTER);
    }
    if (notifications.length > limits.MAX_NOTIFICATIONS) {
      notifications.length = limits.MAX_NOTIFICATIONS;
    }
    pruneExpiredLocks();
    pruneIdleRooms();
    pruneSessionSnapshots();
  };

  const persistServerState = () => {
    enforceCollectionBounds();
    // Single source of truth: persist strictly to consolidated SQLite tables (no flat JSON dual-writes)
    repository.syncLabCollections({
      records: experimentRecords as unknown as Array<Record<string, unknown>>,
      tasks: groupTasks as unknown as Array<Record<string, unknown>>,
      notes: collabNotes as unknown as Array<Record<string, unknown>>,
      students: studentRoster as unknown as Array<Record<string, unknown>>,
      notifications: notifications as unknown as Array<Record<string, unknown>>,
      notificationTtlMs: limits.NOTIFICATION_TTL_MS,
    });
  };

  const hydrateServerState = async () => {
    await asyncRepository.init();

    const sqliteCollections = repository.loadLabCollections();
    const hasSqliteData =
      sqliteCollections.records.length > 0 ||
      sqliteCollections.tasks.length > 0 ||
      sqliteCollections.notes.length > 0 ||
      sqliteCollections.students.length > 0 ||
      sqliteCollections.notifications.length > 0;

    if (hasSqliteData) {
      if (sqliteCollections.records.length > 0) {
        experimentRecords.splice(
          0,
          experimentRecords.length,
          ...(sqliteCollections.records as unknown as ServerExperimentRecord[])
        );
      }
      if (sqliteCollections.tasks.length > 0) {
        groupTasks.splice(
          0,
          groupTasks.length,
          ...(sqliteCollections.tasks as unknown as GroupTask[])
        );
      }
      if (sqliteCollections.notes.length > 0) {
        collabNotes.splice(
          0,
          collabNotes.length,
          ...(sqliteCollections.notes as unknown as CollabNote[])
        );
      }
      if (sqliteCollections.students.length > 0) {
        studentRoster.splice(
          0,
          studentRoster.length,
          ...(sqliteCollections.students as unknown as StudentProgress[])
        );
      }
      if (sqliteCollections.notifications.length > 0) {
        notifications.splice(
          0,
          notifications.length,
          ...(sqliteCollections.notifications as unknown as ServerNotification[])
        );
      }
      enforceCollectionBounds();
      return;
    }

    // One-time legacy import from data/lab-state.json if present (read-only migration, never writes JSON back)
    const loadedState = await loadPersistedState({
      records: experimentRecords,
      tasks: groupTasks,
      notes: collabNotes,
      students: studentRoster,
      notifications,
    });
    if (loadedState) {
      if (Array.isArray(loadedState.records) && loadedState.records.length > 0) {
        experimentRecords.splice(
          0,
          experimentRecords.length,
          ...(loadedState.records as ServerExperimentRecord[])
        );
      }
      if (Array.isArray(loadedState.tasks) && loadedState.tasks.length > 0) {
        groupTasks.splice(
          0,
          groupTasks.length,
          ...(loadedState.tasks as GroupTask[])
        );
      }
      if (Array.isArray(loadedState.notes) && loadedState.notes.length > 0) {
        collabNotes.splice(
          0,
          collabNotes.length,
          ...(loadedState.notes as CollabNote[])
        );
      }
      if (Array.isArray(loadedState.students) && loadedState.students.length > 0) {
        studentRoster.splice(
          0,
          studentRoster.length,
          ...(loadedState.students as StudentProgress[])
        );
      }
      if (
        Array.isArray(loadedState.notifications) &&
        loadedState.notifications.length > 0
      ) {
        notifications.splice(
          0,
          notifications.length,
          ...(loadedState.notifications as ServerNotification[])
        );
      }
    }

    enforceCollectionBounds();
    repository.syncLabCollections({
      records: experimentRecords as unknown as Array<Record<string, unknown>>,
      tasks: groupTasks as unknown as Array<Record<string, unknown>>,
      notes: collabNotes as unknown as Array<Record<string, unknown>>,
      students: studentRoster as unknown as Array<Record<string, unknown>>,
      notifications: notifications as unknown as Array<Record<string, unknown>>,
      notificationTtlMs: limits.NOTIFICATION_TTL_MS,
    });
  };

  const roomActivityMap = new Map<string, RoomActivityState>();
  const getScopedActivityState = (
    roomId?: string,
    schoolId?: string
  ): RoomActivityState => {
    const cleanRoom = roomId ? roomId.toUpperCase().trim() : '';
    const cleanSchool = schoolId ? schoolId.trim() : DEFAULT_SCHOOL_ID;
    if (
      (!cleanRoom || cleanRoom === 'LAB-ALPHA') &&
      cleanSchool === DEFAULT_SCHOOL_ID
    ) {
      return {
        experimentRecords,
        groupTasks,
        collabNotes,
        studentRoster,
        notifications,
      };
    }
    const scopeKey = `${cleanSchool}::${cleanRoom || '__lobby__'}`;
    let existing = roomActivityMap.get(scopeKey);
    if (!existing) {
      existing = {
        experimentRecords: [],
        groupTasks: [],
        collabNotes: [],
        studentRoster: [],
        notifications: [],
      };
      roomActivityMap.set(scopeKey, existing);
    }
    return existing;
  };

  const maintenanceTimer = setInterval(() => {
    const now = Date.now();
    pruneExpiredLocks(now);
    pruneExpiredNotifications(now);
    pruneIdleRooms(now);
    pruneSessionSnapshots(now);
    database.pruneExpiredRooms(now);
  }, 5 * 60 * 1000);
  maintenanceTimer.unref?.();

  const dispose = () => {
    clearInterval(maintenanceTimer);
    backupService.stopScheduler();
    if (asyncRepository.driver === 'postgres') {
      void asyncRepository.close();
    }
    database.close();
  };

  return {
    dbPath: resolvedDbPath,
    database,
    repository,
    asyncRepository,
    backupService,
    experimentRecords,
    groupTasks,
    collabNotes,
    studentRoster,
    notifications,
    parameterLocks,
    activeLabRooms,
    sessionSnapshots,
    recordAuditLog,
    touchLabRoom,
    rejoinParticipantSession,
    saveRoomSimulationSnapshot,
    getLatestRoomSimulationSnapshot,
    saveGradebookEntry,
    getGradebookEntries,
    pruneExpiredDatabaseRooms,
    pruneExpiredLocks,
    pruneExpiredNotifications,
    pruneIdleRooms,
    pruneSessionSnapshots,
    enforceCollectionBounds,
    getScopedActivityState,
    persistServerState,
    hydrateServerState,
    dispose,
  };
}
