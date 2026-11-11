/**
 * Utilitas Ekspor Data Mentah Tabel ke CSV (RFC 4180 compliant)
 * Menghasilkan file CSV bersih dengan header variabel dan mengunduhnya secara otomatis.
 */

export interface CSVColumnDef {
  key: string;
  label: string;
  unit?: string;
}

export function formatCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // RFC 4180: Escape quotes by doubling them, wrap in quotes if contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportTableToCSV(
  moduleTitle: string,
  columns: CSVColumnDef[],
  rows: Array<Record<string, any>>
): string {
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

  // Trigger client-side file download if in browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  return csvContent;
}

export interface ClassroomExportSubmission {
  studentName: string;
  studentId?: string;
  moduleId: string;
  domain: string;
  quizScore: number;
  teacherGrade?: {
    score: number;
    feedback: string;
  };
}

/**
 * Ekspor Rekap Nilai Format Standar LMS / Google Classroom (FITUR 5)
 * Kolom standar: Student Name, Email/ID, Assignment Title, Score, Teacher Feedback
 */
export function exportGoogleClassroomCSV(
  submissions: ClassroomExportSubmission[]
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
    const finalScore = sub.teacherGrade?.score ?? sub.quizScore ?? 0;
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

  return exportTableToCSV('Google-Classroom-Grades', columns, rows);
}

