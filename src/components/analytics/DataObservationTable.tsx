import React from 'react';
import {
  Table,
  Trash2,
  Download,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import { ExperimentRecord } from '../../utils/scienceEngine';
import { labSound } from '../../utils/soundEngine';

export interface DataObservationTableProps {
  records: ExperimentRecord[];
  onDeleteRecord?: (id: string) => void;
  onExportCSV?: () => void;
}

export const DataObservationTable: React.FC<DataObservationTableProps> = ({
  records,
  onDeleteRecord,
  onExportCSV,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Tabel Rekaman Observasi Praktikum
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total {records.length} titik data uji tersimpan dalam basis data sesi
            </p>
          </div>
        </div>

        {onExportCSV && records.length > 0 && (
          <button
            type="button"
            onClick={() => {
              labSound.playClick();
              onExportCSV();
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        )}
      </div>

      {/* Table Container */}
      {records.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <Database className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs">Belum ada data percobaan yang direkam.</p>
          <p className="text-[11px] text-slate-400">
            Kembali ke simulasi 3D dan klik tombol <strong>"+ Catat Data"</strong> untuk mengisi tabel ini.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {records.map((rec, idx) => (
                <tr
                  key={rec.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-2 px-3 font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    #{idx + 1} ({rec.id})
                  </td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {rec.timestamp}
                  </td>
                  <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                    {rec.experimentTitle || '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                    {rec.numericX !== undefined ? rec.numericX : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {rec.numericY1 !== undefined ? rec.numericY1 : '—'}
                  </td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate font-sans">
                    {rec.parametersSummary}
                  </td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate font-sans italic">
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
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
