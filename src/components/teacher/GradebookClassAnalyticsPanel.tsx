import React from 'react';
import { BarChart3, CheckCircle2, AlertTriangle, Award, Target } from 'lucide-react';
import type { ClassGradebookAnalytics } from '../../utils/classAnalyticsEngine';

export interface GradebookClassAnalyticsPanelProps {
  analytics: ClassGradebookAnalytics;
  kkmThreshold: number;
  onChangeKkm: (val: number) => void;
}

export const GradebookClassAnalyticsPanel: React.FC<GradebookClassAnalyticsPanelProps> = ({
  analytics,
  kkmThreshold,
  onChangeKkm,
}) => {
  const maxBinCount = Math.max(1, ...analytics.histogram.map((b) => b.count));

  return (
    <div
      data-testid="teacher-class-analytics-panel"
      className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--comfort-surface)]"
    >
      {/* Top Bar: KKM Control + Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
            <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
            <span>Analitik Distribusi Nilai &amp; Ketuntasan KKM Kelas</span>
          </div>
          <p className="text-xs text-[var(--comfort-text-muted)]">
            Berdasarkan {analytics.totalSubmissions} laporan terfilter ({analytics.gradedCount} sudah dinilai, {analytics.pendingCount} belum dinilai)
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[var(--comfort-surface)] px-3.5 py-2 rounded-xl border border-[var(--comfort-border)]">
          <label
            htmlFor="teacher-kkm-slider"
            className="text-xs font-semibold text-[var(--comfort-text)] whitespace-nowrap"
          >
            Batas KKM:
          </label>
          <input
            id="teacher-kkm-slider"
            data-testid="teacher-kkm-slider"
            type="range"
            min={50}
            max={95}
            step={5}
            value={kkmThreshold}
            onChange={(e) => onChangeKkm(Number(e.target.value))}
            className="w-28 sm:w-36 accent-sky-600 cursor-pointer"
          />
          <span
            data-testid="teacher-kkm-value"
            className="font-mono text-sm font-bold text-sky-700 dark:text-sky-300 tabular-nums w-8 text-right"
          >
            {kkmThreshold}
          </span>
        </div>
      </div>

      {/* 4-Column KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Rata-Rata Skor</span>
            <Award className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-bold text-[var(--comfort-text)] tabular-nums">
              {analytics.averageScore.toFixed(1)}
            </span>
            <span className="text-[11px] font-mono text-[var(--comfort-text-muted)]">/ 100</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
            Min {analytics.lowestScore} · Maks {analytics.highestScore}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Tuntas KKM (≥ {analytics.kkmThreshold})</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              data-testid="analytics-pass-rate"
              className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
            >
              {analytics.passRatePct}%
            </span>
            <span className="text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
              ({analytics.passedCount}/{analytics.totalSubmissions})
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--comfort-text-muted)]">
            Siswa mencapai standar ketuntasan
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Perlu Remedial</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {analytics.remedialCount}
            </span>
            <span className="text-[11px] font-mono text-[var(--comfort-text-muted)]">SISWA</span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--comfort-text-muted)]">
            Skor di bawah KKM {analytics.kkmThreshold}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Antrean Penilaian</span>
            <Target className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-bold text-[var(--comfort-text)] tabular-nums">
              {analytics.pendingCount}
            </span>
            <span className="text-[11px] font-mono text-[var(--comfort-text-muted)]">BELUM DINILAI</span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--comfort-text-muted)]">
            {analytics.gradedCount} laporan selesai dinilai
          </div>
        </div>
      </div>

      {/* Main Grid: SVG Score Histogram + 5-Criterion Rubric Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SVG Histogram */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                Histogram Sebaran Nilai Siswa
              </h3>
              <p className="text-[11px] text-[var(--comfort-text-muted)]">
                Distribusi 5 rentang skor · Hijau menandakan rentang melampaui/menyentuh KKM ({analytics.kkmThreshold})
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--comfort-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" aria-hidden="true" />
                Tuntas KKM
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" aria-hidden="true" />
                Di Bawah KKM
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 480 210"
              role="img"
              aria-label="Histogram sebaran nilai siswa"
              className="w-full h-52 min-w-[340px]"
            >
              {/* Horizontal grid lines with unique integer ticks */}
              {(() => {
                const rawTicks =
                  maxBinCount <= 4
                    ? Array.from({ length: maxBinCount + 1 }, (_, i) => i)
                    : [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(r * maxBinCount));
                const uniqueTicks = Array.from(new Set(rawTicks));
                return uniqueTicks.map((tickVal, idx) => {
                  const ratio = maxBinCount > 0 ? tickVal / maxBinCount : 0;
                  const y = 170 - ratio * 130;
                  return (
                    <g key={tickVal}>
                      <line
                        x1={36}
                        y1={y}
                        x2={464}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity={0.12}
                        strokeDasharray={idx === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={28}
                        y={y + 4}
                        textAnchor="end"
                        fontSize={10}
                        fill="currentColor"
                        opacity={0.55}
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        {tickVal}
                      </text>
                    </g>
                  );
                });
              })()}

              {/* Bars */}
              {analytics.histogram.map((bin, i) => {
                const slotWidth = 420 / analytics.histogram.length;
                const barWidth = 48;
                const x = 44 + i * slotWidth + (slotWidth - barWidth) / 2;
                const barHeight = Math.max(bin.count > 0 ? 6 : 2, (bin.count / maxBinCount) * 130);
                const y = 170 - barHeight;
                const fill = bin.meetsKkm ? '#10b981' : '#f59e0b';

                return (
                  <g key={bin.id}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={6}
                      fill={fill}
                      fillOpacity={bin.count > 0 ? 0.88 : 0.22}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill="currentColor"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {bin.count} ({bin.pct}%)
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y={190}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill="currentColor"
                      opacity={0.8}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {bin.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 5-Criterion Rubric Breakdown */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                Capaian 5 Dimensi Rubrik Kelas
              </h3>
              <p className="text-[11px] text-[var(--comfort-text-muted)]">
                Rata-rata skor per kriteria metode ilmiah pada laporan siswa
              </p>
            </div>

            {analytics.rubricAverages.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--comfort-text-muted)]">
                Belum ada data laporan untuk menghitung rata-rata rubrik.
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.rubricAverages.map((crit) => {
                  const isWeakest = analytics.weakestCriterion?.id === crit.id;
                  const barColor =
                    crit.averagePct >= 80
                      ? 'bg-emerald-500'
                      : crit.averagePct >= 65
                      ? 'bg-sky-500'
                      : 'bg-amber-500';
                  return (
                    <div key={crit.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-semibold text-[var(--comfort-text)] truncate">
                          {crit.label}
                          {isWeakest && (
                            <span className="ml-1.5 text-[10px] font-mono text-amber-700 dark:text-amber-400">
                              · Terendah
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[var(--comfort-text)] tabular-nums shrink-0">
                          {crit.averagePoints}/{crit.maxPoints} ({crit.averagePct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${crit.averagePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {analytics.weakestCriterion && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-[var(--comfort-text)] space-y-1">
              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Rekomendasi Remedial Kelas</span>
              </div>
              <p className="text-[11px] text-[var(--comfort-text-muted)] leading-relaxed">
                Dimensi <strong className="text-[var(--comfort-text)]">{analytics.weakestCriterion.label}</strong> memiliki rata-rata terendah (
                <span className="font-mono font-semibold tabular-nums">
                  {analytics.weakestCriterion.averagePct}%
                </span>
                ). Pertimbangkan sesi penguatan singkat sebelum praktikum berikutnya.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradebookClassAnalyticsPanel;
