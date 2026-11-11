export interface LabSubmission {
  id: string;
  studentName: string;
  studentId?: string;
  roomId?: string;
  domain: string;
  moduleId: string;
  submittedAt: string;
  hypothesisText: string;
  observationData: Array<Record<string, number | string>>;
  regressionMetrics: {
    rSquared: number;
    slope: number;
    equation: string;
  };
  quizAnswers: Array<{
    questionId: string;
    selectedAnswer: number | string;
    isCorrect: boolean;
  }>;
  quizScore: number;
  conclusionText: string;
  teacherGrade?: {
    score: number;
    feedback: string;
    gradedAt: string;
  };
}
