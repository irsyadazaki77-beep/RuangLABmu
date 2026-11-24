import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  Sparkles,
} from 'lucide-react';
import { PassAndPlayRotationModal } from './PassAndPlayRotationModal';
import { WorksheetQuestionList } from './WorksheetQuestionList';
import { useTranslation } from 'react-i18next';
import {
  WORKSHEET_QUESTIONS,
  gradeWorksheetAnswers,
  ExperimentRecord,
} from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { HypothesisNote } from '../ui/HypothesisAndCompareDock';
import { useShallow } from 'zustand/react/shallow';
import { useLabStore } from '../../stores/useLabStore';
import { useCollabStore } from '../../stores/useCollabStore';
import {
  DEFAULT_SCHOOL_ID,
  enqueueOutboxMutation,
  generateMutationUuid,
} from '../../utils/offlineOutbox';
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
import { EducationTier, getExperimentById } from '../../registry/experimentRegistry';
import { generateDynamicWorksheetQuestions } from '../../utils/dynamicWorksheetEngine';
import { STUDENT_PROFILES } from '../../stores/initialLabParams';
import { translateObservationPattern } from '../../utils/pedagogicalHelpers';
import { ScienceGlossaryTerm } from '../ui/ScienceGlossaryTerm';
import { DetailToggleButton } from '../ui/ProgressiveDisclosure';

export interface StudentWorksheetFormProps {
  activeStudentName: string;
  activeGroupId: string;
  activeTier?: EducationTier;
  hypothesisNote?: HypothesisNote;
  onChangeHypothesisNote?: (note: HypothesisNote) => void;
  onSubmitQuizScore?: (score: number, correctCount: number) => void;
  onPrintPDFReport?: (conclusionText: string) => void;
  onRotateGroup?: (nextStudentName: string, nextGroupId: string) => void;
  onAskDrLabMu?: (prompt: string) => void;
  lksAnswers?: Record<string, string>;
  onChangeLksAnswers?: (next: Record<string, string>) => void;
  observationRecords?: ExperimentRecord[];
  moduleId?: string;
  domain?: string;
}

