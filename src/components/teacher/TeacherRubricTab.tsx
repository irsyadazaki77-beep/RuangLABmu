import React from 'react';
import { Activity, Cpu, Download, FileCheck2 } from 'lucide-react';
import { StudentProgressItem } from '../TeacherDashboardView';
import { calculateStudentRubric } from '../../utils/scienceEngine';
import { TheoreticalSolverRubricEvaluation } from '../../utils/academicReportExporter';
import { ClassLeaderboardCard } from '../ui/ScientificEnhancementSuite';
import { Accordion, AccordionGroup } from '../ui/Accordion';

export interface TeacherRubricTabProps {
  visibleStudents: StudentProgressItem[];
  rubricRows: Array<ReturnType<typeof calculateStudentRubric>>;
  solverAutoGradeRows: TheoreticalSolverRubricEvaluation[];
  onExportLmsGradebookCSV: (lmsFormat?: 'classroom' | 'moodle' | 'excel') => void;
  onExportClassGradesCSV: () => void;
}

const renderStudentActivityRow = (stu: StudentProgressItem) => (
  <tr key={stu.id} className="hover:bg-[var(--comfort-surface-subtle)] transition-colors">
    <td className="py-3 pr-3 align-middle">
      <div className="font-semibold text-[var(--comfort-text)]">{stu.name}</div>
      <div className="text-[var(--comfort-text-muted)] mt-0.5">
        {stu.groupId} · {stu.lastActive}
      </div>
    </td>
    <td className="py-3 px-3 align-middle">
      <div className="text-[var(--comfort-text)] font-medium">{stu.currentActivity}</div>
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
        <span className="font-semibold text-[var(--comfort-text)]">{stu.completionPct}%</span>
      </div>
      <div className="w-full h-2 bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            stu.completionPct >= 80
              ? 'bg-[var(--comfort-success)]'
              : stu.completionPct >= 50
                ? 'bg-[var(--comfort-accent)]'
                : 'bg-[var(--comfort-warning)]'
          }`}
          style={{ width: `${stu.completionPct}%` }}
        />
      </div>
    </td>
    <td className="py-3 pl-3 align-middle font-mono whitespace-nowrap">
      {stu.status === 'Selesai' && (
        <span className="text-[var(--comfort-success)] font-semibold">Selesai</span>
      )}
      {stu.status === 'Nominal' && (
        <span className="text-[var(--comfort-accent)] font-semibold">Aktif</span>
      )}
      {stu.status === 'Butuh Bantuan' && (
        <span className="text-[var(--comfort-warning)] font-semibold">▲ Butuh Arahan</span>
      )}
    </td>
  </tr>
);

const renderRubricRow = (row: ReturnType<typeof calculateStudentRubric>) => (
  <tr key={row.studentId} className="hover:bg-[var(--comfort-surface-subtle)] transition-colors">
    <td className="py-3 pr-3 font-sans">
      <div className="font-semibold text-[var(--comfort-text)]">{row.studentName}</div>
      <div className="text-[var(--comfort-text-muted)]">{row.groupId}</div>
    </td>
    <td className="py-3 px-3 text-right text-[var(--comfort-text)]">{row.experimentScore}</td>
    <td className="py-3 px-3 text-right text-[var(--comfort-text)]">
      {row.regressionAnalysisScore}
    </td>
    <td className="py-3 px-3 text-right text-[var(--comfort-text)]">{row.collaborationScore}</td>
    <td className="py-3 px-3 text-right text-[var(--comfort-text)]">{row.worksheetQuizScore}</td>
    <td className="py-3 px-3 text-right font-bold text-[var(--comfort-text)] text-sm">
      {row.finalTotalScore}
    </td>
    <td className="py-3 pl-3 whitespace-nowrap">
      <span
        className={`font-semibold ${
          row.letterGrade === 'A'
            ? 'text-[var(--comfort-success)]'
            : row.letterGrade === 'B'
              ? 'text-[var(--comfort-accent)]'
              : 'text-[var(--comfort-warning)]'
        }`}
      >
        Grade {row.letterGrade} · {row.predicate}
      </span>
    </td>
  </tr>
);

const renderSolverRow = (ev: TheoreticalSolverRubricEvaluation) => (
  <tr key={ev.studentId} className="hover:bg-[var(--comfort-surface-subtle)]">
    <td className="py-2.5 pr-3">
      <div className="font-semibold text-[var(--comfort-text)]">{ev.studentName}</div>
      <div className="text-2xs text-[var(--comfort-text-muted)]">{ev.moduleTitle}</div>
    </td>
    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--comfort-text)]">
      {ev.theoreticalSolverValue.toFixed(2)}
    </td>
    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--comfort-text)]">
      {ev.observedValue.toFixed(2)}
    </td>
    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--comfort-warning)] font-semibold">
      {ev.percentDeviation.toFixed(2)}%
    </td>
    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[var(--comfort-success)]">
      {ev.totalScore}/100 ({ev.letterGrade})
    </td>
    <td className="py-2.5 pl-3 text-2xs text-[var(--comfort-text-muted)] max-w-md leading-relaxed comfort-report-prose">
      {ev.diagnosticFeedback}
    </td>
  </tr>
);

export const TeacherRubricTab: React.FC<TeacherRubricTabProps> = ({
  visibleStudents,
  rubricRows,
  solverAutoGradeRows,
  onExportLmsGradebookCSV,
  onExportClassGradesCSV,
}) => {
  // Prioritize students needing help first so the initial 2-row preview is immediately actionable
  const prioritizedStudents = [...visibleStudents].sort((a, b) => {
    const rank = (status: StudentProgressItem['status']) =>
      status === 'Butuh Bantuan' ? 0 : status === 'Nominal' ? 1 : 2;
    return rank(a.status) - rank(b.status);
  });
  const previewStudents = prioritizedStudents.slice(0, 2);
  const extraStudents = prioritizedStudents.slice(2);

  const previewRubricRows = rubricRows.slice(0, 2);
  const extraRubricRows = rubricRows.slice(2);

  // Surface the 2 highest-deviation solver diagnostics first
  const prioritizedSolverRows = [...solverAutoGradeRows].sort(
    (a, b) => b.percentDeviation - a.percentDeviation
  );
  const previewSolverRows = prioritizedSolverRows.slice(0, 2);
  const extraSolverRows = prioritizedSolverRows.slice(2);

  return (
    <div className="lg:col-span-12 space-y-5">
      <ClassLeaderboardCard students={visibleStudents} />

      <AccordionGroup className="space-y-4">
        {/* 1. Student Live Activity Table (2 priority rows visible initially) */}
        <Accordion
          title="Pemantauan Aktivitas & Progres Siswa"
          subtitle="Memantau parameter aktif, jumlah rekaman data, dan penyelesaian tugas tiap siswa"
          meta={`${visibleStudents.length} siswa`}
          icon={<Activity className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
          collapsedLabel={`Lihat semua ${visibleStudents.length} siswa`}
          expandedLabel="Tampilkan 2 prioritas utama"
          collapsedHint="Menampilkan 2 siswa prioritas terlebih dahulu agar tabel mudah dipindai"
          expandedHint="Menampilkan seluruh daftar aktivitas siswa kelas"
          hiddenCount={extraStudents.length > 0 ? extraStudents.length : undefined}
          testId="teacher-activity-accordion"
          toggleTestId="teacher-activity-detail-toggle"
          previewClassName="px-4 sm:px-5 py-3 overflow-x-auto"
          contentClassName="px-4 sm:px-5 pb-4 pt-2 border-t border-[var(--comfort-border)] overflow-x-auto"
          preview={
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text-muted)]">
                  <th className="py-2 pr-3">Nama Siswa &amp; Kelompok</th>
                  <th className="py-2 px-3">Aktivitas Eksperimen Saat Ini</th>
                  <th className="py-2 px-3">Data &amp; Tugas</th>
                  <th className="py-2 px-3">Progres</th>
                  <th className="py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--comfort-border)] text-xs">
                {previewStudents.map(renderStudentActivityRow)}
              </tbody>
            </table>
          }
        >
          {extraStudents.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-[var(--comfort-border)] text-xs">
                {extraStudents.map(renderStudentActivityRow)}
              </tbody>
            </table>
          ) : null}
        </Accordion>

        {/* 2. Automated Rubric Grading Matrix & Class CSV Export (2 rows visible initially) */}
        <Accordion
          title="Matriks Rubrik Penilaian Otomatis & Rekap Nilai Kelas"
          subtitle="Eksperimen (25%) · Analisis Regresi (25%) · Kolaborasi (25%) · Skor LKS/Kuis (25%)"
          meta={`${rubricRows.length} siswa`}
          icon={<FileCheck2 className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
          collapsedLabel="Lihat matriks rubrik lengkap"
          expandedLabel="Tampilkan 2 baris ringkas"
          collapsedHint="2 baris rekap rubrik ditampilkan awal · klik untuk membuka seluruh kelas"
          expandedHint="Seluruh matriks nilai rubrik kelas ditampilkan"
          hiddenCount={extraRubricRows.length > 0 ? extraRubricRows.length : undefined}
          testId="teacher-rubric-matrix-accordion"
          toggleTestId="teacher-rubric-matrix-toggle"
          previewClassName="px-4 sm:px-5 py-3 overflow-x-auto"
          contentClassName="px-4 sm:px-5 pb-4 pt-2 border-t border-[var(--comfort-border)] overflow-x-auto"
          headerRight={
            <>
              <button
                type="button"
                data-testid="export-lms-gradebook-csv-btn"
                onClick={() => onExportLmsGradebookCSV('excel')}
                className="comfort-btn-primary flex items-center gap-1.5 px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ekspor CSV LMS</span>
              </button>
              <button
                type="button"
                onClick={onExportClassGradesCSV}
                className="comfort-btn-secondary flex items-center gap-1.5 px-3.5 py-2 min-h-[36px] text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[var(--comfort-accent)]" aria-hidden="true" />
                <span>Rekap Nilai (CSV)</span>
              </button>
            </>
          }
          preview={
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--comfort-border)] text-xs font-semibold text-[var(--comfort-text-muted)]">
                  <th className="py-2 pr-3">Nama Siswa &amp; Kelompok</th>
                  <th className="py-2 px-3 text-right">Eksperimen (25%)</th>
                  <th className="py-2 px-3 text-right">Regresi Data (25%)</th>
                  <th className="py-2 px-3 text-right">Kolaborasi (25%)</th>
                  <th className="py-2 px-3 text-right">Skor LKS (25%)</th>
                  <th className="py-2 px-3 text-right">Nilai Akhir</th>
                  <th className="py-2 pl-3">Predikat Rubrik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--comfort-border)] text-xs font-mono tabular-nums">
                {previewRubricRows.map(renderRubricRow)}
              </tbody>
            </table>
          }
        >
          {extraRubricRows.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-[var(--comfort-border)] text-xs font-mono tabular-nums">
                {extraRubricRows.map(renderRubricRow)}
              </tbody>
            </table>
          ) : null}
        </Accordion>

        {/* 3. RK4 / Velocity Verlet Solver Diagnostic Matrix (top 2 highest deviation visible initially) */}
        <Accordion
          title="Auto-Grading Diagnostik vs Solver Numerik RK4 / Velocity Verlet"
          subtitle="Membandingkan regresi & propagasi ralat ketidakpastian siswa terhadap referensi solver teoretis"
          meta={`${solverAutoGradeRows.length} evaluasi`}
          icon={<Cpu className="w-4 h-4 text-[var(--comfort-accent)] shrink-0" aria-hidden="true" />}
          collapsedLabel="Lihat semua diagnostik solver"
          expandedLabel="Tampilkan 2 deviasi tertinggi"
          collapsedHint="Menampilkan 2 siswa dengan deviasi tertinggi untuk tindak lanjut cepat"
          expandedHint="Menampilkan seluruh matriks umpan balik diagnostik RK4"
          hiddenCount={extraSolverRows.length > 0 ? extraSolverRows.length : undefined}
          testId="teacher-solver-diagnostic-accordion"
          toggleTestId="teacher-solver-diagnostic-toggle"
          previewClassName="px-4 sm:px-5 py-3 overflow-x-auto"
          contentClassName="px-4 sm:px-5 pb-4 pt-2 border-t border-[var(--comfort-border)] overflow-x-auto"
          preview={
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
                {previewSolverRows.map(renderSolverRow)}
              </tbody>
            </table>
          }
        >
          {extraSolverRows.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <tbody className="divide-y divide-[var(--comfort-border)]">
                {extraSolverRows.map(renderSolverRow)}
              </tbody>
            </table>
          ) : null}
        </Accordion>
      </AccordionGroup>
    </div>
  );
};
