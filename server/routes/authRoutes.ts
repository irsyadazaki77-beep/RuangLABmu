import crypto from 'crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  comparePasscodeTimingSafe,
  hashPasscodeScrypt,
  requireAuthMiddleware,
  signSessionToken,
  verifyPasscodeScrypt,
} from '../auth/sessionToken';
import { DEFAULT_SCHOOL_ID } from '../db/LabRepository';
import {
  verifyRoomPinTimingSafe,
  type LabServerState,
} from '../state/labServerState';
import { rateLimitKeyGenerator } from '../utils/rateLimitKey';
import {
  formatValidationErrorResponse,
  validateAuthBootstrapTeacherPayload,
  validateAuthSessionRequestPayload,
} from '../utils/routePayloadValidators';

export interface AuthRoutesDeps {
  state: LabServerState;
  authRateLimitMax?: number;
  authRateLimitWindowMs?: number;
}

function getEnvTeacherPasscode(): string | null {
  const pin = process.env.TEACHER_SECRET_PIN?.trim();
  return pin && pin.length > 0 ? pin : null;
}

export function createAuthRouter({
  state,
  authRateLimitMax = 20,
  authRateLimitWindowMs = 60 * 1000,
}: AuthRoutesDeps): express.Router {
  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: authRateLimitWindowMs,
    max: authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    message: {
      error: 'RATE_LIMITED',
      code: 'RATE_LIMITED',
      message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu 1 menit sebelum mencoba lagi.',
    },
  });

  router.get('/api/auth/status', async (req, res, next) => {
    try {
      const schoolId =
        typeof req.query?.schoolId === 'string' && req.query.schoolId.trim()
          ? req.query.schoolId.trim().slice(0, 64)
          : DEFAULT_SCHOOL_ID;
      const envPasscode = getEnvTeacherPasscode();
      if (envPasscode) {
        res.json({
          mode: 'env',
          requiresBootstrap: false,
          schoolId,
        });
        return;
      }

      const hasClaimed = await state.asyncRepository.hasAnyTeacherCredential(schoolId);
      res.json({
        mode: hasClaimed ? 'claimed' : 'needs_bootstrap',
        requiresBootstrap: !hasClaimed,
        schoolId,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/auth/bootstrap-teacher', authLimiter, async (req, res, next) => {
    try {
      const check = validateAuthBootstrapTeacherPayload(req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const { schoolId, teacherName, passcode } = check.data;
      if (getEnvTeacherPasscode()) {
        res.status(409).json({
          error: 'CONFLICT',
          code: 'TEACHER_PIN_MANAGED_BY_ENV',
          message:
            'Kredensial pengajar dikelola oleh environment server (TEACHER_SECRET_PIN). Silakan login menggunakan PIN tersebut.',
        });
        return;
      }

      const alreadyClaimed = await state.asyncRepository.hasAnyTeacherCredential(schoolId);
      if (alreadyClaimed) {
        res.status(409).json({
          error: 'CONFLICT',
          code: 'TEACHER_ALREADY_BOOTSTRAPPED',
          message:
            'PIN pengajar untuk sekolah ini sudah ditetapkan sebelumnya. Silakan login menggunakan PIN pengajar yang terdaftar.',
        });
        return;
      }

      const credentialId = `teacher:${schoolId}:primary`;
      const passcodeHash = hashPasscodeScrypt(passcode);
      await state.asyncRepository.upsertAuthCredential({
        id: credentialId,
        schoolId,
        role: 'teacher',
        username: 'default-teacher',
        passwordHash: passcodeHash,
      });

      // Keep local SQLite synchronized when hybrid PG mode is active
      if (state.asyncRepository.driver === 'postgres') {
        state.repository.upsertAuthCredential({
          id: credentialId,
          schoolId,
          role: 'teacher',
          username: 'default-teacher',
          passwordHash: passcodeHash,
        });
      }

      const signed = signSessionToken({
        sub: credentialId,
        role: 'teacher',
        schoolId,
        displayName: teacherName,
      });

      state.recordAuditLog({
        schoolId,
        actorId: credentialId,
        actorName: teacherName,
        actorRole: 'teacher',
        action: 'TEACHER_BOOTSTRAP',
        targetType: 'auth_credential',
        targetId: credentialId,
        metadata: { mode: 'first_run_bootstrap' },
        ipAddress: rateLimitKeyGenerator(req),
      });

      res.status(201).json({
        ok: true,
        token: signed.token,
        session: signed.claims,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/api/auth/session', authLimiter, async (req, res, next) => {
    try {
      const check = validateAuthSessionRequestPayload(req.body);
      if (!check.ok) {
        res.status(400).json(formatValidationErrorResponse(check));
        return;
      }

      const { role, schoolId, displayName, userId, roomId, passcode } = check.data;
      const clientIp = rateLimitKeyGenerator(req);

      if (role === 'student') {
        const studentSub = userId || `stu-${crypto.randomUUID().slice(0, 8)}`;
        const resolvedName = displayName || 'Siswa Praktikan';
        const signed = signSessionToken({
          sub: studentSub,
          role: 'student',
          schoolId,
          displayName: resolvedName,
          roomId,
        });
        res.status(200).json({
          ok: true,
          token: signed.token,
          session: signed.claims,
        });
        return;
      }

      // Teacher / Admin authentication
      const envPasscode = getEnvTeacherPasscode();
      let authorized = false;
      let resolvedTeacherName = displayName || 'Pengajar RuangLABmu';
      let resolvedActorId = userId || `teacher:${schoolId}:primary`;

      if (envPasscode) {
        authorized = Boolean(passcode && comparePasscodeTimingSafe(passcode, envPasscode));
      } else {
        const storedCred = await state.asyncRepository.getAuthCredential(
          schoolId,
          'teacher',
          'default-teacher'
        );
        if (storedCred) {
          authorized = Boolean(
            passcode && verifyPasscodeScrypt(passcode, storedCred.password_hash)
          );
          resolvedActorId = storedCred.id;
        } else if (roomId) {
          // Optional fallback when authenticating with an active room's generated PIN
          const room = state.activeLabRooms.get(roomId.toUpperCase()) as
            | (import('../../src/utils/collabProtocol').LabRoom & { pinHash?: string })
            | undefined;
          const expectedSecret = room?.pinHash || room?.pin;
          if (room && expectedSecret && passcode) {
            authorized = verifyRoomPinTimingSafe(passcode, expectedSecret);
            if (authorized && !displayName && room.teacherName) {
              resolvedTeacherName = room.teacherName;
            }
          }
        } else {
          res.status(409).json({
            error: 'BOOTSTRAP_REQUIRED',
            code: 'TEACHER_BOOTSTRAP_REQUIRED',
            message:
              'PIN pengajar belum diatur pada server lokal ini. Silakan buat PIN pengajar pertama kali.',
          });
          return;
        }
      }

      if (!authorized) {
        state.recordAuditLog({
          schoolId,
          actorId: resolvedActorId,
          actorName: resolvedTeacherName,
          actorRole: 'teacher',
          action: 'AUTH_LOGIN_FAILED',
          targetType: 'session',
          targetId: roomId || schoolId,
          metadata: { reason: 'invalid_passcode' },
          ipAddress: clientIp,
        });
        res.status(401).json({
          error: 'UNAUTHORIZED',
          code: 'INVALID_TEACHER_PASSCODE',
          message: 'PIN pengajar tidak valid. Periksa kembali PIN akses Anda.',
        });
        return;
      }

      const signed = signSessionToken({
        sub: resolvedActorId,
        role: 'teacher',
        schoolId,
        displayName: resolvedTeacherName,
        roomId,
      });

      state.recordAuditLog({
        schoolId,
        actorId: resolvedActorId,
        actorName: resolvedTeacherName,
        actorRole: 'teacher',
        action: 'AUTH_LOGIN_SUCCESS',
        targetType: 'session',
        targetId: roomId || schoolId,
        metadata: { mode: envPasscode ? 'env' : 'credential' },
        ipAddress: clientIp,
      });

      res.status(200).json({
        ok: true,
        token: signed.token,
        session: signed.claims,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/auth/me', requireAuthMiddleware, (req, res) => {
    res.json({
      ok: true,
      session: req.authSession,
    });
  });

  return router;
}
