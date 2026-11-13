import {
  PhysicsParams,
  calculatePhysicsMetrics,
} from './physicsEngine';
import {
  ChemistryParams,
  calculateChemistryMetrics,
} from './chemistryEngine';
import {
  AstronomyParams,
  calculateAstronomyMetrics,
} from './astronomyEngine';
import type { DrLabMuUIAction } from '../drLabMuActions';

export type ScienceDomain = 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';

export interface ExperimentRecord {
  id: string;
  timestamp: string;
  studentName: string;
  groupId: string;
  domain: ScienceDomain;
  experimentTitle: string;
  parametersSummary: string;
  keyMetrics: Record<string, number | string>;
  numericX?: number;
  numericY1?: number;
  numericY2?: number;
  notes: string;
}

export interface LabNotification {
  id: string;
  timestamp: string;
  severity: 'nominal' | 'elevated' | 'critical';
  domain: ScienceDomain | 'Kolaborasi' | 'Pengajar';
  title: string;
  message: string;
  formulaHint?: string;
}

export interface DataPointMultiAxis {
  label: string;
  x: number;
  y1: number;
  y2: number;
}

export interface LinearRegressionResult {
  slopeM: number;
  interceptC: number;
  rSquared: number;
  equationString: string;
  meanX: number;
  meanY: number;
  stdDevY: number;
  predictedPoints: { x: number; yPred: number }[];
}

export interface WorksheetQuestion {
  id: string;
  domain: ScienceDomain;
  topic: string;
  questionText: string;
  formulaHint: string;
  unit: string;
  correctValue: number;
  tolerance: number;
  explanation: string;
  scaffoldedHints?: [string, string, string];
}

export interface RubricScoreBreakdown {
  studentId: string;
  studentName: string;
  groupId: string;
  experimentScore: number; // 0-100 (weight 25%)
  regressionAnalysisScore: number; // 0-100 (weight 25%)
  collaborationScore: number; // 0-100 (weight 25%)
  worksheetQuizScore: number; // 0-100 (weight 25%)
  finalTotalScore: number; // 0-100
  letterGrade: 'A' | 'B' | 'C' | 'D';
  predicate: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan';
}

export const WORKSHEET_QUESTIONS: WorksheetQuestion[] = [
  {
    id: 'q-newton-1',
    domain: 'Fisika',
    topic: 'Hukum II Newton & Gaya Gesek',
    questionText:
      'Sebuah balok bermassa m = 5 kg ditarik pada bidang datar (θ = 0°) dengan gaya mendatar F = 50 N. Jika koefisien gesek kinetis μk = 0.10 dan g = 10 m/s², berapakah percepatan balok a?',
    formulaHint: 'a = (F - μk · m · g) / m',
    unit: 'm/s²',
    correctValue: 9.0,
    tolerance: 0.15,
    explanation:
      'Gaya normal N = m·g = 50 N, gaya gesek kinetis fk = 0.10 × 50 = 5 N. Resultan gaya ΣF = 50 - 5 = 45 N, sehingga a = 45 / 5 = 9.0 m/s².',
    scaffoldedHints: [
      'Konsep Fisis: Gaya gesek kinetis (fk) selalu berlawanan arah dengan gaya tarik F dan mengurangi gaya resultan yang mempercepat balok.',
      'Identifikasi Variabel: Hitung dulu gaya normal N = m · g = 5 × 10 = 50 N, lalu cari gaya gesek fk = μk · N.',
      'Langkah Substitusi: fk = 0.10 × 50 = 5 N. Kurangkan dari F (50 - 5 = 45 N), lalu bagi dengan massa m = 5 kg.',
    ],
  },
  {
    id: 'q-collision-2',
    domain: 'Fisika',
    topic: 'Tumbukan Sentral & Kekekalan Momentum',
    questionText:
      'Benda m₁ = 4 kg bergerak dengan kecepatan v₁ = 6 m/s menumbuk benda m₂ = 2 kg yang diam (v₂ = 0 m/s) secara tidak lenting sama sekali (e = 0). Berapakah kecepatan akhir kedua benda setelah menyatu?',
    formulaHint: "v' = (m₁·v₁ + m₂·v₂) / (m₁ + m₂)",
    unit: 'm/s',
    correctValue: 4.0,
    tolerance: 0.1,
    explanation:
      "Momentum awal p = 4×6 + 2×0 = 24 kg·m/s. Setelah tumbukan inelastis sempurna (e=0), v' = 24 / (4 + 2) = 4.0 m/s.",
    scaffoldedHints: [
      "Konsep Fisis: Pada tumbukan tidak lenting sama sekali (e = 0), kedua benda menyatu setelah tumbukan dan bergerak bersama dengan satu kecepatan akhir v'.",
      'Identifikasi Variabel: Momentum total awal p_awal = m₁·v₁ + m₂·v₂ = (4 × 6) + (2 × 0) = 24 kg·m/s.',
      'Langkah Substitusi: Bagi momentum total awal (24 kg·m/s) dengan jumlah massa gabungan (m₁ + m₂ = 4 + 2 = 6 kg).',
    ],
  },
  {
    id: 'q-thermo-3',
    domain: 'Kimia',
    topic: 'Energi Bebas Gibbs & Spontanitas Reaksi',
    questionText:
      'Suatu reaksi kimia memiliki perubahan entalpi ΔH° = -60 kJ/mol dan perubahan entropi ΔS° = 100 J/(mol·K) pada suhu T = 300 K. Hitunglah nilai energi bebas Gibbs ΔG dalam satuan kJ/mol!',
    formulaHint: 'ΔG = ΔH - T · (ΔS / 1000)',
    unit: 'kJ/mol',
    correctValue: -90.0,
    tolerance: 0.5,
    explanation:
      'ΔG = -60 kJ/mol - (300 K × 0.100 kJ/(mol·K)) = -60 - 30 = -90.0 kJ/mol (Reaksi berlangsung spontan).',
    scaffoldedHints: [
      'Konsep Fisis: Hati-hati terhadap perbedaan satuan! ΔH dalam kJ/mol sedangkan ΔS diberikan dalam J/(mol·K).',
      'Identifikasi Variabel: Ubah ΔS ke kJ/(mol·K) terlebih dahulu: 100 J/(mol·K) ÷ 1000 = 0.10 kJ/(mol·K).',
      'Langkah Substitusi: Hitung suku T·ΔS = 300 × 0.10 = 30 kJ/mol, lalu masukkan ke ΔG = -60 - 30.',
    ],
  },
  {
    id: 'q-titration-4',
    domain: 'Kimia',
    topic: 'Stoikiometri Titrasi Asam-Basa',
    questionText:
      'Sebanyak 25 mL larutan HCl 0.20 M dititrasi dengan larutan standar NaOH 0.25 M. Pada volume NaOH berapakah titik ekuivalen (pH = 7.0) tercapai?',
    formulaHint: 'M_a · V_a = M_b · V_b',
    unit: 'mL',
    correctValue: 20.0,
    tolerance: 0.2,
    explanation:
      'Pada titik ekuivalen mol H⁺ = mol OH⁻: 0.20 M × 25 mL = 0.25 M × V_b ⇒ V_b = 5.0 / 0.25 = 20.0 mL.',
    scaffoldedHints: [
      'Konsep Fisis: Titik ekuivalen asam kuat HCl (valensi 1) dan basa kuat NaOH (valensi 1) tercapai saat milimol H⁺ tepat sama dengan milimol OH⁻.',
      'Identifikasi Variabel: Hitung milimol asam HCl = M_a × V_a = 0.20 M × 25 mL = 5.0 mmol.',
      'Langkah Substitusi: Karena mmol NaOH = 5.0 mmol dan M_b = 0.25 M, maka V_b = 5.0 ÷ 0.25 mL.',
    ],
  },
  {
    id: 'q-kepler-5',
    domain: 'Astronomi',
    topic: 'Hukum III Kepler Orbit Planet',
    questionText:
      'Sebuah planet ekstrasurya mengorbit bintang bermassa identik Matahari (1.0 M☉) pada sumbu semi-mayor a = 4.0 AU. Berapakah periode orbit planet tersebut (T) dalam satuan tahun Bumi?',
    formulaHint: 'T² = a³ / M_*',
    unit: 'tahun',
    correctValue: 8.0,
    tolerance: 0.15,
    explanation:
      'Berdasarkan Hukum III Kepler untuk M_* = 1 M☉: T² = a³ = 4³ = 64 ⇒ T = √64 = 8.0 tahun Bumi.',
    scaffoldedHints: [
      'Konsep Fisis: Hukum III Kepler menyatakan kuadrat periode orbit (T²) berbanding lurus dengan pangkat tiga jarak rata-rata (a³).',
      'Identifikasi Variabel: Untuk M_* = 1.0 M☉, berlaku T² = a³. Hitung nilai pangkat tiga dari a = 4.0 AU (4 × 4 × 4).',
      'Langkah Substitusi: Karena a³ = 64, maka T² = 64. Tarik akar kuadrat dari 64 untuk memperoleh periode T.',
    ],
  },
  {
    id: 'q-exoplanet-6',
    domain: 'Astronomi',
    topic: 'Fotometri Transit Eksoplanet',
    questionText:
      'Sebuah eksoplanet berjari-jari Rp = 0.10 R* melintas tepat di depan piringan bintang induknya. Berapa persen penurunan fluks cahaya bintang (kedalaman transit ΔF/F) yang teramati teleskop?',
    formulaHint: 'ΔF/F (%) = (Rp / R*)² × 100%',
    unit: '%',
    correctValue: 1.0,
    tolerance: 0.05,
    explanation:
      'Kedalaman transit sebanding dengan rasio luas penampang planet terhadap bintang: (0.10)² × 100% = 0.01 × 100% = 1.0%.',
    scaffoldedHints: [
      'Konsep Fisis: Penurunan kecerahan bintang saat transit sebanding dengan luas lingkaran planet dibagi luas lingkaran bintang.',
      'Identifikasi Variabel: Rasio jari-jari Rp / R* sudah diketahui sebesar 0.10. Kuadratkan rasio tersebut: (0.10)².',
      'Langkah Substitusi: (0.10)² = 0.01. Kalikan dengan 100% untuk mendapatkan persentase peredupan cahaya.',
    ],
  },
  {
    id: 'q-cardio-7',
    domain: 'Biologi',
    topic: 'Fisiologi Kardiovaskular & Curah Jantung',
    questionText:
      'Seorang siswa beristirahat dengan denyut jantung (HR) 75 detak/menit dan volume sekuncup (SV) 70 mL/detak. Berapakah curah jantung (Cardiac Output, CO) siswa tersebut dalam satuan Liter/menit?',
    formulaHint: 'CO = (HR × SV) / 1000',
    unit: 'L/menit',
    correctValue: 5.25,
    tolerance: 0.1,
    explanation:
      'Curah jantung (Cardiac Output) adalah volume darah total yang dipompa ventrikel dalam satu menit: CO = (HR × SV) / 1000 = (75 × 70) / 1000 = 5.25 L/menit.',
    scaffoldedHints: [
      'Konsep Fisis: Curah jantung (Cardiac Output) menyatakan volume total darah yang dipompa jantung ke seluruh sirkulasi tubuh dalam satu menit.',
      'Identifikasi Variabel: Kalikan frekuensi denyut jantung (HR = 75 detak/menit) dengan volume sekuncup (SV = 70 mL/detak).',
      'Langkah Substitusi: 75 × 70 = 5250 mL/menit. Bagi dengan 1000 untuk mengonversi satuan mL/menit menjadi L/menit: 5250 ÷ 1000 = 5.25 L/menit.',
    ],
  },
  {
    id: 'q-osmosis-8',
    domain: 'Biologi',
    topic: 'Potensial Air & Osmosis Membran Sel Tumbuhan',
    questionText:
      'Sebuah silinder kentang bermassa awal m₀ = 5.0 gram direndam dalam larutan sukrosa hipertonik. Setelah 30 menit, massanya menyusut menjadi m_akhir = 4.2 gram akibat keluarnya air secara osmosis. Hitunglah persentase perubahan massa (%Δm) jaringan kentang tersebut!',
    formulaHint: '%Δm = ((m_akhir - m_awal) / m_awal) × 100%',
    unit: '%',
    correctValue: -16.0,
    tolerance: 0.5,
    explanation:
      '%Δm = ((4.2 - 5.0) / 5.0) × 100% = (-0.8 / 5.0) × 100% = -16.0% (tanda negatif mengindikasikan penyusutan massa sel akibat peristiwa plasmolisis).',
    scaffoldedHints: [
      'Konsep Fisis: Pada larutan hipertonik, air keluar dari vakuola sel tumbuhan secara osmosis sehingga massa jaringan menyusut (bertanda negatif).',
      'Identifikasi Variabel: Hitung selisih perubahan massa jaringan kentang: Δm = m_akhir - m_awal = 4.2 - 5.0 = -0.8 gram.',
      'Langkah Substitusi: Bagi selisih massa dengan massa awal (-0.8 ÷ 5.0 = -0.16), lalu kalikan 100% sehingga diperoleh -16.0%.',
    ],
  },
];

