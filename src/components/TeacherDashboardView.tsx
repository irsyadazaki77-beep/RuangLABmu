import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown,
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
  const [classControlsOpen, setClassControlsOpen] = useState<boolean>(false);
  const broadcastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (broadcastTimerRef.current !== null) {
        window.clearTimeout(broadcastTimerRef.current);
        broadcastTimerRef.current = null;
      }
    };
  }, []);

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
    if (broadcastTimerRef.current !== null) {
      window.clearTimeout(broadcastTimerRef.current);
    }
    broadcastTimerRef.current = window.setTimeout(() => {
      setBroadcastSentNotice(false);
      broadcastTimerRef.current = null;
    }, 3000);
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
    <div className="space-y-4">
      {/* Compact Single-Row Scannable KPI Metric Bar */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--comfort-border)]">
        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          title={`Terbagi dalam ${uniqueGroupCount} kelompok praktikum kolaboratif`}
        >
          <div>
            <div className="text-2xs font-medium text-[var(--comfort-text-muted)]">Siswa Aktif</div>
            <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
              <span className="text-2xl font-mono font-bold text-[var(--comfort-text)]">
                {students.length}
              </span>
              <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">
                · {uniqueGroupCount} kel.
              </span>
            </div>
          </div>
          <Activity className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
        </div>

        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          title={`Domain aktif: ${activeDomainsLabel} · Target capaian 80%`}
        >
          <div>
            <div className="text-2xs font-medium text-[var(--comfort-text-muted)]">Progres Modul</div>
            <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
              <span className="text-2xl font-mono font-bold text-[var(--comfort-success)]">
                {avgCompletion}%
              </span>
              <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">rata-rata</span>
            </div>
          </div>
          <Award className="w-4 h-4 text-[var(--comfort-success)] shrink-0" aria-hidden="true" />
        </div>

        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          title="Total data percobaan siswa yang siap dievaluasi dan diekspor ke CSV"
        >
          <div>
            <div className="text-2xs font-medium text-[var(--comfort-text-muted)]">Data Terekam</div>
            <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
              <span className="text-2xl font-mono font-bold text-[var(--comfort-text)]">
                {totalTrials}
              </span>
              <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">uji</span>
            </div>
          </div>
          <ClipboardList className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
        </div>

        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          title="Deteksi otomatis saat R² < 0.80 atau tertahan > 8 menit"
        >
          <div>
            <div className="text-2xs font-medium text-[var(--comfort-text-muted)]">Perlu Arahan</div>
            <div className="flex items-baseline gap-1.5 mt-0.5 tabular-nums">
              <span className="text-2xl font-mono font-bold text-[var(--comfort-warning)]">
                {studentsNeedingHelp}
              </span>
              <span className="text-2xs font-mono text-[var(--comfort-text-muted)]">siswa</span>
            </div>
          </div>
          <AlertTriangle className="w-4 h-4 text-[var(--comfort-warning)] shrink-0" aria-hidden="true" />
        </div>
      </div>

      {/* Unified Collapsible Classroom Control Strip (Timer + Quick Broadcast) */}
      <div
        data-testid="teacher-countdown-timer"
        className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-xl overflow-hidden"
      >
        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Timer className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />
            <span className="text-xs font-bold text-[var(--comfort-text)]">
              Kontrol Kelas
            </span>
            <span aria-hidden="true" className="text-[var(--comfort-text-muted)] opacity-45">·</span>
            <span
              data-testid="teacher-timer-display"
              className={`text-sm font-mono font-bold tabular-nums ${
                remainingSeconds <= 60
                  ? 'text-[var(--comfort-danger)]'
                  : 'text-[var(--comfort-text)]'
              }`}
            >
              {formattedTimer}
            </span>
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
              className="comfort-btn-primary px-2.5 py-1 rounded-lg text-2xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-3 h-3" aria-hidden="true" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" aria-hidden="true" />
                  <span>Mulai</span>
                </>
              )}
            </button>
            {broadcastSentNotice && (
              <span className="text-2xs font-semibold text-[var(--comfort-success)]">
                · Instruksi tersiarkan
              </span>
            )}
          </div>

          <button
            type="button"
            data-testid="teacher-class-controls-toggle"
            aria-expanded={classControlsOpen}
            onClick={() => {
              labSound.playClick();
              setClassControlsOpen((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--comfort-accent)] hover:bg-[var(--comfort-accent-soft)] transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <span>{classControlsOpen ? 'Sembunyikan' : 'Atur Timer & Siaran'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                classControlsOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {classControlsOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-[var(--comfort-border)] grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-semibold text-[var(--comfort-text-muted)] mr-1">
                Durasi:
              </span>
              {[5, 10, 15, 30].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => handleSelectTimerPreset(min)}
                  className={`px-2 py-1 rounded-lg text-2xs font-mono font-semibold border cursor-pointer transition-colors ${
                    timerPresetMin === min && !isTimerRunning && remainingSeconds === min * 60
                      ? 'comfort-tab-active border-transparent'
                      : 'comfort-btn-secondary text-[var(--comfort-text-muted)]'
                  }`}
                >
                  {min}m
                </button>
              ))}
              <button
                type="button"
                aria-label="Reset Pengatur Waktu"
                onClick={() => handleSelectTimerPreset(timerPresetMin)}
                className="comfort-btn-secondary p-1.5 rounded-lg text-[var(--comfort-text-muted)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <span className="text-2xs font-mono text-[var(--comfort-success)] font-semibold ml-auto inline-flex items-center gap-1 tabular-nums">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Konvergen {students.filter((s) => (s.rSquared ?? 0.95) >= 0.8).length}/{students.length}
              </span>
            </div>

            <form
              onSubmit={handleQuickBroadcast}
              className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <input
                type="text"
                data-testid="teacher-quick-broadcast-input"
                value={quickBroadcastText}
                onChange={(e) => setQuickBroadcastText(e.target.value)}
                placeholder="Siarkan instruksi cepat ke seluruh kelompok..."
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] text-xs text-[var(--comfort-text)] focus:outline-none focus:border-[var(--comfort-accent)]"
              />
              <button
                type="submit"
                data-testid="teacher-quick-broadcast-btn"
                disabled={!quickBroadcastText.trim()}
                className="comfort-btn-primary min-h-[38px] px-3.5 py-1.5 rounded-lg disabled:opacity-50 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Siarkan</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Focused 3-Tab Switcher for Teacher Dashboard */}
      <div
        role="tablist"
        aria-label="Navigasi Dashboard Pengajar"
        className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-xs overflow-x-auto no-scrollbar"
      >
        <button
          type="button"
          role="tab"
          aria-selected={teacherTab === 'radar'}
          onClick={() => {
            labSound.playClick();
            setTeacherTab('radar');
          }}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
            teacherTab === 'radar'
              ? 'comfort-tab-active'
              : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span>1. Radar Progres Kelas</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={teacherTab === 'rubrik'}
          onClick={() => {
            labSound.playClick();
            setTeacherTab('rubrik');
          }}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
            teacherTab === 'rubrik'
              ? 'comfort-tab-active'
              : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
          }`}
        >
          <FileCheck2 className="w-4 h-4 shrink-0" />
          <span>2. Aktivitas &amp; Rubrik Nilai</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={teacherTab === 'ujian-misteri'}
          onClick={() => {
            labSound.playClick();
            setTeacherTab('ujian-misteri');
          }}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
            teacherTab === 'ujian-misteri'
              ? 'comfort-tab-active'
              : 'text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] hover:text-[var(--comfort-text)]'
          }`}
        >
          <Radio className="w-4 h-4 shrink-0" />
          <span>3. Ujian Sampel Misterius</span>
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
