# SimuLab Sains — Modernisasi UI Interaktif & Ruang Kerja Eksperimen Adaptif

Transformasi antarmuka laboratorium virtual SimuLab Sains (Fisika, Kimia, Astronomi, Analitik LKS, dan Dashboard Pengajar) menjadi ruang kerja sains modern berpresisi tinggi dengan tema adaptif Light/Dark Glassmorphism, manipulasi kanvas secara langsung, efek audio sintetis laboratorium, serta fitur perbandingan eksperimen berdampingan (A/B).

### User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh keputusan desain di bawah ini disusun berdasarkan preferensi yang telah Anda konfirmasi dan siap dieksekusi tanpa menghilangkan fitur simulasi, perhitungan ilmiah, maupun sinkronisasi kolaborasi real-time yang sudah berjalan.

- **Tema Adaptif Light & Dark Glassmorphism (Terkonfirmasi)**: Menyediakan pengalih tema instan (Light Mode klinis `#F8FAFC` dan Dark Mode observatorium `#0B0E17`) dengan permukaan panel *translucent backdrop-blur* halus, batas garis rambut (*hairline border* 1px), serta kontras WCAG AA di seluruh komponen.
- **Tata Letak Split-Screen dengan HUD Mengambang & Dock Bawah (Terkonfirmasi)**: Mengatur ulang ruang kerja praktikum menjadi proporsi kanvas visual dominan (65% lebar) dengan kartu telemetri HUD mengambang di sudut kanvas, bilah pemutar waktu (*timeline scrubber* & *playback dock*) melayang di bagian bawah kanvas, serta dek kalibrasi parameter yang ringkas dan terstruktur di sisi samping (35% lebar).
- **Manipulasi Langsung di Kanvas, Audio Sintetis & Mode Perbandingan A/B (Terkonfirmasi)**:
  - *Direct Canvas Manipulation*: Siswa dapat menyeret langsung objek atau vektor di kanvas 2D/3D (seperti sudut bidang miring, vektor kecepatan projektil, simpangan pegas Hooke, keran buret titrasi, atau jari-jari orbit planet) dengan kursor *crosshair* dan umpan balik koordinat instan.
  - *Synthesized Lab Sound Effects*: Umpan balik suara prosedural menggunakan Web Audio API murni (tanpa berkas audio eksternal) untuk dentuman tumbukan, osilasi pegas, tetesan buret titrasi, dengung orbit, dan notifikasi pencatatan data (dilengkapi tombol Mute/Unmute).
  - *Side-by-Side Experiment Comparison (Mode A/B)*: Mode pembanding langsung antara *Konfigurasi Saat Ini (Live)* dengan *Snapshot Referensi (Baseline)* atau rekaman tabel log sebelumnya, menampilkan selisih metrik ($\Delta$) secara berdampingan.

---

### 1. Overview & Core Concept

