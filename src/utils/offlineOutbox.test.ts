import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BrowserOutboxStorage,
  DEFAULT_SCHOOL_ID,
  MemoryOutboxStorage,
  OUTBOX_LS_KEY,
  OUTBOX_MAX_BACKOFF_MS,
  OfflineOutboxManager,
  computeOutboxBackoffMs,
  formatOutboxSyncLabel,
  generateMutationUuid,
} from './offlineOutbox';

describe('offlineOutbox (Local-First IndexedDB / 3T Outbox)', () => {
  it('generates distinct RFC4122-v4 UUIDs and computes capped exponential backoff', () => {
    const a = generateMutationUuid();
    const b = generateMutationUuid();
    assert.notEqual(a, b);
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    assert.equal(computeOutboxBackoffMs(0), 1000);
    assert.equal(computeOutboxBackoffMs(1), 2000);
    assert.equal(computeOutboxBackoffMs(2), 4000);
    assert.equal(computeOutboxBackoffMs(10), OUTBOX_MAX_BACKOFF_MS);
  });

  it('deduplicates by clientMutationId and coalesces matching coalesceKey updates', async () => {
    const storage = new MemoryOutboxStorage();
    const manager = new OfflineOutboxManager({
      storage,
      isOnlineFn: () => false,
    });

    await manager.enqueue({
      endpoint: '/api/session/autosave',
      coalesceKey: 'autosave:pendulum',
      clientMutationId: 'mut-same-1',
      payload: { version: 1 },
      nowMs: 1000,
    });
    await manager.enqueue({
      endpoint: '/api/session/autosave',
      coalesceKey: 'autosave:pendulum',
      clientMutationId: 'mut-same-1',
      payload: { version: 2 },
      nowMs: 1100,
    });
    await manager.enqueue({
      endpoint: '/api/session/autosave',
      coalesceKey: 'autosave:pendulum',
      clientMutationId: 'mut-newer-2',
      payload: { version: 3 },
      nowMs: 1200,
    });
    await manager.enqueue({
      endpoint: '/api/submissions',
      clientMutationId: 'mut-sub-1',
      payload: { studentName: 'Alya' },
      nowMs: 1300,
    });

    const entries = await manager.listEntries();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].clientMutationId, 'mut-newer-2');
    assert.equal(entries[0].payload.version, 3);
    assert.equal(entries[0].schoolId, DEFAULT_SCHOOL_ID);
    assert.equal(entries[1].clientMutationId, 'mut-sub-1');
    assert.equal(manager.getSnapshot().label, 'Offline (2 antre)');
  });

  it('falls back cleanly to localStorage when IndexedDB is unavailable', async () => {
    const store = new Map<string, string>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    };

    try {
      const storage = new BrowserOutboxStorage();
      const manager = new OfflineOutboxManager({
        storage,
        isOnlineFn: () => false,
      });

      await manager.enqueue({
        endpoint: '/api/submissions',
        clientMutationId: 'ls-mut-1',
        payload: { studentName: 'Budi' },
      });

      assert.ok(store.has(OUTBOX_LS_KEY));
      const reloaded = new OfflineOutboxManager({
        storage: new BrowserOutboxStorage(),
        isOnlineFn: () => false,
      });
      const snap = await reloaded.hydrateCount();
      assert.equal(snap.pendingCount, 1);
      assert.equal(snap.label, 'Offline (1 antre)');
    } finally {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  });

  it('flushes queued mutations in FIFO order with X-Idempotency-Key and updates reactive status', async () => {
    let online = false;
    const storage = new MemoryOutboxStorage();
    const sentRequests: Array<{ url: string; idempotencyKey: string | null; body: Record<string, unknown> }> = [];

    const manager = new OfflineOutboxManager({
      storage,
      isOnlineFn: () => online,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        sentRequests.push({
          url: String(input),
          idempotencyKey: headers.get('X-Idempotency-Key'),
          body,
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const observedLabels: string[] = [];
    const unsubscribe = manager.subscribe((snap) => {
      observedLabels.push(snap.label);
    });

    await manager.enqueue({
      endpoint: '/api/session/autosave',
      clientMutationId: 'fifo-1',
      payload: { step: 1 },
      nowMs: 100,
    });
    await manager.enqueue({
      endpoint: '/api/submissions',
      clientMutationId: 'fifo-2',
      payload: { step: 2 },
      nowMs: 200,
    });

    // Should not flush while offline
    const offlineFlush = await manager.flush();
    assert.equal(offlineFlush.flushed, 0);
    assert.equal(offlineFlush.remaining, 2);

    // Reconnect and flush
    online = true;
    const onlineFlush = await manager.flush({ force: true });
    assert.equal(onlineFlush.flushed, 2);
    assert.equal(onlineFlush.remaining, 0);
    assert.deepEqual(
      sentRequests.map((r) => r.idempotencyKey),
      ['fifo-1', 'fifo-2']
    );
    assert.equal(sentRequests[0].body.schoolId, DEFAULT_SCHOOL_ID);
    assert.ok(observedLabels.includes('Offline (2 antre)'));
    assert.ok(observedLabels.includes('Menyinkronkan...'));
    assert.equal(observedLabels[observedLabels.length - 1], 'Tersinkronisasi');

    unsubscribe();
  });

  it('resolves HTTP 409 conflicts deterministically without infinite retries and respects transient 503 backoff', async () => {
    const storage = new MemoryOutboxStorage();
    let callCount = 0;

    const manager = new OfflineOutboxManager({
      storage,
      isOnlineFn: () => true,
      fetchImpl: async () => {
        callCount += 1;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'STALE_VERSION', latestVersion: 8 }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (callCount === 2) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'TEMP_DOWN' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await manager.enqueue({
      endpoint: '/api/session/autosave',
      clientMutationId: 'conflict-1',
      payload: { version: 3 },
      nowMs: 100,
    });
    await manager.enqueue({
      endpoint: '/api/submissions',
      clientMutationId: 'transient-503',
      payload: { studentName: 'Citra' },
      nowMs: 200,
    });

    const firstFlush = await manager.flush({
      nowMs: 1000,
      onConflict: (entry, body) => {
        const latest = (body as { latestVersion?: number })?.latestVersion ?? 0;
        return {
          action: 'retry-once',
          updatedPayload: { ...entry.payload, version: latest + 1 },
        };
      },
    });

    assert.equal(firstFlush.flushed, 1);
    assert.equal(firstFlush.conflictsResolved, 1);
    assert.equal(firstFlush.remaining, 1);

    // Verify 503 entry got exponential backoff nextRetryAt = 2000 and skips non-forced flush at t=1500
    const remainingEntries = await manager.listEntries();
    assert.equal(remainingEntries.length, 1);
    assert.equal(remainingEntries[0].retryCount, 1);
    assert.equal(remainingEntries[0].nextRetryAt, 2000);

    const skippedFlush = await manager.flush({ nowMs: 1500 });
    assert.equal(skippedFlush.flushed, 0);
    assert.equal(callCount, 3); // no extra network request fired during backoff window
    assert.equal(
      formatOutboxSyncLabel({ isOnline: true, pendingCount: 0, syncStatus: 'idle' }),
      'Tersinkronisasi'
    );
  });
});
