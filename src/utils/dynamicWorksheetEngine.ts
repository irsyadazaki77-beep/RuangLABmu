import type { ExperimentModule } from '../registry/experimentRegistry';
import {
  CurveFitResult,
  CurveModelType,
  DataPointMultiAxis,
  ExperimentRecord,
  ScienceDomain,
  WorksheetQuestion,
  calculateCurveFitting,
  calculateLinearRegression,
} from './engines/statisticsAndRegression';

export interface ModuleAnalyticsDataset {
  id: string;
  title: string;
  xAxisLabel: string;
  y1AxisLabel: string;
  y2AxisLabel: string;
  xUnit: string;
  y1Unit: string;
  y2Unit: string;
  points: DataPointMultiAxis[];
}

export interface ResidualPoint {
  index: number;
  label: string;
  x: number;
  y: number;
  yPred: number;
  residual: number;
  absResidual: number;
  errorBarHalf: number;
}

export interface CurveModelComparisonItem {
  modelType: CurveModelType;
  modelLabel: string;
  equationString: string;
  rSquared: number;
  rmse: number;
  isBest: boolean;
}

export interface DynamicPostLabQuestion {
  id: string;
  question: string;
  options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctKey: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  sourceTag: 'data-aktual' | 'analisis-kurva' | 'metodologi';
}

export interface ParsedManualCsvRow {
  x: number;
  y1: number;
  y2?: number;
  notes: string;
}

function mapRegistryDomainToTitle(domain?: string): ScienceDomain {
  const lower = (domain || '').toLowerCase();
  if (lower === 'kimia' || lower === 'chemistry') return 'Kimia';
  if (lower === 'biologi' || lower === 'biology') return 'Biologi';
  if (lower === 'astronomi' || lower === 'astronomy') return 'Astronomi';
  return 'Fisika';
}

function roundTo(val: number, decimals: number): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(5, decimals)));
  return Math.round(val * factor) / factor;
}

/**
 * Resolves axis labels and units from an ExperimentModule definition so Stage 3 charts
 * display real physical/chemical/biological/astronomical axis titles instead of generic X/Y1.
 */
export function resolveModuleAxisMeta(mod?: ExperimentModule): {
  xKey: string;
  y1Key: string;
  y2Key: string | null;
  xAxisLabel: string;
  y1AxisLabel: string;
  y2AxisLabel: string;
  xUnit: string;
  y1Unit: string;
  y2Unit: string;
} {
  if (!mod) {
    return {
      xKey: 'x',
      y1Key: 'y1',
      y2Key: null,
      xAxisLabel: 'Variabel Bebas (X)',
      y1AxisLabel: 'Respons Terikat (Y1)',
      y2AxisLabel: 'Respons Sekunder (Y2)',
      xUnit: '',
      y1Unit: '',
      y2Unit: '',
    };
  }

  const xParam =
    mod.parameters.find((p) => p.key === mod.defaultRegressionAxes?.xKey) ??
    mod.parameters.find((p) => p.variableRole === 'bebas') ??
    mod.parameters[0];

  const y1Out =
    mod.outputs.find((o) => o.key === mod.defaultRegressionAxes?.yKey) ??
    mod.outputs[0];

  const y2Out =
    mod.outputs.find((o) => o.key !== y1Out?.key) ?? null;

  const xUnit = xParam?.unit || '';
  const y1Unit = y1Out?.unit || '';
  const y2Unit = y2Out?.unit || '';

  return {
    xKey: xParam?.key || 'x',
    y1Key: y1Out?.key || 'y1',
    y2Key: y2Out?.key || null,
    xAxisLabel: xParam
      ? `${xParam.label}${xUnit ? ` (${xUnit})` : ''}`
      : 'Variabel Bebas (X)',
    y1AxisLabel: y1Out
      ? `${y1Out.label}${y1Unit ? ` (${y1Unit})` : ''}`
      : 'Respons Terikat (Y1)',
    y2AxisLabel: y2Out
      ? `${y2Out.label}${y2Unit ? ` (${y2Unit})` : ''}`
      : 'Respons Sekunder (Y2)',
    xUnit,
    y1Unit,
    y2Unit,
  };
}

/**
 * Deterministically builds a physically accurate 5-point preset dataset for ANY of the 28 modules
 * using the module's own `computeStep` model, adding realistic small instrumentation variation (~1%).
 */
