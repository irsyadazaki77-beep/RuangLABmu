import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import { computeCursorChartPosition } from '../../utils/spatialHudHelpers';

export interface LiveTimeSeriesChartProps {
  primaryLabel?: string;
  primaryUnit?: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
}

const SVG_W = 360;
const SVG_H = 112;
const PAD_L = 32;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 18;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

export const LiveTimeSeriesChart: React.FC<LiveTimeSeriesChartProps> = ({
  primaryLabel = 'Sinyal Utama',
  primaryUnit = '',
  secondaryLabel,
  secondaryUnit = '',
}) => {
  const {
    liveTelemetrySeries,
    timelineMinTime,
    timelineMaxTime,
    timelineCurrentTime,
    isTimeTraveling,
    seekTimelineCursor,
  } = useLabStore(
    useShallow((s) => ({
      liveTelemetrySeries: s.liveTelemetrySeries,
      timelineMinTime: s.timelineMinTime,
      timelineMaxTime: s.timelineMaxTime,
      timelineCurrentTime: s.timelineCurrentTime,
      isTimeTraveling: s.isTimeTraveling,
      seekTimelineCursor: s.seekTimelineCursor,
    }))
  );

  const {
    primaryPath,
    secondaryPath,
    minY,
    maxY,
    minT,
    maxT,
    cursorX,
    latestPoint,
  } = useMemo(() => {
    if (liveTelemetrySeries.length < 2) {
      return {
        primaryPath: '',
        secondaryPath: '',
        minY: 0,
        maxY: 1,
        minT: timelineMinTime,
        maxT: Math.max(timelineMinTime + 1, timelineMaxTime),
        cursorX: PAD_L + PLOT_W,
        latestPoint: liveTelemetrySeries[liveTelemetrySeries.length - 1] ?? null,
      };
    }

    const tMin = liveTelemetrySeries[0].t;
    const tMax = Math.max(tMin + 0.01, liveTelemetrySeries[liveTelemetrySeries.length - 1].t);

    let yMin = Infinity;
    let yMax = -Infinity;
    let hasSecondary = false;
    for (const pt of liveTelemetrySeries) {
      if (Number.isFinite(pt.primary)) {
        yMin = Math.min(yMin, pt.primary);
        yMax = Math.max(yMax, pt.primary);
      }
      if (typeof pt.secondary === 'number' && Number.isFinite(pt.secondary)) {
        hasSecondary = true;
        yMin = Math.min(yMin, pt.secondary);
        yMax = Math.max(yMax, pt.secondary);
      }
    }

    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = 0;
      yMax = 1;
    } else if (Math.abs(yMax - yMin) < 1e-4) {
      yMin -= 1;
      yMax += 1;
    } else {
      const pad = (yMax - yMin) * 0.1;
      yMin -= pad;
      yMax += pad;
    }

    const toX = (t: number) => PAD_L + ((t - tMin) / (tMax - tMin)) * PLOT_W;
    const toY = (v: number) => PAD_T + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

    const pPts = liveTelemetrySeries
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(pt.t).toFixed(1)} ${toY(pt.primary).toFixed(1)}`)
      .join(' ');

    const sPts = hasSecondary
      ? liveTelemetrySeries
          .filter((pt) => typeof pt.secondary === 'number' && Number.isFinite(pt.secondary))
          .map(
            (pt, idx) =>
              `${idx === 0 ? 'M' : 'L'} ${toX(pt.t).toFixed(1)} ${toY(pt.secondary as number).toFixed(1)}`
          )
          .join(' ')
      : '';

    const cX = computeCursorChartPosition(timelineCurrentTime, tMin, tMax, PAD_L, PLOT_W);

    return {
      primaryPath: pPts,
      secondaryPath: sPts,
      minY: yMin,
      maxY: yMax,
      minT: tMin,
      maxT: tMax,
      cursorX: cX,
      latestPoint: liveTelemetrySeries[liveTelemetrySeries.length - 1] ?? null,
    };
  }, [liveTelemetrySeries, timelineCurrentTime, timelineMinTime, timelineMaxTime]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (liveTelemetrySeries.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const clampedPlotX = Math.min(PAD_L + PLOT_W, Math.max(PAD_L, svgX));
    const ratio = (clampedPlotX - PAD_L) / PLOT_W;
    const targetTime = minT + ratio * (maxT - minT);

    let closest = liveTelemetrySeries[0];
    let bestDiff = Math.abs(closest.t - targetTime);
    for (let i = 1; i < liveTelemetrySeries.length; i += 1) {
      const pt = liveTelemetrySeries[i];
      const diff = Math.abs(pt.t - targetTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        closest = pt;
      }
    }
    seekTimelineCursor(closest.cursorIndex);
  };

  return (
    <div
      data-testid="live-timeseries-chart"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-2.5 space-y-2 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-[var(--comfort-text)] truncate">
          <Activity className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <span className="truncate">Grafik Deret Waktu Real-Time</span>
        </div>
        <span className="font-mono text-[10px] font-bold text-sky-500 tabular-nums shrink-0">
          t = {timelineCurrentTime.toFixed(2)}s
        </span>
      </div>

      <div className="rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] overflow-hidden">
        {liveTelemetrySeries.length < 2 ? (
          <div className="h-[96px] flex items-center justify-center text-[11px] font-mono text-[var(--comfort-text-muted)] px-3 text-center">
            Menunggu aliran sampel simulasi 3D...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            onClick={handleSvgClick}
            role="img"
            aria-label="Grafik deret waktu simulasi 3D interaktif — klik untuk memutar ulang waktu"
            className="w-full h-[106px] cursor-crosshair block"
          >
            {/* Horizontal Gridlines */}
            {[0, 0.5, 1].map((frac, idx) => {
              const gy = PAD_T + frac * PLOT_H;
              const yVal = maxY - frac * (maxY - minY);
              return (
                <g key={idx}>
                  <line
                    x1={PAD_L}
                    y1={gy}
                    x2={SVG_W - PAD_R}
                    y2={gy}
                    stroke="currentColor"
                    className="text-slate-300 dark:text-slate-800"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={PAD_L - 4}
                    y={gy + 3}
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {Math.abs(yVal) >= 100 ? yVal.toFixed(0) : yVal.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Time Axis Labels */}
            <text
              x={PAD_L}
              y={SVG_H - 4}
              fill="#64748b"
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="start"
            >
              {minT.toFixed(1)}s
            </text>
            <text
              x={SVG_W - PAD_R}
              y={SVG_H - 4}
              fill="#64748b"
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="end"
            >
              {maxT.toFixed(1)}s
            </text>

            {/* Secondary Signal Path */}
            {secondaryPath && (
              <path
                d={secondaryPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )}

            {/* Primary Signal Path */}
            {primaryPath && (
              <path
                d={primaryPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Synchronized Playhead Cursor */}
            <line
              x1={cursorX}
              y1={PAD_T}
              x2={cursorX}
              y2={PAD_T + PLOT_H}
              stroke={isTimeTraveling ? '#f59e0b' : '#38bdf8'}
              strokeWidth="1.5"
              strokeDasharray={isTimeTraveling ? undefined : '3 2'}
            />
            <circle
              cx={cursorX}
              cy={PAD_T + 3}
              r="3"
              fill={isTimeTraveling ? '#f59e0b' : '#38bdf8'}
            />
          </svg>
        )}
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[var(--comfort-text-muted)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1 truncate">
            <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
            <span className="truncate">{primaryLabel}:</span>
            <strong className="text-[var(--comfort-text)] tabular-nums">
              {latestPoint ? latestPoint.primary.toFixed(2) : '0.00'}
              {primaryUnit ? ` ${primaryUnit}` : ''}
            </strong>
          </span>
          {secondaryPath && secondaryLabel && (
            <span className="inline-flex items-center gap-1 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{secondaryLabel}:</span>
              <strong className="text-[var(--comfort-text)] tabular-nums">
                {typeof latestPoint?.secondary === 'number'
                  ? latestPoint.secondary.toFixed(2)
                  : '0.00'}
                {secondaryUnit ? ` ${secondaryUnit}` : ''}
              </strong>
            </span>
          )}
        </div>
        <span className="text-[9px] opacity-75">Klik grafik untuk seek</span>
      </div>
    </div>
  );
};
