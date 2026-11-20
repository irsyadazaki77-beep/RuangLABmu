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
import {
  DEFAULT_SCHOOL_ID,
  enqueueOutboxMutation,
  flushOfflineOutbox,
  generateMutationUuid,
} from '../utils/offlineOutbox';

export interface AutoSaveSyncTicket {
  version: number;
  signal: AbortSignal;
  controller: AbortController;
}

/**
 * Resolves the next deterministic monotonic sequence version after an HTTP 409 conflict,
 * guaranteeing the retry advances strictly past both local and server-reported versions.
 */
export function resolveAutosaveConflictNextVersion(
  localVersion: number,
  serverLatestVersion?: number
): number {
  const safeLocal = Number.isFinite(localVersion) ? Math.max(0, Math.floor(localVersion)) : 0;
  const safeServer =
    typeof serverLatestVersion === 'number' && Number.isFinite(serverLatestVersion)
      ? Math.max(0, Math.floor(serverLatestVersion))
      : 0;
  return Math.max(safeLocal, safeServer) + 1;
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
  const isMountedRef = useRef<boolean>(true);
  const lastSavedDigestRef = useRef<string>('');
  const rejectedRemoteKeysRef = useRef<Set<string>>(new Set());
  const pendingOfflineSyncRef = useRef<{
    remoteStorageKey: string;
    remoteStudentId: string;
    version: number;
    snapshot: SavedLabSession;
  } | null>(null);

  const getOrCreateSessionToken = useCallback((): string => {
    try {
      const tokenKey = 'ruanglab_session_owner_token_v1';
      const existingToken = window.localStorage.getItem(tokenKey);
      if (existingToken && existingToken.trim().length >= 8) {
        return existingToken.trim();
      }
      const generated =
        typeof window.crypto !== 'undefined' &&
        typeof window.crypto.randomUUID === 'function'
          ? `st-${window.crypto.randomUUID()}`
          : `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(tokenKey, generated);
      return generated;
    } catch {
      return `st-fallback-${studentId}`;
    }
  }, [studentId]);

  const buildRemoteScope = useCallback(
    (sessionToken: string) => {
      const cleanTokenSuffix = sessionToken.replace(/[^a-zA-Z0-9_-]/g, '').slice(-16) || 'local';
      const remoteStudentId = `${studentId}__${cleanTokenSuffix}`;
      const remoteStorageKey = getSessionStorageKey(remoteStudentId, activeModuleId);
      return { remoteStudentId, remoteStorageKey };
    },
    [studentId, activeModuleId]
  );

  const postAutosaveWithConflictRecovery = useCallback(
    async (
      localStorageKey: string,
      remoteStorageKey: string,
      remoteStudentId: string,
      initialVersion: number,
      initialSnapshot: SavedLabSession,
      signal: AbortSignal
    ): Promise<void> => {
      if (rejectedRemoteKeysRef.current.has(remoteStorageKey)) {
        return;
      }

      const sessionToken = getOrCreateSessionToken();

      const enqueueAutosaveToOutbox = async (
        targetVersion: number,
        targetSnapshot: SavedLabSession
      ) => {
        pendingOfflineSyncRef.current = {
          remoteStorageKey,
          remoteStudentId,
          version: targetVersion,
          snapshot: targetSnapshot,
        };
        await enqueueOutboxMutation({
          endpoint: '/api/session/autosave',
          method: 'POST',
          coalesceKey: `autosave:${remoteStorageKey}`,
          schoolId: DEFAULT_SCHOOL_ID,
          headers: {
            'X-Session-Token': sessionToken,
          },
          payload: {
            storageKey: remoteStorageKey,
            version: targetVersion,
            sessionToken,
            studentId: remoteStudentId,
            session: {
              ...targetSnapshot,
              studentId: remoteStudentId,
            },
          },
        }).catch(() => undefined);
      };

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueueAutosaveToOutbox(initialVersion, initialSnapshot);
        return;
      }

      let targetVersion = initialVersion;
      let targetSnapshot = initialSnapshot;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (signal.aborted || !isMountedRef.current) return;

        const clientMutationId = generateMutationUuid();
        const response = await fetch('/api/session/autosave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken,
            'X-Idempotency-Key': clientMutationId,
          },
          body: JSON.stringify({
            storageKey: remoteStorageKey,
            version: targetVersion,
            sessionToken,
            studentId: remoteStudentId,
            schoolId: DEFAULT_SCHOOL_ID,
            clientMutationId,
            session: {
              ...targetSnapshot,
              studentId: remoteStudentId,
            },
          }),
          signal,
        });

        if (response.status === 409) {
          const conflictData = (await response.json().catch(() => null)) as {
            latestVersion?: number;
          } | null;
          if (attempt === 0 && !signal.aborted && isMountedRef.current) {
            const nextVersion = resolveAutosaveConflictNextVersion(
              Math.max(versionCounterRef.current, targetVersion),
              conflictData?.latestVersion
            );
            versionCounterRef.current = nextVersion;
            targetVersion = nextVersion;
            targetSnapshot = {
              ...targetSnapshot,
              sequenceVersion: nextVersion,
              savedAt: Date.now(),
            };
            try {
              window.localStorage.setItem(localStorageKey, serializeSession(targetSnapshot));
            } catch {
              // quota exceeded or private mode
            }
            continue;
          }
          if (conflictData && typeof conflictData.latestVersion === 'number') {
            versionCounterRef.current = Math.max(
              versionCounterRef.current,
              conflictData.latestVersion
            );
          }
          return;
        }

        if (
          signal.aborted ||
          !isMountedRef.current ||
          targetVersion < versionCounterRef.current ||
          targetVersion < committedVersionRef.current
        ) {
          return;
        }

        if (response.status === 403 || response.status === 400) {
          rejectedRemoteKeysRef.current.add(remoteStorageKey);
          pendingOfflineSyncRef.current = null;
          return;
        }

        if (response.ok) {
          pendingOfflineSyncRef.current = null;
          committedVersionRef.current = Math.max(committedVersionRef.current, targetVersion);
          setLastSavedTimestamp(targetSnapshot.savedAt);
        } else if (response.status >= 500 || response.status === 429) {
          await enqueueAutosaveToOutbox(targetVersion, targetSnapshot);
        }
        return;
      }
    },
    [getOrCreateSessionToken]
  );

  // Track mount status & flush queued IndexedDB outbox mutations once connectivity returns
  useEffect(() => {
    isMountedRef.current = true;
    const handleOnline = () => {
      if (!isMountedRef.current || isLobbyMode) return;
      void flushOfflineOutbox({
        force: true,
        onConflict: (entry, serverBody) => {
          const bodyObj =
            typeof serverBody === 'object' && serverBody !== null
              ? (serverBody as { latestVersion?: number })
              : null;
          if (entry.endpoint === '/api/session/autosave' && typeof bodyObj?.latestVersion === 'number') {
            const localVer =
              typeof entry.payload.version === 'number' ? entry.payload.version : 0;
            const nextVersion = resolveAutosaveConflictNextVersion(
              Math.max(versionCounterRef.current, localVer),
              bodyObj.latestVersion
            );
            versionCounterRef.current = nextVersion;
            const rawSession =
              typeof entry.payload.session === 'object' && entry.payload.session !== null
                ? (entry.payload.session as Record<string, unknown>)
                : {};
            return {
              action: 'retry-once',
              updatedPayload: {
                ...entry.payload,
                version: nextVersion,
                session: {
                  ...rawSession,
                  sequenceVersion: nextVersion,
                  savedAt: Date.now(),
                },
              },
            };
          }
          return { action: 'drop' };
        },
      })
        .then((res) => {
          if (res.flushed > 0 && isMountedRef.current) {
            pendingOfflineSyncRef.current = null;
            setLastSavedTimestamp(Date.now());
          }
        })
        .catch(() => {
          // Wait for next online event without retry storms
        });
    };

    window.addEventListener('online', handleOnline);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [activeModuleId, isLobbyMode, postAutosaveWithConflictRecovery, studentId]);

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

    const digest = JSON.stringify({
      studentId,
      activeModuleId,
      activeWorkflowStep,
      recordedTrials,
      lksAnswers,
      safetyPledgeAgreed,
      physicsParams,
      chemistryParams,
      astronomyParams,
    });
    if (digest === lastSavedDigestRef.current) {
      return;
    }
    lastSavedDigestRef.current = digest;

    // Increment monotonic sequence number on every genuine state change
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
        !isMountedRef.current ||
        currentSequenceVersion !== versionCounterRef.current ||
        currentSequenceVersion < committedVersionRef.current
      ) {
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      const localStorageKey = getSessionStorageKey(studentId, activeModuleId);
      const sessionToken = getOrCreateSessionToken();
      const { remoteStudentId, remoteStorageKey } = buildRemoteScope(sessionToken);

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
          window.localStorage.setItem(localStorageKey, serializeSession(snapshot));
          committedVersionRef.current = currentSequenceVersion;
          lastSavedDigestRef.current = digest;
          setLastSavedTimestamp(snapshot.savedAt);
        }
      } catch {
        // quota exceeded or private mode
      }

      // 2. Asynchronous server-side session sync with AbortController & 409 recovery
      const syncToBackend = async () => {
        try {
          await postAutosaveWithConflictRecovery(
            localStorageKey,
            remoteStorageKey,
            remoteStudentId,
            currentSequenceVersion,
            snapshot,
            signal
          );
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          pendingOfflineSyncRef.current = {
            remoteStorageKey,
            remoteStudentId,
            version: currentSequenceVersion,
            snapshot,
          };
          await enqueueOutboxMutation({
            endpoint: '/api/session/autosave',
            method: 'POST',
            coalesceKey: `autosave:${remoteStorageKey}`,
            schoolId: DEFAULT_SCHOOL_ID,
            headers: {
              'X-Session-Token': sessionToken,
            },
            payload: {
              storageKey: remoteStorageKey,
              version: currentSequenceVersion,
              sessionToken,
              studentId: remoteStudentId,
              session: {
                ...snapshot,
                studentId: remoteStudentId,
              },
            },
          }).catch(() => undefined);
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
    buildRemoteScope,
    getOrCreateSessionToken,
    postAutosaveWithConflictRecovery,
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

export { useLabSessionAutoSave as useLabAutoSave };
export default useLabSessionAutoSave;

