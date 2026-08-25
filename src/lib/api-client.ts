'use client';

import { API_URL } from './env';
import { toApiError } from './api-error';
import { createRefresher, endSession } from './auth-session';
import { useSessionStore } from '@/store/session-store';

/**
 * Single-flight token refresh. When several requests 401 at once (e.g. the
 * sidebar + notifications polling firing together after the access token
 * expires), they must NOT each call /api/auth/refresh independently — the
 * refresh token rotates, so only the first would succeed and the rest would
 * 401 and bounce the user to login. Instead they all await the one in-flight
 * refresh and share its new access token.
 *
 * Exported because the shell's bootstrap must go through it too. It used to
 * call the endpoint with a raw `fetch`, which put a second uncoordinated caller
 * outside the single-flight guard — see app-shell.tsx.
 */
export const refreshAccessToken = createRefresher({
  endpoint: '/api/auth/refresh',
  onToken: (accessToken) => {
    const { user, setSession } = useSessionStore.getState();
    if (user) setSession(accessToken, user);
  },
});

/** The refresh token is gone too — end the session rather than look signed in. */
function expired(): void {
  endSession('/login', useSessionStore.getState().clear);
}

/**
 * Thin authenticated fetch for browser calls to the API. Attaches the in-memory
 * access token; on a 401 it silently refreshes once (coalesced across callers)
 * and retries. No token is ever read from or written to localStorage.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // FormData must set its own Content-Type so the multipart boundary is
  // included; forcing application/json would make the server reject the upload.
  const isFormData = init.body instanceof FormData;
  const doFetch = (token: string | null): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

  const { accessToken } = useSessionStore.getState();
  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const next = await refreshAccessToken();
    if (next) res = await doFetch(next);
    else expired();
  }

  // ApiError, not Error — a 422 carries per-field issues the form needs to show.
  if (!res.ok) throw await toApiError(res, 'Request failed');
  return res.json() as Promise<T>;
}

/**
 * Fetch a binary asset (e.g. a PDF) with the bearer token and open it in a new
 * tab. A raw `window.open(API_URL…)` cannot attach the in-memory token, so the
 * API rejects it with 401 — this fetches the blob authenticated instead. The tab
 * is opened synchronously first to preserve the click gesture (popup blockers).
 */
export async function openAuthedAsset(path: string): Promise<void> {
  const win = window.open('', '_blank');
  const doFetch = (token: string | null): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  const { accessToken } = useSessionStore.getState();
  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const next = await refreshAccessToken();
    if (next) res = await doFetch(next);
    else expired();
  }
  if (!res.ok) {
    win?.close();
    throw await toApiError(res, 'Download failed');
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