export function buildModulePresetDataset(
  mod: ExperimentModule,
  numPoints: number = 5
): ModuleAnalyticsDataset {
  const count = Math.max(3, Math.min(8, Math.floor(numPoints)));
  const axis = resolveModuleAxisMeta(mod);
  const xParam =
    mod.parameters.find((p) => p.key === axis.xKey) ??
    mod.parameters.find((p) => p.variableRole === 'bebas') ??
    mod.parameters[0];

  const baseParams: Record<string, number> = {};
  for (const p of mod.parameters) {
    baseParams[p.key] = p.defaultValue;
  }

  const points: DataPointMultiAxis[] = [];
  if (xParam) {
    const span = Math.max(xParam.step || 0.1, xParam.max - xParam.min);
    // Avoid extreme min/max boundaries that may cause 0-division or static threshold clamping
    const startX = xParam.min + span * 0.15;
    const endX = xParam.min + span * 0.85;
    const stepDec = xParam.step < 1 ? Math.min(3, String(xParam.step).split('.')[1]?.length || 2) : 1;

    for (let i = 0; i < count; i++) {
      const ratio = count === 1 ? 0.5 : i / (count - 1);
      const rawX = startX + ratio * (endX - startX);
      const xVal = roundTo(rawX, stepDec);
      const trialParams = { ...baseParams, [xParam.key]: xVal };
      let computed: Record<string, number> = {};
      try {
        computed = mod.computeStep(trialParams, 2.0) || {};
      } catch {
        computed = {};
      }

      const rawY1 = computed[axis.y1Key];
      const fallbackY1 = Object.values(computed).find((v) => typeof v === 'number' && Number.isFinite(v)) ?? xVal;
      const baseY1 = typeof rawY1 === 'number' && Number.isFinite(rawY1) ? rawY1 : fallbackY1;
      // Deterministic tiny measurement jitter (±0.8%) so residuals & error bars are meaningful
      const jitterPattern = [-0.007, 0.008, -0.005, 0.006, -0.004, 0.005, -0.006, 0.004];
      const jitter = 1 + (jitterPattern[i % jitterPattern.length] ?? 0);
      const y1Precision = mod.outputs.find((o) => o.key === axis.y1Key)?.precision ?? 2;
      const y1Val = roundTo(baseY1 * jitter, Math.max(2, y1Precision));

      let y2Val = 0;
      if (axis.y2Key && typeof computed[axis.y2Key] === 'number' && Number.isFinite(computed[axis.y2Key])) {
        const y2Precision = mod.outputs.find((o) => o.key === axis.y2Key)?.precision ?? 2;
        y2Val = roundTo(computed[axis.y2Key], Math.max(2, y2Precision));
      }

      points.push({
        label: `Uji ${i + 1}`,
        x: xVal,
        y1: y1Val,
        y2: y2Val,
      });
    }
  } else {
    for (let i = 0; i < count; i++) {
      points.push({
        label: `Uji ${i + 1}`,
        x: (i + 1) * 10,
        y1: roundTo((i + 1) * 2.5, 2),
        y2: roundTo((i + 1) * 1.2, 2),
      });
    }
  }

  return {
    id: `preset-${mod.id}`,
    title: `Dataset Kurasi Modul: ${mod.title}`,
    xAxisLabel: axis.xAxisLabel,
    y1AxisLabel: axis.y1AxisLabel,
    y2AxisLabel: axis.y2AxisLabel,
    xUnit: axis.xUnit,
    y1Unit: axis.y1Unit,
    y2Unit: axis.y2Unit,
    points,
  };
}

/**
 * Computes residuals Δy_i = y_i - ŷ_i and symmetric error-bar half-widths for each point.
 */
export function computeResidualsAndErrorBars(
  points: DataPointMultiAxis[],
  regression: CurveFitResult,
  instrumentNst?: number
): {
  residuals: ResidualPoint[];
  rmse: number;
  maxAbsResidual: number;
} {
  if (points.length === 0) {
    return { residuals: [], rmse: 0, maxAbsResidual: 0 };
  }

  const rawResiduals = points.map((p) => {
    const yPred = regression.evaluateAt(p.x);
    return Number.isFinite(yPred) ? p.y1 - yPred : 0;
  });

  const mse =
    rawResiduals.reduce((acc, r) => acc + r * r, 0) / Math.max(1, rawResiduals.length);
  const rmse = Math.sqrt(mse);

  const yVals = points.map((p) => p.y1);
  const yRange = Math.max(1e-6, Math.max(...yVals) - Math.min(...yVals));
  const defaultHalfError =
    instrumentNst && instrumentNst > 0
      ? instrumentNst / 2
      : Math.max(rmse, yRange * 0.035);

  const residuals: ResidualPoint[] = points.map((p, index) => {
    const yPred = regression.evaluateAt(p.x);
    const safePred = Number.isFinite(yPred) ? yPred : p.y1;
    const residual = p.y1 - safePred;
    return {
      index,
      label: p.label || `Uji ${index + 1}`,
      x: p.x,
      y: p.y1,
      yPred: roundTo(safePred, 4),
      residual: roundTo(residual, 4),
      absResidual: roundTo(Math.abs(residual), 4),
      errorBarHalf: roundTo(Math.max(defaultHalfError, Math.abs(residual) * 0.5), 4),
    };
  });

  const maxAbsResidual = residuals.reduce(
    (max, r) => Math.max(max, r.absResidual),
    0
  );

  return {
    residuals,
    rmse: roundTo(rmse, 4),
    maxAbsResidual: roundTo(maxAbsResidual, 4),
  };
}

