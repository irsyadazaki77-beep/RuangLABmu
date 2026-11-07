# 🧪 RuangLABmu (SimuLab Sains)
### *Laboratorium Virtual Sains 3D Interaktif & Kolaboratif dengan Pembimbing AI Sokratik*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Gemini API](https://img.shields.io/badge/Google_Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-green?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

---

## 🌟 Tentang RuangLABmu

**RuangLABmu** adalah platform praktikum sains virtual interaktif berbasis web generasi baru yang dirancang untuk pelajar jenjang **SMP, SMA, hingga Perguruan Tinggi (Mahasiswa)**. Menggabungkan simulasi 3D real-time dengan kalkulasi ilmiah presisi tinggi, RuangLABmu memungkinkan siswa menjalankan eksperimen **Fisika, Kimia, Biologi, dan Astronomi** secara mandiri maupun berkelompok.

Dilengkapi dengan **Dr. LabMu** (asisten instruktur AI bertenaga Google Gemini) yang menerapkan metode pedagogi **Sokratik**, siswa dibimbing untuk menganalisis data, memahami hukum alam, mengevaluasi kurva regresi $R^2$, serta mengidentifikasi anomali tanpa sekadar disuapi jawaban instan.

---

## ✨ Fitur-Fitur Utama

### 1. 🔬 4 Domain Sains Terintegrasi (20+ Modul Praktikum)
* **Fisika:** Hukum Newton, Gerak Parabola/Kinematika, Osilasi Pegas, Bandul Sederhana, Tumbukan & Momentum, Viskositas Fluida Stokes, Rangkaian Listrik Ohm & Wheatstone, Interferensi Celah Ganda Young, Efek Fotolistrik, dan Gravitasi Universal.
* **Kimia:** Kalorimetri Netralisasi Termokimia, Titrasi Asam-Basa, Sel Elektrokimia/Galvani, Hukum Gas Ideal (Boyle-Gay Lussac), Kinetika Reaksi Arrhenius, dan Spektrofotometri Beer-Lambert.
* **Biologi:** Fotosintesis Percobaan Ingenhousz, Kinetika Enzim Katalase, serta Osmosis & Plasmolisis Sel Tumbuhan.
* **Astronomi:** Hukum Kepler & Orbit Planet, Kurva Rotasi Bima Sakti & Deteksi Materi Gelap (*Dark Matter*), Metode Transit Eksoplanet, Spektrum Radiasi Bintang Hukum Wien, dan Ekspansi Alam Semesta Hukum Hubble.

### 2. 🎮 Simulasi 3D Interaktif & Komputasi Web Worker Bebas Lag
* Meja laboratorium 3D interaktif yang dibangun menggunakan **Three.js** untuk visualisasi aparatus ilmiah nyata (buret titrasi, bejana kalorimeter, bidang miring, mikroskop, tabung reaksi, teleskop, dan orbit angkasa).
* Seluruh persamaan diferensial gerak dan dinamika fluida dieksekusi di background thread menggunakan **Dedicated Web Worker**, menjamin performa rendering 60 FPS tanpa jeda pada antarmuka pengguna.

### 3. 👥 Kolaborasi Real-Time & Mutex Parameter Slider
* Terhubung menggunakan arsitektur **WebSocket** dua arah:
  * **Kursor Spasial Multi-Pengguna:** Melihat pergerakan rekan sekelompok secara langsung.
  * **Parameter Mutex Lock:** Mencegah tabrakan pengaturan slider variabel antar-siswa secara bersamaan.
  * **Sinkronisasi Otomatis:** Tabel log pengamatan bersama, papan diskusi kelompok, dan pembagian tugas praktikum.

### 4. 🤖 Asisten Lab AI Sokratik — "Dr. LabMu"
* Ditenagai oleh **Google Gemini API** (`gemini-3.8-flash`) pada sisi server (*server-side*).
* **Metode Sokratik:** Menolak memberikan jawaban akhir secara cuma-cuma; melainkan memberikan pertanyaan reflektif berdasarkan data aktual dan slope regresi siswa.
* **Deteksi Anomali & Outlier:** Memberikan peringatan pedagogis ketika koefisien determinasi $R^2 < 0.85$ atau saat data pengukuran menyimpang ekstrem.
* **Mesin Heuristik Cadangan:** Tetap berfungsi membimbing siswa secara cerdas bahkan ketika API key belum disetel.

