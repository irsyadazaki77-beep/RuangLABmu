import React from 'react';
import {
  CheckCircle2,
  Atom,
  BarChart3,
  FileCheck2,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Printer,
  Sparkles,
} from 'lucide-react';
import { labSound } from '../utils/soundEngine';

export type WorkflowStepNumber = 1 | 2 | 3 | 4;

interface GuidedWorkflowStepperProps {
  currentStep: WorkflowStepNumber;
  experimentTitle: string;
  recordsCount: number;
  minRecordsRequired?: number;
  lksGraded: boolean;
  onStepChange: (step: WorkflowStepNumber) => void;
  onBackToLobby: () => void;
  onPrintReport?: () => void;
}

export const GuidedWorkflowStepper: React.FC<GuidedWorkflowStepperProps> = ({
  currentStep,
  experimentTitle,
  recordsCount,
  minRecordsRequired = 3,
  lksGraded,
  onStepChange,
  onBackToLobby,
  onPrintReport,
}) => {
  const steps = [
    {
      num: 1 as WorkflowStepNumber,
      label: 'Pengenalan & K3',
      shortLabel: '1. K3 & Alat',
      desc: 'Tinjauan teori & keselamatan lab',
      icon: BookOpen,
      isCompleted: true, // Once started, step 1 is viewed
    },
    {
      num: 2 as WorkflowStepNumber,
      label: 'Meja Simulasi 3D',
      shortLabel: '2. Simulasi 3D',
      desc: 'Manipulasi variabel & rekam data',
      icon: Atom,
      isCompleted: recordsCount >= minRecordsRequired,
    },
    {
      num: 3 as WorkflowStepNumber,
      label: 'Analisis & Grafik',
      shortLabel: '3. Grafik & LKS',
      desc: 'Regresi linier & evaluasi data',
      icon: BarChart3,
      isCompleted: lksGraded,
    },
    {
      num: 4 as WorkflowStepNumber,
      label: 'Laporan & Evaluasi',
      shortLabel: '4. Laporan Resmi',
      desc: 'Sertifikat & ekspor laporan PDF',
      icon: FileCheck2,
      isCompleted: lksGraded && recordsCount >= minRecordsRequired,
    },
  ];

  const hasEnoughData = recordsCount >= minRecordsRequired;

  return (
    <>
      {/* 1. TOP PROGRESS TRACKER (Sticky under header) */}
      <nav
        aria-label="Tahapan Alur Praktikum"
        className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2 text-white shrink-0 z-40 select-none shadow-xs"
      >
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Experiment Context & Back link */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 truncate max-w-xs xl:max-w-md">
            <button
              type="button"
              onClick={() => {
                labSound.playClick();
                onBackToLobby();
              }}
              className="font-medium text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              ← Ganti Modul
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-200 truncate" title={experimentTitle}>
              {experimentTitle}
            </span>
          </div>

          {/* Center: 4-Step Sequential Pipeline */}
          <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-center max-w-2xl">
            {steps.map((st, idx) => {
              const isCurrent = currentStep === st.num;
              const isPast = currentStep > st.num;
              const isFuture = currentStep < st.num;
              const Icon = st.icon;

              return (
                <React.Fragment key={st.num}>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      onStepChange(st.num);
                    }}
                    className={`group relative px-2.5 sm:px-3 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer text-xs ${
                      isCurrent
                        ? 'bg-sky-600 text-white font-bold shadow-xs'
                        : isPast || st.isCompleted
                        ? 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700/80 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Status Circle or Checkmark */}
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-white text-sky-600'
                          : st.isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : isFuture
                          ? 'bg-slate-700 text-slate-400'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {st.isCompleted && !isCurrent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                      ) : (
                        <span>{st.num}</span>
                      )}
                    </div>

                    <span className="hidden md:inline whitespace-nowrap">{st.label}</span>
                    <span className="md:hidden whitespace-nowrap">{st.shortLabel}</span>
                  </button>

                  {idx < steps.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`w-4 sm:w-8 h-0.5 rounded-full ${
                        currentStep > st.num
                          ? 'bg-emerald-500/80'
                          : 'bg-slate-800'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Right: Quick Stage Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span className="font-mono text-sky-400 font-bold">
              Tahap {currentStep}/4
            </span>
          </div>
        </div>
      </nav>

      {/* 2. BOTTOM SMART NEXT-STEP NAVIGATOR BAR (Fixed bottom) */}
      <footer
        className="fixed bottom-0 inset-x-0 h-16 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-white px-4 z-40 flex items-center justify-between select-none shadow-lg"
      >
        <div className="max-w-[1380px] w-full mx-auto flex items-center justify-between gap-4">
          {/* Left Context Guidance */}
          <div className="flex items-center gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onStepChange((currentStep - 1) as WorkflowStepNumber);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Langkah Sebelumnya</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onBackToLobby();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                ← Beranda Lab
              </button>
            )}

            {/* Smart Contextual Hint */}
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              {currentStep === 1 && (
                <span>Pelajari K3 dan persiapkan alat sebelum menjalankan simulasi 3D.</span>
              )}
              {currentStep === 2 && (
                <div className="flex items-center gap-2">
                  <span>Status Data:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${
                      hasEnoughData
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {recordsCount} / {minRecordsRequired} Data Minimal
                  </span>
                  {!hasEnoughData && (
                    <span className="text-slate-400">Tekan tombol &quot;+ Catat Data Trial&quot; di meja 3D.</span>
                  )}
                </div>
              )}
              {currentStep === 3 && (
                <span>Evaluasi regresi kurva $R^2$ dan lengkapi pertanyaan LKS.</span>
              )}
              {currentStep === 4 && (
                <span>Laporan praktikum telah tersusun lengkap dan siap dicetak/diunduh.</span>
              )}
            </div>
          </div>

          {/* Right Action Button (Step Progression) */}
          <div className="flex items-center gap-3">
            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onStepChange(2);
                }}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>Saya Siap, Buka Meja Simulasi 3D</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onStepChange(3);
                }}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                  hasEnoughData
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/40 animate-pulse'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {hasEnoughData ? (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Data Cukup! Lanjut ke Analisis Grafik</span>
                  </>
                ) : (
                  <span>Lanjut ke Analisis Grafik ({recordsCount} data)</span>
                )}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onStepChange(4);
                }}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>Susun Laporan Resmi Praktikum</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 4 && (
              <div className="flex items-center gap-2">
                {onPrintReport && (
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      onPrintReport();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-700"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Cetak Laporan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    labSound.playRecordSuccess();
                    onBackToLobby();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesai & Pilih Praktikum Lain</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
};
