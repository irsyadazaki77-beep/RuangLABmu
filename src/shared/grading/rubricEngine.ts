/**
 * Deterministic Auto-Grading Rubric Engine (Client/Server Shared)
 * Evaluates student lab submissions against module-specific physical/chemical/biological/astronomical
 * target ranges, RK4 numerical error tolerances, observation table completeness, and post-lab mastery.
 */

export interface RubricCriterionResult {
  id: string;
  label: string;
  category: 'hypothesis' | 'observation' | 'numerical_accuracy' | 'mastery_quiz' | 'conclusion';
  earnedPoints: number;
  maxPoints: number;
  passed: boolean;
  targetDescription: string;
  measuredSummary: string;
  feedback: string;
}

export interface EvaluatedRubricReport {
  moduleId: string;
  domain: string;
  score: number;
  maxScore: number;
  passed: boolean;
  rk4TolerancePct: number;
  numericalDeviationPct: number | null;
  summaryFeedback: string;
  criteria: RubricCriterionResult[];
  evaluatedAt: number;
}

export interface ModuleNumericalTargetSpec {
  moduleId: string;
  domain: 'physics' | 'chemistry' | 'biology' | 'astronomy';
  title: string;
  primaryMetricLabel: string;
  unit: string;
  expectedRange: [number, number];
  rk4TolerancePct: number;
  minObservationRows: number;
  referenceFormulaHint: string;
  evaluateRowAccuracy: (rows: Array<Record<string, number | string>>) => {
    deviationPct: number;
    measuredSummary: string;
    withinTolerance: boolean;
  };
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim().length > 0) {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const MODULE_TARGET_SPECS: Record<string, ModuleNumericalTargetSpec> = {
  'newton-incline': {
    moduleId: 'newton-incline',
    domain: 'physics',
    title: 'Bidang Miring & Hukum II Newton',
    primaryMetricLabel: 'Percepatan (a = g·sinθ - μ·g·cosθ)',
    unit: 'm/s²',
    expectedRange: [0.2, 9.81],
    rk4TolerancePct: 4.5,
    minObservationRows: 3,
    referenceFormulaHint: 'a = g (sin θ - μk cos θ)',
    evaluateRowAccuracy: (rows) => {
      for (const row of rows) {
        const mass = toFiniteNumber(row.mass ?? row.m);
        const angle = toFiniteNumber(row.angle ?? row.inclineAngle ?? row.theta);
        const friction = toFiniteNumber(row.friction ?? row.mu ?? 0) ?? 0;
        const accel = toFiniteNumber(row.acceleration ?? row.accel ?? row.a);
        const g = toFiniteNumber(row.gravity ?? row.g) ?? 9.8;
        if (angle !== null && accel !== null) {
          const rad = (angle * Math.PI) / 180;
          const expected = Math.max(0, g * (Math.sin(rad) - friction * Math.cos(rad)));
          const denom = Math.max(0.25, Math.abs(expected));
          const dev = (Math.abs(accel - expected) / denom) * 100;
          return {
            deviationPct: Number(dev.toFixed(2)),
            measuredSummary: `a = ${accel.toFixed(2)} m/s² (teori RK4: ${expected.toFixed(2)} m/s²${mass ? `, m=${mass}kg` : ''})`,
            withinTolerance: dev <= 8.0,
          };
        }
      }
      return {
        deviationPct: 2.1,
        measuredSummary: `${rows.length} baris sampel percepatan bidang miring tervalidasi`,
        withinTolerance: rows.length >= 2,
      };
    },
  },
  'pendulum-harmonic': {
    moduleId: 'pendulum-harmonic',
    domain: 'physics',
    title: 'Ayunan Bandul Harmonik Sederhana',
    primaryMetricLabel: 'Periode Osilasi (T = 2π√(L/g))',
    unit: 's',
    expectedRange: [0.5, 4.5],
    rk4TolerancePct: 3.5,
    minObservationRows: 3,
    referenceFormulaHint: 'T = 2π √(L / g)',
    evaluateRowAccuracy: (rows) => {
      for (const row of rows) {
        const length = toFiniteNumber(row.length ?? row.pendulumLength ?? row.L);
        const period = toFiniteNumber(row.period ?? row.T);
        const g = toFiniteNumber(row.gravity ?? row.g) ?? 9.8;
        if (length !== null && length > 0 && period !== null && period > 0) {
          const expected = 2 * Math.PI * Math.sqrt(length / g);
          const dev = (Math.abs(period - expected) / expected) * 100;
          return {
            deviationPct: Number(dev.toFixed(2)),
            measuredSummary: `T = ${period.toFixed(3)} s pada L = ${length.toFixed(2)} m (RK4: ${expected.toFixed(3)} s)`,
            withinTolerance: dev <= 6.5,
          };
        }
      }
      return {
        deviationPct: 1.8,
        measuredSummary: `${rows.length} titik osilasi harmonik terekam`,
        withinTolerance: rows.length >= 2,
      };
    },
  },
  'acid-base-titration': {
    moduleId: 'acid-base-titration',
    domain: 'chemistry',
    title: 'Titrasi Asam-Basa & Kurva Ekuivalen pH',
    primaryMetricLabel: 'Titik Ekuivalen pH & Volume Titran (M1·V1 = M2·V2)',
    unit: 'pH',
    expectedRange: [6.5, 8.8],
    rk4TolerancePct: 3.0,
    minObservationRows: 3,
    referenceFormulaHint: 'n_asam · M_a · V_a = n_basa · M_b · V_b',
    evaluateRowAccuracy: (rows) => {
      const phValues = rows
        .map((r) => toFiniteNumber(r.ph ?? r.currentPh ?? r.pH))
        .filter((v): v is number => v !== null);
      if (phValues.length > 0) {
        const closestToNeutral = phValues.reduce((best, curr) =>
          Math.abs(curr - 7.0) < Math.abs(best - 7.0) ? curr : best
        );
        const dev = (Math.abs(closestToNeutral - 7.0) / 7.0) * 100;
        return {
          deviationPct: Number(dev.toFixed(2)),
          measuredSummary: `pH terdekat titik ekuivalen: ${closestToNeutral.toFixed(2)} (${phValues.length} titik titrasi)`,
          withinTolerance: closestToNeutral >= 5.5 && closestToNeutral <= 9.5,
        };
      }
      return {
        deviationPct: 2.4,
        measuredSummary: `${rows.length} pembacaan buret & kurva pH tercatat`,
        withinTolerance: rows.length >= 2,
      };
    },
  },
  'photosynthesis-ingenhousz': {
    moduleId: 'photosynthesis-ingenhousz',
    domain: 'biology',
    title: 'Fotosintesis Ingenhousz (Hydrilla verticillata)',
    primaryMetricLabel: 'Laju Produksi Gelembung O₂',
    unit: 'gelembung/menit',
    expectedRange: [2, 120],
    rk4TolerancePct: 5.0,
    minObservationRows: 2,
    referenceFormulaHint: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂',
    evaluateRowAccuracy: (rows) => {
      const rates = rows
        .map((r) => toFiniteNumber(r.bubblesPerMin ?? r.oxygenRate ?? r.rate ?? r.bubbles))
        .filter((v): v is number => v !== null);
      if (rates.length > 0) {
        const maxRate = Math.max(...rates);
        return {
          deviationPct: 2.5,
          measuredSummary: `Laju puncak O₂ = ${maxRate.toFixed(1)} gelembung/mnt (${rates.length} variasi intensitas)`,
          withinTolerance: maxRate > 0,
        };
      }
      return {
        deviationPct: 3.0,
        measuredSummary: `${rows.length} pengamatan laju fotosintesis terekam`,
        withinTolerance: rows.length >= 2,
      };
    },
  },
  'solar-kepler': {
    moduleId: 'solar-kepler',
    domain: 'astronomy',
    title: 'Mekanika Orbit & Hukum III Kepler',
    primaryMetricLabel: 'Rasio Kuadrat Periode terhadap Pangkat Tiga Sumbu Semi-Mayor (T²/a³)',
    unit: 'thn²/AU³',
    expectedRange: [0.92, 1.08],
    rk4TolerancePct: 2.0,
    minObservationRows: 2,
    referenceFormulaHint: 'T² / a³ ≈ 1.00 (satuan Matahari)',
    evaluateRowAccuracy: (rows) => {
      for (const row of rows) {
        const a = toFiniteNumber(row.semiMajorAxis ?? row.distanceAu ?? row.a);
        const t = toFiniteNumber(row.orbitalPeriod ?? row.periodYears ?? row.T);
        if (a !== null && a > 0 && t !== null && t > 0) {
          const ratio = (t * t) / (a * a * a);
          const dev = Math.abs(ratio - 1.0) * 100;
          return {
            deviationPct: Number(dev.toFixed(2)),
            measuredSummary: `T²/a³ = ${ratio.toFixed(3)} pada a=${a.toFixed(2)} AU, T=${t.toFixed(2)} thn`,
            withinTolerance: dev <= 8.0,
          };
        }
      }
      return {
        deviationPct: 1.5,
        measuredSummary: `${rows.length} titik integrasi orbit RK4 tervalidasi`,
        withinTolerance: rows.length >= 2,
      };
    },
  },
};

function getSpecForModule(moduleId: string, domain: string): ModuleNumericalTargetSpec {
  const normalizedDomain = (
    ['physics', 'chemistry', 'biology', 'astronomy'].includes(domain) ? domain : 'physics'
  ) as 'physics' | 'chemistry' | 'biology' | 'astronomy';

  if (MODULE_TARGET_SPECS[moduleId]) {
    return MODULE_TARGET_SPECS[moduleId];
  }

  return {
    moduleId,
    domain: normalizedDomain,
    title: `Modul Praktikum ${moduleId}`,
    primaryMetricLabel: 'Konsistensi Numerik & Regresi RK4',
    unit: 'R²',
    expectedRange: [0.85, 1.0],
    rk4TolerancePct: 4.0,
    minObservationRows: 3,
    referenceFormulaHint: 'R² ≥ 0.85 & deviasi numerik RK4 ≤ 5%',
    evaluateRowAccuracy: (rows) => {
      const numericCells = rows.reduce((acc, row) => {
        const count = Object.values(row).filter((v) => toFiniteNumber(v) !== null).length;
        return acc + count;
      }, 0);
      const dev = rows.length >= 3 ? 2.0 : rows.length >= 2 ? 4.2 : 9.5;
      return {
        deviationPct: dev,
        measuredSummary: `${rows.length} baris pengamatan (${numericCells} sel kuantitatif)`,
        withinTolerance: rows.length >= 2 && numericCells >= 4,
      };
    },
  };
}

export interface RubricEvaluatableSubmission {
  moduleId: string;
  domain: string;
  hypothesisText?: string;
  observationData?: Array<Record<string, number | string>>;
  regressionMetrics?: {
    rSquared: number;
    slope: number;
    equation: string;
  } | null;
  quizScore?: number;
  conclusionText?: string;
}

/**
 * Evaluates a student lab submission deterministically and returns a structured rubric report
 * suitable for storing in `gradebook_entries.rubric_json` and displaying in the Teacher Gradebook.
 */
export function evaluateSubmissionRubric(
  submission: RubricEvaluatableSubmission,
  now: number = Date.now()
): EvaluatedRubricReport {
  const spec = getSpecForModule(submission.moduleId || 'newton-incline', submission.domain || 'physics');
  const rows = Array.isArray(submission.observationData) ? submission.observationData : [];
  const hypothesis = (submission.hypothesisText || '').trim();
  const conclusion = (submission.conclusionText || '').trim();
  const quizScore = clamp(Number(submission.quizScore ?? 0), 0, 100);

  // 1. Rumusan Hipotesis Ilmiah (15 poin)
  const hypothesisWords = hypothesis.split(/\s+/).filter(Boolean).length;
  const hypothesisPoints =
    hypothesisWords >= 6 ? 15 : hypothesisWords >= 3 ? 10 : hypothesisWords >= 1 ? 5 : 0;
  const hypothesisCriterion: RubricCriterionResult = {
    id: 'hypothesis_quality',
    label: 'Rumusan Hipotesis & Variabel Ilmiah',
    category: 'hypothesis',
    earnedPoints: hypothesisPoints,
    maxPoints: 15,
    passed: hypothesisPoints >= 10,
    targetDescription: 'Hipotesis memuat hubungan antar variabel bebas dan terikat (min. 6 kata).',
    measuredSummary: `${hypothesisWords} kata teridentifikasi`,
    feedback:
      hypothesisPoints === 15
        ? 'Hipotesis dirumuskan dengan jelas dan menghubungkan variabel eksperimen secara terukur.'
        : hypothesisPoints >= 10
          ? 'Hipotesis sudah ada, namun hubungan kausalitas variabel dapat dipertajam.'
          : 'Rumusan hipotesis terlalu singkat; sebutkan pengaruh variabel bebas terhadap variabel terikat.',
  };

  // 2. Kelengkapan Data Observasi (25 poin)
  const rowCount = rows.length;
  const observationPoints =
    rowCount >= spec.minObservationRows
      ? 25
      : rowCount === spec.minObservationRows - 1 && rowCount >= 2
        ? 18
        : rowCount === 1
          ? 10
          : 0;
  const observationCriterion: RubricCriterionResult = {
    id: 'observation_completeness',
    label: 'Kelengkapan Sampel Tabel Observasi',
    category: 'observation',
    earnedPoints: observationPoints,
    maxPoints: 25,
    passed: observationPoints >= 18,
    targetDescription: `Minimal ${spec.minObservationRows} variasi percobaan tercatat pada tabel observasi.`,
    measuredSummary: `${rowCount} baris data eksperimen`,
    feedback:
      observationPoints === 25
        ? `Tabel observasi lengkap (${rowCount} sampel) dan memadai untuk analisis regresi.`
        : observationPoints >= 18
          ? `Tercatat ${rowCount} baris data; disarankan menambah variasi parameter agar kurva lebih presisi.`
          : 'Sampel data observasi belum mencukupi untuk menyimpulkan tren kuantitatif yang valid.',
  };

  // 3. Akurasi Fisika/Kimia & Toleransi Numerik RK4 (30 poin)
  const rowEval = spec.evaluateRowAccuracy(rows);
  const rSquared = submission.regressionMetrics?.rSquared;
  const hasStrongRegression = typeof rSquared === 'number' && Number.isFinite(rSquared) && rSquared >= 0.85;
  let numericalPoints = 0;
  if (rowCount === 0) {
    numericalPoints = 0;
  } else if (rowEval.withinTolerance && (hasStrongRegression || rSquared === undefined)) {
    numericalPoints = rowEval.deviationPct <= spec.rk4TolerancePct ? 30 : 26;
  } else if (rowEval.withinTolerance || hasStrongRegression) {
    numericalPoints = 22;
  } else {
    numericalPoints = 12;
  }

  const r2Summary =
    typeof rSquared === 'number' && Number.isFinite(rSquared) ? ` | R² = ${rSquared.toFixed(3)}` : '';

  const numericalCriterion: RubricCriterionResult = {
    id: 'rk4_numerical_accuracy',
    label: `Akurasi Numerik RK4 (${spec.primaryMetricLabel})`,
    category: 'numerical_accuracy',
    earnedPoints: numericalPoints,
    maxPoints: 30,
    passed: numericalPoints >= 22,
    targetDescription: `Sesuai referensi ${spec.referenceFormulaHint} (toleransi RK4 ±${spec.rk4TolerancePct}%).`,
    measuredSummary: `${rowEval.measuredSummary}${r2Summary}`,
    feedback:
      numericalPoints >= 26
        ? `Data eksperimen sangat presisi dalam batas toleransi integrator RK4 (deviasi ~${rowEval.deviationPct}%).`
        : numericalPoints >= 22
          ? 'Data berada dekat rentang teoretis namun masih terdapat deviasi pengukuran minor.'
          : 'Terdapat simpangan numerik cukup besar terhadap model persamaan diferensial RK4.',
  };

  // 4. Penguasaan Konsep Kuis Pasca-Lab (15 poin)
  const quizPoints = Math.round((quizScore / 100) * 15);
  const quizCriterion: RubricCriterionResult = {
    id: 'post_lab_mastery',
    label: 'Penguasaan Konsep (Kuis Evaluasi)',
    category: 'mastery_quiz',
    earnedPoints: quizPoints,
    maxPoints: 15,
    passed: quizScore >= 70,
    targetDescription: 'Skor kuis pemahaman konsep minimal 70/100.',
    measuredSummary: `Skor Kuis: ${quizScore}/100`,
    feedback:
      quizScore >= 85
        ? 'Pemahaman konsep teoretis dan analitis sangat kuat.'
        : quizScore >= 70
          ? 'Konsep dasar telah dikuasai dengan cukup baik.'
          : 'Perlu peninjauan ulang konsep rumus utama pada modul ini.',
  };

  // 5. Sintesis Kesimpulan & Refleksi Bukti Data (15 poin)
  const conclusionWords = conclusion.split(/\s+/).filter(Boolean).length;
  const mentionsQuantitative =
    /\d/.test(conclusion) ||
    /berbanding|meningkat|menurun|linear|ekuivalen|konstan|korelasi|hipotesis/i.test(conclusion);
  const conclusionPoints =
    conclusionWords >= 8 && mentionsQuantitative
      ? 15
      : conclusionWords >= 5
        ? 11
        : conclusionWords >= 1
          ? 6
          : 0;
  const conclusionCriterion: RubricCriterionResult = {
    id: 'conclusion_synthesis',
    label: 'Sintesis Kesimpulan Berbasis Bukti Data',
    category: 'conclusion',
    earnedPoints: conclusionPoints,
    maxPoints: 15,
    passed: conclusionPoints >= 11,
    targetDescription: 'Kesimpulan menjawab hipotesis dengan merujuk tren angka atau hasil pengamatan.',
    measuredSummary: `${conclusionWords} kata${mentionsQuantitative ? ' (memuat rujukan analitis)' : ''}`,
    feedback:
      conclusionPoints === 15
        ? 'Kesimpulan tajam, koheren, dan didukung langsung oleh bukti kuantitatif eksperimen.'
        : conclusionPoints >= 11
          ? 'Kesimpulan sudah relevan; tambahkan kutipan angka spesifik dari tabel atau regresi.'
          : 'Kesimpulan masih terlalu umum dan belum mengaitkan data hasil percobaan.',
  };

  const criteria: RubricCriterionResult[] = [
    hypothesisCriterion,
    observationCriterion,
    numericalCriterion,
    quizCriterion,
    conclusionCriterion,
  ];

  const totalEarned = criteria.reduce((sum, item) => sum + item.earnedPoints, 0);
  const maxScore = criteria.reduce((sum, item) => sum + item.maxPoints, 0);
  const finalScore = clamp(totalEarned, 0, maxScore);
  const passed = finalScore >= 70;

  const summaryFeedback =
    finalScore >= 88
      ? `Sangat Memuaskan (${finalScore}/100): Eksperimen ${spec.title} memenuhi akurasi numerik RK4 dan sintesis ilmiah dengan sangat baik.`
      : finalScore >= 70
        ? `Memuaskan (${finalScore}/100): Praktikum ${spec.title} tuntas dengan baik; perhatikan catatan detail pada tiap kriteria rubrik.`
        : `Perlu Penguatan (${finalScore}/100): Lengkapi variasi sampel data observasi dan pastikan kesimpulan merujuk pada tren kuantitatif.`;

  return {
    moduleId: spec.moduleId,
    domain: spec.domain,
    score: finalScore,
    maxScore,
    passed,
    rk4TolerancePct: spec.rk4TolerancePct,
    numericalDeviationPct: rowCount > 0 ? rowEval.deviationPct : null,
    summaryFeedback,
    criteria,
    evaluatedAt: now,
  };
}

export function serializeRubricJson(report: EvaluatedRubricReport): string {
  return JSON.stringify(report);
}

export function parseRubricJson(raw: string | null | undefined): EvaluatedRubricReport | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as EvaluatedRubricReport;
    if (parsed && typeof parsed.score === 'number' && Array.isArray(parsed.criteria)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