### 5. 📊 Analisis Data, Regresi $R^2$, dan Ketidakpastian Pengukuran
* Fitting kurva regresi linier dan non-linier otomatis langsung di browser.
* Analisis ralat eksperimen, deviasi standar, dan propagasi ketidakpastian instrumen.
* Fitur *Playback Buffer* untuk memutar ulang dinamika eksperimen langkah-demi-langkah.

### 6. 📋 4-Step Guided Learning Workflow
1. **Langkah 1 (Pre-Lab Briefing & K3):** Pengenalan teori, alat/bahan, dan kuis pemahaman keselamatan kerja lab.
2. **Langkah 2 (Eksperimen Interaktif):** Pengambilan data variabel bebas, kontrol, dan terikat pada aparatus 3D.
3. **Langkah 3 (Analisis Data & Grafik):** Plotting otomatis, perhitungan gradien, dan evaluasi $R^2$.
4. **Langkah 4 (LKS & Evaluasi):** Pengerjaan Lembar Kerja Siswa dan ekspor laporan ilmiah resmi (CSV / PDF / Cetak).

### 7. 👨‍🏫 Teacher Dashboard (Pantauan Pengajar)
* Dashboard analitik khusus guru/dosen untuk memantau status siswa (*Nominal*, *Butuh Bantuan*, *Selesai*).
* Pemantauan progres pengerjaan tugas kelompok secara langsung dari kelas.

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite 8](https://vitejs.dev/) |
| **3D Rendering** | [Three.js](https://threejs.org/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Motion (Framer Motion)](https://motion.dev/), [Lucide React](https://lucide.dev/) |
| **Backend & Server** | [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [tsx](https://github.com/privatenumber/tsx) |
| **Real-time Networking** | [ws (WebSocket)](https://github.com/websockets/ws) |
| **Generative AI** | [Google Gen AI SDK (@google/genai)](https://www.npmjs.com/package/@google/genai) |
| **Audio Engine** | Web Audio API (Synthesized SFX) |
| **State Persistence** | Atomic Disk JSON Storage (`.data/ruanglab-state.json`) |

---

## 📁 Struktur Direktori

```text
RuangLABmu/
├── .aistudio/                  # Konfigurasi AI Studio environment
├── .data/                      # Penyimpanan persistensi data lokal (.json)
├── src/
│   ├── components/             # Komponen antarmuka React
│   │   ├── ui/                 # Kartu formula, instrumen lab, & widget reusable
│   │   ├── AnalyticsAndWorksheetPanel.tsx # Panel regresi & Lembar Kerja Siswa (LKS)
│   │   ├── AstronomyLabView.tsx           # Antarmuka praktikum Astronomi
│   │   ├── AstronomyScene3D.tsx           # Rendering 3D tata surya & galaksi
│   │   ├── BiologyLabView.tsx             # Antarmuka praktikum Biologi
│   │   ├── BiologyScene3D.tsx             # Rendering 3D mikroskop & sel
│   │   ├── ChemistryLabView.tsx           # Antarmuka praktikum Kimia
│   │   ├── ChemistryScene3D.tsx           # Rendering 3D bejana & buret reaksi
│   │   ├── CollaborationAndDataSection.tsx# Kolaborasi kelompok, notes, & tabel log
│   │   ├── DrLabMuAssistantPanel.tsx      # Antarmuka asisten AI Sokratik
│   │   ├── ExperimentCatalogPicker.tsx    # Katalog pemilihan modul praktikum
│   │   ├── PhysicsLabView.tsx             # Antarmuka praktikum Fisika
│   │   ├── PhysicsScene3D.tsx             # Rendering 3D mekanika & pegas
│   │   ├── PreLabSafetyModal.tsx          # Modal induksi keselamatan lab & kuis
│   │   ├── SimulationPlaybackBar.tsx      # Bar kontrol putar, jeda, & scrubbing
│   │   └── TeacherDashboardView.tsx       # Dashboard monitoring pengajar
│   ├── hooks/                  # Custom React Hooks (Web Worker & Spatial Collab)
│   ├── registry/               # Katalog & definisi 20+ modul sains
│   │   ├── modules/            # physics, chemistry, biology, & astronomy modules
│   │   └── experimentRegistry.ts
│   ├── types/                  # Definisi TypeScript untuk simulasi & worker
│   ├── utils/                  # Engine sains, ralat, audio, & ekspor laporan
│   ├── workers/                # Web Worker background simulation
│   ├── App.tsx                 # Root component aplikasi
│   ├── main.tsx                # Entry point client
│   └── index.css               # Styling global Tailwind CSS v4
├── .env.example                # Template variabel lingkungan
├── package.json                # Dependencies & scripts
├── server.ts                   # Express server, Vite middleware, WebSocket & Gemini AI endpoint
├── tsconfig.json               # Konfigurasi TypeScript compiler
└── vite.config.ts              # Konfigurasi Vite
```

---

## 🚀 Panduan Memulai (Quick Start)

### 1. Prasyarat Sistem
Pastikan perangkat Anda telah terpasang:
* **Node.js** (versi 18.0 atau lebih baru)
* **npm** atau **bun** / **yarn** / **pnpm**
* Kunci API Google Gemini (Opsional, untuk fitur AI Dr. LabMu penuh dari Google AI Studio)

### 2. Kloning Repositori
```bash
git clone https://github.com/irsyadazaki77-beep/RuangLABmu.git
cd RuangLABmu
```

### 3. Instal Dependensi
```bash
npm install
```
*(atau jika menggunakan Bun: `bun install`)*

### 4. Konfigurasi Variabel Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` dan masukkan kunci API Gemini Anda:
```env
GEMINI_API_KEY="AIzaSy..."
APP_URL="http://localhost:3000"
```
> **Catatan:** Jika Anda tidak mengisi `GEMINI_API_KEY`, aplikasi tetap dapat berjalan secara penuh dan asisten Dr. LabMu akan otomatis beralih ke mesin pedagogi heuristik lokal.

### 5. Menjalankan Aplikasi
Jalankan server pengembangan:
```bash
npm run dev
```

Buka peramban (browser) Anda dan akses:
```
http://localhost:3000
```

---

## 📜 Skrip yang Tersedia

* `npm run dev` — Menjalankan server aplikasi full-stack (Express + Vite + WebSocket) dalam mode pengembangan dengan reload otomatis.
* `npm run build` — Melakukan kompilasi aset frontend Vite untuk tahap produksi ke folder `dist`.
* `npm run start` — Menjalankan server produksi menggunakan Node.js.
* `npm run preview` — Melihat pratinjau hasil build produksi secara lokal.
* `npm run lint` — Memeriksa tipe data TypeScript di seluruh proyek (`tsc --noEmit`).
* `npm run clean` — Membersihkan folder build `dist` dan file transpilasi sementara.

---

## 💡 Panduan Penggunaan Singkat

1. **Pilih Peran & Identitas:**
   * Masuk sebagai **Siswa** (pilih kelompok praktikum) atau **Pengajar** di sudut navigasi.
   * Pilih jenjang pendidikan yang sesuai (**SMP**, **SMA**, atau **Mahasiswa**).
2. **Pilih Modul Praktikum:**
   * Klik ikon domain (Fisika, Kimia, Biologi, Astronomi) atau buka katalog lengkap untuk memilih eksperimen spesifik.
3. **Selesaikan Pre-Lab Safety Briefing:**
   * Pelajari capaian pembelajaran, tinjauan teori, alat bahan, dan jawab kuis keselamatan dasar sebelum memulai eksperimen.
4. **Jalankan Simulasi:**
   * Atur variabel slider (misal massa, percepatan gravitasi, konsentrasi, sudut kemiringan, atau jarak orbit).
   * Tekan tombol **Rekam Data** untuk menyimpan titik pengamatan ke log tabel.
5. **Diskusi Bersama Dr. LabMu:**
   * Ajukan pertanyaan atau mintalah tanggapan data kepada Dr. LabMu di panel sebelah kanan untuk mendapatkan arahan berpikir Sokratik.
6. **Ekspor Hasil:**
   * Unduh seluruh data tabel dalam format **CSV** atau cetak **Laporan Akademik Lengkap** untuk dikumpulkan kepada pengajar.

---

## 🤝 Kontribusi

Kontribusi untuk memperkaya modul eksperimen, optimasi visualisasi 3D, atau penambahan instrumen baru sangat terbuka!

1. *Fork* repositori ini.
2. Buat branch fitur baru (`git checkout -b fitur/modul-baru`).
3. Lakukan commit perubahan Anda (`git commit -m 'Menambahkan modul optika cermin cekung'`).
4. *Push* ke branch Anda (`git push origin fitur/modul-baru`).
5. Buat **Pull Request**.

---

## 📄 Lisensi

Proyek ini dikembangkan untuk tujuan edukasi dan kemajuan pembelajaran sains interaktif. Silakan tinjau berkas lisensi pada repositori ini untuk informasi lebih lanjut.

---

<p align="center">
  Dibuat dengan ❤️ untuk kemajuan pendidikan sains Indonesia 🇮🇩
</p>
