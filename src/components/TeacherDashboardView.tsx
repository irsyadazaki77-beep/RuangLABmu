import React, { useState, useMemo } from 'react';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Award,
  ClipboardList,
  Download,
  FileCheck2,
  HelpCircle,
  Radio,
  Flame,
  Clock,
  MessageSquare,
  Sparkles,
  ChevronRight,
  X,
  Compass,
  AlertCircle,
} from 'lucide-react';
import {
  ExperimentRecord,
  ScienceDomain,
  calculateStudentRubric,
  exportRubricGradesToCSV,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
  PRESET_MYSTERY_CHALLENGES,
} from '../utils/mysteryChallengeEngine';
import {
  buildRadarLanes,
  RadarLaneSummary,
  StudentRadarCard,
} from '../utils/telemetryRadar';

export interface StudentProgressItem {
  id: string;
  name: string;
  groupId: string;
  activeDomain: ScienceDomain;
  currentActivity: string;
  trialsRecorded: number;
  tasksCompleted: number;
  totalTasks: number;
  completionPct: number;
  quizScore?: number;
  lastActive: string;
  status: 'Nominal' | 'Butuh Bantuan' | 'Selesai';
  currentStep?: 1 | 2 | 3 | 4;
  activeModuleTitle?: string;
  timeInStepMinutes?: number;
  rSquared?: number;
}

