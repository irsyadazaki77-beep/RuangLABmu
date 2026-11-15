/**
 * Utilitas Ekspor Data Mentah Tabel ke CSV (RFC 4180 compliant)
 * Dilengkapi sanitasi Formula Injection (=, +, -, @) dan UTF-8 BOM (\uFEFF).
 */

export const UTF8_BOM = '\uFEFF';

export interface CSVColumnDef {
  key: string;
  label: string;
  unit?: string;
}

/**
 * Sanitizes string values against spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
 * while preserving legitimate negative numeric values (e.g., `-57.30`).
 */
export function sanitizeCSVFormulaInjection(raw: string): string {
  if (!raw || raw.length === 0) return raw;
  const firstChar = raw[0];
  if (firstChar === '=' || firstChar === '+' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return `'${raw}`;
  }
  if (firstChar === '-') {
    // Allow plain negative numbers like "-42.5" or "-81.27 kJ/mol", escape formulas like "-SUM(A1:A2)" or "-cmd|..."
    if (/^-[A-Za-z=@+|]/.test(raw)) {
      return `'${raw}`;
    }
  }
  return raw;
}

export function formatCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const rawStr = String(value);
  const str = typeof value === 'number' ? rawStr : sanitizeCSVFormulaInjection(rawStr);
  // RFC 4180: Escape quotes by doubling them, wrap in quotes if contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportTableToCSV(
  moduleTitle: string,
  columns: CSVColumnDef[],
  rows: Array<Record<string, unknown>>,
  triggerDownloadOrOptions?: boolean | { includeBomInReturn?: boolean },
  options?: { includeBomInReturn?: boolean }
): string {
  const resolvedOptions =
    typeof triggerDownloadOrOptions === 'object' && triggerDownloadOrOptions !== null
      ? triggerDownloadOrOptions
      : options;

  const headerLine = columns
    .map((col) => {
      const headerText = col.unit ? `${col.label} (${col.unit})` : col.label;
      return formatCSVCell(headerText);
    })
    .join(',');

  const dataLines = rows.map((row) => {
    return columns.map((col) => formatCSVCell(row[col.key] ?? '')).join(',');
  });

  const csvContent = [headerLine, ...dataLines].join('\r\n');
  const bomPrefixedContent = `${UTF8_BOM}${csvContent}`;

  // Trigger client-side file download with UTF-8 BOM (\uFEFF) if in browser
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    triggerDownloadOrOptions !== false
  ) {
    const blob = new Blob([bomPrefixedContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanTitle = (moduleTitle || 'Eksperimen')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    const dateStamp = new Date().toISOString().split('T')[0];
    const filename = `RuangLABmu-${cleanTitle}-${dateStamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return resolvedOptions?.includeBomInReturn ? bomPrefixedContent : csvContent;
}

export interface ClassroomExportSubmission {
  studentName: string;
  studentId?: string;
  moduleId: string;
  domain: string;
  quizScore: number;
  autoRubricScore?: number;
  teacherGrade?: {
    score: number;
    feedback: string;
  };
}

/**
 * Ekspor Rekap Nilai Format Standar LMS / Google Classroom (dengan UTF-8 BOM & Sanitasi Formula)
 * Kolom standar: Student Name, Email/ID, Assignment Title, Score, Teacher Feedback
 */
export function exportGoogleClassroomCSV(
  submissions: ClassroomExportSubmission[],
  triggerDownloadOrIncludeBom?: boolean,
  includeBomInReturn: boolean = false
): string {
  const columns: CSVColumnDef[] = [
    { key: 'studentName', label: 'Student Name' },
    { key: 'emailOrId', label: 'Email/ID' },
    { key: 'assignmentTitle', label: 'Assignment Title' },
    { key: 'score', label: 'Score' },
    { key: 'teacherFeedback', label: 'Teacher Feedback' },
  ];

  const rows = submissions.map((sub) => {
    const cleanId =
      sub.studentId ||
      `${sub.studentName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@siswa.ruanglab.id`;
    const finalScore = sub.teacherGrade?.score ?? sub.autoRubricScore ?? sub.quizScore ?? 0;
    const feedback =
      sub.teacherGrade?.feedback ||
      `Kuis LKS: ${sub.quizScore}/100 (Menunggu umpan balik tambahan pengajar)`;

    return {
      studentName: sub.studentName,
      emailOrId: cleanId,
      assignmentTitle: `${sub.moduleId} (${sub.domain})`,
      score: finalScore,
      teacherFeedback: feedback,
    };
  });

  return exportTableToCSV('Google-Classroom-Grades', columns, rows, triggerDownloadOrIncludeBom, {
    includeBomInReturn,
  });
}

