import type { ModulePedagogyBundle } from './index';

export const ASTRONOMY_PEDAGOGY: Record<string, ModulePedagogyBundle> = {
  'solar-kepler': {
    keyTakeaways: [
      'Hukum I Kepler: Orbit setiap planet berbentuk elips dengan Matahari berada di salah satu titik fokusnya.',
      'Hukum II Kepler: Planet menyapu luas juring yang sama dalam waktu sama — melaju paling cepat di perihelion dan paling lambat di aphelion.',
      'Hukum III Kepler: Kuadrat periode orbit sebanding dengan pangkat tiga sumbu semi-mayor (T² = a³ / M bintang dalam satuan tahun, AU, M☉).',
    ],
    everydayAnalogy: {
      title: 'Penari Es Mempercepat Putaran Saat Menarik Tangan',
      scenario:
        'Ketika penari seluncur es menarik lengannya mendekati tubuh, putarannya mendadak kencang; saat lengan direntangkan, putaran melambat.',
      connection:
        'Planet mematuhi kekekalan momentum sudut yang sama (L = m·r·v): saat mendekati Matahari (r kecil di perihelion), kecepatannya otomatis melonjak.',
    },
    formulaBreakdown: [
      { symbol: 'a', name: 'Sumbu semi-mayor orbit', unit: 'AU', role: 'bebas', explanation: 'Jarak rata-rata planet ke bintang (1 AU = jarak Bumi–Matahari).' },
      { symbol: 'e', name: 'Eksentrisitas elips', unit: '0–0,9', role: 'bebas', explanation: 'Tingkat kelonjongan orbit (e = 0 lingkaran sempurna; makin dekat 1 makin lonjong).' },
      { symbol: 'M*', name: 'Massa bintang induk', unit: 'M☉', role: 'bebas', explanation: 'Makin masif bintang, makin kuat tarikan gravitasi dan makin singkat periode.' },
      { symbol: 'T', name: 'Periode revolusi orbit', unit: 'tahun', role: 'terikat', explanation: 'Waktu satu putaran penuh planet mengelilingi bintangnya.' },
    ],
    workedExample: {
      question:
        'Sebuah eksoplanet mengorbit bintang bermassa 1,0 M☉ pada jarak rata-rata a = 4,0 AU dengan eksentrisitas e = 0,25. Hitung periode orbit T serta jarak perihelion dan aphelionnya!',
      given: ['a = 4,0 AU', 'e = 0,25', 'M* = 1,0 M☉'],
      steps: [
        'Hitung periode dengan Hukum III Kepler: T = √(a³ / M*) = √(4³ / 1) = √64 = 8,0 tahun.',
        'Hitung jarak terdekat (perihelion): r peri = a·(1 − e) = 4,0 × 0,75 = 3,0 AU.',
        'Hitung jarak terjauh (aphelion): r ap = a·(1 + e) = 4,0 × 1,25 = 5,0 AU.',
      ],
      answer: 'T = 8,0 tahun; r peri = 3,0 AU; r ap = 5,0 AU',
      physicalMeaning:
        'Meskipun jaraknya 4 kali Bumi, lama satu tahunnya 8 kali lebih panjang karena orbitnya jauh lebih luas dan laju orbitnya lebih pelan.',
    },
    glossary: [
      { term: 'Satuan Astronomi (AU)', definition: 'Jarak rata-rata Bumi ke Matahari, sekitar 149,6 juta kilometer.' },
      { term: 'Perihelion', definition: 'Titik terdekat planet terhadap Matahari di mana kelajuan orbit mencapai maksimum.' },
      { term: 'Aphelion', definition: 'Titik terjauh planet dari Matahari di mana kelajuan orbit paling lambat.' },
      { term: 'Eksentrisitas (e)', definition: 'Ukuran penyimpangan bentuk elips dari lingkaran sempurna (0 ≤ e < 1).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Johannes Kepler (1609–1619) menganalisis catatan pengamatan mata telanjang super teliti milik Tycho Brahe selama puluhan tahun untuk merumuskan ketiga hukum orbit planet sebelum teleskop populer.',
      derivationLatex: [
        'T^2 = \\frac{4\\pi^2}{G M_*} a^3 \\implies T_{\\text{thn}} = \\sqrt{\\frac{a_{\\text{AU}}^3}{M_*/M_\\odot}}',
        'v = \\sqrt{G M_* \\left(\\frac{2}{r} - \\frac{1}{a}\\right)} \\quad (\\text{Persamaan Vis-Viva})',
      ],
      advancedConcept:
        'Persamaan Vis-Viva memungkinkan insinyur misi antariksa menghitung tepat besar impuls roket (Δv) yang diperlukan untuk berpindah dari satu orbit elips ke orbit lain.',
    },
    extraPreLabQuestions: [
      {
        id: 'kep-q2',
        question: 'Jika massa bintang induk dinaikkan menjadi 4 kali massa Matahari (4 M☉) sementara planet tetap pada jarak a = 1 AU, berapakah periode orbitnya?',
        options: ['0,5 tahun (setengah tahun Bumi)', '2,0 tahun', '4,0 tahun', 'Tetap 1,0 tahun'],
        correctIndex: 0,
        explanation:
          'Dari T = √(a³ / M*) = √(1 / 4) = 0,5 tahun. Gravitasi yang 4× lebih kuat menarik planet berputar 2× lebih cepat.',
      },
    ],
  },

  'milky-way-rotation': {
    keyTakeaways: [
      'Jika galaksi hanya tersusun dari bintang dan gas yang tampak, kecepatan bintang di pinggiran seharusnya turun mengikuti Hukum Kepler (v ∝ 1/√r).',
      'Pengamatan nyata menunjukkan kurva rotasi galaksi mendatar stabil (~220 km/s) hingga radius sangat jauh dari pusat.',
      'Kelebihan kecepatan rotasi ini menjadi bukti observasional kuat keberadaan halo raksasa Materi Gelap (Dark Matter) yang menyumbang ~85% massa galaksi.',
    ],
    everydayAnalogy: {
      title: 'Komidi Putar yang Tidak Terlempar Keluar Saat Berputar Kencang',
      scenario:
        'Jika kursi di pinggir komidi putar berputar sangat kencang tanpa terlepas, pasti ada rantai pengikat tak terlihat yang sangat kuat menahan kursi itu ke pusat.',
      connection:
        'Bintang di pinggiran Bima Sakti melesat ~220 km/s tanpa terlontar ke ruang antargalaksi karena diikat gravitasi "rantai tak terlihat" berupa halo Materi Gelap.',
    },
    formulaBreakdown: [
      { symbol: 'r', name: 'Radius galaktosentris', unit: 'kpc', role: 'bebas', explanation: 'Jarak bintang dari pusat Bima Sakti (Matahari berada di r ≈ 8,2 kpc).' },
      { symbol: 'f DM', name: 'Fraksi halo materi gelap', unit: 'relatif', role: 'bebas', explanation: 'Mengatur besar massa halo tak tampak yang menopang kurva rotasi datar.' },
      { symbol: 'v obs', name: 'Kecepatan rotasi teramati', unit: 'km/s', role: 'terikat', explanation: 'Kecepatan aktual bintang akibat gabungan materi tampak + materi gelap.' },
      { symbol: 'v Kep', name: 'Kecepatan Keplerian tampak', unit: 'km/s', role: 'terikat', explanation: 'Prediksi kecepatan jika hanya materi bercahaya yang diperhitungkan.' },
    ],
    workedExample: {
      question:
        'Pada radius r = 15 kpc dari pusat galaksi, kecepatan Keplerian dari materi tampak hanya 120 km/s, tetapi pengamatan spektroskopi mengukur v obs = 220 km/s. Berapa rasio massa total terhadap massa tampak di dalam radius tersebut?',
      given: ['v Kep = 120 km/s', 'v obs = 220 km/s', 'M(<r) = r·v² / G'],
      steps: [
        'Karena M(<r) sebanding dengan v² pada radius r yang sama: M total / M tampak = (v obs / v Kep)².',
        'Substitusi nilai: (220 / 120)² = (1,833)² ≈ 3,36.',
      ],
      answer: 'Massa total sekitar 3,36× massa tampak (~70% berupa materi gelap di radius 15 kpc)',
      physicalMeaning:
        'Makin jauh ke pinggiran galaksi, dominasi massa materi gelap makin besar hingga melampaui 85% total massa galaksi.',
    },
    glossary: [
      { term: 'Kiloparsek (kpc)', definition: 'Satuan jarak skala galaksi; 1 kpc ≈ 3.262 tahun cahaya.' },
      { term: 'Kurva Rotasi Datar', definition: 'Profil kecepatan orbit bintang yang tetap tinggi dan mendatar jauh dari pusat galaksi.' },
      { term: 'Materi Gelap (Dark Matter)', definition: 'Materi non-barionik yang tidak berinteraksi dengan cahaya namun menghasilkan gravitasi kuat.' },
      { term: 'Halo Galaksi', definition: 'Selubung sferis raksasa berisi materi gelap dan gugus bola yang membungkus piringan galaksi.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Fritz Zwicky (1933) pertama kali mengusulkan "materi hilang" di gugus galaksi Coma, lalu Vera Rubin dan Kent Ford (1970-an) memberikan bukti kurva rotasi datar yang tak terbantahkan pada galaksi Andromeda dan puluhan galaksi spiral lainnya.',
      derivationLatex: [
        'v(r) = \\sqrt{\\frac{G M(<r)}{r}}',
        'M_{\\text{total}}(<r) = M_{\\text{barion}}(<r) + M_{\\text{halo}}(<r)',
      ],
      advancedConcept:
        'Agar kurva rotasi mendatar sempurna (v ≈ konstan), massa terkurung M(<r) harus tumbuh linear terhadap r, artinya kerapatan halo materi gelap meluruh seperti ρ(r) ∝ 1/r² (profil isotermal/NFW).',
    },
    extraPreLabQuestions: [
      {
        id: 'mw-q2',
        question: 'Apa konsekuensi jika halo materi gelap di Bima Sakti tiba-tiba dihilangkan (fraksi = 0) sementara bintang tetap berputar pada r = 20 kpc?',
        options: [
          'Kecepatan orbit stabil bintang menurun drastis mengikuti kurva Keplerian 1/√r',
          'Kecepatan rotasi bintang meningkat dua kali lipat',
          'Kurva rotasi tetap mendatar pada 220 km/s',
          'Pusat galaksi berhenti memancarkan cahaya',
        ],
        correctIndex: 0,
        explanation:
          'Tanpa massa tambahan dari halo materi gelap, gravitasi luar hanya berasal dari materi tampak pusat sehingga v(r) meluruh turun sebanding dengan 1/√r.',
      },
    ],
  },

  'exoplanet-transit': {
    keyTakeaways: [
      'Metode transit mendeteksi eksoplanet dengan mengukur penurunan kecil kecerlangan bintang saat planet melintas tepat di depan piringan bintang.',
      'Kedalaman transit sebanding dengan rasio luas penampang planet terhadap bintang: ΔF/F = (Rₚ / R*)².',
      'Bentuk dasar lembah kurva cahaya (datar vs berbentuk V) serta durasi transit mengungkap ukuran planet dan kemiringan orbitnya.',
    ],
    everydayAnalogy: {
      title: 'Kumbang Kecil Melintas di Depan Lampu Sorot Stadion',
      scenario:
        'Walau kumbang terlalu kecil untuk dilihat langsung dari kejauhan di depan lampu sorot yang menyilaukan, alat pengukur cahaya presisi dapat mendeteksi sedikit redup sesaat kumbang melintas.',
      connection:
        'Lampu sorot adalah bintang induk, kumbang adalah eksoplanet, dan persentase redupnya cahaya langsung membocorkan jari-jari kumbang relatif terhadap lampu.',
    },
    formulaBreakdown: [
      { symbol: 'Rₚ', name: 'Radius eksoplanet', unit: 'R⊕ (Bumi)', role: 'bebas', explanation: 'Makin besar planet, makin luas cahaya bintang yang terhalang.' },
      { symbol: 'R*', name: 'Radius bintang induk', unit: 'R☉ (Matahari)', role: 'bebas', explanation: 'Bintang kecil (kerdil merah) menghasilkan persentase kedalaman transit lebih besar.' },
      { symbol: 'ΔF/F', name: 'Kedalaman transit', unit: '% / ppm', role: 'terikat', explanation: 'Fraksi penurunan fluks cahaya = (Rₚ / R*)².' },
      { symbol: 'T dur', name: 'Durasi transit', unit: 'jam', role: 'terikat', explanation: 'Lama planet menyeberangi diameter piringan bintang.' },
    ],
    workedExample: {
      question:
        'Planet seukuran Neptunus (Rₚ = 4,0 R⊕) melintas di depan bintang seukuran Matahari (R* = 1,0 R☉ ≈ 109 R⊕). Hitung kedalaman transit dalam persen dan ppm!',
      given: ['Rₚ = 4,0 R⊕', 'R* = 109 R⊕'],
      steps: [
        'Hitung rasio radius: Rₚ / R* = 4,0 / 109 ≈ 0,0367.',
        'Kuadratkan rasio: ΔF/F = (0,0367)² ≈ 0,00135.',
        'Konversi ke persen dan ppm: 0,135% atau sekitar 1.350 ppm.',
      ],
      answer: 'ΔF/F ≈ 0,135% (1.350 ppm)',
      physicalMeaning:
        'Penurunan 0,135% terlalu halus bagi mata manusia, namun mudah terukur jelas oleh fotometer luar angkasa seperti Kepler dan TESS.',
    },
    glossary: [
      { term: 'Kurva Cahaya (Light Curve)', definition: 'Grafik kecerlangan (fluks) bintang terhadap waktu untuk mendeteksi peristiwa transit.' },
      { term: 'ppm (Parts Per Million)', definition: 'Satuan perubahan sangat kecil; 1% = 10.000 ppm (transit Bumi di Matahari hanya ~84 ppm).' },
      { term: 'Penggelapan Tepi (Limb Darkening)', definition: 'Efek optik pinggiran piringan bintang tampak sedikit lebih redup daripada pusatnya.' },
      { term: 'Zona Layak Huni', definition: 'Rentang jarak orbit bintang di mana air cair dapat bertahan di permukaan planet.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Transit eksoplanet pertama diamati pada HD 209458 b (1999); sejak peluncuran teleskop NASA Kepler (2009) dan TESS (2018), lebih dari 4.000 eksoplanet berhasil ditemukan dengan metode ini.',
      derivationLatex: [
        '\\frac{\\Delta F}{F} = \\left(\\frac{R_p}{R_*}\\right)^2',
        'T_{\\text{dur}} \\approx \\frac{P}{\\pi} \\frac{R_*}{a}',
      ],
      advancedConcept:
        'Dengan mengukur kedalaman transit pada berbagai panjang gelombang warna (spektroskopi transmisi), teleskop JWST membaca sidik jari molekul atmosfer eksoplanet seperti H₂O, CO₂, dan CH₄.',
    },
    extraPreLabQuestions: [
      {
        id: 'exo-q2',
        question: 'Mengapa eksoplanet seukuran Bumi lebih mudah dideteksi metode transit jika mengorbit bintang kerdil merah (radius 0,2 R☉) dibandingkan bintang seukuran Matahari (1,0 R☉)?',
        options: [
          'Kedalaman transit (Rₚ/R*)² menjadi 25 kali lebih besar sehingga sinyal jauh lebih jelas',
          'Planet di dekat bintang kecil memancarkan cahayanya sendiri',
          'Bintang kerdil merah tidak memiliki efek penggelapan tepi',
          'Durasi transit menjadi 25 kali lebih lama',
        ],
        correctIndex: 0,
        explanation:
          'Karena ΔF/F = (Rₚ/R*)², memperkecil radius bintang menjadi 1/5 (0,2) membuat kedalaman transit melonjak sebesar 5² = 25 kali lipat.',
      },
    ],
  },

  'stellar-wien-spectrum': {
    keyTakeaways: [
      'Hukum Pergeseran Wien λ maks · T = 2,898 × 10⁶ nm·K menyatakan bintang yang lebih panas memuncak pada panjang gelombang lebih pendek (lebih biru).',
      'Hukum Stefan-Boltzmann L = 4π·R²·σ·T⁴ menunjukkan daya pancar bintang melonjak ekstrem dengan pangkat empat suhu fotosfernya.',
      'Spektrum warna dan garis serapan mengelompokkan bintang ke kelas O-B-A-F-G-K-M dari terpanas (biru) hingga terdingin (merah).',
    ],
    everydayAnalogy: {
      title: 'Besi Panas di Pandai Besi dan Nyala Api Kompor',
      scenario:
        'Besi yang baru dipanaskan berpijar merah redup, lalu jingga, kuning, hingga putih kebiruan saat sangat panas — sama halnya api biru kompor gas jauh lebih panas dari api kuning lilin.',
      connection:
        'Perubahan warna pijar tersebut adalah wujud langsung Hukum Wien yang juga dipakai astronom mengukur suhu bintang sejauh ratusan tahun cahaya tanpa pernah menyentuhnya.',
    },
    formulaBreakdown: [
      { symbol: 'T', name: 'Suhu efektif fotosfer', unit: 'K', role: 'bebas', explanation: 'Menentukan warna dominan dan intensitas radiasi permukaan bintang.' },
      { symbol: 'R*', name: 'Radius bintang', unit: 'R☉', role: 'bebas', explanation: 'Memperbesar luas permukaan pemancar sehingga luminositas naik ∝ R².' },
      { symbol: 'λ maks', name: 'Panjang gelombang puncak', unit: 'nm', role: 'terikat', explanation: 'Panjang gelombang dengan intensitas pancaran benda hitam tertinggi.' },
      { symbol: 'L', name: 'Luminositas total bintang', unit: 'L☉', role: 'terikat', explanation: 'Total energi cahaya yang dipancarkan bintang per detik ke segala arah.' },
    ],
    workedExample: {
      question:
        'Matahari memiliki suhu fotosfer T = 5800 K (L = 1 L☉). Sebuah bintang kelas A memiliki radius sama (1 R☉) tetapi suhunya dua kali lipat (T = 11.600 K). Hitung λ maks dan luminositas bintang tersebut!',
      given: ['T = 11.600 K (2× Matahari)', 'R = 1 R☉', 'b = 2,898 × 10⁶ nm·K'],
      steps: [
        'Hitung puncak spektrum Wien: λ maks = 2,898 × 10⁶ / 11.600 ≈ 250 nm (wilayah ultraviolet).',
        'Hitung rasio luminositas Stefan-Boltzmann: L / L☉ = (R/R☉)² · (T/T☉)⁴ = 1² × 2⁴ = 16.',
      ],
      answer: 'λ maks ≈ 250 nm (biru-UV) dan Luminositas = 16 L☉',
      physicalMeaning:
        'Menggandakan suhu fotosfer saja langsung memancarkan 16 kali lipat energi per detik dan menggeser warna bintang dari putih-kuning menjadi biru cerah.',
    },
    glossary: [
      { term: 'Radiasi Benda Hitam', definition: 'Spektrum cahaya termal kontinu ideal yang hanya bergantung pada suhu pemancarnya.' },
      { term: 'Luminositas (L)', definition: 'Daya pancar energi intrinsik bintang per satuan waktu (Watt atau L☉).' },
      { term: 'Fotosfer', definition: 'Lapisan atmosfer bintang tempat cahaya mulai lepas bebas menuju ruang angkasa.' },
      { term: 'Kelas Spektral (OBAFGKM)', definition: 'Klasifikasi standar bintang dari biru super panas (O) hingga merah dingin (M).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Wilhelm Wien (1893) menurunkan hukum pergeseran puncak termal, dan Max Planck (1900) memecahkan "bencana ultraviolet" kurva benda hitam dengan memperkenalkan kuanta energi — melahirkan fisika kuantum.',
      derivationLatex: [
        '\\lambda_{\\max} \\cdot T = b = 2.898 \\times 10^{-3}\\text{ m}\\cdot\\text{K}',
        'L = 4\\pi R^2 \\sigma T^4',
      ],
      advancedConcept:
        'Indeks warna B−V membandingkan kecerlangan bintang lewat filter Biru (440 nm) dan Visual kuning-hijau (550 nm): nilai negatif menandakan bintang biru panas, nilai positif menandakan bintang merah dingin.',
    },
    extraPreLabQuestions: [
      {
        id: 'wien-q2',
        question: 'Jika dua bintang memiliki jari-jari yang persis sama, tetapi bintang X bersuhu 2 kali suhu bintang Y, berapa kali lebih besar luminositas bintang X dibanding Y?',
        options: ['16 kali lebih besar', '2 kali lebih besar', '4 kali lebih besar', '8 kali lebih besar'],
        correctIndex: 0,
        explanation:
          'Berdasarkan Hukum Stefan-Boltzmann L ∝ R²·T⁴, suhu 2 kali lipat menghasilkan 2⁴ = 16 kali lipat luminositas.',
      },
    ],
  },

  'hubble-expansion': {
    keyTakeaways: [
      'Hukum Hubble-Lemaître menyatakan kecepatan menjauh galaksi sebanding dengan jaraknya: v = H₀·d.',
      'Pergeseran merah kosmologis z = (λ obs − λ₀) / λ₀ terjadi karena peregangan ruang waktu ikut meregangkan panjang gelombang cahaya dalam perjalanannya.',
      'Invers Konstanta Hubble (t ≈ 1/H₀) memberikan estimasi orde usia alam semesta sekitar 13,8 miliar tahun.',
    ],
    everydayAnalogy: {
      title: 'Kismis di Dalam Adonan Roti yang Mengembang di Oven',
      scenario:
        'Saat adonan roti mengembang merata, setiap kismis melihat semua kismis lain menjauh; kismis yang awalnya dua kali lebih jauh bergeser menjauh dua kali lebih cepat.',
      connection:
        'Kismis adalah galaksi dan adonan adalah ruang waktu semesta: tidak ada satu kismis pun yang menjadi pusat tunggal, semua pengamat merasakan hukum ekspansi yang identik.',
    },
    formulaBreakdown: [
      { symbol: 'd', name: 'Jarak galaksi', unit: 'Mpc', role: 'bebas', explanation: '1 Megaparsek ≈ 3,26 juta tahun cahaya.' },
      { symbol: 'H₀', name: 'Konstanta Hubble', unit: 'km/(s·Mpc)', role: 'bebas', explanation: 'Laju ekspansi alam semesta saat ini (~70 km/s/Mpc).' },
      { symbol: 'v', name: 'Kecepatan resesi galaksi', unit: 'km/s', role: 'terikat', explanation: 'Laju menjauh galaksi akibat peregangan metrik ruang.' },
      { symbol: 'z', name: 'Pergeseran merah (redshift)', unit: 'tanpa satuan', role: 'terikat', explanation: 'Fraksi pemanjangan panjang gelombang cahaya: z = Δλ / λ₀ ≈ v / c.' },
    ],
    workedExample: {
      question:
        'Sebuah galaksi berada pada jarak d = 200 Mpc dengan H₀ = 70 km/(s·Mpc). Hitung kecepatan resesinya, nilai redshift z, dan panjang gelombang garis Ca-K (λ₀ = 393,4 nm) yang teramati di Bumi (c = 300.000 km/s)!',
      given: ['d = 200 Mpc', 'H₀ = 70 km/(s·Mpc)', 'λ₀ = 393,4 nm', 'c = 300.000 km/s'],
      steps: [
        'Hitung kecepatan resesi: v = H₀·d = 70 × 200 = 14.000 km/s.',
        'Hitung redshift: z ≈ v / c = 14.000 / 300.000 ≈ 0,0467.',
        'Hitung panjang gelombang teramati: λ obs = λ₀·(1 + z) = 393,4 × 1,0467 ≈ 411,8 nm.',
      ],
      answer: 'v = 14.000 km/s; z ≈ 0,0467; λ obs ≈ 411,8 nm',
      physicalMeaning:
        'Garis spektrum bergeser +18,4 nm ke arah merah; semakin jauh galaksi, semakin jauh pula pergeseran garis spektrumnya.',
    },
    glossary: [
      { term: 'Megaparsek (Mpc)', definition: 'Satuan jarak kosmologi setara 3,26 juta tahun cahaya.' },
      { term: 'Pergeseran Merah (Redshift)', definition: 'Pemanjangan panjang gelombang cahaya dari galaksi jauh akibat ekspansi alam semesta.' },
      { term: 'Konstanta Hubble (H₀)', definition: 'Gradien hubungan kecepatan resesi terhadap jarak galaksi (~67–73 km/s/Mpc).' },
      { term: 'Waktu Hubble (1/H₀)', definition: 'Taksiran skala usia alam semesta jika ekspansi berlangsung dengan laju konstan.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Georges Lemaître (1927) memprediksi ekspansi alam semesta dari Relativitas Umum Einstein, lalu Edwin Hubble (1929) mengonfirmasinya secara observasional di Observatorium Mount Wilson menggunakan bintang variabel Cepheid.',
      derivationLatex: [
        'v = H_0 \\cdot d',
        'z = \\frac{\\lambda_{\\text{obs}} - \\lambda_0}{\\lambda_0} \\approx \\frac{v}{c} \\quad (z \\ll 1)',
        't_H = \\frac{1}{H_0} \\approx 13.8\\text{ miliar tahun}',
      ],
      advancedConcept:
        'Pengamatan supernova Tipe Ia (Nobel Fisika 2011) mengungkap bahwa ekspansi alam semesta saat ini justru mengalami percepatan akibat Energi Gelap (~68% isi energi semesta).',
    },
    extraPreLabQuestions: [
      {
        id: 'hub-q2',
        question: 'Jika galaksi B berjarak 3 kali lebih jauh dari galaksi A, bagaimana perbandingan pergeseran merah (redshift z) galaksi B terhadap A pada jarak kosmologi dekat?',
        options: [
          'Redshift galaksi B sekitar 3 kali lebih besar daripada galaksi A',
          'Redshift keduanya sama karena kecepatan cahaya konstan',
          'Redshift galaksi B sepertiga dari galaksi A',
          'Galaksi B mengalami pergeseran biru',
        ],
        correctIndex: 0,
        explanation:
          'Karena v = H₀·d dan z ≈ v/c, jarak 3 kali lebih jauh menghasilkan kecepatan resesi dan nilai redshift 3 kali lebih besar.',
      },
    ],
  },
};
