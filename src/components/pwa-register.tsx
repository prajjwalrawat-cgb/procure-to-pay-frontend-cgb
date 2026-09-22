'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Registers the app service worker (public/app-sw.js) that makes ProcureFlow
 * installable and serves the offline page when the network drops.
 *
 * Production only. Under `next dev` the worker's cache-first rule for
 * /_next/static would pin stale chunks (dev chunk URLs do not change with their
 * content). To exercise it locally anyway, set localStorage `pf:sw` to `1` and
 * reload — and clear site data afterwards.
 *
 * The scanner registers its own worker at /scan and is left alone here.
 */
export function PwaRegister(): null {
  const pathname = usePathname();
  const inScanner = pathname.startsWith('/scan');

  useEffect(() => {
    if (inScanner || !('serviceWorker' in navigator)) return;
    let optIn = false;
    try {
      optIn = window.localStorage.getItem('pf:sw') === '1';
    } catch {
      /* storage blocked — treat as not opted in */
    }
    if (process.env.NODE_ENV !== 'production' && !optIn) return;
    // A failed registration only costs the offline page; the app still runs.
    navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(() => undefined);
  }, [inScanner]);

  return null;
}
