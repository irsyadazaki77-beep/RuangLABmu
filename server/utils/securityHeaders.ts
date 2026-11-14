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
  'https://*.googleusercontent.com',
  'https://*.usercontent.goog',
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

export function isCrossOriginIframeRequest(headers: IncomingHttpHeaders): boolean {
  const fetchDest = readHeaderValue(headers, 'sec-fetch-dest');
  if (fetchDest !== 'iframe') return false;
  const fetchSite = readHeaderValue(headers, 'sec-fetch-site');
  return fetchSite !== 'same-origin';
}

export function shouldRelaxHeadersForEmbeddedPreview(
  headers: IncomingHttpHeaders,
  strictFrameguard = false
): boolean {
  if (strictFrameguard) return false;
  return isCrossOriginIframeRequest(headers);
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
