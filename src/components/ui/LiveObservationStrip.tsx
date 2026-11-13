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
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${accent.badgeTextClass}`}>
              Hipotesis yang Diuji
            </span>
            {trimmed ? (
              <p
                className={`text-[11px] text-slate-700 dark:text-slate-200 leading-snug ${
                  expanded ? '' : 'line-clamp-2'
                }`}
              >
                &ldquo;{trimmed}&rdquo;
              </p>
            ) : (
              <p className="text-[11px] italic text-slate-500 dark:text-slate-400 leading-snug">
                Belum ada dugaan awal tercatat dari Tahap 1.
              </p>
            )}
          </div>
          {trimmed.length > 60 && (
            <span className="text-slate-400 shrink-0 mt-0.5">
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
            className="shrink-0 p-1 rounded-lg hover:bg-white/40 dark:hover:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
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
      className="rounded-xl border border-stone-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3 space-y-2.5 text-xs"
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
          <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
            Log Data Pengamatan Terkini
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold tabular-nums border ${
              readiness.isReady
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}
          >
            {readiness.badgeLabel}
          </span>
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Progress Track */}
      <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-stone-100/70 dark:bg-slate-950/60 rounded-lg px-2.5 py-2 border border-dashed border-stone-300 dark:border-slate-800">
              {readiness.guidanceText}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recentRows.map((rec, idx) => (
                <li
                  key={rec.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-stone-100/80 dark:bg-slate-950/70 border border-stone-200/80 dark:border-slate-800/80 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        #{domainRecords.length - idx}
                      </span>
                      <span className="truncate">{rec.parametersSummary}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
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
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
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
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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
