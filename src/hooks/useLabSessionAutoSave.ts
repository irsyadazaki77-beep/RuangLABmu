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
          setRecoverableSession(parsed);
          setShowRecoveryBanner(true);
        }
      }
    } catch {
      // ignore localStorage errors
    }
    prevModuleRef.current = activeModuleId;
  }, [studentId, activeModuleId, isLobbyMode]);

  // Debounced auto-save on state mutation
  useEffect(() => {
    if (typeof window === 'undefined' || isLobbyMode || !activeModuleId) return;
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const storageKey = getSessionStorageKey(studentId, activeModuleId);
      const snapshot: SavedLabSession = {
        version: 1,
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

      try {
        window.localStorage.setItem(storageKey, serializeSession(snapshot));
        setLastSavedTimestamp(snapshot.savedAt);
      } catch {
        // quota exceeded or private mode
      }
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
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
    formattedRecoveryTime: recoverableSession
      ? formatSessionTimestamp(recoverableSession.savedAt)
      : '',
    restoreSession,
    discardAndRestart,
  };
}
