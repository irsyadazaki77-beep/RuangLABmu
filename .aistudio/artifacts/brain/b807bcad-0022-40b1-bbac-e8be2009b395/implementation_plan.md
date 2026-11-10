# Pengembangan & Penyempurnaan Fitur serta Visual RuangLABmu (SimuLab)

Meningkatkan pengalaman imersif dan kedalaman ilmiah **RuangLABmu (SimuLab)** melalui penyempurnaan visual 3D WebGL (kamera sinematik dengan transisi mulus, HUD telemetri langsung di atas kanvas, dan efek partikel/shader dinamis), serta penambahan empat fitur fungsional baru: **Pemutar Ulang & Tangkapan Layar 3D ke Laporan**, **Simulasi Komparasi Berdampingan (A/B Run)**, **Generator Skenario Tantangan & Asisten Suara Dr. LabMu**, dan **Papan Peringkat Kelas beserta Lencana Pencapaian Praktikum**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh fitur baru dirancang menyatu dengan tata letak bersih yang sudah ada (**Pengungkapan Bertahap / Progressive Disclosure**) tanpa menumpuk panel yang menghalangi ruang pandang 3D.

- **Keputusan Terkonfirmasi 1 (Cakupan Peningkatan Menyeluruh)**: Mengembangkan keempat pilar aplikasi — **Visual 3D WebGL & Pencahayaan**, **Instrumen Interaktif Simulasi**, **Visualisasi Grafik Analitik & LKS**, serta **Dashboard Pengajar, Kolaborasi & Laporan Akademik**.
- **Keputusan Terkonfirmasi 2 (Prioritas Visual 3D)**: Menghadirkan **Transisi Kamera Sinematik Berperedam (*Smooth Damped Camera Presets*)**, **HUD Telemetri Langsung di Kanvas 3D** (vektor real-time, indikator energi/reaksi, dan kontrol pengambilan foto 3D), serta **Efek Partikel & Pencahayaan Dinamis**.
- **Keputusan Terkonfirmasi 3 (4 Fitur Fungsional Baru)**:
  1. **Tangkapan Layar 3D & Pemutar Ulang Rekaman (*3D Snapshot & Trial Replay*)** yang dapat disematkan langsung ke **Laporan Akademik A4**.
  2. **Simulasi Komparasi Berdampingan (*A/B Run Overlay*)** untuk membandingkan lintasan/kurva Percobaan A (Baseline) dengan Percobaan B (Aktif) secara langsung di ruang simulasi dan grafik.
  3. **Generator Tantangan Otomatis (*Smart Challenge Generator*) & Asisten Suara Interaktif Dr. LabMu** untuk memandu analisis ilmiah dengan narasi suara Bahasa Indonesia.
  4. **Papan Peringkat Kelas (*Live Class Leaderboard*) & Lencana Pencapaian (*Scientific Badges*)** yang tersinkronisasi antara lobi siswa, bilah progres, dan dashboard pengajar.

---

## 1. Overview & Core Concept

