import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Info,
  Sparkles,
  Download,
  BarChart2,
  GitCommitHorizontal,
  Layers,
  Check,
  Copy,
  RotateCcw,
  Crosshair,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  DataPointMultiAxis,
  CurveModelType,
  calculateCurveFitting,
} from '../../utils/scienceEngine';
import {
  compareCurveModels,
  computeResidualsAndErrorBars,
  detectRegressionOutliersAndDiagnostics,
} from '../../utils/dynamicWorksheetEngine';
import { ResidualSubplot } from './ResidualSubplot';
import { labSound } from '../../utils/soundEngine';
import { ScienceGlossaryTerm } from '../ui/ScienceGlossaryTerm';
import { useUIStore } from '../../stores/useUIStore';
import { getComfortChartPalette } from '../ui/VisualComfortToolbar';

export interface PoePredictionPoint {
  x: number;
  y: number;
  trend?: string;
}

export interface RegressionChartSectionProps {
  datasetTitle: string;
  xAxisLabel: string;
  y1AxisLabel: string;
  y2AxisLabel?: string;
  points: DataPointMultiAxis[];
  curveModel: CurveModelType;
  onChangeCurveModel: (model: CurveModelType) => void;
  onAskDrLabMuAboutOutlier?: () => void;
  poePrediction?: PoePredictionPoint | null;
  onAskDrLabMuAboutPoe?: (deviationPct: number, predictedY: number, actualY: number) => void;
  instrumentNst?: number;
  onExportChart?: (format: 'PNG' | 'SVG') => void;
}

