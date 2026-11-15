# RuangLABmu — System Architecture & Production Blueprint

**RuangLABmu** adalah platform laboratorium sains virtual 3D interaktif (Fisika, Kimia, Biologi, dan Astronomi) yang dirancang khusus untuk ketahanan jaringan sekolah di wilayah 3T (Terdepan, Terluar, Tertinggal), kolaborasi kelas berbasis PIN multi-pengguna, evaluasi rubrik numerik otomatis berbasis integrator Runge-Kutta Orde 4 (RK4), dan pendampingan AI Sokratis hibrida (Daring & Luring).

---

## 1. Tumpukan Teknologi (Technology Stack)

| Lapisan | Teknologi & Pustaka Utama | Peran Arsitektural |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 19 + TypeScript (`strict: true`) + Vite 6 | UI deklaratif dengan *domain-level code-splitting* (`React.lazy` + `Suspense`) untuk modul Fisika, Kimia, Biologi, dan Astronomi. |
| **State Management** | Zustand + `useShallow` | Penyimpanan reaktif tersegmentasi (`useLabStore`, `useUIStore`, `useCollabStore`) tanpa *unnecessary re-render* pada loop 60 FPS. |
| **3D Spatial & WebXR** | Three.js + PostProcessing + WebXR | Mesin visualisasi 3D PBR (`ACESFilmicToneMapping`, `toneMappingExposure = 0.98`, `SRGBColorSpace`), gelas borosilikat IOR 1.47, *3D measurement tools* (mistar, busur derajat, probe digital), dan *WebGL Context-Loss ErrorBoundary*. |
| **Numerical Solver** | Web Worker (`src/workers/simulationWorker.ts`) | Integrator persamaan diferensial biasa **Runge-Kutta Orde 4 (RK4)** *off-main-thread* dengan *ring-buffer timeline scrubber* (`simulationTimelineBuffer.ts`). |
| **Backend & WebSocket** | Express + `ws` (`server.ts`, `server/ws/*`) | Server HTTP + WebSocket (`/ws-lab`) untuk sinkronisasi kursor 3D, penguncian parameter (*parameter locks*), pembekuan layar oleh guru (*teacher freeze*), dan *custom AI mission broadcast*. |
| **Database Layer** | `bun:sqlite` / `node:sqlite` (`server/db/database.ts`) | Penyimpanan relasional persisten dengan `PRAGMA journal_mode = WAL;` dan `PRAGMA foreign_keys = ON;` untuk tabel `rooms`, `participants`, `simulation_snapshots`, dan `gradebook_entries`. |
| **Auto-Grading Engine** | `src/shared/grading/rubricEngine.ts` | Mesin penilaian rubrik deterministik yang memvalidasi hipotesis, kelengkapan tabel observasi, deviasi numerik RK4, kuis pasca-lab, dan sintesis kesimpulan. |

---

## 2. Aliran Data Simulasi: RK4 Worker → Zustand `useShallow` → Three.js Render Loop

```text
[TactileParameterControl (Slider / Input Numerik / Fine Step)]
       │
       ▼ (Acquire Lock via WebSocket + Update Store)
[Zustand Store (useLabStore / useShallow)]
       │
       ├──► [useSimulationSync.ts] ──(Throttled Snapshot)──► [SQLite: simulation_snapshots]
       │
       ▼ (PostMessage ke Off-Thread Worker)
[RK4 Web Worker (simulationWorker.ts)]
  • Menyelesaikan dy/dt menggunakan Runge-Kutta Orde 4 (k1, k2, k3, k4)
  • Menghitung konservasi energi (Ek, Ep, E_termal, E_total) & ketidakpastian alat (NST)
       │
       ▼ (Frame Telemetry & Ring-Buffer Snapshot)
[Three.js Studio Render Loop (threeStudioHost.ts)]
  • Membaca state terbaru tanpa memicu re-render komponen React per frame
  • Menginterpolasi posisi objek 3D & kursor laser kolaborator dengan damping eksponensial:
      alpha = 1 - Math.exp(-k * dt)
  • Memantau rolling FPS melalui `useAdaptiveQuality.ts` (high -> medium -> low)
```

---

## 3. Arsitektur Persistensi Multiplayer & Pemulihan Koneksi 3T (`server/db/database.ts`)

Seluruh siklus hidup meja praktikum disimpan secara atomik ke dalam database SQLite menggunakan *prepared statements* dan transaksi (`BEGIN IMMEDIATE TRANSACTION`):

