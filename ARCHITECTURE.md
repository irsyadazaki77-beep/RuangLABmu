# RuangLABmu — System Architecture & Production Blueprint

**RuangLABmu** adalah platform laboratorium sains virtual 3D interaktif (Fisika, Kimia, Biologi, dan Astronomi) yang dirancang khusus untuk ketahanan jaringan sekolah di wilayah 3T (Terdepan, Terluar, Tertinggal), kolaborasi kelas berbasis PIN multi-pengguna, evaluasi rubrik numerik otomatis berbasis integrator Runge-Kutta Orde 4 (RK4), dan pendampingan AI Sokratis hibrida (Daring & Luring).

---

## 1. Tumpukan Teknologi (Technology Stack)

| Lapisan | Teknologi & Pustaka Utama | Peran Arsitektural |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 19 + TypeScript (`strict: true`) + Vite 6 | UI deklaratif dengan *domain-level code-splitting* (`React.lazy` + `Suspense`) untuk modul Fisika, Kimia, Biologi, dan Astronomi. |
| **State Management** | Zustand + `useShallow` | Penyimpanan reaktif tersegmentasi (`useLabStore`, `useUIStore`, `useCollabStore`) tanpa *unnecessary re-render* pada loop 60 FPS. |
| **3D Spatial & WebXR** | Three.js + PostProcessing + WebXR | Mesin visualisasi 3D PBR (`ACESFilmicToneMapping`, `toneMappingExposure = 0.98`, `SRGBColorSpace`), gelas borosilikat IOR 1.47, *3D measurement tools* (mistar, busur derajat, probe digital), dan *WebGL Context-Loss ErrorBoundary*. |
| **Numerical Solver** | Web Worker (`src/workers/simulation.worker.ts`, `src/workers/domains/*`, `src/workers/integrators/*`) | Integrator persamaan diferensial biasa **Runge-Kutta Orde 4 (`rk4.ts`)** dan **Velocity Verlet Simlektik (`verlet.ts`)** *off-main-thread* dengan solver per domain (`physics.ts`, `chemistry.ts`, `biology.ts`, `astronomy.ts`), `SharedArrayBuffer` ring buffer (`simulationBuffer.ts`), dan *timeline scrubber* (`simulationTimelineBuffer.ts`). |
| **Backend & WebSocket** | Express + `ws` (`server.ts`, `server/ws/*`) | Server HTTP + WebSocket (`/ws-lab`) dengan heartbeat `ping`/`pong` 30 detik, proteksi anti-*role-escalation*, sanitasi PIN, sinkronisasi kursor 3D, penguncian parameter (*parameter locks*), `PARAM_LOCK_RESET_ALL`, pembekuan layar oleh guru (*teacher freeze*), dan *custom AI mission broadcast*. |
| **Database Layer** | `bun:sqlite` / `node:sqlite` (`server/db/database.ts`) | Penyimpanan relasional persisten dengan `PRAGMA journal_mode = WAL;` dan `PRAGMA foreign_keys = ON;` untuk tabel `rooms`, `participants`, `simulation_snapshots`, dan `gradebook_entries`. |
| **Auto-Grading Engine** | `src/shared/grading/rubricEngine.ts` | Mesin penilaian rubrik deterministik yang memvalidasi hipotesis, kelengkapan tabel observasi, deviasi numerik RK4, kuis pasca-lab, dan sintesis kesimpulan. |

---

## 2. Aliran Data Simulasi: Modular RK4/Verlet Worker → Zustand `useShallow` → Three.js Render Loop