/**
 * Compares all 4 curve models (linear, quadratic, exponential, power) and identifies
 * the best-fitting model by R² (preferring simpler linear when tied within 0.002).
 */
export function compareCurveModels(
  points: { x: number; y: number }[]
): {
  comparisons: CurveModelComparisonItem[];
  bestModel: CurveModelType;
} {
  const models: CurveModelType[] = ['linear', 'quadratic', 'exponential', 'power'];
  if (points.length < 3) {
    const lin = calculateCurveFitting(points, 'linear');
    return {
      comparisons: [
        {
          modelType: 'linear',
          modelLabel: lin.modelLabel,
          equationString: lin.equationString,
          rSquared: lin.rSquared,
          rmse: 0,
          isBest: true,
        },
      ],
      bestModel: 'linear',
    };
  }

  const rawItems = models.map((modelType) => {
    const fit = calculateCurveFitting(points, modelType);
    const mse =
      points.reduce((acc, p) => {
        const pred = fit.evaluateAt(p.x);
        const diff = Number.isFinite(pred) ? p.y - pred : 0;
        return acc + diff * diff;
      }, 0) / points.length;
    return {
      modelType,
      modelLabel: fit.modelLabel,
      equationString: fit.equationString,
      rSquared: Number.isFinite(fit.rSquared) ? fit.rSquared : 0,
      rmse: roundTo(Math.sqrt(mse), 4),
      isBest: false,
    };
  });

  // Prefer linear if within 0.002 R² of the highest non-linear fit (Occam's razor)
  let best = rawItems[0];
  for (const item of rawItems) {
    if (item.rSquared > best.rSquared + 0.002) {
      best = item;
    }
  }

  const comparisons = rawItems.map((item) => ({
    ...item,
    isBest: item.modelType === best.modelType,
  }));

  return {
    comparisons,
    bestModel: best.modelType,
  };
}

export interface RegressionOutlierDiagnosticsResult {
  candidateOutlierIndices: number[];
  candidateOutlierLabels: string[];
  currentRSquared: number;
  projectedRSquared: number;
  rSquaredGain: number;
  qualityTier: 'high' | 'moderate' | 'low';
  qualityLabel: string;
  recommendedModel: CurveModelType;
  modelMismatchDetected: boolean;
  diagnosticSummary: string;
  clipboardReport: string;
}

/**
 * Pure deterministic outlier detector and scientific curve diagnostic engine.
 * Scans residuals (using leave-one-out / median-absolute-deviation & RMSE thresholds)
 * to identify anomalous measurements and projects R² improvement when cleaned.
 */
