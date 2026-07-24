import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_INTERNAL_URL, REFRESH_COOKIE } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_INTERNAL_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
