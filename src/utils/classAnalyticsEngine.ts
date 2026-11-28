import type { ExperimentModule, ScienceDomain } from '../registry/experimentRegistry';
import type { LabSubmission } from '../types/submissionTypes';
import {
  evaluateSubmissionRubric,
  parseRubricJson,
  type EvaluatedRubricReport,
} from '../shared/grading/rubricEngine';

export interface ScoreHistogramBin {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  count: number;
  pct: number;
  meetsKkm: boolean;
}

export interface RubricCriterionAverage {
  id: string;
  label: string;
  averagePct: number;
  averagePoints: number;
  maxPoints: number;
}

export interface ClassMisconceptionCluster {
  id: string;
  title: string;
  criterionId: string;
  affectedCount: number;
  affectedPct: number;
  severity: 'high' | 'medium' | 'low';
  remedialAction: string;
  studentNames: string[];
}

export interface ClassGradebookAnalytics {
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  kkmThreshold: number;
  passedCount: number;
  remedialCount: number;
  passRatePct: number;
  histogram: ScoreHistogramBin[];
  rubricAverages: RubricCriterionAverage[];
  weakestCriterion: RubricCriterionAverage | null;
  misconceptionClusters: ClassMisconceptionCluster[];
}

export interface DomainCurriculumProgress {
  domain: ScienceDomain;
  label: string;
  completedCount: number;
  totalCount: number;
  pct: number;
}

const BOOKMARK_STORAGE_KEY = 'ruanglab_bookmarked_modules_v1';

function resolveRubric(sub: LabSubmission): EvaluatedRubricReport {
  if (sub.autoRubric && Array.isArray(sub.autoRubric.criteria)) {
    return sub.autoRubric;
  }
  const parsed = parseRubricJson(sub.rubricJson);
  if (parsed) return parsed;
  return evaluateSubmissionRubric({
    moduleId: sub.moduleId,
    domain: sub.domain,
    hypothesisText: sub.hypothesisText,
    observationData: sub.observationData,
    regressionMetrics: sub.regressionMetrics,
    quizScore: sub.quizScore,
    conclusionText: sub.conclusionText,
  });
}