- **Apa yang Dikembangkan & Disempurnakan**:
  1. **Ruang 3D Sinematik & HUD Telemetri Langsung**:
     - Pergerakan kamera antar-preset (*Isometrik, Depan, Atas, Fokus Objek, Orbit Sinematik*) kini bergerak mulus dengan interpolasi eksponensial (*smooth damping*), bukan berpindah patah-patah.
     - Menambahkan **HUD Telemetri Ringkas di Sudut Kanvas 3D** yang menampilkan metrik kunci secara *real-time*, bar perbandingan energi (Kinetik vs Potensial / Eksotermik vs Endotermik), serta tombol **"Ambil Foto 3D"** untuk menangkap gambar kanvas WebGL resolusi penuh.
     - Menyempurnakan efek visual partikel dan pencahayaan (jejak lintasan bercahaya, partikel gelembung/termal reaksi kimia, pendaran fotosintesis biologi, dan korona bintang astronomi).
  2. **Tangkapan Layar 3D & Pemutar Ulang Rekaman ke Laporan Akademik**:
     - Siswa dapat mengambil tangkapan layar 3D (*3D Canvas Snapshot*) beserta cap waktu dan parameter aktif, menyimpannya ke galeri percobaan, memutar ulang kondisi parameter rekaman sebelumnya (*Replay Trial*), dan menyertakan foto 3D tersebut ke dalam **Pratinjau & Cetak Laporan Akademik A4**.
  3. **Simulasi Komparasi Berdampingan (Mode A/B Run)**:
     - Siswa dapat mengunci satu konfigurasi sebagai **Percobaan A (Acuan / Baseline)** lalu mengubah variabel untuk menjalankan **Percobaan B (Eksperimen Aktif)**.
     - Ruang simulasi dan panel analitik menampilkan perbandingan delta secara langsung ($\Delta a$, $\Delta R$, $\Delta \text{pH}$, $\Delta T$) beserta kurva bayangan (*ghost curve*) agar siswa dapat mengamati pengaruh perubahan satu variabel secara visual.
  4. **Generator Tantangan Otomatis & Asisten Suara Dr. LabMu**:
     - Menghadirkan fitur **"Tantangan Kilat (*Target Challenge*)"** di kokpit simulasi yang meminta siswa mencapai target terukur (misal: *"Atur sudut & kecepatan agar projektil mendarat tepat di 45.0 m ± 1.0 m"* atau *"Capai pH netral 7.00 ± 0.15"*), lengkap dengan verifikasi otomatis saat target tercapai.
     - Melengkapi **Dr. LabMu** dengan fitur **Narasi Suara Interaktif (*Text-to-Speech Bahasa Indonesia*)** dan tombol analisis cepat satu klik untuk membacakan penjelasan konsep maupun diagnosis regresi.
  5. **Papan Peringkat Kelas & Lencana Pencapaian Praktikum**:
     - Memberikan **Lencana Kompetensi Ilmiah** (seperti *Pelopor K3*, *Analis Presisi $R^2 > 0.98$*, *Penakluk Tantangan Kilat*, dan *Detektif Sampel Misteri*) yang tampil di Lobi Katalog dan Header Progres, serta **Papan Peringkat Kelas & Kelompok** di Dashboard Pengajar dan halaman Kolaborasi.
- **Target Pengguna**: Siswa SMP, SMA, dan Mahasiswa yang melaksanakan praktikum sains virtual, serta Pengajar yang mengevaluasi ketelitian eksperimen kelas.
- **Nilai Utama**: Mengubah simulasi laboratorium menjadi pengalaman eksplorasi ilmiah yang hidup, terukur, interaktif secara visual, dan memotivasi siswa melalui tantangan berbasis bukti nyata.

---

## 2. User Experience & Visual Design

### Alur Pengguna pada Fitur Baru & Visual yang Disempurnakan

1. **Eksplorasi Kokpit 3D Sinematik & HUD Telemetri (Tahap 2)**:
   - Saat siswa memilih sudut kamera (*Isometrik, Depan, Atas, Fokus, atau Orbit Sinematik*), kamera meluncur secara halus menuju titik fokus objek.
   - Di atas kanvas 3D tampil **HUD Telemetri Transparan** yang menyajikan pembacaan sensor utama dengan angka tabular presisi, indikator keseimbangan energi, serta tombol **"Kamera Foto 3D"**.
   - Siswa dapat mengaktifkan tombol **"Bandingkan A/B (Pin Baseline)"** untuk menyimpan kondisi saat ini sebagai acuan dan melihat selisih persentase perubahan secara *real-time* saat *slider* digeser.
2. **Tantangan Kilat Otomatis & Asisten Suara Dr. LabMu**:
   - Siswa dapat menekan tombol **"Buat Tantangan Kilat"** di kokpit untuk mendapatkan misi eksperimen acak sesuai modul aktif. Begitu pembacaan simulasi memenuhi rentang target, muncul konfirmasi keberhasilan dan poin lencana otomatis bertambah.
   - Di panel **Dr. LabMu**, siswa dapat menekan ikon **Suara Narasi** agar penjelasan konsep, rumus, dan umpan balik grafik dibacakan secara jelas dalam Bahasa Indonesia.
