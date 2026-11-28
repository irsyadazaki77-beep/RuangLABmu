import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Lightbulb,
  Pin,
  Target,
  X,
} from 'lucide-react';
import { ExperimentRecord, ScienceDomain } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
export { ExperimentTrialComparePanel } from './TrialComparePanel';

export interface HypothesisNote {
  moduleId?: string;
  independentVar: string;
  dependentVar: string;
  hypothesisText: string;
  reflectionText: string;
  predictedTrend?: 'naik-linier' | 'naik-kurva' | 'turun' | 'konstan';
  predictedX?: string;
  predictedY?: string;
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
 * Menggunakan .studio-hud-surface agar adaptif di mode Light/Sepia/Dark.
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
  const [collapsed, setCollapsed] = useState<boolean>(true);

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

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          labSound.playClick();
          setCollapsed(false);
        }}
        className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl studio-hud-surface text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
        title="Buka Panduan Praktikum 3D"
      >
        <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" />
        <span>Panduan ({completedCount}/3)</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto max-w-xs sm:max-w-sm rounded-2xl studio-hud-surface text-xs shadow-xl overflow-hidden transition-all">
      <div
        className="px-3.5 py-2.5 flex items-center justify-between gap-3 border-b"
        style={{ borderColor: 'var(--comfort-hud-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-sky-500 shrink-0" />
          <div className="truncate">
            <span className="font-bold">Panduan Praktikum 3D</span>
            <span className="ml-1.5 font-mono text-2xs text-emerald-500 tabular-nums">
              ({completedCount}/3 Selesai)
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            labSound.playClick();
            setCollapsed(true);
          }}
          className="p-1.5 rounded-lg text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)] cursor-pointer shrink-0"
          title="Ringkas Panduan"
        >
          <ChevronDown className="w-3.5 h-3.5" />
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
            <div className="text-2xs text-[var(--comfort-hud-muted)] truncate" title={moduleTitle}>
              Modul: <strong className="text-[var(--comfort-hud-text)]">{moduleTitle}</strong>
            </div>

            {keyEquation && (
              <div className="px-2.5 py-1.5 rounded-lg studio-hud-subcard font-mono text-2xs text-sky-500 truncate">
                {keyEquation}
              </div>
            )}

            <ul className="space-y-1.5">
              {steps.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 text-2xs py-1.5 px-2 rounded-lg studio-hud-subcard"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {st.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <span
                        className="w-3.5 h-3.5 rounded-full border text-2xs font-mono flex items-center justify-center text-[var(--comfort-hud-muted)] shrink-0"
                        style={{ borderColor: 'var(--comfort-hud-border)' }}
                      >
                        {st.id}
                      </span>
                    )}
                    <span
                      className={`truncate ${
                        st.done ? 'text-[var(--comfort-hud-muted)]' : 'font-medium'
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
                      className="px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-600 dark:text-sky-300 font-semibold text-2xs whitespace-nowrap cursor-pointer shrink-0"
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
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Data Cukup! Lanjut ke Grafik & LKS</span>
                <ArrowRight className="w-3.5 h-3.5" />
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
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRecordIds = note.pinnedRecordIds ?? [];

  useEffect(() => {
    return () => {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
        savedToastTimerRef.current = null;
      }
    };
  }, []);
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
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
    savedToastTimerRef.current = setTimeout(() => {
      setSavedToast(false);
      savedToastTimerRef.current = null;
    }, 1500);
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
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4 space-y-3 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--comfort-text)] text-xs leading-tight">
              Buku Catatan Hipotesis &amp; Refleksi Ilmiah
            </h3>
            <p className="text-2xs text-[var(--comfort-text-muted)] truncate max-w-[260px]">
              {moduleTitle} · Tersimpan otomatis ke Laporan Resmi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {savedToast && (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" /> Tersimpan
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
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
          <label className="block text-2xs font-semibold text-[var(--comfort-text)] mb-1">
            Variabel Bebas (Diubah di Slider)
          </label>
          <input
            type="text"
            value={note.independentVar}
            onChange={(e) => onChangeNote({ ...note, independentVar: e.target.value })}
            placeholder={defaultIndependentVar}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-2xs font-semibold text-[var(--comfort-text)] mb-1">
            Variabel Terikat (Respons Terukur)
          </label>
          <input
            type="text"
            value={note.dependentVar}
            onChange={(e) => onChangeNote({ ...note, dependentVar: e.target.value })}
            placeholder={defaultDependentVar}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Quick Hypothesis Templates */}
      <div className="space-y-1">
        <div className="text-2xs text-[var(--comfort-text-muted)] flex items-center justify-between">
          <span>Templat Perumusan Cepat:</span>
          <span className="font-mono text-2xs">Klik untuk mengisi</span>
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
              className="px-2.5 py-1 rounded-lg bg-[var(--comfort-surface-subtle)] hover:bg-sky-500/20 text-[var(--comfort-text)] hover:text-sky-600 dark:hover:text-sky-300 border border-[var(--comfort-border)] font-medium text-2xs transition-colors cursor-pointer"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hypothesis Textarea */}
      <div>
        <label className="block text-2xs font-semibold text-[var(--comfort-text)] mb-1">
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
          className="w-full px-3 py-2 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs leading-relaxed focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* POE Quantitative Prediction Box */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-2xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-500" />
            <span>Tantangan Prediksi Kuantitatif (Metode POE: Predict–Observe–Explain)</span>
          </div>
          <span className="text-2xs font-mono text-amber-700 dark:text-amber-400">
            Ditampilkan di Grafik Analitik
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
          <div className="min-w-0">
            <label
              title="Tren Kurva Prediksi"
              className="block text-2xs font-semibold text-[var(--comfort-text-muted)] mb-1 truncate"
            >
              Tren Kurva Prediksi
            </label>
            <select
              value={note.predictedTrend || 'naik-linier'}
              onChange={(e) =>
                onChangeNote({
                  ...note,
                  predictedTrend: e.target.value as HypothesisNote['predictedTrend'],
                })
              }
              className="w-full h-9 px-2.5 rounded-lg bg-[var(--comfort-surface)] border border-amber-400/50 text-[var(--comfort-text)] text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="naik-linier">↗ Naik Linier (Proporsional)</option>
              <option value="naik-kurva">⤴ Naik Melengkung (Non-Linier)</option>
              <option value="turun">↘ Menurun Terbalik</option>
              <option value="konstan">→ Konstan / Stasioner</option>
            </select>
          </div>
          <div className="min-w-0">
            <label
              title={`Titik Uji X (${note.independentVar || defaultIndependentVar})`}
              className="block text-2xs font-semibold text-[var(--comfort-text-muted)] mb-1 truncate"
            >
              Titik Uji X ({note.independentVar || defaultIndependentVar})
            </label>
            <input
              type="number"
              step="any"
              value={note.predictedX ?? ''}
              onChange={(e) =>
                onChangeNote({
                  ...note,
                  predictedX: e.target.value,
                })
              }
              placeholder="Misal: 30"
              className="w-full h-9 px-2.5 rounded-lg bg-[var(--comfort-surface)] border border-amber-400/50 text-[var(--comfort-text)] text-xs font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="min-w-0">
            <label
              title={`Prediksi Output Y (${note.dependentVar || defaultDependentVar})`}
              className="block text-2xs font-semibold text-[var(--comfort-text-muted)] mb-1 truncate"
            >
              Prediksi Output Y ({note.dependentVar || defaultDependentVar})
            </label>
            <input
              type="number"
              step="any"
              value={note.predictedY ?? ''}
              onChange={(e) =>
                onChangeNote({
                  ...note,
                  predictedY: e.target.value,
                })
              }
              placeholder="Misal: 7.5"
              className="w-full h-9 px-2.5 rounded-lg bg-[var(--comfort-surface)] border border-amber-400/50 text-[var(--comfort-text)] text-xs font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Reflection / Empirical Verification Textarea */}
      <div>
        <label className="block text-2xs font-semibold text-[var(--comfort-text)] mb-1">
          Refleksi Hasil Pengamatan vs Hipotesis:
        </label>
        <textarea
          rows={2}
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
          className="w-full px-3 py-2 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Pin Live Recorded Trials as Evidence */}
      {records.length > 0 && (
        <div className="pt-1 border-t border-[var(--comfort-border)] space-y-1.5">
          <div className="flex items-center justify-between text-2xs text-[var(--comfort-text-muted)]">
            <span className="flex items-center gap-1 font-semibold text-[var(--comfort-text)]">
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
                  className={`px-2 py-1 rounded-lg border font-mono text-2xs transition-colors cursor-pointer flex items-center gap-1 ${
                    pinned
                      ? 'bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 font-bold'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text-muted)]'
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