export function detectRegressionOutliersAndDiagnostics(
  points: DataPointMultiAxis[],
  curveModel: CurveModelType,
  excludedIndices: Set<number> = new Set(),
  instrumentNst?: number
): RegressionOutlierDiagnosticsResult {
  const activePts = points
    .map((p, idx) => ({ p, idx }))
    .filter((item) => !excludedIndices.has(item.idx));

  const fitInputs = (activePts.length >= 2 ? activePts : points.map((p, idx) => ({ p, idx }))).map(
    (item) => ({ x: item.p.x, y: item.p.y1 })
  );

  const currentReg = calculateCurveFitting(fitInputs, curveModel);
  const residualStats = computeResidualsAndErrorBars(points, currentReg, instrumentNst);
  const modelComp = compareCurveModels(fitInputs);

  const candidateOutlierIndices: number[] = [];
  const candidateOutlierLabels: string[] = [];

  if (activePts.length >= 4) {
    const activeAbsResiduals = activePts.map(
      (item) => residualStats.residuals[item.idx]?.absResidual ?? 0
    );
    const sortedAbs = [...activeAbsResiduals].sort((a, b) => a - b);
    const medianAbs = sortedAbs[Math.floor(sortedAbs.length / 2)] || 0;
    const yVals = activePts.map((item) => item.p.y1);
    const ySpan = Math.max(1e-6, Math.max(...yVals) - Math.min(...yVals));
    const nstFloor = instrumentNst && instrumentNst > 0 ? instrumentNst * 1.5 : ySpan * 0.06;
    const threshold = Math.max(nstFloor, medianAbs * 2.8, residualStats.rmse * 1.45);

    for (const item of activePts) {
      const resPt = residualStats.residuals[item.idx];
      if (resPt && resPt.absResidual > threshold && resPt.absResidual > ySpan * 0.05) {
        candidateOutlierIndices.push(item.idx);
        candidateOutlierLabels.push(item.p.label || `Uji ${item.idx + 1}`);
      }
    }
  }

  let projectedRSquared = currentReg.rSquared;
  if (
    candidateOutlierIndices.length > 0 &&
    activePts.length - candidateOutlierIndices.length >= 2
  ) {
    const cleanedSet = new Set([...excludedIndices, ...candidateOutlierIndices]);
    const cleanedPts = points
      .filter((_, idx) => !cleanedSet.has(idx))
      .map((p) => ({ x: p.x, y: p.y1 }));
    if (cleanedPts.length >= 2) {
      const cleanedFit = calculateCurveFitting(cleanedPts, curveModel);
      projectedRSquared = cleanedFit.rSquared;
    }
  }

  const rSquaredGain = roundTo(Math.max(0, projectedRSquared - currentReg.rSquared), 4);
  const bestAlt = modelComp.comparisons.find((c) => c.modelType === modelComp.bestModel);
  const modelMismatchDetected = Boolean(
    bestAlt &&
      bestAlt.modelType !== curveModel &&
      bestAlt.rSquared > currentReg.rSquared + 0.04
  );

  const qualityTier: 'high' | 'moderate' | 'low' =
    currentReg.rSquared >= 0.95
      ? 'high'
      : currentReg.rSquared >= 0.85
      ? 'moderate'
      : 'low';

  const qualityLabel =
    qualityTier === 'high'
      ? '● PRESISI TINGGI'
      : qualityTier === 'moderate'
      ? '▲ PRESISI MENENGAH'
      : '✕ DEV. TINGGI';

  let diagnosticSummary = '';
  if (candidateOutlierIndices.length > 0) {
    diagnosticSummary = `Terdeteksi ${candidateOutlierIndices.length} kandidat outlier (${candidateOutlierLabels.join(', ')}) dengan simpangan residu tajam. Mengecualikan titik tersebut meningkatkan R² dari ${currentReg.rSquared.toFixed(4)} menjadi ${projectedRSquared.toFixed(4)} (+${rSquaredGain.toFixed(4)}).`;
  } else if (modelMismatchDetected && bestAlt) {
    diagnosticSummary = `Pola data menunjukkan hubungan non-linier/alternatif: model ${bestAlt.modelLabel} menghasilkan R² = ${bestAlt.rSquared.toFixed(4)} (lebih akurat dibanding model saat ini R² = ${currentReg.rSquared.toFixed(4)}).`;
  } else if (qualityTier === 'high') {
    diagnosticSummary = `Kurva regresi sangat konsisten (${currentReg.equationString}, R² = ${currentReg.rSquared.toFixed(4)}, RMSE = ${residualStats.rmse.toFixed(3)}) tanpa pencilan signifikan.`;
  } else {
    diagnosticSummary = `Sebaran data memiliki R² = ${currentReg.rSquared.toFixed(4)} dan RMSE = ${residualStats.rmse.toFixed(3)}. Periksa konsistensi variabel kontrol atau tambah titik sampel.`;
  }

  const clipboardReport = `Analisis Regresi: ${currentReg.equationString} | R² = ${currentReg.rSquared.toFixed(4)} | RMSE = ${residualStats.rmse.toFixed(3)}. Diagnostik: ${diagnosticSummary}`;

  return {
    candidateOutlierIndices,
    candidateOutlierLabels,
    currentRSquared: roundTo(currentReg.rSquared, 4),
    projectedRSquared: roundTo(projectedRSquared, 4),
    rSquaredGain,
    qualityTier,
    qualityLabel,
    recommendedModel: modelComp.bestModel,
    modelMismatchDetected,
    diagnosticSummary,
    clipboardReport,
  };
}

