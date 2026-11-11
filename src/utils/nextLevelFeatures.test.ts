import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetGamificationProfile,
  recordK3Compliance,
  evaluateDataPrecisionXP,
  recordPerfectLksQuiz,
  calculateLevelFromXP,
  getLevelProgress,
  SCIENTIFIC_BADGES_CATALOG,
} from '../services/gamificationEngine';
import {
  recordTelemetryInteraction,
  getRecordedTelemetryEvents,
  clearRecordedTelemetryEvents,
  buildSubmissionTelemetryTimeline,
} from './telemetryRecorder';
import { exportGoogleClassroomCSV } from './csvExporter';

describe('Next-Level Features: Gamification, Telemetry Replay, & Google Classroom Export', () => {
  beforeEach(() => {
    resetGamificationProfile();
    clearRecordedTelemetryEvents();
  });

  it('FITUR 1: awards +100 XP and unlocks "K3 Guardian" badge upon K3 compliance', () => {
    const res = recordK3Compliance('newton-second-law');
    assert.strictEqual(res.xpDelta, 100);
    assert.strictEqual(res.profile.xp, 100);
    assert.ok(res.profile.unlockedBadges.includes('K3 Guardian'));
    assert.strictEqual(res.newlyUnlockedBadges.length, 1);
    assert.strictEqual(res.newlyUnlockedBadges[0].id, 'K3 Guardian');

    // Duplicate compliance on same moduleId does not award duplicate XP
    const duplicateRes = recordK3Compliance('newton-second-law');
    assert.strictEqual(duplicateRes.xpDelta, 0);
    assert.strictEqual(duplicateRes.profile.xp, 100);
  });

  it('FITUR 1: awards +150 XP for R² >= 0.95 and +300 XP for R² >= 0.99 with domain badges', () => {
    // R² < 0.95 yields 0 XP
    const lowRes = evaluateDataPrecisionXP(0.88, 'Fisika', 'mod-1');
    assert.strictEqual(lowRes.xpDelta, 0);

    // R² = 0.96 yields +150 XP and "Precision Analyst" + "Master Titrator" for Kimia
    const highRes = evaluateDataPrecisionXP(0.962, 'Kimia', 'acid-base-titration');
    assert.strictEqual(highRes.xpDelta, 150);
    assert.ok(highRes.profile.unlockedBadges.includes('Precision Analyst'));
    assert.ok(highRes.profile.unlockedBadges.includes('Master Titrator'));

    // R² = 0.995 yields +300 XP and "Kepler Navigator" for Astronomi
    const ultraRes = evaluateDataPrecisionXP(0.995, 'Astronomi', 'kepler-orbits');
    assert.strictEqual(ultraRes.xpDelta, 300);
    assert.strictEqual(ultraRes.profile.xp, 450);
    assert.ok(ultraRes.profile.unlockedBadges.includes('Kepler Navigator'));
    assert.strictEqual(calculateLevelFromXP(ultraRes.profile.xp), 2);
  });

  it('FITUR 1: awards +200 XP for perfect LKS & Quiz score (100) and checks catalog completeness', () => {
    const expectedBadges = [
      'K3 Guardian',
      'Precision Analyst',
      'Master Titrator',
      'Kepler Navigator',
      'Bio Explorer',
    ];
    const catalogIds = SCIENTIFIC_BADGES_CATALOG.map((b) => b.id);
    assert.deepStrictEqual(catalogIds, expectedBadges);

    const quizRes = recordPerfectLksQuiz(100, 'Biologi', 'cell-osmosis');
    assert.strictEqual(quizRes.xpDelta, 200);
    assert.ok(quizRes.profile.unlockedBadges.includes('Bio Explorer'));

    const progress = getLevelProgress(quizRes.profile.xp);
    assert.strictEqual(progress.level, 1);
    assert.strictEqual(progress.currentLevelXp, 200);
  });

  it('FITUR 3: records student slider and table interactions into telemetry timeline buffer', () => {
    const ev1 = recordTelemetryInteraction('inclineAngle', 25.4567, 1, {
      domain: 'Fisika',
      eventType: 'slider',
      force: true,
    });
    assert.ok(ev1);
    assert.strictEqual(ev1.parameterName, 'inclineAngle');
    assert.strictEqual(ev1.value, 25.457);
    assert.strictEqual(ev1.stepIndex, 1);

    recordTelemetryInteraction('appliedForce', 40, 2, {
      domain: 'Fisika',
      eventType: 'record',
      note: 'Sampel #1 dicatat',
      force: true,
    });
    recordTelemetryInteraction('regressionR2', 0.994, 3, {
      domain: 'Fisika',
      eventType: 'record',
      force: true,
    });

    const events = getRecordedTelemetryEvents();
    assert.strictEqual(events.length, 3);

    const timeline = buildSubmissionTelemetryTimeline('Fisika');
    assert.strictEqual(timeline.length, 3);
    assert.strictEqual(timeline[1].parameterName, 'appliedForce');
  });

  it('FITUR 5: exports Google Classroom compatible CSV with required standard columns', () => {
    const csv = exportGoogleClassroomCSV([
      {
        studentName: 'Budi Santoso',
        studentId: 'budi.santoso@sekolah.sch.id',
        moduleId: 'Titrasi Asam-Basa',
        domain: 'Kimia',
        quizScore: 100,
        teacherGrade: {
          score: 96,
          feedback: 'Titik ekuivalen sangat presisi dan analisis stoikiometri tepat.',
        },
      },
    ]);

    const lines = csv.split('\r\n');
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(
      lines[0],
      '"Student Name","Email/ID","Assignment Title","Score","Teacher Feedback"'
    );
    assert.strictEqual(
      lines[1],
      '"Budi Santoso","budi.santoso@sekolah.sch.id","Titrasi Asam-Basa (Kimia)","96","Titik ekuivalen sangat presisi dan analisis stoikiometri tepat."'
    );
  });
});