3. **Visualisasi Grafik Analitik Multi-Kurva & Tangkapan 3D (Tahap 3 & 4)**:
   - Grafik regresi di Tahap 3 dilengkapi dengan **Penanda Anomali/Titik Puncak**, perbandingan kurva A/B, serta ringkasan interpretasi fisik otomatis di bawah grafik.
   - Di Tahap 4 (Laporan Akademik), seluruh **Tangkapan Layar 3D** yang diambil siswa selama praktikum otomatis terlampir di bagian **Lampiran Bukti Visual 3D** pada dokumen Laporan A4 siap cetak.
4. **Pencapaian Siswa & Papan Peringkat Kelas (Lobi & Dashboard Pengajar)**:
   - Siswa dapat melihat koleksi **Lencana Pencapaian Praktikum** yang berhasil dibuka beserta skor ketelitian mereka.
   - Pengajar memiliki akses ke **Papan Peringkat Kelas & Kelompok** berdasarkan skor gabungan (Ketelitian Regresi $R^2$, Kelengkapan Data, Skor LKS, dan Tantangan Kilat).

### Identitas Visual & Tema
- **Aesthetic Direction**: *High-Precision Scientific Observatory* — memadukan estetika instrumen laboratorium modern dengan pencahayaan studio 3D yang tajam, tipografi bersih, dan hirarki data bebas distraksi.
- **Color Palette & Mood**:
  - **60% Kanvas Netral**: `#0B1120` / `#0F172A` pada mode gelap dan `#F8FAFC` pada mode terang.
  - **30% Permukaan Struktural**: Panel berlapis batas tipis `1px` (`border-slate-200 dark:border-slate-800`) dengan permukaan solid/semi-transparan yang aman untuk performa WebGL.
  - **10% Aksen Semantik**: Biru Sains (`#0EA5E9`) untuk navigasi dan Percobaan B, Kuning Amber (`#F59E0B`) untuk acuan Percobaan A & Tantangan Kilat, serta Hijau Zamrud (`#10B981`) untuk indikator target tercapai.
- **Typography & Hierarchy**:
  - Judul tampilan menggunakan proporsi geometris tegas (`Plus Jakarta Sans` / `Outfit`), teks penjelasan yang nyaman dibaca, serta seluruh angka telemetri, koordinat 3D, dan papan peringkat wajib menggunakan `font-mono tabular-nums`.
  - Metadata menggunakan pemisah tipografi bersih (`·`) tanpa tumpukan kapsul dekoratif.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Interpolasi Kamera Berperedam (*Exponential Damping*) & HUD bebas `backdrop-blur` berat di atas Kanvas 3D**
  - *Pendekatan Terpilih*: Menggunakan perhitungan `THREE.MathUtils.damp` di dalam *render loop* untuk transisi kamera sinematik serta menggunakan permukaan HUD semi-solid berperforma tinggi tanpa efek *blur* berlapis di atas kanvas WebGL.
  - *Mengapa*: Menjamin pergerakan kamera terasa berbobot layaknya kamera studio nyata sekaligus menjaga *frame rate* WebGL tetap mulus di berbagai perangkat.
- **Keputusan 2: Tangkapan Layar Kanvas 3D Langsung (*Direct WebGL Frame Capture*)**
  - *Pendekatan Terpilih*: Menjalankan satu siklus *render* tepat sebelum memanggil `canvas.toDataURL('image/png')` ketika siswa menekan tombol **"Ambil Foto 3D"**, lalu menyimpan hasilnya di state sesi untuk dilampirkan ke Laporan Akademik A4.
  - *Mengapa*: Memastikan gambar 3D yang tertangkap tidak pernah kosong (*blank buffer*) dan langsung siap dicetak di laporan praktikum tanpa perlu aplikasi tambahan.
