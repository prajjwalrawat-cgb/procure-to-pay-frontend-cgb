'use client';

import { API_URL } from './env';
import { toApiError } from '@/lib/api-error';
import { useSessionStore } from '@/vendor/store/session-store';

/** Authenticated fetch for the vendor portal; refreshes the token once on 401. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // FormData must set its own Content-Type so the multipart boundary is included;
  // forcing application/json here would make the body unparseable server-side.
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

  const { accessToken, setSession, user } = useSessionStore.getState();
  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const refreshed = await fetch(`/api/vendor/auth/refresh`, { method: 'POST' });
    if (refreshed.ok) {
      const { accessToken: next } = (await refreshed.json()) as { accessToken: string };
      if (user) setSession(next, user);
      res = await doFetch(next);
    }
  }

  // ApiError, not Error — a 422 carries per-field issues the wizard needs to show.
  if (!res.ok) throw await toApiError(res, 'Request failed');
  return res.json() as Promise<T>;
}

/** Fetch a binary asset (PDF) with the bearer token and open it in a new tab. */
export async function openAuthedAsset(path: string): Promise<void> {
  const win = window.open('', '_blank');
  const doFetch = (token: string | null): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  const { accessToken, setSession, user } = useSessionStore.getState();
  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const refreshed = await fetch(`/api/vendor/auth/refresh`, { method: 'POST' });
    if (refreshed.ok) {
      const { accessToken: next } = (await refreshed.json()) as { accessToken: string };
      if (user) setSession(next, user);
      res = await doFetch(next);
    }
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
