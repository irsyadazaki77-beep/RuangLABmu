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