export function calculateLinearRegression(
  points: { x: number; y: number }[]
): LinearRegressionResult {
  if (points.length === 0) {
    return {
      slopeM: 0,
      interceptC: 0,
      rSquared: 0,
      equationString: 'y = 0.00x + 0.00',
      meanX: 0,
      meanY: 0,
      stdDevY: 0,
      predictedPoints: [],
    };
  }

  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  if (n === 1) {
    return {
      slopeM: 0,
      interceptC: Number(meanY.toFixed(3)),
      rSquared: 1,
      equationString: `y = ${meanY.toFixed(2)}`,
      meanX: Number(meanX.toFixed(3)),
      meanY: Number(meanY.toFixed(3)),
      stdDevY: 0,
      predictedPoints: [{ x: points[0].x, yPred: points[0].y }],
    };
  }

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;

  for (const pt of points) {
    const dx = pt.x - meanX;
    const dy = pt.y - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slopeM = ssXX > 1e-9 ? ssXY / ssXX : 0;
  const interceptC = meanY - slopeM * meanX;
  const rSquared =
    ssXX > 1e-9 && ssYY > 1e-9
      ? Math.max(0, Math.min(1, (ssXY * ssXY) / (ssXX * ssYY)))
      : 1;
  const stdDevY = Math.sqrt(ssYY / n);

  const sign = interceptC >= 0 ? '+' : '-';
  const equationString = `y = ${slopeM.toFixed(3)}x ${sign} ${Math.abs(
    interceptC
  ).toFixed(3)}`;

  const sortedByX = [...points].sort((a, b) => a.x - b.x);
  const predictedPoints = sortedByX.map((p) => ({
    x: p.x,
    yPred: Number((slopeM * p.x + interceptC).toFixed(3)),
  }));

  return {
    slopeM: Number(slopeM.toFixed(4)),
    interceptC: Number(interceptC.toFixed(4)),
    rSquared: Number(rSquared.toFixed(4)),
    equationString,
    meanX: Number(meanX.toFixed(3)),
    meanY: Number(meanY.toFixed(3)),
    stdDevY: Number(stdDevY.toFixed(3)),
    predictedPoints,
  };
}

export type CurveModelType = 'linear' | 'quadratic' | 'exponential';

export interface CurveFitResult {
  modelType: CurveModelType;
  modelLabel: string;
  equationString: string;
  rSquared: number;
  slopeM: number;
  interceptC: number;
  quadA?: number;
  quadB?: number;
  quadC?: number;
  expA?: number;
  expB?: number;
  meanX: number;
  meanY: number;
  stdDevY: number;
  predictedPoints: { x: number; yPred: number }[];
  evaluateAt: (x: number) => number;
}

export function calculateCurveFitting(
  points: { x: number; y: number }[],
  modelType: CurveModelType = 'linear'
): CurveFitResult {
  const lin = calculateLinearRegression(points);
  if (points.length < 3 || modelType === 'linear') {
    return {
      modelType: 'linear',
      modelLabel: 'Regresi Linier (OLS)',
      equationString: lin.equationString,
      rSquared: lin.rSquared,
      slopeM: lin.slopeM,
      interceptC: lin.interceptC,
      meanX: lin.meanX,
      meanY: lin.meanY,
      stdDevY: lin.stdDevY,
      predictedPoints: lin.predictedPoints,
      evaluateAt: (x: number) => lin.slopeM * x + lin.interceptC,
    };
  }

  const n = points.length;
  const meanY = lin.meanY;
  const ssTot = points.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0);

  if (modelType === 'exponential') {
    const minY = Math.min(...points.map((p) => p.y));
    const shift = minY <= 0.01 ? Math.abs(minY) + 1.0 : 0;
    const logPoints = points.map((p) => ({
      x: p.x,
      y: Math.log(Math.max(1e-4, p.y + shift)),
    }));
    const logFit = calculateLinearRegression(logPoints);
    const expB = logFit.slopeM;
    const expA = Math.exp(logFit.interceptC);
    const evaluateAt = (x: number) => expA * Math.exp(expB * x) - shift;

    const ssRes = points.reduce((acc, p) => acc + Math.pow(p.y - evaluateAt(p.x), 2), 0);
    const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
    const sortedByX = [...points].sort((a, b) => a.x - b.x);
    const predictedPoints = sortedByX.map((p) => ({
      x: p.x,
      yPred: Number(evaluateAt(p.x).toFixed(3)),
    }));
    const shiftStr = shift > 0 ? ` - ${shift.toFixed(2)}` : '';
    return {
      modelType: 'exponential',
      modelLabel: 'Model Eksponensial',
      equationString: `y = ${expA.toFixed(3)}·e^(${expB.toFixed(3)}x)${shiftStr}`,
      rSquared: Number(rSquared.toFixed(4)),
      slopeM: Number(expB.toFixed(4)),
      interceptC: Number((expA - shift).toFixed(4)),
      expA: Number(expA.toFixed(4)),
      expB: Number(expB.toFixed(4)),
      meanX: lin.meanX,
      meanY: lin.meanY,
      stdDevY: lin.stdDevY,
      predictedPoints,
      evaluateAt,
    };
  }

  // Quadratic polynomial fit: y = a*x^2 + b*x + c using normal equations (3x3 Cramer/Gaussian)
  let s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0,
    sy = 0,
    sxy = 0,
    sx2y = 0;
  for (const p of points) {
    const x = p.x;
    const x2 = x * x;
    s1 += x;
    s2 += x2;
    s3 += x2 * x;
    s4 += x2 * x2;
    sy += p.y;
    sxy += x * p.y;
    sx2y += x2 * p.y;
  }

  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const A = [
    [s4, s3, s2],
    [s3, s2, s1],
    [s2, s1, n],
  ];
  const D = det3(A);
  if (Math.abs(D) < 1e-9) {
    return {
      modelType: 'quadratic',
      modelLabel: 'Polinomial Kuadratik (Orde-2)',
      equationString: lin.equationString,
      rSquared: lin.rSquared,
      slopeM: lin.slopeM,
      interceptC: lin.interceptC,
      quadA: 0,
      quadB: lin.slopeM,
      quadC: lin.interceptC,
      meanX: lin.meanX,
      meanY: lin.meanY,
      stdDevY: lin.stdDevY,
      predictedPoints: lin.predictedPoints,
      evaluateAt: (x: number) => lin.slopeM * x + lin.interceptC,
    };
  }

  const quadA =
    det3([
      [sx2y, s3, s2],
      [sxy, s2, s1],
      [sy, s1, n],
    ]) / D;
  const quadB =
    det3([
      [s4, sx2y, s2],
      [s3, sxy, s1],
      [s2, sy, n],
    ]) / D;
  const quadC =
    det3([
      [s4, s3, sx2y],
      [s3, s2, sxy],
      [s2, s1, sy],
    ]) / D;

  const evaluateAt = (x: number) => quadA * x * x + quadB * x + quadC;
  const ssRes = points.reduce((acc, p) => acc + Math.pow(p.y - evaluateAt(p.x), 2), 0);
  const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;

  const sortedByX = [...points].sort((a, b) => a.x - b.x);
  const predictedPoints = sortedByX.map((p) => ({
    x: p.x,
    yPred: Number(evaluateAt(p.x).toFixed(3)),
  }));

  const bSign = quadB >= 0 ? '+' : '-';
  const cSign = quadC >= 0 ? '+' : '-';
  const equationString = `y = ${quadA.toFixed(3)}x² ${bSign} ${Math.abs(quadB).toFixed(3)}x ${cSign} ${Math.abs(quadC).toFixed(3)}`;

  return {
    modelType: 'quadratic',
    modelLabel: 'Polinomial Kuadratik (Orde-2)',
    equationString,
    rSquared: Number(rSquared.toFixed(4)),
    slopeM: Number(quadB.toFixed(4)),
    interceptC: Number(quadC.toFixed(4)),
    quadA: Number(quadA.toFixed(4)),
    quadB: Number(quadB.toFixed(4)),
    quadC: Number(quadC.toFixed(4)),
    meanX: lin.meanX,
    meanY: lin.meanY,
    stdDevY: lin.stdDevY,
    predictedPoints,
    evaluateAt,
  };
}

export interface OutlierPointInfo {
  index: number;
  id?: string;
  label?: string;
  x: number;
  y: number;
  yPred: number;
  residual: number;
  zScore: number;
  isOutlier: boolean;
}

export interface OutlierDetectionResult {
  pointsWithResiduals: OutlierPointInfo[];
  outliers: OutlierPointInfo[];
  rSquaredRaw: number;
  rSquaredClean: number;
  rmseResiduals: number;
}

export function detectRegressionOutliers(
  points: { x: number; y: number; id?: string; label?: string }[]
): OutlierDetectionResult {
  const rawFit = calculateLinearRegression(points);
  if (points.length < 3) {
    return {
      pointsWithResiduals: points.map((p, idx) => ({
        index: idx,
        id: p.id,
        label: p.label,
        x: p.x,
        y: p.y,
        yPred: p.y,
        residual: 0,
        zScore: 0,
        isOutlier: false,
      })),
      outliers: [],
      rSquaredRaw: rawFit.rSquared,
      rSquaredClean: rawFit.rSquared,
      rmseResiduals: 0,
    };
  }

  // Compute leave-one-out predicted value so a single extreme point cannot mask itself
  const rawResiduals = points.map((p, idx) => {
    const others = points.filter((_, j) => j !== idx);
    const looFit = calculateLinearRegression(others);
    const yPredLoo = looFit.slopeM * p.x + looFit.interceptC;
    const residual = p.y - yPredLoo;
    return {
      index: idx,
      id: p.id,
      label: p.label,
      x: p.x,
      y: p.y,
      yPred: Number((rawFit.slopeM * p.x + rawFit.interceptC).toFixed(3)),
      residual: Number(residual.toFixed(3)),
      absLooResidual: Math.abs(residual),
    };
  });

  const sortedAbs = [...rawResiduals].map((r) => r.absLooResidual).sort((a, b) => a - b);
  const medianAbs = sortedAbs[Math.floor(sortedAbs.length / 2)] || 0.05;
  const scaleSigma = Math.max(0.15, medianAbs * 1.4826);

  const pointsWithResiduals: OutlierPointInfo[] = rawResiduals.map((r) => {
    const zScore = Number((r.absLooResidual / scaleSigma).toFixed(2));
    const isOutlier = zScore >= 2.2 && r.absLooResidual >= 0.45;
    return {
      index: r.index,
      id: r.id,
      label: r.label,
      x: r.x,
      y: r.y,
      yPred: r.yPred,
      residual: r.residual,
      zScore,
      isOutlier,
    };
  });

  const outliers = pointsWithResiduals.filter((p) => p.isOutlier);
  const cleanPoints = pointsWithResiduals
    .filter((p) => !p.isOutlier)
    .map((p) => ({ x: p.x, y: p.y }));
  const cleanFit =
    cleanPoints.length >= 2 ? calculateLinearRegression(cleanPoints) : rawFit;
  const rmseResiduals = Math.sqrt(
    pointsWithResiduals.reduce((acc, p) => acc + p.residual * p.residual, 0) /
      pointsWithResiduals.length
  );

  return {
    pointsWithResiduals,
    outliers,
    rSquaredRaw: rawFit.rSquared,
    rSquaredClean: cleanFit.rSquared,
    rmseResiduals: Number(rmseResiduals.toFixed(3)),
  };
}

export type WorksheetDiagnosticStatus =
  | 'exact'
  | 'close-rounding'
  | 'sign-error'
  | 'unit-conversion-error'
  | 'conceptual-error'
  | 'unanswered';

export interface WorksheetQuestionGradeDetail {
  isCorrect: boolean;
  expected: number;
  explanation: string;
  userNumericValue?: number;
  errorPct?: number;
  diagnosticStatus: WorksheetDiagnosticStatus;
  diagnosticBadge: string;
  diagnosticFeedback: string;
}