- **What It Does**: Menghadirkan pengalaman laboratorium sains interaktif generasi baru yang memadukan estetika instrumen ilmiah modern dengan kemudahan eksplorasi langsung di atas kanvas untuk 11 mode simulasi (5 Fisika, 3 Kimia, 3 Astronomi), lembar kerja otomatis (LKS), dan pemantauan guru secara real-time.
- **Target Audience / Persona**: Siswa SMA/SMK, Mahasiswa S1 Sains & Teknik, serta Pengajar/Dosen yang membutuhkan laboratorium virtual yang responsif, bebas kesan kaku, dan intuitif.
- **Key Value**: Meningkatkan keterlibatan belajar melalui interaksi sentuh/seret langsung pada objek eksperimen, perbandingan langsung dua skenario ilmiah ($\Delta$ variabel), dan kenyamanan visual di ruangan terang maupun gelap.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Kalibrasi Tema, Audio & Tingkat Akademik**: Pengguna beralih antara Light/Dark Mode, mengaktifkan/mematikan efek suara laboratorium (Web Audio API), atau mengganti mode Siswa SMA/SMK vs Mahasiswa S1 dari pita kontrol ruang kerja tanpa memuat ulang halaman.
  2. **Interaksi Langsung di Kanvas & Dock Bawah**: Di dalam kanvas simulasi, pengguna dapat mengklik dan menyeret langsung elemen fisik (misal menarik balok pegas, mengubah sudut peluncuran projektil, atau memutar keran titrasi) sambil memantau perubahan vektor dan kurva secara langsung, atau mengontrol jalannya waktu (`Play`, `Pause`, `Step`, `Kecepatan 0.5x–2x`, `Reset`) dari *Floating Bottom Dock*.
  3. **Mode Perbandingan Eksperimen Berdampingan (A/B Comparison)**: Pengguna menekan tombol **Bandingkan Skenario (A/B)** untuk membekukan parameter saat ini sebagai *Skenario A (Baseline)*, lalu mengubah parameter untuk *Skenario B (Eksperimen Aktif)* dan melihat perbandingan grafik/metrik secara berdampingan lengkap dengan indikator selisih ($\Delta$).
  4. **Pencatatan Satu Klik & Evaluasi LKS**: Saat menekan **Rekam Data**, antarmuka memberikan umpan balik suara klik instrumen dan animasi transisi mulus ke lencana log data serta memperbarui garis regresi OLS ($R^2$).

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Precision Scientific Glass & Telemetry Workbench** — memadukan ketegasan instrumen laboratorium dan observatorium antariksa dengan panel kaca akrilik halus (`backdrop-blur-md`).
  - *Color Palette & Mood (60-30-10 Discipline)*:
    - **60% Dominant Canvas**: Pristine Lab Slate (`#F8FAFC`) pada Light Mode dan Deep Space Obsidian (`#07090E` / `#0B0E17`) pada Dark Mode.
    - **30% Structural Surfaces & Glass HUD**: Panel struktural `bg-white/85 dark:bg-slate-900/80` dengan batas garis rambut 1px (`border-slate-200/80 dark:border-slate-800/80`).
    - **10% Semantic Focal Accents**: Laser Cyan / Azure (`#0284C7` / `#06B6D4`) untuk kontrol aktif dan vektor utama, Emerald (`#059669` / `#10B981`) untuk status `● NOMINAL`, Amber (`#D97706` / `#F59E0B`) untuk `▲ PERHATIAN`, dan Coral Rose (`#E11D48` / `#F43F5E`) untuk `✖ KRITIS`.
  - *Typography & Hierarchy*:
    - **Display & UI Labels**: `Plus Jakarta Sans` (SemiBold/Bold dengan `text-wrap: balance` dan kompensasi optik pada mode gelap).
    - **Telemetry, Coordinates & Equations**: `IBM Plex Mono` dengan `tabular-nums` wajib pada seluruh angka metrik, pembacaan waktu, koordinat kursor, dan tabel data agar tidak terjadi pergeseran tata letak (*layout jitter*) saat angka berubah cepat.
    - **Zero-Pill Metadata Discipline**: Seluruh informasi metadata statis (unit, waktu, kategori, status koneksi) ditampilkan sebagai teks bersih dengan pemisah tipografi (`·` atau `/`) tanpa kapsul dekoratif berlebihan, sementara tombol filter dan tab mode tetap menggunakan *segmented control* interaktif yang tegas.
  - *Component Styling & Layout*:
    - **Top Bar Contract (3 Zona Ketat)**: Zona 1 menampilkan wordmark `SimuLab Sains` satu baris; Zona 2 menampilkan 5 tautan navigasi utama satu baris dengan indikator garis bawah aktif yang mulus; Zona 3 menampilkan tombol aksi utama `Ekspor CSV`.
    - **Asymmetric Split-Screen Workbench**: Kanvas interaktif menempati area utama di sebelah kiri/atas dilengkapi *Floating Telemetry HUD* di sudut atas dan *Playback & Camera Dock* mengambang di bagian bawah, didampingi *Parameter & Concept Deck* di sebelah kanan.

