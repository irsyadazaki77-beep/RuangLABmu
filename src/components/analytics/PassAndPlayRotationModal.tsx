import React, { useEffect } from 'react';
import { RotateCcw, Users } from 'lucide-react';

export interface PassAndPlayRotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGroupId: string;
  activeStudentName: string;
  observationCount: number;
  nextGroupInput: string;
  setNextGroupInput: (value: string) => void;
  nextStudentInput: string;
  setNextStudentInput: (value: string) => void;
  isRotatingGroup: boolean;
  onConfirmRotation: () => void;
}

/**
 * 3T Pass-and-Play classroom rotation dialog preserving the outgoing group's
 * submission before resetting workspace telemetry and worksheet fields.
 */
export const PassAndPlayRotationModal: React.FC<PassAndPlayRotationModalProps> = ({
  isOpen,
  onClose,
  activeGroupId,
  activeStudentName,
  observationCount,
  nextGroupInput,
  setNextGroupInput,
  nextStudentInput,
  setNextStudentInput,
  isRotatingGroup,
  onConfirmRotation,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gilir Kelompok Pass-and-Play"
      data-testid="pass-and-play-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[var(--comfort-text)]">
                Gilir Kelompok di 1 Komputer (Pass-and-Play)
              </h3>
              <p className="text-2xs text-[var(--comfort-text-muted)]">
                Solusi praktikum 3T saat 1 komputer digunakan bergantian oleh beberapa kelompok siswa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog gilir kelompok"
            className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] p-1 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title="Tutup dialog"
          >
            ✕
          </button>
        </div>

        {/* Current Group Summary */}
        <div className="p-3.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs space-y-1.5">
          <div className="text-2xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)]">
            Laporan Kelompok Selesai yang Disimpan Permanen:
          </div>
          <div className="font-bold text-[var(--comfort-text)] text-sm">
            {activeGroupId} · {activeStudentName}
          </div>
          <div className="text-2xs text-[var(--comfort-text-muted)] space-y-0.5">
            <div>
              ✓ <strong>{observationCount} Titik Data</strong> observasi terlampir & tersimpan
            </div>
            <div>
              ✓ <strong>Jawaban LKS & Kesimpulan</strong> aman tercatat di daftar laporan
            </div>
            <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              *Data kelompok ini TIDAK akan terhapus saat meja direset untuk kelompok berikutnya.
            </div>
          </div>
        </div>

        {/* Next Group Selection Form */}
        <div className="space-y-3 text-xs">
          <div className="text-2xs font-bold text-[var(--comfort-text)]">
            Tentukan Kelompok & Siswa Berikutnya:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)] mb-1">
                Nama Kelompok Berikutnya:
              </label>
              <input
                type="text"
                value={nextGroupInput}
                onChange={(e) => setNextGroupInput(e.target.value)}
                placeholder="Contoh: Kelompok 2 — Termokimia"
                className="w-full px-3 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-semibold text-[var(--comfort-text)] text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-[var(--comfort-text-muted)] mb-1">
                Nama Siswa / Perwakilan:
              </label>
              <input
                type="text"
                value={nextStudentInput}
                onChange={(e) => setNextStudentInput(e.target.value)}
                placeholder="Contoh: Citra Lestari"
                className="w-full px-3 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-semibold text-[var(--comfort-text)] text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--comfort-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--comfort-border)] text-[var(--comfort-text)] font-semibold text-xs cursor-pointer hover:bg-[var(--comfort-surface-subtle)]"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="confirm-pass-and-play-rotation-btn"
            disabled={isRotatingGroup}
            onClick={onConfirmRotation}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {isRotatingGroup
                ? 'Menyimpan & Menyiapkan Meja...'
                : `Simpan Laporan & Gilir ke [${nextGroupInput || 'Kelompok Berikutnya'}]`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