/**
 * Parses pasted CSV / TSV / semicolon-separated manual measurements into structured numeric rows.
 * Format per line: `X, Y1 [, Y2 [, Catatan]]` (headers are automatically skipped).
 */
export function parseManualCsvRecords(rawText: string): ParsedManualCsvRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: ParsedManualCsvRow[] = [];
  for (const line of lines) {
    // Support comma, semicolon, or tab delimiters
    const delimiter = line.includes('\t')
      ? '\t'
      : line.includes(';')
      ? ';'
      : ',';
    const cells = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 2) continue;

    const x = Number(cells[0].replace(',', '.'));
    const y1 = Number(cells[1].replace(',', '.'));
    if (!Number.isFinite(x) || !Number.isFinite(y1)) {
      continue; // Skip header line or invalid text
    }

    let y2: number | undefined;
    let notes = '';
    if (cells.length >= 3) {
      const maybeY2 = Number(cells[2].replace(',', '.'));
      if (cells[2] !== '' && Number.isFinite(maybeY2)) {
        y2 = maybeY2;
        notes = cells.slice(3).join(' ').trim();
      } else {
        notes = cells.slice(2).join(' ').trim();
      }
    }

    parsed.push({
      x: roundTo(x, 4),
      y1: roundTo(y1, 4),
      y2: y2 !== undefined ? roundTo(y2, 4) : undefined,
      notes: notes || 'Impor data manual (CSV)',
    });
  }

  return parsed;
}

/**
 * Generates dynamic, contextual LKS worksheet questions tailored to the active ExperimentModule
 * AND the student's actual observation records & regression fit (zero pre-filled spoilers).
 */
