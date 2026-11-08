# Penataan Ulang UI/UX Menyeluruh RuangLABmu (SimuLab) — Alur Kerja Terarah & Bebas Kebingungan

Merapikan dan menyederhanakan antarmuka **RuangLABmu (SimuLab)** di seluruh halaman menggunakan prinsip **Pengungkapan Bertahap (*Progressive Disclosure*)** dan **Panduan Langkah Demi Langkah (*Guided Step-by-Step Flow*)**, sehingga siswa maupun pengajar langsung memahami langkah berikutnya tanpa terbebani tumpukan panel teknis.

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh fitur lanjutan yang telah dibangun (Osiloskop Telemetri, Kalibrasi Instrumen & NST, Deteksi Outlier, Kalkulator Ralat, Pratinjau Laporan A4, dan Racik Sampel Kustom) **tetap dipertahankan 100%**, namun ditata ulang ke dalam akordion lipat dan tab terfokus agar layar utama tetap bersih dan intuitif.

- **Keputusan Terkonfirmasi 1 (Cakupan Area UI/UX)**: Merapikan keempat area utama sekaligus — **Navigasi Bar Atas & Alur Tahapan**, **Kokpit Simulasi 3D & Panel Parameter**, **Halaman Analisis Grafik & LKS**, serta **Lobi Katalog & Dashboard Pengajar**.
- **Keputusan Terkonfirmasi 2 (Penyederhanaan Kokpit 3D)**: Menampilkan **Kontrol Parameter Utama & Rumus Interaktif** terlebih dahulu di panel kanan kokpit 3D, sementara fitur lanjutan (**Preset Skenario Cepat**, **Osiloskop Telemetri**, dan **Kalibrasi Instrumen Manual**) disimpan rapi di dalam **Akordion Lipat (*Collapsible Accordions*)** yang dapat dibuka sesuai kebutuhan.
- **Keputusan Terkonfirmasi 3 (Gaya Alur Kerja Praktikum)**: Menghadirkan **Bilah Panduan Langkah Kontekstual (*Next-Action Guide Banner*)** dengan indikator progres jelas dan tombol **"Lanjut ke Tahap Berikutnya →"** yang menonjol begitu syarat tahap terpenuhi (misalnya setelah mencatat $\ge 3$ data di Tahap 2 atau setelah menilai LKS di Tahap 3).

---

## 1. Overview & Core Concept

- **Apa yang Ditingkatkan**:
  1. **Header Navigasi Utama yang Ringkas & Jelas**: Mengurangi kepadatan tombol di bar atas dengan mengelompokkan utilitas sekunder (profil siswa, suara, unduh CSV cepat, ergonomi visual) ke dalam menu ringkas, sehingga fokus utama bar atas hanya pada **Identitas/Katalog**, **4 Tahapan Praktikum**, dan **Asisten Dr. LabMu / Mode Pengajar**.
  2. **Kokpit Simulasi 3D dengan Akordion Bertahap**: Di keempat lab (Fisika, Kimia, Biologi, Astronomi), siswa langsung melihat pilih mode dan *slider* variabel utama tanpa perlu menggulir panjang. Instrumen lanjutan (Preset Skenario, Osiloskop & Vektor, Kalibrasi Alat) dikemas dalam akordion lipat yang rapi.
  3. **Bilah Panduan Langkah & Tombol "Lanjut" Otomatis**: Di setiap tahapan (Tahap 1 s.d. Tahap 4), terdapat kartu/bilah petunjuk langkah aktif di bagian atas/bawah yang memberi tahu siswa *"Apa yang harus dilakukan sekarang"* (contoh: *"Ubah variabel dan klik + Catat Data minimal 3 kali (Tercatat: 1/3)"*) dan berubah menjadi tombol hijau **"Lanjut ke Analisis Grafik & LKS →"** saat target tercapai.
  4. **Halaman Analisis & LKS yang Terfokus**: Grafik Regresi dan Lembar Kerja Siswa (LKS) tampil berdampingan secara bersih. Fitur **Deteksi Outlier** dan **Kalkulator Propagasi Ketidakpastian** ditempatkan dalam akordion lipat di bawah grafik agar tidak mendistraksi siswa saat membaca kurva.
  5. **Lobi Katalog & Dashboard Pengajar Berbasis Tab**: Menyederhanakan baris filter di Lobi Katalog dan membagi Dashboard Pengajar ke dalam 3 tab fokus (**1. Pantauan Kelas & Rubrik**, **2. Ujian Sampel Misteri**, **3. Analitik & Log Kelas**) agar pengajar tidak bingung melihat halaman yang terlalu panjang.