- **Interactive Feedback & Motion**:
  - Transisi antar-tab, pembukaan panel perbandingan A/B, dan perubahan nilai metrik menggunakan animasi halus (`transform` dan `opacity` $\le 200\text{ms}$ dengan kurva `cubic-bezier(0.16, 1, 0.3, 1)`).
  - Kursor kanvas berubah menjadi `cursor-crosshair` atau `cursor-grab`/`cursor-grabbing` saat berada di atas titik kontrol objek yang dapat diseret langsung di kanvas 2D disertai tooltip koordinat $(x, y)$ real-time.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Sintesis Audio Laboratorium Berbasis Web Audio API Murni**
  - *Chosen Approach*: Membangun modul synthesizer audio prosedural berbasis `AudioContext` bawaan peramban (osilator gelombang sinus/segitiga dan *filtered noise* terukur) dengan tombol kontrol bisukan (*Mute/Unmute*).
  - *Why*: Menghasilkan efek suara tumbukan fisika, pegas harmonik, tetesan titrasi kimia, dan sinyal telemetri astronomi dengan latensi nol serta bebas risiko gagal muat aset eksternal.
  - *Alternatives Considered*: Memuat file MP3 eksternal (berisiko gagal dimuat di jaringan terbatas dan menambah beban unduhan).

- **Decision 2: Mode Perbandingan Berdampingan (A/B Snapshot & Delta Engine)**
  - *Chosen Approach*: Menyediakan fitur *Pin Baseline Snapshot* pada setiap laboratorium (Fisika, Kimia, Astronomi) sehingga pengguna dapat menyematkan kondisi eksperimen A dan membandingkannya secara berdampingan dengan kondisi eksperimen B yang sedang berjalan, lengkap dengan kartu perbandingan metrik $\Delta$ dan kurva *overlay*.
  - *Why*: Memungkinkan siswa membuktikan hipotesis ilmiah secara visual (misal: lintasan projektil di Bumi vs Mars, pH titrasi dengan konsentrasi berbeda, atau kurva rotasi galaksi dengan vs tanpa Materi Gelap) tanpa harus bolak-balik mencatat manual.
  - *Alternatives Considered*: Merender dua kanvas WebGL 3D secara bersamaan (dapat menurunkan *frame rate* GPU pada perangkat laptop sekolah standar). Dengan menggabungkan *overlay* kurva pada kanvas dan panel komparasi berdampingan A/B, performa tetap 60 FPS.

- **Decision 3: Manipulasi Langsung (*Direct Canvas Dragging*) + Scrubbing Presisi**
  - *Chosen Approach*: Menambahkan deteksi *hit-target* pointer (`onPointerDown`, `onPointerMove`, `onPointerUp`) pada kanvas 2D untuk menyeret parameter kunci secara visual, yang tersinkronisasi dua arah dengan slider presisi dan tombol stepper `-/+`.
  - *Why*: Memberikan sensasi taktilitas laboratorium nyata sekaligus mempertahankan akurasi angka desimal ketika siswa mengerjakan soal LKS.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   App Root & Theme / Audio Context Shell                   │
│  ┌──────────────────────┐  ┌────────────────────────┐  ┌────────────────┐  │
│  │ 3-Zone Top Bar       │  │ Workspace Calibration  │  │ Web Audio API  │  │
│  │ (Brand · Nav · CSV)  │  │ (Light/Dark · Sound ·  │  │ Lab Synth      │  │
│  │                      │  │  SMA/S1 · A/B Toggle)  │  │ Engine         │  │
│  └──────────┬───────────┘  └───────────┬────────────┘  └───────┬────────┘  │
└─────────────┼──────────────────────────┼───────────────────────┼───────────┘
              │                          │                       │
              ▼                          ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                Interactive Split-Screen Lab Workbench                      │
