# Penataan Ulang Alur & Navigasi Terstruktur RuangLABmu

Restrukturisasi pengalaman pengguna **RuangLABmu** dari kumpulan tab yang tersebar dan tumpang-tindih menjadi alur praktikum ilmiah bertahap (**1. Katalog & K3 $\rightarrow$ 2. Eksperimen 3D $\rightarrow$ 3. Analisis Grafik & LKS $\rightarrow$ 4. Laporan & Evaluasi**) dengan pemisahan peran **Siswa** dan **Pengajar** yang tegas serta kanvas 3D yang bersih dan lega.

### User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh keputusan arsitektur alur di bawah ini telah disesuaikan berdasarkan konfirmasi Anda pada tahap klarifikasi dan siap dieksekusi setelah Anda menekan tombol **Proceed**.

- **Keputusan Terkonfirmasi 1 — Alur Bertahap (4 Langkah Praktikum)**: Pengguna dipandu melalui tahapan berurutan mulai dari **Tahap 1: Pilih Modul & Pre-Lab K3**, **Tahap 2: Eksperimen 3D & Rekam Data**, **Tahap 3: Analisis Grafik Regresi & LKS**, hingga **Tahap 4: Kolaborasi Kelompok & Unduh Laporan (PDF/CSV)**, sambil tetap mengizinkan perpindahan cepat antar-tahap melalui *Stepper Bar*.
- **Keputusan Terkonfirmasi 2 — Pemisahan Mode Siswa vs. Mode Pengajar**: Navigasi atas tidak lagi mencampur tab laboratorium dengan tab pengajar. Disediakan pengalih peran (*Role Switcher*: **Mode Praktikum Siswa** | **Mode Evaluasi Pengajar**) yang memisahkan ruang kerja eksperimen dari ruang pantau kelas dan rubrik penilaian.
- **Keputusan Terkonfirmasi 3 — Eliminasi Duplikasi Grafik & LKS**: Fitur Grafik Regresi dan LKS disatukan ke dalam alur terpadu: saat di Tahap 2 (Simulasi 3D), siswa fokus mengamati fenomena 3D, mencatat titik pengamatan, dan melihat *counter badge* jumlah data yang terekam beserta tombol lanjut langsung menuju **Tahap 3 (Analisis & LKS)** tanpa duplikasi laci dan halaman yang membingungkan.
- **Keputusan Terkonfirmasi 4 — Kanvas 3D Lega & Dr.LabMu Ringkas**: Panel parameter dan telemetri 3D disatukan ke dalam satu dok kontrol yang rapi dan dapat disembunyikan (*collapsible*), sementara tombol mengambang asisten Sokratik **Dr.LabMu** diringkas menjadi tombol *pill/icon* minimalis dengan lencana notifikasi pintar saat terdeteksi anomali regresi ($R^2 < 0.85$).

---

### 1. Overview & Core Concept

- **What It Does**: Mengubah navigasi datar 6-tab menjadi sistem pembelajaran laboratorium terpandu (*Guided Scientific Inquiry Workflow*). Setiap sesi praktikum memiliki alur awal hingga akhir yang jelas, mulai dari pemilihan eksperimen lintas bidang (Fisika, Kimia, Biologi, Astronomi) dan persetujuan K3, pengambilan data di kokpit 3D interaktif, pengolahan regresi linier beserta pengisian LKS, hingga ekspor laporan resmi praktikum.
- **Target Audience / Persona**:
  - **Siswa & Mahasiswa (SMP / SMA / Perguruan Tinggi)**: Membutuhkan panduan langkah demi langkah yang jelas tanpa kebingungan harus menekan tombol mana setelah menjalankan simulasi 3D.
  - **Guru & Dosen Pembimbing (Mode Pengajar)**: Membutuhkan tampilan fokus untuk memantau progres tahapan tiap siswa secara *real-time*, memeriksa skor LKS otomatis, memberikan umpan balik langsung, dan mengunduh rekap nilai kelas.
- **Key Value**:
  - Menghilangkan kebingungan akibat fitur ganda (Grafik & LKS yang sebelumnya muncul bersamaan di laci dalam kanvas 3D dan di tab navigasi atas).
  - Memperluas ruang pandang kanvas WebGL/Three.js hingga $\ge 75\%$ area layar dengan menyatukan kontrol parameter dan rumus interaktif.
  - Memperjelas progres belajar siswa melalui indikator tahapan (*Progress Stepper*) dari Pre-Lab hingga ekspor laporan PDF/CSV.

---

### 2. User Experience & Visual Design

#### A. Key User Flows (Alur Kerja Baru)

