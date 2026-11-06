import { ExperimentModule } from '../experimentRegistry';

export const ASTRONOMY_MODULES: ExperimentModule[] = [
  {
    id: 'solar-kepler',
    title: 'Orbit Tata Surya & Hukum III Kepler',
    domain: 'astronomi',
    subCategory: 'Mekanika Benda Langit',
    supportedTiers: ['SMP', 'SMA', 'Mahasiswa'],
    difficulty: 1,
    estimatedMinutes: 30,
    objectives: {
      SMP: [
        'Mengenal bentuk orbit elips planet dan letak Matahari di salah satu titik fokusnya.',
        'Mengamati bahwa planet yang lebih jauh dari Matahari memerlukan waktu lebih lama untuk satu putaran.',
      ],
      SMA: [
        'Membuktikan Hukum III Kepler secara matematis bahwa kuadrat periode sebanding dengan pangkat tiga sumbu semi-mayor (T² ∝ a³).',
        'Menghitung variasi kecepatan orbit pada titik perihelion dan aphelion (Hukum II Kepler).',
      ],
      Mahasiswa: [
        'Menurunkan Hukum Kepler tergeneralisasi dari Hukum Gravitasi Universal Newton dengan massa bersama (M* + m).',
        'Menganalisis anomali eksentrisitas dan presesi orbit relativistik.',
      ],
    },
    theorySummary:
      'Johannes Kepler merumuskan tiga hukum gerak planet. Hukum I: orbit planet berbentuk elips dengan Matahari di salah satu fokus. Hukum II: garis hubung planet-Matahari menyapu luasan yang sama dalam selang waktu yang sama (kekekalan momentum sudut). Hukum III: rasio kuadrat periode revolusi terhadap pangkat tiga sumbu semi-mayor bernilai konstan: T² / a³ = 4π² / [G(M + m)].',
    keyEquations: [
      '\\frac{T^2}{a^3} = \\frac{4\\pi^2}{G(M_* + m)} \\approx 1.000 \\quad (\\text{dalam satuan tahun & AU})',
      'v_{\\text{peri}} = \\sqrt{\\frac{G M_*}{a} \\frac{1+e}{1-e}}',
      'v_{\\text{aph}} = \\sqrt{\\frac{G M_*}{a} \\frac{1-e}{1+e}}',
      'r(\\theta) = \\frac{a(1 - e^2)}{1 + e \\cos\\theta}',
    ],
    apparatusList: [
      'Simulator efemeris astrodinamika orbit planet Tata Surya',
      'Data teleskopik sumbu semi-mayor (a), eksentrisitas (e), dan periode (T)',
      'Diagram sektor luasan sapuan orbit Keplerian 3D',
    ],
    safetyNotes: [
      'Data orbit telah diskalakan dalam satuan astronomi (AU) dan tahun Bumi untuk mempermudah kalkulasi numerik.',
    ],
    parameters: [
      { key: 'customSemiMajorAxisAu', label: 'Sumbu Semi-Mayor (a)', unit: 'AU', min: 0.2, max: 30.0, step: 0.2, defaultValue: 1.0, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'customEccentricity', label: 'Eksentrisitas Orbit (e)', unit: '', min: 0.0, max: 0.85, step: 0.02, defaultValue: 0.017, variableRole: 'bebas' },
      { key: 'centralStarMassSolar', label: 'Massa Bintang Induk (M*)', unit: 'M☉', min: 0.2, max: 5.0, step: 0.1, defaultValue: 1.0, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'orbitalPeriodYears', label: 'Periode Orbit (T)', unit: 'tahun', formulaLatex: 'T = \\sqrt{a^3/M_*}', precision: 3 },
      { key: 'perihelionVelocityKmS', label: 'Kecepatan Perihelion (v_peri)', unit: 'km/s', formulaLatex: 'v_{\\text{peri}}', precision: 2 },
      { key: 'aphelionVelocityKmS', label: 'Kecepatan Aphelion (v_aph)', unit: 'km/s', formulaLatex: 'v_{\\text{aph}}', precision: 2 },
      { key: 'keplerRatio', label: 'Rasio Kepler (T²/a³)', unit: '', formulaLatex: 'T^2/a^3', precision: 3 },
    ],
    defaultRegressionAxes: { xKey: 'customSemiMajorAxisAu', yKey: 'orbitalPeriodYears', expectedSlopeMeaning: 'Hukum III Kepler (Pangkat 1.5)' },
    preLabQuiz: [
      {
        id: 'kep-q1',
        question: 'Sebuah planet baru ditemukan memiliki sumbu semi-mayor orbit a = 4.0 AU mengitari bintang seperti Matahari. Berapakah periode orbit planet tersebut?',
        options: ['2 tahun', '4 tahun', '8 tahun', '16 tahun'],
        correctIndex: 2,
        explanation: 'Menurut Hukum III Kepler T² = a³. Jika a = 4, maka T² = 4³ = 64, sehingga T = √64 = 8 tahun.',
      },
    ],
    computeStep: (params) => {
      const { customSemiMajorAxisAu = 1.0, customEccentricity = 0.017, centralStarMassSolar = 1.0 } = params;
      const a = Math.max(0.1, customSemiMajorAxisAu);
      const e = Math.min(0.95, Math.max(0, customEccentricity));
      const M = Math.max(0.1, centralStarMassSolar);
      const orbitalPeriodYears = Math.sqrt(Math.pow(a, 3) / M);
      const vMeanKmS = 29.78 * Math.sqrt(M / a);
      const perihelionVelocityKmS = vMeanKmS * Math.sqrt((1 + e) / (1 - e));
      const aphelionVelocityKmS = vMeanKmS * Math.sqrt((1 - e) / (1 + e));
      const keplerRatio = Math.pow(orbitalPeriodYears, 2) / Math.pow(a, 3);
      return { orbitalPeriodYears, perihelionVelocityKmS, aphelionVelocityKmS, keplerRatio };
    },
  },

  {
    id: 'milky-way-rotation',
    title: 'Kurva Rotasi Galaksi & Materi Gelap (Dark Matter)',
    domain: 'astronomi',
    subCategory: 'Astrofisika Galaksi & Kosmologi',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 3,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati putaran bintang-bintang mengelilingi pusat galaksi Bima Sakti.',
        'Mengenal adanya massa tak kasat mata (materi gelap) di alam semesta.',
      ],
      SMA: [
        'Membandingkan prediksi kurva rotasi Keplerian yang meluruh (v ∝ 1/√r) dengan kurva pengamatan yang datar (v ≈ konstan).',
        'Memahami bukti empiris keberadaan halo materi gelap (Dark Matter) di galaksi spiral.',
      ],
      Mahasiswa: [
        'Memodelkan profil densitas massa materi gelap Navarro-Frenk-White (NFW) atau Isothermal Sphere.',
        'Menghitung fraksi massa materi gelap terhadap massa barionik bercahaya sebagai fungsi radius galaktosentris.',
      ],
    },
    theorySummary:
      'Vera Rubin (1970) menemukan bahwa kecepatan orbit bintang dan awan hidrogen netral (HI 21 cm) di pinggiran galaksi spiral tidak meluruh seperti prediksi gravitasi Newton berbasis materi bercahaya (v ∝ 1/√r), melainkan mendatar pada v ~ 220 km/s hingga jarak puluhan kiloparsek. Hal ini membuktikan bahwa sebagian besar massa galaksi tersusun atas materi gelap non-barionik yang membentuk halo masif.',
    keyEquations: [
      'v_{\\text{obs}}(r) = \\sqrt{v_{\\text{disk}}^2(r) + v_{\\text{bulge}}^2(r) + v_{\\text{halo}}^2(r)}',
      'v_{\\text{Keplerian}}(r) = \\sqrt{\\frac{G M_{\\text{barion}}(r)}{r}} \\propto \\frac{1}{\\sqrt{r}}',
      'M_{\\text{dyn}}(< r) = \\frac{v^2 \\cdot r}{G}',
      '\\rho_{\\text{DM}}(r) = \\frac{\\rho_0}{1 + (r/r_s)^2}',
    ],
    apparatusList: [
      'Data radio astronomi spektroskopi garis 21-cm atom hidrogen netral (HI)',
      'Simulator profil kurva rotasi galaksi spiral terdekomposisi 3D',
      'Basis data katalog kurva rotasi galaksi SPARC',
    ],
    safetyNotes: [
      'Gunakan koordinat galaktosentrik (r dalam satuan kiloparsek, 1 kpc ≈ 3.260 tahun cahaya).',
    ],
    parameters: [
      { key: 'galactocentricRadiusKpc', label: 'Radius Galaktosentris (r)', unit: 'kpc', min: 1, max: 25, step: 1, defaultValue: 8.2, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'darkMatterHaloFraction', label: 'Fraksi Halo Materi Gelap', unit: 'x', min: 0.0, max: 3.0, step: 0.2, defaultValue: 1.0, variableRole: 'bebas' },
      { key: 'bulgeDiskMassFactor', label: 'Massa Piringan & Tonjolan Pusat', unit: 'x', min: 0.5, max: 2.5, step: 0.25, defaultValue: 1.0, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'observedVelocityKmS', label: 'Kecepatan Rotasi Teramati (v_obs)', unit: 'km/s', formulaLatex: 'v_{\\text{obs}}', precision: 1 },
      { key: 'keplerianExpectedKmS', label: 'Kecepatan Keplerian Teoretis', unit: 'km/s', formulaLatex: 'v_{\\text{baryon}}', precision: 1 },
      { key: 'darkMatterMassEnclosed', label: 'Massa Materi Gelap (< r)', unit: 'x 10¹⁰ M☉', formulaLatex: 'M_{\\text{DM}}(<r)', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'galactocentricRadiusKpc', yKey: 'observedVelocityKmS', expectedSlopeMeaning: 'Profil Kurva Datar (Flat Rotation Curve)' },
    preLabQuiz: [
      {
        id: 'mw-q1',
        question: 'Jika galaksi spiral hanya tersusun atas bintang-bintang yang tampak (materi bercahaya yang terpusat di tengah), bagaimanakah pola kecepatan rotasi bintang di pinggiran terluar galaksi?',
        options: ['Kecepatan meningkat tajam', 'Kecepatan mendatar konstan', 'Kecepatan meluruh berbanding terbalik dengan akar jarak (1/√r)', 'Kecepatan menjadi nol seketika'],
        correctIndex: 2,
        explanation: 'Sesuai mekanika Newton / Keplerian, massa terpusat di inti menyebabkan kecepatan orbit di daerah luar meluruh seiring pertambahan jarak: v = √(GM/r) ∝ 1/√r.',
      },
    ],
    computeStep: (params) => {
      const { galactocentricRadiusKpc = 8.2, darkMatterHaloFraction = 1.0, bulgeDiskMassFactor = 1.0 } = params;
      const r = Math.max(0.5, galactocentricRadiusKpc);

      // Baryonic contribution (peaks around 4 kpc then drops)
      const vBaryon = 190 * Math.sqrt(bulgeDiskMassFactor) * (r / (r + 3.0)) * Math.pow(8.0 / (r + 4.0), 0.35);

      // Dark matter halo contribution (rises then flattens)
      const vHalo = 160 * Math.sqrt(darkMatterHaloFraction) * Math.sqrt(r * r / (r * r + 25.0));

      const observedVelocityKmS = Math.sqrt(vBaryon * vBaryon + vHalo * vHalo);
      const keplerianExpectedKmS = vBaryon;
      const darkMatterMassEnclosed = (vHalo * vHalo * r) / (4.3e-3 * 1e5); // approximate enclosed halo mass in 10^10 M☉

      return { observedVelocityKmS, keplerianExpectedKmS, darkMatterMassEnclosed };
    },
  },

  {
    id: 'exoplanet-transit',
    title: 'Fotometri Transit Eksoplanet & Kurva Cahaya',
    domain: 'astronomi',
    subCategory: 'Astrofisika Bintang & Eksoplanet',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati peredupan cahaya bintang ketika dilintasi oleh planet yang mengorbitnya.',
        'Mengenal keberadaan planet di luar Tata Surya (eksoplanet).',
      ],
      SMA: [
        'Memahami metode fotometri transit untuk mendeteksi planet di luar Tata Surya (eksoplanet).',
        'Menentukan rasio ukuran radius eksoplanet terhadap bintang induknya dari kedalaman peredupan cahaya (transit depth).',
      ],
      Mahasiswa: [
        'Memodelkan profil peredupan tepi bintang (limb darkening) pada kurva cahaya transit.',
        'Menghitung kerapatan rata-rata curah eksoplanet untuk membedakan planet batuan kebumian atau raksasa gas.',
      ],
    },
    theorySummary:
      'Ketika sebuah eksoplanet melintas tepat di depan piringan bintang induknya dari sudut pandang pengamat (transit fotometri), fluks cahaya bintang yang diterima mengalami penurunan sementara sebesar fraksi luas: ΔF / F = (Rp / R*)². Misi Kepler dan TESS telah menemukan ribuan eksoplanet menggunakan teknik presisi tinggi ini.',
    keyEquations: [
      '\\frac{\\Delta F}{F} = \\left( \\frac{R_p}{R_*} \\right)^2',
      'R_p = R_* \\sqrt{\\frac{\\Delta F}{F}}',
      '\\tau_{\\text{durasi}} = \\frac{P}{\\pi} \\arcsin\\left( \\frac{\\sqrt{(R_* + R_p)^2 - (b R_*)^2}}{a} \\right)',
      '\\rho_p = \\frac{3 M_p}{4\\pi R_p^3}',
    ],
    apparatusList: [
      'Teleskop luar angkasa fotometer presisi tinggi (analog Kepler/TESS)',
      'Kamera CCD/CMOS pendingin termoelektrik dengan filter fotometri standar',
      'Perangkat lunak analisis kurva cahaya reduksi data apertur',
    ],
    safetyNotes: [
      'Pastikan orientasi inklinasi orbit eksoplanet berada dekat 90° agar terjadi gerhana geometris dari sudut pandang Bumi.',
    ],
    parameters: [
      { key: 'starRadiusSolar', label: 'Radius Bintang Induk (R*)', unit: 'R☉', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.0, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'exoplanetRadiusEarth', label: 'Radius Eksoplanet (Rp)', unit: 'R⊕', min: 1.0, max: 20.0, step: 0.5, defaultValue: 11.2, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'exoplanetOrbitAu', label: 'Jarak Orbit Bintang (a)', unit: 'AU', min: 0.02, max: 2.0, step: 0.05, defaultValue: 0.05, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'transitDepthPct', label: 'Kedalaman Transit (ΔF/F)', unit: '%', formulaLatex: '\\Delta F/F = (R_p/R_*)^2', precision: 3 },
      { key: 'transitDurationHours', label: 'Durasi Transit (τ)', unit: 'jam', formulaLatex: '\\tau_{\\text{transit}}', precision: 2 },
      { key: 'stellarFluxDipPpm', label: 'Penurunan Fluks', unit: 'ppm', formulaLatex: '\\text{ppm}', precision: 0 },
    ],
    defaultRegressionAxes: { xKey: 'exoplanetRadiusEarth', yKey: 'transitDepthPct', expectedSlopeMeaning: 'Kuadratik Terhadap Radius Planet' },
    preLabQuiz: [
      {
        id: 'exo-q1',
        question: 'Sebuah planet seukuran Jupiter (radius ~ 10 kali radius Bumi) mengitari bintang seperti Matahari (radius ~ 100 kali radius Bumi). Berapakah persentase kedalaman transit peredupan cahaya bintangnya?',
        options: ['Sekitar 0.01%', 'Sekitar 1.0%', 'Sekitar 10.0%', 'Sekitar 50.0%'],
        correctIndex: 1,
        explanation: 'Kedalaman transit ΔF/F = (Rp / R*)^2 = (10 / 100)^2 = (1/10)^2 = 1/100 = 1.0%.',
      },
    ],
    computeStep: (params) => {
      const { starRadiusSolar = 1.0, exoplanetRadiusEarth = 11.2, exoplanetOrbitAu = 0.05 } = params;
      // 1 R_sun ≈ 109.2 R_earth
      const rStarInEarth = starRadiusSolar * 109.2;
      const ratio = exoplanetRadiusEarth / rStarInEarth;
      const transitDepthRaw = Math.pow(ratio, 2);
      const transitDepthPct = transitDepthRaw * 100;
      const stellarFluxDipPpm = transitDepthRaw * 1e6;

      // Approximate duration in hours for circular orbit
      const orbitalPeriodDays = 365.25 * Math.sqrt(Math.pow(exoplanetOrbitAu, 3));
      const transitDurationHours = Math.max(0.5, (orbitalPeriodDays * 24 / Math.PI) * (starRadiusSolar * 0.00465 / exoplanetOrbitAu));

      return { transitDepthPct, transitDurationHours, stellarFluxDipPpm };
    },
  },

  {
    id: 'stellar-wien-spectrum',
    title: 'Spektroskopi Bintang, Hukum Wien & Klasifikasi Harvard',
    domain: 'astronomi',
    subCategory: 'Astrofisika Bintang',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 2,
    estimatedMinutes: 35,
    objectives: {
      SMP: [
        'Mengamati perbedaan warna bintang panas (biru) dan bintang dingin (merah).',
        'Mengenal bahwa warna bintang menunjukkan suhunya.',
      ],
      SMA: [
        'Memahami hukum pergeseran Wien bahwa bintang yang lebih panas memancarkan radiasi puncak pada panjang gelombang lebih pendek.',
        'Mengenal urutan klasifikasi spektrum bintang Harvard (O, B, A, F, G, K, M) dan kaitan warnanya.',
      ],
      Mahasiswa: [
        'Menghitung luminositas bolometrik total bintang melalui Hukum Stefan-Boltzmann L = 4π·R²·σ·T⁴.',
        'Menganalisis indeks warna fotometri Johnson B - V dan temperatur fotosfer efektif bintang.',
      ],
    },
    theorySummary:
      'Radiasi termal bintang didekati secara akurat oleh kurva radiasi benda hitam Planck. Hukum Pergeseran Wilhelm Wien menyatakan bahwa panjang gelombang emisi maksimum berbanding terbalik dengan suhu mutlak fotosfer: λ_max · T = b = 2.898 × 10⁻³ m·K. Bintang biru sangat panas (kelas O/B, T > 10.000 K), Matahari berwarna kuning (kelas G, T ≈ 5.778 K), dan bintang kerdil merah lebih dingin (kelas M, T < 3.500 K).',
    keyEquations: [
      '\\lambda_{\\max} \\cdot T = b = 2.898 \\times 10^{-3} \\text{ m}\\cdot\\text{K} = 2.898 \\times 10^6 \\text{ nm}\\cdot\\text{K}',
      'L = 4\\pi R_*^2 \\sigma T^4 = L_\\odot \\left( \\frac{R_*}{R_\\odot} \\right)^2 \\left( \\frac{T}{T_\\odot} \\right)^4',
      'F = \\frac{L}{4\\pi d^2}',
      'B - V \\approx \\frac{7201}{T} - 0.25',
    ],
    apparatusList: [
      'Spektrograf kisi transmisi presisi optik tinggi terpasang pada teleskop',
      'Detektor sensor kurva spektral intensitas kalibrasi fotometri fluks',
      'Atlas spektrum bintang terkalibrasi katalog Harvard OBAFGKM',
    ],
    safetyNotes: [
      'Data fotometri fluks radiasi telah dinormalisasi terhadap standar fluks bintang Vega.',
    ],
    parameters: [
      { key: 'starEffectiveTempK', label: 'Suhu Efektif Fotosfer (T)', unit: 'K', min: 2500, max: 35000, step: 250, defaultValue: 5800, variableRole: 'bebas', instrumentType: 'thermometer' },
      { key: 'starRadiusSolar', label: 'Radius Bintang (R*)', unit: 'R☉', min: 0.2, max: 50.0, step: 0.5, defaultValue: 1.0, variableRole: 'kontrol', instrumentType: 'ruler' },
      { key: 'distanceParsecs', label: 'Jarak ke Bintang (d)', unit: 'pc', min: 1.0, max: 500.0, step: 5.0, defaultValue: 10.0, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'peakWavelengthNm', label: 'Panjang Gelombang Puncak (λ_max)', unit: 'nm', formulaLatex: '\\lambda_{\\max} = b / T', precision: 1 },
      { key: 'luminositySolar', label: 'Luminositas Total Bintang (L)', unit: 'L☉', formulaLatex: 'L/L_\\odot', precision: 2 },
      { key: 'colorIndexBMinusV', label: 'Indeks Warna Fotometri (B - V)', unit: '', formulaLatex: 'B - V', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'starEffectiveTempK', yKey: 'peakWavelengthNm', expectedSlopeMeaning: 'Invers Hiperbolik (Hukum Wien)' },
    preLabQuiz: [
      {
        id: 'wien-q1',
        question: 'Sebuah bintang raksasa biru memiliki suhu fotosfer T = 10.000 K. Di manakah perkiraan panjang gelombang puncak pancaran radiasinya (λ_max)?',
        options: ['290 nm (daerah ultraviolet)', '500 nm (daerah tampak hijau)', '700 nm (daerah tampak merah)', '1000 nm (daerah inframerah)'],
        correctIndex: 0,
        explanation: 'Berdasarkan Hukum Pergeseran Wien: λ_max = 2.898 × 10^6 nm·K / 10.000 K ≈ 289.8 nm (berada di wilayah spektrum ultraviolet dekat).',
      },
    ],
    computeStep: (params) => {
      const { starEffectiveTempK = 5800, starRadiusSolar = 1.0 } = params;
      const T = Math.max(1000, starEffectiveTempK);
      const bWien = 2.89777e6; // nm·K
      const peakWavelengthNm = bWien / T;
      const tSun = 5778;
      const luminositySolar = Math.pow(starRadiusSolar, 2) * Math.pow(T / tSun, 4);
      const colorIndexBMinusV = 7201 / T - 0.25;
      return { peakWavelengthNm, luminositySolar, colorIndexBMinusV };
    },
  },

  {
    id: 'hubble-expansion',
    title: 'Redshift Spektrum Galaksi & Hukum Ekspansi Hubble',
    domain: 'astronomi',
    subCategory: 'Kosmologi Observasional',
    supportedTiers: ['SMA', 'Mahasiswa'],
    difficulty: 3,
    estimatedMinutes: 40,
    objectives: {
      SMP: [
        'Mengamati bahwa galaksi-galaksi di alam semesta saling bergerak menjauh.',
        'Mengenal konsep bahwa alam semesta sedang mengembang.',
      ],
      SMA: [
        'Mengamati pergeseran merah (redshift) garis absorpsi spektrum galaksi-galaksi jauh.',
        'Membuktikan bahwa kecepatan resesi galaksi berbanding lurus dengan jaraknya dari kita (v = H₀·d).',
      ],
      Mahasiswa: [
        'Menentukan nilai konstanta laju ekspansi alam semesta Hubble (H₀) dan mengestimasi usia alam semesta (t_Hubble ≈ 1/H₀).',
        'Menganalisis efek kosmologis pergeseran merah relativistik z = Δλ / λ₀.',
      ],
    },
    theorySummary:
      'Edwin Hubble (1929) menemukan bahwa spektrum cahaya dari galaksi-galaksi jauh mengalami pergeseran merah Doppler-kosmologis. Hukum Hubble menyatakan bahwa kecepatan resesi galaksi (v) menjauh berbanding lurus dengan jaraknya (d): v = H₀·d. Kemiringan grafik kecepatan terhadap jarak memberikan Konstanta Hubble H₀ (~70 km/s/Mpc), yang membuktikan bahwa ruang waktu alam semesta sedang mengembang.',
    keyEquations: [
      'v = H_0 \\cdot d',
      'z = \\frac{\\lambda_{\\text{teramati}} - \\lambda_0}{\\lambda_0} = \\frac{\\Delta\\lambda}{\\lambda_0}',
      'v \\approx c \\cdot z \\quad (z \\ll 1)',
      't_{\\text{Hubble}} = \\frac{1}{H_0} \\approx 13.8 \\text{ miliar tahun}',
    ],
    apparatusList: [
      'Data survei spektroskopi digital Sloan Digital Sky Survey (SDSS)',
      'Teleskop optik pemantau gugus galaksi Coma dan Virgo',
      'Spektrogram garis absorpsi Kalsium H (396.8 nm) dan K (393.4 nm)',
    ],
    safetyNotes: [
      'Perhitungan kecepatan resesi menggunakan pendekatan non-relativistik untuk z < 0.2; gunakan koreksi relativistik z = √((1+v/c)/(1-v/c)) - 1 jika kecepatan mendekati kecepatan cahaya c.',
    ],
    parameters: [
      { key: 'galaxyDistanceMpc', label: 'Jarak Galaksi (d)', unit: 'Mpc', min: 20, max: 600, step: 20, defaultValue: 150, variableRole: 'bebas', instrumentType: 'ruler' },
      { key: 'hubbleConstantH0', label: 'Konstanta Hubble (H₀)', unit: 'km/s/Mpc', min: 65, max: 78, step: 1, defaultValue: 70, variableRole: 'kontrol' },
      { key: 'restWavelengthNm', label: 'Panjang Gelombang Garis Diam (λ₀)', unit: 'nm', min: 390, max: 660, step: 10, defaultValue: 393.4, variableRole: 'kontrol' },
    ],
    outputs: [
      { key: 'recessionVelocityKmS', label: 'Kecepatan Resesi (v)', unit: 'km/s', formulaLatex: 'v = H_0 \\cdot d', precision: 1 },
      { key: 'redshiftZ', label: 'Parameter Redshift (z)', unit: '', formulaLatex: 'z = v / c', precision: 4 },
      { key: 'observedWavelengthNm', label: 'Panjang Gelombang Teramati', unit: 'nm', formulaLatex: '\\lambda_{\\text{obs}} = \\lambda_0(1+z)', precision: 2 },
      { key: 'lookbackTimeGyr', label: 'Waktu Kilas Balik', unit: 'miliar thn', formulaLatex: 't_{\\text{lookback}}', precision: 2 },
    ],
    defaultRegressionAxes: { xKey: 'galaxyDistanceMpc', yKey: 'recessionVelocityKmS', expectedSlopeMeaning: 'Konstanta Hubble H₀ (km/s/Mpc)' },
    preLabQuiz: [
      {
        id: 'hub-q1',
        question: 'Sebuah galaksi berjarak 100 Mpc dari Bumi. Jika konstanta Hubble H₀ = 70 km/s/Mpc, berapakah kecepatan gerak galaksi tersebut menjauh dari kita?',
        options: ['700 km/s', '7.000 km/s', '70.000 km/s', '300.000 km/s'],
        correctIndex: 1,
        explanation: 'Berdasarkan Hukum Hubble: v = H₀ · d = (70 km/s/Mpc) · (100 Mpc) = 7.000 km/s.',
      },
    ],
    computeStep: (params) => {
      const { galaxyDistanceMpc = 150, hubbleConstantH0 = 70, restWavelengthNm = 393.4 } = params;
      const cKmS = 299792;
      const recessionVelocityKmS = hubbleConstantH0 * galaxyDistanceMpc;
      const redshiftZ = recessionVelocityKmS / cKmS;
      const observedWavelengthNm = restWavelengthNm * (1 + redshiftZ);
      // Lookback time approximation: d (Mpc) * 3.26e6 light years / 1e9 years
      const lookbackTimeGyr = (galaxyDistanceMpc * 3.2616) / 1000;
      return { recessionVelocityKmS, redshiftZ, observedWavelengthNm, lookbackTimeGyr };
    },
  },
];