export function gradeWorksheetAnswers(
  userAnswers: Record<string, number | string>,
  targetQuestions?: WorksheetQuestion[]
): {
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  results: Record<string, WorksheetQuestionGradeDetail>;
} {
  const activeQuestions =
    targetQuestions && targetQuestions.length > 0
      ? targetQuestions
      : Object.keys(userAnswers).length === 6 && !('q-cardio-7' in userAnswers)
      ? WORKSHEET_QUESTIONS.slice(0, 6)
      : WORKSHEET_QUESTIONS;

  let correctCount = 0;
  const results: Record<string, WorksheetQuestionGradeDetail> = {};

  for (const q of activeQuestions) {
    const raw = userAnswers[q.id];
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));

    if (Number.isNaN(parsed)) {
      results[q.id] = {
        isCorrect: false,
        expected: q.correctValue,
        explanation: q.explanation,
        diagnosticStatus: 'unanswered',
        diagnosticBadge: 'Belum Diisi',
        diagnosticFeedback:
          'Masukkan hasil perhitungan numerik Anda terlebih dahulu untuk mendapatkan analisis diagnostik.',
      };
      continue;
    }

    const absDiff = Math.abs(parsed - q.correctValue);
    const errorPct =
      Math.abs(q.correctValue) > 1e-6
        ? Number(((absDiff / Math.abs(q.correctValue)) * 100).toFixed(2))
        : Number((absDiff * 100).toFixed(2));
    const isCorrect = absDiff <= q.tolerance;

    let diagnosticStatus: WorksheetDiagnosticStatus = 'conceptual-error';
    let diagnosticBadge = 'Periksa Konsep & Rumus';
    let diagnosticFeedback =
      'Periksa kembali substitusi variabel ke dalam persamaan dasar serta urutan operasi aljabarnya.';

    if (isCorrect) {
      correctCount += 1;
      if (absDiff <= q.tolerance * 0.25) {
        diagnosticStatus = 'exact';
        diagnosticBadge = 'Presisi Eksak';
        diagnosticFeedback =
          'Sangat presisi! Nilai perhitungan Anda tepat berada pada pusat acuan teoretis.';
      } else {
        diagnosticStatus = 'close-rounding';
        diagnosticBadge = 'Tepat (Toleransi Pembulatan)';
        diagnosticFeedback = `Benar (selisih pembulatan kecil ${errorPct}% masih dalam batas toleransi ±${q.tolerance} ${q.unit}).`;
      }
    } else if (
      Math.abs(parsed + q.correctValue) <= Math.max(q.tolerance * 2, 1.5) &&
      Math.abs(q.correctValue) > 0.1
    ) {
      diagnosticStatus = 'sign-error';
      diagnosticBadge = 'Kekeliruan Tanda (+/-)';
      diagnosticFeedback = `Nilai besaran Anda (${parsed} ${q.unit}) sudah tepat secara magnitudo, tetapi tandanya terbalik dari ${q.correctValue} ${q.unit}. Perhatikan konvensi tanda eksotermik/endotermik atau arah vektor.`;
    } else if (
      Math.abs(parsed / q.correctValue - 1000) < 50 ||
      Math.abs(q.correctValue / (parsed || 1e-9) - 1000) < 50 ||
      Math.abs(parsed / q.correctValue - 100) < 5 ||
      Math.abs(q.correctValue / (parsed || 1e-9) - 100) < 5
    ) {
      diagnosticStatus = 'unit-conversion-error';
      diagnosticBadge = 'Kekeliruan Konversi Satuan';
      diagnosticFeedback = `Terdeteksi faktor skala sekitar 100× atau 1000× terhadap nilai acuan (${q.correctValue} ${q.unit}). Pastikan konversi satuan (misal J ke kJ, mL ke L, atau cm ke m) sudah seragam.`;
    } else if (absDiff <= q.tolerance * 2.5) {
      diagnosticStatus = 'close-rounding';
      diagnosticBadge = 'Hampir Tepat (Galat Pembulatan)';
      diagnosticFeedback = `Jawaban Anda (${parsed} ${q.unit}) mendekati nilai acuan (${q.correctValue} ${q.unit}, galat ${errorPct}%). Hindari pembulatan terlalu dini pada langkah antara.`;
    } else {
      if (q.id === 'q-newton-1' || q.id === 'q1-newton') {
        diagnosticFeedback = `Gaya normal N = m·g = 50 N, gaya gesek kinetis fk = μk·N = 0.10 × 50 = 5 N. Resultan gaya ΣF = 50 - 5 = 45 N, sehingga percepatan a = ΣF / m = 45 / 5 = 9.0 m/s².`;
      } else if (q.id === 'q-collision-2' || q.id === 'q2-projectile') {
        diagnosticFeedback = `Gunakan hukum kekekalan momentum: m₁·v₁ + m₂·v₂ = (m₁ + m₂)·v'. Momentum total awal = (4×6) + (2×0) = 24 kg·m/s, dibagi massa total 6 kg menghasilkan v' = 4.0 m/s.`;
      } else if (q.id === 'q-thermo-3' || q.id === 'q3-gibbs') {
        diagnosticFeedback = `Konversikan ΔS = 100 J/(mol·K) menjadi 0.100 kJ/(mol·K) terlebih dahulu sebelum dikalikan T = 300 K (T·ΔS = 30 kJ/mol), sehingga ΔG = -60 - 30 = -90.0 kJ/mol.`;
      } else if (q.id === 'q-titration-4' || q.id === 'q4-titration') {
        diagnosticFeedback = `Gunakan syarat titik ekuivalen monoprotik: M_a × V_a = M_b × V_b → 0.20 × 25 = 0.25 × V_b sehingga V_b = 5.0 / 0.25 = 20.0 mL.`;
      } else if (q.id === 'q-kepler-5' || q.id === 'q5-kepler') {
        diagnosticFeedback = `Berdasarkan Hukum III Kepler: T² = a³ / M_*. Dengan a = 4.0 dan M_* = 1.0, T² = 4³ = 64 sehingga T = √64 = 8.0 tahun Bumi.`;
      } else if (q.id === 'q-exoplanet-6') {
        diagnosticFeedback = `Gunakan rumus peredupan fluks transit: ΔF/F = (Rp / R*)² × 100% = (0.10)² × 100% = 1.0%.`;
      } else if (q.id === 'q-cardio-7') {
        diagnosticFeedback = `Gunakan rumus curah jantung: CO = (HR × SV) / 1000 = (75 × 70) / 1000 = 5.25 L/menit.`;
      } else if (q.id === 'q-osmosis-8') {
        diagnosticFeedback = `Gunakan rumus persentase perubahan massa: %Δm = ((4.2 - 5.0) / 5.0) × 100% = (-0.8 / 5.0) × 100% = -16.0%.`;
      }
    }

    results[q.id] = {
      isCorrect,
      expected: q.correctValue,
      explanation: q.explanation,
      userNumericValue: parsed,
      errorPct,
      diagnosticStatus,
      diagnosticBadge,
      diagnosticFeedback,
    };
  }

  const totalScore = Math.round(
    (correctCount / activeQuestions.length) * 100
  );
  return {
    totalScore,
    correctCount,
    totalQuestions: activeQuestions.length,
    results,
  };
}

export function calculateStudentRubric(
  student: {
    id: string;
    name: string;
    groupId: string;
    trialsRecorded: number;
    tasksCompleted: number;
    totalTasks: number;
    completionPct: number;
    quizScore?: number;
  },
  rSquaredQuality = 0.96
): RubricScoreBreakdown {
  const experimentScore = Math.min(100, Math.round(40 + student.trialsRecorded * 15));
  const regressionAnalysisScore = Math.min(
    100,
    Math.round(rSquaredQuality * 85 + (student.trialsRecorded >= 2 ? 15 : 5))
  );
  const collaborationScore =
    student.totalTasks > 0
      ? Math.min(100, Math.round((student.tasksCompleted / student.totalTasks) * 100))
      : 75;
  const worksheetQuizScore =
    student.quizScore !== undefined
      ? student.quizScore
      : Math.min(100, Math.round(student.completionPct * 0.9));

  const finalTotalScore = Math.round(
    experimentScore * 0.25 +
      regressionAnalysisScore * 0.25 +
      collaborationScore * 0.25 +
      worksheetQuizScore * 0.25
  );

  const letterGrade: 'A' | 'B' | 'C' | 'D' =
    finalTotalScore >= 85
      ? 'A'
      : finalTotalScore >= 72
      ? 'B'
      : finalTotalScore >= 60
      ? 'C'
      : 'D';

  const predicate: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan' =
    letterGrade === 'A'
      ? 'Sangat Baik'
      : letterGrade === 'B'
      ? 'Baik'
      : letterGrade === 'C'
      ? 'Cukup'
      : 'Perlu Bimbingan';

  return {
    studentId: student.id,
    studentName: student.name,
    groupId: student.groupId,
    experimentScore,
    regressionAnalysisScore,
    collaborationScore,
    worksheetQuizScore,
    finalTotalScore,
    letterGrade,
    predicate,
  };
}

