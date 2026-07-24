'use client';

import { API_URL } from './env';
import { useSessionStore } from '@/store/session-store';

/**
 * Single-flight token refresh. When several requests 401 at once (e.g. the
 * sidebar + notifications polling firing together after the access token
 * expires), they must NOT each call /api/auth/refresh independently — the
 * refresh token rotates, so only the first would succeed and the rest would
 * 401 and bounce the user to login. Instead they all await the one in-flight
 * refresh and share its new access token.
 */
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<string | null> => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (!res.ok) return null;
        const { accessToken } = (await res.json()) as { accessToken: string };
        const { user, setSession } = useSessionStore.getState();
        if (user) setSession(accessToken, user);
        return accessToken;
      } catch {
        return null;
      } finally {
        // Allow a fresh refresh on the next expiry once this one settles.
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Thin authenticated fetch for browser calls to the API. Attaches the in-memory
 * access token; on a 401 it silently refreshes once (coalesced across callers)
 * and retries. No token is ever read from or written to localStorage.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

  const { accessToken } = useSessionStore.getState();
  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const next = await refreshAccessToken();
    if (next) res = await doFetch(next);
  }

  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.detail ?? `Request failed: ${res.status}`);
  }
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
  }
  if (!res.ok) {
    win?.close();
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.detail ?? `Download failed: ${res.status}`);
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
