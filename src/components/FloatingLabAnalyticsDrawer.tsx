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
      <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700/80 text-white rounded-xl p-1.5 shadow-xl">
        {onBackToCatalog && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onBackToCatalog();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Kembali ke Tahap 1: Katalog Modul & K3"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>Data Terekam:</span>
          <span className="font-mono font-bold text-sky-400 tabular-nums">
            {domainRecords.length}
          </span>
          {showQuickLog ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
            className="w-80 sm:w-92 bg-slate-900/95 border border-slate-700/80 text-white rounded-xl shadow-2xl p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  Ringkasan Data {domain} ({domainRecords.length} Titik)
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {experimentTitle}
                </div>
              </div>
              {regression && (
                <div className="text-right font-mono text-[11px] shrink-0">
                  <span className="text-slate-400 block">Akurasi R²</span>
                  <span
                    className={`font-bold tabular-nums ${
                      regression.rSquared >= 0.85
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {regression.rSquared.toFixed(3)}
                  </span>
                </div>
              )}
            </div>

            {domainRecords.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada titik data untuk bidang {domain}. Tekan tombol{' '}
                <strong className="text-emerald-400">+ Catat Data Percobaan</strong>{' '}
                di bilah bawah.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-slate-950/80">
                {domainRecords.slice(0, 6).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 flex items-start justify-between gap-2 text-xs hover:bg-slate-900/60"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-sky-400 font-semibold">
                        {rec.id} · {rec.timestamp}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate mt-0.5 font-mono">
                        {rec.parametersSummary}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5 truncate">
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
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
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
                className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
