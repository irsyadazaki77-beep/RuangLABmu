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
  BarChart3,
  ListChecks,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
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
import { EXPERIMENT_CATALOG, type EducationTier } from '../../registry/experimentRegistry';
import { computeClassGradebookAnalytics } from '../../utils/classAnalyticsEngine';
import { GradebookSubmissionsList } from './GradebookSubmissionsList';
import { GradebookSubmissionReview } from './GradebookSubmissionReview';
import { GradebookClassAnalyticsPanel } from './GradebookClassAnalyticsPanel';
import { GradebookSecurityBackupPanel } from './GradebookSecurityBackupPanel';
import { TeacherAuthGateModal } from './TeacherAuthGateModal';
import { useAuthStore } from '../../stores/useAuthStore';
import { apiFetch } from '../../utils/apiClient';

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
  const [expandedRubricOpen, setExpandedRubricOpen] = useState<boolean>(false);
  const [selectedSubmission, setSelectedSubmission] = useState<LabSubmission | null>(null);
  const [replaySubmission, setReplaySubmission] = useState<LabSubmission | null>(null);

  const [gradingScore, setGradingScore] = useState<number>(85);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
  const [isBatchGrading, setIsBatchGrading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [viewMode, setViewMode] = useState<'review' | 'analytics' | 'security'>('review');
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);
  const [kkmThreshold, setKkmThreshold] = useState<number>(75);
  const [showBlankLksPicker, setShowBlankLksPicker] = useState(false);
  const [blankLksModuleId, setBlankLksModuleId] = useState<string>(
    EXPERIMENT_CATALOG[0]?.id || 'newton-incline'
  );
  const [blankLksTier, setBlankLksTier] = useState<EducationTier>('SMA');

  const PAGE_SIZE = 25;
  const [pageOffset, setPageOffset] = useState<number>(0);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [hasMorePages, setHasMorePages] = useState<boolean>(false);

  const authPromptOpen = useAuthStore((s) => s.authPromptOpen);
  const authPromptReason = useAuthStore((s) => s.authPromptReason);
  const openAuthPrompt = useAuthStore((s) => s.openAuthPrompt);
  const closeAuthPrompt = useAuthStore((s) => s.closeAuthPrompt);
  const authSession = useAuthStore((s) => s.session);

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

          apiFetch('/api/submissions', {
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

  const fetchSubmissions = async (overrideOffset?: number) => {
    setIsLoading(true);
    try {
      const effectiveOffset = overrideOffset !== undefined ? overrideOffset : pageOffset;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(effectiveOffset),
      });
      if (domainFilter !== 'Semua') params.set('domain', domainFilter);
      if (moduleFilter !== 'Semua') params.set('moduleId', moduleFilter);
      if (statusFilter === 'Sudah Dinilai') params.set('status', 'graded');
      if (statusFilter === 'Belum Dinilai') params.set('status', 'ungraded');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (sortField === 'score') params.set('sortBy', 'score');
      else if (sortField === 'studentName') params.set('sortBy', 'student_name');
      else params.set('sortBy', 'submitted_at');
      params.set('sortDir', sortDirection);

      const res = await apiFetch(`/api/submissions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.submissions)) {
          const enriched: LabSubmission[] = data.submissions.map((s: LabSubmission) => ({
            ...s,
            autoRubric: resolveSubmissionRubric(s),
          }));
          setSubmissions(enriched);
          const totalCount =
            typeof data.pagination?.total === 'number'
              ? data.pagination.total
              : enriched.length;
          setServerTotal(totalCount);
          setHasMorePages(Boolean(data.pagination?.hasMore));
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
      void fetchSubmissions();
    }
  }, [isOpen, pageOffset, domainFilter, moduleFilter, statusFilter, sortField, sortDirection]);

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
    setMobileDetailOpen(true);
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
      const res = await apiFetch(`/api/submissions/${selectedSubmission.id}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: gradingScore,
          feedback: gradingFeedback,
        }),
        promptTeacherAuthOn401: true,
        authReason: 'Verifikasi PIN pengajar diperlukan untuk menyimpan penilaian laporan siswa.',
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
      } else if (res.status === 401 || res.status === 403) {
        setToastMessage('Masukkan PIN pengajar untuk menyimpan nilai.');
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch {
      setToastMessage('Gagal menyimpan nilai.');
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  const handleBatchGradeRubric = async (targetIds: string[], onlyUngraded: boolean) => {
    if (targetIds.length === 0) return;
    setIsBatchGrading(true);
    try {
      const res = await apiFetch('/api/submissions/batch-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionIds: targetIds,
          onlyUngraded,
          feedbackPrefix: 'Penilaian Rubrik Massal',
        }),
        promptTeacherAuthOn401: true,
        authReason: 'Verifikasi PIN pengajar diperlukan untuk penilaian rubrik massal.',
      });
      if (res.ok) {
        const data = await res.json();
        const updatedList: LabSubmission[] = Array.isArray(data.submissions)
          ? data.submissions.map((s: LabSubmission) => ({
              ...s,
              autoRubric: resolveSubmissionRubric(s),
            }))
          : [];
        const updatedMap = new Map(updatedList.map((s) => [s.id, s]));
        setSubmissions((prev) => prev.map((s) => updatedMap.get(s.id) ?? s));
        if (selectedSubmission && updatedMap.has(selectedSubmission.id)) {
          const nextSelected = updatedMap.get(selectedSubmission.id)!;
          setSelectedSubmission(nextSelected);
          setGradingScore(nextSelected.teacherGrade?.score ?? gradingScore);
          setGradingFeedback(nextSelected.teacherGrade?.feedback ?? gradingFeedback);
        }
        labSound.playSuccessChime();
        setToastMessage(
          `Penilaian rubrik massal selesai: ${data.gradedCount ?? updatedList.length} laporan diperbarui.`
        );
        setTimeout(() => setToastMessage(null), 4000);
      } else if (res.status === 401 || res.status === 403) {
        setToastMessage('Verifikasi sesi pengajar diperlukan untuk penilaian massal.');
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        setToastMessage('Gagal menjalankan penilaian rubrik massal.');
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch {
      setToastMessage('Gagal terhubung ke server untuk penilaian massal.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsBatchGrading(false);
    }
  };

  const handlePrintSelectedBlankLks = () => {
    const selectedMod =
      EXPERIMENT_CATALOG.find((m) => m.id === blankLksModuleId) || EXPERIMENT_CATALOG[0];
    if (!selectedMod) return;
    labSound.playClick();
    printBlankStudentWorksheet(selectedMod, blankLksTier);
    setShowBlankLksPicker(false);
    setToastMessage(`LKS Kosong "${selectedMod.title}" (${blankLksTier}) siap dicetak.`);
    setTimeout(() => setToastMessage(null), 3500);
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
  const classAnalytics = computeClassGradebookAnalytics(filteredSubmissions, kkmThreshold);
  const filteredPendingIds = filteredSubmissions.filter((s) => !s.teacherGrade).map((s) => s.id);
  const batchTargetIds =
    filteredPendingIds.length > 0 ? filteredPendingIds : filteredSubmissions.map((s) => s.id);
  const batchOnlyUngraded = filteredPendingIds.length > 0;

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
              data-testid="teacher-batch-grade-btn"
              disabled={isBatchGrading || batchTargetIds.length === 0}
              onClick={() => handleBatchGradeRubric(batchTargetIds, batchOnlyUngraded)}
              title="Terapkan nilai rubrik otomatis secara massal ke laporan terfilter"
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isBatchGrading
                  ? 'Menilai Massal...'
                  : batchOnlyUngraded
                  ? `Terapkan Rubrik Massal (${batchTargetIds.length})`
                  : `Sinkron Rubrik Massal (${batchTargetIds.length})`}
              </span>
            </button>

            <button
              type="button"
              data-testid="teacher-print-blank-worksheet-btn"
              onClick={() => {
                labSound.playClick();
                setShowBlankLksPicker((prev) => !prev);
              }}
              title="Pilih modul & jenjang untuk mencetak format LKS kosong hemat tinta kelas 3T"
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-[var(--comfort-surface)] hover:opacity-90 text-[var(--comfort-text)] border border-[var(--comfort-border)] text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] shrink-0" />
              <span>Cetak LKS Kosong</span>
            </button>

            <button
              type="button"
              data-testid="import-offline-rlab-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Impor file tugas praktikum luring (.rlab) yang dikumpulkan siswa via Bluetooth / Flashdisk / Hotspot LAN lokal"
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-[var(--comfort-surface)] hover:border-sky-500/50 text-[var(--comfort-text)] border border-[var(--comfort-border)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
              <span>Impor .rlab</span>
            </button>

            <button
              type="button"
              onClick={handleExportClassroomCSV}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={() => void fetchSubmissions()}
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

        {/* Blank LKS Module & Tier Selector Bar */}
        {showBlankLksPicker && (
          <div
            data-testid="blank-lks-picker-panel"
            className="px-4 sm:px-6 py-3 bg-[var(--comfort-surface)] border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-bold text-[var(--comfort-text)] flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <span>Pilih Modul &amp; Jenjang LKS Kosong:</span>
              </span>
              <select
                data-testid="blank-lks-module-select"
                aria-label="Pilih Modul LKS Kosong"
                value={blankLksModuleId}
                onChange={(e) => setBlankLksModuleId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs font-semibold text-[var(--comfort-text)] max-w-xs"
              >
                {(['fisika', 'kimia', 'biologi', 'astronomi'] as const).map((dom) => (
                  <optgroup
                    key={dom}
                    label={dom.charAt(0).toUpperCase() + dom.slice(1)}
                  >
                    {EXPERIMENT_CATALOG.filter((m) => m.domain === dom).map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <select
                data-testid="blank-lks-tier-select"
                aria-label="Pilih Jenjang Pendidikan LKS"
                value={blankLksTier}
                onChange={(e) => setBlankLksTier(e.target.value as EducationTier)}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs font-semibold text-[var(--comfort-text)]"
              >
                <option value="SMP">Jenjang SMP</option>
                <option value="SMA">Jenjang SMA</option>
                <option value="Mahasiswa">Jenjang Mahasiswa</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="blank-lks-confirm-print-btn"
                onClick={handlePrintSelectedBlankLks}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer whitespace-nowrap"
              >
                Cetak LKS Sekarang
              </button>
              <button
                type="button"
                onClick={() => setShowBlankLksPicker(false)}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Global Toast Feedback Banner across Analytics & Security tabs */}
        {toastMessage && viewMode !== 'review' && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-500/12 border-b border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-0.5 hover:opacity-80 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bulk .rlab Import Summary Banner (Zero-Pill Clean Inline Readout) */}
        {importSummary && (
          <div
            data-testid="rlab-import-summary-banner"
            className="p-3.5 bg-[var(--comfort-surface)] border-b border-[var(--comfort-border)] text-xs text-[var(--comfort-text)] space-y-2 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums">
                <span className="font-bold text-teal-600 dark:text-teal-300 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-teal-500" />
                  <span>Impor Massal .rlab ({importSummary.totalFiles} berkas):</span>
                </span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ {importSummary.newCount} Baru
                </span>
                <span aria-hidden="true" className="opacity-35">·</span>
                <span className="font-mono font-semibold text-sky-700 dark:text-sky-300">
                  ↻ {importSummary.updatedCount} Diperbarui
                </span>
                <span aria-hidden="true" className="opacity-35">·</span>
                {importSummary.failedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowFailuresDetail((prev) => !prev)}
                    className="font-mono font-semibold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    ✕ {importSummary.failedCount} Gagal{' '}
                    {showFailuresDetail ? '▲ Sembunyikan' : '▼ Rincian'}
                  </button>
                ) : (
                  <span className="font-mono text-2xs text-[var(--comfort-text-muted)]">
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
              <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5 max-h-36 overflow-y-auto font-mono text-2xs">
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

        {/* Status Counters, View Switcher, Search, Module Filter & Sortable Column Controls */}
        <div className="p-4 border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--comfort-surface)] text-xs">
          <div className="flex flex-wrap items-center gap-3 tabular-nums text-[var(--comfort-text-muted)]">
            <div
              role="tablist"
              aria-label="Mode Tampilan Buku Nilai"
              className="inline-flex items-center gap-1 bg-[var(--comfort-surface-subtle)] p-0.5 rounded-xl border border-[var(--comfort-border)]"
            >
              <button
                type="button"
                role="tab"
                data-testid="gradebook-tab-review"
                aria-selected={viewMode === 'review'}
                onClick={() => {
                  labSound.playClick();
                  setViewMode('review');
                }}
                className={`px-2.5 py-1 rounded-lg text-2xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  viewMode === 'review'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Daftar &amp; Penilaian</span>
              </button>
              <button
                type="button"
                role="tab"
                data-testid="gradebook-tab-analytics"
                aria-selected={viewMode === 'analytics'}
                onClick={() => {
                  labSound.playClick();
                  setViewMode('analytics');
                }}
                className={`px-2.5 py-1 rounded-lg text-2xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  viewMode === 'analytics'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Analitik Kelas</span>
              </button>
              <button
                type="button"
                role="tab"
                data-testid="gradebook-tab-security"
                aria-selected={viewMode === 'security'}
                onClick={() => {
                  labSound.playClick();
                  setViewMode('security');
                }}
                className={`px-2.5 py-1 rounded-lg text-2xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  viewMode === 'security'
                    ? 'bg-sky-600 text-white'
                    : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Keamanan &amp; Backup</span>
              </button>
            </div>

            <span className="font-medium text-[var(--comfort-text)]">
              Total:{' '}
              <strong className="font-mono">{serverTotal || submissions.length}</strong>
            </span>
            <span aria-hidden="true" className="opacity-35">·</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Belum: <strong className="font-mono">{pendingCount}</strong></span>
            </span>
            <span aria-hidden="true" className="opacity-35">·</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Dinilai: <strong className="font-mono">{gradedCount}</strong></span>
            </span>

            <div className="inline-flex items-center gap-1 bg-[var(--comfort-surface-subtle)] p-0.5 rounded-xl border border-[var(--comfort-border)]">
              <button
                type="button"
                onClick={() => handleToggleSort('score')}
                className={`px-2 py-1 rounded-lg text-2xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
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
                className={`px-2 py-1 rounded-lg text-2xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
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
                className={`px-2 py-1 rounded-lg text-2xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
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

        {/* Main Content Area: Split View, Class Analytics, or Security & Backup */}
        {viewMode === 'security' ? (
          <GradebookSecurityBackupPanel
            onOpenAuthModal={(reason) => openAuthPrompt(reason)}
            onNotify={(msg) => {
              setToastMessage(msg);
              setTimeout(() => setToastMessage(null), 4000);
            }}
          />
        ) : viewMode === 'analytics' ? (
          <GradebookClassAnalyticsPanel
            analytics={classAnalytics}
            kkmThreshold={kkmThreshold}
            onChangeKkm={setKkmThreshold}
            submissions={filteredSubmissions}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {mobileDetailOpen && selectedSubmission && (
              <div className="md:hidden px-3 py-2 border-b border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    labSound.playClick();
                    setMobileDetailOpen(false);
                  }}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs font-semibold text-[var(--comfort-text)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kembali ke Daftar</span>
                </button>
                <span className="text-xs font-semibold text-[var(--comfort-text-muted)] truncate">
                  {selectedSubmission.studentName}
                </span>
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              <div
                className={`${
                  mobileDetailOpen ? 'hidden md:flex' : 'flex'
                } w-full md:w-1/2 min-h-0 flex-1 overflow-hidden`}
              >
                <GradebookSubmissionsList
                  submissions={filteredSubmissions}
                  isLoading={isLoading}
                  selectedSubmissionId={selectedSubmission?.id}
                  resolveSubmissionRubric={resolveSubmissionRubric}
                  onSelectSubmission={handleSelectSubmission}
                  onOpenReplay={setReplaySubmission}
                />
              </div>

              <div
                className={`${
                  mobileDetailOpen ? 'flex' : 'hidden md:flex'
                } w-full md:w-1/2 min-h-0 flex-1 overflow-hidden`}
              >
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

            {serverTotal > PAGE_SIZE && (
              <div className="px-4 py-2 border-t border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[var(--comfort-text-muted)] font-mono tabular-nums">
                  Halaman {Math.floor(pageOffset / PAGE_SIZE) + 1} · Menampilkan{' '}
                  {pageOffset + 1}–{Math.min(pageOffset + submissions.length, serverTotal)} dari{' '}
                  {serverTotal} laporan
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pageOffset === 0 || isLoading}
                    onClick={() => setPageOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasMorePages || isLoading}
                    onClick={() => setPageOffset((prev) => prev + PAGE_SIZE)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SessionReplayPlayer
        submission={replaySubmission}
        isOpen={Boolean(replaySubmission)}
        onClose={() => setReplaySubmission(null)}
      />

      <TeacherAuthGateModal
        isOpen={authPromptOpen}
        onClose={closeAuthPrompt}
        reason={authPromptReason}
        defaultTeacherName={authSession?.displayName || 'Dr. Hendra Kusuma'}
        onAuthenticated={() => {
          setToastMessage('Sesi pengajar terverifikasi. Silakan lanjutkan tindakan Anda.');
          setTimeout(() => setToastMessage(null), 3500);
          void fetchSubmissions();
        }}
      />
    </div>,
    document.body
  );
};

export default TeacherGradebookHub;
