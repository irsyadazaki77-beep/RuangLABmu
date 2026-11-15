import { useCallback, useState } from 'react';
import {
  evaluateSubmissionRubric,
  serializeRubricJson,
  type EvaluatedRubricReport,
} from '../shared/grading/rubricEngine';
import type { LabSubmission } from '../types/submissionTypes';

export interface GradebookSubmitResult {
  submission: LabSubmission;
  autoRubric: EvaluatedRubricReport;
  persistedOnline: boolean;
}

/**
 * Modular hook for evaluating and submitting student lab reports to the Teacher Gradebook.
 * Runs the deterministic `evaluateSubmissionRubric` engine immediately (both client-side
 * for 3T offline resilience and server-side on `POST /api/submissions`).
 */
export function useGradebookSubmit() {
  const [isSubmittingGradebook, setIsSubmittingGradebook] = useState(false);
  const [lastEvaluatedRubric, setLastEvaluatedRubric] =
    useState<EvaluatedRubricReport | null>(null);

  const evaluateDraftSubmission = useCallback(
    (
      draft: Pick<
        LabSubmission,
        | 'moduleId'
        | 'domain'
        | 'hypothesisText'
        | 'observationData'
        | 'regressionMetrics'
        | 'quizScore'
        | 'conclusionText'
      >
    ): EvaluatedRubricReport => {
      const report = evaluateSubmissionRubric(draft);
      setLastEvaluatedRubric(report);
      return report;
    },
    []
  );

  const submitToGradebook = useCallback(
    async (submission: LabSubmission): Promise<GradebookSubmitResult> => {
      setIsSubmittingGradebook(true);
      const localRubric = evaluateSubmissionRubric({
        moduleId: submission.moduleId,
        domain: submission.domain,
        hypothesisText: submission.hypothesisText,
        observationData: submission.observationData,
        regressionMetrics: submission.regressionMetrics,
        quizScore: submission.quizScore,
        conclusionText: submission.conclusionText,
      });

      const enrichedSubmission: LabSubmission = {
        ...submission,
        autoRubric: localRubric,
        rubricJson: serializeRubricJson(localRubric),
        teacherGrade: submission.teacherGrade ?? {
          score: localRubric.score,
          feedback: localRubric.summaryFeedback,
          gradedAt: new Date().toISOString(),
        },
      };
      setLastEvaluatedRubric(localRubric);

      try {
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedSubmission),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            submission?: LabSubmission;
            autoRubric?: EvaluatedRubricReport;
          };
          const finalRubric = data.autoRubric ?? localRubric;
          setLastEvaluatedRubric(finalRubric);
          return {
            submission: data.submission ?? enrichedSubmission,
            autoRubric: finalRubric,
            persistedOnline: true,
          };
        }
      } catch {
        // Offline 3T fallback uses deterministic local rubric
      } finally {
        setIsSubmittingGradebook(false);
      }

      return {
        submission: enrichedSubmission,
        autoRubric: localRubric,
        persistedOnline: false,
      };
    },
    []
  );

  return {
    isSubmittingGradebook,
    lastEvaluatedRubric,
    evaluateDraftSubmission,
    submitToGradebook,
  };
}