export function generateDynamicWorksheetQuestions(
  mod: ExperimentModule | undefined,
  records: ExperimentRecord[],
  fallbackDomain?: string
): WorksheetQuestion[] {
  const domainTitle = mapRegistryDomainToTitle(mod?.domain || fallbackDomain);
  const axis = resolveModuleAxisMeta(mod);
  const moduleTitle = mod?.title || 'Praktikum Sains Virtual';

  const validPoints = records
    .filter((r) => typeof r.numericX === 'number' && typeof r.numericY1 === 'number')
    .map((r) => ({ x: r.numericX as number, y: r.numericY1 as number }));

  const hasStudentData = validPoints.length >= 2 && new Set(validPoints.map((p) => p.x)).size >= 2;

  // Build deterministic baseline points from module if student hasn't recorded >= 2 distinct points yet
  const referencePoints = hasStudentData
    ? validPoints
    : mod
    ? buildModulePresetDataset(mod, 5).points.map((p) => ({ x: p.x, y: p.y1 }))
    : [
        { x: 10, y: 2.5 },
        { x: 20, y: 5.0 },
        { x: 30, y: 7.5 },
        { x: 40, y: 10.0 },
      ];

  const reg = calculateLinearRegression(referencePoints);
  const sortedPts = [...referencePoints].sort((a, b) => a.x - b.x);
  const minPt = sortedPts[0];
  const maxPt = sortedPts[sortedPts.length - 1];
  const xSpan = Math.max(0.5, maxPt.x - minPt.x);
  const testX = roundTo(maxPt.x + xSpan * 0.25, 2);
  const predictedYAtTestX = roundTo(reg.slopeM * testX + reg.interceptC, 2);
  const meanY = roundTo(reg.meanY, 2);
  const deltaY = roundTo(maxPt.y - minPt.y, 2);
  const deltaX = roundTo(maxPt.x - minPt.x, 2);
  const secantSlope = Math.abs(deltaX) > 1e-6 ? roundTo(deltaY / deltaX, 3) : 0;

  const dataOriginLabel = hasStudentData
    ? `data aktual praktikum Anda (${validPoints.length} titik)`
    : `seri data acuan modul ${moduleTitle}`;

  const q1Tol = Math.max(0.15, Math.abs(predictedYAtTestX) * 0.04);
  const q2Tol = Math.max(0.05, Math.abs(secantSlope) * 0.06);
  const q3Tol = Math.max(0.1, Math.abs(meanY) * 0.03);

  const questions: WorksheetQuestion[] = [
    {
      id: `dyn-${mod?.id || 'lab'}-predict-y`,
      domain: domainTitle,
      topic: `${moduleTitle} — Prediksi Model Regresi`,
      questionText: `Berdasarkan ${dataOriginLabel} dengan persamaan regresi linier ${reg.equationString}, hitunglah nilai prediksi ${axis.y1AxisLabel} saat ${axis.xAxisLabel} dinaikkan ke X = ${testX}${axis.xUnit ? ` ${axis.xUnit}` : ''}!`,
      formulaHint: `ŷ = m · X + c = (${reg.slopeM.toFixed(3)})(${testX}) + (${reg.interceptC.toFixed(3)})`,
      unit: axis.y1Unit || 'satuan',
      correctValue: predictedYAtTestX,
      tolerance: roundTo(q1Tol, 3),
      explanation: `Substitusikan X = ${testX} ke persamaan regresi ${reg.equationString}: ŷ = ${reg.slopeM.toFixed(3)} × ${testX} + (${reg.interceptC.toFixed(3)}) = ${predictedYAtTestX}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}.`,
      scaffoldedHints: [
        `Konsep Fisis: Persamaan regresi memodelkan hubungan kuantitatif antara ${axis.xAxisLabel} dan ${axis.y1AxisLabel} sehingga dapat digunakan untuk meramalkan kondisi uji baru.`,
        `Identifikasi Variabel: Dari hasil regresi diperoleh gradien m = ${reg.slopeM.toFixed(3)} dan titik potong c = ${reg.interceptC.toFixed(3)}.`,
        `Langkah Substitusi: Hitung (${reg.slopeM.toFixed(3)} × ${testX}) lalu jumlahkan dengan (${reg.interceptC.toFixed(3)}).`,
      ],
    },
    {
      id: `dyn-${mod?.id || 'lab'}-slope-rate`,
      domain: domainTitle,
      topic: `${moduleTitle} — Laju Perubahan (Gradien Empiris)`,
      questionText: `Dari titik terendah (X₁ = ${minPt.x}, Y₁ = ${minPt.y}) hingga titik tertinggi (X₂ = ${maxPt.x}, Y₂ = ${maxPt.y}) pada ${dataOriginLabel}, berapakah laju perubahan rata-rata ΔY / ΔX?`,
      formulaHint: `m_rata = (Y₂ - Y₁) / (X₂ - X₁)`,
      unit: axis.y1Unit && axis.xUnit ? `${axis.y1Unit}/${axis.xUnit}` : 'satuan/unit',
      correctValue: secantSlope,
      tolerance: roundTo(q2Tol, 3),
      explanation: `ΔY = ${maxPt.y} - (${minPt.y}) = ${deltaY}, dan ΔX = ${maxPt.x} - (${minPt.x}) = ${deltaX}. Maka ΔY/ΔX = ${deltaY} / ${deltaX} = ${secantSlope}. Makna fisisnya: ${mod?.defaultRegressionAxes?.expectedSlopeMeaning || 'menunjukkan sensitivitas variabel terikat terhadap perubahan variabel bebas'}.`,
      scaffoldedHints: [
        `Konsep Fisis: Gradien (ΔY/ΔX) merepresentasikan ${mod?.defaultRegressionAxes?.expectedSlopeMeaning || 'laju perubahan variabel terikat per satuan variabel bebas'}.`,
        `Identifikasi Variabel: Hitung selisih ΔY = ${maxPt.y} - (${minPt.y}) = ${deltaY} dan ΔX = ${maxPt.x} - (${minPt.x}) = ${deltaX}.`,
        `Langkah Substitusi: Bagi ΔY (${deltaY}) dengan ΔX (${deltaX}) dan bulatkan hingga 2–3 angka desimal.`,
      ],
    },
    {
      id: `dyn-${mod?.id || 'lab'}-mean-y`,
      domain: domainTitle,
      topic: `${moduleTitle} — Rata-Rata Respons Pengamatan`,
      questionText: `Hitunglah nilai rata-rata (mean) pengukuran ${axis.y1AxisLabel} dari seluruh ${referencePoints.length} titik pengamatan (${referencePoints.map((p) => roundTo(p.y, 2)).join(', ')})!`,
      formulaHint: `ȳ = (Σ Y_i) / n`,
      unit: axis.y1Unit || 'satuan',
      correctValue: meanY,
      tolerance: roundTo(q3Tol, 3),
      explanation: `Jumlah seluruh nilai Y = ${roundTo(referencePoints.reduce((a, b) => a + b.y, 0), 3)} dibagi n = ${referencePoints.length} menghasilkan rata-rata ȳ = ${meanY}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}.`,
      scaffoldedHints: [
        'Konsep Statistik: Nilai rata-rata (mean) menjadi estimasi pusat pengukuran sebelum menghitung simpangan baku dan ketidakpastian gabungan.',
        `Identifikasi Variabel: Terdapat n = ${referencePoints.length} data pengukuran pada variabel ${axis.y1AxisLabel}.`,
        `Langkah Substitusi: Jumlahkan semua nilai (${referencePoints.map((p) => roundTo(p.y, 2)).join(' + ')}) lalu bagi dengan ${referencePoints.length}.`,
      ],
    },
  ];

  // Optional 4th question: Evaluate module's computeStep directly at mid-range parameter!
  if (mod && mod.parameters.length > 0 && mod.outputs.length > 0) {
    const p0 = mod.parameters[0];
    const out0 = mod.outputs[0];
    const midParams: Record<string, number> = {};
    for (const p of mod.parameters) {
      midParams[p.key] = p.defaultValue;
    }
    const targetP0 = roundTo(p0.min + (p0.max - p0.min) * 0.6, p0.step < 1 ? 2 : 1);
    midParams[p0.key] = targetP0;
    try {
      const res = mod.computeStep(midParams, 2.0);
      const val = res?.[out0.key];
      if (typeof val === 'number' && Number.isFinite(val)) {
        const expected = roundTo(val, Math.max(2, out0.precision));
        const tol = Math.max(0.15, Math.abs(expected) * 0.05);
        const paramDesc = mod.parameters
          .slice(0, 3)
          .map((p) => `${p.label} = ${midParams[p.key]}${p.unit ? ` ${p.unit}` : ''}`)
          .join(', ');
        questions.push({
          id: `dyn-${mod.id}-model-verify`,
          domain: domainTitle,
          topic: `${moduleTitle} — Verifikasi Persamaan Teoretis`,
          questionText: `Uji verifikasi kokpit: Jika pada modul ${moduleTitle} Anda menyetel ${paramDesc}, berapakah nilai teoretis ${out0.label} yang seharusnya terukur?`,
          formulaHint: mod.keyEquations[0] || out0.formulaLatex || 'Gunakan persamaan utama modul',
          unit: out0.unit || 'satuan',
          correctValue: expected,
          tolerance: roundTo(tol, 3),
          explanation: `Dengan menyubstitusikan ${paramDesc} ke model matematis ${mod.title} (${mod.keyEquations[0] || out0.formulaLatex}), diperoleh ${out0.label} = ${expected} ${out0.unit}.`,
          scaffoldedHints: [
            `Konsep Fisis: Anda dapat memverifikasi hasil hitungan tangan secara langsung dengan menggeser slider ${p0.label} ke ${targetP0} ${p0.unit} di Kokpit 3D.`,
            `Rumus Acuan: Gunakan persamaan ${mod.keyEquations[0] || out0.formulaLatex}.`,
            `Verifikasi Nilai: Pada setelan ${paramDesc}, nilai acuan teoretis berada di sekitar ${expected} ${out0.unit}.`,
          ],
        });
      }
    } catch {
      // Ignore if computeStep throws on synthetic mid params
    }
  }

  return questions;
}

