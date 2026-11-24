import express from 'express';
import fs from 'fs';
import { requireTeacherAuthMiddleware } from '../auth/sessionToken';
import type { LabServerState } from '../state/labServerState';
import { rateLimitKeyGenerator } from '../utils/rateLimitKey';
import {
  formatValidationErrorResponse,
  validateAuditLogsQuery,
} from '../utils/routePayloadValidators';

export interface AdminRoutesDeps {
  state: LabServerState;
}

export function createAdminRouter({ state }: AdminRoutesDeps): express.Router {
  const router = express.Router();

  router.get('/api/audit-logs', requireTeacherAuthMiddleware, async (req, res, next) => {
    try {
      const check = validateAuditLogsQuery(req.query);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const session = req.authSession!;
      const result = await state.asyncRepository.queryAuditLogs({
        schoolId: session.schoolId,
        action: check.data.action,
        limit: check.data.limit,
        offset: check.data.offset,
      });

      res.json({
        ok: true,
        schoolId: session.schoolId,
        logs: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/admin/backups', requireTeacherAuthMiddleware, (_req, res) => {
    res.json({
      ok: true,
      status: state.backupService.getStatus(),
      backups: state.backupService.listBackups(),
    });
  });

  router.post('/api/admin/backups', requireTeacherAuthMiddleware, async (req, res, next) => {
    try {
      const session = req.authSession!;
      const backup = await state.backupService.createBackup('manual');
      state.recordAuditLog({
        schoolId: session.schoolId,
        actorId: session.sub,
        actorName: session.displayName,
        actorRole: session.role,
        action: 'BACKUP_CREATED',
        targetType: 'backup',
        targetId: backup.filename,
        metadata: { sizeBytes: backup.sizeBytes, reason: 'manual' },
        ipAddress: rateLimitKeyGenerator(req),
      });

      res.status(201).json({
        ok: true,
        backup,
        status: state.backupService.getStatus(),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/admin/backups/:filename', requireTeacherAuthMiddleware, (req, res) => {
    const filename = String(req.params.filename || '').trim();
    const safePath = state.backupService.resolveSafeBackupPath(filename);
    if (!safePath) {
      res.status(400).json({
        error: 'INVALID_FILENAME',
        code: 'INVALID_BACKUP_FILENAME',
        message: 'Nama berkas backup tidak valid.',
      });
      return;
    }

    if (!fs.existsSync(safePath)) {
      res.status(404).json({
        error: 'NOT_FOUND',
        code: 'BACKUP_NOT_FOUND',
        message: 'Berkas backup tidak ditemukan.',
      });
      return;
    }

    const session = req.authSession!;
    state.recordAuditLog({
      schoolId: session.schoolId,
      actorId: session.sub,
      actorName: session.displayName,
      actorRole: session.role,
      action: 'BACKUP_DOWNLOADED',
      targetType: 'backup',
      targetId: filename,
      ipAddress: rateLimitKeyGenerator(req),
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const stream = fs.createReadStream(safePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'BACKUP_READ_FAILED', message: 'Gagal membaca berkas backup.' });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  });

  return router;
}