1. **Header Utama Tiga Zona & Pengalih Peran (Role Switcher)**:
   - **Zona Kiri**: Identitas **RuangLABmu** beserta pemilih bidang sains aktif (*Fisika · Kimia · Biologi · Astronomi*) dan tingkat kurikulum (*SMP · SMA · PT*).
   - **Zona Tengah (Mode Siswa)**: **Indikator Progres 4 Tahap Praktikum** (*1. Katalog & K3 $\rightarrow$ 2. Simulasi 3D $\rightarrow$ 3. Grafik & LKS $\rightarrow$ 4. Laporan & Diskusi*) yang menunjukkan tahap aktif dan status penyelesaian tiap tahap.
   - **Zona Kanan**: Pengalih peran (**Mode Siswa** / **Mode Pengajar**), pemilih profil siswa/kelompok aktif, tombol tema/suara, dan lonceng notifikasi sesi.
2. **Tahap 1 — Katalog Modul & Persiapan Pre-Lab K3**:
   - Siswa memilih bidang sains (Fisika, Kimia, Biologi, atau Astronomi) dan memfilter modul berdasarkan jenjang kurikulum.
   - Setiap kartu modul menampilkan tujuan eksperimen, rumus kunci, daftar alat, serta status apakah briefing K3 sudah diselesaikan.
   - Menekan **"Siapkan & Cek K3"** membuka ringkasan prosedur keselamatan kerja (APD & bahaya); menekan **"Mulai Eksperimen 3D"** langsung membawa siswa ke Tahap 2 dengan modul terpilih.
3. **Tahap 2 — Eksperimen 3D & Pengambilan Data Terpadu**:
   - **Kanvas 3D Fokus Penuh**: Ruang tengah sepenuhnya didedikasikan untuk visualisasi 3D interaktif tanpa tertutup banyak laci melayang.
   - **Panel Kontrol & Telemetri Terpadu (Kiri)**: Menyatukan pemilihan sub-modul, *slider* parameter eksperimen, pembacaan metrik *real-time*, dan kartu rumus interaktif dalam satu panel ramping yang dapat dilipat (*collapsible*).
   - **Bar Eksekusi & Rekam Data (Bawah)**: Menggabungkan kontrol *Play/Pause/Reset*, pengatur kecepatan waktu, tombol **"Rekam Data Pengamatan"**, serta tombol aksi berlanjut **"Lanjut ke Analisis & LKS ($N$ Data)"** yang otomatis menyala begitu siswa merekam minimal 2–3 titik pengamatan.
4. **Tahap 3 — Analisis Grafik Regresi & Lembar Kerja Siswa (LKS)**:
   - Tampilan *Two-Zone Sandbox* yang bersih: sisi kiri menampilkan **Grafik Regresi Linier OLS ($R^2$)** dan **Tabel Log Pengamatan** (lengkap dengan fitur hapus/filter data), sedangkan sisi kanan menampilkan **Lembar Kerja Siswa (LKS)** terstruktur yang terhubung langsung dengan data hasil rekaman.
   - Begitu siswa menekan **"Periksa & Simpan Skor LKS"**, progres Tahap 3 ditandai selesai dan tombol **"Lanjut ke Ringkasan & Ekspor Laporan"** siap diakses.
5. **Tahap 4 — Kolaborasi Kelompok & Ekspor Laporan Akhir**:
   - Menampilkan papan tugas kelompok (*Checklist Investigasi*), ruang diskusi catatan siswa-pengajar secara *real-time*, serta kartu **Pusat Ekspor Praktikum** untuk mengunduh **Laporan Akademik Cetak/PDF** dan **Berkas Data CSV** dalam satu klik.
6. **Mode Evaluasi Pengajar (Terpisah dari Alur Siswa)**:
   - Saat beralih ke **Mode Pengajar**, tampilan berfokus pada Matriks Rubrik Kelas, grafik distribusi ketuntasan siswa, pantauan tahap aktif masing-masing siswa, pengiriman umpan balik instan via WebSocket, dan unduhan nilai CSV.

#### B. Visual Identity & Theme

