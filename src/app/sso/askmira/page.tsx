'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { safeNextPath } from '@/lib/auth-session';
import { useSessionStore } from '@/store/session-store';

/**
 * /sso/askmira#token=… — someone opened ProcureFlow from AskMiraa. The one-time
 * link rides in the fragment, which never reaches a server log; this page hands
 * it to /api/askmira/launch, which opens a normal session.
 */
export default function AskMiraSignInPage(): React.JSX.Element {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token');
    const next = hash.get('next');
    // The link works once; take it out of the address bar and history.
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setError('This AskMiraa link is not complete. Open ProcureFlow again from AskMiraa.');
      return;
    }
    fetch('/api/askmira/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.accessToken) {
          setError(data.detail ?? 'Could not sign you in. Open ProcureFlow again from AskMiraa.');
          return;
        }
        setSession(data.accessToken, data.user);
        router.replace(safeNextPath(next, '/'));
      })
      .catch(() => setError('Could not reach ProcureFlow. Try again in a minute.'));
  }, [router, setSession]);

  return (
    <main className="bg-canvas flex min-h-screen items-center justify-center px-4">
      <div className="border-line bg-panel w-full max-w-sm rounded-xl border p-8 shadow-lg">
        <p className="text-ink text-h3 font-semibold">ProcureFlow</p>
        {error ? (
          <p role="alert" className="text-body-sm text-danger mt-3">
            {error}
          </p>
        ) : (
          <p className="text-body-sm text-muted mt-3">Signing you in from AskMiraa…</p>
        )}
      </div>
    </main>
  );
}
