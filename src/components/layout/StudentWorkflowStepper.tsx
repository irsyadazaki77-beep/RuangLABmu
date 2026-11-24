import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WorkflowStep } from '../../stores/useLabStore';
import { labSound } from '../../utils/soundEngine';
import { SPRING_LAYOUT_PILL } from '../../styles/motionPresets';

export interface StudentWorkflowStepperProps {
  workflowStep: WorkflowStep;
  setWorkflowStep: (step: WorkflowStep) => void;
  recordsCount: number;
  lksGraded: boolean;
}

/**
 * 4-step pedagogical workflow stepper rendered in the top bar for students,
 * including a non-blocking readiness indicator before Stage 3 (Analytics & LKS).
 */
export const StudentWorkflowStepper: React.FC<StudentWorkflowStepperProps> = ({
  workflowStep,
  setWorkflowStep,
  recordsCount,
  lksGraded,
}) => {
  const { t } = useTranslation();
  const isAnalysisReady = recordsCount >= 3;

  const steps = [
    { step: 1 as WorkflowStep, label: t('nav.step1'), done: workflowStep > 1 },
    {
      step: 2 as WorkflowStep,
      label: t('nav.step2'),
      done: isAnalysisReady || workflowStep > 2,
      badge: `${recordsCount}/3`,
    },
    {
      step: 3 as WorkflowStep,
      label: t('nav.step3'),
      done: lksGraded || workflowStep > 3,
      needsDataHint: !isAnalysisReady && workflowStep < 3,
    },
    {
      step: 4 as WorkflowStep,
      label: t('nav.step4'),
      done: workflowStep === 4 && isAnalysisReady && lksGraded,
    },
  ];

  return (
    <nav
      aria-label="Tahapan Alur Praktikum"
      data-onboarding="workflow-stepper"
      className="flex items-center gap-0.5 bg-[var(--comfort-surface-subtle)] border border-[var(--comfort-border)] p-1 rounded-xl shrink-0 max-w-full overflow-x-auto no-scrollbar"
    >
      {steps.map((item) => {
        const isActive = workflowStep === item.step;
        return (
          <button
            key={item.step}
            type="button"
            onClick={() => {
              labSound.playClick();
              setWorkflowStep(item.step);
            }}
            aria-current={isActive ? 'step' : undefined}
            aria-label={`Pindah ke Tahap ${item.label}`}
            title={
              item.needsDataHint
                ? `Disarankan catat minimal 3 titik data pengamatan terlebih dahulu (${recordsCount}/3 tercatat)`
                : undefined
            }
            className={`relative px-2 xl:px-2.5 py-1 rounded-lg text-2xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              isActive
                ? 'text-white'
                : item.done
                ? 'text-[var(--comfort-success)] hover:bg-[var(--comfort-surface)]'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)]'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="student-workflow-active-pill"
                transition={SPRING_LAYOUT_PILL}
                className="absolute inset-0 rounded-lg bg-[var(--comfort-accent-solid)] shadow-xs"
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              {item.done && !isActive && (
                <CheckCircle2 className="w-3 h-3 text-[var(--comfort-success)] shrink-0" />
              )}
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className={`font-mono text-2xs px-1 rounded tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isAnalysisReady
                      ? 'bg-[var(--comfort-success-soft)] text-[var(--comfort-success)]'
                      : 'bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {item.needsDataHint && !isActive && (
                <span
                  data-testid="step3-readiness-dot"
                  className="w-1.5 h-1.5 rounded-full bg-[var(--comfort-warning)] shrink-0"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
