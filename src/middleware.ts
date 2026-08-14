import { NextResponse, type NextRequest } from 'next/server';

import { REFRESH_COOKIE as BUYER_COOKIE } from '@/lib/env';
import { REFRESH_COOKIE as VENDOR_COOKIE } from '@/vendor/lib/env';

/**
 * Route gate for the single app that now hosts both portals:
 *   - buyer zone at `/*`         → gated by the buyer refresh cookie, /login
 *   - vendor zone at `/vendor/*` → gated by the vendor refresh cookie, /vendor/login
 * Each zone keeps its own httpOnly refresh cookie (separate JWT audiences), so
 * a buyer and a vendor session can coexist in the same browser. Presence of the
 * cookie is the coarse gate — the API re-validates the token on every call.
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
      const url = request.nextUrl.clone();
      url.pathname = '/vendor';
      return NextResponse.redirect(url);
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
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, static assets, and API routes. The API
  // route handlers (/api/auth/*, /api/vendor/auth/*) and the /api/v1 proxy
  // authorize themselves, so they must not be gated by this page middleware.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
