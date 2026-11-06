import React, { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  ImageDown,
  Printer,
  CheckCircle2,
  BookOpenCheck,
  Calculator,
} from 'lucide-react';
import {
  DataPointMultiAxis,
  ExperimentRecord,
  WORKSHEET_QUESTIONS,
  calculateLinearRegression,
  gradeWorksheetAnswers,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

interface AnalyticsAndWorksheetPanelProps {
  records: ExperimentRecord[];
  activeStudentName: string;
  activeGroupId: string;
  onSubmitQuizScore: (score: number, correctCount: number) => void;
  onExportChartNotification: (format: 'PNG' | 'PDF') => void;
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
}) => {
  const [selectedDatasetKey, setSelectedDatasetKey] =
    useState<string>('newton-force-acc');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Resolve active points (either preset or custom recorded points)
  const customRecordPoints: DataPointMultiAxis[] = records
    .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
    .map((r, i) => ({
      label: r.id,
      x: r.numericX ?? i + 1,
      y1: r.numericY1 ?? 0,
      y2: r.numericY2 ?? 0,
    }));

  const activeConfig =
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

  const regression = calculateLinearRegression(
    activeConfig.points.map((p) => ({ x: p.x, y: p.y1 }))
  );

  // Handle interactive pointer hover over the canvas points
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;

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

    if (closestIdx !== hoverIdx) {
      setHoverIdx(closestIdx);
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

    // 1. Draw OLS Linear Regression Line for Y1 (Dashed Emerald)
    if (regression.predictedPoints.length >= 2) {
      const firstPred = regression.predictedPoints[0];
      const lastPred =
        regression.predictedPoints[regression.predictedPoints.length - 1];
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toScreenX(firstPred.x), toScreenY1(firstPred.yPred));
      ctx.lineTo(toScreenX(lastPred.x), toScreenY1(lastPred.yPred));
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

      // Y1 node
      ctx.fillStyle = hoverIdx === idx ? '#10B981' : '#38BDF8';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy1, hoverIdx === idx ? 7.5 : 6, 0, Math.PI * 2);
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
    ctx.roundRect(padLeft + 14, padTop + 10, 265, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10B981';
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.fillText(
      `REGRESI OLS: ${regression.equationString}`,
      padLeft + 24,
      padTop + 30
    );
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(
      `Koefisien Determinasi R² = ${regression.rSquared.toFixed(4)}`,
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

  const handlePrintPDFReport = () => {
    labSound.playClick();
    onExportChartNotification('PDF');
    window.print();
  };

  const handleCheckWorksheet = (e: React.FormEvent) => {
    e.preventDefault();
    labSound.playRecordSuccess();
    const res = gradeWorksheetAnswers(answers);
    setGradedState(res);
    onSubmitQuizScore(res.totalScore, res.correctCount);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Cols: Interactive Multi-Axis Chart & Automatic Linear Regression + PNG/PDF Export */}
      <div className="lg:col-span-7 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Grafik Interaktif Multi-Sumbu & Regresi Linier Otomatis
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Memplot kurva Sumbu-Y1 (Biru), Sumbu-Y2 (Amber), dan garis regresi Least-Squares (Hijau Putus-putus)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <ImageDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Unduh Grafik PNG
            </button>
            <button
              type="button"
              onClick={handlePrintPDFReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Laporan PDF
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
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedDatasetKey === 'thermo-gibbs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Kimia: Suhu vs ΔG & Laju
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setSelectedDatasetKey('kepler-third-law');
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedDatasetKey === 'custom-records'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Data Rekaman Log ({customRecordPoints.length})
              </button>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <canvas
            ref={chartCanvasRef}
            data-testid="multi-axis-regression-canvas"
            width={720}
            height={280}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={() => setHoverIdx(null)}
            className="w-full h-[260px] sm:h-[280px] block cursor-crosshair"
          />
        </div>

        {/* Regression Statistical Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Persamaan Regresi Linier
            </div>
            <div className="mt-1 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
              {regression.equationString}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Koefisien Determinasi (R²)
            </div>
            <div className="mt-1 font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
              {regression.rSquared.toFixed(4)}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Rata-Rata (Mean X / Y1)
            </div>
            <div className="mt-1 font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
              {regression.meanX} / {regression.meanY}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Simpangan Baku (σ_Y1)
            </div>
            <div className="mt-1 font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
              ±{regression.stdDevY}
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
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={() => {
                labSound.playStep();
                setHoverIdx(i);
              }}
              className={`px-2 py-1 font-mono rounded border transition-colors ${
                hoverIdx === i
                  ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-600 text-sky-900 dark:text-sky-300 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              ({pt.x}, Y1:{pt.y1}, Y2:{pt.y2})
            </button>
          ))}
        </div>
      </div>

      {/* Right 5 Cols: Interactive Worksheet (LKS) & Auto-Graded Science Quiz */}
      <div className="lg:col-span-5 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Lembar Kerja Siswa (LKS) & Kuis Penilaian Otomatis
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
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
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
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setShowFormulaHints((h) => !h);
              }}
              className="text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 underline"
            >
              {showFormulaHints
                ? 'Sembunyikan Petunjuk Rumus'
                : 'Tampilkan Petunjuk Rumus'}
            </button>
          </div>
        </div>

        <form onSubmit={handleCheckWorksheet} className="space-y-3.5">
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {filteredQuestions.map((q) => {
              const originalIndex = WORKSHEET_QUESTIONS.findIndex(
                (item) => item.id === q.id
              );
              const itemResult = gradedState?.results[q.id];
              return (
                <div
                  key={q.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-slate-500 dark:text-slate-400 font-mono">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      0{originalIndex + 1}. {q.domain} · {q.topic}
                    </span>
                    {showFormulaHints && (
                      <span className="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 whitespace-nowrap">
                        Rumus: {q.formulaHint}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                    {q.questionText}
                  </p>
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
                        className={`ml-auto font-mono font-semibold ${
                          itemResult.isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {itemResult.isCorrect
                          ? '● BENAR'
                          : `✖ KUNCI: ${itemResult.expected} ${q.unit}`}
                      </span>
                    )}
                  </div>
                  {itemResult && (
                    <p className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 leading-relaxed">
                      <strong>Pembahasan:</strong> {itemResult.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap"
          >
            <Calculator className="w-4 h-4" />
            Periksa Jawaban & Kirim Skor LKS ke Rubrik Pengajar
          </button>
        </form>

        {gradedState && (
          <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-md p-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Skor LKS ({gradedState.totalScore}/100 — {gradedState.correctCount}/
              {gradedState.totalQuestions} benar) telah disinkronkan ke Rubrik Penilaian Pengajar.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
