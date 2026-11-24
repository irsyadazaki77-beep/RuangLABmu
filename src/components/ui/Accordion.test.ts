import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Accordion, AccordionGroup } from './Accordion';
import { DetailAccordion } from './ProgressiveDisclosure';
import { PreLabTheoryPanel, PreLabSafetyAndApparatusCard } from '../prelab/PreLabTheoryAndSafetySection';
import { PreLabInsightsPanel } from '../prelab/PreLabQuizAndInsightsSection';
import { PreLabSafetyModal } from '../PreLabSafetyModal';
import { TeacherRubricTab } from '../teacher/TeacherRubricTab';
import { GradebookSubmissionReview } from '../teacher/GradebookSubmissionReview';
import { GradebookClassAnalyticsPanel } from '../teacher/GradebookClassAnalyticsPanel';
import { EXPERIMENT_CATALOG } from '../../registry/experimentRegistry';
import { calculateStudentRubric } from '../../utils/scienceEngine';
import { evaluateSubmissionRubric } from '../../shared/grading/rubricEngine';
import { evaluateTheoreticalSolverRubricGrade } from '../../utils/academicReportExporter';
import { computeClassGradebookAnalytics } from '../../utils/classAnalyticsEngine';
import type { StudentProgressItem } from '../TeacherDashboardView';
import type { LabSubmission } from '../../types/submissionTypes';

test('Accordion preview mode keeps 1–2 core points visible while collapsing detail body by default', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Accordion,
      {
        title: 'Ringkasan Teori Inti',
        meta: '3 poin',
        collapsedLabel: 'Lihat Detail',
        expandedLabel: 'Ringkas',
        hiddenCount: 2,
        testId: 'theory-accordion',
        toggleTestId: 'theory-toggle',
        preview: React.createElement('p', null, 'Poin Inti 1: Gaya berbanding lurus dengan percepatan.'),
      },
      React.createElement('p', null, 'Uraian Lengkap Tersembunyi')
    )
  );

  assert.match(html, /data-testid="theory-accordion"/);
  assert.match(html, /Poin Inti 1: Gaya berbanding lurus dengan percepatan\./);
  assert.doesNotMatch(html, /Uraian Lengkap Tersembunyi/);
  assert.match(html, /data-testid="theory-toggle"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Lihat Detail \(\+2\)/);
  assert.match(html, /aria-controls="/);
});

test('Accordion controlled open=true reveals region linked via aria-controls and aria-labelledby', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Accordion,
      {
        title: 'Aturan K3 Laboratorium',
        open: true,
        onToggle: () => {},
        collapsedLabel: 'Lihat Semua',
        expandedLabel: 'Ringkas K3',
        preview: React.createElement('div', null, 'Aturan K3 Utama'),
      },
      React.createElement('div', null, 'Aturan K3 Tambahan Terbuka')
    )
  );

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /role="region"/);
  assert.match(html, /aria-labelledby="/);
  assert.match(html, /Aturan K3 Utama/);
  assert.match(html, /Aturan K3 Tambahan Terbuka/);
  assert.match(html, /Ringkas K3/);
});

test('Accordion compact single-header mode collapses body by default and exposes headerRight outside button', () => {
  const html = renderToStaticMarkup(
    React.createElement(AccordionGroup, {
      testId: 'demo-group',
      compact: true,
      children: React.createElement(
        Accordion,
        {
          title: 'Daftar Alat',
          meta: '4 item',
          defaultOpen: false,
          headerRight: React.createElement('button', { type: 'button' }, 'Aksi'),
        },
        React.createElement('div', null, 'Mikrometer Sekrup')
      ),
    })
  );

  assert.match(html, /data-testid="demo-group"/);
  assert.match(html, /Daftar Alat/);
  assert.doesNotMatch(html, /Mikrometer Sekrup/);
  // Ensure there is no nested <button> inside another <button>
  assert.doesNotMatch(html, /<button\b(?:(?!<\/button>)[\s\S])*?<button\b/);
});

test('DetailAccordion remains backward compatible and delegates cleanly to Accordion', () => {
  const html = renderToStaticMarkup(
    React.createElement(DetailAccordion, {
      title: 'Tabel Data Observasi',
      meta: '5 titik',
      defaultOpen: false,
      testId: 'legacy-detail-accordion',
      children: React.createElement('div', null, 'Isi Tabel Tersembunyi'),
    })
  );

  assert.match(html, /data-testid="legacy-detail-accordion"/);
  assert.match(html, /Tabel Data Observasi/);
  assert.doesNotMatch(html, /Isi Tabel Tersembunyi/);
});