export function exportRubricGradesToCSV(rubrics: RubricScoreBreakdown[]): string {
  const headers = [
    'ID Siswa',
    'Nama Siswa',
    'Kelompok Praktikum',
    'Skor Eksperimen (25%)',
    'Skor Analisis Regresi (25%)',
    'Skor Kolaborasi Tugas (25%)',
    'Skor Kuis & LKS (25%)',
    'Nilai Akhir (0-100)',
    'Grade Huruf',
    'Predikat Evaluasi',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = rubrics.map((r) =>
    [
      r.studentId,
      r.studentName,
      r.groupId,
      r.experimentScore,
      r.regressionAnalysisScore,
      r.collaborationScore,
      r.worksheetQuizScore,
      r.finalTotalScore,
      r.letterGrade,
      r.predicate,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function generateAutomaticFeedback(
  domain: ScienceDomain,
  physicsParams?: PhysicsParams,
  chemistryParams?: ChemistryParams,
  astronomyParams?: AstronomyParams
): LabNotification {
  const now = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (domain === 'Astronomi' && astronomyParams) {
    const a = calculateAstronomyMetrics(astronomyParams);

    if (astronomyParams.mode === 'milkyway-galaxy') {
      return {
        id,
        timestamp: now,
        severity: a.velocityAnomalyKms > 45 ? 'elevated' : 'nominal',
        domain: 'Astronomi',
        title: `Kurva Rotasi Galaksi Bima Sakti (R = ${astronomyParams.galactocentricRadiusKpc} kpc)`,
        message: `Kecepatan rotasi observasi v_obs = ${a.observedDarkMatterVelocityKms} km/s (Keplerian tanpa Materi Gelap = ${a.keplerianVelocityKms} km/s). Periode galaktik = ${a.galacticOrbitalPeriodMyr} juta tahun.`,
        formulaHint: 'v(R) = √(G · M(<R) / R)',
      };
    }

    if (astronomyParams.mode === 'stellar-exoplanet') {
      return {
        id,
        timestamp: now,
        severity: a.isInHabitableZone ? 'nominal' : 'elevated',
        domain: 'Astronomi',
        title: `Bintang Kelas Spektral ${a.spectralClass} & Transit Eksoplanet`,
        message: `Luminositas bintang L = ${a.stellarLuminositySolar} L☉. Kedalaman transit ΔF/F = ${a.transitDepthPct}% (${a.transitDepthPpm} ppm). Status orbit: ${
          a.isInHabitableZone ? 'Di Dalam Zona Laik Huni' : 'Di Luar Zona Laik Huni'
        }.`,
        formulaHint: 'L/L☉ = (R/R☉)²(T/T☉)⁴  |  ΔF/F = (Rp/R*)²',
      };
    }

    return {
      id,
      timestamp: now,
      severity: 'nominal',
      domain: 'Astronomi',
      title: `Hukum Orbit Kepler (T = ${a.orbitalPeriodYears} Tahun Bumi)`,
      message: `Pada a = ${astronomyParams.customSemiMajorAxisAu} AU dan e = ${astronomyParams.customEccentricity}, kecepatan perihelion v_p = ${a.perihelionVelocityKms} km/s dan aphelion v_a = ${a.aphelionVelocityKms} km/s.`,
      formulaHint: 'T² / a³ = 1 / M_*  |  dA/dt = konstan',
    };
  }

  if (domain === 'Fisika' && physicsParams) {
    const m = calculatePhysicsMetrics(physicsParams);

    if (physicsParams.mode === 'collision-momentum') {
      return {
        id,
        timestamp: now,
        severity: m.energyLossPct > 50 ? 'elevated' : 'nominal',
        domain: 'Fisika',
        title: `Hukum Kekekalan Momentum (p = ${m.initialTotalMomentum} kg·m/s)`,
        message: `Pasca tumbukan (e = ${physicsParams.restitutionCoeff}): v₁' = ${m.v1Final} m/s, v₂' = ${m.v2Final} m/s. Disipasi energi kinetik sebesar ${m.energyLossPct}%.`,
        formulaHint: "m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'",
      };
    }

    if (physicsParams.mode === 'spring-hooke') {
      return {
        id,
        timestamp: now,
        severity: 'nominal',
        domain: 'Fisika',
        title: `Osilasi Harmonik Hukum Hooke (T = ${m.oscillationPeriod} s)`,
        message: `Gaya pemulih pegas Fp = ${m.springRestoringForce} N dengan energi potensial elastis Ep = ${m.springPotentialEnergy} J pada k = ${physicsParams.springConstantK} N/m.`,
        formulaHint: 'F = -k·x  |  T = 2π√(m/k)',
      };
    }

    if (physicsParams.mode === 'projectile-gravity') {
      if (physicsParams.launchAngle >= 43 && physicsParams.launchAngle <= 47) {
        return {
          id,
          timestamp: now,
          severity: 'nominal',
          domain: 'Fisika',
          title: 'Sudut Elevasi Optimal Tercapai (≈45°)',
          message: `Jarak jangkauan horizontal maksimum R = ${m.projectileRange} m dicapai pada g = ${physicsParams.gravity} m/s² dengan tinggi puncak ${m.maxProjectileHeight} m.`,
          formulaHint: 'R = (v₀² · sin(2θ)) / g',
        };
      }
      return {
        id,
        timestamp: now,
        severity: 'nominal',
        domain: 'Fisika',
        title: 'Lintasan Parabolik & Gravitasi Terhitung',
        message: `Waktu tempuh t = ${m.timeOfFlight} s, tinggi maksimum H = ${m.maxProjectileHeight} m, dan gaya gravitasi antar-massa Fg = ${m.universalGravityForce} µN.`,
        formulaHint: 'y(t) = y₀ + v₀y·t - ½g·t²',
      };
    }

    if (!m.isMoving) {
      return {
        id,
        timestamp: now,
        severity: 'elevated',
        domain: 'Fisika',
        title: 'Hukum I Newton — Kesetimbangan Statis (ΣF = 0 N)',
        message: `Gaya penggerak belum melampaui batas gesek statis maksimum (fs,maks = ${m.maxStaticFriction} N). Tambahkan gaya dorong F atau perkecil koefisien gesek μs agar benda bergerak.`,
        formulaHint: 'ΣF = 0 ⇔ |F - m·g·sin(θ)| ≤ μs·N',
      };
    }

    return {
      id,
      timestamp: now,
      severity: Math.abs(m.acceleration) > 12 ? 'critical' : 'nominal',
      domain: 'Fisika',
      title: 'Hukum II Newton — Gerak Lurus Berubah Beraturan',
      message: `Benda bergerak dengan percepatan konstan a = ${m.acceleration} m/s² (ΣF = ${m.netForce} N, gaya gesek kinetis fk = ${Math.abs(m.frictionForce)} N).`,
      formulaHint: 'ΣF = F - m·g·sin(θ) - fk = m·a',
    };
  }

  if (domain === 'Kimia' && chemistryParams) {
    const c = calculateChemistryMetrics(chemistryParams);

    if (chemistryParams.mode === 'acid-base-titration') {
      return {
        id,
        timestamp: now,
        severity:
          c.titrationRegion === 'Titik Ekuivalen' ? 'nominal' : 'elevated',
        domain: 'Kimia',
        title: `Titrasi Asam-Basa: ${c.titrationRegion} (pH = ${c.currentPh})`,
        message: `Volume titran NaOH = ${chemistryParams.titrantAddedMl} mL (Titik ekuivalen teoretis = ${c.equivalenceVolumeMl} mL). Warna indikator: ${c.indicatorColorName}.`,
        formulaHint: 'M_a · V_a = M_b · V_b',
      };
    }

    if (chemistryParams.mode === 'electrochemistry-cell') {
      return {
        id,
        timestamp: now,
        severity: c.nernstCellPotentialE > 0 ? 'nominal' : 'critical',
        domain: 'Kimia',
        title: `Potensial Sel Galvani Nernst (E_sel = +${c.nernstCellPotentialE} V)`,
        message: `Reaksi redoks spontan menghasilkan ΔG = ${c.electroFreeEnergyDeltaG} kJ/mol dengan kuosien reaksi Q = ${c.reactionQuotientQ}.`,
        formulaHint: 'E_sel = E°_sel - (RT / nF) · ln(Q)',
      };
    }

    if (c.finalTempC > 95) {
      return {
        id,
        timestamp: now,
        severity: 'critical',
        domain: 'Kimia',
        title: 'Peringatan Termal Kalorimeter (T > 95°C)',
        message: `Pelepasan kalor eksotermik menaikkan suhu larutan hingga ${c.finalTempC}°C (ΔT = +${c.deltaTempC}°C). Kurangi konsentrasi reaktan atau tingkatkan volume pelarut.`,
        formulaHint: 'q = m·c·ΔT = -n·ΔH',
      };
    }
    if (!c.isSpontaneous) {
      return {
        id,
        timestamp: now,
        severity: 'elevated',
        domain: 'Kimia',
        title: 'Reaksi Non-Spontan pada Suhu Saat Ini (ΔG > 0)',
        message: `Energi bebas Gibbs ΔG = +${c.deltaG} kJ/mol. Untuk reaksi endotermik dengan ΔS > 0, naikkan suhu T agar suku T·ΔS melampaui ΔH.`,
        formulaHint: 'ΔG = ΔH - T·ΔS',
      };
    }
    return {
      id,
      timestamp: now,
      severity: 'nominal',
      domain: 'Kimia',
      title: `Reaksi ${c.thermalClassification} Spontan (ΔG = ${c.deltaG} kJ/mol)`,
      message: `Perubahan suhu kalorimeter ΔT = ${c.deltaTempC >= 0 ? '+' : ''}${c.deltaTempC}°C menuju ${c.finalTempC}°C. Laju reaksi awal r = ${c.reactionRate} M/s.`,
      formulaHint: 'ΔG = ΔH - T·ΔS < 0',
    };
  }

  return {
    id,
    timestamp: now,
    severity: 'nominal',
    domain: 'Kolaborasi',
    title: 'Sinkronisasi Sesi Laboratorium Aktif',
    message: 'Parameter eksperimen dan catatan kelompok telah diperbarui secara real-time.',
  };
}

export function exportRecordsToCSV(records: ExperimentRecord[]): string {
  const headers = [
    'ID Eksperimen',
    'Waktu',
    'Nama Siswa',
    'Kelompok',
    'Domain Praktikum',
    'Judul Eksperimen',
    'Parameter Input',
    'Hasil Pengukuran Utama',
    'Catatan Analisis',
  ];

  const escapeCsvCell = (value: string | number): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((rec) => {
    const metricsFormatted = Object.entries(rec.keyMetrics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    return [
      rec.id,
      rec.timestamp,
      rec.studentName,
      rec.groupId,
      rec.domain,
      rec.experimentTitle,
      rec.parametersSummary,
      metricsFormatted,
      rec.notes,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export type AcademicLevel = 'smp' | 'sma' | 'mahasiswa';

export type DrLabMuEducationLevel = 'SMP' | 'SMA' | 'Perguruan Tinggi';

export function mapAcademicLevelToTelemetry(
  level: AcademicLevel
): DrLabMuEducationLevel {
  if (level === 'smp') return 'SMP';
  if (level === 'mahasiswa') return 'Perguruan Tinggi';
  return 'SMA';
}

export interface GuidedScenarioPreset {
  id: string;
  domain: ScienceDomain;
  title: string;
  badgeText: string;
  objective: string;
  physicsPatch?: Partial<PhysicsParams>;
  chemistryPatch?: Partial<ChemistryParams>;
  astronomyPatch?: Partial<AstronomyParams>;
}

export const GUIDED_LAB_SCENARIOS: GuidedScenarioPreset[] = [
  {
    id: 'phys-static-threshold',
    domain: 'Fisika',
    title: 'Uji Ambang Gesek Statis',
    badgeText: 'Hukum I Newton · θ = 15°',
    objective:
      'Amati kondisi tepat sebelum benda bergerak ketika gaya dorong F diimbangi oleh gaya berat sejajar bidang dan gesek statis.',
    physicsPatch: {
      mode: 'newton-incline',
      mass: 5.0,
      appliedForce: 18,
      inclineAngle: 15,
      frictionCoeffKinetic: 0.2,
      frictionCoeffStatic: 0.27,
      gravity: 9.81,
      initialVelocity: 0,
    },
  },
  {
    id: 'phys-mars-projectile',
    domain: 'Fisika',
    title: 'Parabola Sudut Optimal di Mars',
    badgeText: 'Kinematika · ∠ = 45°',
    objective:
      'Bandingkan jangkauan horizontal maksimum pada sudut elevasi 45° di medan gravitasi Mars (g = 3.72 m/s²).',
    physicsPatch: {
      mode: 'projectile-gravity',
      mass: 3.0,
      initialVelocity: 24,
      launchAngle: 45,
      initialHeight: 0,
      gravity: 3.72,
    },
  },
  {
    id: 'phys-elastic-collision',
    domain: 'Fisika',
    title: 'Pertukaran Kecepatan Tumbukan Elastis',
    badgeText: 'Momentum · e = 1.00',
    objective:
      'Dua benda bermassa identik (m₁ = m₂ = 4 kg) bertumbukan lenting sempurna dan saling bertukar kecepatan.',
    physicsPatch: {
      mode: 'collision-momentum',
      mass: 4.0,
      collisionMass2: 4.0,
      initialVelocity: 8,
      velocity2Initial: -2,
      restitutionCoeff: 1.0,
    },
  },
  {
    id: 'phys-underdamped-spring',
    domain: 'Fisika',
    title: 'Resonansi Pegas Teredam Ringan',
    badgeText: 'Hukum Hooke · k = 160 N/m',
    objective:
      'Amati pertukaran periodik antara energi potensial elastis dan energi kinetik pada osilator harmonik.',
    physicsPatch: {
      mode: 'spring-hooke',
      mass: 4.0,
      springConstantK: 160,
      springDisplacement: 1.0,
      dampingCoeff: 0.1,
    },
  },
  {
    id: 'chem-exo-catalysed',
    domain: 'Kimia',
    title: 'Efek Katalis pada Energi Aktivasi',
    badgeText: 'Kalorimetri · Katalis Aktif',
    objective:
      'Aktifkan katalis pada netralisasi eksotermik untuk memangkas puncak Ea tanpa mengubah ΔH maupun ΔG.',
    chemistryPatch: {
      mode: 'thermo-calorimetry',
      reactionId: 'neutralization-hcl-naoh',
      initialTempC: 25,
      reactantConcentration: 2.0,
      solutionVolumeMl: 250,
      useCatalyst: true,
    },
  },
  {
    id: 'chem-equivalence-point',
    domain: 'Kimia',
    title: 'Tepat Titik Ekuivalen Titrasi (pH 7.00)',
    badgeText: 'Titrasi · V_NaOH = 20.0 mL',
    objective:
      'Capai kondisi stoikiometri mol H⁺ = mol OH⁻ pada penambahan 20.0 mL NaOH 0.25 M ke 25 mL HCl 0.20 M.',
    chemistryPatch: {
      mode: 'acid-base-titration',
      analyteAcidConc: 0.2,
      analyteVolumeMl: 25,
      titrantBaseConc: 0.25,
      titrantAddedMl: 20.0,
      acidPka: 1.0,
      indicatorType: 'bromtimol-biru',
    },
  },
  {
    id: 'chem-daniell-standard',
    domain: 'Kimia',
    title: 'Potensial Standar Sel Daniell (+1.10 V)',
    badgeText: 'Elektrokimia · Q = 1.00',
    objective:
      'Uji jembatan garam dan aliran elektron dari anoda Zn ke katoda Cu pada konsentrasi standar 1.00 M.',
    chemistryPatch: {
      mode: 'electrochemistry-cell',
      redoxPairId: 'zn-cu-daniell',
      anodeConcM: 1.0,
      cathodeConcM: 1.0,
      initialTempC: 25,
    },
  },
  {
    id: 'astro-halley-ellipse',
    domain: 'Astronomi',
    title: 'Orbit Elips Ekstrem Komet Halley',
    badgeText: 'Hukum II Kepler · e = 0.82',
    objective:
      'Amati lonjakan kecepatan orbit saat perihelion dan pelambatan drastis saat aphelion sesuai kekekalan momentum sudut.',
    astronomyPatch: {
      mode: 'solar-kepler',
      selectedPlanetId: 'halley-comet',
      customSemiMajorAxisAu: 17.8,
      customEccentricity: 0.82,
      centralStarMassSolar: 1.0,
      showKeplerAreaSweep: true,
    },
  },
  {
    id: 'astro-dark-matter-flat',
    domain: 'Astronomi',
    title: 'Anomali Kurva Rotasi Bima Sakti',
    badgeText: 'Materi Gelap · R = 16.0 kpc',
    objective:
      'Bandingkan kurva rotasi datar observasi (dengan halo materi gelap) terhadap kurva turun Keplerian di tepi galaksi.',
    astronomyPatch: {
      mode: 'milkyway-galaxy',
      galactocentricRadiusKpc: 16.0,
      darkMatterHaloFraction: 1.15,
      sgrAStarMassMillionSolar: 4.15,
    },
  },
  {
    id: 'astro-habitable-transit',
    domain: 'Astronomi',
    title: 'Eksoplanet di Zona Laik Huni',
    badgeText: 'Fotometri Transit · Kelas G',
    objective:
      'Simulasikan transit planet seukuran Jupiter di depan bintang serupa Matahari (5778 K) pada jarak 1.00 AU.',
    astronomyPatch: {
      mode: 'stellar-exoplanet',
      starEffectiveTempK: 5778,
      starRadiusSolar: 1.0,
      exoplanetRadiusEarth: 10.91,
      exoplanetOrbitAu: 1.0,
    },
  },
];

export interface ConceptCompanionCard {
  heading: string;
  levelLabel: string;
  summaryText: string;
  keyEquation: string;
  practicalTip: string;
}

export function getConceptCardContent(
  domain: ScienceDomain,
  subMode: string,
  level: AcademicLevel
): ConceptCompanionCard {
  if (level === 'smp') {
    if (domain === 'Fisika') {
      return {
        heading: 'Analogi Konkret SMP: Gaya, Lemparan Bola & Getaran Pegas',
        levelLabel: 'Mode Siswa SMP — Analogi Sehari-hari',
        summaryText:
          'Bayangkan saat kamu mendorong meja di lantai kasar atau melempar bola basket ke ring: makin besar dorongan awalmu, makin cepat dan jauh bolanya melambung sebelum ditarik gravitasi ke bawah.',
        keyEquation: 'Gaya Bersih = Dorongan - Gesekan   |   Percepatan = Gaya / Massa',
        practicalTip:
          'Eksperimen Seru: Geser slider Gaya Dorong atau Sudut Lempar, lalu klik Rekam Data untuk melihat polanya bersama Dr. LabMu!',
      };
    }
    if (domain === 'Kimia') {
      return {
        heading: 'Analogi Konkret SMP: Suhu Reaksi & Keseimbangan Asam-Basa',
        levelLabel: 'Mode Siswa SMP — Analogi Sehari-hari',
        summaryText:
          'Seperti melarutkan gula di teh hangat atau mencampur perasan jeruk nipis (asam) dengan air sabun (basa): saat takarannya pas seimbang, sifat asam dan basanya saling menetralkan di pH 7.',
        keyEquation: 'Asam + Basa → Garam + Air + Panas (pH Netral = 7)',
        practicalTip:
          'Eksperimen Seru: Teteskan larutan sedikit demi sedikit dengan tombol [+] sampai warna cairan di gelas kimia berubah!',
      };
    }
    return {
      heading: 'Analogi Konkret SMP: Putaran Planet & Cahaya Bintang',
      levelLabel: 'Mode Siswa SMP — Analogi Sehari-hari',
      summaryText:
        'Seperti melihat Bulan mengelilingi Bumi atau komidi putar: planet yang berada lebih dekat dengan Matahari harus berlari jauh lebih cepat agar tidak tertarik jatuh ke Matahari.',
      keyEquation: 'Makin Jauh Planet dari Matahari → Makin Lama 1 Tahun Orbitnya',
      practicalTip:
        'Eksperimen Seru: Pilih planet Merkurius lalu bandingkan dengan Jupiter, dan tanyakan ke Dr. LabMu mengapa kecepatannya berbeda!',
    };
  }

  if (domain === 'Fisika') {
    if (subMode === 'projectile-gravity') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Gerak Parabola (Projektil)',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Gerak parabola adalah gabungan gerak lurus beraturan (GLB) pada sumbu mendatar X dan gerak lurus berubah beraturan (GLBB) dipercepat gravitasi pada sumbu vertikal Y.',
            keyEquation: 'R = (v₀² · sin 2θ) / g   |   H_maks = (v₀² · sin²θ) / (2g)',
            practicalTip:
              'Tips Praktikum: Atur sudut tembak tepat 45° untuk membuktikan jarak jangkauan mendatar paling jauh pada ketinggian awal h₀ = 0 m.',
          }
        : {
            heading: 'Analisis Vektor & Balistik Gravitasi',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Integrasi persamaan gerak r̈(t) = -g ĵ menghasilkan lintasan kuadratik y(x) = h₀ + x tan θ - (g x²) / (2 v₀² cos²θ) dengan konservasi energi mekanik E = ½mv² + mgy.',
            keyEquation: 'r(t) = (v₀ cos θ)t î + [h₀ + (v₀ sin θ)t - ½gt²] ĵ',
            practicalTip:
              'Analisis Kuantitatif: Variasikan medan gravitasi planet g dan plot regresi linier antara v₀² terhadap R untuk memverifikasi gradien 1/g.',
          };
    }
    if (subMode === 'collision-momentum') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Hukum Kekekalan Momentum',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Total momentum sebelum dan sesudah tumbukan selalu tetap selama tidak ada gaya luar. Koefisien restitusi (e) menentukan seberapa lenting tumbukan tersebut.',
            keyEquation: "m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'   |   e = -(v₂' - v₁') / (v₂ - v₁)",
            practicalTip:
              'Tips Praktikum: Bandingkan e = 1.0 (lenting sempurna, energi kinetik utuh) dengan e = 0.0 (tidak lenting, kedua benda menempel pasca tumbukan).',
          }
        : {
            heading: 'Dinamika Impuls & Disipasi Energi Tumbukan 1D',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Dalam kerangka pusat massa (center-of-mass frame), momentum total sistem terisolasi kekal (dp_tot/dt = 0), sedangkan fraksi energi kinetik yang terdisipasi menjadi panas adalah (1 - e²) pada kerangka reduksi.',
            keyEquation: 'ΔEK = -½ μ_red (1 - e²)(v₁ - v₂)²   dengan   μ_red = (m₁m₂)/(m₁+m₂)',
            practicalTip:
              'Analisis Kuantitatif: Catat persentase kehilangan energi kinetik (Hilang EK %) pada berbagai rasio massa m₁/m₂.',
          };
    }
    if (subMode === 'spring-hooke') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Gaya Pegas Hooke & Getaran Harmonik',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Pegas selalu menarik atau mendorong beban kembali ke titik setimbang (x = 0) dengan gaya yang sebanding dengan simpangannya. Makin kaku pegas (k besar), makin cepat getarannya.',
            keyEquation: 'Fp = -k · Δx   |   T = 2π √(m / k)   |   Ep = ½ k Δx²',
            practicalTip:
              'Tips Praktikum: Geser simpangan Δx lalu rekam 4 titik data untuk melihat garis lurus Hukum Hooke di grafik regresi!',
          }
        : {
            heading: 'Osilator Harmonik Teredam (Damped Harmonic Oscillator)',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Persamaan diferensial orde dua m ẍ + b ẋ + kx = 0 memiliki solusi teredam kurang (underdamped) dengan peluruhan amplitudo eksponensial e^(-γt) dan pergeseran frekuensi sudut ω_d.',
            keyEquation: 'x(t) = A e^(-γt) cos(ω_d t)   |   ω_d = √(k/m - (b/2m)²)',
            practicalTip:
              'Analisis Kuantitatif: Amati pengaruh faktor redaman viskos b terhadap peluruhan energi mekanik total E(t) sepanjang waktu.',
          };
    }
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Hukum I & II Newton pada Bidang Miring',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Benda mulai bergerak jika gaya penggerak melampaui batas gesek statis maksimum (fs,maks). Setelah bergerak, percepatan benda berbanding lurus dengan resultan gaya (ΣF) dan berbanding terbalik dengan massa (m).',
          keyEquation: 'ΣF = F - m·g·sin θ - fk = m · a   |   fk = μk · m·g·cos θ',
          practicalTip:
            'Tips Praktikum: Coba tambah gaya dorong F secara bertahap dengan tombol [+] lalu rekam minimal 3 data untuk melihat grafik lurus F terhadap a.',
        }
      : {
          heading: 'Mekanika Newton & Dekomposisi Vektor Bidang Miring',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Transformasi koordinat ke sumbu sejajar (x̂) dan tegak lurus bidang miring (ŷ) memisahkan kendala normal N = mg cos θ dari persamaan dinamika translasi m ẍ = F_ext - mg sin θ - f(ẋ).',
          keyEquation: 'm (d²x/dt²) = F - mg sin θ - sgn(v) μk mg cos θ',
          practicalTip:
            'Analisis Kuantitatif: Tentukan sudut kritis kemiringan θ_c = arctan(μs) di mana balok tepat mulai meluncur tanpa gaya luar (F = 0 N).',
        };
  }

  if (domain === 'Kimia') {
    if (subMode === 'acid-base-titration') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Titrasi Asam-Basa & Titik Ekuivalen',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Titrasi digunakan untuk mencari konsentrasi larutan asam dengan meneteskan basa standar hingga jumlah mol ion H⁺ tepat sama dengan mol ion OH⁻ (titik ekuivalen).',
            keyEquation: 'M_asam × V_asam = M_basa × V_basa   |   pH = -log[H⁺]',
            practicalTip:
              'Tips Praktikum: Gunakan tombol [+] pada Volume NaOH di sekitar 19.5 – 20.5 mL untuk mengamati lonjakan tajam pH dan perubahan warna indikator!',
          }
        : {
            heading: 'Kesetimbangan Ionik & Kurva Sigmoidal Henderson-Hasselbalch',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Sepanjang zona penyangga pra-ekuivalen, pH dikendalikan oleh rasio pasangan asam-basa konjugasi, sedangkan di titik infleksi (d²pH/dV² = 0) kapasitas penyangga mencapai minimum.',
            keyEquation: 'pH = pKa + log([A⁻]/[HA])   |   [H⁺]³ + Ka[H⁺]² - (Kw + Ka C_a)[H⁺] = 0',
            practicalTip:
              'Analisis Kuantitatif: Bandingkan pemilihan indikator Bromtimol Biru (pKa ≈ 7.1) terhadap Fenolftalein (pKa ≈ 9.3) di sekitar volume ekuivalen.',
          };
    }
    if (subMode === 'electrochemistry-cell') {
      return level === 'sma'
        ? {
            heading: 'Intisari Konsep: Sel Volta (Galvani) & Reaksi Redoks',
            levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
            summaryText:
              'Pada sel Volta, reaksi redoks spontan menghasilkan arus listrik. Elektron mengalir dari Anoda (tempat oksidasi, kutub negatif) menuju Katoda (tempat reduksi, kutub positif).',
            keyEquation: 'E°_sel = E°_katoda - E°_anoda   (Ingat: Katoda Reduksi, Anoda Oksidasi)',
            practicalTip:
              'Tips Praktikum: Perhatikan nilai voltmeter digital saat Anda mengubah pasangan elektrode dari Zn-Cu ke Mg-Ag!',
          }
        : {
            heading: 'Termodinamika Elektrokimia & Persamaan Nernst',
            levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
            summaryText:
              'Potensial gaya gerak listrik sel bergantung pada aktivitas ionik kuosien reaksi Q = [Anoda]/[Katoda] dan berhubungan langsung dengan kerja listrik maksimum ΔG = -nFE_sel.',
            keyEquation: 'E_sel = E°_sel - (RT / nF) ln Q   |   ΔG = -n F E_sel',
            practicalTip:
              'Analisis Kuantitatif: Variasikan rasio konsentrasi [Anoda]/[Katoda] untuk memverifikasi kemiringan Nernst sebesar -0.0592/n Volt per dekade log Q.',
          };
    }
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Termokimia, Kalorimetri & Energi Gibbs',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Reaksi eksotermik (ΔH < 0) melepaskan panas sehingga suhu kalorimeter naik, sedangkan endotermik (ΔH > 0) menyerap panas. Suatu reaksi berjalan spontan jika energi bebas Gibbs bernilai negatif (ΔG < 0).',
          keyEquation: 'q = m · c · ΔT   |   ΔG = ΔH - T · ΔS',
          practicalTip:
            'Tips Praktikum: Klik tombol "Gunakan Katalis" dan perhatikan bagaimana bukit energi aktivasi (Ea) turun sehingga reaksi jauh lebih cepat!',
        }
      : {
          heading: 'Kinetika Arrhenius & Termodinamika Kesetimbangan Kimia',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Konstanta laju reaksi mengikuti distribusi Boltzmann k = A exp(-Ea/RT), sedangkan arah spontanitas dan konstanta kesetimbangan termodinamika ditentukan oleh ΔG° = -RT ln K_eq.',
          keyEquation: 'k(T) = A e^(-Ea / RT)   |   ΔG = ΔH - TΔS = -RT ln K_eq',
          practicalTip:
            'Analisis Kuantitatif: Uji reaksi endotermik CaCO₃ dan cari suhu balik (crossover temperature T = ΔH/ΔS) di mana ΔG beralih menjadi negatif.',
        };
  }

  // Astronomi
  if (subMode === 'milkyway-galaxy') {
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Galaksi Bima Sakti & Misteri Materi Gelap',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Tata Surya kita mengorbit pusat Galaksi Bima Sakti (lubang hitam Sagittarius A*) pada jarak ~8.2 kpc. Bintang-bintang di tepi luar galaksi bergerak jauh lebih cepat dari perkiraan karena adanya Halo Materi Gelap.',
          keyEquation: 'v_rotasi = √(G · M_total / R)   |   R_TataSurya ≈ 8.2 kpc',
          practicalTip:
            'Tips Praktikum: Geser Fraksi Materi Gelap ke 0.0x untuk melihat kurva biru berimpit dengan kurva kuning Keplerian!',
        }
      : {
          heading: 'Dinamika Galaktik, Profil Halo Materi Gelap & Metrik Sgr A*',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Kurva rotasi datar (v(R) ≈ konstan pada R > 8 kpc) membuktikan keberadaan profil kerapatan halo isotermal ρ_DM(r) ∝ r⁻² sehingga massa terlingkupi M(<R) tumbuh linier terhadap radius galaktosentrik R.',
          keyEquation: 'v²(R) = v²_bulge(R) + v²_disk(R) + (G M_halo(<R)) / R   |   R_s = 2GM_BH / c²',
          practicalTip:
            'Analisis Kuantitatif: Hitung massa total terlingkupi M(<R) pada R = 20 kpc dan bandingkan kontribusi materi tampak terhadap halo materi gelap.',
        };
  }
  if (subMode === 'stellar-exoplanet') {
    return level === 'sma'
      ? {
          heading: 'Intisari Konsep: Spektrum Bintang (O–M) & Transit Eksoplanet',
          levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
          summaryText:
            'Warna bintang menunjukkan suhunya: bintang biru (Kelas O/B) sangat panas, kuning (Kelas G seperti Matahari) sedang, dan merah (Kelas M) lebih dingin. Saat planet melintas di depan bintang, cahaya bintang meredup sedikit.',
          keyEquation: 'L ∝ R*² · T⁴   |   Peredupan Transit (%) = (R_planet / R_bintang)² × 100%',
          practicalTip:
            'Tips Praktikum: Atur jarak orbit eksoplanet agar masuk ke rentang Zona Laik Huni (Habitable Zone) di mana air cair dapat bertahan.',
        }
      : {
          heading: 'Hukum Radiasi Stefan-Boltzmann & Fotometri Transit Kepler',
          levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
          summaryText:
            'Posisi bintang pada Diagram Hertzsprung-Russell ditentukan oleh fluks bolometrik L = 4πR*²σT_eff⁴, sedangkan kedalaman kurva cahaya transit ΔF/F memberikan rasio penampang geometris (Rp/R*)².',
          keyEquation: 'L/L☉ = (R*/R☉)² (T_eff/5778 K)⁴   |   d_HZ ≈ √(L / L☉) AU',
          practicalTip:
            'Analisis Kuantitatif: Rekam variasi jari-jari planet Rp terhadap kedalaman transit ΔF/F (ppm) untuk menguji batas deteksi fotometrik.',
        };
  }
  return level === 'sma'
    ? {
        heading: 'Intisari Konsep: Tata Surya & Tiga Hukum Orbit Kepler',
        levelLabel: 'Mode Siswa SMA/SMK — Konsep Intuitif',
        summaryText:
          'Planet bergerak mengelilingi Matahari dalam lintasan elips (Hukum I), bergerak lebih cepat saat dekat Matahari/perihelion (Hukum II), dan kuadrat periode orbitnya sebanding dengan pangkat tiga jarak rata-ratanya (Hukum III).',
        keyEquation: 'T² / a³ = Konstan (1.00 untuk M* = 1 M☉)   |   r_perihelion = a(1 - e)',
        practicalTip:
          'Tips Praktikum: Klik tombol objek planet (Merkurius, Bumi, Jupiter, Komet Halley) dan perhatikan bahwa rasio T²/a³ selalu bernilai 1.000!',
      }
    : {
        heading: 'Mekanika Orbit Elips Keplerian & Persamaan Vis-Viva',
        levelLabel: 'Mode Mahasiswa S1 — Formulasi Kalkulus & Analitik',
        summaryText:
          'Dari solusi masalah dua-benda gravitasi Newton, kecepatan orbit sesaat pada jarak r memenuhi persamaan Vis-Viva v² = GM*(2/r - 1/a), dengan konservasi momentum sudut spesifik h = r × v yang menghasilkan dA/dt = h/2.',
        keyEquation: 'T² = (4π² / GM*) a³   |   v_p / v_a = (1 + e) / (1 - e)',
        practicalTip:
          'Analisis Kuantitatif: Variasikan massa bintang induk M* dan amati perubahan skala konstanta Kepler T²/a³ = 1/M*.',
      };
}

