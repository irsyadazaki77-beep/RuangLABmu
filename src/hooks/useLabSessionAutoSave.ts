import { useEffect, useRef, useState, useCallback } from 'react';
import {
  SavedLabSession,
  getSessionStorageKey,
  parseSession,
  serializeSession,
  formatSessionTimestamp,
} from '../utils/sessionRecovery';
import {
  ExperimentRecord,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
} from '../utils/scienceEngine';

export interface AutoSaveSyncTicket {
  version: number;
  signal: AbortSignal;
  controller: AbortController;
}

/**
 * Coordinates monotonic version numbering and AbortController lifecycle
 * to prevent out-of-order async auto-save completions from overwriting newer state.
 */
export class AutoSaveVersionCoordinator {
  private versionCounter = 0;
  private committedVersion = 0;
  private activeController: AbortController | null = null;

  /**
   * Increments the monotonic sequence counter on state mutation and
   * immediately aborts any in-flight auto-save request.
   */
  public nextVersion(): AutoSaveSyncTicket {
    this.versionCounter += 1;
    if (this.activeController) {
      this.activeController.abort();
    }
    const controller = new AbortController();
    this.activeController = controller;
    return {
      version: this.versionCounter,
      signal: controller.signal,
      controller,
    };
  }

  /**
   * Returns true only if the given ticket version is still the latest
   * and its AbortSignal has not been aborted.
   */
  public canCommit(version: number, signal?: AbortSignal): boolean {
    if (signal?.aborted) return false;
    if (version < this.versionCounter) return false;
    if (version < this.committedVersion) return false;
    return true;
  }

  /**
   * Marks a version as committed if it is still valid.
   */
  public markCommitted(version: number, signal?: AbortSignal): boolean {
    if (!this.canCommit(version, signal)) {
      return false;
    }
    this.committedVersion = version;
    return true;
  }

  public getCurrentVersion(): number {
    return this.versionCounter;
  }

  public getCommittedVersion(): number {
    return this.committedVersion;
  }

  public abortActive(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }
}

interface UseLabSessionAutoSaveOptions {
  studentId: string;
  activeModuleId: string;
  activeWorkflowStep: 1 | 2 | 3 | 4;
  recordedTrials: ExperimentRecord[];
  lksAnswers: Record<string, string>;
  safetyPledgeAgreed: boolean;
  physicsParams?: PhysicsParams;
  chemistryParams?: ChemistryParams;
  astronomyParams?: AstronomyParams;
  isLobbyMode: boolean;
  onRestoreSession?: (session: SavedLabSession) => void;
}

