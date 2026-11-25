import crypto from 'crypto';
import type express from 'express';
import { DEFAULT_SCHOOL_ID } from '../db/LabRepository';

export type SessionRole = 'teacher' | 'admin' | 'student';

export interface SessionTokenClaims {
  sub: string;
  displayName: string;
  name?: string;
  role: SessionRole;
  schoolId: string;
  roomId?: string;
  iat: number;
  exp: number;
  jti: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authSession?: SessionTokenClaims | null;
    }
  }
}

export const DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

// Ephemeral cryptographically random fallback signing secret kept strictly in server memory
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32);

function getSigningSecretKey(): Buffer {
  const envSecret = process.env.SESSION_SIGNING_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret, 'utf8').digest();
  }
  if (process.env.NODE_ENV === 'production' && process.env.RUANGLAB_PORTABLE !== '1') {
    throw new Error(
      'SESSION_SIGNING_SECRET environment variable (>=16 characters) is required in production.'
    );
  }
  return EPHEMERAL_SESSION_SECRET;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

/**
 * Hashes a passcode/password using Node.js `crypto.scryptSync` with a random 16-byte salt.
 */
export function hashPasscodeScrypt(rawPasscode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(rawPasscode.trim(), salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a plaintext passcode against a `scrypt$<salt>$<hex>` hash in constant time.
 */
export function verifyPasscodeScrypt(candidate: string, storedHash: string): boolean {
  const cleanCandidate = String(candidate || '').trim();
  const cleanStored = String(storedHash || '').trim();
  if (!cleanCandidate || !cleanStored.startsWith('scrypt$')) return false;
  const parts = cleanStored.split('$');
  if (parts.length !== 3) return false;
  const [, salt, storedHex] = parts;
  if (!salt || !storedHex) return false;
  try {
    const derived = crypto.scryptSync(cleanCandidate, salt, 32);
    const expected = Buffer.from(storedHex, 'hex');
    if (derived.length === 0 || derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function comparePasscodeTimingSafe(candidate: string, expectedPlain: string): boolean {
  const a = String(candidate || '').trim();
  const b = String(expectedPlain || '').trim();
  if (!a || !b) return false;
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

/**
 * Issues a compact stateless HMAC-SHA256 JWT-compatible token (works 100% offline in 3T LANs).
 */
export function signSessionToken(input: {
  sub: string;
  displayName?: string;
  name?: string;
  role: SessionRole;
  schoolId?: string;
  roomId?: string;
  ttlSeconds?: number;
}): { token: string; claims: SessionTokenClaims } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl =
    typeof input.ttlSeconds === 'number' && input.ttlSeconds > 0
      ? Math.floor(input.ttlSeconds)
      : DEFAULT_SESSION_TTL_SECONDS;
  const resolvedName = String(input.displayName || input.name || 'Pengguna').trim() || 'Pengguna';
  const claims: SessionTokenClaims = {
    sub: String(input.sub).trim(),
    displayName: resolvedName,
    name: resolvedName,
    role: input.role,
    schoolId: String(input.schoolId || DEFAULT_SCHOOL_ID).trim() || DEFAULT_SCHOOL_ID,
    ...(input.roomId ? { roomId: String(input.roomId).trim().toUpperCase() } : {}),
    iat: nowSec,
    exp: nowSec + ttl,
    jti: crypto.randomUUID(),
  };

  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto
    .createHmac('sha256', getSigningSecretKey())
    .update(signingInput, 'utf8')
    .digest();
  const sigB64 = base64UrlEncode(sig);

  return {
    token: `${signingInput}.${sigB64}`,
    claims,
  };
}

/**
 * Verifies signature & expiration of a stateless HMAC-SHA256 session token in constant time.
 */
export function verifySessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now()
): SessionTokenClaims | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecretKey())
      .update(signingInput, 'utf8')
      .digest();
    const expectedSigB64 = base64UrlEncode(expectedSig);

    const bufA = Buffer.from(sigB64, 'utf8');
    const bufB = Buffer.from(expectedSigB64, 'utf8');
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(headerB64)) as { alg?: string };
    if (header.alg !== 'HS256') return null;

    const claims = JSON.parse(base64UrlDecode(payloadB64)) as Partial<SessionTokenClaims>;
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.role !== 'string' ||
      typeof claims.schoolId !== 'string' ||
      typeof claims.exp !== 'number'
    ) {
      return null;
    }

    const nowSec = Math.floor(nowMs / 1000);
    if (claims.exp <= nowSec) {
      return null;
    }

    if (claims.role !== 'teacher' && claims.role !== 'admin' && claims.role !== 'student') {
      return null;
    }

    const resolvedName =
      typeof claims.displayName === 'string' && claims.displayName.trim()
        ? claims.displayName.trim()
        : typeof claims.name === 'string' && claims.name.trim()
        ? claims.name.trim()
        : 'Pengguna';

    return {
      sub: claims.sub,
      displayName: resolvedName,
      name: resolvedName,
      role: claims.role,
      schoolId: claims.schoolId || DEFAULT_SCHOOL_ID,
      roomId: typeof claims.roomId === 'string' ? claims.roomId : undefined,
      iat: typeof claims.iat === 'number' ? claims.iat : 0,
      exp: claims.exp,
      jti: typeof claims.jti === 'string' ? claims.jti : '',
    };
  } catch {
    return null;
  }
}

export function extractBearerTokenFromRequest(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

export interface AuthenticatedLocals {
  session?: SessionTokenClaims | null;
  requestId?: string;
}

export function attachSessionMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = extractBearerTokenFromRequest(req);
  const claims = token ? verifySessionToken(token) : null;
  req.authSession = claims;
  (res.locals as AuthenticatedLocals).session = claims;
  next();
}

export function getSessionFromResponse(res: express.Response): SessionTokenClaims | null {
  return (res.locals as AuthenticatedLocals).session ?? null;
}

export function requireAuthMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const existing = req.authSession ?? getSessionFromResponse(res);
  const session = existing ?? verifySessionToken(extractBearerTokenFromRequest(req));
  if (!session) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      code: 'AUTH_REQUIRED',
      message: 'Autentikasi sesi diperlukan untuk mengakses endpoint ini.',
      requestId: res.locals?.requestId,
    });
    return;
  }
  req.authSession = session;
  (res.locals as AuthenticatedLocals).session = session;
  next();
}

export function requireTeacherAuthMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const existing = req.authSession ?? getSessionFromResponse(res);
  const session = existing ?? verifySessionToken(extractBearerTokenFromRequest(req));
  if (!session) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      code: 'TEACHER_AUTH_REQUIRED',
      message: 'Token sesi Pengajar diperlukan untuk melakukan tindakan ini.',
      requestId: res.locals?.requestId,
    });
    return;
  }
  if (session.role !== 'teacher' && session.role !== 'admin') {
    res.status(403).json({
      error: 'FORBIDDEN',
      code: 'TEACHER_ROLE_REQUIRED',
      message: 'Akses ditolak: Endpoint ini khusus untuk peran Pengajar atau Admin.',
      requestId: res.locals?.requestId,
    });
    return;
  }
  req.authSession = session;
  (res.locals as AuthenticatedLocals).session = session;
  next();
}
