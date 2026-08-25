import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, REFRESH_COOKIE } from '@/vendor/lib/env';

export async function POST(): Promise<NextResponse> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ error: 'no_session' }, { status: 401 });

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    /*
     * Do NOT delete the cookie here.
     *
     * The refresh token rotates in place, so a failure is not proof the session
     * is over — it can equally mean another tab refreshed a moment earlier and
     * this request presented the token that one consumed. Deleting on that
     * basis destroyed the cookie the successful tab had just been issued,
     * turning one tab's lost race into every tab being signed out.
     *
     * Leaving a dead token in the jar costs nothing: it is httpOnly, the server
     * rejects it, and the next sign-in overwrites it. The client calls
     * endSession on this 401 anyway, which clears the store and redirects.
     */
    return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
  }

  const res = NextResponse.json({ accessToken: data.accessToken });
  res.cookies.set(REFRESH_COOKIE, data.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
