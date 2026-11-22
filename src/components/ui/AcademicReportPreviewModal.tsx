import React, { useEffect, useRef } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import {
  AcademicReportData,
  generateAcademicReportHTML,
  downloadAcademicReportFile,
  exportOfficialLabReportPDF,
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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

  const handleExportPDF = async () => {
    labSound.playClick(760);
    await exportOfficialLabReportPDF(reportData);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Laporan Resmi Praktikum Akademik"
    >
      <div className="relative w-full max-w-5xl h-[90vh] rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Action Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] border-b border-[var(--comfort-border)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--comfort-text)]">
                  Pratinjau Laporan Resmi Praktikum (Format Standar A4)
                </h3>
                <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Siap Cetak / PDF
                </span>
              </div>
              <p className="text-[11px] text-[var(--comfort-text-muted)]">
                {reportData.experimentTitle} · Praktikan: {reportData.studentName} ({reportData.groupId}) · {reportData.records.length} Data Uji
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh PDF Resmi (.PDF)
            </button>
            <button
              type="button"
              onClick={handlePrintIframe}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak A4
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                downloadAcademicReportFile(reportData, 'html');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold bg-[var(--comfort-surface)] hover:bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border border-[var(--comfort-border)] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Unduh .HTML
            </button>
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                downloadAcademicReportFile(reportData, 'md');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold bg-[var(--comfort-surface)] hover:bg-[var(--comfort-elevated)] text-[var(--comfort-text)] border border-[var(--comfort-border)] transition-colors cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Unduh .MD
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau laporan"
              className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-[var(--comfort-surface)] hover:bg-rose-600/15 text-[var(--comfort-text-muted)] hover:text-rose-600 dark:hover:text-rose-400 border border-[var(--comfort-border)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Embedded A4 Document Preview */}
        <div className="flex-1 bg-[var(--comfort-bg)] p-3 sm:p-6 overflow-auto flex justify-center">
          <iframe
            ref={iframeRef}
            title="Dokumen Laporan Resmi Praktikum"
            srcDoc={htmlContent}
            className="w-full max-w-[210mm] min-h-[297mm] h-full bg-[#ffffff] rounded-lg shadow-xl border border-[var(--comfort-border)]"
          />
        </div>
      </div>
    </div>
  );
};
