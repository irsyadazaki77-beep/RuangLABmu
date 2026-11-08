import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  FileSpreadsheet,
  Lightbulb,
  Pin,
  ArrowLeftRight,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { ExperimentRecord, ScienceDomain } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';

export interface HypothesisNote {
  moduleId?: string;
  independentVar: string;
  dependentVar: string;
  hypothesisText: string;
  reflectionText: string;
  pinnedRecordIds?: string[];
  updatedAt: string;
}

interface ContextualMicroGuideHUDProps {
  moduleTitle: string;
  domain?: ScienceDomain;
  keyEquation?: string;
  IndependentVarLabel?: string;
  DependentVarLabel?: string;
  recordsCount: number;
  targetRecords?: number;
  isPlaying?: boolean;
  hasHypothesis?: boolean;
  onOpenHypothesis?: () => void;
  onOpenCompare?: () => void;
  onQuickRecord?: () => void;
  onProceedToAnalysis?: () => void;
}

/**
 * 1. Panduan Langkah Mikro Kontekstual di Layar 3D
 * Mengurangi Split-Attention Effect (Sweller) sehingga siswa tidak perlu bolak-balik ke halaman teori.
 */
export const ContextualMicroGuideHUD: React.FC<ContextualMicroGuideHUDProps> = ({
  moduleTitle,
  keyEquation,
  IndependentVarLabel,
  DependentVarLabel,
  recordsCount,
  targetRecords = 3,
  hasHypothesis = false,
  onOpenHypothesis,
  onOpenCompare,
  onQuickRecord,
  onProceedToAnalysis,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const steps = [
    {
      id: 1,
      label: IndependentVarLabel
        ? `Ubah ${IndependentVarLabel} & amati ${DependentVarLabel || 'output'}`
        : 'Rumuskan Hipotesis & Variasikan Slider',
      done: hasHypothesis || recordsCount >= 1,
      actionLabel: onOpenHypothesis
        ? hasHypothesis
          ? 'Edit Hipotesis'
          : '+ Tulis Hipotesis'
        : undefined,
      onAction: onOpenHypothesis,
    },
    {
      id: 2,
      label: `Rekam Minimal ${targetRecords} Titik Data (${Math.min(targetRecords, recordsCount)}/${targetRecords})`,
      done: recordsCount >= targetRecords,
      actionLabel: onQuickRecord && recordsCount < targetRecords ? '+ Catat Data' : undefined,
      onAction: onQuickRecord,
    },
    {
      id: 3,
      label: 'Bandingkan 2 Percobaan (Diff ΔX & ΔY)',
      done: recordsCount >= 2,
      actionLabel: recordsCount >= 2 && onOpenCompare ? 'Bandingkan Data' : undefined,
      onAction: recordsCount >= 2 ? onOpenCompare : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="pointer-events-auto max-w-xs sm:max-w-sm rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-800/90 text-xs text-slate-100 shadow-2xl overflow-hidden transition-all">
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold text-white">Panduan Praktikum 3D</span>
            <span className="ml-1.5 font-mono text-[10px] text-emerald-400 tabular-nums">
              ({completedCount}/3 Selesai)
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setCollapsed((c) => !c);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          title={collapsed ? 'Tampilkan Langkah Mikro' : 'Ringkas Panduan'}
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
            className="p-3 space-y-2.5"
          >
            <div className="text-[11px] text-slate-300 truncate" title={moduleTitle}>
              Modul: <strong className="text-white">{moduleTitle}</strong>
            </div>

            {keyEquation && (
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-300 truncate">
                {keyEquation}
              </div>
            )}

            <ul className="space-y-1.5">
              {steps.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 text-[11px] py-1 px-2 rounded-lg bg-slate-900/70 border border-slate-800/70"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {st.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-600 text-[9px] font-mono flex items-center justify-center text-slate-400 shrink-0">
                        {st.id}
                      </span>
                    )}
                    <span
                      className={`truncate ${
                        st.done ? 'text-slate-300' : 'text-white font-medium'
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                  {st.actionLabel && st.onAction && (
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        st.onAction?.();
                      }}
                      className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-semibold text-[10px] whitespace-nowrap cursor-pointer shrink-0"
                    >
                      {st.actionLabel}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {recordsCount >= 3 && onProceedToAnalysis && (
              <button
                type="button"
                onClick={() => {
                  labSound.playRecordSuccess();
                  onProceedToAnalysis();
                }}
                className="w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Data Cukup! Lanjut ke Grafik & LKS →</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface HypothesisScratchpadCardProps {
  moduleTitle?: string;
  defaultIndependentVar?: string;
  defaultDependentVar?: string;
  note: HypothesisNote;
  onChangeNote?: (next: HypothesisNote) => void;
  onChange?: (next: HypothesisNote) => void;
  records?: ExperimentRecord[];
  onClose?: () => void;
  compact?: boolean;
}

/**
 * 2. Buku Catatan Hipotesis & Refleksi Cepat (Split-Screen / Pin)
 */
export const HypothesisScratchpadCard: React.FC<HypothesisScratchpadCardProps> = ({
  moduleTitle = 'Modul Praktikum Sains',
  defaultIndependentVar = 'Gaya Dorong / Suhu / Jarak Orbit',
  defaultDependentVar = 'Percepatan / Laju Reaksi / Periode',
  note,
  onChangeNote: propOnChangeNote,
  onChange,
  records = [],
  onClose,
  compact = false,
}) => {
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const pinnedRecordIds = note.pinnedRecordIds ?? [];
  const onChangeNote = (next: HypothesisNote) => {
    if (propOnChangeNote) propOnChangeNote(next);
    if (onChange) onChange(next);
  };

  const handleInsertTemplate = (relation: 'meningkat linier' | 'menurun terbalik' | 'berubah kuadratik') => {
    labSound.playClick();
    const ind = note.independentVar.trim() || defaultIndependentVar;
    const dep = note.dependentVar.trim() || defaultDependentVar;
    const draft = `Jika variabel bebas (${ind}) diperbesar secara bertahap sementara variabel kontrol dijaga tetap, maka variabel terikat (${dep}) akan ${relation}.`;
    onChangeNote({
      ...note,
      independentVar: ind,
      dependentVar: dep,
      hypothesisText: draft,
      updatedAt: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1500);
  };

  const handleTogglePinRecord = (recordId: string) => {
    labSound.playClick();
    const exists = pinnedRecordIds.includes(recordId);
    const nextPinned = exists
      ? pinnedRecordIds.filter((id) => id !== recordId)
      : [...pinnedRecordIds, recordId];
    onChangeNote({
      ...note,
      pinnedRecordIds: nextPinned,
      updatedAt: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
              Buku Catatan Hipotesis & Refleksi Ilmiah
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
              {moduleTitle} · Tersimpan otomatis ke Laporan Resmi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {savedToast && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" /> Tersimpan
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              title="Tutup Panel Hipotesis"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Independent & Dependent Variables Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
            Variabel Bebas (Diubah di Slider)
          </label>
          <input
            type="text"
            value={note.independentVar}
            onChange={(e) =>
              onChangeNote({ ...note, independentVar: e.target.value })
            }
            placeholder={defaultIndependentVar}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
            Variabel Terikat (Respons Terukur)
          </label>
          <input
            type="text"
            value={note.dependentVar}
            onChange={(e) =>
              onChangeNote({ ...note, dependentVar: e.target.value })
            }
            placeholder={defaultDependentVar}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Quick Hypothesis Templates */}
      <div className="space-y-1">
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Templat Perumusan Cepat:</span>
          <span className="font-mono text-[10px]">Klik untuk mengisi</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { label: '∝ Meningkat Linier', val: 'meningkat linier' },
              { label: '1/x Menurun Terbalik', val: 'menurun terbalik' },
              { label: 'x² Berubah Kuadratik', val: 'berubah kuadratik' },
            ] as const
          ).map((tpl) => (
            <button
              key={tpl.val}
              type="button"
              onClick={() => handleInsertTemplate(tpl.val)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/20 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 border border-slate-200 dark:border-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hypothesis Textarea */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Hipotesis Awal Siswa (Sebelum / Saat Eksperimen):
        </label>
        <textarea
          rows={compact ? 2 : 3}
          value={note.hypothesisText}
          onChange={(e) =>
            onChangeNote({
              ...note,
              hypothesisText: e.target.value,
              updatedAt: new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          }
          placeholder="Contoh: Jika gaya dorong F diperbesar pada massa tetap, maka percepatan a meningkat sebanding lurus sesuai F = m·a..."
          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs leading-relaxed focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* Reflection / Empirical Verification Textarea */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
          Refleksi Hasil Pengamatan vs Hipotesis:
        </label>
        <textarea
          rows={compact ? 2 : 2}
          value={note.reflectionText}
          onChange={(e) =>
            onChangeNote({
              ...note,
              reflectionText: e.target.value,
              updatedAt: new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          }
          placeholder="Apakah data rekaman membuktikan hipotesis Anda? Catat temuan gradien R² atau anomali di sini..."
          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Pin Live Recorded Trials as Evidence */}
      {records.length > 0 && (
        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <Pin className="w-3 h-3 text-sky-500" />
              <span>Sematkan Bukti Data Eksperimen ({pinnedRecordIds.length})</span>
            </span>
            <span>Klik untuk menyematkan</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {records.slice(0, 6).map((rec) => {
              const pinned = pinnedRecordIds.includes(rec.id);
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => handleTogglePinRecord(rec.id)}
                  className={`px-2 py-1 rounded-lg border font-mono text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                    pinned
                      ? 'bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>{rec.id}</span>
                  <span>·</span>
                  <span className="truncate max-w-[140px]">{rec.parametersSummary}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ExperimentTrialComparePanelProps {
  records: ExperimentRecord[];
  domainFilter?: string;
  onClose?: () => void;
}

/**
 * 3. Perbandingan Rekaman Eksperimen Berdampingan (Diff / Compare 2 Percobaan)
 */
export const ExperimentTrialComparePanel: React.FC<ExperimentTrialComparePanelProps> = ({
  records: rawRecords,
  domainFilter,
  onClose,
}) => {
  const records = useMemo(() => {
    if (!domainFilter) return rawRecords;
    const filtered = rawRecords.filter(
      (r) => r.domain.toLowerCase() === domainFilter.toLowerCase()
    );
    return filtered.length >= 2 ? filtered : rawRecords;
  }, [rawRecords, domainFilter]);

  const [trialAId, setTrialAId] = useState<string>(() => records[1]?.id || records[0]?.id || '');
  const [trialBId, setTrialBId] = useState<string>(() => records[0]?.id || '');

  const recordA = useMemo(
    () => records.find((r) => r.id === trialAId) || records[1] || records[0],
    [records, trialAId]
  );
  const recordB = useMemo(
    () => records.find((r) => r.id === trialBId) || records[0],
    [records, trialBId]
  );

  if (records.length < 2 || !recordA || !recordB) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-sky-500" />
            <span>Komparator 2 Rekaman Eksperimen Berdampingan (Diff)</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-slate-500 dark:text-slate-400">
          Rekam minimal <strong>2 titik data eksperimen</strong> di simulasi 3D untuk membandingkan perubahan parameter (ΔX) dan respons terukur (ΔY) secara berdampingan.
        </p>
      </div>
    );
  }

  const dx =
    recordA.numericX !== undefined && recordB.numericX !== undefined
      ? Number((recordB.numericX - recordA.numericX).toFixed(3))
      : null;
  const dy1 =
    recordA.numericY1 !== undefined && recordB.numericY1 !== undefined
      ? Number((recordB.numericY1 - recordA.numericY1).toFixed(3))
      : null;
  const dy2 =
    recordA.numericY2 !== undefined && recordB.numericY2 !== undefined
      ? Number((recordB.numericY2 - recordA.numericY2).toFixed(3))
      : null;

  const pctChangeY1 =
    dy1 !== null && recordA.numericY1 && Math.abs(recordA.numericY1) > 1e-6
      ? Number(((dy1 / Math.abs(recordA.numericY1)) * 100).toFixed(1))
      : null;

  // All metric keys across both records
  const allMetricKeys = Array.from(
    new Set([
      ...Object.keys(recordA.keyMetrics),
      ...Object.keys(recordB.keyMetrics),
    ])
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 text-xs shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              Perbandingan 2 Eksperimen Berdampingan (Side-by-Side Diff)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Analisis kausalitas perubahan parameter input terhadap metrik output terukur
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selector Row: Percobaan A vs Percobaan B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <label className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 block">
            PERCOBAAN ACUAN (A)
          </label>
          <select
            value={recordA.id}
            onChange={(e) => {
              labSound.playClick();
              setTrialAId(e.target.value);
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} ({r.timestamp}) — {r.experimentTitle}
              </option>
            ))}
          </select>
          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
            Parameter: {recordA.parametersSummary}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <label className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
            PERCOBAAN PEMBANDING (B)
          </label>
          <select
            value={recordB.id}
            onChange={(e) => {
              labSound.playClick();
              setTrialBId(e.target.value);
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} ({r.timestamp}) — {r.experimentTitle}
              </option>
            ))}
          </select>
          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
            Parameter: {recordB.parametersSummary}
          </div>
        </div>
      </div>

      {/* Quantitative Delta KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Perubahan Variabel Bebas (ΔX = X_B - X_A)
          </div>
          <div className="mt-1 font-mono font-bold text-base text-slate-900 dark:text-white tabular-nums">
            {dx !== null ? (
              <>
                {dx > 0 ? `+${dx}` : dx}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({recordA.numericX} → {recordB.numericX})
                </span>
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Selisih Respons Utama (ΔY₁ = Y₁_B - Y₁_A)
          </div>
          <div className="mt-1 font-mono font-bold text-base text-sky-600 dark:text-sky-400 tabular-nums">
            {dy1 !== null ? (
              <>
                {dy1 > 0 ? `▲ +${dy1}` : dy1 < 0 ? `▼ ${dy1}` : '● 0'}{' '}
                {pctChangeY1 !== null && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    ({pctChangeY1 > 0 ? `+${pctChangeY1}%` : `${pctChangeY1}%`})
                  </span>
                )}
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Selisih Respons Sekunder (ΔY₂)
          </div>
          <div className="mt-1 font-mono font-bold text-base text-amber-600 dark:text-amber-400 tabular-nums">
            {dy2 !== null ? (
              <>
                {dy2 > 0 ? `▲ +${dy2}` : dy2 < 0 ? `▼ ${dy2}` : '● 0'}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({recordA.numericY2 ?? 0} → {recordB.numericY2 ?? 0})
                </span>
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>
      </div>

      {/* Detailed Side-by-Side Metrics Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <th className="py-2 px-3">Besaran Terukur</th>
              <th className="py-2 px-3">Percobaan A ({recordA.id})</th>
              <th className="py-2 px-3">Percobaan B ({recordB.id})</th>
              <th className="py-2 px-3">Perubahan (Δ)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono tabular-nums">
            {allMetricKeys.map((key) => {
              const valA = String(recordA.keyMetrics[key] ?? '-');
              const valB = String(recordB.keyMetrics[key] ?? '-');
              const numA = parseFloat(valA.replace(/[^\d.-]/g, ''));
              const numB = parseFloat(valB.replace(/[^\d.-]/g, ''));
              const hasNumericDelta = !Number.isNaN(numA) && !Number.isNaN(numB);
              const diff = hasNumericDelta ? Number((numB - numA).toFixed(3)) : 0;

              return (
                <tr key={key} className="text-slate-700 dark:text-slate-200">
                  <td className="py-2 px-3 font-sans font-semibold">{key}</td>
                  <td className="py-2 px-3">{valA}</td>
                  <td className="py-2 px-3 font-semibold">{valB}</td>
                  <td className="py-2 px-3">
                    {hasNumericDelta ? (
                      <span
                        className={
                          diff > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : diff < 0
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-slate-400'
                        }
                      >
                        {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '= 0 (Tetap)'}
                      </span>
                    ) : valA === valB ? (
                      <span className="text-slate-400">= Sama</span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400">Berubah</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Automatic Causal Interpretation Footer */}
      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
        <FileSpreadsheet className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
        <div>
          <strong>Sintesis Kausalitas:</strong> Ketika parameter diubah dari{' '}
          <span className="font-mono">{recordA.id}</span> ke{' '}
          <span className="font-mono">{recordB.id}</span> (ΔX ={' '}
          <span className="font-mono">{dx ?? 0}</span>), respons utama Y₁ mengalami perubahan sebesar{' '}
          <span className="font-mono font-bold">
            {dy1 ?? 0} ({pctChangeY1 !== null ? `${pctChangeY1}%` : '0%'})
          </span>
          . Gunakan temuan ini untuk menjawab LKS dan menyusun kesimpulan laporan!
        </div>
      </div>
    </div>
  );
};