- **Target Pengguna**: Siswa SMP, SMA, dan Mahasiswa yang membutuhkan alur praktikum terarah, serta Pengajar yang memantau kelas.
- **Nilai Utama**: Menurunkan beban kognitif visual (*visual clutter*) secara drastis sambil mempertahankan kelengkapan instrumen laboratorium tingkat lanjut.

---

## 2. User Experience & Visual Design

### Alur Pengguna Langkah Demi Langkah (Guided Workflow)

1. **Lobi Katalog Eksperimen**:
   - Siswa disambut dengan ringkasan jelas, filter domain satu baris (**Semua, Fisika, Kimia, Biologi, Astronomi**), dan kartu modul yang bersih dengan 1 tombol aksi utama **"Mulai Praktikum →"**. Filter beban kognitif dan pencarian disatukan secara ringkas.
2. **Tahap 1 — Pengenalan, K3 & Hipotesis Awal**:
   - Tata letak terfokus dengan daftar cek APD K3 dan pengisian Hipotesis Awal, diakhiri tombol utama **"Masuk ke Ruang Simulasi 3D (Tahap 2) →"**.
3. **Tahap 2 — Kokpit Simulasi 3D (Kanvas Kiri 65% + Panel Kontrol Kanan 35%)**:
   - **Bilah Status Langkah di Atas Panel Kanan**: Menampilkan progres pengambilan data (`Data Tercatat: X/3`) beserta tombol **"Lanjut ke Tahap 3 (Grafik & LKS) →"** yang langsung menyala ketika data mencukupi.
   - **Tampilan Utama Panel Kanan**: Hanya menampilkan Pemilih Sub-Eksperimen, **Slider Parameter Eksperimen**, dan **Kartu Rumus Interaktif**.
   - **Akordion Instrumen Lanjutan (Tertutup secara default)**:
     - `▸ Preset Skenario & Gravitasi Cepat`
     - `▸ Osiloskop Telemetri & Indikator Mikroskopis`
     - `▸ Kalibrasi Instrumen & Ketidakpastian (NST)`
4. **Tahap 3 — Analisis Grafik Regresi & LKS**:
   - Bagian atas menampilkan bilah progres tahapan dengan tombol jelas **"Lanjut ke Tahap 4: Cetak Laporan →"**.
   - Kolom Kiri menampilkan **Grafik Regresi Multi-Model**; alat bantu **Deteksi Outlier** dan **Kalkulator Rumus & Ralat** dirapikan ke dalam panel akordion lipat sehingga tidak memenuhi layar.
   - Kolom Kanan menampilkan **Soal Evaluasi LKS** dengan umpan balik diagnostik dan tombol konsultasi **Dr. LabMu**.
5. **Tahap 4 — Laporan Akademik & Kolaborasi**:
   - Fokus utama pada tombol **"Pratinjau & Cetak Laporan A4"** di bagian paling atas, diikuti tabel data pengamatan dan ruang diskusi kelompok.

### Identitas Visual & Tema
- **Aesthetic Direction**: *Clean Scientific Sandbox* — memadukan ketegasan instrumen laboratorium dengan ruang kosong (*whitespace*) yang lega dan hirarki tipografi yang tenang.
- **Color Palette & Mood**:
  - **60% Kanvas Netral**: `#0F172A` / `#020617` pada mode gelap dan `#F8FAFC` pada mode terang.
  - **30% Permukaan Struktural**: Kartu dengan batas halus `1px` (`border-slate-200 dark:border-slate-800`) tanpa tumpukan kartu di dalam kartu (*no cards within cards*).
  - **10% Aksen Fungsional**: Biru Langit (`#0284C7` / `#0EA5E9`) untuk navigasi langkah aktif, dan Hijau Zamrud (`#10B981`) khusus untuk penanda tahap selesai dan tombol **"Lanjut →"**.
