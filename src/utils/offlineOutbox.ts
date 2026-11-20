import { useEffect, useState } from 'react';

export const DEFAULT_SCHOOL_ID = 'default-school';
export const OUTBOX_DB_NAME = 'ruanglab-offline-outbox-db';
export const OUTBOX_DB_VERSION = 1;
export const OUTBOX_STORE_NAME = 'mutations';
export const OUTBOX_LS_KEY = 'ruanglab-offline-outbox-v1';
export const OUTBOX_MAX_ENTRIES = 250;
export const OUTBOX_BASE_BACKOFF_MS = 1000;
export const OUTBOX_MAX_BACKOFF_MS = 60_000;

export type OutboxSyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface OfflineOutboxEntry {
  id: string;
  clientMutationId: string;
  coalesceKey?: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT';
  payload: Record<string, unknown>;
  schoolId: string;
  headers?: Record<string, string>;
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
}

export interface EnqueueOutboxInput {
  id?: string;
  clientMutationId?: string;
  coalesceKey?: string;
  endpoint: string;
  method?: 'POST' | 'PATCH' | 'PUT';
  payload: Record<string, unknown>;
  schoolId?: string;
  headers?: Record<string, string>;
  nowMs?: number;
}

export interface OutboxStatusSnapshot {
  pendingCount: number;
  syncStatus: OutboxSyncState;
  isOnline: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  conflictCount: number;
  label: string;
}

export interface OutboxFlushResult {
  flushed: number;
  conflictsResolved: number;
  droppedPermanent: number;
  remaining: number;
}

export interface OutboxStorageAdapter {
  readAll: () => Promise<OfflineOutboxEntry[]>;
  writeAll: (entries: OfflineOutboxEntry[]) => Promise<void>;
}

export type OutboxConflictResolution =
  | { action: 'drop' }
  | { action: 'retry-once'; updatedPayload: Record<string, unknown> };

export interface FlushOutboxOptions {
  force?: boolean;
  nowMs?: number;
  onConflict?: (
    entry: OfflineOutboxEntry,
    serverBody: unknown
  ) => OutboxConflictResolution | void | Promise<OutboxConflictResolution | void>;
}

/**
 * Generates a collision-resistant UUID v4 string without requiring external dependencies.
 */
export function generateMutationUuid(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Computes capped exponential backoff in ms for queued HTTP mutations.
 */
export function computeOutboxBackoffMs(retryCount: number): number {
  const safeRetry = Number.isFinite(retryCount) ? Math.max(0, Math.floor(retryCount)) : 0;
  return Math.min(OUTBOX_MAX_BACKOFF_MS, OUTBOX_BASE_BACKOFF_MS * Math.pow(2, safeRetry));
}

export function formatOutboxSyncLabel(params: {
  isOnline: boolean;
  pendingCount: number;
  syncStatus: OutboxSyncState;
}): string {
  if (!params.isOnline) {
    return params.pendingCount > 0
      ? `Offline (${params.pendingCount} antre)`
      : 'Offline (0 antre)';
  }
  if (params.syncStatus === 'syncing') {
    return 'Menyinkronkan...';
  }
  if (params.pendingCount > 0) {
    return `Offline (${params.pendingCount} antre)`;
  }
  return 'Tersinkronisasi';
}

function isBrowserNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function normalizeOutboxEntries(raw: unknown): OfflineOutboxEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: OfflineOutboxEntry[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as OfflineOutboxEntry).id === 'string' &&
      typeof (item as OfflineOutboxEntry).clientMutationId === 'string' &&
      typeof (item as OfflineOutboxEntry).endpoint === 'string' &&
      typeof (item as OfflineOutboxEntry).payload === 'object' &&
      (item as OfflineOutboxEntry).payload !== null
    ) {
      const entry = item as OfflineOutboxEntry;
      valid.push({
        id: entry.id,
        clientMutationId: entry.clientMutationId,
        coalesceKey: typeof entry.coalesceKey === 'string' ? entry.coalesceKey : undefined,
        endpoint: entry.endpoint,
        method: entry.method === 'PATCH' || entry.method === 'PUT' ? entry.method : 'POST',
        payload: entry.payload,
        schoolId: typeof entry.schoolId === 'string' && entry.schoolId.trim() ? entry.schoolId : DEFAULT_SCHOOL_ID,
        headers: entry.headers,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
        retryCount: typeof entry.retryCount === 'number' ? Math.max(0, entry.retryCount) : 0,
        nextRetryAt: typeof entry.nextRetryAt === 'number' ? entry.nextRetryAt : 0,
        lastError: typeof entry.lastError === 'string' ? entry.lastError : undefined,
      });
    }
  }
  valid.sort((a, b) => a.createdAt - b.createdAt);
  return valid;
}

