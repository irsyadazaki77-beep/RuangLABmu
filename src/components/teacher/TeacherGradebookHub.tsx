import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  X,
  Award,
  Send,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { LabSubmission } from '../../types/submissionTypes';
import { labSound } from '../../utils/soundEngine';

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

  // Form State Evaluasi Guru
  const [gradingScore, setGradingScore] = useState<number>(85);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      alert('Gagal menyimpan nilai.');
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
      <div className="relative w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/40">
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
                LMS Pipeline: Periksa hipotesis, grafik regresi OLS, kuis LKS, dan berikan evaluasi pedagogik
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Status Counters & Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
              Total Laporan: <strong className="font-mono text-slate-900 dark:text-white">{submissions.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Belum Dinilai: {pendingCount}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
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
                    className={`p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-l-4 border-sky-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {sub.studentName}
                          </h4>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{sub.teacherGrade?.score}/100</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span>Perlu Nilai</span>
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">
                          Kuis: {sub.quizScore}/100
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic">
                      "{sub.hypothesisText || 'Tidak ada hipotesis tertulis'}"
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Review & Grading Form Panel (Right) */}
          <div className="w-full md:w-1/2 flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/30">
            {selectedSubmission ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
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

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Korelasi Regresi OLS</span>
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
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
                        <table className="w-full text-left text-[11px] font-mono">
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
                        className="w-full text-base font-mono font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                        required
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Skor Kuis LKS: <strong className="font-mono text-slate-900 dark:text-white">{selectedSubmission.quizScore}/100</strong>
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
    </div>,
    document.body
  );
};

export default TeacherGradebookHub;