export function stepParameterValue(
  current: number,
  delta: number,
  min: number,
  max: number,
  decimals = 2
): number {
  const raw = current + delta;
  const clamped = Math.min(max, Math.max(min, raw));
  return Number(clamped.toFixed(decimals));
}

export interface DrLabMuOutlierPoint {
  trialNumber: number;
  id: string;
  title: string;
  x: number;
  yObserved: number;
  yPredicted: number;
  residual: number;
  parametersSummary: string;
}

export interface DrLabMuTelemetryPayload {
  domain: ScienceDomain;
  topic: string;
  educationLevel: DrLabMuEducationLevel;
  currentParameters: Record<string, number | string | boolean>;
  recordedData: Array<{
    trialNumber: number;
    id: string;
    title: string;
    parametersSummary: string;
    x?: number;
    y1?: number;
    y2?: number;
    keyMetrics: Record<string, number | string>;
  }>;
  analytics: {
    rSquared: number;
    slope: number;
    intercept: number;
    stdDev: number;
    equation: string;
    hasExtremeOutlier: boolean;
    outlierTrial?: DrLabMuOutlierPoint;
  };
  studentQuery: string;
}

export interface DrLabMuStructuredResponse {
  observation: string;
  dataHighlight: string;
  socraticQuestion: string;
  detectedTrigger:
    | 'anomaly-outlier'
    | 'direct-answer-refusal'
    | 'off-topic-refusal'
    | 'concept-analogy';
  formattedText: string;
  uiActions?: DrLabMuUIAction[];
}

