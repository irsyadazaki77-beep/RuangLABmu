import { useAuthStore, type ClientAuthSession } from '../stores/useAuthStore';

export interface ApiFetchOptions extends RequestInit {
  promptTeacherAuthOn401?: boolean;
  authReason?: string;
  skipAutoStudentAuth?: boolean;
}

let pendingStudentAuthPromise: Promise<string | null> | null = null;

/**
 * Ensures the client holds a valid in-memory/sessionStorage Bearer token.
 * If no token exists (or it has expired), automatically obtains a student session
 * token from `POST /api/auth/session` so authenticated endpoints work seamlessly.
 */
export async function ensureClientSession(): Promise<string | null> {
  const store = useAuthStore.getState();
  const nowSec = Math.floor(Date.now() / 1000);
  if (store.token && store.session && store.session.exp > nowSec + 30) {
    return store.token;
  }

  if (pendingStudentAuthPromise) {
    return pendingStudentAuthPromise;
  }

  pendingStudentAuthPromise = (async () => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'student',
          schoolId: 'default-school',
          displayName: 'Siswa Praktikan',
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        token?: string;
        session?: ClientAuthSession;
      };
      if (data.token && data.session) {
        useAuthStore.getState().setAuth(data.token, data.session);
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      pendingStudentAuthPromise = null;
    }
  })();

  return pendingStudentAuthPromise;
}

/**
 * Centralized fetch wrapper that injects the Bearer token (auto-provisioning a
 * student session token when needed) and optionally opens TeacherAuthGateModal on 401/403.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const {
    promptTeacherAuthOn401 = false,
    authReason,
    skipAutoStudentAuth = false,
    headers: rawHeaders,
    ...rest
  } = options;
  const headers = new Headers(rawHeaders || {});
  let token = useAuthStore.getState().token;

  if (!token && !skipAutoStudentAuth && !promptTeacherAuthOn401) {
    token = await ensureClientSession();
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...rest,
    headers,
  });

  if (promptTeacherAuthOn401 && (response.status === 401 || response.status === 403)) {
    const store = useAuthStore.getState();
    if (response.status === 401) {
      store.clearAuth();
    }
    store.openAuthPrompt(
      authReason ||
        'Sesi pengajar terverifikasi diperlukan untuk melanjutkan tindakan ini.'
    );
  }

  return response;
}
