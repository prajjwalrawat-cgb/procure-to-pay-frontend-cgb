import { NextResponse, type NextRequest } from 'next/server';

import { REFRESH_COOKIE } from '@/lib/env';

export function middleware(request: NextRequest): NextResponse {
  const hasSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login';

  // Redirect via nextUrl.clone() so the /vendor basePath is preserved (a bare
  // new URL('/login', request.url) would drop it and bounce to the buyer portal).
  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
