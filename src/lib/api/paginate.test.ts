import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/api-client', () => ({ apiFetch: (p: string) => apiFetch(p) }));

import { fetchAllPages } from './paginate';

describe('fetchAllPages', () => {
  beforeEach(() => apiFetch.mockReset());

  it('follows the cursor, replaces any limit, and keeps first-page extras', async () => {
    apiFetch
      .mockResolvedValueOnce({ items: [1, 2], nextCursor: 'b', counts: { all: 3 } })
      .mockResolvedValueOnce({ items: [3], nextCursor: null });
    const out = await fetchAllPages<{ items: number[]; nextCursor: string | null; counts: object }>(
      '/invoices?tab=all&limit=50',
    );
    expect(apiFetch.mock.calls.map((c) => c[0])).toEqual([
      '/invoices?tab=all&limit=200',
      '/invoices?tab=all&limit=200&cursor=b',
    ]);
    expect(out.items).toEqual([1, 2, 3]);
    expect(out.counts).toEqual({ all: 3 });
    expect(out.truncated).toBe(false);
  });

  it('works for a path with no query string', async () => {
    apiFetch.mockResolvedValueOnce({ items: [], nextCursor: null });
    await fetchAllPages('/grn');
    expect(apiFetch).toHaveBeenCalledWith('/grn?limit=200');
  });
});
