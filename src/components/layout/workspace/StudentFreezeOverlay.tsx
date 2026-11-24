import React from 'react';
import { Lock } from 'lucide-react';
import { useCollabStore } from '../../../stores/useCollabStore';

export interface StudentFreezeOverlayProps {
  teacherName: string | null;
  activeRoomId: string | null;
}

export const StudentFreezeOverlay: React.FC<StudentFreezeOverlayProps> = ({
  teacherName,
  activeRoomId,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border border-amber-500/60 p-6 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <span className="text-2xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
            KONTROL INTERAKTIF DIKUNCI GURU
          </span>
          <h3 className="text-lg font-bold text-[var(--comfort-text)]">
            Perhatian ke Penjelasan {teacherName || 'Guru Pengampu'}
          </h3>
        </div>
        <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed">
          Seluruh slider dan kontrol eksperimen di meja praktikum{' '}
          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{activeRoomId || 'Kelas'}</span>{' '}
          sedang dibekukan sementara saat pengajar memberikan arahan konsep sains.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => useCollabStore.getState().setTeacherFreeze(false)}
            className="px-3.5 py-2 rounded-lg bg-[var(--comfort-surface-subtle)] hover:bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-2xs font-mono text-[var(--comfort-text)] cursor-pointer transition-colors"
          >
            Mode Mandiri: Lepas Kunci Lokal
          </button>
        </div>
      </div>
    </div>
  );
};
