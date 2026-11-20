import React, { useState } from 'react';
import { motion } from 'motion/react';
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
  ArrowLeftRight,
} from 'lucide-react';
import {
  ExperimentRecord,
  exportRecordsToCSV,
  ScienceDomain,
  calculateLinearRegression,
} from '../utils/scienceEngine';
import { labSound } from '../utils/soundEngine';
import {
  AcademicReportData,
  downloadAcademicReportFile,
} from '../utils/academicReportExporter';
import { computeMeasurementErrorSummary } from '../utils/uncertaintyEngine';
import { getLabSafetyLicenseForModule } from '../services/labLicenseEngine';
import { getExperimentById } from '../registry/experimentRegistry';
import { AcademicReportPreviewModal } from './ui/AcademicReportPreviewModal';
import {
  HypothesisNote,
  HypothesisScratchpadCard,
  ExperimentTrialComparePanel,
} from './ui/HypothesisAndCompareDock';
import {
  Lab3DSnapshot,
  SnapshotAndReplayGallery,
  ClassLeaderboardCard,
} from './ui/ScientificEnhancementSuite';
import type { StudentProgressItem } from './TeacherDashboardView';

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
  onBackToAnalysis?: () => void;
  onBackToCatalog?: () => void;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (next: HypothesisNote) => void;
  snapshots3D?: Lab3DSnapshot[];
  onDeleteSnapshot?: (id: string) => void;
  onReplayRecord?: (rec: ExperimentRecord) => void;
  students?: StudentProgressItem[];
  moduleId?: string;
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
  onBackToAnalysis,
  onBackToCatalog,
  hypothesisNote,
  onChangeHypothesisNote,
  moduleId,
  snapshots3D = [],
  onDeleteSnapshot,
  onReplayRecord,
  students = [],
}) => {
  const [domainFilter, setDomainFilter] = useState<'Semua' | ScienceDomain>('Semua');
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDomain, setNewTaskDomain] = useState<ScienceDomain>('Fisika');
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [taskError, setTaskError] = useState<string>('');
  const [showCompareView, setShowCompareView] = useState<boolean>(true);
  const [reportModalData, setReportModalData] =
    useState<AcademicReportData | null>(null);

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

  const buildReportData = (): AcademicReportData => {
    const activeRecs = filteredRecords.length > 0 ? filteredRecords : records;
    const firstRec = activeRecs[0];
    const expTitle = firstRec
      ? firstRec.experimentTitle
      : 'Praktikum Laboratorium Terpadu';
    const domainStr = firstRec ? firstRec.domain : 'Sains Terintegrasi';

    const pts = activeRecs
      .filter((r) => r.numericX !== undefined && r.numericY1 !== undefined)
      .map((r, idx) => ({ x: r.numericX ?? idx + 1, y: r.numericY1 ?? 0 }));
    const reg = pts.length >= 2 ? calculateLinearRegression(pts) : undefined;
    const resolvedModule = moduleId ? getExperimentById(moduleId) : undefined;
    const simLicense = moduleId
      ? getLabSafetyLicenseForModule(moduleId)
      : null;
    const errorStats = computeMeasurementErrorSummary(pts.map((p) => p.y));

    const predXNum = hypothesisNote?.predictedX?.trim() ? Number(hypothesisNote.predictedX.trim()) : NaN;
    const predYNum = hypothesisNote?.predictedY?.trim() ? Number(hypothesisNote.predictedY.trim()) : NaN;
    const hasValidPoeCoords = Number.isFinite(predXNum) && Number.isFinite(predYNum);
    const actualYAtPredX =
      hasValidPoeCoords && reg ? reg.slopeM * predXNum + reg.interceptC : undefined;
    const poeDevPct =
      hasValidPoeCoords && actualYAtPredX !== undefined && Math.abs(actualYAtPredX) > 1e-9
        ? (Math.abs(predYNum - actualYAtPredX) / Math.abs(actualYAtPredX)) * 100
        : undefined;

    const trialDiffSummary =
      activeRecs.length >= 2
        ? {
            runALabel: `${activeRecs[0].id} (${activeRecs[0].timestamp})`,
            runBLabel: `${activeRecs[1].id} (${activeRecs[1].timestamp})`,
            keyDifferences: [
              `Run A: ${activeRecs[0].parametersSummary} → ${Object.entries(activeRecs[0].keyMetrics)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')}`,
              `Run B: ${activeRecs[1].parametersSummary} → ${Object.entries(activeRecs[1].keyMetrics)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')}`,
            ],
          }
        : undefined;

    return {
      experimentTitle: resolvedModule?.title || expTitle,
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
      module: resolvedModule,
      records: activeRecs,
      snapshots3D,
      regressionSummary: reg
        ? {
            slope: reg.slopeM,
            intercept: reg.interceptC,
            rSquared: reg.rSquared,
            formula: reg.equationString,
            modelLabel: 'Regresi Linier OLS',
            equationString: reg.equationString,
            expectedSlopeMeaning: resolvedModule?.defaultRegressionAxes?.expectedSlopeMeaning,
          }
        : undefined,
      trialComparisonSummary: trialDiffSummary,
      hypothesisSummary: hypothesisNote
        ? {
            independentVar: hypothesisNote.independentVar,
            dependentVar: hypothesisNote.dependentVar,
            hypothesisText: hypothesisNote.hypothesisText,
            reflectionText: hypothesisNote.reflectionText,
          }
        : undefined,
      simLabLicense: simLicense
        ? {
            licenseCode: simLicense.licenseId,
            status: simLicense.status,
            quizScore: simLicense.preLabQuizScorePct,
            issuedDateStr: simLicense.issuedAtFormatted,
          }
        : undefined,
      poeEvaluationSummary:
        hasValidPoeCoords || hypothesisNote?.predictedTrend
          ? {
              predictedTrend: hypothesisNote?.predictedTrend,
              predictedX: hasValidPoeCoords ? predXNum : undefined,
              predictedY: hasValidPoeCoords ? predYNum : undefined,
              actualYAtPredictedX: actualYAtPredX,
              deviationPct: poeDevPct,
            }
          : undefined,
      uncertaintySummary:
        errorStats.n > 0
          ? {
              metricLabel: resolvedModule?.defaultRegressionAxes?.yKey || 'Metrik Utama (Y1)',
              n: errorStats.n,
              mean: errorStats.mean,
              sampleStdDev: errorStats.sampleStdDev,
              standardErrorMean: errorStats.standardErrorMean,
              instrumentUncertainty: errorStats.instrumentUncertainty,
              combinedUncertainty: errorStats.combinedUncertainty,
              relativeUncertaintyPct: errorStats.relativeUncertaintyPct,
              percentErrorVsTheory: errorStats.percentErrorVsTheory ?? null,
              precisionGrade: errorStats.precisionGrade,
              recommendedSignificantFigures: errorStats.recommendedSignificantFigures,
            }
          : undefined,
      discussionNotes: notes.map((n) => `[${n.author}]: ${n.text}`).join('\n\n'),
      conclusionNotes:
        hypothesisNote?.reflectionText?.trim() ||
        `Praktikum kolaborasi ${activeGroupId} berhasil memverifikasi prinsip dasar sains dengan ${records.length} variasi data terukur.`,
    };
  };

  const handlePrintAcademicReport = () => {
    labSound.playClick();
    setReportModalData(buildReportData());
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
    <div className="space-y-5">
      {/* Step 4 Header & Final Export Center */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            04. Tahap Penyelesaian Laporan, Komparasi Data &amp; Kolaborasi Kelompok
          </div>
          <h1 className="text-lg font-bold text-[var(--comfort-text)] mt-0.5">
            Pusat Ekspor Laporan Praktikum &amp; Diskusi Kelompok
          </h1>
          <p className="text-xs text-[var(--comfort-text-muted)] mt-0.5 comfort-prose">
            Tinjau perbandingan 2 percobaan berdampingan, lengkapi refleksi hipotesis, lalu unduh laporan akademik resmi (PDF/Cetak) atau berkas data CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              setShowCompareView((v) => !v);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              showCompareView
                ? 'bg-sky-600/15 border-sky-500 text-sky-700 dark:text-sky-300'
                : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)]'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{showCompareView ? 'Sembunyikan Diff' : 'Tampilkan Diff'}</span>
          </button>

          {onBackToAnalysis && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToAnalysis();
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] hover:opacity-90 transition-colors cursor-pointer whitespace-nowrap"
            >
              ← Kembali ke Grafik &amp; LKS
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintAcademicReport}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Pratinjau &amp; Cetak Laporan A4
          </button>
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              downloadAcademicReportFile(buildReportData(), 'html');
            }}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[var(--comfort-text)] bg-[var(--comfort-surface-subtle)] hover:opacity-90 border border-[var(--comfort-border)] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-sky-500" />
            Laporan .HTML
          </button>
          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Data CSV ({filteredRecords.length})
          </button>
          {onBackToCatalog && (
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToCatalog();
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] hover:opacity-90 transition-colors cursor-pointer whitespace-nowrap"
            >
              Pilih Modul Baru
            </button>
          )}
        </div>
      </div>

      {/* 3D Snapshot Gallery & Trial Replay + Class Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={students.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <SnapshotAndReplayGallery
            snapshots={snapshots3D}
            records={records}
            onDeleteSnapshot={onDeleteSnapshot}
            onReplayRecord={onReplayRecord}
          />
        </div>
        {students.length > 0 && (
          <div className="lg:col-span-5">
            <ClassLeaderboardCard
              students={students}
              highlightStudentName={activeStudentName}
            />
          </div>
        )}
      </div>

      {/* Hypothesis Scratchpad + Side-by-Side Trial Comparator Row */}
      {showCompareView && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <ExperimentTrialComparePanel records={records} />
          </div>
          <div className="lg:col-span-5">
            {hypothesisNote && onChangeHypothesisNote && (
              <HypothesisScratchpadCard
                moduleTitle={records[0]?.experimentTitle || 'Modul Praktikum'}
                note={hypothesisNote}
                onChangeNote={onChangeHypothesisNote}
                records={records}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Experiment Data Log & CSV Export Table (7 cols) */}
        <div className="lg:col-span-7 bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--comfort-text)]">
                Tabel Pencatatan Data Eksperimen ({filteredRecords.length} Baris)
              </h2>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Data tersinkronisasi otomatis untuk seluruh anggota kelompok dan dapat diekspor ke CSV
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Domain Segmented Filter */}
              <div className="flex items-center gap-1 p-1 bg-[var(--comfort-surface-subtle)] rounded-lg border border-[var(--comfort-border)]">
                {(['Semua', 'Fisika', 'Kimia', 'Biologi', 'Astronomi'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      setDomainFilter(tab);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      domainFilter === tab
                        ? 'bg-[var(--comfort-surface)] text-[var(--comfort-text)] shadow-xs font-semibold'
                        : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-[var(--comfort-border)] space-y-2">
              <FileSpreadsheet className="w-6 h-6 text-[var(--comfort-text-muted)] mx-auto" />
              <div className="text-xs font-semibold text-[var(--comfort-text)]">
                Belum ada data eksperimen untuk filter domain {domainFilter}.
              </div>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Jalankan simulasi pada panel Fisika, Kimia, Biologi, atau Astronomi lalu klik &ldquo;+ Catat Data&rdquo;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-lg border border-[var(--comfort-border)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] text-[var(--comfort-text-muted)] font-mono text-[11px]">
                    <th className="py-2.5 px-3">ID &amp; Waktu</th>
                    <th className="py-2.5 px-3">Praktikan</th>
                    <th className="py-2.5 px-3">Modul &amp; Parameter</th>
                    <th className="py-2.5 px-3">Hasil Pengukuran Utama</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--comfort-border)]">
                  {filteredRecords.map((rec) => (
                    <motion.tr
                      key={rec.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-[var(--comfort-surface-subtle)] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap align-top">
                        <div className="font-semibold text-[var(--comfort-text)]">
                          {rec.id}
                        </div>
                        <div className="text-[11px] text-[var(--comfort-text-muted)]">
                          {rec.timestamp} · {rec.domain}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap align-top">
                        <div className="font-medium text-[var(--comfort-text)]">
                          {rec.studentName}
                        </div>
                        <div className="text-[11px] text-[var(--comfort-text-muted)]">
                          {rec.groupId}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top max-w-xs">
                        <div className="font-semibold text-[var(--comfort-text)]">
                          {rec.experimentTitle}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--comfort-text-muted)] mt-0.5">
                          {rec.parametersSummary}
                        </div>
                        {rec.notes && (
                          <div className="text-[11px] text-[var(--comfort-text-muted)] mt-1 italic">
                            &ldquo;{rec.notes}&rdquo;
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] align-top tabular-nums">
                        <div className="space-y-0.5">
                          {Object.entries(rec.keyMetrics).map(([k, v]) => (
                            <div key={k} className="whitespace-nowrap">
                              <span className="text-[var(--comfort-text-muted)]">
                                {k}:
                              </span>{' '}
                              <span className="font-semibold text-[var(--comfort-text)]">
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => {
                            labSound.playClick();
                            onDeleteRecord(rec.id);
                          }}
                          title="Hapus baris data"
                          className="p-1.5 text-[var(--comfort-text-muted)] hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Multi-User Group Collaboration: Checklist & Discussion Notes (5 cols) */}
        <div className="lg:col-span-5 bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--comfort-border)] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--comfort-text)] flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Kolaborasi Kelompok Praktikum
              </h2>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                Aktif: <strong className="text-[var(--comfort-text)]">{activeGroupId}</strong> ({activeStudentName})
              </p>
            </div>
          </div>

          {/* Shared Experiment Tasks Checklist */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--comfort-text)]">
              Target Pengamatan Kelompok ({tasks.filter((t) => t.completed).length}/{tasks.length} Selesai)
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    onToggleTask(task.id);
                  }}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    task.completed
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-[var(--comfort-text-muted)]'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] hover:border-sky-500/40 text-[var(--comfort-text)]'
                  }`}
                >
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs flex-1">
                    <div className={task.completed ? 'line-through' : 'font-medium'}>
                      {task.title}
                    </div>
                    <div className="text-[11px] text-[var(--comfort-text-muted)] mt-0.5 font-mono">
                      {task.domain} · {task.groupId}
                      {task.completedBy ? ` · Diselesaikan oleh ${task.completedBy}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Add New Group Task Form */}
            <form onSubmit={handleAddTask} className="space-y-1.5 pt-1">
              <div className="flex gap-1.5">
                <select
                  aria-label="Pilih Domain Tugas"
                  value={newTaskDomain}
                  onChange={(e) => setNewTaskDomain(e.target.value as ScienceDomain)}
                  className="text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2 py-1.5 text-[var(--comfort-text)] focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="Fisika">Fisika</option>
                  <option value="Kimia">Kimia</option>
                  <option value="Biologi">Biologi</option>
                  <option value="Astronomi">Astronomi</option>
                </select>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => {
                    setNewTaskTitle(e.target.value);
                    if (taskError) setTaskError('');
                  }}
                  placeholder="Tambah tugas eksperimen baru..."
                  className="flex-1 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2.5 py-1.5 text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-500 transition-colors shrink-0 flex items-center gap-1 text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>
              {taskError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{taskError}</p>
              )}
            </form>
          </div>

          {/* Shared Group Discussion & Teacher Feedback Feed */}
          <div className="space-y-2.5 border-t border-[var(--comfort-border)] pt-4">
            <div className="text-xs font-semibold text-[var(--comfort-text)]">
              Catatan Diskusi &amp; Umpan Balik Pengajar
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-2.5 rounded-lg border text-xs ${
                    note.role === 'Pengajar'
                      ? 'bg-amber-500/10 border-amber-500/30 text-[var(--comfort-text)]'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--comfort-text-muted)] mb-1">
                    <span className="font-semibold text-[var(--comfort-text)]">
                      {note.author} · {note.role}
                    </span>
                    <span className="font-mono">{note.timestamp}</span>
                  </div>
                  <p className="leading-relaxed comfort-prose">{note.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddNote} className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Tulis kesimpulan atau diskusi..."
                className="flex-1 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2.5 py-1.5 text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors shrink-0 flex items-center gap-1 text-xs font-medium cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Kirim
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* In-App Printable A4 Academic Report Preview Modal */}
      {reportModalData && (
        <AcademicReportPreviewModal
          isOpen={Boolean(reportModalData)}
          onClose={() => setReportModalData(null)}
          reportData={reportModalData}
        />
      )}
    </div>
  );
};
