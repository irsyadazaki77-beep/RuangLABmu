import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGenerateMissionPayload,
  validateRoomMissionPayload,
  validateDrLabMuAskPayload,
  validateConversationalDrLabMuPayload,
  validateVisionDiagnosePayload,
  validateCreateSubmissionPayload,
  validateGradeSubmissionPayload,
} from './routePayloadValidators';

describe('Backend Route Payload Validators', () => {
  it('validates /api/generate-mission payloads strictly and rejects missing/wrong/oversized prompts', () => {
    assert.equal(validateGenerateMissionPayload(null).ok, false);
    assert.equal(validateGenerateMissionPayload([]).ok, false);
    assert.equal(validateGenerateMissionPayload({}).ok, false);
    assert.equal(validateGenerateMissionPayload({ caseStudyPrompt: '   ' }).ok, false);
    assert.equal(validateGenerateMissionPayload({ caseStudyPrompt: 12345 }).ok, false);
    assert.equal(
      validateGenerateMissionPayload({ caseStudyPrompt: 'x'.repeat(2005) }).ok,
      false
    );
    assert.equal(
      validateGenerateMissionPayload({
        caseStudyPrompt: 'Uji keasaman limbah tahu',
        publishToRoom: 'yes',
      }).ok,
      false
    );

    const valid = validateGenerateMissionPayload({
      moduleId: 'acid-base-titration',
      caseStudyPrompt: 'Uji keasaman sampel air sungai lokal.',
      teacherName: 'Bu Sari',
      roomId: 'lab-99',
      publishToRoom: true,
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.data.roomId, 'LAB-99');
      assert.equal(valid.data.publishToRoom, true);
    }
  });

  it('validates /api/rooms/:roomId/mission payloads', () => {
    assert.equal(validateRoomMissionPayload('', {}).ok, false);
    assert.equal(validateRoomMissionPayload('LAB-1', 'bad').ok, false);
    assert.equal(
      validateRoomMissionPayload('LAB-1', { mission: { title: '' } }).ok,
      false
    );
    assert.equal(
      validateRoomMissionPayload('LAB-1', {
        mission: {
          title: 'Misi Titrasi',
          targetVariable: { targetValue: Number.NaN },
        },
      }).ok,
      false
    );

    assert.equal(validateRoomMissionPayload('lab-1', { mission: null }).ok, true);
    assert.equal(
      validateRoomMissionPayload('lab-1', {
        teacherName: 'Pak Budi',
        mission: {
          title: 'Misi pH Air',
          domain: 'chemistry',
          moduleId: 'acid-base-titration',
          targetVariable: {
            variableKey: 'currentPh',
            variableLabel: 'pH',
            unit: 'pH',
            targetValue: 7,
            minSuccessValue: 6.8,
            maxSuccessValue: 7.2,
          },
        },
      }).ok,
      true
    );
  });

  it('validates /api/dr-labmu/ask and /api/assistant for both socratic and mission modes', () => {
    assert.equal(validateDrLabMuAskPayload(null).ok, false);
    assert.equal(validateDrLabMuAskPayload({}).ok, false);
    assert.equal(
      validateDrLabMuAskPayload({ mode: 'generate-mission', caseStudyPrompt: '' }).ok,
      false
    );
    assert.equal(
      validateDrLabMuAskPayload({
        telemetry: { domain: 'Fisika', analytics: { rSquared: 'bad' } },
      }).ok,
      false
    );

    const missionOk = validateDrLabMuAskPayload({
      mode: 'generate-mission',
      caseStudyPrompt: 'Analisis gerak bandul di bulan',
    });
    assert.equal(missionOk.ok, true);
    if (missionOk.ok) {
      assert.equal(missionOk.data.kind, 'mission');
    }

    const socraticOk = validateDrLabMuAskPayload({
      telemetry: {
        domain: 'Fisika',
        topic: 'Bandul Matematis',
        analytics: { rSquared: 0.99, slope: 2.0 },
      },
    });
    assert.equal(socraticOk.ok, true);
  });

  it('validates /api/ai/dr-labmu conversational payload', () => {
    assert.equal(validateConversationalDrLabMuPayload({}).ok, false);
    assert.equal(validateConversationalDrLabMuPayload({ message: 999 }).ok, false);
    assert.equal(
      validateConversationalDrLabMuPayload({ message: 'a'.repeat(2001) }).ok,
      false
    );
    assert.equal(
      validateConversationalDrLabMuPayload({ message: 'Mengapa R² turun?' }).ok,
      true
    );
  });

  it('validates /api/ai/vision-diagnose against non-string, malformed, and oversized images', () => {
    assert.equal(validateVisionDiagnosePayload({}).ok, false);
    assert.equal(validateVisionDiagnosePayload({ image: 12345 }).ok, false);
    assert.equal(validateVisionDiagnosePayload({ image: 'not-a-data-url' }).ok, false);
    assert.equal(
      validateVisionDiagnosePayload({
        image: 'data:image/jpeg;base64,abc',
        studentQuery: { text: 'oops' },
      }).ok,
      false
    );

    assert.equal(
      validateVisionDiagnosePayload({
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        studentQuery: 'Apakah rangkaian ini seimbang?',
        telemetry: { domain: 'Fisika', topic: 'Jembatan Wheatstone' },
      }).ok,
      true
    );
  });

  it('validates POST /api/submissions and PATCH /api/submissions/:id/grade strictly', () => {
    assert.equal(validateCreateSubmissionPayload({}).ok, false);
    assert.equal(
      validateCreateSubmissionPayload({ studentName: 123, moduleId: 'newton-incline' }).ok,
      false
    );
    assert.equal(
      validateCreateSubmissionPayload({
        studentName: 'Alya',
        moduleId: 'newton-incline',
        quizScore: 150,
      }).ok,
      false
    );
    assert.equal(
      validateCreateSubmissionPayload({
        studentName: 'Alya',
        moduleId: 'newton-incline',
        regressionMetrics: { rSquared: Number.NaN, slope: 1 },
      }).ok,
      false
    );

    const validSub = validateCreateSubmissionPayload({
      studentName: 'Alya Pratama',
      moduleId: 'newton-incline',
      quizScore: 95,
      observationData: [{ No: 1, X: 10, Y1: 2.5 }],
      quizAnswers: [{ questionId: 'q1', selectedAnswer: '9.0', isCorrect: true }],
    });
    assert.equal(validSub.ok, true);

    // Grade validation must reject null, "", false, [], NaN, out-of-range, and bad feedback
    assert.equal(validateGradeSubmissionPayload('SUB-1', { score: null }).ok, false);
    assert.equal(validateGradeSubmissionPayload('SUB-1', { score: '' }).ok, false);
    assert.equal(validateGradeSubmissionPayload('SUB-1', { score: false }).ok, false);
    assert.equal(validateGradeSubmissionPayload('SUB-1', { score: [] }).ok, false);
    assert.equal(validateGradeSubmissionPayload('SUB-1', { score: -1 }).ok, false);
    assert.equal(validateGradeSubmissionPayload('SUB-1', { score: 101 }).ok, false);
    assert.equal(
      validateGradeSubmissionPayload('SUB-1', { score: 90, feedback: 123 }).ok,
      false
    );
    assert.equal(validateGradeSubmissionPayload('', { score: 90 }).ok, false);

    const validGrade = validateGradeSubmissionPayload('SUB-1', {
      score: 92,
      feedback: 'Analisis data konsisten!',
    });
    assert.equal(validGrade.ok, true);
  });
});