- **Aesthetic Direction**: *Precision Scientific Studio* — menggabungkan imersi laboratorium gelap pada panggung 3D dengan keterbacaan dokumen akademik tinggi pada tahap Katalog, Analisis Grafik, LKS, dan Laporan.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Canvas**: Deep Obsidian Slate (`#090D16` / `slate-950`) untuk ruang simulasi 3D dan Clean Alabaster (`#F8FAFC` / `slate-50` pada mode terang) untuk ruang baca LKS & katalog.
  - **30% Structural Surfaces**: Panel instrumen semi-transparan (`bg-slate-900/90 border-white/10`) dengan garis pemisah tipis (*hairline borders* `1px`) tanpa kotak di dalam kotak yang berlebihan.
  - **10% Semantic Focal Accents**:
    - Fisika: Cerulean Sky (`#0EA5E9`)
    - Kimia: Analytical Teal (`#14B8A6`)
    - Biologi: Botanical Emerald (`#10B981`)
    - Astronomi: Celestial Indigo (`#6366F1`)
    - Indikator Status: Teks berlabel eksplisit (`● TERCAPAI`, `▲ ANOMALI R²`) mendampingi warna semantik.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - **Display & Headings**: `Plus Jakarta Sans` (SemiBold/Bold) untuk judul modul, navigasi tahapan, dan metrik utama.
  - **Body Prose**: `Plus Jakarta Sans` (Regular/Medium) untuk instruksi praktikum, teori singkat, dan soal LKS.
  - **Data, Rumus & Telemetri**: `IBM Plex Mono` dengan `tabular-nums` untuk tabel pengamatan, persamaan regresi, nilai *slider*, dan waktu simulasi.
- **Component Styling & Spatial Math**:
  - Menghilangkan lencana kapsul (*static pill clutter*) pada metadata kartu katalog; menggantinya dengan teks bersih berpemisah titik tengah (`Mekanika · SMA · 25 Menit`).
  - Tombol mengambang **Dr.LabMu** di pojok kanan bawah disederhanakan menjadi kapsul kompak satu baris (`Dr. LabMu · Tanya Mentor`) yang tidak menutupi kontrol simulasi 3D.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Mengganti 6 Tab Sejajar Menjadi "Pemilih Bidang Sains + Stepper 4 Tahap"**
  - *Chosen Approach*: Memisahkan **Apa yang dipelajari** (Fisika/Kimia/Biologi/Astronomi) dari **Tahap pengerjaan** (1. Katalog & K3 $\rightarrow$ 2. Simulasi 3D $\rightarrow$ 3. Analisis & LKS $\rightarrow$ 4. Laporan & Kolaborasi).
  - *Why*: Sebelumnya, bidang sains ("Lab Fisika") berada sejajar dengan langkah kerja ("Grafik & LKS") dan peran ("Dashboard Pengajar"), sehingga siswa bingung apakah harus berpindah tab atau membuka laci di dalam 3D. Dengan pemisahan ini, alur belajar menjadi linier dan terarah.
  - *Alternatives Considered*: Mempertahankan 6 tab di atas dan hanya mengubah nama labelnya — ditolak karena tidak menyelesaikan masalah tumpang-tindih antara laci analitik di dalam 3D dan halaman Grafik & LKS.
- **Decision 2: Konsolidasi Laci Analitik 3D ke Tahap Analisis & Ringkasan Cepat**
  - *Chosen Approach*: Di dalam Tahap 2 (Simulasi 3D), laci kanan yang penuh sesak diganti dengan indikator ringkas jumlah data terekam + pratinjau mini status regresi dan tombol langsung **"Buka Analisis & LKS (Tahap 3)"**, sementara analisis grafik penuh, tabel data lengkap, dan pengisian 6 soal LKS ditempatkan secara lega di **Tahap 3**.
  - *Why*: Mencegah duplikasi kode dan state antara laci sempit (`w-96`) dan halaman analisis utama, sekaligus membebaskan area kanan kanvas 3D agar objek eksperimen terlihat utuh.
  - *Alternatives Considered*: Menghapus kemampuan melihat daftar rekaman sama sekali saat di 3D — ditolak karena siswa tetap membutuhkan konfirmasi visual bahwa titik data yang baru saja direkam sudah masuk.
- **Decision 3: Mode Siswa vs. Mode Pengajar dengan Pengalih Peran Eksplisit**
  - *Chosen Approach*: Menambahkan sakelar peran (*Role Switcher*) di bilah atas. Saat **Mode Siswa** aktif, pengguna melihat alur 4 tahap praktikum. Saat **Mode Pengajar** aktif, pengguna melihat ruang kerja evaluasi kelas, pantauan progres tahapan siswa, dan rubrik penilaian.
  - *Why*: Menjaga fokus antarmuka sesuai tugas pengguna tanpa mencampur instrumen penilaian guru ke dalam langkah praktikum siswa.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### A. Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         TOP NAVIGATION & ROLE ORCHESTRATOR                        │
│  [RuangLABmu · Pemilih Bidang & Jenjang]   [Stepper 1→2→3→4]   [Siswa | Pengajar] │
└───────────────────┬───────────────────────────────────────────────┬───────────────┘
                    │ (Mode Siswa)                                  │ (Mode Pengajar)
                    ▼                                               ▼
