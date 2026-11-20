import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WorkflowStep } from '../../stores/useLabStore';
import { labSound } from '../../utils/soundEngine';

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
            aria-label={`Pindah ke Tahap ${item.label}`}
            title={
              item.needsDataHint
                ? `Disarankan catat minimal 3 titik data pengamatan terlebih dahulu (${recordsCount}/3 tercatat)`
                : undefined
            }
            className={`px-1.5 xl:px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 ${
              isActive
                ? 'bg-sky-600 text-white shadow-xs'
                : item.done
                ? 'text-emerald-700 dark:text-emerald-400 hover:bg-[var(--comfort-surface)]'
                : 'text-[var(--comfort-text-muted)] hover:text-[var(--comfort-text)] hover:bg-[var(--comfort-surface)]'
            }`}
          >
            {item.done && !isActive && (
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`font-mono text-[10px] px-1 rounded tabular-nums ${
                  isAnalysisReady
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : isActive
                    ? 'bg-sky-700 text-sky-100'
                    : 'bg-[var(--comfort-surface)] text-[var(--comfort-text-muted)]'
                }`}
              >
                {item.badge}
              </span>
            )}
            {item.needsDataHint && !isActive && (
              <span
                data-testid="step3-readiness-dot"
                className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
