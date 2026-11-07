import React, { useState } from 'react';
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
