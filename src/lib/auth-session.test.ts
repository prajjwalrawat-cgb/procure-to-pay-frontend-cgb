import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRefresher, safeNextPath } from './auth-session';
import { SESSION_ENDED_PARAM } from './session-ended';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Single-flight matters for correctness, not just efficiency: the refresh token
 * rotates, so if concurrent 401s each refreshed independently only the first
 * would succeed and the rest would look like a dead session — which now logs
 * the user out.
 */
describe('createRefresher', () => {
  it('coalesces concurrent refreshes into one request', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return { ok: true, json: async () => ({ accessToken: 'fresh' }) } as Response;
    });
    const onToken = vi.fn();
    const refresh = createRefresher({ endpoint: '/api/auth/refresh', onToken });

    const results = await Promise.all([refresh(), refresh(), refresh()]);

    expect(calls).toBe(1);
    expect(results).toEqual(['fresh', 'fresh', 'fresh']);
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('fresh');
  });

  it('allows a new refresh after the previous one settles', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return { ok: true, json: async () => ({ accessToken: `t${calls}` }) } as Response;
    });
    const refresh = createRefresher({ endpoint: '/e', onToken: () => undefined });

    expect(await refresh()).toBe('t1');
    expect(await refresh()).toBe('t2');
    expect(calls).toBe(2);
  });

  it('returns null when the refresh token is rejected', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false }) as Response);
    const onToken = vi.fn();
    const refresh = createRefresher({ endpoint: '/e', onToken });

    expect(await refresh()).toBeNull();
    expect(onToken).not.toHaveBeenCalled();
  });

  it('returns null when the network throws rather than propagating', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const refresh = createRefresher({ endpoint: '/e', onToken: () => undefined });
    await expect(refresh()).resolves.toBeNull();
  });
});

/** `next` comes off the URL, so it is attacker-controlled. */
describe('safeNextPath', () => {
  it('returns the fallback when absent or unparseable', () => {
    expect(safeNextPath(null, '/vendor')).toBe('/vendor');
    expect(safeNextPath('%E0%A4%A', '/vendor')).toBe('/vendor');
  });

  it('honours a same-origin path, including its query', () => {
    expect(safeNextPath('%2Fvendor%2Fonboarding', '/vendor')).toBe('/vendor/onboarding');
    expect(safeNextPath('/vendor/onboarding?step=3', '/vendor')).toBe(
      '/vendor/onboarding?step=3',
    );
  });

  it('refuses to bounce to another origin', () => {
    expect(safeNextPath('https://evil.example.com', '/vendor')).toBe('/vendor');
    expect(safeNextPath('//evil.example.com', '/vendor')).toBe('/vendor');
    expect(safeNextPath(encodeURIComponent('//evil.example.com'), '/vendor')).toBe('/vendor');
    expect(safeNextPath('javascript:alert(1)', '/vendor')).toBe('/vendor');
  });
});

describe('safeNextPath — bounce loops', () => {
  it('refuses a destination that is itself another bounce', () => {
    // The shape seen in the wild: `next` nested inside `next`, re-encoded on
    // every cycle. Following it would put the user straight back in the loop.
    expect(safeNextPath('%2F%3Fnext%3D%252F%253Fnext%253D%25252F', '/')).toBe('/');
  });

  it('still honours an ordinary destination', () => {
    expect(safeNextPath('%2Finvoices%2Finv_1', '/')).toBe('/invoices/inv_1');
  });

  it('still refuses an off-site destination', () => {
    expect(safeNextPath('%2F%2Fevil.example', '/')).toBe('/');
  });
});

/**
 * `endSession` keeps module state (a one-shot redirect guard), so each case
 * imports a fresh copy. `window.location.replace` is stubbed to record the
 * destination rather than navigate.
 */
async function endSessionOn(
  href: string,
  loginPath = '/login',
): Promise<{ replaced: string | null; cleared: boolean }> {
  vi.resetModules();
  const url = new URL(href, 'https://portal.example');
  let replaced: string | null = null;
  vi.stubGlobal('window', {
    location: {
      pathname: url.pathname,
      search: url.search,
      replace: (to: string) => {
        replaced = to;
      },
    },
  });
  let cleared = false;
  const { endSession } = await import('./auth-session');
  endSession(loginPath, () => {
    cleared = true;
  });
  return { replaced, cleared };
}

describe('endSession', () => {
  it('clears the session and bounces to the login page, remembering where they were', async () => {
    const { replaced, cleared } = await endSessionOn('/invoices/inv_1');
    expect(cleared).toBe(true);
    expect(replaced).toBe(`/login?next=%2Finvoices%2Finv_1&${SESSION_ENDED_PARAM}=1`);
  });

  it('flags the bounce so the middleware does not send them back into the portal', async () => {
    /*
     * Without the flag the middleware sees the still-present (but dead) refresh
     * cookie, treats it as a live session and redirects to `/` — where the app
     * fails to refresh and bounces here again. That was the loop that left the
     * URL stuck on `/?next=%2F` and reloaded the page endlessly.
     */
    const { replaced } = await endSessionOn('/');
    expect(replaced).toContain(`${SESSION_ENDED_PARAM}=1`);
  });

  it('does not nest `next` inside itself when bouncing a page that carries one', async () => {
    const { replaced } = await endSessionOn('/invoices?next=%2Fold&tab=open');
    expect(replaced).toBe(
      `/login?next=%2Finvoices%3Ftab%3Dopen&${SESSION_ENDED_PARAM}=1`,
    );
  });

  it('does not carry the flag into the destination it captures', async () => {
    // It belongs to the hop, not to the page the user is being returned to.
    const { replaced } = await endSessionOn(`/invoices?${SESSION_ENDED_PARAM}=1`);
    expect(replaced).toBe(`/login?next=%2Finvoices&${SESSION_ENDED_PARAM}=1`);
  });

  it('clears the session but does not navigate when already on the login page', async () => {
    const { replaced, cleared } = await endSessionOn('/login?next=%2F');
    expect(cleared).toBe(true);
    expect(replaced).toBeNull();
  });

  it('redirects only once when several failures land together', async () => {
    vi.resetModules();
    const replaced: string[] = [];
    vi.stubGlobal('window', {
      location: {
        pathname: '/invoices',
        search: '',
        replace: (to: string) => replaced.push(to),
      },
    });
    const { endSession } = await import('./auth-session');
    endSession('/login', () => undefined);
    endSession('/login', () => undefined);
    endSession('/login', () => undefined);
    expect(replaced).toHaveLength(1);
  });

  it('sends a vendor to the vendor login', async () => {
    const { replaced } = await endSessionOn('/vendor/invoices', '/vendor/login');
    expect(replaced).toBe(
      `/vendor/login?next=%2Fvendor%2Finvoices&${SESSION_ENDED_PARAM}=1`,
    );
  });
});