export interface BiologyTelemetryContext {
  moduleId: string;
  params: Record<string, number>;
  parameters?: Record<string, number>;
  liveMetrics?: Record<string, number>;
}

const HUMAN_MODULE_LABELS: Record<string, string> = {
  'newton-incline': 'Hukum II Newton & Bidang Miring',
  'projectile-gravity': 'Kinematika Gerak Parabola',
  'collision-momentum': 'Tumbukan & Kekekalan Momentum',
  'spring-hooke': 'Osilasi Pegas Hukum Hooke',
  'orbital-gravity': 'Gravitasi Universal Dua Massa',
  'pendulum-harmonic': 'Bandul Sederhana Harmonis',
  'hukum-pendulum': 'Hukum Bandul Sederhana Harmonis',
  'stokes-viscosity': 'Viskositas Fluida & Hukum Stokes',
  'ohm-wheatstone': 'Hukum Ohm & Jembatan Wheatstone',
  'optics-young-slit': 'Interferensi Celah Ganda Young',
  'photoelectric-planck': 'Efek Fotolistrik & Konstanta Planck',
  'thermo-calorimetry': 'Termokimia & Kalorimetri',
  'acid-base-titration': 'Titrasi Asam-Basa',
  'titrasi-asam-basa': 'Titrasi Asam-Basa',
  'electrochemistry-cell': 'Sel Elektrokimia Galvani',
  'ideal-gas-boyle': 'Hukum Gas Ideal & Kompresi Boyle',
  'reaction-kinetics-arrhenius': 'Kinetika Laju Reaksi & Arrhenius',
  'spectrophotometry-beer': 'Spektrofotometri UV-Vis & Hukum Beer',
  'photosynthesis-ingenhousz': 'Fotosintesis Ingenhousz (Hydrilla)',
  'enzyme-catalase': 'Kinetika Enzim Katalase Michaelis-Menten',
  'enzyme-kinetics': 'Kinetika Enzim Michaelis-Menten',
  'predator-prey-dynamics': 'Dinamika Populasi Lotka-Volterra',
  'cell-osmosis-tonicity': 'Osmosis & Tekanan Turgor Sel',
  'osmosis-plasmolysis': 'Osmosis & Plasmolisis Sel Tumbuhan',
  'mikroskop-sel': 'Mikroskop & Struktur Organel Sel',
  'solar-kepler': 'Dinamika Orbit Hukum Kepler',
  'hukum-kepler': 'Hukum-Hukum Orbit Kepler',
  'milkyway-galaxy': 'Kurva Rotasi Galaksi Bima Sakti',
  'stellar-exoplanet': 'Spektrum Bintang & Transit Eksoplanet',
  'stellar-wien-spectrum': 'Hukum Pergeseran Wien & Spektroskopi',
  'hubble-expansion': 'Hukum Hubble & Ekspansi Kosmik',
};

export function buildDrLabMuTelemetry(
  domain: ScienceDomain,
  academicLevel: AcademicLevel,
  physicsParams: PhysicsParams,
  chemistryParams: ChemistryParams,
  astronomyParams: AstronomyParams,
  records: ExperimentRecord[],
  studentQuery: string,
  biologyContext?: BiologyTelemetryContext
): DrLabMuTelemetryPayload {
  const educationLevel = mapAcademicLevelToTelemetry(academicLevel);
  let topic = 'newton-incline';
  let currentParameters: Record<string, number | string | boolean> = {};

  if (domain === 'Fisika') {
    topic = physicsParams.mode;
    if (physicsParams.mode === 'projectile-gravity') {
      currentParameters = {
        mode: physicsParams.mode,
        massKg: physicsParams.mass,
        initialVelocityMs: physicsParams.initialVelocity,
        launchAngleDeg: physicsParams.launchAngle,
        initialHeightM: physicsParams.initialHeight,
        gravityMs2: physicsParams.gravity,
      };
    } else if (physicsParams.mode === 'spring-hooke') {
      currentParameters = {
        mode: physicsParams.mode,
        massKg: physicsParams.mass,
        springConstantK: physicsParams.springConstantK,
        springDisplacementM: physicsParams.springDisplacement,
        dampingCoeff: physicsParams.dampingCoeff,
      };
    } else if (physicsParams.mode === 'collision-momentum') {
      currentParameters = {
        mode: physicsParams.mode,
        mass1Kg: physicsParams.mass,
        velocity1InitialMs: physicsParams.initialVelocity,
        mass2Kg: physicsParams.collisionMass2,
        velocity2InitialMs: physicsParams.velocity2Initial,
        restitutionCoeff: physicsParams.restitutionCoeff,
      };
    } else {
      currentParameters = {
        mode: physicsParams.mode,
        massKg: physicsParams.mass,
        appliedForceN: physicsParams.appliedForce,
        inclineAngleDeg: physicsParams.inclineAngle,
        frictionCoeffStatic: physicsParams.frictionCoeffStatic,
        frictionCoeffKinetic: physicsParams.frictionCoeffKinetic,
        gravityMs2: physicsParams.gravity,
      };
    }
  } else if (domain === 'Kimia') {
    topic = chemistryParams.mode;
    if (chemistryParams.mode === 'acid-base-titration') {
      currentParameters = {
        mode: chemistryParams.mode,
        analyteAcidConcM: chemistryParams.analyteAcidConc,
        analyteVolumeMl: chemistryParams.analyteVolumeMl,
        titrantBaseConcM: chemistryParams.titrantBaseConc,
        titrantAddedMl: chemistryParams.titrantAddedMl,
        acidPka: chemistryParams.acidPka,
        indicatorType: chemistryParams.indicatorType,
      };
    } else if (chemistryParams.mode === 'electrochemistry-cell') {
      currentParameters = {
        mode: chemistryParams.mode,
        redoxPairId: chemistryParams.redoxPairId,
        anodeConcM: chemistryParams.anodeConcM,
        cathodeConcM: chemistryParams.cathodeConcM,
        tempC: chemistryParams.initialTempC,
      };
    } else {
      currentParameters = {
        mode: chemistryParams.mode,
        reactionId: chemistryParams.reactionId,
        initialTempC: chemistryParams.initialTempC,
        reactantConcentrationM: chemistryParams.reactantConcentration,
        solutionVolumeMl: chemistryParams.solutionVolumeMl,
        useCatalyst: chemistryParams.useCatalyst,
      };
    }
  } else if (domain === 'Biologi') {
    topic = biologyContext?.moduleId || 'photosynthesis-ingenhousz';
    currentParameters = {
      mode: topic,
      ...(biologyContext?.params || {
        lightIntensityLux: 5000,
        nahco3ConcPct: 0.5,
        waterTempC: 28,
      }),
    };
  } else {
    topic = astronomyParams.mode;
    if (astronomyParams.mode === 'solar-kepler') {
      currentParameters = {
        mode: 'solar-kepler',
        selectedPlanetId: astronomyParams.selectedPlanetId,
        semiMajorAxisAu: astronomyParams.customSemiMajorAxisAu,
        eccentricity: astronomyParams.customEccentricity,
        centralStarMassSolar: astronomyParams.centralStarMassSolar,
      };
    } else if (astronomyParams.mode === 'milkyway-galaxy') {
      currentParameters = {
        mode: astronomyParams.mode,
        galactocentricRadiusKpc: astronomyParams.galactocentricRadiusKpc,
        darkMatterHaloFraction: astronomyParams.darkMatterHaloFraction,
        sgrAStarMassMillionSolar: astronomyParams.sgrAStarMassMillionSolar,
      };
    } else {
      currentParameters = {
        mode: astronomyParams.mode,
        starEffectiveTempK: astronomyParams.starEffectiveTempK,
        starRadiusSolar: astronomyParams.starRadiusSolar,
        exoplanetRadiusEarth: astronomyParams.exoplanetRadiusEarth,
        exoplanetOrbitAu: astronomyParams.exoplanetOrbitAu,
      };
    }
  }

  const domainRecords = [...records]
    .filter((r) => r.domain === domain)
    .reverse();

  const recordedData = domainRecords.map((rec, index) => ({
    trialNumber: index + 1,
    id: rec.id,
    title: rec.experimentTitle,
    parametersSummary: rec.parametersSummary,
    x: rec.numericX,
    y1: rec.numericY1,
    y2: rec.numericY2,
    keyMetrics: rec.keyMetrics,
  }));

  const validPoints = recordedData.filter(
    (d) => typeof d.x === 'number' && typeof d.y1 === 'number'
  ) as Array<
    (typeof recordedData)[number] & { x: number; y1: number }
  >;

  const reg = calculateLinearRegression(
    validPoints.map((p) => ({ x: p.x, y: p.y1 }))
  );

  let outlierTrial: DrLabMuOutlierPoint | undefined;
  let maxAbsResidual = 0;

  if (validPoints.length >= 3) {
    for (const pt of validPoints) {
      const yPred = reg.slopeM * pt.x + reg.interceptC;
      const residual = Math.abs(pt.y1 - yPred);
      if (residual > maxAbsResidual) {
        maxAbsResidual = residual;
        outlierTrial = {
          trialNumber: pt.trialNumber,
          id: pt.id,
          title: pt.title,
          x: pt.x,
          yObserved: pt.y1,
          yPredicted: Number(yPred.toFixed(2)),
          residual: Number(residual.toFixed(2)),
          parametersSummary: pt.parametersSummary,
        };
      }
    }
  }

  const hasExtremeOutlier =
    validPoints.length >= 3 &&
    (reg.rSquared < 0.85 ||
      (reg.stdDevY > 0 && maxAbsResidual > 1.35 * reg.stdDevY));

  return {
    domain,
    topic,
    educationLevel,
    currentParameters,
    recordedData,
    analytics: {
      rSquared: reg.rSquared,
      slope: reg.slopeM,
      intercept: reg.interceptC,
      stdDev: reg.stdDevY,
      equation: reg.equationString,
      hasExtremeOutlier,
      outlierTrial,
    },
    studentQuery: studentQuery.trim(),
  };
}

