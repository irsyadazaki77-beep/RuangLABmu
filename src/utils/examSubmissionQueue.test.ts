import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueuePendingExamSubmission,
  flushPendingExamSubmissions,
  loadPendingExamSubmissions,
  PENDING_EXAM_SUBMISSIONS_KEY,
  savePendingExamSubmissions,
  submitExamPayload,
} from './examSubmissionQueue';

function ensureWindowStorageMock() {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as Record<string, unknown>).window = {
    localStorage: mockLocalStorage,
  };
  return mockLocalStorage;
}

describe('Exam Submission Queue & Retry Handling', () => {
  beforeEach(() => {
    ensureWindowStorageMock();
    savePendingExamSubmissions([]);
  });

  it('queues failed exam payloads when fetch rejects or returns HTTP 500 and flushes cleanly upon recovery', async () => {
    const payload = {
      studentName: 'Alya Pratama',
      moduleId: 'newton-incline',
      submittedAt: '2026-11-14T01:10:00.000Z',
      quizScore: 92,
    };

    // 1. Network failure returns explicit error without swallowing
    const offlineOutcome = await submitExamPayload(payload, (async () => {
      throw new Error('Failed to fetch');
    }) as unknown as typeof fetch);
    assert.equal(offlineOutcome.ok, false);
    assert.match(offlineOutcome.error || '', /Failed to fetch/);

    const queued = enqueuePendingExamSubmission(payload, offlineOutcome.error || 'Offline');
    assert.equal(queued.length, 1);
    assert.equal(loadPendingExamSubmissions().length, 1);

    // 2. HTTP 503 during first retry keeps item queued and increments attempts
    const retryFail = await flushPendingExamSubmissions((async () =>
      new Response(JSON.stringify({ error: 'Service Unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch);
    assert.equal(retryFail.syncedCount, 0);
    assert.equal(retryFail.remainingCount, 1);
    assert.equal(retryFail.lastError, 'Service Unavailable');
    assert.equal(loadPendingExamSubmissions()[0].attempts, 2);

    // 3. Recovery HTTP 201 clears localStorage queue
    const retrySuccess = await flushPendingExamSubmissions((async () =>
      new Response(JSON.stringify({ success: true, ticketCode: 'SUB-RETRY-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch);
    assert.equal(retrySuccess.syncedCount, 1);
    assert.equal(retrySuccess.remainingCount, 0);
    assert.equal(retrySuccess.ticketCode, 'SUB-RETRY-1');
    assert.equal(loadPendingExamSubmissions().length, 0);
    assert.equal(
      (globalThis.window.localStorage.getItem(PENDING_EXAM_SUBMISSIONS_KEY)),
      null
    );
  });
});