function readLocalStorageFallback(): OfflineOutboxEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(OUTBOX_LS_KEY);
    if (!raw) return [];
    return normalizeOutboxEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeLocalStorageFallback(entries: OfflineOutboxEntry[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (entries.length === 0) {
      window.localStorage.removeItem(OUTBOX_LS_KEY);
    } else {
      window.localStorage.setItem(OUTBOX_LS_KEY, JSON.stringify(entries));
    }
  } catch {
    // ignore quota errors in private mode
  }
}

function openOutboxIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(OUTBOX_DB_NAME, OUTBOX_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE_NAME)) {
        db.createObjectStore(OUTBOX_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export class BrowserOutboxStorage implements OutboxStorageAdapter {
  private memoryCache: OfflineOutboxEntry[] | null = null;

  public async readAll(): Promise<OfflineOutboxEntry[]> {
    if (typeof indexedDB !== 'undefined') {
      try {
        const db = await openOutboxIndexedDb();
        const items = await new Promise<OfflineOutboxEntry[]>((resolve, reject) => {
          const tx = db.transaction(OUTBOX_STORE_NAME, 'readonly');
          const store = tx.objectStore(OUTBOX_STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(normalizeOutboxEntries(req.result));
          req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
          tx.oncomplete = () => db.close();
          tx.onerror = () => db.close();
        });
        this.memoryCache = items;
        return items;
      } catch {
        // Fallback below
      }
    }

    const lsItems = readLocalStorageFallback();
    if (lsItems.length > 0) {
      this.memoryCache = lsItems;
      return [...lsItems];
    }
    return this.memoryCache ? [...this.memoryCache] : [];
  }

  public async writeAll(entries: OfflineOutboxEntry[]): Promise<void> {
    const normalized = normalizeOutboxEntries(entries);
    this.memoryCache = normalized;
    writeLocalStorageFallback(normalized);

    if (typeof indexedDB !== 'undefined') {
      try {
        const db = await openOutboxIndexedDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(OUTBOX_STORE_NAME, 'readwrite');
          const store = tx.objectStore(OUTBOX_STORE_NAME);
          store.clear();
          for (const entry of normalized) {
            store.put(entry);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error('IndexedDB write failed'));
          };
        });
      } catch {
        // localStorage + memoryCache already updated
      }
    }
  }
}

export class MemoryOutboxStorage implements OutboxStorageAdapter {
  private entries: OfflineOutboxEntry[] = [];

  public async readAll(): Promise<OfflineOutboxEntry[]> {
    return [...this.entries];
  }

  public async writeAll(entries: OfflineOutboxEntry[]): Promise<void> {
    this.entries = normalizeOutboxEntries(entries);
  }
}

export class OfflineOutboxManager {
  private readonly storage: OutboxStorageAdapter;
  private readonly fetchImpl: typeof fetch;
  private readonly onlineCheck: () => boolean;
  private readonly listeners = new Set<(snapshot: OutboxStatusSnapshot) => void>();
  private inFlightFlush: Promise<OutboxFlushResult> | null = null;
  private snapshot: OutboxStatusSnapshot;

  constructor(options?: {
    storage?: OutboxStorageAdapter;
    fetchImpl?: typeof fetch;
    isOnlineFn?: () => boolean;
  }) {
    this.storage = options?.storage ?? new BrowserOutboxStorage();
    this.fetchImpl = options?.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.onlineCheck = options?.isOnlineFn ?? isBrowserNavigatorOnline;
    const online = this.onlineCheck();
    this.snapshot = {
      pendingCount: 0,
      syncStatus: online ? 'idle' : 'offline',
      isOnline: online,
      lastSyncedAt: null,
      lastError: null,
      conflictCount: 0,
      label: formatOutboxSyncLabel({
        isOnline: online,
        pendingCount: 0,
        syncStatus: online ? 'idle' : 'offline',
      }),
    };
  }

