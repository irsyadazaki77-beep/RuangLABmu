import { test, expect } from '@playwright/test';

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

    // Pastikan judul katalog tampil
    await expect(
      page.getByRole('heading', { name: /Katalog Laboratorium Sains Interaktif 3D/i })
    ).toBeVisible();

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
    const searchInput = page.getByPlaceholder('Cari modul atau rumus...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Titrasi');

    await expect(
      page.getByRole('heading', { name: /Titrasi Asam-Basa/i }).first()
    ).toBeVisible();

    // Reset pencarian & buka tampilan semua modul untuk memverifikasi Hukum II Newton
    await searchInput.fill('');
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await expect(
      page.getByRole('heading', { name: /Hukum II Newton/i }).first()
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(fatalConsoleErrors).toEqual([]);
  });

  test('Skenario 2 (Lab 3D & Pedagogical UX): Render <canvas> Fisika & Kimia di dalam LabErrorBoundary + Asisten Sokratik Offline Dr. LabMu (tanpa NaN)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');

    // 1. Masuk ke 1 modul Fisika
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page
      .getByRole('button', { name: /Mulai Praktikum/i })
      .first()
      .click();

    // Lanjut dari Tahap 1 (Pre-Lab) ke Tahap 2 (Simulasi 3D)
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    const cockpit3D = page.getByTestId('main-3d-cockpit');
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await expect(cockpit3D.locator('canvas').first()).toBeVisible();

    // 2. Kembali ke Katalog & masuk ke 1 modul Kimia
    await page.getByRole('button', { name: 'Kembali ke Katalog Laboratorium' }).click();
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await page.getByRole('button', { name: 'Kimia', exact: true }).click();
    await page
      .getByRole('button', { name: /Mulai Praktikum/i })
      .first()
      .click();

    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await expect(cockpit3D.locator('canvas').first()).toBeVisible();

    // 3. Buka panel Asisten Dr. LabMu & uji simulasi pertanyaan dalam mode offline
    await page.route('**/api/dr-labmu/ask', (route) => route.abort('internetdisconnected'));
    await page.route('**/api/ai/dr-labmu', (route) => route.abort('internetdisconnected'));

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
    expect(drawerContent).toMatch(/Pertanyaan Pemantik:/i);
    expect(drawerContent).not.toContain('NaN');
  });

  test('Skenario 3 (Mobile Viewport 390x844): Responsivitas tanpa horizontal overflow & kontrol utama dapat diklik', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Katalog Laboratorium Sains Interaktif 3D/i })
    ).toBeVisible();

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
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await page
      .getByRole('button', { name: /Mulai Praktikum/i })
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
      await Promise.all([teacherPage.goto('/'), studentPage.goto('/')]);

      // 1. Guru membuat Room PIN
      await teacherPage.getByRole('button', { name: '+ Buat Room' }).click();
      const roomIdInputTeacher = teacherPage.getByPlaceholder('Contoh: LAB-ALPHA');
      const pinInputTeacher = teacherPage.getByTestId('room-pin-input');
      await roomIdInputTeacher.fill(testRoomId);
      await pinInputTeacher.fill(testPin);
      await teacherPage.getByRole('button', { name: 'Buka Meja Praktikum' }).click();

      await expect(teacherPage.getByText(new RegExp(`MEJA AKTIF: ${testRoomId}`, 'i'))).toBeVisible();

      // 2. Siswa bergabung ke Room ID & PIN yang sama
      await studentPage.getByRole('button', { name: 'Masuk dengan PIN' }).click();
      const roomIdInputStudent = studentPage.getByPlaceholder('Contoh: LAB-ALPHA');
      const pinInputStudent = studentPage.getByTestId('room-pin-input');
      await roomIdInputStudent.fill(testRoomId);
      await pinInputStudent.fill(testPin);
      await studentPage.getByRole('button', { name: 'Siswa Praktikan' }).click();
      await studentPage.getByRole('button', { name: 'Gabung Sekarang' }).click();

      await expect(studentPage.getByText(new RegExp(`Room: ${testRoomId}`, 'i'))).toBeVisible();

      // 3. Guru mengaktifkan Freeze Mode
      await teacherPage
        .getByRole('button', { name: /Kunci Layar Murid \(Freeze Inputs\)/i })
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
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await page.getByRole('button', { name: 'Fisika', exact: true }).click();
    await page.getByRole('button', { name: /Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    const cockpit3D = page.getByTestId('main-3d-cockpit');
    await expect(cockpit3D).toBeVisible();
    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);

    await page.getByTestId('toggle-3d-measure-btn').click();
    await expect(page.getByText(/Mistar:/i)).toBeVisible();
    await expect(page.getByText(/Busur:/i)).toBeVisible();
    await page.getByTestId('snap-dock-apparatus-btn').click();

    // Drag sedikit pada kanvas 3D Fisika
    const physCanvas = page.getByTestId('physics-simulation-canvas');
    const physBox = await physCanvas.boundingBox();
    if (physBox) {
      await page.mouse.move(physBox.x + physBox.width * 0.5, physBox.y + physBox.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(physBox.x + physBox.width * 0.55, physBox.y + physBox.height * 0.45);
      await page.mouse.up();
    }

    // 2. Toggle Mode Hemat Daya 3T (Lite Mode) melalui menu Pengaturan
    await page.getByTestId('settings-popover-trigger-btn').click();
    const liteToggleBtn = page.getByTestId('lite-device-mode-toggle-btn');
    await expect(liteToggleBtn).toBeVisible();
    await liteToggleBtn.click();
    await expect(liteToggleBtn).toContainText(/AKTIF/i);
    await page.keyboard.press('Escape');

    // 3. Pindah ke Kimia dalam Lite 3T Mode -> uji Probe Digital 3D & Snap-to-Port
    await page.getByRole('button', { name: 'Kembali ke Katalog Laboratorium' }).click();
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await page.getByRole('button', { name: 'Kimia', exact: true }).click();
    await page.getByRole('button', { name: /Mulai Praktikum/i }).first().click();
    await page.getByRole('button', { name: /Pindah ke Tahap.*Simulasi/i }).click();

    await expect(page.getByTestId('lab-webgl-error-fallback')).toHaveCount(0);
    await page.getByTestId('toggle-3d-probe-btn').click();
    await expect(page.getByText(/Sensor Probe 3D:/i)).toBeVisible();
    await page.getByTestId('snap-dock-apparatus-btn').click();

    // 4. Pindah ke Biologi -> uji Mistar 3D & kanvas tanpa error WebGL
    await page.getByRole('button', { name: 'Kembali ke Katalog Laboratorium' }).click();
    await page.getByRole('button', { name: /Semua 28 Modul Sains/i }).click();
    await page.getByRole('button', { name: 'Biologi', exact: true }).click();
    await page.getByRole('button', { name: /Mulai Praktikum/i }).first().click();
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
});
