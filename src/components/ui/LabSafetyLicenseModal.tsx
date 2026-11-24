import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Printer,
  X,
  CheckCircle2,
  Award,
  FileCheck2,
} from 'lucide-react';
import {
  LabSafetyLicense,
  buildLicenseVerificationText,
} from '../../services/labLicenseEngine';
import { labSound } from '../../utils/soundEngine';

export interface LabSafetyLicenseModalProps {
  isOpen: boolean;
  license: LabSafetyLicense | null;
  onClose: () => void;
}

export const LabSafetyLicenseModal: React.FC<LabSafetyLicenseModalProps> = ({
  isOpen,
  license,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !license) return;
    let active = true;
    const payload = buildLicenseVerificationText(license);
    QRCode.toDataURL(payload, {
      width: 150,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, license]);

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

  if (!isOpen || !license) return null;

  const handlePrint = () => {
    labSound.playClick();
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kartu Surat Izin Masuk Laboratorium (SIM Lab)"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-[var(--comfort-surface)] border border-[var(--comfort-border)] shadow-2xl overflow-hidden">
        {/* Top Action Bar */}
        <div className="px-5 py-3.5 bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)] border-b border-[var(--comfort-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-[var(--comfort-text)]">
              Surat Izin Masuk Laboratorium (SIM Lab Digital)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 min-h-[36px] rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Kartu</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[var(--comfort-surface)] hover:bg-[var(--comfort-elevated)] border border-[var(--comfort-border)] text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              aria-label="Tutup modal SIM Lab"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Printable License Card Body */}
        <div className="p-5 sm:p-6 bg-[var(--comfort-bg)]">
          <div className="rounded-2xl border-2 border-emerald-500/50 bg-[var(--comfort-surface)] p-5 shadow-md space-y-4">
            {/* License Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--comfort-border)] pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-2xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Otorisasi Resmi RuangLABmu</span>
                </div>
                <h4 className="text-base sm:text-lg font-extrabold text-[var(--comfort-text)] tracking-tight">
                  SERTIFIKAT KELAYAKAN &amp; K3 LAB
                </h4>
                <div className="font-mono text-xs text-[var(--comfort-text-muted)]">
                  No. Lisensi: <strong className="text-[var(--comfort-text)]">{license.licenseId}</strong>
                </div>
              </div>
              <span className="text-emerald-700 dark:text-emerald-300 font-mono text-2xs font-bold inline-flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>TERVERIFIKASI</span>
              </span>
            </div>

            {/* Identity + QR Split */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="space-y-2 text-xs flex-1">
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-[var(--comfort-text-muted)] font-medium">Nama Praktikan</span>
                  <span className="col-span-2 font-bold text-[var(--comfort-text)]">: {license.studentName}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-[var(--comfort-text-muted)] font-medium">Kelompok</span>
                  <span className="col-span-2 font-semibold text-[var(--comfort-text)]">: {license.studentGroup}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-[var(--comfort-text-muted)] font-medium">Jenjang</span>
                  <span className="col-span-2 font-semibold text-sky-700 dark:text-sky-400">: {license.tier}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-[var(--comfort-text-muted)] font-medium">Modul Izin</span>
                  <span className="col-span-2 font-bold text-[var(--comfort-text)]">: {license.moduleTitle}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-[var(--comfort-text-muted)] font-medium">Diterbitkan</span>
                  <span className="col-span-2 font-mono text-2xs text-[var(--comfort-text-muted)]">: {license.issuedAtFormatted} WIB</span>
                </div>
              </div>

              {/* QR Code Verification (white quiet zone required for optical scanners) */}
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[#ffffff] border border-[var(--comfort-border)] shadow-xs shrink-0 self-center sm:self-start">
                  <img
                    src={qrDataUrl}
                    alt={`QR Verifikasi SIM Lab ${license.licenseId}`}
                    className="w-24 h-24 rounded"
                  />
                  <span className="text-2xs font-mono text-slate-600 font-bold">
                    SCAN VERIFIKASI
                  </span>
                </div>
              )}
            </div>

            {/* Readiness Scores Strip */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--comfort-border)]">
              <div className="p-2.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-2xs text-[var(--comfort-text-muted)]">Protokol K3</div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {license.k3Complied ? 'Lulus & Patuh SOP' : 'Belum Patuh'}
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div>
                  <div className="text-2xs text-[var(--comfort-text-muted)]">Kuis Pra-Praktikum</div>
                  <div className="text-xs font-bold text-sky-700 dark:text-sky-400 font-mono tabular-nums">
                    {license.preLabQuizScorePct}% (Syarat ≥ 75%)
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-2xs text-[var(--comfort-text)] bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5">
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Praktikan berhak mengoperasikan aparatus laboratorium 3D serta merekam data eksperimen secara mandiri dan bertanggung jawab.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