interface TeacherDashboardViewProps {
  students: StudentProgressItem[];
  records: ExperimentRecord[];
  onSendTeacherFeedback: (targetStudentId: string, message: string) => void;
  onExportGradesNotification: (studentCount: number) => void;
  activeMysteryChallenge?: MysterySampleChallenge | null;
  onBroadcastMysteryChallenge?: (challenge: MysterySampleChallenge) => void;
  mysterySubmissions?: MysterySubmissionResult[];
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  students,
  records,
  onSendTeacherFeedback,
  onExportGradesNotification,
  activeMysteryChallenge,
  onBroadcastMysteryChallenge,
  mysterySubmissions = [],
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackError, setFeedbackError] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('Semua');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    PRESET_MYSTERY_CHALLENGES[0].id
  );

  // Quick note modal state for Telemetry Radar cards
  const [quickNoteStudent, setQuickNoteStudent] = useState<StudentRadarCard | null>(null);
  const [quickNoteText, setQuickNoteText] = useState<string>('');

  const radarLanes = useMemo(() => {
    return buildRadarLanes(students, groupFilter);
  }, [students, groupFilter]);

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

  const avgCompletion =
    students.length > 0
      ? Math.round(
          students.reduce((acc, s) => acc + s.completionPct, 0) / students.length
        )
      : 0;

  const totalTrials = records.length;
  const studentsNeedingHelp = students.filter(
    (s) => s.status === 'Butuh Bantuan'
  ).length;

  const groups = [
    'Semua',
    ...Array.from(new Set(students.map((s) => s.groupId))),
  ];

  const visibleStudents = students.filter((s) =>
    groupFilter === 'Semua' ? true : s.groupId === groupFilter
  );

  const rubricRows = visibleStudents.map((stu) => calculateStudentRubric(stu));

  const handleExportClassGradesCSV = () => {
    labSound.playClick();
    const allRubrics = students.map((stu) => calculateStudentRubric(stu));
    const csvContent = exportRubricGradesToCSV(allRubrics);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'simulab-rekap-nilai-rubrik-kelas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportGradesNotification(allRubrics.length);
  };

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setFeedbackError(
        'Tulis pesan umpan balik atau arahan praktikum terlebih dahulu.'
      );
      return;
    }
    setFeedbackError('');
    labSound.playRecordSuccess();
    onSendTeacherFeedback(selectedStudentId, feedbackMessage.trim());
    setFeedbackMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Top 4-Column Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Siswa Aktif di Laboratorium</span>
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {students.length}
            </span>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 ml-1.5">
              SISWA ONLINE
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Terbagi dalam 3 kelompok praktikum kolaboratif
          </div>
        </div>

        <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rata-Rata Progres Modul</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {avgCompletion}%
            </span>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 ml-1.5">
              TERCAPAI
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Target kurikulum Fisika & Kimia: 80%
          </div>
        </div>

        <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Data Eksperimen Terekam</span>
            <ClipboardList className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {totalTrials}
            </span>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 ml-1.5">
              PERCOBAAN
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Siap dievaluasi dan diekspor ke CSV
          </div>
        </div>

        <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Status Bimbingan Siswa</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {studentsNeedingHelp}
            </span>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 ml-1.5">
              PERLU ARAHAN
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Deteksi otomatis saat percobaan belum konvergen
          </div>
        </div>
      </div>

      {/* TAMPILAN BARU: RADAR PROGRES KELAS REAL-TIME (4 TAHAP PRAKTIKUM) */}
      <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Radar Progres Kelas Real-Time
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                LIVE TELEMETRI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Distribusi siswa sepanjang 4 tahap alur terstruktur · Deteksi anomali (R² &lt; 0.80 atau tertahan &gt; 8 menit)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Filter:</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/70 dark:border-slate-700">
              {groups.map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setGroupFilter(grp);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    groupFilter === grp
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
              { border: 'border-sky-500/30', headerBg: 'bg-sky-500/10 text-sky-400', stepBadge: 'bg-sky-500 text-slate-950' },
              { border: 'border-emerald-500/30', headerBg: 'bg-emerald-500/10 text-emerald-400', stepBadge: 'bg-emerald-500 text-slate-950' },
              { border: 'border-amber-500/30', headerBg: 'bg-amber-500/10 text-amber-400', stepBadge: 'bg-amber-500 text-slate-950' },
              { border: 'border-purple-500/30', headerBg: 'bg-purple-500/10 text-purple-400', stepBadge: 'bg-purple-500 text-white' },
            ][lane.step - 1];

            return (
              <div
                key={lane.step}
                className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 space-y-3"
              >
                {/* Lane Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-5 h-5 rounded-md ${laneColors.stepBadge} font-mono font-bold text-[10px] flex items-center justify-center shrink-0`}>
                      {lane.step}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {lane.title}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {lane.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      {lane.students.length}
                    </span>
                    {lane.needsHelpCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30 flex items-center gap-0.5 animate-pulse">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {lane.needsHelpCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Students Container */}
                <div className="flex-1 space-y-2.5 min-h-[160px]">
                  {lane.students.length === 0 ? (
                    <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800/60 rounded-xl text-slate-400 dark:text-slate-600">
                      <p className="text-xs">Tidak ada siswa</p>
                      <p className="text-[10px] text-slate-400">di tahap ini</p>
                    </div>
                  ) : (
                    lane.students.map((stu) => {
                      const domainColorClass =
                        stu.activeDomain === 'Fisika'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          : stu.activeDomain === 'Kimia'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : stu.activeDomain === 'Biologi'
                          ? 'bg-lime-500/15 text-lime-400 border-lime-500/30'
                          : 'bg-purple-500/15 text-purple-400 border-purple-500/30';

                      const moduleDisplayName =
                        stu.activeModuleTitle ||
                        stu.currentActivity.replace(/^Menjalankan Simulasi |^Menganalisis |^Menguji |^Eksplorasi /i, '').split('(')[0].trim() ||
                        `Praktikum ${stu.activeDomain}`;

                      return (
                        <div
                          key={stu.id}
                          className={`rounded-xl p-3 border transition-all text-xs space-y-2.5 ${
                            stu.needsHelp
                              ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-400 dark:border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.18)] ring-1 ring-amber-400/30'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* Student Header */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {stu.name}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {stu.groupId.split(' — ')[0]}
                              </div>
                            </div>

                            {/* Active Module Domain Pill */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-semibold shrink-0 ${domainColorClass}`}>
                              {stu.activeDomain}
                            </span>
                          </div>

                          {/* Active Module Badge */}
                          <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-1 bg-slate-100/80 dark:bg-slate-800/60 px-2 py-1 rounded-md">
                            {moduleDisplayName}
                          </div>

                          {/* Metrics Row: Time Spent + Recorded Trials */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className={stu.timeInStepMinutes && stu.timeInStepMinutes > 8 ? 'text-amber-500 font-bold' : ''}>
                                {stu.formattedTimeInStep}
                              </span>
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 font-semibold">
                              {stu.trialsRecorded > 0 ? `${stu.trialsRecorded}/3 Data` : '0 Data'}
                            </div>
                          </div>

                          {/* Status Flag */}
                          {stu.needsHelp ? (
                            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 flex items-start gap-1.5 text-[10px] leading-tight font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
                              <div>
                                <span className="font-bold">Butuh Bantuan:</span>{' '}
                                <span>{stu.helpReason}</span>
                              </div>
                            </div>
                          ) : stu.status === 'Selesai' ? (
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Sesi Selesai (100%)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                              <span>Nominal (Progres {stu.completionPct}%)</span>
                            </div>
                          )}

                          {/* Action Button: Beri Catatan Instruktur */}
                          <button
                            type="button"
                            onClick={() => handleOpenQuickNote(stu)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/50 text-slate-700 hover:text-sky-600 dark:text-slate-200 dark:hover:text-sky-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3 text-sky-500" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-[11px] font-mono font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  Arahan Instruktur Langsung
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Kirim Catatan ke {quickNoteStudent.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {quickNoteStudent.groupId} · Tahap {quickNoteStudent.resolvedStep} ({quickNoteStudent.activeModuleTitle || quickNoteStudent.currentActivity.split('(')[0].trim()})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickNoteStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendQuickNote} className="space-y-4">
              <div>
                <label
                  htmlFor="quick-note-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Pesan Pembimbingan (akan tampil langsung di layar siswa):
                </label>
                <textarea
                  id="quick-note-input"
                  rows={3}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                  placeholder="Ketik catatan atau pilih saran cepat di bawah..."
                  autoFocus
                />
              </div>

              {/* Quick Template Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
                    className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer"
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
                    className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer"
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
                    className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Apresiasi & Lanjut LKS
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickNoteStudent(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!quickNoteText.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim ke Siswa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Split: Student Roster & Live Telemetry (8 cols) + Instructor Broadcast Feedback (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Pemantauan Aktivitas & Progres Siswa Secara Langsung
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Memantau parameter yang sedang diuji, jumlah rekaman data, dan penyelesaian tugas tiap siswa
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/70 dark:border-slate-700">
              {groups.map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setGroupFilter(grp);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    groupFilter === grp
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {grp === 'Semua' ? 'Semua Kelompok' : grp.split(' — ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 pr-3">Nama Siswa & Kelompok</th>
                  <th className="py-2.5 px-3">Aktivitas Eksperimen Saat Ini</th>
                  <th className="py-2.5 px-3">Data & Tugas</th>
                  <th className="py-2.5 px-3">Progres</th>
                  <th className="py-2.5 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {visibleStudents.map((stu) => (
                  <tr
                    key={stu.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3.5 pr-3 align-middle">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {stu.name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                        {stu.groupId} · {stu.lastActive}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 align-middle">
                      <div className="text-slate-900 dark:text-white font-medium">
                        {stu.currentActivity}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Modul: Praktikum {stu.activeDomain}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 align-middle font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      <div>{stu.trialsRecorded} Percobaan</div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {stu.tasksCompleted}/{stu.totalTasks} Tugas
                      </div>
                    </td>
                    <td className="py-3.5 px-3 align-middle w-36">
                      <div className="flex items-center justify-between font-mono tabular-nums mb-1">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {stu.completionPct}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            stu.completionPct >= 80
                              ? 'bg-emerald-600 dark:bg-emerald-500'
                              : stu.completionPct >= 50
                              ? 'bg-sky-600 dark:bg-sky-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${stu.completionPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 pl-3 align-middle font-mono whitespace-nowrap">
                      {stu.status === 'Selesai' && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          ● Selesai
                        </span>
                      )}
                      {stu.status === 'Nominal' && (
                        <span className="text-sky-700 dark:text-sky-400 font-semibold">
                          ● Aktif
                        </span>
                      )}
                      {stu.status === 'Butuh Bantuan' && (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          ▲ Butuh Arahan
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Instructor Direct Feedback & Guidance Console (4 cols) */}
        <div className="lg:col-span-4 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Kirim Umpan Balik & Instruksi Pengajar
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pesan akan muncul sebagai notifikasi instan di layar siswa serta tercatat di ruang diskusi kelompok
            </p>
          </div>

          <form onSubmit={handleBroadcastSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="teacher-target-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Penerima Arahan
              </label>
              <select
                id="teacher-target-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="all">
                  Seluruh Kelompok Praktikum (Broadcast)
                </option>
                {students.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    {stu.name} ({stu.groupId} — {stu.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="teacher-feedback-textarea"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Isi Umpan Balik / Petunjuk Eksperimen
              </label>
              <textarea
                id="teacher-feedback-textarea"
                rows={4}
                value={feedbackMessage}
                onChange={(e) => {
                  setFeedbackMessage(e.target.value);
                  if (feedbackError) setFeedbackError('');
                }}
                placeholder="Contoh: Untuk Dimas (Kelompok 2), naikkan suhu kalorimeter di atas 85°C agar dekomposisi CaCO₃ mencapai ΔG < 0..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              {feedbackError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                  {feedbackError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Template Umpan Balik Cepat:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setFeedbackMessage(
                      'Perhatikan hubungan linier ΣF terhadap percepatan a. Pastikan minimal 3 variasi massa dicatat sebelum ekspor CSV.'
                    );
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded transition-colors"
                >
                  Cek Kemiringan Grafik F = m·a
                </button>
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setFeedbackMessage(
                      'Pada titrasi asam-basa, amati lonjakan tajam pH di sekitar titik ekuivalen 20.0 mL dan catat ke LKS.'
                    );
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded transition-colors"
                >
                  Petunjuk Titik Ekuivalen Titrasi
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              Kirim Notifikasi Umpan Balik ke Siswa
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Indikator Evaluasi Otomatis Aktif
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Sistem secara otomatis menilai kemajuan eksperimen, kualitas regresi data, penyelesaian tugas kolaborasi, dan skor LKS setiap siswa.
            </p>
          </div>
        </div>
      </div>

      {/* NEW: Mystery Challenge Broadcast & Exam Leaderboard Panel */}
      <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-amber-300 dark:border-amber-500/30 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 dark:border-amber-500/20 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
              Siaran Ujian Sampel Misterius (Mystery Challenge Engine)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Guru dapat menyiarkan sampel tak dikenal ke semua siswa. Nilai parameter disamarkan menjadi &quot;???&quot; di lab siswa hingga mereka melakukan analisis dan mengirimkan perkiraan.
            </p>
          </div>

          {activeMysteryChallenge && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>SEDANG AKTIF: {activeMysteryChallenge.codename} ({activeMysteryChallenge.domain})</span>
            </div>
          )}
        </div>

        {/* Challenge Selection & Broadcast Action */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="md:col-span-8 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Pilih Paket Tantangan Ujian Misterius:
            </label>
            <select
              value={selectedChallengeId}
              onChange={(e) => setSelectedChallengeId(e.target.value)}
              className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {PRESET_MYSTERY_CHALLENGES.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  [{ch.domain.toUpperCase()}] {ch.codename}: {ch.title} ({ch.difficulty} — Parameter: {ch.hiddenParamLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <button
              type="button"
              onClick={() => {
                labSound.playRecordSuccess();
                const ch = PRESET_MYSTERY_CHALLENGES.find((c) => c.id === selectedChallengeId);
                if (ch && onBroadcastMysteryChallenge) {
                  onBroadcastMysteryChallenge(ch);
                }
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" />
              Siarkan Tantangan ke Semua Siswa
            </button>
          </div>
        </div>

        {/* Live Mystery Submissions Table */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Hasil Jawaban Siswa Pada Ujian Misterius ({mysterySubmissions.length} Dikirim)
          </h3>

          {mysterySubmissions.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              Belum ada siswa yang mengirimkan estimasi ujian misterius. Siarkan tantangan di atas untuk memulai sesi evaluasi sampel.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2 pr-3">Sampel</th>
                    <th className="py-2 px-3 text-right">Tebakan Siswa</th>
                    <th className="py-2 px-3 text-right">Nilai Asli</th>
                    <th className="py-2 px-3 text-right">Galat (%)</th>
                    <th className="py-2 px-3 text-right">Skor</th>
                    <th className="py-2 pl-3">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                  {mysterySubmissions.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-sans font-semibold text-slate-900 dark:text-white">
                        {sub.codename}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        {sub.studentGuess}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {sub.actualValue}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-500 font-bold">
                        {sub.errorPercentage}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {sub.score}/100
                      </td>
                      <td className="py-2.5 pl-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.passed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {sub.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Automated Rubric Grading Matrix & Class CSV Export */}
      <div className="bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Matriks Rubrik Penilaian Otomatis & Rekap Nilai Kelas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kalkulasi objektif berbasis bukti aktivitas: Eksperimen (25%) · Analisis Regresi (25%) · Tugas Kolaborasi (25%) · Skor LKS/Kuis (25%)
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportClassGradesCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor Nilai Kelas (CSV)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 pr-3">Nama Siswa & Kelompok</th>
                <th className="py-2.5 px-3 text-right">Eksperimen (25%)</th>
                <th className="py-2.5 px-3 text-right">Regresi Data (25%)</th>
                <th className="py-2.5 px-3 text-right">Kolaborasi (25%)</th>
                <th className="py-2.5 px-3 text-right">Skor LKS (25%)</th>
                <th className="py-2.5 px-3 text-right">Nilai Akhir</th>
                <th className="py-2.5 pl-3">Predikat Rubrik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono tabular-nums">
              {rubricRows.map((row) => (
                <tr
                  key={row.studentId}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-3 pr-3 font-sans">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {row.studentName}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {row.groupId}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                    {row.experimentScore}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                    {row.regressionAnalysisScore}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                    {row.collaborationScore}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                    {row.worksheetQuizScore}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white text-sm">
                    {row.finalTotalScore}
                  </td>
                  <td className="py-3 pl-3 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        row.letterGrade === 'A'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : row.letterGrade === 'B'
                          ? 'text-sky-700 dark:text-sky-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      Grade {row.letterGrade} · {row.predicate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
