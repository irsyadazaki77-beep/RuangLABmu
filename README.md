<div align="center">

# RuangLABmu

**Integrated 3D Virtual Science Laboratory, Socratic AI Mentor & Real-Time Collaborative LMS**

[![CI Pipeline](https://github.com/irsyadazaki77-beep/RuangLABmu/actions/workflows/ci.yml/badge.svg)](https://github.com/irsyadazaki77-beep/RuangLABmu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Bun 1.3+ / Node 22+](https://img.shields.io/badge/Runtime-Bun_1.3%2B_%7C_Node_22%2B-f472b6?logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js r187](https://img.shields.io/badge/3D_Engine-Three.js_0.187_WebGL-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite_(bun%3Asqlite)-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Playwright E2E](https://img.shields.io/badge/E2E-Playwright_1.59-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

Platform laboratorium sains virtual interaktif untuk jenjang **SMP, SMA, dan Perguruan Tinggi** — menggabungkan simulasi numerik deterministik (**RK4 & Velocity Verlet**), visualisasi **3D WebGL (Three.js r187)** dengan *Adaptive 3T Quality Tier*, mentor **Dr. LabMu AI Sokratik + Vision**, kolaborasi **PIN Room WebSocket multi-pengguna**, persistensi **SQLite (`bun:sqlite` / `node:sqlite`)**, serta **Auto-Grading Rubrik LMS** (Google Classroom / Moodle / Excel).

📄 **Dokumentasi Arsitektur Lengkap & Diagram Mermaid**: Lihat [ARCHITECTURE.md](./ARCHITECTURE.md).

</div>

---

## 🛠️ Matriks Tech Stack & Versi

| Lapisan | Teknologi & Versi | Peran Utama |
| :--- | :--- | :--- |
| **Runtime & Package Manager** | **Bun `1.3+`** & **Node.js `>= 22.0.0`** (`bun.lock`) | Eksekusi server cepat, bundler, test runner, dan native SQLite driver |
| **Bahasa Pemrograman** | **TypeScript `7.0`** (`@typescript/native-preview`) | Type-checking ketat (*strict mode*) di seluruh frontend, worker, dan backend |
| **Frontend UI & State** | **React `19.2`** (`<StrictMode>`, `React.lazy` + `Suspense`) & **Zustand `5.0`** | Antarmuka modular terpisah per domain dengan *code-splitting* dan *theme-aware skeleton* |
| **Engine 3D & WebGL** | **Three.js `0.187`** + Custom WebGL Host | Simulasi 3D interaktif, *WebGL Context-Loss Recovery*, dan *Rolling FPS Adaptive 3T Tier* |
| **Simulasi Numerik** | **60Hz Web Worker** (RK4 & Velocity Verlet) | Integrasi ODE *drift-compensated* dengan `Float32Array` *transferable zero-copy buffer* |
| **Backend & Real-Time** | **Express `5.2`** + **ws `8.20`** (`/ws-lab`) | REST API (1MB default / 20MB Vision limit), *Helmet CSP*, dan Room PIN kriptografis (`timingSafeEqual`) |
| **Persistensi Database** | **SQLite** (`bun:sqlite` / `node:sqlite`) | Penyimpanan persisten di `./data/ruanglabmu.db` dengan indeks `room_id`, `created_at` & *TTL auto-pruning* |
| **AI Mentor & Vision** | **`@google/genai` `1.49`** + Local Socratic Engine | Evaluasi telemetri Sokratik Dr. LabMu & diagnosis gambar 3D/grafik (dengan fallback 100% offline) |
| **Testing & CI/CD** | **Playwright `1.59`** + `node:test` + GitHub Actions | Unit test numerik/backend & E2E smoke test otomatis dengan unggahan artefak trace/report |

---

## ⚡ Peluncur Cepat Sekolah 3T (Sekali Klik Tanpa Kuota Internet)

Bagi sekolah di daerah **3T (Tertinggal, Terdepan, dan Terluar)** atau laboratorium dengan keterbatasan perangkat dan jaringan internet:

```bash
# 🪟 Windows (Cukup Klik Ganda pada file ini di Windows Explorer):
mulai-lab-sekolah.bat

# 🐧 Linux / 🍎 macOS:
./mulai-lab-sekolah.sh
```

### 📦 Cara Menjalankan Versi Portabel (Untuk Guru Daerah 3T Tanpa Install Node.js/Bun)

Bagi sekolah yang komputernya **sama sekali belum terpasang Node.js, Bun, NPM, maupun Git**, tersedia bundel **Portable Executable Mandiri**:

1. **Membangun Paket Portabel (Oleh Tim IT / Developer)**:
   ```bash
   npm run build:portable
   # Atau cross-compile khusus Windows (.exe):
   npx tsx scripts/build-portable.ts --target=win
   ```
   Perintah ini otomatis mengompilasi aset 3D frontend (`release/dist/`) dan membungkus `server.ts` menjadi satu file executable mandiri di folder `release/` (misal `release/RuangLABmu-Sekolah-win.exe` atau `release/RuangLABmu-Sekolah-linux`).
2. **Distribusi via Flashdisk ke Sekolah 3T**:
   Salin seluruh isi folder `release/` ke komputer laboratorium atau laptop Guru.
3. **Jalankan dengan Klik 2x (Zero-Install)**:
   - Guru cukup **klik 2x** pada file `RuangLABmu-Sekolah-win.exe` (Windows) atau `./RuangLABmu-Sekolah-linux` (Linux).
   - Server otomatis mendeteksi folder `dist/` di sebelahnya, menyiapkan database SQLite lokal, mencari port kosong (`3000`/`3001`/dst.), mencetak **Alamat IP Hotspot Wi-Fi lokal Guru beserta QR Code** langsung di layar terminal, dan otomatis membuka browser ke `http://localhost:3000`.

### 🎒 Fitur Ketahanan Khusus Perangkat 3T di RuangLABmu:
1. **⚡ Adaptive Quality Tier (< 30 FPS Auto-Downgrade & Lite 3T Mode)**:
   - Monitor FPS bergulir (*rolling 2-second window*) otomatis menurunkan `pixelRatio(1)` dan mematikan bayangan/post-processing berat saat rata-rata FPS turun di bawah 30 FPS atau saat *Mode Hemat 3T* diaktifkan, dilengkapi indikator performa non-intrusif di HUD.
2. **🛡️ WebGL Context-Loss Recovery & Scene3DErrorBoundary**:
   - Menangani kehilangan konteks GPU (`webglcontextlost` / `webglcontextrestored`) secara otomatis pada perangkat RAM rendah dan menyediakan tombol **"Pulihkan Scene 3D"** tanpa me-reload halaman atau kehilangan data tabel pengamatan.
3. **📶 Offline Exam Auto-Submit Recovery**:
   - Apabila koneksi terputus saat waktu ujian habis, jawaban siswa disimpan ke antrean aman `localStorage`/`IndexedDB` dengan banner peringatan dan dikirim ulang secara otomatis begitu jaringan kembali `online`.
4. **🖨️ Cetak LKS Kertas Kosong (Hemat Tinta)** & **📽️ Mode Proyektor Kelas 1.5x**:
   - Menghasilkan lembar kerja hitam-putih ramah fotokopi dengan **Grid Milimeter Blok SVG** serta mode tampilan kontras tinggi untuk proyektor kelas.
5. **👥 Gilir Kelompok di 1 Komputer (Pass-and-Play Rotation)**:
   - Menyimpan laporan Kelompok A secara aman lalu menyiapkan meja kerja bersih bagi Kelompok B di perangkat yang sama.

---

## Fitur Utama

### 1. 28 Modul Eksperimen Terkurasi Across 4 Domain Sains
Seluruh modul dikelola terpusat di [`experimentRegistry.ts`](src/registry/experimentRegistry.ts) dengan dukungan jenjang adaptif (**SMP**, **SMA**, **Mahasiswa**):

| Domain | Modul Tersedia | Model & Engine Numerik |
| :--- | :---: | :--- |
| **Fisika** ([`physicsModules.ts`](src/registry/modules/physicsModules.ts)) | **10 Modul** | Hukum II Newton & Bidang Miring, Gerak Parabola, Bandul Matematis, Osilasi Pegas Hooke, Tumbukan 1D, Viskositas Stokes, Ohm–Kirchhoff & Wheatstone, Interferensi Celah Ganda Young, Efek Fotolistrik Planck, Gravitasi Universal |
| **Kimia** ([`chemistryModules.ts`](src/registry/modules/chemistryModules.ts)) | **6 Modul** | Kalorimetri & Termokimia Netralisasi, Titrasi Asam-Basa & Kurva Sigmoidal, Sel Volta & Nernst, Hukum Gas Ideal, Kinetika Arrhenius, Spektrofotometri UV-Vis Lambert-Beer |
| **Biologi & Anatomi 3D** ([`biologyModules.ts`](src/registry/modules/biologyModules.ts)) | **7 Modul** | Fotosintesis Ingenhousz, Kinetika Enzim Michaelis-Menten, Populasi Lotka-Volterra, Osmosis Sel Tumbuhan, **Kardiovaskular & EKG 3D**, **Spirometri Paru-Paru 3D**, **Neurofisiologi & Potensial Aksi 3D** |
| **Astronomi** ([`astronomyModules.ts`](src/registry/modules/astronomyModules.ts)) | **5 Modul** | Orbit Tata Surya & Hukum III Kepler, Kurva Rotasi Galaksi & Dark Matter, Fotometri Transit Eksoplanet, Spektroskopi Bintang & Hukum Wien, Ekspansi Kosmik & Hukum Hubble |

### 2. Auto-Grading Rubrik LMS & Ekspor Laporan Akademik
- **Evaluasi Otomatis terhadap Solver RK4 / Velocity Verlet** ([`academicReportExporter.ts`](src/utils/academicReportExporter.ts)): Membandingkan kemiringan regresi dan propagasi ketidakpastian siswa terhadap solusi teoretis solver numerik untuk menghasilkan skor `0–100`, persentase deviasi (`%`), dan umpan balik diagnostik.
- **Ekspor CSV Gradebook LMS** ([`TeacherDashboardView.tsx`](src/components/TeacherDashboardView.tsx)): Ekspor satu klik dalam format kolom yang ramah impor ke **Google Classroom**, **Moodle Gradebook**, dan **Microsoft Excel** (dengan UTF-8 BOM).
- **Laporan Resmi PDF & HTML A4**: Ekspor dokumen laporan praktikum lengkap dengan tangkapan layar 3D, grafik regresi, dan analisis ralat Tipe A/B.

---

## Struktur Direktori Utama

```text
RuangLABmu/
├── .github/workflows/ci.yml           # Pipeline GitHub Actions (Bun + Node 22 + Playwright E2E Artifacts)
├── ARCHITECTURE.md                    # Dokumentasi arsitektur sistem & diagram alir Mermaid
├── Dockerfile                         # Multi-stage container build (oven/bun + node:22-slim + Volume /app/data)
├── server.ts                          # Express + WebSocket (/ws-lab) backend & payload hardening
├── server/
│   ├── routes/                        # Rute modular (aiRoutes, labRoutes, submissionRoutes)
│   ├── state/                         # labServerState.ts & sqliteAdapter.ts (bun:sqlite / node:sqlite)
│   ├── utils/                         # Security headers, validators, rate-limit & backend unit tests
│   └── ws/                            # collabSocketServer, wsAuth, wsRoomManager, wsSpatialSync, wsMissionHandler
├── src/
│   ├── App.tsx                        # Root container dengan React.lazy + Suspense & offline exam recovery
│   ├── stores/                        # Zustand stores (useLabStore, useUIStore, useCollabStore)
│   ├── hooks/                         # useLabSession, useLabParamsSync, useLabTelemetryAndXP, useLabCollabBridge, useLabAutoSave
│   ├── workers/simulationWorker.ts    # RK4 & Velocity Verlet ODE solver di Web Worker thread
│   ├── components/
│   │   ├── common/                    # LabErrorBoundary & Scene3DErrorBoundary (WebGL recovery)
│   │   ├── scenes/ & *Scene3D.tsx     # Viewport 3D Three.js & modular stage builders (*CoreStage.ts, *Rigs.ts)
│   │   ├── analytics/                 # RegressionChartSection, DataObservationTable, StudentWorksheetForm
│   │   └── teacher/                   # TeacherDashboardView, TeacherGradebookHub, SessionReplayPlayer
│   └── utils/                         # Science engines, Three.js studio host, LMS rubric auto-grader & unit tests
└── data/                              # Volume database SQLite (ruanglabmu.db) & submissions.json
```

---

## Panduan Menjalankan (Lokal, Produksi, Mode 3T, & Docker)

### 1. Mode Pengembangan Lokal
Prasyarat: **Bun `>= 1.3`** atau **Node.js `>= 22.0.0`**.

```bash
git clone https://github.com/irsyadazaki77-beep/RuangLABmu.git
cd RuangLABmu
bun install # atau npm install
npm run dev
```
Aplikasi berjalan di `http://localhost:3000`.

### 2. Mode Produksi & Verifikasi Kualitas
```bash
npm run lint     # TypeScript strict type checking (tsc --noEmit)
npm test         # Menjalankan seluruh unit test frontend, solver numerik, & SQLite backend
npm run build    # Build frontend PWA (dist/) & bundle server produksi (dist-server/server.cjs)
npm start        # Menjalankan server produksi terkompilasi pada port 3000

# Menjalankan E2E Smoke Test di atas server produksi:
CI=true APP_URL=http://localhost:3000 ALLOWED_ORIGINS=http://localhost:3000 npm run test:e2e
```

### 3. Menjalankan via Docker (dengan Volume Persistensi SQLite)
`Dockerfile` menggunakan `oven/bun` untuk instalasi dependensi deterministik (`bun.lock`) dan mendeklarasikan volume `/app/data` agar database SQLite (`DB_PATH=/app/data/ruanglabmu.db`) tetap persisten:

```bash
docker build -t ruanglabmu .
docker run -d \
  -p 3000:3000 \
  -v ruanglabmu_data:/app/data \
  -e DB_PATH=/app/data/ruanglabmu.db \
  -e GEMINI_API_KEY="your_optional_key" \
  --name ruanglabmu-server \
  ruanglabmu
```

---

## Lisensi

Proyek ini dilisensikan di bawah **MIT License** — lihat berkas [LICENSE](./LICENSE) untuk detail lengkap.
