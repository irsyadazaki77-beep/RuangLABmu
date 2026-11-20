import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Search,
  X,
  Award,
  Send,
  RefreshCw,
  FileText,
  PlayCircle,
  Download,
  FolderOpen,
  Upload,
  Printer,
  ArrowUpDown,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
import {
  evaluateSubmissionRubric,
  parseRubricJson,
  type EvaluatedRubricReport,
} from '../../shared/grading/rubricEngine';
import { labSound } from '../../utils/soundEngine';
import { exportGoogleClassroomCSV } from '../../utils/csvExporter';
import { SessionReplayPlayer } from './SessionReplayPlayer';
import {
  verifyAndParseRlabPacket,
  convertPacketToSubmission,
} from '../../utils/offlinePacketProtocol';
import { printBlankStudentWorksheet } from '../../utils/academicReportExporter';
import { EXPERIMENT_CATALOG } from '../../registry/experimentRegistry';

export interface TeacherGradebookHubProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomId?: string;
}

type SortField = 'submittedAt' | 'score' | 'quizScore' | 'studentName';

function resolveSubmissionRubric(sub: LabSubmission): EvaluatedRubricReport {
  if (sub.autoRubric && Array.isArray(sub.autoRubric.criteria)) {
    return sub.autoRubric;
  }
  const parsed = parseRubricJson(sub.rubricJson);
  if (parsed) {
    return parsed;
  }
  return evaluateSubmissionRubric({
    moduleId: sub.moduleId,
    domain: sub.domain,
    hypothesisText: sub.hypothesisText,
    observationData: sub.observationData,
    regressionMetrics: sub.regressionMetrics,
    quizScore: sub.quizScore,
    conclusionText: sub.conclusionText,
  });
}

