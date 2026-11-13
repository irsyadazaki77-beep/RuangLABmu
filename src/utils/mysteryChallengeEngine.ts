import { ScienceDomain } from './scienceEngine';

export interface MysterySampleChallenge {
  id: string;
  domain: ScienceDomain;
  moduleId: string;
  title: string;
  codename: string; // e.g. "SAMPEL-X74"
  difficulty: 'Mudah' | 'Sedang' | 'Tantangan Olimpiade';
  storyDescription: string;
  hiddenParamKey: string;
  hiddenParamLabel: string;
  hiddenParamUnit: string;
  actualHiddenValue: number;
  acceptableTolerancePct: number; // default 5.0% for 100 points
  clues: string[];
  suggestedProcedure: string[];
  formulaHint: string;
  explanationSolution: string;
}

export interface MysterySubmissionResult {
  challengeId: string;
  codename: string;
  studentGuess: number;
  actualValue: number;
  errorPercentage: number;
  score: number; // 0 - 100
  passed: boolean;
  verdict: 'Sempurna (A+)' | 'Akurat (A)' | 'Cukup Dekat (B)' | 'Perlu Kalibrasi Ulang (C)' | 'Melenceng Jauh (D)';
  feedbackText: string;
  timestamp: string;
}

export const PRESET_MYSTERY_CHALLENGES: MysterySampleChallenge[] = [
  // 1. Fisika: Gravitasi Planet Ekstrasurya
  {
    id: 'phys-mystery-gravity',
    domain: 'Fisika',
    moduleId: 'pendulum-harmonic',
    title: 'Gravitasi Koloni Planet Kepler-452b',
    codename: 'PROBE-KEPLER-G',
    difficulty: 'Sedang',
    storyDescription:
      'Wahana penjelajah otomatis baru mendarat di permukaan planet asing. Sensor gravitasi utama rusak saat masuk atmosfer. Anda harus mengukur percepatan gravitasi lokal (g) menggunakan osilasi bandul harmonis presisi.',
    hiddenParamKey: 'gravity',
    hiddenParamLabel: 'Percepatan Gravitasi (g)',
    hiddenParamUnit: 'm/s²',
    actualHiddenValue: 12.35,
    acceptableTolerancePct: 5.0,
    clues: [
      'Gunakan stopwatch digital dan ukur waktu untuk 10 kali ayunan penuh (10T).',
      'Ingat hubungan T = 2π√(L/g). Variasikan panjang tali L untuk mendapatkan hasil yang lebih presisi.',
      'Plot grafik T² terhadap L; gradien garis sama dengan 4π²/g.',
    ],
    suggestedProcedure: [
      '1. Atur panjang tali bandul (L) ke 1.0 m atau 1.5 m.',
      '2. Simpangkan sudut kecil (θ ≤ 15°) lalu jalankan simulasi.',
      '3. Catat periode ayunan T dari pembacaan instrumen.',
      '4. Hitung g = 4π²L / T² dan masukkan perkiraan Anda.',
    ],
    formulaHint: 'g = \\frac{4\\pi^2 L}{T^2}',
    explanationSolution:
      'Dengan panjang tali L = 1.0 m, periode teramati T ≈ 1.789 s. Maka g = 4π²(1.0) / (1.789)² ≈ 12.35 m/s².',
  },

  // 2. Fisika: Koefisien Gesek Bidang
  {
    id: 'phys-mystery-friction',
    domain: 'Fisika',
    moduleId: 'newton-incline',
    title: 'Material Pelapis Balap MagLev Misterius',
    codename: 'ALLOY-MU-X9',
    difficulty: 'Sedang',
    storyDescription:
      'Laboratorium material menerima sampel paduan baru untuk rel superkonduktor. Tentukan koefisien gesek kinetik (μk) paduan tersebut dengan menguji percepatan luncur balok.',
    hiddenParamKey: 'frictionCoeffKinetic',
    hiddenParamLabel: 'Koefisien Gesek Kinetik (μk)',
    hiddenParamUnit: '',
    actualHiddenValue: 0.28,
    acceptableTolerancePct: 6.0,
    clues: [
      'Perhatikan resultan gaya ΣF = m·a = F_dorong - m·g·sin(θ) - μk·m·g·cos(θ).',
      'Pada kemiringan datar (θ = 0°), f_k = μk·m·g.',
    ],
    suggestedProcedure: [
      '1. Atur sudut kemiringan ke 0° (bidang datar).',
      '2. Berikan gaya dorong F dan ukur percepatan luncur a.',
      '3. Hitung gaya gesek: fk = F - m·a.',
      '4. Dapatkan koefisien: μk = fk / (m·g).',
    ],
    formulaHint: '\\mu_k = \\frac{F - m \\cdot a}{m \\cdot g \\cdot \\cos(\\theta)}',
    explanationSolution:
      'Dengan m = 4 kg, g = 9.81 m/s², F = 45 N, percepatan terukur a = 8.50 m/s². fk = 45 - 34.02 = 10.98 N. Maka μk = 10.98 / (4 × 9.81) = 0.280.',
  },

  // 3. Kimia: Konsentrasi Larutan Asam Misterius
  {
    id: 'chem-mystery-titration',
    domain: 'Kimia',
    moduleId: 'acid-base-titration',
    title: 'Uji Kemurnian Asam Cuka Pabrik Cilegon',
    codename: 'ACID-UNKNOWN-M',
    difficulty: 'Mudah',
    storyDescription:
      'Inspektorat mutu menyita satu drum larutan asam tanpa label konsentrasi. Lakukan titrasi netralisasi menggunakan buret standar NaOH 0.25 M untuk menentukan konsentrasi analit (Ma).',
    hiddenParamKey: 'analyteAcidConc',
    hiddenParamLabel: 'Konsentrasi Asam Analit (Ma)',
    hiddenParamUnit: 'M',
    actualHiddenValue: 0.35,
    acceptableTolerancePct: 5.0,
    clues: [
      'Titik ekuivalen ditandai dengan perubahan warna indikator secara tajam.',
      'Gunakan persamaan stoikiometri: Ma · Va = Mb · Vb.',
    ],
    suggestedProcedure: [
      '1. Masukkan volume analit Va = 25 mL ke dalam labu Erlenmeyer.',
      '2. Teteskan titran NaOH 0.25 M perlahan melalui buret digital.',
      '3. Catat volume Vb saat larutan mencapai titik ekuivalen (pH ≈ 7.0).',
      '4. Hitung Ma = (Mb × Vb) / Va.',
    ],
    formulaHint: 'M_a = \\frac{M_b \\cdot V_b}{V_a}',
    explanationSolution:
      'Titik ekuivalen tercapai tepat saat Vb = 35.0 mL. Maka Ma = (0.25 M × 35.0 mL) / 25.0 mL = 0.350 M.',
  },

  // 4. Kimia: Jumlah Mol Gas dalam Tabung Kompresi
  {
    id: 'chem-mystery-gas',
    domain: 'Kimia',
    moduleId: 'ideal-gas-boyle',
    title: 'Analisis Gas Tabung Cryo Luar Angkasa',
    codename: 'GAS-MOLES-N2',
    difficulty: 'Sedang',
    storyDescription:
      'Sebuah tabung gas bertekanan ditemukan dari modul stasiun antariksa. Tentukan jumlah mol gas (n) yang terperangkap menggunakan uji kompresi isotermal pada suhu T = 300 K.',
    hiddenParamKey: 'gasMoles',
    hiddenParamLabel: 'Jumlah Mol Gas (n)',
    hiddenParamUnit: 'mol',
    actualHiddenValue: 1.45,
    acceptableTolerancePct: 5.0,
    clues: [
      'Gunakan persamaan gas ideal P · V = n · R · T.',
      'Konstanta gas R = 0.082057 L·atm/(mol·K).',
    ],
    suggestedProcedure: [
      '1. Amati tekanan P (atm) pada volume V = 10.0 L dan suhu T = 300 K.',
      '2. Geser piston untuk memverifikasi hukum Boyle P ∝ 1/V.',
      '3. Hitung n = (P × V) / (R × T).',
    ],
    formulaHint: 'n = \\frac{P \\cdot V}{R \\cdot T}',
    explanationSolution:
      'Pada V = 10.0 L dan T = 300 K, tekanan terukur P = 3.569 atm. Maka n = (3.569 × 10.0) / (0.082057 × 300) = 1.450 mol.',
  },

  // 5. Kimia: Konsentrasi Spektrofotometri (Hukum Beer)
  {
    id: 'chem-mystery-beer',
    domain: 'Kimia',
    moduleId: 'spectrophotometry-beer',
    title: 'Deteksi Pewarna Makanan Terlarang Rhodamin-B',
    codename: 'SPECTRO-DYE-C',
    difficulty: 'Sedang',
    storyDescription:
      'Laboratorium forensik pangan menganalisis sampel sirup yang dicurigai mengandung zat pewarna berbahaya. Tentukan konsentrasi analit (c dalam mM) dari nilai absorbansi spektrofotometer UV-Vis.',
    hiddenParamKey: 'spectroConcMm',
    hiddenParamLabel: 'Konsentrasi Larutan (c)',
    hiddenParamUnit: 'mM',
    actualHiddenValue: 0.125,
    acceptableTolerancePct: 5.0,
    clues: [
      'Hukum Lambert-Beer: A = ε · b · c.',
      'Perhatikan ketebalan kuvet b = 1.0 cm dan absorptivitas molar ε = 9500 L/(mol·cm).',
    ],
    suggestedProcedure: [
      '1. Masukkan kuvet ke dalam chamber spektrofotometer.',
      '2. Baca nilai Absorbansi (A) pada panjang gelombang maksimum λ = 525 nm.',
      '3. Hitung c = A / (ε × b) lalu konversikan mol/L ke mM.',
    ],
    formulaHint: 'c = \\frac{A}{\\varepsilon \\cdot b}',
    explanationSolution:
      'Absorbansi terukur A = 1.187. Dengan b = 1.0 cm dan ε = 9500, c = 1.187 / 9500 = 0.000125 M = 0.125 mM.',
  },

  // 6. Astronomi: Suhu Bintang Baru Terdeteksi
  {
    id: 'astro-mystery-wien',
    domain: 'Astronomi',
    moduleId: 'stellar-wien-spectrum',
    title: 'Penentuan Suhu Fotosfer Supernova SN-2026A',
    codename: 'STAR-TEMP-WIEN',
    difficulty: 'Mudah',
    storyDescription:
      'Observatorium mendeteksi kilatan radiasi dari bintang baru di rasi Carina. Tentukan temperatur efektif fotosfer bintang (T dalam Kelvin) dari spektrum radiasi benda hitamnya.',
    hiddenParamKey: 'starEffectiveTempK',
    hiddenParamLabel: 'Suhu Efektif Fotosfer (T)',
    hiddenParamUnit: 'K',
    actualHiddenValue: 14500,
    acceptableTolerancePct: 5.0,
    clues: [
      'Hukum Pergeseran Wien menyatakan λ_max · T = 2.898 × 10⁶ nm·K.',
      'Bintang biru memiliki puncak emisi pada panjang gelombang ultraungu dekat.',
    ],
    suggestedProcedure: [
      '1. Arahkan spektograf ke bintang dan amati prisma dispersi.',
      '2. Catat panjang gelombang di mana kurva fluks mencapai puncak (λ_max).',
      '3. Hitung T = b / λ_max.',
    ],
    formulaHint: 'T = \\frac{2.898 \\times 10^6 \\text{ nm}\\cdot\\text{K}}{\\lambda_{\\max}}',
    explanationSolution:
      'Panjang gelombang puncak teramati λ_max ≈ 199.8 nm. Maka T = 2.89777 × 10⁶ / 199.8 ≈ 14.500 K (Bintang kelas B super panas).',
  },

  // 7. Astronomi: Jarak Galaksi Deep-Field (Hukum Hubble)
  {
    id: 'astro-mystery-hubble',
    domain: 'Astronomi',
    moduleId: 'hubble-expansion',
    title: 'Survei Kosmologi Galaksi Terjauh Cosmos-Z',
    codename: 'GALAXY-DIST-HUBBLE',
    difficulty: 'Tantangan Olimpiade',
    storyDescription:
      'Teleskop James Webb menemukan galaksi spiral redup dengan garis spektral yang sangat bergeser ke arah merah. Tentukan jarak galaksi tersebut (d dalam Mpc) dari pergeseran spektrumnya.',
    hiddenParamKey: 'galaxyDistanceMpc',
    hiddenParamLabel: 'Jarak Galaksi (d)',
    hiddenParamUnit: 'Mpc',
    actualHiddenValue: 320,
    acceptableTolerancePct: 5.0,
    clues: [
      'Gunakan Hukum Hubble: v = H₀ · d.',
      'Kecepatan resesi dihitung dari redshift: v = c · z dengan c ≈ 299.792 km/s.',
      'Konstanta Hubble terkalibrasi H₀ = 70 km/s/Mpc.',
    ],
    suggestedProcedure: [
      '1. Ukur pergeseran panjang gelombang garis absorpsi Kalsium-K (λ₀ = 393.4 nm).',
      '2. Hitung parameter redshift z = (λ_obs - λ₀) / λ₀.',
      '3. Hitung kecepatan resesi v = c × z.',
      '4. Dapatkan jarak galaksi: d = v / H₀.',
    ],
    formulaHint: 'd = \\frac{c \\cdot z}{H_0}',
    explanationSolution:
      'Garis teramati bergeser ke λ_obs ≈ 422.8 nm (z = 0.0747). Kecepatan resesi v ≈ 22.400 km/s. Dengan H₀ = 70 km/s/Mpc, d = 22.400 / 70 = 320 Mpc.',
  },

  // 8. Biologi: Kinetika Enzim Katalase (Konstanta Michaelis Km)
  {
    id: 'bio-mystery-enzyme',
    domain: 'Biologi',
    moduleId: 'enzyme-catalase',
    title: 'Kinetika Michaelis-Menten Enzim Katalase Misterius',
    codename: 'BIO-CAT-KM',
    difficulty: 'Sedang',
    storyDescription:
      'Sampel ekstrak enzim katalase baru ditemukan dari isolat mikroba ekstremofil. Dengan Vmax terkalibrasi 120 μmol/(L·s) pada kondisi optimum (pH 7.0, T = 37°C, V_enzim = 1.0 mL), tentukan Konstanta Michaelis (Km) enzim tersebut dalam mM.',
    hiddenParamKey: 'kmConstantMm',
    hiddenParamLabel: 'Konstanta Michaelis (Km)',
    hiddenParamUnit: 'mM',
    actualHiddenValue: 4.5,
    acceptableTolerancePct: 6.0,
    clues: [
      'Gunakan modul Uji Kinetika Enzim Katalase pada kondisi optimum: pH = 7.0, suhu T = 37°C, volume enzim = 1.0 mL.',
      'Pada kondisi ini, Vmax = 120 μmol/(L·s) dan kecepatan reaksi v = Vmax·[S] / (Km + [S]).',
      'Saat substrat [H₂O₂] diatur tepat 9 mM, amati nilai kecepatan reaksi v (μmol/(L·s)) lalu balikkan persamaan untuk Km.',
    ],
    suggestedProcedure: [
      '1. Atur pH = 7.0, T = 37°C, dan Volume Ekstrak Enzim = 1.0 mL.',
      '2. Geser konsentrasi substrat [S] ke 9 mM dan catat laju reaksi v yang terbaca.',
      '3. Hitung Km = [S] × ((Vmax / v) - 1) dan masukkan jawaban akhir Anda.',
    ],
    formulaHint: 'K_m = [S] \\left(\\frac{V_{\\max}}{v} - 1\\right)',
    explanationSolution:
      'Pada [S] = 9 mM, pH 7.0, T = 37°C dengan Vmax = 120 μmol/(L·s), laju reaksi terukur v = 80.0 μmol/(L·s). Maka Km = 9 × ((120 / 80) - 1) = 4.5 mM.',
  },

  // 9. Biologi: Forensik Penyempitan Arteri Koroner (Hukum Poiseuille)
  {
    id: 'bio-mystery-cardio',
    domain: 'Biologi',
    moduleId: 'anatomy-cardiovascular-heart',
    title: 'Forensik Penyempitan Arteri Koroner (Hukum Poiseuille)',
    codename: 'CARDIO-R-RATIO',
    difficulty: 'Tantangan Olimpiade',
    storyDescription:
      'Rekam medis Doppler vaskular pasien menunjukkan Resistensi Vaskular sistemik melonjak hingga R = 5.602 PRU pada viskositas darah normal η = 3.5 cP. Tentukan rasio jari-jari pembuluh darah pasien (r / r₀) akibat plak aterosklerosis.',
    hiddenParamKey: 'vesselRadiusRatio',
    hiddenParamLabel: 'Rasio Radius Pembuluh (r/r₀)',
    hiddenParamUnit: 'rasio',
    actualHiddenValue: 0.65,
    acceptableTolerancePct: 5.0,
    clues: [
      'Gunakan modul Anatomi Jantung & Sirkulasi Kardiovaskular 3D pada viskositas darah normal η = 3.5 cP.',
      'Menurut Hukum Poiseuille ternormalisasi: R = (η / 3.5) / (r / r₀)⁴.',
      'Geser Rasio Radius Pembuluh secara sistematis hingga Resistensi Vaskular terbaca ~5.602 PRU, atau hitung langsung akar pangkat empatnya.',
    ],
    suggestedProcedure: [
      '1. Pastikan viskositas darah η tetap pada 3.5 cP.',
      '2. Variasikan Rasio Radius Pembuluh (r/r₀) atau hitung r/r₀ = (1 / 5.602)^(1/4).',
      '3. Verifikasi pembacaan Resistensi Vaskular (R) mendekati 5.602 PRU.',
      '4. Masukkan nilai rasio r/r₀ (antara 0.40 hingga 1.20).',
    ],
    formulaHint: '\\frac{r}{r_0} = \\left(\\frac{\\eta / 3.5}{R}\\right)^{1/4}',
    explanationSolution:
      'Karena R = (3.5 / 3.5) / (r/r₀)⁴ = 5.602 PRU, maka (r/r₀)⁴ = 1 / 5.602 ≈ 0.1785, sehingga r/r₀ = (0.1785)^(1/4) = 0.65 (penyempitan lumen 35%).',
  },
];

