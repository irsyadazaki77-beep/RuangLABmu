export interface ModuleDeepDiveInfo {
  chapterNumber: number;
  chapterTitle: string;
  competencyLevel: 'Dasar' | 'Menengah' | 'Lanjut' | 'Olimpiade';
  commonMisconceptions: string[];
  realWorldApplications: string[];
  stepByStepGuide: string[];
  deepDiveContent?: {
    derivationLatex?: string[];
    historicalContext?: string;
    advancedConcept?: string;
  };
}

export const MODULE_DEEP_DIVE_MAP: Record<string, ModuleDeepDiveInfo> = {
  // ==========================================
  // FISIKA (10 MODUL)
  // ==========================================
  'newton-incline': {
    chapterNumber: 1,
    chapterTitle: 'Bab 1: Kinematika & Dinamika Gerak Klasik',
    competencyLevel: 'Dasar',
    commonMisconceptions: [
      'Gaya normal (N) selalu sama dengan berat benda (m·g). Faktanya: Pada bidang miring, gaya normal adalah komponen tegak lurus permukaan N = m·g·cos(θ), yang semakin mengecil saat sudut kemiringan bertambah.',
      'Benda membutuhkan gaya dorong terus-menerus agar tetap bergerak. Faktanya: Sesuai Hukum I Newton (Inersia), tanpa gaya gesek atau hambatan, benda akan terus meluncur selamanya dengan kecepatan konstan.',
    ],
    realWorldApplications: [
      'Desain tanjakan jalan raya dan jalan tol pegunungan (misal Tol Cipularang & Kelok 9) dengan sudut kemiringan terkontrol untuk mencegah selip kendaraan.',
      'Sistem sabuk konveyor pengangkut material di pabrik semen dan pelabuhan bongkar muat barang.',
      'Prinsip jalur penyelamat darurat rem blong (runaway truck ramp) berpasir di turunan curam.',
    ],
    stepByStepGuide: [
      '1. Atur sudut kemiringan bidang miring θ = 15° dan massa balok m = 4.0 kg.',
      '2. Naikkan gaya dorong luar (F) secara bertahap: 20 N, 40 N, 60 N, dan 80 N.',
      '3. Catat percepatan luncur (a) pada setiap gaya dorong dan amati bagaimana gaya gesek kinetis fk menahan gerak.',
      '4. Periksa kurva regresi percepatan vs gaya dorong; gradien garis merepresentasikan invers massa benda (1/m).',
    ],
    deepDiveContent: {
      historicalContext:
        'Sir Isaac Newton menerbitkan Philosophiae Naturalis Principia Mathematica pada tahun 1687, menyatukan pengamatan gerak Galileo dengan kalkulus diferensial untuk merumuskan hukum gerak universal.',
      derivationLatex: [
        '\\Sigma F_x = F - m g \\sin\\theta - f_k = m \\cdot a',
        '\\Sigma F_y = N - m g \\cos\\theta = 0 \\implies N = m g \\cos\\theta',
        'f_k = \\mu_k N = \\mu_k m g \\cos\\theta',
        'a = \\frac{F - m g (\\sin\\theta + \\mu_k \\cos\\theta)}{m}',
      ],
      advancedConcept:
        'Transisi Gesek Statis-Kinetis: Benda hanya akan mulai meluncur jika gaya dorong neto melebihi ambang gesek statis maksimum fs,max = μs·N.',
    },
  },

  'projectile-motion': {
    chapterNumber: 1,
    chapterTitle: 'Bab 1: Kinematika & Dinamika Gerak Klasik',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Kecepatan peluru di titik puncak lintasan bernilai nol total. Faktanya: Hanya kecepatan vertikal vy yang bernilai nol; kecepatan horizontal vx tetap ada dan konstan sebesar v0·cos(θ).',
      'Sudut tembak 45° selalu menghasilkan jarak terjauh pada semua kondisi. Faktanya: Sudut 45° optimum hanya jika elevasi awal h0 = 0. Jika diluncurkan dari tebing (h0 > 0), sudut optimum lebih kecil dari 45°.',
    ],
    realWorldApplications: [
      'Kalkulasi trajektori peluncuran roket pengorbit satelit di stasiun peluncuran antariksa LAPAN/BRIN Pameungpeuk, Garut.',
      'Analisis sudut tembakan bola basket (shooting arc) atlet nasional untuk mengoptimalkan persentase bola masuk.',
      'Perhitungan pancaran air meriam pemadam kebakaran (water cannon) untuk menjangkau lantai atas gedung.',
    ],
    stepByStepGuide: [
      '1. Atur kecepatan awal v₀ = 25 m/s pada ketinggian awal h₀ = 0 m.',
      '2. Ubah sudut elevasi θ berturut-turut: 15°, 30°, 45°, 60°, dan 75°.',
      '3. Buktikan bahwa pasangan sudut komplementer (misal 30° dan 60°) menghasilkan jarak jangkauan datar R yang sama.',
      '4. Uji sudut 45° untuk memverifikasi jarak jangkauan horizontal maksimum.',
    ],
    deepDiveContent: {
      historicalContext:
        'Galileo Galilei (1638) membuktikan bahwa lintasan proyektil merupakan parabola sempurna dengan mendemonstrasikan bahwa gerak horizontal (GLB) dan gerak vertikal (GLBB) saling bebas (independen).',
      derivationLatex: [
        'x(t) = v_0 \\cos\\theta \\cdot t \\implies t = \\frac{x}{v_0 \\cos\\theta}',
        'y(x) = h_0 + x \\tan\\theta - \\frac{g x^2}{2 v_0^2 \\cos^2\\theta}',
        'R = \\frac{v_0^2 \\sin(2\\theta)}{g} \\quad (\\text{saat } h_0 = 0)',
        'H_{\\max} = h_0 + \\frac{v_0^2 \\sin^2\\theta}{2g}',
      ],
      advancedConcept:
        'Persamaan sudut tembak optimum dari tebing tinggi h0: θ_opt = arcsin(1 / √(2 + 2gh0/v0²)).',
    },
  },

  'gravity-orbital': {
    chapterNumber: 1,
    chapterTitle: 'Bab 1: Kinematika & Dinamika Gerak Klasik',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Astronot di stasiun luar angkasa mengapung karena tidak ada gravitasi. Faktanya: Gravitasi di orbit rendah Bumi (~400 km) masih sekitar 90% gravitasi permukaan; astronot mengapung karena stasiun dan seisinya sedang jatuh bebas bersama mengitari Bumi.',
      'Kecepatan lepas bergantung pada bobot wahana roket. Faktanya: Kecepatan lepas v_esc = √(2GM/R) hanya ditentukan oleh massa dan radius benda langit sentral, sama sekali tidak bergantung pada massa wahana.',
    ],
    realWorldApplications: [
      'Penentuan kecepatan peluncuran Satelit Republik Indonesia (SATRIA-1) menuju orbit geostasioner (GEO 36.000 km).',
      'Manuver bantuan gravitasi (gravity assist / slingshot) pada wahana penjelajah antariksa antarplanet.',
      'Penentuan batas radius horizon peristiwa (Schwarzschild) pada lubang hitam astrofisika.',
    ],
    stepByStepGuide: [
      '1. Pilih planet Bumi (M = 5.97 × 10²⁴ kg, R = 6.37 × 10³ km).',
      '2. Amati kecepatan orbit lingkaran v_orb (~7.91 km/s) dan kecepatan lepas v_esc (~11.18 km/s).',
      '3. Buktikan secara matematis bahwa rasio v_esc / v_orb selalu bernilai tepat √2 ≈ 1.414.',
      '4. Ganti parameter massa benda sentral ke Jupiter untuk mengamati lonjakan kecepatan lepas hingga > 59 km/s.',
    ],
  },

  'pendulum-harmonic': {
    chapterNumber: 2,
    chapterTitle: 'Bab 2: Getaran Harmonik, Elastisitas & Dinamika Fluida',
    competencyLevel: 'Dasar',
    commonMisconceptions: [
      'Beban yang lebih berat membuat bandul mengayun lebih cepat. Faktanya: Massa beban sama sekali tidak memengaruhi periode ayunan bandul sederhana (T = 2π√(L/g)). Hanya panjang tali dan gravitasi yang menentukannya.',
      'Rumus T = 2π√(L/g) berlaku mutlak untuk sudut berapa pun. Faktanya: Rumus ini adalah hampiran sudut kecil (θ ≤ 15° di mana sin θ ≈ θ). Untuk sudut besar, waktu ayunan memanjang mengikuti koreksi Legendre.',
    ],
    realWorldApplications: [
      'Mekanisme jam dinding bandul mekanik kuno yang menjaga presisi waktu dengan ayunan isokronik.',
      'Peredam massa terstem (Tuned Mass Damper) pada gedung pencakar langit Monas / Taipei 101 untuk meredam goyangan gempa dan angin badai.',
      'Gravimeter geofisika eksplorasi minyak bumi untuk memetakan variasi gravitasi lokal di bawah tanah.',
    ],
    stepByStepGuide: [
      '1. Atur panjang tali L = 1.0 m dan sudut simpangan kecil θ = 10°.',
      '2. Variasikan massa beban dari 0.05 kg hingga 0.5 kg, lalu buktikan bahwa periode ayunan T tetap konstan ~2.00 detik.',
      '3. Variasikan panjang tali L dari 0.25 m hingga 1.5 m, lalu catat waktu 10 kali ayunan penuh.',
      '4. Plot grafik T² terhadap L; kemiringan garis regresi bernilai 4π²/g sehingga nilai gravitasi lokal dapat dihitung presisi.',
    ],
  },

  'spring-hooke': {
    chapterNumber: 2,
    chapterTitle: 'Bab 2: Getaran Harmonik, Elastisitas & Dinamika Fluida',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Pegas yang lebih kaku berosilasi lebih lambat. Faktanya: Pegas kaku memiliki konstanta k besar sehingga gaya pemulihnya lebih kuat dan frekuensi osilasinya justru jauh lebih tinggi (periode T berbanding terbalik dengan √k).',
      'Gaya pemulih pegas selalu searah dengan tarikan beban. Faktanya: Sesuai tanda minus pada F = -k·Δx, gaya pemulih selalu berlawanan arah dengan simpangan untuk mengembalikan benda ke posisi seimbang.',
    ],
    realWorldApplications: [
      'Sistem suspensi per keong (coil spring) dan peredam kejut (shock absorber) pada sepeda motor dan mobil di jalan bergelombang.',
      'Timbangan pegas gantung di pasar tradisional dan dinamometer laboratorium sains.',
      'Mekanisme pegas katup pada mesin pembakaran dalam silinder otomotif.',
    ],
    stepByStepGuide: [
      '1. Pasang pegas dengan konstanta k = 100 N/m.',
      '2. Gantungkan massa m = 0.5 kg, lalu variasikan simpangan awal dari 0.05 m hingga 0.3 m.',
      '3. Amati bahwa periode osilasi alami T tidak terpengaruh oleh besarnya amplitudo simpangan.',
      '4. Tambahkan massa beban secara bertahap dan buktikan hubungan kuadrat T² sebanding dengan massa m.',
    ],
  },

  'stokes-viscosity': {
    chapterNumber: 2,
    chapterTitle: 'Bab 2: Getaran Harmonik, Elastisitas & Dinamika Fluida',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Benda yang jatuh dalam zat cair akan dipercepat terus-menerus tanpa batas. Faktanya: Benda akan mencapai kecepatan terminal konstan ketika gaya berat ke bawah diimbangi sempurna oleh gaya apung Archimedes dan gaya gesek kental Stokes ke atas.',
      'Viskositas cairan sama dengan massa jenisnya. Faktanya: Viskositas adalah hambatan geser gesekan molekuler fluida, sedangkan massa jenis adalah kerapatan massa per volume. Minyak pelumas memiliki massa jenis lebih rendah dari air, namun viskositasnya jauh lebih tinggi.',
    ],
    realWorldApplications: [
      'Penentuan spesifikasi grade oli mesin kendaraan (SAE 10W-40 vs SAE 20W-50) untuk perlindungan gesekan piston pada suhu ekstrem.',
      'Industri pengolahan minyak kelapa sawit mentah (Crude Palm Oil / CPO) di Sumatera dan Kalimantan.',
      'Uji Laju Endap Darah (LED) pada laboratorium diagnostik medis untuk mendeteksi peradangan dalam tubuh.',
    ],
    stepByStepGuide: [
      '1. Isi tabung dengan gliserol murni (viskositas η = 0.95 Pa·s).',
      '2. Jatuhkan kelereng baja dengan jari-jari r = 3 mm, 5 mm, dan 8 mm.',
      '3. Catat waktu tempuh dan buktikan bahwa kecepatan terminal vt berbanding lurus dengan kuadrat jari-jari bola (r²).',
      '4. Periksa Bilangan Reynolds Re < 1 untuk memvalidasi bahwa rezim aliran laminar Stokes terpenuhi.',
    ],
  },

  'collision-momentum': {
    chapterNumber: 3,
    chapterTitle: 'Bab 3: Gelombang, Optika Fisik & Fisika Kuantum',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Energi kinetik selalu kekal pada setiap peristiwa tabrakan. Faktanya: Energi kinetik hanya kekal pada tumbukan lenting sempurna (e = 1). Pada tumbukan tidak lenting sama sekali (e = 0), sebagian energi kinetik terdisipasi menjadi energi termal (panas), deformasi bodi, dan gelombang suara.',
      'Benda yang diam tidak memiliki inersia. Faktanya: Benda diam memiliki inersia yang menolak perubahan gerak; semakin besar massanya, semakin besar momentum yang harus ditransfer oleh benda penabrak.',
    ],
    realWorldApplications: [
      'Zona benturan remuk (crumple zone) dan kantung udara (airbag) pada mobil modern untuk memperpanjang waktu impuls dan mereduksi gaya benturan fatal.',
      'Dinamika pukulan bola biliar dan ayunan bandul momentum Newton Cradle.',
      'Mekanisme pemancangan tiang paku bumi pada konstruksi jembatan dan gedung bertingkat.',
    ],
    stepByStepGuide: [
      '1. Atur massa troli 1 (m1 = 2 kg, v1 = 4 m/s) dan troli 2 (m2 = 2 kg, diam).',
      '2. Set koefisien restitusi e = 1.0 (lenting sempurna) dan amati transfer kecepatan total.',
      '3. Ubah koefisien restitusi e = 0.0 (tidak lenting sama sekali) dan buktikan kedua troli menyatu meluncur bersama dengan kecepatan akhir v = 2.0 m/s.',
      '4. Hitung disipasi energi kinetik sistem (ΔEk) pada variasi elastisitas tumbukan.',
    ],
  },

  'ohm-wheatstone': {
    chapterNumber: 3,
    chapterTitle: 'Bab 3: Gelombang, Optika Fisik & Fisika Kuantum',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Arus listrik habis dikonsumsi oleh lampu dalam rangkaian. Faktanya: Muatan listrik bersifat kekal (Hukum I Kirchhoff); laju elektron yang masuk ke lampu persis sama dengan yang keluar. Yang diserap lampu adalah energi potensial listrik (tegangan), bukan elektronnya.',
      'Voltmeter dirangkai seri dengan beban. Faktanya: Voltmeter memiliki resistansi internal sangat tinggi dan wajib dirangkai paralel; amperemeter memiliki resistansi mendekati nol dan dirangkai seri.',
    ],
    realWorldApplications: [
      'Sensor regangan jembatan (strain gauge) berbasis jembatan Wheatstone untuk memonitor integritas struktur jembatan bentang panjang.',
      'Termometer resistansi platina presisi (RTD PT100) pada tangki reaktor industri kimia.',
      'Sensor gas semikonduktor pada detektor kebocoran tabung LPG rumah tangga.',
    ],
    stepByStepGuide: [
      '1. Rangkai jembatan Wheatstone dengan R1 = 100 Ω, R2 = 100 Ω, dan resistor uji Rx = 220 Ω.',
      '2. Geser nilai resistor variabel R3 secara perlahan.',
      '3. Amati indikator galvanometer hingga beda potensial jembatan VG tepat mencapai 0.0 mV (kondisi seimbang).',
      '4. Buktikan bahwa nilai Rx terhitung tepat sama dengan R3 × (R1 / R2).',
    ],
  },

  'optics-young-slit': {
    chapterNumber: 3,
    chapterTitle: 'Bab 3: Gelombang, Optika Fisik & Fisika Kuantum',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Cahaya yang melewati dua celah sempit hanya menghasilkan dua garis bayangan di layar. Faktanya: Gelombang cahaya dari kedua celah mengalami difraksi lenturan dan berinterferensi menghasilkan puluhan pita garis terang dan gelap bergantian.',
      'Pita gelap terbentuk karena partikel foton saling menghancurkan secara fisik. Faktanya: Pita gelap adalah peristiwa interferensi destruktif akibat selisih fase 180° (beda lintasan setengah panjang gelombang).',
    ],
    realWorldApplications: [
      'Lapisan tipis anti-silau (anti-reflective coating) pada lensa kacamata dan kamera DSLR profesional.',
      'Spektrometer kisi difraksi astronomi untuk menganalisis komposisi unsur kimia atmosfer bintang.',
      'Perekaman keamanan hologram pada uang kertas Rupiah emisi terbaru dan paspor RI.',
    ],
    stepByStepGuide: [
      '1. Nyalakan sumber laser merah (λ = 650 nm) dengan jarak celah d = 0.25 mm dan jarak layar L = 1.5 m.',
      '2. Amati pola pita terang-gelap di layar dan ukur jarak antar-pita terang Δy (~3.9 mm).',
      '3. Ganti sumber laser ke warna hijau (λ = 532 nm) dan amati bahwa pita terang merapat karena panjang gelombangnya lebih pendek.',
      '4. Periksa korelasi linear antara jarak layar L dan jarak antar-terang Δy.',
    ],
  },

  'photoelectric-planck': {
    chapterNumber: 3,
    chapterTitle: 'Bab 3: Gelombang, Optika Fisik & Fisika Kuantum',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Menaikkan intensitas cahaya redup akan meningkatkan energi kinetik elektron yang lepas. Faktanya: Teori gelombang klasik gagal di sini! Menambah intensitas hanya memperbanyak jumlah foton (arus listrik), tetapi energi kinetik per elektron hanya ditentukan oleh frekuensi atau panjang gelombang foton.',
      'Cahaya merah yang sangat terang mampu melepaskan elektron jika disorot berjam-jam. Faktanya: Jika frekuensi foton berada di bawah frekuensi ambang f0 (hf < W0), tidak ada satu pun elektron yang terlepas berapa pun terangnya cahaya tersebut.',
    ],
    realWorldApplications: [
      'Panel surya fotovoltaik pembangkit listrik tenaga surya (PLTS Terapung Cirata Jawa Barat).',
      'Sensor kamera penglihatan malam (night vision goggles) dan sensor fotodioda sensorik.',
      'Sensor keselamatan pintu lift otomatis dan pemindai barcode optik retail.',
    ],
    stepByStepGuide: [
      '1. Pilih katoda Cesium dengan fungsi kerja W0 = 2.14 eV.',
      '2. Sorotkan cahaya merah (λ = 650 nm, E = 1.91 eV) dan buktikan tidak ada elektron foto yang terlepas.',
      '3. Pendekkan panjang gelombang ke warna violet (λ = 400 nm, E = 3.10 eV) dan amati terbentuknya elektron foto dengan potensial henti V0 = 0.96 V.',
      '4. Plot kurva potensial henti V0 terhadap frekuensi f untuk mengukur nilai konstanta Planck h.',
    ],
  },

  // ==========================================
  // KIMIA (6 MODUL)
  // ==========================================
  'thermo-calorimetry': {
    chapterNumber: 4,
    chapterTitle: 'Bab 4: Termodinamika & Kinetika Reaksi Kimia',
    competencyLevel: 'Dasar',
    commonMisconceptions: [
      'Suhu dan kalor adalah besaran fisik yang identik. Faktanya: Suhu adalah ukuran energi kinetik rata-rata partikel zat (°C atau K), sedangkan kalor adalah perpindahan energi termal (Joule) akibat perbedaan suhu.',
      'Reaksi eksotermik menyerap panas karena terasa panas di tangan. Faktanya: Reaksi melepaskan kalor ke lingkungan; tangan kita terasa hangat karena kalor dari larutan berpindah mengalir ke kulit kita (ΔH bertanda negatif).',
    ],
    realWorldApplications: [
      'Kalorimeter bom di industri pangan untuk menentukan nilai kalori energi pada label informasi nilai gizi BPOM.',
      'Kompres dingin instan (cold pack ammonium nitrat endotermik) dan kantung penghangat darurat (heat pack eksotermik).',
      'Perhitungan efisiensi bahan bakar minyak bumi dan gas alam di kilang pengolahan Pertamina.',
    ],
    stepByStepGuide: [
      '1. Masukkan 125 mL HCl 1.0 M dan 125 mL NaOH 1.0 M ke dalam kalorimeter pada suhu awal 25.0°C.',
      '2. Nyalakan pengaduk magnetik pada 240 RPM untuk menjamin homogenitas campuran.',
      '3. Catat kenaikan suhu puncak ΔT (~6.85°C).',
      '4. Hitung kalor reaksi q = m·c·ΔT dan buktikan entalpi netralisasi molar standar ΔH ≈ -57.3 kJ/mol.',
    ],
  },

  'ideal-gas-boyle': {
    chapterNumber: 4,
    chapterTitle: 'Bab 4: Termodinamika & Kinetika Reaksi Kimia',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Gas ideal benar-benar berwujud nyata di alam semesta. Faktanya: Gas ideal adalah model pendekatan teoritis di mana gaya tarik antarmolekul dan volume partikel diabaikan; gas nyata mendekati sifat ideal pada tekanan rendah dan suhu tinggi.',
      'Menekan gas secara cepat suhunya selalu konstan. Faktanya: Penekanan cepat berlangsung secara adiabatik (tanpa waktu pertukaran kalor Q = 0) sehingga kerja kompresi langsung meningkatkan suhu gas secara tajam.',
    ],
    realWorldApplications: [
      'Prinsip kerja pompa ban sepeda dan kompresor tabung udara penyelam (scuba diving).',
      'Mesin diesel kendaraan yang menyalakan bahan bakar solar melalui panas kompresi udara murni tanpa busi.',
      'Sistem penyimpanan gas bertekanan tinggi pada tabung oksigen medis rumah sakit dan tabung elpiji.',
    ],
    stepByStepGuide: [
      '1. Atur jumlah mol gas n = 1.0 mol pada suhu T = 300 K.',
      '2. Pada mode Isotermal, ubah volume silinder dari 20 L, 15 L, 10 L, hingga 5 L.',
      '3. Amati kurva hiperbolik tekanan P vs volume V sesuai Hukum Boyle (P ∝ 1/V).',
      '4. Beralih ke mode Adiabatik dan amati tekanan naik jauh lebih curam akibat eksponen adiabatik γ = 1.4.',
    ],
  },

  'reaction-kinetics-arrhenius': {
    chapterNumber: 4,
    chapterTitle: 'Bab 4: Termodinamika & Kinetika Reaksi Kimia',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Semua tumbukan antarmolekul pasti menghasilkan reaksi kimia baru. Faktanya: Hanya tumbukan efektif yang menghasilkan reaksi, yakni tumbukan dengan orientasi geometri yang tepat dan energi kinetik melampaui energi aktivasi (E ≥ Ea).',
      'Katalis mempercepat reaksi dengan cara menambah energi molekul pereaksi. Faktanya: Katalis tidak menambah energi, melainkan menyediakan rute mekanisme reaksi alternatif dengan energi aktivasi yang jauh lebih rendah.',
    ],
    realWorldApplications: [
      'Penyimpanan bahan pangan di lemari es (freezer) untuk memperlambat laju reaksi biokimia pembusukan bakteri.',
      'Penggunaan konverter katalitik logam platina pada knalpot kendaraan untuk mereduksi gas buang beracun CO dan NOx.',
      'Sintesis pupuk urea amonia skala besar pada industri pupuk nasional dengan proses Haber-Bosch berkatalis besi.',
    ],
    stepByStepGuide: [
      '1. Atur konsentrasi reaktan [A] = 0.8 M dan energi aktivasi Ea = 52 kJ/mol.',
      '2. Catat laju reaksi pada variasi suhu: 20°C, 30°C, 40°C, 50°C, dan 60°C.',
      '3. Amati bagaimana waktu paruh reaksi (t½) menyusut eksponensial seiring peningkatan suhu.',
      '4. Plot kurva ln(k) vs 1/T untuk membuktikan gradien garis lurus bernilai -Ea / R.',
    ],
  },

  'acid-base-titration': {
    chapterNumber: 5,
    chapterTitle: 'Bab 5: Larutan, Titrasi Volumetri & Elektrokimia Modern',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Titik ekuivalen selalu berada tepat pada pH 7 untuk semua jenis titrasi. Faktanya: pH 7 hanya terjadi pada titrasi asam kuat dengan basa kuat. Pada titrasi asam lemah dengan basa kuat, hidrolisis garam menghasilkan titik ekuivalen pada pH basa (> 7).',
      'Titik akhir titrasi persis sama dengan titik ekuivalen. Faktanya: Titik ekuivalen adalah kondisi stoikiometri mol H+ tepat bereaksi habis dengan mol OH-, sedangkan titik akhir titrasi adalah momen saat indikator visual berubah warna.',
    ],
    realWorldApplications: [
      'Standardisasi kadar keasaman cuka makan dapur di industri pangan olahan nusantara.',
      'Pemantauan baku mutu pH air limbah industri tekstil sebelum dibuang ke aliran sungai.',
      'Uji kendali mutu penetralan asam lambung pada sediaan obat antasida di industri farmasi.',
    ],
    stepByStepGuide: [
      '1. Isi buret dengan titran NaOH 0.25 M dan Erlenmeyer dengan 25 mL analit HCl 0.20 M.',
      '2. Teteskan titran bertahap: 5 mL, 10 mL, 15 mL, 19 mL, dan 20 mL.',
      '3. Amati lonjakan tajam kurva pH sigmoidal tepat mencapai pH netral 7.00 saat volume NaOH = 20.0 mL.',
      '4. Tambahkan sedikit kelebihan titran (21 mL) dan amati pH langsung melonjak tinggi ke suasana basa pekat.',
    ],
  },

  'redox-electrochemistry': {
    chapterNumber: 5,
    chapterTitle: 'Bab 5: Larutan, Titrasi Volumetri & Elektrokimia Modern',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Elektron mengalir menyeberangi jembatan garam di dalam larutan cair. Faktanya: Elektron hanya mengalir melalui kawat konduktor logam eksternal; jembatan garam menghantarkan ion kation dan anion untuk menetralkan penumpukan muatan.',
      'Tegangan baterai selalu konstan 1.10 V selama digunakan sampai habis. Faktanya: Menurut Persamaan Nernst, seiring menumpuknya ion anoda dan menipisnya ion katoda, potensial sel terukur perlahan menurun hingga nol volt.',
    ],
    realWorldApplications: [
      'Hilirisasi industri baterai sekunder Lithium-Ion dan sel nikel untuk kendaraan listrik nasional di Morowali.',
      'Pencegahan korosi pipa baja minyak bawah laut menggunakan sistem proteksi katodik anoda korban (sacrificial anode).',
      'Pelapisan logam krom dan emas (electroplating) untuk proteksi karat dan estetika perhiasan.',
    ],
    stepByStepGuide: [
      '1. Siapkan sel Daniell Zn/Cu dengan konsentrasi awal [Zn²⁺] = 1.0 M dan [Cu²⁺] = 1.0 M.',
      '2. Baca tegangan sel standar E° = 1.100 V pada voltmeter digital.',
      '3. Encerkan konsentrasi anoda [Zn²⁺] menjadi 0.01 M dan amati potensial sel terukur naik menjadi ~1.159 V.',
      '4. Buktikan keabsahan Persamaan Nernst E = E° - (0.0592/2)·log([Zn²⁺]/[Cu²⁺]).',
    ],
  },

  'spectrophotometry-beer': {
    chapterNumber: 5,
    chapterTitle: 'Bab 5: Larutan, Titrasi Volumetri & Elektrokimia Modern',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Absorbansi dan transmitansi berbanding lurus secara linier. Faktanya: Hubungannya adalah logaritmik terbalik A = -log10(T). Larutan yang meneruskan 10% cahaya memiliki absorbansi 1.0; meneruskan 1% cahaya memiliki absorbansi 2.0.',
      'Hukum Lambert-Beer berlaku tanpa batas untuk konsentrasi pekat berapa pun. Faktanya: Pada larutan pekat (> 0.01 M), jarak antarmolekul yang terlalu rapat memicu deviasi negatif akibat interaksi medan elektrostatik.',
    ],
    realWorldApplications: [
      'Uji laboratorium BPOM untuk mendeteksi zat pewarna berbahaya terlarang (Rhodamin-B) pada pangan olahan.',
      'Pengukuran kadar hemoglobin dan bilirubin pada uji laboratorium darah klinis rumah sakit.',
      'Analisis pencemaran logam berat terlarut pada air danau dan muara sungai.',
    ],
    stepByStepGuide: [
      '1. Atur panjang gelombang spektrofotometer pada puncak serapan analit λ = 525 nm.',
      '2. Gunakan kuvet kuarsa standar dengan panjang lintasan optik b = 1.0 cm.',
      '3. Uji deret konsentrasi analit dari 0.02 mM hingga 0.20 mM.',
      '4. Buktikan linearitas kurva kalibrasi absorbansi A terhadap konsentrasi c (A = ε·b·c).',
    ],
  },

  // ==========================================
  // BIOLOGI (7 MODUL)
  // ==========================================
  'photosynthesis-ingenhousz': {
    chapterNumber: 6,
    chapterTitle: 'Bab 6: Fisiologi Sel, Enzimologi & Ekologi Kuantitatif',
    competencyLevel: 'Dasar',
    commonMisconceptions: [
      'Tumbuhan hanya berfotosintesis dan tidak melakukan respirasi seluler. Faktanya: Sel tumbuhan bernapas sepanjang waktu (24 jam) menyerap O2 dan melepas CO2; fotosintesis hanya berlangsung saat ada cahaya dan laju O2 yang dihasilkan jauh melampaui konsumsi respirasinya.',
      'Cahaya hijau adalah cahaya paling efektif untuk fotosintesis karena daun berwarna hijau. Faktanya: Daun tampak hijau justru karena klorofil memantulkan warna hijau! Fotosintesis paling aktif pada cahaya biru (~435 nm) dan merah (~660 nm).',
    ],
    realWorldApplications: [
      'Pengaturan lampu LED tumbuh (grow lights) spektrum biru-merah pada pertanian modern perkotaan (urban vertical farming).',
      'Kultivasi mikroalga Spirulina sebagai penyerap emisi karbon pembangkit listrik.',
      'Optimalisasi suplai oksigen biologis pada akuarium aquascape tanaman air tawar.',
    ],
    stepByStepGuide: [
      '1. Rangkai tanaman air Hydrilla di bawah corong terbalik dalam beker berisi air bersih.',
      '2. Nyalakan sumber cahaya dengan intensitas 1200 lux pada spektrum merah (λ = 660 nm).',
      '3. Tambahkan 2.5 g/L serbuk NaHCO3 sebagai donor CO2 terlarut dan amati pelepasan gelembung oksigen.',
      '4. Ganti filter cahaya ke warna hijau (λ = 530 nm) dan saksikan laju pelepasan gelembung anjlok drastis.',
    ],
  },

  'enzyme-catalase': {
    chapterNumber: 6,
    chapterTitle: 'Bab 6: Fisiologi Sel, Enzimologi & Ekologi Kuantitatif',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Semakin tinggi suhu pemanasan, enzim akan bekerja semakin cepat tanpa batas. Faktanya: Aktivitas enzim hanya meningkat hingga suhu optimum (~37°C); suhu di atas 45°C merusak ikatan hidrogen struktur tersier protein (denaturasi permanen).',
      'Enzim habis bereaksi bersama substratnya. Faktanya: Enzim adalah biokatalisator yang tidak berubah di akhir reaksi dan dapat digunakan kembali untuk menguraikan molekul substrat berikutnya.',
    ],
    realWorldApplications: [
      'Penetralan senyawa racun hidrogen peroksida sisa metabolisme oleh sel organ hati mamalia.',
      'Pemanfaatan enzim papain dari getah pepaya untuk melunakkan serat daging masakan tradisional.',
      'Formulasi deterjen enzimatik pencuci pakaian yang efektif merontokkan noda darah pada air dingin.',
    ],
    stepByStepGuide: [
      '1. Masukkan ekstrak hati ayam yang kaya enzim katalase ke dalam tabung reaksi pada suhu 37°C.',
      '2. Tambahkan substrat H2O2 10 mM pada suasana pH netral 7.0.',
      '3. Amati lonjakan kolom busa gelembung oksigen dan lakukan uji bara api menyala.',
      '4. Didihkan ekstrak enzim di atas 65°C sebelum ditetesi H2O2, lalu buktikan tidak ada busa yang terbentuk akibat denaturasi termal.',
    ],
  },

  'osmosis-plasmolysis': {
    chapterNumber: 6,
    chapterTitle: 'Bab 6: Fisiologi Sel, Enzimologi & Ekologi Kuantitatif',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Pada larutan isotonik, molekul air berhenti bergerak melintasi membran sel. Faktanya: Molekul air tetap bergerak bebas melintasi membran ke dua arah, namun laju air masuk sama dengan laju air keluar (kesetimbangan dinamis).',
      'Dinding sel tumbuhan mengempis dan kolaps saat berada di larutan gula pekat. Faktanya: Dinding selulosa kaku dan mempertahankan bentuk luar sel; yang menyusut dan terlepas adalah membran plasma sitoplasma di dalamnya (plasmolisis).',
    ],
    realWorldApplications: [
      'Metode pengawetan ikan asin dan manisan buah tradisional dengan menciptakan lingkungan hipertonik pembunuh bakteri.',
      'Teknologi desalinasi air laut menjadi air minum Reverse Osmosis (RO) di pulau-pulau 3T kepulauan nusantara.',
      'Pemberian infus cairan natrium klorida fisiologis 0.9% (isotonik) bagi pasien dehidrasi di rumah sakit.',
    ],
    stepByStepGuide: [
      '1. Potong silinder umbi kentang dengan massa awal m0 = 2.5 gram.',
      '2. Rendam ke dalam deret larutan sukrosa murni: 0.0 M (aquades), 0.2 M, 0.4 M, 0.6 M, dan 0.8 M.',
      '3. Setelah 30 menit, timbang kembali massa akhir masing-masing jaringan kentang.',
      '4. Tentukan konsentrasi larutan isotonik sel kentang pada titik potong kurva perubahan massa Δm = 0% (~0.28 M).',
    ],
  },

  'predator-prey-dynamics': {
    chapterNumber: 6,
    chapterTitle: 'Bab 6: Fisiologi Sel, Enzimologi & Ekologi Kuantitatif',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Populasi predator dan mangsa selalu berjumlah tetap di alam bebas. Faktanya: Populasi keduanya berosilasi membentuk kurva siklik bergelombang, di mana puncak populasi predator selalu tertinggal seperempat fase di belakang mangsa.',
      'Predator merupakan musuh yang harus dibasmi demi melindungi populasi mangsa. Faktanya: Predator adalah pengendali vital keseimbangan ekosistem; tanpa pemangsa, mangsa mengalami ledakan populasi yang menghabiskan vegetasi dan memicu kepunahan massal.',
    ],
    realWorldApplications: [
      'Pengendalian hama biologis terpadu menggunakan burung hantu Tyto alba untuk menekan hama tikus di perkebunan sawit.',
      'Pengaturan kuota tangkap perikanan laut lestari di Wilayah Pengelolaan Perikanan (WPP) Indonesia.',
      'Program konservasi pelestarian habitat harimau sumatera dan banteng jawa di taman nasional.',
    ],
    stepByStepGuide: [
      '1. Atur populasi awal mangsa x = 40 individu dan predator y = 9 individu.',
      '2. Amati siklus osilasi kurva waktu: saat mangsa bertambah, predator menyusul naik.',
      '3. Amati potret ruang fase (phase-portrait) tertutup yang membuktikan invarian energi ekologis H(x,y).',
      '4. Uji titik ekuilibrium koeksistensi x* = γ/δ dan y* = α/β.',
    ],
  },

  'anatomy-cardiovascular-heart': {
    chapterNumber: 7,
    chapterTitle: 'Bab 7: Anatomi Manusia 3D & Sistem Fisiologi Organ',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Darah manusia berwarna biru saat berada di dalam pembuluh vena. Faktanya: Darah manusia selalu berwarna merah; darah kaya oksigen berwarna merah terang cerah dan miskin oksigen berwarna merah tua pekat. Tampak kebiruan di kulit hanya akibat hambatan refraksi optik kulit.',
      'Jantung terletak sepenuhnya di rongga dada sebelah kiri. Faktanya: Jantung berada di tengah rongga dada (mediastinum) di antara kedua paru-paru, dengan apeks puncak bawahnya miring ke arah kiri.',
    ],
    realWorldApplications: [
      'Pencegahan serangan jantung koroner dan stroke melalui deteksi dini penimbunan plak aterosklerosis pembuluh darah.',
      'Pemeriksaan elektrokardiogram (EKG 12-lead) oleh dokter spesialis jantung untuk mendiagnosis aritmia dan iskemia.',
      'Pengukuran tekanan darah rutin menggunakan tensimeter digital di Posyandu dan fasilitas kesehatan primer.',
    ],
    stepByStepGuide: [
      '1. Buka model anatomi 3D jantung berdetak dan kenali 4 ruang jantung serta katup atrioventrikular.',
      '2. Atur denyut jantung HR = 72 bpm dan amati sinkronisasi gelombang EKG P-QRS-T terhadap kontraksi bilik jantung.',
      '3. Perkecil radius pembuluh (r/r0 = 0.6) untuk mensimulasikan aterosklerosis dan amati lonjakan resistensi vaskular (Hukum Poiseuille R ∝ 1/r⁴).',
      '4. Hitung Curah Jantung CO = (HR × SV) / 1000.',
    ],
  },

  'anatomy-respiratory-lungs': {
    chapterNumber: 7,
    chapterTitle: 'Bab 7: Anatomi Manusia 3D & Sistem Fisiologi Organ',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Paru-paru memiliki jaringan otot sendiri yang aktif memompa udara. Faktanya: Paru-paru tidak memiliki otot rangka; udara mengalir masuk karena kontraksi otot diafragma dan otot antartulang rusuk yang memperbesar rongga dada (Hukum Boyle).',
      'Di puncak gunung tinggi persentase oksigen di udara turun di bawah 21%. Faktanya: Fraksi oksigen di udara tetap konstan ~20.9% di mana pun; yang turun drastis adalah tekanan total atmosfer barometrik sehingga tekanan parsial pendorong difusi oksigen ke darah anjlok.',
    ],
    realWorldApplications: [
      'Pengaturan parameter mesin ventilator mekanik pernapasan di ruang Intensive Care Unit (ICU) rumah sakit.',
      'Protokol aklimatisasi pendaki gunung di Puncak Cartenz Papua (4.884 mdpl) untuk mencegah edema paru akut.',
      'Terapi inhaler bronkodilator untuk meredakan penyempitan jalan napas pada pasien asma bronkial.',
    ],
    stepByStepGuide: [
      '1. Amati gerakan mendatar kubah diafragma saat fase inspirasi pada model toraks 3D.',
      '2. Naikkan ketinggian tempat dari 0 mdpl ke 4500 mdpl dan perhatikan bagaimana tekanan parsial oksigen PAO2 turun.',
      '3. Amati kurva saturasi oksihemoglobin Hill sigmoid di mana SpO2 turun di bawah 85% memicu refleks napas cepat.',
      '4. Naikkan resistensi jalan napas untuk mensimulasikan serangan asma dan amati penyusutan Volume Tidal (TV).',
    ],
  },

  'anatomy-neural-synapse': {
    chapterNumber: 7,
    chapterTitle: 'Bab 7: Anatomi Manusia 3D & Sistem Fisiologi Organ',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Sinyal saraf merambat seperti aliran elektron pada kawat tembaga kabel listrik. Faktanya: Impuls saraf adalah peristiwa elektrokimiawi biologis berupa pertukaran ion natrium dan kalium melintasi membran sel melalui kanal berpintu tegangan.',
      'Rangsangan yang lebih kuat menghasilkan lonjakan voltase potensial aksi yang lebih tinggi. Faktanya: Menurut Hukum All-or-None, amplitudo potensial aksi selalu sama tinggi (+30 mV) begitu ambang batas -55 mV terlewati; stimulus kuat hanya menaikkan frekuensi tembakan impuls per detik.',
    ],
    realWorldApplications: [
      'Mekanisme kerja obat anestesi lokal (seperti lidokain) yang memblokir kanal Na+ berpintu tegangan sehingga impuls nyeri tidak sampai ke otak.',
      'Pemahaman patofisiologi penyakit Multiple Sclerosis yang merusak selubung mielin sehingga konduksi saraf melambat.',
      'Pengembangan teknologi prostetik lengan robotik bionik yang dikendalikan oleh sinyal saraf motorik.',
    ],
    stepByStepGuide: [
      '1. Berikan stimulus sub-ambang (-60 mV) dan amati bahwa potensial aksi gagal terbentuk.',
      '2. Naikkan stimulus melampaui ambang batas (-40 mV) dan amati lonjakan depolarisasi eksplosif menuju +30 mV.',
      '3. Ubah ketebalan selubung mielin dari 0% ke 100% dan amati peningkatan kecepatan konduksi saltatorik dari 2 m/s ke > 100 m/s.',
      '4. Amati eksositosis pelepasan neurotransmiter di celah sinapsis saat impuls mencapai ujung akson.',
    ],
  },

  // ==========================================
  // ASTRONOMI (5 MODUL)
  // ==========================================
  'solar-kepler': {
    chapterNumber: 8,
    chapterTitle: 'Bab 8: Astrofisika Observasional & Kosmologi Modern',
    competencyLevel: 'Dasar',
    commonMisconceptions: [
      'Orbit planet berbentuk lingkaran bulat sempurna dengan Matahari di tengahnya. Faktanya: Sesuai Hukum I Kepler, orbit planet adalah elips dengan Matahari terletak di salah satu dari dua titik fokusnya.',
      'Planet meluncur dengan kecepatan tetap sepanjang tahun. Faktanya: Sesuai Hukum II Kepler, planet bergerak paling cepat saat berada di titik terdekat dengan Matahari (perihelion) dan paling lambat di titik terjauh (aphelion).',
    ],
    realWorldApplications: [
      'Kalkulasi orbit transfer Hohmann untuk mengarahkan wahana antariksa dari Bumi menuju planet Mars dengan efisiensi bahan bakar maksimal.',
      'Penentuan posisi presisi satelit navigasi GPS dan satelit komunikasi geostasioner orbit Bumi.',
      'Prediksi waktu kejadian gerhana matahari dan gerhana bulan dengan akurasi hingga sepersekian detik.',
    ],
    stepByStepGuide: [
      '1. Atur sumbu semi-mayor orbit a = 1.0 AU dan eksentrisitas elips e = 0.017 (orbit Bumi).',
      '2. Naikkan eksentrisitas ke e = 0.60 dan amati bagaimana kecepatan planet melesat kencang di perihelion dan melambat di aphelion.',
      '3. Ubah sumbu semi-mayor ke a = 5.2 AU (orbit Jupiter) dan catat periode orbit T = 11.86 tahun.',
      '4. Buktikan bahwa rasio Kepler T² / a³ selalu bernilai konstan 1.000 untuk semua planet Tata Surya.',
    ],
  },

  'milky-way-rotation': {
    chapterNumber: 8,
    chapterTitle: 'Bab 8: Astrofisika Observasional & Kosmologi Modern',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Materi gelap hanyalah lubang hitam kecil yang banyak bertebaran. Faktanya: Materi gelap adalah partikel subatomik eksotis non-barionik masif yang tidak memancarkan maupun menyerap cahaya, membentuk halo raksasa yang menyelubungi seluruh galaksi.',
      'Kecepatan putaran bintang di pinggiran galaksi melambat seperti planet luar tata surya. Faktanya: Pengamatan Vera Rubin membuktikan kurva rotasi galaksi justru mendatar (flat rotation curve) pada kecepatan tinggi ~220 km/s akibat massa halo materi gelap.',
    ],
    realWorldApplications: [
      'Riset observasional astrofisika di Observatorium Nasional Timau NTT untuk memetakan dinamika galaksi.',
      'Simulasi kosmologi superkomputer dalam memodelkan evolusi jaring kosmik pembentukan galaksi.',
      'Teknologi pelensaan gravitasi (gravitational lensing) untuk mengukur massa gugus galaksi jauh.',
    ],
    stepByStepGuide: [
      '1. Amati kecepatan rotasi teramati v_obs pada radius galaktosentris r = 8.2 kpc (~220 km/s).',
      '2. Bandingkan dengan kurva kecepatan Keplerian berbasis materi tampak yang meluruh turun sebanding dengan 1/√r.',
      '3. Naikkan fraksi halo materi gelap dan saksikan kurva rotasi mendatar stabil pada jarak puluhan kiloparsek.',
      '4. Hitung massa materi gelap yang terkungkung di dalam orbit Bima Sakti.',
    ],
  },

  'exoplanet-transit': {
    chapterNumber: 8,
    chapterTitle: 'Bab 8: Astrofisika Observasional & Kosmologi Modern',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Planet di luar Tata Surya dapat langsung dipotret terang benderang dengan teleskop biasa. Faktanya: Bintang induk miliaran kali lebih silau dibanding planetnya; eksoplanet dideteksi secara tidak langsung dari peredupan cahaya saat planet melintas (metode transit).',
      'Gerhana transit eksoplanet dapat terlihat dari sudut pandang mana pun di antariksa. Faktanya: Transit hanya teramati jika bidang orbit planet kebetulan sejajar tepat dengan garis pandang teleskop di Bumi.',
    ],
    realWorldApplications: [
      'Pencarian planet ekstrasurya berzona layak huni (habitable zone) pada sistem bintang TRAPPIST-1 dan Proxima Centauri.',
      'Karakterisasi atmosfer eksoplanet oleh Teleskop Luar Angkasa James Webb (JWST) untuk mendeteksi tanda kehidupan (uap air, metana, ozon).',
      'Teknologi detektor CCD fotometri presisi tinggi pada wahana antariksa misi Kepler dan TESS.',
    ],
    stepByStepGuide: [
      '1. Pilih bintang seukuran Matahari (R* = 1.0 R☉) dan eksoplanet seukuran Jupiter (Rp = 11.2 R⊕).',
      '2. Amati kurva cahaya fotometri saat piringan planet mulai melintas di depan bintang induknya.',
      '3. Catat kedalaman penurunan fluks cahaya (transit depth ~1.05%).',
      '4. Perkecil radius planet ke ukuran Bumi (Rp = 1.0 R⊕) dan amati penurunan fluks yang sangat tipis (~84 ppm).',
    ],
  },

  'stellar-wien-spectrum': {
    chapterNumber: 8,
    chapterTitle: 'Bab 8: Astrofisika Observasional & Kosmologi Modern',
    competencyLevel: 'Menengah',
    commonMisconceptions: [
      'Bintang berwarna merah adalah bintang yang paling panas di alam semesta. Faktanya: Kebalikannya! Bintang merah adalah bintang yang paling dingin (T < 3500 K); bintang paling panas berwarna biru cerah dan ultraviolet (T > 10.000 K s.d. 40.000 K).',
      'Matahari hanya memancarkan cahaya warna kuning tunggal. Faktanya: Matahari memancarkan spektrum kontinu radiasi benda hitam yang mencakup semua warna (putih murni di luar atmosfer) dengan puncak emisi di daerah hijau-kuning (~500 nm).',
    ],
    realWorldApplications: [
      'Termometer inframerah pirometer tanpa sentuh (thermogun) untuk pengecekan suhu tubuh dan pabrik peleburan baja.',
      'Klasifikasi umur dan evolusi bintang pada Diagram Hertzsprung-Russell di observatorium astronomi.',
      'Kamera termografi FLIR untuk deteksi kebocoran energi bangunan dan operasi SAR malam hari.',
    ],
    stepByStepGuide: [
      '1. Atur suhu fotosfer bintang T = 5800 K (kelas spektral G, tipe Matahari).',
      '2. Amati panjang gelombang puncak radiasi benda hitam λmax = 500 nm pada spektrum tampak.',
      '3. Naikkan suhu ke T = 15.000 K (bintang biru kelas B) dan saksikan puncak spektrum bergeser ke wilayah ultraviolet.',
      '4. Turunkan suhu ke T = 3000 K (bintang kerdil merah kelas M) dan saksikan puncak spektrum bergeser ke inframerah.',
    ],
  },

  'hubble-expansion': {
    chapterNumber: 8,
    chapterTitle: 'Bab 8: Astrofisika Observasional & Kosmologi Modern',
    competencyLevel: 'Lanjut',
    commonMisconceptions: [
      'Galaksi-galaksi menjauh karena bergerak terbang menembus ruang angkasa yang diam. Faktanya: Ruang waktu alam semesta itu sendirilah yang sedang meregang dan mengembang di antara galaksi-galaksi (ekspansi metrik ruang).',
      'Bumi adalah pusat alam semesta karena semua galaksi tampak menjauh dari kita. Faktanya: Pengamat di galaksi mana pun di alam semesta akan melihat galaksi lain menjauh darinya dengan hukum yang persis sama, seperti kismis pada adonan roti yang sedang mengembang.',
    ],
    realWorldApplications: [
      'Penentuan perkiraan usia alam semesta (~13.8 miliar tahun) dari invers Konstanta Hubble t ≈ 1/H0.',
      'Pemetaan struktur jaring kosmik raksasa (cosmic web) oleh teleskop survei Sloan Digital Sky Survey (SDSS).',
      'Penelitian energi gelap (Dark Energy) yang mendorong percepatan ekspansi alam semesta modern.',
    ],
    stepByStepGuide: [
      '1. Pilih garis spektral diam Kalsium-K (λ0 = 393.4 nm).',
      '2. Amati galaksi pada jarak d = 100 Mpc, 200 Mpc, 300 Mpc, dan 400 Mpc.',
      '3. Catat pergeseran merah panjang gelombang teramati (λobs) dan kecepatan resesi galaksi (v = H0·d).',
      '4. Plot grafik kecepatan resesi v terhadap jarak d; kemiringan garis regresi membuktikan nilai Konstanta Hubble H0 (~70 km/s/Mpc).',
    ],
  },
};
