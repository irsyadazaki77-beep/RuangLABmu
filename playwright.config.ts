import { chromium, defineConfig, devices } from '@playwright/test';
import fs from 'fs';

const PREINSTALLED_HEADLESS_SHELL =
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';

const WINDOWS_CHROME_FALLBACK =
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WINDOWS_EDGE_FALLBACK =
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function resolveExecutablePath(): string | undefined {
  if (fs.existsSync(PREINSTALLED_HEADLESS_SHELL)) {
    return PREINSTALLED_HEADLESS_SHELL;
  }
  try {
    const defaultBin = chromium.executablePath();
    if (defaultBin && fs.existsSync(defaultBin)) {
      return undefined;
    }
  } catch {
    // Fall through to system browser checks
  }
  if (fs.existsSync(WINDOWS_CHROME_FALLBACK)) return WINDOWS_CHROME_FALLBACK;
  if (fs.existsSync(WINDOWS_EDGE_FALLBACK)) return WINDOWS_EDGE_FALLBACK;
  return undefined;
}

const customExecutablePath = resolveExecutablePath();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: {
      ...(customExecutablePath ? { executablePath: customExecutablePath } : {}),
      args: [
        ...(process.env.CI === 'true'
          ? ['--no-sandbox', '--disable-setuid-sandbox']
          : []),
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'bun run start'
      : process.platform === 'win32'
      ? 'npm run dev'
      : 'bun run dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      PORT: '3000',
      APP_URL: 'http://localhost:3000',
      ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
    },
  },
});
