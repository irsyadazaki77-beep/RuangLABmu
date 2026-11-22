import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Search,
  X,
  RefreshCw,
  Download,
  FolderOpen,
  Upload,
  Printer,
  ArrowUpDown,
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
import { GradebookSubmissionsList } from './GradebookSubmissionsList';
import { GradebookSubmissionReview } from './GradebookSubmissionReview';

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

  const [gradingScore, setGradingScore] = useState<number>(85);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm"
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
        className={`relative w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl bg-[var(--comfort-elevated)] border shadow-2xl overflow-hidden transition-all ${
          isDraggingFiles
            ? 'border-teal-400 ring-4 ring-teal-400/30'
            : 'border-[var(--comfort-border)]'
        }`}
      >
        {isDraggingFiles && (
          <div className="absolute inset-0 z-50 bg-teal-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white pointer-events-none space-y-2 animate-fade-in">
            <Upload className="w-10 h-10 text-teal-400" aria-hidden="true" />
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
                <h2 className="text-lg sm:text-xl font-bold text-[var(--comfort-text)]">
                  Buku Nilai &amp; Rekap Laporan Guru
                </h2>
                {activeRoomId && (
                  <span className="text-xs font-mono font-medium text-sky-600 dark:text-sky-400">
                    · Room {activeRoomId}
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
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-[var(--comfort-surface)] hover:opacity-90 text-[var(--comfort-text)] border border-[var(--comfort-border)] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" />
              <span>Cetak LKS Kosong (Untuk Fotokopi Kelas)</span>
            </button>

            <button
              type="button"
              data-testid="import-offline-rlab-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Impor file tugas praktikum luring (.rlab) yang dikumpulkan siswa via Bluetooth / Flashdisk / Hotspot LAN lokal"
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-[var(--comfort-surface)] hover:border-sky-500/50 text-[var(--comfort-text)] border border-[var(--comfort-border)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
              <span>Impor File Tugas (.rlab)</span>
            </button>

            <button
              type="button"
              onClick={handleExportClassroomCSV}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Ekspor Rekap LMS / CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchSubmissions}
              disabled={isLoading}
              title="Segarkan Data Laporan"
              className="p-2 rounded-xl text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Buku Nilai"
              className="p-2 rounded-xl text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bulk .rlab Import Summary Banner */}
        {importSummary && (
          <div
            data-testid="rlab-import-summary-banner"
            className="p-3.5 bg-[var(--comfort-surface)] border-b border-[var(--comfort-border)] text-xs text-[var(--comfort-text)] space-y-2 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-teal-600 dark:text-teal-300 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-teal-500" />
                  <span>Hasil Impor Massal .rlab ({importSummary.totalFiles} berkas):</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                  ✓ {importSummary.newCount} Sukses Baru
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold border border-sky-500/30">
                  ↻ {importSummary.updatedCount} Diperbarui (Deduplikasi)
                </span>
                {importSummary.failedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowFailuresDetail((prev) => !prev)}
                    className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold border border-rose-500/35 hover:bg-rose-500/25 cursor-pointer underline flex items-center gap-1"
                  >
                    ✕ {importSummary.failedCount} Gagal{' '}
                    {showFailuresDetail ? '▲ Sembunyikan' : '▼ Rincian'}
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] font-mono text-[11px]">
                    0 Gagal
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                aria-label="Tutup Ringkasan Impor"
                className="text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showFailuresDetail && importSummary.failures.length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                <div className="font-bold text-rose-700 dark:text-rose-300">
                  Daftar Berkas Gagal &amp; Penyebab:
                </div>
                {importSummary.failures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-[var(--comfort-text)]">
                    <span className="text-rose-600 dark:text-rose-400 shrink-0">• {f.fileName}:</span>
                    <span className="text-[var(--comfort-text-muted)]">{f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Counters, Search, Module Filter & Sortable Column Controls */}
        <div className="p-4 border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--comfort-surface)] text-xs">
          <div className="flex flex-wrap items-center gap-3 tabular-nums text-[var(--comfort-text-muted)]">
            <span className="font-medium text-[var(--comfort-text)]">
              Total Laporan:{' '}
              <strong className="font-mono">{submissions.length}</strong>
            </span>
            <span aria-hidden="true" className="opacity-35">·</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Belum Dinilai: <strong className="font-mono">{pendingCount}</strong></span>
            </span>
            <span aria-hidden="true" className="opacity-35">·</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Selesai Dinilai: <strong className="font-mono">{gradedCount}</strong></span>
            </span>

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
                <span>
                  Kuis {sortField === 'quizScore' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </span>
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
                <span>
                  Waktu {sortField === 'submittedAt' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </span>
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
              onChange={(e) =>
                setStatusFilter(e.target.value as 'Semua' | 'Belum Dinilai' | 'Sudah Dinilai')
              }
              aria-label="Filter Status Penilaian"
              className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] font-semibold text-[var(--comfort-text)]"
            >
              <option value="Semua">Semua Status</option>
              <option value="Belum Dinilai">Belum Dinilai</option>
              <option value="Sudah Dinilai">Sudah Dinilai</option>
            </select>
          </div>
        </div>

        {/* Main Content Area: Split View */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <GradebookSubmissionsList
            submissions={filteredSubmissions}
            isLoading={isLoading}
            selectedSubmissionId={selectedSubmission?.id}
            resolveSubmissionRubric={resolveSubmissionRubric}
            onSelectSubmission={handleSelectSubmission}
            onOpenReplay={setReplaySubmission}
          />

          <GradebookSubmissionReview
            selectedSubmission={selectedSubmission}
            selectedRubric={selectedRubric}
            expandedRubricOpen={expandedRubricOpen}
            onToggleRubricOpen={() => setExpandedRubricOpen((prev) => !prev)}
            onOpenReplay={setReplaySubmission}
            gradingScore={gradingScore}
            onChangeGradingScore={setGradingScore}
            gradingFeedback={gradingFeedback}
            onChangeGradingFeedback={setGradingFeedback}
            isSubmittingGrade={isSubmittingGrade}
            toastMessage={toastMessage}
            onSaveGrade={handleSaveGrade}
          />
        </div>
      </div>

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
