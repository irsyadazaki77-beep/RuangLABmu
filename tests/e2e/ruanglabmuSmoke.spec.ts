import { test, expect, Page } from '@playwright/test';

async function exitLabToLobby(page: Page) {
  await page.getByRole('button', { name: 'Kembali ke Katalog Laboratorium' }).click();
  const exitConfirmModal = page.getByTestId('lab-exit-confirm-modal');
  try {
    await exitConfirmModal.waitFor({ state: 'visible', timeout: 1200 });
    await exitConfirmModal.getByRole('button', { name: 'Keluar ke Lobby' }).click();
  } catch {
    // Modal does not appear if no records or timeline frames were captured yet
  }
  await expect(page.getByTestId('lobby-compact-filter-bar')).toBeVisible();
}

test.describe('RuangLABmu E2E Smoke Suite', () => {
  test('Skenario 1 (Desktop 1366x768): Katalog, Theme Switcher (Terang/Sepia/Gelap) & Pencarian Modul tanpa error', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const fatalConsoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore non-fatal browser asset/websocket noise in headless test runner
        if (
          !text.includes('favicon') &&
          !text.includes('WebSocket') &&
          !text.includes('ERR_CONNECTION')
        ) {
          fatalConsoleErrors.push(text);
        }
      }
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    // Pastikan 2-row Lobby (Compact Filter Bar + Diet Chapter Cards + Quick Start Banner) tampil
    await expect(page.getByTestId('lobby-compact-filter-bar')).toBeVisible();
    await expect(page.getByTestId('quick-start-hero-bar')).toBeVisible();
    await expect(page.getByTestId('diet-chapter-card-1')).toBeVisible();

    // Uji modal detail Bab Kurikulum saat klik "Buka Bab"
    await page.getByTestId('diet-chapter-card-1').getByRole('button', { name: /Buka Bab/i }).click();
    const chapterModal = page.getByTestId('chapter-detail-modal');
    await expect(chapterModal).toBeVisible();
    await expect(chapterModal.getByText(/Capaian Pembelajaran Inti/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(chapterModal).toHaveCount(0);

    // Uji perpindahan tema (Terang / Sepia / Gelap) melalui menu Pengaturan
    const settingsBtn = page.getByTestId('settings-popover-trigger-btn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const settingsMenu = page.getByTestId('settings-popover-menu');
    await expect(settingsMenu).toBeVisible();

    await settingsMenu.getByRole('button', { name: /Terang|Light/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-comfort-theme', 'light');

    await settingsMenu.getByRole('button', { name: /Sepia/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-comfort-theme', 'sepia');

    await settingsMenu.getByRole('button', { name: /Gelap|Dark/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-comfort-theme', 'dark');

    // Tutup popover pengaturan
    await page.keyboard.press('Escape');

    // Uji pencarian modul di Katalog
    const searchInput = page.getByPlaceholder(/Cari modul/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Titrasi');

    await expect(
      page.getByRole('heading', { name: /Titrasi Asam-Basa/i }).first()
    ).toBeVisible();

    // Reset pencarian & buka tampilan Semua Modul untuk memverifikasi Hukum II Newton
    await searchInput.fill('');
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: /Hukum II Newton/i }).first()
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(fatalConsoleErrors).toEqual([]);
  });

  test('Skenario 2 (Lab 3D & Pedagogical UX): Render <canvas> Fisika & Kimia di dalam Spatial HUD + Asisten Sokratik Offline Dr. LabMu (tanpa NaN)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    // 1. Masuk ke 1 modul Fisika
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page
      .getByRole('button', { name: /Mulai →|Mulai Praktikum/i })
      .first()
      .click();

    // Lanjut dari Tahap 1 (Pre-Lab) ke Tahap 2 (Simulasi 3D Full-Bleed Spatial HUD)
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    const cockpit3D = page.getByTestId('main-3d-cockpit');
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('spatial-hud-shell')).toBeVisible();
    await expect(page.getByTestId('spatial-left-drawer')).toBeVisible();
    await expect(page.getByTestId('spatial-telemetry-hud-panel')).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await expect(cockpit3D.locator('canvas').first()).toBeVisible();

    // Uji tombol Focus 3D untuk melipat kedua drawer sekaligus lalu buka kembali
    await page.getByTestId('focus-3d-toggle-btn').click();
    await expect(page.getByTestId('spatial-left-drawer')).toHaveCount(0);
    await expect(page.getByTestId('spatial-telemetry-hud-panel')).toHaveCount(0);
    await page.getByTestId('focus-3d-toggle-btn').click();

    // 2. Kembali ke Katalog & masuk ke 1 modul Kimia
    await exitLabToLobby(page);
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Kimia', exact: true }).click();
    await page
      .getByRole('button', { name: /Mulai →|Mulai Praktikum/i })
      .first()
      .click();

    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await expect(cockpit3D.locator('canvas').first()).toBeVisible();

    // 3. Buka panel Asisten Dr. LabMu & uji simulasi pertanyaan dalam mode offline
    await page.route('**/api/dr-labmu/ask', (route) => route.abort('internetdisconnected'));
    await page.route('**/api/ai/dr-labmu', (route) => route.abort('internetdisconnected'));
    await page.route('**/api/ai/dr-labmu/stream', (route) => route.abort('internetdisconnected'));

    await page.getByRole('button', { name: /Buka Asisten Dr\. LabMu/i }).click();
    const drawerDialog = page.getByRole('dialog', {
      name: /Laci Samping Dr\. LabMu/i,
    });
    await expect(drawerDialog).toBeVisible();

    const mentorTabBtn = drawerDialog.getByRole('button', { name: /Mentor Dr\. LabMu/i });
    if (await mentorTabBtn.isVisible()) {
      await mentorTabBtn.click();
    }

    const queryText = 'Mengapa suhu larutan berubah saat reaksi berlangsung?';
    const chatInput = drawerDialog.getByPlaceholder(/Tanya Dr\. LabMu/i);
    await chatInput.fill(queryText);
    await drawerDialog.getByRole('button', { name: 'Tanya', exact: true }).click();

    // Pastikan pertanyaan dan respons Sokratik lokal muncul tanpa angka NaN
    await expect(drawerDialog.getByText(queryText)).toBeVisible();
    await expect(drawerDialog.getByTestId('offline-mentor-badge')).toBeVisible();

    const drawerContent = await drawerDialog.innerText();
    expect(drawerContent).toMatch(/Pertanyaan Pemantik/i);
    expect(drawerContent).not.toContain('NaN');
  });

  test('Skenario 3 (Mobile Viewport 390x844): Responsivitas tanpa horizontal overflow & kontrol utama dapat diklik', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByTestId('lobby-compact-filter-bar')).toBeVisible();
    await expect(page.getByTestId('diet-chapter-card-1')).toBeVisible();

    // Verifikasi tidak ada horizontal overflow yang merusak layout
    const overflowLobby = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(overflowLobby).toBe(false);

    // Pastikan kontrol utama di mobile dapat diklik
    const settingsBtn = page.getByTestId('settings-popover-trigger-btn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await expect(page.getByTestId('settings-popover-menu')).toBeVisible();
    await page.keyboard.press('Escape');

    // Klik modul pertama di tampilan mobile
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page
      .getByRole('button', { name: /Mulai →|Mulai Praktikum/i })
      .first()
      .click();

    const overflowPreLab = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(overflowPreLab).toBe(false);
  });

  test('Skenario 4 (Multi-User Room PIN Collaboration): Guru membuat Room PIN -> Siswa bergabung -> Guru aktifkan Freeze Mode -> Indikator terkunci muncul di Siswa', async ({
    browser,
  }) => {
    const teacherContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const studentContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });

    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();

    const testRoomId = `LAB-${Math.floor(100 + Math.random() * 899)}`;
    const testPin = '2468';

    try {
      // 0. Autentikasi Guru terlebih dahulu agar ROOM_CREATE lolos proteksi ketat NODE_ENV=production
      const teacherPasscode = process.env.TEACHER_SECRET_PIN || '20262026';
      let authRes = await teacherContext.request.post('/api/auth/bootstrap-teacher', {
        data: { teacherName: 'Guru E2E', passcode: teacherPasscode },
      });
      if (!authRes.ok()) {
        authRes = await teacherContext.request.post('/api/auth/session', {
          data: { role: 'teacher', displayName: 'Guru E2E', passcode: teacherPasscode },
        });
      }
      if (authRes.ok()) {
        const authJson = (await authRes.json()) as { token?: string; session?: unknown };
        if (authJson.token && authJson.session) {
          await teacherContext.addInitScript(
            (payload: { token: string; session: unknown }) => {
              window.sessionStorage.setItem('ruanglab_auth_session_v1', JSON.stringify(payload));
            },
            { token: authJson.token, session: authJson.session }
          );
        }
      }

      await Promise.all([teacherPage.goto('/'), studentPage.goto('/')]);

      // 1. Guru membuka Meja Bersama dan membuat Room PIN
      await teacherPage.getByTestId('navbar-meja-bersama-btn').click();
      await expect(teacherPage.getByTestId('meja-bersama-popover')).toBeVisible();
      await teacherPage.getByTestId('meja-bersama-popover').getByRole('button', { name: '+ Buat Room' }).click();

      const roomIdInputTeacher = teacherPage.getByPlaceholder('Contoh: LAB-ALPHA');
      const pinInputTeacher = teacherPage.getByTestId('room-pin-input');
      await roomIdInputTeacher.fill(testRoomId);
      await pinInputTeacher.fill(testPin);
      await teacherPage.getByRole('button', { name: 'Buka Meja Praktikum' }).click();

      await expect(teacherPage.getByText(new RegExp(`Room: ${testRoomId}`, 'i'))).toBeVisible();

      // 2. Siswa membuka Meja Bersama dan bergabung ke Room ID & PIN yang sama
      await studentPage.getByTestId('navbar-meja-bersama-btn').click();
      await expect(studentPage.getByTestId('meja-bersama-popover')).toBeVisible();
      await studentPage.getByTestId('meja-bersama-popover').getByRole('button', { name: 'Masuk dengan PIN' }).click();

      const roomIdInputStudent = studentPage.getByPlaceholder('Contoh: LAB-ALPHA');
      const pinInputStudent = studentPage.getByTestId('room-pin-input');
      await roomIdInputStudent.fill(testRoomId);
      await pinInputStudent.fill(testPin);
      await studentPage.getByRole('button', { name: 'Siswa Praktikan' }).click();
      await studentPage.getByRole('button', { name: 'Gabung Sekarang' }).click();

      await expect(studentPage.getByText(new RegExp(`Room: ${testRoomId}`, 'i'))).toBeVisible();

      // 3. Guru mengaktifkan Freeze Mode
      await teacherPage
        .getByRole('button', { name: /Kunci Layar Murid/i })
        .click();

      // 4. Verifikasi indikator terkunci muncul secara real-time di layar Siswa
      await expect(
        studentPage.getByText(/KONTROL INTERAKTIF DIKUNCI GURU/i)
      ).toBeVisible();
    } finally {
      await teacherContext.close();
      await studentContext.close();
    }
  });

  test('Skenario 5 (Fase 4 WebGL 3D & Lite 3T): Switch Fisika/Kimia/Biologi, Alat Ukur 3D, Snap-to-Port & Toggle Lite 3T tanpa error WebGL', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    // 1. Fisika: masuk simulasi -> uji Alat Ukur 3D (Mistar & Busur) + Snap-to-Port + drag canvas
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    const cockpit3D = page.getByTestId('main-3d-cockpit');
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);

    await page.getByTestId('toggle-3d-measure-btn').click();
    await expect(page.getByText(/Mistar:/i)).toBeVisible();
    await expect(page.getByText(/Busur:/i)).toBeVisible();
    await cockpit3D.getByTestId('snap-dock-apparatus-btn').first().click();

    // Drag sedikit pada kanvas 3D Fisika
    const physCanvas = page.getByTestId('physics-simulation-canvas');
    const physBox = await physCanvas.boundingBox();
    if (physBox) {
      await page.mouse.move(physBox.x + physBox.width * 0.5, physBox.y + physBox.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(physBox.x + physBox.width * 0.55, physBox.y + physBox.height * 0.45);
      await page.mouse.up();
    }

    // 2. Toggle Mode Hemat Daya 3T (Lite Mode) langsung dari Floating Top Bar HUD
    const hudLiteBtn = page.getByTestId('hud-lite-mode-toggle-btn');
    await expect(hudLiteBtn).toBeVisible();
    await hudLiteBtn.click();
    await expect(hudLiteBtn).toContainText(/lite/i);

    // 3. Pindah ke Kimia dalam Lite 3T Mode -> uji Probe Digital 3D & Snap-to-Port
    await exitLabToLobby(page);
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Kimia', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await page.getByTestId('toggle-3d-probe-btn').click();
    await expect(page.getByText(/Sensor Probe 3D:/i)).toBeVisible();
    await cockpit3D.getByTestId('snap-dock-apparatus-btn').first().click();

    // 4. Pindah ke Biologi -> uji Mistar 3D & kanvas tanpa error WebGL
    await exitLabToLobby(page);
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Biologi', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await expect(cockpit3D.locator('canvas').first()).toBeVisible();
    const bioRulerBtn = page.getByTestId('toggle-3d-ruler-btn');
    if (await bioRulerBtn.isVisible()) {
      await bioRulerBtn.click();
      await expect(page.getByText(/Mistar 3D:/i)).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
  });

  test('Skenario 6 (Adaptive Quality, Mode Ringan 2D & Astronomi 3D + Kamera Preset): Toggle kualitas, Mode 2D fallback, dan preset kamera tanpa error', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    // 1. Masuk ke domain Astronomi -> buka simulasi 3D
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Astronomi', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    const cockpit3D = page.getByTestId('main-3d-cockpit');
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await expect(page.getByTestId('astronomy-simulation-canvas')).toBeVisible();

    // 2. Uji tombol Reset & preset kamera (Depan / Atas / Fokus)
    await page.getByTestId('camera-reset-btn').click();
    await page.getByRole('button', { name: 'Depan', exact: true }).click();
    await page.getByRole('button', { name: 'Atas', exact: true }).click();
    await page.getByRole('button', { name: 'Fokus', exact: true }).click();
    await page.getByTestId('camera-reset-btn').click();

    // 3. Uji selector kualitas grafis 3D (3t-saver -> high -> auto)
    const qualitySelect = page.getByTestId('hud-quality-mode-select');
    await expect(qualitySelect).toBeVisible();
    await qualitySelect.selectOption('3t-saver');
    await expect(page.getByTestId('hud-lite-mode-toggle-btn')).toContainText(/lite/i);
    await qualitySelect.selectOption('high');
    await qualitySelect.selectOption('auto');

    // 4. Uji Mode Ringan 2D (Fallback SVG/RingBuffer) lalu kembali ke 3D
    const toggle2DBtn = page.getByTestId('hud-2d-fallback-toggle-btn');
    await expect(toggle2DBtn).toBeVisible();
    await toggle2DBtn.click();

    await expect(page.getByTestId('lab-2d-fallback-view')).toBeVisible();
    await expect(page.getByLabel('Skema Simulasi 2D')).toBeVisible();
    await expect(page.getByLabel('Grafik Kurva Telemetri 2D')).toBeVisible();

    await page.getByTestId('restore-3d-from-2d-btn').click();
    await expect(page.getByTestId('lab-2d-fallback-view')).toHaveCount(0);
    await expect(page.getByTestId('astronomy-simulation-canvas')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('Skenario 7 (A11y Keyboard Navigation & Reactive Outbox Sync Indicator): Tab/Arrow/Escape, Reset View aria-label & badge sync status', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    // 1. Verifikasi indikator konektivitas & status sinkronisasi Outbox 3T di header
    const connectivityBadge = page.getByTestId('tri-state-connectivity-badge');
    await expect(connectivityBadge).toBeVisible();
    await expect(page.getByTestId('outbox-sync-status-label')).toHaveText(/Tersinkronisasi|Offline/i);

    // 2. Masuk ke modul Fisika -> buka modal K3/Pra-Lab & uji penutupan via keyboard Escape
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();

    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();
    await expect(page.getByTestId('main-3d-cockpit')).toBeVisible();

    // 3. Verifikasi HUD 3T Sync pill & Reset View Camera button dengan aria-label yang eksplisit
    await expect(page.getByTestId('hud-3t-connection-pill')).toBeVisible();
    const resetCameraBtn = page.getByRole('button', { name: 'Reset View Kamera 3D' });
    await expect(resetCameraBtn).toBeVisible();
    await resetCameraBtn.focus();
    await expect(resetCameraBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // 4. Uji navigasi keyboard pada PrecisionSlider (<input type="range">) dengan ArrowRight
    const firstRangeSlider = page.getByTestId('spatial-left-drawer').locator('input[type="range"]').first();
    await expect(firstRangeSlider).toBeVisible();
    const initialVal = Number(await firstRangeSlider.inputValue());
    await firstRangeSlider.focus();
    await expect(firstRangeSlider).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const updatedVal = Number(await firstRangeSlider.inputValue());
    expect(updatedVal).not.toBe(initialVal);

    // 5. Buka laci Dr. LabMu lalu tutup menggunakan Escape
    await page.getByRole('button', { name: /Buka Asisten Dr\. LabMu/i }).click();
    const drLabMuDialog = page.getByRole('dialog', { name: /Laci Samping Dr\. LabMu/i });
    await expect(drLabMuDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drLabMuDialog).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test('Skenario 8 (Sepia Theme Cohesion, Lazy Modals, Clean Notation & Stage 3 Module Dataset Filtering)', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByTestId('lobby-compact-filter-bar')).toBeVisible();

    // 1. Switch theme ke Sepia dan verifikasi modal lazy (ChapterDetail & RoomCollab) + Escape
    await page.getByTestId('settings-popover-trigger-btn').click();
    await page.getByTestId('settings-popover-menu').getByRole('button', { name: /Sepia/i }).click();
    await page.keyboard.press('Escape');

    const activeTheme = await page.locator('html').getAttribute('data-comfort-theme');
    expect(activeTheme).toBe('sepia');

    await page.getByTestId('diet-chapter-card-1').getByRole('button').first().click();
    await expect(page.getByTestId('chapter-detail-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chapter-detail-modal')).toHaveCount(0);

    await page.getByTestId('navbar-meja-bersama-btn').click();
    await page.getByTestId('meja-bersama-popover').getByRole('button', { name: '+ Buat Room' }).click();
    await expect(page.getByPlaceholder('Contoh: LAB-ALPHA')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder('Contoh: LAB-ALPHA')).toHaveCount(0);

    // 2. Buka modul Fisika Stage 1 -> pastikan tidak ada kebocoran LaTeX mentah / notasi underscore teknis
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();

    const preLabText = await page.locator('main').innerText();
    expect(preLabText).not.toMatch(/\\frac|\\sqrt|\\sum|\\in\b|10\^[0-9-]/);
    expect(preLabText).not.toMatch(/\b[A-Za-z]+_[A-Za-z0-9]+\b/);

    // 3. Stage 2 -> pastikan LiveFormulaCard menampilkan output terhitung real-time
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).first().click();
    await expect(page.getByTestId('main-3d-cockpit')).toBeVisible();
    await expect(page.getByTestId('live-formula-derived-outputs')).toBeVisible();

    // Catat data uji modul aktif dengan variasi parameter agar regresi Stage 3 otomatis memilih dataset module-records
    const autoSweepBtn = page.getByRole('button', { name: /Auto-Sweep/i }).first();
    if (await autoSweepBtn.isVisible()) {
      await autoSweepBtn.click();
      await page.waitForTimeout(400);
      if (await page.locator('[role="dialog"]').count()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
      }
    } else {
      for (let i = 0; i < 2; i += 1) {
        if (i === 1) {
          const sliders = page.getByTestId('spatial-left-drawer').locator('input[type="range"]');
          const cnt = await sliders.count();
          for (let s = 0; s < cnt; s += 1) {
            await sliders.nth(s).press('ArrowRight');
          }
        }
        await page.getByRole('button', { name: /\+ Catat Data/i }).first().click();
        await page.waitForTimeout(250);
        if (await page.locator('[role="dialog"]').count()) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(150);
          if (await page.locator('[role="dialog"]').count()) {
            await page.locator('[role="dialog"] button').first().click();
          }
        }
      }
    }

    // 4. Stage 3 -> dataset selector default ke module-records & bebas latar rgb(255, 255, 255) di tema Sepia
    await page.getByRole('button', { name: /Grafik & LKS/i }).first().click();
    const datasetSelect = page.locator('#analytics-dataset-select');
    await expect(datasetSelect).toBeVisible();
    await expect(datasetSelect).toHaveValue('module-records');

    const whiteCountStage3 = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return 0;
      return Array.from(main.querySelectorAll('div, section, table, select, input')).filter(
        (el) =>
          getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)' &&
          el.getBoundingClientRect().height > 20
      ).length;
    });
    expect(whiteCountStage3).toBe(0);

    // 5. Stage 4 -> bebas latar putih polos di tema Sepia
    await page.getByRole('button', { name: /Tahap 4: Kolaborasi & Ekspor|Laporan & Tugas Kelompok/i }).first().click();
    await expect(page.locator('#analytics-dataset-select')).toHaveCount(0);
    const whiteCountStage4 = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return 0;
      return Array.from(main.querySelectorAll('div, section, textarea, input')).filter(
        (el) =>
          getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)' &&
          el.getBoundingClientRect().height > 20
      ).length;
    });
    expect(whiteCountStage4).toBe(0);

    expect(pageErrors).toEqual([]);
  });

  test('Skenario 9 (Tablet 1024x768 HUD Non-Overlap & Mobile 390x844 Stage 2 Viewport Safety)', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Semua Modul', exact: true }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page.getByRole('button', { name: /Mulai →|Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).first().click();
    await expect(page.getByTestId('main-3d-cockpit')).toBeVisible();
    await page.waitForTimeout(600);

    // 1. Verifikasi toolbar 3D HUD & concept labels tidak bertumpukan dengan panel samping di 1024x768
    const tabletAudit = await page.evaluate(() => {
      const left = document.querySelector('[data-testid="spatial-left-drawer"]')?.getBoundingClientRect();
      const right = document.querySelector('[data-testid="spatial-telemetry-hud-panel"]')?.getBoundingClientRect();
      const camToolbar = document
        .querySelector('[data-testid="camera-reset-btn"]')
        ?.closest('div.pointer-events-auto.absolute')
        ?.getBoundingClientRect();

      const toolbarOverlapsLeft = Boolean(
        camToolbar && left && camToolbar.left < left.right - 1 && camToolbar.bottom > left.top
      );
      const toolbarOverlapsRight = Boolean(
        camToolbar && right && camToolbar.right > right.left + 1 && camToolbar.bottom > right.top
      );

      const pills = Array.from(document.querySelectorAll('[data-concept-label-id]'))
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => el.firstElementChild?.getBoundingClientRect())
        .filter((r): r is DOMRect => Boolean(r));

      let pillCollision = false;
      for (let i = 0; i < pills.length; i += 1) {
        for (let j = i + 1; j < pills.length; j += 1) {
          const a = pills[i];
          const b = pills[j];
          const overlapX = a.left < b.right && a.right > b.left;
          const overlapY = a.top < b.bottom && a.bottom > b.top;
          if (overlapX && overlapY) pillCollision = true;
        }
      }

      const pillTouchesDrawer = pills.some(
        (p) => (left && p.left < left.right) || (right && p.right > right.left)
      );

      return { toolbarOverlapsLeft, toolbarOverlapsRight, pillCollision, pillTouchesDrawer };
    });

    expect(tabletAudit.toolbarOverlapsLeft).toBe(false);
    expect(tabletAudit.toolbarOverlapsRight).toBe(false);
    expect(tabletAudit.pillCollision).toBe(false);
    expect(tabletAudit.pillTouchesDrawer).toBe(false);

    // 2. Uji Stage 2 pada viewport mobile 390x844 bebas horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(mobileOverflow).toBe(false);

    expect(pageErrors).toEqual([]);
  });
});


