import React from 'react';
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
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="pass-and-play-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200/80 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Gilir Kelompok di 1 Komputer (Pass-and-Play)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Solusi praktikum 3T saat 1 komputer digunakan bergantian oleh beberapa kelompok siswa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
            title="Tutup dialog"
          >
            ✕
          </button>
        </div>

        {/* Current Group Summary */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-950 border border-stone-200/80 dark:border-slate-800 text-xs space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Laporan Kelompok Selesai yang Disimpan Permanen:
          </div>
          <div className="font-bold text-slate-900 dark:text-white text-sm">
            {activeGroupId} · {activeStudentName}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
            <div>
              ✓ <strong>{observationCount} Titik Data</strong> observasi terlampir & tersimpan
            </div>
            <div>
              ✓ <strong>Jawaban LKS & Kesimpulan</strong> aman tercatat di daftar laporan
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              *Data kelompok ini TIDAK akan terhapus saat meja direset untuk kelompok berikutnya.
            </div>
          </div>
        </div>

        {/* Next Group Selection Form */}
        <div className="space-y-3 text-xs">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            Tentukan Kelompok & Siswa Berikutnya:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nama Kelompok Berikutnya:
              </label>
              <input
                type="text"
                value={nextGroupInput}
                onChange={(e) => setNextGroupInput(e.target.value)}
                placeholder="Contoh: Kelompok 2 — Termokimia"
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nama Siswa / Perwakilan:
              </label>
              <input
                type="text"
                value={nextStudentInput}
                onChange={(e) => setNextStudentInput(e.target.value)}
                placeholder="Contoh: Citra Lestari"
                className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer hover:bg-stone-100 dark:hover:bg-slate-800"
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
