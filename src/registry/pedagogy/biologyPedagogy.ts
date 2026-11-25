import type { ModulePedagogyBundle } from './index';

export const BIOLOGY_PEDAGOGY: Record<string, ModulePedagogyBundle> = {
  'photosynthesis-ingenhousz': {
    keyTakeaways: [
      'Percobaan Ingenhousz membuktikan bahwa fotosintesis memerlukan cahaya dan menghasilkan gas oksigen (O₂) sebagai gelembung dari Hydrilla.',
      'Klorofil a dan b menyerap kuat spektrum biru (~435 nm) dan merah (~660 nm), tetapi memantulkan cahaya hijau (~530 nm).',
      'Laju fotosintesis meningkat seiring intensitas cahaya dan suplai CO₂ (dari NaHCO₃) hingga mencapai titik jenuh (faktor pembatas Blackman).',
    ],
    everydayAnalogy: {
      title: 'Panel Surya Hijau Penghasil Oksigen di Bawah Air',
      scenario:
        'Daun Hydrilla di dalam air bekerja seperti pabrik bertenaga surya: makin terang lampu merah/biru dan makin banyak bahan baku karbon (baking soda), makin cepat gelembung oksigen keluar.',
      connection:
        'Energi foton memecah molekul air (fotolisis) menjadi O₂, sementara NaHCO₃ memasok ion bikarbonat/CO₂ untuk siklus Calvin penyusun glukosa.',
    },
    formulaBreakdown: [
      { symbol: 'I', name: 'Intensitas cahaya', unit: 'lux', role: 'bebas', explanation: 'Menentukan laju fotolisis air pada reaksi terang hingga titik jenuh.' },
      { symbol: 'λ', name: 'Panjang gelombang cahaya', unit: 'nm', role: 'bebas', explanation: 'Puncak serapan klorofil ada di biru (~435 nm) dan merah (~660 nm).' },
      { symbol: '[NaHCO₃]', name: 'Kadar natrium bikarbonat', unit: 'g/L', role: 'bebas', explanation: 'Sumber karbon dioksida (CO₂) terlarut bagi tanaman air.' },
      { symbol: 'R', name: 'Laju gelembung O₂', unit: 'gelembung/mnt', role: 'terikat', explanation: 'Indikator langsung kecepatan fotosintesis neto.' },
    ],
    workedExample: {
      question:
        'Pada intensitas 1600 lux dengan cahaya merah (efisiensi klorofil ~95%), Hydrilla menghasilkan 38 gelembung O₂ per menit. Ketika filter diganti hijau (530 nm, efisiensi ~18%), berapa perkiraan laju gelembungnya?',
      given: ['R merah = 38 gelembung/menit', 'Efisiensi merah = 95%', 'Efisiensi hijau = 18%'],
      steps: [
        'Bandingkan rasio efisiensi serapan spektrum: 18% / 95% ≈ 0,189.',
        'Kalikan dengan laju awal: R hijau ≈ 38 × 0,189 ≈ 7,2 gelembung/menit.',
      ],
      answer: 'Laju anjlok dari 38 menjadi sekitar 7 gelembung O₂/menit',
      physicalMeaning:
        'Daun tampak hijau di mata kita justru karena sebagian besar foton hijau dipantulkan dan tidak dimanfaatkan klorofil.',
    },
    glossary: [
      { term: 'Fotolisis Air', definition: 'Pemecahan molekul H₂O oleh energi cahaya menjadi O₂, proton H⁺, dan elektron.' },
      { term: 'Spektrum Aksi', definition: 'Kurva efektivitas tiap panjang gelombang cahaya dalam mendorong laju fotosintesis.' },
      { term: 'Faktor Pembatas', definition: 'Faktor lingkungan yang ketersediaannya paling minim sehingga membatasi laju total reaksi.' },
      { term: 'Kloroplas', definition: 'Organel sel tumbuhan berisi pigmen klorofil tempat berlangsungnya fotosintesis.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Jan Ingenhousz (1779) melakukan lebih dari 500 percobaan di Inggris dan membuktikan bahwa hanya bagian tumbuhan berwarna hijau yang terkena cahaya matahari yang mampu "memurnikan udara" (menghasilkan O₂).',
      derivationLatex: [
        '6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{cahaya}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2',
        'R = R_{\\max} \\cdot \\frac{I}{I + K_I} \\cdot \\frac{[\\text{CO}_2]}{[\\text{CO}_2] + K_C} \\cdot \\eta(\\lambda)',
      ],
      advancedConcept:
        'Pada suhu di atas 35°C, enzim Rubisco mengalami fotorespirasi meningkat dan struktur protein mulai tidak stabil sehingga laju fotosintesis turun tajam.',
    },
  },

  'enzyme-catalase': {
    keyTakeaways: [
      'Enzim katalase memecah hidrogen peroksida (H₂O₂) beracun menjadi air (H₂O) dan gas oksigen (O₂) dengan kecepatan luar biasa.',
      'Kinetika Michaelis-Menten menunjukkan laju awal meningkat cepat bersama kadar substrat [S] lalu mendatar menuju Vₘₐₖₛ saat semua sisi aktif penuh.',
      'Aktivitas enzim memuncak pada suhu optimum (~37°C) dan pH netral (~7,0); panas berlebih (>55–65°C) mendenaturasi bentuk 3D enzim secara permanen.',
    ],
    everydayAnalogy: {
      title: 'Kunci dan Gembok yang Meleleh Saat Dipanaskan',
      scenario:
        'Sisi aktif enzim seperti lubang kunci yang hanya cocok dengan satu bentuk anak kunci (substrat); jika gembok dipanaskan hingga berubah bentuk, kunci tidak lagi bisa masuk.',
      connection:
        'Kerusakan bentuk lubang kunci akibat suhu tinggi atau pH ekstrem adalah denaturasi protein yang menghentikan produksi gelembung O₂.',
    },
    formulaBreakdown: [
      { symbol: '[S]', name: 'Konsentrasi substrat H₂O₂', unit: 'mM', role: 'bebas', explanation: 'Meningkatkan laju reaksi hingga seluruh molekul enzim jenuh.' },
      { symbol: 'T', name: 'Suhu inkubasi', unit: '°C', role: 'bebas', explanation: 'Optimum di suhu tubuh ~37°C; di atas 55°C denaturasi merusak aktivitas.' },
      { symbol: 'pH', name: 'Keasaman larutan', unit: '1–14', role: 'bebas', explanation: 'Mengubah muatan gugus asam amino sisi aktif; optimum di pH ~7,0.' },
      { symbol: 'v', name: 'Laju reaksi enzimatik', unit: 'μmol/(L·s)', role: 'terikat', explanation: 'Kecepatan penguraian H₂O₂ yang terlihat sebagai tinggi kolom busa O₂.' },
    ],
    workedExample: {
      question:
        'Pada suhu 37°C dan pH 7,0, enzim katalase memiliki Vₘₐₖₛ = 120 μmol/(L·s) dan Kₘ = 4,5 mM. Berapa laju reaksi saat konsentrasi substrat H₂O₂ adalah 4,5 mM dan saat 13,5 mM?',
      given: ['Vₘₐₖₛ = 120 μmol/(L·s)', 'Kₘ = 4,5 mM', '[S]₁ = 4,5 mM; [S]₂ = 13,5 mM'],
      steps: [
        'Gunakan Persamaan Michaelis-Menten: v = (Vₘₐₖₛ · [S]) / (Kₘ + [S]).',
        'Saat [S] = 4,5 mM: v₁ = (120 × 4,5) / (4,5 + 4,5) = 540 / 9 = 60 μmol/(L·s) (tepat setengah Vₘₐₖₛ).',
        'Saat [S] = 13,5 mM: v₂ = (120 × 13,5) / (4,5 + 13,5) = 1620 / 18 = 90 μmol/(L·s).',
      ],
      answer: 'v₁ = 60 μmol/(L·s) dan v₂ = 90 μmol/(L·s)',
      physicalMeaning:
        'Konstanta Kₘ selalu setara dengan konsentrasi substrat yang menghasilkan tepat ½ Vₘₐₖₛ; makin kecil Kₘ, makin tinggi afinitas enzim terhadap substratnya.',
    },
    glossary: [
      { term: 'Sisi Aktif', definition: 'Celah spesifik tiga dimensi pada enzim tempat substrat berikatan dan bereaksi.' },
      { term: 'Denaturasi', definition: 'Kerusakan lipatan struktur tersier protein akibat panas atau pH ekstrem sehingga kehilangan fungsi.' },
      { term: 'Konstanta Michaelis (Kₘ)', definition: 'Kadar substrat saat laju reaksi mencapai setengah kecepatan maksimum (½ Vₘₐₖₛ).' },
      { term: 'Uji Bara Api', definition: 'Uji kualitatif keberadaan O₂: lidi membara kembali menyala terang saat didekatkan ke gas oksigen.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Leonor Michaelis dan Maud Menten (1913) mempublikasikan model matematika kinetika enzim yang menjadi salah satu persamaan terpenting dalam biokimia dan farmakologi modern.',
      derivationLatex: [
        '2\\text{H}_2\\text{O}_2 \\xrightarrow{\\text{katalase}} 2\\text{H}_2\\text{O} + \\text{O}_2\\uparrow',
        'v = \\frac{V_{\\max}[S]}{K_m + [S]}',
      ],
      advancedConcept:
        'Satu molekul enzim katalase mampu menguraikan hingga jutaan molekul H₂O₂ per detik (bilangan turnover k cat ≈ 10⁷ s⁻¹), mendekati batas laju difusi fisik molekul dalam air.',
    },
    extraPreLabQuestions: [
      {
        id: 'enz-q2',
        question: 'Ketika konsentrasi substrat [S] tepat sama dengan konstanta Michaelis Kₘ pada kondisi suhu dan pH optimum, berapakah laju reaksi enzimatiknya?',
        options: [
          'Tepat setengah dari laju maksimum (½ Vₘₐₖₛ)',
          'Tepat sama dengan laju maksimum (Vₘₐₖₛ)',
          'Seperempat dari laju maksimum',
          'Nol karena enzim mulai terdenaturasi',
        ],
        correctIndex: 0,
        explanation:
          'Substitusi [S] = Kₘ ke dalam v = Vₘₐₖₛ·[S]/(Kₘ + [S]) menghasilkan Vₘₐₖₛ·Kₘ/(2Kₘ) = ½ Vₘₐₖₛ.',
      },
    ],
  },

  'osmosis-plasmolysis': {
    keyTakeaways: [
      'Osmosis adalah perpindahan neto molekul air melintasi membran semipermeabel dari potensial air tinggi (encer) ke potensial air rendah (pekat).',
      'Di larutan hipotonik sel tumbuhan menjadi turgid (kencang); di larutan hipertonik air keluar sehingga membran plasma lepas dari dinding sel (plasmolisis).',
      'Konsentrasi sukrosa yang menghasilkan perubahan massa 0% (Δm = 0) menunjukkan titik isotonik internal sel jaringan.',
    ],
    everydayAnalogy: {
      title: 'Sayur Layu yang Segar Kembali Saat Direndam Air Bersih',
      scenario:
        'Selada atau kangkung layu menjadi renyah kembali setelah direndam air tawar, tetapi timun yang ditaburi garam justru mengeluarkan air dan menjadi lembek.',
      connection:
        'Air tawar bersifat hipotonik sehingga air masuk mengisi vakuola (tekanan turgor naik), sedangkan garam menciptakan lingkungan hipertonik yang menyedot air keluar dari sel.',
    },
    formulaBreakdown: [
      { symbol: 'C', name: 'Molaritas larutan sukrosa', unit: 'M', role: 'bebas', explanation: 'Menentukan seberapa negatif potensial zat terlarut Ψₛ di luar sel.' },
      { symbol: 'T', name: 'Suhu larutan', unit: '°C / K', role: 'bebas', explanation: 'Memengaruhi potensial osmotik melalui persamaan van ’t Hoff Ψₛ = −i·C·R·T.' },
      { symbol: 'Δm', name: 'Persen perubahan massa jaringan', unit: '%', role: 'terikat', explanation: 'Positif saat air masuk (hipotonik), negatif saat air keluar (hipertonik).' },
      { symbol: 'Ψₛ', name: 'Potensial zat terlarut', unit: 'MPa', role: 'terikat', explanation: 'Selalu ≤ 0; makin pekat gula, makin negatif nilainya.' },
    ],
    workedExample: {
      question:
        'Potongan kentang bermassa awal 2,50 g direndam dalam larutan sukrosa 0,60 M pada suhu 25°C (298 K). Jika massa akhirnya menjadi 2,15 g, hitung persen perubahan massa dan potensial zat terlarut sukrosa (i = 1, R = 0,008314 L·MPa/mol·K)!',
      given: ['m₀ = 2,50 g', 'm akhir = 2,15 g', 'C = 0,60 M', 'T = 298 K', 'i = 1 (sukrosa non-elektrolit)'],
      steps: [
        'Hitung persen perubahan massa: Δm% = ((2,15 − 2,50) / 2,50) × 100% = −14,0%.',
        'Hitung potensial zat terlarut: Ψₛ = −i·C·R·T = −1 × 0,60 × 0,008314 × 298.',
        'Hasil akhir: Ψₛ ≈ −1,49 MPa.',
      ],
      answer: 'Δm = −14,0% (menyusut) dan Ψₛ ≈ −1,49 MPa',
      physicalMeaning:
        'Tanda minus pada Δm menunjukkan larutan 0,60 M bersifat hipertonik terhadap sel kentang (isotonik ~0,28 M), memicu plasmolisis.',
    },
    glossary: [
      { term: 'Hipotonik', definition: 'Larutan berkonsentrasi zat terlarut lebih rendah daripada cairan di dalam sel.' },
      { term: 'Hipertonik', definition: 'Larutan berkonsentrasi zat terlarut lebih tinggi sehingga menarik air keluar sel.' },
      { term: 'Tekanan Turgor', definition: 'Tekanan hidrostatis isi sel yang mendorong membran menempel kuat ke dinding sel.' },
      { term: 'Plasmolisis', definition: 'Terlepasnya membran plasma dari dinding sel tumbuhan akibat kehilangan air berlebih.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Jean-Antoine Nollet pertama kali mengamati osmosis pada 1748 memakai membran kandung kemih babi, kemudian Jacobus Henricus van ’t Hoff meraih Nobel Kimia pertama (1901) berkat hukum tekanan osmotiknya.',
      derivationLatex: [
        '\\Psi = \\Psi_s + \\Psi_p',
        '\\Psi_s = -i C R T',
        '\\Delta m(\\%) = \\frac{m_{\\text{akhir}} - m_0}{m_0} \\times 100\\%',
      ],
      advancedConcept:
        'Berbeda dari sel hewan yang dapat pecah (lisis) di air murni, sel tumbuhan terlindungi dinding selulosa yang menghasilkan tekanan balik positif Ψₚ hingga Ψ dalam = Ψ luar.',
    },
    extraPreLabQuestions: [
      {
        id: 'osmo-q2',
        question: 'Jika potongan kentang direndam dalam aquades murni (0,0 M sukrosa) selama 30 menit, perubahan apa yang terjadi pada sel-selnya?',
        options: [
          'Air masuk ke sel, massa kentang bertambah, dan sel menjadi turgid',
          'Air keluar dari sel sehingga terjadi plasmolisis',
          'Massa kentang berkurang drastis karena gula berdifusi keluar',
          'Sel pecah total karena tidak memiliki dinding sel',
        ],
        correctIndex: 0,
        explanation:
          'Aquades (Ψ = 0 MPa) bersifat hipotonik terhadap cairan sel kentang, sehingga air masuk ke vakuola menaikkan massa dan tekanan turgor tanpa memecahkan dinding sel.',
      },
    ],
  },

  'predator-prey-dynamics': {
    keyTakeaways: [
      'Model Lotka-Volterra menggambarkan dinamika pasang-surut populasi mangsa (x) dan predator (y) yang saling bergantung.',
      'Puncak populasi predator selalu tertinggal seperempat siklus di belakang puncak mangsa karena butuh waktu untuk bereproduksi.',
      'Pada titik ekuilibrium (x* = γ/δ, y* = α/β), laju perubahan kedua populasi bernilai nol sehingga ekosistem koeksistensi stabil.',
    ],
    everydayAnalogy: {
      title: 'Keseimbangan Kelinci dan Serigala di Padang Rumput',
      scenario:
        'Ketika kelinci melimpah, serigala mudah makan dan berkembang biak pesat; akibatnya kelinci berkurang drastis, lalu serigala kelaparan dan menurun, memberi kesempatan kelinci pulih kembali.',
      connection:
        'Umpan balik negatif tertunda inilah yang melahirkan gelombang siklus tak berujung dan lintasan tertutup pada diagram ruang fase.',
    },
    formulaBreakdown: [
      { symbol: 'x', name: 'Populasi mangsa', unit: 'individu', role: 'bebas', explanation: 'Tumbuh eksponensial dengan laju α jika tidak ada pemangsa.' },
      { symbol: 'y', name: 'Populasi predator', unit: 'individu', role: 'bebas', explanation: 'Menurun alami dengan laju γ jika kehabisan mangsa.' },
      { symbol: 'α', name: 'Laju lahir mangsa', unit: '/siklus', role: 'bebas', explanation: 'Kecepatan reproduksi alami populasi mangsa.' },
      { symbol: 'β', name: 'Koefisien predasi', unit: '/(ind·siklus)', role: 'bebas', explanation: 'Efektivitas perburuan per pertemuan mangsa-predator.' },
    ],
    workedExample: {
      question:
        'Suatu ekosistem memiliki laju lahir mangsa α = 0,8, koefisien predasi β = 0,04, laju mati predator γ = 0,6, dan efisiensi konversi δ = 0,02. Tentukan titik ekuilibrium koeksistensi (x*, y*)!',
      given: ['α = 0,8', 'β = 0,04', 'γ = 0,6', 'δ = 0,02'],
      steps: [
        'Syarat dy/dt = 0 menghasilkan mangsa setimbang: x* = γ / δ = 0,6 / 0,02 = 30 individu.',
        'Syarat dx/dt = 0 menghasilkan predator setimbang: y* = α / β = 0,8 / 0,04 = 20 individu.',
      ],
      answer: 'Titik ekuilibrium pada x* = 30 mangsa dan y* = 20 predator',
      physicalMeaning:
        'Jika populasi dimulai tepat di (30, 20), jumlah keduanya tetap konstan; jika dimulai jauh dari titik ini, populasi berosilasi mengelilingi (30, 20).',
    },
    glossary: [
      { term: 'Ruang Fase (Phase Portrait)', definition: 'Grafik populasi predator (y) terhadap mangsa (x) yang membentuk orbit tertutup.' },
      { term: 'Ekuilibrium Koeksistensi', definition: 'Kombinasi jumlah mangsa dan predator saat keduanya tidak lagi bertambah maupun berkurang.' },
      { term: 'Keterlambatan Fase', definition: 'Jeda waktu antara puncak populasi mangsa dan puncak populasi predator.' },
      { term: 'Daya Dukung (Carrying Capacity)', definition: 'Batas maksimum populasi yang dapat ditopang sumber daya habitat nyata.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Alfred J. Lotka (1925) dan Vito Volterra (1926) secara terpisah menyusun persamaan ini; Volterra terinspirasi oleh misteri meningkatnya persentase ikan hiu predator di Laut Adriatik saat penangkapan ikan terhenti selama Perang Dunia I.',
      derivationLatex: [
        '\\frac{dx}{dt} = \\alpha x - \\beta x y',
        '\\frac{dy}{dt} = \\delta x y - \\gamma y',
        'x^* = \\frac{\\gamma}{\\delta}, \\quad y^* = \\frac{\\alpha}{\\beta}',
      ],
      advancedConcept:
        'Prinsip Volterra membuktikan bahwa penggunaan pestisida non-selektif yang membunuh mangsa dan predator sekaligus justru menaikkan rata-rata populasi hama (x*) karena γ predator meningkat.',
    },
    extraPreLabQuestions: [
      {
        id: 'pred-q2',
        question: 'Dalam siklus alami Lotka-Volterra, kapan puncak populasi predator terjadi dibandingkan puncak populasi mangsa?',
        options: [
          'Menyusul (tertinggal) beberapa waktu sesudah puncak populasi mangsa',
          'Selalu terjadi lebih dulu sebelum puncak mangsa',
          'Selalu berimpit tepat pada waktu yang sama',
          'Populasi predator tetap konstan sepanjang waktu',
        ],
        correctIndex: 0,
        explanation:
          'Predator terus bertambah selama jumlah mangsa masih di atas ambang x*, sehingga puncak predator baru tercapai setelah populasi mangsa mulai menurun.',
      },
    ],
  },

  'anatomy-cardiovascular-heart': {
    keyTakeaways: [
      'Curah Jantung CO = (HR × SV) / 1000 mengukur volume darah yang dipompa ventrikel kiri setiap menit (normal istirahat ~5 L/menit).',
      'Hukum Poiseuille (R ∝ η / r⁴) menunjukkan bahwa penyempitan jari-jari pembuluh darah sedikit saja melonjakkan resistensi secara drastis (pangkat empat).',
      'Gelombang EKG P-QRS-T merekam koordinasi sinyal listrik jantung: P (depolarisasi atrium), QRS (kontraksi ventrikel), dan T (repolarisasi ventrikel).',
    ],
    everydayAnalogy: {
      title: 'Pompa Air & Selang yang Menyempit Akibat Kerak',
      scenario:
        'Jika diameter selang air menyempit menjadi separuhnya akibat kerak, pompa harus bekerja jauh lebih keras untuk mempertahankan aliran air yang sama.',
      connection:
        'Plak aterosklerosis memperkecil radius pembuluh r sehingga resistensi melonjak 16 kali lipat (1 / 0,5⁴), memaksa jantung memompa dengan tekanan darah jauh lebih tinggi.',
    },
    formulaBreakdown: [
      { symbol: 'HR', name: 'Denyut jantung', unit: 'bpm', role: 'bebas', explanation: 'Jumlah siklus kontraksi jantung per menit (normal istirahat 60–100 bpm).' },
      { symbol: 'SV', name: 'Volume sekuncup', unit: 'mL/detak', role: 'terikat', explanation: 'Volume darah yang dipompa keluar tiap satu denyut (~70 mL).' },
      { symbol: 'r/r₀', name: 'Rasio jari-jari pembuluh', unit: 'relatif', role: 'bebas', explanation: '1,0 = sehat normal; < 0,7 = stenosis/aterosklerosis.' },
      { symbol: 'CO', name: 'Curah jantung', unit: 'L/menit', role: 'terikat', explanation: 'Laju aliran total darah sistemik = (HR × SV) / 1000.' },
    ],
    workedExample: {
      question:
        'Saat berolahraga ringan, denyut jantung siswa naik menjadi HR = 120 bpm dengan volume sekuncup SV = 85 mL. Hitung Curah Jantung (CO) dalam L/menit!',
      given: ['HR = 120 denyut/menit', 'SV = 85 mL/denyut'],
      steps: [
        'Kalikan denyut jantung dengan volume sekuncup: 120 × 85 = 10.200 mL/menit.',
        'Konversi mL ke Liter (dibagi 1000): CO = 10.200 / 1000 = 10,2 L/menit.',
      ],
      answer: 'CO = 10,2 L/menit (sekitar dua kali lipat kondisi istirahat)',
      physicalMeaning:
        'Peningkatan CO menyalurkan oksigen dan glukosa ekstra ke otot rangka yang sedang aktif bekerja.',
    },
    glossary: [
      { term: 'Sistol & Diastol', definition: 'Sistol adalah fase kontraksi bilik memompa darah; diastol adalah fase relaksasi pengisian.' },
      { term: 'Aterosklerosis', definition: 'Penumpukan plak lemak kolesterol di dinding arteri yang menyempitkan saluran darah.' },
      { term: 'Hukum Poiseuille', definition: 'Hukum hemodinamika yang menyatakan hambatan aliran fluida berbanding terbalik dengan r⁴.' },
      { term: 'Elektrokardiogram (EKG)', definition: 'Rekaman aktivitas impuls listrik jantung untuk memantau irama dan kesehatan miokardium.' },
    ],
    deepDiveContent: {
      historicalContext:
        'William Harvey (1628) membuktikan bahwa darah bersirkulasi dalam lintasan tertutup yang dipompa jantung, dan Willem Einthoven mengembangkan mesin EKG klinis pertama (Nobel Kedokteran 1924).',
      derivationLatex: [
        '\\text{CO} = \\frac{\\text{HR} \\times \\text{SV}}{1000}',
        'R = \\frac{8 \\eta L}{\\pi r^4} \\implies \\text{MAP} = \\text{CO} \\times \\text{TPR}',
      ],
      advancedConcept:
        'Mekanisme Frank-Starling menjelaskan bahwa makin besar volume darah yang mengisi ventrikel (preload), makin kuat serat otot jantung meregang dan memompa darah keluar.',
    },
  },

  'anatomy-respiratory-lungs': {
    keyTakeaways: [
      'Inspirasi terjadi karena kontraksi diafragma memperbesar volume toraks, menurunkan tekanan paru di bawah tekanan atmosfer (Hukum Boyle).',
      'Ventilasi menit (MV = RR × TV) mengukur total volume udara segar yang keluar-masuk paru-paru setiap menit.',
      'Saturasi oksigen darah (SpO₂) mengikuti kurva sigmoid oksihemoglobin Hill: stabil > 95% di dataran rendah tetapi anjlok di ketinggian ekstrem.',
    ],
    everydayAnalogy: {
      title: 'Menarik Piston Suntikan Agar Udara Tersedot Masuk',
      scenario:
        'Saat batang suntikan ditarik keluar, ruang di dalamnya membesar sehingga tekanan turun dan udara luar langsung tersedot masuk tanpa perlu didorong.',
      connection:
        'Kubah diafragma bekerja persis seperti piston suntikan di dasar rongga dada: saat diafragma turun mendatar, paru-paru mengembang pasif menarik udara.',
    },
    formulaBreakdown: [
      { symbol: 'RR', name: 'Frekuensi napas', unit: 'napas/mnt', role: 'bebas', explanation: 'Jumlah siklus tarik-hembus per menit (normal istirahat 12–18/mnt).' },
      { symbol: 'TV', name: 'Volume tidal', unit: 'mL', role: 'terikat', explanation: 'Volume udara sekali tarik napas tenang (~500 mL pada dewasa sehat).' },
      { symbol: 'h', name: 'Ketinggian lokasi', unit: 'mdpl', role: 'bebas', explanation: 'Makin tinggi dari permukaan laut, tekanan barometrik dan PₐO₂ makin rendah.' },
      { symbol: 'SpO₂', name: 'Saturasi oksigen hemoglobin', unit: '%', role: 'terikat', explanation: 'Persentase hemoglobin yang mengikat oksigen (normal 95–100%).' },
    ],
    workedExample: {
      question:
        'Seorang siswa bernapas tenang dengan frekuensi RR = 14 kali/menit dan volume tidal TV = 500 mL. Hitung Ventilasi Menit (MV) dalam L/menit!',
      given: ['RR = 14 napas/menit', 'TV = 500 mL = 0,50 L'],
      steps: [
        'Kalikan frekuensi napas dengan volume tidal: MV = 14 × 500 = 7000 mL/menit.',
        'Konversi ke liter: MV = 7000 / 1000 = 7,0 L/menit.',
      ],
      answer: 'Ventilasi Menit = 7,0 L/menit',
      physicalMeaning:
        'Dari 500 mL tiap tarikan napas, ~150 mL mengisi ruang rugi anatomis (trakea/bronkus) dan ~350 mL mencapai alveolus untuk pertukaran gas.',
    },
    glossary: [
      { term: 'Alveolus', definition: 'Jutaan kantung udara mikroskopis berdinding tipis tempat difusi O₂ dan CO₂ dengan kapiler.' },
      { term: 'Diafragma', definition: 'Otot kubah pemisah rongga dada dan perut yang menjadi penggerak utama pernapasan.' },
      { term: 'Volume Tidal (TV)', definition: 'Volume udara yang masuk atau keluar dalam satu kali bernapas biasa.' },
      { term: 'Hipoksia', definition: 'Kondisi kekurangan suplai oksigen pada jaringan tubuh akibat SpO₂ turun drastis.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Archibald Hill (1910) merumuskan persamaan kooperativitas pengikatan oksigen oleh empat gugus heme hemoglobin yang membentuk kurva disosiasi sigmoid khas.',
      derivationLatex: [
        '\\text{MV} = \\frac{\\text{RR} \\times \\text{TV}}{1000}',
        'S_{O_2} = \\frac{P_{O_2}^n}{P_{O_2}^n + P_{50}^n} \\times 100\\% \\quad (n \\approx 2.7)',
      ],
      advancedConcept:
        'Efek Bohr: saat jaringan bekerja keras dan menghasilkan banyak CO₂ (pH turun), kurva hemoglobin bergeser ke kanan agar oksigen lebih mudah dilepas ke otot yang membutuhkan.',
    },
    extraPreLabQuestions: [
      {
        id: 'resp-q2',
        question: 'Apa yang terjadi pada volume rongga dada dan tekanan udara dalam paru-paru saat otot diafragma berkontraksi (mendatar)?',
        options: [
          'Volume rongga dada membesar dan tekanan paru turun sehingga udara masuk',
          'Volume rongga dada mengecil dan tekanan paru naik sehingga udara keluar',
          'Volume dan tekanan tetap sama',
          'Tekanan paru naik melebihi atmosfer untuk menyedot udara',
        ],
        correctIndex: 0,
        explanation:
          'Berdasarkan Hukum Boyle (P ∝ 1/V), membesarnya volume rongga dada menurunkan tekanan intrapulmoner di bawah tekanan atmosfer sehingga udara mengalir masuk (inspirasi).',
      },
    ],
  },

  'anatomy-neural-synapse': {
    keyTakeaways: [
      'Potensial istirahat neuron berada di sekitar −70 mV akibat gradien ion Na⁺ (tinggi di luar) dan K⁺ (tinggi di dalam) yang dijaga pompa Na⁺/K⁺.',
      'Potensial aksi mematuhi Hukum All-or-None: jika stimulus melewati ambang −55 mV, kanal Na⁺ terbuka serentak melompatkan tegangan ke +30 mV.',
      'Selubung mielin mempercepat rambatan impuls hingga 50× lipat lewat konduksi saltatorik (melompat antar Nodus Ranvier).',
    ],
    everydayAnalogy: {
      title: 'Barisan Domino Berlompatan & Saklar Lampu',
      scenario:
        'Dorongan lemah tidak menjatuhkan domino pertama, tetapi sekali ambang terlampaui, seluruh deretan roboh dengan tinggi jatuh yang selalu sama; selubung mielin seperti memperpanjang jarak lompatan sinyal.',
      connection:
        'Domino yang roboh seragam adalah Hukum All-or-None (+30 mV), dan loncatan impuls di celah Nodus Ranvier menghemat waktu dan energi ATP sel saraf.',
    },
    formulaBreakdown: [
      { symbol: 'V stim', name: 'Tegangan stimulus input', unit: 'mV', role: 'bebas', explanation: 'Harus mencapai atau melewati ambang −55 mV untuk memicu potensial aksi.' },
      { symbol: 'Mielin', name: 'Ketebalan selubung mielin', unit: '%', role: 'bebas', explanation: 'Insulator lipid penekan kebocoran ion; mempercepat konduksi saltatorik.' },
      { symbol: 'E Na / E K', name: 'Potensial Nernst ion Na⁺ & K⁺', unit: 'mV', role: 'terikat', explanation: 'Tegangan keseimbangan masing-masing ion (~ +60 mV untuk Na⁺, ~ −90 mV untuk K⁺).' },
      { symbol: 'v kond', name: 'Kecepatan konduksi akson', unit: 'm/s', role: 'terikat', explanation: 'Kelajuan rambat impuls dari badan sel menuju sinapsis (2–120 m/s).' },
    ],
    workedExample: {
      question:
        'Sebuah akson bermielin menghantarkan sinyal motorik dengan kecepatan 80 m/s dari sumsum tulang belakang ke otot kaki sejauh 1,2 m. Bandingkan waktu tempuhnya dengan akson tak bermielin berkecepatan 2 m/s!',
      given: ['Jarak s = 1,2 m', 'v bermielin = 80 m/s', 'v tak bermielin = 2 m/s'],
      steps: [
        'Hitung waktu akson bermielin: t₁ = s / v₁ = 1,2 / 80 = 0,015 s (15 milidetik).',
        'Hitung waktu akson tak bermielin: t₂ = s / v₂ = 1,2 / 2 = 0,60 s (600 milidetik).',
      ],
      answer: '15 ms (bermielin) vs 600 ms (tak bermielin) — 40 kali lebih cepat!',
      physicalMeaning:
        'Tanpa selubung mielin, refleks menarik kaki saat menginjak benda tajam akan tertunda lebih dari setengah detik.',
    },
    glossary: [
      { term: 'Depolarisasi', definition: 'Masuknya ion Na⁺ ke dalam akson yang membuat bagian dalam sel menjadi positif (+30 mV).' },
      { term: 'Repolarisasi', definition: 'Keluarnya ion K⁺ mengembalikan tegangan membran kembali menuju −70 mV.' },
      { term: 'Konduksi Saltatorik', definition: 'Perambatan impuls saraf yang melompat cepat dari satu Nodus Ranvier ke nodus berikutnya.' },
      { term: 'Neurotransmiter', definition: 'Senyawa kimia pembawa sinyal melintasi celah sinapsis menuju sel target.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Alan Hodgkin dan Andrew Huxley memetakan mekanisme kanal ion menggunakan akson raksasa cumi-cumi (1952) dan meraih Hadiah Nobel Fisiologi/Kedokteran 1963.',
      derivationLatex: [
        'E_{\\text{ion}} = \\frac{61.5\\text{ mV}}{z} \\log_{10}\\left(\\frac{[\\text{ion}]_{\\text{luar}}}{[\\text{ion}]_{\\text{dalam}}}\\right)',
        'I_m = C_m \\frac{dV}{dt} + g_{Na}(V - E_{Na}) + g_K(V - E_K)',
      ],
      advancedConcept:
        'Setelah potensial aksi, kanal Na⁺ masuk fase inaktivasi singkat (periode refrakter absolut) sehingga impuls selalu merambat satu arah menuju ujung sinapsis.',
    },
  },

  'mendel-genetics-dihybrid': {
    keyTakeaways: [
      'Hukum II Mendel (Asortasi Bebas) menyatakan alel dari dua gen pada kromosom berbeda berpisah secara independen membentuk 4 jenis gamet (RY, Ry, rY, ry) dengan peluang setara.',
      'Persilangan dihibrid heterozigot RrYy × RrYy menghasilkan rasio fenotipe harapan F₂ sebesar 9 Bulat-Kuning : 3 Bulat-Hijau : 3 Keriput-Kuning : 1 Keriput-Hijau.',
      'Uji Goodness-of-Fit Chi-Square (χ²) mengukur apakah selisih antara jumlah anakan pengamatan (O) dan harapan (E) masih berada dalam batas fluktuasi acak (χ² ≤ 7,815 pada df = 3, α = 0,05).',
    ],
    everydayAnalogy: {
      title: 'Melempar Dua Koin Berbeda Secara Bersamaan',
      scenario:
        'Saat Anda melempar koin perak dan koin emas sekaligus, hasil sisi angka atau gambar pada koin perak sama sekali tidak memengaruhi hasil jatuhnya koin emas.',
      connection:
        'Koin perak adalah gen bentuk biji (R/r) dan koin emas adalah gen warna biji (Y/y): karena keduanya berpilah bebas, peluang gabungan (3/4 : 1/4) × (3/4 : 1/4) melahirkan rasio 9/16 : 3/16 : 3/16 : 1/16.',
    },
    formulaBreakdown: [
      { symbol: 'N', name: 'Jumlah total sampel biji F₂', unit: 'biji', role: 'bebas', explanation: 'Ukuran populasi anakan yang diamati; makin besar N makin dekat proporsi ke 9:3:3:1.' },
      { symbol: 'Eᵢ', name: 'Frekuensi harapan kelas ke-i', unit: 'biji', role: 'terikat', explanation: 'Jumlah teoritis tiap fenotipe: (9/16)N, (3/16)N, (3/16)N, dan (1/16)N.' },
      { symbol: 'Oᵢ', name: 'Frekuensi pengamatan kelas ke-i', unit: 'biji', role: 'terikat', explanation: 'Jumlah biji aktual yang terhitung pada masing-masing kategori fenotipe.' },
      { symbol: 'χ²', name: 'Nilai statistik Chi-Square', unit: 'tanpa satuan', role: 'terikat', explanation: 'Jumlah kuadrat selisih (Oᵢ − Eᵢ)² dibagi Eᵢ untuk menguji kesesuaian model Mendel.' },
    ],
    workedExample: {
      question:
        'Dari persilangan tanaman ercis RrYy × RrYy diperoleh total N = 160 biji dengan pengamatan: 93 Bulat-Kuning, 27 Bulat-Hijau, 28 Keriput-Kuning, dan 12 Keriput-Hijau. Hitung nilai χ² dan tentukan apakah memenuhi rasio 9:3:3:1 (nilai kritis df = 3 adalah 7,815)!',
      given: ['N = 160 biji', 'O = [93, 27, 28, 12]', 'Rasio harapan = 9/16 : 3/16 : 3/16 : 1/16'],
      steps: [
        'Hitung nilai harapan Eᵢ untuk N = 160: E₁ = (9/16)×160 = 90; E₂ = (3/16)×160 = 30; E₃ = (3/16)×160 = 30; E₄ = (1/16)×160 = 10.',
        'Hitung kontribusi tiap kelas (Oᵢ − Eᵢ)² / Eᵢ: (93−90)²/90 = 9/90 = 0,100; (27−30)²/30 = 9/30 = 0,300; (28−30)²/30 = 4/30 = 0,133; (12−10)²/10 = 4/10 = 0,400.',
        'Jumlahkan seluruh komponen: χ² = 0,100 + 0,300 + 0,133 + 0,400 = 0,933.',
      ],
      answer: 'χ² = 0,933 ≤ 7,815 (Hipotesis Mendel 9:3:3:1 Diterima)',
      physicalMeaning:
        'Deviasi kecil (93 vs 90 biji) murni disebabkan oleh variasi pengambilan sampel acak fertilisasi gamet, sehingga kedua gen terbukti berpilah secara bebas.',
    },
    glossary: [
      { term: 'Asortasi Bebas (Hukum II Mendel)', definition: 'Prinsip bahwa alel dari lokus gen yang berbeda memisah secara independen selama metafase-anafase I meiosis.' },
      { term: 'Persilangan Dihibrid', definition: 'Persilangan genetik yang mengamati pewarisan dua sifat beda sekaligus (misalnya tekstur biji dan warna kotiledon).' },
      { term: 'Uji Chi-Square (χ²)', definition: 'Uji statistik non-parametrik untuk mengevaluasi seberapa cocok distribusi frekuensi pengamatan terhadap distribusi harapan teoritis.' },
      { term: 'Derajat Kebebasan (df)', definition: 'Jumlah kategori fenotipe independen dikurangi satu (untuk 4 kelas fenotipe dihibrid, df = 4 − 1 = 3).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Gregor Johann Mendel (1865) membudidayakan lebih dari 28.000 tanaman kacang ercis di biara Brno, lalu Karl Pearson (1900) memperkenalkan uji statistik Chi-Square yang kemudian digunakan Ronald Fisher untuk menganalisis ketelitian data Mendel.',
      derivationLatex: [
        'P(R\\_Y\\_) = P(R\\_) \\cdot P(Y\\_) = \\frac{3}{4} \\times \\frac{3}{4} = \\frac{9}{16}',
        '\\chi^2 = \\sum_{i=1}^{k} \\frac{(O_i - E_i)^2}{E_i}, \\quad df = k - 1 = 3',
      ],
      advancedConcept:
        'Apabila nilai χ² jauh melampaui 7,815 pada sampel besar, hal tersebut mengindikasikan terjadinya pautan gen (genetic linkage) pada kromosom yang sama, epistasis, atau seleksi alel letal.',
    },
  },
};

