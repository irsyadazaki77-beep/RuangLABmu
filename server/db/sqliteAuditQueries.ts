import {
  DEFAULT_SCHOOL_ID,
  type AuditLogQueryOptions,
  type DbAuditLogRecord,
  type PaginatedResult,
} from './LabRepository';
import type { SqliteDatabaseDriver } from './sqliteDriver';

function normalizeSchoolId(schoolId?: string | null): string {
  const clean = typeof schoolId === 'string' ? schoolId.trim() : '';
  return clean || DEFAULT_SCHOOL_ID;
}

export function buildAuditLogRecord(input: {
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
}): DbAuditLogRecord {
  return {
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
}

export function querySqliteAuditLogs(
  db: SqliteDatabaseDriver,
  options: AuditLogQueryOptions
): PaginatedResult<DbAuditLogRecord> {
  const limit =
    typeof options.limit === 'number' && Number.isFinite(options.limit)
      ? Math.max(1, Math.min(200, Math.floor(options.limit)))
      : 50;
  const offset =
    typeof options.offset === 'number' && Number.isFinite(options.offset)
      ? Math.max(0, Math.floor(options.offset))
      : 0;

  const params: unknown[] = [normalizeSchoolId(options.schoolId)];
  let whereSql = 'WHERE school_id = ?';
  if (options.action && options.action.trim()) {
    whereSql += ' AND action = ?';
    params.push(options.action.trim());
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`)
    .get(...params);
  const total = Number(countRow?.total ?? 0);

  const rows = db
    .prepare(
      `SELECT id, school_id, actor_id, actor_name, actor_role, action, target_type, target_id, metadata_json, request_id, created_at
       FROM audit_logs ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const items: DbAuditLogRecord[] = rows.map((row) => ({
    id: String(row.id),
    school_id: normalizeSchoolId(row.school_id as string | undefined),
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
