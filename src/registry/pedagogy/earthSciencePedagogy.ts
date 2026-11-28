import type { ModulePedagogyBundle } from './index';

export const EARTH_SCIENCE_PEDAGOGY: Record<string, ModulePedagogyBundle> = {
  'earth-seismic-waves': {
    keyTakeaways: [
      'Gelombang Primer (P) merambat lebih cepat daripada Gelombang Sekunder (S) karena bersifat longitudinal kompresional.',
      'Selisih waktu tiba Δt berbanding lurus dengan jarak hiposentrum gempa terhadap stasiun seismograf.',
      'Minimal diperlukan data dari 3 stasiun seismograf untuk menentukan titik episentrum secara triangulasi.',
    ],
    everydayAnalogy: {
      title: 'Kilat dan Guntur saat Hujan Badai',
      scenario:
        'Ketika petir menyambar di kejauhan, kita selalu melihat kilatan cahaya lebih dulu baru kemudian mendengar suara guntur beberapa detik kemudian.',
      connection:
        'Seperti cahaya dan suara petir, gelombang P dan S berangkat dari pusat gempa pada saat yang sama tetapi bergerak dengan kecepatan berbeda sehingga makin jauh pusatnya, makin lebar jeda waktu tibanya.',
    },
    formulaBreakdown: [
      {
        symbol: 'd',
        name: 'Jarak Hiposentrum',
        unit: 'km',
        role: 'bebas',
        explanation: 'Jarak tiga dimensi dari fokus gempa di bawah tanah menuju stasiun seismograf.',
      },
      {
        symbol: 'vₚ, vₛ',
        name: 'Kecepatan Gelombang P & S',
        unit: 'km/s',
        role: 'konstanta',
        explanation: 'Kecepatan rambat gelombang primer dan sekunder melalui lapisan kerak bumi.',
      },
      {
        symbol: 'Δt',
        name: 'Selisih Waktu Kedatangan',
        unit: 's',
        role: 'terikat',
        explanation: 'Jeda waktu antara terekamnya gelombang P dan gelombang S pada seismogram.',
      },
    ],
    workedExample: {
      question:
        'Sebuah stasiun seismik mencatat gelombang P tiba 20 detik sebelum gelombang S. Jika vₚ = 6.0 km/s dan vₛ = 3.0 km/s, berapa jarak hiposentrum gempa?',
      given: ['Δt = 20 s', 'vₚ = 6.0 km/s', 'vₛ = 3.0 km/s'],
      steps: [
        'Gunakan persamaan selisih waktu: Δt = d · (1/vₛ − 1/vₚ).',
        'Hitung faktor lambat: (1/3.0 − 1/6.0) = 1/6 s/km.',
        'Substitusi nilai: d = 20 / (1/6) = 120 km.',
      ],
      answer: 'd = 120 km',
      physicalMeaning: 'Pusat gempa berjarak 120 km dari stasiun pengamatan seismik.',
    },
    glossary: [
      { term: 'Episentrum', definition: 'Titik proyeksi pusat gempa tepat di permukaan Bumi di atas hiposentrum.' },
      { term: 'Hiposentrum', definition: 'Titik lokasi pelepasan energi patahan gempa di dalam kerak atau mantel Bumi.' },
      { term: 'Seismogram', definition: 'Grafik rekaman getaran tanah terhadap waktu yang dihasilkan oleh alat seismograf.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Metode penentuan jarak gempa dari jeda S-P dipelopori oleh seismolog Fusakichi Omori pada awal abad ke-20 dan masih menjadi dasar sistem peringatan dini gempa.',
      advancedConcept:
        'Gelombang S bersifat gelombang geser (transversal) sehingga tidak dapat merambat menembus inti luar Bumi yang berwujud cair, menciptakan zona bayangan gelombang S.',
    },
    extraPreLabQuestions: [
      {
        id: 'q-seis-2',
        question: 'Jika jarak stasiun ke episentrum makin jauh, bagaimanakah perubahan selisih waktu tiba S dan P?',
        options: [
          'Selisih waktu semakin besar secara proporsional',
          'Selisih waktu semakin kecil menuju nol',
          'Selisih waktu selalu tetap 5 detik',
          'Gelombang S menyusul mendahului gelombang P',
        ],
        correctIndex: 0,
        explanation: 'Karena kecepatan P selalu lebih besar daripada S, jarak tempuh yang lebih panjang memperlebar selisih waktu kedatangan keduanya.',
      },
    ],
  },

  'earth-greenhouse-radiation': {
    keyTakeaways: [
      'Tanpa efek rumah kaca alami, suhu rata-rata permukaan Bumi hanya sekitar minus 18 derajat Celsius dan lautan akan membeku.',
      'Albedo tinggi seperti es kutub memantulkan lebih banyak sinar matahari sehingga menurunkan suhu kesetimbangan planet.',
      'Peningkatan konsentrasi gas CO₂ menaikkan emisivitas atmosfer sehingga menahan lebih banyak radiasi inframerah.',
    ],
    everydayAnalogy: {
      title: 'Kabin Mobil yang Diparkir di Bawah Matahari',
      scenario:
        'Cahaya tampak matahari mudah menembus kaca mobil dan memanaskan jok, tetapi panas inframerah dari jok terperangkap di dalam kabin sehingga suhu kabin jauh lebih hangat daripada udara luar.',
      connection:
        'Gas rumah kaca di atmosfer bekerja seperti kaca kabin tersebut: transparan terhadap cahaya tampak matahari, namun menyerap radiasi termal inframerah dari permukaan Bumi.',
    },
    formulaBreakdown: [
      {
        symbol: 'S₀',
        name: 'Konstanta Surya',
        unit: 'W/m²',
        role: 'konstanta',
        explanation: 'Fluks radiasi matahari yang tiba di puncak atmosfer tegak lurus sinar datang.',
      },
      {
        symbol: 'α',
        name: 'Albedo Permukaan',
        unit: 'fraksi',
        role: 'bebas',
        explanation: 'Proporsi radiasi matahari yang langsung dipantulkan kembali ke luar angkasa.',
      },
      {
        symbol: 'T',
        name: 'Suhu Permukaan Bumi',
        unit: '°C',
        role: 'terikat',
        explanation: 'Suhu kesetimbangan termal atmosfer satu lapis di permukaan planet.',
      },
    ],
    workedExample: {
      question:
        'Jika konsentrasi CO₂ meningkat dari 280 ppm menjadi 560 ppm, berapakah besar radiative forcing logaritmik ΔF?',
      given: ['C₀ = 280 ppm', 'C = 560 ppm', 'Koefisien = 5.35 W/m²'],
      steps: [
        'Hitung rasio konsentrasi: C / C₀ = 560 / 280 = 2.',
        'Hitung logaritma natural: ln(2) ≈ 0.693.',
        'Kalikan dengan faktor radiatif: ΔF = 5.35 × 0.693 ≈ 3.71 W/m².',
      ],
      answer: 'ΔF ≈ 3.71 W/m²',
      physicalMeaning: 'Penggandaan kadar CO₂ menambah energi perangkap panas netto sebesar sekitar 3.7 W pada tiap meter persegi permukaan Bumi.',
    },
    glossary: [
      { term: 'Albedo', definition: 'Daya pantul permukaan planet terhadap radiasi gelombang pendek matahari.' },
      { term: 'Radiative Forcing', definition: 'Perubahan neraca energi radiasi masuk dan keluar atmosfer di lapisan tropopause.' },
      { term: 'Hukum Stefan-Boltzmann', definition: 'Daya radiasi termal benda hitam berbanding lurus dengan pangkat empat suhu mutlaknya.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Pada 1896, kimiawan Swedia Svante Arrhenius menjadi ilmuwan pertama yang menghitung secara kuantitatif kenaikan suhu global akibat penggandaan kadar karbon dioksida atmosfer.',
      advancedConcept:
        'Peningkatan suhu memicu umpan balik positif: mencairnya es menurunkan albedo Bumi dan meningkatkan uap air atmosfer.',
    },
    extraPreLabQuestions: [
      {
        id: 'q-gh-2',
        question: 'Apa akibat langsung dari bertambahnya konsentrasi gas CO₂ di atmosfer terhadap energi inframerah keluar?',
        options: [
          'Sebagian besar diserap atmosfer lalu dipancarkan balik ke permukaan sehingga suhu naik',
          'Semua energi matahari langsung diblokir total sebelum menyentuh tanah',
          'Albedo awan dan lautan langsung menjadi nol',
          'Konstanta surya matahari meningkat dua kali lipat',
        ],
        correctIndex: 0,
        explanation: 'Gas CO₂ menyerap panjang gelombang inframerah termal dari Bumi dan memancarkannya kembali ke segala arah, termasuk ke permukaan.',
      },
    ],
  },

  'earth-hydrology-darcy': {
    keyTakeaways: [
      'Debit rembesan air tanah Q berbanding lurus dengan konduktivitas hidrolik batuan K, luas penampang A, dan gradien hidrolik.',
      'Tanah berpasir kasar memiliki konduktivitas K jauh lebih besar dibanding lempung rapat.',
      'Gradien hidrolik yang terlalu tinggi pada tanggul atau lereng tanah meningkatkan risiko erosi bawah permukaan.',
    ],
    everydayAnalogy: {
      title: 'Menyaring Kopi dengan Bubuk Halus vs Kasar',
      scenario:
        'Air panas menetes sangat cepat melewati ampas kopi gilingan kasar, tetapi mengalir amat lambat jika bubuk kopi terlalu halus dan dipadatkan.',
      connection:
        'Ukuran pori-pori media penyaring kopi analog dengan konduktivitas hidrolik akuifer dalam Hukum Darcy.',
    },
    formulaBreakdown: [
      {
        symbol: 'K',
        name: 'Konduktivitas Hidrolik',
        unit: 'm/hari',
        role: 'konstanta',
        explanation: 'Ukuran kemudahan tanah atau batuan meloloskan aliran fluida air.',
      },
      {
        symbol: 'Δh',
        name: 'Beda Tinggi Hidrolik',
        unit: 'm',
        role: 'bebas',
        explanation: 'Selisih tinggi muka tekanan air antara titik hulu dan hilir akuifer.',
      },
      {
        symbol: 'Q',
        name: 'Debit Aliran Air Tanah',
        unit: 'm³/hari',
        role: 'terikat',
        explanation: 'Volume air yang mengalir melintasi penampang akuifer tiap satuan waktu.',
      },
    ],
    workedExample: {
      question:
        'Akuifer berpasir memiliki K = 10 m/hari, penampang A = 20 m², panjang L = 100 m, dan beda tinggi Δh = 5 m. Hitung debit aliran Q.',
      given: ['K = 10 m/hari', 'A = 20 m²', 'L = 100 m', 'Δh = 5 m'],
      steps: [
        'Hitung gradien hidrolik: i = Δh / L = 5 / 100 = 0.05.',
        'Hitung kecepatan Darcy: q = K · i = 10 × 0.05 = 0.5 m/hari.',
        'Hitung debit total: Q = q · A = 0.5 × 20 = 10 m³/hari.',
      ],
      answer: 'Q = 10 m³/hari',
      physicalMeaning: 'Sebanyak 10 meter kubik air tanah meresap melalui penampang akuifer tersebut setiap hari.',
    },
    glossary: [
      { term: 'Akuifer', definition: 'Lapisan batuan atau sedimen berpori di bawah tanah yang menyimpan dan mengalirkan air tanah.' },
      { term: 'Gradien Hidrolik', definition: 'Perbandingan selisih tinggi tekan piezometrik terhadap panjang lintasan aliran.' },
      { term: 'Permeabilitas', definition: 'Kemampuan material berpori untuk melewatkan fluida melalui ruang antarbutirnya.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Insinyur hidrolik Prancis Henry Darcy merumuskan persamaan aliran media berpori pada tahun 1856 saat merancang sistem penyaringan air bersih kota Dijon.',
      advancedConcept:
        'Hukum Darcy berlaku pada aliran laminer berbilangan Reynolds rendah; pada retakan batu besar atau gua karst, aliran berubah menjadi turbulen non-Darcy.',
    },
    extraPreLabQuestions: [
      {
        id: 'q-darcy-2',
        question: 'Lapisan akuifer manakah yang memiliki konduktivitas hidrolik K paling tinggi?',
        options: [
          'Kerikil dan pasir kasar berpori besar',
          'Lempung padat kedap air',
          'Batuan granit masif tanpa retakan',
          'Tanah liat berlumpur sangat halus',
        ],
        correctIndex: 0,
        explanation: 'Pori-pori besar yang saling terhubung pada kerikil dan pasir kasar meminimalkan hambatan gesek fluida.',
      },
    ],
  },

  'earth-radioactive-decay': {
    keyTakeaways: [
      'Peluruhan radioaktif bersifat stokastik pada tingkat inti tunggal namun sangat akurat secara eksponensial pada sampel makroskopis.',
      'Setiap satu waktu paruh T½, jumlah inti induk berkurang menjadi tepat setengah dari nilai sebelumnya.',
      'Isotop Karbon-14 berwaktu paruh 5730 tahun ideal untuk menentukan umur fosil organik hingga sekitar 50 ribu tahun.',
    ],
    everydayAnalogy: {
      title: 'Popcorn yang Meletus di Wajan Tertutup',
      scenario:
        'Kita tidak pernah bisa menebak biji jagung mana yang akan meletus berikutnya, tetapi secara statistik separuh jagung mentah habis dalam selang waktu tertentu.',
      connection:
        'Setiap inti radioaktif memiliki peluang meluruh konstan per detik sehingga populasi totalnya menyusut secara teratur mengikuti kurva waktu paruh.',
    },
    formulaBreakdown: [
      {
        symbol: 'N₀',
        name: 'Jumlah Inti Awal',
        unit: 'inti',
        role: 'konstanta',
        explanation: 'Banyaknya atom radioaktif pada saat t = 0 ketika sampel masih hidup atau terbentuk.',
      },
      {
        symbol: 'T½',
        name: 'Waktu Paruh',
        unit: 'kyr',
        role: 'konstanta',
        explanation: 'Selang waktu yang diperlukan agar tepat 50% inti induk meluruh.',
      },
      {
        symbol: 'N(t)',
        name: 'Inti Tersisa',
        unit: 'inti',
        role: 'terikat',
        explanation: 'Jumlah atom induk radioaktif yang masih tersisa setelah waktu t berlalu.',
      },
    ],
    workedExample: {
      question:
        'Jika jumlah inti awal N₀ = 10000 dan waktu paruh isotop T½ = 5.0 kyr, berapa inti yang tersisa setelah t = 15.0 kyr?',
      given: ['N₀ = 10000 inti', 'T½ = 5.0 kyr', 't = 15.0 kyr'],
      steps: [
        'Hitung jumlah siklus waktu paruh: n = t / T½ = 15.0 / 5.0 = 3.',
        'Hitung fraksi tersisa: (1/2)³ = 1/8 = 0.125 (12.5%).',
        'Kalikan dengan inti awal: N = 10000 × 0.125 = 1250 inti.',
      ],
      answer: '1250 inti (12.5%)',
      physicalMeaning: 'Setelah tiga kali waktu paruh, tinggal seperdelapan populasi isotop induk awal yang masih radioaktif.',
    },
    glossary: [
      { term: 'Waktu Paruh', definition: 'Waktu rata-rata yang dibutuhkan separuh populasi inti radioaktif untuk meluruh.' },
      { term: 'Aktivitas Becquerel', definition: 'Banyaknya peristiwa peluruhan inti atom per satu detik (1 Bq = 1 peluruhan/s).' },
      { term: 'Konstanta Peluruhan', definition: 'Peluang peluruhan per satuan waktu yang bernilai tetap bagi suatu jenis isotop.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Willard Libby meraih Hadiah Nobel Kimia 1960 berkat penemuan metode penanggalan radiokarbon yang merevolusi arkeologi dan geokronologi Kuarter.',
      advancedConcept:
        'Untuk batuan berusia ratusan juta hingga miliaran tahun, geolog memakai pasangan Uranium-Timbal (U-238/Pb-206) karena waktu paruhnya jauh lebih panjang daripada Karbon-14.',
    },
    extraPreLabQuestions: [
      {
        id: 'q-rad-2',
        question: 'Apakah aktivitas radiasi A(t) meningkat atau menurun seiring bertambahnya waktu peluruhan?',
        options: [
          'Menurun secara eksponensial sebanding dengan jumlah inti induk tersisa',
          'Meningkat linier sepanjang waktu',
          'Selalu konstan sampai waktu paruh ketiga lalu berhenti mendadak',
          'Tidak bergantung pada jumlah inti induk',
        ],
        correctIndex: 0,
        explanation: 'Karena aktivitas A(t) = λ · N(t), penyusutan jumlah inti N(t) langsung menurunkan laju cacahan radiasi secara eksponensial.',
      },
    ],
  },
};
