'use client';

import { SESSION_ENDED_PARAM } from './session-ended';

/**
 * Shared session plumbing for both portals' API clients.
 *
 * Two rules live here, and they depend on each other:
 *
 * 1. Refreshing must be single-flight. The refresh token rotates, so if several
 *    requests each refreshed on their own 401 only the first would succeed and
 *    the rest would be told the session is dead.
 * 2. When a refresh genuinely fails the session is over, so the app must stop
 *    pretending otherwise. Previously the failure just fell through to a thrown
 *    error: the store still held the user, the shell still rendered as
 *    signed-in, and every action produced a bearer-token error. A vendor who
 *    left the onboarding wizard open for days hit exactly that.
 *
 * Rule 2 is only safe because of rule 1 — without single-flight, a routine
 * concurrent refresh would log people out mid-session.
 */

/** Builds a single-flight refresher for one portal's refresh endpoint. */
export function createRefresher(opts: {
  endpoint: string;
  /** Store the new token. Read the user from the store here, not at build time. */
  onToken: (accessToken: string) => void;
}): () => Promise<string | null> {
  let inFlight: Promise<string | null> | null = null;

  return () => {
    if (!inFlight) {
      inFlight = (async (): Promise<string | null> => {
        try {
          const res = await fetch(opts.endpoint, { method: 'POST' });
          if (!res.ok) return null;
          const { accessToken } = (await res.json()) as { accessToken: string };
          opts.onToken(accessToken);
          return accessToken;
        } catch {
          return null;
        } finally {
          // Allow a fresh attempt on the next expiry once this one settles.
          inFlight = null;
        }
      })();
    }
    return inFlight;
  };
}

/** Set once we start navigating away, so parallel 401s don't each redirect. */
let redirecting = false;

/**
 * The access token expired and the refresh token could not renew it, so the
 * session is genuinely over. Clear it and send the user to the right login,
 * remembering where they were so they can be returned there.
 */
export function endSession(loginPath: string, clear: () => void): void {
  clear();
  if (typeof window === 'undefined' || redirecting) return;

  const { pathname, search } = window.location;
  // Already on the login page — nothing to bounce, and no loop to start.
  if (pathname === loginPath) return;

  redirecting = true;
  /*
   * Drop any `next` already on the URL before capturing it as the new one.
   *
   * Without this the parameter nests inside itself on every bounce, re-encoded
   * each time: `/?next=%2F%3Fnext%3D%252F%253Fnext%253D…`. One transient
   * refresh failure while sitting on a page that had already been bounced once
   * was enough to start it, and the URL then doubled in length per cycle. The
   * destination never changes — only the encoding grows — so the parameter is
   * pure noise after the first hop.
   */
  const params = new URLSearchParams(search);
  params.delete('next');
  // Never carry the marker into the destination either — it belongs to the hop,
  // not to the page the user is being returned to.
  params.delete(SESSION_ENDED_PARAM);
  const rest = params.toString();
  const next = encodeURIComponent(`${pathname}${rest ? `?${rest}` : ''}`);
  window.location.replace(`${loginPath}?next=${next}&${SESSION_ENDED_PARAM}=1`);
}

/**
 * Safe post-login destination from a `?next=` param. Only same-origin paths are
 * honoured: an absolute URL would let a crafted link bounce someone to another
 * site carrying the trust of having just signed in.
 */
export function safeNextPath(next: string | null, fallback: string): string {
  if (!next) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  // Must be a rooted path, and not protocol-relative ("//evil.com").
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback;
  /*
   * Refuse a destination that is itself another bounce. Belt and braces with
   * the strip in `endSession`: a link from an older build, a bookmarked URL, or
   * anything else carrying a nested `next` would otherwise send the user
   * straight back into the loop the moment they signed in.
   */
  if (decoded.includes('next=')) return fallback;
  return decoded;
}
