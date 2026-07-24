import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, PORTAL, REFRESH_COOKIE } from '@/lib/env';

/**
 * Login proxy. Forwards credentials to the API, then stores the refresh token
 * in an httpOnly cookie (never returned to JS) and hands the access token +
 * user back to the client for in-memory storage (Master Context Slice 0).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-portal': PORTAL },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = NextResponse.json({
    user: data.user,
    accessToken: data.tokens.accessToken,
    expiresIn: data.tokens.expiresIn,
    mfaRequired: data.mfaRequired ?? false,
  });

  if (data.tokens.refreshToken) {
    res.cookies.set(REFRESH_COOKIE, data.tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return res;
}
