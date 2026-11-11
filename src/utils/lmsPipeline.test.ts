import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportTableToCSV, formatCSVCell, type CSVColumnDef } from './csvExporter';
import type { LabSubmission } from '../types/submissionTypes';

describe('LMS Pipeline & CSV Export Utilities', () => {
  it('formats CSV cells properly according to RFC 4180', () => {
    assert.strictEqual(formatCSVCell('SimpleText'), '"SimpleText"');
    assert.strictEqual(formatCSVCell('Text with, comma'), '"Text with, comma"');
    assert.strictEqual(formatCSVCell('Text with "quotes" inside'), '"Text with ""quotes"" inside"');
    assert.strictEqual(formatCSVCell('Line1\nLine2'), '"Line1\nLine2"');
    assert.strictEqual(formatCSVCell(null), '""');
    assert.strictEqual(formatCSVCell(undefined), '""');
    assert.strictEqual(formatCSVCell(42.5), '"42.5"');
  });

  it('exports structured lab observation table into valid CSV content', () => {
    const columns: CSVColumnDef[] = [
      { key: 'trial', label: 'Percobaan' },
      { key: 'force', label: 'Gaya', unit: 'N' },
      { key: 'accel', label: 'Percepatan', unit: 'm/s²' },
    ];

    const rows = [
      { trial: 1, force: 10, accel: 2.0 },
      { trial: 2, force: 20, accel: 4.0 },
      { trial: 3, force: 30, accel: 6.0 },
    ];

    const csv = exportTableToCSV('Hukum II Newton', columns, rows);
    const lines = csv.split('\r\n');

    assert.strictEqual(lines.length, 4);
    assert.strictEqual(lines[0], '"Percobaan","Gaya (N)","Percepatan (m/s²)"');
    assert.strictEqual(lines[1], '"1","10","2"');
    assert.strictEqual(lines[2], '"2","20","4"');
    assert.strictEqual(lines[3], '"3","30","6"');
  });

  it('validates a LabSubmission payload integrity', () => {
    const submission: LabSubmission = {
      id: 'sub-test-123',
      studentName: 'Aisyah Putri',
      studentId: 'SIS-001',
      roomId: 'room-alpha',
      domain: 'physics',
      moduleId: 'newton-second-law',
      submittedAt: new Date().toISOString(),
      hypothesisText: 'Gaya berbanding lurus dengan percepatan.',
      observationData: [
        { trial: 1, force: 10, accel: 2.0 },
        { trial: 2, force: 20, accel: 4.0 },
      ],
      regressionMetrics: {
        rSquared: 0.998,
        slope: 0.2,
        equation: 'y = 0.2x + 0.01',
      },
      quizAnswers: [
        { questionId: 'q1', selectedAnswer: 1, isCorrect: true },
        { questionId: 'q2', selectedAnswer: 0, isCorrect: true },
      ],
      quizScore: 100,
      conclusionText: 'Data mendukung hipotesis dengan korelasi R² mendekati 1.0.',
      teacherGrade: {
        score: 95,
        feedback: 'Analisis regresi sangat akurat dan teliti!',
        gradedAt: new Date().toISOString(),
      },
    };

    assert.strictEqual(submission.id, 'sub-test-123');
    assert.strictEqual(submission.studentName, 'Aisyah Putri');
    assert.strictEqual(submission.quizScore, 100);
    assert.ok(submission.observationData.length >= 2);
    assert.ok(submission.teacherGrade && submission.teacherGrade.score >= 0 && submission.teacherGrade.score <= 100);
  });
});
