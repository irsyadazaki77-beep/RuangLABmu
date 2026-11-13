import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  DataPointMultiAxis,
  CurveModelType,
  calculateCurveFitting,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { ScienceGlossaryTerm } from '../ui/ScienceGlossaryTerm';

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
}

export const RegressionChartSection: React.FC<RegressionChartSectionProps> = ({
  datasetTitle,
  xAxisLabel,
  y1AxisLabel,
  points,
  curveModel,
  onChangeCurveModel,
  onAskDrLabMuAboutOutlier,
  poePrediction,
  onAskDrLabMuAboutPoe,
}) => {
  // Set of point indices excluded as outliers
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Toggle outlier status of point idx
  const handleToggleOutlier = (idx: number) => {
    labSound.playClick(idx % 2 === 0 ? 560 : 700);
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

  // Included points used for curve fitting
  const includedPoints = useMemo(() => {
    return points.filter((_, idx) => !excludedIndices.has(idx));
  }, [points, excludedIndices]);

  // Recalculate regression fitting in real time
  const regression = useMemo(() => {
    const ptsForFit = includedPoints.length >= 2 ? includedPoints : points;
    return calculateCurveFitting(
      ptsForFit.map((p) => ({ x: p.x, y: p.y1 })),
      curveModel
    );
  }, [includedPoints, points, curveModel]);

  // SVG coordinate bounds
  const svgWidth = 720;
  const svgHeight = 360;
  const padLeft = 60;
  const padRight = 50;
  const padTop = 35;
  const padBottom = 45;
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

  // Generate regression curve line path
  const regressionPathD = useMemo(() => {
    if (points.length < 2) return '';
    const numSteps = 40;
    const dArr: string[] = [];
    for (let i = 0; i <= numSteps; i++) {
      const curX = minX + (i / numSteps) * (maxX - minX);
      const curY = regression.evaluateAt(curX);
      const sx = toScreenX(curX);
      const sy = toScreenY1(curY);
      if (i === 0) {
        dArr.push(`M ${sx.toFixed(1)} ${sy.toFixed(1)}`);
      } else {
        dArr.push(`L ${sx.toFixed(1)} ${sy.toFixed(1)}`);
      }
    }
    return dArr.join(' ');
  }, [minX, maxX, regression, toScreenX, toScreenY1, points.length]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
              Visualisasi Kurva Regresi Interaktif (SVG)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate pl-9">
            {datasetTitle}
          </p>
        </div>

        {/* Model Selector & R² Readout */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={curveModel}
            onChange={(e) => {
              labSound.playClick();
              onChangeCurveModel(e.target.value as CurveModelType);
            }}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="linear">Model: Linier OLS (y = mx + c)</option>
            <option value="quadratic">Model: Kuadratik (y = ax² + bx + c)</option>
            <option value="exponential">Model: Eksponensial (y = a·e^(bx))</option>
            <option value="power">Model: Hukum Daya (y = a·x^b)</option>
          </select>

          <div className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ScienceGlossaryTerm term="R²" displayLabel="R²" /> =
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                regression.rSquared >= 0.95
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : regression.rSquared >= 0.85
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-amber-500'
              }`}
            >
              {regression.rSquared.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      {/* Regression Equation Badge & Interactive Outlier Guide */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">Persamaan:</span>
          <span className="text-sky-600 dark:text-sky-300 font-bold">{regression.equationString}</span>
          <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
            (<ScienceGlossaryTerm term="Slope/Gradien" />)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-sans">
          <span className="text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>
              Klik titik untuk Kecualikan / Sertakan <ScienceGlossaryTerm term="Outlier" />:
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Solid = Included
          </span>
          <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full border border-rose-500 inline-block" /> Berongga ✕ = Outlier
          </span>
        </div>
      </div>

      {/* Interactive SVG Chart Viewport */}
      <div className="relative w-full aspect-[2/1] min-h-[300px] max-h-[420px] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Horizontal Gridlines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const gy = padTop + (i / 4) * plotH;
            const yVal = maxY1 - (i / 4) * (maxY1 - minY1);
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={svgWidth - padRight}
                  y2={gy}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 8}
                  y={gy + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {yVal.toFixed(1)}
                </text>
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
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={gx}
                  y={svgHeight - padBottom + 16}
                  fill="#64748b"
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
            stroke="#475569"
            strokeWidth="1.5"
          />
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={svgHeight - padBottom}
            stroke="#475569"
            strokeWidth="1.5"
          />

          {/* Axis Labels */}
          <text
            x={padLeft + plotW / 2}
            y={svgHeight - 10}
            fill="#94a3b8"
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
            fill="#94a3b8"
            fontSize="11"
            fontFamily="sans-serif"
            fontWeight="bold"
            textAnchor="middle"
            transform={`rotate(-90, 15, ${padTop + plotH / 2})`}
          >
            {y1AxisLabel}
          </text>

          {/* Regression Curve Line */}
          {regressionPathD && (
            <path
              d={regressionPathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const sx = toScreenX(p.x);
            const sy = toScreenY1(p.y1);
            const isExcluded = excludedIndices.has(idx);
            const isHovered = hoveredPointIdx === idx;

            return (
              <g
                key={`pt-${idx}`}
                className="cursor-pointer transition-transform"
                onClick={() => handleToggleOutlier(idx)}
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
                {/* Hit target circle */}
                <circle cx={sx} cy={sy} r="18" fill="transparent" />

                {/* Point Graphic */}
                {isExcluded ? (
                  // Hollow Circle with Red Cross (Excluded Outlier)
                  <g>
                    <circle
                      cx={sx}
                      cy={sy}
                      r={isHovered ? 8 : 6.5}
                      fill="#0f172a"
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />
                    <line
                      x1={sx - 3.5}
                      y1={sy - 3.5}
                      x2={sx + 3.5}
                      y2={sy + 3.5}
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />
                    <line
                      x1={sx + 3.5}
                      y1={sy - 3.5}
                      x2={sx - 3.5}
                      y2={sy + 3.5}
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />
                  </g>
                ) : (
                  // Solid Circle (Included Data Point)
                  <g>
                    {isHovered && (
                      <circle
                        cx={sx}
                        cy={sy}
                        r="12"
                        fill="#38bdf8"
                        opacity="0.25"
                      />
                    )}
                    <circle
                      cx={sx}
                      cy={sy}
                      r={isHovered ? 7.5 : 5.5}
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* Trial Label text */}
                <text
                  x={sx}
                  y={sy - 12}
                  fill={isExcluded ? '#f43f5e' : '#e2e8f0'}
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
                  stroke="#f59e0b"
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
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={toScreenX(poePrediction.x)}
                y={toScreenY1(poePrediction.y) - 14}
                fill="#fbbf24"
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
            className="absolute pointer-events-none z-30 p-2.5 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl text-[11px] font-mono text-slate-200 transform -translate-x-1/2 -translate-y-full mb-3 space-y-1 min-w-[170px]"
            style={{
              left: `${Math.min(Math.max(tooltipPos.x, 90), svgWidth - 90)}px`,
              top: `${Math.max(tooltipPos.y - 12, 10)}px`,
            }}
          >
            <div className="flex items-center justify-between font-bold text-sky-400 border-b border-slate-800 pb-1">
              <span>{points[hoveredPointIdx].label || `Percobaan #${hoveredPointIdx + 1}`}</span>
              <span className={excludedIndices.has(hoveredPointIdx) ? 'text-rose-400' : 'text-emerald-400'}>
                {excludedIndices.has(hoveredPointIdx) ? 'Outlier (Excluded)' : 'Aktif (Included)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">X: </span>
              <span className="font-bold text-white">{points[hoveredPointIdx].x}</span>
            </div>
            <div>
              <span className="text-slate-400">Y1: </span>
              <span className="font-bold text-white">{points[hoveredPointIdx].y1}</span>
            </div>
            <div className="pt-0.5 border-t border-slate-800 text-[10px]">
              <span className="text-slate-400">Residu Galat (Δy): </span>
              <span
                className={`font-bold ${
                  Math.abs(points[hoveredPointIdx].y1 - regression.evaluateAt(points[hoveredPointIdx].x)) > 2
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {(points[hoveredPointIdx].y1 - regression.evaluateAt(points[hoveredPointIdx].x)).toFixed(3)}
              </span>
            </div>
            <div className="text-[9px] text-slate-400 pt-0.5 italic">
              *Klik titik untuk mengubah status outlier
            </div>
          </div>
        )}
      </div>

      {/* POE Prediction vs Reality Comparison Banner */}
      {poeEvaluation && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border text-xs ${
            poeEvaluation.isAccurate
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
          }`}
        >
          <div className="space-y-0.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>◆ Evaluasi Prediksi POE (Predict–Observe–Explain):</span>
              <span className="font-mono">
                Selisih {poeEvaluation.deviationPct}%
              </span>
            </div>
            <p className="text-[11px] opacity-90">
              Pada X = <strong>{poeEvaluation.predictedX}</strong>, Anda memprediksi Y ={' '}
              <strong>{poeEvaluation.predictedY}</strong>, sedangkan kurva regresi riil 3D menunjukkan Y ≈{' '}
              <strong>{poeEvaluation.actualY}</strong>.{' '}
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
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Bedah Selisih dengan Dr. LabMu →
            </button>
          )}
        </div>
      )}

      {/* Outlier Alert & Dr. LabMu Advice */}
      {excludedIndices.size > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              <strong>{excludedIndices.size} Titik Outlier Dikecualikan:</strong> Nilai R² diperbarui secara otomatis tanpa memperhitungkan galat anomali tersebut.
            </span>
          </div>
          {onAskDrLabMuAboutOutlier && (
            <button
              type="button"
              onClick={onAskDrLabMuAboutOutlier}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold text-[11px] cursor-pointer whitespace-nowrap"
            >
              Konsultasi ke Dr. LabMu →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
