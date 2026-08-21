'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

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
    <div className="flex min-h-[100dvh] flex-col bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-3">
          {atRoot ? (
            <span className="text-[15px] font-semibold">Scanner</span>
          ) : (
            <>
              <button
                type="button"
                aria-label="Back"
                // A 44px target: this is pressed with gloves on.
                className="-ml-1 h-11 w-11 text-[20px] text-muted hover:text-ink"
                onClick={() => router.push('/scan')}
              >
                ‹
              </button>
              <span className="text-[15px] font-semibold">{title}</span>
            </>
          )}
        </div>
        <div className="px-3 pb-2">
          <SyncStatus />
        </div>
      </header>

      <main className="flex-1 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {!atRoot ? (
        <footer className="border-t border-line bg-white px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <Link href="/scan" className="block py-2 text-center text-[13px] text-muted">
            All tasks
          </Link>
        </footer>
      ) : null}
    </div>
  );
}
