import React, { useState } from 'react';
import {
  Download,
  Trash2,
  CheckSquare,
  Square,
  Send,
  Plus,
  Users,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react';
import { ExperimentRecord, exportRecordsToCSV, ScienceDomain } from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import { openPrintableAcademicReport } from '../utils/academicReportExporter';

export interface GroupTaskItem {
  id: string;
  groupId: string;
  title: string;
  domain: ScienceDomain;
  completed: boolean;
  completedBy?: string;
}

export interface CollabNoteItem {
  id: string;
  groupId: string;
  author: string;
  role: 'Siswa' | 'Pengajar';
  text: string;
  timestamp: string;
}

interface CollaborationAndDataSectionProps {
  records: ExperimentRecord[];
  tasks: GroupTaskItem[];
  notes: CollabNoteItem[];
  activeGroupId: string;
  activeStudentName: string;
  onDeleteRecord: (id: string) => void;
  onToggleTask: (id: string) => void;
  onCreateTask: (title: string, domain: ScienceDomain) => void;
  onCreateNote: (text: string) => void;
  onCSVExported: (count: number) => void;
}

export const CollaborationAndDataSection: React.FC<
  CollaborationAndDataSectionProps
> = ({
  records,
  tasks,
  notes,
  activeGroupId,
  activeStudentName,
  onDeleteRecord,
  onToggleTask,
  onCreateTask,
  onCreateNote,
  onCSVExported,
}) => {
  const [domainFilter, setDomainFilter] = useState<
    'Semua' | ScienceDomain
  >('Semua');
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDomain, setNewTaskDomain] = useState<ScienceDomain>('Fisika');
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [taskError, setTaskError] = useState<string>('');

  const filteredRecords = records.filter((r) =>
    domainFilter === 'Semua' ? true : r.domain === domainFilter
  );

  const handleDownloadCSV = () => {
    labSound.playClick();
    const csvContent = exportRecordsToCSV(filteredRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `simulab-data-eksperimen-${domainFilter.toLowerCase()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onCSVExported(filteredRecords.length);
  };

  const handlePrintAcademicReport = () => {
    labSound.playClick();
    const firstRec = filteredRecords[0] || records[0];
    const expTitle = firstRec ? firstRec.experimentTitle : 'Praktikum Laboratorium Terpadu';
    const domainStr = firstRec ? firstRec.domain : 'Sains Terintegrasi';

    openPrintableAcademicReport({
      experimentTitle: expTitle,
      studentName: activeStudentName,
      groupId: activeGroupId,
      tier: 'SMA',
      dateStr: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      timeStr: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      domain: domainStr,
      records: filteredRecords.length > 0 ? filteredRecords : records,
      discussionNotes: notes.map((n) => `[${n.author}]: ${n.text}`).join('\n\n'),
      conclusionNotes: `Praktikum kolaborasi ${activeGroupId} berhasil memverifikasi prinsip dasar sains dengan ${records.length} variasi data terukur.`,
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      setTaskError('Masukkan deskripsi tugas kelompok terlebih dahulu.');
      return;
    }
    setTaskError('');
    labSound.playClick();
    onCreateTask(newTaskTitle.trim(), newTaskDomain);
    setNewTaskTitle('');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    labSound.playClick();
    onCreateNote(newNoteText.trim());
    setNewNoteText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Experiment Data Log & CSV Export Table (7 cols) */}
      <div className="lg:col-span-7 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Tabel Pencatatan Data Eksperimen ({filteredRecords.length} Baris)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Data tersinkronisasi otomatis untuk seluruh anggota kelompok dan dapat diekspor ke CSV
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Domain Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200/70 dark:border-slate-700">
              {(['Semua', 'Fisika', 'Kimia', 'Biologi', 'Astronomi'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setDomainFilter(tab);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    domainFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePrintAcademicReport}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 border border-slate-300 dark:border-slate-700"
            >
              <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Cetak Laporan Resmi Praktikum
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Belum ada data eksperimen untuk filter ini
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Klik tombol &ldquo;Rekam Data Eksperimen ke Tabel Log&rdquo; pada panel kontrol simulasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 pr-3">Waktu & Siswa</th>
                  <th className="py-2.5 px-3">Eksperimen & Parameter</th>
                  <th className="py-2.5 px-3">Hasil Pengukuran</th>
                  <th className="py-2.5 pl-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 pr-3 align-top">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {rec.studentName}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {rec.timestamp} · {rec.domain}
                      </div>
                      <div className="text-slate-400 dark:text-slate-500 mt-0.5">
                        {rec.groupId}
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {rec.experimentTitle}
                      </div>
                      <div className="font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                        {rec.parametersSummary}
                      </div>
                      {rec.notes && (
                        <div className="text-slate-500 dark:text-slate-400 italic mt-1">
                          &ldquo;{rec.notes}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top font-mono tabular-nums">
                      <div className="space-y-0.5">
                        {Object.entries(rec.keyMetrics).map(([k, v]) => (
                          <div key={k} className="text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500 dark:text-slate-400">
                              {k}:
                            </span>{' '}
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pl-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          onDeleteRecord(rec.id);
                        }}
                        aria-label={`Hapus data ${rec.experimentTitle}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Group Collaboration Panel: Shared Checklist & Live Discussion (5 cols) */}
      <div className="lg:col-span-5 bg-white/95 dark:bg-slate-900/85 lab-glass-panel border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Kolaborasi Kelompok Real-Time
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sesi Aktif:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {activeGroupId}
              </strong>{' '}
              · Siswa:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {activeStudentName}
              </strong>
            </p>
          </div>
        </div>

        {/* Shared Group Tasks Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Daftar Tugas Praktikum Kelompok (
              {tasks.filter((t) => t.completed).length}/{tasks.length} Selesai)
            </h3>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50"
              >
                <button
                  type="button"
                  onClick={() => {
                    labSound.playStep();
                    onToggleTask(task.id);
                  }}
                  aria-label={`Tandai tugas ${task.title}`}
                  className="mt-0.5 text-sky-600 dark:text-sky-400 hover:text-sky-700 shrink-0"
                >
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
                <div className="flex-1 text-xs">
                  <div
                    className={
                      task.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-200 font-medium'
                    }
                  >
                    {task.title}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {task.domain} · {task.groupId}
                    {task.completedBy
                      ? ` · Diselesaikan oleh ${task.completedBy}`
                      : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Group Task Form */}
          <form onSubmit={handleAddTask} className="space-y-1.5">
            <div className="flex gap-2">
              <select
                aria-label="Pilih domain tugas kelompok"
                value={newTaskDomain}
                onChange={(e) =>
                  setNewTaskDomain(
                    e.target.value as 'Fisika' | 'Kimia' | 'Astronomi'
                  )
                }
                className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-2 text-slate-800 dark:text-slate-200"
              >
                <option value="Fisika">Fisika</option>
                <option value="Kimia">Kimia</option>
                <option value="Astronomi">Astronomi</option>
              </select>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => {
                  setNewTaskTitle(e.target.value);
                  if (taskError) setTaskError('');
                }}
                placeholder="Tambah target eksperimen kelompok..."
                className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <button
                type="submit"
                aria-label="Tambah Tugas Kelompok"
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </button>
            </div>
            {taskError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {taskError}
              </p>
            )}
          </form>
        </div>

        {/* Live Group Discussion & Shared Observations */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Diskusi & Catatan Kolaborasi Sesi
          </h3>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-2.5 rounded-lg border text-xs ${
                  note.role === 'Pengajar'
                    ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/80'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {note.author} · {note.role}
                  </span>
                  <span className="font-mono">{note.timestamp}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {note.text}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Bagikan hipotesis atau hasil analisis ke kelompok..."
              className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
