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

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  token: null,
  session: null,
  authPromptOpen: false,
  authPromptReason: null,
  setAuth: (token, session) => {
    set({
      token,
      session,
      authPromptOpen: false,
      authPromptReason: null,
    });
  },
  clearAuth: () => {
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