export function useLabSessionAutoSave({
  studentId,
  activeModuleId,
  activeWorkflowStep,
  recordedTrials,
  lksAnswers,
  safetyPledgeAgreed,
  physicsParams,
  chemistryParams,
  astronomyParams,
  isLobbyMode,
  onRestoreSession,
}: UseLabSessionAutoSaveOptions) {
  const [recoverableSession, setRecoverableSession] = useState<SavedLabSession | null>(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState<boolean>(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingRef = useRef<boolean>(false);
  const prevModuleRef = useRef<string>(activeModuleId);

  // Monotonic sequence number and AbortController refs to prevent out-of-order state overwrite
  const versionCounterRef = useRef<number>(0);
  const committedVersionRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check for saved session whenever activeModuleId or studentId changes
  useEffect(() => {
    if (typeof window === 'undefined' || isLobbyMode || !activeModuleId) {
      setShowRecoveryBanner(false);
      setRecoverableSession(null);
      return;
    }

    const storageKey = getSessionStorageKey(studentId, activeModuleId);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = parseSession(raw);
        // Only prompt recovery if there is substantial state to restore (step > 1 or recorded data)
        if (
          parsed &&
          (parsed.activeWorkflowStep > 1 ||
            parsed.recordedTrials.length > 0 ||
            Object.keys(parsed.lksAnswers).length > 0)
        ) {
          if (typeof parsed.sequenceVersion === 'number') {
            versionCounterRef.current = Math.max(
              versionCounterRef.current,
              parsed.sequenceVersion
            );
            committedVersionRef.current = versionCounterRef.current;
          }
          setRecoverableSession(parsed);
          setShowRecoveryBanner(true);
        }
      }
    } catch {
      // ignore localStorage errors
    }
    prevModuleRef.current = activeModuleId;
  }, [studentId, activeModuleId, isLobbyMode]);

  // Debounced auto-save on state mutation with monotonic version counter & AbortController
  useEffect(() => {
    if (typeof window === 'undefined' || isLobbyMode || !activeModuleId) return;
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }

    // Increment monotonic sequence number on every state change
    versionCounterRef.current += 1;
    const currentSequenceVersion = versionCounterRef.current;

    // Cancel any in-flight HTTP/sync auto-save request from an older state version
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      // Guard against stale timer execution if a newer mutation already arrived
      if (
        currentSequenceVersion !== versionCounterRef.current ||
        currentSequenceVersion < committedVersionRef.current
      ) {
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      const storageKey = getSessionStorageKey(studentId, activeModuleId);
      const snapshot: SavedLabSession = {
        version: 1,
        sequenceVersion: currentSequenceVersion,
        savedAt: Date.now(),
        studentId,
        moduleId: activeModuleId,
        activeWorkflowStep,
        recordedTrials,
        lksAnswers,
        safetyPledgeAgreed,
        physicsParams,
        chemistryParams,
        astronomyParams,
      };

      // 1. Synchronous local persistence (guarded by version order)
      try {
        if (!signal.aborted && currentSequenceVersion >= committedVersionRef.current) {
          window.localStorage.setItem(storageKey, serializeSession(snapshot));
          committedVersionRef.current = currentSequenceVersion;
          setLastSavedTimestamp(snapshot.savedAt);
        }
      } catch {
        // quota exceeded or private mode
      }

      // 2. Asynchronous server-side session sync with AbortController cancellation
      const syncToBackend = async () => {
        try {
          const response = await fetch('/api/session/autosave', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...snapshot,
              version: currentSequenceVersion,
            }),
            signal,
          });

          // Prevent out-of-order response from overwriting newer state metadata
          if (
            signal.aborted ||
            currentSequenceVersion !== versionCounterRef.current ||
            currentSequenceVersion < committedVersionRef.current
          ) {
            return;
          }

          if (response.ok) {
            committedVersionRef.current = Math.max(
              committedVersionRef.current,
              currentSequenceVersion
            );
            setLastSavedTimestamp(snapshot.savedAt);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Expected cancellation when a newer state change supersedes this request
            return;
          }
          // Ignore transient offline errors; localStorage snapshot is already saved
        } finally {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      };

      void syncToBackend();
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [
    studentId,
    activeModuleId,
    activeWorkflowStep,
    recordedTrials,
    lksAnswers,
    safetyPledgeAgreed,
    physicsParams,
    chemistryParams,
    astronomyParams,
    isLobbyMode,
  ]);

  // User action: Restore previous session
  const restoreSession = useCallback(() => {
    if (!recoverableSession) return;
    isHydratingRef.current = true;
    onRestoreSession?.(recoverableSession);
    setShowRecoveryBanner(false);
  }, [recoverableSession, onRestoreSession]);

  // User action: Discard and restart fresh session
  const discardAndRestart = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (typeof window !== 'undefined' && activeModuleId) {
      const storageKey = getSessionStorageKey(studentId, activeModuleId);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
    setShowRecoveryBanner(false);
    setRecoverableSession(null);
  }, [studentId, activeModuleId]);

  return {
    recoverableSession,
    showRecoveryBanner,
    lastSavedTimestamp,
    currentVersion: versionCounterRef.current,
    formattedRecoveryTime: recoverableSession
      ? formatSessionTimestamp(recoverableSession.savedAt)
      : '',
    restoreSession,
    discardAndRestart,
  };
}
