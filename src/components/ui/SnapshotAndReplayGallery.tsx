import React from 'react';
import { Camera, Eye, RotateCcw, Trash2 } from 'lucide-react';
import type { ExperimentRecord, ScienceDomain } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';

export interface Lab3DSnapshot {
  id: string;
  timestamp: string;
  domain: ScienceDomain;
  moduleTitle: string;
  paramsSummary?: string;
  parametersSummary?: string;
  primaryMetric: string;
  dataUrl: string;
}

interface SnapshotAndReplayGalleryProps {
  snapshots: Lab3DSnapshot[];
  onDeleteSnapshot?: (id: string) => void;
  records?: ExperimentRecord[];
  onReplayRecord?: (record: ExperimentRecord) => void;
}

export const SnapshotAndReplayGallery: React.FC<SnapshotAndReplayGalleryProps> = ({
  snapshots,
  onDeleteSnapshot,
  records = [],
  onReplayRecord,
}) => {
  return (
    <div className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--comfort-text)] flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Galeri Bukti Foto 3D &amp; Pemutar Ulang Rekaman (Trial Replay)</span>
          </h3>
          <p className="text-xs text-[var(--comfort-text-muted)]">
            Seluruh tangkapan layar 3D otomatis dilampirkan ke dalam dokumen Laporan Resmi Praktikum A4.
          </p>
        </div>
        <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-semibold tabular-nums">
          {snapshots.length} Foto 3D · {records.length} Rekaman Data
        </span>
      </div>

      {/* 3D Snapshots Grid */}
      {snapshots.length === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--comfort-surface-subtle)] border border-dashed border-[var(--comfort-border)] text-xs text-[var(--comfort-text-muted)] text-center">
          Belum ada tangkapan layar 3D. Klik tombol <strong>&ldquo;Snapshot&rdquo;</strong> pada bilah kontrol bawah di ruang praktikum 3D untuk mendokumentasikan percobaan Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] overflow-hidden flex flex-col justify-between"
            >
              <div className="relative h-36 bg-slate-950 overflow-hidden">
                <img
                  src={snap.dataUrl}
                  alt={snap.moduleTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/85 text-2xs font-mono text-sky-300 border border-white/10">
                  {snap.domain} · {snap.timestamp}
                </div>
                {onDeleteSnapshot && (
                  <button
                    type="button"
                    onClick={() => onDeleteSnapshot(snap.id)}
                    aria-label="Hapus foto 3D"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/85 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="p-3 space-y-1 text-xs">
                <div className="font-bold text-[var(--comfort-text)] truncate">
                  {snap.moduleTitle}
                </div>
                <div className="text-2xs font-mono text-[var(--comfort-text-muted)] truncate">
                  {snap.parametersSummary || snap.paramsSummary}
                </div>
                <div className="text-2xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                  Hasil: {snap.primaryMetric}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Trial Replay List */}
      {records.length > 0 && onReplayRecord && (
        <div className="pt-2 border-t border-[var(--comfort-border)] space-y-2">
          <div className="text-xs font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Putar Ulang Konfigurasi Rekaman ke Ruang 3D:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {records.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="px-3 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--comfort-text)] truncate">
                    {rec.id} · {rec.experimentTitle}
                  </div>
                  <div className="text-2xs font-mono text-[var(--comfort-text-muted)] truncate">
                    {rec.parametersSummary}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onReplayRecord(rec);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Putar di 3D</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