/**
 * Generates 3 distinct Post-Lab Mastery Quiz questions grounded in the student's actual
 * experimental data, regression slope/R², and module concepts (never recycling pre-lab quiz items).
 */
export function generateDynamicPostLabQuiz(
  mod: ExperimentModule | undefined,
  records: ExperimentRecord[],
  fallbackDomain?: string
): DynamicPostLabQuestion[] {
  const moduleTitle = mod?.title || fallbackDomain || 'Eksperimen Sains Virtual';
  const axis = resolveModuleAxisMeta(mod);

  const validPoints = records
    .filter((r) => typeof r.numericX === 'number' && typeof r.numericY1 === 'number')
    .map((r) => ({ x: r.numericX as number, y: r.numericY1 as number }));

  const hasStudentData = validPoints.length >= 2 && new Set(validPoints.map((p) => p.x)).size >= 2;
  const activePts = hasStudentData
    ? validPoints
    : mod
    ? buildModulePresetDataset(mod, 5).points.map((p) => ({ x: p.x, y: p.y1 }))
    : [
        { x: 10, y: 2.5 },
        { x: 20, y: 5.0 },
        { x: 30, y: 7.5 },
      ];

  const reg = calculateLinearRegression(activePts);
  const slopeMeaning =
    mod?.defaultRegressionAxes?.expectedSlopeMeaning ||
    `laju perubahan ${axis.y1AxisLabel} terhadap ${axis.xAxisLabel}`;

  const sorted = [...activePts].sort((a, b) => a.x - b.x);
  const nextX = roundTo(sorted[sorted.length - 1].x + Math.max(1, (sorted[sorted.length - 1].x - sorted[0].x) * 0.5), 2);
  const predY = roundTo(reg.slopeM * nextX + reg.interceptC, 2);
  const distractorHigh = roundTo(predY * 1.38 + 1.2, 2);
  const distractorLow = roundTo(predY * 0.62 - 0.8, 2);
  const distractorNeg = roundTo(Math.abs(predY) > 0.5 ? -predY : predY + 4.5, 2);

  const r2Pct = Math.round(reg.rSquared * 100);
  const trendDirection =
    reg.slopeM > 0.001
      ? 'meningkat (korelasi positif)'
      : reg.slopeM < -0.001
      ? 'menurun (korelasi negatif)'
      : 'relatif konstan';

  return [
    {
      id: `postlab-dyn-pred-${mod?.id || 'lab'}`,
      sourceTag: 'data-aktual',
      question: `Menggunakan kurva regresi ${hasStudentData ? 'data aktual Anda' : `acuan modul ${moduleTitle}`} (${reg.equationString}, R² = ${reg.rSquared.toFixed(3)}), berapakah estimasi paling logis untuk ${axis.y1AxisLabel} bila ${axis.xAxisLabel} disetel pada ${nextX}${axis.xUnit ? ` ${axis.xUnit}` : ''}?`,
      options: [
        { key: 'A', text: `${distractorLow}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}` },
        { key: 'B', text: `${predY}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}` },
        { key: 'C', text: `${distractorHigh}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}` },
        { key: 'D', text: `${distractorNeg}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}` },
      ],
      correctKey: 'B',
      explanation: `Dengan memasukkan X = ${nextX} ke persamaan ${reg.equationString}, diperoleh ŷ = ${reg.slopeM.toFixed(3)} × ${nextX} + (${reg.interceptC.toFixed(3)}) ≈ ${predY}${axis.y1Unit ? ` ${axis.y1Unit}` : ''}.`,
    },
    {
      id: `postlab-dyn-slope-${mod?.id || 'lab'}`,
      sourceTag: 'analisis-kurva',
      question: `Pada eksperimen ${moduleTitle}, grafik ${axis.y1AxisLabel} terhadap ${axis.xAxisLabel} menunjukkan tren ${trendDirection} dengan gradien m = ${reg.slopeM.toFixed(3)}. Apa makna fisis utama dari gradien tersebut?`,
      options: [
        { key: 'A', text: 'Menunjukkan tingkat kesalahan manusia saat menekan tombol catat data.' },
        { key: 'B', text: 'Menyatakan jumlah total pengulangan percobaan yang dilakukan kelompok.' },
        { key: 'C', text: `Merepresentasikan ${slopeMeaning}.` },
        { key: 'D', text: 'Selalu bernilai nol pada setiap sistem eksperimen sains yang ideal.' },
      ],
      correctKey: 'C',
      explanation: `Gradien garis regresi (ΔY/ΔX) pada modul ${moduleTitle} memiliki makna fisis langsung, yaitu ${slopeMeaning}.`,
    },
    {
      id: `postlab-dyn-residual-${mod?.id || 'lab'}`,
      sourceTag: 'metodologi',
      question: `Saat menganalisis kurva dengan koefisien determinasi R² = ${reg.rSquared.toFixed(3)} (${r2Pct}%), bagaimana cara ilmiah paling tepat untuk menilai apakah model kurva yang dipilih (Linier vs Non-Linier) sudah sesuai?`,
      options: [
        {
          key: 'A',
          text: 'Memeriksa plot residual (Δy = y − ŷ) agar tersebar acak di sekitar nol dan membandingkan R² lintas model (Auto-Best-Fit).',
        },
        {
          key: 'B',
          text: 'Menghapus sebagian besar data pengamatan hingga tersisa 2 titik agar R² selalu tepat 1,000.',
        },
        {
          key: 'C',
          text: 'Mengabaikan nilai ketidakpastian instrumen (±Δy) selama grafik terlihat lurus secara kasatmata.',
        },
        {
          key: 'D',
          text: 'Mengubah satuan sumbu X agar kemiringan garis tampak lebih curam di layar.',
        },
      ],
      correctKey: 'A',
      explanation:
        'Evaluasi model ilmiah menuntut pemeriksaan pola residual (bila residual membentuk lengkungan sistematis, model non-linier lebih tepat) sekaligus perbandingan R² dan RMSE secara objektif.',
    },
  ];
}