export const StudentWorksheetForm: React.FC<StudentWorksheetFormProps> = ({
  activeStudentName,
  activeGroupId,
  activeTier = 'SMA',
  hypothesisNote,
  onChangeHypothesisNote,
  onSubmitQuizScore,
  onPrintPDFReport,
  onRotateGroup,
  onAskDrLabMu,
  lksAnswers,
  onChangeLksAnswers,
  observationRecords = [],
  moduleId = 'lab-experiment',
  domain = 'Fisika',
}) => {
  const { t } = useTranslation();
  const { isSubmissionLocked, setSubmissionLocked } = useLabStore(
    useShallow((s) => ({
      isSubmissionLocked: s.isSubmissionLocked,
      setSubmissionLocked: s.setSubmissionLocked,
    }))
  );
  const activeCustomMission = useCollabStore((s) => s.activeCustomMission);
  const [customMissionAnswers, setCustomMissionAnswers] = useState<Record<string, string>>({});

  const activeMod = useMemo(() => getExperimentById(moduleId), [moduleId]);
  const dynamicQuestions = useMemo(
    () => generateDynamicWorksheetQuestions(activeMod, observationRecords, domain),
    [activeMod, observationRecords, domain]
  );

  const [questionMode, setQuestionMode] = useState<'dynamic' | 'bank'>('dynamic');
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>(() => lksAnswers || {});
  const answers = lksAnswers ?? localAnswers;

  const updateAnswers = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    const next = updater(answers);
    setLocalAnswers(next);
    onChangeLksAnswers?.(next);
  };

  const [hintLevelByQuestion, setHintLevelByQuestion] = useState<Record<string, number>>({});
  const [lksDomainFilter, setLksDomainFilter] = useState<'Semua' | 'Fisika' | 'Kimia' | 'Biologi' | 'Astronomi'>('Semua');
  const [conclusionText, setConclusionText] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [submissionSuccessTicket, setSubmissionSuccessTicket] = useState<string | null>(null);
  const [gradedResult, setGradedResult] = useState<ReturnType<typeof gradeWorksheetAnswers> | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [offlinePacketNotice, setOfflinePacketNotice] = useState<string | null>(null);

  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);
  const [isRotatingGroup, setIsRotatingGroup] = useState(false);
  const [rotationNotice, setRotationNotice] = useState<string | null>(null);
  const [showPatternDetail, setShowPatternDetail] = useState(false);
  const patternTranslation = translateObservationPattern({
    records: observationRecords,
    domain,
    moduleId,
  });

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
    printBlankStudentWorksheet(modConfig, activeTier);
  };

  const handleReviewDraftWithDrLabMu = () => {
    if (!onAskDrLabMu) return;
    labSound.playClick();
    const regSummary = computeRecordsRegressionSummary(observationRecords);
    const hypText = hypothesisNote?.hypothesisText?.trim() || '(belum diisi)';
    const concText = conclusionText.trim() || '(belum diisi)';
    onAskDrLabMu(
      `Tinjau draf LKS saya secara Sokratik untuk modul ${activeMod?.title || moduleId}: Hipotesis="${hypText}", Jumlah data=${observationRecords.length} titik, R²=${regSummary.hasRegression ? regSummary.rSquared.toFixed(3) : 'belum tersedia'}, Draf kesimpulan="${concText}". Berikan 2 pertanyaan reflektif dan saran perbaikan ilmiah tanpa langsung menuliskan jawaban akhir.`
    );
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

    const pnpMutationId = generateMutationUuid();
    const pnpPayload = {
      ...submissionRecord,
      schoolId: DEFAULT_SCHOOL_ID,
      clientMutationId: pnpMutationId,
    };
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': pnpMutationId,
        },
        body: JSON.stringify(pnpPayload),
      });
      if (!res.ok && res.status >= 500) {
        await enqueueOutboxMutation({
          endpoint: '/api/submissions',
          method: 'POST',
          schoolId: DEFAULT_SCHOOL_ID,
          clientMutationId: pnpMutationId,
          payload: pnpPayload,
        });
      }
    } catch {
      await enqueueOutboxMutation({
        endpoint: '/api/submissions',
        method: 'POST',
        schoolId: DEFAULT_SCHOOL_ID,
        clientMutationId: pnpMutationId,
        payload: pnpPayload,
      }).catch(() => undefined);
    }

    updateAnswers(() => ({}));
    setConclusionText('');
    setGradedResult(null);
    setSubmissionSuccessTicket(null);
    setSubmissionLocked(false);

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

    if (onRotateGroup) {
      onRotateGroup(targetStudent, targetGroup);
    }

    setIsRotationModalOpen(false);
    setIsRotatingGroup(false);

    setRotationNotice(
      `Laporan [${prevGroupName}] berhasil disimpan permanen! Meja praktikum & tabel pengamatan direset bersih untuk [${targetGroup}].`
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

  const filteredQuestions =
    questionMode === 'dynamic'
      ? dynamicQuestions
      : WORKSHEET_QUESTIONS.filter((q) => {
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
        No: i + 1,
        Waktu: r.timestamp,
        X: r.numericX ?? 0,
        Y1: r.numericY1 ?? 0,
        Parameter: r.parametersSummary,
      }));

      const telemetryLog = buildSubmissionTelemetryTimeline(domain || 'Fisika', obsPayload);
      const clientMutationId = generateMutationUuid();
      const submissionBody = {
        studentName: activeStudentName,
        studentId: activeGroupId,
        roomId: activeRoomId,
        schoolId: DEFAULT_SCHOOL_ID,
        clientMutationId,
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
      };

      const enqueueSubmissionOffline = async () => {
        await enqueueOutboxMutation({
          endpoint: '/api/submissions',
          method: 'POST',
          schoolId: DEFAULT_SCHOOL_ID,
          clientMutationId,
          payload: submissionBody,
        }).catch(() => undefined);
        labSound.playSuccessChime();
        setSubmissionSuccessTicket(`3T-${clientMutationId.slice(0, 6).toUpperCase()}`);
        setSubmissionLocked(true);
      };

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueueSubmissionOffline();
        return;
      }

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': clientMutationId,
        },
        body: JSON.stringify(submissionBody),
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

      if (res.status >= 500) {
        await enqueueSubmissionOffline();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        labSound.playSuccessChime();
        setRateLimitMessage(null);
        setRateLimitCountdown(0);
        setSubmissionSuccessTicket(data.ticketCode || 'SUB-OK');
        setSubmissionLocked(true);
        recordPerfectLksQuiz(finalGrade.totalScore, domain, moduleId);
        if (regSummary.hasRegression) {
          evaluateDataPrecisionXP(regSummary.rSquared, domain, moduleId);
        }
      }
    } catch {
      const fallbackMutationId = generateMutationUuid();
      const obsFallback = (observationRecords || []).map((r, i) => ({
        No: i + 1,
        Waktu: r.timestamp,
        X: r.numericX ?? 0,
        Y1: r.numericY1 ?? 0,
        Parameter: r.parametersSummary,
      }));
      await enqueueOutboxMutation({
        endpoint: '/api/submissions',
        method: 'POST',
        schoolId: DEFAULT_SCHOOL_ID,
        clientMutationId: fallbackMutationId,
        payload: {
          studentName: activeStudentName,
          studentId: activeGroupId,
          roomId: activeRoomId,
          schoolId: DEFAULT_SCHOOL_ID,
          clientMutationId: fallbackMutationId,
          domain: domain || 'Fisika',
          moduleId: moduleId || 'lab-experiment',
          submittedAt: new Date().toISOString(),
          hypothesisText: hypothesisNote?.hypothesisText || '',
          observationData: obsFallback,
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
          telemetryLog: buildSubmissionTelemetryTimeline(domain || 'Fisika', obsFallback),
        },
      }).catch(() => undefined);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleDownloadOfflineRlab = () => {
    labSound.playSuccessChime();
    const finalGrade = gradedResult ?? gradeWorksheetAnswers(answers, filteredQuestions);
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
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-5 shadow-sm space-y-5">
      {/* Offline .rlab Download Notice Banner */}
      {offlinePacketNotice && (
        <div
          role="status"
          data-testid="offline-packet-notice"
          className="p-3.5 rounded-xl bg-[var(--comfort-accent-soft)] border border-[var(--comfort-accent-border)] flex items-center gap-2.5 text-xs text-[var(--comfort-text)] font-semibold shadow-2xs animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" />
          <span>{offlinePacketNotice}</span>
        </div>
      )}

      {/* Pass-and-Play Rotation Success Banner */}
      {rotationNotice && (
        <div
          role="status"
          data-testid="rotation-notice-banner"
          className="p-3.5 rounded-xl bg-[var(--comfort-accent-soft)] border border-[var(--comfort-accent-border)] flex items-center justify-between gap-3 text-xs text-[var(--comfort-text)] font-bold shadow-2xs animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" />
            <span>{rotationNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRotationNotice(null)}
            className="text-[var(--comfort-accent)] font-mono text-2xs underline cursor-pointer"
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
          className="p-3.5 rounded-xl bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 text-[var(--comfort-text)] font-semibold">
            <AlertTriangle className="w-4 h-4 text-[var(--comfort-warning)] shrink-0" />
            <span className="leading-relaxed">{rateLimitMessage}</span>
          </div>
          {rateLimitCountdown > 0 && (
            <span className="font-mono font-bold text-2xs px-2.5 py-0.5 rounded bg-[var(--comfort-surface)] text-[var(--comfort-warning)] shrink-0">
              Tunggu {rateLimitCountdown} dtk
            </span>
          )}
        </div>
      )}

      {/* Submission Lock Banner */}
      {isSubmissionLocked && (
        <div
          role="status"
          data-testid="lks-submission-locked-banner"
          className="p-3.5 rounded-xl bg-[var(--comfort-warning-soft)] border border-[var(--comfort-warning-border)] flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 text-[var(--comfort-text)] font-semibold">
            <Lock className="w-4 h-4 text-[var(--comfort-warning)] shrink-0" />
            <span>{t('lks.lockedNotice')}</span>
          </div>
          {submissionSuccessTicket && (
            <span className="font-mono font-bold text-2xs px-2 py-0.5 rounded bg-[var(--comfort-success-soft)] text-[var(--comfort-success)]">
              Tiket: {submissionSuccessTicket}
            </span>
          )}
        </div>
      )}

      {/* Ticket Modal Confirmation */}
      {submissionSuccessTicket && (
        <div className="p-4 rounded-2xl bg-[var(--comfort-success-soft)] border border-[var(--comfort-success-border)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--comfort-success)] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-sm text-[var(--comfort-text)]">
                  Laporan Berhasil Diserahkan ke Guru!
                </h4>
                <span className="text-2xs font-mono font-extrabold px-2 py-0.5 rounded-full bg-[var(--comfort-surface)] text-[var(--comfort-success)]">
                  {submissionSuccessTicket}
                </span>
              </div>
              <p className="comfort-report-prose text-[var(--comfort-text-muted)]">
                Laporan praktikum beserta rekaman telemetri kronologis telah tersimpan di portal guru dan dikunci.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmissionSuccessTicket(null)}
            className="comfort-btn-secondary px-3.5 py-1.5 rounded-xl font-bold text-xs shrink-0 cursor-pointer"
          >
            Tutup Bukti Tiket
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg comfort-accent-soft flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-[var(--comfort-text)]">
              {t('lks.title')}
            </h3>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              {t('lks.studentLabel')}: <strong className="text-[var(--comfort-text)]">{activeStudentName}</strong> ({activeGroupId})
            </p>
          </div>
        </div>

        {/* Mode & Domain Filter and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs">
            <button
              type="button"
              data-testid="lks-mode-dynamic-btn"
              onClick={() => {
                labSound.playClick();
                setQuestionMode('dynamic');
                setGradedResult(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                questionMode === 'dynamic'
                  ? 'bg-[var(--comfort-surface)] text-[var(--comfort-accent)] shadow-xs'
                  : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
            >
              Soal Modul Aktif ({dynamicQuestions.length})
            </button>
            <button
              type="button"
              data-testid="lks-mode-bank-btn"
              onClick={() => {
                labSound.playClick();
                setQuestionMode('bank');
                setGradedResult(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                questionMode === 'bank'
                  ? 'bg-[var(--comfort-surface)] text-[var(--comfort-accent)] shadow-xs'
                  : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
              }`}
            >
              Bank Lintas Domain
            </button>
          </div>

          {questionMode === 'bank' && (
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-xs">
              <Filter className="w-3.5 h-3.5 text-[var(--comfort-text-muted)] ml-1.5" />
              {(['Semua', 'Fisika', 'Kimia', 'Biologi', 'Astronomi'] as const).map((dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setLksDomainFilter(dom)}
                  className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    lksDomainFilter === dom
                      ? 'bg-[var(--comfort-surface)] text-[var(--comfort-accent)] shadow-xs'
                      : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)]'
                  }`}
                >
                  {dom === 'Semua' ? t('lks.filterAll') : dom}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            data-testid="print-blank-worksheet-btn"
            onClick={handlePrintBlankLks}
            title="Cetak Lembar Kerja Siswa (LKS) kosong hitam-putih hemat tinta untuk fotokopi siswa di kelas"
            className="comfort-btn-secondary px-3 py-1.5 min-h-[38px] rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
            <span>Cetak LKS Kosong</span>
          </button>

          <button
            type="button"
            data-testid="pass-and-play-rotation-btn"
            onClick={() => {
              labSound.playClick();
              setIsRotationModalOpen(true);
            }}
            title="Simpan laporan kelompok aktif dan reset meja praktikum untuk giliran kelompok berikutnya (Pass-and-Play)"
            className="comfort-btn-secondary px-3 py-1.5 min-h-[38px] rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
            <span>Ganti Giliran</span>
          </button>

          {onPrintPDFReport && (
            <button
              type="button"
              onClick={() => onPrintPDFReport(conclusionText)}
              className="comfort-btn-secondary px-3.5 py-1.5 min-h-[38px] rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--comfort-accent)]" />
              <span>{t('lks.printPdf')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmitReportToTeacher}
            disabled={isSubmittingReport || isSubmissionLocked}
            className="comfort-btn-primary px-3.5 py-1.5 min-h-[38px] rounded-xl disabled:opacity-50 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
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

      {/* Hypothesis Review & Conclusion Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-2">
          <span className="text-2xs font-bold uppercase tracking-wider text-[var(--comfort-accent)] block">
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
            className="w-full text-[0.8125rem] leading-relaxed p-2.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] focus:outline-none focus:border-[var(--comfort-accent)] disabled:opacity-60"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] space-y-3">
          <div
            data-testid="lks-data-pattern-summary"
            className={`p-3 rounded-xl border space-y-1.5 ${
              patternTranslation.status === 'ready'
                ? 'bg-[var(--comfort-accent-soft)] border-[var(--comfort-accent-border)]'
                : 'bg-[var(--comfort-warning-soft)] border-[var(--comfort-warning-border)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-[var(--comfort-text)]">
                <Lightbulb className="w-3.5 h-3.5 text-[var(--comfort-accent)] shrink-0" />
                <span>Pola Data</span>
              </span>
              <div className="flex items-center gap-2">
                {patternTranslation.status === 'ready' && (
                  <span className="inline-flex items-center gap-1 font-mono text-2xs font-bold text-[var(--comfort-accent)] tabular-nums">
                    <ScienceGlossaryTerm term="R²" displayLabel="R²" />
                    <span>{patternTranslation.rSquaredPct}%</span>
                  </span>
                )}
                {patternTranslation.guidanceText && (
                  <DetailToggleButton
                    expanded={showPatternDetail}
                    onToggle={() => setShowPatternDetail((prev) => !prev)}
                    collapsedLabel="Lihat Detail"
                    expandedLabel="Ringkas"
                    className="!min-h-[28px] !py-0.5 !px-2 !text-2xs"
                  />
                )}
              </div>
            </div>
            <p className="font-medium text-[var(--comfort-text)] comfort-report-prose">
              {patternTranslation.summaryText}
            </p>
            {showPatternDetail && patternTranslation.guidanceText && (
              <p className="text-[var(--comfort-text-muted)] comfort-report-prose pt-1.5 border-t border-[var(--comfort-border)]">
                {patternTranslation.guidanceText}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="block text-2xs font-bold uppercase tracking-wider text-[var(--comfort-accent)]">
              {t('lks.finalConclusion')}
            </span>
            {onAskDrLabMu && (
              <button
                type="button"
                data-testid="review-lks-draft-ai-btn"
                onClick={handleReviewDraftWithDrLabMu}
                className="comfort-accent-soft px-2.5 py-1 rounded-lg border text-2xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-3 h-3" />
                <span>Tinjau Draf dengan Dr. LabMu</span>
              </button>
            )}
          </div>
          <textarea
            rows={3}
            disabled={isSubmissionLocked}
            data-testid="lks-conclusion-textarea"
            value={conclusionText}
            onChange={(e) => {
              if (!isSubmissionLocked) setConclusionText(e.target.value);
            }}
            placeholder="Tuliskan kesimpulan ilmiah Anda berdasarkan tren grafik, nilai R², gradien kurva, dan kesesuaian terhadap hipotesis awal..."
            className="w-full text-[0.8125rem] leading-relaxed p-2.5 rounded-lg bg-[var(--comfort-surface)] border border-[var(--comfort-border)] text-[var(--comfort-text)] focus:outline-none focus:border-[var(--comfort-accent)] disabled:opacity-60"
          />
        </div>
      </div>

      {/* Modular Custom Mission + Worksheet Questions List */}
      <WorksheetQuestionList
        activeCustomMission={activeCustomMission}
        customMissionAnswers={customMissionAnswers}
        onChangeCustomMissionAnswer={(qId, val) =>
          setCustomMissionAnswers((prev) => ({ ...prev, [qId]: val }))
        }
        filteredQuestions={filteredQuestions}
        answers={answers}
        onChangeAnswer={(qId, val) => updateAnswers((prev) => ({ ...prev, [qId]: val }))}
        hintLevelByQuestion={hintLevelByQuestion}
        onAdvanceHint={handleAdvanceHint}
        gradedResult={gradedResult}
        isSubmissionLocked={isSubmissionLocked}
        isSubmittingReport={isSubmittingReport}
        onGradeForm={handleGradeForm}
        onOpenRotationModal={() => setIsRotationModalOpen(true)}
        onDownloadOfflineRlab={handleDownloadOfflineRlab}
        onSubmitReportToTeacher={handleSubmitReportToTeacher}
      />

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
