import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import helmet from 'helmet';
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

const isPortableBinary =
  process.env.RUANGLAB_PORTABLE === '1' ||
  (!fs.existsSync(path.join(process.cwd(), 'src', 'main.tsx')) &&
    fs.existsSync(path.join(path.dirname(process.execPath), 'dist', 'index.html')));

const ROOT_DIR = isPortableBinary
  ? path.dirname(process.execPath)
  : process.cwd();

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

startServer();
