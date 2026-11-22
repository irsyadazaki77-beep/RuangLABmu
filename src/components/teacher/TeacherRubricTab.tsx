import React from 'react';
import { Download, FileCheck2 } from 'lucide-react';
import { StudentProgressItem } from '../TeacherDashboardView';
import { calculateStudentRubric } from '../../utils/scienceEngine';
import { TheoreticalSolverRubricEvaluation } from '../../utils/academicReportExporter';
import { ClassLeaderboardCard } from '../ui/ScientificEnhancementSuite';

export interface TeacherRubricTabProps {
  visibleStudents: StudentProgressItem[];
  rubricRows: Array<ReturnType<typeof calculateStudentRubric>>;
  solverAutoGradeRows: TheoreticalSolverRubricEvaluation[];
  onExportLmsGradebookCSV: (lmsFormat?: 'classroom' | 'moodle' | 'excel') => void;
  onExportClassGradesCSV: () => void;
}

export const TeacherRubricTab: React.FC<TeacherRubricTabProps> = ({
  visibleStudents,
  rubricRows,
  solverAutoGradeRows,
  onExportLmsGradebookCSV,
  onExportClassGradesCSV,
}) => {
  return (
    <div className="lg:col-span-12 space-y-6">
      <ClassLeaderboardCard students={visibleStudents} />

      {/* 1. Student Live Activity Table */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--comfort-text)]">
              Pemantauan Aktivitas &amp; Progres Siswa Secara Langsung
            </h2>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              Memantau parameter yang sedang diuji, jumlah rekaman data, dan penyelesaian tugas tiap siswa
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text-muted)]">
                <th className="py-2.5 pr-3">Nama Siswa &amp; Kelompok</th>
                <th className="py-2.5 px-3">Aktivitas Eksperimen Saat Ini</th>
                <th className="py-2.5 px-3">Data &amp; Tugas</th>
                <th className="py-2.5 px-3">Progres</th>
                <th className="py-2.5 pl-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--comfort-border)] text-xs">
              {visibleStudents.map((stu) => (
                <tr key={stu.id} className="hover:bg-[var(--comfort-surface-subtle)] transition-colors">
                  <td className="py-3 pr-3 align-middle">
                    <div className="font-semibold text-[var(--comfort-text)]">{stu.name}</div>
                    <div className="text-[var(--comfort-text-muted)] mt-0.5">
                      {stu.groupId} · {stu.lastActive}
                    </div>
                  </td>
                  <td className="py-3 px-3 align-middle">
                    <div className="text-[var(--comfort-text)] font-medium">
                      {stu.currentActivity}
                    </div>
                    <div className="text-[var(--comfort-text-muted)] font-mono mt-0.5">
                      Modul: Praktikum {stu.activeDomain}
                    </div>
                  </td>
                  <td className="py-3 px-3 align-middle font-mono tabular-nums text-[var(--comfort-text)]">
                    <div>{stu.trialsRecorded} Percobaan</div>
                    <div className="text-[var(--comfort-text-muted)]">
                      {stu.tasksCompleted}/{stu.totalTasks} Tugas
                    </div>
                  </td>
                  <td className="py-3 px-3 align-middle w-32">
                    <div className="flex items-center justify-between font-mono tabular-nums mb-1">
                      <span className="font-semibold text-[var(--comfort-text)]">
                        {stu.completionPct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          stu.completionPct >= 80
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : stu.completionPct >= 50
                            ? 'bg-sky-600 dark:bg-sky-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${stu.completionPct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 pl-3 align-middle font-mono whitespace-nowrap">
                    {stu.status === 'Selesai' && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        Selesai
                      </span>
                    )}
                    {stu.status === 'Nominal' && (
                      <span className="text-sky-700 dark:text-sky-400 font-semibold">Aktif</span>
                    )}
                    {stu.status === 'Butuh Bantuan' && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        ▲ Butuh Arahan
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Automated Rubric Grading Matrix & Class CSV Export */}
      <div className="bg-[var(--comfort-surface)] border border-[var(--comfort-border)] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--comfort-text)] flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Matriks Rubrik Penilaian Otomatis &amp; Rekap Nilai Kelas</span>
            </h2>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              Eksperimen (25%) · Analisis Regresi (25%) · Tugas Kolaborasi (25%) · Skor LKS/Kuis (25%)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="export-lms-gradebook-csv-btn"
              onClick={() => onExportLmsGradebookCSV('excel')}
              className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV LMS (Classroom / Moodle / Excel)</span>
            </button>
            <button
              type="button"
              onClick={onExportClassGradesCSV}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Nilai Kelas (CSV)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text-muted)]">
                <th className="py-2.5 pr-3">Nama Siswa &amp; Kelompok</th>
                <th className="py-2.5 px-3 text-right">Eksperimen (25%)</th>
                <th className="py-2.5 px-3 text-right">Regresi Data (25%)</th>
                <th className="py-2.5 px-3 text-right">Kolaborasi (25%)</th>
                <th className="py-2.5 px-3 text-right">Skor LKS (25%)</th>
                <th className="py-2.5 px-3 text-right">Nilai Akhir</th>
                <th className="py-2.5 pl-3">Predikat Rubrik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--comfort-border)] text-xs font-mono tabular-nums">
              {rubricRows.map((row) => (
                <tr key={row.studentId} className="hover:bg-[var(--comfort-surface-subtle)] transition-colors">
                  <td className="py-3 pr-3 font-sans">
                    <div className="font-semibold text-[var(--comfort-text)]">
                      {row.studentName}
                    </div>
                    <div className="text-[var(--comfort-text-muted)]">{row.groupId}</div>
                  </td>
                  <td className="py-3 px-3 text-right text-[var(--comfort-text)]">
                    {row.experimentScore}
                  </td>
                  <td className="py-3 px-3 text-right text-[var(--comfort-text)]">
                    {row.regressionAnalysisScore}
                  </td>
                  <td className="py-3 px-3 text-right text-[var(--comfort-text)]">
                    {row.collaborationScore}
                  </td>
                  <td className="py-3 px-3 text-right text-[var(--comfort-text)]">
                    {row.worksheetQuizScore}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[var(--comfort-text)] text-sm">
                    {row.finalTotalScore}
                  </td>
                  <td className="py-3 pl-3 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        row.letterGrade === 'A'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : row.letterGrade === 'B'
                          ? 'text-sky-700 dark:text-sky-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      Grade {row.letterGrade} · {row.predicate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. RK4 / Velocity Verlet Theoretical Solver Auto-Grading Diagnostic Matrix */}
        <div className="pt-4 border-t border-[var(--comfort-border)] space-y-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--comfort-text)]">
              Auto-Grading Diagnostik vs Solver Numerik RK4 / Velocity Verlet
            </h3>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              Membandingkan hasil regresi &amp; propagasi ralat ketidakpastian siswa terhadap referensi solver teoretis
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--comfort-border)] font-semibold text-[var(--comfort-text-muted)]">
                  <th className="py-2 pr-3">Siswa &amp; Modul</th>
                  <th className="py-2 px-3 text-right">Target Solver</th>
                  <th className="py-2 px-3 text-right">Terukur</th>
                  <th className="py-2 px-3 text-right">% Deviasi</th>
                  <th className="py-2 px-3 text-right">Skor Solver</th>
                  <th className="py-2 pl-3">Feedback Diagnostik Otomatis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--comfort-border)]">
                {solverAutoGradeRows.map((ev) => (
                  <tr key={ev.studentId} className="hover:bg-[var(--comfort-surface-subtle)]">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-[var(--comfort-text)]">
                        {ev.studentName}
                      </div>
                      <div className="text-[11px] text-[var(--comfort-text-muted)]">
                        {ev.moduleTitle}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--comfort-text)]">
                      {ev.theoreticalSolverValue.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--comfort-text)]">
                      {ev.observedValue.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                      {ev.percentDeviation.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {ev.totalScore}/100 ({ev.letterGrade})
                    </td>
                    <td className="py-2.5 pl-3 text-[11px] text-[var(--comfort-text-muted)] max-w-md">
                      {ev.diagnosticFeedback}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
