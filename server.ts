import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import helmet from 'helmet';
import { createLabServerState } from './server/state/labServerState';
import { detectLanIps, listenWithPortFallback } from './server/utils/lanNetwork';
import { createCollabSocketServer } from './server/ws/collabSocketServer';
import { createLabRouter } from './server/routes/labRoutes';
import { createSubmissionRouter } from './server/routes/submissionRoutes';
import { createAiRouter } from './server/routes/aiRoutes';

const ROOT_DIR = process.cwd();

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT) || 3000;
  let activePort = preferredPort;

  // Security headers + Cross-Origin Isolation required for SharedArrayBuffer in SimulationRingBuffer
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Lightweight CORS middleware for local LAN devices & mobile browsers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  const state = createLabServerState();
  await state.hydrateServerState();

  const server = http.createServer(app);
  const { broadcastAll } = createCollabSocketServer(server, state);

  app.use(createLabRouter({ state, getPort: () => activePort }));
  app.use(await createSubmissionRouter({ rootDir: ROOT_DIR, state, broadcastAll }));
  app.use(createAiRouter({ state, broadcastAll }));

  if (process.env.NODE_ENV !== 'production') {
    const viteModuleId = 'vite';
    const { createServer: createViteServer } = await import(viteModuleId);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = fs.existsSync(path.join(ROOT_DIR, 'dist'))
      ? path.join(ROOT_DIR, 'dist')
      : path.resolve(ROOT_DIR, '..', 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  try {
    activePort = await listenWithPortFallback(server, preferredPort, '0.0.0.0');
    const lanInfo = detectLanIps(os.networkInterfaces(), activePort);
    console.log(`RuangLABmu server listening on http://localhost:${activePort}`);
    console.log(`[LAN 3T] Siswa di Wi-Fi lokal dapat membuka: ${lanInfo.lanUrl}`);
  } catch (err) {
    console.error(
      `[RuangLABmu ERROR] Gagal menjalankan server:`,
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

startServer();