test('LabWorkspace Theory, K3, Insights, and Safety Modal enforce 1–2 visible points progressive disclosure', () => {
  const baseExp =
    EXPERIMENT_CATALOG.find(
      (e) =>
        (e.keyTakeaways?.length ?? 0) >= 3 &&
        (e.commonMisconceptions?.length ?? 0) >= 2
    ) ?? EXPERIMENT_CATALOG[0];
  const exp = {
    ...baseExp,
    safetyNotes:
      baseExp.safetyNotes.length >= 3
        ? baseExp.safetyNotes
        : [
            ...baseExp.safetyNotes,
            'Pastikan meja praktikum bersih dan kering sebelum memulai pengukuran.',
          ],
  };

  // Stage 1 Theory Panel
  const theoryHtml = renderToStaticMarkup(
    React.createElement(PreLabTheoryPanel, { experiment: exp, activeTier: 'SMA' })
  );
  assert.match(theoryHtml, /data-testid="prelab-theory-accordion"/);
  assert.match(theoryHtml, /data-testid="prelab-theory-detail-toggle"/);
  assert.match(theoryHtml, /aria-expanded="false"/);
  if (exp.keyTakeaways && exp.keyTakeaways.length >= 3) {
    assert.ok(theoryHtml.includes(exp.keyTakeaways[0].slice(0, 20)));
    assert.ok(!theoryHtml.includes(exp.keyTakeaways[2].slice(0, 20)));
  }

  // Stage 1 K3 Panel
  const k3Html = renderToStaticMarkup(
    React.createElement(PreLabSafetyAndApparatusCard, {
      experiment: exp,
      isSpeakingK3: false,
      k3Complied: false,
      safetyTitle: 'Aturan K3',
      listenLabel: 'Dengarkan',
      stopLabel: 'Hentikan',
      complyLabel: 'Saya Patuh K3',
      compliedLabel: 'K3 Dipatuhi',
      apparatusHeader: 'Daftar Alat',
      onToggleK3Narration: () => {},
      onComplyK3: () => {},
    })
  );
  assert.match(k3Html, /data-testid="prelab-k3-accordion"/);
  assert.match(k3Html, /data-testid="prelab-k3-detail-toggle"/);
  assert.ok(k3Html.includes(exp.safetyNotes[0].slice(0, 20)));
  if (exp.safetyNotes.length >= 3) {
    assert.ok(!k3Html.includes(exp.safetyNotes[2].slice(0, 20)));
  }

  // Stage 1 Insights Panel
  const insightsHtml = renderToStaticMarkup(
    React.createElement(PreLabInsightsPanel, { experiment: exp })
  );
  if ((exp.commonMisconceptions?.length ?? 0) > 0) {
    assert.match(insightsHtml, /data-testid="prelab-misconceptions-accordion"/);
  }

  // Stage 2 PreLabSafetyModal
  const modalHtml = renderToStaticMarkup(
    React.createElement(PreLabSafetyModal, {
      experiment: exp,
      activeTier: 'SMA',
      isOpen: true,
      onClose: () => {},
    })
  );
  assert.match(modalHtml, /data-testid="modal-objectives-accordion"/);
  assert.match(modalHtml, /data-testid="modal-theory-accordion"/);
});

