import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import QRCode from 'qrcode';
import { createLabServerState } from './server/state/labServerState';
import {
  detectLanIps,
  listenWithPortFallback,
  openBrowserUrl,
} from './server/utils/lanNetwork';
import { createCollabSocketServer } from './server/ws/collabSocketServer';
import { createLabRouter } from './server/routes/labRoutes';
import { createSubmissionRouter } from './server/routes/submissionRoutes';
import { createAiRouter } from './server/routes/aiRoutes';
import {
  buildFrameAncestorsList,
  shouldRelaxHeadersForEmbeddedPreview,
} from './server/utils/securityHeaders';
import {
  rateLimitKeyGenerator,
  resolveTrustProxySetting,
} from './server/utils/rateLimitKey';

const isPortableBinary =
  process.env.RUANGLAB_PORTABLE === '1' ||
  (!fs.existsSync(path.join(process.cwd(), 'src', 'main.tsx')) &&
    fs.existsSync(path.join(path.dirname(process.execPath), 'dist', 'index.html')));

const ROOT_DIR = isPortableBinary
  ? path.dirname(process.execPath)
  : process.cwd();

const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/i;

export function parseAllowedOrigins(rawEnv?: string, appUrl?: string): Set<string> {
  const origins = new Set<string>();
  if (rawEnv) {
    for (const part of rawEnv.split(',')) {
      const trimmed = part.trim().replace(/\/+$/, '');
      if (trimmed) origins.add(trimmed);
    }
  }
  if (appUrl && appUrl.trim() && appUrl.trim() !== 'MY_APP_URL') {
    try {
      const parsed = new URL(appUrl.trim());
      origins.add(parsed.origin);
    } catch {
      // ignore invalid APP_URL
    }
  }
  return origins;
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>,
  isProduction: boolean,
  isPortable = false
): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.has(normalized)) return true;
  if (!isProduction || isPortable) {
    return DEV_ORIGIN_PATTERN.test(normalized);
  }
  return false;
}

export const JSON_BODY_LIMITS = {
  standard: '1mb',
  visionUpload: '20mb',
} as const;

export function selectJsonBodyLimit(requestPath: string): '1mb' | '20mb' {
  const cleanPath = String(requestPath || '').trim();
  if (cleanPath === '/api/ai/vision-diagnose') {
    return JSON_BODY_LIMITS.visionUpload;
  }
  return JSON_BODY_LIMITS.standard;
}