function sanitizeCsvField(raw: string | number | null | undefined): string {
  const str = String(raw ?? '').replace(/\r?\n/g, ' ').trim();
  const safeFormula = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safeFormula.replace(/"/g, '""')}"`;
}

/**
 * Pure misconception cluster detector across student submissions.
 * Identifies specific pedagogical & experimental bottlenecks (hypothesis variables, sample density,
 * RK4 numerical deviation, post-lab concept mastery, and evidence-based conclusion).
 */
export function computeClassMisconceptionClusters(
  submissions: LabSubmission[]
): ClassMisconceptionCluster[] {
  const clusterDefs: Array<{
    id: string;
    criterionId: string;
    title: string;
    remedialAction: string;
  }> = [
    {
      id: 'misconception-hypothesis',
      criterionId: 'hypothesis',
      title: 'Rumusan Hipotesis Belum Memuat Hubungan Variabel Bebas & Terikat',
      remedialAction:
        'Latih siswa menyusun kalimat hipotesis sebab-akibat ("Jika [variabel bebas] dinaikkan, maka [variabel terikat] akan...") sebelum masuk ke kokpit 3D.',
    },
    {
      id: 'misconception-observation',
      criterionId: 'observation_completeness',
      title: 'Variasi Sampel Pengamatan Kurang (< 4 Titik Regresi)',
      remedialAction:
        'Arahkan siswa menggunakan fitur Auto-Sweep 5 Titik atau mencatat minimal 5 variasi variabel bebas agar garis regresi valid.',
    },
    {
      id: 'misconception-rk4-solver',
      criterionId: 'rk4_numerical_accuracy',
      title: 'Deviasi Pengukuran / Outlier terhadap Model Teoretis RK4',
      remedialAction:
        'Minta siswa memeriksa Diagnostik Kualitas Kurva di Stage 3 untuk mengecualikan titik outlier dan mencocokkan model kurva.',
    },
    {
      id: 'misconception-postlab-quiz',
      criterionId: 'post_lab_quiz',
      title: 'Pemahaman Konsep & Interpretasi Gradien Kurva Masih Lemah',
      remedialAction:
        'Bahas makna fisis kemiringan grafik (ΔY/ΔX) menggunakan Kartu Formula Interaktif bersama kelas.',
    },
    {
      id: 'misconception-conclusion',
      criterionId: 'conclusion_synthesis',
      title: 'Kesimpulan Belum Menyertakan Bukti Angka R² / Persamaan Regresi',
      remedialAction:
        'Gunakan tombol "Salin Diagnostik LKS" pada grafik regresi agar siswa menuliskan bukti kuantitatif di kesimpulan.',
    },
  ];

  if (submissions.length === 0) return [];

  const total = submissions.length;
  const results: ClassMisconceptionCluster[] = [];

  for (const def of clusterDefs) {
    const affectedStudents: string[] = [];

    for (const sub of submissions) {
      const rubric = resolveRubric(sub);
      const crit = rubric.criteria.find((c) => c.id === def.criterionId);
      if (crit) {
        const ratio = crit.maxPoints > 0 ? crit.earnedPoints / crit.maxPoints : 1;
        if (ratio < 0.72) {
          affectedStudents.push(sub.studentName);
        }
      }
    }

    const affectedCount = affectedStudents.length;
    const affectedPct = Math.round((affectedCount / total) * 100);
    const severity: 'high' | 'medium' | 'low' =
      affectedPct >= 45 ? 'high' : affectedPct >= 20 ? 'medium' : 'low';

    results.push({
      id: def.id,
      title: def.title,
      criterionId: def.criterionId,
      affectedCount,
      affectedPct,
      severity,
      remedialAction: def.remedialAction,
      studentNames: affectedStudents.slice(0, 8),
    });
  }

  return results.sort((a, b) => b.affectedCount - a.affectedCount);
}

/**
 * Generates an Excel/Google-Classroom safe UTF-8 BOM CSV containing full 5-dimension rubric breakdown,
 * KKM mastery status, regression R², and diagnostic notes for every student submission.
 */
export function buildFullClassAnalyticsReportCsv(
  submissions: LabSubmission[],
  kkmThreshold: number = 75
): string {
  const safeKkm = Math.max(0, Math.min(100, Math.round(kkmThreshold)));
  const headers = [
    'ID Laporan',
    'Nama Siswa',
    'Domain',
    'ID Modul',
    'Skor Akhir',
    'Batas KKM',
    'Status Ketuntasan',
    'Hipotesis (15)',
    'Kelengkapan Data (25)',
    'Akurasi RK4 (30)',
    'Kuis Pasca-Lab (15)',
    'Sintesis Kesimpulan (15)',
    'R-Squared Regresi',
    'Persamaan Regresi',
    'Diagnostik & Umpan Balik',
    'Waktu Pengumpulan',
  ];

  const rows = submissions.map((sub) => {
    const rubric = resolveRubric(sub);
    const finalScore = sub.teacherGrade?.score ?? rubric.score ?? sub.quizScore ?? 0;
    const status = finalScore >= safeKkm ? 'TUNTAS KKM' : 'PERLU REMEDIAL';
    const getCritPts = (id: string) => {
      const c = rubric.criteria.find((item) => item.id === id);
      return c ? c.earnedPoints : 0;
    };
    const r2 = sub.regressionMetrics?.rSquared ?? 0;
    const eq = sub.regressionMetrics?.equation || '-';
    const feedback =
      sub.teacherGrade?.feedback || rubric.summaryFeedback || 'Sudah dievaluasi otomatis.';

    return [
      sanitizeCsvField(sub.id),
      sanitizeCsvField(sub.studentName),
      sanitizeCsvField(sub.domain),
      sanitizeCsvField(sub.moduleId),
      sanitizeCsvField(finalScore),
      sanitizeCsvField(safeKkm),
      sanitizeCsvField(status),
      sanitizeCsvField(getCritPts('hypothesis')),
      sanitizeCsvField(getCritPts('observation_completeness')),
      sanitizeCsvField(getCritPts('rk4_numerical_accuracy')),
      sanitizeCsvField(getCritPts('post_lab_quiz')),
      sanitizeCsvField(getCritPts('conclusion_synthesis')),
      sanitizeCsvField(Number(r2).toFixed(4)),
      sanitizeCsvField(eq),
      sanitizeCsvField(feedback),
      sanitizeCsvField(sub.submittedAt),
    ].join(',');
  });

  return `\uFEFF${headers.map(sanitizeCsvField).join(',')}\n${rows.join('\n')}`;
}

/**
 * Pure analytics engine for Teacher Gradebook: computes score histogram, KKM pass rate,
 * 5-dimension rubric averages, and misconception clusters to pinpoint class-wide learning bottlenecks.
 */
export function computeClassGradebookAnalytics(
  submissions: LabSubmission[],
  kkmThreshold: number = 75
): ClassGradebookAnalytics {
  const safeKkm = Math.max(0, Math.min(100, Math.round(kkmThreshold)));
  const binSpecs = [
    { id: 'bin-0-59', label: '< 60', minScore: 0, maxScore: 59 },
    { id: 'bin-60-69', label: '60–69', minScore: 60, maxScore: 69 },
    { id: 'bin-70-79', label: '70–79', minScore: 70, maxScore: 79 },
    { id: 'bin-80-89', label: '80–89', minScore: 80, maxScore: 89 },
    { id: 'bin-90-100', label: '90–100', minScore: 90, maxScore: 100 },
  ];

  if (submissions.length === 0) {
    return {
      totalSubmissions: 0,
      gradedCount: 0,
      pendingCount: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      kkmThreshold: safeKkm,
      passedCount: 0,
      remedialCount: 0,
      passRatePct: 0,
      histogram: binSpecs.map((b) => ({
        ...b,
        count: 0,
        pct: 0,
        meetsKkm: b.maxScore >= safeKkm,
      })),
      rubricAverages: [],
      weakestCriterion: null,
      misconceptionClusters: [],
    };
  }

  let gradedCount = 0;
  let scoreSum = 0;
  let highestScore = -Infinity;
  let lowestScore = Infinity;
  let passedCount = 0;

  const binCounts = binSpecs.map(() => 0);
  const rubricAccum = new Map<
    string,
    { id: string; label: string; pointsSum: number; maxPoints: number; count: number }
  >();

  for (const sub of submissions) {
    const rubric = resolveRubric(sub);
    const effectiveScore = sub.teacherGrade?.score ?? rubric.score ?? sub.quizScore ?? 0;
    if (sub.teacherGrade) gradedCount += 1;

    scoreSum += effectiveScore;
    if (effectiveScore > highestScore) highestScore = effectiveScore;
    if (effectiveScore < lowestScore) lowestScore = effectiveScore;
    if (effectiveScore >= safeKkm) passedCount += 1;

    const binIdx = binSpecs.findIndex(
      (b) => effectiveScore >= b.minScore && effectiveScore <= b.maxScore
    );
    if (binIdx !== -1) {
      binCounts[binIdx] += 1;
    } else if (effectiveScore > 100) {
      binCounts[binCounts.length - 1] += 1;
    } else {
      binCounts[0] += 1;
    }

    for (const crit of rubric.criteria || []) {
      const prev = rubricAccum.get(crit.id) ?? {
        id: crit.id,
        label: crit.label,
        pointsSum: 0,
        maxPoints: crit.maxPoints,
        count: 0,
      };
      prev.pointsSum += Number.isFinite(crit.earnedPoints) ? crit.earnedPoints : 0;
      prev.count += 1;
      rubricAccum.set(crit.id, prev);
    }
  }

  const total = submissions.length;
  const histogram: ScoreHistogramBin[] = binSpecs.map((b, idx) => ({
    ...b,
    count: binCounts[idx],
    pct: Math.round((binCounts[idx] / total) * 100),
    meetsKkm: b.minScore >= safeKkm || (b.minScore < safeKkm && b.maxScore >= safeKkm),
  }));

  const rubricAverages: RubricCriterionAverage[] = Array.from(rubricAccum.values()).map(
    (entry) => {
      const avgPts = entry.count > 0 ? entry.pointsSum / entry.count : 0;
      const pct = entry.maxPoints > 0 ? Math.round((avgPts / entry.maxPoints) * 100) : 0;
      return {
        id: entry.id,
        label: entry.label,
        averagePoints: Number(avgPts.toFixed(1)),
        maxPoints: entry.maxPoints,
        averagePct: Math.max(0, Math.min(100, pct)),
      };
    }
  );

  const weakestCriterion =
    rubricAverages.length > 0
      ? rubricAverages.reduce((min, item) =>
          item.averagePct < min.averagePct ? item : min
        )
      : null;

  const misconceptionClusters = computeClassMisconceptionClusters(submissions);

  return {
    totalSubmissions: total,
    gradedCount,
    pendingCount: total - gradedCount,
    averageScore: Number((scoreSum / total).toFixed(1)),
    highestScore: highestScore === -Infinity ? 0 : highestScore,
    lowestScore: lowestScore === Infinity ? 0 : lowestScore,
    kkmThreshold: safeKkm,
    passedCount,
    remedialCount: total - passedCount,
    passRatePct: Math.round((passedCount / total) * 100),
    histogram,
    rubricAverages,
    weakestCriterion,
    misconceptionClusters,
  };
}

/**
 * Computes per-domain curriculum completion summary across the 28-module catalog.
 */
export function computeDomainCurriculumProgress(
  catalog: ExperimentModule[],
  completedModuleIds: string[]
): {
  domains: DomainCurriculumProgress[];
  totalCompleted: number;
  totalModules: number;
  overallPct: number;
} {
  const completedSet = new Set(completedModuleIds);
  const domainSpecs: Array<{ domain: ScienceDomain; label: string }> = [
    { domain: 'fisika', label: 'Fisika' },
    { domain: 'kimia', label: 'Kimia' },
    { domain: 'biologi', label: 'Biologi' },
    { domain: 'astronomi', label: 'Astronomi' },
    { domain: 'kebumian', label: 'Kebumian' },
  ];

  const domains: DomainCurriculumProgress[] = domainSpecs.map(({ domain, label }) => {
    const mods = catalog.filter((m) => m.domain === domain);
    const done = mods.filter((m) => completedSet.has(m.id)).length;
    const total = mods.length;
    return {
      domain,
      label,
      completedCount: done,
      totalCount: total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  const totalModules = catalog.length;
  const totalCompleted = catalog.filter((m) => completedSet.has(m.id)).length;

  return {
    domains,
    totalCompleted,
    totalModules,
    overallPct: totalModules > 0 ? Math.round((totalCompleted / totalModules) * 100) : 0,
  };
}

export function toggleModuleBookmarkList(currentIds: string[], moduleId: string): string[] {
  if (currentIds.includes(moduleId)) {
    return currentIds.filter((id) => id !== moduleId);
  }
  return [...currentIds, moduleId];
}

export function loadBookmarkedModuleIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveBookmarkedModuleIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota errors
  }
}
