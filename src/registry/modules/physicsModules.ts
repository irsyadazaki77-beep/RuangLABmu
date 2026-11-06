import { ExperimentModule } from '../experimentRegistry';

export const PHYSICS_MODULES: ExperimentModule[] = [
  {
    id: 'newton-incline',
    title: 'Hukum II Newton & Bidang Miring',
    domain: 'fisika',
    subCategory: 'Mekanika Klasik',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 1,
    estimatedMinutes: 30,
    objectives: {
      SMP: [
        'Memahami hubungan antara gaya dorong (F), massa benda (m), dan percepatan (a).',
        'Mengamati pengaruh kemiringan bidang terhadap luncuran benda.',
      ],
      SMA: [
        'Menganalisis diagram gaya bebas pada bidang miring dengan gaya gesek kinetik.',
        'Membuktikan persamaan ΣF = m·a secara kuantitatif melalui regresi linier.',
      ],
      Mahasiswa: [
        'Mengkaji dinamika transisi gesek statis-kinetik dan disipasi energi mekanik pada bidang miring.',
        'Mengevaluasi ralat propagasi pengukuran gaya dan percepatan.',
      ],
    },
    theorySummary:
      'Hukum II Newton menyatakan bahwa percepatan sebuah benda berbanding lurus dengan resultan gaya yang bekerja dan berbanding terbalik dengan massanya (a = ΣF / m). Pada bidang miring bersudut θ, komponen gaya berat searah bidang adalah w_paralel = m·g·sin(θ), gaya normal N = m·g·cos(θ), dan gaya gesek kinetik fk = μk·N.',
    keyEquations: [
      '\\Sigma F = m \\cdot a',
      'N = m \\cdot g \\cdot \\cos(\\theta)',
      'f_k = \\mu_k \\cdot N',
      'a = \\frac{F_{\\text{tarik}} - m g \\sin(\\theta) - \\mu_k m g \\cos(\\theta)}{m}',
    ],
    apparatusList: [
      'Rel / lintasan bidang miring berskala busur derajat',
      'Balok beban kuningan & kayu bermassa variabel',
      'Sensor gaya digital & gerbang cahaya (photogate)',
      'Perangkat lunak pencatat data waktu tempuh',
    ],
    safetyNotes: [
      'Pastikan stopper di ujung bawah lintasan terpasang kokoh agar balok tidak terlepas.',
      'Hindari menempatkan jari di jalur luncuran balok.',
    ],
    parameters: [
      { key: 'mass', label: 'Massa Benda (m)', unit: 'kg', min: 0.5, max: 20, step: 0.5, defaultValue: 4.0, variableRole: 'kontrol', instrumentType: 'dynamometer' },
      { key: 'appliedForce', label: 'Gaya Dorong Luar (F)', unit: 'N', min: 0, max: 200, step: 5, defaultValue: 45, variableRole: 'bebas', instrumentType: 'dynamometer' },
      { key: 'inclineAngle', label: 'Sudut Kemiringan (θ)', unit: '°', min: 0, max: 60, step: 1, defaultValue: 15, variableRole: 'kontrol' },
      { key: 'frictionCoeffKinetic', label: 'Koefisien Gesek Kinetik (μk)', unit: '', min: 0, max: 0.8, step: 0.05, defaultValue: 0.15, variableRole: 'kontrol' },
      { key: 'gravity', label: 'Percepatan Gravitasi (g)', unit: 'm/s²', min: 1.62, max: 24.79, step: 0.01, defaultValue: 9.81, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'netForce', label: 'Resultan Gaya (ΣF)', unit: 'N', formulaLatex: '\\Sigma F = F - mg\\sin\\theta - f_k', precision: 2 },
      { key: 'acceleration', label: 'Percepatan (a)', unit: 'm/s²', formulaLatex: 'a = \\Sigma F / m', precision: 2 },
      { key: 'normalForce', label: 'Gaya Normal (N)', unit: 'N', formulaLatex: 'N = mg\\cos\\theta', precision: 2 },
      { key: 'frictionForce', label: 'Gaya Gesek Kinetik (fk)', unit: 'N', formulaLatex: 'f_k = \\mu_k N', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'appliedForce', yKey: 'acceleration', expectedSlopeMeaning: 'Invers Massa (1/m)' },
    preLabQuiz: [
      {
        id: 'newton-q1',
        question: 'Jika resultan gaya yang bekerja pada balok bernilai nol, bagaimanakah keadaan gerak balok?',
        options: ['Pasti diam', 'Diam atau bergerak lurus beraturan (kecepatan konstan)', 'Pasti bergerak dipercepat', 'Kehilangan massa'],
        correctIndex: 1,
        explanation: 'Sesuai Hukum I Newton (Inersia), jika resultan gaya ΣF = 0, benda yang mula-mula diam tetap diam, dan benda yang bergerak akan terus bergerak dengan kecepatan tetap.',
      },
      {
        id: 'newton-q2',
        question: 'Bagaimana pengaruh kenaikan sudut kemiringan bidang terhadap gaya normal balok?',
        options: ['Gaya normal membesar', 'Gaya normal konstan', 'Gaya normal mengecil karena cos(θ) menurun', 'Gaya normal menjadi nol pada semua sudut'],
        correctIndex: 2,
        explanation: 'Gaya normal N = m·g·cos(θ). Nilai cos(θ) berkurang seiring membesarnya sudut θ (dari 0° ke 90°), sehingga gaya normal mengecil.',
      },
    ],
    computeStep: (params) => {
      const { mass = 4, appliedForce = 45, inclineAngle = 15, frictionCoeffKinetic = 0.15, gravity = 9.81 } = params;
      const rad = (inclineAngle * Math.PI) / 180;
      const normalForce = mass * gravity * Math.cos(rad);
      const gravityParallel = mass * gravity * Math.sin(rad);
      const frictionForce = frictionCoeffKinetic * normalForce;
      const netForceRaw = appliedForce - gravityParallel - frictionForce;
      const netForce = Math.max(0, netForceRaw);
      const acceleration = netForce > 0 ? netForce / mass : 0;
      return { netForce, acceleration, normalForce, frictionForce };
    },
  },

  {
    id: 'projectile-motion',
    title: 'Kinematika Gerak Parabola (Projektil)',
    domain: 'fisika',
    subCategory: 'Kinematika 2D',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati lintasan lengkung peluru akibat pengaruh percepatan gravitasi.',
        'Menemukan sudut tembak yang menghasilkan jarak luncur terjauh.',
      ],
      SMA: [
        'Membedakan gerak lurus beraturan pada sumbu horizontal dan gerak lurus berubah beraturan pada sumbu vertikal.',
        'Membuktikan secara analitis sudut elevasi optimum 45° pada elevasi awal h0 = 0.',
      ],
      Mahasiswa: [
        'Menurunkan persamaan trajektori projektil dengan elevasi non-nol h0 > 0.',
        'Menganalisis variasi jangkauan pada percepatan gravitasi lingkungan planet yang berbeda.',
      ],
    },
    theorySummary:
      'Gerak peluru merupakan perpaduan dua gerak independen: GLB pada sumbu-X (vx = v0·cos(θ)) dan GLBB pada sumbu-Y (vy = v0·sin(θ) - g·t). Jarak jangkauan horizontal maksimum pada bidang datar adalah R = (v0²·sin(2θ)) / g, dan ketinggian puncak adalah H = (v0²·sin²(θ)) / (2g).',
    keyEquations: [
      'x(t) = v_0 \\cos(\\theta) \\cdot t',
      'y(t) = h_0 + v_0 \\sin(\\theta) \\cdot t - \\frac{1}{2} g t^2',
      'R = \\frac{v_0^2 \\sin(2\\theta)}{g}',
      'H_{\\max} = h_0 + \\frac{v_0^2 \\sin^2(\\theta)}{2g}',
    ],
    apparatusList: [
      'Meriam peluru mekanik dengan pengatur sudut busur derajat presisi',
      'Bola logam kalibrasi bermassa terukur',
      'Kertas karbon dan pita ukur pengukur jarak pendaratan',
      'Sensor photogate pencatat kecepatan awal v0',
    ],
    safetyNotes: [
      'Arahkan moncong meriam selalu ke arah tangkapan jaring aman.',
      'Gunakan kacamata pelindung (safety goggles) saat peluncuran peluru berkecepatan tinggi.',
    ],
    parameters: [
      { key: 'initialVelocity', label: 'Kecepatan Awal (v₀)', unit: 'm/s', min: 5, max: 50, step: 1, defaultValue: 25, variableRole: 'bebas', instrumentType: 'stopwatch' },
      { key: 'launchAngle', label: 'Sudut Elevasi (θ)', unit: '°', min: 10, max: 85, step: 1, defaultValue: 45, variableRole: 'bebas' },
      { key: 'initialHeight', label: 'Ketinggian Peluncur (h₀)', unit: 'm', min: 0, max: 50, step: 1, defaultValue: 0, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'gravity', label: 'Gravitasi (g)', unit: 'm/s²', min: 1.62, max: 24.79, step: 0.01, defaultValue: 9.81, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'range', label: 'Jarak Jangkauan (R)', unit: 'm', formulaLatex: 'R = v_0 \\cos\\theta \\cdot t_{\\text{flight}}', precision: 2 },
      { key: 'maxHeight', label: 'Tinggi Maksimum (H)', unit: 'm', formulaLatex: 'H = h_0 + \\frac{v_0^2\\sin^2\\theta}{2g}', precision: 2 },
      { key: 'flightTime', label: 'Waktu Terbang (t)', unit: 's', formulaLatex: 't = \\frac{v_0\\sin\\theta + \\sqrt{v_0^2\\sin^2\\theta + 2gh_0}}{g}', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'initialVelocity', yKey: 'range', expectedSlopeMeaning: 'Kuadratik Terhadap v₀' },
    preLabQuiz: [
      {
        id: 'proj-q1',
        question: 'Pada titik tertinggi lintasan peluru, komponen kecepatan manakah yang bernilai nol?',
        options: ['Kecepatan horizontal (vx)', 'Kecepatan vertikal (vy)', 'Percepatan gravitasi (g)', 'Seluruh vektor kecepatan v'],
        correctIndex: 1,
        explanation: 'Di puncak lintasan, arah gerak vertikal berbalik sehingga vy = 0 m/s. Komponen horizontal vx tetap konstan.',
      },
    ],
    computeStep: (params) => {
      const { initialVelocity = 25, launchAngle = 45, initialHeight = 0, gravity = 9.81 } = params;
      const rad = (launchAngle * Math.PI) / 180;
      const vy0 = initialVelocity * Math.sin(rad);
      const vx = initialVelocity * Math.cos(rad);
      const discriminant = vy0 * vy0 + 2 * gravity * initialHeight;
      const flightTime = (vy0 + Math.sqrt(Math.max(0, discriminant))) / gravity;
      const range = vx * flightTime;
      const maxHeight = initialHeight + (vy0 * vy0) / (2 * gravity);
      return { range, maxHeight, flightTime };
    },
  },

  {
    id: 'pendulum-harmonic',
    title: 'Bandul Matematis & Percepatan Gravitasi',
    domain: 'fisika',
    subCategory: 'Getaran & Gelombang',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 1,
    estimatedMinutes: 30,
    objectives: {
      SMP: [
        'Mempelajari ayunan bandul sederhana dan mengukur waktu periode getaran.',
        'Membuktikan bahwa massa beban tidak mempengaruhi periode ayunan pada sudut kecil.',
      ],
      SMA: [
        'Menentukan nilai percepatan gravitasi lokal (g) melalui grafik T² terhadap panjang tali (L).',
        'Menganalisis syarat simpangan sudut kecil (sin θ ≈ θ) pada osilasi harmonik sederhana.',
      ],
      Mahasiswa: [
        'Menghitung koreksi orde tinggi deret Legendre untuk simpangan sudut besar.',
        'Menganalisis perambatan ralat diferensial dg/g = dL/L + 2 dT/T.',
      ],
    },
    theorySummary:
      'Bandul matematis terdiri atas partikel bermassa m yang digantungkan pada seutas tali ringan tak renggang sepanjang L. Untuk simpangan sudut kecil (θ < 15°), periode getaran harmonik sederhana dinyatakan oleh T = 2π√(L/g). Dengan memplot T² versus L, kemiringan kurva linear m = 4π²/g memungkinkan pengukuran g lokal dengan akurasi tinggi.',
    keyEquations: [
      'T = 2\\pi \\sqrt{\\frac{L}{g}}',
      'T^2 = \\left(\\frac{4\\pi^2}{g}\\right) L',
      'g = \\frac{4\\pi^2 L}{T^2}',
      'E_m = m g L (1 - \\cos\\theta_0)',
    ],
    apparatusList: [
      'Statif bandul kokoh dengan penjepit klem terkalibrasi',
      'Benang nilon tak melar & beban bola kuningan (50g, 100g, 200g)',
      'Stopwatch digital presisi 0.01 detik / Sensor Photogate',
      'Pita meteran baja berskala milimeter & busur derajat',
    ],
    safetyNotes: [
      'Lepaskan bandul tanpa hentakan atau dorongan samping agar ayunan terjadi pada satu bidang planar.',
      'Jaga agar sudut simpangan tidak melebihi 15° untuk menjaga validitas model harmonik sederhana.',
    ],
    parameters: [
      { key: 'length', label: 'Panjang Tali (L)', unit: 'm', min: 0.2, max: 2.0, step: 0.05, defaultValue: 1.0, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'mass', label: 'Massa Beban (m)', unit: 'kg', min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.1, variableRole: 'kontrol', instrumentType: 'dynamometer' },
      { key: 'initialAngle', label: 'Sudut Simpangan (θ₀)', unit: '°', min: 2, max: 30, step: 1, defaultValue: 10, variableRole: 'kontrol' },
      { key: 'gravity', label: 'Percepatan Gravitasi (g)', unit: 'm/s²', min: 1.62, max: 24.79, step: 0.01, defaultValue: 9.81, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'period', label: 'Periode Ayunan (T)', unit: 's', formulaLatex: 'T = 2\\pi\\sqrt{L/g}', precision: 3 },
      { key: 'periodSquared', label: 'Kuadrat Periode (T²)', unit: 's²', formulaLatex: 'T^2 = \\frac{4\\pi^2}{g} L', precision: 3 },
      { key: 'frequency', label: 'Frekuensi (f)', unit: 'Hz', formulaLatex: 'f = 1 / T', precision: 3 },
      { key: 'maxVelocity', label: 'Kecepatan Maksimum (v_max)', unit: 'm/s', formulaLatex: 'v_{\\max} = \\sqrt{2gL(1 - \\cos\\theta_0)}', precision: 3 },
    ],
    defaultRegressionAxes: { xKey: 'length', yKey: 'periodSquared', expectedSlopeMeaning: 'Konstanta 4π²/g (~4.02 s²/m)' },
    preLabQuiz: [
      {
        id: 'pend-q1',
        question: 'Jika panjang tali bandul matematis diperempatkan (L menjadi 1/4 L), apa yang terjadi pada periode ayunan T?',
        options: ['Periode menjadi 4 kali semula', 'Periode menjadi 2 kali semula', 'Periode menjadi 1/2 kali semula', 'Periode tetap sama'],
        correctIndex: 2,
        explanation: 'Karena T sebanding dengan akar panjang tali T ∝ √L, jika L menjadi 1/4, maka T baru = √(1/4) = 1/2 kali periode semula.',
      },
    ],
    computeStep: (params) => {
      const { length = 1.0, initialAngle = 10, gravity = 9.81 } = params;
      const thetaRad = (initialAngle * Math.PI) / 180;
      // First order correction: T = T0 * (1 + (1/16)*theta^2)
      const correction = 1 + (1 / 16) * Math.pow(thetaRad, 2);
      const period = 2 * Math.PI * Math.sqrt(length / gravity) * correction;
      const periodSquared = period * period;
      const frequency = 1 / period;
      const maxVelocity = Math.sqrt(2 * gravity * length * (1 - Math.cos(thetaRad)));
      return { period, periodSquared, frequency, maxVelocity };
    },
  },

  {
    id: 'spring-hooke',
    title: 'Osilasi Pegas & Hukum Hooke',
    domain: 'fisika',
    subCategory: 'Getaran & Elastisitas',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 30,
    objectives: {
      SMP: [
        'Mengukur pertambahan panjang pegas terhadap penambahan beban gantung.',
        'Menyimpulkan bahwa gaya pegas berbanding lurus dengan pertambahan panjang.',
      ],
      SMA: [
        'Menentukan konstanta pegas k melalui grafik statik F vs Δx dan osilasi dinamik T² vs m.',
        'Menganalisis hukum kekekalan energi mekanik pada sistem pegas vertikal.',
      ],
      Mahasiswa: [
        'Mengkaji osilasi teredam fluida (damped harmonic oscillator) dan faktor kualitas Q.',
        'Menghitung frekuensi natural dan rasio redaman kritis.',
      ],
    },
    theorySummary:
      'Hukum Hooke menyatakan bahwa gaya pemulih pegas berbanding lurus dengan pertambahan panjangnya: F = -k·Δx. Pada gerak osilasi vertikal beban m pada pegas, periode osilasi tak teredam adalah T = 2π√(m/k). Energi potensial elastis yang tersimpan dalam pegas adalah Ep = 1/2·k·(Δx)²',
    keyEquations: [
      'F = -k \\cdot \\Delta x',
      'T = 2\\pi \\sqrt{\\frac{m}{k}}',
      'E_p = \\frac{1}{2} k (\\Delta x)^2',
      '\\omega = \\sqrt{\\frac{k}{m}}',
    ],
    apparatusList: [
      'Statif pegas vertikal dengan mistar skala milimeter',
      'Set pegas spiral baja dengan variasi konstanta k (20 N/m, 50 N/m, 100 N/m)',
      'Piringan beban gantung berslot (20g - 500g)',
      'Sensor gerak ultrasonik / stopwatch digital',
    ],
    safetyNotes: [
      'Hindari menarik pegas melebihi batas elastisitasnya (jangan sampai terjadi deformasi plastis permanen).',
      'Pastikan beban terpasang kuat pada pengait agar tidak terjatuh saat berosilasi.',
    ],
    parameters: [
      { key: 'springConstantK', label: 'Konstanta Pegas (k)', unit: 'N/m', min: 10, max: 300, step: 10, defaultValue: 100, variableRole: 'kontrol' },
      { key: 'mass', label: 'Massa Beban (m)', unit: 'kg', min: 0.1, max: 3.0, step: 0.1, defaultValue: 0.5, variableRole: 'bebas', instrumentType: 'dynamometer' },
      { key: 'springDisplacement', label: 'Simpangan Awal (Δx)', unit: 'm', min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.2, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'dampingCoeff', label: 'Koefisien Redaman (b)', unit: 'N·s/m', min: 0, max: 2, step: 0.05, defaultValue: 0.1, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'period', label: 'Periode Alami (T)', unit: 's', formulaLatex: 'T = 2\\pi\\sqrt{m/k}', precision: 3 },
      { key: 'angularFreq', label: 'Frekuensi Sudut (ω)', unit: 'rad/s', formulaLatex: '\\omega_0 = \\sqrt{k/m}', precision: 2 },
      { key: 'potentialEnergy', label: 'Energi Potensial Pegas (Ep)', unit: 'J', formulaLatex: 'E_p = \\frac{1}{2} k \\Delta x^2', precision: 3 },
      { key: 'restoringForce', label: 'Gaya Pemulih Maks (Fp)', unit: 'N', formulaLatex: 'F_p = k \\cdot \\Delta x', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'mass', yKey: 'period', expectedSlopeMeaning: 'Non-Linier (Akar Kuadrat m)' },
    preLabQuiz: [
      {
        id: 'hooke-q1',
        question: 'Dua buah pegas identik masing-masing memiliki konstanta k dirangkai secara paralel. Berapakah konstanta pegas penggantinya?',
        options: ['k / 2', 'k', '2k', '4k'],
        correctIndex: 2,
        explanation: 'Pada susunan pegas paralel, gaya terbagi dan simpangan sama besar, sehingga konstanta penggantinya dijumlahkan: k_total = k1 + k2 = 2k.',
      },
    ],
    computeStep: (params) => {
      const { springConstantK = 100, mass = 0.5, springDisplacement = 0.2 } = params;
      const period = 2 * Math.PI * Math.sqrt(mass / springConstantK);
      const angularFreq = Math.sqrt(springConstantK / mass);
      const potentialEnergy = 0.5 * springConstantK * Math.pow(springDisplacement, 2);
      const restoringForce = springConstantK * springDisplacement;
      return { period, angularFreq, potentialEnergy, restoringForce };
    },
  },

  {
    id: 'collision-momentum',
    title: 'Tumbukan 1D & Kekekalan Momentum',
    domain: 'fisika',
    subCategory: 'Mekanika Klasik',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati benturan antara dua benda bergerak.',
        'Mengenal konsep bahwa benda yang bergerak memiliki momentum.',
      ],
      SMA: [
        'Membuktikan hukum kekekalan momentum pada peristiwa tumbukan lurus dua troli.',
        'Membedakan jenis tumbukan lenting sempurna (e=1), lenting sebagian (0<e<1), dan tidak lenting sama sekali (e=0).',
      ],
      Mahasiswa: [
        'Menganalisis transformasi kerangka acuan pusat massa (Center of Mass Frame).',
        'Menghitung disipasi energi kinetik ke dalam energi deformasi internal dan panas.',
      ],
    },
    theorySummary:
      'Dalam sistem terisolasi tanpa gaya luar impulsif, jumlah momentum linear sistem sebelum tumbukan sama dengan setelah tumbukan: m1·v1 + m2·v2 = m1·v1\' + m2·v2\'. Koefisien restitusi e = -(v1\' - v2\') / (v1 - v2) mengukur elastisitas benturan.',
    keyEquations: [
      'p_{\\text{awal}} = m_1 v_1 + m_2 v_2',
      'e = -\\frac{v_1\' - v_2\'}{v_1 - v_2}',
      'E_k = \\frac{1}{2} m_1 v_1^2 + \\frac{1}{2} m_2 v_2^2',
      '\\Delta E_k = E_{k,\\text{akhir}} - E_{k,\\text{awal}}',
    ],
    apparatusList: [
      'Lintasan rel udara linear presisi rendah gesekan (Air Track)',
      'Dua troli luncur berpelampung udara dengan bumper pegas & velcro',
      'Dua pasang gerbang sensor inframerah (Photogates)',
      'Timbangan analitik pengukur massa gerbong',
    ],
    safetyNotes: [
      'Nyalakan kompresor peniup udara rel sebelum meluncurkan kereta agar bantalan udara terbentuk sempurna.',
      'Hindari menekan troli ke rel secara kasar.',
    ],
    parameters: [
      { key: 'mass', label: 'Massa Troli 1 (m₁)', unit: 'kg', min: 0.5, max: 10, step: 0.5, defaultValue: 2.0, variableRole: 'kontrol', instrumentType: 'dynamometer' },
      { key: 'collisionMass2', label: 'Massa Troli 2 (m₂)', unit: 'kg', min: 0.5, max: 10, step: 0.5, defaultValue: 2.0, variableRole: 'kontrol', instrumentType: 'dynamometer' },
      { key: 'initialVelocity', label: 'Kecepatan Awal 1 (v₁)', unit: 'm/s', min: 0, max: 10, step: 0.5, defaultValue: 4.0, variableRole: 'bebas', instrumentType: 'stopwatch' },
      { key: 'velocity2Initial', label: 'Kecepatan Awal 2 (v₂)', unit: 'm/s', min: -10, max: 10, step: 0.5, defaultValue: -2.0, variableRole: 'kontrol', instrumentType: 'stopwatch' },
      { key: 'restitutionCoeff', label: 'Koefisien Restitusi (e)', unit: '', min: 0, max: 1, step: 0.1, defaultValue: 1.0, variableRole: 'bebas' },
    ],
    outputs: [
      { key: 'totalMomentumInitial', label: 'Momentum Awal Total (p)', unit: 'kg·m/s', formulaLatex: 'p_i = m_1 v_1 + m_2 v_2', precision: 2 },
      { key: 'v1Final', label: 'Kecepatan Akhir Troli 1 (v₁\')', unit: 'm/s', formulaLatex: 'v_1\'', precision: 2 },
      { key: 'v2Final', label: 'Kecepatan Akhir Troli 2 (v₂\')', unit: 'm/s', formulaLatex: 'v_2\'', precision: 2 },
      { key: 'kineticEnergyLoss', label: 'Energi Kinetik Hilang (ΔEk)', unit: 'J', formulaLatex: '\\Delta E_k = E_{k,f} - E_{k,i}', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'restitutionCoeff', yKey: 'kineticEnergyLoss', expectedSlopeMeaning: 'Disipasi Termal vs Elastisitas' },
    preLabQuiz: [
      {
        id: 'coll-q1',
        question: 'Pada peristiwa tumbukan tidak lenting sama sekali (e = 0), apa yang terjadi pada kedua benda setelah bertumbukan?',
        options: ['Kedua benda terpental dengan kecepatan sama ke arah berlawanan', 'Kedua benda bergerak bersama-sama dengan kecepatan yang sama', 'Kedua benda langsung berhenti seketika', 'Energi kinetik sistem bertambah'],
        correctIndex: 1,
        explanation: 'Pada tumbukan tidak lenting sama sekali (e = 0), kedua benda menempel dan bergerak bersama-sama dengan kecepatan akhir yang sama v1\' = v2\'.',
      },
    ],
    computeStep: (params) => {
      const { mass = 2, collisionMass2 = 2, initialVelocity = 4, velocity2Initial = -2, restitutionCoeff = 1 } = params;
      const m1 = mass;
      const m2 = collisionMass2;
      const v1 = initialVelocity;
      const v2 = velocity2Initial;
      const totalMomentumInitial = m1 * v1 + m2 * v2;
      const ekInitial = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
      // 1D Collision formulas with coefficient of restitution e
      const v1Final = (m1 * v1 + m2 * v2 - m2 * restitutionCoeff * (v1 - v2)) / (m1 + m2);
      const v2Final = (m1 * v1 + m2 * v2 + m1 * restitutionCoeff * (v1 - v2)) / (m1 + m2);
      const ekFinal = 0.5 * m1 * v1Final * v1Final + 0.5 * m2 * v2Final * v2Final;
      const kineticEnergyLoss = Math.max(0, ekInitial - ekFinal);
      return { totalMomentumInitial, v1Final, v2Final, kineticEnergyLoss };
    },
  },

  {
    id: 'stokes-viscosity',
    title: 'Viskositas Fluida & Hukum Stokes',
    domain: 'fisika',
    subCategory: 'Mekanika Fluida',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati lambatnya gerakan kelereng saat jatuh dalam cairan kental dibanding air biasa.',
        'Mengenal konsep kekentalan (viskositas) cairan.',
      ],
      SMA: [
        'Mengukur waktu jatuh bola uji dalam kolom cairan gliserin / minyak pelumas.',
        'Menentukan koefisien viskositas zat cair dari kecepatan terminal bola.',
      ],
      Mahasiswa: [
        'Menerapkan koreksi dinding tabung silinder (Koreksi Ladenburg-Faxen).',
        'Menganalisis bilangan Reynolds (Re < 1) untuk memastikan rezim aliran laminar Stokes.',
      ],
    },
    theorySummary:
      'Benda berbentuk bola yang jatuh bebas dalam fluida kental mengalami gaya gesek Stokes Fs = 6πηrv. Ketika gaya berat, gaya apung Archimedes, dan gaya gesek mencapai keseimbangan dinamis, bola bergerak dengan kecepatan konstan yang disebut kecepatan terminal: vt = [2r²(ρb - ρf)g] / (9η).',
    keyEquations: [
      'F_s = 6 \\pi \\eta r v',
      'v_t = \\frac{2 r^2 (\\rho_b - \\rho_f) g}{9 \\eta}',
      '\\eta = \\frac{2 r^2 (\\rho_b - \\rho_f) g}{9 v_t}',
      'Re = \\frac{2 \\rho_f v_t r}{\\eta} < 1',
    ],
    apparatusList: [
      'Tabung viskositas kaca transparan tinggi 1 meter berskala',
      'Fluida uji (Gliserol murni / Minyak SAE 40)',
      'Set kelereng / bola baja kalibrasi berbagai ukuran jari-jari (r = 2mm s.d. 8mm)',
      'Mikrometer sekrup & stopwatch digital / sensor magnetik',
    ],
    safetyNotes: [
      'Bersihkan tumpahan minyak / gliserol segera dari lantai untuk menghindari bahaya licin.',
      'Gunakan penjepit magnet untuk mengambil bola dari dasar tabung tanpa mengotori tangan.',
    ],
    parameters: [
      { key: 'ballRadiusMm', label: 'Jari-jari Bola (r)', unit: 'mm', min: 2, max: 12, step: 0.5, defaultValue: 5, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'ballDensity', label: 'Massa Jenis Bola (ρb)', unit: 'kg/m³', min: 2000, max: 8500, step: 100, defaultValue: 7850, variableRole: 'kontrol' },
      { key: 'fluidDensity', label: 'Massa Jenis Fluida (ρf)', unit: 'kg/m³', min: 800, max: 1400, step: 50, defaultValue: 1260, variableRole: 'kontrol' },
      { key: 'viscosityCoeff', label: 'Viskositas Fluida (η)', unit: 'Pa·s', min: 0.1, max: 2.0, step: 0.05, defaultValue: 0.95, variableRole: 'kontrol' },
      { key: 'tubeHeight', label: 'Ketinggian Jatuh (h)', unit: 'm', min: 0.3, max: 1.2, step: 0.1, defaultValue: 0.8, variableRole: 'kontrol', instrumentType: 'ruler' },
    ],
    outputs: [
      { key: 'terminalVelocity', label: 'Kecepatan Terminal (vt)', unit: 'm/s', formulaLatex: 'v_t = \\frac{2 r^2 (\\rho_b - \\rho_f) g}{9 \\eta}', precision: 3 },
      { key: 'fallTime', label: 'Waktu Tempuh (t)', unit: 's', formulaLatex: 't = h / v_t', precision: 2 },
      { key: 'reynoldsNumber', label: 'Bilangan Reynolds (Re)', unit: '', formulaLatex: 'Re = \\frac{2\\rho_f v_t r}{\\eta}', precision: 4 },
      { key: 'stokesForce', label: 'Gaya Hambat Stokes (Fs)', unit: 'mN', formulaLatex: 'F_s = 6\\pi\\eta r v_t', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'ballRadiusMm', yKey: 'terminalVelocity', expectedSlopeMeaning: 'Kuadratik Terhadap Jari-jari (r²)' },
    preLabQuiz: [
      {
        id: 'stokes-q1',
        question: 'Pada kecepatan terminal, bagaimana perbandingan antara gaya berat benda ke bawah dengan penjumlahan gaya apung dan gaya Stokes ke atas?',
        options: ['Gaya berat lebih besar', 'Gaya berat persis sama dengan gaya apung ditambah gaya gesek Stokes', 'Gaya gesek Stokes menjadi nol', 'Gaya apung lenyap'],
        correctIndex: 1,
        explanation: 'Pada kecepatan terminal, resultan gaya ΣF = 0 (benda tidak lagi dipercepat), sehingga Gaya Berat (W) seimbang sempurna dengan Gaya Apung (Fa) + Gaya Gesek Stokes (Fs).',
      },
    ],
    computeStep: (params) => {
      const { ballRadiusMm = 5, ballDensity = 7850, fluidDensity = 1260, viscosityCoeff = 0.95, tubeHeight = 0.8 } = params;
      const rM = ballRadiusMm / 1000;
      const g = 9.81;
      const deltaRho = Math.max(1, ballDensity - fluidDensity);
      const terminalVelocity = (2 * Math.pow(rM, 2) * deltaRho * g) / (9 * viscosityCoeff);
      const fallTime = tubeHeight / Math.max(0.001, terminalVelocity);
      const reynoldsNumber = (2 * fluidDensity * terminalVelocity * rM) / viscosityCoeff;
      const stokesForce = 6 * Math.PI * viscosityCoeff * rM * terminalVelocity * 1000; // in mN
      return { terminalVelocity, fallTime, reynoldsNumber, stokesForce };
    },
  },

  {
    id: 'ohm-wheatstone',
    title: 'Hukum Ohm, Kirchoff & Jembatan Wheatstone',
    domain: 'fisika',
    subCategory: 'Listrik & Magnet',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Merangkai sirkuit seri-paralel dan membuktikan Hukum Ohm (V = I·R).',
        'Membaca nilai tegangan pada voltmeter dan kuat arus pada amperemeter.',
      ],
      SMA: [
        'Menerapkan Hukum I dan II Kirchoff pada rangkaian majemuk multi-loop.',
        'Mengukur hambatan kawat yang belum diketahui (Rx) menggunakan prinsip jembatan Wheatstone seimbang.',
      ],
      Mahasiswa: [
        'Menganalisis sensitivitas galvanometer terhadap deviasi hambatan dV/dRx.',
        'Mengevaluasi efek pembebanan impedansi internal alat ukur nyata.',
      ],
    },
    theorySummary:
      'Hukum Ohm menyatakan beda potensial pada ujung resistor berbanding lurus dengan arus listrik yang mengalir melaluinya (V = I·R). Jembatan Wheatstone merupakan konfigurasi empat resistor (R1, R2, R3, Rx) yang digunakan untuk mengukur hambatan presisi. Pada kondisi seimbang, tegangan antara dua titik cabang bernilai nol (VG = 0) sehingga berlaku hubungan Rx = R3 · (R1 / R2).',
    keyEquations: [
      'V = I \\cdot R',
      'V_G = V_s \\left( \\frac{R_x}{R_1 + R_x} - \\frac{R_3}{R_2 + R_3} \\right)',
      'R_x = R_3 \\cdot \\frac{R_1}{R_2} \\quad (\\text{saat } V_G = 0)',
      'P = I^2 \\cdot R = \\frac{V^2}{R}',
    ],
    apparatusList: [
      'Catu daya DC tergulasi (Power Supply 0 - 15V)',
      'Papan rangkaian (breadboard) dan kabel jumper konektor banana',
      'Dekade resistor presisi toleransi 0.1% dan resistor geser (rheostat)',
      'Multimeter digital & Galvanometer nol-tengah (Zero-center galvanometer)',
    ],
    safetyNotes: [
      'Jangan menghubungkan kutub positif dan negatif sumber tegangan secara langsung (bahaya hubung singkat / short circuit).',
      'Pastikan sakelar daya utama dalam keadaan OFF saat memasang atau membongkar komponen rangkaian.',
    ],
    parameters: [
      { key: 'sourceVoltage', label: 'Tegangan Sumber (Vs)', unit: 'V', min: 1, max: 24, step: 0.5, defaultValue: 10, variableRole: 'bebas', instrumentType: 'voltmeter' },
      { key: 'resistor1', label: 'Resistor R₁', unit: 'Ω', min: 10, max: 500, step: 10, defaultValue: 100, variableRole: 'kontrol' },
      { key: 'resistor2', label: 'Resistor R₂', unit: 'Ω', min: 10, max: 500, step: 10, defaultValue: 100, variableRole: 'kontrol' },
      { key: 'resistor3', label: 'Resistor Variabel R₃', unit: 'Ω', min: 10, max: 1000, step: 5, defaultValue: 220, variableRole: 'bebas' },
      { key: 'unknownRx', label: 'Hambatan Uji Rₓ', unit: 'Ω', min: 10, max: 1000, step: 5, defaultValue: 220, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'bridgeVoltage', label: 'Beda Potensial Jembatan (VG)', unit: 'mV', formulaLatex: 'V_G', precision: 2 },
      { key: 'calculatedRx', label: 'Estimasi Rx Seimbang', unit: 'Ω', formulaLatex: 'R_x = R_3 (R_1/R_2)', precision: 1 },
      { key: 'totalCurrent', label: 'Arus Total Sirkuit (I)', unit: 'mA', formulaLatex: 'I_{\\text{tot}}', precision: 2 },
      { key: 'bridgeStatus', label: 'Status Keseimbangan', unit: '', formulaLatex: 'V_G \\approx 0', precision: 0 },
    ],
    defaultRegressionAxes: { xKey: 'sourceVoltage', yKey: 'totalCurrent', expectedSlopeMeaning: 'Konduktansi Total Rangkaian (1/R_ekivalen)' },
    preLabQuiz: [
      {
        id: 'wheat-q1',
        question: 'Pada kondisi jembatan Wheatstone seimbang, berapakah arus yang mengalir melalui galvanometer di tengah?',
        options: ['Maksimum', 'Nol', 'Sama dengan arus sumber', 'Bergantung pada suhu kabel'],
        correctIndex: 1,
        explanation: 'Jembatan seimbang tercapai saat beda potensial kedua cabang persis sama (VG = 0), sehingga arus galvanometer IG = 0.',
      },
    ],
    computeStep: (params) => {
      const { sourceVoltage = 10, resistor1 = 100, resistor2 = 100, resistor3 = 220, unknownRx = 220 } = params;
      const vGVolts = sourceVoltage * (unknownRx / (resistor1 + unknownRx) - resistor3 / (resistor2 + resistor3));
      const bridgeVoltage = vGVolts * 1000; // in mV
      const calculatedRx = resistor3 * (resistor1 / resistor2);
      const branch1R = resistor1 + unknownRx;
      const branch2R = resistor2 + resistor3;
      const rEq = (branch1R * branch2R) / (branch1R + branch2R);
      const totalCurrent = (sourceVoltage / rEq) * 1000; // in mA
      const bridgeStatus = Math.abs(bridgeVoltage) < 5 ? 1 : 0;
      return { bridgeVoltage, calculatedRx, totalCurrent, bridgeStatus };
    },
  },

  {
    id: 'optics-young-slit',
    title: 'Meja Optik & Interferensi Celah Ganda Young',
    domain: 'fisika',
    subCategory: 'Optika & Gelombang',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati pola garis-garis terang dan gelap pada layar yang disinari sinar laser.',
        'Mengenal sifat cahaya yang dapat melentur dan berpadu.',
      ],
      SMA: [
        'Mengamati pembentukan pita garis terang dan gelap akibat interferensi gelombang cahaya.',
        'Menghitung jarak antar garis terang (Δy) dan mengaitkannya dengan panjang gelombang laser.',
      ],
      Mahasiswa: [
        'Menganalisis modulasi intensitas perpaduan difraksi celah tunggal dan interferensi celah ganda.',
        'Menentukan panjang gelombang emisi foton sumber laser semikonduktor dengan ketidakpastian baku.',
      ],
    },
    theorySummary:
      'Percobaan celah ganda Thomas Young membuktikan sifat gelombang cahaya. Dua berkas koheren dari celah ganda berjarak d berinterferensi di layar pada jarak L. Pola garis terang maksimum terjadi jika selisih lintasan optik memenuhi d·sin(θ) = m·λ. Untuk sudut kecil, jarak antar pita terang berurutan adalah Δy = (λ·L) / d.',
    keyEquations: [
      'd \\sin(\\theta) = m \\lambda',
      '\\Delta y = \\frac{\\lambda \\cdot L}{d}',
      '\\lambda = \\frac{d \\cdot \\Delta y}{L}',
      'I(\\theta) = I_0 \\cos^2\\left(\\frac{\\pi d \\sin\\theta}{\\lambda}\\right) \\left[\\frac{\\sin(\\pi a \\sin\\theta / \\lambda)}{\\pi a \\sin\\theta / \\lambda}\\right]^2',
    ],
    apparatusList: [
      'Sumber laser dioda monokromatik (Merah 650nm / Hijau 532nm)',
      'Pelat kisi celah ganda presisi (lebar d = 0.1mm - 0.5mm)',
      'Rel optik berskala 2 meter dengan penyangga komponen kaku',
      'Layar pengamatan putih berskala milimeter / sensor intensitas optik',
    ],
    safetyNotes: [
      'BAHAYA RADIASI LASER KELAS 3R: JANGAN PERNAH menatap langsung ke arah sorotan berkas laser atau pantulannya dari cermin!',
      'Gunakan penghalang layar buram di ujung rel optik.',
    ],
    parameters: [
      { key: 'wavelengthNm', label: 'Panjang Gelombang Laser (λ)', unit: 'nm', min: 400, max: 700, step: 10, defaultValue: 650, variableRole: 'kontrol' },
      { key: 'slitDistanceMm', label: 'Jarak Antar Celah (d)', unit: 'mm', min: 0.1, max: 0.8, step: 0.05, defaultValue: 0.25, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'screenDistanceM', label: 'Jarak ke Layar (L)', unit: 'm', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.5, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'slitWidthMm', label: 'Lebar Celah (a)', unit: 'mm', min: 0.02, max: 0.1, step: 0.01, defaultValue: 0.04, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'fringeSpacingMm', label: 'Jarak Antar Terang (Δy)', unit: 'mm', formulaLatex: '\\Delta y = \\frac{\\lambda L}{d}', precision: 3 },
      { key: 'fringeAngleRad', label: 'Sudut Terang Orde 1 (θ₁)', unit: 'mrad', formulaLatex: '\\theta_1 = \\lambda / d', precision: 3 },
      { key: 'envelopeWidthMm', label: 'Lebar Selubung Difraksi (w₀)', unit: 'mm', formulaLatex: 'w_0 = \\frac{2\\lambda L}{a}', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'screenDistanceM', yKey: 'fringeSpacingMm', expectedSlopeMeaning: 'Gradien λ/d (mm/m)' },
    preLabQuiz: [
      {
        id: 'opt-q1',
        question: 'Jika jarak antar kedua celah (d) diperbesar, bagaimanakah jarak antar pola terang (Δy) di layar?',
        options: ['Δy semakin lebar/renggang', 'Δy semakin rapat/sempit', 'Δy tidak berubah', 'Garis terang menghilang total'],
        correctIndex: 1,
        explanation: 'Dari rumus Δy = (λ·L) / d, nilai Δy berbanding terbalik dengan jarak antar celah d. Memperbesar d membuat pita interferensi semakin rapat.',
      },
    ],
    computeStep: (params) => {
      const { wavelengthNm = 650, slitDistanceMm = 0.25, screenDistanceM = 1.5, slitWidthMm = 0.04 } = params;
      const lambdaM = wavelengthNm * 1e-9;
      const dM = slitDistanceMm * 1e-3;
      const aM = slitWidthMm * 1e-3;
      const fringeSpacingMm = ((lambdaM * screenDistanceM) / dM) * 1000;
      const fringeAngleRad = (lambdaM / dM) * 1000; // in mrad
      const envelopeWidthMm = ((2 * lambdaM * screenDistanceM) / aM) * 1000;
      return { fringeSpacingMm, fringeAngleRad, envelopeWidthMm };
    },
  },

  {
    id: 'photoelectric-planck',
    title: 'Efek Fotolistrik & Konstanta Planck',
    domain: 'fisika',
    subCategory: 'Fisika Modern & Kuantum',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 3,
    estimatedMinutes: 45,
    objectives: {
      SMP: [
        'Mengenal bahwa cahaya memiliki energi berupa paket-paket foton.',
        'Mengamati pelepasan muatan listrik akibat radiasi cahaya.',
      ],
      SMA: [
        'Memahami bahwa cahaya tersusun atas kuanta foton berenergi E = h·f.',
        'Mengamati bahwa frekuensi ambang f0 menentukan terjadinya pelepasan elektron, bukan intensitas cahaya.',
      ],
      Mahasiswa: [
        'Menentukan konstanta Planck (h) dan fungsi kerja logam katoda (W0) secara empiris.',
        'Menganalisis kurva arus fotoelektrik terhadap potensial perlambat (stopping potential V0).',
      ],
    },
    theorySummary:
      'Albert Einstein (1905) menjelaskan efek fotolistrik dengan mendalilkan bahwa cahaya terkuantisasi menjadi paket energi foton E = h·f. Jika energi foton melebihi fungsi kerja logam (h·f > W0), elektron foto terlepas dengan energi kinetik maksimum Ek,max = h·f - W0 = e·V0, di mana V0 adalah potensial henti. Grafik V0 terhadap frekuensi f menghasilkan garis lurus dengan kemiringan h/e.',
    keyEquations: [
      'E = h \\cdot f = \\frac{h \\cdot c}{\\lambda}',
      'E_{k,\\max} = h f - W_0 = e \\cdot V_0',
      'V_0 = \\left(\\frac{h}{e}\\right) f - \\frac{W_0}{e}',
      'f_0 = \\frac{W_0}{h}',
    ],
    apparatusList: [
      'Tabung fotolistrik vakum berkatoda Cesium / Kalium dengan jendela kuarsa',
      'Lampu spektrum merkuri bertekanan tinggi dengan filter monokromatik terstandar',
      'Sumber tegangan variabel mikro DC perlambat terbalik',
      'Elektrometer / Pikoamperemeter digital sensitivitas 10⁻¹² A',
    ],
    safetyNotes: [
      'Hindari paparan langsung radiasi ultraviolet lampu merkuri pada mata (gunakan kacamata pelindung UV).',
      'Jangan memegang tabung fotolistrik vakum saat beroperasi karena sensitif terhadap muatan statis dan rentan pecah.',
    ],
    parameters: [
      { key: 'wavelengthNm', label: 'Panjang Gelombang Foton (λ)', unit: 'nm', min: 250, max: 600, step: 10, defaultValue: 400, variableRole: 'bebas', instrumentType: 'voltmeter' },
      { key: 'workFunctionEv', label: 'Fungsi Kerja Logam (W₀)', unit: 'eV', min: 1.8, max: 4.5, step: 0.1, defaultValue: 2.14, variableRole: 'kontrol' },
      { key: 'lightIntensityPct', label: 'Intensitas Berkas Cahaya', unit: '%', min: 10, max: 100, step: 10, defaultValue: 80, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'photonEnergyEv', label: 'Energi Foton (Ef)', unit: 'eV', formulaLatex: 'E_f = hc/\\lambda', precision: 3 },
      { key: 'stoppingPotential', label: 'Potensial Henti (V₀)', unit: 'V', formulaLatex: 'V_0 = (E_f - W_0)/e', precision: 3 },
      { key: 'maxKineticEnergy', label: 'Energi Kinetik Maks (Ek)', unit: 'eV', formulaLatex: 'E_{k,\\max} = e V_0', precision: 3 },
      { key: 'thresholdWavelength', label: 'Panjang Gelombang Ambang (λ₀)', unit: 'nm', formulaLatex: '\\lambda_0 = hc / W_0', precision: 1 },
    ],
    defaultRegressionAxes: { xKey: 'photonEnergyEv', yKey: 'stoppingPotential', expectedSlopeMeaning: 'Rasio Satuan Muatan Elementer (1.00 V/eV)' },
    preLabQuiz: [
      {
        id: 'pe-q1',
        question: 'Apa pengaruh penambahan intensitas cahaya monokromatik (jumlah foton diperbanyak tanpa mengubah frekuensi) terhadap energi kinetik maksimum elektron yang terlepas?',
        options: ['Energi kinetik elektron bertambah', 'Energi kinetik elektron tetap sama, namun jumlah elektron yang terlepas (arus) meningkat', 'Elektron berhenti terlepas', 'Fungsi kerja logam membesar'],
        correctIndex: 1,
        explanation: 'Intensitas cahaya mewakili jumlah foton per detik, bukan energi per foton. Memperbesar intensitas meningkatkan jumlah elektron foto (arus listrik), tetapi Ek,max tetap konstan selama frekuensi cahaya tidak berubah.',
      },
    ],
    computeStep: (params) => {
      const { wavelengthNm = 400, workFunctionEv = 2.14 } = params;
      // hc in eV·nm is approximately 1239.84
      const photonEnergyEv = 1239.84 / wavelengthNm;
      const stoppingPotential = Math.max(0, photonEnergyEv - workFunctionEv);
      const maxKineticEnergy = stoppingPotential; // in eV
      const thresholdWavelength = 1239.84 / workFunctionEv;
      return { photonEnergyEv, stoppingPotential, maxKineticEnergy, thresholdWavelength };
    },
  },

  {
    id: 'gravity-orbital',
    title: 'Gravitasi Universal & Kecepatan Lepas',
    domain: 'fisika',
    subCategory: 'Astrofisika & Gravitasi',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 3,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengenal gaya tarik gravitasi antar benda langit.',
        'Mengamati kecepatan lepas yang dibutuhkan roket untuk keluar dari gravitasi Bumi.',
      ],
      SMA: [
        'Memahami hukum gravitasi universal Newton F = G·m1·m2 / r².',
        'Menghitung kecepatan lepas (escape velocity) dari permukaan berbagai benda langit.',
      ],
      Mahasiswa: [
        'Menganalisis profil sumur potensial gravitasi U(r) dan energi orbital total.',
        'Mengkaji kestabilan orbit elips dan hukum konservasi momentum sudut spesifik.',
      ],
    },
    theorySummary:
      'Gaya tarik gravitasi universal antara dua massa m1 dan m2 berbanding terbalik dengan kuadrat jarak pisahnya. Agar suatu wahana antariksa dapat melepaskan diri dari tarikan gravitasi benda langit tanpa propulsi lanjutan, kecepatannya di permukaan harus mencapai kecepatan lepas ve = √(2·G·M / R).',
    keyEquations: [
      'F_g = G \\frac{m_1 m_2}{r^2}',
      'v_{\\text{orbit}} = \\sqrt{\\frac{G M}{r}}',
      'v_{\\text{lepas}} = \\sqrt{\\frac{2 G M}{R}}',
      'U(r) = -\\frac{G M m}{r}',
    ],
    apparatusList: [
      'Simulator astrodinamika orbital terkalibrasi numerik Runge-Kutta',
      'Basis data massa dan jari-jari planet Tata Surya (Bumi, Bulan, Mars, Jupiter)',
      'Model trajektori ruang angkasa 3 dimensi',
    ],
    safetyNotes: [
      'Pastikan parameter jari-jari orbit r selalu lebih besar dari radius fisik planet R untuk menghindari tabrakan wahana ke permukaan.',
    ],
    parameters: [
      { key: 'secondaryMass', label: 'Massa Benda Sentral (M)', unit: 'x 10²⁴ kg', min: 0.1, max: 2000, step: 10, defaultValue: 5.97, variableRole: 'kontrol' },
      { key: 'separationDistance', label: 'Jari-jari Permukaan (R)', unit: 'x 10³ km', min: 1.0, max: 100.0, step: 0.5, defaultValue: 6.37, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'mass', label: 'Massa Wahana (m)', unit: 'kg', min: 100, max: 10000, step: 100, defaultValue: 1500, variableRole: 'bebas', instrumentType: 'dynamometer' },
    ],
    outputs: [
      { key: 'escapeVelocityKmS', label: 'Kecepatan Lepas (v_esc)', unit: 'km/s', formulaLatex: 'v_e = \\sqrt{2GM/R}', precision: 2 },
      { key: 'orbitalVelocityKmS', label: 'Kecepatan Orbit Melingkar (v_orb)', unit: 'km/s', formulaLatex: 'v_o = \\sqrt{GM/R}', precision: 2 },
      { key: 'surfaceGravity', label: 'Percepatan Gravitasi Permukaan (g)', unit: 'm/s²', formulaLatex: 'g = GM/R^2', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'secondaryMass', yKey: 'escapeVelocityKmS', expectedSlopeMeaning: 'Akar Massa Planet' },
    preLabQuiz: [
      {
        id: 'grav-q1',
        question: 'Berapakah rasio antara kecepatan lepas (v_esc) dengan kecepatan orbit melingkar (v_orb) pada radius yang sama?',
        options: ['1.0', '√2 (sekitar 1.414)', '2.0', '1 / √2'],
        correctIndex: 1,
        explanation: 'Kecepatan lepas v_esc = √(2GM/R) persis sama dengan √2 dikalikan kecepatan orbit melingkar v_orb = √(GM/R).',
      },
    ],
    computeStep: (params) => {
      const { secondaryMass = 5.97, separationDistance = 6.37 } = params;
      const G = 6.6743e-11;
      const massKg = secondaryMass * 1e24;
      const radiusM = separationDistance * 1e6;
      const escapeVelocityKmS = Math.sqrt((2 * G * massKg) / radiusM) / 1000;
      const orbitalVelocityKmS = Math.sqrt((G * massKg) / radiusM) / 1000;
      const surfaceGravity = (G * massKg) / Math.pow(radiusM, 2);
      return { escapeVelocityKmS, orbitalVelocityKmS, surfaceGravity };
    },
  },
];