1. **Skema Tabel Utama (`data/ruanglabmu.db`)**:
   - `rooms`: `pin TEXT PRIMARY KEY, host_id TEXT NOT NULL, module_domain TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL`
   - `participants`: `id TEXT PRIMARY KEY, room_pin TEXT NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher', 'student')), connected INTEGER NOT NULL DEFAULT 1, last_seen INTEGER NOT NULL`
   - `simulation_snapshots`: `id INTEGER PRIMARY KEY AUTOINCREMENT, room_pin TEXT NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE, params_json TEXT NOT NULL, updated_at INTEGER NOT NULL`
   - `gradebook_entries`: `id TEXT PRIMARY KEY, room_pin TEXT NOT NULL REFERENCES rooms(pin) ON DELETE CASCADE, student_id TEXT NOT NULL, student_name TEXT NOT NULL, module_id TEXT NOT NULL, score REAL NOT NULL, rubric_json TEXT NOT NULL, submitted_at INTEGER NOT NULL`

2. **Pemulihan Koneksi Jaringan 3T (`useRoomSocket.ts` + `/api/rooms/rejoin` + WS `ROOM_REJOIN`)**:
   - Saat koneksi siswa di daerah 3T terputus sementara, server menandai `participants.connected = 0` tanpa menghapus sesi eksperimen.
   - Ketika koneksi pulih, klien memanggil `ROOM_REJOIN` (WebSocket) dan `POST /api/rooms/rejoin` dengan `(roomPin, participantId)`.
   - Server menjalankan transaksi atomik `rejoinParticipantSession`: memulihkan `connected = 1`, memperbarui `last_seen`, dan langsung mengirimkan *payload* `simulation_snapshots` terbaru (`SIMULATION_SNAPSHOT_RESTORE`) sehingga seluruh parameter eksperimen siswa kembali utuh.
   - Tugas pemeliharaan berkala (*periodic cleanup*) secara otomatis membersihkan ruangan yang telah melewati batas waktu (`expires_at < Date.now()`) beserta entri terkait via `ON DELETE CASCADE`.

---

## 4. Kalibrasi Visual Three.js, Ketahanan WebGL & Performa Adaptif 3T

1. **Kalibrasi Pencahayaan & Tone Mapping (`src/utils/threeStudioHost.ts`)**:
   - `THREE.ACESFilmicToneMapping` dengan `toneMappingExposure = 0.98` (rentang terkalibrasi `0.95–1.05`) dan `THREE.SRGBColorSpace` mencegah *highlight blowout* pada peralatan gelas kimia maupun lintasan fisika.
   - Sistem pencahayaan 3 titik (*Three-Point Studio Lighting*): `HemisphereLight` (`intensity = 0.52`), *Key DirectionalLight* (`intensity = 1.02`, `shadow.bias = -0.0005`, `shadow.normalBias = 0.02`), dan *Rim DirectionalLight* (`intensity = 0.38`).

2. **Proteksi Konteks WebGL (`src/components/three/WebGLErrorBoundary.tsx`)**:
   - Menangkap event `webglcontextlost` (`event.preventDefault()`) dan `webglcontextrestored` pada elemen `<canvas>`.
   - Menampilkan *overlay* pemulihan bertema laboratorium dengan tombol **"Pulihkan Canvas 3D"** tanpa menghilangkan data pengamatan maupun progres LKS siswa.

3. **Adaptive FPS & Resolution Scaler (`src/hooks/useAdaptiveQuality.ts`)**:
   - Melacak waktu antar-frame (*rolling frame delta*) langsung di dalam `requestAnimationFrame` tanpa memicu re-render React.
   - Jika rata-rata FPS turun di bawah **30 FPS selama 2 detik berturut-turut**, kualitas diturunkan secara bertahap (`high -> medium -> low`): mengubah `renderer.setPixelRatio` dari `Math.min(window.devicePixelRatio, 2) -> 1.0 -> 0.75` dan menonaktifkan *shadow map* dinamis pada tier `low`.

---

## 5. Evaluasi Rubrik Otomatis & Buku Nilai Guru (`src/shared/grading/rubricEngine.ts`)

Setiap laporan praktikum yang dikirimkan siswa (baik daring melalui `POST /api/submissions` maupun luring melalui berkas terenkripsi `.rlab`) dievaluasi secara deterministik berdasarkan 5 kriteria ilmiah:
1. **Rumusan Hipotesis & Variabel Ilmiah** (15 poin)
2. **Kelengkapan Sampel Tabel Observasi** (25 poin)
3. **Akurasi Numerik RK4 terhadap Rumus Referensi Modul** (30 poin)
4. **Penguasaan Konsep Kuis Pasca-Lab** (15 poin)
5. **Sintesis Kesimpulan Berbasis Bukti Data** (15 poin)

Hasil evaluasi disimpan sebagai JSON terstruktur (`rubric_json`) di tabel `gradebook_entries`, ditampilkan secara transparan pada *drawer* rincian rubrik di **Teacher Gradebook Hub**, dan dapat diekspor ke CSV yang kompatibel dengan Excel/Google Classroom (dilengkapi prefix UTF-8 BOM `\uFEFF` serta sanitasi *formula injection* `=`, `+`, `-`, `@`).