export const TeacherGradebookHub: React.FC<TeacherGradebookHubProps> = ({
  isOpen,
  onClose,
  activeRoomId,
}) => {
  const [submissions, setSubmissions] = useState<LabSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('Semua');
  const [moduleFilter, setModuleFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Belum Dinilai' | 'Sudah Dinilai'>('Semua');
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRubricOpen, setExpandedRubricOpen] = useState<boolean>(true);
  const [selectedSubmission, setSelectedSubmission] = useState<LabSubmission | null>(null);
  const [replaySubmission, setReplaySubmission] = useState<LabSubmission | null>(null);

  // Form State Evaluasi Guru
  const [gradingScore, setGradingScore] = useState<number>(85);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Bulk .rlab Import Summary State
  const [importSummary, setImportSummary] = useState<{
    totalFiles: number;
    newCount: number;
    updatedCount: number;
    failedCount: number;
    failures: Array<{ fileName: string; reason: string }>;
  } | null>(null);
  const [showFailuresDetail, setShowFailuresDetail] = useState(false);

  const processRlabFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const settleResults = await Promise.allSettled(
      fileArray.map(async (file) => {
        try {
          const text = await file.text();
          const verification = verifyAndParseRlabPacket(text);
          if (!verification.valid || !verification.packet) {
            throw new Error(verification.error || 'Format berkas rusak atau integritas tidak lolos');
          }
          const sub = convertPacketToSubmission(verification.packet);
          const autoRubric = resolveSubmissionRubric(sub);
          return {
            file,
            sub: {
              ...sub,
              autoRubric,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal membaca atau memverifikasi berkas .rlab';
          throw new Error(msg);
        }
      })
    );

    const validItems: Array<{ file: File; sub: LabSubmission }> = [];
    const failures: Array<{ fileName: string; reason: string }> = [];

    settleResults.forEach((res, idx) => {
      const fileName = fileArray[idx]?.name || `berkas-${idx + 1}.rlab`;
      if (res.status === 'fulfilled') {
        validItems.push(res.value);
      } else {
        failures.push({
          fileName,
          reason: res.reason?.message || 'Berkas rusak atau checksum tidak valid',
        });
      }
    });

    let newCount = 0;
    let updatedCount = 0;

    if (validItems.length > 0) {
      setSubmissions((prev) => {
        const subMap = new Map<string, LabSubmission>();
        for (const s of prev) {
          subMap.set(s.id, s);
        }

        for (const item of validItems) {
          const sub = item.sub;
          if (subMap.has(sub.id)) {
            updatedCount += 1;
            const existing = subMap.get(sub.id)!;
            subMap.set(sub.id, {
              ...sub,
              teacherGrade: sub.teacherGrade || existing.teacherGrade,
            });
          } else {
            newCount += 1;
            subMap.set(sub.id, sub);
          }

          fetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          }).catch(() => {});
        }

        const merged = Array.from(subMap.values());
        if (!selectedSubmission && validItems.length > 0) {
          setSelectedSubmission(validItems[0].sub);
          const rubricScore = validItems[0].sub.autoRubric?.score ?? validItems[0].sub.quizScore;
          setGradingScore(Math.min(100, Math.max(70, rubricScore)));
        }
        return merged;
      });

      labSound.playSuccessChime();
      setToastMessage(
        `Impor tuntas: ${newCount} baru, ${updatedCount} diperbarui${
          failures.length > 0 ? `, ${failures.length} gagal` : ''
        }`
      );
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      labSound.playClick(320);
      setToastMessage('Tidak ada berkas .rlab valid yang berhasil diimpor.');
      setTimeout(() => setToastMessage(null), 3500);
    }

    setImportSummary({
      totalFiles: fileArray.length,
      newCount,
      updatedCount,
      failedCount: failures.length,
      failures,
    });
    setShowFailuresDetail(failures.length > 0 && validItems.length === 0);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processRlabFiles(e.target.files);
      e.target.value = '';
    }
  };

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.submissions)) {
          const enriched: LabSubmission[] = data.submissions.map((s: LabSubmission) => ({
            ...s,
            autoRubric: resolveSubmissionRubric(s),
          }));
          setSubmissions(enriched);
          if (enriched.length > 0 && !selectedSubmission) {
            const first = enriched[0];
            setSelectedSubmission(first);
            const defaultScore =
              first.teacherGrade?.score ??
              first.autoRubric?.score ??
              Math.min(100, Math.max(70, first.quizScore));
            setGradingScore(defaultScore);
            setGradingFeedback(
              first.teacherGrade?.feedback || first.autoRubric?.summaryFeedback || ''
            );
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load submissions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSubmissions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || replaySubmission) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, replaySubmission, onClose]);

  const handleSelectSubmission = (sub: LabSubmission) => {
    labSound.playClick();
    const rubric = resolveSubmissionRubric(sub);
    setSelectedSubmission({ ...sub, autoRubric: rubric });
    setGradingScore(
      sub.teacherGrade?.score ?? rubric.score ?? Math.min(100, Math.max(70, sub.quizScore))
    );
    setGradingFeedback(sub.teacherGrade?.feedback || rubric.summaryFeedback || '');
  };

  const handleExportClassroomCSV = () => {
    labSound.playSuccessChime();
    exportGoogleClassroomCSV(
      submissions.map((s) => ({
        ...s,
        autoRubricScore: resolveSubmissionRubric(s).score,
      })),
      true
    );
    setToastMessage(`Rekap CSV Google Classroom (${submissions.length} siswa) berhasil diunduh!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleSort = (field: SortField) => {
    labSound.playClick();
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    setIsSubmittingGrade(true);
    try {
      const res = await fetch(`/api/submissions/${selectedSubmission.id}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: gradingScore,
          feedback: gradingFeedback,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedSub: LabSubmission = {
          ...data.submission,
          autoRubric: resolveSubmissionRubric(data.submission),
        };
        labSound.playSuccessChime();
        setToastMessage(`Nilai untuk ${selectedSubmission.studentName} berhasil disimpan!`);
        setTimeout(() => setToastMessage(null), 3000);

        setSubmissions((prev) =>
          prev.map((s) => (s.id === selectedSubmission.id ? updatedSub : s))
        );
        setSelectedSubmission(updatedSub);
      }
    } catch {
      setToastMessage('Gagal menyimpan nilai.');
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  const availableModules = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      if (s.moduleId) set.add(s.moduleId);
    });
    return Array.from(set);
  }, [submissions]);

  if (!isOpen) return null;

  const filteredSubmissions = submissions
    .filter((sub) => {
      const matchSearch =
        sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.moduleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDomain =
        domainFilter === 'Semua' || sub.domain.toLowerCase() === domainFilter.toLowerCase();

      const matchModule =
        moduleFilter === 'Semua' || sub.moduleId.toLowerCase() === moduleFilter.toLowerCase();

      const isGraded = Boolean(sub.teacherGrade);
      const matchStatus =
        statusFilter === 'Semua'
          ? true
          : statusFilter === 'Sudah Dinilai'
          ? isGraded
          : !isGraded;

      return matchSearch && matchDomain && matchModule && matchStatus;
    })
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'studentName') {
        return a.studentName.localeCompare(b.studentName) * dir;
      }
      if (sortField === 'score') {
        const scoreA = a.teacherGrade?.score ?? resolveSubmissionRubric(a).score;
        const scoreB = b.teacherGrade?.score ?? resolveSubmissionRubric(b).score;
        return (scoreA - scoreB) * dir;
      }
      if (sortField === 'quizScore') {
        return ((a.quizScore ?? 0) - (b.quizScore ?? 0)) * dir;
      }
      const timeA = Date.parse(a.submittedAt) || 0;
      const timeB = Date.parse(b.submittedAt) || 0;
      return (timeA - timeB) * dir;
    });

  const gradedCount = submissions.filter((s) => s.teacherGrade).length;
  const pendingCount = submissions.length - gradedCount;
  const selectedRubric = selectedSubmission ? resolveSubmissionRubric(selectedSubmission) : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buku Nilai dan Penilaian Guru"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFiles(true);
        }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFiles(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processRlabFiles(e.dataTransfer.files);
          }
        }}
        className={`relative w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl bg-[var(--comfort-surface)] border shadow-2xl overflow-hidden transition-all ${
          isDraggingFiles
            ? 'border-teal-400 ring-4 ring-teal-400/30'
            : 'border-[var(--comfort-border)]'
        }`}
      >
        {/* Drag-and-drop overlay */}
        {isDraggingFiles && (
          <div className="absolute inset-0 z-50 bg-teal-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white pointer-events-none space-y-2 animate-fade-in">
            <Upload className="w-12 h-12 text-teal-400 animate-bounce" />
            <h3 className="text-lg font-bold">Lepaskan File Tugas Luring (.rlab) di Sini</h3>
            <p className="text-xs text-teal-200">
              Sistem akan memverifikasi integritas checksum anti-tamper dan memuat nilai ke buku nilai guru secara instan.
            </p>
          </div>
        )}

        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-4 bg-[var(--comfort-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[var(--comfort-text)]">
                  Buku Nilai &amp; Rekap Laporan Guru
                </h2>
                {activeRoomId && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    Room: {activeRoomId}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--comfort-text-muted)]">
                LMS Pipeline: Evaluasi Rubrik Otomatis RK4, regresi OLS, replay kronologi, dan ekspor CSV UTF-8 BOM
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".rlab,application/json"
              className="hidden"
              onChange={handleFilesSelected}
            />

            <button
              type="button"
              data-testid="teacher-print-blank-worksheet-btn"
              onClick={() => {
                labSound.playClick();
                const defaultMod = EXPERIMENT_CATALOG[0];
                printBlankStudentWorksheet(defaultMod, 'SMA');
              }}
              title="Cetak format LKS kosong hemat tinta untuk difotokopi bagi siswa kelas 3T"
              className="px-3.5 py-2 rounded-xl bg-[var(--comfort-surface)] hover:opacity-90 text-[var(--comfort-text)] border border-[var(--comfort-border)] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" />
              <span>🖨️ Cetak LKS Kosong (Untuk Fotokopi Kelas)</span>
            </button>

            <button
              type="button"
              data-testid="import-offline-rlab-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Impor file tugas praktikum luring (.rlab) yang dikumpulkan siswa via Bluetooth / Flashdisk / Hotspot LAN lokal"
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span>📂 Impor File Tugas Siswa (.rlab)</span>
            </button>

            <button
              type="button"
              onClick={handleExportClassroomCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Ekspor Format Rekap LMS / Google Classroom</span>
            </button>

            <button
              type="button"
              onClick={fetchSubmissions}
              disabled={isLoading}
              title="Segarkan Data Laporan"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Buku Nilai"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bulk .rlab Import Summary Banner */}
        {importSummary && (
          <div
            data-testid="rlab-import-summary-banner"
            className="p-3.5 bg-slate-900 border-b border-slate-800 text-xs text-white space-y-2 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-teal-300 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-teal-400" />
                  <span>Hasil Impor Massal .rlab ({importSummary.totalFiles} berkas):</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  ✓ {importSummary.newCount} Sukses Baru
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  ↻ {importSummary.updatedCount} Diperbarui (Deduplikasi)
                </span>
                {importSummary.failedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowFailuresDetail((prev) => !prev)}
                    className="px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-semibold border border-rose-500/40 hover:bg-rose-500/35 cursor-pointer underline flex items-center gap-1"
                  >
                    ✕ {importSummary.failedCount} Gagal {showFailuresDetail ? '▲ Sembunyikan' : '▼ Rincian'}
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[11px]">
                    0 Gagal
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                aria-label="Tutup Ringkasan Impor"
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showFailuresDetail && importSummary.failures.length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/30 space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                <div className="font-bold text-rose-300">Daftar Berkas Gagal &amp; Penyebab:</div>
                {importSummary.failures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-rose-200">
                    <span className="text-rose-400 shrink-0">• {f.fileName}:</span>
                    <span className="text-rose-300/90">{f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Counters, Search, Module Filter & Sortable Column Controls */}
        <div className="p-4 border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--comfort-surface)] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] font-semibold text-[var(--comfort-text)]">
              Total Laporan: <strong className="font-mono text-[var(--comfort-text)] tabular-nums">{submissions.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              <span>Belum Dinilai: {pendingCount}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Selesai Dinilai: {gradedCount}</span>
            </span>

            {/* Sortable Score & Date Column Buttons */}
            <div className="inline-flex items-center gap-1 bg-[var(--comfort-surface-subtle)] p-0.5 rounded-xl border border-[var(--comfort-border)]">
              <button
                type="button"
                onClick={() => handleToggleSort('score')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  sortField === 'score'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
                title="Urutkan berdasarkan Skor Akhir / Rubrik"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Skor {sortField === 'score' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleSort('quizScore')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  sortField === 'quizScore'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
                title="Urutkan berdasarkan Skor Kuis LKS"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Kuis {sortField === 'quizScore' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleSort('submittedAt')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  sortField === 'submittedAt'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
                title="Urutkan berdasarkan Waktu Pengumpulan"
              >
                <span>Waktu {sortField === 'submittedAt' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa / modul..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              aria-label="Filter Domain Sains"
              className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] font-semibold text-[var(--comfort-text)]"
            >
              <option value="Semua">Semua Domain</option>
              <option value="Fisika">Fisika</option>
              <option value="Kimia">Kimia</option>
              <option value="Biologi">Biologi</option>
              <option value="Astronomi">Astronomi</option>
            </select>

            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              aria-label="Filter Modul Praktikum"
              className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] font-semibold text-[var(--comfort-text)]"
            >
              <option value="Semua">Semua Modul</option>
              {availableModules.map((modId) => (
                <option key={modId} value={modId}>
                  {modId}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'Semua' | 'Belum Dinilai' | 'Sudah Dinilai')}
              aria-label="Filter Status Penilaian"
              className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] font-semibold text-[var(--comfort-text)]"
            >
              <option value="Semua">Semua Status</option>
              <option value="Belum Dinilai">Belum Dinilai</option>
              <option value="Sudah Dinilai">Sudah Dinilai</option>
            </select>
          </div>
        </div>

        {/* Main Content Area: Split View (Table Left, Fast Review Right) */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Submissions List Table */}
          <div className="w-full md:w-1/2 border-r border-[var(--comfort-border)] overflow-y-auto divide-y divide-[var(--comfort-border)]">
            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-[var(--comfort-text-muted)]">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Tidak ada data penyerahan laporan yang sesuai kriteria.</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => {
                const isSelected = selectedSubmission?.id === sub.id;
                const isGraded = Boolean(sub.teacherGrade);
                const rubric = resolveSubmissionRubric(sub);

                return (
                  <div
                    key={sub.id}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-4 transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/40'
                        : 'hover:bg-[var(--comfort-surface-subtle)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-[var(--comfort-text)]">
                            {sub.studentName}
                          </h4>
                          {sub.id.startsWith('RLAB-') && (
                            <span
                              data-testid="offline-submission-badge"
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30"
                            >
                              📦 Luring (.rlab)
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)]">
                            {sub.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--comfort-text-muted)] font-medium">
                          Modul: {sub.moduleId} ({sub.domain})
                        </p>
                      </div>

                      <div className="text-right">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 tabular-nums">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{sub.teacherGrade?.score}/100</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span>Rubrik: {rubric.score}/100</span>
                          </span>
                        )}
                        <div className="text-[10px] text-[var(--comfort-text-muted)] mt-1 tabular-nums">
                          Kuis: {sub.quizScore}/100 · RK4: {rubric.score}/100
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-[var(--comfort-text-muted)] line-clamp-1 italic flex-1">
                        "{sub.hypothesisText || 'Tidak ada hipotesis tertulis'}"
                      </p>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          labSound.playClick();
                          setReplaySubmission(sub);
                        }}
                        aria-label={`Lihat Replay Praktikum ${sub.studentName}`}
                        className="px-2.5 py-1 rounded-lg bg-sky-600/10 hover:bg-sky-600 hover:text-white text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Lihat Replay Praktikum</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Review, Expandable Auto-Rubric Drawer & Grading Form Panel (Right) */}
          <div className="w-full md:w-1/2 flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--comfort-surface-subtle)]">
            {selectedSubmission && selectedRubric ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
                      Review Laporan Siswa · {selectedSubmission.id}
                    </span>
                    <h3 className="text-base font-extrabold text-[var(--comfort-text)]">
                      {selectedSubmission.studentName}
                    </h3>
                    <p className="text-xs text-[var(--comfort-text-muted)]">
                      Diserahkan pada:{' '}
                      {new Date(selectedSubmission.submittedAt).toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        labSound.playClick();
                        setReplaySubmission(selectedSubmission);
                      }}
                      className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Lihat Replay Praktikum</span>
                    </button>
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                      R² = {selectedSubmission.regressionMetrics?.rSquared?.toFixed(3) ?? '0.99'} · m ={' '}
                      {selectedSubmission.regressionMetrics?.slope?.toFixed(2) ?? '1.00'}
                    </span>
                  </div>
                </div>

                {/* Expandable Deterministic RK4 Auto-Rubric Breakdown Drawer */}
                <div
                  data-testid="teacher-rubric-breakdown-panel"
                  className="rounded-2xl border border-teal-500/30 bg-[var(--comfort-surface)] overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedRubricOpen((prev) => !prev)}
                    aria-expanded={expandedRubricOpen}
                    className="w-full px-4 py-3 flex items-center justify-between gap-2 bg-teal-500/10 hover:bg-teal-500/15 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <div>
                        <span className="text-xs font-extrabold text-[var(--comfort-text)] block">
                          Rincian Rubrik Otomatis &amp; Toleransi Numerik RK4
                        </span>
                        <span className="text-[11px] text-[var(--comfort-text-muted)]">
                          Toleransi RK4: ±{selectedRubric.rk4TolerancePct}% · Status:{' '}
                          {selectedRubric.passed ? 'Lulus Kriteria Minimum' : 'Perlu Penguatan'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-extrabold bg-teal-600 text-white tabular-nums">
                        {selectedRubric.score}/{selectedRubric.maxScore}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--comfort-text-muted)] transition-transform ${
                          expandedRubricOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {expandedRubricOpen && (
                    <div className="p-3.5 space-y-2.5 divide-y divide-[var(--comfort-border)] text-xs">
                      <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300 pb-1">
                        {selectedRubric.summaryFeedback}
                      </p>
                      {selectedRubric.criteria.map((crit) => (
                        <div key={crit.id} className="pt-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[var(--comfort-text)]">
                              {crit.label}
                            </span>
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] tabular-nums ${
                                crit.passed
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {crit.earnedPoints}/{crit.maxPoints} poin
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Terukur: {crit.measuredSummary}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                            {crit.feedback}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hipotesis & Kesimpulan */}
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                    <span className="font-bold text-[11px] text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                      Hipotesis Siswa:
                    </span>
                    <p className="text-[var(--comfort-text)] leading-relaxed">
                      {selectedSubmission.hypothesisText || '—'}
                    </p>
                  </div>

                  {/* Ringkasan Tabel Observasi & Regresi */}
                  <div className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-[var(--comfort-text-muted)] uppercase tracking-wider">
                        Data Observasi ({selectedSubmission.observationData?.length || 0} Titik Uji)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                        {selectedSubmission.regressionMetrics?.equation || 'y = mx + c'}
                      </span>
                    </div>
                    {selectedSubmission.observationData && selectedSubmission.observationData.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-[var(--comfort-border)]">
                        <table className="w-full text-left text-[11px] font-mono tabular-nums">
                          <thead className="bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]">
                            <tr>
                              {Object.keys(selectedSubmission.observationData[0]).map((k) => (
                                <th key={k} className="px-2 py-1 font-semibold">
                                  {k}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--comfort-border)]">
                            {selectedSubmission.observationData.slice(0, 4).map((row, idx) => (
                              <tr key={idx}>
                                {Object.values(row).map((val, cIdx) => (
                                  <td key={cIdx} className="px-2 py-1 text-[var(--comfort-text)]">
                                    {String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)]">
                    <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                      Kesimpulan Siswa:
                    </span>
                    <p className="text-[var(--comfort-text)] leading-relaxed">
                      {selectedSubmission.conclusionText || '—'}
                    </p>
                  </div>
                </div>

                {/* Teacher Grading & Feedback Form */}
                <form
                  onSubmit={handleSaveGrade}
                  className="p-4 rounded-2xl bg-[var(--comfort-surface)] border border-sky-500/30 shadow-md space-y-4"
                >
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wider">
                    <Award className="w-4 h-4" />
                    <span>Evaluasi &amp; Nilai Pengajar</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--comfort-text)] mb-1">
                        Nilai Numerik (0–100):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={gradingScore}
                        onChange={(e) => setGradingScore(Number(e.target.value))}
                        className="w-full text-base font-mono font-bold px-3 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] focus:outline-none focus:border-sky-500 tabular-nums"
                        required
                      />
                    </div>

                    <div className="text-[11px] text-[var(--comfort-text-muted)]">
                      Skor Kuis LKS: <strong className="font-mono text-[var(--comfort-text)] tabular-nums">{selectedSubmission.quizScore}/100</strong>
                      <br />
                      Rekomendasi Rubrik RK4: <strong className="font-mono text-teal-600 dark:text-teal-400 tabular-nums">{selectedRubric.score}/100</strong>
                      <br />
                      Status: {selectedSubmission.teacherGrade ? 'Sudah Dinilai' : 'Menunggu Penilaian'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--comfort-text)] mb-1">
                      Catatan Evaluasi / Umpan Balik Guru:
                    </label>
                    <textarea
                      rows={2}
                      value={gradingFeedback}
                      onChange={(e) => setGradingFeedback(e.target.value)}
                      placeholder="Tuliskan apresiasi, koreksi metodologi, atau saran pendalaman teori..."
                      className="w-full text-xs p-2.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {toastMessage && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {toastMessage}
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingGrade}
                      className="ml-auto px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingGrade ? 'Menyimpan...' : 'Simpan Nilai & Beri Evaluasi'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8 space-y-2">
                <FileText className="w-10 h-10 opacity-40 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Pilih Laporan Siswa di Panel Kiri
                </p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Klik salah satu laporan yang masuk untuk meninjau data hipotesis, grafik regresi, rincian rubrik RK4, dan memberi nilai akhir.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Replay Player Modal */}
      <SessionReplayPlayer
        submission={replaySubmission}
        isOpen={Boolean(replaySubmission)}
        onClose={() => setReplaySubmission(null)}
      />
    </div>,
    document.body
  );
};

export default TeacherGradebookHub;