export function generateSocraticDrLabMuResponse(
  telemetry: DrLabMuTelemetryPayload
): DrLabMuStructuredResponse {
  const {
    domain,
    topic,
    educationLevel,
    recordedData,
    analytics,
    studentQuery,
  } = telemetry;

  const qLower = studentQuery.toLowerCase().trim();
  const readableTopic = HUMAN_MODULE_LABELS[topic] || topic;

  // 1. PANTANGAN MUTLAK: Deteksi Permintaan Jawaban Mentah / Curang
  const isAskingDirectAnswer =
    /berapa\s+(nilai|besar|angka|hasil|jawaban|rumus|titik|konstanta)|kasih\s+tahu\s+jawaban|jawabannya\s+apa|hitungin|bocorin|kesimpulan\s+laporan|nilai\s+g[- ]?nya|langsung\s+jawab|minta\s+jawaban|angka\s+akhir/i.test(
      qLower
    );

  // Deteksi Pertanyaan di Luar Topik / Sains
  const isOffTopic =
    /resep\s+masakan|game\s+online|sepak\s+bola|kripto|bitcoin|politik|presiden|pacar|lagu|film|gosip|harga\s+emas|siapa\s+kamu|di\s+luar\s+praktikum/i.test(
      qLower
    );

  // 2. ATURAN PENANGANAN ANOMALI: R² < 0.85 atau Outlier Ekstrem
  const isAnomalyOrLowR2 =
    analytics.rSquared < 0.85 && recordedData.length >= 3
      ? true
      : analytics.hasExtremeOutlier ||
        /outlier|melenceng|menyimpang|aneh|r2|r²|tidak\s+lurus|merosot|turun\s+drastis/i.test(
          qLower
        );

  const observation = `Eksplorasi yang sangat baik di laboratorium virtual ${domain} pada modul ${readableTopic} (${educationLevel}). Sejauh ini Anda telah mengumpulkan ${recordedData.length} baris data observasi riil di meja praktikum.`;

  // Tangani Pertanyaan di Luar Topik
  if (isOffTopic) {
    const dataHighlight = `Ilmuwan hebat selalu memusatkan perhatian pada fenomena alam yang sedang diselidiki di hadapannya. Di laboratorium virtual RuangLABmu, kita sedang mengeksplorasi modul ${readableTopic} (${educationLevel}) dengan data observasi nyata.`;
    const socraticQuestion = `Bagaimana kalau kita kembali berfokus pada instrumen lab 3D dan mengamati apa yang terjadi pada grafik saat salah satu variabel bebas Anda geser?`;
    return {
      observation: `Senang bisa menyapa Anda di RuangLABmu! Namun sebagai mentor laboratorium sains, mari kita tetap berfokus pada eksperimen aktif kita.`,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: 'off-topic-refusal',
      formattedText: `Senang bisa menyapa Anda di RuangLABmu! Namun sebagai mentor laboratorium sains, mari kita tetap berfokus pada eksperimen aktif kita.\n\n${dataHighlight}\n\n${socraticQuestion}`,
    };
  }

  // Tangani Permintaan Jawaban Mentah / Menyontek
  if (isAskingDirectAnswer) {
    const slopeInfo =
      recordedData.length >= 2
        ? `(${analytics.equation} dengan nilai R² = ${analytics.rSquared.toFixed(3)})`
        : `dari data observasi yang sedang kamu kumpulkan`;
    const dataHighlight = `Ilmuwan hebat tidak menyalin jawaban, tapi membaca polanya! Mari kita periksa slope grafik yang baru saja kamu dapatkan ${slopeInfo}. Saya punya catatannya, tapi ilmuwan sejati menemukan rahasianya dari grafik sendiri! Memahami korelasi variabel bebas dan terikat jauh lebih bermakna daripada sekadar menghafal angka akhir.`;

    const socraticQuestion =
      domain === 'Fisika'
        ? `Jika sumbu mendatar mewakili variabel bebas yang Anda atur di slider dan sumbu tegak adalah responsnya, bagaimana kemiringan garis regresi pada grafik Anda berhubungan dengan konstanta fisis atau hukum kekekalan yang sedang diuji?`
        : domain === 'Kimia'
        ? `Coba perhatikan indikator visual perubahan warna larutan dan kurva pH: di sekitar volume berapakah perbandingan stoikiometri reaktan mencapai titik kesetimbangan atau titik ekuivalen?`
        : domain === 'Biologi'
        ? `Perhatikan laju pembentukan gelembung oksigen atau perubahan massa sel pada tabel pengamatan: variabel lingkungan manakah yang kini menjadi faktor pembatas utama dalam proses biologis tersebut?`
        : `Bagaimana perbandingan antara kuadrat periode orbit (T²) terhadap pangkat tiga jarak rata-rata (a³) saat Anda menggeser massa bintang induk atau jari-jari edar sesuai Hukum III Kepler?`;

    return {
      observation,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: 'direct-answer-refusal',
      formattedText: `${observation}\n\n${dataHighlight}\n\n${socraticQuestion}`,
    };
  }

  // Tangani Anomali & Deviasi Data (R² < 0.85 atau Outlier Ekstrem)
  if (isAnomalyOrLowR2) {
    const outlier = analytics.outlierTrial;
    let dataHighlight = '';
    let socraticQuestion = '';

    if (
      domain === 'Biologi' &&
      (topic.includes('enzyme') ||
        topic.includes('katalase') ||
        qLower.includes('suhu') ||
        (outlier && outlier.parametersSummary.includes('°C')))
    ) {
      dataHighlight = `Coba amati baris data ke-${outlier ? outlier.trialNumber : 4} saat suhu dinaikkan ke 80°C. Mengapa laju reaksi justru menurun drastis? Faktor apa pada enzim yang kira-kira terpengaruh?`;
      socraticQuestion = `Apakah struktur tiga dimensi protein enzim mengalami denaturasi termal pada suhu ekstrem tersebut sehingga sisi aktifnya tidak lagi dapat mengikat molekul substrat?`;
    } else if (outlier) {
      dataHighlight = `Nilai korelasi grafik saat ini adalah R² = ${analytics.rSquared.toFixed(3)}. Coba amati baris data ke-${outlier.trialNumber} (${outlier.title}) di mana nilai respons terukur (${outlier.yObserved}) menyimpang dari tren garis prediksi (${outlier.yPredicted}). Dalam sains empiris, anomali bukanlah kesalahan, melainkan petunjuk adanya efek non-linier atau batas fisis baru.`;
      socraticQuestion = `Menurut hipotesis Anda, faktor atau kondisi variabel manakah pada percobaan ke-${outlier.trialNumber} yang menyebabkan nilai respons tersebut berbelok dari garis tren umum?`;
    } else {
      dataHighlight = `Nilai korelasi grafik saat ini adalah R² = ${analytics.rSquared.toFixed(3)}, menandakan terdapat titik percobaan yang menjauh dari garis regresi akibat fluktuasi pengukuran atau perubahan lebih dari satu parameter sekaligus.`;
      socraticQuestion = `Jika Anda menjaga semua variabel kontrol tetap konstan dan hanya menggeser satu variabel bebas secara bertahap, apakah titik pengamatan berikutnya akan menaikkan nilai R² mendekati 1,00?`;
    }

    return {
      observation,
      dataHighlight,
      socraticQuestion,
      detectedTrigger: 'anomaly-outlier',
      formattedText: `${observation}\n\n${dataHighlight}\n\n${socraticQuestion}`,
    };
  }

  // 3. BIMBINGAN BERTAHAP: Domain-Specific Insights & Analogi Jenjang (SMP / SMA / Perguruan Tinggi)
  let analogyHighlight = '';
  let socraticQuestion = '';

  if (educationLevel === 'SMP') {
    if (domain === 'Fisika') {
      analogyHighlight = `Bayangkan kamu sedang melempar bola basket ke arah ring atau mendorong kotak kardus di lantai: makin kuat dorongan awalmu dan makin pas sudut lemparanmu, makin jauh bola melambung sebelum ditarik gravitasi bumi ke bawah.`;
      socraticQuestion = `Jika kamu melempar bola terlalu mendatar dibandingkan terlalu tegak ke atas, pada sudut berapa derajat menurut perkiraanmu jarak lemparannya mencapai paling jauh?`;
    } else if (domain === 'Kimia') {
      analogyHighlight = `Bayangkan kamu sedang melarutkan sesendok gula ke dalam teh hangat atau menetesi air perasan jeruk yang asam dengan air soda kue: sifat dan suhu larutan akan berubah bertahap mengikuti takaran yang kamu campurkan sampai keduanya seimbang netral.`;
      socraticQuestion = `Coba geser slider penambahan tetesan di simulasi: pada saat warna cairan di gelas kimia 3D berubah, apa yang terjadi pada angka derajat keasaman (pH) larutan?`;
    } else if (domain === 'Biologi') {
      analogyHighlight = `Bayangkan tanaman air Hydrilla yang berjemur di bawah sinar matahari hangat: klorofil di daun hijau bertindak seperti panel surya kecil yang menangkap cahaya untuk memproduksi energi dan melepaskan gelembung oksigen segar.`;
      socraticQuestion = `Coba geser slider intensitas cahaya atau kadar karbon dioksida di panel kiri: pada kondisi lingkungan seperti apa gelembung udara oksigen muncul paling melimpah?`;
    } else {
      analogyHighlight = `Bayangkan pelari di lintasan lari stadion: pelari di lajur paling dalam dekat pusat harus berlari lebih cepat menyelesaikan putaran dibandingkan pelari di lajur paling luar. Planet di dekat Matahari pun berperilaku sama!`;
      socraticQuestion = `Coba pilih planet Merkurius lalu bandingkan dengan Jupiter di simulasi: mengapa planet yang lebih dekat dengan Matahari membutuhkan waktu orbit yang jauh lebih singkat?`;
    }
  } else if (educationLevel === 'SMA') {
    if (domain === 'Fisika') {
      analogyHighlight = `Mari kita teliti korelasi antara variabel bebas dan variabel terikat pada modul ${readableTopic}. Menurut hukum kekekalan energi dan momentum, perubahan gaya atau kecepatan awal akan langsung tercermin pada gradien garis regresi grafikmu.`;
      socraticQuestion = `Jika Anda menggandakan kecepatan awal sambil menjaga sudut elevasi dan massa tetap konstan, apakah jarak jangkauan horizontal meningkat dua kali lipat atau empat kali lipat? Yuk buktikan di tabel!`;
    } else if (domain === 'Kimia') {
      analogyHighlight = `Perhatikan indikator visual stoikiometri pada modul ${readableTopic}: perubahan warna indikator dan lonjakan kurva pH menandakan titik ekuivalen saat mol ion asam tepat dinetralkan oleh ion basa. Pada sel elektrokimia, aliran elektron mencerminkan selisih potensial reduksi standar.`;
      socraticQuestion = `Jika konsentrasi reaktan asam Anda naikkan dua kali lipat pada slider, berapa mL volume titran basa yang kini dibutuhkan agar larutan tepat mencapai titik infleksi pH?`;
    } else if (domain === 'Biologi') {
      analogyHighlight = `Pada sistem biologis ${readableTopic}, struktur organel dan membran selulosa sangat menentukan permeabilitas osmosis, sementara aktivitas enzimatik sangat bergantung pada suhu dan pH optimum sebelum laju reaksi jenuh.`;
      socraticQuestion = `Jika suhu dinaikkan melampaui batas optimum 40°C pada slider, mengapa laju pembentukan gelembung oksigen atau aktivitas enzim justru merosot tajam meskipun konsentrasi substrat melimpah?`;
    } else {
      analogyHighlight = `Perhatikan pergerakan benda langit pada modul ${readableTopic}: gaya gravitasi universal Newton yang berbanding terbalik dengan kuadrat jarak menjadi penentu lintasan elips dan rasio konstan kuadrat periode terhadap pangkat tiga jarak rata-rata sesuai Hukum Kepler.`;
      socraticQuestion = `Bagaimana perubahan massa bintang induk atau penambahan fraksi materi gelap pada galaksi memengaruhi kecepatan rotasi bintang-bintang di tepi luar lintasan?`;
    }
  } else {
    // Perguruan Tinggi
    if (domain === 'Fisika') {
      analogyHighlight = `Dalam tinjauan mekanika analitik tingkat Perguruan Tinggi (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), dekomposisi gaya non-konservatif, disipasi viskositas fluida, dan persamaan diferensial gerak memisahkan respon transien dari kondisi tunak sistem.`;
      socraticQuestion = `Bagaimana pengaruh koefisien gesek atau redaman viskos terhadap pergeseran kemiringan garis regresi saat Anda mendekati batas kestabilan sistem pada slider?`;
    } else if (domain === 'Kimia') {
      analogyHighlight = `Secara termodinamika kesetimbangan kimia dan elektrokimia (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), profil potensial sel dikendalikan oleh persamaan Nernst logaritmik, sementara kapasitas penyangga larutan mengikuti persamaan Henderson-Hasselbalch di sekitar titik infleksi.`;
      socraticQuestion = `Bagaimana perubahan rasio aktivitas ionik atau penambahan katalisator menggeser penghalang energi aktivasi (Ea) tanpa mengubah nilai perubahan energi bebas Gibbs (ΔG)?`;
    } else if (domain === 'Biologi') {
      analogyHighlight = `Dalam perspektif biofisika sel dan kinetika Michaelis-Menten (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), potensial kimia air (Ψw = Ψs + Ψp) mengendalikan fluks osmosis melintasi membran semipermeabel, sedangkan saturasi sisi aktif enzim menentukan laju reaksi maksimum V_max.`;
      socraticQuestion = `Bagaimana variasi konsentrasi solut hipertonik terhadap tekanan turgor sel atau penentuan nilai Km pada plot Lineweaver-Burk membuktikan afinitas enzim terhadap substratnya?`;
    } else {
      analogyHighlight = `Dalam astrofisika sistemik (regresi ${analytics.equation}, R² = ${analytics.rSquared.toFixed(3)}), kurva rotasi datar galaksi mengonfirmasi keberadaan distribusi halo materi gelap isotermal, sementara kedalaman transit fotometrik eksoplanet memberikan rasio penampang geometris (Rp/R*)².`;
      socraticQuestion = `Bagaimana deviasi kecepatan observasi terhadap kurva Keplerian di radius galaktosentrik luar membuktikan keberadaan massa halo materi gelap yang tidak tampak?`;
    }
  }

  return {
    observation,
    dataHighlight: analogyHighlight,
    socraticQuestion,
    detectedTrigger: 'concept-analogy',
    formattedText: `${observation}\n\n${analogyHighlight}\n\n${socraticQuestion}`,
  };
}

