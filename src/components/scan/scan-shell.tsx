'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { scanQueue } from '@/lib/scan/queue';
import { useSessionStore } from '@/store/session-store';

import { SyncStatus } from './sync-status';

/** Screen titles, keyed by the first path segment after /scan. */
const TITLES: Record<string, string> = {
  box: 'Box',
  receive: 'Receive',
  putaway: 'Putaway',
  pick: 'Pick',
  count: 'Cycle count',
  transfer: 'Transfer',
  offline: 'Offline',
};

/**
 * The scanner shell: a title bar, the sync indicator, and the screen.
 *
 * Registering the service worker here rather than in the root layout keeps it
 * scoped to /scan. The rest of the app is a desktop tool on a reliable network
 * and gains nothing from being made offline-capable; a worker with site-wide
 * scope would start serving cached HTML to it too.
 */
export function ScanShell({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registration failure is not fatal: without a worker the app still runs
    // online, and the IndexedDB queue — which is what actually protects a
    // scan — is unaffected.
    navigator.serviceWorker.register('/sw.js', { scope: '/scan' }).catch(() => undefined);
  }, []);

  const segment = pathname.split('/')[2] ?? '';
  const title = TITLES[segment] ?? 'Scanner';
  const atRoot = !segment;

  return (
    // Capped and centred: the scanner is a handheld layout, and on a desktop
    // browser its full-bleed buttons stretched a metre wide.
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-paper sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 border-b border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-3">
          {atRoot ? (
            <span className="text-h3 font-semibold">Scanner</span>
          ) : (
            <>
              <button
                type="button"
                aria-label="Back"
                // A 44px target: this is pressed with gloves on.
                className="-ml-1 h-11 w-11 text-h2 text-muted hover:text-ink"
                onClick={() => router.push('/scan')}
              >
                ‹
              </button>
              <span className="text-h3 font-semibold">{title}</span>
            </>
          )}
        </div>
        <div className="space-y-1 px-3 pb-2">
          <SyncStatus />
          <AccountBar />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {!atRoot ? (
        <footer className="border-t border-line bg-white px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <Link href="/scan" className="block py-2 text-center text-body-sm text-muted">
            All tasks
          </Link>
        </footer>
      ) : null}
    </div>
  );
}

/**
 * Who is signed in, and the way out.
 *
 * Installed to a home screen, the scanner opens straight at /scan with no
 * browser chrome — no address bar, no tabs, and on iOS its own cookie jar
 * separate from Safari. Without this row, an operator signed in as the wrong
 * user has no way to switch: the permission error is correct and the app is a
 * dead end. That makes a sign-out control part of the shell, not a nicety.
 */
function AccountBar(): React.JSX.Element | null {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  // Signing out drops the queue's only route to the server, so warn if scans
  // are still waiting — they would sit on the device until someone signs back
  // in, and the operator should know that before they tap.
  useEffect(() => {
    scanQueue
      .all()
      .then((rows) => setPending(rows.filter((r) => r.status === 'pending').length))
      .catch(() => setPending(0));
  }, []);

  const signOut = useCallback(async () => {
    if (pending > 0) {
      const go = window.confirm(
        `${pending} scan${pending === 1 ? '' : 's'} still waiting to sync. ` +
          `They stay on this device until someone signs in again. Sign out anyway?`,
      );
      if (!go) return;
    }
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Offline: the local session still has to go, so carry on.
    }
    clear();
    router.replace('/login?next=%2Fscan');
  }, [clear, pending, router]);

  if (!user) return null;

  return (
    <div className="flex items-center justify-between gap-2 text-caption">
      <span className="text-muted truncate">
        Signed in as <span className="text-ink font-medium">{user.name || user.email}</span>
      </span>
      <button
        type="button"
        className="text-accent shrink-0 px-1 py-1 font-medium"
        disabled={busy}
        onClick={() => void signOut()}
      >
        {busy ? 'Signing out…' : 'Switch user'}
      </button>
    </div>
  );
}
