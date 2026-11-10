import { ExperimentModule } from '../experimentRegistry';
import {
  calculateEnzymeKinetics,
  calculateLotkaVolterraMetrics,
  calculateCellOsmosisTonicity,
} from '../../utils/scienceEngine';

export const BIOLOGY_MODULES: ExperimentModule[] = [
  {
    id: 'photosynthesis-ingenhousz',
    title: 'Uji Fotosintesis Ingenhousz (Hydrilla verticillata)',
    domain: 'biologi',
    subCategory: 'Fisiologi Tumbuhan',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 1,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Membuktikan bahwa proses fotosintesis tumbuhan menghasilkan gas oksigen (O₂).',
        'Mengamati pengaruh intensitas cahaya matahari terhadap pembentukan gelembung udara.',
      ],
      SMA: [
        'Menganalisis spektrum aksi klorofil (efektivitas panjang gelombang merah dan biru dibandingkan hijau).',
        'Mempelajari pengaruh konsentrasi bikarbonat NaHCO₃ sebagai sumber karbon dioksida terlarut.',
      ],
      Mahasiswa: [
        'Mengkaji hukum faktor pembatas Blackman (cahaya, CO₂, dan suhu enzimatis).',
        'Menghitung laju fiksasi karbon fotokimia dan efisiensi kuantum fotosistem II (PSII).',
      ],
    },
    theorySummary:
      'Jan Ingenhousz (1779) membuktikan bahwa tumbuhan hijau membutuhkan cahaya untuk menghasilkan gas oksigen. Fotosintesis menggabungkan CO₂ dan H₂O menghasilkan glukosa dan O₂ melalui reaksi terang pada tilakoid dan siklus Calvin di stroma. Klorofil a dan b menyerap paling kuat spektrum biru (~430-450 nm) dan merah (~640-660 nm), sementara spektrum hijau dipantulkan.',
    keyEquations: [
      '6 \\text{CO}_2 + 6 \\text{H}_2\\text{O} \\xrightarrow{\\text{cahaya, klorofil}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6 \\text{O}_2',
      '\\text{Laju } O_2 = R_{\\max} \\cdot \\frac{I}{I + K_I} \\cdot \\frac{[\\text{CO}_2]}{[\\text{CO}_2] + K_C} \\cdot f(T)',
      '\\text{Efisiensi Klorofil}(\\lambda) = \\alpha_{\\text{klorofil}}(\\lambda) \\times 100\\%',
      'Q_{10} = \\left( \\frac{R_2}{R_1} \\right)^{10 / (T_2 - T_1)}',
    ],
    apparatusList: [
      'Gelas beker kaca 1000 mL dan corong kaca bertangkai pendek',
      'Tabung reaksi kaca pengumpul gas O₂ terbalik',
      'Kawat penyangga corong dan tanaman air Hydrilla verticillata segar',
      'Lampu halogen / LED spektrum variabel dengan pengatur lux meter',
      'Serbuk Natrium Bikarbonat NaHCO₃ murni dan termometer air',
    ],
    safetyNotes: [
      'Hati-hati saat memasang tabung reaksi terbalik agar tidak pecah dan terisi penuh air tanpa kantung udara awal.',
      'Jauhkan lampu pemanas dari percikan air beker untuk mencegah korsleting listrik.',
    ],
    parameters: [
      { key: 'lightIntensityLux', label: 'Intensitas Cahaya (I)', unit: 'lux', min: 200, max: 2500, step: 100, defaultValue: 1200, variableRole: 'bebas' },
      { key: 'wavelengthNm', label: 'Panjang Gelombang Cahaya (λ)', unit: 'nm', min: 400, max: 700, step: 20, defaultValue: 660, variableRole: 'bebas' },
      { key: 'bicarbonateConc', label: 'Konsentrasi NaHCO₃', unit: 'g/L', min: 0, max: 10, step: 0.5, defaultValue: 2.5, variableRole: 'bebas' },
      { key: 'waterTempC', label: 'Suhu Air Lingkungan (T)', unit: '°C', min: 10, max: 45, step: 1, defaultValue: 28, variableRole: 'kontrol', instrumentType: 'thermometer' },
    ],
    outputs: [
      { key: 'bubbleRatePerMin', label: 'Laju Gelembung O₂', unit: 'gelembung/menit', formulaLatex: 'R_{\\text{bubble}}', precision: 1 },
      { key: 'chlorophyllEfficiencyPct', label: 'Efisiensi Absorpsi Klorofil', unit: '%', formulaLatex: '\\eta_{\\text{abs}}(\\lambda)', precision: 1 },
      { key: 'o2VolumeProducedMl', label: 'Volume O₂ Terkumpul (10 mnt)', unit: 'mL', formulaLatex: 'V_{O_2} = R \\times 0.045', precision: 2 },
      { key: 'limitingFactorCode', label: 'Faktor Pembatas Dominan', unit: '', formulaLatex: '\\min(I, \\text{CO}_2, T)', precision: 0 },
    ],
    defaultRegressionAxes: { xKey: 'lightIntensityLux', yKey: 'bubbleRatePerMin', expectedSlopeMeaning: 'Laju Penjenuhan Foton (Saturasi Cahaya)' },
    preLabQuiz: [
      {
        id: 'bio-q1',
        question: 'Mengapa penambahan serbuk Natrium Bikarbonat (NaHCO₃) ke dalam air dapat meningkatkan laju pembentukan gelembung fotosintesis?',
        options: ['Karena NaHCO₃ menghasilkan gas nitrogen', 'Karena NaHCO₃ terurai dalam air menyuplai gas karbon dioksida (CO₂) terlarut bagi tanaman', 'Karena NaHCO₃ membunuh bakteri air', 'Karena NaHCO₃ mendinginkan suhu air'],
        correctIndex: 1,
        explanation: 'NaHCO₃ larut dan terurai menjadi ion Na⁺ dan HCO₃⁻ yang berkeseimbangan dengan CO₂ bebas terlarut, menjadi substrat utama untuk reaksi fotosintesis Siklus Calvin.',
      },
      {
        id: 'bio-q2',
        question: 'Pada panjang gelombang warna manakah klorofil tumbuhan hijau menunjukkan laju fotosintesis paling RENDAH?',
        options: ['Cahaya Biru (~450 nm)', 'Cahaya Merah (~660 nm)', 'Cahaya Hijau (~530 nm)', 'Cahaya Ungu (~410 nm)'],
        correctIndex: 2,
        explanation: 'Klorofil memantulkan spektrum warna hijau (itulah mengapa daun tampak hijau) dan hanya sedikit menyerapnya, sehingga laju fotosintesis pada cahaya hijau paling rendah.',
      },
    ],
    computeStep: (params) => {
      const { lightIntensityLux = 1200, wavelengthNm = 660, bicarbonateConc = 2.5, waterTempC = 28 } = params;

      // Chlorophyll absorption curve model (peaks at blue ~435nm & red ~660nm, valley at green ~530nm)
      const bluePeak = Math.exp(-Math.pow((wavelengthNm - 435) / 35, 2));
      const redPeak = Math.exp(-Math.pow((wavelengthNm - 660) / 40, 2));
      const chlorophyllEfficiency = Math.min(1.0, 0.12 + 0.88 * Math.max(bluePeak, redPeak));

      // Light saturation factor
      const lightFactor = lightIntensityLux / (lightIntensityLux + 600);

      // CO2 substrate factor
      const co2Factor = (bicarbonateConc + 0.1) / (bicarbonateConc + 1.2);

      // Temperature enzyme optimum factor (~30°C optimum, drops past 40°C)
      let tempFactor = 1.0;
      if (waterTempC < 30) {
        tempFactor = Math.max(0.1, (waterTempC - 10) / 20);
      } else {
        tempFactor = Math.max(0.05, 1.0 - Math.pow((waterTempC - 30) / 14, 2));
      }

      const maxBubbleRate = 95.0; // bubbles per min max
      const bubbleRatePerMin = maxBubbleRate * lightFactor * chlorophyllEfficiency * co2Factor * tempFactor;
      const chlorophyllEfficiencyPct = chlorophyllEfficiency * 100;
      const o2VolumeProducedMl = bubbleRatePerMin * 0.042; // mL in 10 minutes

      return { bubbleRatePerMin, chlorophyllEfficiencyPct, o2VolumeProducedMl, limitingFactorCode: 1 };
    },
  },

  {
    id: 'enzyme-catalase',
    title: 'Kinetika Enzim Katalase Michaelis-Menten',
    domain: 'biologi',
    subCategory: 'Biokimia & Enzimologi',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati pembentukan gelembung busa oksigen saat ekstrak tanaman dicampur hidrogen peroksida.',
        'Mengenal bahwa enzim mempercepat reaksi dalam tubuh makhluk hidup.',
      ],
      SMA: [
        'Mengamati kerja enzim katalase dari ekstrak hati ayam / kentang dalam mendekomposisi H₂O₂.',
        'Menguji pengaruh pH asam, netral, dan basa serta pemanasan terhadap keaktifan enzim.',
      ],
      Mahasiswa: [
        'Menentukan parameter kinetika Michaelis-Menten (Km dan Vmax) menggunakan plot Lineweaver-Burk.',
        'Menganalisis profil stabilitas termal Arrhenius dan denaturasi protein eksponensial saat T > T_opt.',
      ],
    },
    theorySummary:
      'Katalase merupakan enzim antioksidan tetramerik yang mengkatalisis dekomposisi cepat hidrogen peroksida (2 H₂O₂ → 2 H₂O + O₂) dengan laju perputaran kcat yang sangat tinggi (~10⁷ s⁻¹). Laju reaksi mengikuti model kinetika Michaelis-Menten v = (Vmax · [S]) / (Km + [S]) · f(T) · f(pH). Aktivitas katalase memiliki optimum pada pH ~7.0 dan suhu ~37°C; suhu di atas 45°C memicu denaturasi eksponensial struktur tersier protein.',
    keyEquations: [
      '2 \\text{H}_2\\text{O}_2 \\xrightarrow{\\text{Katalase}} 2 \\text{H}_2\\text{O} + \\text{O}_2 \\uparrow',
      'v = \\frac{V_{\\max} [S]}{K_m + [S]} \\cdot f(T) \\cdot f(\\text{pH})',
      '\\frac{1}{v} = \\frac{K_m}{V_{\\max}} \\cdot \\frac{1}{[S]} + \\frac{1}{V_{\\max}} \\quad (\\text{Lineweaver-Burk})',
      'f(\\text{pH}) = \\exp\\left(-\\left(\\frac{\\text{pH} - \\text{pH}_{\\text{opt}}}{\\sigma_{\\text{pH}}}\\right)^2\\right)',
    ],
    apparatusList: [
      'Rak tabung reaksi kaca dan tabung reaksi berskala milimeter',
      'Ekstrak homogenat hati ayam segar / umbi kentang',
      'Larutan Hidrogen Peroksida H₂O₂ berbagai konsentrasi (0.5% s.d. 6.0%)',
      'Larutan HCl 1 M, NaOH 1 M, dan larutan dapar buffer pH 3 sampai 11',
      'Mistar pengukur ketinggian kolom busa dan lidi uji nyala bara api O₂',
    ],
    safetyNotes: [
      'Hidrogen peroksida pekat dapat memutihkan dan membakar kulit: kenakan sarung tangan karet nitril.',
      'Bara api penguji O₂ harus dipegang hati-hati dan dipadamkan di air sebelum dibuang.',
    ],
    parameters: [
      { key: 'substrateConcMm', label: 'Konsentrasi Substrat [H₂O₂]', unit: 'mM', min: 1, max: 25, step: 1, defaultValue: 10, variableRole: 'bebas' },
      { key: 'solutionPH', label: 'Derajat Keasaman (pH)', unit: '', min: 2, max: 12, step: 0.5, defaultValue: 7.0, variableRole: 'bebas' },
      { key: 'temperatureC', label: 'Suhu Inkubasi (T)', unit: '°C', min: 5, max: 75, step: 5, defaultValue: 37, variableRole: 'bebas', instrumentType: 'thermometer' },
      { key: 'enzymeVolumeMl', label: 'Volume Ekstrak Enzim', unit: 'mL', min: 0.5, max: 3.0, step: 0.5, defaultValue: 1.0, variableRole: 'kontrol', instrumentType: 'ruler' },
    ],
    outputs: [
      { key: 'reactionRateV', label: 'Kecepatan Reaksi (v)', unit: 'μmol/(L·s)', formulaLatex: 'v = \\frac{V_{\\max}[S]}{K_m + [S]}', precision: 2 },
      { key: 'foamHeightCm', label: 'Tinggi Kolom Busa O₂', unit: 'cm', formulaLatex: 'h_{\\text{busa}}', precision: 1 },
      { key: 'relativeActivityPct', label: 'Aktivitas Relatif Enzim', unit: '%', formulaLatex: '\\% \\text{Aktivitas}', precision: 1 },
      { key: 'denaturationDegreePct', label: 'Tingkat Denaturasi Termal', unit: '%', formulaLatex: '\\% \\text{Denaturasi}', precision: 1 },
    ],
    defaultRegressionAxes: { xKey: 'substrateConcMm', yKey: 'reactionRateV', expectedSlopeMeaning: 'Plot Kinetika Michaelis-Menten' },
    preLabQuiz: [
      {
        id: 'cat-q1',
        question: 'Mengapa tabung reaksi yang dididihkan (suhu > 65°C) tidak menghasilkan gelembung busa saat ditetesi H₂O₂?',
        options: ['Karena H₂O₂ menguap habis', 'Karena molekul protein enzim katalase terdenaturasi dan sisi aktifnya rusak permanen', 'Karena larutan menjadi terlalu pekat', 'Karena oksigen terserap kembali'],
        correctIndex: 1,
        explanation: 'Enzim adalah protein. Pemanasan suhu tinggi merusak ikatan hidrogen dan struktur tersier/kuartener enzim (denaturasi), sehingga sisi aktif kehilangan kemampuan mengikat substrat.',
      },
    ],
    computeStep: (params) => {
      const { substrateConcMm = 10, solutionPH = 7.0, temperatureC = 37, enzymeVolumeMl = 1.0 } = params;
      const VmaxBase = 120.0 * enzymeVolumeMl;
      const kin = calculateEnzymeKinetics({
        substrateConcMm,
        vMaxBase: VmaxBase,
        kmConstantMm: 4.5,
        temperatureC,
        solutionPh: solutionPH,
      });

      const reactionRateV = kin.reactionVelocityV;
      const foamHeightCm = Math.min(15.0, (reactionRateV / 10.0) * 1.8);
      const relativeActivityPct = Math.min(100, (reactionRateV / VmaxBase) * 100);

      return {
        reactionRateV,
        foamHeightCm,
        relativeActivityPct,
        denaturationDegreePct: kin.denaturationDegreePct,
      };
    },
  },

  {
    id: 'predator-prey-dynamics',
    title: 'Dinamika Populasi Ekosistem Lotka-Volterra',
    domain: 'biologi',
    subCategory: 'Ekologi Kuantitatif & Dinamika Populasi',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 3,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati hubungan rantai makanan antara populasi mangsa (kelinci) dan predator (serigala).',
        'Memahami bagaimana keseimbangan ekosistem terjaga di alam.',
      ],
      SMA: [
        'Menganalisis siklus osilasi populasi mangsa dan predator terhadap waktu.',
        'Mempelajari pengaruh laju reproduksi mangsa (α) dan laju pemangsaan (β) terhadap keseimbangan ekosistem.',
      ],
      Mahasiswa: [
        'Menyelesaikan sistem persamaan diferensial non-linier Lotka-Volterra menggunakan integrasi numerik RK4.',
        'Menentukan titik ekuilibrium koeksistensi (x* = γ/δ, y* = α/β) dan invarian orbit fase H(x,y).',
      ],
    },
    theorySummary:
      'Model persamaan diferensial Lotka-Volterra mendeskripsikan dinamika interaksi biologis dua spesies dalam ekosistem: mangsa (x) dan predator (y). Populasi mangsa tumbuh secara eksponensial dengan laju α bila tidak ada predator, namun berkurang sebanding dengan frekuensi pertemuan x·y (koefisien predasi β). Sebaliknya, populasi predator tumbuh dari konversi biomassa mangsa δ·x·y dan mengalami kematian alami dengan laju γ.',
    keyEquations: [
      '\\frac{dx}{dt} = \\alpha x - \\beta x y',
      '\\frac{dy}{dt} = \\delta x y - \\gamma y',
      'x^* = \\frac{\\gamma}{\\delta}, \\quad y^* = \\frac{\\alpha}{\\beta} \\quad (\\text{Titik Ekuilibrium})',
      'H(x,y) = \\delta x - \\gamma \\ln(x) + \\beta y - \\alpha \\ln(y) = \\text{konstan}',
    ],
    apparatusList: [
      'Simulator Bioreaktor Ekologi & Pencacah Populasi Telemetri GPS',
      'Grafik Ruang Fase (Phase-Portrait) Predator vs Mangsa',
      'Sensor Kepadatan Biomassa & Laju Pertumbuhan Spesies',
    ],
    safetyNotes: [
      'Jaga parameter laju predasi β agar tidak melampaui ambang kepunahan mendadak (ecological collapse).',
      'Catat minimal 3 kombinasi kepadatan populasi untuk memetakan potret ruang fase.',
    ],
    parameters: [
      { key: 'preyPopulationX', label: 'Populasi Awal Mangsa (x)', unit: 'individu', min: 5, max: 120, step: 5, defaultValue: 40, variableRole: 'bebas' },
      { key: 'predatorPopulationY', label: 'Populasi Awal Predator (y)', unit: 'individu', min: 2, max: 50, step: 1, defaultValue: 9, variableRole: 'bebas' },
      { key: 'preyGrowthRateAlpha', label: 'Laju Tumbuh Mangsa (α)', unit: '/tahun', min: 0.2, max: 2.5, step: 0.1, defaultValue: 1.1, variableRole: 'kontrol' },
      { key: 'predationRateBeta', label: 'Koefisien Predasi (β)', unit: '', min: 0.01, max: 0.12, step: 0.01, defaultValue: 0.04, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'dPreyDt', label: 'Laju Perubahan Mangsa (dx/dt)', unit: 'ind/thn', formulaLatex: '\\alpha x - \\beta xy', precision: 2 },
      { key: 'dPredatorDt', label: 'Laju Perubahan Predator (dy/dt)', unit: 'ind/thn', formulaLatex: '\\delta xy - \\gamma y', precision: 2 },
      { key: 'equilibriumPreyX', label: 'Ekuilibrium Mangsa (x*)', unit: 'individu', formulaLatex: '\\gamma / \\delta', precision: 1 },
      { key: 'equilibriumPredatorY', label: 'Ekuilibrium Predator (y*)', unit: 'individu', formulaLatex: '\\alpha / \\beta', precision: 1 },
    ],
    defaultRegressionAxes: { xKey: 'preyPopulationX', yKey: 'dPreyDt', expectedSlopeMeaning: 'Gradien Pertumbuhan Bersih Mangsa' },
    preLabQuiz: [
      {
        id: 'lv-q1',
        question: 'Dalam sistem Lotka-Volterra, apa yang terjadi pada laju perubahan populasi mangsa (dx/dt) tepat ketika jumlah predator y sama dengan α / β?',
        options: ['Populasi mangsa meledak tak terbatas', 'Laju perubahan populasi mangsa dx/dt = 0 (titik stasioner/ekuilibrium)', 'Populasi predator langsung punah', 'Laju kelahiran mangsa α menjadi nol'],
        correctIndex: 1,
        explanation: 'Substitusi y = α/β ke dalam dx/dt = x(α - βy) menghasilkan dx/dt = x(α - α) = 0, yaitu kondisi kesetimbangan populasi mangsa.',
      },
    ],
    computeStep: (params) => {
      const {
        preyPopulationX = 40,
        predatorPopulationY = 9,
        preyGrowthRateAlpha = 1.1,
        predationRateBeta = 0.04,
        predatorReproductionDelta = 0.01,
        predatorMortalityGamma = 0.4,
      } = params;

      const lv = calculateLotkaVolterraMetrics({
        preyPopulationX,
        predatorPopulationY,
        preyGrowthRateAlpha,
        predationRateBeta,
        predatorReproductionDelta,
        predatorMortalityGamma,
      });

      return {
        dPreyDt: lv.dPreyDt,
        dPredatorDt: lv.dPredatorDt,
        equilibriumPreyX: lv.equilibriumPreyX,
        equilibriumPredatorY: lv.equilibriumPredatorY,
      };
    },
  },

  {
    id: 'osmosis-plasmolysis',
    title: 'Potensial Air & Osmosis Membran Sel Tumbuhan',
    domain: 'biologi',
    subCategory: 'Biologi Sel & Membran',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati perubahan kekakuan dan massa irisan kentang dalam larutan gula berkonsentrasi berbeda.',
        'Mengenal konsep perpindahan molekul air melalui selaput semipermeabel (osmosis).',
      ],
      SMA: [
        'Menentukan konsentrasi larutan sukrosa yang isotonik dengan cairan sel tumbuhan.',
        'Mengamati peristiwa plasmolisis sel daun Rhoeo discolor di bawah mikroskop.',
      ],
      Mahasiswa: [
        'Menghitung potensial osmotik solut (Ψs) menggunakan persamaan van \'t Hoff (Π = i·M·R·T).',
        'Menganalisis kurva tekanan turgor sel (Ψp) dan fluks air bersih melintasi membran semipermeabel.',
      ],
    },
    theorySummary:
      'Osmosis adalah difusi neto molekul pelarut (air) melintasi membran semipermeabel dari daerah berpotensial air tinggi ke daerah berpotensial air rendah. Pada lingkungan hipertonik, air keluar dari vakuola sel menyebabkan sitoplasma menyusut dan membran plasma terlepas dari dinding sel (plasmolisis). Pada larutan isotonik, potensial air di dalam dan di luar sel seimbang sehingga tidak terjadi perubahan massa netto.',
    keyEquations: [
      '\\Psi_w = \\Psi_s + \\Psi_p',
      '\\Pi = i \\cdot M \\cdot R \\cdot T \\quad (\\text{Persamaan van \'t Hoff})',
      '\\% \\Delta m = \\frac{m_{\\text{akhir}} - m_{\\text{awal}}}{m_{\\text{awal}}} \\times 100\\%',
      '\\text{Turgor } \\Psi_p = \\max(0, \\Psi_w - \\Psi_s)',
    ],
    apparatusList: [
      'Satu set cawan petri kaca dan pisau pelubang gabus silinder kentang (cork borer)',
      'Timbangan analitik digital ketelitian 0.001 gram',
      'Larutan sukrosa murni konsentrasi 0.0 M (aquades), 0.2 M, 0.4 M, 0.6 M, 0.8 M, dan 1.0 M',
      'Mikroskop cahaya biokuler dan preparat sayatan epidermis bawah daun Rhoeo discolor',
    ],
    safetyNotes: [
      'Hati-hati saat menggunakan pisau pemotong atau pembuat silinder kentang agar tidak melukai jari.',
      'Keringkan permukaan silinder kentang dengan kertas isap secara lembut sebelum ditimbang.',
    ],
    parameters: [
      { key: 'sucroseConcMolar', label: 'Konsentrasi Sukrosa Luar (C)', unit: 'M', min: 0.0, max: 1.0, step: 0.1, defaultValue: 0.3, variableRole: 'bebas' },
      { key: 'solutionTempC', label: 'Suhu Larutan (T)', unit: '°C', min: 15, max: 40, step: 1, defaultValue: 25, variableRole: 'kontrol', instrumentType: 'thermometer' },
      { key: 'tissueInitialMassG', label: 'Massa Awal Jaringan (m₀)', unit: 'g', min: 1.0, max: 5.0, step: 0.5, defaultValue: 2.5, variableRole: 'kontrol', instrumentType: 'dynamometer' },
    ],
    outputs: [
      { key: 'solutePotentialMpa', label: 'Potensial Solut Larutan (Ψs)', unit: 'MPa', formulaLatex: '\\Psi_s = -iCRT', precision: 3 },
      { key: 'massChangePct', label: 'Perubahan Massa Jaringan (Δm)', unit: '%', formulaLatex: '\\%\\Delta m', precision: 2 },
      { key: 'plasmolyzedCellsPct', label: 'Persentase Sel Terplasmolisis', unit: '%', formulaLatex: '\\% \\text{Plasmolisis}', precision: 1 },
      { key: 'cellTurgorState', label: 'Kondisi Turgor Sel (1:Turgid, 0:Plasmolisis)', unit: '', formulaLatex: '\\text{Status}', precision: 0 },
    ],
    defaultRegressionAxes: { xKey: 'sucroseConcMolar', yKey: 'massChangePct', expectedSlopeMeaning: 'Titik Potong Isotonik (Δm = 0%)' },
    preLabQuiz: [
      {
        id: 'osm-q1',
        question: 'Ketika sel tumbuhan dimasukkan ke dalam larutan gula pekat 1.0 M (sangat hipertonik), apa yang terjadi pada sel tersebut?',
        options: ['Sel menggembung hingga pecah (lisis)', 'Air masuk ke dalam vakuola sel', 'Air keluar dari sel sehingga membran plasma terlepas dari dinding sel (plasmolisis)', 'Dinding sel ikut menyusut hingga pipih'],
        correctIndex: 2,
        explanation: 'Dinding selulosa sel tumbuhan kaku dan mempertahankan bentuk luar, namun air keluar secara osmosis dari sitoplasma/vakuola ke larutan hipertonik sehingga membran sel mengerut lepas dari dinding sel (peristiwa plasmolisis).',
      },
    ],
    computeStep: (params) => {
      const { sucroseConcMolar = 0.3, solutionTempC = 25 } = params;
      const osm = calculateCellOsmosisTonicity({
        intracellularMolarityM: 0.28,
        extracellularMolarityM: sucroseConcMolar,
        temperatureC: solutionTempC,
        hasCellWall: true,
      });

      const solutePotentialMpa = -osm.osmoticPressureExtMpa;
      const isotonicConc = 0.28;
      const deltaC = isotonicConc - sucroseConcMolar;
      const massChangePct = deltaC * 22.0;

      let plasmolyzedCellsPct = 0;
      if (sucroseConcMolar > isotonicConc) {
        plasmolyzedCellsPct = Math.min(100, ((sucroseConcMolar - isotonicConc) / (1.0 - isotonicConc)) * 100);
      }

      const cellTurgorState = massChangePct >= 0 ? 1 : 0;
      return { solutePotentialMpa, massChangePct, plasmolyzedCellsPct, cellTurgorState };
    },
  },
];