// ============================================================================
// FITUR 5: SIMULASI BAHAYA KESELAMATAN (SAFETY HAZARD SIMULATOR)
// ============================================================================

export interface SafetyHazardAlert {
  isHazardous: boolean;
  hazardCode: string | null;
  domain: 'Fisika' | 'Kimia';
  severity?: 'warning' | 'critical';
  hazardFocusPoint?: [number, number, number];
  title: string;
  headlineAlert: string;
  scientificExplanation: string;
  mitigationInstruction: string;
  triggerParamSummary: string;
}

export function evaluateSafetyHazard(
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi',
  physicsParams?: PhysicsParams,
  chemistryParams?: ChemistryParams
): SafetyHazardAlert {
  if (domain === 'Kimia' && chemistryParams) {
    const temp =
      chemistryParams.mode === 'reaction-kinetics-arrhenius'
        ? chemistryParams.kineticsTempC ?? chemistryParams.initialTempC
        : chemistryParams.initialTempC;
    const conc = Math.max(
      chemistryParams.reactantConcentration || 0,
      chemistryParams.analyteAcidConc || 0,
      chemistryParams.titrantBaseConc || 0,
      chemistryParams.kineticsConcA || 0
    );
    const hasCatalyst = Boolean(chemistryParams.useCatalyst);

    if (temp > 85 && conc >= 1.8 && !hasCatalyst) {
      return {
        isHazardous: true,
        hazardCode: 'CHEM_THERMAL_RUNAWAY',
        domain: 'Kimia',
        severity: 'critical',
        hazardFocusPoint: [0, 1.5, 0],
        title: 'Peringatan Keselamatan: Reaksi Eksotermik di Luar Kendali!',
        headlineAlert:
          'Peringatan Keselamatan: Reaksi eksotermik di luar kendali! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Anda mencampurkan reaktan berkonsentrasi tinggi ([M] = ${conc.toFixed(2)} mol/L) pada suhu awal ekstrem (${temp}°C > 85°C) tanpa katalis pengendali/pendingin. Menurut persamaan Arrhenius k = A·exp(-Ea/RT), laju pelepasan kalor meningkat secara eksponensial melampaui kapasitas disipasi kalorimeter, yang di laboratorium nyata dapat memicu pendidihan eksplosif (thermal runaway), percikan asam korosif, dan pecahnya wadah kaca borosilikat.`,
        mitigationInstruction:
          'Turunkan suhu awal larutan di bawah 80°C, kurangi konsentrasi molar reaktan (< 1.8 M), atau aktifkan Katalis Pengendali pada panel variabel.',
        triggerParamSummary: `T₀ = ${temp}°C (> 85°C), [M] = ${conc.toFixed(2)} M, Katalis = Nonaktif`,
      };
    }

    if (
      chemistryParams.mode === 'ideal-gas-boyle' &&
      (chemistryParams.gasTemperatureK ?? 300) > 650 &&
      (chemistryParams.gasVolumeL ?? 10) < 3.5
    ) {
      return {
        isHazardous: true,
        hazardCode: 'CHEM_OVERPRESSURE_VESSEL',
        domain: 'Kimia',
        severity: 'critical',
        hazardFocusPoint: [0, 1.8, 0],
        title: 'Peringatan Keselamatan: Tekanan Bejana Gas Melampaui Batas Kritis!',
        headlineAlert:
          'Peringatan Keselamatan: Reaksi eksotermik & tekanan gas di luar kendali! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Pemanasan gas pada suhu ${chemistryParams.gasTemperatureK} K dalam volume sempit (${chemistryParams.gasVolumeL} L) menghasilkan lonjakan tekanan ekstrem sesuai P = nRT/V yang melampaui batas ketahanan katup pengaman silinder kaca.`,
        mitigationInstruction:
          'Perbesar volume ruang gas (V > 4.0 L) atau turunkan temperatur absolut gas.',
        triggerParamSummary: `T = ${chemistryParams.gasTemperatureK} K, V = ${chemistryParams.gasVolumeL} L`,
      };
    }

    if (
      chemistryParams.mode === 'acid-base-titration' &&
      (chemistryParams.titrantAddedMl ?? 0) >= 48 &&
      Math.max(chemistryParams.analyteAcidConc || 0, chemistryParams.titrantBaseConc || 0) >= 1.8
    ) {
      return {
        isHazardous: true,
        hazardCode: 'CHEM_CORROSIVE_OVERFLOW',
        domain: 'Kimia',
        severity: 'warning',
        hazardFocusPoint: [0, 1.35, 0],
        title: 'Peringatan Keselamatan: Risiko Luapan Asam-Basa Pekat pada Labu Titrasi!',
        headlineAlert:
          'Peringatan Keselamatan: Volume titran hampir penuh dengan reagen korosif pekat!',
        scientificExplanation: `Penambahan titran hingga ${chemistryParams.titrantAddedMl} mL dengan molaritas pekat (≥ 1.8 M) membuat labu Erlenmeyer mendekati batas kapasitas dan menghasilkan panas netralisasi lokal yang berisiko memercikkan larutan korosif.`,
        mitigationInstruction:
          'Tutup keran buret (kurangi Vb < 45 mL) atau encerkan konsentrasi larutan asam/basa di bawah 1.5 M.',
        triggerParamSummary: `Vb = ${chemistryParams.titrantAddedMl} mL (≥ 48 mL), [M]_max = ${Math.max(chemistryParams.analyteAcidConc || 0, chemistryParams.titrantBaseConc || 0).toFixed(2)} M`,
      };
    }
  }

  if (domain === 'Fisika' && physicsParams) {
    const pendAngle = Math.abs(physicsParams.pendulumAngle ?? 0);
    if (physicsParams.mode === 'pendulum-harmonic' && pendAngle > 80) {
      return {
        isHazardous: true,
        hazardCode: 'PHYS_PENDULUM_EXTREME_ANGLE',
        domain: 'Fisika',
        severity: 'warning',
        hazardFocusPoint: [0, 2.2, 0],
        title: 'Peringatan Keselamatan: Sudut Ayunan Pendulum Melampaui Batas Aman (> 80°)!',
        headlineAlert:
          'Peringatan Keselamatan: Beban & sudut simpangan melampaui batas statif! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Simpangan sudut awal θ = ${pendAngle}° (> 80°) menyebabkan tegangan tali maksimum T_max = m·g·(3 - 2·cos θ₀) di titik terendah melonjak hampir 3 kali lipat berat beban, ditambah hentakan kejut (slack-snap) yang di laboratorium nyata dapat menggulingkan statif penyangga atau memutuskan kawat penggantung.`,
        mitigationInstruction:
          'Turunkan sudut simpangan pendulum ke rentang aman (θ ≤ 75°) agar statif tetap stabil dan aproksimasi harmonik berlaku.',
        triggerParamSummary: `Sudut Ayunan θ = ${pendAngle}° (> 80°), L = ${physicsParams.pendulumLength ?? 1.2} m`,
      };
    }

    const isWireOverload =
      (physicsParams.mass >= 24 && Math.abs(physicsParams.appliedForce) >= 180) ||
      (physicsParams.mode === 'spring-hooke' &&
        Math.abs(physicsParams.springDisplacement) >= 1.8 &&
        physicsParams.springConstantK >= 180);

    if (isWireOverload) {
      return {
        isHazardous: true,
        hazardCode: 'PHYS_WIRE_BREAKING_STRESS',
        domain: 'Fisika',
        severity: 'critical',
        hazardFocusPoint: [0, 1.2, 0],
        title: 'Peringatan Keselamatan: Beban Melampaui Batas Regangan Putus Kawat/Pegas!',
        headlineAlert:
          'Peringatan Keselamatan: Tegangan mekanik melampaui batas elastisitas (Ultimate Tensile Strength)! Amati mengapa hal ini berbahaya di laboratorium riil.',
        scientificExplanation: `Kombinasi beban massa tinggi (${physicsParams.mass} kg) dan gaya tarik/pegas ekstrem menghasilkan tegangan mekanik σ = F/A yang melampaui batas regangan putus (breaking stress) kawat baja laboratorium. Di laboratorium riil, putusnya kawat bertegangan tinggi dapat melontarkan beban logam secara tiba-tiba (whiplash hazard).`,
        mitigationInstruction:
          'Kurangi massa beban (< 22 kg), kecilkan gaya tarik, atau kurangi simpangan pegas di bawah batas elastis Hooke.',
        triggerParamSummary: `m = ${physicsParams.mass} kg, F = ${physicsParams.appliedForce} N, Δx = ${physicsParams.springDisplacement} m`,
      };
    }
  }

  return {
    isHazardous: false,
    hazardCode: null,
    domain: domain === 'Kimia' ? 'Kimia' : 'Fisika',
    title: '',
    headlineAlert: '',
    scientificExplanation: '',
    mitigationInstruction: '',
    triggerParamSummary: '',
  };
}
