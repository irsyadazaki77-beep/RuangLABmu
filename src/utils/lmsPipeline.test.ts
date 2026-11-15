import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportTableToCSV,
  exportGoogleClassroomCSV,
  formatCSVCell,
  sanitizeCSVFormulaInjection,
  UTF8_BOM,
  type CSVColumnDef,
} from './csvExporter';
import { createAdaptiveQualityController } from '../hooks/useAdaptiveQuality';
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

  it('sanitizes spreadsheet formula-injection characters (=, +, -, @)', () => {
    assert.strictEqual(sanitizeCSVFormulaInjection('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.strictEqual(sanitizeCSVFormulaInjection('+cmd|"/c calc"!A0'), "'+cmd|\"/c calc\"!A0");
    assert.strictEqual(sanitizeCSVFormulaInjection('-HYPERLINK("http://evil.tld")'), "'-HYPERLINK(\"http://evil.tld\")");
    assert.strictEqual(sanitizeCSVFormulaInjection('@IMPORTXML(A1,A2)'), "'@IMPORTXML(A1,A2)");
    assert.strictEqual(sanitizeCSVFormulaInjection('-9.81'), '-9.81');
    assert.strictEqual(formatCSVCell('=1+1'), '"\'=1+1"');
  });

  it('exports structured lab observation table into valid CSV content and supports UTF-8 BOM', () => {
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

    const csvWithBom = exportTableToCSV('Hukum II Newton', columns, rows, false, { includeBomInReturn: true });
    assert.ok(csvWithBom.startsWith(UTF8_BOM));
  });

  it('validates a LabSubmission payload integrity and Google Classroom CSV BOM + sanitization', () => {
    const submission: LabSubmission = {
      id: 'sub-test-123',
      studentName: '=Aisyah Putri',
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
    assert.strictEqual(submission.quizScore, 100);
    const classroomCsv = exportGoogleClassroomCSV([submission], false, true);
    assert.ok(classroomCsv.startsWith(UTF8_BOM));
    assert.ok(classroomCsv.includes('"\'=Aisyah Putri"'));
  });

  it('steps down adaptive WebGL quality tier when rolling FPS drops below 30 for 2 seconds', () => {
    const tiers: string[] = [];
    const controller = createAdaptiveQualityController({
      initialTier: 'high',
      onTierChange: (nextTier) => {
        tiers.push(nextTier);
      },
    });

    assert.strictEqual(controller.getTier(), 'high');
    // Simulate 50ms frame times (0.05s = 20 FPS) for 60 frames (20 warm-up + 40 frames = 2.0s accumulated)
    for (let i = 0; i < 65; i++) {
      controller.recordFrameDelta(0.05);
    }
    assert.strictEqual(controller.getTier(), 'medium');

    // Simulate another 2.0+ seconds of 20 FPS frames
    for (let i = 0; i < 45; i++) {
      controller.recordFrameDelta(0.05);
    }
    assert.strictEqual(controller.getTier(), 'low');
    assert.deepStrictEqual(tiers, ['medium', 'low']);
  });
});