│                                                                            │
│  ┌───────────────────────────────────────────┐  ┌───────────────────────┐  │
│  │ Main Interactive Stage (65% Viewport)     │  │ Parameter & Concept   │  │
│  │                                           │  │ Deck (35% Viewport)   │  │
│  │  ┌─────────────────────────────────────┐  │  │                       │  │
│  │  │ Floating Glass HUD Overlay          │  │  │ • Guided Mission Tabs │  │
│  │  │ (Live Tabular Telemetry & Status)   │  │  │ • Grouped Sliders &   │  │
│  │  └─────────────────────────────────────┘  │  │   -/+ Fine Steppers   │  │
│  │                                           │  │ • A/B Comparison      │  │
│  │  • 2D Direct-Drag Canvas / 3D WebGL       │  │   Snapshot & Δ Cards  │  │
│  │  • Crosshair Coordinate Probe             │  │ • Concept & Formula   │  │
│  │  • Baseline Ghost Trajectory Overlay      │  │   Interactive Card    │  │
│  │                                           │  │ • One-Click Record &  │  │
│  │  ┌─────────────────────────────────────┐  │  │   WebSocket Sync      │  │
│  │  │ Floating Bottom Dock                │  │  └───────────────────────┘  │
│  │  │ (Play/Pause · Speed · 2D/3D · Reset)│  │                             │
│  │  └─────────────────────────────────────┘  │                             │
│  └───────────────────────────────────────────┘                             │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│         Multi-Axis OLS Regression, Auto-Graded LKS & Teacher Matrix        │
│  • Dual-Theme SVG Regression Charts with Crosshair Snapping                │
│  • 6-Question Auto-Graded LKS & Real-Time WebSocket Broadcast (/ws-lab)    │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `themeMode`: `'light' | 'dark'` (disimpan di `localStorage` dan disinkronkan dengan kelas `.dark` pada `document.documentElement`).
  - `soundEnabled`: `boolean` (mengontrol synthesizer Web Audio API untuk efek interaksi tombol, pegas, tumbukan, tetesan titrasi, dan pencatatan data).
  - `comparisonSnapshots`: Menyimpan *snapshot* parameter dan metrik hasil perhitungan (`physicsBaseline`, `chemistryBaseline`, `astronomyBaseline`) untuk menghitung selisih ($\Delta = \text{Live} - \text{Baseline}$) secara instan pada mode perbandingan berdampingan A/B.
  - `pointerDragState`: State lokal kanvas yang memetakan posisi pointer $(x, y)$ ke variabel fisik (sudut kemiringan $\theta$, vektor kecepatan awal $v_0$ dan $\angle$, simpangan pegas $\Delta x$, volume titran $\text{mL}$, atau sumbu semi-mayor orbit $a$).

- **Interactive Component & State Mapping**:
  - **Pengalih Tema Light/Dark & Audio**: Memperbarui kelas `.dark` pada root dokumen dan memicu bunyi konfirmasi lembut jika audio aktif; seluruh permukaan kanvas, grafik regresi, dan kartu otomatis menyesuaikan kontras warna.
  - **Manipulasi Kanvas Langsung (Pointer Drag)**: Saat pengguna menyeret titik kontrol pada kanvas 2D, handler `onPointerMove` mengonversi koordinat piksel ke nilai ilmiah terkalibrasi, memperbarui parameter simulasi secara real-time, dan memicu suara umpan balik halus sesuai perubahan nilai.
  - **Floating Bottom Dock**: Mengendalikan siklus animasi (`isPlaying`), pengali kecepatan waktu (`0.5x`, `1x`, `2x`), peralihan kamera `2D Vektor` vs `3D Interaktif`, perataan lapisan vektor, serta tombol cepat penyematan *Snapshot A/B*.
  - **Panel Perbandingan Berdampingan (A/B Mode)**: Saat diaktifkan, menampilkan kartu perbandingan berdampingan antara *Skenario A (Disematkan)* dan *Skenario B (Aktif)* dengan kalkulasi selisih numerik dan persentase perubahan otomatis, serta menggambar bayangan lintasan referensi (*ghost curve*) di atas kanvas.
