import React from 'react';

export interface StemRadarAxisItem {
  id: string;
  label: string;
  shortLabel: string;
  score: number;
  detail: string;
}

export interface StemRadarGeometry {
  cx: number;
  cy: number;
  gridPolygons: string[];
  dataPolygonPoints: string;
  dataVertices: Array<{
    id: string;
    shortLabel: string;
    score: number;
    x: number;
    y: number;
    axisEndX: number;
    axisEndY: number;
    labelX: number;
    labelY: number;
  }>;
}

export interface StemRadarChartSectionProps {
  radarGeometry: StemRadarGeometry;
  radarAxes: StemRadarAxisItem[];
}

export const StemRadarChartSection: React.FC<StemRadarChartSectionProps> = ({
  radarGeometry,
  radarAxes,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
      {/* Left: SVG Polygon Radar */}
      <div className="lg:col-span-6 rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-4 flex flex-col items-center justify-center">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Peta Kompetensi Praktikum (5 Dimensi)
        </div>
        <svg
          viewBox="0 0 280 265"
          className="w-full max-w-[300px] h-auto overflow-visible"
          data-testid="stem-competency-radar-svg"
          role="img"
          aria-label="Grafik Radar 5 Kompetensi STEM"
        >
          {/* Concentric Web Polygons */}
          {radarGeometry.gridPolygons.map((pts, idx) => (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth={idx === 3 ? 1.2 : 0.75}
              strokeDasharray={idx < 3 ? '2 2' : undefined}
            />
          ))}

          {/* Axis Spokes */}
          {radarGeometry.dataVertices.map((v) => (
            <line
              key={v.id}
              x1={radarGeometry.cx}
              y1={radarGeometry.cy}
              x2={v.axisEndX}
              y2={v.axisEndY}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth={0.9}
            />
          ))}

          {/* Student Score Polygon */}
          <polygon
            points={radarGeometry.dataPolygonPoints}
            fill="rgba(14, 165, 233, 0.24)"
            stroke="#0284c7"
            strokeWidth={2.2}
          />

          {/* Vertex Dots & Axis Labels */}
          {radarGeometry.dataVertices.map((v) => (
            <g key={v.id}>
              <circle
                cx={v.x}
                cy={v.y}
                r={4}
                className="fill-sky-500 stroke-white dark:stroke-slate-900"
                strokeWidth={1.5}
              />
              <text
                x={v.labelX}
                y={v.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9.5}
                className="fill-slate-700 dark:fill-slate-200 font-bold"
              >
                {v.shortLabel} ({v.score})
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Right: 5-Axis Detailed Metric Bars */}
      <div className="lg:col-span-6 space-y-3">
        {radarAxes.map((axis) => (
          <div
            key={axis.id}
            className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-bg)] p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">{axis.label}</span>
              <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {axis.score}/100 · <span className="text-slate-500 font-normal">{axis.detail}</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-300"
                style={{ width: `${axis.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
