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
      <div className="max-w-md w-full rounded-xl bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border border-[var(--comfort-warning-border)] p-6 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] flex items-center justify-center text-[var(--comfort-warning)] mx-auto">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <span className="text-2xs font-semibold text-[var(--comfort-warning)]">
            Kontrol Interaktif Dikunci Guru
          </span>
          <h3 className="text-lg font-bold text-[var(--comfort-text)]">
            Perhatian ke Penjelasan {teacherName || 'Guru Pengampu'}
          </h3>
        </div>
        <p className="text-xs text-[var(--comfort-text-muted)] leading-relaxed">
          Seluruh slider dan kontrol eksperimen di meja praktikum{' '}
          <span className="font-mono font-bold text-[var(--comfort-accent)]">{activeRoomId || 'Kelas'}</span>{' '}
          sedang dibekukan sementara saat pengajar memberikan arahan konsep sains.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => useCollabStore.getState().setTeacherFreeze(false)}
            className="px-3.5 py-2 rounded-lg comfort-btn-secondary text-2xs font-mono cursor-pointer"
          >
            Mode Mandiri: Lepas Kunci Lokal
          </button>
        </div>
      </div>
    </div>
  );
};
