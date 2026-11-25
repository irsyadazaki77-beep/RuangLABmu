import type { ModulePedagogyBundle } from './index';

export const CHEMISTRY_PEDAGOGY: Record<string, ModulePedagogyBundle> = {
  'thermo-calorimetry': {
    keyTakeaways: [
      'Hukum Kekekalan Energi pada kalorimeter terisolasi menyatakan kalor yang dilepas reaksi diserap oleh larutan: q reaksi = −q larutan = −m·c·ΔT.',
      'Reaksi eksotermik menaikkan suhu larutan (ΔT > 0) sehingga perubahan entalpi molar ΔH bertanda negatif (< 0).',
      'Entalpi netralisasi asam kuat dan basa kuat selalu mendekati −57,3 kJ/mol karena reaksi bersihnya sama: H⁺ + OH⁻ → H₂O.',
    ],
    everydayAnalogy: {
      title: 'Termos Air Panas & Kantung Penghangat Instan',
      scenario:
        'Wadah termos mencegah panas bocor ke udara luar sehingga perubahan suhu air di dalamnya mencerminkan seluruh panas yang masuk atau dilepas.',
      connection:
        'Kalorimeter bekerja seperti termos presisi: setiap Joule panas yang keluar dari reaksi kimia langsung terbaca sebagai kenaikan suhu ΔT pada termometer.',
    },
    formulaBreakdown: [
      { symbol: 'm', name: 'Massa total larutan', unit: 'g', role: 'bebas', explanation: 'Untuk larutan encer air, massa (g) ≈ volume total (mL) karena ρ ≈ 1 g/mL.' },
      { symbol: 'c', name: 'Kalor jenis larutan', unit: 'J/(g·°C)', role: 'konstanta', explanation: 'Energi untuk menaikkan 1 gram air sebesar 1°C, bernilai 4,184 J/(g·°C).' },
      { symbol: 'ΔT', name: 'Selisih suhu (T akhir − T awal)', unit: '°C', role: 'terikat', explanation: 'Positif pada eksotermik, negatif pada endotermik.' },
      { symbol: 'ΔH', name: 'Entalpi reaksi molar', unit: 'kJ/mol', role: 'terikat', explanation: 'Kalor reaksi dibagi jumlah mol pereaksi pembatas: ΔH = −q / n.' },
    ],
    workedExample: {
      question:
        '100 mL HCl 1,0 M dicampur dengan 100 mL NaOH 1,0 M dalam kalorimeter. Suhu naik dari 25,0°C menjadi 31,8°C. Hitung kalor larutan dan entalpi netralisasi molar ΔH (c = 4,184 J/g·°C, ρ = 1 g/mL)!',
      given: ['V total = 200 mL → m = 200 g', 'n HCl = n NaOH = 0,100 L × 1,0 M = 0,10 mol', 'ΔT = 31,8 − 25,0 = +6,8°C'],
      steps: [
        'Hitung kalor yang diserap larutan: q larutan = m·c·ΔT = 200 × 4,184 × 6,8 = 5690,2 J ≈ 5,69 kJ.',
        'Tentukan kalor reaksi: q reaksi = −q larutan = −5,69 kJ.',
        'Bagi dengan mol pereaksi pembatas (0,10 mol): ΔH = −5,69 / 0,10 = −56,9 kJ/mol.',
      ],
      answer: 'q larutan = 5,69 kJ dan ΔH ≈ −56,9 kJ/mol',
      physicalMeaning:
        'Nilai ΔH negatif mendekati teori −57,3 kJ/mol membuktikan pembentukan ikatan O−H pada air melepaskan energi besar ke lingkungan.',
    },
    glossary: [
      { term: 'Eksotermik', definition: 'Proses kimia yang melepaskan kalor dari sistem ke lingkungan (ΔH < 0).' },
      { term: 'Endotermik', definition: 'Proses kimia yang menyerap kalor dari lingkungan sehingga suhu larutan turun (ΔH > 0).' },
      { term: 'Entalpi (H)', definition: 'Kandungan energi termal sistem pada tekanan tetap.' },
      { term: 'Pereaksi Pembatas', definition: 'Zat yang habis bereaksi lebih dulu sehingga menentukan jumlah mol produk dan kalor total.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Antoine Lavoisier dan Pierre-Simon Laplace merancang kalorimeter es pertama pada tahun 1782 untuk membuktikan bahwa respirasi hewan adalah bentuk pembakaran lambat.',
      derivationLatex: [
        'q_{\\text{reaksi}} + q_{\\text{larutan}} + q_{\\text{kalorimeter}} = 0',
        'q_{\\text{reaksi}} = -(m c \\Delta T + C_{\\text{kal}} \\Delta T)',
        '\\Delta H = \\frac{q_{\\text{reaksi}}}{n_{\\text{pembatas}}}',
      ],
      advancedConcept:
        'Kalorimeter presisi tinggi memperhitungkan kapasitas kalor wadah (C kal) yang dikalibrasi terlebih dahulu melalui pemanas listrik atau reaksi standar.',
    },
    extraPreLabQuestions: [
      {
        id: 'thermo-q2',
        question: 'Jika volume larutan asam dan basa sama-sama digandakan (dari 100 mL menjadi 200 mL) dengan konsentrasi tetap 1,0 M, bagaimana perubahan kenaikan suhu ΔT?',
        options: [
          'ΔT relatif tetap sama karena kalor reaksi dan massa larutan sama-sama naik dua kali',
          'ΔT naik menjadi dua kali lipat',
          'ΔT turun menjadi setengahnya',
          'ΔH molar menjadi dua kali lebih negatif',
        ],
        correctIndex: 0,
        explanation:
          'Jumlah mol naik 2× sehingga kalor q naik 2×, tetapi massa larutan m yang dipanaskan juga naik 2×. Akibatnya ΔT = q/(m·c) tetap konstan.',
      },
    ],
  },

  'acid-base-titration': {
    keyTakeaways: [
      'Titrasi volumetri menentukan konsentrasi zat tak diketahui lewat kesetaraan stoikiometri mol asam dan basa: Mₐ·Vₐ·a = Mᵦ·Vᵦ·b.',
      'Kurva titrasi berbentuk huruf S (sigmoid) dengan lonjakan pH sangat curam di sekitar titik ekuivalen.',
      'Pemilihan indikator warna (seperti fenolftalein di pH 8,2–10) harus beririsan dengan daerah lonjakan tajam kurva pH.',
    ],
    everydayAnalogy: {
      title: 'Menetralkan Rasa Asam Kuah dengan Bumbu Basa Tetes Demi Tetes',
      scenario:
        'Saat menambahkan penetral setetes demi setetes, awalnya rasa asam berubah perlahan, lalu hanya dengan satu tetes terakhir rasa berubah drastis menjadi netral.',
      connection:
        'Karena skala pH bersifat logaritmik (faktor 10 per satuan), saat sisa ion H⁺ hampir nol, satu tetes NaOH saja langsung melompatkan pH dari 4 ke 10.',
    },
    formulaBreakdown: [
      { symbol: 'Mₐ, Vₐ', name: 'Molaritas & volume analit asam', unit: 'M, mL', role: 'bebas', explanation: 'Menentukan jumlah mol ion H⁺ awal di dalam labu Erlenmeyer.' },
      { symbol: 'Mᵦ, Vᵦ', name: 'Molaritas & volume titran basa', unit: 'M, mL', role: 'bebas', explanation: 'Larutan standar di dalam buret yang diteteskan terukur.' },
      { symbol: 'Vₑ', name: 'Volume titik ekuivalen', unit: 'mL', role: 'terikat', explanation: 'Volume titran tepat saat mol OH⁻ = mol H⁺.' },
      { symbol: 'pH', name: 'Derajat keasaman larutan', unit: '0–14', role: 'terikat', explanation: 'Didefinisikan sebagai −log₁₀[H⁺] pada suhu 25°C.' },
    ],
    workedExample: {
      question:
        'Sebanyak 25,0 mL larutan HCl yang belum diketahui molaritasnya tepat mencapai titik ekuivalen setelah dititrasi dengan 20,0 mL NaOH 0,25 M. Berapakah molaritas HCl tersebut?',
      given: ['Vₐ = 25,0 mL', 'Mᵦ = 0,25 M', 'Vᵦ = 20,0 mL', 'Valensi HCl = 1, NaOH = 1'],
      steps: [
        'Gunakan kesetaraan stoikiometri: Mₐ·Vₐ = Mᵦ·Vᵦ.',
        'Substitusi angka: Mₐ × 25,0 = 0,25 × 20,0 = 5,0 mmol.',
        'Hitung Mₐ = 5,0 / 25,0 = 0,20 M.',
      ],
      answer: 'Mₐ (konsentrasi HCl) = 0,20 M',
      physicalMeaning:
        'Jika titrasi dilanjutkan 1 mL lagi (21 mL), sisa OH⁻ berlebih membuat pH larutan langsung melonjak melewati 11 dan indikator fenolftalein menjadi merah muda.',
    },
    glossary: [
      { term: 'Analit', definition: 'Larutan di labu Erlenmeyer yang kadarnya hendak ditentukan.' },
      { term: 'Titran', definition: 'Larutan standar bervolume terukur yang diteteskan dari buret.' },
      { term: 'Titik Ekuivalen', definition: 'Kondisi stoikiometri ideal saat asam dan basa tepat habis bereaksi.' },
      { term: 'Titik Akhir', definition: 'Saat indikator berubah warna secara visual yang menandakan titrasi dihentikan.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Joseph Louis Gay-Lussac menciptakan buret skala volumetri pada tahun 1824 dan memperkenalkan istilah "titrasi" dari kata Prancis "titre" (kadar kemurnian).',
      derivationLatex: [
        'n_{H^+} = n_{OH^-} \\implies M_a V_a = M_b V_b',
        '\\text{pH} = -\\log_{10}[H^+], \\quad \\text{pH} + \\text{pOH} = 14',
      ],
      advancedConcept:
        'Pada titrasi asam lemah (mis. CH₃COOH) dengan NaOH, sebelum titik ekuivalen terbentuk daerah penyangga (buffer) yang mengikuti persamaan Henderson-Hasselbalch: pH = pKₐ + log([A⁻]/[HA]).',
    },
    extraPreLabQuestions: [
      {
        id: 'titr-q2',
        question: 'Untuk menetralkan 25 mL HCl 0,20 M menggunakan NaOH 0,25 M, berapa volume NaOH yang diperlukan hingga titik ekuivalen?',
        options: ['20,0 mL', '25,0 mL', '15,0 mL', '31,25 mL'],
        correctIndex: 0,
        explanation:
          'Mol HCl = 25 × 0,20 = 5,0 mmol. Volume NaOH = 5,0 mmol / 0,25 M = 20,0 mL.',
      },
    ],
  },

  'redox-electrochemistry': {
    keyTakeaways: [
      'Sel Volta mengubah energi reaksi redoks spontan menjadi energi listrik: oksidasi terjadi di Anoda (−), reduksi di Katoda (+).',
      'Jembatan garam menjaga kenetralan muatan ionik di kedua gelas reaksi sehingga arus listrik dapat mengalir kontinu.',
      'Persamaan Nernst E = E° − (0,0592/n)·log Q menjelaskan perubahan tegangan baterai saat konsentrasi ion berubah.',
    ],
    everydayAnalogy: {
      title: 'Air Terjun Listrik Antar Dua Logam Berbeda',
      scenario:
        'Seng (Zn) lebih rela melepaskan elektron dibanding Tembaga (Cu), seperti air di waduk tinggi yang otomatis mengalir ke waduk lebih rendah lewat turbin.',
      connection:
        'Beda ketinggian waduk adalah potensial sel E° = E° katoda − E° anoda (+1,10 V), dan aliran elektron melalui kabel eksternal memutar "turbin" voltmeter.',
    },
    formulaBreakdown: [
      { symbol: 'E°', name: 'Potensial sel standar', unit: 'V', role: 'konstanta', explanation: 'Selisih potensial reduksi standar katoda dan anoda pada 1 M, 25°C.' },
      { symbol: '[Zn²⁺]', name: 'Konsentrasi ion anoda', unit: 'M', role: 'bebas', explanation: 'Produk oksidasi; makin tinggi [Zn²⁺], tegangan sel sedikit turun.' },
      { symbol: '[Cu²⁺]', name: 'Konsentrasi ion katoda', unit: 'M', role: 'bebas', explanation: 'Reaktan reduksi; makin tinggi [Cu²⁺], gaya dorong tegangan meningkat.' },
      { symbol: 'E', name: 'Potensial sel terukur', unit: 'V', role: 'terikat', explanation: 'Tegangan aktual sel sesuai Persamaan Nernst.' },
    ],
    workedExample: {
      question:
        'Sel Daniell Zn|Zn²⁺(0,01 M) || Cu²⁺(1,0 M)|Cu bekerja pada 25°C dengan E° = 1,100 V dan n = 2 elektron. Hitung potensial sel aktual E!',
      given: ['E° = 1,100 V', 'n = 2', '[Zn²⁺] = 0,01 M', '[Cu²⁺] = 1,0 M'],
      steps: [
        'Hitung kuosien reaksi: Q = [Zn²⁺] / [Cu²⁺] = 0,01 / 1,0 = 10⁻².',
        'Hitung log₁₀(Q) = −2.',
        'Substitusi ke Nernst: E = 1,100 − (0,0592 / 2) × (−2) = 1,100 + 0,0592.',
        'Hasil akhir: E ≈ 1,159 V.',
      ],
      answer: 'E ≈ 1,159 V (lebih tinggi dari E° standar)',
      physicalMeaning:
        'Mengencerkan ion produk anoda mendorong reaksi ke kanan (prinsip Le Chatelier) sehingga menghasilkan tambahan tegangan ~59 mV.',
    },
    glossary: [
      { term: 'Anoda', definition: 'Elektroda tempat terjadinya reaksi oksidasi (pelepasan elektron).' },
      { term: 'Katoda', definition: 'Elektroda tempat terjadinya reaksi reduksi (penangkapan elektron).' },
      { term: 'Jembatan Garam', definition: 'Tabung elektrolit inert (seperti KNO₃) penyeimbang muatan ionik antar setengah sel.' },
      { term: 'Energi Bebas Gibbs (ΔG)', definition: 'Kerja listrik maksimum sel: ΔG = −n·F·E; spontan jika ΔG < 0 (E > 0).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Alessandro Volta menciptakan tumpukan baterai pertama (1800), diikuti John Frederic Daniell (1836) dengan sel dua kompartemen stabil, lalu Walther Nernst (1889) merumuskan ketergantungan konsentrasinya.',
      derivationLatex: [
        'E^\\circ_{\\text{sel}} = E^\\circ_{\\text{katoda}} - E^\\circ_{\\text{anoda}} = 0.34 - (-0.76) = 1.10\\text{ V}',
        'E = E^\\circ - \\frac{RT}{nF} \\ln Q = E^\\circ - \\frac{0.0592}{n}\\log_{10}\\left(\\frac{[Zn^{2+}]}{[Cu^{2+}]}\\right)',
        '\\Delta G = -n F E',
      ],
      advancedConcept:
        'Saat sel terus dipakai hingga Q mencapai konstanta kesetimbangan K (≈ 10³⁷ untuk sel Daniell), E turun menjadi tepat 0 V — baterai mati total.',
    },
    extraPreLabQuestions: [
      {
        id: 'redox-q2',
        question: 'Apa yang terjadi pada potensial sel Daniell jika konsentrasi ion katoda [Cu²⁺] diperbesar dari 0,1 M menjadi 1,0 M sementara [Zn²⁺] tetap?',
        options: [
          'Potensial sel E meningkat karena reaksi terdorong ke arah produk',
          'Potensial sel E menurun menuju nol',
          'Potensial sel tetap persis 1,10 V',
          'Arah aliran elektron berbalik dari Cu ke Zn',
        ],
        correctIndex: 0,
        explanation:
          'Memperbesar reaktan [Cu²⁺] mengecilkan Q = [Zn²⁺]/[Cu²⁺], sehingga suku −(0,0592/2)·log Q menjadi lebih positif dan tegangan sel naik.',
      },
    ],
  },

  'ideal-gas-boyle': {
    keyTakeaways: [
      'Persamaan gas ideal P·V = n·R·T menyatukan Hukum Boyle, Charles, dan Avogadro dalam satu relasi keadaan.',
      'Pada proses isotermal (suhu T tetap), tekanan berbanding terbalik dengan volume (P·V = konstan).',
      'Pada kompresi adiabatik (tanpa kalor keluar, Q = 0), kerja piston langsung memanaskan gas sehingga tekanan melonjak lebih curam (P·Vᵞ = konstan).',
    ],
    everydayAnalogy: {
      title: 'Menekan Ujung Suntikan Tertutup & Pompa Ban Sepeda',
      scenario:
        'Saat ujung suntikan ditutup jari lalu piston ditekan ke setengah volume, terasa tekanan balik dua kali lipat; jika dipompa cepat berulang kali, silinder pompa terasa hangat.',
      connection:
        'Penekanan pelan menjaga suhu tetap (Hukum Boyle isotermal), sedangkan pemompaan cepat tidak memberi waktu panas keluar sehingga suhu gas melonjak (efek adiabatik).',
    },
    formulaBreakdown: [
      { symbol: 'P', name: 'Tekanan gas', unit: 'atm', role: 'terikat', explanation: 'Gaya tumbukan partikel gas per satuan luas dinding silinder.' },
      { symbol: 'V', name: 'Volume ruang silinder', unit: 'L', role: 'bebas', explanation: 'Ruang gerak molekul yang diatur oleh posisi piston.' },
      { symbol: 'T', name: 'Suhu mutlak Kelvin', unit: 'K', role: 'bebas', explanation: 'Sebanding dengan energi kinetik rata-rata molekul (K = °C + 273,15).' },
      { symbol: 'n', name: 'Jumlah mol gas', unit: 'mol', role: 'bebas', explanation: 'Banyaknya molekul gas (1 mol = 6,022 × 10²³ partikel).' },
    ],
    workedExample: {
      question:
        'Sebanyak 1,0 mol gas ideal menempati silinder bervolume 20,0 L pada suhu tetap 300 K (R = 0,0821 L·atm/mol·K). Berapakah tekanannya mula-mula, dan berapa tekanannya jika dimampatkan isotermal menjadi 5,0 L?',
      given: ['n = 1,0 mol', 'T = 300 K', 'V₁ = 20,0 L', 'V₂ = 5,0 L'],
      steps: [
        'Hitung tekanan awal: P₁ = n·R·T / V₁ = (1,0 × 0,0821 × 300) / 20,0 = 24,63 / 20,0 = 1,23 atm.',
        'Terapkan Hukum Boyle (P₁V₁ = P₂V₂): P₂ = P₁ × (V₁ / V₂) = 1,23 × (20,0 / 5,0).',
        'Hasil akhir: P₂ = 1,23 × 4 = 4,93 atm.',
      ],
      answer: 'P₁ ≈ 1,23 atm; setelah ditekan ke 5 L menjadi P₂ ≈ 4,93 atm',
      physicalMeaning:
        'Volume diperkecil seperempatnya membuat frekuensi tumbukan molekul ke dinding meningkat empat kali lipat pada suhu yang sama.',
    },
    glossary: [
      { term: 'Isotermal', definition: 'Perubahan keadaan gas pada suhu konstan (ΔT = 0).' },
      { term: 'Adiabatik', definition: 'Perubahan keadaan gas tanpa pertukaran kalor dengan lingkungan (Q = 0).' },
      { term: 'Suhu Mutlak (Kelvin)', definition: 'Skala suhu termodinamika yang titik nolnya adalah nol mutlak (−273,15°C).' },
      { term: 'Rasio Kapasitas Kalor (γ)', definition: 'Perbandingan Cₚ/Cᵥ, bernilai ~1,4 untuk gas diatomik seperti udara.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Robert Boyle (1662) memakai tabung kaca berbentuk huruf J berisi raksa untuk menemukan hubungan P ∝ 1/V, yang 172 tahun kemudian disatukan Émile Clapeyron ke dalam persamaan gas ideal modern.',
      derivationLatex: [
        'P V = n R T, \\quad R = 0.08206\\text{ L}\\cdot\\text{atm}\\cdot\\text{mol}^{-1}\\cdot\\text{K}^{-1}',
        'P_1 V_1 = P_2 V_2 \\quad (\\text{Isotermal})',
        'P_1 V_1^\\gamma = P_2 V_2^\\gamma \\quad (\\text{Adiabatik},\\ \\gamma = 1.4)',
      ],
      advancedConcept:
        'Pada tekanan sangat tinggi atau suhu mendekati titik cair, gas nyata menyimpang dan dimodelkan oleh persamaan Van der Waals: (P + a·n²/V²)(V − n·b) = nRT.',
    },
    extraPreLabQuestions: [
      {
        id: 'gas-q2',
        question: 'Jika 1 mol gas ideal dalam wadah kaku (volume V tetap) dipanaskan dari 300 K menjadi 600 K, bagaimana perubahan tekanannya?',
        options: [
          'Tekanan meningkat menjadi 2 kali lipat',
          'Tekanan berkurang menjadi setengahnya',
          'Tekanan meningkat 4 kali lipat',
          'Tekanan tetap karena volume tidak berubah',
        ],
        correctIndex: 0,
        explanation:
          'Dari P = nRT/V pada n dan V konstan, tekanan berbanding lurus dengan suhu mutlak Kelvin (Hukum Gay-Lussac), sehingga 600 K / 300 K = 2×.',
      },
    ],
  },

  'reaction-kinetics-arrhenius': {
    keyTakeaways: [
      'Laju reaksi kimia v = k·[A] ditentukan oleh konsentrasi reaktan dan tetapan laju k yang sangat sensitif terhadap suhu.',
      'Persamaan Arrhenius k = A·e^(−Eₐ/RT) menjelaskan mengapa kenaikan suhu kecil dapat melipatgandakan laju reaksi secara eksponensial.',
      'Katalis mempercepat reaksi dengan menurunkan bukit energi aktivasi Eₐ tanpa ikut habis bereaksi.',
    ],
    everydayAnalogy: {
      title: 'Pelari Melompati Pagar Rintangan Saat Berenergi Tinggi',
      scenario:
        'Hanya pelari yang cukup bertenaga melompati pagar setinggi 1 meter yang sampai ke garis finis; memanaskan reaksi seperti memberi energi ekstra kepada semua pelari, sedangkan katalis seperti merendahkan pagarnya.',
      connection:
        'Tinggi pagar adalah energi aktivasi Eₐ, sedangkan distribusi tenaga pelari mengikuti kurva Maxwell-Boltzmann yang bergeser ke kanan saat suhu T naik.',
    },
    formulaBreakdown: [
      { symbol: 'T', name: 'Suhu reaksi', unit: '°C / K', role: 'bebas', explanation: 'Meningkatkan energi kinetik rata-rata dan fraksi tumbukan efektif.' },
      { symbol: 'Eₐ', name: 'Energi aktivasi', unit: 'kJ/mol', role: 'bebas', explanation: 'Ambang energi minimum tumbukan agar ikatan lama putus dan ikatan baru terbentuk.' },
      { symbol: '[A]', name: 'Konsentrasi reaktan', unit: 'M', role: 'bebas', explanation: 'Memperbanyak frekuensi tumbukan partikel per detik.' },
      { symbol: 't½', name: 'Waktu paruh reaksi', unit: 's', role: 'terikat', explanation: 'Durasi hingga konsentrasi reaktan berkurang menjadi setengahnya (ln 2 / k).' },
    ],
    workedExample: {
      question:
        'Reaksi orde satu memiliki konstanta laju k = 0,035 s⁻¹ pada suhu 40°C dengan konsentrasi awal [A] = 0,80 M. Hitung laju awal reaksi dan waktu paruhnya!',
      given: ['k = 0,035 s⁻¹', '[A] = 0,80 M', 'ln(2) ≈ 0,693'],
      steps: [
        'Hitung laju reaksi awal: v = k·[A] = 0,035 × 0,80 = 0,028 M/s.',
        'Hitung waktu paruh orde satu: t½ = 0,693 / k = 0,693 / 0,035.',
        'Hasil akhir: t½ ≈ 19,8 detik.',
      ],
      answer: 'v = 0,028 M/s dan t½ ≈ 19,8 s',
      physicalMeaning:
        'Jika suhu dinaikkan 10°C sehingga k kira-kira berlipat dua menjadi 0,070 s⁻¹, waktu paruh langsung terpangkas setengahnya menjadi ~9,9 detik.',
    },
    glossary: [
      { term: 'Energi Aktivasi (Eₐ)', definition: 'Energi minimum yang harus dimiliki molekul bertumbukan agar terjadi reaksi kimia.' },
      { term: 'Tumbukan Efektif', definition: 'Tumbukan berenergi cukup (≥ Eₐ) dan berorientasi ruang tepat.' },
      { term: 'Waktu Paruh (t½)', definition: 'Waktu yang diperlukan agar separuh jumlah reaktan habis bereaksi.' },
      { term: 'Katalis', definition: 'Zat yang membuka lintasan reaksi ber-Eₐ lebih rendah tanpa mengubah ΔH akhir.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Svante Arrhenius (1889) menafsirkan secara fisis persamaan empiris van ’t Hoff dengan memperkenalkan konsep molekul "teraktivasi" yang harus melampaui penghalang energi Eₐ.',
      derivationLatex: [
        'k = A \\exp\\left(-\\frac{E_a}{R T}\\right)',
        '\\ln k = \\ln A - \\frac{E_a}{R}\\left(\\frac{1}{T}\\right)',
        't_{1/2} = \\frac{\\ln 2}{k} \\approx \\frac{0.693}{k}',
      ],
      advancedConcept:
        'Grafik Arrhenius ln(k) terhadap 1/T berbentuk garis lurus sempurna dengan gradien −Eₐ/R, metode eksperimen utama menentukan energi aktivasi reaksi.',
    },
    extraPreLabQuestions: [
      {
        id: 'kin-q2',
        question: 'Bagaimana mekanisme utama katalis dalam mempercepat laju reaksi kimia?',
        options: [
          'Menyediakan lintasan reaksi alternatif dengan energi aktivasi Eₐ lebih rendah',
          'Menaikkan suhu larutan secara permanen',
          'Menambah jumlah mol reaktan di dalam wadah',
          'Mengubah reaksi endotermik menjadi eksotermik',
        ],
        correctIndex: 0,
        explanation:
          'Katalis menurunkan energi aktivasi Eₐ sehingga jauh lebih banyak fraksi molekul yang mampu melampaui ambang reaksi pada suhu yang sama.',
      },
    ],
  },

  'spectrophotometry-beer': {
    keyTakeaways: [
      'Hukum Lambert-Beer menyatakan absorbansi cahaya berbanding lurus dengan konsentrasi zat dan tebal kuvet: A = ε·b·c.',
      'Absorbansi A dan Transmitansi T terhubung secara logaritmik terbalik: A = −log₁₀(T) = 2 − log₁₀(%T).',
      'Pengukuran paling peka dilakukan pada panjang gelombang serapan maksimum (λ maks), yaitu warna komplementer larutan.',
    ],
    everydayAnalogy: {
      title: 'Melihat Cahaya Senter Menembus Sirup Encer vs Sirup Pekat',
      scenario:
        'Sinar senter menembus segelas sirup encer dengan terang, tetapi meredup drastis ketika sirup makin kental atau gelasnya makin lebar.',
      connection:
        'Kepekatan sirup adalah konsentrasi c, lebar gelas adalah panjang lintasan kuvet b, dan seberapa besar cahaya yang tertahan diukur secara kuantitatif sebagai absorbansi A.',
    },
    formulaBreakdown: [
      { symbol: 'c', name: 'Konsentrasi molar analit', unit: 'mM / M', role: 'bebas', explanation: 'Jumlah molekul penyerap foton per satuan volume larutan.' },
      { symbol: 'b', name: 'Panjang lintasan optik kuvet', unit: 'cm', role: 'bebas', explanation: 'Lebar dalam kuvet kuarsa standar (umumnya 1,0 cm).' },
      { symbol: 'ε', name: 'Absorptivitas molar', unit: 'L/(mol·cm)', role: 'konstanta', explanation: 'Karakteristik serapan spesifik suatu senyawa pada λ tertentu.' },
      { symbol: 'A', name: 'Absorbansi', unit: 'tanpa satuan', role: 'terikat', explanation: 'Ukuran logaritmik intensitas cahaya yang diserap: A = log₁₀(I₀/I).' },
    ],
    workedExample: {
      question:
        'Larutan kompleks berwarna memiliki ε = 5000 L/(mol·cm) pada λ = 525 nm. Diukur dalam kuvet b = 1,0 cm dengan konsentrasi c = 0,10 mM (1,0 × 10⁻⁴ M). Hitung absorbansi A dan persen transmitansi %T!',
      given: ['ε = 5000 L/(mol·cm)', 'b = 1,0 cm', 'c = 1,0 × 10⁻⁴ M'],
      steps: [
        'Hitung absorbansi: A = ε·b·c = 5000 × 1,0 × (1,0 × 10⁻⁴) = 0,50.',
        'Konversi ke fraksi transmitansi: T = 10⁻ᴬ = 10⁻⁰·⁵ ≈ 0,316.',
        'Ubah ke persen: %T = 0,316 × 100% = 31,6%.',
      ],
      answer: 'A = 0,50 dan %T ≈ 31,6%',
      physicalMeaning:
        'Sekitar 68,4% intensitas cahaya datang diserap molekul analit dan 31,6% sisanya berhasil menembus menuju detektor fotodioda.',
    },
    glossary: [
      { term: 'Absorbansi (A)', definition: 'Besaran tak bersatuan yang mengukur daya serap optik larutan secara linear terhadap konsentrasi.' },
      { term: 'Transmitansi (%T)', definition: 'Persentase intensitas cahaya yang lolos menembus kuvet (I / I₀ × 100%).' },
      { term: 'Kuvet', definition: 'Wadah transparan kuarsa/kaca berdinding paralel presisi untuk menampung sampel optik.' },
      { term: 'Blanko (Blank)', definition: 'Larutan pelarut murni tanpa analit untuk mengkalibrasi 100% transmitansi (A = 0).' },
    ],
    deepDiveContent: {
      historicalContext:
        'Pierre Bouguer (1729) dan Johann Heinrich Lambert (1760) menemukan hukum tebal lintasan, lalu August Beer (1852) menemukan ketergantungan konsentrasinya yang menjadi fondasi spektrofotometri UV-Vis modern.',
      derivationLatex: [
        'T = \\frac{I}{I_0}, \\quad A = -\\log_{10}(T) = \\log_{10}\\left(\\frac{I_0}{I}\\right)',
        'A = \\varepsilon \\cdot b \\cdot c',
      ],
      advancedConcept:
        'Rentang pengukuran optimal spektrofotometer berada pada A = 0,2 sampai 0,8 (error fotometrik minimum pada A ≈ 0,434); di atas A > 1,5 sampel sebaiknya diencerkan terlebih dahulu.',
    },
    extraPreLabQuestions: [
      {
        id: 'spec-q2',
        question: 'Jika konsentrasi larutan sampel digandakan dari 0,05 mM menjadi 0,10 mM dalam kuvet yang sama pada batas linear Lambert-Beer, bagaimana perubahan absorbansinya?',
        options: [
          'Absorbansi meningkat tepat 2 kali lipat',
          'Absorbansi meningkat 10 kali lipat',
          'Absorbansi berkurang menjadi setengahnya',
          'Transmitansi (%T) meningkat 2 kali lipat',
        ],
        correctIndex: 0,
        explanation:
          'Menurut A = ε·b·c, absorbansi berbanding lurus secara linear terhadap konsentrasi c, sehingga menggandakan c langsung menggandakan A.',
      },
    ],
  },

  'chemical-equilibrium-lechatelier': {
    keyTakeaways: [
      'Asas Le Chatelier menyatakan bahwa jika sistem kesetimbangan diberi gangguan (suhu, tekanan, konsentrasi), sistem akan bergeser ke arah yang meminimalkan gangguan tersebut.',
      'Pada reaksi endotermik N₂O₄(g, tak berwarna) ⇌ 2 NO₂(g, cokelat kemerahan) (ΔH° = +57,2 kJ/mol), pemanasan menggeser kesetimbangan ke kanan dan memperbesar nilai Kp.',
      'Peningkatan tekanan total P pada suhu tetap menggeser kesetimbangan ke arah jumlah mol gas yang lebih kecil (1 mol N₂O₄ di kiri) tanpa mengubah nilai Kp.',
    ],
    everydayAnalogy: {
      title: 'Kacamata Fotokromik yang Menggelap di Bawah Terik Matahari',
      scenario:
        'Lensa kacamata fotokromik tampak bening saat berada di ruangan sejuk, namun berubah menjadi cokelat gelap ketika terkena panas dan sinar terik di luar ruangan, lalu kembali bening saat masuk ke ruangan.',
      connection:
        'Sama seperti kesetimbangan reversibel N₂O₄ ⇌ 2 NO₂: energi panas mendorong pembentukan molekul berwarna gelap (NO₂), dan pendinginan mengembalikannya ke bentuk dimer tak berwarna (N₂O₄).',
    },
    formulaBreakdown: [
      { symbol: 'T', name: 'Suhu reaktor kesetimbangan', unit: '°C / K', role: 'bebas', explanation: 'Mengubah nilai tetapan kesetimbangan Kp secara eksponensial melalui persamaan Van \'t Hoff.' },
      { symbol: 'P', name: 'Tekanan total gas', unit: 'atm', role: 'bebas', explanation: 'Mengubah derajat disosiasi α karena selisih koefisien mol gas Δn = +1.' },
      { symbol: 'Kp', name: 'Tetapan kesetimbangan tekanan', unit: 'atm', role: 'terikat', explanation: 'Rasio kuadrat tekanan parsial NO₂ terhadap tekanan parsial N₂O₄ saat setimbang.' },
      { symbol: 'α', name: 'Derajat disosiasi N₂O₄', unit: 'fraksi 0–1', role: 'terikat', explanation: 'Fraksi mol N₂O₄ awal yang terurai menjadi gas NO₂ cokelat kemerahan: α = √[Kp / (Kp + 4P)].' },
    ],
    workedExample: {
      question:
        'Pada suhu 25 °C (298,15 K), reaksi N₂O₄(g) ⇌ 2 NO₂(g) memiliki Kp = 0,148 atm. Jika tekanan total dijaga P = 1,00 atm, hitung derajat disosiasi α dan persentase mol gas NO₂ di dalam tabung!',
      given: ['T = 298,15 K', 'Kp = 0,148 atm', 'P = 1,00 atm'],
      steps: [
        'Gunakan hubungan Kp = 4·α²·P / (1 − α²) sehingga α = √[Kp / (Kp + 4P)].',
        'Substitusi nilai: α = √[0,148 / (0,148 + 4 × 1,00)] = √(0,148 / 4,148) = √0,03568 ≈ 0,189.',
        'Hitung fraksi mol NO₂: x(NO₂) = 2α / (1 + α) = (2 × 0,189) / 1,189 ≈ 0,318 (31,8%).',
      ],
      answer: 'α ≈ 0,189 dan fraksi mol NO₂ ≈ 31,8%',
      physicalMeaning:
        'Pada suhu kamar dan tekanan 1 atm, sekitar 18,9% molekul N₂O₄ terpecah menjadi NO₂ sehingga campuran gas berwarna kuning-cokelat sedang.',
    },
    glossary: [
      { term: 'Kesetimbangan Dinamis', definition: 'Keadaan saat laju reaksi maju sama dengan laju reaksi balik (v maju = v balik) sehingga komposisi makroskopik tetap.' },
      { term: 'Asas Le Chatelier', definition: 'Prinsip bahwa sistem setimbang merespons gangguan eksternal dengan bergeser ke arah yang meredam gangguan tersebut.' },
      { term: 'Derajat Disosiasi (α)', definition: 'Perbandingan jumlah mol zat yang terurai terhadap jumlah mol zat mula-mula sebelum bereaksi.' },
      { term: 'Persamaan Van \'t Hoff', definition: 'Rumus termodinamika yang menghubungkan perubahan nilai tetapan kesetimbangan Kp terhadap perubahan suhu dan entalpi ΔH°.' },
    ],
    deepDiveContent: {
      historicalContext:
        'Henry Louis Le Chatelier (1884) dan Karl Ferdinand Braun merumuskan prinsip pergeseran kesetimbangan kimia yang kemudian menjadi kunci rekayasa industri sintesis amonia Haber-Bosch bertekanan tinggi.',
      derivationLatex: [
        'K_p = \\frac{P_{\\text{NO}_2}^2}{P_{\\text{N}_2\\text{O}_4}} = \\frac{\\left(\\frac{2\\alpha}{1+\\alpha}P\\right)^2}{\\left(\\frac{1-\\alpha}{1+\\alpha}P\\right)} = \\frac{4\\alpha^2 P}{1 - \\alpha^2}',
        '\\frac{d \\ln K_p}{dT} = \\frac{\\Delta H^\\circ}{R T^2}',
      ],
      advancedConcept:
        'Berbeda dengan perubahan tekanan atau konsentrasi yang hanya menggeser kuosien reaksi Qp menuju Kp yang sama, perubahan suhu secara langsung mengubah lanskap energi bebas Gibbs standar ΔG° = −RT ln Kp.',
    },
  },
};

