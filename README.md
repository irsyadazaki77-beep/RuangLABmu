<div align="center">

# RuangLABmu

**Integrated 3D Virtual Science Laboratory, Socratic AI Mentor & Real-Time Collaborative LMS**

[![CI Pipeline](https://github.com/irsyadazaki77-beep/RuangLABmu/actions/workflows/ci.yml/badge.svg)](https://github.com/irsyadazaki77-beep/RuangLABmu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/3D_Engine-Three.js_WebGL-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)

Platform laboratorium sains virtual interaktif untuk jenjang **SMP, SMA, dan Perguruan Tinggi** — menggabungkan simulasi numerik deterministik (RK4 & Velocity Verlet), visualisasi **3D WebGL (Three.js)**, mentor **Dr. LabMu AI Sokratik + Vision**, kolaborasi **PIN Room WebSocket multi-pengguna**, serta pipeline asesmen & ekspor laporan resmi.

</div>

---

## ⚡ Peluncur Cepat Sekolah 3T (Sekali Klik Tanpa Kuota Internet)

Bagi sekolah di daerah **3T (Tertinggal, Terdepan, dan Terluar)** atau laboratorium dengan keterbatasan perangkat dan jaringan internet:

```bash
# 🪟 Windows (Cukup Klik Ganda pada file ini di Windows Explorer):
mulai-lab-sekolah.bat

# 🐧 Linux / 🍎 macOS:
./mulai-lab-sekolah.sh
```

### Apa yang Dilakukan Skrip Ini Secara Otomatis?
1. **Pengecekan Otomatis**: Memastikan dependensi dan berkas build `dist/` sudah siap. Jika belum, skrip otomatis melakukan build pertama kali.
2. **Jaringan Hotspot Lokal (Zero Data / Tanpa Kuota)**: Laptop guru cukup menyalakan *Mobile Hotspot* (tethering Wi-Fi tanpa kuota). Skrip mendeteksi dan menampilkan alamat IP lokal guru (misal: `http://192.168.137.1:3000`) di layar terminal.
3. **Akses HP / Tablet Siswa**: Siswa di kelas menyambungkan perangkatnya ke Wi-Fi laptop guru dan membuka browser ke alamat IP tersebut untuk ikut praktikum real-time.
4. **Membuka Otomatis**: Browser di laptop guru langsung terbuka ke `http://localhost:3000`.

### 🎒 5 Fitur Khusus Lapangan 3T di RuangLABmu:
1. **🖨️ Cetak LKS Kertas Kosong (Hemat Tinta)**:
   - Didesain khusus untuk sekolah di mana siswa tidak memiliki gawai pribadi dan mengamati 1 laptop/proyektor guru.
   - Menghasilkan lembar kerja hitam-putih ramah fotokopi: Kop LKS, Tujuan & K3, Kotak titik-titik hipotesis, **Tabel pengamatan kosong 7 baris** berparameter otomatis sesuai modul, **Area Grid Milimeter Blok SVG** untuk menggambar grafik manual dengan penggaris, serta pertanyaan diskusi dan kesimpulan.
   - Tombol cetak tersedia langsung di panel Lembar Kerja Siswa dan Pengaturan Guru.
2. **📽️ Mode Proyektor Kelas / Layar Besar**:
   - Toggle di menu pengaturan `⚙️` yang memperbesar angka telemetri, HUD, dan label variabel simulasi 3D sebesar **1.5x dengan kontras tinggi** agar mudah dibaca siswa di barisan belakang kelas.
3. **👥 Gilir Kelompok di 1 Komputer (Pass-and-Play Rotation)**:
   - Tombol *"Simpan & Ganti Giliran Kelompok"* di form LKS menyimpan laporan Kelompok A ke penyimpanan aman, lalu mereset tabel observasi dan formulir menjadi bersih untuk Kelompok B tanpa menghapus rekam jejak kelompok sebelumnya.
4. **🚀 Skrip Peluncur 1-Klik Guru Non-IT (`mulai-lab-sekolah.bat` & `.sh`)**:
   - Guru tidak perlu mengetik perintah terminal yang rumit; cukup klik 2x file `.bat` untuk menyalakan laboratorium kelas.
5. **📴 100% Offline & Non-Blocking Font Stack**:
   - Sistem font fallbacks lokal memastikan aplikasi terbuka instan tanpa delay atau error saat komputer sama sekali tidak memiliki koneksi internet.

---

## Fitur Utama

### 1. 28 Modul Eksperimen Terkurasi Across 4 Domain Sains
Seluruh modul dikelola terpusat di [experimentRegistry.ts](src/registry/experimentRegistry.ts) dengan dukungan jenjang adaptif (**SMP**, **SMA**, **Mahasiswa**):

| Domain | Modul Tersedia | Model & Engine Numerik |
| :--- | :---: | :--- |
| **Fisika** ([`physicsModules.ts`](src/registry/modules/physicsModules.ts)) | **10 Modul** | Hukum II Newton & Bidang Miring, Gerak Parabola, Bandul Matematis, Osilasi Pegas Hooke, Tumbukan 1D, Viskositas Stokes, Ohm–Kirchhoff & Wheatstone, Interferensi Celah Ganda Young, Efek Fotolistrik Planck, Gravitasi Universal |
| **Kimia** ([`chemistryModules.ts`](src/registry/modules/chemistryModules.ts)) | **6 Modul** | Kalorimetri & Termokimia Netralisasi, Titrasi Asam-Basa & Kurva Sigmoidal, Sel Volta & Nernst, Hukum Gas Ideal, Kinetika Arrhenius, Spektrofotometri UV-Vis Lambert-Beer |
| **Biologi & Anatomi 3D** ([`biologyModules.ts`](src/registry/modules/biologyModules.ts)) | **7 Modul** | Fotosintesis Ingenhousz, Kinetika Enzim Michaelis-Menten, Populasi Lotka-Volterra, Osmosis Sel Tumbuhan, **Kardiovaskular & EKG 3D**, **Spirometri Paru-Paru 3D**, **Neurofisiologi & Potensial Aksi 3D** |
| **Astronomi** ([`astronomyModules.ts`](src/registry/modules/astronomyModules.ts)) | **5 Modul** | Orbit Tata Surya & Hukum III Kepler, Kurva Rotasi Galaksi & Dark Matter, Fotometri Transit Eksoplanet, Spektroskopi Bintang & Hukum Wien, Ekspansi Kosmik & Hukum Hubble |

### 2. Arsitektur Modern & Performa Komputasi
- **Zustand State Architecture** ([`src/stores/`](src/stores)): Pemisahan state terstruktur antara `useLabStore`, `useUIStore`, dan `useCollabStore` untuk meminimalkan re-render pada loop simulasi 3D.
- **60Hz Web Worker & Ring Buffer** ([`simulationWorker.ts`](src/workers/simulationWorker.ts), [`simulationBuffer.ts`](src/utils/simulationBuffer.ts)): Integrasi ODE Runge-Kutta orde-4 (RK4) berjalan di background thread tanpa menghambat UI utama.
- **Ketidakpastian Instrumen Realistis** ([`uncertaintyEngine.ts`](src/utils/uncertaintyEngine.ts)): Injeksi noise Gaussian & ketelitian skala terkecil (NST) alat ukur.
- **Record Parameter Replay** ([`labTelemetryHelpers.ts`](src/utils/labTelemetryHelpers.ts)): Muat ulang parameter percobaan historis langsung kembali ke kokpit 3D domain terkait.

### 3. Mentor AI Sokratik & Vision AI (`Dr. LabMu`)
- Endpoint `POST /api/dr-labmu/ask` dan `POST /api/ai/vision-diagnose` dengan integrasi **Gemini API (`@google/genai`)** plus fallback **Deterministic Socratic Engine** lokal ketika API key tidak tersedia.
- Mendeteksi anomali regresi ($R^2 < 0.85$ pada $\ge 3$ data), menolak permintaan jawaban mentah secara edukatif, menganalisis tangkapan gambar 3D kanvas/grafik (Multimodal Vision), serta mendukung narasi suara **Web Speech API** ([`voiceNarrationEngine.ts`](src/utils/voiceNarrationEngine.ts)).

### 4. Kolaborasi Real-Time, Ujian Terkontrol & Dashboard Pengajar
- **Room PIN WebSocket (`/ws-lab`)** & REST Discovery (`GET /api/rooms`): Dosen/Guru dapat membuat Room ber-PIN, memantau kehadiran real-time, mengunci parameter dengan **Mutex Parameter Lock**, serta membekukan instrumen siswa (**Teacher Freeze**).
- **Spatial 3D Cursor** ([`useSpatialCollab.ts`](src/hooks/useSpatialCollab.ts)): Penunjuk spasial kolaboratif di kanvas 3D dengan interpolasi LERP & throttling 20Hz.
- **Exam Mode & Mystery Challenge** ([`ExamSessionController.tsx`](src/components/exam/ExamSessionController.tsx), [`mysteryChallengeEngine.ts`](src/utils/mysteryChallengeEngine.ts)): Hitung mundur ujian, deteksi pindah tab anti-curang, tantangan sampel misteri real-time, dan auto-submit saat waktu habis.
- **Teacher Gradebook & Session Replay** ([`TeacherGradebookHub.tsx`](src/components/teacher/TeacherGradebookHub.tsx), [`SessionReplayPlayer.tsx`](src/components/teacher/SessionReplayPlayer.tsx)): Penilaian LKS & laporan praktikum, pemutar replay timeline interaksi slider, serta ekspor rekap CSV **Google Classroom**.

### 5. Analitik Ilmiah, PWA Offline & Bilingual (ID / EN)
- **OLS Linear Regression & Curve Fitting** ([`RegressionChartSection.tsx`](src/components/analytics/RegressionChartSection.tsx)): Visualisasi grafik interaktif, deteksi outlier leave-one-out, dan kalkulasi $R^2$ real-time.
- **Ekspor Laporan Resmi**: Pratinjau HTML cetak + ekspor PDF multi-tabel terstruktur (lazy-loaded `jsPDF` & `jspdf-autotable`) dan CSV standar RFC 4180.
- **Gamifikasi Praktikum** ([`gamificationEngine.ts`](src/services/gamificationEngine.ts)): Sistem XP & lencana pencapaian (*K3 Guardian*, presisi $R^2 \ge 0.99$, nilai LKS sempurna).
- **Offline Outbox Sync & PWA** (`vite-plugin-pwa`): Perubahan data saat offline diantrekan otomatis dan disinkronkan ulang saat koneksi pulih.
- **Dwibahasa ID / EN** ([`i18n.ts`](src/i18n.ts)): Dukungan antarmuka Bahasa Indonesia dan Bahasa Inggris.

---

## Struktur Direktori Utama

```text
RuangLABmu/
├── .github/workflows/ci.yml           # Pipeline GitHub Actions (Node 22: lint, test, build)
├── Dockerfile                         # Multi-stage container build (node:22-alpine)
├── server.ts                          # Express + WebSocket (/ws-lab) backend & AI endpoints
├── vite.config.ts                     # Konfigurasi Vite, PWA manifest, chunking & COOP/COEP
├── src/
│   ├── App.tsx                        # Root container & exam/replay orchestration
│   ├── i18n.ts & locales/             # Konfigurasi i18next (id.json & en.json)
│   ├── stores/                        # Zustand stores (useLabStore, useUIStore, useCollabStore)
│   ├── registry/modules/              # Definisi 28 modul eksperimen & misi
│   ├── hooks/                         # useLabSession, useBackendSync, useDrLabMuChat, useSpatialCollab
│   ├── workers/simulationWorker.ts    # RK4 ODE solver di Web Worker thread
│   ├── services/gamificationEngine.ts # Sistem XP, level & badges praktikum
│   ├── components/
│   │   ├── layout/                    # TopNavigationHeader, MainLabWorkspace, StandardLabViewShell
│   │   ├── analytics/                 # RegressionChartSection, DataObservationTable, StudentWorksheetForm
│   │   ├── teacher/                   # TeacherGradebookHub, SessionReplayPlayer
│   │   ├── exam/                      # ExamSessionController
│   │   ├── scenes/ & *Scene3D.tsx     # Viewport 3D Three.js per domain & anatomi manusia
│   │   └── ui/                        # Dock kontrol, Command Palette, Report Modal, PWA Banner
│   └── utils/                         # Science engines, telemetry helpers, PDF/CSV exporters & unit tests
└── data/                              # Penyimpanan JSON lokal persisten (submissions & session snapshots)
```

---

## Menjalankan Secara Lokal

### Prasyarat
- **Node.js `>= 22.0.0`** dan **npm**
- *(Opsional)* `GEMINI_API_KEY` untuk mengaktifkan respons Gemini pada asisten AI **Dr. LabMu** (tanpa API key, sistem otomatis memakai Deterministic Socratic Engine lokal).

### Instalasi & Pengembangan

```bash
git clone https://github.com/irsyadazaki77-beep/RuangLABmu.git
cd RuangLABmu
npm install
```

Konfigurasi `.env` opsional:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

Jalankan server fullstack (Express API + WebSocket `/ws-lab` + Vite HMR):
```bash
npm run dev
```
Aplikasi tersedia di `http://localhost:3000`.

### Perintah Verifikasi & Produksi

```bash
npm run lint     # TypeScript strict type checking (tsc --noEmit)
npm test         # Menjalankan seluruh unit test di src/utils/*.test.ts
npm run build    # Build frontend PWA (dist/) & bundle server ESM/CJS (dist-server/server.cjs)
npm start        # Menjalankan server produksi terkompilasi pada port 3000
```

### Menjalankan via Docker

```bash
docker build -t ruanglabmu .
docker run -p 3000:3000 -e GEMINI_API_KEY="your_key" ruanglabmu
```

---

## Ringkasan API Backend (`server.ts`)

| Endpoint / Protocol | Deskripsi |
| :--- | :--- |
| `GET /api/health` | Status kesehatan server, jumlah room aktif, dan jumlah rekaman |
| `GET /api/rooms` | Daftar room PIN aktif beserta domain, pengajar, dan jumlah peserta |
| `GET /api/lab-state` | State global awal (records, tasks, notes, roster, parameter locks) |
| `GET /api/submissions` & `POST /api/submissions` | Pengumpulan dan pengambilan daftar laporan praktikum LKS |
| `PATCH /api/submissions/:id/grade` | Pemberian nilai dan umpan balik pengajar per submission |
| `POST /api/dr-labmu/ask` | Evaluasi telemetri AI Sokratik Dr. LabMu (mendukung `{ telemetry }` & flat JSON) |
| `POST /api/ai/vision-diagnose` | Analisis multimodal Vision dari tangkapan screenshot kanvas/grafik |
| `POST /api/session/autosave` & `GET /api/session/autosave` | Autosave & pemulihan state praktikum mahasiswa |
| `WS /ws-lab` | Sinkronisasi Room PIN, Spatial 3D Cursor, Mutex Locks, Quiz, Mystery Challenge & Feedback |

---

## Lisensi

Proyek ini dilisensikan di bawah **MIT License** — lihat berkas [LICENSE](./LICENSE) untuk detail lengkap.
