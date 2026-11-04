import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, REFRESH_COOKIE } from '@/lib/env';

/**
 * Switch the session into another organisation the user belongs to. The API
 * takes the refresh token as proof of identity, so it has to go through this
 * route — the browser cannot read the httpOnly cookie — and the new refresh
 * token (bound to the target organisation) replaces it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }
  const { tenantId } = (await request.json()) as { tenantId?: string };

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/switch-workspace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': request.headers.get('user-agent') ?? '',
    },
    body: JSON.stringify({ refreshToken, tenantId }),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = NextResponse.json({ user: data.user, accessToken: data.tokens.accessToken });
  res.cookies.set(REFRESH_COOKIE, data.tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
