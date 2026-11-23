import React, { useState } from 'react';
import {
  Trash2,
  Download,
  Database,
  FileSpreadsheet,
  Plus,
  Upload,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { ExperimentRecord, ScienceDomain } from '../../utils/scienceEngine';
import { parseManualCsvRecords } from '../../utils/dynamicWorksheetEngine';
import { labSound } from '../../utils/soundEngine';
import { exportTableToCSV, CSVColumnDef } from '../../utils/csvExporter';
import { ScienceGlossaryTerm } from '../ui/ScienceGlossaryTerm';

export interface DataObservationTableProps {
  records: ExperimentRecord[];
  onDeleteRecord?: (id: string) => void;
  onAddRecord?: (record: ExperimentRecord) => void;
  onUpdateRecord?: (id: string, patch: Partial<ExperimentRecord>) => void;
  onExportCSV?: () => void;
  moduleTitle?: string;
  moduleId?: string;
  domain?: string;
  activeStudentName?: string;
  activeGroupId?: string;
  xAxisLabel?: string;
  y1AxisLabel?: string;
}

function normalizeScienceDomain(domain?: string): ScienceDomain {
  const lower = (domain || '').toLowerCase();
  if (lower === 'kimia' || lower === 'chemistry') return 'Kimia';
  if (lower === 'biologi' || lower === 'biology') return 'Biologi';
  if (lower === 'astronomi' || lower === 'astronomy') return 'Astronomi';
  return 'Fisika';
}

export const DataObservationTable: React.FC<DataObservationTableProps> = ({
  records,
  onDeleteRecord,
  onAddRecord,
  onUpdateRecord,
  onExportCSV,
  moduleTitle,
  moduleId,
  domain,
  activeStudentName = 'Praktikan',
  activeGroupId = 'Kelompok 1',
  xAxisLabel = 'X (Independen)',
  y1AxisLabel = 'Y1 (Dependen)',
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [manualX, setManualX] = useState('');
  const [manualY1, setManualY1] = useState('');
  const [manualY2, setManualY2] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [csvRawText, setCsvRawText] = useState('');
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editX, setEditX] = useState('');
  const [editY1, setEditY1] = useState('');
  const [editNotes, setEditNotes] = useState('');

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
      { key: 'numericX', label: xAxisLabel },
      { key: 'numericY1', label: y1AxisLabel },
      { key: 'parametersSummary', label: 'Parameter' },
      { key: 'notes', label: 'Catatan Observasi' },
    ];
    exportTableToCSV(
      moduleTitle || records[0]?.experimentTitle || 'Observasi-Lab',
      columns,
      records as unknown as Array<Record<string, unknown>>
    );
  };

  const handleSubmitManualRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddRecord) return;
    const xVal = Number(manualX.replace(',', '.'));
    const y1Val = Number(manualY1.replace(',', '.'));
    const y2Val = manualY2.trim() ? Number(manualY2.replace(',', '.')) : undefined;

    if (!Number.isFinite(xVal) || !Number.isFinite(y1Val)) {
      setFormError('Masukkan nilai angka yang valid untuk X dan Y1.');
      return;
    }
    if (y2Val !== undefined && !Number.isFinite(y2Val)) {
      setFormError('Nilai Y2 harus berupa angka valid atau dikosongkan.');
      return;
    }

    setFormError(null);
    labSound.playRecordSuccess();
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const resolvedDomain = normalizeScienceDomain(domain || records[0]?.domain);
    const newRec: ExperimentRecord = {
      id: `MAN-${String(records.length + 1).padStart(2, '0')}-${String(Date.now()).slice(-3)}`,
      timestamp: nowTime,
      domain: resolvedDomain,
      moduleId: moduleId || records[0]?.moduleId,
      experimentTitle: moduleTitle || records[0]?.experimentTitle || 'Pengukuran Manual',
      studentName: activeStudentName,
      groupId: activeGroupId,
      parametersSummary: `Input Manual · X=${xVal}`,
      keyMetrics: {
        [xAxisLabel]: `${xVal}`,
        [y1AxisLabel]: `${y1Val}`,
        ...(y2Val !== undefined ? { Y2: `${y2Val}` } : {}),
      },
      numericX: xVal,
      numericY1: y1Val,
      numericY2: y2Val,
      notes: manualNotes.trim() || 'Pengukuran manual praktikan',
    };
    onAddRecord(newRec);
    setManualX('');
    setManualY1('');
    setManualY2('');
    setManualNotes('');
    setShowAddForm(false);
  };

  const handleImportCsvSubmit = () => {
    if (!onAddRecord) return;
    const parsed = parseManualCsvRecords(csvRawText);
    if (parsed.length === 0) {
      setCsvFeedback('Tidak ada baris numerik valid ditemukan. Format: X, Y1 [, Y2 [, Catatan]]');
      return;
    }
    labSound.playSuccessChime();
    const resolvedDomain = normalizeScienceDomain(domain || records[0]?.domain);
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    parsed.forEach((row, idx) => {
      onAddRecord({
        id: `CSV-${String(records.length + idx + 1).padStart(2, '0')}-${String(Date.now() + idx).slice(-3)}`,
        timestamp: nowTime,
        domain: resolvedDomain,
        moduleId: moduleId || records[0]?.moduleId,
        experimentTitle: moduleTitle || records[0]?.experimentTitle || 'Impor CSV',
        studentName: activeStudentName,
        groupId: activeGroupId,
        parametersSummary: `Impor CSV · X=${row.x}`,
        keyMetrics: {
          [xAxisLabel]: `${row.x}`,
          [y1AxisLabel]: `${row.y1}`,
          ...(row.y2 !== undefined ? { Y2: `${row.y2}` } : {}),
        },
        numericX: row.x,
        numericY1: row.y1,
        numericY2: row.y2,
        notes: row.notes,
      });
    });
    setCsvFeedback(`${parsed.length} baris data berhasil diimpor ke tabel dan grafik regresi.`);
    setCsvRawText('');
    setTimeout(() => {
      setShowImportCsv(false);
      setCsvFeedback(null);
    }, 1200);
  };

  const startEditRow = (rec: ExperimentRecord) => {
    labSound.playClick();
    setEditingId(rec.id);
    setEditX(rec.numericX !== undefined ? String(rec.numericX) : '');
    setEditY1(rec.numericY1 !== undefined ? String(rec.numericY1) : '');
    setEditNotes(rec.notes || '');
  };

  const saveEditRow = (rec: ExperimentRecord) => {
    if (!onUpdateRecord) return;
    const nextX = Number(editX.replace(',', '.'));
    const nextY1 = Number(editY1.replace(',', '.'));
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY1)) return;
    labSound.playClick();
    onUpdateRecord(rec.id, {
      numericX: nextX,
      numericY1: nextY1,
      notes: editNotes.trim(),
      keyMetrics: {
        ...rec.keyMetrics,
        [xAxisLabel]: `${nextX}`,
        [y1AxisLabel]: `${nextY1}`,
      },
    });
    setEditingId(null);
  };

  return (
    <div className="rounded-2xl border border-[var(--comfort-border)] bg-[var(--comfort-surface)] p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-[var(--comfort-text)]">
              Tabel Rekaman Observasi Praktikum
            </h3>
            <p className="text-xs text-[var(--comfort-text-muted)] tabular-nums">
              Total {records.length} titik data uji tersimpan · dapat ditambah manual, diedit, atau diimpor dari CSV
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 text-[11px] text-[var(--comfort-text-muted)] mr-1">
            <span>Kamus:</span>
            <ScienceGlossaryTerm term="R²" />
            <span>·</span>
            <ScienceGlossaryTerm term="Slope/Gradien" />
            <span>·</span>
            <ScienceGlossaryTerm term="Outlier" />
          </div>

          {onAddRecord && (
            <>
              <button
                type="button"
                data-testid="add-manual-row-toggle-btn"
                onClick={() => {
                  labSound.playClick();
                  setShowAddForm((v) => !v);
                  setShowImportCsv(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>

              <button
                type="button"
                data-testid="import-csv-toggle-btn"
                onClick={() => {
                  labSound.playClick();
                  setShowImportCsv((v) => !v);
                  setShowAddForm(false);
                }}
                className="px-3 py-1.5 rounded-xl border border-[var(--comfort-border)] bg-[var(--comfort-surface-subtle)] hover:border-sky-500/50 text-[var(--comfort-text)] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-sky-500" />
                <span>Impor CSV</span>
              </button>
            </>
          )}

          {records.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Manual Add Row Form */}
      {showAddForm && onAddRecord && (
        <form
          onSubmit={handleSubmitManualRow}
          data-testid="manual-row-form"
          className="p-3.5 rounded-xl border border-sky-500/35 bg-sky-500/5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--comfort-text)]">
              Input Data Pengukuran Manual (Sinkron ke Grafik Regresi)
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
            >
              Tutup
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <label className="space-y-1 text-[11px]">
              <span className="font-semibold text-[var(--comfort-text-muted)] block truncate">
                {xAxisLabel} *
              </span>
              <input
                type="number"
                step="any"
                required
                data-testid="manual-x-input"
                value={manualX}
                onChange={(e) => setManualX(e.target.value)}
                placeholder="Mis. 25"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs font-mono text-[var(--comfort-text)]"
              />
            </label>
            <label className="space-y-1 text-[11px]">
              <span className="font-semibold text-[var(--comfort-text-muted)] block truncate">
                {y1AxisLabel} *
              </span>
              <input
                type="number"
                step="any"
                required
                data-testid="manual-y1-input"
                value={manualY1}
                onChange={(e) => setManualY1(e.target.value)}
                placeholder="Mis. 6.2"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs font-mono text-[var(--comfort-text)]"
              />
            </label>
            <label className="space-y-1 text-[11px]">
              <span className="font-semibold text-[var(--comfort-text-muted)] block">
                Y2 (Opsional)
              </span>
              <input
                type="number"
                step="any"
                value={manualY2}
                onChange={(e) => setManualY2(e.target.value)}
                placeholder="Kosongkan jika tdk ada"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs font-mono text-[var(--comfort-text)]"
              />
            </label>
            <label className="space-y-1 text-[11px] lg:col-span-2">
              <span className="font-semibold text-[var(--comfort-text-muted)] block">
                Catatan Pengamatan
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  data-testid="manual-notes-input"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Contoh: Ulangan ke-1 suhu ruang"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs text-[var(--comfort-text)]"
                />
                <button
                  type="submit"
                  data-testid="manual-row-submit-btn"
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  Simpan Baris
                </button>
              </div>
            </label>
          </div>
          {formError && <p className="text-[11px] text-rose-500 font-semibold">{formError}</p>}
        </form>
      )}

      {/* CSV / TSV Paste Importer Panel */}
      {showImportCsv && onAddRecord && (
        <div
          data-testid="csv-import-panel"
          className="p-3.5 rounded-xl border border-indigo-500/35 bg-indigo-500/5 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--comfort-text)]">
              Impor Massal Data (Tempel dari Excel / CSV / Spreadsheet)
            </span>
            <button
              type="button"
              onClick={() => setShowImportCsv(false)}
              className="text-xs text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer"
            >
              Tutup
            </button>
          </div>
          <p className="text-[11px] text-[var(--comfort-text-muted)]">
            Format tiap baris: <code className="font-mono text-[var(--comfort-text)]">X, Y1 [, Y2 [, Catatan]]</code> (dipisahkan koma, titik-koma, atau tab). Baris judul otomatis dilewati.
          </p>
          <textarea
            rows={4}
            data-testid="csv-import-textarea"
            value={csvRawText}
            onChange={(e) => setCsvRawText(e.target.value)}
            placeholder={'10, 2.5, 12, Uji pertama\n20, 5.1, 35, Uji kedua\n30, 7.4, 78, Uji ketiga'}
            className="w-full p-2.5 rounded-lg border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs font-mono text-[var(--comfort-text)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-[var(--comfort-text-muted)]">
              {csvFeedback ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{csvFeedback}</span>
              ) : (
                <span>Terdeteksi {parseManualCsvRecords(csvRawText).length} baris numerik valid</span>
              )}
            </div>
            <button
              type="button"
              data-testid="csv-import-submit-btn"
              onClick={handleImportCsvSubmit}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
            >
              Impor ke Tabel &amp; Grafik
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      {records.length === 0 ? (
        <div className="py-12 text-center text-[var(--comfort-text-muted)] space-y-2">
          <Database className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-xs font-medium text-[var(--comfort-text)]">
            Belum ada data percobaan yang direkam.
          </p>
          <p className="text-[11px] text-[var(--comfort-text-muted)]">
            Kembali ke simulasi 3D dan klik <strong>&ldquo;+ Catat Data&rdquo;</strong>, jalankan <strong>Auto-Sweep 5 Titik</strong>, atau klik <strong>&ldquo;+ Tambah Baris&rdquo;</strong> di atas.
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
                <th className="py-2.5 px-3 text-right">{xAxisLabel}</th>
                <th className="py-2.5 px-3 text-right">{y1AxisLabel}</th>
                <th className="py-2.5 px-3">Ringkasan Parameter</th>
                <th className="py-2.5 px-3">Catatan Observasi</th>
                {(onDeleteRecord || onUpdateRecord) && (
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--comfort-border)] font-mono text-[11px] tabular-nums">
              {records.map((rec, idx) => {
                const isEditing = editingId === rec.id;
                return (
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
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editX}
                          onChange={(e) => setEditX(e.target.value)}
                          className="w-20 px-1.5 py-0.5 rounded border border-sky-500 bg-[var(--comfort-surface)] text-right text-xs"
                        />
                      ) : rec.numericX !== undefined ? (
                        rec.numericX
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editY1}
                          onChange={(e) => setEditY1(e.target.value)}
                          className="w-20 px-1.5 py-0.5 rounded border border-emerald-500 bg-[var(--comfort-surface)] text-right text-xs"
                        />
                      ) : rec.numericY1 !== undefined ? (
                        rec.numericY1
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3 text-[var(--comfort-text-muted)] max-w-xs truncate font-sans">
                      {rec.parametersSummary}
                    </td>
                    <td className="py-2 px-3 text-[var(--comfort-text-muted)] max-w-xs truncate font-sans italic">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full min-w-[140px] px-1.5 py-0.5 rounded border border-[var(--comfort-border)] bg-[var(--comfort-surface)] text-xs not-italic text-[var(--comfort-text)]"
                        />
                      ) : (
                        rec.notes || '—'
                      )}
                    </td>
                    {(onDeleteRecord || onUpdateRecord) && (
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEditRow(rec)}
                                title="Simpan perubahan"
                                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                title="Batal"
                                className="p-1 rounded-lg text-[var(--comfort-text-muted)] hover:bg-[var(--comfort-surface-subtle)] cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {onUpdateRecord && (
                                <button
                                  type="button"
                                  onClick={() => startEditRow(rec)}
                                  title="Edit baris data ini"
                                  className="p-1 rounded-lg text-[var(--comfort-text-muted)] hover:text-sky-500 hover:bg-sky-500/10 transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteRecord && (
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
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
