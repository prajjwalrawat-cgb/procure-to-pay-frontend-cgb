import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { REFRESH_COOKIE as BUYER_COOKIE } from '@/lib/env';
import { SESSION_ENDED_PARAM } from '@/lib/session-ended';
import { REFRESH_COOKIE as VENDOR_COOKIE } from '@/vendor/lib/env';

import { middleware } from './middleware';

const ORIGIN = 'https://portal.example';

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const req = new NextRequest(new URL(path, ORIGIN));
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

/** `location`, relative to the origin, or null when the request was let through. */
function redirectedTo(res: ReturnType<typeof middleware>): string | null {
  if (res.status !== 307 && res.status !== 308) return null;
  const location = res.headers.get('location');
  return location === null ? null : location.slice(ORIGIN.length);
}

describe('middleware — gating', () => {
  it('sends a cookieless buyer request to the buyer login', () => {
    expect(redirectedTo(middleware(request('/invoices')))).toBe('/login');
  });

  it('sends a cookieless vendor request to the vendor login', () => {
    expect(redirectedTo(middleware(request('/vendor/invoices')))).toBe('/vendor/login');
  });

  it('lets a request with the matching cookie through', () => {
    expect(
      redirectedTo(middleware(request('/invoices', { [BUYER_COOKIE]: 't' }))),
    ).toBeNull();
    expect(
      redirectedTo(middleware(request('/vendor/invoices', { [VENDOR_COOKIE]: 't' }))),
    ).toBeNull();
  });

  it('keeps the two portals on separate cookies', () => {
    // A buyer cookie is no key to the vendor zone, and vice versa.
    expect(redirectedTo(middleware(request('/vendor', { [BUYER_COOKIE]: 't' })))).toBe(
      '/vendor/login',
    );
    expect(redirectedTo(middleware(request('/', { [VENDOR_COOKIE]: 't' })))).toBe(
      '/login',
    );
  });

  it('leaves the public auth pages reachable without a cookie', () => {
    for (const path of [
      '/login',
      '/accept-invite',
      '/forgot-password',
      '/reset-password',
    ]) {
      expect(redirectedTo(middleware(request(path)))).toBeNull();
    }
    for (const path of [
      '/vendor/login',
      '/vendor/signup',
      '/vendor/accept-invite',
      '/vendor/forgot-password',
      '/vendor/reset-password',
    ]) {
      expect(redirectedTo(middleware(request(path)))).toBeNull();
    }
  });
});

/**
 * The cookie is a coarse gate and can outlive the session it names — the
 * refresh route never deletes it on a 401, because that failure can be a lost
 * rotation race against another tab. These tests pin shut the loop that used to
 * cause: the client bounced to /login, the middleware saw the dead cookie and
 * bounced it back into the portal, the portal failed to refresh and bounced to
 * /login again, forever, with the URL stuck on `/?next=%2F`.
 */
describe('middleware — dead-cookie redirect loop', () => {
  it('lets the login page render when the client says the cookie was refused', () => {
    expect(
      redirectedTo(
        middleware(
          request(`/login?next=%2F&${SESSION_ENDED_PARAM}=1`, { [BUYER_COOKIE]: 'dead' }),
        ),
      ),
    ).toBeNull();
    expect(
      redirectedTo(
        middleware(
          request(`/vendor/login?next=%2Fvendor&${SESSION_ENDED_PARAM}=1`, {
            [VENDOR_COOKIE]: 'dead',
          }),
        ),
      ),
    ).toBeNull();
  });

  it('still bounces a signed-in user off the login page they merely visited', () => {
    expect(redirectedTo(middleware(request('/login', { [BUYER_COOKIE]: 't' })))).toBe(
      '/',
    );
    expect(
      redirectedTo(middleware(request('/vendor/login', { [VENDOR_COOKIE]: 't' }))),
    ).toBe('/vendor');
  });

  it('drops the login page query when bouncing, rather than stranding `next` on the destination', () => {
    // Cloning the URL carried `?next=%2F` onto `/`, which is the `/?next=%2F`
    // the loop left in the address bar.
    expect(
      redirectedTo(
        middleware(request('/login?next=%2Finvoices', { [BUYER_COOKIE]: 't' })),
      ),
    ).toBe('/');
  });
});
