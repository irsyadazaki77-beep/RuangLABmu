export const PENDING_EXAM_SUBMISSIONS_KEY = 'ruanglab-pending-exam-submissions';
const EXAM_IDB_NAME = 'ruanglab-exam-offline-db';
const EXAM_IDB_STORE = 'pending_submissions';

export interface PendingExamSubmission {
  id: string;
  queuedAt: number;
  attempts: number;
  lastError: string;
  payload: Record<string, unknown>;
}

export interface ExamSubmitOutcome {
  ok: boolean;
  status?: number;
  ticketCode?: string;
  error?: string;
}

export interface ExamFlushSummary {
  syncedCount: number;
  remainingCount: number;
  lastError?: string;
  ticketCode?: string;
}

function createSubmissionQueueId(payload: Record<string, unknown>): string {
  const studentName =
    typeof payload.studentName === 'string' && payload.studentName.trim()
      ? payload.studentName.trim().toLowerCase().replace(/\s+/g, '-')
      : 'siswa';
  const moduleId =
    typeof payload.moduleId === 'string' && payload.moduleId.trim()
      ? payload.moduleId.trim()
      : 'module';
  const submittedAt =
    typeof payload.submittedAt === 'string' && payload.submittedAt.trim()
      ? payload.submittedAt.trim()
      : String(Date.now());
  return `exam-${studentName}-${moduleId}-${submittedAt}`;
}

async function mirrorPendingToIndexedDb(items: PendingExamSubmission[]): Promise<void> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return;
  try {
    await new Promise<void>((resolve) => {
      const req = window.indexedDB.open(EXAM_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(EXAM_IDB_STORE)) {
          db.createObjectStore(EXAM_IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(EXAM_IDB_STORE, 'readwrite');
          const store = tx.objectStore(EXAM_IDB_STORE);
          store.clear();
          for (const item of items) {
            store.put(item);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  } catch {
    // IndexedDB unavailable in private/sandboxed contexts
  }
}

export function loadPendingExamSubmissions(): PendingExamSubmission[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PENDING_EXAM_SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingExamSubmission =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as PendingExamSubmission).id === 'string' &&
        typeof (item as PendingExamSubmission).payload === 'object' &&
        (item as PendingExamSubmission).payload !== null
    );
  } catch {
    return [];
  }
}

export function savePendingExamSubmissions(items: PendingExamSubmission[]): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      if (items.length === 0) {
        window.localStorage.removeItem(PENDING_EXAM_SUBMISSIONS_KEY);
      } else {
        window.localStorage.setItem(PENDING_EXAM_SUBMISSIONS_KEY, JSON.stringify(items));
      }
    } catch {
      // Storage quota exceeded
    }
  }
  void mirrorPendingToIndexedDb(items);
}

export function enqueuePendingExamSubmission(
  payload: Record<string, unknown>,
  lastError: string
): PendingExamSubmission[] {
  const existing = loadPendingExamSubmissions();
  const id = createSubmissionQueueId(payload);
  const idx = existing.findIndex((item) => item.id === id);
  const nextEntry: PendingExamSubmission = {
    id,
    queuedAt: idx >= 0 ? existing[idx].queuedAt : Date.now(),
    attempts: idx >= 0 ? existing[idx].attempts + 1 : 1,
    lastError,
    payload,
  };
  const nextList =
    idx >= 0
      ? existing.map((item, i) => (i === idx ? nextEntry : item))
      : [...existing, nextEntry];
  savePendingExamSubmissions(nextList);
  return nextList;
}

export function removePendingExamSubmission(id: string): PendingExamSubmission[] {
  const nextList = loadPendingExamSubmissions().filter((item) => item.id !== id);
  savePendingExamSubmissions(nextList);
  return nextList;
}

export async function submitExamPayload(
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<ExamSubmitOutcome> {
  try {
    const response = await fetchImpl('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errMsg = `Server menolak pengumpulan ujian (HTTP ${response.status})`;
      try {
        const body = (await response.json()) as { error?: string; message?: string };
        if (body?.error || body?.message) {
          errMsg = String(body.error || body.message);
        }
      } catch {
        // Keep HTTP status message
      }
      return { ok: false, status: response.status, error: errMsg };
    }

    let ticketCode: string | undefined;
    try {
      const data = (await response.json()) as { ticketCode?: string };
      ticketCode = data?.ticketCode;
    } catch {
      // Response body optional
    }

    return { ok: true, status: response.status, ticketCode };
  } catch (err) {
    const msg =
      err instanceof Error && err.message
        ? err.message
        : 'Koneksi jaringan terputus saat mengirim jawaban ujian.';
    return { ok: false, error: msg };
  }
}

export async function flushPendingExamSubmissions(
  fetchImpl: typeof fetch = fetch
): Promise<ExamFlushSummary> {
  const queue = loadPendingExamSubmissions();
  if (queue.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;
  let lastError: string | undefined;
  let ticketCode: string | undefined;
  const remaining: PendingExamSubmission[] = [];

  for (const item of queue) {
    const result = await submitExamPayload(item.payload, fetchImpl);
    if (result.ok) {
      syncedCount += 1;
      ticketCode = result.ticketCode ?? ticketCode;
    } else {
      lastError = result.error || 'Gagal mengirim ulang jawaban ujian.';
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastError,
      });
    }
  }

  savePendingExamSubmissions(remaining);
  return {
    syncedCount,
    remainingCount: remaining.length,
    lastError,
    ticketCode,
  };
}
