import React, { useState } from 'react';
import {
  Lightbulb,
  Table2,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import { ExperimentRecord, ScienceDomain } from '../../utils/scienceEngine';
import {
  computeDataReadinessStatus,
  filterDomainRecords,
  formatDomainPrimaryMetric,
  getDomainAccentTokens,
} from '../../utils/layoutFlowHelpers';
import { labSound } from '../../utils/soundEngine';

export interface ActiveHypothesisBannerProps {
  hypothesisText?: string;
  domain: ScienceDomain | string;
  onEditPreLab?: () => void;
}

/**
 * Compact Stage 1 -> Stage 2 continuity pill displaying the student's hypothesis
 * while they manipulate parameters on the 3D workbench.
 */
export const ActiveHypothesisBanner: React.FC<ActiveHypothesisBannerProps> = ({
  hypothesisText,
  domain,
  onEditPreLab,
}) => {
  const [expanded, setExpanded] = useState(false);
  const trimmed = (hypothesisText || '').trim();
  const accent = getDomainAccentTokens(domain);

  return (
    <div
      data-testid="active-hypothesis-banner"
      className={`rounded-xl border px-3 py-2 text-xs transition-colors ${accent.badgeBgClass} ${accent.borderClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (trimmed.length > 60) {
              labSound.playClick(620);
              setExpanded((prev) => !prev);
            }
          }}
          className="flex items-start gap-2 text-left min-w-0 flex-1 cursor-pointer"
        >
          <Lightbulb className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${accent.badgeTextClass}`} />
          <div className="min-w-0 flex-1">
            <span className={`block text-2xs font-bold uppercase tracking-wider ${accent.badgeTextClass}`}>
              Hipotesis yang Diuji
            </span>
            {trimmed ? (
              <p
                className={`text-2xs text-[var(--comfort-text)] leading-snug ${
                  expanded ? '' : 'line-clamp-2'
                }`}
              >
                &ldquo;{trimmed}&rdquo;
              </p>
            ) : (
              <p className="text-2xs italic text-[var(--comfort-text-muted)] leading-snug">
                Belum ada dugaan awal tercatat dari Tahap 1.
              </p>
            )}
          </div>
          {trimmed.length > 60 && (
            <span className="text-[var(--comfort-text-muted)] shrink-0 mt-0.5">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          )}
        </button>

        {onEditPreLab && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onEditPreLab();
            }}
            title="Kembali ke Tahap 1 untuk menulis atau memperbarui hipotesis"
            className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export interface LiveObservationFeedCardProps {
  domain: ScienceDomain | string;
  records: ExperimentRecord[];
  totalRecordsCount?: number;
  onDeleteRecord?: (id: string) => void;
  onProceedToAnalysis?: () => void;
}

/**
 * Live mini data log rendered inside Stage 2 sidebar so students get immediate
 * visual confirmation of captured data rows and readiness before moving to Stage 3.
 */
export const LiveObservationFeedCard: React.FC<LiveObservationFeedCardProps> = ({
  domain,
  records,
  totalRecordsCount,
  onDeleteRecord,
  onProceedToAnalysis,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const domainRecords = filterDomainRecords(records, domain);
  const effectiveCount = domainRecords.length > 0 ? domainRecords.length : (totalRecordsCount ?? records.length);
  const readiness = computeDataReadinessStatus(effectiveCount, 3);
  const accent = getDomainAccentTokens(domain);
  const recentRows = domainRecords.slice(-3).reverse();

  return (
    <section
      data-testid="live-observation-feed-card"
      className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-3 space-y-2.5 text-xs"
    >
      {/* Header + Progress Bar */}
      <button
        type="button"
        onClick={() => {
          labSound.playClick(580);
          setCollapsed((prev) => !prev);
        }}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Table2 className={`w-3.5 h-3.5 shrink-0 ${accent.badgeTextClass}`} />
          <span className="font-bold text-[var(--comfort-text)] truncate">
            Log Data Pengamatan Terkini
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`font-mono text-2xs font-bold tabular-nums ${
              readiness.isReady
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {readiness.badgeLabel}
          </span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--comfort-text-muted)]" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--comfort-text-muted)]" />
          )}
        </div>
      </button>

      {/* Progress Track */}
      <div className="w-full h-1.5 rounded-full bg-[var(--comfort-surface-subtle)] overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            readiness.isReady ? 'bg-emerald-500' : accent.progressBarClass
          }`}
          style={{ width: `${readiness.progressPct}%` }}
        />
      </div>

      {!collapsed && (
        <div className="space-y-2 pt-0.5">
          {recentRows.length === 0 ? (
            <p className="text-2xs text-[var(--comfort-text-muted)] leading-relaxed bg-[var(--comfort-surface-subtle)] rounded-lg px-2.5 py-2 border border-dashed border-[var(--comfort-border)]">
              {readiness.guidanceText}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recentRows.map((rec, idx) => (
                <li
                  key={rec.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-2xs font-mono text-[var(--comfort-text-muted)]">
                      <span className="font-bold text-[var(--comfort-text)] tabular-nums">
                        #{domainRecords.length - idx}
                      </span>
                      <span className="truncate">{rec.parametersSummary}</span>
                    </div>
                    <div className="text-2xs font-semibold text-[var(--comfort-text)] truncate">
                      {formatDomainPrimaryMetric(rec)}
                    </div>
                  </div>
                  {onDeleteRecord && (
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick(420);
                        onDeleteRecord(rec.id);
                      }}
                      aria-label="Hapus titik data ini"
                      title="Hapus baris pengamatan ini"
                      className="p-1.5 rounded-md text-[var(--comfort-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {readiness.isReady && onProceedToAnalysis && (
            <button
              type="button"
              data-testid="live-feed-proceed-analysis-btn"
              onClick={() => {
                labSound.playClick(680);
                onProceedToAnalysis();
              }}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Data Cukup ({effectiveCount}) — Lanjut Grafik &amp; LKS</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};
