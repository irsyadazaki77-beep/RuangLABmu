import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
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

export const TeacherGradebookHub: React.FC<TeacherGradebookHubProps> = ({
  isOpen,
  onClose,
  activeRoomId,
}) => {
  const [submissions, setSubmissions] = useState<LabSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Belum Dinilai' | 'Sudah Dinilai'>('Semua');
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

    // Use Promise.allSettled so 1 corrupted file does NOT fail the entire batch
    const settleResults = await Promise.allSettled(
      fileArray.map(async (file) => {
        try {
          const text = await file.text();
          const verification = verifyAndParseRlabPacket(text);
          if (!verification.valid || !verification.packet) {
            throw new Error(verification.error || 'Format berkas rusak atau integritas tidak lolos');
          }
          const sub = convertPacketToSubmission(verification.packet);
          return { file, sub };
        } catch (err: any) {
          throw new Error(err?.message || 'Gagal membaca atau memverifikasi berkas .rlab');
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
        // Populate existing
        for (const s of prev) {
          subMap.set(s.id, s);
        }

        // Apply new or updated submissions (deduplication by submission.id)
        for (const item of validItems) {
          const sub = item.sub;
          if (subMap.has(sub.id)) {
            updatedCount += 1;
            const existing = subMap.get(sub.id)!;
            // Preserve teacherGrade if incoming does not have one
            subMap.set(sub.id, {
              ...sub,
              teacherGrade: sub.teacherGrade || existing.teacherGrade,
            });
          } else {
            newCount += 1;
            subMap.set(sub.id, sub);
          }

          // Asynchronously persist to backend if reachable
          fetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          }).catch(() => {});
        }

        const merged = Array.from(subMap.values());
        if (!selectedSubmission && validItems.length > 0) {
          setSelectedSubmission(validItems[0].sub);
          setGradingScore(Math.min(100, Math.max(70, validItems[0].sub.quizScore)));
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
          setSubmissions(data.submissions);
          if (data.submissions.length > 0 && !selectedSubmission) {
            const first = data.submissions[0];
            setSelectedSubmission(first);
            setGradingScore(first.teacherGrade?.score ?? Math.min(100, Math.max(70, first.quizScore)));
            setGradingFeedback(first.teacherGrade?.feedback || '');
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

  const handleSelectSubmission = (sub: LabSubmission) => {
    labSound.playClick();
    setSelectedSubmission(sub);
    setGradingScore(sub.teacherGrade?.score ?? Math.min(100, Math.max(70, sub.quizScore)));
    setGradingFeedback(sub.teacherGrade?.feedback || '');
  };

  const handleExportClassroomCSV = () => {
    labSound.playSuccessChime();
    exportGoogleClassroomCSV(submissions);
    setToastMessage(`Rekap CSV Google Classroom (${submissions.length} siswa) berhasil diunduh!`);
    setTimeout(() => setToastMessage(null), 3500);
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
        labSound.playSuccessChime();
        setToastMessage(`Nilai untuk ${selectedSubmission.studentName} berhasil disimpan!`);
        setTimeout(() => setToastMessage(null), 3000);

        // Update local state
        setSubmissions((prev) =>
          prev.map((s) => (s.id === selectedSubmission.id ? data.submission : s))
        );
        setSelectedSubmission(data.submission);
      }
    } catch {
      setToastMessage('Gagal menyimpan nilai.');
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  if (!isOpen) return null;

  const filteredSubmissions = submissions.filter((sub) => {
    const matchSearch =
      sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.moduleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchDomain =
      domainFilter === 'Semua' || sub.domain.toLowerCase() === domainFilter.toLowerCase();

    const isGraded = Boolean(sub.teacherGrade);
    const matchStatus =
      statusFilter === 'Semua'
        ? true
        : statusFilter === 'Sudah Dinilai'
        ? isGraded
        : !isGraded;

    return matchSearch && matchDomain && matchStatus;
  });

  const gradedCount = submissions.filter((s) => s.teacherGrade).length;
  const pendingCount = submissions.length - gradedCount;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm">
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
        className={`relative w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border shadow-2xl overflow-hidden transition-all ${
          isDraggingFiles
            ? 'border-teal-400 ring-4 ring-teal-400/30'
            : 'border-slate-200 dark:border-slate-800'
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
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  Buku Nilai &amp; Rekap Laporan Guru
                </h2>
                {activeRoomId && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    Room: {activeRoomId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                LMS Pipeline: Periksa hipotesis, grafik regresi OLS, replay kronologi, dan ekspor nilai Google Classroom
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden file input for .rlab */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".rlab,application/json"
              className="hidden"
              onChange={handleFilesSelected}
            />

            {/* FITUR 1: Cetak LKS Kosong untuk Fotokopi Kelas 3T */}
            <button
              type="button"
              data-testid="teacher-print-blank-worksheet-btn"
              onClick={() => {
                labSound.playClick();
                const defaultMod = EXPERIMENT_CATALOG[0];
                printBlankStudentWorksheet(defaultMod, 'SMA');
              }}
              title="Cetak format LKS kosong hemat tinta untuk difotokopi bagi siswa kelas 3T"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />
              <span>🖨️ Cetak LKS Kosong (Untuk Fotokopi Kelas)</span>
            </button>

            {/* FITUR 3: Tombol Impor File Tugas Siswa (.rlab) untuk Daerah 3T */}
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

            {/* FITUR 5: Ekspor Google Classroom & Sync Nilai */}
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

            {/* Failure Breakdown details */}
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

        {/* Status Counters & Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              Total Laporan: <strong className="font-mono text-slate-900 dark:text-white tabular-nums">{submissions.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              <span>Belum Dinilai: {pendingCount}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Selesai Dinilai: {gradedCount}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa / modul..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="Semua">Semua Domain</option>
              <option value="Fisika">Fisika</option>
              <option value="Kimia">Kimia</option>
              <option value="Biologi">Biologi</option>
              <option value="Astronomi">Astronomi</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300"
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
          <div className="w-full md:w-1/2 border-r border-slate-200 dark:border-slate-800 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredSubmissions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Tidak ada data penyerahan laporan yang sesuai kriteria.</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => {
                const isSelected = selectedSubmission?.id === sub.id;
                const isGraded = Boolean(sub.teacherGrade);

                return (
                  <div
                    key={sub.id}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-4 transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40 ring-1 ring-inset ring-sky-500/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
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
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {sub.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
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
                            <span>Perlu Nilai</span>
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1 tabular-nums">
                          Kuis: {sub.quizScore}/100
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic flex-1">
                        "{sub.hypothesisText || 'Tidak ada hipotesis tertulis'}"
                      </p>

                      {/* FITUR 3: Tombol Lihat Replay Praktikum */}
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

          {/* Quick Review & Grading Form Panel (Right) */}
          <div className="w-full md:w-1/2 flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/30">
            {selectedSubmission ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
                      Review Laporan Siswa · {selectedSubmission.id}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {selectedSubmission.studentName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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

                {/* Hipotesis & Kesimpulan */}
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-[11px] text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                      Hipotesis Siswa:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedSubmission.hypothesisText || '—'}
                    </p>
                  </div>

                  {/* Ringkasan Tabel Observasi & Regresi */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider">
                        Data Observasi ({selectedSubmission.observationData?.length || 0} Titik Uji)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                        {selectedSubmission.regressionMetrics?.equation || 'y = mx + c'}
                      </span>
                    </div>
                    {selectedSubmission.observationData && selectedSubmission.observationData.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-left text-[11px] font-mono tabular-nums">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                            <tr>
                              {Object.keys(selectedSubmission.observationData[0]).map((k) => (
                                <th key={k} className="px-2 py-1 font-semibold">
                                  {k}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {selectedSubmission.observationData.slice(0, 4).map((row, idx) => (
                              <tr key={idx}>
                                {Object.values(row).map((val, cIdx) => (
                                  <td key={cIdx} className="px-2 py-1 text-slate-700 dark:text-slate-300">
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

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                      Kesimpulan Siswa:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedSubmission.conclusionText || '—'}
                    </p>
                  </div>
                </div>

                {/* Teacher Grading & Feedback Form */}
                <form
                  onSubmit={handleSaveGrade}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-sky-500/30 shadow-md space-y-4"
                >
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wider">
                    <Award className="w-4 h-4" />
                    <span>Evaluasi &amp; Nilai Pengajar</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Nilai Numerik (0–100):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={gradingScore}
                        onChange={(e) => setGradingScore(Number(e.target.value))}
                        className="w-full text-base font-mono font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 tabular-nums"
                        required
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Skor Kuis LKS: <strong className="font-mono text-slate-900 dark:text-white tabular-nums">{selectedSubmission.quizScore}/100</strong>
                      <br />
                      Status: {selectedSubmission.teacherGrade ? 'Sudah Dinilai' : 'Menunggu Penilaian'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Catatan Evaluasi / Umpan Balik Guru:
                    </label>
                    <textarea
                      rows={2}
                      value={gradingFeedback}
                      onChange={(e) => setGradingFeedback(e.target.value)}
                      placeholder="Tuliskan apresiasi, koreksi metodologi, atau saran pendalaman teori..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
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
                  Klik salah satu laporan yang masuk untuk meninjau data hipotesis, grafik regresi, kuis, dan memberi nilai akhir.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FITUR 3: Session Replay Player Modal */}
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

