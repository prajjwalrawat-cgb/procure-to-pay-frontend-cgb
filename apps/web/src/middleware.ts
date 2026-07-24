import { NextResponse, type NextRequest } from 'next/server';

import { REFRESH_COOKIE } from '@/lib/env';

/**
 * Route gate: unauthenticated users (no refresh cookie) are redirected to
 * /login; authenticated users hitting /login go to the shell. Presence of the
 * httpOnly cookie is the coarse gate — the API re-validates on every call.
 */
export function middleware(request: NextRequest): NextResponse {
  const hasSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login';

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the auth route handlers, static assets,
  // and the /vendor zone (proxied to the vendor app, which guards itself).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|vendor).*)'],
};
