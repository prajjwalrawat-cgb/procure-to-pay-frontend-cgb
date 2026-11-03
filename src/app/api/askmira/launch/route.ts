import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, REFRESH_COOKIE } from '@/lib/env';

/**
 * Sign-in from AskMira. The /sso/askmira page posts AskMira's one-time link
 * here; the API checks it and opens a session, and — exactly as the login
 * proxy does — the refresh token goes into the httpOnly cookie and only the
 * access token and the user go back to the page.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let token = '';
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === 'string' ? body.token : '';
  } catch {
    token = '';
  }
  if (!token || token.length > 4000) {
    return NextResponse.json({ detail: 'This AskMira link is not valid.' }, { status: 401 });
  }

  const upstream = await fetch(`${API_INTERNAL_URL}/integrations/askmira/launch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': request.headers.get('user-agent') ?? '',
    },
    body: JSON.stringify({ token }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { detail: data.detail ?? 'Could not sign you in from AskMira.' },
      { status: upstream.status },
    );
  }

  const res = NextResponse.json({
    user: data.user,
    accessToken: data.tokens.accessToken,
    expiresIn: data.tokens.expiresIn,
  });
  res.cookies.set(REFRESH_COOKIE, data.tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
