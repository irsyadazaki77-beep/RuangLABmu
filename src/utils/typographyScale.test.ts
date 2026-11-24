import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateAcademicReportHTML } from './academicReportExporter';

const ROOT_DIR = process.cwd();

function readSrcFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectSourceFiles(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

test('src/index.css uses percentage-based root font scaling and unified prose line-height tokens', () => {
  const css = readSrcFile('src/index.css');

  // Percentage-based root scaling respects browser default font size & all zoom levels
  assert.match(css, /html\s*\{[^}]*font-size:\s*100%/s);
  assert.match(css, /html\[data-font-scale="normal"\]\s*\{[^}]*font-size:\s*100%/s);
  assert.match(css, /html\[data-font-scale="comfortable"\]\s*\{[^}]*font-size:\s*106\.25%/s);
  assert.match(css, /html\[data-font-scale="large"\]\s*\{[^}]*font-size:\s*112\.5%/s);
  assert.doesNotMatch(css, /html(\[data-font-scale=[^\]]+\])?\s*\{[^}]*font-size:\s*1[6-8]px/s);

  // Unified rem-based 2xs floor & semantic line-height tokens
  assert.match(css, /--text-2xs:\s*0\.6875rem/);
  assert.match(css, /--comfort-line-height-ui:\s*1\.45/);
  assert.match(css, /--comfort-line-height-prose:\s*1\.62/);

  // Dedicated semantic classes for Dr. LabMu chat & report summaries
  assert.match(css, /\.comfort-chat-prose\s*\{[^}]*line-height:\s*var\(--comfort-line-height-prose\)/s);
  assert.match(css, /\.comfort-chat-callout\s*\{[^}]*line-height:\s*var\(--comfort-line-height-prose\)/s);
  assert.match(css, /\.comfort-report-prose\s*\{[^}]*line-height:\s*var\(--comfort-line-height-prose\)/s);

  // Relaxed & dyslexia modes override the shared line-height tokens
  assert.match(css, /html\[data-line-spacing="relaxed"\]\s*\{[^}]*--comfort-line-height-prose:\s*1\.82/s);
  assert.match(css, /html\[data-dyslexia-mode="true"\]\s*\{[^}]*--comfort-line-height-prose:\s*1\.85/s);
});

test('no hardcoded pixel Tailwind text-[*px] font classes remain across src/components', () => {
  const files = collectSourceFiles(path.join(ROOT_DIR, 'src/components'));
  const offenders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/\btext-\[[0-9]+(?:\.[0-9]+)?px\]/g);
    if (matches && matches.length > 0) {
      offenders.push(`${path.relative(ROOT_DIR, file)}: ${matches.join(', ')}`);
    }
  }

  assert.deepEqual(offenders, [], `Found fixed-px font utilities: ${offenders.join('; ')}`);
});

test('Dr. LabMu chat panel and report summary components use unified prose classes', () => {
  const drLabMu = readSrcFile('src/components/DrLabMuAssistantPanel.tsx');
  assert.match(drLabMu, /comfort-chat-prose/);
  assert.match(drLabMu, /comfort-chat-callout/);

  const reportSummaryFiles = [
    'src/components/analytics/StudentWorksheetForm.tsx',
    'src/components/analytics/WorksheetQuestionList.tsx',
    'src/components/analytics/UncertaintyAnalysisCard.tsx',
    'src/components/teacher/GradebookSubmissionReview.tsx',
    'src/components/teacher/GradebookClassAnalyticsPanel.tsx',
    'src/components/portfolio/StudentPortfolioModal.tsx',
    'src/components/CollaborationAndDataSection.tsx',
    'src/components/ui/TrialComparePanel.tsx',
  ];

  for (const relPath of reportSummaryFiles) {
    const content = readSrcFile(relPath);
    assert.match(
      content,
      /comfort-report-prose/,
      `Expected ${relPath} to apply .comfort-report-prose for consistent report summary line-height`
    );
  }
});

test('generateAcademicReportHTML applies unified line-height and report summary box rules', () => {
  const html = generateAcademicReportHTML({
    studentName: 'Alya Pratama',
    groupId: 'Kelompok 1',
    domain: 'Fisika',
    tier: 'SMA',
    dateStr: '24/11/2026',
    timeStr: '10:00',
    experimentTitle: 'Bandul Matematis Harmonik',
    records: [
      {
        id: 'r1',
        timestamp: '10:00:00',
        studentName: 'Alya Pratama',
        groupId: 'Kelompok 1',
        domain: 'Fisika',
        experimentTitle: 'Bandul Matematis Harmonik',
        parametersSummary: 'L = 1.0 m',
        keyMetrics: { T: '2.01 s' },
        notes: 'Pengukuran stabil',
      },
    ],
    hypothesisSummary: {
      independentVar: 'Panjang tali (L)',
      dependentVar: 'Periode kuadrat (T²)',
      hypothesisText: 'Semakin panjang tali, periode ayunan semakin besar.',
    },
    regressionSummary: {
      slope: 4.02,
      intercept: 0.01,
      rSquared: 0.996,
      formula: 'T² = 4.02 L + 0.01',
    },
  });

  assert.match(html, /font-size:\s*100%/);
  assert.match(html, /line-height:\s*1\.62/);
  assert.match(html, /\.report-summary-box\s*\{/);
  assert.match(html, /\.report-prose\s*\{/);
  assert.match(html, /class="report-summary-box"/);
  assert.match(html, /class="report-prose"/);
});
