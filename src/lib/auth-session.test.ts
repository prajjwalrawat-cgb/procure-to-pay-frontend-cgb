import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRefresher, safeNextPath } from './auth-session';

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
