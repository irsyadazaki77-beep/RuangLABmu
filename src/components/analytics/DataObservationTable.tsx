import React from 'react';
import {
  Trash2,
  Download,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';
import { exportTableToCSV, CSVColumnDef } from '../../utils/csvExporter';
import { ScienceGlossaryTerm } from '../ui/ScienceGlossaryTerm';

export interface DataObservationTableProps {
  records: ExperimentRecord[];
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
  moduleTitle?: string;
}

export const DataObservationTable: React.FC<DataObservationTableProps> = ({
  records,
  onDeleteRecord,
  onExportCSV,
  moduleTitle,
}) => {
  const handleDownloadCSV = () => {
    labSound.playClick();
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    const columns: CSVColumnDef[] = [
      { key: 'id', label: 'ID Percobaan' },
      { key: 'timestamp', label: 'Waktu Pengambilan' },
      { key: 'experimentTitle', label: 'Judul Modul' },
      { key: 'numericX', label: 'Variabel Bebas (X)' },
      { key: 'numericY1', label: 'Variabel Terikat (Y1)' },
      { key: 'parametersSummary', label: 'Parameter' },
      { key: 'notes', label: 'Catatan Observasi' },
    ];
    exportTableToCSV(moduleTitle || records[0]?.experimentTitle || 'Observasi-Lab', columns, records as unknown as Array<Record<string, any>>);
  };
  return (
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-[var(--comfort-text)]">
              Tabel Rekaman Observasi Praktikum
            </h3>
            <p className="text-xs text-[var(--comfort-text-muted)]">
              Total {records.length} titik data uji tersimpan dalam basis data sesi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--comfort-text-muted)]">
            <span>Kamus:</span>
            <ScienceGlossaryTerm term="R²" />
            <span>·</span>
            <ScienceGlossaryTerm term="Slope/Gradien" />
            <span>·</span>
            <ScienceGlossaryTerm term="Outlier" />
          </div>
          {records.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV (.csv)</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      {records.length === 0 ? (
        <div className="py-12 text-center text-[var(--comfort-text-muted)] space-y-2">
          <Database className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-xs font-medium text-[var(--comfort-text)]">Belum ada data percobaan yang direkam.</p>
          <p className="text-[11px] text-[var(--comfort-text-muted)]">
            Kembali ke simulasi 3D dan klik tombol <strong>"+ Catat Data"</strong> untuk mengisi tabel ini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--comfort-border)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] font-semibold border-b border-[var(--comfort-border)]">
                <th className="py-2.5 px-3 font-mono">No / ID</th>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3">Judul Modul</th>
                <th className="py-2.5 px-3 text-right">X (Independen)</th>
                <th className="py-2.5 px-3 text-right">Y1 (Dependen)</th>
                <th className="py-2.5 px-3">Ringkasan Parameter</th>
                <th className="py-2.5 px-3">Catatan Hipotesis</th>
                {onDeleteRecord && <th className="py-2.5 px-3 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--comfort-border)] font-mono text-[11px]">
              {records.map((rec, idx) => (
                <tr
                  key={rec.id}
                  className="hover:bg-[var(--comfort-surface-subtle)] transition-colors"
                >
                  <td className="py-2 px-3 font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    #{idx + 1} ({rec.id})
                  </td>
                  <td className="py-2 px-3 text-[var(--comfort-text-muted)] whitespace-nowrap">
                    {rec.timestamp}
                  </td>
                  <td className="py-2 px-3 font-sans font-medium text-[var(--comfort-text)]">
                    {rec.experimentTitle || '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-[var(--comfort-text)]">
                    {rec.numericX !== undefined ? rec.numericX : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {rec.numericY1 !== undefined ? rec.numericY1 : '—'}
                  </td>
                  <td className="py-2 px-3 text-[var(--comfort-text-muted)] max-w-xs truncate font-sans">
                    {rec.parametersSummary}
                  </td>
                  <td className="py-2 px-3 text-[var(--comfort-text-muted)] max-w-xs truncate font-sans italic">
                    {rec.notes || '—'}
                  </td>
                  {onDeleteRecord && (
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          labSound.playClick();
                          onDeleteRecord(rec.id);
                        }}
                        title="Hapus baris data ini"
                        className="p-1 rounded-lg text-[var(--comfort-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
