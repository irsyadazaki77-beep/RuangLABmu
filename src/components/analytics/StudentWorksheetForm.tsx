import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  CheckCircle2,
  Lightbulb,
  Filter,
  Send,
  Ticket,
  Lock,
  AlertTriangle,
  Download,
  Users,
} from 'lucide-react';
import { PassAndPlayRotationModal } from './PassAndPlayRotationModal';
import { useTranslation } from 'react-i18next';
import {
  WORKSHEET_QUESTIONS,
  gradeWorksheetAnswers,
  ExperimentRecord,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { HypothesisNote } from '../ui/HypothesisAndCompareDock';
import { useLabStore } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import { computeRecordsRegressionSummary } from '../../utils/labTelemetryHelpers';
import {
  evaluateDataPrecisionXP,
  recordPerfectLksQuiz,
} from '../../services/gamificationEngine';
import { buildSubmissionTelemetryTimeline } from '../../utils/telemetryRecorder';
import { parseRateLimitRetryAfter } from '../../hooks/useDrLabMuChat';
import {
  createOfflinePacket,
  downloadOfflineRlabPacket,
} from '../../utils/offlinePacketProtocol';
import { printBlankStudentWorksheet } from '../../utils/academicReportExporter';
import { getExperimentById } from '../../registry/experimentRegistry';
import { STUDENT_PROFILES } from '../../stores/initialLabParams';
import { translateObservationPattern } from '../../utils/pedagogicalHelpers';
import { ScienceGlossaryTerm } from '../ui/ScienceGlossaryTerm';

export interface StudentWorksheetFormProps {
  activeStudentName: string;
  activeGroupId: string;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (note: HypothesisNote) => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onPrintPDFReport?: (conclusionText: string) => void;
  onRotateGroup?: (nextStudentName: string, nextGroupId: string) => void;
  observationRecords?: ExperimentRecord[];
  moduleId?: string;
  domain?: string;
}

export const StudentWorksheetForm: React.FC<StudentWorksheetFormProps> = ({
  activeStudentName,
  activeGroupId,
  hypothesisNote,
  onChangeHypothesisNote,
  onSubmitQuizScore,
  onPrintPDFReport,
  onRotateGroup,
  observationRecords = [],
  moduleId = 'lab-experiment',
  domain = 'Fisika',
}) => {
  const { t } = useTranslation();
  const { isSubmissionLocked, setSubmissionLocked } = useLabStore();
  const { activeCustomMission } = useCollabStore();
  const [customMissionAnswers, setCustomMissionAnswers] = useState<Record<string, string>>({});

  const [answers, setAnswers] = useState<Record<string, string>>({
    'q-newton-1': '9.0',
    'q-collision-2': '4.0',
    'q-thermo-3': '-90.0',
    'q-titration-4': '20.0',
    'q-kepler-5': '8.0',
    'q-exoplanet-6': '1.0',
    'q-cardio-7': '5.25',
    'q-osmosis-8': '-16.0',
  });
  const [hintLevelByQuestion, setHintLevelByQuestion] = useState<Record<string, number>>({});
  const [lksDomainFilter, setLksDomainFilter] = useState<'Semua' | 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi'>('Semua');
  const [conclusionText, setConclusionText] = useState<string>(
    'Berdasarkan perolehan data percobaan dan kurva regresi kuantitatif, hipotesis awal terbukti valid. Hubungan antar variabel menunjukkan korelasi linear yang kuat sesuai teori ilmiah yang berlaku.'
  );
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [submissionSuccessTicket, setSubmissionSuccessTicket] = useState<string | null>(null);
  const [gradedResult, setGradedResult] = useState<ReturnType<typeof gradeWorksheetAnswers> | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [offlinePacketNotice, setOfflinePacketNotice] = useState<string | null>(null);

  // FITUR 3: Pass-and-Play Classroom Rotation States
  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);
  const [isRotatingGroup, setIsRotatingGroup] = useState(false);
  const [rotationNotice, setRotationNotice] = useState<string | null>(null);
  const patternTranslation = translateObservationPattern({
    records: observationRecords,
    domain,
    moduleId,
  });

  // Compute next suggested group & student name
  const currentIdx = STUDENT_PROFILES.findIndex(
    (p) => p.group === activeGroupId || p.name === activeStudentName
  );
  const nextProfile =
    STUDENT_PROFILES[(currentIdx + 1) % STUDENT_PROFILES.length] || STUDENT_PROFILES[0];
  const [nextStudentInput, setNextStudentInput] = useState<string>(nextProfile.name);
  const [nextGroupInput, setNextGroupInput] = useState<string>(nextProfile.group);

  useEffect(() => {
    const nextIdx = (currentIdx + 1) % STUDENT_PROFILES.length;
    const np = STUDENT_PROFILES[nextIdx] || STUDENT_PROFILES[0];
    setNextStudentInput(np.name);
    setNextGroupInput(np.group);
  }, [activeGroupId, activeStudentName, currentIdx]);

  const handlePrintBlankLks = () => {
    labSound.playClick();
    const modConfig = getExperimentById(moduleId);
    printBlankStudentWorksheet(modConfig, 'SMA');
  };

  const handlePassAndPlayRotation = async () => {
    labSound.playSuccessChime();
    setIsRotatingGroup(true);
    const finalGrade = gradedResult ?? gradeWorksheetAnswers(answers);
    const activeRoomId = useCollabStore.getState().activeRoomId || 'LAB-3T';
    const regSummary = computeRecordsRegressionSummary(observationRecords);

    const obsPayload = (observationRecords || []).map((r, i) => ({
      No: i + 1,
      Waktu: r.timestamp,
      X: r.numericX ?? 0,
      Y1: r.numericY1 ?? 0,
      Parameter: r.parametersSummary,
    }));

    const telemetryLog = buildSubmissionTelemetryTimeline(domain || 'Fisika', obsPayload);

    const submissionRecord = {
      id: `pnp-${Date.now()}`,
      studentName: activeStudentName,
      studentId: activeGroupId,
      roomId: activeRoomId,
      domain: domain || 'Fisika',
      moduleId: moduleId || 'lab-experiment',
      submittedAt: new Date().toISOString(),
      hypothesisText: hypothesisNote?.hypothesisText || '',
      observationData: obsPayload,
      recordsCount: observationRecords.length,
      regressionMetrics: {
        rSquared: regSummary.rSquared,
        slope: regSummary.slope,
        equation: regSummary.equation,
      },
      quizAnswers: Object.entries(answers).map(([qId, val]) => ({
        questionId: qId,
        selectedAnswer: val,
        isCorrect: finalGrade.results?.[qId]?.isCorrect ?? true,
      })),
      quizScore: finalGrade.totalScore,
      conclusionText,
      telemetryLog,
    };

    // 1. Permanently preserve in LocalStorage so Kelompok A's report is NEVER lost
    try {
      const storedKey = 'ruanglab_pass_and_play_submissions';
      const prevSubmissions = JSON.parse(window.localStorage.getItem(storedKey) || '[]');
      window.localStorage.setItem(
        storedKey,
        JSON.stringify([submissionRecord, ...prevSubmissions])
      );
    } catch {
      // ignore storage error
    }

    // 2. Also attempt server persistence if backend is reachable
    try {
      await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionRecord),
      });
    } catch {
      // ignore network errors in 3T mode
    }

    // 3. Clear LKS form inputs for the next group
    const blankAnswers: Record<string, string> = {};
    for (const q of WORKSHEET_QUESTIONS) {
      blankAnswers[q.id] = '';
    }
    setAnswers(blankAnswers);
    setConclusionText('Berdasarkan pengamatan kelompok kami, ');
    setGradedResult(null);
    setSubmissionSuccessTicket(null);
    setSubmissionLocked(false);

    // 4. Reset hypothesis note if callback available
    if (onChangeHypothesisNote && hypothesisNote) {
      onChangeHypothesisNote({
        independentVar: '',
        dependentVar: '',
        hypothesisText: '',
        reflectionText: '',
        updatedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    const prevGroupName = activeGroupId;
    const targetStudent = nextStudentInput.trim() || 'Siswa Kelompok Baru';
    const targetGroup = nextGroupInput.trim() || 'Kelompok Berikutnya';

    // 5. Notify parent to rotate student profile & clear active observation records table
    if (onRotateGroup) {
      onRotateGroup(targetStudent, targetGroup);
    }

    setIsRotationModalOpen(false);
    setIsRotatingGroup(false);

    setRotationNotice(
      `✓ Laporan [${prevGroupName}] berhasil disimpan secara permanen! Meja praktikum & tabel pengamatan direset bersih untuk [${targetGroup}].`
    );
    setTimeout(() => setRotationNotice(null), 8000);
  };

  useEffect(() => {
    if (rateLimitCountdown <= 0) {
      setRateLimitMessage(null);
      return;
    }
    const timer = window.setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) {
          setRateLimitMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rateLimitCountdown]);

  const filteredQuestions = WORKSHEET_QUESTIONS.filter((q) => {
    if (lksDomainFilter === 'Semua') return true;
    return q.domain.toLowerCase() === lksDomainFilter.toLowerCase();
  });

  const handleAdvanceHint = (questionId: string) => {
    if (isSubmissionLocked) return;
    labSound.playClick();
    setHintLevelByQuestion((prev) => {
      const current = prev[questionId] || 0;
      return { ...prev, [questionId]: Math.min(3, current + 1) };
    });
  };

  const handleGradeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmissionLocked) return;
    labSound.playSuccessChime();
    const result = gradeWorksheetAnswers(answers, filteredQuestions);
    setGradedResult(result);
    recordPerfectLksQuiz(result.totalScore, domain, moduleId);
    if (onSubmitQuizScore) {
      onSubmitQuizScore(result.totalScore, result.correctCount);
    }
  };

  const handleSubmitReportToTeacher = async () => {
    if (isSubmissionLocked) return;
    labSound.playClick();
    const finalGrade = gradedResult ?? gradeWorksheetAnswers(answers, filteredQuestions);
    setGradedResult(finalGrade);
    setIsSubmittingReport(true);
    const activeRoomId = useCollabStore.getState().activeRoomId || 'LAB-ALPHA';
    const regSummary = computeRecordsRegressionSummary(observationRecords);
    try {
      const obsPayload = (observationRecords || []).map((r, i) => ({
        'No': i + 1,
        'Waktu': r.timestamp,
        'X': r.numericX ?? 0,
        'Y1': r.numericY1 ?? 0,
        'Parameter': r.parametersSummary,
      }));

      const telemetryLog = buildSubmissionTelemetryTimeline(domain || 'Fisika', obsPayload);

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: activeStudentName,
          studentId: activeGroupId,
          roomId: activeRoomId,
          domain: domain || 'Fisika',
          moduleId: moduleId || 'lab-experiment',
          submittedAt: new Date().toISOString(),
          hypothesisText: hypothesisNote?.hypothesisText || '',
          observationData: obsPayload,
          regressionMetrics: {
            rSquared: regSummary.rSquared,
            slope: regSummary.slope,
            equation: regSummary.equation,
          },
          quizAnswers: Object.entries(answers).map(([qId, val]) => ({
            questionId: qId,
            selectedAnswer: val,
            isCorrect: finalGrade.results?.[qId]?.isCorrect ?? true,
          })),
          quizScore: finalGrade.totalScore,
          conclusionText,
          telemetryLog,
        }),
      });

      if (res.status === 429) {
        const retrySec = parseRateLimitRetryAfter(
          res.headers.get('Retry-After') || res.headers.get('RateLimit-Reset'),
          20
        );
        setRateLimitCountdown(retrySec);
        setRateLimitMessage(
          'Dr. LabMu sedang menganalisis banyak data, silakan tunggu beberapa detik sebelum mengirim pertanyaan atau laporan berikutnya.'
        );
        return;
      }

      if (res.ok) {
        const data = await res.json();
        labSound.playSuccessChime();
        setRateLimitMessage(null);
        setRateLimitCountdown(0);
        setSubmissionSuccessTicket(data.ticketCode || 'SUB-OK');
        // FITUR 2: Kunci Pengiriman (Submission Lock) setelah tombol kirim ditekan
        setSubmissionLocked(true);
        // FITUR 1: Berikan XP & Lencana untuk LKS & Presisi Data
        recordPerfectLksQuiz(finalGrade.totalScore, domain, moduleId);
        if (regSummary.hasRegression) {
          evaluateDataPrecisionXP(regSummary.rSquared, domain, moduleId);
        }
      }
    } catch {
      // ignore connection error
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleDownloadOfflineRlab = () => {
    labSound.playSuccessChime();
    const finalGrade = gradedResult ?? gradeWorksheetAnswers(answers);
    const activeRoomId = useCollabStore.getState().activeRoomId || 'LAB-3T';
    const regSummary = computeRecordsRegressionSummary(observationRecords);
    const obsPayload = (observationRecords || []).map((r, i) => ({
      No: i + 1,
      Waktu: r.timestamp,
      X: r.numericX ?? 0,
      Y1: r.numericY1 ?? 0,
      Parameter: r.parametersSummary,
    }));
    const telemetryLog = buildSubmissionTelemetryTimeline(domain || 'Fisika', obsPayload);

    const packet = createOfflinePacket({
      studentName: activeStudentName,
      studentId: activeGroupId,
      roomId: activeRoomId,
      domain: domain || 'Fisika',
      moduleId: moduleId || 'lab-experiment',
      submittedAt: new Date().toISOString(),
      hypothesisText: hypothesisNote?.hypothesisText || '',
      observationData: obsPayload,
      regressionMetrics: {
        rSquared: regSummary.rSquared,
        slope: regSummary.slope,
        equation: regSummary.equation,
      },
      quizAnswers: Object.entries(answers).map(([qId, val]) => ({
        questionId: qId,
        selectedAnswer: val,
        isCorrect: finalGrade.results?.[qId]?.isCorrect ?? true,
      })),
      quizScore: finalGrade.totalScore,
      conclusionText,
      telemetryLog,
    });

    downloadOfflineRlabPacket(packet);
    setOfflinePacketNotice(
      `Berkas tugas luring (.rlab) berhasil diunduh (${packet.packetId})! Berikan berkas ini ke guru via Bluetooth/Flashdisk/LAN lokal.`
    );
    setTimeout(() => setOfflinePacketNotice(null), 6000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-5">
      {/* Offline .rlab Download Notice Banner */}
      {offlinePacketNotice && (
        <div
          role="status"
          data-testid="offline-packet-notice"
          className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/50 flex items-center gap-2.5 text-xs text-teal-800 dark:text-teal-200 font-semibold shadow-sm animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{offlinePacketNotice}</span>
        </div>
      )}

      {/* Pass-and-Play Rotation Success Banner */}
      {rotationNotice && (
        <div
          role="status"
          data-testid="rotation-notice-banner"
          className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-500/50 flex items-center justify-between gap-3 text-xs text-sky-900 dark:text-sky-100 font-bold shadow-md animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>{rotationNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRotationNotice(null)}
            className="text-sky-500 hover:text-sky-700 dark:hover:text-sky-300 font-mono text-[11px] underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Friendly HTTP 429 Rate Limit Banner */}
      {rateLimitMessage && (
        <div
          role="alert"
          data-testid="lks-rate-limit-banner"
          className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{rateLimitMessage}</span>
          </div>
          {rateLimitCountdown > 0 && (
            <span className="font-mono font-bold text-[11px] px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
              Tunggu {rateLimitCountdown} dtk
            </span>
          )}
        </div>
      )}

      {/* Submission Lock Banner (FITUR 2) */}
      {isSubmissionLocked && (
        <div
          role="status"
          data-testid="lks-submission-locked-banner"
          className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200 font-semibold">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t('lks.lockedNotice')}</span>
          </div>
          {submissionSuccessTicket && (
            <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Tiket: {submissionSuccessTicket}
            </span>
          )}
        </div>
      )}

      {/* Ticket Modal Confirmation */}
      {submissionSuccessTicket && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                  Laporan Berhasil Diserahkan ke Guru!
                </h4>
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  {submissionSuccessTicket}
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Laporan praktikum beserta rekaman telemetri kronologis telah tersimpan di portal guru dan dikunci.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmissionSuccessTicket(null)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm"
          >
            Tutup Bukti Tiket
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              {t('lks.title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('lks.studentLabel')}: <strong>{activeStudentName}</strong> ({activeGroupId})
            </p>
          </div>
        </div>

        {/* Filter and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            {(['Semua', 'Fisika', 'Kimia', 'Biologi', 'Astronomi'] as const).map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setLksDomainFilter(dom)}
                className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  lksDomainFilter === dom
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dom === 'Semua' ? t('lks.filterAll') : dom}
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="print-blank-worksheet-btn"
            onClick={handlePrintBlankLks}
            title="Cetak Lembar Kerja Siswa (LKS) kosong hitam-putih hemat tinta untuk fotokopi siswa di kelas"
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-stone-300 dark:border-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>🖨️ Cetak LKS Kosong (Untuk Fotokopi Kelas)</span>
          </button>

          <button
            type="button"
            data-testid="pass-and-play-rotation-btn"
            onClick={() => {
              labSound.playClick();
              setIsRotationModalOpen(true);
            }}
            title="Simpan laporan kelompok aktif dan reset meja praktikum untuk giliran kelompok berikutnya (Pass-and-Play)"
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>👥 Simpan & Ganti Giliran Kelompok</span>
          </button>

          <button
            type="button"
            onClick={handleSubmitReportToTeacher}
            disabled={isSubmittingReport || isSubmissionLocked}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            {isSubmissionLocked ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            <span>
              {isSubmissionLocked
                ? 'Laporan Terkunci'
                : isSubmittingReport
                ? t('lks.submitting')
                : t('lks.submitReport')}
            </span>
          </button>

          {onPrintPDFReport && (
            <button
              type="button"
              onClick={() => onPrintPDFReport(conclusionText)}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('lks.printPdf')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hypothesis Review & Conclusion Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hipotesis Awal */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
            {t('lks.initialHypothesis')}
          </span>
          <textarea
            rows={3}
            disabled={isSubmissionLocked}
            value={hypothesisNote?.hypothesisText || ''}
            onChange={(e) => {
              if (onChangeHypothesisNote && hypothesisNote && !isSubmissionLocked) {
                onChangeHypothesisNote({
                  ...hypothesisNote,
                  hypothesisText: e.target.value,
                });
              }
            }}
            placeholder={t('lks.hypothesisPlaceholder')}
            className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-60"
          />
        </div>

        {/* Kesimpulan Akhir */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          {/* Feature 4: Penerjemah Arti Data Otomatis di LKS */}
          <div
            data-testid="lks-data-pattern-summary"
            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
              patternTranslation.status === 'ready'
                ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/70'
                : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                💡 Ringkasan Pola Datamu
              </span>
              {patternTranslation.status === 'ready' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-sky-200 dark:border-sky-700 font-mono text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  <ScienceGlossaryTerm term="R²" displayLabel="R²" />
                  <span>{patternTranslation.rSquaredPct}%</span>
                  <span>·</span>
                  <ScienceGlossaryTerm term="Slope/Gradien" displayLabel="Gradien" />
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {patternTranslation.summaryText}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              {patternTranslation.guidanceText}
            </p>
          </div>

          <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {t('lks.finalConclusion')}
          </span>
          <textarea
            rows={3}
            disabled={isSubmissionLocked}
            value={conclusionText}
            onChange={(e) => {
              if (!isSubmissionLocked) setConclusionText(e.target.value);
            }}
            placeholder={t('lks.conclusionPlaceholder')}
            className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Active Teacher AI Custom Mission Contextual LKS Questions */}
      {activeCustomMission && (
        <div
          data-testid="lks-custom-ai-mission-section"
          className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                ✨ MISI STUDI KASUS GURU · ROOM {activeCustomMission.roomId}
              </span>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                {activeCustomMission.title}
              </h4>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              Target {activeCustomMission.targetVariable.variableLabel}:{' '}
              {activeCustomMission.targetVariable.minSuccessValue} –{' '}
              {activeCustomMission.targetVariable.maxSuccessValue}{' '}
              {activeCustomMission.targetVariable.unit}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {activeCustomMission.narrative}
          </p>
          <div className="space-y-2.5 pt-1">
            {activeCustomMission.contextualQuestions.slice(0, 3).map((cq, idx) => (
              <div
                key={cq.id || idx}
                className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/90 border border-indigo-500/25 space-y-1.5"
              >
                <div className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Pertanyaan Kontekstual Studi Kasus #{idx + 1}
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {cq.questionText}
                </p>
                <input
                  type="text"
                  disabled={isSubmissionLocked}
                  value={customMissionAnswers[cq.id] || ''}
                  onChange={(e) =>
                    setCustomMissionAnswers((prev) => ({
                      ...prev,
                      [cq.id]: e.target.value,
                    }))
                  }
                  placeholder={`Petunjuk: ${cq.hint}`}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LKS Questions Form */}
      <form onSubmit={handleGradeForm} className="space-y-4">
        <div className="space-y-3">
          {filteredQuestions.map((q, idx) => {
            const userAns = answers[q.id] || '';
            const hintLvl = hintLevelByQuestion[q.id] || 0;
            const evalItem = gradedResult?.results?.[q.id];

            return (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        Soal {idx + 1} · {q.domain}
                      </span>
                      <span>·</span>
                      <span className="font-semibold">
                        {t('lks.weight')}: {Math.round(100 / (filteredQuestions.length || 1))} {t('lks.points')}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                      {q.questionText}
                    </p>
                  </div>

                  {/* Scaffolded Hint Trigger */}
                  <button
                    type="button"
                    disabled={isSubmissionLocked}
                    onClick={() => handleAdvanceHint(q.id)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>
                      {t('lks.hint')} ({hintLvl}/3)
                    </span>
                  </button>
                </div>

                {/* Scaffolded Hints Accordion */}
                {hintLvl > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="font-bold text-[11px]">
                      {hintLvl === 1
                        ? 'Petunjuk Tingkat 1 (Konseptual):'
                        : hintLvl === 2
                        ? 'Petunjuk Tingkat 2 (Rumus & Variabel):'
                        : 'Petunjuk Tingkat 3 (Langkah Solusi):'}
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {q.scaffoldedHints?.[hintLvl - 1] || q.formulaHint || q.explanation}
                    </p>
                  </div>
                )}

                {/* Input and Evaluation Feedback */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={isSubmissionLocked}
                    value={userAns}
                    onChange={(e) => {
                      if (!isSubmissionLocked) {
                        setAnswers({ ...answers, [q.id]: e.target.value });
                      }
                    }}
                    placeholder={t('lks.answerPlaceholder')}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono disabled:opacity-60"
                  />
                  {evalItem && (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        evalItem.isCorrect
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {evalItem.isCorrect ? '✓ Benar' : '✗ Kurang Tepat'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit and Grade Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {gradedResult && (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                Nilai LKS: <strong className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{gradedResult.totalScore}/100</strong> ({gradedResult.correctCount} dari {gradedResult.totalQuestions} Soal Benar)
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="submit"
              disabled={isSubmissionLocked}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              {t('lks.checkGrade')}
            </button>
            <button
              type="button"
              data-testid="bottom-pass-and-play-rotation-btn"
              onClick={() => {
                labSound.playClick();
                setIsRotationModalOpen(true);
              }}
              title="Simpan laporan kelompok aktif dan reset meja praktikum untuk giliran kelompok berikutnya"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Simpan & Ganti Giliran Kelompok</span>
            </button>
            <button
              type="button"
              data-testid="download-offline-rlab-btn"
              onClick={handleDownloadOfflineRlab}
              title="Unduh paket tugas luring (.rlab) terenkapsulasi anti-tamper untuk dikumpulkan via Flashdisk/Bluetooth tanpa kuota"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>💾 Unduh File Tugas Luring (.rlab)</span>
            </button>
            <button
              type="button"
              onClick={handleSubmitReportToTeacher}
              disabled={isSubmittingReport || isSubmissionLocked}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              {isSubmissionLocked ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              <span>
                {isSubmissionLocked
                  ? 'Laporan Terkunci'
                  : isSubmittingReport
                  ? t('lks.submitting')
                  : t('lks.submitReport')}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* FITUR 3: Pass-and-Play Rotation Modal Dialog */}
      <PassAndPlayRotationModal
        isOpen={isRotationModalOpen}
        onClose={() => setIsRotationModalOpen(false)}
        activeGroupId={activeGroupId}
        activeStudentName={activeStudentName}
        observationCount={observationRecords.length}
        nextGroupInput={nextGroupInput}
        setNextGroupInput={setNextGroupInput}
        nextStudentInput={nextStudentInput}
        setNextStudentInput={setNextStudentInput}
        isRotatingGroup={isRotatingGroup}
        onConfirmRotation={handlePassAndPlayRotation}
      />
    </div>
  );
};


