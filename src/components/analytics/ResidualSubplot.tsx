import React from 'react';

export interface ResidualSubplotProps {
  svgWidth: number;
  resSvgHeight: number;
  padLeft: number;
  padRight: number;
  resPadTop: number;
  resPadBottom: number;
  maxResBound: number;
  toScreenX: (x: number) => number;
  toResY: (r: number) => number;
  residualStats: {
    rmse: number;
    maxAbsResidual: number;
    residuals: Array<{ x: number; residual: number }>;
  };
  excludedIndices: Set<number>;
  palette: {
    canvasBg: string;
    axisStroke: string;
    labelFill: string;
    critical: string;
    primary: string;
    warning: string;
    pointStroke: string;
  };
}

export const ResidualSubplot: React.FC<ResidualSubplotProps> = ({
  svgWidth,
  resSvgHeight,
  padLeft,
  padRight,
  resPadTop,
  resPadBottom,
  maxResBound,
  toScreenX,
  toResY,
  residualStats,
  excludedIndices,
  palette,
}) => {
  return (
    <div
      data-testid="residual-subplot-panel"
      className="rounded-xl border border-[var(--comfort-border)] p-3.5 space-y-2"
      style={{ backgroundColor: palette.canvasBg }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
        <div className="font-bold text-[var(--comfort-text)]">
          Plot Residual (Δy = y_ukur − ŷ_model)
        </div>
        <div className="font-mono text-[var(--comfort-text-muted)] tabular-nums">
          RMSE = <strong className="text-[var(--comfort-text)]">{residualStats.rmse.toFixed(4)}</strong>
          {' · '}
          Max |Δy| = <strong className="text-[var(--comfort-text)]">{residualStats.maxAbsResidual.toFixed(4)}</strong>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${resSvgHeight}`}
        className="w-full h-36"
        preserveAspectRatio="none"
      >
        {/* Zero reference line */}
        <line
          x1={padLeft}
          y1={toResY(0)}
          x2={svgWidth - padRight}
          y2={toResY(0)}
          stroke={palette.axisStroke}
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        {/* Top/bottom bounds */}
        <text x={padLeft - 8} y={resPadTop + 4} fill={palette.labelFill} fontSize="9.5" fontFamily="monospace" textAnchor="end">
          +{maxResBound.toFixed(2)}
        </text>
        <text x={padLeft - 8} y={toResY(0) + 3} fill={palette.labelFill} fontSize="9.5" fontFamily="monospace" textAnchor="end">
          0.00
        </text>
        <text x={padLeft - 8} y={resSvgHeight - resPadBottom + 3} fill={palette.labelFill} fontSize="9.5" fontFamily="monospace" textAnchor="end">
          -{maxResBound.toFixed(2)}
        </text>
        {/* Residual stems & dots */}
        {residualStats.residuals.map((r, idx) => {
          const sx = toScreenX(r.x);
          const sy0 = toResY(0);
          const syR = toResY(r.residual);
          const isExcluded = excludedIndices.has(idx);
          const color = isExcluded
            ? palette.critical
            : r.residual >= 0
            ? palette.primary
            : palette.warning;
          return (
            <g key={`res-${idx}`}>
              <line x1={sx} y1={sy0} x2={sx} y2={syR} stroke={color} strokeWidth="2" opacity="0.8" />
              <circle cx={sx} cy={syR} r="4.5" fill={color} stroke={palette.pointStroke} strokeWidth="1.5" />
              <text
                x={sx}
                y={resSvgHeight - 10}
                fill={palette.labelFill}
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {r.x.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
