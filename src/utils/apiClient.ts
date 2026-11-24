import { useAuthStore } from '../stores/useAuthStore';

export interface ApiFetchOptions extends RequestInit {
  promptTeacherAuthOn401?: boolean;
  authReason?: string;
}

/**
 * Centralized fetch wrapper that injects the in-memory Bearer token
 * on API requests and optionally opens the TeacherAuthGateModal on 401/403.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { promptTeacherAuthOn401 = false, authReason, headers: rawHeaders, ...rest } = options;
  const headers = new Headers(rawHeaders || {});
  const token = useAuthStore.getState().token;

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
