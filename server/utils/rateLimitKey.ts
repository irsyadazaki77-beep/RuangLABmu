import type { Request } from 'express';
import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';

export type TrustProxySetting = boolean | number | string;

export function resolveTrustProxySetting(
  env: NodeJS.ProcessEnv = process.env
): TrustProxySetting {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) {
    // Trust a single upstream reverse-proxy hop by default (Cloud Run, Fly.io, Render, Nginx)
    // so express-rate-limit resolves client IPs accurately without triggering ERR_ERL_PERMISSIVE_TRUST_PROXY.
    return 1;
  }

  const lower = raw.toLowerCase();
  if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'no') {
    return false;
  }
  if (lower === 'true' || lower === 'yes' || lower === 'on') {
    return 1;
  }
  if (/^\d+$/.test(raw)) {
    const hops = Number.parseInt(raw, 10);
    return Math.min(10, Math.max(1, hops));
  }
  return raw;
}

export function normalizeIpCandidate(rawToken: string): string | null {
  let token = rawToken.trim();
  if (!token) return null;

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (!token || token.toLowerCase() === 'unknown' || token.startsWith('_')) {
    return null;
  }

  if (token.startsWith('[')) {
    const closeBracketIdx = token.indexOf(']');
    if (closeBracketIdx <= 1) return null;
    token = token.slice(1, closeBracketIdx);
  } else {
    const colonCount = (token.match(/:/g) ?? []).length;
    if (colonCount === 1) {
      const [hostPart, portPart] = token.split(':');
      if (hostPart && /^\d{1,5}$/.test(portPart ?? '')) {
        token = hostPart;
      }
    }
  }

  const zoneIdx = token.indexOf('%');
  if (zoneIdx > 0) {
    token = token.slice(0, zoneIdx);
  }

  return isIP(token) !== 0 ? token : null;
}

function splitHeaderPreservingQuotes(headerText: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < headerText.length; i += 1) {
    const ch = headerText[i];
    if (ch === '"' && headerText[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) {
    parts.push(current);
  }
  return parts;
}

export function parseForwardedForIps(headerValue: string | string[] | undefined): string[] {
  if (!headerValue) return [];
  const rawValues = Array.isArray(headerValue) ? headerValue : [headerValue];
  const validIps: string[] = [];

  for (const raw of rawValues) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    for (const entry of splitHeaderPreservingQuotes(raw, ',')) {
      for (const param of splitHeaderPreservingQuotes(entry, ';')) {
        const eqIdx = param.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = param.slice(0, eqIdx).trim().toLowerCase();
        if (key !== 'for') continue;
        const value = param.slice(eqIdx + 1);
        const normalized = normalizeIpCandidate(value);
        if (normalized) {
          validIps.push(normalized);
        }
      }
    }
  }

  return validIps;
}

export function extractClientIpFromRequest(req: Request): string {
  const trustProxy = req.app?.get('trust proxy');

  if (trustProxy !== false && req.headers?.forwarded) {
    const forwardedIps = parseForwardedForIps(req.headers.forwarded);
    if (forwardedIps.length > 0) {
      const hopCount =
        typeof trustProxy === 'number' && Number.isInteger(trustProxy) && trustProxy > 0
          ? trustProxy
          : 1;
      return forwardedIps[Math.max(0, forwardedIps.length - hopCount)];
    }
  }

  const expressIp = typeof req.ip === 'string' ? normalizeIpCandidate(req.ip) : null;
  if (expressIp) {
    return expressIp;
  }

  const socketIp =
    typeof req.socket?.remoteAddress === 'string'
      ? normalizeIpCandidate(req.socket.remoteAddress)
      : null;
  return socketIp ?? '127.0.0.1';
}

export function rateLimitKeyGenerator(req: Request): string {
  const clientIp = extractClientIpFromRequest(req) || req.ip || '127.0.0.1';
  return ipKeyGenerator(clientIp, 56);
}
