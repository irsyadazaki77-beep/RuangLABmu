import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Printer,
  X,
  CheckCircle2,
  Award,
  Sparkles,
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

  if (!isOpen || !license) return null;

  const handlePrint = () => {
    labSound.playClick();
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kartu Surat Izin Masuk Laboratorium (SIM Lab)"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        {/* Top Action Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold">
              Surat Izin Masuk Laboratorium (SIM Lab Digital)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Kartu</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Tutup modal SIM Lab"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable License Card Body */}
        <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-950">
          <div className="rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-white via-emerald-50/30 to-sky-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 p-5 shadow-lg space-y-4">
            {/* License Header */}
            <div className="flex items-start justify-between gap-3 border-b border-emerald-200/80 dark:border-emerald-800/60 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Otorisasi Resmi RuangLABmu</span>
                </div>
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  SERTIFIKAT KELAYAKAN &amp; K3 LAB
                </h4>
                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  No. Lisensi: <strong className="text-slate-800 dark:text-slate-200">{license.licenseId}</strong>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono text-[11px] font-bold inline-flex items-center gap-1 shrink-0 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>TERVERIFIKASI</span>
              </span>
            </div>

            {/* Identity + QR Split */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="space-y-2 text-xs flex-1">
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Nama Praktikan</span>
                  <span className="col-span-2 font-bold text-slate-900 dark:text-white">: {license.studentName}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Kelompok</span>
                  <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">: {license.studentGroup}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Jenjang</span>
                  <span className="col-span-2 font-semibold text-sky-700 dark:text-sky-400">: {license.tier}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Modul Izin</span>
                  <span className="col-span-2 font-bold text-slate-900 dark:text-white">: {license.moduleTitle}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Diterbitkan</span>
                  <span className="col-span-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">: {license.issuedAtFormatted} WIB</span>
                </div>
              </div>

              {/* QR Code Verification */}
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0 self-center sm:self-start">
                  <img
                    src={qrDataUrl}
                    alt={`QR Verifikasi SIM Lab ${license.licenseId}`}
                    className="w-24 h-24 rounded"
                  />
                  <span className="text-[9px] font-mono text-slate-500 font-bold">
                    SCAN VERIFIKASI
                  </span>
                </div>
              )}
            </div>

            {/* Readiness Scores Strip */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/60">
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Protokol K3</div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {license.k3Complied ? 'Lulus & Patuh SOP' : 'Belum Patuh'}
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Kuis Pra-Praktikum</div>
                  <div className="text-xs font-bold text-sky-700 dark:text-sky-400 font-mono">
                    {license.preLabQuizScorePct}% (Syarat ≥ 75%)
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
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
