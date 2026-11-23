import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  Award,
  ClipboardList,
  FileCheck2,
  Radio,
  Compass,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  ExperimentRecord,
  ScienceDomain,
  calculateStudentRubric,
  exportRubricGradesToCSV,
} from '../utils/scienceEngine';
import {
  evaluateTheoreticalSolverRubricGrade,
  resolveDefaultTheoreticalSolverTarget,
  exportLmsGradebookCsv,
} from '../utils/academicReportExporter';
import { labSound } from '../utils/soundEngine';
import {
  MysterySampleChallenge,
  MysterySubmissionResult,
} from '../utils/mysteryChallengeEngine';
import { buildRadarLanes } from '../utils/telemetryRadar';
import { TeacherRadarTab } from './teacher/TeacherRadarTab';
import { TeacherRubricTab } from './teacher/TeacherRubricTab';
import { TeacherMysteryExamTab } from './teacher/TeacherMysteryExamTab';

export interface StudentProgressItem {
  id: string;
  name: string;
  groupId: string;
  activeDomain: ScienceDomain;
  currentActivity: string;
  trialsRecorded: number;
  tasksCompleted: number;
  totalTasks: number;
  completionPct: number;
  quizScore?: number;
  lastActive: string;
  status: 'Nominal' | 'Butuh Bantuan' | 'Selesai';
  currentStep?: 1 | 2 | 3 | 4;
  activeModuleTitle?: string;
  timeInStepMinutes?: number;
  rSquared?: number;
}

interface TeacherDashboardViewProps {
  students: StudentProgressItem[];
  records: ExperimentRecord[];
  onSendTeacherFeedback: (targetStudentId: string, message: string) => void;
  onExportGradesNotification: (studentCount: number) => void;
  activeMysteryChallenge?: MysterySampleChallenge | null;
  onBroadcastMysteryChallenge?: (challenge: MysterySampleChallenge) => void;
  mysterySubmissions?: MysterySubmissionResult[];
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  students,
  records,
  onSendTeacherFeedback,
  onExportGradesNotification,
  activeMysteryChallenge,
  onBroadcastMysteryChallenge,
  mysterySubmissions = [],
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('Semua');
  const [teacherTab, setTeacherTab] = useState<'radar' | 'rubrik' | 'ujian-misteri'>('radar');

  // Lab Session Countdown Timer (seconds)
  const [timerPresetMin, setTimerPresetMin] = useState<number>(15);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(15 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [quickBroadcastText, setQuickBroadcastText] = useState<string>('');
  const [broadcastSentNotice, setBroadcastSentNotice] = useState<boolean>(false);

  useEffect(() => {
    if (!isTimerRunning) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          labSound.playSuccessChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTimerRunning]);

  const handleSelectTimerPreset = (minutes: number) => {
    labSound.playClick();
    setTimerPresetMin(minutes);
    setRemainingSeconds(minutes * 60);
    setIsTimerRunning(false);
  };

  const handleQuickBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickBroadcastText.trim();
    if (!trimmed) return;
    labSound.playSuccessChime();
    onSendTeacherFeedback('all', trimmed);
    setQuickBroadcastText('');
    setBroadcastSentNotice(true);
    window.setTimeout(() => setBroadcastSentNotice(false), 3000);
  };

