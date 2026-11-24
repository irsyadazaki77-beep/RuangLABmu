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
      isCompleted: true,
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
      {/* 1. TOP PROGRESS TRACKER */}
      <nav
        aria-label="Tahapan Alur Praktikum"
        className="w-full comfort-header-surface border-b border-[var(--comfort-border)] py-2 px-3 sm:px-4 text-[var(--comfort-text)] shrink-0 z-40 select-none backdrop-blur-md"
      >
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-3 sm:gap-4">
          <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--comfort-text-muted)] truncate max-w-xs xl:max-w-md font-semibold">
            <span className="truncate" title={experimentTitle}>
              {experimentTitle}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-start sm:justify-center max-w-2xl overflow-x-auto no-scrollbar">
            {steps.map((st, idx) => {
              const isCurrent = currentStep === st.num;
              const isPast = currentStep > st.num;
              const isFuture = currentStep < st.num;

              return (
                <React.Fragment key={st.num}>
                  <button
                    type="button"
                    onClick={() => {
                      labSound.playClick();
                      onStepChange(st.num);
                    }}
                    className={`group relative px-2.5 sm:px-3 py-1.5 rounded-xl transition-all duration-150 active:scale-[0.98] flex items-center gap-2 cursor-pointer text-xs whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
                      isCurrent
                        ? 'comfort-tab-active font-bold shadow-xs'
                        : isPast || st.isCompleted
                        ? 'bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] text-[var(--comfort-text)] hover:border-[var(--comfort-accent-border)] font-medium'
                        : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface-subtle)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-mono font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-[var(--comfort-surface)] text-[var(--comfort-accent)]'
                          : st.isCompleted
                          ? 'bg-[var(--comfort-success)] text-white'
                          : isFuture
                          ? 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text-muted)]'
                          : 'bg-[var(--comfort-surface-subtle)] text-[var(--comfort-text)]'
                      }`}
                    >
                      {st.isCompleted && !isCurrent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <span>{st.num}</span>
                      )}
                    </div>

                    <span className="hidden md:inline">{st.label}</span>
                    <span className="md:hidden">{st.shortLabel}</span>
                  </button>

                  {idx < steps.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`w-4 sm:w-8 h-0.5 rounded-full transition-colors ${
                        currentStep > st.num
                          ? 'bg-[var(--comfort-success)]'
                          : 'bg-[var(--comfort-border)]'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--comfort-text-muted)] shrink-0">
            <span className="font-mono text-[var(--comfort-accent)] font-bold tabular-nums">
              Tahap {currentStep}/4
            </span>
          </div>
        </div>
      </nav>

      {/* 2. BOTTOM SMART NEXT-STEP NAVIGATOR BAR */}
      <footer
        className="fixed bottom-0 inset-x-0 min-h-[60px] py-2 comfort-header-surface border-t border-[var(--comfort-border)] text-[var(--comfort-text)] px-3 sm:px-4 z-40 flex items-center justify-between select-none backdrop-blur-md shadow-sm"
      >
        <div className="max-w-[1380px] w-full mx-auto flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onStepChange((currentStep - 1) as WorkflowStepNumber);
                }}
                className="min-h-[42px] px-3 py-2 rounded-xl comfort-btn-secondary text-xs font-semibold transition-transform active:scale-[0.98] flex items-center gap-1.5 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
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
                className="min-h-[42px] px-3 py-2 rounded-xl comfort-btn-secondary text-xs font-semibold transition-transform active:scale-[0.98] flex items-center gap-1.5 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
              >
                ← Beranda Lab
              </button>
            )}

            <div className="hidden md:flex items-center gap-2 text-xs text-[var(--comfort-text-muted)]">
              {currentStep === 1 && (
                <span>Pelajari K3 dan persiapkan alat sebelum menjalankan simulasi 3D.</span>
              )}
              {currentStep === 2 && (
                <div className="flex items-center gap-2">
                  <span>Status Data:</span>
                  <span
                    className={`font-mono font-bold text-2xs tabular-nums ${
                      hasEnoughData
                        ? 'text-[var(--comfort-success)]'
                        : 'text-[var(--comfort-warning)]'
                    }`}
                  >
                    {hasEnoughData ? '● ' : '▲ '}
                    {recordsCount} / {minRecordsRequired} Data Minimal
                  </span>
                  {!hasEnoughData && (
                    <span>· Tekan &quot;Catat Data&quot; atau tombol D di meja 3D.</span>
                  )}
                </div>
              )}
              {currentStep === 3 && (
                <span>Evaluasi regresi kurva R² dan lengkapi pertanyaan LKS.</span>
              )}
              {currentStep === 4 && (
                <span>Laporan praktikum telah tersusun lengkap dan siap dicetak atau diunduh.</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  labSound.playClick();
                  onStepChange(2);
                }}
                className="min-h-[42px] px-5 py-2.5 rounded-xl comfort-btn-primary font-bold text-xs transition-transform active:scale-[0.98] flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
              >
                <span>Buka Meja Simulasi 3D</span>
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
                className={`min-h-[42px] px-5 py-2.5 rounded-xl font-bold text-xs transition-transform active:scale-[0.98] flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
                  hasEnoughData
                    ? 'bg-[var(--comfort-success)] text-white hover:opacity-92'
                    : 'comfort-btn-primary'
                }`}
              >
                {hasEnoughData ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Data Cukup — Lanjut Analisis Grafik</span>
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
                className="min-h-[42px] px-5 py-2.5 rounded-xl comfort-btn-primary font-bold text-xs transition-transform active:scale-[0.98] flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
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
                    className="min-h-[42px] px-4 py-2.5 rounded-xl comfort-btn-secondary font-semibold text-xs transition-transform active:scale-[0.98] flex items-center gap-2 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
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
                  className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[var(--comfort-success)] hover:opacity-92 text-white font-bold text-xs transition-transform active:scale-[0.98] flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesai &amp; Pilih Praktikum Lain</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
};