function resolveDistDirectory(): string {
  const candidates = [
    path.join(path.dirname(process.execPath), 'dist'),
    path.join(ROOT_DIR, 'dist'),
    path.join(process.cwd(), 'dist'),
    path.resolve(ROOT_DIR, '..', 'dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return fs.existsSync(path.join(ROOT_DIR, 'dist'))
    ? path.join(ROOT_DIR, 'dist')
    : path.resolve(ROOT_DIR, '..', 'dist');
}

async function printStartupDiagnostics(activePort: number) {
  const lanInfo = detectLanIps(os.networkInterfaces(), activePort);
  const localUrl = `http://localhost:${activePort}`;

  console.log(`RuangLABmu server listening on ${localUrl}`);
  console.log(`[LAN 3T] Siswa di Wi-Fi lokal dapat membuka: ${lanInfo.lanUrl}`);

  if (isPortableBinary || process.env.RUANGLAB_PRINT_QR === '1') {
    console.log('\n====================================================================');
    console.log('  🔬 RUANGLABMU PORTABLE 3T — SERVER LABORATORIUM LOKAL AKTIF');
    console.log('====================================================================');
    console.log(`  💻 Laptop Guru (Lokal)   : ${localUrl}`);
    console.log(`  📱 HP/Tablet Siswa (LAN) : ${lanInfo.lanUrl}`);
    if (lanInfo.allLanIps.length > 1) {
      console.log(
        `  🌐 Semua IP Hotspot LAN  : ${lanInfo.allLanIps
          .map((ip) => `http://${ip}:${activePort}`)
          .join(', ')}`
      );
    }
    console.log(`  💡 ${lanInfo.tip3T}`);
    try {
      const qrAscii = await QRCode.toString(lanInfo.lanUrl, {
        type: 'terminal',
        small: true,
      });
      console.log('\n  [Pindai QR Code di bawah ini menggunakan Kamera HP Siswa]:\n');
      console.log(qrAscii);
    } catch {
      // Fallback if terminal QR generation fails
    }
    console.log('====================================================================\n');
  }

  if (
    (isPortableBinary || process.env.AUTO_OPEN_BROWSER === 'true') &&
    process.env.CI !== 'true' &&
    process.env.NO_OPEN_BROWSER !== '1'
  ) {
    openBrowserUrl(localUrl);
  }
}

function resolvePreferredPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const cliPort = Number(process.argv[portArgIndex + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  return Number(process.env.PORT) || 3000;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', resolveTrustProxySetting());
  const preferredPort = resolvePreferredPort();
  let activePort = preferredPort;
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = parseAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    process.env.APP_URL
  );

  const strictFrameguard = process.env.STRICT_FRAMEGUARD === 'true';
  const frameAncestors = buildFrameAncestorsList({
    isProduction,
    appUrl: process.env.APP_URL,
    allowedFrameAncestorsEnv: process.env.ALLOWED_FRAME_ANCESTORS,
    strictFrameguard,
  });

  // Security headers + Cross-Origin Isolation required for SharedArrayBuffer in SimulationRingBuffer
  app.use(
    helmet({
      frameguard: { action: 'sameorigin' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProduction
            ? ["'self'", 'blob:']
            : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:'],
          scriptSrcAttr: ["'none'"],
          workerSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          frameAncestors,
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Allow trusted cross-origin preview iframes (e.g. AI Studio) governed by CSP frame-ancestors
  // while keeping X-Frame-Options: SAMEORIGIN and COEP: require-corp on top-level/standalone requests.
  app.use((req, res, next) => {
    if (shouldRelaxHeadersForEmbeddedPreview(req.headers, strictFrameguard)) {
      res.removeHeader('X-Frame-Options');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    }
    next();
  });

  // Whitelist-enforced CORS middleware (localhost/LAN fallback only in non-production or portable mode)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');

    if (origin) {
      if (!isOriginAllowed(origin, allowedOrigins, isProduction, isPortableBinary)) {
        if (req.method === 'OPTIONS') {
          res.status(403).json({ error: 'Origin tidak diizinkan oleh kebijakan CORS.' });
          return;
        }
        next();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Global /api/* rate limit + stricter /api/ai/* rate limit
  const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    message: {
      error:
        'Terlalu banyak permintaan API dari perangkat Anda. Silakan tunggu sebentar sebelum mencoba lagi.',
    },
  });

  const aiRoutesLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKeyGenerator,
    message: {
      error:
        'Batas kuota permintaan AI Dr. LabMu tercapai (maksimal 20 permintaan/menit). Silakan tunggu sebentar.',
    },
  });

  app.use('/api', globalApiLimiter);
  app.use('/api/ai', aiRoutesLimiter);
  app.use('/api/assistant', aiRoutesLimiter);
  app.use('/api/generate-mission', aiRoutesLimiter);
  app.use('/api/dr-labmu', aiRoutesLimiter);

  // Safe default 1MB body limit; permit 20MB strictly on AI/Vision or image upload endpoints
  const standardJsonParser = express.json({ limit: JSON_BODY_LIMITS.standard });
  const largeVisionJsonParser = express.json({ limit: JSON_BODY_LIMITS.visionUpload });
  app.use((req, res, next) => {
    if (selectJsonBodyLimit(req.path) === JSON_BODY_LIMITS.visionUpload) {
      largeVisionJsonParser(req, res, next);
      return;
    }
    standardJsonParser(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMITS.standard }));

  const state = createLabServerState();
  await state.hydrateServerState();

  const server = http.createServer(app);
  const { broadcastAll, broadcastRoom } = createCollabSocketServer(server, state);

  app.use(createLabRouter({ state, getPort: () => activePort }));
  app.use(await createSubmissionRouter({ rootDir: ROOT_DIR, state, broadcastAll }));
  app.use(createAiRouter({ state, broadcastAll, broadcastRoom }));

  const useStaticDist =
    process.env.NODE_ENV === 'production' || isPortableBinary;

  if (!useStaticDist) {
    const viteModuleId = 'vite';
    const { createServer: createViteServer } = await import(viteModuleId);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = resolveDistDirectory();
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  try {
    activePort = await listenWithPortFallback(server, preferredPort, '0.0.0.0');
    await printStartupDiagnostics(activePort);
  } catch (err) {
    console.error(
      `[RuangLABmu ERROR] Gagal menjalankan server:`,
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

const isTestRunner =
  process.execArgv.includes('--test') ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  Boolean(process.argv[1] && /\.test\.[cm]?[jt]sx?$/.test(process.argv[1]));

if (!isTestRunner) {
  startServer();
}