- **Typography & Hierarchy**:
  - Judul & Navigasi menggunakan proporsi tegas dan bersih, sedangkan seluruh angka metrik, tabel, dan pembacaan sensor wajib menggunakan angka tabular (`font-mono tabular-nums`).
  - Menghilangkan label kapsul (*pill badges*) statis yang berlebihan dan menggantinya dengan pemisah tipografi bersih (`·`).

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Akordion Lipat (*Progressive Disclosure*) pada Kokpit 3D dan Halaman Analisis**
  - *Pendekatan Terpilih*: Menampilkan kontrol parameter inti secara terbuka, sementara Preset Skenario, Osiloskop Telemetri, Kalibrasi Alat, serta Kalkulator Ralat ditempatkan dalam komponen akordion yang dapat dibuka/tutup dengan satu klik.
  - *Mengapa*: Mencegah siswa baru merasa kewalahan oleh banyaknya grafik mini dan tombol kalibrasi saat pertama kali masuk ke ruang 3D, namun tetap menjaga akses instan bagi siswa yang ingin melakukan analisis mendalam.
- **Keputusan 2: Pembagian Tab Fokus pada Dashboard Pengajar**
  - *Pendekatan Terpilih*: Mengorganisasikan Dashboard Pengajar ke dalam 3 tab terpisah (**Pantauan Kelas & Rubrik**, **Ujian Sampel Misteri**, **Analitik Kompetensi**).
  - *Mengapa*: Menggantikan halaman vertikal panjang sehingga pengajar dapat langsung fokus menilai rubrik siswa atau menyiarkan ujian sampel misteri tanpa tersesat.
- **Keputusan 3: Konsolidasi Bilah Navigasi Atas (Top Bar)**
  - *Pendekatan Terpilih*: Memindahkan pengaturan sekunder (Pemilih Profil Siswa, Toggle Suara, Ekspor CSV Cepat) ke dalam satu tombol menu **"Utilitas & Profil"** di pojok kanan atas.
  - *Mengapa*: Menjaga bilah navigasi atas tetap bersih, tidak penuh sesak di layar laptop standar, dan menonjolkan 4 Tahapan Praktikum di bagian tengah.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Diagram Hirarki Antarmuka & Alur Navigasi

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER BAR RINGKAS (3 Zona Bersih)                                           │
│ [Logo RuangLABmu + ← Katalog] ── [Stepper 1 → 2 → 3 → 4] ── [Dr.LabMu | Menu]│
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┴───────────────────────────────┐
        ▼                                                               ▼
┌───────────────────────────────────────┐       ┌──────────────────────────────┐
│ MODE SISWA (Alur Terarah 4 Tahap)     │       │ MODE PENGAJAR (3 Tab Fokus)  │
├───────────────────────────────────────┤       ├──────────────────────────────┤
│ • Bilah Panduan Kontekstual + CTA     │       │ Tab 1: Tabel Kelas & Rubrik  │
│   "Lanjut ke Tahap Berikutnya →"      │       │ Tab 2: Ujian Sampel Misteri  │
│                                       │       │        (Preset & Kustom)     │
│ • Kokpit 3D (Tahap 2):                │       │ Tab 3: Analitik Kompetensi & │
│   ├─ Kanvas Interaktif 3D + Playback  │       │        Radar Kelas           │
│   └─ Panel Kanan:                     │       └──────────────────────────────┘
│      ├─ [Terbuka] Parameter & Rumus   │
│      ├─ [Akordion] Preset Skenario    │
│      ├─ [Akordion] Osiloskop & Vektor │
│      └─ [Akordion] Kalibrasi & NST    │
│                                       │
│ • Analisis & LKS (Tahap 3):           │
│   ├─ Grafik Regresi Multi-Model       │
│   ├─ [Akordion] Deteksi Outlier       │
│   ├─ [Akordion] Kalkulator Ralat      │
│   └─ Evaluasi LKS Diagnostik          │
└───────────────────────────────────────┘
```

### Pemetaan Interaksi & State Komponen
- **Bilah Panduan Langkah Kontekstual (`GuidedStepActionBanner`)**:
  - Membaca state `workflowStep`, `records.length`, dan `lksGraded`.
  - Menampilkan instruksi singkat 1 kalimat dan tombol aksi langsung untuk berpindah antar-tahap (`setWorkflowStep(2 | 3 | 4)` atau membuka modal cetak laporan).
- **Komponen Akordion Instrumen (`CollapsibleLabSection`)**:
  - Mengelola state buka/tutup lokal dengan indikator ringkas saat tertutup (misalnya menampilkan status `Terkalibrasi` atau `Ch1/Ch2 Aktif`) sehingga pengguna tahu isi akordion sebelum membukanya.
- **Menu Utilitas Header & Tab Dashboard Pengajar**:
  - Mengelola popover utilitas di header utama (pergantian profil siswa, efek suara, unduh CSV cepat) serta state tab aktif pada Dashboard Pengajar (`'class-rubric' | 'mystery-exam' | 'competency-analytics'`).
