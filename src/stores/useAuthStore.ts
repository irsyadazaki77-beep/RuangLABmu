import { create } from 'zustand';

export type ClientAuthRole = 'student' | 'teacher' | 'admin';

export interface ClientAuthSession {
  sub: string;
  role: ClientAuthRole;
  schoolId: string;
  displayName: string;
  roomId?: string;
  iat: number;
  exp: number;
}

interface AuthStoreState {
  // Stored strictly in JS/React memory (never persisted to localStorage/sessionStorage)
  token: string | null;
  session: ClientAuthSession | null;
  authPromptOpen: boolean;
  authPromptReason: string | null;
  setAuth: (token: string, session: ClientAuthSession) => void;
  clearAuth: () => void;
  openAuthPrompt: (reason?: string) => void;
  closeAuthPrompt: () => void;
  isTeacherAuthenticated: () => boolean;
}

const AUTH_SESSION_STORAGE_KEY = 'ruanglab_auth_session_v1';

function loadInitialAuth(): { token: string | null; session: ClientAuthSession | null } {
  if (typeof window === 'undefined') return { token: null, session: null };
  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return { token: null, session: null };
    const parsed = JSON.parse(raw) as { token?: string; session?: ClientAuthSession };
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      typeof parsed?.token === 'string' &&
      parsed.token &&
      parsed.session &&
      typeof parsed.session.exp === 'number' &&
      parsed.session.exp > nowSec
    ) {
      return { token: parsed.token, session: parsed.session };
    }
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage parse errors
  }
  return { token: null, session: null };
}

const initialAuth = loadInitialAuth();

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  token: initialAuth.token,
  session: initialAuth.session,
  authPromptOpen: false,
  authPromptReason: null,
  setAuth: (token, session) => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          AUTH_SESSION_STORAGE_KEY,
          JSON.stringify({ token, session })
        );
      }
    } catch {
      // Ignore storage quota errors
    }
    set({
      token,
      session,
      authPromptOpen: false,
      authPromptReason: null,
    });
  },
  clearAuth: () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    set({
      token: null,
      session: null,
    });
  },
  openAuthPrompt: (reason) =>
    set({
      authPromptOpen: true,
      authPromptReason: reason || null,
    }),
  closeAuthPrompt: () =>
    set({
      authPromptOpen: false,
      authPromptReason: null,
    }),
  isTeacherAuthenticated: () => {
    const { token, session } = get();
    if (!token || !session) return false;
    if (session.role !== 'teacher' && session.role !== 'admin') return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return session.exp > nowSec;
  },
}));
