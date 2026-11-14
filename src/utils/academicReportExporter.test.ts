import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTheoreticalSolverRubricGrade,
  resolveDefaultTheoreticalSolverTarget,
  exportLmsGradebookCsv,
} from './academicReportExporter';

test('resolveDefaultTheoreticalSolverTarget returns accurate solver references across domains', () => {
  const pend = resolveDefaultTheoreticalSolverTarget('Fisika', 'Bandul Matematis Harmonik');
  assert.equal(pend.targetValue, 9.81);
  assert.equal(pend.solverMethod, 'RK4');

  const hooke = resolveDefaultTheoreticalSolverTarget('Fisika', 'Osilasi Pegas Hooke');
  assert.equal(hooke.targetValue, 50.0);
  assert.equal(hooke.solverMethod, 'Velocity Verlet');

  const titration = resolveDefaultTheoreticalSolverTarget('Kimia', 'Titrasi Asam-Basa');
  assert.equal(titration.targetValue, 25.0);
});

test('evaluateTheoreticalSolverRubricGrade computes 0-100 score, percent deviation, and diagnostic feedback', () => {
  const highPrecision = evaluateTheoreticalSolverRubricGrade({
    studentId: 'stu-01',
    studentName: 'Alya Pratama',
    groupId: 'Kelompok 1',
    domain: 'Fisika',
    moduleTitle: 'Bandul Matematis',
    observedValue: 9.75,
    theoreticalSolverValue: 9.81,
    rSquared: 0.992,
    relativeUncertaintyPct: 1.5,
    trialsRecorded: 4,
    worksheetScore: 95,
  });

  assert.ok(highPrecision.percentDeviation < 1.0);
  assert.ok(highPrecision.totalScore >= 90);
  assert.equal(highPrecision.letterGrade, 'A');
  assert.match(highPrecision.diagnosticFeedback, /Konvergen tinggi terhadap solver numerik RK4\/Verlet/);

  const highDrift = evaluateTheoreticalSolverRubricGrade({
    studentId: 'stu-02',
    studentName: 'Budi Santoso',
    groupId: 'Kelompok 2',
    domain: 'Fisika',
    moduleTitle: 'Bandul Matematis',
    observedValue: 7.4,
    theoreticalSolverValue: 9.81,
    rSquared: 0.62,
    relativeUncertaintyPct: 18.5,
    trialsRecorded: 1,
  });

  assert.ok(highDrift.percentDeviation > 20);
  assert.ok(highDrift.totalScore < 65);
  assert.match(highDrift.diagnosticFeedback, /Deviasi signifikan/);
});

test('exportLmsGradebookCsv formats columns for Google Classroom, Moodle, and Excel with UTF-8 BOM', () => {
  const evalRow = evaluateTheoreticalSolverRubricGrade({
    studentId: 'stu-01',
    studentName: 'Alya Pratama',
    groupId: 'Kelompok 1',
    domain: 'Kimia',
    moduleTitle: 'Titrasi Asam-Basa',
    observedValue: 24.8,
    theoreticalSolverValue: 25.0,
    rSquared: 0.985,
    relativeUncertaintyPct: 1.2,
    trialsRecorded: 3,
  });

  const classroomCsv = exportLmsGradebookCsv([evalRow], 'classroom');
  assert.match(classroomCsv, /Student ID,Student Name,Email Address/);
  assert.match(classroomCsv, /alya\.pratama@siswa\.ruanglabmu\.sch\.id/);

  const moodleCsv = exportLmsGradebookCsv([evalRow], 'moodle');
  assert.match(moodleCsv, /ID number,Full name,Email address/);

  const excelCsv = exportLmsGradebookCsv([evalRow], 'excel');
  assert.equal(excelCsv.charCodeAt(0), 0xfeff);
});
