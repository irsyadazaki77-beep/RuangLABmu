/**
 * Session Recovery & Auto-Save Engine
 * Provides persistent snapshot storage for students to recover in-progress lab experiments,
 * recorded observation trials, worksheet answers, and 3D parameters.
 */

import {
  ExperimentRecord,
  PhysicsParams,
  ChemistryParams,
  AstronomyParams,
} from './scienceEngine';
import { normalizeLegacyPhysicsParams } from './engines/physicsEngine';

export interface SavedLabSession {
  version: number;
  sequenceVersion?: number; // Monotonic sequence number for race-condition prevention
  savedAt: number; // Unix timestamp ms
  studentId: string;
  moduleId: string;
  activeWorkflowStep: 1 | 2 | 3 | 4;
  recordedTrials: ExperimentRecord[];
  lksAnswers: Record<string, string>;
  safetyPledgeAgreed: boolean;
  physicsParams?: PhysicsParams;
  chemistryParams?: ChemistryParams;
  astronomyParams?: AstronomyParams;
}

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getSessionStorageKey(studentId: string, moduleId: string): string {
  const safeStudent = (studentId || 'default_student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeModule = (moduleId || 'default_module').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ruanglab_session_${safeStudent}_${safeModule}`;
}

export function isSessionValid(session: unknown, maxAgeMs: number = SESSION_MAX_AGE_MS): session is SavedLabSession {
  if (!session || typeof session !== 'object') return false;
  const s = session as Partial<SavedLabSession>;

  if (typeof s.savedAt !== 'number' || typeof s.activeWorkflowStep !== 'number') {
    return false;
  }

  if (s.activeWorkflowStep < 1 || s.activeWorkflowStep > 4) {
    return false;
  }

  const age = Date.now() - s.savedAt;
  if (age < 0 || age > maxAgeMs) {
    return false;
  }

  if (!Array.isArray(s.recordedTrials)) {
    return false;
  }

  return true;
}

export function serializeSession(session: SavedLabSession): string {
  return JSON.stringify(session);
}

export function parseSession(rawJson: string, maxAgeMs: number = SESSION_MAX_AGE_MS): SavedLabSession | null {
  try {
    const parsed = JSON.parse(rawJson);
    if (isSessionValid(parsed, maxAgeMs)) {
      if (parsed.physicsParams && typeof parsed.physicsParams === 'object') {
        parsed.physicsParams = normalizeLegacyPhysicsParams(
          parsed.physicsParams as unknown as Record<string, unknown>
        );
      }
      return parsed;
    }
  } catch {
    // Malformed JSON
  }
  return null;
}

export function formatSessionTimestamp(savedAt: number): string {
  const date = new Date(savedAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `Hari ini pk ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr}, pk ${timeStr}`;
}
