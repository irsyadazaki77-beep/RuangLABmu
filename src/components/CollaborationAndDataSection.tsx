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
  Camera,
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
import { EducationTier, getExperimentById } from '../registry/experimentRegistry';
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
import { DetailAccordion } from './ui/ProgressiveDisclosure';
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
  activeTier?: EducationTier;
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
  activeTier = 'SMA',
}) => {
  const [domainFilter, setDomainFilter] = useState<'Semua' | ScienceDomain>('Semua');
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDomain, setNewTaskDomain] = useState<ScienceDomain>('Fisika');
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [taskError, setTaskError] = useState<string>('');
  const [showCompareView, setShowCompareView] = useState<boolean>(false);
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
      tier: activeTier,
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
      {/* Practicum Completion Status Strip */}
      <div
        data-testid="stage4-completion-summary"
        className="rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-2xs"
      >
        <span className="font-bold text-[var(--comfort-text)]">Ringkasan Ketuntasan Praktikum:</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
          <span className={records.length >= 3 ? 'text-[var(--comfort-success)] font-semibold' : 'text-[var(--comfort-warning)] font-semibold'}>
            Data Observasi: {records.length}/3 {records.length >= 3 ? '✓' : '(Disarankan ≥ 3)'}
          </span>
          <span className={hypothesisNote?.reflectionText?.trim() ? 'text-[var(--comfort-success)] font-semibold' : 'text-[var(--comfort-text-muted)]'}>
            Refleksi Hipotesis: {hypothesisNote?.reflectionText?.trim() ? 'Terisi ✓' : 'Opsional'}
          </span>
          <span className="text-[var(--comfort-text-muted)]">
            Tugas Kelompok: {tasks.filter((t) => t.completed).length}/{tasks.length}
          </span>
        </div>
      </div>

      {/* Step 4 Header & Final Export Center */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-[var(--comfort-accent)]">
            Tahap 4 · Laporan Praktikum &amp; Kolaborasi Kelompok
          </div>
          <h1 className="text-lg font-bold text-[var(--comfort-text)]">
            Pusat Ekspor Laporan Praktikum &amp; Diskusi Kelompok
          </h1>
          <p className="text-[var(--comfort-text-muted)] comfort-report-prose">
            Tinjau perbandingan percobaan, lengkapi refleksi hipotesis, lalu cetak laporan akademik A4 atau unduh data CSV.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {onBackToAnalysis && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onBackToAnalysis();
                }}
                className="comfort-btn-secondary px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                ← Grafik &amp; LKS
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                setShowCompareView((v) => !v);
              }}
              className={`px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                showCompareView
                  ? 'comfort-accent-soft'
                  : 'comfort-btn-secondary'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showCompareView ? 'Tutup Diff' : 'Bandingkan'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                downloadAcademicReportFile(buildReportData(), 'html');
              }}
              disabled={records.length === 0}
              className="comfort-btn-secondary flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
              <span>.HTML</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={filteredRecords.length === 0}
              className="comfort-btn-secondary flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
            >
              <Download className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
              <span>CSV ({filteredRecords.length})</span>
            </button>
            {onBackToCatalog && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onBackToCatalog();
                }}
                className="comfort-btn-secondary px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Katalog
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrintAcademicReport}
            disabled={records.length === 0}
            className="comfort-btn-primary flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-bold disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pratinjau &amp; Cetak A4</span>
          </button>
        </div>
      </div>

      {/* Primary Workspace: Group Tasks & Discussion Notes (centered & prominent) */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--comfort-border)] pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-[var(--comfort-text)]">
              Kolaborasi Kelompok · {activeGroupId}
            </h2>
          </div>
          <span className="text-xs text-[var(--comfort-text-muted)]">
            Praktikan aktif: <strong className="text-[var(--comfort-text)]">{activeStudentName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Shared Experiment Tasks Checklist (6 cols) */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="text-xs font-semibold text-[var(--comfort-text)]">
              Target Pengamatan Kelompok ({tasks.filter((t) => t.completed).length}/{tasks.length} Selesai)
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
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
                      ? 'bg-[var(--comfort-success-soft)] border-[var(--comfort-success-border)] text-[var(--comfort-text-muted)]'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] hover:border-[var(--comfort-accent-border)] text-[var(--comfort-text)]'
                  }`}
                >
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 text-[var(--comfort-success)] shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-[var(--comfort-text-muted)] shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs flex-1">
                    <div className={task.completed ? 'line-through' : 'font-medium'}>
                      {task.title}
                    </div>
                    <div className="text-2xs text-[var(--comfort-text-muted)] mt-0.5 font-mono">
                      {task.domain} · {task.groupId}
                      {task.completedBy ? ` · ${task.completedBy}` : ''}
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
                  className="text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2 py-1.5 text-[var(--comfort-text)] focus:outline-none focus:border-[var(--comfort-accent)]"
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
                  className="flex-1 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2.5 py-1.5 text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:border-[var(--comfort-accent)]"
                />
                <button
                  type="submit"
                  className="comfort-btn-primary px-2.5 py-1.5 rounded-md transition-colors shrink-0 flex items-center gap-1 text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </div>
              {taskError && (
                <p className="text-2xs text-[var(--comfort-danger)]">{taskError}</p>
              )}
            </form>
          </div>

          {/* Shared Group Discussion & Teacher Feedback Feed (6 cols) */}
          <div className="lg:col-span-6 space-y-2.5 lg:border-l lg:border-[var(--comfort-border)] lg:pl-6">
            <div className="text-xs font-semibold text-[var(--comfort-text)]">
              Catatan Diskusi &amp; Umpan Balik ({notes.length})
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-3 rounded-lg border ${
                    note.role === 'Pengajar'
                      ? 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)] text-[var(--comfort-text)]'
                      : 'bg-[var(--comfort-surface-subtle)] border-[var(--comfort-border)] text-[var(--comfort-text)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-2xs text-[var(--comfort-text-muted)] mb-1">
                    <span className="font-semibold text-[var(--comfort-text)]">
                      {note.author} · {note.role}
                    </span>
                    <span className="font-mono tabular-nums">{note.timestamp}</span>
                  </div>
                  <p className="comfort-report-prose">{note.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddNote} className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Tulis kesimpulan atau diskusi..."
                className="flex-1 text-xs bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-md px-2.5 py-1.5 text-[var(--comfort-text)] placeholder:text-[var(--comfort-text-muted)] focus:outline-none focus:border-[var(--comfort-accent)]"
              />
              <button
                type="submit"
                className="comfort-btn-primary px-3 py-1.5 rounded-md transition-colors shrink-0 flex items-center gap-1 text-xs font-medium cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Kirim
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Optional Side-by-Side Trial Comparator & Hypothesis (collapsed by default) */}
      {showCompareView && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
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

      {/* Collapsible Secondary Archive Panels */}
      <div className="space-y-3">
        <DetailAccordion
          title="Arsip Tabel Data Eksperimen"
          meta={`${filteredRecords.length} baris`}
          icon={<FileSpreadsheet className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="stage4-records-archive-accordion"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <span className="text-2xs font-mono text-[var(--comfort-text-muted)] tabular-nums">
                {filteredRecords.length} dari {records.length} data
              </span>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-[var(--comfort-border)] space-y-1.5">
                <div className="text-xs font-semibold text-[var(--comfort-text)]">
                  Belum ada data eksperimen untuk filter domain {domainFilter}.
                </div>
                <p className="text-xs text-[var(--comfort-text-muted)]">
                  Rekam variasi percobaan di ruang 3D menggunakan tombol &ldquo;+ Catat Data&rdquo;.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-lg border border-[var(--comfort-border)]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--comfort-surface-subtle)] border-b border-[var(--comfort-border)] text-[var(--comfort-text-muted)] font-mono text-2xs">
                      <th className="py-2.5 px-3">ID &amp; Waktu</th>
                      <th className="py-2.5 px-3">Praktikan</th>
                      <th className="py-2.5 px-3">Modul &amp; Parameter</th>
                      <th className="py-2.5 px-3">Hasil Utama</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--comfort-border)]">
                    {filteredRecords.map((rec) => (
                      <motion.tr
                        key={rec.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="hover:bg-[var(--comfort-surface-subtle)] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap align-top">
                          <div className="font-semibold text-[var(--comfort-text)]">
                            {rec.id}
                          </div>
                          <div className="text-2xs text-[var(--comfort-text-muted)]">
                            {rec.timestamp} · {rec.domain}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap align-top">
                          <div className="font-medium text-[var(--comfort-text)]">
                            {rec.studentName}
                          </div>
                          <div className="text-2xs text-[var(--comfort-text-muted)]">
                            {rec.groupId}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 align-top max-w-xs">
                          <div className="font-semibold text-[var(--comfort-text)]">
                            {rec.experimentTitle}
                          </div>
                          <div className="font-mono text-2xs text-[var(--comfort-text-muted)] mt-0.5 leading-relaxed">
                            {rec.parametersSummary}
                          </div>
                          {rec.notes && (
                            <div className="text-2xs text-[var(--comfort-text-muted)] mt-1 italic leading-relaxed">
                              &ldquo;{rec.notes}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-2xs align-top tabular-nums">
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
                            className="p-1.5 text-[var(--comfort-text-muted)] hover:text-[var(--comfort-danger)] rounded transition-colors cursor-pointer"
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
        </DetailAccordion>

        <DetailAccordion
          title="Galeri Cuplikan 3D, Replay & Peringkat Kelas"
          meta={`${snapshots3D.length} cuplikan${students.length > 0 ? ` · ${students.length} siswa` : ''}`}
          icon={<Camera className="w-4 h-4 text-[var(--comfort-accent)]" aria-hidden="true" />}
          defaultOpen={false}
          testId="stage4-snapshots-leaderboard-accordion"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
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
        </DetailAccordion>
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
