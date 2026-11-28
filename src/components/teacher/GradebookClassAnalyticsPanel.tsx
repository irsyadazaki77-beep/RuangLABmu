import React, { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Award,
  Target,
  FileCheck2,
  Download,
  Printer,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  buildFullClassAnalyticsReportCsv,
  type ClassGradebookAnalytics,
} from '../../utils/classAnalyticsEngine';
import type { LabSubmission } from '../../types/submissionTypes';
import { labSound } from '../../utils/soundEngine';
import { apiFetch } from '../../utils/apiClient';
import { Accordion } from '../ui/Accordion';

export interface GradebookClassAnalyticsPanelProps {
  analytics: ClassGradebookAnalytics;
  kkmThreshold: number;
  onChangeKkm: (val: number) => void;
  submissions?: LabSubmission[];
}

export const GradebookClassAnalyticsPanel: React.FC<GradebookClassAnalyticsPanelProps> = ({
  analytics,
  kkmThreshold,
  onChangeKkm,
  submissions = [],
}) => {
  const [exportedFeedback, setExportedFeedback] = useState<string | null>(null);
  const [aiStrategy, setAiStrategy] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const maxBinCount = Math.max(1, ...analytics.histogram.map((b) => b.count));

  // Prioritize lowest-scoring rubric dimensions first so the 2-point preview highlights remedial targets
  const prioritizedDimensions = [...analytics.rubricAverages].sort(
    (a, b) => a.averagePct - b.averagePct
  );
  const previewDimensions = prioritizedDimensions.slice(0, 2);
  const extraDimensions = prioritizedDimensions.slice(2);

  const handleExportFullReportCsv = () => {
    labSound.playSuccessChime();
    const csvStr = buildFullClassAnalyticsReportCsv(submissions, kkmThreshold);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapor-analitik-lengkap-ruanglabmu-kkm${kkmThreshold}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportedFeedback('Rapor Lengkap CSV Diunduh');
    setTimeout(() => setExportedFeedback(null), 2500);
  };

  const handlePrintClassAnalyticsSummary = () => {
    labSound.playClick();
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
    setExportedFeedback('Siap Dicetak');
    setTimeout(() => setExportedFeedback(null), 2200);
  };

  const handleAnalyzeMisconceptionsAi = async () => {
    labSound.playClick(680);
    setIsAnalyzingAi(true);
    try {
      const res = await apiFetch('/api/ai/class-misconceptions', {
        method: 'POST',
        promptTeacherAuthOn401: true,
        authReason: 'Verifikasi sesi guru diperlukan untuk menjalankan analisis strategi AI kelas.',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalSubmissions: analytics.totalSubmissions,
          averageScore: analytics.averageScore,
          passRatePct: analytics.passRatePct,
          weakestCriterionLabel: analytics.weakestCriterion?.label,
          clusters: analytics.misconceptionClusters.map((c) => ({
            title: c.title,
            affectedCount: c.affectedCount,
            affectedPct: c.affectedPct,
            remedialAction: c.remedialAction,
          })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { strategy?: string };
        if (data.strategy) {
          setAiStrategy(data.strategy);
          return;
        }
      }
      setAiStrategy(
        `Ringkasan Lokal: ${analytics.misconceptionClusters.filter((c) => c.affectedCount > 0).length} klaster terdeteksi dengan ketuntasan ${analytics.passRatePct}%. Fokuskan diskusi kelas pada dimensi ${analytics.weakestCriterion?.label || 'akurasi numerik & regresi'}.`
      );
    } catch {
      setAiStrategy(
        `Ringkasan Offline 3T: Tingkat ketuntasan ${analytics.passRatePct}% (rata-rata ${analytics.averageScore}/100). Gunakan fitur Peer Review di header untuk meninjau laporan kelompok berdeviasi tinggi.`
      );
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const renderRubricDimension = (crit: ClassGradebookAnalytics['rubricAverages'][number]) => {
    const isWeakest = analytics.weakestCriterion?.id === crit.id;
    const barColor =
      crit.averagePct >= 80
        ? 'bg-[var(--comfort-success)]'
        : crit.averagePct >= 65
          ? 'bg-[var(--comfort-accent)]'
          : 'bg-[var(--comfort-warning)]';

    return (
      <div key={crit.id} className="space-y-1">
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="font-semibold text-[var(--comfort-text)] truncate">
            {crit.label}
            {isWeakest && (
              <span className="ml-1.5 text-2xs font-mono text-[var(--comfort-warning)]">
                · Terendah
              </span>
            )}
          </span>
          <span className="font-mono text-2xs font-semibold text-[var(--comfort-text)] tabular-nums shrink-0">
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
  };

  return (
    <div
      data-testid="teacher-class-analytics-panel"
      className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--comfort-surface)]"
    >
      {/* Top Bar: KKM Control + Full Report Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--comfort-text)]">
            <BarChart3 className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
            <span>Analitik Distribusi Nilai, Miskonsepsi &amp; Ketuntasan KKM Kelas</span>
          </div>
          <p className="text-xs text-[var(--comfort-text-muted)]">
            Berdasarkan {analytics.totalSubmissions} laporan terfilter ({analytics.gradedCount} sudah dinilai, {analytics.pendingCount} belum dinilai)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
              className="w-24 sm:w-32 accent-[var(--comfort-accent)] cursor-pointer"
            />
            <span
              data-testid="teacher-kkm-value"
              className="font-mono text-sm font-bold text-[var(--comfort-accent)] tabular-nums w-8 text-right"
            >
              {kkmThreshold}
            </span>
          </div>

          <button
            type="button"
            data-testid="export-full-class-report-csv-btn"
            onClick={handleExportFullReportCsv}
            className="px-3.5 py-2 min-h-[38px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs transition-colors"
          >
            {exportedFeedback === 'Rapor Lengkap CSV Diunduh' ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{exportedFeedback}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Ekspor Rapor Lengkap (CSV)</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="print-class-analytics-btn"
            onClick={handlePrintClassAnalyticsSummary}
            className="px-3 py-2 min-h-[38px] rounded-xl bg-[var(--comfort-surface)] hover:opacity-90 text-[var(--comfort-text)] border border-[var(--comfort-border)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" aria-hidden="true" />
            <span>Cetak Ringkasan</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Rata-Rata Skor</span>
            <Award className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-bold text-[var(--comfort-text)] tabular-nums">
              {analytics.averageScore.toFixed(1)}
            </span>
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">/ 100</span>
          </div>
          <div className="mt-1 text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
            Min {analytics.lowestScore} · Maks {analytics.highestScore}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Tuntas KKM (≥ {analytics.kkmThreshold})</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--comfort-success)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              data-testid="analytics-pass-rate"
              className="text-2xl font-mono font-bold text-[var(--comfort-success)] tabular-nums"
            >
              {analytics.passRatePct}%
            </span>
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
              ({analytics.passedCount}/{analytics.totalSubmissions})
            </span>
          </div>
          <div className="mt-1 text-2xs text-[var(--comfort-text-muted)]">
            Siswa mencapai standar ketuntasan
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Perlu Remedial</span>
            <AlertTriangle className="w-4 h-4 text-[var(--comfort-warning)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-bold text-[var(--comfort-warning)] tabular-nums">
              {analytics.remedialCount}
            </span>
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">SISWA</span>
          </div>
          <div className="mt-1 text-2xs text-[var(--comfort-text-muted)]">
            Skor di bawah KKM {analytics.kkmThreshold}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)]">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Antrean Penilaian</span>
            <Target className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-bold text-[var(--comfort-text)] tabular-nums">
              {analytics.pendingCount}
            </span>
            <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">BELUM DINILAI</span>
          </div>
          <div className="mt-1 text-2xs text-[var(--comfort-text-muted)]">
            {analytics.gradedCount} laporan selesai dinilai
          </div>
        </div>
      </div>

      {/* Main Grid: SVG Score Histogram + Progressive-Disclosure Rubric Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* SVG Histogram */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                Histogram Sebaran Nilai Siswa
              </h3>
              <p className="text-2xs text-[var(--comfort-text-muted)]">
                Distribusi 5 rentang skor · Hijau menandakan rentang melampaui/menyentuh KKM ({analytics.kkmThreshold})
              </p>
            </div>
            <div className="flex items-center gap-3 text-2xs font-medium text-[var(--comfort-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--comfort-success)] inline-block" aria-hidden="true" />
                Tuntas KKM
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--comfort-warning)] inline-block" aria-hidden="true" />
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
                const fill = bin.meetsKkm ? '#15803d' : '#b45309';

                return (
                  <g key={bin.id}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={6}
                      fill={fill}
                      fillOpacity={bin.count > 0 ? 0.85 : 0.22}
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

        {/* 5-Criterion Rubric Breakdown with Progressive Disclosure */}
        <div className="lg:col-span-5 space-y-4">
          <Accordion
            title="Capaian Dimensi Rubrik Kelas"
            subtitle="Rata-rata skor per kriteria metode ilmiah pada laporan siswa"
            meta={`${analytics.rubricAverages.length} dimensi`}
            icon={<FileCheck2 className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
            collapsedLabel={`Lihat semua ${analytics.rubricAverages.length} dimensi`}
            expandedLabel="Tampilkan 2 prioritas utama"
            collapsedHint="Menampilkan 2 dimensi prioritas terendah terlebih dahulu"
            expandedHint="Seluruh dimensi rubrik kelas ditampilkan"
            hiddenCount={extraDimensions.length > 0 ? extraDimensions.length : undefined}
            testId="analytics-rubric-dimensions-accordion"
            toggleTestId="analytics-rubric-dimensions-toggle"
            previewClassName="px-4 py-3.5 space-y-3"
            contentClassName="px-4 pb-4 pt-3 border-t border-[var(--comfort-border)] space-y-3"
            preview={
              analytics.rubricAverages.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--comfort-text-muted)]">
                  Belum ada data laporan untuk menghitung rata-rata rubrik.
                </div>
              ) : (
                <>{previewDimensions.map(renderRubricDimension)}</>
              )
            }
          >
            {extraDimensions.length > 0 ? (
              <>{extraDimensions.map(renderRubricDimension)}</>
            ) : null}
          </Accordion>

          {analytics.weakestCriterion && (
            <div className="p-3.5 rounded-xl bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] text-[var(--comfort-text)] space-y-1.5">
              <div className="text-xs font-bold text-[var(--comfort-warning)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Rekomendasi Remedial Kelas</span>
              </div>
              <p className="comfort-report-prose text-xs text-[var(--comfort-text-muted)]">
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

      {/* Pemetaan Miskonsepsi & Diagnostik Ilmiah Kelas */}
      {analytics.misconceptionClusters && analytics.misconceptionClusters.length > 0 && (
        <div
          data-testid="class-misconception-map-card"
          className="p-4 sm:p-5 rounded-2xl bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                Pemetaan Miskonsepsi &amp; Pola Kesalahan Ilmiah Kelas
              </h3>
              <p className="text-2xs text-[var(--comfort-text-muted)]">
                Deteksi otomatis berdasarkan analisis rubrik 5-dimensi, kepadatan sampel, dan deviasi numerik RK4
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                {analytics.misconceptionClusters.filter((c) => c.affectedCount > 0).length} klaster aktif
              </span>
              <button
                type="button"
                data-testid="ai-class-misconception-btn"
                disabled={isAnalyzingAi}
                onClick={() => void handleAnalyzeMisconceptionsAi()}
                className="px-3 py-1.5 rounded-lg comfort-tab-active text-2xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isAnalyzingAi ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isAnalyzingAi ? 'Menganalisis...' : 'Strategi Remedial AI'}</span>
              </button>
            </div>
          </div>

          {aiStrategy && (
            <div
              data-testid="ai-class-misconception-result"
              className="p-3.5 rounded-xl border border-[var(--comfort-accent-border)] bg-[var(--comfort-accent-soft)] text-xs space-y-1 whitespace-pre-line"
            >
              <div className="font-bold text-[var(--comfort-accent)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rekomendasi Strategi Mengajar Dr. LabMu</span>
              </div>
              <p className="text-[var(--comfort-text)] leading-relaxed">{aiStrategy}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.misconceptionClusters.map((cluster) => {
              const severityText =
                cluster.severity === 'high'
                  ? '▲ PRIORITAS TINGGI'
                  : cluster.severity === 'medium'
                  ? '● PERLU PERHATIAN'
                  : '✓ TERKENDALI';
              const severityColor =
                cluster.severity === 'high'
                  ? 'text-[var(--comfort-warning)]'
                  : cluster.severity === 'medium'
                  ? 'text-[var(--comfort-accent)]'
                  : 'text-[var(--comfort-success)]';

              return (
                <div
                  key={cluster.id}
                  data-testid={`misconception-cluster-${cluster.criterionId}`}
                  className="p-3.5 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-[var(--comfort-text)] leading-snug">
                      {cluster.title}
                    </h4>
                    <span className={`font-mono text-2xs font-bold whitespace-nowrap shrink-0 tabular-nums ${severityColor}`}>
                      {severityText}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                    <span>
                      Siswa Terdampak: <strong className="text-[var(--comfort-text)]">{cluster.affectedCount}</strong> / {analytics.totalSubmissions} ({cluster.affectedPct}%)
                    </span>
                  </div>

                  <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed">
                    <strong className="text-[var(--comfort-text)]">Saran Intervensi:</strong> {cluster.remedialAction}
                  </p>

                  {cluster.studentNames.length > 0 && (
                    <div className="pt-1 border-t border-[var(--comfort-border)] text-2xs text-[var(--comfort-text-muted)] truncate">
                      <span>Siswa: </span>
                      <span className="font-semibold text-[var(--comfort-text)]">
                        {cluster.studentNames.join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GradebookClassAnalyticsPanel;