export const RegressionChartSection: React.FC<RegressionChartSectionProps> = ({
  datasetTitle,
  xAxisLabel,
  y1AxisLabel,
  y2AxisLabel,
  points,
  curveModel,
  onChangeCurveModel,
  onAskDrLabMuAboutOutlier,
  poePrediction,
  onAskDrLabMuAboutPoe,
  instrumentNst,
  onExportChart,
}) => {
  const { theme, colorBlindSafe } = useUIStore(
    useShallow((s) => ({
      theme: s.comfortPrefs.theme,
      colorBlindSafe: s.comfortPrefs.colorBlindSafe,
    }))
  );
  const palette = getComfortChartPalette(theme, colorBlindSafe);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [copiedEquation, setCopiedEquation] = useState<boolean>(false);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState<boolean>(false);

  // Advanced Scientific Chart Toggles
  const [showErrorBars, setShowErrorBars] = useState<boolean>(true);
  const [showResidualPlot, setShowResidualPlot] = useState<boolean>(false);
  const [showY2Curve, setShowY2Curve] = useState<boolean>(false);
  const [showBestFitPanel, setShowBestFitPanel] = useState<boolean>(false);

  const handleToggleOutlier = (idx: number) => {
    labSound.playClick(idx % 2 === 0 ? 560 : 700);
    setSelectedPointIdx(idx);
    setExcludedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleResetAllOutliers = () => {
    labSound.playClick();
    setExcludedIndices(new Set());
  };

  const handleCopyEquation = () => {
    labSound.playClick();
    const summaryText = `${regression.equationString} (R² = ${regression.rSquared.toFixed(4)}, RMSE = ${residualStats.rmse.toFixed(3)})`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(summaryText).then(() => {
        setCopiedEquation(true);
        setTimeout(() => setCopiedEquation(false), 1600);
      });
    } else {
      setCopiedEquation(true);
      setTimeout(() => setCopiedEquation(false), 1600);
    }
  };

  const includedPoints = useMemo(() => {
    return points.filter((_, idx) => !excludedIndices.has(idx));
  }, [points, excludedIndices]);

  const activeFitPoints = useMemo(() => {
    return includedPoints.length >= 2 ? includedPoints : points;
  }, [includedPoints, points]);

  const regression = useMemo(() => {
    return calculateCurveFitting(
      activeFitPoints.map((p) => ({ x: p.x, y: p.y1 })),
      curveModel
    );
  }, [activeFitPoints, curveModel]);

  const residualStats = useMemo(
    () => computeResidualsAndErrorBars(points, regression, instrumentNst),
    [points, regression, instrumentNst]
  );

  const modelComparison = useMemo(
    () => compareCurveModels(activeFitPoints.map((p) => ({ x: p.x, y: p.y1 }))),
    [activeFitPoints]
  );

  const curveDiagnostics = useMemo(
    () =>
      detectRegressionOutliersAndDiagnostics(
        points,
        curveModel,
        excludedIndices,
        instrumentNst
      ),
    [points, curveModel, excludedIndices, instrumentNst]
  );

  const handleAutoExcludeDetectedOutliers = () => {
    if (curveDiagnostics.candidateOutlierIndices.length === 0) return;
    labSound.playSuccessChime();
    setExcludedIndices((prev) => {
      const next = new Set(prev);
      for (const idx of curveDiagnostics.candidateOutlierIndices) {
        next.add(idx);
      }
      return next;
    });
  };

  const handleCopyDiagnosticReport = () => {
    labSound.playClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(curveDiagnostics.clipboardReport).then(() => {
        setCopiedDiagnostics(true);
        setTimeout(() => setCopiedDiagnostics(false), 1800);
      });
    } else {
      setCopiedDiagnostics(true);
      setTimeout(() => setCopiedDiagnostics(false), 1800);
    }
  };

  const hasValidY2 = useMemo(() => {
    const y2Vals = points
      .map((p) => p.y2)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (y2Vals.length < 2) return false;
    return Math.max(...y2Vals) - Math.min(...y2Vals) > 1e-6;
  }, [points]);

  // SVG coordinate bounds
  const svgWidth = 720;
  const svgHeight = 360;
  const padLeft = 62;
  const padRight = showY2Curve && hasValidY2 ? 64 : 46;
  const padTop = 34;
  const padBottom = 46;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const hasPoePoint = Boolean(
    poePrediction &&
      Number.isFinite(poePrediction.x) &&
      Number.isFinite(poePrediction.y)
  );

  const minX = useMemo(() => {
    const vals = points.map((p) => p.x);
    if (hasPoePoint && poePrediction) vals.push(poePrediction.x);
    return Math.min(...vals, 0);
  }, [points, hasPoePoint, poePrediction]);

  const maxX = useMemo(() => {
    const vals = points.map((p) => p.x);
    if (hasPoePoint && poePrediction) vals.push(poePrediction.x);
    return Math.max(...vals, minX + 1);
  }, [points, minX, hasPoePoint, poePrediction]);

  const minY1 = useMemo(() => {
    const vals = points.map((p) => p.y1);
    if (hasPoePoint && poePrediction) vals.push(poePrediction.y);
    return Math.min(0, ...vals);
  }, [points, hasPoePoint, poePrediction]);

  const maxY1 = useMemo(() => {
    const vals = points.map((p) => p.y1);
    if (hasPoePoint && poePrediction) vals.push(poePrediction.y);
    return Math.max(...vals, minY1 + 1) * 1.15;
  }, [points, minY1, hasPoePoint, poePrediction]);

  const { minY2, maxY2 } = useMemo(() => {
    if (!hasValidY2) return { minY2: 0, maxY2: 1 };
    const vals = points
      .map((p) => p.y2 ?? 0)
      .filter((v) => Number.isFinite(v));
    const mn = Math.min(0, ...vals);
    const mx = Math.max(...vals, mn + 1) * 1.15;
    return { minY2: mn, maxY2: mx };
  }, [points, hasValidY2]);

  const poeEvaluation = useMemo(() => {
    if (!hasPoePoint || !poePrediction || points.length < 2) return null;
    const expectedActualY = regression.evaluateAt(poePrediction.x);
    const diff = Math.abs(poePrediction.y - expectedActualY);
    const denom = Math.max(1e-6, Math.abs(expectedActualY));
    const deviationPct = expectedActualY !== 0 ? (diff / denom) * 100 : diff * 100;
    return {
      predictedX: poePrediction.x,
      predictedY: poePrediction.y,
      actualY: Number(expectedActualY.toFixed(3)),
      deviationPct: Number(deviationPct.toFixed(1)),
      isAccurate: deviationPct <= 10,
    };
  }, [hasPoePoint, poePrediction, points.length, regression]);

  const toScreenX = (xVal: number) =>
    padLeft + ((xVal - minX) / Math.max(1e-6, maxX - minX)) * plotW;
  const toScreenY1 = (yVal: number) =>
    padTop + plotH - ((yVal - minY1) / Math.max(1e-6, maxY1 - minY1)) * plotH;
  const toScreenY2 = (yVal: number) =>
    padTop + plotH - ((yVal - minY2) / Math.max(1e-6, maxY2 - minY2)) * plotH;

  const regressionPathD = useMemo(() => {
    if (points.length < 2) return '';
    const numSteps = 48;
    const dArr: string[] = [];
    for (let i = 0; i <= numSteps; i++) {
      const curX = minX + (i / numSteps) * (maxX - minX);
      const curY = regression.evaluateAt(curX);
      if (!Number.isFinite(curY)) continue;
      const sx = toScreenX(curX);
      const sy = Math.max(padTop - 20, Math.min(svgHeight - padBottom + 20, toScreenY1(curY)));
      dArr.push(`${dArr.length === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
    }
    return dArr.join(' ');
  }, [minX, maxX, regression, points.length, minY1, maxY1, padRight]);

  const y2PathD = useMemo(() => {
    if (!showY2Curve || !hasValidY2 || points.length < 2) return '';
    const sorted = [...points].sort((a, b) => a.x - b.x);
    return sorted
      .map((p, idx) => {
        const sx = toScreenX(p.x);
        const sy = toScreenY2(p.y2 ?? 0);
        return `${idx === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      })
      .join(' ');
  }, [showY2Curve, hasValidY2, points, minX, maxX, minY2, maxY2, padRight]);

  const handleExportSvgOrPng = (format: 'SVG' | 'PNG') => {
    labSound.playClick();
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(svgWidth * 2));
    clone.setAttribute('height', String(svgHeight * 2));

    // Inject solid background rect for clean export
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', palette.canvasBg);
    clone.insertBefore(bgRect, clone.firstChild);

    const svgStr = serializer.serializeToString(clone);
    const safeSlug = datasetTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);

    if (format === 'SVG') {
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grafik-regresi-${safeSlug}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onExportChart?.('SVG');
      return;
    }

    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgWidth * 2;
      canvas.height = svgHeight * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = palette.canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `grafik-regresi-${safeSlug}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
      onExportChart?.('PNG');
    };
    img.src = url;
  };

  // Residual subplot dimensions
  const resSvgHeight = 148;
  const resPadTop = 22;
  const resPadBottom = 32;
  const resPlotH = resSvgHeight - resPadTop - resPadBottom;
  const maxResBound = Math.max(0.1, residualStats.maxAbsResidual * 1.25);
  const toResY = (resVal: number) =>
    resPadTop + resPlotH / 2 - (resVal / maxResBound) * (resPlotH / 2);

  const inspectedIdx =
    hoveredPointIdx !== null
      ? hoveredPointIdx
      : selectedPointIdx !== null && selectedPointIdx < points.length
      ? selectedPointIdx
      : null;
  const inspectedPoint = inspectedIdx !== null ? points[inspectedIdx] : null;
  const inspectedPredictedY =
    inspectedPoint !== null ? regression.evaluateAt(inspectedPoint.x) : null;
  const inspectedResidual =
    inspectedPoint !== null && inspectedPredictedY !== null
      ? inspectedPoint.y1 - inspectedPredictedY
      : null;

  return (
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg comfort-accent-soft flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-[var(--comfort-text)] truncate">
              Visualisasi Kurva Regresi Ilmiah (SVG)
            </h3>
          </div>
          <p className="text-xs text-[var(--comfort-text-muted)] truncate pl-9">
            {datasetTitle}
          </p>
        </div>

        {/* Model Selector & R² + RMSE Readout */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih Model Regresi"
            value={curveModel}
            onChange={(e) => {
              labSound.playClick();
              onChangeCurveModel(e.target.value as CurveModelType);
            }}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] font-semibold text-[var(--comfort-text)] cursor-pointer"
          >
            <option value="linear">Model: Linier OLS (y = mx + c)</option>
            <option value="quadratic">Model: Kuadratik (y = ax² + bx + c)</option>
            <option value="exponential">Model: Eksponensial (y = a·e^(bx))</option>
            <option value="power">Model: Hukum Daya (y = a·x^b)</option>
          </select>

          <div className="pl-2.5 border-l border-[var(--comfort-border)] flex items-center gap-2 tabular-nums">
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono text-[var(--comfort-text-muted)] flex items-center gap-1">
                <ScienceGlossaryTerm term="R²" displayLabel="R²" /> =
              </span>
              <span
                className={`font-mono text-sm font-bold ${
                  regression.rSquared >= 0.95
                    ? 'text-[var(--comfort-success)]'
                    : regression.rSquared >= 0.85
                    ? 'text-[var(--comfort-accent)]'
                    : 'text-[var(--comfort-warning)]'
                }`}
              >
                {regression.rSquared.toFixed(4)}
              </span>
            </div>
            <span className="text-[var(--comfort-border)]">·</span>
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
              RMSE <strong className="text-[var(--comfort-text)]">{residualStats.rmse.toFixed(3)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Scientific Analysis Toolbar: Residuals, Error Bars, Y2, Auto-Best-Fit, PNG/SVG Export */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="toggle-error-bars-btn"
            onClick={() => {
              labSound.playClick();
              setShowErrorBars((v) => !v);
            }}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              showErrorBars
                ? 'comfort-accent-soft'
                : 'comfort-btn-secondary text-[var(--comfort-text-muted)]'
            }`}
          >
            <GitCommitHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Error Bars (±Δy)</span>
          </button>

          <button
            type="button"
            data-testid="toggle-residual-plot-btn"
            onClick={() => {
              labSound.playClick();
              setShowResidualPlot((v) => !v);
            }}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              showResidualPlot
                ? 'comfort-accent-soft'
                : 'comfort-btn-secondary text-[var(--comfort-text-muted)]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Plot Residual (Δy)</span>
          </button>

          {hasValidY2 && (
            <button
              type="button"
              data-testid="toggle-y2-curve-btn"
              onClick={() => {
                labSound.playClick();
                setShowY2Curve((v) => !v);
              }}
              className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                showY2Curve
                  ? 'comfort-accent-soft'
                  : 'comfort-btn-secondary text-[var(--comfort-text-muted)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Kurva Y2</span>
            </button>
          )}

          <button
            type="button"
            data-testid="toggle-best-fit-btn"
            onClick={() => {
              labSound.playClick();
              setShowBestFitPanel((v) => !v);
            }}
            className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              showBestFitPanel
                ? 'comfort-accent-soft'
                : 'comfort-btn-secondary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
            <span>Bandingkan 4 Model</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="export-chart-png-btn"
            onClick={() => handleExportSvgOrPng('PNG')}
            className="comfort-btn-secondary px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
            <span>PNG</span>
          </button>
          <button
            type="button"
            data-testid="export-chart-svg-btn"
            onClick={() => handleExportSvgOrPng('SVG')}
            className="comfort-btn-secondary px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Auto-Best-Fit 4-Model Comparison Strip */}
      {showBestFitPanel && (
        <div
          data-testid="auto-best-fit-panel"
          className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-3.5 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-[var(--comfort-text)]">
              Perbandingan Otomatis 4 Model Kurva (Auto-Best-Fit)
            </div>
            <button
              type="button"
              data-testid="apply-best-fit-btn"
              onClick={() => {
                labSound.playSuccessChime();
                onChangeCurveModel(modelComparison.bestModel);
              }}
              className="comfort-btn-primary px-3 py-1 rounded-lg text-2xs font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <Check className="w-3 h-3" />
              <span>Terapkan Model Terbaik</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {modelComparison.comparisons.map((item) => {
              const isSelected = curveModel === item.modelType;
              return (
                <button
                  key={item.modelType}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onChangeCurveModel(item.modelType);
                  }}
                  className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                    isSelected
                      ? 'bg-[var(--comfort-surface)] border-[var(--comfort-accent)] ring-1 ring-[var(--comfort-accent-border)]'
                      : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-2xs font-bold text-[var(--comfort-text)]">
                    <span className="truncate">{item.modelLabel}</span>
                    {item.isBest && (
                      <span className="text-2xs font-mono text-[var(--comfort-success)] shrink-0">
                        ★ Terbaik
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-2xs text-[var(--comfort-text-muted)] truncate">
                    {item.equationString}
                  </div>
                  <div className="flex items-center justify-between text-2xs font-mono tabular-nums pt-0.5">
                    <span className="text-[var(--comfort-accent)] font-bold">
                      R² {item.rSquared.toFixed(4)}
                    </span>
                    <span className="text-[var(--comfort-text-muted)]">
                      RMSE {item.rmse.toFixed(3)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Regression Equation Badge & Copy + Interactive Outlier Guide */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--comfort-surface-subtle)] p-3 rounded-xl border border-[var(--comfort-border)] font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--comfort-text-muted)] font-sans font-bold">Persamaan:</span>
          <span className="text-[var(--comfort-accent)] font-bold">{regression.equationString}</span>
          <button
            type="button"
            data-testid="copy-equation-btn"
            onClick={handleCopyEquation}
            title="Salin persamaan regresi & nilai R² ke papan klip"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--comfort-border)] bg-[var(--comfort-surface)] hover:border-[var(--comfort-accent-border)] text-2xs font-sans font-semibold text-[var(--comfort-text)] cursor-pointer transition-colors"
          >
            {copiedEquation ? (
              <>
                <Check className="w-3 h-3 text-[var(--comfort-success)]" aria-hidden="true" />
                <span className="text-[var(--comfort-success)]">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[var(--comfort-text-muted)]" aria-hidden="true" />
                <span>Salin</span>
              </>
            )}
          </button>
          <span className="text-2xs font-sans text-[var(--comfort-text-muted)]">
            (<ScienceGlossaryTerm term="Slope/Gradien" />)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-2xs font-sans">
          <span className="text-[var(--comfort-text-muted)] flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
            <span>
              Klik titik untuk Kecualikan / Sertakan <ScienceGlossaryTerm term="Outlier" />:
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--comfort-text)]">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: palette.primary }}
            />{' '}
            Solid = Included
          </span>
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: palette.critical }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full border inline-block"
              style={{ borderColor: palette.critical }}
            />{' '}
            Berongga ✕ = Outlier
          </span>
        </div>
      </div>

      {/* Automated Curve Diagnostics & 1-Click Outlier Cleaning Panel */}
      <div
        data-testid="regression-diagnostics-banner"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs"
      >
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[var(--comfort-text)]">
              Diagnostik Kualitas Kurva Otomatis
            </span>
            <span className="text-[var(--comfort-border)]" aria-hidden="true">·</span>
            <span
              data-testid="regression-quality-label"
              className={`font-mono text-2xs font-bold tabular-nums ${
                curveDiagnostics.qualityTier === 'high'
                  ? 'text-[var(--comfort-success)]'
                  : curveDiagnostics.qualityTier === 'moderate'
                  ? 'text-[var(--comfort-accent)]'
                  : 'text-[var(--comfort-warning)]'
              }`}
            >
              {curveDiagnostics.qualityLabel}
            </span>
            {curveDiagnostics.candidateOutlierIndices.length > 0 && (
              <>
                <span className="text-[var(--comfort-border)]" aria-hidden="true">·</span>
                <span
                  data-testid="detected-outliers-badge"
                  className="font-mono text-2xs font-bold text-[var(--comfort-warning)] tabular-nums"
                >
                  ✕ {curveDiagnostics.candidateOutlierIndices.length} Kandidat Outlier (
                  {curveDiagnostics.candidateOutlierLabels.join(', ')})
                </span>
              </>
            )}
          </div>
          <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
            {curveDiagnostics.diagnosticSummary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {curveDiagnostics.candidateOutlierIndices.length > 0 && (
            <button
              type="button"
              data-testid="auto-clean-outliers-btn"
              onClick={handleAutoExcludeDetectedOutliers}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-2xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Kecualikan Outlier ({curveDiagnostics.candidateOutlierIndices.length}) · R² →{' '}
                {curveDiagnostics.projectedRSquared.toFixed(4)}
              </span>
            </button>
          )}

          {curveDiagnostics.modelMismatchDetected && (
            <button
              type="button"
              data-testid="apply-recommended-model-btn"
              onClick={() => {
                labSound.playSuccessChime();
                onChangeCurveModel(curveDiagnostics.recommendedModel);
              }}
              className="comfort-btn-primary px-2.5 py-1.5 rounded-lg font-bold text-2xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Gunakan Model Rekomendasi</span>
            </button>
          )}

          <button
            type="button"
            data-testid="copy-diagnostics-report-btn"
            onClick={handleCopyDiagnosticReport}
            title="Salin kesimpulan diagnostik regresi ke papan klip untuk ditempel ke LKS"
            className="comfort-btn-secondary px-2.5 py-1.5 rounded-lg font-semibold text-2xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {copiedDiagnostics ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--comfort-success)]" aria-hidden="true" />
                <span className="text-[var(--comfort-success)]">Diagnostik Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[var(--comfort-text-muted)]" aria-hidden="true" />
                <span>Salin Diagnostik LKS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive SVG Chart Viewport */}
      <div
        className="relative w-full aspect-[2/1] min-h-[300px] max-h-[420px] rounded-xl border border-[var(--comfort-border)] overflow-hidden select-none"
        style={{ backgroundColor: palette.canvasBg }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Horizontal Gridlines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const gy = padTop + (i / 4) * plotH;
            const yVal = maxY1 - (i / 4) * (maxY1 - minY1);
            const y2Val = maxY2 - (i / 4) * (maxY2 - minY2);
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={svgWidth - padRight}
                  y2={gy}
                  stroke={palette.gridStroke}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={gy + 4}
                  fill={palette.labelFill}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {yVal.toFixed(1)}
                </text>
                {showY2Curve && hasValidY2 && (
                  <text
                    x={svgWidth - padRight + 8}
                    y={gy + 4}
                    fill={palette.secondary}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="start"
                  >
                    {y2Val.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Vertical Gridlines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const gx = padLeft + (i / 4) * plotW;
            const xVal = minX + (i / 4) * (maxX - minX);
            return (
              <g key={`vgrid-${i}`}>
                <line
                  x1={gx}
                  y1={padTop}
                  x2={gx}
                  y2={svgHeight - padBottom}
                  stroke={palette.gridStroke}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={gx}
                  y={svgHeight - padBottom + 16}
                  fill={palette.labelFill}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {xVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Axes Lines */}
          <line
            x1={padLeft}
            y1={svgHeight - padBottom}
            x2={svgWidth - padRight}
            y2={svgHeight - padBottom}
            stroke={palette.axisStroke}
            strokeWidth="1.5"
          />
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={svgHeight - padBottom}
            stroke={palette.axisStroke}
            strokeWidth="1.5"
          />
          {showY2Curve && hasValidY2 && (
            <line
              x1={svgWidth - padRight}
              y1={padTop}
              x2={svgWidth - padRight}
              y2={svgHeight - padBottom}
              stroke={palette.secondary}
              strokeWidth="1.25"
              strokeDasharray="3 3"
            />
          )}

          {/* Axis Labels */}
          <text
            x={padLeft + plotW / 2}
            y={svgHeight - 10}
            fill={palette.labelFill}
            fontSize="11"
            fontFamily="sans-serif"
            fontWeight="bold"
            textAnchor="middle"
          >
            {xAxisLabel}
          </text>
          <text
            x={15}
            y={padTop + plotH / 2}
            fill={palette.labelFill}
            fontSize="11"
            fontFamily="sans-serif"
            fontWeight="bold"
            textAnchor="middle"
            transform={`rotate(-90, 15, ${padTop + plotH / 2})`}
          >
            {y1AxisLabel}
          </text>
          {showY2Curve && hasValidY2 && y2AxisLabel && (
            <text
              x={svgWidth - 12}
              y={padTop + plotH / 2}
              fill={palette.secondary}
              fontSize="10.5"
              fontFamily="sans-serif"
              fontWeight="bold"
              textAnchor="middle"
              transform={`rotate(90, ${svgWidth - 12}, ${padTop + plotH / 2})`}
            >
              {y2AxisLabel}
            </text>
          )}

          {/* Secondary Y2 Curve Overlay */}
          {y2PathD && (
            <g>
              <path
                d={y2PathD}
                fill="none"
                stroke={palette.secondary}
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              {points.map((p, idx) => (
                <rect
                  key={`y2-pt-${idx}`}
                  x={toScreenX(p.x) - 3}
                  y={toScreenY2(p.y2 ?? 0) - 3}
                  width="6"
                  height="6"
                  fill={palette.secondary}
                  opacity="0.85"
                />
              ))}
            </g>
          )}

          {/* Regression Curve Line */}
          {regressionPathD && (
            <path
              d={regressionPathD}
              fill="none"
              stroke={palette.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Vertical Error Bars (±Δy) */}
          {showErrorBars &&
            residualStats.residuals.map((r, idx) => {
              const sx = toScreenX(r.x);
              const syTop = Math.max(padTop, toScreenY1(r.y + r.errorBarHalf));
              const syBot = Math.min(svgHeight - padBottom, toScreenY1(r.y - r.errorBarHalf));
              const isExcluded = excludedIndices.has(idx);
              return (
                <g key={`eb-${idx}`} opacity={isExcluded ? 0.35 : 0.78}>
                  <line
                    x1={sx}
                    y1={syTop}
                    x2={sx}
                    y2={syBot}
                    stroke={isExcluded ? palette.critical : palette.primary}
                    strokeWidth="1.4"
                  />
                  <line
                    x1={sx - 4}
                    y1={syTop}
                    x2={sx + 4}
                    y2={syTop}
                    stroke={isExcluded ? palette.critical : palette.primary}
                    strokeWidth="1.4"
                  />
                  <line
                    x1={sx - 4}
                    y1={syBot}
                    x2={sx + 4}
                    y2={syBot}
                    stroke={isExcluded ? palette.critical : palette.primary}
                    strokeWidth="1.4"
                  />
                </g>
              );
            })}

          {/* Live Precision Crosshair Projection Lines for Active/Inspected Point */}
          {inspectedPoint !== null && (
            <g data-testid="regression-crosshair" pointerEvents="none">
              <line
                x1={padLeft}
                y1={toScreenY1(inspectedPoint.y1)}
                x2={toScreenX(inspectedPoint.x)}
                y2={toScreenY1(inspectedPoint.y1)}
                stroke={palette.primary}
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <line
                x1={toScreenX(inspectedPoint.x)}
                y1={toScreenY1(inspectedPoint.y1)}
                x2={toScreenX(inspectedPoint.x)}
                y2={svgHeight - padBottom}
                stroke={palette.primary}
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <circle
                cx={toScreenX(inspectedPoint.x)}
                cy={svgHeight - padBottom}
                r="3"
                fill={palette.primary}
              />
              <circle
                cx={padLeft}
                cy={toScreenY1(inspectedPoint.y1)}
                r="3"
                fill={palette.primary}
              />
            </g>
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const sx = toScreenX(p.x);
            const sy = toScreenY1(p.y1);
            const isExcluded = excludedIndices.has(idx);
            const isHovered = hoveredPointIdx === idx || selectedPointIdx === idx;

            return (
              <g
                key={`pt-${idx}`}
                role="button"
                tabIndex={0}
                aria-label={`${p.label || `Titik ${idx + 1}`}: X=${p.x}, Y=${p.y1}${isExcluded ? ' (Outlier)' : ''}. Tekan Enter untuk ubah status outlier.`}
                className="cursor-pointer transition-transform focus:outline-none"
                onClick={() => handleToggleOutlier(idx)}
                onFocus={() => setSelectedPointIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleOutlier(idx);
                  }
                }}
                onPointerEnter={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (rect) {
                    setTooltipPos({
                      x: (sx / svgWidth) * rect.width,
                      y: (sy / svgHeight) * rect.height,
                    });
                  }
                  setHoveredPointIdx(idx);
                }}
                onPointerLeave={() => {
                  setHoveredPointIdx(null);
                  setTooltipPos(null);
                }}
              >
                <circle cx={sx} cy={sy} r="18" fill="transparent" />

                {isExcluded ? (
                  <g>
                    <circle
                      cx={sx}
                      cy={sy}
                      r={isHovered ? 8 : 6.5}
                      fill={palette.canvasBg}
                      stroke={palette.critical}
                      strokeWidth="2"
                    />
                    <line
                      x1={sx - 3.5}
                      y1={sy - 3.5}
                      x2={sx + 3.5}
                      y2={sy + 3.5}
                      stroke={palette.critical}
                      strokeWidth="2"
                    />
                    <line
                      x1={sx + 3.5}
                      y1={sy - 3.5}
                      x2={sx - 3.5}
                      y2={sy + 3.5}
                      stroke={palette.critical}
                      strokeWidth="2"
                    />
                  </g>
                ) : (
                  <g>
                    {isHovered && (
                      <circle
                        cx={sx}
                        cy={sy}
                        r="12"
                        fill={palette.primary}
                        opacity="0.25"
                      />
                    )}
                    <circle
                      cx={sx}
                      cy={sy}
                      r={isHovered ? 7.5 : 5.5}
                      fill={palette.primary}
                      stroke={palette.pointStroke}
                      strokeWidth="2"
                    />
                  </g>
                )}

                <text
                  x={sx}
                  y={sy - 12}
                  fill={isExcluded ? palette.critical : theme === 'dark' ? '#e2e8f0' : '#1e2530'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {p.label || `Uji ${idx + 1}`}
                </text>
              </g>
            );
          })}

          {/* POE Student Hypothesis Prediction Overlay */}
          {hasPoePoint && poePrediction && (
            <g>
              {points.length >= 2 && (
                <line
                  x1={toScreenX(poePrediction.x)}
                  y1={toScreenY1(poePrediction.y)}
                  x2={toScreenX(poePrediction.x)}
                  y2={toScreenY1(regression.evaluateAt(poePrediction.x))}
                  stroke={palette.warning}
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                />
              )}
              <polygon
                points={`${toScreenX(poePrediction.x)},${toScreenY1(poePrediction.y) - 9} ${
                  toScreenX(poePrediction.x) + 9
                },${toScreenY1(poePrediction.y)} ${toScreenX(poePrediction.x)},${
                  toScreenY1(poePrediction.y) + 9
                } ${toScreenX(poePrediction.x) - 9},${toScreenY1(poePrediction.y)}`}
                fill={palette.warning}
                stroke={palette.pointStroke}
                strokeWidth="2"
              />
              <text
                x={toScreenX(poePrediction.x)}
                y={toScreenY1(poePrediction.y) - 14}
                fill={palette.warning}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                ◆ Prediksi POE ({poePrediction.x}, {poePrediction.y})
              </text>
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPointIdx !== null && tooltipPos && (
          <div
            className="absolute pointer-events-none z-30 p-2.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-xl text-2xs font-mono text-[var(--comfort-text)] transform -translate-x-1/2 -translate-y-full mb-3 space-y-1 min-w-[180px]"
            style={{
              left: `${Math.min(Math.max(tooltipPos.x, 95), svgWidth - 95)}px`,
              top: `${Math.max(tooltipPos.y - 12, 10)}px`,
            }}
          >
            <div className="flex items-center justify-between font-bold border-b border-[var(--comfort-border)] pb-1">
              <span style={{ color: palette.primary }}>
                {points[hoveredPointIdx].label || `Percobaan #${hoveredPointIdx + 1}`}
              </span>
              <span
                style={{
                  color: excludedIndices.has(hoveredPointIdx) ? palette.critical : palette.secondary,
                }}
              >
                {excludedIndices.has(hoveredPointIdx) ? 'Outlier' : 'Aktif'}
              </span>
            </div>
            <div>
              <span className="text-[var(--comfort-text-muted)]">X: </span>
              <span className="font-bold">{points[hoveredPointIdx].x}</span>
            </div>
            <div>
              <span className="text-[var(--comfort-text-muted)]">Y1: </span>
              <span className="font-bold">{points[hoveredPointIdx].y1}</span>
              {showErrorBars && residualStats.residuals[hoveredPointIdx] && (
                <span className="text-[var(--comfort-text-muted)]">
                  {' '}± {residualStats.residuals[hoveredPointIdx].errorBarHalf}
                </span>
              )}
            </div>
            {showY2Curve && hasValidY2 && (
              <div>
                <span className="text-[var(--comfort-text-muted)]">Y2: </span>
                <span className="font-bold" style={{ color: palette.secondary }}>
                  {points[hoveredPointIdx].y2 ?? 0}
                </span>
              </div>
            )}
            <div className="pt-0.5 border-t border-[var(--comfort-border)] text-2xs">
              <span className="text-[var(--comfort-text-muted)]">Residu (Δy): </span>
              <span
                className="font-bold"
                style={{
                  color:
                    Math.abs(points[hoveredPointIdx].y1 - regression.evaluateAt(points[hoveredPointIdx].x)) > 2
                      ? palette.warning
                      : palette.secondary,
                }}
              >
                {(points[hoveredPointIdx].y1 - regression.evaluateAt(points[hoveredPointIdx].x)).toFixed(3)}
              </span>
            </div>
            <div className="text-2xs text-[var(--comfort-text-muted)] pt-0.5">
              *Klik titik untuk mengubah status outlier
            </div>
          </div>
        )}
      </div>

      {/* Touch-Friendly Point Inspection Readout Bar (Zero-Clipping on Mobile & Desktop) */}
      <div
        data-testid="regression-point-inspector"
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-2xs"
      >
        {inspectedPoint !== null && inspectedIdx !== null ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
              <span className="inline-flex items-center gap-1 font-sans font-bold text-[var(--comfort-accent)]">
                <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{inspectedPoint.label || `Titik #${inspectedIdx + 1}`}</span>
              </span>
              <span>
                <span className="text-[var(--comfort-text-muted)]">X: </span>
                <strong className="text-[var(--comfort-text)]">{inspectedPoint.x}</strong>
              </span>
              <span>
                <span className="text-[var(--comfort-text-muted)]">Y₁: </span>
                <strong className="text-[var(--comfort-text)]">{inspectedPoint.y1}</strong>
                {showErrorBars && residualStats.residuals[inspectedIdx] && (
                  <span className="text-[var(--comfort-text-muted)]">
                    {' '}±{residualStats.residuals[inspectedIdx].errorBarHalf}
                  </span>
                )}
              </span>
              {inspectedPredictedY !== null && (
                <span>
                  <span className="text-[var(--comfort-text-muted)]">ŷ: </span>
                  <strong className="text-[var(--comfort-text)]">{inspectedPredictedY.toFixed(3)}</strong>
                </span>
              )}
              {inspectedResidual !== null && (
                <span>
                  <span className="text-[var(--comfort-text-muted)]">Δy: </span>
                  <strong
                    className={
                      Math.abs(inspectedResidual) > 2
                        ? 'text-[var(--comfort-warning)]'
                        : 'text-[var(--comfort-success)]'
                    }
                  >
                    {inspectedResidual >= 0 ? '+' : ''}
                    {inspectedResidual.toFixed(3)}
                  </strong>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleToggleOutlier(inspectedIdx)}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg border font-sans font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                excludedIndices.has(inspectedIdx)
                  ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success-border)] text-[var(--comfort-success)]'
                  : 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)] text-[var(--comfort-warning)]'
              }`}
            >
              {excludedIndices.has(inspectedIdx) ? 'Sertakan Kembali' : 'Tandai Outlier'}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-[var(--comfort-text-muted)]">
            <Crosshair className="w-3.5 h-3.5 shrink-0 text-[var(--comfort-accent)]" aria-hidden="true" />
            <span>Arahkan kursor atau ketuk salah satu titik data pada grafik untuk inspeksi koordinat presisi &amp; status outlier.</span>
          </div>
        )}
      </div>

      {/* Synchronized Residual Subplot (Δy_i = y_i - ŷ_i) */}
      {showResidualPlot && (
        <ResidualSubplot
          svgWidth={svgWidth}
          resSvgHeight={resSvgHeight}
          padLeft={padLeft}
          padRight={padRight}
          resPadTop={resPadTop}
          resPadBottom={resPadBottom}
          maxResBound={maxResBound}
          toScreenX={toScreenX}
          toResY={toResY}
          residualStats={residualStats}
          excludedIndices={excludedIndices}
          palette={palette}
        />
      )}

      {/* POE Prediction vs Reality Comparison Banner */}
      {poeEvaluation && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border text-xs ${
            poeEvaluation.isAccurate
              ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success-border)] text-[var(--comfort-text)]'
              : 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)] text-[var(--comfort-text)]'
          }`}
        >
          <div className="space-y-0.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>◆ Evaluasi Prediksi POE (Predict–Observe–Explain):</span>
              <span
                className={`font-mono ${
                  poeEvaluation.isAccurate
                    ? 'text-[var(--comfort-success)]'
                    : 'text-[var(--comfort-warning)]'
                }`}
              >
                Selisih {poeEvaluation.deviationPct}%
              </span>
            </div>
            <p className="text-2xs text-[var(--comfort-text-muted)]">
              Pada X = <strong className="text-[var(--comfort-text)]">{poeEvaluation.predictedX}</strong>, Anda memprediksi Y ={' '}
              <strong className="text-[var(--comfort-text)]">{poeEvaluation.predictedY}</strong>, sedangkan kurva regresi riil 3D menunjukkan Y ≈{' '}
              <strong className="text-[var(--comfort-text)]">{poeEvaluation.actualY}</strong>.{' '}
              {poeEvaluation.isAccurate
                ? 'Intuisi dan perhitungan hipotesis Anda sangat akurat!'
                : 'Terdapat selisih signifikan antara intuisi awal dengan kenyataan eksperimen—tinjau ulang faktor gaya/variabel non-liniernya.'}
            </p>
          </div>
          {!poeEvaluation.isAccurate && onAskDrLabMuAboutPoe && (
            <button
              type="button"
              onClick={() =>
                onAskDrLabMuAboutPoe(
                  poeEvaluation.deviationPct,
                  poeEvaluation.predictedY,
                  poeEvaluation.actualY
                )
              }
              className="comfort-btn-primary px-3 py-1.5 rounded-lg font-bold text-2xs cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Bedah Selisih dengan Dr. LabMu →
            </button>
          )}
        </div>
      )}

      {/* Outlier Alert, Quick Restore & Dr. LabMu Advice */}
      {excludedIndices.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] text-[var(--comfort-text)] text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--comfort-warning)]" />
            <span>
              <strong>{excludedIndices.size} Titik Outlier Dikecualikan:</strong> Nilai R² diperbarui secara otomatis tanpa memperhitungkan galat anomali tersebut.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="restore-all-outliers-btn"
              onClick={handleResetAllOutliers}
              className="comfort-btn-secondary px-2.5 py-1 rounded-lg font-semibold text-2xs cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Pulihkan Semua Titik</span>
            </button>
            {onAskDrLabMuAboutOutlier && (
              <button
                type="button"
                onClick={onAskDrLabMuAboutOutlier}
                className="comfort-btn-secondary px-2.5 py-1 rounded-lg font-bold text-2xs cursor-pointer whitespace-nowrap"
              >
                Konsultasi ke Dr. LabMu →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