test('Teacher Dashboard RubricTab, GradebookSubmissionReview, and ClassAnalytics collapse dense blocks to 2 priority points initially', () => {
  const students: StudentProgressItem[] = [
    {
      id: 's1',
      name: 'Budi Santoso',
      groupId: 'Kelompok 1',
      activeDomain: 'Fisika',
      currentActivity: 'Bandul Matematis',
      trialsRecorded: 6,
      tasksCompleted: 4,
      totalTasks: 4,
      completionPct: 95,
      quizScore: 92,
      lastActive: '1m lalu',
      status: 'Selesai',
      rSquared: 0.992,
    },
    {
      id: 's2',
      name: 'Citra Lestari',
      groupId: 'Kelompok 2',
      activeDomain: 'Fisika',
      currentActivity: 'Bandul Matematis',
      trialsRecorded: 2,
      tasksCompleted: 1,
      totalTasks: 4,
      completionPct: 35,
      quizScore: 68,
      lastActive: '2m lalu',
      status: 'Butuh Bantuan',
      rSquared: 0.72,
    },
    {
      id: 's3',
      name: 'Darma Wijaya',
      groupId: 'Kelompok 3',
      activeDomain: 'Fisika',
      currentActivity: 'Bandul Matematis',
      trialsRecorded: 5,
      tasksCompleted: 3,
      totalTasks: 4,
      completionPct: 82,
      quizScore: 84,
      lastActive: '3m lalu',
      status: 'Nominal',
      rSquared: 0.96,
    },
  ];

  const rubricRows = students.map((s) => calculateStudentRubric(s));
  const solverRows = [
    evaluateTheoreticalSolverRubricGrade({
      studentId: 's1',
      studentName: 'Budi Santoso',
      groupId: 'Kelompok 1',
      domain: 'Fisika',
      moduleTitle: 'Bandul Matematis',
      observedValue: 9.8,
      theoreticalSolverValue: 9.81,
      rSquared: 0.992,
      relativeUncertaintyPct: 1.1,
      trialsRecorded: 6,
      worksheetScore: 92,
    }),
    evaluateTheoreticalSolverRubricGrade({
      studentId: 's2',
      studentName: 'Citra Lestari',
      groupId: 'Kelompok 2',
      domain: 'Fisika',
      moduleTitle: 'Bandul Matematis',
      observedValue: 8.2,
      theoreticalSolverValue: 9.81,
      rSquared: 0.72,
      relativeUncertaintyPct: 9.5,
      trialsRecorded: 2,
      worksheetScore: 68,
    }),
    evaluateTheoreticalSolverRubricGrade({
      studentId: 's3',
      studentName: 'Darma Wijaya',
      groupId: 'Kelompok 3',
      domain: 'Fisika',
      moduleTitle: 'Bandul Matematis',
      observedValue: 9.3,
      theoreticalSolverValue: 9.81,
      rSquared: 0.96,
      relativeUncertaintyPct: 3.0,
      trialsRecorded: 5,
      worksheetScore: 84,
    }),
  ];

  const rubricTabHtml = renderToStaticMarkup(
    React.createElement(TeacherRubricTab, {
      visibleStudents: students,
      rubricRows,
      solverAutoGradeRows: solverRows,
      onExportLmsGradebookCSV: () => {},
      onExportClassGradesCSV: () => {},
    })
  );

  assert.match(rubricTabHtml, /data-testid="teacher-activity-accordion"/);
  assert.match(rubricTabHtml, /data-testid="teacher-rubric-matrix-accordion"/);
  assert.match(rubricTabHtml, /data-testid="teacher-solver-diagnostic-accordion"/);
  assert.match(rubricTabHtml, /data-testid="export-lms-gradebook-csv-btn"/);
  // Top 2 priority students appear in the solver diagnostic preview, while lowest-deviation student stays collapsed
  assert.match(rubricTabHtml, /Citra Lestari/);
  assert.match(rubricTabHtml, /Darma Wijaya/);
  assert.match(rubricTabHtml, /Lihat semua diagnostik solver \(\+1\)/);

  // GradebookSubmissionReview collapsed rubric shows 2 criteria initially, hides rest
  const sampleSubmission: LabSubmission = {
    id: 'SUB-001',
    studentId: 's1',
    studentName: 'Budi Santoso',
    domain: 'Fisika',
    moduleId: 'pendulum',
    submittedAt: '2026-11-24T10:00:00Z',
    hypothesisText: 'Periode kuadrat sebanding dengan panjang tali.',
    conclusionText: 'Hasil percobaan sesuai dengan model gravitasi.',
    quizScore: 90,
    quizAnswers: [],
    observationData: [
      { L: 0.5, T: 1.42 },
      { L: 1.0, T: 2.01 },
    ],
    regressionMetrics: {
      slope: 4.02,
      rSquared: 0.996,
      equation: 'T² = 4.02 L + 0.01',
    },
  };

  const evaluatedRubric = evaluateSubmissionRubric(sampleSubmission);
  const reviewCollapsedHtml = renderToStaticMarkup(
    React.createElement(GradebookSubmissionReview, {
      selectedSubmission: sampleSubmission,
      selectedRubric: evaluatedRubric,
      expandedRubricOpen: false,
      onToggleRubricOpen: () => {},
      onOpenReplay: () => {},
      gradingScore: 90,
      onChangeGradingScore: () => {},
      gradingFeedback: '',
      onChangeGradingFeedback: () => {},
      isSubmittingGrade: false,
      toastMessage: null,
      onSaveGrade: () => {},
    })
  );

  const normalizedReviewHtml = reviewCollapsedHtml.replace(/&amp;/g, '&');
  assert.match(normalizedReviewHtml, /data-testid="teacher-rubric-breakdown-panel"/);
  assert.match(normalizedReviewHtml, /data-testid="gradebook-observation-accordion"/);
  assert.match(normalizedReviewHtml, /aria-expanded="false"/);
  if (evaluatedRubric.criteria.length >= 3) {
    const sortedCriteria = [...evaluatedRubric.criteria].sort(
      (a, b) => Number(a.passed) - Number(b.passed)
    );
    assert.ok(normalizedReviewHtml.includes(sortedCriteria[0].label));
    assert.ok(!normalizedReviewHtml.includes(sortedCriteria[sortedCriteria.length - 1].label));
  }

  // GradebookClassAnalyticsPanel shows 2 priority rubric dimensions initially
  const analytics = computeClassGradebookAnalytics([sampleSubmission], 75);
  const analyticsHtml = renderToStaticMarkup(
    React.createElement(GradebookClassAnalyticsPanel, {
      analytics,
      kkmThreshold: 75,
      onChangeKkm: () => {},
    })
  );
  assert.match(analyticsHtml, /data-testid="analytics-rubric-dimensions-accordion"/);
  assert.match(analyticsHtml, /data-testid="analytics-rubric-dimensions-toggle"/);
  assert.match(analyticsHtml, /aria-expanded="false"/);
});
