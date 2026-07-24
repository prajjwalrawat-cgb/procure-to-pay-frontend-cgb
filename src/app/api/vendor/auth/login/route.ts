import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, PORTAL, REFRESH_COOKIE } from '@/vendor/lib/env';

/** Vendor login proxy — sends `x-portal: vendor` so the API mints a
 *  vendor-audience JWT (Master Context §3 rule #11 / Slice 0). */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-portal': PORTAL },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });

  const res = NextResponse.json({
    user: data.user,
    accessToken: data.tokens.accessToken,
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