  private updateSnapshot(partial: Partial<OutboxStatusSnapshot>): void {
    const isOnline = partial.isOnline ?? this.onlineCheck();
    const pendingCount = partial.pendingCount ?? this.snapshot.pendingCount;
    const syncStatus: OutboxSyncState = !isOnline
      ? 'offline'
      : partial.syncStatus ?? this.snapshot.syncStatus;

    this.snapshot = {
      ...this.snapshot,
      ...partial,
      isOnline,
      pendingCount,
      syncStatus,
      label: formatOutboxSyncLabel({
        isOnline,
        pendingCount,
        syncStatus,
      }),
    };

    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  public getSnapshot(): OutboxStatusSnapshot {
    const isOnline = this.onlineCheck();
    if (isOnline !== this.snapshot.isOnline) {
      const nextStatus: OutboxSyncState = !isOnline
        ? 'offline'
        : this.snapshot.syncStatus === 'offline'
        ? 'idle'
        : this.snapshot.syncStatus;
      this.snapshot = {
        ...this.snapshot,
        isOnline,
        syncStatus: nextStatus,
        label: formatOutboxSyncLabel({
          isOnline,
          pendingCount: this.snapshot.pendingCount,
          syncStatus: nextStatus,
        }),
      };
    }
    return this.snapshot;
  }

  public subscribe(listener: (snapshot: OutboxStatusSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async hydrateCount(): Promise<OutboxStatusSnapshot> {
    const entries = await this.storage.readAll();
    const online = this.onlineCheck();
    this.updateSnapshot({
      pendingCount: entries.length,
      isOnline: online,
      syncStatus: online ? (this.inFlightFlush ? 'syncing' : 'idle') : 'offline',
    });
    return this.snapshot;
  }

  public async listEntries(): Promise<OfflineOutboxEntry[]> {
    return this.storage.readAll();
  }

  public async enqueue(input: EnqueueOutboxInput): Promise<OfflineOutboxEntry> {
    const nowMs = input.nowMs ?? Date.now();
    const clientMutationId = input.clientMutationId?.trim() || generateMutationUuid();
    const schoolId = input.schoolId?.trim() || DEFAULT_SCHOOL_ID;
    const method = input.method ?? 'POST';

    const existing = await this.storage.readAll();

    // Deduplicate identical clientMutationId
    const withoutSameId = existing.filter((e) => e.clientMutationId !== clientMutationId);

    // Coalesce latest snapshot for matching coalesceKey (e.g. autosave per storageKey)
    const filtered = input.coalesceKey
      ? withoutSameId.filter((e) => e.coalesceKey !== input.coalesceKey)
      : withoutSameId;

    const entry: OfflineOutboxEntry = {
      id: input.id?.trim() || clientMutationId,
      clientMutationId,
      coalesceKey: input.coalesceKey,
      endpoint: input.endpoint,
      method,
      payload: {
        ...input.payload,
        schoolId,
        clientMutationId,
      },
      schoolId,
      headers: input.headers,
      createdAt: nowMs,
      retryCount: 0,
      nextRetryAt: 0,
    };

    const nextEntries = [...filtered, entry];
    while (nextEntries.length > OUTBOX_MAX_ENTRIES) {
      nextEntries.shift();
    }

    await this.storage.writeAll(nextEntries);
    const online = this.onlineCheck();
    this.updateSnapshot({
      pendingCount: nextEntries.length,
      isOnline: online,
      syncStatus: online ? (this.inFlightFlush ? 'syncing' : 'idle') : 'offline',
    });
    return entry;
  }

  public async clear(): Promise<void> {
    await this.storage.writeAll([]);
    const online = this.onlineCheck();
    this.updateSnapshot({
      pendingCount: 0,
      isOnline: online,
      syncStatus: online ? 'idle' : 'offline',
      lastError: null,
    });
  }

  public async flush(options?: FlushOutboxOptions): Promise<OutboxFlushResult> {
    if (this.inFlightFlush) {
      return this.inFlightFlush;
    }

    const runner = this.executeFlush(options);
    this.inFlightFlush = runner;
    try {
      return await runner;
    } finally {
      this.inFlightFlush = null;
    }
  }

  private async executeFlush(options?: FlushOutboxOptions): Promise<OutboxFlushResult> {
    const entries = await this.storage.readAll();
    const online = this.onlineCheck();

    if (!online) {
      this.updateSnapshot({
        pendingCount: entries.length,
        isOnline: false,
        syncStatus: 'offline',
      });
      return {
        flushed: 0,
        conflictsResolved: 0,
        droppedPermanent: 0,
        remaining: entries.length,
      };
    }

    if (entries.length === 0) {
      this.updateSnapshot({
        pendingCount: 0,
        isOnline: true,
        syncStatus: 'idle',
      });
      return {
        flushed: 0,
        conflictsResolved: 0,
        droppedPermanent: 0,
        remaining: 0,
      };
    }

    this.updateSnapshot({
      pendingCount: entries.length,
      isOnline: true,
      syncStatus: 'syncing',
      lastError: null,
    });

    const nowMs = options?.nowMs ?? Date.now();
    const remaining: OfflineOutboxEntry[] = [];
    let flushed = 0;
    let conflictsResolved = 0;
    let droppedPermanent = 0;
    let abortedDueToConnectivity = false;
    let lastError: string | null = null;

    for (let idx = 0; idx < entries.length; idx += 1) {
      const entry = entries[idx];

      if (abortedDueToConnectivity) {
        remaining.push(entry);
        continue;
      }

      if (!options?.force && entry.nextRetryAt > nowMs) {
        remaining.push(entry);
        continue;
      }

      const sendMutation = async (
        targetEntry: OfflineOutboxEntry
      ): Promise<Response> => {
        return this.fetchImpl(targetEntry.endpoint, {
          method: targetEntry.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': targetEntry.clientMutationId,
            ...(targetEntry.headers ?? {}),
          },
          body: JSON.stringify({
            ...targetEntry.payload,
            schoolId: targetEntry.schoolId,
            clientMutationId: targetEntry.clientMutationId,
          }),
        });
      };

      try {
        const res = await sendMutation(entry);

        if (res.ok) {
          flushed += 1;
          continue;
        }

        // Deterministic HTTP 409 Conflict resolution: never infinite-loop
        if (res.status === 409) {
          const conflictBody = await res.json().catch(() => null);
          const resolution = await options?.onConflict?.(entry, conflictBody);
          if (resolution && resolution.action === 'retry-once') {
            const replacementId = generateMutationUuid();
            const retryRes = await sendMutation({
              ...entry,
              clientMutationId: replacementId,
              payload: resolution.updatedPayload,
            });
            if (retryRes.ok) {
              flushed += 1;
              conflictsResolved += 1;
              continue;
            }
          }
          // Drop stale mutation deterministically after handling conflict once
          conflictsResolved += 1;
          continue;
        }

        // Non-retryable client validation/auth errors
        if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 422) {
          droppedPermanent += 1;
          lastError = `HTTP ${res.status}`;
          continue;
        }

        // Transient 5xx or 429: increment backoff & preserve order
        const nextRetryCount = entry.retryCount + 1;
        const backoffMs = computeOutboxBackoffMs(entry.retryCount);
        lastError = `HTTP ${res.status}`;
        remaining.push({
          ...entry,
          retryCount: nextRetryCount,
          nextRetryAt: nowMs + backoffMs,
          lastError,
        });
        abortedDueToConnectivity = true;
      } catch (err) {
        const nextRetryCount = entry.retryCount + 1;
        const backoffMs = computeOutboxBackoffMs(entry.retryCount);
        lastError = err instanceof Error ? err.message : 'Network error';
        remaining.push({
          ...entry,
          retryCount: nextRetryCount,
          nextRetryAt: nowMs + backoffMs,
          lastError,
        });
        abortedDueToConnectivity = true;
      }
    }

    await this.storage.writeAll(remaining);
    const stillOnline = this.onlineCheck();
    const nextStatus: OutboxSyncState = !stillOnline
      ? 'offline'
      : lastError && remaining.length > 0
      ? 'error'
      : 'idle';

    this.updateSnapshot({
      pendingCount: remaining.length,
      isOnline: stillOnline,
      syncStatus: nextStatus,
      lastSyncedAt: flushed > 0 ? Date.now() : this.snapshot.lastSyncedAt,
      lastError,
      conflictCount: this.snapshot.conflictCount + conflictsResolved,
    });

    return {
      flushed,
      conflictsResolved,
      droppedPermanent,
      remaining: remaining.length,
    };
  }
}

export const offlineOutbox = new OfflineOutboxManager();

let listenersInitialized = false;
function ensureBrowserListeners(): void {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;
  void offlineOutbox.hydrateCount();
  window.addEventListener('online', () => {
    void offlineOutbox.flush({ force: true });
  });
  window.addEventListener('offline', () => {
    void offlineOutbox.hydrateCount();
  });
}

export function enqueueOutboxMutation(input: EnqueueOutboxInput): Promise<OfflineOutboxEntry> {
  ensureBrowserListeners();
  return offlineOutbox.enqueue(input);
}

export function flushOfflineOutbox(options?: FlushOutboxOptions): Promise<OutboxFlushResult> {
  ensureBrowserListeners();
  return offlineOutbox.flush(options);
}

export function getOutboxSnapshot(): OutboxStatusSnapshot {
  ensureBrowserListeners();
  return offlineOutbox.getSnapshot();
}

export function subscribeOutbox(
  listener: (snapshot: OutboxStatusSnapshot) => void
): () => void {
  ensureBrowserListeners();
  return offlineOutbox.subscribe(listener);
}

export function useOfflineOutboxStatus(): OutboxStatusSnapshot {
  const [status, setStatus] = useState<OutboxStatusSnapshot>(() => getOutboxSnapshot());

  useEffect(() => {
    ensureBrowserListeners();
    void offlineOutbox.hydrateCount();
    return subscribeOutbox(setStatus);
  }, []);

  return status;
}
