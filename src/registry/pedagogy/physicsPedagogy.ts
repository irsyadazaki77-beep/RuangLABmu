import type { ModulePedagogyBundle } from './index';

export const PHYSICS_PEDAGOGY: Record<string, ModulePedagogyBundle> = {
  'newton-incline': {
    keyTakeaways: [
      'Gaya berat m·g pada bidang miring diurai menjadi komponen sejajar lintasan (m·g·sin θ) dan komponen tegak lurus permukaan (m·g·cos θ).',
      'Gaya normal N = m·g·cos θ mengecil saat bidang makin curam, sehingga gaya gesek kinetis fₖ = μₖ·N ikut berkurang.',
      'Percepatan luncur ditentukan oleh resultan seluruh gaya searah lintasan dibagi massa benda: a = ΣF / m.',
    ],
    everydayAnalogy: {
      title: 'Mendorong Koper di Jalur Landai Bandara',
      scenario:
        'Saat mendorong koper berat menaiki ramp miring di bandara, makin curam kemiringannya, makin berat dorongan yang diperlukan meski berat koper tidak berubah.',
      connection:
        'Kemiringan ramp memperbesar komponen gravitasi m·g·sin θ yang menarik koper ke bawah, sementara lantai yang kasar menambah hambatan gesek μₖ·m·g·cos θ.',
    },
    formulaBreakdown: [
      { symbol: 'F', name: 'Gaya dorong luar', unit: 'N', role: 'bebas', explanation: 'Dorongan sejajar lintasan ke arah atas bidang.' },
      { symbol: 'θ', name: 'Sudut kemiringan bidang', unit: '°', role: 'bebas', explanation: 'Menentukan porsi gaya berat yang sejajar vs tegak lurus.' },
      { symbol: 'm', name: 'Massa balok', unit: 'kg', role: 'bebas', explanation: 'Ukuran inersia benda terhadap perubahan kecepatan.' },
      { symbol: 'μₖ', name: 'Koefisien gesek kinetis', unit: 'tanpa satuan', role: 'bebas', explanation: 'Tingkat kekasaran kontak antara alas balok dan papan.' },
      { symbol: 'a', name: 'Percepatan luncur', unit: 'm/s²', role: 'terikat', explanation: 'Laju perubahan kecepatan balok sepanjang bidang miring.' },
    ],
    workedExample: {
      question:
        'Balok bermassa 4 kg berada di bidang miring bersudut 30° dengan koefisien gesek kinetis μₖ = 0,20. Jika balok didorong ke atas dengan gaya 40 N (g = 10 m/s²), berapa percepatannya?',
      given: ['m = 4 kg', 'θ = 30° (sin 30° = 0,50; cos 30° = 0,866)', 'μₖ = 0,20', 'F = 40 N', 'g = 10 m/s²'],
      steps: [
        'Hitung komponen berat sejajar bidang: Wₓ = m·g·sin 30° = 4 × 10 × 0,50 = 20,0 N.',
        'Hitung gaya normal: N = m·g·cos 30° = 4 × 10 × 0,866 = 34,64 N.',
        'Hitung gaya gesek kinetis: fₖ = μₖ·N = 0,20 × 34,64 = 6,93 N.',
        'Hitung resultan gaya: ΣF = F − Wₓ − fₖ = 40 − 20,0 − 6,93 = 13,07 N.',
        'Hitung percepatan: a = ΣF / m = 13,07 / 4 = 3,27 m/s².',
      ],
      answer: 'a ≈ 3,27 m/s² ke arah atas bidang miring',
      physicalMeaning:
        'Karena gaya dorong 40 N melampaui total hambatan gravitasi dan gesekan (26,93 N), balok bergerak dipercepat beraturan menaiki bidang.',
    },
    glossary: [
      { term: 'Gaya Normal (N)', definition: 'Gaya reaksi permukaan yang selalu tegak lurus terhadap bidang sentuh benda.' },
      { term: 'Gesek Kinetis (fₖ)', definition: 'Gaya hambat yang bekerja berlawanan arah gerak ketika dua permukaan saling bergeser.' },
      { term: 'Inersia', definition: 'Kecenderungan benda mempertahankan keadaan diam atau gerak lurus beraturannya.' },
      { term: 'Resultan Gaya (ΣF)', definition: 'Jumlah vektor seluruh gaya yang bekerja pada satu benda.' },
    ],
  },

  'projectile-motion': {
    keyTakeaways: [
      'Gerak parabola adalah perpaduan dua gerak saling bebas: GLB horizontal (vₓ tetap) dan GLBB vertikal (percepatan −g).',
      'Di titik puncak lintasan, kecepatan vertikal vᵧ = 0, tetapi proyektil tetap melaju ke depan dengan kecepatan vₓ = v₀·cos θ.',
      'Untuk ketinggian awal nol (h₀ = 0), sudut tembak 45° memberi jarak terjauh dan pasangan sudut komplementer (mis. 30° dan 60°) mencapai jarak sama.',
    ],
    everydayAnalogy: {
      title: 'Lengkungan Lemparan Bola Basket & Semburan Air',
      scenario:
        'Ketika melempar bola basket menuju ring, bola naik melambat hingga puncak lalu menukik turun, sementara bayangannya di lantai melaju konstan.',
      connection:
        'Bayangan di lantai mewakili komponen horizontal vₓ = v₀·cos θ yang bebas gravitasi, sedangkan naik-turunnya bola dikendalikan penuh oleh gravitasi g.',
    },
    formulaBreakdown: [
      { symbol: 'v₀', name: 'Kecepatan awal tembak', unit: 'm/s', role: 'bebas', explanation: 'Kelajuan proyektil tepat saat meninggalkan laras.' },
      { symbol: 'θ', name: 'Sudut elevasi tembak', unit: '°', role: 'bebas', explanation: 'Mengatur pembagian kecepatan ke arah mendatar dan vertikal.' },
      { symbol: 'h₀', name: 'Ketinggian awal peluncuran', unit: 'm', role: 'bebas', explanation: 'Posisi vertikal awal relatif terhadap bidang jatuh.' },
      { symbol: 'R', name: 'Jangkauan horizontal', unit: 'm', role: 'terikat', explanation: 'Jarak datar total yang ditempuh hingga menyentuh tanah.' },
      { symbol: 'Hₘₐₖₛ', name: 'Tinggi maksimum', unit: 'm', role: 'terikat', explanation: 'Ketinggian puncak ketika vᵧ mencapai nol.' },
    ],
    workedExample: {
      question:
        'Sebuah peluru ditembakkan dari permukaan tanah (h₀ = 0) dengan kecepatan awal 20 m/s dan sudut elevasi 30° (g = 10 m/s²). Hitung tinggi maksimum dan jarak jangkauannya!',
      given: ['v₀ = 20 m/s', 'θ = 30° (sin 30° = 0,5; sin 60° = 0,866)', 'h₀ = 0 m', 'g = 10 m/s²'],
      steps: [
        'Hitung kecepatan vertikal awal: v₀ᵧ = v₀·sin 30° = 20 × 0,5 = 10 m/s.',
        'Hitung tinggi maksimum: Hₘₐₖₛ = v₀ᵧ² / (2g) = 10² / 20 = 5,0 m.',
        'Hitung jangkauan mendatar: R = (v₀²·sin 2θ) / g = (400 × sin 60°) / 10 = 40 × 0,866 = 34,64 m.',
      ],
      answer: 'Hₘₐₖₛ = 5,0 m dan R ≈ 34,64 m',
      physicalMeaning:
        'Sudut 30° menghasilkan lintasan rendah dan cepat mencapai target; jika dinaikkan ke 60°, jarak R tetap 34,64 m namun tinggi puncak melonjak tiga kali lipat.',
    },
    glossary: [
      { term: 'Superposisi Gerak', definition: 'Prinsip bahwa gerak dua dimensi dapat diurai menjadi komponen sumbu X dan Y secara independen.' },
      { term: 'Sudut Komplementer', definition: 'Dua sudut yang jumlahnya 90° (seperti 30° dan 60°) dengan jangkauan datar identik saat h₀ = 0.' },
      { term: 'Waktu Terbang', definition: 'Total durasi proyektil berada di udara dari peluncuran hingga mendarat.' },
      { term: 'Trajektori', definition: 'Bentuk kurva lintasan yang dilalui proyektil di dalam ruang.' },
    ],
    extraPreLabQuestions: [
      {
        id: 'proj-q2',
        question: 'Jika dua meriam identik menembak dari tanah datar (h₀ = 0) dengan laju awal sama pada sudut 25° dan 65°, pernyataan mana yang benar?',
        options: [
          'Keduanya mencapai jarak jangkauan mendatar yang sama, namun sudut 65° terbang lebih lama',
          'Sudut 25° mencapai jarak lebih jauh karena komponen vₓ lebih besar',
          'Keduanya mencapai ketinggian maksimum yang persis sama',
          'Sudut 65° mencapai jarak lebih pendek karena gravitasi menarik lebih lama',
        ],
        correctIndex: 0,
        explanation:
          'Karena 25° + 65° = 90° (komplementer), sin(2×25°) = sin(50°) = sin(130°) = sin(2×65°), sehingga jangkauan R sama persis, sementara sudut 65° memiliki v₀ᵧ lebih besar sehingga waktu terbang lebih lama.',
      },
    ],
  },

  'pendulum-harmonic': {
    keyTakeaways: [
      'Periode bandul sederhana T = 2π·√(L/g) hanya bergantung pada panjang tali L dan percepatan gravitasi g.',
      'Massa beban tidak memengaruhi periode ayunan karena gaya pemulih dan inersia sama-sama sebanding dengan massa m.',
      'Hubungan T² terhadap L berbentuk garis lurus dengan gradien 4π²/g, cara klasik mengukur gravitasi lokal secara presisi.',
    ],
    everydayAnalogy: {
      title: 'Ayunan Taman Bermain Bertali Panjang vs Pendek',
      scenario:
        'Anak kecil dan orang dewasa yang naik ayunan dengan panjang rantai sama akan berayun dengan ritme yang hampir sama, tetapi ayunan berrantai lebih panjang terasa jauh lebih lambat.',
      connection:
        'Ritme ayunan ditentukan oleh panjang rantai L (sebanding dengan √L), bukan oleh berat badan penumpangnya.',
    },
    formulaBreakdown: [
      { symbol: 'L', name: 'Panjang tali bandul', unit: 'm', role: 'bebas', explanation: 'Jarak dari titik gantung tetap ke pusat massa bandul.' },
      { symbol: 'g', name: 'Percepatan gravitasi', unit: 'm/s²', role: 'bebas', explanation: 'Menarik beban kembali ke titik kesetimbangan terendah.' },
      { symbol: 'θ₀', name: 'Sudut simpangan awal', unit: '°', role: 'bebas', explanation: 'Harus kecil (≤ 15°) agar gerak harmonik sederhana berlaku murni.' },
      { symbol: 'T', name: 'Periode satu getaran', unit: 's', role: 'terikat', explanation: 'Waktu satu ayunan penuh bolak-balik kembali ke titik awal.' },
    ],
    workedExample: {
      question:
        'Sebuah bandul sederhana memiliki panjang tali L = 1,0 m di tempat dengan g = 9,81 m/s². Berapa periodenya, dan berapa panjang tali yang dibutuhkan agar periodenya menjadi dua kali lebih lama?',
      given: ['L₁ = 1,0 m', 'g = 9,81 m/s²', 'T₂ = 2·T₁'],
      steps: [
        'Hitung periode awal: T₁ = 2π·√(1,0 / 9,81) = 6,283 × 0,3193 ≈ 2,01 s.',
        'Karena T ∝ √L, maka T₂/T₁ = √(L₂/L₁) → 2 = √(L₂ / 1,0).',
        'Kuadratkan kedua ruas: L₂ = 4 × 1,0 = 4,0 m.',
      ],
      answer: 'T₁ ≈ 2,01 s; panjang tali harus diperbesar 4 kali menjadi 4,0 m',
      physicalMeaning:
        'Hubungan akar kuadrat berarti menggandakan waktu ayunan membutuhkan tali empat kali lebih panjang — prinsip penyetelan jam bandul klasik.',
    },
    glossary: [
      { term: 'Periode (T)', definition: 'Waktu yang diperlukan bandul menempuh satu siklus ayunan bolak-balik penuh.' },
      { term: 'Frekuensi (f)', definition: 'Jumlah ayunan penuh per detik (f = 1/T), bersatuan Hertz (Hz).' },
      { term: 'Hampiran Sudut Kecil', definition: 'Pendekatan sin θ ≈ θ (dalam radian) yang akurat untuk sudut simpangan ≤ 15°.' },
      { term: 'Isokronisme', definition: 'Sifat periode bandul yang hampir konstan walaupun amplitudo sudut kecil sedikit berubah.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Galileo Galilei (1583) menemukan sifat isokronisme saat mengamati ayunan lampu gantung di Katedral Pisa memakai denyut nadinya, lalu Christiaan Huygens mematenkan jam bandul pertama pada 1656.',
      derivationLatex: [
        '\\tau = -m g L \\sin\\theta = I \\alpha = m L^2 \\frac{d^2\\theta}{dt^2}',
        '\\frac{d^2\\theta}{dt^2} + \\frac{g}{L}\\theta = 0 \\quad (\\sin\\theta \\approx \\theta)',
        '\\omega = \\sqrt{\\frac{g}{L}} \\implies T = 2\\pi\\sqrt{\\frac{L}{g}}',
      ],
      advancedConcept:
        'Pada sudut besar, periode meningkat mengikuti deret eliptik Legendre: T ≈ T₀·(1 + θ₀²/16 + ...), sehingga ayunan ekstrem sedikit melambat.',
    },
    extraPreLabQuestions: [
      {
        id: 'pend-q2',
        question: 'Jika massa beban bandul digandakan dari 0,2 kg menjadi 0,4 kg sementara panjang tali L tetap, apa yang terjadi pada periode T?',
        options: [
          'Tetap sama, tidak berubah',
          'Menjadi dua kali lebih lambat',
          'Menjadi setengah kali lebih cepat',
          'Meningkat sebesar √2 kali',
        ],
        correctIndex: 0,
        explanation:
          'Pada persamaan T = 2π·√(L/g), variabel massa saling meniadakan antara gaya pemulih (m·g·sin θ) dan momen inersia (m·L²), sehingga periode tidak bergantung pada massa.',
      },
    ],
  },

  'spring-hooke': {
    keyTakeaways: [
      'Hukum Hooke menyatakan gaya pemulih pegas sebanding dengan simpangan dan selalu berlawanan arah: F = −k·Δx.',
      'Periode getaran pegas T = 2π·√(m/k) membesar jika massa bertambah dan mengecil jika pegas makin kaku.',
      'Energi mekanik sistem terkonversi bergantian antara energi potensial elastis (½·k·x²) di titik balik dan energi kinetik (½·m·v²) di titik setimbang.',
    ],
    everydayAnalogy: {
      title: 'Suspensi Motor di Jalan Bergelombang',
      scenario:
        'Saat sepeda motor melewati polisi tidur berboncengan (massa besar), ayunan sokbreker terasa lebih lambat dan dalam dibanding saat dikendarai sendiri.',
      connection:
        'Pertambahan massa m memperbesar periode osilasi T = 2π·√(m/k), sementara oli peredam (damping) mencegah motor terus memantul.',
    },
    formulaBreakdown: [
      { symbol: 'k', name: 'Konstanta kekakuan pegas', unit: 'N/m', role: 'bebas', explanation: 'Gaya yang dibutuhkan untuk meregangkan pegas sejauh 1 meter.' },
      { symbol: 'm', name: 'Massa beban gantung', unit: 'kg', role: 'bebas', explanation: 'Beban yang berosilasi pada ujung bebas pegas.' },
      { symbol: 'Δx', name: 'Simpangan pegas', unit: 'm', role: 'bebas', explanation: 'Perubahan panjang dari posisi setimbang.' },
      { symbol: 'T', name: 'Periode osilasi pegas', unit: 's', role: 'terikat', explanation: 'Waktu satu siklus naik-turun penuh.' },
    ],
    workedExample: {
      question:
        'Pegas dengan konstanta k = 100 N/m digantungi beban 0,25 kg lalu ditarik 0,10 m dari titik setimbang. Hitung besar gaya pemulih awal dan periode getarannya!',
      given: ['k = 100 N/m', 'm = 0,25 kg', 'Δx = 0,10 m'],
      steps: [
        'Hitung besar gaya pemulih: |F| = k·Δx = 100 × 0,10 = 10 N (berarah menuju titik setimbang).',
        'Hitung periode osilasi: T = 2π·√(m/k) = 2π·√(0,25 / 100) = 2π × 0,05.',
        'Sederhanakan hasil: T = 0,1π ≈ 0,314 s.',
      ],
      answer: '|F| = 10 N dan T ≈ 0,314 s',
      physicalMeaning:
        'Dalam 1 detik pegas menuntaskan sekitar 3,18 getaran penuh, dan amplitudo 0,10 m tidak mengubah periode selama masih dalam batas elastis.',
    },
    glossary: [
      { term: 'Konstanta Pegas (k)', definition: 'Ukuran kekakuan pegas; makin besar k, makin sulit pegas diregangkan.' },
      { term: 'Batas Elastis', definition: 'Simpangan maksimum di mana pegas masih dapat kembali sempurna ke bentuk semula.' },
      { term: 'Redaman (Damping)', definition: 'Gaya disipatif yang perlahan mengecilkan amplitudo getaran hingga berhenti.' },
      { term: 'Frekuensi Sudut (ω)', definition: 'Laju perubahan fase osilasi dalam radian per detik, ω = √(k/m).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Robert Hooke mengumumkan hukum elastisitasnya pada 1676 melalui anagram Latin "ceiiinosssttuv" yang bermakna "Ut tensio, sic vis" (seperti regangan, demikian pula gayanya).',
      derivationLatex: [
        'F = -k x = m \\frac{d^2 x}{dt^2} \\implies \\frac{d^2 x}{dt^2} + \\frac{k}{m} x = 0',
        'x(t) = A \\cos(\\omega t + \\phi), \\quad \\omega = \\sqrt{\\frac{k}{m}}',
        'E_p = \\frac{1}{2} k x^2, \\quad T = 2\\pi\\sqrt{\\frac{m}{k}}',
      ],
      advancedConcept:
        'Pada osilator teredam (b > 0), kondisi redaman kritis (b = 2√(km)) mengembalikan sistem ke setimbang paling cepat tanpa berosilasi balik — target desain suspensi kendaraan.',
    },
    extraPreLabQuestions: [
      {
        id: 'spring-q2',
        question: 'Jika massa beban pada pegas diperbesar 4 kali lipat dengan konstanta k tetap, bagaimana perubahan periode osilasinya?',
        options: [
          'Menjadi 2 kali lebih besar',
          'Menjadi 4 kali lebih besar',
          'Menjadi setengahnya',
          'Tetap tidak berubah',
        ],
        correctIndex: 0,
        explanation:
          'Karena T = 2π·√(m/k), memperbesar m sebesar 4 kali menghasilkan faktor √4 = 2 pada periode osilasi.',
      },
    ],
  },

  'collision-momentum': {
    keyTakeaways: [
      'Momentum linear total sistem tertutup (p = m₁v₁ + m₂v₂) selalu kekal pada semua jenis tumbukan.',
      'Koefisien restitusi e ∈ [0, 1] menentukan tingkat kelentingan: e = 1 lenting sempurna (energi kinetik kekal), e = 0 tidak lenting sama sekali.',
      'Pada tumbukan tak lenting, selisih energi kinetik berubah menjadi panas, bunyi, dan deformasi struktur.',
    ],
    everydayAnalogy: {
      title: 'Bola Biliar vs Zona Remuk Bumper Mobil',
      scenario:
        'Bola biliar yang beradu memantul nyaris tanpa kehilangan laju, sedangkan bumper mobil sengaja dibuat melesak saat tabrakan agar penumpang terlindungi.',
      connection:
        'Bola biliar mendekati e ≈ 1 (transfer momentum elastis), sedangkan zona remuk bumper mendekati e ≈ 0 untuk menyerap energi kinetik destruktif dan memperpanjang waktu kontak impuls.',
    },
    formulaBreakdown: [
      { symbol: 'm₁, m₂', name: 'Massa troli 1 & 2', unit: 'kg', role: 'bebas', explanation: 'Menentukan kapasitas momentum dan pembagian kecepatan pascatumbukan.' },
      { symbol: 'v₁, v₂', name: 'Kecepatan awal', unit: 'm/s', role: 'bebas', explanation: 'Kecepatan bertanda arah (+ ke kanan, − ke kiri) sebelum kontak.' },
      { symbol: 'e', name: 'Koefisien restitusi', unit: '0–1', role: 'bebas', explanation: 'Rasio kelajuan menjauh pascatumbukan terhadap kelajuan mendekat awal.' },
      { symbol: 'ΔEₖ', name: 'Energi kinetik terdisipasi', unit: 'J', role: 'terikat', explanation: 'Bagian energi mekanik yang berubah menjadi kalor/bunyi saat e < 1.' },
    ],
    workedExample: {
      question:
        'Troli 1 (m₁ = 2 kg, v₁ = 6 m/s) menabrak troli 2 (m₂ = 4 kg) yang diam. Jika tumbukan tidak lenting sama sekali (e = 0), berapa kecepatan gabungan mereka dan berapa energi kinetik yang hilang?',
      given: ['m₁ = 2 kg, v₁ = 6 m/s', 'm₂ = 4 kg, v₂ = 0 m/s', 'e = 0'],
      steps: [
        'Hitung momentum awal: p = m₁v₁ + m₂v₂ = 2(6) + 4(0) = 12 kg·m/s.',
        'Karena menempel bersama (e = 0): v akhir = p / (m₁ + m₂) = 12 / (2 + 4) = 2,0 m/s.',
        'Hitung energi kinetik awal: Eₖ awal = ½·2·6² = 36 J.',
        'Hitung energi kinetik akhir: Eₖ akhir = ½·(2+4)·2² = 12 J.',
        'Energi kinetik hilang: ΔEₖ = 36 − 12 = 24 J.',
      ],
      answer: 'v akhir = 2,0 m/s dan energi hilang = 24 J (66,7% dari energi awal)',
      physicalMeaning:
        'Meskipun 24 J energi kinetik berubah menjadi panas dan deformasi, momentum total sistem tetap persis 12 kg·m/s.',
    },
    glossary: [
      { term: 'Momentum Linear (p)', definition: 'Hasil kali massa dan kecepatan vektor benda (p = m·v).' },
      { term: 'Impuls (J)', definition: 'Hasil kali gaya rata-rata dan selang waktu kontak yang sama dengan perubahan momentum.' },
      { term: 'Koefisien Restitusi (e)', definition: 'Angka 0 sampai 1 yang mengukur kelentingan tumbukan: e = −(v₂′ − v₁′)/(v₂ − v₁).' },
      { term: 'Sistem Terisolasi', definition: 'Sistem tanpa resultan gaya luar sehingga momentum totalnya kekal.' },
    ],
    deepDiveContent: {
      historicalContext:
        'John Wallis, Christopher Wren, dan Christiaan Huygens (1668) merumuskan hukum kekekalan momentum tumbukan untuk Royal Society London sebelum Newton menerbitkan Principia.',
      derivationLatex: [
        'm_1 v_1 + m_2 v_2 = m_1 v_1\' + m_2 v_2\'',
        'e = -\\frac{v_2\' - v_1\'}{v_2 - v_1}',
        'v_1\' = \\frac{(m_1 - e m_2)v_1 + (1+e)m_2 v_2}{m_1 + m_2}',
      ],
      advancedConcept:
        'Dalam kerangka pusat massa (Center of Mass Frame), tumbukan lenting sempurna hanya membalikkan arah kecepatan relatif tanpa mengubah kelajuannya.',
    },
    extraPreLabQuestions: [
      {
        id: 'coll-q2',
        question: 'Sebuah bola menumbuk bola lain yang massanya sama dan sedang diam secara lenting sempurna (e = 1) satu dimensi. Apa yang terjadi sesudah tumbukan?',
        options: [
          'Bola pertama berhenti total dan bola kedua melaju dengan kecepatan awal bola pertama',
          'Kedua bola bergerak bersama dengan setengah kecepatan awal',
          'Bola pertama memantul balik dengan kecepatan sama dan bola kedua tetap diam',
          'Kedua bola berhenti total karena momentum saling meniadakan',
        ],
        correctIndex: 0,
        explanation:
          'Pada tumbukan lenting sempurna satu dimensi bermassa identik (m₁ = m₂, e = 1), kedua benda bertukar kecepatan secara sempurna seperti pada Newton Cradle.',
      },
    ],
  },

  'stokes-viscosity': {
    keyTakeaways: [
      'Bola yang jatuh di fluida kental awalnya dipercepat lalu mencapai kecepatan terminal konstan saat gaya berat = gaya apung + gaya Stokes.',
      'Kecepatan terminal berbanding lurus dengan kuadrat jari-jari bola (vₜ ∝ r²) dan berbanding terbalik dengan viskositas fluida (η).',
      'Hukum Stokes Fₛ = 6π·η·r·v berlaku presisi pada rezim aliran laminar dengan Bilangan Reynolds Re < 1.',
    ],
    everydayAnalogy: {
      title: 'Menjatuhkan Kelereng ke Dalam Madu vs Air',
      scenario:
        'Kelereng yang dijatuhkan ke dalam stoples madu turun jauh lebih pelan dibandingkan di air, dan kelereng besar meluncur lebih cepat daripada butiran kecil.',
      connection:
        'Madu memiliki viskositas η jauh lebih tinggi daripada air, sementara kelereng besar menang pada rasio volume berat (∝ r³) dibanding hambatan gesek (∝ r), sehingga vₜ ∝ r².',
    },
    formulaBreakdown: [
      { symbol: 'r', name: 'Jari-jari bola uji', unit: 'mm', role: 'bebas', explanation: 'Memengaruhi gaya berat (∝ r³) lebih cepat daripada hambatan (∝ r).' },
      { symbol: 'η', name: 'Viskositas dinamik fluida', unit: 'Pa·s', role: 'bebas', explanation: 'Tingkat kekentalan gesekan internal antar lapisan fluida.' },
      { symbol: 'ρₛ, ρₗ', name: 'Massa jenis bola & fluida', unit: 'kg/m³', role: 'bebas', explanation: 'Selisih (ρₛ − ρₗ) menentukan gaya dorong gravitasi efektif.' },
      { symbol: 'vₜ', name: 'Kecepatan terminal', unit: 'm/s', role: 'terikat', explanation: 'Kecepatan jatuh konstan saat resultan gaya menjadi nol.' },
    ],
    workedExample: {
      question:
        'Kelereng baja berjari-jari r = 3 mm (0,003 m) dengan ρₛ = 7800 kg/m³ dijatuhkan dalam gliserin (ρₗ = 1260 kg/m³, η = 0,95 Pa·s, g = 9,81 m/s²). Hitung kecepatan terminalnya!',
      given: ['r = 3 × 10⁻³ m', 'ρₛ − ρₗ = 6540 kg/m³', 'η = 0,95 Pa·s', 'g = 9,81 m/s²'],
      steps: [
        'Gunakan rumus kecepatan terminal Stokes: vₜ = (2·r²·g·(ρₛ − ρₗ)) / (9·η).',
        'Hitung pembilang: 2 × (9 × 10⁻⁶) × 9,81 × 6540 = 1,1548.',
        'Hitung penyebut: 9 × 0,95 = 8,55.',
        'Bagi hasilnya: vₜ = 1,1548 / 8,55 ≈ 0,135 m/s (13,5 cm/s).',
      ],
      answer: 'vₜ ≈ 0,135 m/s',
      physicalMeaning:
        'Jika jari-jari bola digandakan menjadi 6 mm, kecepatan terminal melonjak 4 kali lipat menjadi ~0,54 m/s karena bergantung pada r².',
    },
    glossary: [
      { term: 'Viskositas (η)', definition: 'Hambatan fluida terhadap deformasi geser; makin kental fluida makin besar nilai η.' },
      { term: 'Kecepatan Terminal', definition: 'Kelajuan maksimum konstan benda jatuh saat resultan gaya penggerak dan hambat seimbang.' },
      { term: 'Gaya Apung Archimedes', definition: 'Gaya ke atas sebesar berat fluida yang dipindahkan oleh volume benda.' },
      { term: 'Aliran Laminar', definition: 'Aliran fluida halus berlapis sejajar tanpa pusaran turbulen (Re rendah).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Sir George Gabriel Stokes menurunkan hukum gaya seret bola dalam fluida kental pada tahun 1851; rumus ini kemudian menjadi kunci Robert Millikan mengukur muatan elektron melalui percobaan tetes minyak (1909).',
      derivationLatex: [
        'W = F_A + F_s \\implies \\frac{4}{3}\\pi r^3 \\rho_s g = \\frac{4}{3}\\pi r^3 \\rho_f g + 6\\pi \\eta r v_t',
        'v_t = \\frac{2 r^2 g (\\rho_s - \\rho_f)}{9 \\eta}',
        '\\text{Re} = \\frac{2 \\rho_f v_t r}{\\eta} < 1',
      ],
      advancedConcept:
        'Untuk tabung sempit, dinding kaca menambah hambatan ekstra yang dikoreksi lewat faktor Ladenburg: vₜ koreksi = vₜ · (1 + 2,4·r/R tabung).',
    },
    extraPreLabQuestions: [
      {
        id: 'stokes-q2',
        question: 'Dua kelereng dari bahan sama dijatuhkan ke gliserin. Kelereng B berjari-jari 2 kali jari-jari kelereng A. Bagaimana perbandingan kecepatan terminalnya?',
        options: [
          'Kecepatan terminal kelereng B 4 kali lebih besar dari A',
          'Kecepatan terminal kelereng B 2 kali lebih besar dari A',
          'Keduanya memiliki kecepatan terminal yang sama',
          'Kecepatan terminal kelereng B setengah dari A',
        ],
        correctIndex: 0,
        explanation:
          'Berdasarkan vₜ = 2r²g(ρₛ − ρₗ)/(9η), kecepatan terminal sebanding dengan kuadrat jari-jari (r²), sehingga 2² = 4 kali lebih cepat.',
      },
    ],
  },

  'ohm-wheatstone': {
    keyTakeaways: [
      'Hukum Ohm V = I·R menghubungkan tegangan, arus, dan hambatan pada konduktor ohmik bersuhu konstan.',
      'Jembatan Wheatstone seimbang ketika beda potensial galvanometer Vg = 0, memenuhi perbandingan silang R₁·Rₓ = R₂·R₃.',
      'Metode kesetimbangan nol (null method) sangat akurat karena tidak terganggu oleh hambatan dalam sumber tegangan saat seimbang.',
    ],
    everydayAnalogy: {
      title: 'Timbangan Dua Lengan yang Seimbang Sempurna',
      scenario:
        'Saat menimbang emas di timbangan dua lengan, jarum penunjuk tepat di angka nol ketika momen berat kiri dan kanan sama persis.',
      connection:
        'Galvanometer berperan sebagai jarum timbangan nol: ketika rasio tegangan cabang kiri (R₁/R₂) sama dengan cabang kanan (R₃/Rₓ), arus penyeberangan berhenti tepat di nol.',
    },
    formulaBreakdown: [
      { symbol: 'Vₛ', name: 'Tegangan sumber DC', unit: 'V', role: 'bebas', explanation: 'Menyuplai beda potensial ke kedua cabang paralel jembatan.' },
      { symbol: 'R₁, R₂', name: 'Resistor rasio tetap', unit: 'Ω', role: 'bebas', explanation: 'Menentukan pembagi tegangan cabang referensi.' },
      { symbol: 'R₃', name: 'Resistor variabel kalibrasi', unit: 'Ω', role: 'bebas', explanation: 'Diatur hingga jarum galvanometer menunjukkan 0 mV.' },
      { symbol: 'Rₓ', name: 'Resistor uji tak diketahui', unit: 'Ω', role: 'terikat', explanation: 'Dihitung presisi lewat Rₓ = R₃·(R₂/R₁) saat Vg = 0.' },
    ],
    workedExample: {
      question:
        'Pada rangkaian jembatan Wheatstone dengan R₁ = 100 Ω dan R₂ = 200 Ω, galvanometer menunjukkan nol tepat ketika resistor variabel R₃ diatur ke 110 Ω. Berapakah hambatan Rₓ?',
      given: ['R₁ = 100 Ω', 'R₂ = 200 Ω', 'R₃ = 110 Ω', 'Vg = 0 V (seimbang)'],
      steps: [
        'Terapkan syarat keseimbangan jembatan Wheatstone: R₁ / R₂ = R₃ / Rₓ (atau Rₓ = R₃ × R₂ / R₁).',
        'Substitusi nilai: Rₓ = 110 × (200 / 100).',
        'Hitung hasil akhir: Rₓ = 110 × 2 = 220 Ω.',
      ],
      answer: 'Rₓ = 220 Ω',
      physicalMeaning:
        'Perhatikan bahwa nilai sumber tegangan Vₛ tidak mengubah titik keseimbangan, sehingga fluktuasi baterai tidak merusak akurasi pengukuran.',
    },
    glossary: [
      { term: 'Galvanometer', definition: 'Alat ukur arus listrik sangat kecil yang peka terhadap arah simpangan (nol di tengah).' },
      { term: 'Pembagi Tegangan', definition: 'Dua resistor seri yang membagi tegangan sumber sebanding dengan nilai hambatannya.' },
      { term: 'Metode Nol (Null)', definition: 'Teknik pengukuran dengan menyeimbangkan rangkaian hingga sinyal detektor bernilai nol.' },
      { term: 'Hukum Kirchhoff', definition: 'Prinsip kekekalan muatan pada simpul (ΣI = 0) dan energi pada loop tertutup (ΣV = 0).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Diciptakan oleh Samuel Hunter Christie (1833) dan dipopulerkan oleh Sir Charles Wheatstone (1843) sebagai standar metrologi hambatan listrik sebelum era multimeter digital.',
      derivationLatex: [
        'V_A = V_s \\frac{R_2}{R_1 + R_2}, \\quad V_B = V_s \\frac{R_x}{R_3 + R_x}',
        'V_G = V_A - V_B = 0 \\implies \\frac{R_2}{R_1 + R_2} = \\frac{R_x}{R_3 + R_x}',
        'R_x = R_3 \\frac{R_2}{R_1}',
      ],
      advancedConcept:
        'Ketika salah satu lengan diganti strain gauge (sensor regangan), perubahan kecil ΔR/R sebesar 0,01% langsung terbaca sebagai tegangan jembatan Vg proporsional.',
    },
    extraPreLabQuestions: [
      {
        id: 'ohm-q2',
        question: 'Jika jembatan Wheatstone sudah seimbang (Vg = 0) lalu tegangan baterai dinaikkan dari 6 V menjadi 12 V, apa yang terjadi pada keseimbangan jembatan?',
        options: [
          'Tetap seimbang (Vg tetap 0 V) karena titik seimbang hanya bergantung pada rasio resistor',
          'Menjadi tidak seimbang karena arus cabang kanan membesar dua kali',
          'Nilai Rₓ terukur ikut berubah dua kali lipat',
          'Galvanometer menyimpang ke arah berlawanan',
        ],
        correctIndex: 0,
        explanation:
          'Tegangan sumber Vₛ muncul sebagai pengali yang sama di kedua simpul A dan B; jika rasio resistor sudah seimbang, V(A) − V(B) tetap nol untuk tegangan sumber berapa pun.',
      },
    ],
  },

  'optics-young-slit': {
    keyTakeaways: [
      'Pola pita terang-gelap celah ganda membuktikan sifat gelombang cahaya melalui superposisi dan interferensi.',
      'Jarak antar pita terang berurutan memenuhi Δy = (λ·L)/d: makin besar panjang gelombang λ atau jarak layar L, pita makin lebar.',
      'Memperbesar jarak antar celah d justru membuat pita terang saling merapat (Δy ∝ 1/d).',
    ],
    everydayAnalogy: {
      title: 'Riak Dua Batu yang Dijatuhkan Bersamaan di Kolam',
      scenario:
        'Jika dua batu dijatuhkan serentak ke kolam tenang, riak melingkar bertemu membentuk puncak air ekstra tinggi di satu garis dan permukaan tenang di garis sebelahnya.',
      connection:
        'Puncak bertemu puncak analog dengan pita terang (interferensi konstruktif), sedangkan puncak bertemu lembah analog dengan pita gelap (interferensi destruktif).',
    },
    formulaBreakdown: [
      { symbol: 'λ', name: 'Panjang gelombang laser', unit: 'nm', role: 'bebas', explanation: 'Menentukan warna cahaya (merah ~650 nm, hijau ~532 nm, biru ~450 nm).' },
      { symbol: 'd', name: 'Jarak antar dua celah', unit: 'mm', role: 'bebas', explanation: 'Pemisah sumber koheren; makin kecil d, lenturan pita makin melebar.' },
      { symbol: 'L', name: 'Jarak celah ke layar', unit: 'm', role: 'bebas', explanation: 'Memperbesar proyeksi pola interferensi secara linear.' },
      { symbol: 'Δy', name: 'Jarak antar pita terang', unit: 'mm', role: 'terikat', explanation: 'Spasi seragam antara dua pusat garis terang bersebelahan.' },
    ],
    workedExample: {
      question:
        'Laser hijau (λ = 532 nm) menyinari celah ganda berjarak d = 0,20 mm menuju layar sejauh L = 1,5 m. Hitung jarak antar dua pita terang berurutan Δy!',
      given: ['λ = 532 nm = 5,32 × 10⁻⁷ m', 'd = 0,20 mm = 2,0 × 10⁻⁴ m', 'L = 1,5 m'],
      steps: [
        'Gunakan rumus spasi pita interferensi: Δy = (λ·L) / d.',
        'Substitusi dalam satuan SI: Δy = (5,32 × 10⁻⁷ × 1,5) / (2,0 × 10⁻⁴).',
        'Hitung hasil: Δy = (7,98 × 10⁻⁷) / (2,0 × 10⁻⁴) = 3,99 × 10⁻³ m = 3,99 mm.',
      ],
      answer: 'Δy ≈ 3,99 mm',
      physicalMeaning:
        'Dengan mengganti laser ke merah (650 nm), jarak antar pita melebar ke ~4,88 mm karena panjang gelombang cahaya merah lebih besar.',
    },
    glossary: [
      { term: 'Koheren', definition: 'Dua sumber gelombang yang memiliki frekuensi sama dan beda fase tetap.' },
      { term: 'Interferensi Konstruktif', definition: 'Penguatan gelombang saat beda lintasan kelipatan bulat panjang gelombang (m·λ).' },
      { term: 'Interferensi Destruktif', definition: 'Saling meniadakan saat beda lintasan kelipatan ganjil setengah panjang gelombang.' },
      { term: 'Difraksi', definition: 'Pelenturan muka gelombang ketika melewati celah sempit seorde panjang gelombang.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Thomas Young mempresentasikan eksperimen celah gandanya di hadapan Royal Society tahun 1801, mengguncang teori partikel cahaya Newton yang telah dominan selama seabad.',
      derivationLatex: [
        '\\Delta r = d \\sin\\theta \\approx d \\frac{y}{L}',
        'd \\frac{y_m}{L} = m\\lambda \\implies y_m = \\frac{m\\lambda L}{d}',
        '\\Delta y = y_{m+1} - y_m = \\frac{\\lambda L}{d}',
      ],
      advancedConcept:
        'Pada celah nyata berlebar a, pola interferensi termodulasi oleh selubung difraksi celah tunggal: I(θ) = I₀·cos²(β)·(sin α / α)².',
    },
    extraPreLabQuestions: [
      {
        id: 'young-q2',
        question: 'Jika sumber cahaya diganti dari laser merah (650 nm) menjadi laser biru (450 nm) tanpa mengubah celah maupun layar, apa yang terjadi pada pola pita terang?',
        options: [
          'Jarak antar pita terang Δy menyempit (makin rapat)',
          'Jarak antar pita terang Δy melebar',
          'Pola interferensi hilang total',
          'Jarak antar pita tetap tidak berubah',
        ],
        correctIndex: 0,
        explanation:
          'Karena Δy = λ·L/d sebanding langsung dengan λ, panjang gelombang biru yang lebih pendek menghasilkan jarak antar pita yang lebih rapat.',
      },
    ],
  },

  'photoelectric-planck': {
    keyTakeaways: [
      'Cahaya terdiri atas paket energi diskrit (foton) dengan energi E = h·f = h·c/λ.',
      'Elektron hanya terlepas jika energi foton melampaui fungsi kerja logam (E > W₀); di bawah ambang tersebut, intensitas sekuat apa pun menghasilkan arus nol.',
      'Energi kinetik maksimum elektron Eₖ maks = h·f − W₀ dan potensial henti V₀ = Eₖ maks / e hanya bergantung pada frekuensi foton dan jenis logam.',
    ],
    everydayAnalogy: {
      title: 'Mesin Penjual Minuman yang Membutuhkan Koin Pecahan Pas',
      scenario:
        'Bayangkan mesin tiket yang hanya menerima satu koin bernilai minimal Rp2.000; melemparkan seratus koin Rp500 sekaligus tetap tidak membuka gerbang.',
      connection:
        'Satu foton berinteraksi dengan satu elektron sekaligus: intensitas cahaya hanyalah jumlah "koin", sedangkan frekuensi f adalah nilai per koin yang harus melampaui harga minimal W₀.',
    },
    formulaBreakdown: [
      { symbol: 'λ', name: 'Panjang gelombang cahaya', unit: 'nm', role: 'bebas', explanation: 'Makin pendek λ, makin tinggi frekuensi f dan energi per foton.' },
      { symbol: 'W₀', name: 'Fungsi kerja logam katoda', unit: 'eV', role: 'bebas', explanation: 'Energi ikat minimum untuk melepaskan elektron dari permukaan logam.' },
      { symbol: 'I', name: 'Intensitas cahaya', unit: '%', role: 'bebas', explanation: 'Mengatur jumlah foton per detik (kuat arus foto), bukan Eₖ maks.' },
      { symbol: 'V₀', name: 'Potensial henti', unit: 'V', role: 'terikat', explanation: 'Tegangan balik minimum untuk menghentikan elektron foto tercepat.' },
    ],
    workedExample: {
      question:
        'Katoda Cesium (W₀ = 2,14 eV) disinari cahaya ungu berpanjang gelombang λ = 400 nm. Gunakan h·c ≈ 1240 eV·nm. Hitung energi foton, energi kinetik maksimum elektron, dan potensial hentinya!',
      given: ['W₀ = 2,14 eV', 'λ = 400 nm', 'h·c = 1240 eV·nm'],
      steps: [
        'Hitung energi satu foton: E = h·c / λ = 1240 / 400 = 3,10 eV.',
        'Bandingkan dengan fungsi kerja: 3,10 eV > 2,14 eV, sehingga elektron terlepas.',
        'Hitung energi kinetik maksimum: Eₖ maks = E − W₀ = 3,10 − 2,14 = 0,96 eV.',
        'Konversi ke potensial henti: V₀ = Eₖ maks / e = 0,96 Volt.',
      ],
      answer: 'E = 3,10 eV; Eₖ maks = 0,96 eV; V₀ = 0,96 V',
      physicalMeaning:
        'Menambah kecerahan lampu 400 nm dua kali lipat akan menggandakan jumlah elektron lepas (arus foto), tetapi V₀ tetap persis 0,96 V.',
    },
    glossary: [
      { term: 'Foton', definition: 'Kuantum energi radiasi elektromagnetik tanpa massa diam dengan energi E = h·f.' },
      { term: 'Fungsi Kerja (W₀)', definition: 'Energi minimum yang dibutuhkan elektron untuk keluar dari permukaan logam.' },
      { term: 'Potensial Henti (V₀)', definition: 'Tegangan penghambat yang tepat menghentikan elektron foto berenergi kinetik maksimum.' },
      { term: 'Konstanta Planck (h)', definition: 'Konstanta fundamental fisika kuantum sebesar 6,626 × 10⁻³⁴ J·s.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Albert Einstein menjelaskan efek fotolistrik pada tahun 1905 dengan hipotesis kuanta cahaya, penemuan revolusioner yang mengantarkannya meraih Hadiah Nobel Fisika 1921.',
      derivationLatex: [
        'E_{\\text{foton}} = h f = \\frac{h c}{\\lambda}',
        'K_{\\max} = h f - W_0 = e V_0',
        'V_0 = \\frac{h}{e} f - \\frac{W_0}{e}',
      ],
      advancedConcept:
        'Grafik linear V₀ terhadap f memiliki kemiringan konstan h/e untuk segala jenis logam, sedangkan titik potong sumbu mendatarnya menunjukkan frekuensi ambang unik tiap unsur.',
    },
    extraPreLabQuestions: [
      {
        id: 'photo-q2',
        question: 'Logam Natrium memiliki fungsi kerja W₀ = 2,28 eV. Cahaya merah (E foton = 1,90 eV) dengan intensitas sangat terang diarahkan ke logam tersebut. Apa yang teramati?',
        options: [
          'Tidak ada elektron yang lepas dan arus foto bernilai nol',
          'Elektron lepas setelah logam menyerap cahaya cukup lama',
          'Elektron lepas dengan energi kinetik 0,38 eV',
          'Potensial henti meningkat seiring kecerahan lampu',
        ],
        correctIndex: 0,
        explanation:
          'Karena energi tiap foton (1,90 eV) lebih kecil daripada fungsi kerja logam (2,28 eV), efek fotolistrik tidak dapat terjadi berapa pun besarnya intensitas cahaya.',
      },
    ],
  },

  'gravity-orbital': {
    keyTakeaways: [
      'Gaya gravitasi Newton F = G·M·m/r² menarik dua massa secara saling berlawanan dan melemah mengikuti hukum kuadrat terbalik.',
      'Kecepatan orbit lingkaran v orbit = √(G·M/r) menjaga satelit "jatuh mengelilingi" planet tanpa pernah menghantam permukaan.',
      'Kecepatan lepas v lepas = √(2·G·M/R) selalu tepat √2 (≈ 1,414) kali kecepatan orbit lingkaran di radius yang sama.',
    ],
    everydayAnalogy: {
      title: 'Meriam Newton di Puncak Gunung Sangat Tinggi',
      scenario:
        'Jika peluru ditembakkan horizontal makin cepat dari puncak gunung, titik jatuhnya makin jauh hingga kelengkungan jatuhnya menyamai kelengkungan Bumi.',
      connection:
        'Ketika kelengkungan lintasan menyamai jari-jari Bumi, peluru tidak pernah mendarat — itulah mekanisme satelit mengorbit secara jatuh bebas abadi.',
    },
    formulaBreakdown: [
      { symbol: 'M', name: 'Massa benda sentral (planet)', unit: '×10²⁴ kg', role: 'bebas', explanation: 'Sumber utama medan gravitasi pengikat orbit.' },
      { symbol: 'r', name: 'Jarak orbit dari pusat planet', unit: 'km', role: 'bebas', explanation: 'Makin jauh dari pusat, gaya gravitasi dan kecepatan orbit menurun.' },
      { symbol: 'v orbit', name: 'Kecepatan orbit lingkaran', unit: 'km/s', role: 'terikat', explanation: 'Kelajuan pas agar percepatan sentripetal = percepatan gravitasi.' },
      { symbol: 'v lepas', name: 'Kecepatan lepas gravitasi', unit: 'km/s', role: 'terikat', explanation: 'Kelajuan minimum meninggalkan sumur gravitasi planet ke tak hingga.' },
    ],
    workedExample: {
      question:
        'Bumi memiliki massa M = 5,97 × 10²⁴ kg dan radius R = 6,37 × 10⁶ m (G = 6,674 × 10⁻¹¹ N·m²/kg²). Hitung kecepatan orbit lingkaran dekat permukaan dan kecepatan lepas Bumi!',
      given: ['M = 5,97 × 10²⁴ kg', 'R = 6,37 × 10⁶ m', 'G = 6,674 × 10⁻¹¹ N·m²/kg²'],
      steps: [
        'Hitung G·M = 6,674 × 10⁻¹¹ × 5,97 × 10²⁴ = 3,984 × 10¹⁴ m³/s².',
        'Hitung kecepatan orbit: v orbit = √(G·M / R) = √(3,984 × 10¹⁴ / 6,37 × 10⁶) = √(6,255 × 10⁷) ≈ 7909 m/s ≈ 7,91 km/s.',
        'Hitung kecepatan lepas: v lepas = √2 × v orbit = 1,414 × 7,91 ≈ 11,18 km/s.',
      ],
      answer: 'v orbit ≈ 7,91 km/s dan v lepas ≈ 11,18 km/s',
      physicalMeaning:
        'Wahana menuju Mars atau Bulan harus menembus 11,18 km/s (atau melakukan manuver transfer bertahap) agar terbebas dari ikatan gravitasi Bumi.',
    },
    glossary: [
      { term: 'Kecepatan Lepas', definition: 'Kecepatan awal minimum benda agar energi mekanik totalnya mencapai nol dan bebas dari gravitasi planet.' },
      { term: 'Hukum Kuadrat Terbalik', definition: 'Hubungan di mana kuat medan turun menjadi seperempatnya ketika jarak digandakan.' },
      { term: 'Gaya Sentripetal', definition: 'Gaya menuju pusat lengkungan yang membelokkan arah kecepatan satelit agar tetap di orbit.' },
      { term: 'Konstanta Gravitasi (G)', definition: 'Tetapan universal kekuatan interaksi gravitasi sebesar 6,674 × 10⁻¹¹ N·m²/kg².' },
    ],
    deepDiveContent: {
      historicalContext:
        'Isaac Newton merumuskan Gravitasi Universal (1687), namun nilai tetapan G baru berhasil diukur presisi di laboratorium satu abad kemudian oleh Henry Cavendish (1798) menggunakan neraca puntir.',
      derivationLatex: [
        'F_g = \\frac{G M m}{r^2} = \\frac{m v_{\\text{orbit}}^2}{r} \\implies v_{\\text{orbit}} = \\sqrt{\\frac{G M}{r}}',
        '\\frac{1}{2} m v_{\\text{lepas}}^2 - \\frac{G M m}{R} = 0 \\implies v_{\\text{lepas}} = \\sqrt{\\frac{2 G M}{R}}',
      ],
      advancedConcept:
        'Energi mekanik total orbit terikat selalu bernilai negatif (E = −GMm / 2a); jika E = 0 lintasan berbentuk parabola lepas, dan jika E > 0 berbentuk hiperbola.',
    },
    extraPreLabQuestions: [
      {
        id: 'grav-q2',
        question: 'Jika sebuah satelit dinaikkan ke orbit lingkaran dengan jari-jari 4 kali lebih besar dari orbit sebelumnya, bagaimana kecepatan orbitnya berubah?',
        options: [
          'Berkurang menjadi setengah kecepatan semula',
          'Berkurang menjadi seperempat kecepatan semula',
          'Meningkat menjadi dua kali kecepatan semula',
          'Tetap sama karena massa Bumi tidak berubah',
        ],
        correctIndex: 0,
        explanation:
          'Dari v orbit = √(GM/r), memperbesar r menjadi 4r membagi kecepatan dengan √4 = 2, sehingga satelit di orbit tinggi melaju lebih lambat.',
      },
    ],
  },

  'standing-wave-melde': {
    keyTakeaways: [
      'Cepat rambat gelombang transversal pada dawai berbanding lurus dengan akar gaya tegangan F dan berbanding terbalik dengan akar rapat massa linier μ: v = √(F / μ).',
      'Gelombang berdiri terbentuk dari superposisi gelombang datang dan gelombang pantul yang menghasilkan titik simpul (amplitudo nol) dan titik perut (amplitudo maksimum).',
      'Resonansi harmonik ke-n terjadi ketika panjang dawai L memuat tepat n setengah panjang gelombang: L = n·(λ / 2) sehingga fₙ = n·v / (2L).',
    ],
    everydayAnalogy: {
      title: 'Menyetem Senar Gitar Akustik',
      scenario:
        'Saat memutar pasak penala gitar untuk mengencangkan senar, nada yang dihasilkan terdengar makin tinggi; sedangkan senar bas yang tebal menghasilkan nada lebih berat dibanding senar tipis.',
      connection:
        'Mengencangkan pasak memperbesar gaya tegangan F sehingga cepat rambat v dan frekuensi fₙ naik; senar bas yang tebal memiliki rapat massa linier μ besar sehingga cepat rambatnya lebih rendah.',
    },
    formulaBreakdown: [
      { symbol: 'F', name: 'Gaya tegangan dawai', unit: 'N', role: 'bebas', explanation: 'Dihasilkan oleh berat beban gantung F = m·g yang menarik dawai melewati katrol.' },
      { symbol: 'μ', name: 'Rapat massa linier dawai', unit: 'kg/m', role: 'bebas', explanation: 'Massa dawai per satuan panjang (μ = m dawai / L).' },
      { symbol: 'v', name: 'Cepat rambat gelombang', unit: 'm/s', role: 'terikat', explanation: 'Kelajuan rambat gangguan transversal sepanjang dawai: v = √(F / μ).' },
      { symbol: 'λ', name: 'Panjang gelombang', unit: 'm', role: 'terikat', explanation: 'Jarak dua perut ditambah dua simpul berurutan (1 gelombang penuh = 2 loop perut).' },
    ],
    workedExample: {
      question:
        'Seutas dawai sepanjang L = 1,2 m dengan rapat massa linier μ = 0,005 kg/m diberi beban gantung menghasilkan tegangan F = 20 N dan digetarkan oleh vibrator f = 50 Hz. Hitung cepat rambat v, panjang gelombang λ, dan jumlah perut harmonik n!',
      given: ['L = 1,2 m', 'μ = 0,005 kg/m', 'F = 20 N', 'f = 50 Hz'],
      steps: [
        'Hitung cepat rambat gelombang: v = √(F / μ) = √(20 / 0,005) = √4000 ≈ 63,25 m/s.',
        'Hitung panjang gelombang: λ = v / f = 63,25 / 50 ≈ 1,265 m.',
        'Hitung jumlah perut harmonik: n = 2L / λ = (2 × 1,2) / 1,265 ≈ 1,90 loop (mendekati harmonik kedua n = 2).',
      ],
      answer: 'v ≈ 63,25 m/s; λ ≈ 1,265 m; n ≈ 1,90 loop',
      physicalMeaning:
        'Jika tegangan dawai disetel sedikit ke F = 18 N (v = 60 m/s, λ = 1,20 m), dawai tepat membentuk resonansi harmonik kedua dengan 2 perut dan 3 simpul tajam.',
    },
    glossary: [
      { term: 'Simpul (Node)', definition: 'Titik pada gelombang berdiri yang selalu diam (amplitudo simpangan nol) akibat interferensi destruktif.' },
      { term: 'Perut (Antinode)', definition: 'Titik pada gelombang berdiri yang bergetar dengan amplitudo maksimum akibat interferensi konstruktif.' },
      { term: 'Rapat Massa Linier (μ)', definition: 'Ukuran kelembaman dawai per satuan panjang dalam satuan kg/m atau g/cm.' },
      { term: 'Harmonik Ke-n', definition: 'Modus getaran resonansi stasioner dengan n buah perut gelombang di sepanjang dawai.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Franz Emil Melde (1860) merancang eksperimen garputala dan dawai berbeban di Universitas Marburg untuk memvisualisasikan gelombang stasioner dan membuktikan rumus kecepatan gelombang dawai Brook Taylor.',
      derivationLatex: [
        'v = \\sqrt{\\frac{F}{\\mu}}, \\quad y(x,t) = 2A \\sin(kx) \\cos(\\omega t)',
        'k L = n \\pi \\implies \\lambda_n = \\frac{2L}{n}, \\quad f_n = \\frac{n}{2L}\\sqrt{\\frac{F}{\\mu}}',
      ],
      advancedConcept:
        'Pada instrumen musik berdawai, warna bunyi (timbre) ditentukan oleh superposisi nada dasar (n = 1) bersama deret harmonik atasnya (n = 2, 3, 4, ...) yang berosilasi serentak.',
    },
  },

  'faraday-induction': {
    keyTakeaways: [
      'Gaya gerak listrik (GGL) induksi muncul hanya ketika terjadi perubahan fluks magnetik terhadap waktu: ε = −N·(dΦ/dt).',
      'Untuk magnet yang berosilasi harmonik berfrekuensi f menembus kumparan berpenampang A dengan N lilitan, GGL puncaknya memenuhi εₘₐₓ = N·B·A·(2πf).',
      'Hukum Lenz menyatakan arus induksi selalu menghasilkan medan magnet yang melawan perubahan fluks magnetik penyebabnya.',
    ],
    everydayAnalogy: {
      title: 'Dinamo Sepeda yang Menerangkan Lampu Saat Kayuhan Cepat',
      scenario:
        'Saat Anda mengayuh sepeda lebih cepat di malam hari, roda kecil dinamo berputar lebih kencang sehingga lampu depan sepeda menyala jauh lebih terang, lalu meredup dan padam saat sepeda berhenti.',
      connection:
        'Putaran cepat menaikkan frekuensi perubahan fluks magnetik f sehingga GGL induksi εₘₐₓ = N·B·A·(2πf) membesar; ketika kayuhan berhenti (f = 0), perubahan fluks nol dan lampu langsung padam.',
    },
    formulaBreakdown: [
      { symbol: 'N', name: 'Jumlah lilitan kumparan', unit: 'lilitan', role: 'bebas', explanation: 'Tiap lilitan menyumbang tegangan induksi secara seri sehingga total GGL berbanding lurus dengan N.' },
      { symbol: 'B', name: 'Kuat medan magnetik', unit: 'T', role: 'bebas', explanation: 'Kerapatan garis gaya magnet permanen yang menembus luas penampang kumparan.' },
      { symbol: 'f', name: 'Frekuensi osilasi magnet', unit: 'Hz', role: 'bebas', explanation: 'Menentukan laju perubahan fluks sudut ω = 2πf yang langsung melipatgandakan εₘₐₓ.' },
      { symbol: 'εₘₐₓ', name: 'GGL induksi puncak', unit: 'V', role: 'terikat', explanation: 'Tegangan maksimum sinusoidal yang terbaca pada osiloskop dan menyuplai arus beban Iₘₐₓ = εₘₐₓ/R.' },
    ],
    workedExample: {
      question:
        'Sebuah kumparan memiliki N = 100 lilitan dengan luas penampang A = 20 cm² (0,002 m²). Magnet batang berosilasi di dalamnya pada frekuensi f = 2,0 Hz dengan puncak medan B = 0,50 T. Hitung fluks maksimum Φₘₐₓ dan GGL induksi puncak εₘₐₓ!',
      given: ['N = 100 lilitan', 'A = 20 cm² = 0,002 m²', 'B = 0,50 T', 'f = 2,0 Hz'],
      steps: [
        'Hitung fluks magnetik maksimum: Φₘₐₓ = B × A = 0,50 × 0,002 = 0,001 Wb = 1,00 mWb.',
        'Hitung frekuensi sudut osilasi: ω = 2πf = 2 × π × 2,0 ≈ 12,566 rad/s.',
        'Hitung GGL induksi puncak: εₘₐₓ = N × Φₘₐₓ × ω = 100 × 0,001 × 12,566 ≈ 1,257 V.',
      ],
      answer: 'Φₘₐₓ = 1,00 mWb dan εₘₐₓ ≈ 1,257 V',
      physicalMeaning:
        'Jika hambatan beban total R = 10 Ω, arus induksi bolak-balik mencapai puncak 125,7 mA dengan jarum galvanometer berayun simetris ke kiri dan ke kanan.',
    },
    glossary: [
      { term: 'Fluks Magnetik (Φ)', definition: 'Banyaknya garis medan magnet B yang menembus secara tegak lurus bidang seluas A (Φ = B·A·cos θ dalam Weber).' },
      { term: 'Hukum Faraday', definition: 'Hukum dasar elektromagnetisme yang menyatakan besar GGL induksi sebanding dengan laju perubahan fluks magnetik terhadap waktu.' },
      { term: 'Hukum Lenz', definition: 'Aturan kekekalan energi elektromagnetik bahwa arah arus induksi selalu menentang perubahan fluks magnetik yang menimbulkannya.' },
      { term: 'Galvanometer Nol-Tengah', definition: 'Instrumen pengukur arus lemah dua arah dengan posisi nol di tengah skala untuk mendeteksi polaritas arus bolak-balik.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Michael Faraday (1831) di Royal Institution London menemukan bahwa medan magnet dapat melahirkan arus listrik asalkan fluksnya berubah, lalu Heinrich Lenz (1834) merumuskan kaidah arah berlawanannya.',
      derivationLatex: [
        '\\Phi(t) = B A \\cos(2\\pi f t) \\implies \\varepsilon(t) = -N \\frac{d\\Phi}{dt} = N B A (2\\pi f) \\sin(2\\pi f t)',
        '\\varepsilon_{\\max} = N B A (2\\pi f), \\quad P_{\\text{avg}} = \\frac{1}{T}\\int_0^T \\frac{\\varepsilon^2(t)}{R}dt = \\frac{\\varepsilon_{\\max}^2}{2R}',
      ],
      advancedConcept:
        'Tanda minus dalam Hukum Faraday menjamin kekekalan energi: apabila arus induksi justru membantu mempercepat magnet, energi listrik gratis akan tercipta tanpa usaha mekanik.',
    },
  },
};


