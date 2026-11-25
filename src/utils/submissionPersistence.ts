import crypto from 'crypto';

export interface TeacherAuthContext {
  socketId: string;
  claimedRole?: string;
  providedPin?: string;
  providedToken?: string;
  roomPin?: string;
  roomPinHash?: string;
  roomTeacherSocketId?: string;
  isSocketAlreadyVerifiedTeacher?: boolean;
  expectedMasterPin?: string;
}

export interface TeacherAuthResult {
  authorized: boolean;
  effectiveRole: 'Pengajar' | 'Praktikan';
  reason?: string;
}

function compareSecretsTimingSafe(candidate: string, expected: string): boolean {
  const cleanCandidate = String(candidate ?? '').trim();
  const cleanExpected = String(expected ?? '').trim();
  if (!cleanCandidate || !cleanExpected) return false;

  if (cleanExpected.startsWith('sha256$')) {
    const parts = cleanExpected.split('$');
    if (parts.length !== 3) return false;
    const [, salt, storedHex] = parts;
    if (!salt || !storedHex) return false;
    const candidateHex = crypto
      .createHmac('sha256', salt)
      .update(cleanCandidate, 'utf8')
      .digest('hex');
    const bufA = Buffer.from(candidateHex, 'hex');
    const bufB = Buffer.from(storedHex, 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  const digestA = crypto.createHash('sha256').update(cleanCandidate, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(cleanExpected, 'utf8').digest();
  if (digestA.length !== digestB.length) return false;
  return crypto.timingSafeEqual(digestA, digestB);
}

/**
 * Validates whether a WebSocket client is authorized to claim the 'Pengajar' (teacher) role
 * or execute privileged teacher actions (e.g., freeze class, broadcast mystery challenge, send teacher feedback).
 */
export function verifyTeacherAuthorization(ctx: TeacherAuthContext): TeacherAuthResult {
  const masterPin = (ctx.expectedMasterPin || process.env.TEACHER_SECRET_PIN || '').trim();
  const wantsTeacher =
    ctx.claimedRole === 'Pengajar' ||
    ctx.claimedRole === 'teacher' ||
    ctx.claimedRole === 'Guru';

  if (ctx.isSocketAlreadyVerifiedTeacher) {
    return { authorized: true, effectiveRole: 'Pengajar' };
  }

  if (ctx.roomTeacherSocketId && ctx.roomTeacherSocketId === ctx.socketId) {
    return { authorized: true, effectiveRole: 'Pengajar' };
  }

  const candidatePin = (ctx.providedPin || ctx.providedToken || '').trim();
  if (candidatePin) {
    if (ctx.roomPinHash && compareSecretsTimingSafe(candidatePin, ctx.roomPinHash)) {
      return { authorized: true, effectiveRole: 'Pengajar' };
    }
    if (ctx.roomPin && compareSecretsTimingSafe(candidatePin, ctx.roomPin)) {
      return { authorized: true, effectiveRole: 'Pengajar' };
    }
    if (masterPin && compareSecretsTimingSafe(candidatePin, masterPin)) {
      return { authorized: true, effectiveRole: 'Pengajar' };
    }
  }

  if (wantsTeacher) {
    return {
      authorized: false,
      effectiveRole: 'Praktikan',
      reason: 'Klaim peran Pengajar ditolak: PIN Guru atau otorisasi pemilik ruangan tidak valid.',
    };
  }

  return {
    authorized: false,
    effectiveRole: 'Praktikan',
    reason: 'Aksi khusus Pengajar membutuhkan verifikasi PIN Guru.',
  };
}
