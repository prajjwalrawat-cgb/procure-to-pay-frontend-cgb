'use client';

import { useEffect } from 'react';

/**
 * Opens a tabbed list on the tab named in `?tab=` — how the Home tiles deep
 * link (e.g. /invoices?tab=exceptions). Read once on mount from
 * `window.location` rather than `useSearchParams`, which would need a Suspense
 * boundary around every list page to prerender. Unknown values are ignored.
 */
export function useInitialTab<T extends string>(
  validTabs: readonly T[],
  setTab: (tab: T) => void,
): void {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && (validTabs as readonly string[]).includes(requested)) {
      setTab(requested as T);
    }
    // Mount only: later tab changes are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
