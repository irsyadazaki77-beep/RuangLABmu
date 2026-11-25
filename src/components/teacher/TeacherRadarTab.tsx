import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { RadarLaneSummary, StudentRadarCard } from '../../utils/telemetryRadar';
import { labSound } from '../../utils/soundEngine';

export interface TeacherRadarTabProps {
  radarLanes: RadarLaneSummary[];
  groups: string[];
  groupFilter: string;
  onChangeGroupFilter: (group: string) => void;
  onSendTeacherFeedback: (targetStudentId: string, message: string) => void;
}

export const TeacherRadarTab: React.FC<TeacherRadarTabProps> = ({
  radarLanes,
  groups,
  groupFilter,
  onChangeGroupFilter,
  onSendTeacherFeedback,
}) => {
  const [quickNoteStudent, setQuickNoteStudent] = useState<StudentRadarCard | null>(null);
  const [quickNoteText, setQuickNoteText] = useState<string>('');

  const handleOpenQuickNote = (student: StudentRadarCard) => {
    labSound.playClick();
    setQuickNoteStudent(student);
    if (student.needsHelp) {
      setQuickNoteText(
        student.rSquared && student.rSquared < 0.8
          ? `Halo ${student.name.split(' ')[0]}, nilai R² = ${student.rSquared.toFixed(2)} terindikasi menyimpang. Coba periksa kembali titik data yang melenceng atau ulangi pengambilan sampel.`
          : `Halo ${student.name.split(' ')[0]}, ada kendala pada tahap ${student.resolvedStep}? Perhatikan variabel bebas dan petunjuk di modul.`
      );
    } else {
      setQuickNoteText(
        `Kerja bagus ${student.name.split(' ')[0]}, progres praktikum Anda berjalan optimal. Lanjutkan pengisian LKS!`
      );
    }
  };

  const handleSendQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteStudent || !quickNoteText.trim()) return;
    labSound.playRecordSuccess();
    onSendTeacherFeedback(quickNoteStudent.id, quickNoteText.trim());
    setQuickNoteStudent(null);
    setQuickNoteText('');
  };

  return (
    <>
      <div className="bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--comfort-text)]">
              Radar Progres Kelas Real-Time (4 Tahap Praktikum)
            </h2>
            <p className="text-xs text-[var(--comfort-text-muted)] mt-0.5">
              Distribusi siswa sepanjang 4 tahap alur terstruktur · Deteksi otomatis saat R² &lt; 0.80 atau tertahan &gt; 8 menit
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs text-[var(--comfort-text-muted)]">Filter:</span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--comfort-surface-subtle)] rounded-lg border border-[var(--comfort-border)]">
              {groups.map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onChangeGroupFilter(grp);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    groupFilter === grp
                      ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs font-semibold'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {grp === 'Semua' ? 'Semua Kelompok' : grp.split(' — ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Active Workflow Columns / Radar Lanes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {radarLanes.map((lane) => {
            const laneColors = [
              { stepBadge: 'bg-[var(--comfort-accent-solid)] text-white' },
              { stepBadge: 'bg-[var(--comfort-success)] text-white' },
              { stepBadge: 'bg-[var(--comfort-warning)] text-white' },
              { stepBadge: 'bg-[var(--comfort-accent-solid)] text-white' },
            ][lane.step - 1] || { stepBadge: 'bg-[var(--comfort-accent-solid)] text-white' };

            return (
              <div
                key={lane.step}
                className="flex flex-col rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] p-3 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--comfort-border)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md ${laneColors.stepBadge} font-mono font-bold text-2xs flex items-center justify-center shrink-0`}
                    >
                      {lane.step}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--comfort-text)] truncate">
                        {lane.title}
                      </div>
                      <div className="text-2xs text-[var(--comfort-text-muted)] truncate">
                        {lane.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 font-mono text-2xs tabular-nums">
                    <span className="px-2 py-0.5 rounded-md bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] font-semibold">
                      {lane.students.length}
                    </span>
                    {lane.needsHelpCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)] font-bold border border-[var(--comfort-warning-border)] flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" aria-hidden="true" />
                        {lane.needsHelpCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 min-h-[160px]">
                  {lane.students.length === 0 ? (
                    <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-[var(--comfort-border)] rounded-xl text-[var(--comfort-text-muted)]">
                      <p className="text-xs">Tidak ada siswa</p>
                      <p className="text-2xs opacity-80">di tahap ini</p>
                    </div>
                  ) : (
                    lane.students.map((stu) => {
                      const domainColorClass =
                        stu.activeDomain === 'Fisika'
                          ? 'bg-[var(--comfort-accent-soft)] text-[var(--comfort-accent)] border-[var(--comfort-accent-border)]'
                          : stu.activeDomain === 'Kimia'
                          ? 'bg-[var(--comfort-success-soft)] text-[var(--comfort-success)] border-[var(--comfort-success-border)]'
                          : stu.activeDomain === 'Biologi'
                          ? 'bg-[var(--comfort-warning-soft)] text-[var(--comfort-warning)] border-[var(--comfort-warning-border)]'
                          : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] border-[var(--comfort-border)]';

                      const moduleDisplayName =
                        stu.activeModuleTitle ||
                        stu.currentActivity
                          .replace(/^Menjalankan Simulasi |^Menganalisis |^Menguji |^Eksplorasi /i, '')
                          .split('(')[0]
                          .trim() ||
                        `Praktikum ${stu.activeDomain}`;

                      return (
                        <div
                          key={stu.id}
                          className={`rounded-xl p-3 border transition-colors text-xs space-y-2.5 ${
                            stu.needsHelp
                              ? 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)]'
                              : 'bg-[var(--comfort-surface)] border-[var(--comfort-border)] shadow-xs hover:border-[var(--comfort-accent-border)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <div className="font-bold text-[var(--comfort-text)] truncate">
                                {stu.name}
                              </div>
                              <div className="text-2xs text-[var(--comfort-text-muted)] truncate">
                                {stu.groupId.split(' — ')[0]}
                              </div>
                            </div>

                            <span
                              className={`px-1.5 py-0.5 rounded text-2xs font-mono border font-semibold shrink-0 ${domainColorClass}`}
                            >
                              {stu.activeDomain}
                            </span>
                          </div>

                          <div className="text-2xs font-medium text-[var(--comfort-text)] line-clamp-1 bg-[var(--comfort-surface-subtle)] px-2 py-1 rounded-md">
                            {moduleDisplayName}
                          </div>

                          <div className="flex items-center justify-between text-2xs font-mono text-[var(--comfort-text-muted)] pt-0.5 tabular-nums">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              <span
                                className={
                                  stu.timeInStepMinutes && stu.timeInStepMinutes > 8
                                    ? 'text-[var(--comfort-warning)] font-bold'
                                    : ''
                                }
                              >
                                {stu.formattedTimeInStep}
                              </span>
                            </div>
                            <div className="text-[var(--comfort-text)] font-semibold">
                              {stu.trialsRecorded > 0 ? `${stu.trialsRecorded}/3 Data` : '0 Data'}
                            </div>
                          </div>

                          {stu.needsHelp ? (
                            <div className="p-2 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-warning-border)] text-[var(--comfort-text)] flex items-start gap-1.5 text-2xs leading-snug font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-[var(--comfort-warning)] shrink-0 mt-0.5" aria-hidden="true" />
                              <div>
                                <span className="font-bold text-[var(--comfort-warning)]">Perlu Arahan:</span>{' '}
                                <span>{stu.helpReason}</span>
                              </div>
                            </div>
                          ) : stu.status === 'Selesai' ? (
                            <div className="flex items-center gap-1 text-2xs font-semibold text-[var(--comfort-success)]">
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                              <span>Sesi Selesai (100%)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-2xs font-medium text-[var(--comfort-accent)] tabular-nums">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--comfort-accent)]" aria-hidden="true" />
                              <span>Nominal (Progres {stu.completionPct}%)</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenQuickNote(stu)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 min-h-[36px] text-2xs font-semibold rounded-lg comfort-btn-secondary cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3 text-[var(--comfort-accent)]" aria-hidden="true" />
                            <span>Beri Catatan Instruktur</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK INSTRUCTOR NOTE MODAL */}
      {quickNoteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--comfort-border)]">
              <div className="space-y-0.5">
                <div className="text-2xs font-semibold text-[var(--comfort-accent)]">
                  Arahan Instruktur Langsung
                </div>
                <h3 className="text-base font-bold text-[var(--comfort-text)]">
                  Kirim Catatan ke {quickNoteStudent.name}
                </h3>
                <p className="text-xs text-[var(--comfort-text-muted)]">
                  {quickNoteStudent.groupId} · Tahap {quickNoteStudent.resolvedStep} (
                  {quickNoteStudent.activeModuleTitle ||
                    quickNoteStudent.currentActivity.split('(')[0].trim()}
                  )
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickNoteStudent(null)}
                className="p-1.5 rounded-lg text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
                aria-label="Tutup modal catatan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendQuickNote} className="space-y-4">
              <div>
                <label
                  htmlFor="quick-note-input"
                  className="block text-xs font-medium text-[var(--comfort-text)] mb-1"
                >
                  Pesan Pembimbingan (akan tampil langsung di layar siswa):
                </label>
                <textarea
                  id="quick-note-input"
                  rows={3}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  className="w-full text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-xl p-3 text-[var(--comfort-text)] focus:outline-none focus:ring-2 focus:ring-[var(--comfort-accent)]"
                  placeholder="Ketik catatan atau pilih saran cepat di bawah..."
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-2xs font-medium text-[var(--comfort-text-muted)]">
                  Pilihan Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setQuickNoteText(
                        'Perhatikan kemiringan garis regresi ΣF = m·a. Pastikan ada minimal 3 variasi data dengan jarak nilai seimbang.'
                      )
                    }
                    className="px-2.5 py-1.5 text-2xs rounded-lg comfort-btn-secondary cursor-pointer"
                  >
                    Petunjuk Garis Regresi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickNoteText(
                        'Amati titik belok pH pada kurva titrasi buret di sekitar volume 20 mL untuk akurasi titik ekuivalen.'
                      )
                    }
                    className="px-2.5 py-1.5 text-2xs rounded-lg comfort-btn-secondary cursor-pointer"
                  >
                    Titik Ekuivalen Kimia
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickNoteText(
                        'Kerja bagus! Lanjutkan ke tahap analisis grafik dan lengkapi pertanyaan LKS.'
                      )
                    }
                    className="px-2.5 py-1.5 text-2xs rounded-lg comfort-btn-secondary cursor-pointer"
                  >
                    Apresiasi &amp; Lanjut LKS
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--comfort-border)]">
                <button
                  type="button"
                  onClick={() => setQuickNoteStudent(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl comfort-btn-secondary cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!quickNoteText.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl comfort-btn-primary disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kirim ke Siswa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
