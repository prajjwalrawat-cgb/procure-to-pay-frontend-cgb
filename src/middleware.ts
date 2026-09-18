import { NextResponse, type NextRequest } from 'next/server';

import { REFRESH_COOKIE as BUYER_COOKIE } from '@/lib/env';
import { SESSION_ENDED_PARAM } from '@/lib/session-ended';
import { REFRESH_COOKIE as VENDOR_COOKIE } from '@/vendor/lib/env';

/**
 * Route gate for the single app that now hosts both portals:
 *   - buyer zone at `/*`         → gated by the buyer refresh cookie, /login
 *   - vendor zone at `/vendor/*` → gated by the vendor refresh cookie, /vendor/login
 * Each zone keeps its own httpOnly refresh cookie (separate JWT audiences), so
 * a buyer and a vendor session can coexist in the same browser. Presence of the
 * cookie is the coarse gate — the API re-validates the token on every call.
 *
 * Because it is only a coarse gate, the cookie can outlive the session it names:
 * the refresh route never deletes it on a 401 (that failure can be a lost
 * rotation race against another tab). So "has cookie" must not be treated as
 * proof of a live session when the client has just proved otherwise — see
 * `signedOutBounce` below.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // --- Vendor zone ---
  if (pathname === '/vendor' || pathname.startsWith('/vendor/')) {
    // Public vendor pages reachable without a session: sign-in, self-signup, the
    // emailed magic set-password link (invited vendors have no session yet), and
    // password recovery — a locked-out vendor has no session by definition.
    const isVendorAuth =
      pathname === '/vendor/login' ||
      pathname === '/vendor/signup' ||
      pathname === '/vendor/accept-invite' ||
      pathname === '/vendor/forgot-password' ||
      pathname === '/vendor/reset-password';
    const hasVendorSession = Boolean(request.cookies.get(VENDOR_COOKIE)?.value);

    if (!hasVendorSession && !isVendorAuth) {
      const url = request.nextUrl.clone();
      url.pathname = '/vendor/login';
      return NextResponse.redirect(url);
    }
    if (hasVendorSession && pathname === '/vendor/login') {
      const bounce = signedOutBounce(request, '/vendor');
      if (bounce) return bounce;
    }
    return NextResponse.next();
  }

  // --- Buyer zone ---
  const hasBuyerSession = Boolean(request.cookies.get(BUYER_COOKIE)?.value);
  const isBuyerLogin = pathname === '/login';
  // Public buyer pages reachable without a session (invited users set their
  // password here before they can log in, and anyone locked out recovers here).
  const isBuyerPublic =
    isBuyerLogin ||
    pathname === '/accept-invite' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

  if (!hasBuyerSession && !isBuyerPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (hasBuyerSession && isBuyerLogin) {
    const bounce = signedOutBounce(request, '/');
    if (bounce) return bounce;
  }
  return NextResponse.next();
}

/**
 * Redirect a request that carries a session cookie away from a login page and
 * back into its portal — unless the client has flagged that this very cookie
 * was just refused, in which case the login page is exactly where they belong.
 *
 * Returning `null` (let the login page render) is what breaks the loop a dead
 * refresh cookie used to cause: client bounces to /login, middleware bounces it
 * back to the app, the app fails to refresh and bounces to /login again. The
 * page reloaded endlessly and the URL sat on `/?next=%2F`; only signing out,
 * which clears the cookie, escaped it.
 */
function signedOutBounce(request: NextRequest, home: string): NextResponse | null {
  if (request.nextUrl.searchParams.has(SESSION_ENDED_PARAM)) return null;
  const url = request.nextUrl.clone();
  url.pathname = home;
  // Drop `?next=` and friends: they addressed the login page, and cloning the
  // URL would otherwise strand them on the destination (`/?next=%2F`).
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, static assets, and API routes. The API
  // route handlers (/api/auth/*, /api/vendor/auth/*) and the /api/v1 proxy
  // authorize themselves, so they must not be gated by this page middleware.
  //
  // The scanner PWA's install assets are exempt too (Slice 13). The browser
  // fetches a manifest *without* credentials unless it is tagged
  // crossorigin="use-credentials", so gating it on the session cookie redirects
  // it to /login and the app silently stops being installable. A service worker
  // script cannot register through a redirect at all. None of these files carry
  // tenant data — the pages they bootstrap are still gated normally.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|sw.js|manifest.webmanifest|icons/).*)',
  ],
};
