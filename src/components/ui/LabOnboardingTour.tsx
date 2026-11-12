import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  X,
  Box,
  Activity,
  ListChecks,
  Bot,
} from 'lucide-react';
import { labSound } from '../../utils/soundEngine';

export const ONBOARDING_STORAGE_KEY = 'ruanglab:onboarding_completed';

export interface OnboardingTourStep {
  stepNumber: 1 | 2 | 3 | 4;
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  shortcutHint: string;
}

export const LAB_ONBOARDING_STEPS: OnboardingTourStep[] = [
  {
    stepNumber: 1,
    id: 'canvas-3d',
    targetSelector: '[data-onboarding="canvas-3d"]',
    title: 'Langkah 1: Kanvas Eksperimen 3D Interaktif',
    description:
      'Klik dan geser alat peraga 3D secara langsung atau putar sudut pandang kamera.',
    shortcutHint: 'Drag kiri: Putar · Scroll: Zoom · Drag alat: Pindah posisi',
  },
  {
    stepNumber: 2,
    id: 'telemetry-ribbon',
    targetSelector: '[data-onboarding="telemetry-ribbon"]',
    title: 'Langkah 2: Pita Telemetri & Osiloskop Real-Time',
    description:
      'Pantau metrik real-time dan klik angka untuk membuka Osiloskop/Gauge.',
    shortcutHint: 'Klik metrik utama di pita atas untuk melihat gelombang live',
  },
  {
    stepNumber: 3,
    id: 'workflow-stepper',
    targetSelector: '[data-onboarding="workflow-stepper"]',
    title: 'Langkah 3: Alur Metode Ilmiah 4 Tahap',
    description:
      'Ikuti 4 tahap ilmiah: Hipotesis -> Simulasi 3D -> Grafik Regresi -> Laporan.',
    shortcutHint: 'Rekam minimal 3 titik data sebelum mengevaluasi kurva R²',
  },
  {
    stepNumber: 4,
    id: 'control-dock-ai',
    targetSelector: '[data-onboarding="dr-labmu-trigger"]',
    title: 'Langkah 4: Kontrol Cepat & Asisten AI Dr. LabMu',
    description:
      'Gunakan tombol Space untuk Play/Jeda atau tanyakan kendala Anda ke asisten AI Dr. LabMu lewat teks maupun suara.',
    shortcutHint: '[Space] Play/Jeda · [R] Reset · [S] Snapshot · [A] Dr. LabMu',
  },
];

export function hasCompletedOnboardingTour(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    }
  } catch {
    // ignore storage error
  }
  return false;
}

export function markOnboardingTourCompleted(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    }
  } catch {
    // ignore storage error
  }
}

export interface LabOnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const LabOnboardingTour: React.FC<LabOnboardingTourProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const currentStep = LAB_ONBOARDING_STEPS[currentStepIdx] || LAB_ONBOARDING_STEPS[0];

  const updateTargetRect = useCallback(() => {
    if (!isOpen || typeof document === 'undefined') {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSpotlightRect({
          top: Math.max(4, rect.top - 6),
          left: Math.max(4, rect.left - 6),
          width: rect.width + 12,
          height: rect.height + 12,
        });
        return;
      }
    }
    setSpotlightRect(null);
  }, [isOpen, currentStep.targetSelector]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIdx(0);
      return;
    }
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isOpen, currentStepIdx, updateTargetRect]);

  const handleCompleteAndClose = () => {
    labSound.playClick(680);
    markOnboardingTourCompleted();
    onClose();
  };

  const handleNext = () => {
    labSound.playClick(620);
    if (currentStepIdx < LAB_ONBOARDING_STEPS.length - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    } else {
      handleCompleteAndClose();
    }
  };

  const handlePrev = () => {
    labSound.playClick(500);
    setCurrentStepIdx((prev) => Math.max(0, prev - 1));
  };

  const getStepIcon = (stepNum: 1 | 2 | 3 | 4) => {
    switch (stepNum) {
      case 1:
        return <Box className="w-4 h-4 text-sky-400" />;
      case 2:
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 3:
        return <ListChecks className="w-4 h-4 text-amber-400" />;
      case 4:
        return <Bot className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan Interaktif RuangLABmu"
          data-testid="lab-onboarding-tour"
        >
          {/* Dimmed backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity"
            onClick={handleCompleteAndClose}
          />

          {/* Highlighted Target Spotlight Ring */}
          {spotlightRect && (
            <motion.div
              initial={false}
              animate={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              data-testid="onboarding-spotlight-ring"
              className="fixed z-50 rounded-2xl border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)] ring-4 ring-sky-400/30 pointer-events-none"
            />
          )}

          {/* Interactive Tour Card */}
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-[410px] z-50 rounded-2xl bg-slate-900/95 text-slate-100 border border-sky-500/40 shadow-2xl p-5 space-y-4"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                  {getStepIcon(currentStep.stepNumber)}
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400">
                  Panduan UI · Langkah {currentStep.stepNumber} / {LAB_ONBOARDING_STEPS.length}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCompleteAndClose}
                aria-label="Lewati & Tutup Panduan"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Content */}
            <div className="space-y-1.5">
              <h3
                data-testid="onboarding-step-title"
                className="text-sm sm:text-base font-bold text-white tracking-tight"
              >
                {currentStep.title}
              </h3>
              <p
                data-testid="onboarding-step-description"
                className="text-xs sm:text-sm text-slate-300 leading-relaxed"
              >
                {currentStep.description}
              </p>
            </div>

            {/* Shortcut / Tip Callout */}
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-3 py-2 text-[11px] font-mono text-sky-300 flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>{currentStep.shortcutHint}</span>
            </div>

            {/* Stepper Progress Dots & Navigation Controls */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {LAB_ONBOARDING_STEPS.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setCurrentStepIdx(idx)}
                    aria-label={`Ke langkah ${st.stepNumber}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIdx
                        ? 'w-6 bg-sky-400'
                        : idx < currentStepIdx
                        ? 'w-2 bg-emerald-400'
                        : 'w-2 bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStepIdx > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    data-testid="onboarding-prev-btn"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  data-testid="onboarding-next-btn"
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  {currentStepIdx === LAB_ONBOARDING_STEPS.length - 1 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Selesai</span>
                    </>
                  ) : (
                    <>
                      <span>Lanjut</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LabOnboardingTour;
