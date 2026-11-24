import { Pool, type PoolConfig } from 'pg';
import {
  DEFAULT_SCHOOL_ID,
  type AsyncLabRepository,
  type AuditLogQueryOptions,
  type DbAuditLogRecord,
  type DbAuthCredentialRecord,
  type DbGradebookEntryRecord,
  type DbIdempotencyKeyRecord,
  type DbSchoolRecord,
  type DbSubmissionRecord,
  type GradebookQueryOptions,
  type PaginatedResult,
  type SubmissionQueryOptions,
} from './LabRepository';
import { logger } from '../utils/logger';

const POSTGRES_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO schools (id, name, slug, created_at)
VALUES ('default-school', 'Sekolah Default 3T', 'default-school', '2026-01-01T00:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS rooms (
  pin TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  host_id TEXT NOT NULL,
  module_domain TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pg_rooms_school ON rooms(school_id);

CREATE TABLE IF NOT EXISTS gradebook_entries (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_pin TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  module_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  rubric_json TEXT NOT NULL,
  submitted_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pg_gradebook_school_room ON gradebook_entries(school_id, room_pin, submitted_at DESC);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  room_id TEXT NOT NULL,
  student_id TEXT,
  student_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  module_id TEXT NOT NULL,
  score DOUBLE PRECISION,
  payload_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pg_submissions_school_submitted ON submissions(school_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_submissions_school_domain ON submissions(school_id, domain, module_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pg_idem_school_endpoint ON idempotency_keys(school_id, endpoint);

CREATE TABLE IF NOT EXISTS auth_credentials (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  role TEXT NOT NULL CHECK(role IN ('teacher', 'admin', 'student')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_auth_school_role_user ON auth_credentials(school_id, role, username);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'default-school',
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pg_audit_school_created ON audit_logs(school_id, created_at DESC);
`;

function normalizeSchoolId(schoolId?: string | null): string {
  const clean = typeof schoolId === 'string' ? schoolId.trim() : '';
  return clean || DEFAULT_SCHOOL_ID;
}

function clampPagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 50;
  const safeOffset =
    typeof offset === 'number' && Number.isFinite(offset)
      ? Math.max(0, Math.floor(offset))
      : 0;
  return { limit: safeLimit, offset: safeOffset };
}

/**
 * Cloud-ready PostgreSQL AsyncLabRepository backed by `pg.Pool`.
 * Activated automatically when `DATABASE_URL` is configured in production/cloud environments.
 */
export class PostgresLabRepository implements AsyncLabRepository {
  public readonly driver = 'postgres' as const;
  private readonly pool: Pool;
  private initialized = false;

  constructor(connectionStringOrConfig: string | PoolConfig) {
    this.pool =
      typeof connectionStringOrConfig === 'string'
        ? new Pool({
            connectionString: connectionStringOrConfig,
            max: Number(process.env.PG_POOL_MAX) || 15,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
          })
        : new Pool(connectionStringOrConfig);
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    await this.pool.query(POSTGRES_BOOTSTRAP_SQL);
    this.initialized = true;
    logger.info('Initialized PostgreSQL LabRepository schema');
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 AS ok');
      return Number(res.rows[0]?.ok) === 1;
    } catch (err) {
      logger.error('PostgreSQL health check failed', { error: err });
      return false;
    }
  }

  public async ensureSchool(input: {
    id: string;
    name?: string;
    slug?: string;
    createdAt?: string;
  }): Promise<DbSchoolRecord> {
    const id = normalizeSchoolId(input.id);
    const slug = (input.slug || id).trim().toLowerCase();
    const name = (input.name || `Sekolah ${id}`).trim();
    const createdAt = input.createdAt || new Date().toISOString();
    await this.pool.query(
      `INSERT INTO schools (id, name, slug, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, slug, createdAt]
    );
    return (await this.getSchoolById(id)) ?? { id, name, slug, created_at: createdAt };
  }

  public async getSchoolById(id: string): Promise<DbSchoolRecord | null> {
    const res = await this.pool.query(
      'SELECT id, name, slug, created_at FROM schools WHERE id = $1',
      [normalizeSchoolId(id)]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      created_at: String(row.created_at),
    };
  }

  public async listSchools(): Promise<DbSchoolRecord[]> {
    const res = await this.pool.query(
      'SELECT id, name, slug, created_at FROM schools ORDER BY created_at ASC'
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      created_at: String(row.created_at),
    }));
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
    const record: DbSubmissionRecord = {
      id: String(input.id).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      room_id: String(input.roomId || 'LAB-ALPHA').trim(),
      student_id: input.studentId ? String(input.studentId).trim() : null,
      student_name: String(input.studentName).trim(),
      domain: String(input.domain || 'Fisika').trim(),
      module_id: String(input.moduleId).trim(),
      score: typeof input.score === 'number' && Number.isFinite(input.score) ? input.score : null,
      payload_json: String(input.payloadJson),
      submitted_at: String(input.submittedAt),
    };

    await this.pool.query(
      `INSERT INTO submissions (
        id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        room_id = EXCLUDED.room_id,
        student_id = EXCLUDED.student_id,
        student_name = EXCLUDED.student_name,
        domain = EXCLUDED.domain,
        module_id = EXCLUDED.module_id,
        score = EXCLUDED.score,
        payload_json = EXCLUDED.payload_json,
        submitted_at = EXCLUDED.submitted_at`,
      [
        record.id,
        record.school_id,
        record.room_id,
        record.student_id,
        record.student_name,
        record.domain,
        record.module_id,
        record.score,
        record.payload_json,
        record.submitted_at,
      ]
    );
    return record;
  }

  public async getSubmissionById(
    id: string,
    schoolId?: string
  ): Promise<DbSubmissionRecord | null> {
    const res = schoolId
      ? await this.pool.query(
          `SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
           FROM submissions WHERE id = $1 AND school_id = $2`,
          [String(id).trim(), normalizeSchoolId(schoolId)]
        )
      : await this.pool.query(
          `SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
           FROM submissions WHERE id = $1`,
          [String(id).trim()]
        );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id),
      room_id: String(row.room_id),
      student_id: row.student_id != null ? String(row.student_id) : null,
      student_name: String(row.student_name),
      domain: String(row.domain),
      module_id: String(row.module_id),
      score: row.score != null ? Number(row.score) : null,
      payload_json: String(row.payload_json),
      submitted_at: String(row.submitted_at),
    };
  }

  public async querySubmissionsPaginated(
    options: SubmissionQueryOptions
  ): Promise<PaginatedResult<DbSubmissionRecord>> {
    const { limit, offset } = clampPagination(options.limit, options.offset);
    const conditions: string[] = [];
    const params: unknown[] = [];
    const pushParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (options.schoolId && options.schoolId.trim()) {
      conditions.push(`school_id = ${pushParam(options.schoolId.trim())}`);
    }
    if (options.roomId && options.roomId.trim()) {
      conditions.push(`UPPER(room_id) = UPPER(${pushParam(options.roomId.trim())})`);
    }
    if (options.studentId && options.studentId.trim()) {
      conditions.push(`student_id = ${pushParam(options.studentId.trim())}`);
    }
    if (options.domain && options.domain.trim() && options.domain !== 'Semua') {
      conditions.push(`LOWER(domain) = LOWER(${pushParam(options.domain.trim())})`);
    }
    if (options.moduleId && options.moduleId.trim() && options.moduleId !== 'Semua') {
      conditions.push(`LOWER(module_id) = LOWER(${pushParam(options.moduleId.trim())})`);
    }
    if (options.status === 'graded') {
      conditions.push(`payload_json LIKE '%"teacherGrade":%'`);
    } else if (options.status === 'ungraded') {
      conditions.push(`payload_json NOT LIKE '%"teacherGrade":%'`);
    }
    if (options.search && options.search.trim()) {
      const pattern = `%${options.search.trim()}%`;
      const p1 = pushParam(pattern);
      conditions.push(
        `(student_name ILIKE ${p1} OR module_id ILIKE ${p1} OR id ILIKE ${p1})`
      );
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortDir = options.sortDir === 'asc' ? 'ASC' : 'DESC';
    const orderCol =
      options.sortBy === 'score'
        ? 'COALESCE(score, 0)'
        : options.sortBy === 'studentName'
          ? 'student_name'
          : 'submitted_at';

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM submissions ${whereSql}`,
      params
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    const limitPlaceholder = pushParam(limit);
    const offsetPlaceholder = pushParam(offset);
    const rowsRes = await this.pool.query(
      `SELECT id, school_id, room_id, student_id, student_name, domain, module_id, score, payload_json, submitted_at
       FROM submissions ${whereSql}
       ORDER BY ${orderCol} ${sortDir}, id DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      params
    );

    const items: DbSubmissionRecord[] = rowsRes.rows.map((row) => ({
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id),
      room_id: String(row.room_id),
      student_id: row.student_id != null ? String(row.student_id) : null,
      student_name: String(row.student_name),
      domain: String(row.domain),
      module_id: String(row.module_id),
      score: row.score != null ? Number(row.score) : null,
      payload_json: String(row.payload_json),
      submitted_at: String(row.submitted_at),
    }));

    const hasMore = offset + items.length < total;
    return {
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + items.length : null,
      },
    };
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
    const record: DbGradebookEntryRecord = {
      id: String(input.id).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      room_pin: String(input.roomPin || 'MANDIRI').trim(),
      student_id: String(input.studentId || 'student-anon').trim(),
      student_name: String(input.studentName || 'Praktikan').trim(),
      module_id: String(input.moduleId || 'newton-incline').trim(),
      score: Number.isFinite(input.score) ? Number(input.score) : 0,
      rubric_json: String(input.rubricJson || '{}'),
      submitted_at: input.submittedAt ?? Date.now(),
    };
    await this.pool.query(
      `INSERT INTO gradebook_entries (
        id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        room_pin = EXCLUDED.room_pin,
        student_id = EXCLUDED.student_id,
        student_name = EXCLUDED.student_name,
        module_id = EXCLUDED.module_id,
        score = EXCLUDED.score,
        rubric_json = EXCLUDED.rubric_json,
        submitted_at = EXCLUDED.submitted_at`,
      [
        record.id,
        record.school_id,
        record.room_pin,
        record.student_id,
        record.student_name,
        record.module_id,
        record.score,
        record.rubric_json,
        record.submitted_at,
      ]
    );
    return record;
  }

  public async queryGradebookPaginated(
    options: GradebookQueryOptions
  ): Promise<PaginatedResult<DbGradebookEntryRecord>> {
    const { limit, offset } = clampPagination(options.limit, options.offset);
    const conditions: string[] = [];
    const params: unknown[] = [];
    const pushParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (options.schoolId && options.schoolId.trim()) {
      conditions.push(`school_id = ${pushParam(options.schoolId.trim())}`);
    }
    if (options.roomPin && options.roomPin.trim()) {
      conditions.push(`room_pin = ${pushParam(options.roomPin.trim())}`);
    }
    if (options.moduleId && options.moduleId.trim()) {
      conditions.push(`module_id = ${pushParam(options.moduleId.trim())}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM gradebook_entries ${whereSql}`,
      params
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    const limP = pushParam(limit);
    const offP = pushParam(offset);
    const rowsRes = await this.pool.query(
      `SELECT id, school_id, room_pin, student_id, student_name, module_id, score, rubric_json, submitted_at
       FROM gradebook_entries ${whereSql}
       ORDER BY submitted_at DESC
       LIMIT ${limP} OFFSET ${offP}`,
      params
    );

    const items: DbGradebookEntryRecord[] = rowsRes.rows.map((row) => ({
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id),
      room_pin: String(row.room_pin),
      student_id: String(row.student_id),
      student_name: String(row.student_name),
      module_id: String(row.module_id),
      score: Number(row.score),
      rubric_json: String(row.rubric_json),
      submitted_at: Number(row.submitted_at),
    }));
    const hasMore = offset + items.length < total;
    return {
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + items.length : null,
      },
    };
  }

  public async getIdempotencyKey(
    key: string,
    schoolId: string,
    endpoint: string
  ): Promise<DbIdempotencyKeyRecord | null> {
    const res = await this.pool.query(
      `SELECT key, school_id, endpoint, response_json, created_at
       FROM idempotency_keys WHERE key = $1 AND school_id = $2 AND endpoint = $3`,
      [String(key).trim(), normalizeSchoolId(schoolId), String(endpoint).trim()]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      key: String(row.key),
      school_id: normalizeSchoolId(row.school_id),
      endpoint: String(row.endpoint),
      response_json: String(row.response_json),
      created_at: String(row.created_at),
    };
  }

  public async saveIdempotencyKey(input: {
    key: string;
    schoolId: string;
    endpoint: string;
    responseJson: string;
    createdAt?: string;
  }): Promise<DbIdempotencyKeyRecord> {
    const record: DbIdempotencyKeyRecord = {
      key: String(input.key).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      endpoint: String(input.endpoint).trim(),
      response_json: String(input.responseJson),
      created_at: input.createdAt || new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO idempotency_keys (key, school_id, endpoint, response_json, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING`,
      [record.key, record.school_id, record.endpoint, record.response_json, record.created_at]
    );
    return record;
  }

  public async getAuthCredential(
    schoolId: string,
    role: 'teacher' | 'admin' | 'student',
    username: string = 'default-teacher'
  ): Promise<DbAuthCredentialRecord | null> {
    const res = await this.pool.query(
      `SELECT id, school_id, role, username, password_hash, created_at, updated_at
       FROM auth_credentials WHERE school_id = $1 AND role = $2 AND username = $3`,
      [normalizeSchoolId(schoolId), role, username.trim().toLowerCase()]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id),
      role: row.role as 'teacher' | 'admin' | 'student',
      username: String(row.username),
      password_hash: String(row.password_hash),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  public async hasAnyTeacherCredential(schoolId?: string): Promise<boolean> {
    const res = schoolId
      ? await this.pool.query(
          `SELECT COUNT(*)::int AS cnt FROM auth_credentials WHERE school_id = $1 AND role IN ('teacher', 'admin')`,
          [normalizeSchoolId(schoolId)]
        )
      : await this.pool.query(
          `SELECT COUNT(*)::int AS cnt FROM auth_credentials WHERE role IN ('teacher', 'admin')`
        );
    return Number(res.rows[0]?.cnt ?? 0) > 0;
  }

  public async upsertAuthCredential(input: {
    id: string;
    schoolId?: string;
    role: 'teacher' | 'admin' | 'student';
    username: string;
    passwordHash: string;
  }): Promise<DbAuthCredentialRecord> {
    const now = new Date().toISOString();
    const record: DbAuthCredentialRecord = {
      id: String(input.id).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      role: input.role,
      username: input.username.trim().toLowerCase(),
      password_hash: input.passwordHash,
      created_at: now,
      updated_at: now,
    };
    await this.pool.query(
      `INSERT INTO auth_credentials (id, school_id, role, username, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (school_id, role, username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.school_id,
        record.role,
        record.username,
        record.password_hash,
        record.created_at,
        record.updated_at,
      ]
    );
    return record;
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
    const record: DbAuditLogRecord = {
      id: String(input.id).trim(),
      school_id: normalizeSchoolId(input.schoolId),
      actor_id: String(input.actorId || 'system').trim(),
      actor_name: String(input.actorName || 'System').trim(),
      actor_role: String(input.actorRole || 'system').trim(),
      action: String(input.action).trim(),
      target_type: String(input.targetType).trim(),
      target_id: String(input.targetId).trim(),
      metadata_json: String(input.metadataJson || '{}'),
      request_id: input.requestId ? String(input.requestId).trim() : null,
      created_at: input.createdAt || new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO audit_logs (
        id, school_id, actor_id, actor_name, actor_role, action, target_type, target_id, metadata_json, request_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.id,
        record.school_id,
        record.actor_id,
        record.actor_name,
        record.actor_role,
        record.action,
        record.target_type,
        record.target_id,
        record.metadata_json,
        record.request_id,
        record.created_at,
      ]
    );
    return record;
  }

  public async queryAuditLogs(
    options: AuditLogQueryOptions
  ): Promise<PaginatedResult<DbAuditLogRecord>> {
    const { limit, offset } = clampPagination(options.limit, options.offset);
    const params: unknown[] = [normalizeSchoolId(options.schoolId)];
    let whereSql = 'WHERE school_id = $1';
    if (options.action && options.action.trim()) {
      params.push(options.action.trim());
      whereSql += ` AND action = $${params.length}`;
    }

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`,
      params
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    params.push(limit, offset);
    const rowsRes = await this.pool.query(
      `SELECT id, school_id, actor_id, actor_name, actor_role, action, target_type, target_id, metadata_json, request_id, created_at
       FROM audit_logs ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const items: DbAuditLogRecord[] = rowsRes.rows.map((row) => ({
      id: String(row.id),
      school_id: normalizeSchoolId(row.school_id),
      actor_id: String(row.actor_id),
      actor_name: String(row.actor_name),
      actor_role: String(row.actor_role),
      action: String(row.action),
      target_type: String(row.target_type),
      target_id: String(row.target_id),
      metadata_json: String(row.metadata_json),
      request_id: row.request_id != null ? String(row.request_id) : null,
      created_at: String(row.created_at),
    }));
    const hasMore = offset + items.length < total;
    return {
      items,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + items.length : null,
      },
    };
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
