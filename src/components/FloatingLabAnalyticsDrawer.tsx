import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  ArrowRight,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import {
  ExperimentRecord,
  calculateLinearRegression,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';

interface FloatingLabAnalyticsDrawerProps {
  domain: 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi';
  experimentTitle: string;
  records: ExperimentRecord[];
  activeStudentName: string;
  activeGroupId: string;
  accentColor?: string;
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onProceedToAnalysis?: () => void;
  onBackToCatalog?: () => void;
}

export const FloatingLabAnalyticsDrawer: React.FC<
  FloatingLabAnalyticsDrawerProps
> = ({
  domain,
  experimentTitle,
  records,
  onDeleteRecord,
  onProceedToAnalysis,
  onBackToCatalog,
}) => {
  const [showQuickLog, setShowQuickLog] = useState<boolean>(false);

  const domainRecords = records.filter((r) => r.domain === domain);
  const activeRecords = domainRecords.length > 0 ? domainRecords : records;

  const customPoints = activeRecords
    .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
    .map((r, idx) => ({
      x: r.numericX ?? idx + 1,
      y: r.numericY1 ?? 0,
    }));

  const regression =
    customPoints.length >= 2
      ? calculateLinearRegression(customPoints)
      : null;

  return (
    <div className="pointer-events-auto absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
      {/* Compact Top-Right Workflow Action Strip */}
      <div className="flex items-center gap-2 studio-hud-surface border rounded-xl p-1.5 shadow-xl">
        {onBackToCatalog && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onBackToCatalog();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] hover:bg-[var(--comfort-hud-surface)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Kembali ke Tahap 1: Katalog Modul & K3"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Katalog Modul</span>
          </button>
        )}

        {/* Quick Toggle for Recorded Data Log */}
        <button
          type="button"
          onClick={() => {
            labSound.playClick(640);
            setShowQuickLog((prev) => !prev);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg studio-hud-subcard border hover:border-sky-500/50 text-xs font-medium text-[var(--comfort-hud-text)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>Data Terekam:</span>
          <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
            {domainRecords.length}
          </span>
          {showQuickLog ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--comfort-hud-muted)]" />
          )}
        </button>

        {/* Primary Next Step CTA -> Step 3: Analisis Grafik & LKS */}
        {onProceedToAnalysis && (
          <button
            type="button"
            onClick={() => {
              labSound.playRecordSuccess();
              onProceedToAnalysis();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Lanjut ke Grafik & LKS</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>

      {/* Compact Quick-Check Popover (Non-intrusive, no duplicate LKS) */}
      <AnimatePresence>
        {showQuickLog && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="w-80 sm:w-92 studio-hud-surface border rounded-xl shadow-2xl p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[var(--comfort-hud-border)] pb-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--comfort-hud-text)] truncate">
                  Ringkasan Data {domain} ({domainRecords.length} Titik)
                </div>
                <div className="text-2xs text-[var(--comfort-hud-muted)] truncate">
                  {experimentTitle}
                </div>
              </div>
              {regression && (
                <div className="text-right font-mono text-2xs shrink-0">
                  <span className="text-[var(--comfort-hud-muted)] block">Akurasi R²</span>
                  <span
                    className={`font-bold tabular-nums ${
                      regression.rSquared >= 0.85
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {regression.rSquared.toFixed(3)}
                  </span>
                </div>
              )}
            </div>

            {domainRecords.length === 0 ? (
              <p className="text-xs text-[var(--comfort-hud-muted)] py-3 text-center">
                Belum ada titik data untuk bidang {domain}. Tekan tombol{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">+ Catat Data Percobaan</strong>{' '}
                di bilah bawah.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-[var(--comfort-hud-border)] border border-[var(--comfort-hud-border)] rounded-lg studio-hud-subcard">
                {domainRecords.slice(0, 6).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 flex items-start justify-between gap-2 text-xs hover:bg-sky-500/5"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-2xs text-sky-600 dark:text-sky-400 font-semibold">
                        {rec.id} · {rec.timestamp}
                      </div>
                      <div className="text-2xs text-[var(--comfort-hud-text)] truncate mt-0.5 font-mono">
                        {rec.parametersSummary}
                      </div>
                      <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 truncate">
                        {Object.entries(rec.keyMetrics)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </div>
                    </div>
                    {onDeleteRecord && (
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(rec.id)}
                        aria-label={`Hapus ${rec.id}`}
                        className="p-1 rounded text-[var(--comfort-hud-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {onProceedToAnalysis && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  setShowQuickLog(false);
                  onProceedToAnalysis();
                }}
                className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Buka Analisis Grafik & Kerjakan LKS (Tahap 3)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