- **Keputusan 3: Mode Komparasi A/B Berbasis Snapshot Ringan**
  - *Pendekatan Terpilih*: Menyimpan snapshot parameter dan metrik hasil perhitungan pada **Slot A (Baseline)** dan menyandingkannya secara langsung dengan **Slot B (Simulasi Aktif)** melalui kartu komparasi delta dan garis kurva pembanding.
  - *Mengapa*: Memberikan kemampuan analisis komparatif A/B secara instan pada keempat laboratorium tanpa menggandakan beban memori WebGL dengan dua kanvas 3D terpisah.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Diagram Arsitektur Fitur & Alur Data

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     STATE UTAMA & ENGINE SAINS (App)                         │
│  • Galeri Foto 3D (Snapshots)      • Lencana & Skor Kompetensi Siswa         │
│  • Slot Komparasi A/B (Baseline)   • Tantangan Kilat Aktif (Target Mission)  │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
                ▼                                              ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│     KOKPIT SIMULASI 3D & HUD (Tahap 2)  │  │  ANALITIK, LAPORAN & PENGAJAR   │
├─────────────────────────────────────────┤  ├─────────────────────────────────┤
│ • Kanvas 3D WebGL (Fisika/Kimia/Bio/Ast)│  │ • Grafik Regresi (Tahap 3):     │
│   ├─ Transisi Kamera Damped + Orbit     │  │   ├─ Kurva Multi-Model + Anomali│
│   ├─ Partikel & Efek Pencahayaan        │  │   └─ Overlay Perbandingan A/B   │
│   └─ Tangkapan Layar (toDataURL PNG)    │  │                                 │
│                                         │  │ • Laporan Akademik A4 (Tahap 4):│
│ • HUD Telemetri & Bar Komparasi:        │  │   └─ Lampiran Galeri Foto 3D    │
│   ├─ Bar Energi & Delta A/B Real-Time   │  │                                 │
│   ├─ Generator Tantangan Kilat Otomatis │  │ • Dashboard Pengajar & Lobi:    │
│   └─ Pemutar Ulang Rekaman (Replay)     │  │   ├─ Papan Peringkat Kelas      │
│                                         │  │   └─ Koleksi Lencana Ilmiah     │
│ • Asisten Dr. LabMu:                    │  └─────────────────────────────────┘
│   └─ Narasi Suara Interaktif (WebSpeech)│
└─────────────────────────────────────────┘
```

### Pemetaan Interaksi & State Komponen
- **Kamera Sinematik & Pengambil Foto 3D (`Scene3D Snapshot & Damped Camera`)**:
  - Menyimpan posisi target kamera (`targetCameraPos`, `targetLookAt`) dan memperbaruinya secara mulus setiap frame dengan `THREE.MathUtils.damp`.
  - Mengekspos aksi **"Ambil Foto 3D"** yang menangkap frame WebGL beserta judul modul, waktu, dan ringkasan parameter ke dalam daftar `capturedSnapshots`.
- **Komparasi Percobaan A/B (`ABComparisonController`)**:
  - Mengizinkan siswa menyematkan (*Pin*) kondisi eksperimen saat ini sebagai **Percobaan A**, menampilkan tabel selisih otomatis ($\Delta$ nilai & persentase) terhadap **Percobaan B** yang sedang digerakkan, serta tombol **"Tukar / Muat Ulang Percobaan A"**.
- **Generator Tantangan Kilat (`QuickChallengeBanner`)**:
  - Menghasilkan target metrik spesifik sesuai domain aktif (contoh: target percepatan, jangkauan projektil, titik pH, laju O₂ fotosintesis, atau periode orbit), memvalidasi metrik secara otomatis saat nilai simulasi masuk ke dalam rentang toleransi, dan memberikan lencana penghargaan.
- **Sistem Lencana & Papan Peringkat Kelas (`AchievementAndLeaderboard`)**:
  - Menghitung pencapaian siswa secara otomatis dari aksi nyata (menyelesaikan K3, mencatat $\ge 3$ data, meraih $R^2 \ge 0.95$, menuntaskan tantangan kilat, dan mengambil bukti foto 3D) serta menampilkannya di Lobi Katalog, Header Progres, dan Papan Peringkat di Dashboard Pengajar.
