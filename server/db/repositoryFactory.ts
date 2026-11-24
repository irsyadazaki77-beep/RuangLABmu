import type {
  AsyncLabRepository,
  AuditLogQueryOptions,
  DbAuditLogRecord,
  DbAuthCredentialRecord,
  DbGradebookEntryRecord,
  DbIdempotencyKeyRecord,
  DbSchoolRecord,
  DbSubmissionRecord,
  GradebookQueryOptions,
  LabRepository,
  PaginatedResult,
  SubmissionQueryOptions,
} from './LabRepository';
import { PostgresLabRepository } from './postgresRepository';
import { logger } from '../utils/logger';

/**
 * Wraps the synchronous SQLite WAL repository in the unified AsyncLabRepository contract
 * so route handlers and services work identically across local 3T SQLite and cloud PostgreSQL.
 */
export class SqliteAsyncLabRepository implements AsyncLabRepository {
  public readonly driver = 'sqlite' as const;
  private readonly repo: LabRepository;

  constructor(repo: LabRepository) {
    this.repo = repo;
  }

  public async init(): Promise<void> {
    // Migrations run eagerly during SqliteLabRepository construction
  }

  public async healthCheck(): Promise<boolean> {
    return this.repo.healthCheck();
  }

  public async ensureSchool(input: {
    id: string;
    name?: string;
    slug?: string;
    createdAt?: string;
  }): Promise<DbSchoolRecord> {
    return this.repo.ensureSchool(input);
  }

  public async getSchoolById(id: string): Promise<DbSchoolRecord | null> {
    return this.repo.getSchoolById(id);
  }

  public async listSchools(): Promise<DbSchoolRecord[]> {
    return this.repo.listSchools();
  }

  public async upsertSubmission(input: {
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
  }): Promise<DbSubmissionRecord> {
    return this.repo.upsertSubmission(input);
  }

  public async getSubmissionById(
    id: string,
    schoolId?: string
  ): Promise<DbSubmissionRecord | null> {
    return this.repo.getSubmissionById(id, schoolId);
  }

  public async querySubmissionsPaginated(
    options: SubmissionQueryOptions
  ): Promise<PaginatedResult<DbSubmissionRecord>> {
    return this.repo.querySubmissionsPaginated(options);
  }

  public async upsertGradebookEntry(input: {
    id: string;
    schoolId?: string;
    roomPin: string;
    studentId: string;
    studentName: string;
    moduleId: string;
    score: number;
    rubricJson: string;
    submittedAt?: number;
  }): Promise<DbGradebookEntryRecord> {
    return this.repo.upsertGradebookEntry(input);
  }

  public async queryGradebookPaginated(
    options: GradebookQueryOptions
  ): Promise<PaginatedResult<DbGradebookEntryRecord>> {
    return this.repo.queryGradebookPaginated(options);
  }

  public async getIdempotencyKey(
    key: string,
    schoolId: string,
    endpoint: string
  ): Promise<DbIdempotencyKeyRecord | null> {
    return this.repo.getIdempotencyKey(key, schoolId, endpoint);
  }

  public async saveIdempotencyKey(input: {
    key: string;
    schoolId: string;
    endpoint: string;
    responseJson: string;
    createdAt?: string;
  }): Promise<DbIdempotencyKeyRecord> {
    return this.repo.saveIdempotencyKey(input);
  }

  public async getAuthCredential(
    schoolId: string,
    role: 'teacher' | 'admin' | 'student',
    username?: string
  ): Promise<DbAuthCredentialRecord | null> {
    return this.repo.getAuthCredential(schoolId, role, username);
  }

  public async hasAnyTeacherCredential(schoolId?: string): Promise<boolean> {
    return this.repo.hasAnyTeacherCredential(schoolId);
  }

  public async upsertAuthCredential(input: {
    id: string;
    schoolId?: string;
    role: 'teacher' | 'admin' | 'student';
    username: string;
    passwordHash: string;
  }): Promise<DbAuthCredentialRecord> {
    return this.repo.upsertAuthCredential(input);
  }

  public async appendAuditLog(input: {
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
  }): Promise<DbAuditLogRecord> {
    return this.repo.appendAuditLog(input);
  }

  public async queryAuditLogs(
    options: AuditLogQueryOptions
  ): Promise<PaginatedResult<DbAuditLogRecord>> {
    return this.repo.queryAuditLogs(options);
  }

  public async close(): Promise<void> {
    // Lifecycle managed by owning SqliteLabRepository
  }
}

export function createHybridAsyncRepository(
  sqliteRepo: LabRepository,
  databaseUrl: string | undefined = process.env.DATABASE_URL
): AsyncLabRepository {
  const cleanUrl = typeof databaseUrl === 'string' ? databaseUrl.trim() : '';
  if (cleanUrl && /^postgres(?:ql)?:\/\//i.test(cleanUrl)) {
    logger.info('Configured hybrid repository driver: PostgreSQL (DATABASE_URL detected)');
    return new PostgresLabRepository(cleanUrl);
  }
  return new SqliteAsyncLabRepository(sqliteRepo);
}
