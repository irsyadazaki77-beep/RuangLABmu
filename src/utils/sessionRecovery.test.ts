import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSessionStorageKey,
  isSessionValid,
  serializeSession,
  parseSession,
  SavedLabSession,
  SESSION_MAX_AGE_MS,
  formatSessionTimestamp,
} from './sessionRecovery';

test('SessionRecovery: generates safe deterministic storage keys', () => {
  const key1 = getSessionStorageKey('stu-1', 'newton-incline');
  assert.equal(key1, 'ruanglab_session_stu-1_newton-incline');

  const keySpecial = getSessionStorageKey('Alya Pratama (Kelompok 1)', 'fotosintesis/ingenhousz');
  assert.ok(!keySpecial.includes(' '));
  assert.ok(!keySpecial.includes('/'));
});

test('SessionRecovery: validates and parses sessions within 24h threshold', () => {
  const now = Date.now();
  const validSession: SavedLabSession = {
    version: 1,
    savedAt: now - 3600 * 1000, // 1 hour ago
    studentId: 'stu-1',
    moduleId: 'newton-incline',
    activeWorkflowStep: 2,
    recordedTrials: [
      {
        id: 'TRIAL-1',
        timestamp: '10:00:00',
        studentName: 'Alya',
        groupId: 'G1',
        domain: 'Fisika',
        experimentTitle: 'Newton',
        parametersSummary: 'm=4',
        keyMetrics: { a: '2.5' },
        notes: '',
      },
    ],
    lksAnswers: { q1: 'Percepatan linier terhadap gaya' },
    safetyPledgeAgreed: true,
  };

  assert.equal(isSessionValid(validSession), true);

  const json = serializeSession(validSession);
  const parsed = parseSession(json);
  assert.ok(parsed !== null);
  assert.equal(parsed?.activeWorkflowStep, 2);
  assert.equal(parsed?.recordedTrials.length, 1);
  assert.equal(parsed?.lksAnswers['q1'], 'Percepatan linier terhadap gaya');

  // Test expired session (> 24h)
  const expiredSession: SavedLabSession = {
    ...validSession,
    savedAt: now - (SESSION_MAX_AGE_MS + 10000),
  };
  assert.equal(isSessionValid(expiredSession), false);
  assert.equal(parseSession(serializeSession(expiredSession)), null);
});

test('SessionRecovery: formats user-friendly timestamp in Indonesian', () => {
  const now = Date.now();
  const formatted = formatSessionTimestamp(now);
  assert.ok(formatted.includes('Hari ini pk') || formatted.includes('pk'));
});
