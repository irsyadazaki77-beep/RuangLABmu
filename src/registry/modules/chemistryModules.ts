import { ExperimentModule } from '../experimentRegistry';

export const CHEMISTRY_MODULES: ExperimentModule[] = [
  {
    id: 'thermo-calorimetry',
    title: 'Kalorimetri & Termokimia Netralisasi',
    domain: 'kimia',
    subCategory: 'Termokimia',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 1,
    estimatedMinutes: 30,
    objectives: {
      SMP: [
        'Mengamati kenaikan suhu pada reaksi eksotermik antara asam dan basa.',
        'Menyimpulkan bahwa reaksi kimia dapat melepas kalor ke lingkungan.',
      ],
      SMA: [
        'Menghitung perubahan entalpi reaksi standar (ΔH) berdasarkan q = m·c·ΔT.',
        'Menganalisis hukum kekekalan energi kalorimetri (q_reaksi + q_larutan + q_kalorimeter = 0).',
      ],
      Mahasiswa: [
        'Menghitung perubahan energi bebas Gibbs (ΔG) dan entropi reaksi (ΔS).',
        'Mengevaluasi kapasitas kalor kalorimeter (C_kal) dan koreksi pertukaran panas radiasi Newton.',
      ],
    },
    theorySummary:
      'Kalorimetri larutan mengukur perpindahan kalor reaksi kimia pada tekanan konstan (qp = ΔH). Reaksi netralisasi asam kuat HCl dengan basa kuat NaOH bersifat eksotermik pekat dengan entalpi netralisasi molar standar ΔH°_netral ≈ -57.3 kJ/mol. Kenaikan suhu larutan terukur memungkinkan penentuan kalor spesifik dan spontanitas termodinamika ΔG = ΔH - TΔS.',
    keyEquations: [
      'q = m \\cdot c \\cdot \\Delta T',
      '\\Delta H = -\\frac{q_{\\text{larutan}}}{n_{\\text{reaksi}}}',
      '\\Delta G = \\Delta H - T \\Delta S',
      '\\Delta T = T_{\\text{akhir}} - T_{\\text{awal}}',
    ],
    apparatusList: [
      'Kalorimeter cangkir stirofoam berdinding ganda dengan tutup isolator',
      'Termometer digital presisi 0.1 °C / sensor suhu nirkabel',
      'Gelas ukur kaca 100 mL dan pengaduk magnetik (magnetic stirrer)',
      'Larutan HCl 1.0 M & larutan NaOH 1.0 M terstandarisasi',
    ],
    safetyNotes: [
      'Asam klorida dan natrium hidroksida bersifat korosif: gunakan jas laboratorium, sarung tangan nitril, dan kacamata pengaman.',
      'Jika larutan terkena kulit, segera bilas dengan air mengalir selama minimal 15 menit.',
    ],
    parameters: [
      { key: 'solutionVolumeMl', label: 'Volume Larutan Total (V)', unit: 'mL', min: 100, max: 500, step: 25, defaultValue: 250, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'reactantConcentration', label: 'Konsentrasi Reaktan (M)', unit: 'M', min: 0.5, max: 3.0, step: 0.25, defaultValue: 1.5, variableRole: 'bebas' },
      { key: 'initialTempC', label: 'Suhu Awal (T₀)', unit: '°C', min: 15, max: 35, step: 1, defaultValue: 25, variableRole: 'kontrol', instrumentType: 'thermometer' },
      { key: 'stirringRpm', label: 'Kecepatan Pengadukan', unit: 'RPM', min: 60, max: 600, step: 20, defaultValue: 240, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'deltaH', label: 'Perubahan Entalpi (ΔH)', unit: 'kJ/mol', formulaLatex: '\\Delta H', precision: 2 },
      { key: 'finalTempC', label: 'Suhu Akhir Campuran (Tf)', unit: '°C', formulaLatex: 'T_f = T_0 + \\Delta T', precision: 2 },
      { key: 'deltaG', label: 'Energi Bebas Gibbs (ΔG)', unit: 'kJ/mol', formulaLatex: '\\Delta G = \\Delta H - T\\Delta S', precision: 2 },
      { key: 'heatReleasedJ', label: 'Kalor Dilepas (q)', unit: 'kJ', formulaLatex: 'q = m c \\Delta T', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'reactantConcentration', yKey: 'heatReleasedJ', expectedSlopeMeaning: 'Kalor Molar Spesifik (kJ/M)' },
    preLabQuiz: [
      {
        id: 'thermo-q1',
        question: 'Pada reaksi eksotermik di dalam kalorimeter, apakah tanda matematis dari perubahan entalpi (ΔH) reaksi?',
        options: ['Positif (ΔH > 0)', 'Negatif (ΔH < 0)', 'Selalu nol', 'Tidak tentu'],
        correctIndex: 1,
        explanation: 'Reaksi eksotermik melepaskan kalor ke lingkungan (larutan memanas), sehingga entalpi sistem berkurang: ΔH bernilai negatif (ΔH < 0).',
      },
    ],
    computeStep: (params) => {
      const { solutionVolumeMl = 250, reactantConcentration = 1.5, initialTempC = 25 } = params;
      const cWater = 4.184; // J/(g·°C)
      const massG = solutionVolumeMl; // density approx 1 g/mL
      const moles = (solutionVolumeMl / 2 / 1000) * reactantConcentration;
      const deltaH = -57.3; // kJ/mol for strong acid-base
      const heatReleasedJ = Math.abs(deltaH * moles); // in kJ
      const deltaT = (heatReleasedJ * 1000) / (massG * cWater);
      const finalTempC = initialTempC + deltaT;
      const deltaS = 0.0805; // kJ/(mol·K)
      const tempK = finalTempC + 273.15;
      const deltaG = deltaH - tempK * deltaS;
      return { deltaH, finalTempC, deltaG, heatReleasedJ };
    },
  },

  {
    id: 'acid-base-titration',
    title: 'Titrasi Asam-Basa & Kurva pH Sigmoidal',
    domain: 'kimia',
    subCategory: 'Kimia Analitik',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati perubahan warna indikator asam-basa (fenolftalein) saat mencapai titik akhir.',
        'Mengenal skala pH larutan asam (pH < 7) dan basa (pH > 7).',
      ],
      SMA: [
        'Menentukan konsentrasi asam yang tidak diketahui melalui titrasi volumetri asam-basa.',
        'Memplot kurva titrasi sigmoidal dan mengidentifikasi titik ekuivalen stoikiometri.',
      ],
      Mahasiswa: [
        'Menganalisis kapasitas penyangga (buffer index β) pada daerah setengah ekuivalen (pH = pKa).',
        'Menghitung turunan pertama dan kedua kurva pH (metode Gran Plot) untuk menentukan titik infleksi akurat.',
      ],
    },
    theorySummary:
      'Titrasi asam-basa merupakan metode analisis volumetri kuantitatif untuk menentukan konsentrasi larutan analit melalui reaksi netralisasi bertahap dengan titran berkonsentrasi standar. Profil penambahan titran menghasilkan kurva pH sigmoidal. Pada titik ekuivalen asam kuat-basa kuat, mol H⁺ tepat bereaksi habis dengan mol OH⁻ menghasilkan pH netral 7.00.',
    keyEquations: [
      'M_a \\cdot V_a \\cdot n_a = M_b \\cdot V_b \\cdot n_b',
      '\\text{pH} = -\\log[H^+]',
      '\\text{pH} = pK_a + \\log\\left( \\frac{[A^-]}{[HA]} \\right) \\quad (\\text{Henderson-Hasselbalch})',
      'K_w = [H^+][OH^-] = 1.0 \\times 10^{-14}',
    ],
    apparatusList: [
      'Buret kaca kelas A berskala 50 mL dengan kran teflon',
      'Erlenmeyer 250 mL dan pipet volumetri 25.0 mL',
      'pH meter digital terkalibrasi dua titik (buffer pH 4.01 dan 7.00)',
      'Indikator warna fenolftalein (trayek pH 8.2 - 10.0)',
    ],
    safetyNotes: [
      'Bilas buret dengan titran NaOH sebelum pengisian untuk menghindari pengenceran oleh sisa air suling.',
      'Gunakan corong kaca saat mengisi buret dan pastikan tidak ada gelembung udara pada ujung buret.',
    ],
    parameters: [
      { key: 'analyteAcidConc', label: 'Konsentrasi Asam Analit (Ma)', unit: 'M', min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.2, variableRole: 'kontrol', instrumentType: 'burette' },
      { key: 'analyteVolumeMl', label: 'Volume Asam Analit (Va)', unit: 'mL', min: 10, max: 50, step: 5, defaultValue: 25, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'titrantBaseConc', label: 'Konsentrasi Basa Titran (Mb)', unit: 'M', min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.25, variableRole: 'kontrol' },
      { key: 'titrantAddedMl', label: 'Volume Titran Ditambahkan (Vb)', unit: 'mL', min: 0, max: 50, step: 0.5, defaultValue: 20, variableRole: 'bebas', instrumentType: 'burette' },
    ],
    outputs: [
      { key: 'calculatedPH', label: 'Nilai pH Larutan', unit: '', formulaLatex: '\\text{pH}', precision: 2 },
      { key: 'equivVolumeMl', label: 'Volume Titik Ekuivalen (V_eq)', unit: 'mL', formulaLatex: 'V_{\\text{eq}} = \\frac{M_a V_a}{M_b}', precision: 2 },
      { key: 'hPlusConc', label: 'Konsentrasi [H⁺]', unit: 'mol/L', formulaLatex: '[H^+]', precision: 6 },
    ],
    defaultRegressionAxes: { xKey: 'titrantAddedMl', yKey: 'calculatedPH', expectedSlopeMeaning: 'Kurva Sigmoidal Lonjakan Ekuivalen' },
    preLabQuiz: [
      {
        id: 'titr-q1',
        question: 'Pada titrasi asam kuat (HCl) dengan basa kuat (NaOH), berapakah nilai pH teoretis tepat pada titik ekuivalen pada 25°C?',
        options: ['pH = 4.0', 'pH = 7.0 (netral)', 'pH = 9.0', 'pH = 12.0'],
        correctIndex: 1,
        explanation: 'Garam NaCl yang terbentuk berasal dari asam kuat dan basa kuat sehingga tidak mengalami hidrolisis. Tepat di titik ekuivalen, konsentrasi [H+] = [OH-] = 10^-7 M sehingga pH = 7.00.',
      },
    ],
    computeStep: (params) => {
      const { analyteAcidConc = 0.2, analyteVolumeMl = 25, titrantBaseConc = 0.25, titrantAddedMl = 20 } = params;
      const equivVolumeMl = (analyteAcidConc * analyteVolumeMl) / titrantBaseConc;
      const totalVolume = analyteVolumeMl + titrantAddedMl;
      let calculatedPH = 7.0;
      let hPlusConc = 1e-7;

      if (titrantAddedMl < equivVolumeMl - 0.01) {
        const remainingAcidMoles = (analyteAcidConc * analyteVolumeMl - titrantBaseConc * titrantAddedMl) / 1000;
        hPlusConc = remainingAcidMoles / (totalVolume / 1000);
        calculatedPH = -Math.log10(Math.max(1e-14, hPlusConc));
      } else if (titrantAddedMl > equivVolumeMl + 0.01) {
        const excessBaseMoles = (titrantBaseConc * (titrantAddedMl - equivVolumeMl)) / 1000;
        const ohConc = excessBaseMoles / (totalVolume / 1000);
        const pOH = -Math.log10(Math.max(1e-14, ohConc));
        calculatedPH = 14.0 - pOH;
        hPlusConc = Math.pow(10, -calculatedPH);
      } else {
        calculatedPH = 7.0;
        hPlusConc = 1e-7;
      }

      return { calculatedPH, equivVolumeMl, hPlusConc };
    },
  },

  {
    id: 'redox-electrochemistry',
    title: 'Sel Volta & Elektrokimia Nernst',
    domain: 'kimia',
    subCategory: 'Elektrokimia',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati pembentukan arus listrik dari reaksi kimia (baterai buah / sel Sederhana).',
        'Mengenal kutub positif (katoda) dan kutub negatif (anoda).',
      ],
      SMA: [
        'Merangkai sel Volta Daniell (Zn|Zn²⁺ || Cu²⁺|Cu) dengan jembatan garam.',
        'Mengukur potensial sel standar (E°_sel) dan membandingkannya dengan deret kereaktifan logam Volt.',
      ],
      Mahasiswa: [
        'Menganalisis ketergantungan potensial sel terhadap rasio konsentrasi melalui Persamaan Nernst.',
        'Menentukan konstanta kesetimbangan redoks K_eq dan koefisien aktivitas ion Debye-Hückel.',
      ],
    },
    theorySummary:
      'Sel elektrokimia Volta mengubah energi bebas reaksi redoks spontan menjadi energi listrik. Pada sel Daniell, seng mengalami oksidasi di anoda (Zn → Zn²⁺ + 2e⁻, E° = -0.76 V) dan tembaga mengalami reduksi di katoda (Cu²⁺ + 2e⁻ → Cu, E° = +0.34 V). Persamaan Nernst mengkoreksi potensial sel nyata berdasarkan rasio konsentrasi ion.',
    keyEquations: [
      'E^\\circ_{\\text{sel}} = E^\\circ_{\\text{katoda}} - E^\\circ_{\\text{anoda}}',
      'E_{\\text{sel}} = E^\\circ_{\\text{sel}} - \\frac{RT}{nF} \\ln(Q)',
      'E_{\\text{sel}} = E^\\circ_{\\text{sel}} - \\frac{0.0592}{n} \\log\\left( \\frac{[\\text{Zn}^{2+}]}{[\\text{Cu}^{2+}]} \\right) \\quad (T = 298\\text{ K})',
      '\\Delta G = -n F E_{\\text{sel}}',
    ],
    apparatusList: [
      'Dua gelas kimia 100 mL dan pipa kaca U jembatan garam (agar-agar KCl/KNO3 jenuh)',
      'Elektroda pelat logam seng (Zn) dan tembaga murni (Cu)',
      'Larutan ZnSO4 dan CuSO4 berbagai konsentrasi (0.01 M s.d. 2.0 M)',
      'Voltmeter digital impedansi tinggi (10 MΩ)',
    ],
    safetyNotes: [
      'Garam tembaga beracun bagi organisme akuatik; tampung limbah larutan tembaga ke dalam jeriken limbah B3 khusus.',
      'Amplas permukaan pelat elektroda dengan kertas gosok halus sebelum digunakan untuk menghilangkan lapisan oksida.',
    ],
    parameters: [
      { key: 'anodeConcM', label: 'Konsentrasi Anoda [Zn²⁺]', unit: 'M', min: 0.01, max: 2.0, step: 0.05, defaultValue: 0.1, variableRole: 'bebas', instrumentType: 'voltmeter' },
      { key: 'cathodeConcM', label: 'Konsentrasi Katoda [Cu²⁺]', unit: 'M', min: 0.01, max: 2.0, step: 0.05, defaultValue: 1.0, variableRole: 'kontrol', instrumentType: 'voltmeter' },
    ],
    outputs: [
      { key: 'cellPotential', label: 'Potensial Sel Terukur (E_sel)', unit: 'V', formulaLatex: 'E_{\\text{sel}} = E^\\circ - \\frac{0.0592}{2}\\log Q', precision: 3 },
      { key: 'stdCellPotential', label: 'Potensial Standar (E°_sel)', unit: 'V', formulaLatex: 'E^\\circ_{\\text{sel}} = 1.10\\text{ V}', precision: 3 },
      { key: 'gibbsEnergyKj', label: 'Energi Gibbs Sel (ΔG)', unit: 'kJ/mol', formulaLatex: '\\Delta G = -nFE_{\\text{sel}}', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'anodeConcM', yKey: 'cellPotential', expectedSlopeMeaning: 'Gradien Logaritmik Nernst (-0.0296 V/dekade)' },
    preLabQuiz: [
      {
        id: 'redox-q1',
        question: 'Pada sel Volta, di manakah proses oksidasi berlangsung?',
        options: ['Di Anoda (kutub negatif)', 'Di Katoda (kutub positif)', 'Di dalam jembatan garam', 'Di voltmeter'],
        correctIndex: 0,
        explanation: 'Menurut akronim standar AnOx-RedCat: Anoda adalah elektroda tempat terjadinya Oksidasi, sedangkan Katoda adalah tempat terjadinya Reduksi.',
      },
    ],
    computeStep: (params) => {
      const { anodeConcM = 0.1, cathodeConcM = 1.0 } = params;
      const stdCellPotential = 1.10; // Zn-Cu Daniell standard
      const Q = Math.max(1e-4, anodeConcM) / Math.max(1e-4, cathodeConcM);
      const cellPotential = stdCellPotential - (0.0592 / 2) * Math.log10(Q);
      const n = 2;
      const F = 96485; // C/mol
      const gibbsEnergyKj = (-n * F * cellPotential) / 1000;
      return { cellPotential, stdCellPotential, gibbsEnergyKj };
    },
  },

  {
    id: 'ideal-gas-boyle',
    title: 'Hukum Gas Ideal & Kompresi Termodinamika',
    domain: 'kimia',
    subCategory: 'Kimia Fisika & Termodinamika',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati perubahan tekanan gas saat volume silinder diperkecil pada suhu tetap (Hukum Boyle).',
        'Memahami bahwa gas dapat ditekan (kompresibel) tidak seperti zat padat atau cair.',
      ],
      SMA: [
        'Membuktikan persamaan keadaan gas ideal P·V = n·R·T secara grafis (P vs 1/V).',
        'Membedakan proses kompresi isotermal (T konstan) dan adiabatik (tanpa pertukaran kalor Q = 0).',
      ],
      Mahasiswa: [
        'Menerapkan persamaan keadaan Van der Waals (P + a/V²)(V - b) = RT untuk gas nyata.',
        'Menghitung kerja ekspansi/kompresi terbalikkan W = -∫ P dV.',
      ],
    },
    theorySummary:
      'Hukum Gas Ideal menyatakan hubungan fundamental antara tekanan (P), volume (V), jumlah partikel mol (n), dan suhu mutlak (T): P·V = n·R·T dengan R = 8.314 J/(mol·K). Pada proses isotermal, kurva P terhadap V membentuk hiperbola persegi P ∝ 1/V. Pada proses adiabatik, tekanan meningkat lebih tajam mengikuti hubungan P·V^γ = konstan.',
    keyEquations: [
      'P \\cdot V = n R T',
      'P = \\frac{n R T}{V}',
      'P V^\\gamma = \\text{konstan} \\quad (\\gamma = C_p / C_v \\approx 1.40)',
      'W_{\\text{isotermal}} = -n R T \\ln\\left(\\frac{V_2}{V_1}\\right)',
    ],
    apparatusList: [
      'Silinder gas berdinding tebal dengan piston kedap gesekan rendah',
      'Sensor tekanan digital terkalibrasi (barometer / manometer presisi)',
      'Pemandas termostatik suhu konstan terprogram',
      'Sensor pergeseran piston linear pengukur volume V',
    ],
    safetyNotes: [
      'Jangan menaikkan tekanan gas melebihi 5 atmosfer untuk mencegah kebocoran seal piston.',
      'Pastikan katup pelepas darurat beroperasi normal sebelum memulai kompresi cepat.',
    ],
    parameters: [
      { key: 'moles', label: 'Jumlah Mol Gas (n)', unit: 'mol', min: 0.1, max: 2.0, step: 0.1, defaultValue: 1.0, variableRole: 'kontrol' },
      { key: 'temperatureK', label: 'Suhu Gas (T)', unit: 'K', min: 250, max: 550, step: 10, defaultValue: 300, variableRole: 'kontrol', instrumentType: 'thermometer' },
      { key: 'volumeL', label: 'Volume Silinder (V)', unit: 'L', min: 2.0, max: 25.0, step: 0.5, defaultValue: 10.0, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'isAdiabatic', label: 'Modus Proses (0: Isotermal, 1: Adiabatik)', unit: '', min: 0, max: 1, step: 1, defaultValue: 0, variableRole: 'bebas' },
    ],
    outputs: [
      { key: 'pressureAtm', label: 'Tekanan Gas (P)', unit: 'atm', formulaLatex: 'P = \\frac{nRT}{V}', precision: 3 },
      { key: 'pressureKpa', label: 'Tekanan Gas (P)', unit: 'kPa', formulaLatex: 'P_{\\text{SI}}', precision: 1 },
      { key: 'internalEnergyJ', label: 'Energi Dalam Gas (U)', unit: 'J', formulaLatex: 'U = \\frac{3}{2} n R T', precision: 1 },
      { key: 'gasDensity', label: 'Massa Jenis Gas (ρ_gas)', unit: 'g/L', formulaLatex: '\\rho = \\frac{P M}{R T}', precision: 3 },
    ],
    defaultRegressionAxes: { xKey: 'volumeL', yKey: 'pressureAtm', expectedSlopeMeaning: 'Invers Hiperbolik (Hukum Boyle)' },
    preLabQuiz: [
      {
        id: 'gas-q1',
        question: 'Jika suatu gas ideal mengalami kompresi isotermal sehingga volumenya menyusut menjadi 1/2 dari volume awal, apa yang terjadi pada tekanannya?',
        options: ['Tekanan berkurang menjadi 1/2 kali', 'Tekanan berlipat ganda menjadi 2 kali lipat', 'Tekanan tetap sama', 'Tekanan menjadi 4 kali lipat'],
        correctIndex: 1,
        explanation: 'Pada proses isotermal (suhu tetap), P1·V1 = P2·V2. Jika volume menjadi 1/2 kali, maka tekanan P2 harus menjadi 2 kali lipat tekanan mula-mula.',
      },
    ],
    computeStep: (params) => {
      const { moles = 1.0, temperatureK = 300, volumeL = 10.0, isAdiabatic = 0 } = params;
      const R_L_atm = 0.08206; // L·atm/(mol·K)
      const R_SI = 8.314; // J/(mol·K)
      let pressureAtm = (moles * R_L_atm * temperatureK) / Math.max(0.1, volumeL);
      if (isAdiabatic === 1) {
        // Adiabatic exponent gamma for diatomic air ~ 1.4
        const gamma = 1.4;
        const vRef = 10.0;
        pressureAtm = pressureAtm * Math.pow(vRef / Math.max(0.1, volumeL), gamma - 1);
      }
      const pressureKpa = pressureAtm * 101.325;
      const internalEnergyJ = 1.5 * moles * R_SI * temperatureK;
      const molarMassAir = 28.97; // g/mol
      const gasDensity = (moles * molarMassAir) / volumeL;
      return { pressureAtm, pressureKpa, internalEnergyJ, gasDensity };
    },
  },

  {
    id: 'reaction-kinetics-arrhenius',
    title: 'Kinetika Laju Reaksi & Persamaan Arrhenius',
    domain: 'kimia',
    subCategory: 'Kinetika Kimia',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati bahwa suhu hangat mempercepat terjadinya reaksi kimia.',
        'Mengenal konsep bahwa pekatnya campuran mempengaruhi kecepatan reaksi.',
      ],
      SMA: [
        'Menentukan pengaruh konsentrasi reaktan dan suhu terhadap kecepatan reaksi.',
        'Menentukan orde reaksi parsial terhadap reaktan dari perbandingan laju awal.',
      ],
      Mahasiswa: [
        'Menghitung energi aktivasi (Ea) dan faktor frekuensi tumbukan (A) menggunakan plot linier Arrhenius ln(k) vs 1/T.',
        'Menganalisis teori keadaan transisi Eyring (entalpi dan entropi aktivasi ΔH‡ dan ΔS‡).',
      ],
    },
    theorySummary:
      'Laju reaksi kimia didefinisikan sebagai laju pengurangan konsentrasi reaktan per satuan waktu: r = k·[A]^m. Nilai konstanta laju k sangat bergantung pada suhu mutlak mengikuti Persamaan Svante Arrhenius: k = A·exp(-Ea / RT). Dengan memplot ln(k) versus 1/T, gradien garis lurus bernilai -Ea / R sehingga energi aktivasi dapat ditentukan.',
    keyEquations: [
      'r = k \\cdot [A]^m',
      'k = A \\cdot e^{-E_a / (R T)}',
      '\\ln(k) = \\ln(A) - \\frac{E_a}{R} \\cdot \\frac{1}{T}',
      't_{1/2} = \\frac{\\ln(2)}{k} \\quad (\\text{Orde 1})',
    ],
    apparatusList: [
      'Set labu Erlenmeyer bertanda silang X dan penangas air terkontrol termostatik',
      'Larutan Natrium Tiosulfat Na2S2O3 dan Asam Klorida HCl',
      'Stopwatch digital presisi 0.01 detik / sensor transmisi kekeruhan turbiditas optik',
      'Buret dan pipet ukur analitik',
    ],
    safetyNotes: [
      'Reaksi tiosulfat dengan asam menghasilkan gas belerang dioksida SO2 yang menyengat: lakukan pengujian di dalam lemari asam (fume hood).',
      'Netralkan residu reaksi belerang sebelum pembuangan ke saluran limbah.',
    ],
    parameters: [
      { key: 'temperatureC', label: 'Suhu Reaksi (T)', unit: '°C', min: 10, max: 70, step: 5, defaultValue: 25, variableRole: 'bebas', instrumentType: 'thermometer' },
      { key: 'reactantConcA', label: 'Konsentrasi Reaktan [A]', unit: 'M', min: 0.1, max: 2.0, step: 0.1, defaultValue: 0.8, variableRole: 'kontrol' },
      { key: 'activationEnergyKj', label: 'Energi Aktivasi (Ea)', unit: 'kJ/mol', min: 30, max: 90, step: 5, defaultValue: 52, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'rateConstantK', label: 'Konstanta Laju (k)', unit: 's⁻¹', formulaLatex: 'k = A e^{-E_a/RT}', precision: 5 },
      { key: 'reactionRate', label: 'Laju Reaksi Awal (r₀)', unit: 'M/s', formulaLatex: 'r_0 = k [A]', precision: 5 },
      { key: 'halfLifeSec', label: 'Waktu Paruh Reaksi (t½)', unit: 's', formulaLatex: 't_{1/2} = \\frac{\\ln 2}{k}', precision: 1 },
      { key: 'inverseTemp', label: 'Invers Suhu Mutlak (1/T)', unit: 'x 10⁻³ K⁻¹', formulaLatex: '1000 / T', precision: 3 },
    ],
    defaultRegressionAxes: { xKey: 'inverseTemp', yKey: 'rateConstantK', expectedSlopeMeaning: 'Plot Arrhenius (-Ea/R)' },
    preLabQuiz: [
      {
        id: 'kin-q1',
        question: 'Secara perkiraan umum (aturan praktis van \'t Hoff), kenaikan suhu sebesar 10°C pada rentang suhu ruang akan meningkatkan laju reaksi kimia sebesar sekitar:',
        options: ['1.1 kali', '2 sampai 3 kali lipat', '10 kali lipat', 'Tidak berubah'],
        correctIndex: 1,
        explanation: 'Untuk sebagian besar reaksi homogen sederhana dengan energi aktivasi sedang (~50 kJ/mol), peningkatan suhu sebesar 10°C menggandakan fraksi molekul yang melampaui energi aktivasi, melipatgandakan laju reaksi 2 hingga 3 kali.',
      },
    ],
    computeStep: (params) => {
      const { temperatureC = 25, reactantConcA = 0.8, activationEnergyKj = 52 } = params;
      const R = 8.314; // J/(mol·K)
      const T_Kelvin = temperatureC + 273.15;
      const A_freq = 1.0e8; // Frequency factor s^-1
      const Ea_J = activationEnergyKj * 1000;
      const rateConstantK = A_freq * Math.exp(-Ea_J / (R * T_Kelvin));
      const reactionRate = rateConstantK * reactantConcA;
      const halfLifeSec = Math.LN2 / Math.max(1e-9, rateConstantK);
      const inverseTemp = (1000 / T_Kelvin);
      return { rateConstantK, reactionRate, halfLifeSec, inverseTemp };
    },
  },

  {
    id: 'spectrophotometry-beer',
    title: 'Spektrofotometri UV-Vis & Hukum Lambert-Beer',
    domain: 'kimia',
    subCategory: 'Kimia Analitik & Spektroskopi',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati bahwa larutan yang lebih pekat menyerap cahaya lebih banyak sehingga tampak lebih gelap.',
        'Mengenal alat ukur penyerapan cahaya.',
      ],
      SMA: [
        'Mempelajari prinsip absorpsi cahaya oleh larutan berwarna (misal KMnO4 atau CuSO4).',
        'Membuat kurva kalibrasi konsentrasi analit terhadap nilai absorbansi optik.',
      ],
      Mahasiswa: [
        'Membuktikan linearitas Hukum Lambert-Beer A = ε·b·c dan mengidentifikasi batas deviasi kimiawi/instrumen.',
        'Menentukan absorptivitas molar molar absorptivity (ε) zat aktif pada panjang gelombang maksimum λ_max.',
      ],
    },
    theorySummary:
      'Spektrofotometri mengukur pelemahan berkas sinar monokromatik saat melewati medium penyerap. Menurut Hukum Lambert-Beer, absorbansi A berbanding lurus dengan absorptivitas molar (ε), panjang jalan optik kuvet (b = 1.0 cm), dan konsentrasi analit (c): A = ε·b·c = -log(T). Hubungan ini mendasari analisis kuantitatif spektrometri modern.',
    keyEquations: [
      'A = \\varepsilon \\cdot b \\cdot c',
      'T = \\frac{I_t}{I_0} = 10^{-A}',
      'A = -\\log_{10}(T) = 2 - \\log_{10}(\\%T)',
      '\\%T = 100 \\times 10^{-A}',
    ],
    apparatusList: [
      'Spektrofotometer UV-Vis berkas ganda (Double-beam UV-Vis spectrophotometer)',
      'Kuvet kuarsa standar ketebalan optik b = 1.00 cm',
      'Labu ukur 50 mL dan mikropipet variabel (100 - 1000 μL)',
      'Larutan baku standar Kalium Permanganat KMnO4 konsentrasi terukur',
    ],
    safetyNotes: [
      'Pegang kuvet hanya pada bagian dinding buramnya, jangan pernah menyentuh dinding optik bening dengan jari.',
      'Bersihkan tetesan larutan di luar kuvet menggunakan tisu lensa halus agar tidak menggores permukaan kaca.',
    ],
    parameters: [
      { key: 'concentrationMm', label: 'Konsentrasi Analit (c)', unit: 'mM', min: 0.01, max: 0.25, step: 0.01, defaultValue: 0.08, variableRole: 'bebas' },
      { key: 'pathLengthCm', label: 'Panjang Jalan Optik Kuvet (b)', unit: 'cm', min: 0.5, max: 2.0, step: 0.5, defaultValue: 1.0, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'molarAbsorptivity', label: 'Absorptivitas Molar (ε)', unit: 'L/(mol·cm)', min: 2000, max: 25000, step: 1000, defaultValue: 9500, variableRole: 'kontrol' },
      { key: 'wavelengthNm', label: 'Panjang Gelombang Monokromator (λ)', unit: 'nm', min: 400, max: 700, step: 10, defaultValue: 525, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'absorbance', label: 'Absorbansi (A)', unit: '', formulaLatex: 'A = \\varepsilon b c', precision: 3 },
      { key: 'transmittancePct', label: 'Transmitansi (%T)', unit: '%', formulaLatex: '\\%T = 100 \\cdot 10^{-A}', precision: 2 },
      { key: 'transmittedIntensity', label: 'Intensitas Terus (I/I₀)', unit: '', formulaLatex: 'I/I_0', precision: 4 },
    ],
    defaultRegressionAxes: { xKey: 'concentrationMm', yKey: 'absorbance', expectedSlopeMeaning: 'Absorptivitas Efektif (ε · b)' },
    preLabQuiz: [
      {
        id: 'spec-q1',
        question: 'Jika suatu larutan sampel menyerap 90% dari sinar datang (hanya 10% sinar yang diteruskan, T = 0.10), berapakah nilai absorbansinya (A)?',
        options: ['A = 0.10', 'A = 1.00', 'A = 2.00', 'A = 0.90'],
        correctIndex: 1,
        explanation: 'Absorbansi dihitung dengan rumus A = -log10(T). Karena T = 0.10 (10^-1), maka A = -log10(0.10) = 1.00.',
      },
    ],
    computeStep: (params) => {
      const { concentrationMm = 0.08, pathLengthCm = 1.0, molarAbsorptivity = 9500 } = params;
      const cMolar = concentrationMm / 1000; // convert mM to M
      const absorbance = molarAbsorptivity * pathLengthCm * cMolar;
      const transmittedIntensity = Math.pow(10, -absorbance);
      const transmittancePct = transmittedIntensity * 100;
      return { absorbance, transmittancePct, transmittedIntensity };
    },
  },
];
