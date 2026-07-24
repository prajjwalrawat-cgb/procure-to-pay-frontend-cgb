import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, REFRESH_COOKIE } from '@/lib/env';

/** Exchange the httpOnly refresh cookie for a fresh in-memory access token. */
export async function POST(): Promise<NextResponse> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    const res = NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const res = NextResponse.json({
    accessToken: data.accessToken,
    expiresIn: data.expiresIn,
  });
  res.cookies.set(REFRESH_COOKIE, data.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
