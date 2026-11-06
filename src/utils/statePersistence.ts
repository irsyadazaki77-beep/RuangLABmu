import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'ruanglab-state.json');
const TMP_FILE = path.join(DATA_DIR, 'ruanglab-state.json.tmp');

let saveTimeout: NodeJS.Timeout | null = null;
let pendingState: unknown = null;
let isWriting = false;

/**
 * Ensures the storage directory exists on disk.
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to ensure .data directory exists:', err);
  }
}

/**
 * Safely loads persisted server state from .data/ruanglab-state.json.
 * Returns fallback if the file doesn't exist, is empty, or corrupted.
 */
export async function loadPersistedState<T>(fallback: T): Promise<T> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    if (!content || !content.trim()) {
      return fallback;
    }
    const parsed = JSON.parse(content) as T;
    return parsed;
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error && error.code !== 'ENOENT') {
      console.warn('Warning: Could not read persisted state, using fallback:', error.message);
    }
    return fallback;
  }
}

/**
 * Performs an atomic write using a temporary file and atomic rename.
 */
async function performAtomicWrite(data: unknown): Promise<void> {
  if (isWriting) return;
  isWriting = true;
  try {
    await ensureDataDir();
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(TMP_FILE, jsonString, 'utf-8');
    await fs.rename(TMP_FILE, STATE_FILE);
  } catch (err) {
    console.error('Error during atomic state persistence:', err);
  } finally {
    isWriting = false;
  }
}

/**
 * Schedules a state save with a 500ms debounce timer to prevent disk I/O thrashing
 * while guaranteeing atomic disk writes via .tmp + rename.
 */
export function scheduleSaveState<T>(state: T): void {
  pendingState = state;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    if (pendingState !== null) {
      const stateToPersist = pendingState;
      pendingState = null;
      performAtomicWrite(stateToPersist).catch((err) => {
        console.error('Failed to execute debounced state save:', err);
      });
    }
  }, 500);
}

/**
 * Immediately flushes any pending state to disk (e.g., on server shutdown).
 */
export async function flushSaveStateNow<T>(state?: T): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  const toSave = state ?? pendingState;
  if (toSave !== null && toSave !== undefined) {
    pendingState = null;
    await performAtomicWrite(toSave);
  }
}
