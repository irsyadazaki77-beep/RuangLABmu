import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import QRCode from 'qrcode';
import type { WebSocketServer } from 'ws';
import { createLabServerState, type LabServerState } from './server/state/labServerState';
import {
  detectLanIps,
  listenWithPortFallback,
  openBrowserUrl,
} from './server/utils/lanNetwork';
import { createCollabSocketServer } from './server/ws/collabSocketServer';
import { attachSessionMiddleware } from './server/auth/sessionToken';
import { createAuthRouter } from './server/routes/authRoutes';
import { createAdminRouter } from './server/routes/adminRoutes';
import { createLabRouter } from './server/routes/labRoutes';
import { createSubmissionRouter } from './server/routes/submissionRoutes';
import { createAiRouter } from './server/routes/aiRoutes';
import { createHealthRouter } from './server/routes/healthRoutes';
import {
  buildContentSecurityPolicyDirectives,
  buildFrameAncestorsList,
  shouldRelaxHeadersForEmbeddedPreview,
} from './server/utils/securityHeaders';
import {
  rateLimitKeyGenerator,
  resolveTrustProxySetting,
} from './server/utils/rateLimitKey';
import { logger, requestCorrelationMiddleware } from './server/utils/logger';

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

  logger.info('RuangLABmu server listening', {
    localUrl,
    lanUrl: lanInfo.lanUrl,
    port: activePort,
  });
  process.stdout.write(`  ➜  Local:   ${localUrl}/\n`);

  if (isPortableBinary || process.env.RUANGLAB_PRINT_QR === '1') {
    const lines: string[] = [
      '\n====================================================================',
      '  RUANGLABMU PORTABLE 3T — SERVER LABORATORIUM LOKAL AKTIF',
      '====================================================================',
      `  Laptop Guru (Lokal)   : ${localUrl}`,
      `  HP/Tablet Siswa (LAN) : ${lanInfo.lanUrl}`,
    ];
    if (lanInfo.allLanIps.length > 1) {
      lines.push(
        `  Semua IP Hotspot LAN  : ${lanInfo.allLanIps
          .map((ip) => `http://${ip}:${activePort}`)
          .join(', ')}`
      );
    }
    lines.push(`  ${lanInfo.tip3T}`);
    try {
      const qrAscii = await QRCode.toString(lanInfo.lanUrl, {
        type: 'terminal',
        small: true,
      });
      lines.push('\n  [Pindai QR Code di bawah ini menggunakan Kamera HP Siswa]:\n');
      lines.push(qrAscii);
    } catch {
      // Fallback if terminal QR generation fails
    }
    lines.push('====================================================================\n');
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  if (
    (isPortableBinary || process.env.AUTO_OPEN_BROWSER === 'true') &&
    process.env.CI !== 'true' &&
    process.env.NO_OPEN_BROWSER !== '1'
  ) {
    openBrowserUrl(localUrl);
  }
}

export function resolvePreferredPort(
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): number {
  const portArgIndex = argv.indexOf('--port');
  if (portArgIndex !== -1 && argv[portArgIndex + 1]) {
    const cliPort = Number(argv[portArgIndex + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  if (env.npm_config_port) {
    const npmPort = Number(env.npm_config_port);
    if (Number.isFinite(npmPort) && npmPort > 0) {
      return npmPort;
    }
  }
  if (env.DEFAULT_APP_PORT && env.NGINX_PORT && env.PORT === env.NGINX_PORT) {
    const defaultAppPort = Number(env.DEFAULT_APP_PORT);
    if (Number.isFinite(defaultAppPort) && defaultAppPort > 0) {
      return defaultAppPort;
    }
  }
  return Number(env.PORT) || 3000;
}

export function createGracefulShutdownHandler(deps: {
  server: http.Server;
  wss: WebSocketServer;
  state: LabServerState;
  setShuttingDown?: (shuttingDown: boolean) => void;
  exitFn?: (code: number) => void;
}): (signal: string) => Promise<void> {
  const { server, wss, state, setShuttingDown, exitFn = (code) => process.exit(code) } = deps;
  let inFlightPromise: Promise<void> | null = null;

  return (signal: string) => {
    if (inFlightPromise) {
      return inFlightPromise;
    }

    setShuttingDown?.(true);
    logger.info('Graceful shutdown initiated', { signal });

    inFlightPromise = new Promise<void>((resolve) => {
      const forceExitTimer = setTimeout(() => {
        logger.warn('Forced shutdown timeout reached; flushing SQLite WAL before exit', {
          signal,
        });
        state.database.checkpointWalTruncate();
        state.dispose();
        exitFn(0);
        resolve();
      }, 5000);
      forceExitTimer.unref?.();

      // 1. Close active WebSocket clients cleanly with close code 1001 (Going Away)
      let openClientsCount = 0;
      for (const client of wss.clients) {
        if (client.readyState === 1 || client.readyState === 0) {
          openClientsCount += 1;
          try {
            client.close(1001, 'Server shutting down');
          } catch {
            // Ignore close error on disconnecting socket
          }
        }
      }

      const finalize = () => {
        clearTimeout(forceExitTimer);
        state.database.checkpointWalTruncate();
        state.dispose();
        logger.info('Graceful shutdown completed cleanly', {
          signal,
          closedWsClients: openClientsCount,
        });
        exitFn(0);
        resolve();
      };

      try {
        wss.close(() => {
          server.close(() => {
            finalize();
          });
        });
      } catch {
        finalize();
      }
    });

    return inFlightPromise;
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', resolveTrustProxySetting());
  const preferredPort = resolvePreferredPort();
  let activePort = preferredPort;
  let shuttingDown = false;
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = parseAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    process.env.APP_URL
  );

  app.use(requestCorrelationMiddleware);

  const strictFrameguard = process.env.STRICT_FRAMEGUARD === 'true';
  const allowEmbeddedPreview = process.env.ALLOW_EMBEDDED_PREVIEW === 'true';
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
        directives: buildContentSecurityPolicyDirectives({
          isProduction,
          frameAncestors,
        }),
      },
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Allow trusted cross-origin preview iframes ONLY in non-production or when ALLOW_EMBEDDED_PREVIEW === 'true'
  // and verified against the origin whitelist; standard production strictly enforces COOP: same-origin & COEP: require-corp.
  app.use((req, res, next) => {
    if (
      shouldRelaxHeadersForEmbeddedPreview(req.headers, strictFrameguard, {
        isProduction,
        allowEmbeddedPreview,
        allowedOrigins,
        appUrl: process.env.APP_URL,
        allowedFrameAncestorsEnv: process.env.ALLOWED_FRAME_ANCESTORS,
      })
    ) {
      res.removeHeader('X-Frame-Options');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Session-Token');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const state = createLabServerState();
  await state.hydrateServerState();
  state.backupService.startScheduler();

  const server = http.createServer(app);
  const {
    wss,
    broadcastAll,
    broadcastRoom,
    broadcastSchool,
    broadcastSchoolTeachers,
    getBackpressureStats,
  } = createCollabSocketServer(server, state, {
    isOriginAllowed: (origin) =>
      isOriginAllowed(origin, allowedOrigins, isProduction, isPortableBinary),
  });

  // SRE Probes (/healthz, /readyz, /metrics) registered BEFORE rate limiters & SPA static fallback
  app.use(
    createHealthRouter({
      state,
      wss,
      getBackpressureStats,
      isShuttingDown: () => shuttingDown,
    })
  );

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

  // Attach verified HMAC session claims (if Authorization: Bearer <token> is provided)
  app.use('/api', attachSessionMiddleware);

  app.use(createAuthRouter({ state }));
  app.use(createAdminRouter({ state }));
  app.use(createLabRouter({ state, getPort: () => activePort }));
  app.use(
    await createSubmissionRouter({
      rootDir: ROOT_DIR,
      state,
      broadcastAll,
      broadcastSchool,
      broadcastSchoolTeachers,
    })
  );
  app.use(createAiRouter({ state, broadcastAll, broadcastRoom }));

  // Return structured JSON 404 for unknown /api/* routes instead of falling through to SPA index.html
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      code: 'API_ENDPOINT_NOT_FOUND',
      message: `Endpoint API tidak ditemukan: ${req.method} ${req.originalUrl}`,
      requestId: res.locals?.requestId,
    });
  });

  // Global Express API error handler (structured JSON + request correlation ID)
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const code =
        typeof (err as { code?: unknown })?.code === 'string'
          ? (err as { code: string }).code
          : status >= 500
          ? 'INTERNAL_SERVER_ERROR'
          : 'REQUEST_ERROR';
      logger.error('Unhandled Express API error', {
        requestId: res.locals?.requestId,
        method: req.method,
        path: req.path,
        status,
        error: err,
      });
      res.status(status).json({
        error: code,
        code,
        message:
          status >= 500
            ? 'Terjadi kesalahan internal pada server RuangLABmu.'
            : err instanceof Error
            ? err.message
            : 'Permintaan tidak dapat diproses.',
        requestId: res.locals?.requestId,
      });
    }
  );

  const shutdownHandler = createGracefulShutdownHandler({
    server,
    wss,
    state,
    setShuttingDown: (val) => {
      shuttingDown = val;
    },
  });

  process.once('SIGINT', () => {
    void shutdownHandler('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdownHandler('SIGTERM');
  });

  const useStaticDist =
    process.env.NODE_ENV === 'production' || isPortableBinary;

  if (!useStaticDist) {
    let viteMiddlewares: express.RequestHandler | null = null;
    const viteReadyPromise = (async () => {
      const viteModuleId = 'vite';
      const { createServer: createViteServer } = await import(viteModuleId);
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          ...(process.env.DISABLE_HMR === 'true'
            ? { hmr: false, ws: false }
            : { ws: { server } }),
        },
        appType: 'spa',
      });
      viteMiddlewares = vite.middlewares;
    })();

    app.use(async (req, res, next) => {
      try {
        if (!viteMiddlewares) {
          await viteReadyPromise;
        }
        if (viteMiddlewares) {
          viteMiddlewares(req, res, next);
          return;
        }
        next();
      } catch (err) {
        next(err);
      }
    });

    try {
      activePort = await listenWithPortFallback(server, preferredPort, '0.0.0.0');
      await viteReadyPromise;
      await printStartupDiagnostics(activePort);
    } catch (err) {
      logger.error('Failed to start RuangLABmu development server', { error: err });
      process.exit(1);
    }
  } else {
    const distDir = resolveDistDirectory();
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });

    try {
      activePort = await listenWithPortFallback(server, preferredPort, '0.0.0.0');
      await printStartupDiagnostics(activePort);
    } catch (err) {
      logger.error('Failed to start RuangLABmu production server', { error: err });
      process.exit(1);
    }
  }
}

const isTestRunner =
  process.execArgv.includes('--test') ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  Boolean(process.argv[1] && /\.test\.[cm]?[jt]sx?$/.test(process.argv[1]));

if (!isTestRunner) {
  startServer();
}