  const formattedTimer = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(
    remainingSeconds % 60
  ).padStart(2, '0')}`;

  const radarLanes = useMemo(() => {
    return buildRadarLanes(students, groupFilter);
  }, [students, groupFilter]);

  const avgCompletion =
    students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + s.completionPct, 0) / students.length)
      : 0;

  const totalTrials = records.length;
  const studentsNeedingHelp = students.filter((s) => s.status === 'Butuh Bantuan').length;
  const groups = ['Semua', ...Array.from(new Set(students.map((s) => s.groupId)))];
  const uniqueGroupCount = Math.max(0, groups.length - 1);
  const activeDomainsLabel = useMemo(() => {
    const domainSet = new Set<string>();
    const mapLabel = (d: string) => {
      const low = d.toLowerCase();
      if (low.includes('fis') || low.includes('phys')) return 'Fisika';
      if (low.includes('kim') || low.includes('chem')) return 'Kimia';
      if (low.includes('bio')) return 'Biologi';
      if (low.includes('astro')) return 'Astronomi';
      return d;
    };
    students.forEach((s) => domainSet.add(mapLabel(s.activeDomain)));
    records.forEach((r) => domainSet.add(mapLabel(r.domain)));
    const arr = Array.from(domainSet);
    return arr.length > 0 ? arr.join(', ') : '4 Domain STEM';
  }, [students, records]);

  const visibleStudents = students.filter((s) =>
    groupFilter === 'Semua' ? true : s.groupId === groupFilter
  );

  const rubricRows = visibleStudents.map((stu) => calculateStudentRubric(stu));

  const solverAutoGradeRows = useMemo(() => {
    return visibleStudents.map((stu) => {
      const targetSpec = resolveDefaultTheoreticalSolverTarget(
        stu.activeDomain,
        stu.activeModuleTitle || stu.currentActivity
      );
      const rSq = stu.rSquared ?? 0.94;
      const simulatedDriftFactor = 1 - Math.max(0.008, (1 - rSq) * 0.35);
      const observedVal = Number((targetSpec.targetValue * simulatedDriftFactor).toFixed(4));
      return evaluateTheoreticalSolverRubricGrade({
        studentId: stu.id,
        studentName: stu.name,
        groupId: stu.groupId,
        domain: stu.activeDomain,
        moduleTitle: stu.activeModuleTitle || stu.currentActivity,
        observedValue: observedVal,
        theoreticalSolverValue: targetSpec.targetValue,
        rSquared: rSq,
        relativeUncertaintyPct: Number(Math.max(1.1, (1 - rSq) * 28).toFixed(2)),
        trialsRecorded: stu.trialsRecorded,
        worksheetScore: stu.quizScore,
      });
    });
  }, [visibleStudents]);

  const handleExportClassGradesCSV = () => {
    labSound.playClick();
    const allRubrics = students.map((stu) => calculateStudentRubric(stu));
    const csvContent = exportRubricGradesToCSV(allRubrics);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'simulab-rekap-nilai-rubrik-kelas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportGradesNotification(allRubrics.length);
  };

  const handleExportLmsGradebookCSV = (
    lmsFormat: 'classroom' | 'moodle' | 'excel' = 'classroom'
  ) => {
    labSound.playClick();
    const allEvaluations = students.map((stu) => {
      const targetSpec = resolveDefaultTheoreticalSolverTarget(
        stu.activeDomain,
        stu.activeModuleTitle || stu.currentActivity
      );
      const rSq = stu.rSquared ?? 0.94;
      const simulatedDriftFactor = 1 - Math.max(0.008, (1 - rSq) * 0.35);
      return evaluateTheoreticalSolverRubricGrade({
        studentId: stu.id,
        studentName: stu.name,
        groupId: stu.groupId,
        domain: stu.activeDomain,
        moduleTitle: stu.activeModuleTitle || stu.currentActivity,
        observedValue: Number((targetSpec.targetValue * simulatedDriftFactor).toFixed(4)),
        theoreticalSolverValue: targetSpec.targetValue,
        rSquared: rSq,
        relativeUncertaintyPct: Number(Math.max(1.1, (1 - rSq) * 28).toFixed(2)),
        trialsRecorded: stu.trialsRecorded,
        worksheetScore: stu.quizScore,
      });
    });
    const csvContent = exportLmsGradebookCsv(allEvaluations, lmsFormat);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ruanglabmu-gradebook-lms-${lmsFormat}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportGradesNotification(allEvaluations.length);
  };

  return (
    <div className="space-y-6">
      {/* Top 4-Column Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Siswa Aktif di Laboratorium</span>
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-[var(--comfort-text)] tabular-nums">
              {students.length}
            </span>
            <span className="text-xs font-mono text-[var(--comfort-text-muted)] ml-1.5">
              SISWA ONLINE
            </span>
          </div>
          <div className="mt-1 text-xs text-[var(--comfort-text-muted)] tabular-nums">
            Terbagi dalam {uniqueGroupCount} kelompok praktikum kolaboratif
          </div>
        </div>

        <div className="bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Rata-Rata Progres Modul</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {avgCompletion}%
            </span>
            <span className="text-xs font-mono text-[var(--comfort-text-muted)] ml-1.5">
              TERCAPAI
            </span>
          </div>
          <div className="mt-1 text-xs text-[var(--comfort-text-muted)]">
            Domain aktif: {activeDomainsLabel} · Target 80%
          </div>
        </div>

        <div className="bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Total Data Eksperimen Terekam</span>
            <ClipboardList className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-[var(--comfort-text)] tabular-nums">
              {totalTrials}
            </span>
            <span className="text-xs font-mono text-[var(--comfort-text-muted)] ml-1.5">
              PERCOBAAN
            </span>
          </div>
          <div className="mt-1 text-xs text-[var(--comfort-text-muted)]">
            Siap dievaluasi dan diekspor ke CSV
          </div>
        </div>

        <div className="bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--comfort-text-muted)]">
            <span>Status Bimbingan Siswa</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {studentsNeedingHelp}
            </span>
            <span className="text-xs font-mono text-[var(--comfort-text-muted)] ml-1.5">
              PERLU ARAHAN
            </span>
          </div>
          <div className="mt-1 text-xs text-[var(--comfort-text-muted)]">
            Deteksi otomatis saat R² &lt; 0.80 atau tertahan &gt; 8 menit
          </div>
        </div>
      </div>

      {/* Pengatur Waktu Praktikum (Countdown Timer) & Siaran Instruksi Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          data-testid="teacher-countdown-timer"
          className="lg:col-span-5 bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600/12 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Timer className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--comfort-text-muted)] font-semibold">
                Pengatur Waktu Praktikum
              </div>
              <div
                data-testid="teacher-timer-display"
                className={`text-2xl font-mono font-bold tabular-nums leading-tight ${
                  remainingSeconds <= 60
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[var(--comfort-text)]'
                }`}
              >
                {formattedTimer}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[5, 10, 15, 30].map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => handleSelectTimerPreset(min)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${
                  timerPresetMin === min && !isTimerRunning && remainingSeconds === min * 60
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] border-[var(--comfort-border)] hover:text-[var(--comfort-text)]'
                }`}
              >
                {min}m
              </button>
            ))}

            <button
              type="button"
              data-testid="teacher-timer-toggle-btn"
              onClick={() => {
                labSound.playClick();
                if (remainingSeconds === 0) {
                  setRemainingSeconds(timerPresetMin * 60);
                }
                setIsTimerRunning((prev) => !prev);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mulai</span>
                </>
              )}
            </button>

            <button
              type="button"
              aria-label="Reset Pengatur Waktu"
              onClick={() => handleSelectTimerPreset(timerPresetMin)}
              className="p-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleQuickBroadcast}
          className="lg:col-span-7 bg-[var(--comfort-surface)] lab-glass-panel border border-[var(--comfort-border)] rounded-xl p-4 flex flex-col justify-between gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-bold">
              Siaran Instruksi Cepat ke Seluruh Kelompok
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--comfort-text-muted)] tabular-nums">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Konvergen: {students.filter((s) => (s.rSquared ?? 0.95) >= 0.8).length}/{students.length}
              </span>
              {broadcastSentNotice && (
                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                  · Instruksi tersiarkan
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="teacher-quick-broadcast-input"
              value={quickBroadcastText}
              onChange={(e) => setQuickBroadcastText(e.target.value)}
              placeholder="Contoh: Waktu tersisa 5 menit, segera catat minimal 5 titik data dan selesaikan LKS..."
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs text-[var(--comfort-text)] focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              data-testid="teacher-quick-broadcast-btn"
              disabled={!quickBroadcastText.trim()}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Siarkan</span>
            </button>
          </div>
        </form>
      </div>

      {/* Focused 3-Tab Switcher for Teacher Dashboard */}
      <div
        role="tablist"
        aria-label="Navigasi Dashboard Pengajar"
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={teacherTab === 'radar'}
          onClick={() => {
            labSound.playClick();
            setTeacherTab('radar');
          }}
          className={`px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            teacherTab === 'radar'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span>1. Radar Progres Kelas (4 Tahap)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={teacherTab === 'rubrik'}
          onClick={() => {
            labSound.playClick();
            setTeacherTab('rubrik');
          }}
          className={`px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            teacherTab === 'rubrik'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
          }`}
        >
          <FileCheck2 className="w-4 h-4 shrink-0" />
          <span>2. Tabel Aktivitas &amp; Rubrik Nilai</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={teacherTab === 'ujian-misteri'}
          onClick={() => {
            labSound.playClick();
            setTeacherTab('ujian-misteri');
          }}
          className={`px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            teacherTab === 'ujian-misteri'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
          }`}
        >
          <Radio className="w-4 h-4 shrink-0" />
          <span>3. Ujian Sampel Misterius &amp; Broadcast Arahan</span>
        </button>
      </div>

      {teacherTab === 'radar' && (
        <TeacherRadarTab
          radarLanes={radarLanes}
          groups={groups}
          groupFilter={groupFilter}
          onChangeGroupFilter={setGroupFilter}
          onSendTeacherFeedback={onSendTeacherFeedback}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {teacherTab === 'rubrik' && (
          <TeacherRubricTab
            visibleStudents={visibleStudents}
            rubricRows={rubricRows}
            solverAutoGradeRows={solverAutoGradeRows}
            onExportLmsGradebookCSV={handleExportLmsGradebookCSV}
            onExportClassGradesCSV={handleExportClassGradesCSV}
          />
        )}

        {teacherTab === 'ujian-misteri' && (
          <TeacherMysteryExamTab
            students={students}
            activeMysteryChallenge={activeMysteryChallenge}
            onBroadcastMysteryChallenge={onBroadcastMysteryChallenge}
            mysterySubmissions={mysterySubmissions}
            onSendTeacherFeedback={onSendTeacherFeedback}
          />
        )}
      </div>
    </div>
  );
};
