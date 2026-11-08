import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  ImageDown,
  Printer,
  CheckCircle2,
  BookOpenCheck,
  Calculator,
  FileText,
  Sparkles,
  Lightbulb,
  ArrowLeftRight,
  AlertTriangle,
  Filter,
  MessageSquareShare,
} from 'lucide-react';
import {
  DataPointMultiAxis,
  ExperimentRecord,
  WORKSHEET_QUESTIONS,
  CurveModelType,
  calculateCurveFitting,
  detectRegressionOutliers,
  gradeWorksheetAnswers,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import {
  AcademicReportData,
  openPrintableAcademicReport,
} from '../utils/academicReportExporter';
import { AcademicReportPreviewModal } from './ui/AcademicReportPreviewModal';
import { CircularGaugeMeter, CollapsibleLabSection } from './ui/LabInstruments';
import {
  HypothesisNote,
  HypothesisScratchpadCard,
  ExperimentTrialComparePanel,
} from './ui/HypothesisAndCompareDock';

interface AnalyticsAndWorksheetPanelProps {
  records: ExperimentRecord[];
  activeStudentName: string;
  activeGroupId: string;
  onSubmitQuizScore: (score: number, correctCount: number) => void;
  onExportChartNotification: (format: 'PNG' | 'PDF') => void;
  onProceedToReport?: () => void;
  onBackToLab?: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  onAskDrLabMu?: (prompt: string) => void;
}

const PRESET_DATASETS: Record<
  string,
  {
    title: string;
    xAxisLabel: string;
    y1AxisLabel: string;
    y2AxisLabel: string;
    points: DataPointMultiAxis[];
  }
> = {
  'newton-force-acc': {
    title: 'Hukum II Newton: Gaya Dorong (F) terhadap Percepatan (a) & Energi Kinetik (EK)',
    xAxisLabel: 'Gaya Resultan ΣF (N)',
    y1AxisLabel: 'Percepatan a (m/s²)',
    y2AxisLabel: 'Energi Kinetik (J)',
    points: [
      { label: 'Uji 1', x: 10, y1: 2.48, y2: 12.3 },
      { label: 'Uji 2', x: 20, y1: 5.02, y2: 36.1 },
      { label: 'Uji 3', x: 30, y1: 7.45, y2: 79.8 },
      { label: 'Uji 4', x: 40, y1: 10.04, y2: 144.5 },
      { label: 'Uji 5', x: 50, y1: 12.52, y2: 225.8 },
    ],
  },
  'hooke-spring': {
    title: 'Hukum Hooke: Simpangan Pegas (Δx) terhadap Gaya Pemulih (|Fp|) & Energi Potensial (Ep)',
    xAxisLabel: 'Simpangan Δx (m)',
    y1AxisLabel: 'Gaya Pemulih |Fp| (N)',
    y2AxisLabel: 'Energi Potensial Ep (J)',
    points: [
      { label: 'x=0.2m', x: 0.2, y1: 24.0, y2: 2.4 },
      { label: 'x=0.4m', x: 0.4, y1: 48.2, y2: 9.6 },
      { label: 'x=0.6m', x: 0.6, y1: 71.8, y2: 21.6 },
      { label: 'x=0.8m', x: 0.8, y1: 96.1, y2: 38.4 },
      { label: 'x=1.0m', x: 1.0, y1: 120.0, y2: 60.0 },
    ],
  },
  'thermo-gibbs': {
    title: 'Termodinamika: Suhu (T) terhadap Energi Bebas Gibbs (-ΔG) & Laju Reaksi (r)',
    xAxisLabel: 'Suhu Larutan (°C)',
    y1AxisLabel: 'Spontanitas -ΔG (kJ/mol)',
    y2AxisLabel: 'Laju Reaksi r (M/s)',
    points: [
      { label: '25°C', x: 25, y1: 81.27, y2: 6.8 },
      { label: '45°C', x: 45, y1: 82.88, y2: 11.4 },
      { label: '65°C', x: 65, y1: 84.49, y2: 18.2 },
      { label: '85°C', x: 85, y1: 86.1, y2: 27.9 },
      { label: '105°C', x: 105, y1: 87.71, y2: 41.5 },
    ],
  },
  'kepler-third-law': {
    title: 'Astronomi Hukum III Kepler: Pangkat Tiga Jarak (a³) terhadap Kuadrat Periode (T²) & Laju Orbit',
    xAxisLabel: 'Pangkat Tiga Sumbu Semi-Mayor a³ (AU³)',
    y1AxisLabel: 'Kuadrat Periode Orbit T² (thn²)',
    y2AxisLabel: 'Kecepatan Orbit v (km/s)',
    points: [
      { label: 'Merkurius', x: 0.06, y1: 0.06, y2: 47.87 },
      { label: 'Venus', x: 0.37, y1: 0.38, y2: 35.02 },
      { label: 'Bumi', x: 1.0, y1: 1.0, y2: 29.78 },
      { label: 'Mars', x: 3.51, y1: 3.53, y2: 24.07 },
      { label: 'Jupiter', x: 140.61, y1: 140.66, y2: 13.07 },
    ],
  },
};

export const AnalyticsAndWorksheetPanel: React.FC<
  AnalyticsAndWorksheetPanelProps
> = ({
  records,
  activeStudentName,
  activeGroupId,
  onSubmitQuizScore,
  onExportChartNotification,
  onProceedToReport,
  onBackToLab,
  hypothesisNote,
  onChangeHypothesisNote,
  onAskDrLabMu,
}) => {
  const [selectedDatasetKey, setSelectedDatasetKey] =
    useState<string>('newton-force-acc');
  const [curveModel, setCurveModel] = useState<CurveModelType>('linear');
  const [excludeOutliers, setExcludeOutliers] = useState<boolean>(false);
  const [simulateOutlierAnomaly, setSimulateOutlierAnomaly] =
    useState<boolean>(false);
  const [showFormulaCalc, setShowFormulaCalc] = useState<boolean>(false);
  const [calcValA, setCalcValA] = useState<string>('20.0');
  const [calcDeltaA, setCalcDeltaA] = useState<string>('0.1');
  const [calcValB, setCalcValB] = useState<string>('4.0');
  const [calcDeltaB, setCalcDeltaB] = useState<string>('0.05');
  const [calcOp, setCalcOp] = useState<'multiply' | 'divide' | 'add' | 'power2'>('divide');
  const [reportModalData, setReportModalData] =
    useState<AcademicReportData | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auxiliary study docks in Step 3
  const [showCompareDock, setShowCompareDock] = useState<boolean>(false);
  const [showHypothesisDock, setShowHypothesisDock] = useState<boolean>(false);

  // 3-Tier Scaffolded Hints State per LKS Question (0 = closed, 1 = Tier 1, 2 = Tier 2, 3 = Tier 3)
  const [hintLevelByQuestion, setHintLevelByQuestion] = useState<
    Record<string, number>
  >({});

  // Worksheet & Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({
    'q-newton-1': '9.0',
    'q-collision-2': '4.0',
    'q-thermo-3': '-90.0',
    'q-titration-4': '20.0',
    'q-kepler-5': '8.0',
    'q-exoplanet-6': '1.0',
  });
  const [lksDomainFilter, setLksDomainFilter] = useState<
    'Semua' | 'Fisika' | 'Kimia' | 'Astronomi'
  >('Semua');
  const [showFormulaHints, setShowFormulaHints] = useState<boolean>(true);
  const [gradedState, setGradedState] = useState<ReturnType<
    typeof gradeWorksheetAnswers
  > | null>(null);

  const filteredQuestions = WORKSHEET_QUESTIONS.filter((q) =>
    lksDomainFilter === 'Semua' ? true : q.domain === lksDomainFilter
  );
  const answeredCount = WORKSHEET_QUESTIONS.filter(
    (q) => (answers[q.id] ?? '').trim() !== ''
  ).length;
  const answeredPct = Math.round(
    (answeredCount / WORKSHEET_QUESTIONS.length) * 100
  );

  const handleAdvanceHint = (qId: string) => {
    labSound.playClick();
    setHintLevelByQuestion((prev) => {
      const current = prev[qId] ?? 0;
      const next = current >= 3 ? 0 : current + 1;
      return { ...prev, [qId]: next };
    });
  };

  // Resolve active points (either preset or custom recorded points)
  const customRecordPoints: DataPointMultiAxis[] = records
    .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
    .map((r, i) => ({
      label: r.id,
      x: r.numericX ?? i + 1,
      y1: r.numericY1 ?? 0,
      y2: r.numericY2 ?? 0,
    }));

  const baseConfig =
    selectedDatasetKey === 'custom-records' && customRecordPoints.length >= 2
      ? {
          title: 'Dataset Rekaman Tabel Log Eksperimen Siswa',
          xAxisLabel: 'Variabel Independen (X)',
          y1AxisLabel: 'Respons Utama (Y1)',
          y2AxisLabel: 'Respons Sekunder (Y2)',
          points: customRecordPoints,
        }
      : PRESET_DATASETS[selectedDatasetKey] ||
        PRESET_DATASETS['newton-force-acc'];

  const rawPointsWithOptionalAnomaly: DataPointMultiAxis[] =
    simulateOutlierAnomaly && baseConfig.points.length >= 3
      ? baseConfig.points.map((p, idx) =>
          idx === Math.floor(baseConfig.points.length / 2)
            ? {
                ...p,
                label: `${p.label} (Anomali)`,
                y1: Number((p.y1 * 1.65 + 4.2).toFixed(2)),
              }
            : p
        )
      : baseConfig.points;

  const outlierAnalysis = detectRegressionOutliers(
    rawPointsWithOptionalAnomaly.map((p) => ({
      x: p.x,
      y: p.y1,
      label: p.label,
    }))
  );

  const outlierIndices = new Set(outlierAnalysis.outliers.map((o) => o.index));

  const filteredPointsForFit = excludeOutliers
    ? rawPointsWithOptionalAnomaly.filter((_, idx) => !outlierIndices.has(idx))
    : rawPointsWithOptionalAnomaly;

  const activeConfig = {
    ...baseConfig,
    points: rawPointsWithOptionalAnomaly,
  };

  const regression = calculateCurveFitting(
    (filteredPointsForFit.length >= 2
      ? filteredPointsForFit
      : rawPointsWithOptionalAnomaly
    ).map((p) => ({ x: p.x, y: p.y1 })),
    curveModel
  );

  // Handle interactive pointer hover over the canvas points
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const pts = activeConfig.points;
    if (pts.length === 0) return;
    const padLeft = 64;
    const padRight = 64;
    const plotW = canvas.width - padLeft - padRight;
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x), minX + 1);
    const toScreenX = (xVal: number) =>
      padLeft + ((xVal - minX) / Math.max(1e-6, maxX - minX)) * plotW;

    let closestIdx: number | null = null;
    let bestDist = 42;
    pts.forEach((p, idx) => {
      const dist = Math.abs(toScreenX(p.x) - mouseX);
      if (dist < bestDist) {
        bestDist = dist;
        closestIdx = idx;
      }
    });

    setHoverIdx(closestIdx);
    if (closestIdx !== null) {
      setTooltipPos({
        x: Math.min(rect.width - 190, Math.max(12, relX + 12)),
        y: Math.max(12, relY - 56),
      });
    } else {
      setTooltipPos(null);
    }
  };

  // Draw Multi-Axis Regression Chart on Canvas
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 64;
    const padRight = 64;
    const padTop = 44;
    const padBottom = 48;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const gy = padTop + (i / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(width - padRight, gy);
      ctx.stroke();
    }

    const pts = activeConfig.points;
    if (pts.length === 0) return;

    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x), minX + 1);
    const minY1 = Math.min(0, ...pts.map((p) => p.y1));
    const maxY1 = Math.max(...pts.map((p) => p.y1), minY1 + 1) * 1.1;
    const minY2 = Math.min(0, ...pts.map((p) => p.y2));
    const maxY2 = Math.max(...pts.map((p) => p.y2), minY2 + 1) * 1.1;

    const toScreenX = (xVal: number) =>
      padLeft + ((xVal - minX) / Math.max(1e-6, maxX - minX)) * plotW;
    const toScreenY1 = (yVal: number) =>
      padTop +
      plotH -
      ((yVal - minY1) / Math.max(1e-6, maxY1 - minY1)) * plotH;
    const toScreenY2 = (yVal: number) =>
      padTop +
      plotH -
      ((yVal - minY2) / Math.max(1e-6, maxY2 - minY2)) * plotH;

    // Axes
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.lineTo(width - padRight, padTop + plotH);
    ctx.lineTo(width - padRight, padTop);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.fillText(`Sumbu Y1: ${activeConfig.y1AxisLabel}`, padLeft, 24);

    ctx.fillStyle = '#F59E0B';
    ctx.fillText(
      `Sumbu Y2: ${activeConfig.y2AxisLabel}`,
      width - padRight - 195,
      24
    );

    ctx.fillStyle = '#94A3B8';
    ctx.fillText(
      activeConfig.xAxisLabel,
      width / 2 - 70,
      height - 12
    );

    // 1. Draw Fitted Curve (Linear OLS, Quadratic Order-2, or Exponential) for Y1 (Dashed Emerald)
    if (regression.predictedPoints.length >= 2) {
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const steps = 48;
      for (let s = 0; s <= steps; s++) {
        const xVal = minX + (s / steps) * (maxX - minX);
        const yVal = regression.evaluateAt(xVal);
        const sx = toScreenX(xVal);
        const sy = toScreenY1(yVal);
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Secondary Axis Y2 Curve (Amber solid line)
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const sx = toScreenX(p.x);
      const sy2 = toScreenY2(p.y2);
      if (idx === 0) ctx.moveTo(sx, sy2);
      else ctx.lineTo(sx, sy2);
    });
    ctx.stroke();

    // 3. Draw Primary Axis Y1 Points & Connecting Line (Azure)
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const sx = toScreenX(p.x);
      const sy1 = toScreenY1(p.y1);
      if (idx === 0) ctx.moveTo(sx, sy1);
      else ctx.lineTo(sx, sy1);
    });
    ctx.stroke();

    pts.forEach((p, idx) => {
      const sx = toScreenX(p.x);
      const sy1 = toScreenY1(p.y1);
      const sy2 = toScreenY2(p.y2);

      // Vertical hover crosshair
      if (hoverIdx === idx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, padTop);
        ctx.lineTo(sx, padTop + plotH);
        ctx.stroke();
        ctx.restore();
      }

      // Y2 node
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(sx, sy2, hoverIdx === idx ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Y1 node (highlight outliers in rose/amber)
      const isPtOutlier = outlierIndices.has(idx);
      ctx.fillStyle = isPtOutlier
        ? excludeOutliers
          ? '#64748B'
          : '#F43F5E'
        : hoverIdx === idx
        ? '#10B981'
        : '#38BDF8';
      ctx.strokeStyle = isPtOutlier ? '#FDE047' : '#FFFFFF';
      ctx.lineWidth = isPtOutlier ? 2.5 : 2;
      ctx.beginPath();
      ctx.arc(sx, sy1, hoverIdx === idx || isPtOutlier ? 7.5 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // X-axis tick value
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText(String(p.x), sx - 10, padTop + plotH + 18);
    });

    // Regression HUD Box on Canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(padLeft + 14, padTop + 10, 295, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10B981';
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.fillText(
      `${regression.modelLabel.toUpperCase()}: ${regression.equationString}`,
      padLeft + 24,
      padTop + 30
    );
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(
      `Koefisien Determinasi R² = ${regression.rSquared.toFixed(4)}${excludeOutliers ? ' (Outlier Difilter)' : ''}`,
      padLeft + 24,
      padTop + 48
    );

    // Hovered Point Readout Box
    if (hoverIdx !== null && pts[hoverIdx]) {
      const hp = pts[hoverIdx];
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(width - padRight - 220, padTop + 10, 206, 48, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText(
        `INSPEKSI: ${hp.label} (X=${hp.x})`,
        width - padRight - 210,
        padTop + 28
      );
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(
        `Y1: ${hp.y1}  |  Y2: ${hp.y2}`,
        width - padRight - 210,
        padTop + 46
      );
    }
  }, [activeConfig, regression, hoverIdx]);

  const handleExportPNG = () => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    labSound.playClick();
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.setAttribute(
      'download',
      `simulab-grafik-regresi-${selectedDatasetKey}.png`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onExportChartNotification('PNG');
  };

  const buildCurrentAcademicReportData = (): AcademicReportData => {
    const firstRec = records[0];
    const expTitle = firstRec ? firstRec.experimentTitle : activeConfig.title;
    const domainStr = firstRec ? firstRec.domain : 'Sains Terintegrasi';
    const chartDataUrl = chartCanvasRef.current
      ? chartCanvasRef.current.toDataURL('image/png')
      : undefined;

    const diagnosticItems = gradedState
      ? WORKSHEET_QUESTIONS.map((q) => {
          const r = gradedState.results[q.id];
          return {
            title: `${q.domain} (${q.topic})`,
            badge: r?.diagnosticBadge || 'Belum Dinilai',
            feedback: r?.diagnosticFeedback || '-',
          };
        })
      : undefined;

    return {
      experimentTitle: expTitle,
      studentName: activeStudentName,
      groupId: activeGroupId,
      tier: 'SMA',
      dateStr: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      timeStr: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      domain: domainStr,
      records: records,
      chartImageDataUrl: chartDataUrl,
      regressionSummary: regression
        ? {
            slope: regression.slopeM,
            intercept: regression.interceptC,
            rSquared: regression.rSquared,
            formula: regression.equationString,
            modelLabel: regression.modelLabel,
            equationString: regression.equationString,
            expectedSlopeMeaning: 'Parameter Kurva Terukur dari Sebaran Data',
          }
        : undefined,
      outlierSummary: {
        outlierCount: outlierAnalysis.outliers.length,
        rSquaredRaw: outlierAnalysis.rSquaredRaw,
        rSquaredClean: outlierAnalysis.rSquaredClean,
        excludedOutliers: excludeOutliers,
      },
      worksheetScore: gradedState
        ? {
            score: gradedState.totalScore,
            correctCount: gradedState.correctCount,
            totalCount: WORKSHEET_QUESTIONS.length,
            diagnosticItems,
          }
        : undefined,
      hypothesisSummary: hypothesisNote
        ? {
            independentVar: hypothesisNote.independentVar,
            dependentVar: hypothesisNote.dependentVar,
            hypothesisText: hypothesisNote.hypothesisText,
            reflectionText: hypothesisNote.reflectionText,
          }
        : undefined,
      discussionNotes: `Grafik data analitik (${regression.modelLabel}) menunjukkan korelasi ${regression.rSquared > 0.85 ? 'sangat kuat' : 'moderat'} dengan persamaan ${regression.equationString} (R² = ${regression.rSquared.toFixed(4)}).`,
      conclusionNotes: `Praktikum berhasil mengumpulkan data kuantitatif, mengevaluasi ketidakpastian instrumen serta deteksi outlier, dan memverifikasi hukum sains yang diuji.`,
    };
  };

  const handlePrintAcademicReport = () => {
    labSound.playClick();
    const reportPayload = buildCurrentAcademicReportData();
    setReportModalData(reportPayload);
  };

  const handlePrintPDFReport = () => {
    labSound.playClick();
    onExportChartNotification('PDF');
    const reportPayload = buildCurrentAcademicReportData();
    setReportModalData(reportPayload);
    openPrintableAcademicReport(reportPayload);
  };

  const handleCheckWorksheet = (e: React.FormEvent) => {
    e.preventDefault();
    labSound.playRecordSuccess();
    const res = gradeWorksheetAnswers(answers);
    setGradedState(res);
    onSubmitQuizScore(res.totalScore, res.correctCount);
  };

  return (
    <div className="space-y-5">
      {/* Step 3 Header & Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold">
            03. Tahap Analisis Kuantitatif, Komparasi Data &amp; Evaluasi LKS
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Analisis Grafik Regresi Linier &amp; Lembar Kerja Siswa (LKS)
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setShowHypothesisDock((v) => !v);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              showHypothesisDock
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Catatan Hipotesis</span>
          </button>

          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setShowCompareDock((v) => !v);
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              showCompareDock
                ? 'bg-sky-600 text-white border-sky-500 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Bandingkan 2 Percobaan (Diff)</span>
          </button>

          {onBackToLab && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToLab();
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              ← Kembali ke Simulasi 3D
            </button>
          )}
          {onProceedToReport && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onProceedToReport();
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Lanjut ke Tahap 4: Laporan &amp; Kolaborasi →
            </button>
          )}
        </div>
      </div>

      {/* Expandable Hypothesis Scratchpad or Side-by-Side Trial Comparator */}
      {(showHypothesisDock || showCompareDock) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {showHypothesisDock && hypothesisNote && onChangeHypothesisNote && (
            <HypothesisScratchpadCard
              moduleTitle={activeConfig.title}
              note={hypothesisNote}
              onChangeNote={onChangeHypothesisNote}
              records={records}
              onClose={() => setShowHypothesisDock(false)}
            />
          )}
          {showCompareDock && (
            <div className={showHypothesisDock ? '' : 'lg:col-span-2'}>
              <ExperimentTrialComparePanel
                records={records}
                onClose={() => setShowCompareDock(false)}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive Multi-Axis Chart & Automatic Linear Regression + PNG/PDF Export */}
        <div className="lg:col-span-7 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Grafik Interaktif Multi-Sumbu &amp; Regresi Linier Otomatis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Memplot kurva Sumbu-Y1 (Biru), Sumbu-Y2 (Amber), dan garis regresi Least-Squares (Hijau Putus-putus)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintAcademicReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Cetak Laporan Resmi Praktikum
              </button>
              <button
                type="button"
                onClick={handleExportPNG}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImageDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Unduh Grafik PNG
              </button>
              <button
                type="button"
                onClick={handlePrintPDFReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak PDF
              </button>
            </div>
          </div>

          {/* Dataset Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedDatasetKey('newton-force-acc');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedDatasetKey === 'newton-force-acc'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Fisika: Gaya vs Percepatan
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedDatasetKey('hooke-spring');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedDatasetKey === 'hooke-spring'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Fisika: Pegas Hooke
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedDatasetKey('thermo-gibbs');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedDatasetKey === 'thermo-gibbs'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Kimia: Suhu vs ΔG &amp; Laju
              </button>
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setSelectedDatasetKey('kepler-third-law');
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedDatasetKey === 'kepler-third-law'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Astronomi: Hukum III Kepler (a³ vs T²)
              </button>
              {customRecordPoints.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setSelectedDatasetKey('custom-records');
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDatasetKey === 'custom-records'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Data Rekaman Log ({customRecordPoints.length})
                </button>
              )}
            </div>

            {/* Curve Model Selector & Formula Calculator Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/70 dark:border-slate-700">
                {(
                  [
                    { id: 'linear', label: 'Linier OLS' },
                    { id: 'quadratic', label: 'Kuadratik (Orde-2)' },
                    { id: 'exponential', label: 'Eksponensial' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setCurveModel(m.id);
                    }}
                    className={`px-2 py-1 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer ${
                      curveModel === m.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <canvas
              ref={chartCanvasRef}
              data-testid="multi-axis-regression-canvas"
              width={720}
              height={280}
              onPointerMove={handleCanvasPointerMove}
              onPointerLeave={() => {
                setHoverIdx(null);
                setTooltipPos(null);
              }}
              className="w-full h-[260px] sm:h-[280px] block cursor-crosshair"
            />

            {/* Floating Glassmorphic HTML Tooltip on Mouse Hover */}
            <AnimatePresence>
              {hoverIdx !== null && activeConfig.points[hoverIdx] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 4 }}
                  transition={{ duration: 0.14 }}
                  style={{
                    left: tooltipPos ? `${tooltipPos.x}px` : 'auto',
                    top: tooltipPos ? `${tooltipPos.y}px` : '12px',
                    right: tooltipPos ? 'auto' : '12px',
                  }}
                  className="pointer-events-none absolute z-20 rounded-xl border border-sky-400/50 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl"
                >
                  <div className="flex items-center justify-between gap-3 font-mono text-[11px] font-bold text-sky-400">
                    <span>Uji #{hoverIdx + 1} · {activeConfig.points[hoverIdx].label}</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                      X = {activeConfig.points[hoverIdx].x}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
                    <div className="text-slate-300">
                      Y1: <strong className="text-white">{activeConfig.points[hoverIdx].y1}</strong>
                    </div>
                    <div className="text-amber-300">
                      Y2: <strong className="text-white">{activeConfig.points[hoverIdx].y2}</strong>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Regression Statistical Summary Strip + R² CircularGaugeMeter Ring */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 items-stretch">
            <div className="md:col-span-4 flex items-center justify-center">
              <CircularGaugeMeter
                label={`Linearitas R² (${regression.rSquared.toFixed(4)})`}
                value={regression.rSquared * 100}
                min={0}
                max={100}
                unit="%"
                precision={1}
                color={regression.rSquared >= 0.95 ? '#10B981' : '#0EA5E9'}
                badgeText={regression.rSquared >= 0.95 ? 'Sangat Presisi!' : undefined}
              />
            </div>

            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Persamaan Regresi Linier
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {regression.equationString}
                </div>
                {regression.rSquared >= 0.95 && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-3 h-3" /> Sangat Presisi! (R² ≥ 0.95)
                  </span>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Rata-Rata (Mean X / Y1)
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                  {regression.meanX} / {regression.meanY}
                </div>
                <span className="mt-1.5 text-[11px] font-mono text-slate-400">
                  Gradien m = {regression.slopeM}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Simpangan Baku (σ_Y1)
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                  ±{regression.stdDevY}
                </div>
                <span className="mt-1.5 text-[11px] font-mono text-slate-400">
                  Intersep c = {regression.interceptC}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Point Inspection Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium">Titik Pengamatan:</span>
            {activeConfig.points.map((pt, i) => (
              <button
                key={pt.label}
                type="button"
                onMouseEnter={() => {
                  setHoverIdx(i);
                  setTooltipPos(null);
                }}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => {
                  labSound.playStep();
                  setHoverIdx(i);
                }}
                className={`px-2 py-1 font-mono rounded border transition-colors cursor-pointer ${
                  hoverIdx === i
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-600 text-sky-900 dark:text-sky-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                ({pt.x}, Y1:{pt.y1}, Y2:{pt.y2})
              </button>
            ))}
          </div>

          {/* Progressive Disclosure Accordions: Outlier Detector & Uncertainty Calculator */}
          <div className="space-y-2.5 pt-2">
            <CollapsibleLabSection
              title="Deteksi & Filter Outlier Residual Otomatis"
              subtitle="Identifikasi titik data anomali (|Z| > 1.8σ) dan bandingkan R² Mentah vs Bersih"
              statusText={
                outlierAnalysis.outliers.length > 0
                  ? `${outlierAnalysis.outliers.length} Outlier Terdeteksi`
                  : '0 Outlier (Bersih)'
              }
              defaultOpen={outlierAnalysis.outliers.length > 0}
              accentColor={outlierAnalysis.outliers.length > 0 ? '#f43f5e' : '#10b981'}
            >
              <div className="pt-2 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        outlierAnalysis.outliers.length > 0
                          ? 'text-rose-500'
                          : 'text-emerald-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        Status Sebaran Residual:{' '}
                        {outlierAnalysis.outliers.length > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-mono">
                            {outlierAnalysis.outliers.length} Titik Pencilan Terdeteksi
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                            Sebaran Bersih (RMSE = ±{outlierAnalysis.rmseResiduals})
                          </span>
                        )}
                      </div>
                      {outlierAnalysis.outliers.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Dampak Filter Outlier: R² Mentah = {outlierAnalysis.rSquaredRaw.toFixed(4)} → R² Bersih = {outlierAnalysis.rSquaredClean.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setSimulateOutlierAnomaly((v) => !v);
                        if (simulateOutlierAnomaly) setExcludeOutliers(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        simulateOutlierAnomaly
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {simulateOutlierAnomaly ? 'Hapus Simulasi Anomali' : 'Uji Deteksi Anomali Outlier'}
                    </button>

                    {outlierAnalysis.outliers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playSuccessChime();
                          setExcludeOutliers((v) => !v);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                          excludeOutliers
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        <span>
                          {excludeOutliers
                            ? 'Outlier Dikecualikan (R² Optimal)'
                            : 'Kecualikan Outlier dari Fitting'}
                        </span>
                      </button>
                    )}

                    {onAskDrLabMu && (
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          const outlierMsg =
                            outlierAnalysis.outliers.length > 0
                              ? `Saya menemukan titik outlier pada X=${outlierAnalysis.outliers[0].x}, Y=${outlierAnalysis.outliers[0].y} (residual ${outlierAnalysis.outliers[0].residual}). Mengapa anomali ini terjadi dan bagaimana pengaruhnya terhadap kemiringan kurva ${regression.equationString}?`
                              : `Bantu saya menginterpretasikan makna fisis gradien kurva ${regression.modelLabel} (${regression.equationString}) dengan R² = ${regression.rSquared.toFixed(4)} pada grafik ${activeConfig.title}.`;
                          onAskDrLabMu(outlierMsg);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600/15 hover:bg-sky-600/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquareShare className="w-3 h-3" />
                        <span>Tanya Dr. LabMu</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleLabSection>

            <CollapsibleLabSection
              title="Kalkulator Rumus & Propagasi Ketidakpastian (Ralat Gauss)"
              subtitle="Hitung nilai hasil beserta rambatan ralat (A ± ΔA dan B ± ΔB)"
              statusText="Z ± ΔZ"
              accentColor="#0ea5e9"
            >
              <div className="pt-2 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end font-mono">
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Nilai A
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={calcValA}
                      onChange={(e) => setCalcValA(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Ralat ±ΔA
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={calcDeltaA}
                      onChange={(e) => setCalcDeltaA(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Operasi Rumus
                    </label>
                    <select
                      value={calcOp}
                      onChange={(e) => setCalcOp(e.target.value as typeof calcOp)}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                    >
                      <option value="divide">Z = A / B</option>
                      <option value="multiply">Z = A × B</option>
                      <option value="add">Z = A + B</option>
                      <option value="power2">Z = A²</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Nilai B
                    </label>
                    <input
                      type="number"
                      step="any"
                      disabled={calcOp === 'power2'}
                      value={calcValB}
                      onChange={(e) => setCalcValB(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      Ralat ±ΔB
                    </label>
                    <input
                      type="number"
                      step="any"
                      disabled={calcOp === 'power2'}
                      value={calcDeltaB}
                      onChange={(e) => setCalcDeltaB(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs tabular-nums disabled:opacity-40"
                    />
                  </div>
                </div>
                {(() => {
                  const a = parseFloat(calcValA) || 0;
                  const da = Math.abs(parseFloat(calcDeltaA) || 0);
                  const b = parseFloat(calcValB) || 1;
                  const db = Math.abs(parseFloat(calcDeltaB) || 0);
                  let z = 0;
                  let dz = 0;
                  if (calcOp === 'add') {
                    z = a + b;
                    dz = Math.sqrt(da * da + db * db);
                  } else if (calcOp === 'multiply') {
                    z = a * b;
                    const rel = Math.sqrt(
                      Math.pow(da / (Math.abs(a) || 1e-9), 2) +
                        Math.pow(db / (Math.abs(b) || 1e-9), 2)
                    );
                    dz = Math.abs(z) * rel;
                  } else if (calcOp === 'divide') {
                    z = a / (b || 1e-9);
                    const rel = Math.sqrt(
                      Math.pow(da / (Math.abs(a) || 1e-9), 2) +
                        Math.pow(db / (Math.abs(b) || 1e-9), 2)
                    );
                    dz = Math.abs(z) * rel;
                  } else {
                    z = a * a;
                    dz = Math.abs(2 * a * da);
                  }
                  const relPct = Math.abs(z) > 1e-9 ? (dz / Math.abs(z)) * 100 : 0;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 font-mono">
                      <span className="text-slate-600 dark:text-slate-300">
                        Hasil Propagasi: <strong className="text-emerald-600 dark:text-emerald-400">{z.toFixed(3)} ± {dz.toFixed(3)}</strong>
                      </span>
                      <span className="text-sky-600 dark:text-sky-400">
                        Ralat Relatif (ΔZ/Z): <strong>{relPct.toFixed(2)}%</strong>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </CollapsibleLabSection>
          </div>

          {/* Animated Recent Recorded Experiment Rows Preview */}
          {records.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Log Pengukuran Terbaru ({records.length} Data Tercatat)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setShowCompareDock((v) => !v);
                  }}
                  className="font-mono text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  {showCompareDock ? 'Tutup Komparator Diff' : 'Bandingkan 2 Data (Diff) →'}
                </button>
              </div>
              <div className="overflow-x-auto max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <th className="py-1.5 px-2.5">ID &amp; Waktu</th>
                      <th className="py-1.5 px-2.5">Eksperimen</th>
                      <th className="py-1.5 px-2.5">Koordinat (X, Y1, Y2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono tabular-nums">
                    {records.slice(0, 5).map((rec) => (
                      <motion.tr
                        key={rec.id}
                        initial={{
                          opacity: 0,
                          x: -16,
                          backgroundColor: 'rgba(14, 165, 233, 0.25)',
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0)',
                        }}
                        transition={{ duration: 0.35 }}
                        className="text-slate-700 dark:text-slate-300"
                      >
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          <span className="font-semibold text-sky-600 dark:text-sky-400">
                            {rec.id}
                          </span>{' '}
                          · {rec.timestamp}
                        </td>
                        <td className="py-1.5 px-2.5 truncate max-w-[180px] font-sans">
                          {rec.experimentTitle}
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          X:{rec.numericX ?? '-'} | Y1:{rec.numericY1 ?? '-'} | Y2:{rec.numericY2 ?? '-'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Interactive Worksheet (LKS) with 3-Tier Scaffolded Hints */}
        <div className="lg:col-span-5 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpenCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Lembar Kerja Siswa (LKS) &amp; Kuis Penilaian Otomatis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Siswa:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {activeStudentName}
                </strong>{' '}
                · <span>{activeGroupId}</span>
              </p>
            </div>
            {gradedState && (
              <div className="text-right font-mono">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Skor LKS
                </span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {gradedState.totalScore}/100
                </span>
              </div>
            )}
          </div>

          {/* Student Comfort Controls: Progress Bar, Domain Filter & Formula Hint Toggle */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/75 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Progres Pengerjaan LKS ({answeredCount}/{WORKSHEET_QUESTIONS.length} Soal Terisi)
              </span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {answeredPct}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                style={{ width: `${answeredPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1">
                {(['Semua', 'Fisika', 'Kimia', 'Astronomi'] as const).map(
                  (dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setLksDomainFilter(dom);
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                        lksDomainFilter === dom
                          ? 'bg-slate-900 dark:bg-sky-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {dom}
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setShowFormulaHints((h) => !h);
                  }}
                  className="text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 underline cursor-pointer"
                >
                  {showFormulaHints
                    ? 'Sembunyikan Rumus'
                    : 'Tampilkan Rumus'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setGradedState(null);
                    if (answeredCount > 0) {
                      setAnswers({});
                    } else {
                      setAnswers({
                        'q-newton-1': '9.0',
                        'q-collision-2': '4.0',
                        'q-thermo-3': '-90.0',
                        'q-titration-4': '20.0',
                        'q-kepler-5': '8.0',
                        'q-exoplanet-6': '1.0',
                      });
                    }
                  }}
                  className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {answeredCount > 0
                    ? 'Reset Latihan Mandiri'
                    : 'Isi Contoh Jawaban'}
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleCheckWorksheet} className="space-y-3.5">
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredQuestions.map((q) => {
                const originalIndex = WORKSHEET_QUESTIONS.findIndex(
                  (item) => item.id === q.id
                );
                const itemResult = gradedState?.results[q.id];
                const activeHintTier = hintLevelByQuestion[q.id] ?? 0;

                return (
                  <div
                    key={q.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-slate-500 dark:text-slate-400 font-mono">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        0{originalIndex + 1}. {q.domain} · {q.topic}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {showFormulaHints && (
                          <span className="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 whitespace-nowrap">
                            Rumus: {q.formulaHint}
                          </span>
                        )}
                        {q.scaffoldedHints && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceHint(q.id)}
                            className={`px-2 py-0.5 rounded font-sans font-semibold text-[10px] border transition-colors flex items-center gap-1 cursor-pointer ${
                              activeHintTier > 0
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                            }`}
                            title="Buka Petunjuk Bertahap (Scaffolded Hints)"
                          >
                            <Lightbulb className="w-3 h-3" />
                            <span>
                              {activeHintTier === 0
                                ? 'Petunjuk (0/3)'
                                : activeHintTier < 3
                                ? `Petunjuk (${activeHintTier}/3) +`
                                : 'Tutup Petunjuk (3/3)'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed comfort-prose">
                      {q.questionText}
                    </p>

                    {/* Progressive 3-Tier Scaffolded Hints Display */}
                    {q.scaffoldedHints && activeHintTier > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        {q.scaffoldedHints.slice(0, activeHintTier).map((hintText, hIdx) => (
                          <div
                            key={hIdx}
                            className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-slate-800 dark:text-amber-100 leading-relaxed flex items-start justify-between gap-2"
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                Tahap {hIdx + 1}:
                              </span>
                              <span>{hintText}</span>
                            </div>
                            {hIdx === 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  labSound.playClick();
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: String(q.correctValue),
                                  }));
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] shrink-0 cursor-pointer"
                              >
                                Isi {q.correctValue}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <label htmlFor={`lks-input-${q.id}`} className="sr-only">
                        Jawaban {q.topic}
                      </label>
                      <input
                        id={`lks-input-${q.id}`}
                        type="number"
                        step="any"
                        value={answers[q.id] ?? ''}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        className="w-36 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {q.unit}
                      </span>
                      {itemResult && (
                        <span
                          className={`ml-auto font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                            itemResult.isCorrect
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {itemResult.isCorrect
                            ? `✓ ${itemResult.diagnosticBadge}`
                            : `✖ ${itemResult.diagnosticBadge} (Acuan: ${itemResult.expected} ${q.unit})`}
                        </span>
                      )}
                    </div>
                    {itemResult && (
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 leading-relaxed">
                        <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          Diagnostik Spesifik: {itemResult.diagnosticFeedback}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                          <strong>Pembahasan:</strong> {itemResult.explanation}
                        </p>
                        {onAskDrLabMu && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                labSound.playClick();
                                onAskDrLabMu(
                                  `Pada soal LKS "${q.topic}" (${q.questionText}), jawaban saya adalah ${answers[q.id] || 'kosong'} ${q.unit} sedangkan kunci teoretisnya ${q.correctValue} ${q.unit}. Diagnostik sistem menyebutkan: "${itemResult.diagnosticBadge}". Bisakah Dr. LabMu membimbing saya memahami langkah perhitungannya secara Sokratik?`
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 cursor-pointer"
                            >
                              <MessageSquareShare className="w-3 h-3" />
                              Bahas Soal Ini bersama Dr. LabMu
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              Periksa Jawaban &amp; Kirim Skor LKS ke Rubrik Pengajar
            </button>
          </form>

          {gradedState && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-md p-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Skor LKS ({gradedState.totalScore}/100 — {gradedState.correctCount}/
                  {gradedState.totalQuestions} benar) telah disinkronkan ke Rubrik Penilaian Pengajar.
                </span>
              </div>
              {onProceedToReport && (
                <button
                  type="button"
                  onClick={() => {
                    labSound.playRecordSuccess();
                    onProceedToReport();
                  }}
                  className="w-full py-2.5 px-4 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Lanjut ke Tahap 4: Unduh Laporan Akhir &amp; Kolaborasi Kelompok →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-App Printable A4 Academic Report Preview Modal */}
      {reportModalData && (
        <AcademicReportPreviewModal
          isOpen={Boolean(reportModalData)}
          onClose={() => setReportModalData(null)}
          reportData={reportModalData}
        />
      )}
    </div>
  );
};