┌───────────────────────────────────────────────────────┐   ┌───────────────────────┐
│            STUDENT GUIDED WORKFLOW CONTAINER          │   │   TEACHER DASHBOARD   │
│                                                       │   │  - Pantauan Tahap     │
│  ┌─────────────────────────────────────────────────┐  │   │    Tiap Siswa         │
│  │ Tahap 1: Katalog Modul & Pre-Lab K3             │  │   │  - Matriks Rubrik     │
│  │ - Filter Bidang (Fisika/Kimia/Biologi/Astronomi)│  │   │  - Broadcast Umpan    │
│  │ - Ceklis APD & Keamanan K3 → Mulai Simulasi     │  │   │    Balik WebSocket    │
│  └────────────────────────┬────────────────────────┘  │   │  - Ekspor Nilai CSV   │
│                           ▼                           │   └───────────────────────┘
│  ┌─────────────────────────────────────────────────┐  │
│  │ Tahap 2: Kokpit Simulasi 3D & Rekam Data        │  │
│  │ - Kanvas 3D Lega (Fisika/Kimia/Biologi/Astro)   │  │
│  │ - Dok Kontrol & Rumus Terpadu (Collapsible)     │  │
│  │ - Bar Playback + Tombol Rekam → Lanjut Tahap 3  │  │
│  └────────────────────────┬────────────────────────┘  │
│                           ▼                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Tahap 3: Analisis Grafik Regresi & LKS          │  │
│  │ - Kiri: Grafik Regresi Linier OLS & Tabel Data  │  │
│  │ - Kanan: Lembar Kerja Siswa (LKS) Auto-Grading  │  │
│  └────────────────────────┬────────────────────────┘  │
│                           ▼                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Tahap 4: Laporan Praktikum & Kolaborasi         │  │
│  │ - Pusat Ekspor Laporan Resmi (PDF/Cetak & CSV)  │  │
│  │ - Checklist Tugas & Diskusi Kelompok Real-Time  │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│             COMPACT DR. LABMU MENTOR ORB & WEBSOCKET SYNC (/ws-lab)               │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### B. Data Model & State

- **`userRole` (`'siswa' | 'pengajar'`)**: Mengatur tampilan utama antara ruang kerja bertahap siswa dan dashboard evaluasi pengajar.
- **`activeDomain` (`'fisika' | 'kimia' | 'biologi' | 'astronomi'`)**: Menentukan bidang sains aktif yang menyinkronkan katalog modul, kanvas 3D, parameter eksperimen, dan konteks telemetri Dr.LabMu.
- **`workflowStep` (`1 | 2 | 3 | 4`)**:
  - `1`: **Katalog & Pre-Lab K3** (Memilih modul eksperimen & memverifikasi kesiapan K3).
  - `2`: **Simulasi 3D & Rekam Data** (Menjalankan simulasi 3D, mengubah variabel, dan merekam titik pengamatan).
  - `3`: **Analisis Grafik & LKS** (Melihat regresi linier $R^2$, mengelola tabel data, dan mengerjakan kuis LKS).
  - `4`: **Laporan & Evaluasi Kelompok** (Menyelesaikan checklist tugas kelompok, diskusi catatan, dan mengunduh laporan PDF/CSV).
- **`completedSafetyModuleIds` (`string[]`) & `lksSubmitted` (`boolean`)**: Melacak status penyelesaian tiap tahapan untuk memberi tanda centang hijau pada *Stepper Bar* di bagian atas.

#### C. Interactive Component & State Mapping

- **Transisi Tahap 1 $\rightarrow$ Tahap 2**: Saat pengguna memilih modul di Katalog atau menyelesaikan modal Pre-Lab K3 dan menekan **"Mulai Praktikum 3D"**, parameter modul otomatis dimuat ke *engine* domain terkait dan `workflowStep` berpindah ke `2`.
- **Transisi Tahap 2 $\rightarrow$ Tahap 3**: Setiap kali pengguna menekan **"Rekam Data"** di kokpit 3D, data masuk ke `records` (tersinkronisasi via WebSocket) dan lencana progres di bilah bawah menampilkan jumlah rekaman terbaru beserta tombol **"Lanjut ke Analisis & LKS"** yang memindahkan `workflowStep` ke `3`.
- **Transisi Tahap 3 $\rightarrow$ Tahap 4**: Setelah siswa memeriksa grafik regresi dan mengirimkan jawaban LKS, skor otomatis disinkronkan ke rubrik pengajar dan muncul tombol **"Lanjut ke Ekspor Laporan & Diskusi"** menuju `workflowStep = 4`.
- **Penyederhanaan Dr.LabMu**: Tombol pemicu Dr.LabMu diringkas menjadi kapsul tipis di kanan bawah yang tidak menghalangi bar kontrol bawah maupun kanvas 3D, namun tetap menampilkan indikator peringatan jika regresi data siswa memiliki $R^2 < 0.85$.
