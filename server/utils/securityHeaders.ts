import type { IncomingHttpHeaders } from 'http';

export interface FrameAncestorsOptions {
  isProduction: boolean;
  appUrl?: string;
  allowedFrameAncestorsEnv?: string;
  strictFrameguard?: boolean;
}

const DEFAULT_AISTUDIO_FRAME_ANCESTORS = [
  'https://aistudio.google.com',
  'https://*.google.com',
  'https://*.corp.google.com',
  'https://*.googlers.com',
  'https://localhost.corp.google.com:26001',
  'https://*.googleusercontent.com',
  'https://*.usercontent.goog',
  'https://*.run.app',
] as const;

export function buildFrameAncestorsList(options: FrameAncestorsOptions): string[] {
  const ancestors = new Set<string>(["'self'"]);
  if (options.strictFrameguard) {
    return Array.from(ancestors);
  }

  for (const origin of DEFAULT_AISTUDIO_FRAME_ANCESTORS) {
    ancestors.add(origin);
  }

  if (options.allowedFrameAncestorsEnv) {
    for (const entry of options.allowedFrameAncestorsEnv.split(/[\s,]+/)) {
      const trimmed = entry.trim().replace(/\/+$/, '');
      if (trimmed) {
        ancestors.add(trimmed);
      }
    }
  }

  if (options.appUrl && options.appUrl.trim() && options.appUrl.trim() !== 'MY_APP_URL') {
    try {
      const parsed = new URL(options.appUrl.trim());
      ancestors.add(parsed.origin);
    } catch {
      // ignore invalid APP_URL
    }
  }

  if (!options.isProduction) {
    ancestors.add('http://localhost:*');
    ancestors.add('http://127.0.0.1:*');
  }

  return Array.from(ancestors);
}

function readHeaderValue(headers: IncomingHttpHeaders, name: string): string {
  const raw = headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return String(raw[0] ?? '').trim().toLowerCase();
  }
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export interface EmbeddedPreviewSecurityOptions {
  isProduction?: boolean;
  allowEmbeddedPreview?: boolean;
  allowedOrigins?: Iterable<string>;
  appUrl?: string;
  allowedFrameAncestorsEnv?: string;
}

export interface CspDirectivesOptions {
  isProduction: boolean;
  frameAncestors: string[];
}

export function buildContentSecurityPolicyDirectives(
  options: CspDirectivesOptions
): Record<string, Iterable<string> | null> {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: options.isProduction
      ? ["'self'", 'blob:']
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:'],
    scriptSrcAttr: ["'none'"],
    workerSrc: ["'self'", 'blob:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https://fonts.gstatic.com',
      'https://www.gstatic.com',
    ],
    connectSrc: ["'self'", 'ws:', 'wss:'],
    frameAncestors: options.frameAncestors,
    upgradeInsecureRequests: null,
  };
}

function extractOriginFromHeaderUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    return new URL(rawUrl).origin.toLowerCase();
  } catch {
    return '';
  }
}

function matchesWildcardOriginPattern(origin: string, pattern: string): boolean {
  const cleanOrigin = origin.trim().toLowerCase().replace(/\/+$/, '');
  const cleanPattern = pattern.trim().toLowerCase().replace(/\/+$/, '');
  if (!cleanOrigin || !cleanPattern || cleanPattern === "'self'") return false;
  if (cleanOrigin === cleanPattern) return true;

  if (cleanPattern.endsWith(':*')) {
    const prefix = cleanPattern.slice(0, -2);
    return cleanOrigin === prefix || cleanOrigin.startsWith(`${prefix}:`);
  }

  if (cleanPattern.includes('*.')) {
    const [scheme, rest] = cleanPattern.split('://');
    if (!scheme || !rest || !rest.startsWith('*.')) return false;
    const domainSuffix = rest.slice(1); // e.g. .google.com
    try {
      const parsed = new URL(cleanOrigin);
      return (
        parsed.protocol === `${scheme}:` &&
        (parsed.hostname.endsWith(domainSuffix) ||
          parsed.hostname === domainSuffix.slice(1))
      );
    } catch {
      return false;
    }
  }

  return false;
}

