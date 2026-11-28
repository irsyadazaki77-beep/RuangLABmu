import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { ensureClientSession } from '../utils/apiClient';

export interface PersistentAuthStatus {
  isAuthenticated: boolean;
  role: 'student' | 'teacher' | 'admin' | null;
  displayName: string | null;
  schoolId: string | null;
  checking: boolean;
}

/**
 * Verifies or silently provisions a valid in-memory Bearer session with `/api/auth/me`
 * without breaking offline/standalone 3T usage when the backend is unreachable.
 */
export function usePersistentAuth(): PersistentAuthStatus {
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;

    const verifyOrInit = async () => {
      setChecking(true);
      try {
        if (token) {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = (await res.json()) as { ok?: boolean; session?: typeof session };
            if (active && body?.session) {
              setAuth(token, body.session);
            }
          } else if (res.status === 401 && active) {
            clearAuth();
            await ensureClientSession();
          }
        } else {
          await ensureClientSession();
        }
      } catch {
        // Offline 3T resilience: keep local experience working without blocking
      } finally {
        if (active) setChecking(false);
      }
    };

    void verifyOrInit();
    return () => {
      active = false;
    };
  }, [token, setAuth, clearAuth]);

  const nowSec = Math.floor(Date.now() / 1000);
  const isAuthenticated = Boolean(token && session && session.exp > nowSec);

  return {
    isAuthenticated,
    role: session?.role ?? null,
    displayName: session?.displayName ?? null,
    schoolId: session?.schoolId ?? null,
    checking,
  };
}
