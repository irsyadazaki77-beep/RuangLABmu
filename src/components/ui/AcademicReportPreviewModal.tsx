import React, { useRef } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  AcademicReportData,
  generateAcademicReportHTML,
  downloadAcademicReportFile,
} from '../../utils/academicReportExporter';
import { labSound } from '../../utils/soundEngine';

export interface AcademicReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: AcademicReportData;
}

export const AcademicReportPreviewModal: React.FC<
  AcademicReportPreviewModalProps
> = ({ isOpen, onClose, reportData }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  if (!isOpen) return null;

  const htmlContent = generateAcademicReportHTML(reportData);

  const handlePrintIframe = () => {
    labSound.playClick();
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Laporan Resmi Praktikum Akademik"
    >
      <div className="relative w-full max-w-5xl h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Action Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Pratinjau Laporan Resmi Praktikum (Format Standar A4)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Siap Cetak
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {reportData.experimentTitle} · Praktikan: {reportData.studentName} ({reportData.groupId}) · {reportData.records.length} Data Uji
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintIframe}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / Simpan PDF
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                downloadAcademicReportFile(reportData, 'html');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Unduh .HTML
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                downloadAcademicReportFile(reportData, 'md');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Unduh .MD
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau laporan"
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embedded A4 Document Preview */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-950 p-3 sm:p-6 overflow-auto flex justify-center">
          <iframe
            ref={iframeRef}
            title="Dokumen Laporan Resmi Praktikum"
            srcDoc={htmlContent}
            className="w-full max-w-[210mm] min-h-[297mm] h-full bg-white rounded-lg shadow-xl border border-slate-300"
          />
        </div>
      </div>
    </div>
  );
};