```text
[TactileParameterControl / PrecisionSlider (Slider / Input Numerik / Fine Step)]
       │
       ▼ (Acquire Lock via WebSocket + Update Store)
[Zustand Store (useLabStore / useShallow)]
       │
       ├──► [useSimulationSync.ts] ──(Throttled Snapshot)──► [SQLite: simulation_snapshots]
       │
       ▼ (PostMessage / Zero-Copy SharedArrayBuffer Ring Buffer)
[Modular Web Worker (src/workers/simulation.worker.ts)]
  • Integrator Murni (src/workers/integrators/):
      - rk4.ts    : Runge-Kutta Orde 4 (k1, k2, k3, k4)
      - verlet.ts : Symplectic Velocity Verlet
  • Solver Domain (src/workers/domains/):
      - physics.ts, chemistry.ts, biology.ts, astronomy.ts
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

---

## 6. Hardening Keamanan WebSocket/REST & Ketahanan Heartbeat 3T

1. **Pencegahan *Role Escalation* & Sanitasi PIN (`server/ws/wsRoomManager.ts` & `server/utils/collabReconnectSync.ts`)**:
   - `handleRoomJoin` tidak pernah mempercayai `payload.role` (`'teacher'` / `'Pengajar'`) dari klien secara mentah. Klaim akses pengajar wajib diverifikasi melalui `verifyTeacherAuthorization` (`src/utils/submissionPersistence.ts`). Bila tidak terotorisasi, server menolak klaim dengan `ROOM_ERROR` (`code: 'UNAUTHORIZED_TEACHER_ROLE'`) dan memaksa peran menjadi `'Siswa'`.
   - `handleRoomJoin` membatasi percobaan PIN salah menggunakan *attempt limiter* per-IP/per-socket (`MAX_JOIN_PIN_ATTEMPTS = 5` per 60 detik) sebelum memblokir sementara dengan kode `RATE_LIMITED`.
   - Seluruh broadcast `ROOM_STATE_SYNC`, `ROOM_JOINED`, dan `ROOM_MISSION_UPDATED` disanitasi menggunakan `sanitizeRoomForBroadcast` sehingga field `pin` dan `pinHash` tidak pernah diekspos ke publik (`pin` hanya dikirim pada respons privat `ROOM_CREATED` ke pembuat ruangan).

2. **WebSocket Heartbeat `ping`/`pong` 30 Detik & `PARAM_LOCK_RESET_ALL` (`server/ws/collabSocketServer.ts` & `server/ws/wsSpatialSync.ts`)**:
   - Setiap koneksi WebSocket ditandai `isAlive = true` saat terhubung dan saat menerima frame `pong`.
   - Interval `WS_HEARTBEAT_INTERVAL_MS` (`30_000 ms`) menjalankan `runWsHeartbeatSweep`: koneksi zombie pada jaringan 3T (`isAlive === false`) diterminasi (`ws.terminate()`) dan dibersihkan via `cleanupSocketRoomAndLocks(ws, services)` sehingga tidak menyandera `parameterLocks` maupun `room.teacherSocketId`.
   - Event `PARAM_LOCK_RESET_ALL` memungkinkan pengajar terotorisasi melepas seluruh kunci parameter di ruangan secara instan bila perangkat siswa mengalami *hang*.

3. **Proteksi Endpoint REST (`server/routes/labRoutes.ts`)**:
   - `POST /api/rooms/rejoin` dilindungi oleh `express-rate-limit` (`windowMs: 60_000`, `max: 20`) berbasis `rateLimitKeyGenerator` (`server/utils/rateLimitKey.ts`) untuk mencegah *brute-force* kombinasi `roomPin` dan `participantId`.
   - `POST /api/session/autosave` memvalidasi kepemilikan sesi melalui kecocokan `storageKey` dengan `studentId` serta pengikatan token pemilik (`X-Session-Token` / `sessionToken` yang disimpan sebagai `ownerTokenHash`), menolak penimpaan sesi oleh klien lain dengan `403 Forbidden` (`SESSION_OWNERSHIP_MISMATCH`) dan menolak versi usang dengan `409 Conflict` (`stale_rejected`).

---

## 7. Fondasi Enterprise Production: Shared Zod, Migrasi SQLite, Structured Logging & SRE Probes

1. **Shared Zod Contracts (`src/shared/contracts/wsContracts.ts` & `src/shared/contracts/restContracts.ts`)**:
   - Seluruh tipe dan skema payload REST (`AutosavePayloadSchema`, `RoomRejoinSchema`, `RoomSnapshotSchema`, `GenerateMissionSchema`, `SubmissionCreateSchema`, `VisionDiagnoseSchema`, dll.) serta WebSocket (`ClientToServerMessageSchema` & `ServerToClientMessageSchema` menggunakan `z.discriminatedUnion('type', [...])`) didefinisikan dari satu sumber kebenaran (*Single Source of Truth*).
   - Validasi di batas server (`server/utils/routePayloadValidators.ts` & `server/ws/collabSocketServer.ts`) menolak payload tidak valid dengan respons `400 Bad Request` terstruktur (`{ error: 'VALIDATION_ERROR', code: 'INVALID_PAYLOAD', issues, details }`) pada REST atau frame `{ type: 'ERROR', payload: { code: 'VALIDATION_ERROR', message, issues } }` pada WebSocket.
   - Hook frontend (`src/hooks/useBackendSync.ts`) ikut memvalidasi pesan masuk melalui `ServerToClientMessageSchema.safeParse`.

2. **Migrasi SQLite Terversi, Backup `VACUUM INTO` & Siklus Hidup WAL (`server/db/migrator.ts`, `server/db/migrations/`)**:
   - Skema SQLite dikelola melalui berkas migrasi SQL bernomor urut (`001_initial_schema.sql`, dst.) yang dilacak di tabel `schema_migrations` (`version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT`).
   - Setiap skrip migrasi dijalankan secara atomik di dalam transaksi `db.transaction` dengan *idempotency check*.
   - Fungsi `backupDatabase(source, destPath)` mengeksekusi `VACUUM INTO ?` secara aman tanpa mengunci operasi baca WAL aktif.
   - *Graceful shutdown* (`SIGINT`/`SIGTERM` melalui `createGracefulShutdownHandler` di `server.ts`) mengirim kode tutup WebSocket `1001`, menutup server HTTP, menjalankan `PRAGMA wal_checkpoint(TRUNCATE);`, dan menutup koneksi database dengan bersih. Volume persisten dikonfigurasi pada `fly.toml` (`[[mounts]]` -> `/app/data`) dan `render.yaml` (`disk:` -> `/app/data`).

3. **Structured JSON Logging & Korelasi Permintaan (`server/utils/logger.ts`)**:
   - Seluruh log backend dicetak sebagai JSON satu baris terstruktur (`timestamp`, `level`, `service`, `message`, konteks tambahan) yang dikendalikan oleh `LOG_LEVEL` (`debug | info | warn | error`).
   - `requestCorrelationMiddleware` menyisipkan dan menyebarkan header `X-Request-Id` untuk pelacakan permintaan end-to-end.
   - Redaksi rekursif (`sanitizeLogValue` / `sanitizeLogContext`) secara otomatis menyensor (`[REDACTED]` / `[REDACTED_API_KEY]`) setiap field sensitif (`pin`, `roomPin`, `teacherPin`, `pinHash`, `sessionToken`, `teacherToken`, `metricsToken`, `authorization`, `apiKey`, pola `AIza...`, serta email/telepon/alamat) sebelum serialisasi JSON.

4. **SRE Probes (`/healthz`, `/readyz`, `/metrics`) (`server/routes/healthRoutes.ts`)**:
   - `GET /healthz`: *Liveness probe* ringan (`200 OK`, `uptimeSeconds`, `timestamp`).
   - `GET /readyz`: *Readiness probe* yang memverifikasi `SELECT 1` pada SQLite, kesiapan `WebSocketServer`, dan status *shutting down* (`503` saat draining, `200` saat siap); dijadikan target `healthCheckPath` di `fly.toml`, `render.yaml`, dan `Dockerfile`.
   - `GET /metrics`: Melaporkan metrik runtime (`activeRooms`, `connectedClients`, `activeParameterLocks`, `memoryRssMb`, `heapUsedMb`, `sqliteWalSizeBytes`). Pada mode `production`, endpoint ini wajib diautentikasi menggunakan Bearer token (`METRICS_TOKEN`).

