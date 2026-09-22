'use client';

import { apiFetch } from '@/lib/api-client';

/** Every list endpoint answers with this envelope (plus per-endpoint extras like `counts`). */
interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}

/** A list envelope after fetchAllPages: every row, plus whether the cap was hit. */
export type AllPages<R> = R & { truncated?: boolean };

/** Hard stop, so a runaway tenant cannot pull an unbounded list into the tab. */
const MAX_ROWS = 2000;
const PAGE_SIZE = 200;

/**
 * Follows `nextCursor` until the list is exhausted and returns one envelope
 * holding every row. The list screens sort and filter client-side (the API has
 * no sort parameter and ignores several filter params), so they need the whole
 * set — sorting only the first 50 rows would silently mislead.
 *
 * Extras from the first page (e.g. `counts`) are kept. `truncated` is true when
 * MAX_ROWS was hit, so a screen can say "showing the first 2,000".
 */
export async function fetchAllPages<R extends Page<unknown>>(
  path: string,
): Promise<R & { truncated: boolean }> {
  const [pathname, query = ''] = path.split('?');
  const pageUrl = (cursor: string | null): string => {
    const params = new URLSearchParams(query);
    params.set('limit', String(PAGE_SIZE));
    if (cursor) params.set('cursor', cursor);
    else params.delete('cursor');
    return `${pathname}?${params.toString()}`;
  };

  const first = await apiFetch<R>(pageUrl(null));
  const items = [...first.items];
  let cursor = first.nextCursor ?? null;
  while (cursor && items.length < MAX_ROWS) {
    const next = await apiFetch<R>(pageUrl(cursor));
    items.push(...next.items);
    cursor = next.nextCursor ?? null;
  }
  return { ...first, items: items.slice(0, MAX_ROWS), nextCursor: null, truncated: !!cursor };
}