export function evaluateMysterySubmission(
  challenge: MysterySampleChallenge,
  studentGuess: number
): MysterySubmissionResult {
  const actual = challenge.actualHiddenValue;
  const absError = Math.abs(studentGuess - actual);
  const errorPct = (absError / Math.max(1e-9, Math.abs(actual))) * 100;
  const tol = challenge.acceptableTolerancePct;

  let score = 0;
  let passed = false;
  let verdict: MysterySubmissionResult['verdict'] = 'Melenceng Jauh (D)';
  let feedbackText = '';

  if (errorPct <= tol * 0.5) {
    score = 100;
    passed = true;
    verdict = 'Sempurna (A+)';
    feedbackText = `Luar biasa akurat! Galat perhitungan Anda hanya ${errorPct.toFixed(2)}% (di bawah toleransi ±${tol}%). Anda membuktikan penguasaan eksperimen tingkat master.`;
  } else if (errorPct <= tol) {
    score = 90;
    passed = true;
    verdict = 'Akurat (A)';
    feedbackText = `Sangat bagus! Estimasi nilai Anda (${studentGuess} ${challenge.hiddenParamUnit}) berada dalam batas toleransi ±${tol}% dengan galat ${errorPct.toFixed(2)}%.`;
  } else if (errorPct <= tol * 2.0) {
    score = 75;
    passed = true;
    verdict = 'Cukup Dekat (B)';
    feedbackText = `Hasil cukup mendekati (galat ${errorPct.toFixed(2)}%), namun masih ada sedikit deviasi pembacaan instrumen. Periksa kembali pembulatan data Anda.`;
  } else if (errorPct <= tol * 3.5) {
    score = 50;
    passed = false;
    verdict = 'Perlu Kalibrasi Ulang (C)';
    feedbackText = `Galat mencapai ${errorPct.toFixed(2)}%. Ada langkah kalibrasi atau rumus turunan yang belum optimal.`;
  } else {
    score = 25;
    passed = false;
    verdict = 'Melenceng Jauh (D)';
    feedbackText = `Perkiraan Anda (${studentGuess} ${challenge.hiddenParamUnit}) terpaut cukup jauh dari nilai sebenarnya (${actual} ${challenge.hiddenParamUnit}). Galat: ${errorPct.toFixed(1)}%.`;
  }

  return {
    challengeId: challenge.id,
    codename: challenge.codename,
    studentGuess,
    actualValue: actual,
    errorPercentage: Number(errorPct.toFixed(2)),
    score,
    passed,
    verdict,
    feedbackText,
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
}