export function isPreviewOriginWhitelisted(
  candidateOrigin: string,
  options: EmbeddedPreviewSecurityOptions = {}
): boolean {
  const normalized = extractOriginFromHeaderUrl(candidateOrigin);
  if (!normalized) return false;

  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === 'production';

  const patterns = new Set<string>(
    buildFrameAncestorsList({
      isProduction,
      appUrl: options.appUrl ?? process.env.APP_URL,
      allowedFrameAncestorsEnv:
        options.allowedFrameAncestorsEnv ?? process.env.ALLOWED_FRAME_ANCESTORS,
      strictFrameguard: false,
    })
  );

  if (options.allowedOrigins) {
    for (const orig of options.allowedOrigins) {
      const trimmed = String(orig || '').trim().replace(/\/+$/, '');
      if (trimmed) patterns.add(trimmed);
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    for (const part of process.env.ALLOWED_ORIGINS.split(',')) {
      const trimmed = part.trim().replace(/\/+$/, '');
      if (trimmed) patterns.add(trimmed);
    }
  }

  if (!isProduction) {
    patterns.add('https://*.run.app');
  }

  for (const pattern of patterns) {
    if (matchesWildcardOriginPattern(normalized, pattern)) {
      return true;
    }
  }

  return false;
}

export function isCrossOriginIframeRequest(headers: IncomingHttpHeaders): boolean {
  const fetchDest = readHeaderValue(headers, 'sec-fetch-dest');
  if (fetchDest !== 'iframe') return false;
  const fetchSite = readHeaderValue(headers, 'sec-fetch-site');
  return fetchSite !== 'same-origin';
}

export function shouldRelaxHeadersForEmbeddedPreview(
  headers: IncomingHttpHeaders,
  strictFrameguard = false,
  options: EmbeddedPreviewSecurityOptions = {}
): boolean {
  if (strictFrameguard) return false;

  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === 'production';
  const allowEmbeddedPreview =
    options.allowEmbeddedPreview ??
    process.env.ALLOW_EMBEDDED_PREVIEW === 'true';

  // Standard production mode NEVER relaxes X-Frame-Options or COEP/COOP
  if (isProduction && !allowEmbeddedPreview) {
    return false;
  }

  const rawOrigin = readHeaderValue(headers, 'origin');
  const rawReferer = readHeaderValue(headers, 'referer');
  const candidateOrigin =
    extractOriginFromHeaderUrl(rawOrigin) ||
    extractOriginFromHeaderUrl(rawReferer);

  // If an explicit Origin or Referer is present, it must match the valid origin whitelist
  if (candidateOrigin && !isPreviewOriginWhitelisted(candidateOrigin, options)) {
    return false;
  }

  // In production with ALLOW_EMBEDDED_PREVIEW === 'true', require both an iframe destination
  // and a verified whitelisted Origin/Referer header (never trust bare sec-fetch-dest or x-forwarded-host)
  if (isProduction) {
    const fetchDest = readHeaderValue(headers, 'sec-fetch-dest');
    if (fetchDest !== 'iframe') return false;
    if (!candidateOrigin) return false;
    return isPreviewOriginWhitelisted(candidateOrigin, options);
  }

  // Non-production dev/preview environment
  return true;
}

export function resolveViteAllowedHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = new Set<string>(['localhost', '127.0.0.1', '.localhost', '.run.app']);

  const addHostToken = (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;
    if (trimmed.includes('://')) {
      try {
        hosts.add(new URL(trimmed).hostname);
        return;
      } catch {
        // fall through
      }
    }
    const hostOnly = trimmed.split(':')[0]?.trim();
    if (hostOnly) hosts.add(hostOnly);
  };

  if (env.APP_URL && env.APP_URL !== 'MY_APP_URL') {
    addHostToken(env.APP_URL);
  }
  if (env.NG_ALLOWED_HOSTS) {
    for (const token of env.NG_ALLOWED_HOSTS.split(/[\s,]+/)) {
      addHostToken(token);
    }
  }
  if (env.ALLOWED_ORIGINS) {
    for (const token of env.ALLOWED_ORIGINS.split(/[\s,]+/)) {
      addHostToken(token);
    }
  }

  return Array.from(hosts);
}

